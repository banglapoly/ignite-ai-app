"""IGNITE-AI knowledge base + retrieval-augmented question answering, fully local.

Knowledge base (all real, all linked to a NASA source):
  * NTRS report titles/abstracts (data/corpus/ntrs_corpus.json)
  * NASA PSI investigation metadata (objective, approach, hypothesis, hardware, dates, DOI, publications)
  * NASA PSI experimental tables (small tables row by row; large ones summarised; FLEX statistics computed)
  * the 144 curated flame-spread experiment rows (with verbatim quotes)
  * curated environment/safety facts with verbatim quotes (src/content/facts.py)
  * paragraphs of three NASA web pages (combustion research, ACME, SoFIE)

Retrieval: TF-IDF (1-2 grams, sublinear tf) over passages. Answer: EXTRACTIVE - the best
matching sentences are quoted verbatim with [n] links to their sources. If the best score is
below a threshold the assistant declines. Optional local generation through Ollama
(IGNITE_LLM=ollama) is off by default and is only accepted if every number it writes
appears in the retrieved passages and it cites at least one [n].
"""
from __future__ import annotations
import json, os, re, pathlib, urllib.request
from functools import lru_cache
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer, ENGLISH_STOP_WORDS
from sklearn.metrics.pairwise import linear_kernel

from . import psi_data
from ..content import facts as F

ROOT = pathlib.Path(__file__).resolve().parents[2]
MIN_SCORE = 0.07      # below this (or with no fire/space term in the question) the assistant declines
MIN_COVERAGE = 0.6    # IDF-weighted share of the question's specific words that must appear in the top passages
ACRONYMS = {  # term in question -> PSI accession or page key
    "flex-2": "PSI-68", "flex 2": "PSI-68", "flex2": "PSI-68", "flex": "PSI-69", "bass-ii": "PSI-25", "bass ii": "PSI-25",
    "bass2": "PSI-25", "bass": "PSI-26", "spice": "PSI-107", "slice": "PSI-106", "cfi-g": "PSI-159", "cfi": "PSI-39",
    "cool flames investigation": "PSI-39", "bre": "PSI-20", "burning rate emulator": "PSI-20", "same-r": "PSI-101",
    "same": "PSI-102", "daft": "PSI-47", "saffire-iii": "PSI-100", "saffire-ii": "PSI-99", "saffire-i": "PSI-98",
    "saffire": "saffire", "sofie": "sofie", "acme": "acme", "luci": "luci", "e-field": "PSI-22", "s-flame": "PSI-23",
    "cld": "PSI-21",
}
DOMAIN = {"fire", "flame", "flames", "burn", "burning", "combustion", "oxygen", "spread", "extinction", "smoke",
          "microgravity", "gravity", "lunar", "moon", "mars", "martian", "iss", "spacecraft", "flammability", "soot",
          "droplet", "fuel", "suppression", "extinguisher", "detector", "ventilation", "nasa", "experiment", "psi",
          "ntrs", "astronaut", "crew", "cabin", "pressure", "co2", "methane", "ethylene", "heptane", "methanol", "sibal",
          "pmma", "nomex", "mylar", "ultem", "cellulose", "cool", "orbit", "transit", "rocket", "space", "station"}


GENERIC = {"space", "station", "iss", "nasa", "does", "happen", "happens", "tell", "explain", "like", "work", "works",
           "know", "use", "used", "make", "goes", "go", "thing", "things", "good", "best", "way", "ways", "need", "want"}
EXPAND = {  # tiny deterministic query expansion for common phrasings (domain vocabulary only)
    "look": "shape appearance spherical rounded color visible", "looks": "shape appearance spherical rounded color visible",
    "shape": "spherical rounded teardrop", "appear": "shape appearance visible", "invisible": "invisible visible dim pale cool flame",
    "see": "visible invisible", "alarm": "verified fire alarm response isolate detection", "extinguish": "extinguisher suppression extinction",
    "extinguishers": "extinguisher suppression", "put": "suppression extinguish", "moon": "lunar", "lunar": "moon", "mars": "martian",
    "martian": "mars", "detect": "detection detector smoke", "vent": "ventilation air flow", "fan": "ventilation air flow",
    "respond": "response isolate", "response": "isolate removing power air circulation", "dangerous": "hazard flammable",
    "safer": "safety", "fast": "rate speed velocity", "slow": "rate speed velocity", "speed": "rate velocity",
    "quickly": "rate speed", "find": "results found", "found": "results", "learn": "results", "fires": "fire flame",
}


def _expand(q: str) -> str:
    toks = re.findall(r"[a-z0-9\-]+", q.lower())
    return q + " " + " ".join(EXPAND[t] for t in toks if t in EXPAND)


def _coverage(q: str, hits: list[dict]) -> float:
    """IDF-weighted share of the question's specific words that occur in the top passages."""
    _, vec, _ = index()
    voc, idf = vec.vocabulary_, vec.idf_
    maxidf = float(idf.max())
    toks = [t for t in re.findall(r"[a-z0-9][a-z0-9\-]*", q.lower()) if t not in ENGLISH_STOP_WORDS and t not in GENERIC and len(t) > 2]
    if not toks:
        return 0.0
    body = " ".join((h["title"] + " " + h["text"]).lower() for h in hits[:4])
    tot = got = 0.0
    for t in toks:
        w = float(idf[voc[t]]) if t in voc else maxidf
        tot += w
        alts = [t] + EXPAND.get(t, "").split()
        for a in alts:
            stem = a[:-1] if a.endswith("s") and len(a) > 4 else a
            if re.search(r"(?<![a-z0-9])" + re.escape(stem), body):
                got += w
                break
    return got / tot if tot else 0.0


def _sentences(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text or "").strip()
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9(\"'])", text)
    return [p.strip() for p in parts if len(p.strip()) > 25]


def _p(pid, kind, title, text, url, label, quote=None, data=None):
    """text = what is indexed. quote = verbatim source text that may be quoted. data = a templated
    statement built from a real table/row (shown without quotation marks, labelled as data)."""
    clean = lambda t: re.sub(r"\s+", " ", t or "").strip()
    return {"id": pid, "kind": kind, "title": title, "text": clean(text), "url": url, "source": label,
            "quote": clean(quote) if quote is not None else None, "data": clean(data) if data is not None else None}


def _fmt(v):
    if isinstance(v, float):
        return f"{v:g}"
    return str(v)


@lru_cache(maxsize=1)
def passages() -> list[dict]:
    out: list[dict] = []
    # 1. NTRS abstracts, chunked into windows of 3 sentences
    for d in json.loads((ROOT / "data/corpus/ntrs_corpus.json").read_text(encoding="utf-8")):
        sents = _sentences(d.get("abstract") or "")
        label = f"NTRS {d['ntrs_id']}: {d['title']}"
        if not sents:
            out.append(_p(f"ntrs-{d['ntrs_id']}-t", "ntrs", d["title"], d["title"] + ".", d["url"], label, quote="")); continue
        for i in range(0, len(sents), 3):
            chunk = " ".join(sents[i:i + 3])
            out.append(_p(f"ntrs-{d['ntrs_id']}-{i}", "ntrs", d["title"], d["title"] + ". " + chunk, d["url"], label, quote=chunk))
    # 2. PSI investigation metadata
    for inv in psi_data.investigations():
        acr = inv.get("investigationAcronym") or ""
        name = f"{inv['accession']} {acr} - {inv['title']}".replace("  ", " ")
        label = f"NASA PSI {inv['accession']}: {inv['title']}" + (f" ({acr})" if acr else "")
        for field in ("objective", "approach", "hypothesis", "researchImpacts"):
            t = inv.get(field) or ""
            if t.strip():
                out.append(_p(f"psi-{inv['accession']}-{field}", "psi", name, f"{name}. {field.replace('researchImpacts', 'Research impacts').capitalize()}: {t}", inv["url"], label, quote=t))
        tabs = "; ".join(t["file_name"] for t in inv.get("experimental_tables", []))
        meta = (f"{name}. Investigation metadata: flight program {inv.get('flightProgram') or 'n/a'}; hardware {inv.get('experimentHardware') or 'n/a'}; "
                f"managing center {inv.get('managingNasaCenter') or 'n/a'}; investigation dates {inv.get('investigationStartDate') or '?'} to {inv.get('investigationEndDate') or '?'}; "
                f"research area {inv.get('researchArea') or ''} / {inv.get('subResearchArea') or ''}; data license {inv.get('licenseIdentifier') or 'not stated'}; "
                f"DOI {inv.get('doi') or 'n/a'}; {inv.get('n_files', 0)} downloadable files ({', '.join(f'{k} {v}' for k, v in (inv.get('file_types') or {}).items())}); "
                f"experimental tables: {tabs or 'none'}.")
        out.append(_p(f"psi-{inv['accession']}-meta", "psi", name, meta, inv["url"], label, data=meta))
        pubs = inv.get("publications") or []
        for j in range(0, len(pubs), 6):
            txt = f"{name}. Publications listed by PSI: " + " ".join(f"{p['title']} (doi {p.get('doi') or 'n/a'})." for p in pubs[j:j + 6])
            out.append(_p(f"psi-{inv['accession']}-pubs-{j}", "psi", name, txt, inv["url"], label, data=txt))
    # 3. PSI experimental tables
    for t in psi_data.table_catalog():
        d = psi_data.read_table(ROOT / t["local"])
        label = f"NASA PSI {t['psi']} experimental table ({t['file_name']})"
        if t["psi"] == "PSI-69":
            continue   # FLEX handled with computed statistics below
        if len(d) <= 40:
            for i, row in d.iterrows():
                cells = "; ".join(f"{str(c).strip()}: {_fmt(v)}" for c, v in row.items() if pd.notna(v) and str(v).strip())
                out.append(_p(f"tab-{t['psi']}-{t['file_name']}-{i}", "table", f"{t['acronym']} test table",
                              f"{t['acronym']} ({t['psi']}) experimental table row {i + 1}: {cells}.", t["url"], label,
                              data=f"{t['acronym']} ({t['psi']}) experimental table row {i + 1}: {cells}."))
        else:
            desc = []
            for c in d.columns:
                col = d[c]
                num = pd.to_numeric(col, errors="coerce")
                if num.notna().mean() > 0.8:
                    desc.append(f"{str(c).strip()} from {num.min():g} to {num.max():g}")
                else:
                    vals = col.dropna().astype(str).str.strip().value_counts().head(4)
                    desc.append(f"{str(c).strip()} (e.g. " + ", ".join(f"{k} x{v}" for k, v in vals.items()) + ")")
            txt = f"{t['acronym']} ({t['psi']}) experimental table with {len(d)} rows. Columns: " + "; ".join(desc) + "."
            out.append(_p(f"tab-{t['psi']}-{t['file_name']}", "table", f"{t['acronym']} test table", txt, t["url"], label, data=txt))
    fs = psi_data.flex_summary()
    if fs.get("available"):
        u, lab = fs["source"]["url"], "NASA PSI-69 FLEX experimental table (statistics computed by IGNITE-AI)"
        txt = (f"FLEX (PSI-69) experimental table: {fs['n_tests']} droplet tests on the ISS; fuels " +
                      ", ".join(f"{k} {v}" for k, v in fs["fuels"].items()) + "; test end " +
                      ", ".join(f"{k} {v}" for k, v in fs["test_end_counts"].items()) +
                      f"; {fs['n_with_co2']} tests had CO2 added to the atmosphere (up to mole fraction {fs['co2_max_mole_fraction']:g}) and {fs['n_with_helium']} had helium; "
                      f"oxygen mole fraction {fs['o2_range'][0]:g} to {fs['o2_range'][1]:g}; ambient pressure {fs['pressure_kpa_range'][0]:g} to {fs['pressure_kpa_range'][1]:g} kPa.")
        out.append(_p("flex-sum", "table", "FLEX statistics", txt, u, lab, data=txt))
        for r in fs["by_co2"]:
            txt = (f"FLEX (PSI-69) {r['fuel']} droplets with CO2 mole fraction {r['co2_bin']}: {r['n']} tests, {r['extinctions']} ended in flame extinction, "
                          f"mean visible-flame extinction diameter {r['mean_extinction_diameter_mm']:g} mm, mean burn time {r['mean_burn_time_s']:g} s (computed from the PSI table).")
            out.append(_p(f"flex-co2-{r['fuel']}-{r['co2_bin']}", "table", "FLEX CO2 statistics", txt, u, lab, data=txt))
    # 4. curated flame-spread rows
    ex = pd.read_csv(ROOT / "data/experiments.csv")
    gname = {0.0: "microgravity", 0.165: "lunar gravity (0.165 g)", 0.38: "Martian gravity (0.38 g)", 1.0: "Earth gravity (1 g)"}
    for _, r in ex.iterrows():
        g = gname.get(round(float(r["gravity_g"]), 3), f"{r['gravity_g']:g} g")
        stmt = (f"Experiment {r['row_id']} ({r['facility']}, {g}): {r['material_detail']} at {r['oxygen_pct']:g}% oxygen, {r['pressure_kpa']:g} kPa, "
               f"{r['flow_cm_s']:g} cm/s {r['flow_direction']} flow. Outcome: {str(r['outcome']).replace('_', ' ')} ({r['outcome_detail']}).")
        out.append(_p(f"row-{r['row_id']}", "row", f"Experiment {r['row_id']}", stmt + " " + str(r["quote"]), r["source_url"],
                      f"{r['report_id']}: {r['source_title']}", quote=str(r["quote"]), data=stmt))
    # 5. curated facts and safety items (verbatim quotes)
    for env in F.ENVIRONMENTS.values():
        for f in env["facts"]:
            if f["source"] and f["quote"]:
                out.append(_p(f"fact-{env['id']}-{f['label']}", "fact", f"{env['name']}: {f['label']}",
                              f"{env['name']} - {f['label']}: {f['value']}. {f['quote']}", f["source"]["url"], f["source"]["label"], quote=f["quote"]))
    for sec in F.SAFETY:
        for f in sec["items"]:
            out.append(_p(f"safety-{sec['id']}-{f['label']}", "fact", f"{sec['title']}: {f['label']}",
                          f"Fire safety - {sec['title']} - {f['label']}: {f['value']}. {f['quote']}", f["source"]["url"], f["source"]["label"], quote=f["quote"]))
    # 6. NASA web pages
    pg = ROOT / "data/corpus/nasa_pages.json"
    if pg.exists():
        for page in json.loads(pg.read_text(encoding="utf-8")):
            for i, para in enumerate(page["paragraphs"]):
                out.append(_p(f"page-{page['url']}-{i}", "page", page["title"], para, page["url"], page["title"], quote=para))
    return out


@lru_cache(maxsize=1)
def index():
    ps = passages()
    vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True, min_df=1,
                          token_pattern=r"(?u)\b[\w][\w\-]*\b")
    mat = vec.fit_transform([p["title"] + ". " + p["text"] for p in ps])
    return ps, vec, mat


def retrieve(q: str, k: int = 8) -> list[dict]:
    ps, vec, mat = index()
    sims = linear_kernel(vec.transform([_expand(q)]), mat).ravel()
    sims = sims * np.array([1.25 if p["kind"] == "fact" else (0.8 if p["id"].endswith(("-meta",)) or "-pubs-" in p["id"] else 1.0) for p in ps])
    order = np.argsort(-sims)[: k * 3]
    out, per_src = [], {}
    for i in order:
        p = ps[i]
        if per_src.get(p["url"], 0) >= 3:     # diversity: at most 3 passages per source
            continue
        per_src[p["url"]] = per_src.get(p["url"], 0) + 1
        out.append({**p, "score": round(float(sims[i]), 4)})
        if len(out) >= k:
            break
    return out


def _detect_acronyms(q: str) -> list[str]:
    ql = " " + q.lower() + " "
    found = []
    for term in sorted(ACRONYMS, key=len, reverse=True):
        if re.search(r"(?<![\w-])" + re.escape(term) + r"(?![\w-])", ql):
            key = ACRONYMS[term]
            if key not in found:
                found.append(key)
            ql = re.sub(r"(?<![\w-])" + re.escape(term) + r"(?![\w-])", " ", ql)
    return found


def _is_domain(q: str) -> bool:
    toks = set(re.findall(r"[a-z0-9\-]+", q.lower())) - ENGLISH_STOP_WORDS
    return bool(toks & DOMAIN) or bool(_detect_acronyms(q))


def _best_sentences(q: str, hits: list[dict], n: int = 4, keys: list[str] | None = None) -> list[tuple[str, int, bool]]:
    """Returns (text, hit index, is_verbatim). Verbatim sentences come only from source text;
    'data' statements are templated from real table rows and are shown unquoted."""
    _, vec, _ = index()
    qv = vec.transform([_expand(q)])
    wants_data = bool(re.search(r"\b(data|table|tests?|how many|number|rows?|rate|fast|speed|mm|kpa|percent|%)\b", q.lower()))
    cands = []
    for hi, h in enumerate(hits):
        units = [(s, True) for s in _sentences(h["quote"] or "")] if h.get("quote") else []
        if h.get("quote") and not units and len(h["quote"]) > 15:
            units = [(h["quote"], True)]
        if h.get("data"):
            units.append((h["data"], False))
        for s, verb in units:
            if len(s.split()) < 6:
                continue
            sc = float(linear_kernel(qv, vec.transform([s])).ravel()[0])
            named = any(k.lower() in h["title"].lower() or k.lower() in h["source"].lower() for k in (keys or []))
            if not verb and not wants_data and not named:
                sc *= 0.6
            cands.append((sc + 0.15 * h["score"], s, hi, verb))
    cands.sort(key=lambda x: -x[0])
    picked, used_src, seen = [], {}, set()
    for sc, s, hi, verb in cands:
        key = re.sub(r"[^a-z0-9]", "", s.lower())[:90]
        if key in seen or used_src.get(hi, 0) >= 2 or sc <= 0.02:
            continue
        seen.add(key); used_src[hi] = used_src.get(hi, 0) + 1
        picked.append((s, hi, verb))
        if len(picked) >= n:
            break
    return picked


def _compare(keys: list[str], hits: list[dict]) -> list[dict]:
    invs = {i["accession"]: i for i in psi_data.investigations()}
    rows = []
    for k in keys:
        if k in invs:
            inv = invs[k]
            obj = _sentences(inv.get("objective") or "")
            rows.append({"name": f"{inv.get('investigationAcronym') or inv['title']} ({k})", "title": inv["title"],
                         "platform": inv.get("flightProgram") or "", "hardware": inv.get("experimentHardware") or "",
                         "dates": (f"{inv.get('investigationStartDate')} to {inv.get('investigationEndDate')}" if (inv.get('investigationStartDate') or "").strip()
                                   else "not listed in PSI metadata"),
                         "area": inv.get("subResearchArea") or "", "objective": obj[0] if obj else "",
                         "tables": [t["file_name"] for t in inv.get("experimental_tables", [])],
                         "n_publications": len(inv.get("publications") or []), "url": inv["url"]})
        else:
            best = next((h for h in hits if k in (h["title"] + h["text"]).lower()), None)
            if best:
                rows.append({"name": k.upper() if k != "saffire" else "Saffire", "title": best["title"], "platform": "", "hardware": "",
                             "dates": "", "area": "", "objective": _sentences(best["text"])[0] if _sentences(best["text"]) else best["text"][:300],
                             "tables": [], "n_publications": None, "url": best["url"]})
    return rows


def _numbers(t: str) -> set[str]:
    return {n.rstrip(".") for n in re.findall(r"\d+(?:\.\d+)?", t)}


def _ollama(q: str, hits: list[dict]) -> str | None:
    if os.environ.get("IGNITE_LLM", os.environ.get("FLAME_LLM", "")).lower() != "ollama":
        return None
    ctx = "\n".join(f"[{i + 1}] {h['text']}" for i, h in enumerate(hits))
    prompt = ("Answer the question in at most 4 sentences using ONLY the numbered passages. Cite passages as [n]. "
              "If the passages do not answer it, say so. Never add numbers that are not in the passages.\n\n"
              f"PASSAGES:\n{ctx}\n\nQUESTION: {q}")
    try:
        req = urllib.request.Request(os.environ.get("IGNITE_LLM_URL", "http://localhost:11434/api/generate"),
                                     data=json.dumps({"model": os.environ.get("IGNITE_LLM_MODEL", "llama3.2"), "prompt": prompt,
                                                      "stream": False}).encode(), headers={"Content-Type": "application/json"})
        text = json.load(urllib.request.urlopen(req, timeout=60)).get("response", "").strip()
    except Exception:
        return None
    allowed = _numbers(ctx) | {str(i + 1) for i in range(len(hits))}
    if not text or not re.search(r"\[\d+\]", text) or any(n not in allowed for n in _numbers(text)):
        return None
    return text


def ask(q: str, k: int = 6) -> dict:
    q = (q or "").strip()[:500]
    base = {"question": q, "mode": "extractive", "generator": "none (extractive quotes)"}
    if len(q) < 3:
        return {**base, "answered": False, "answer": "Please type a question.", "citations": [], "passages": []}
    hits = retrieve(q, k)
    top = hits[0]["score"] if hits else 0.0
    cov = _coverage(q, hits) if hits else 0.0
    base["coverage"] = round(cov, 3)
    if top < MIN_SCORE or not _is_domain(q) or cov < MIN_COVERAGE:
        return {**base, "answered": False, "top_score": top,
                "answer": ("I can't answer that from the IGNITE-AI knowledge base: nothing sufficiently relevant was retrieved "
                           f"(best match score {top:.2f}, threshold {MIN_SCORE}; share of your question's key words found {cov:.0%}, need {MIN_COVERAGE:.0%}). I only answer from NASA combustion and fire-safety sources "
                           "(NTRS reports, PSI investigations and tables, the curated experiment rows)."),
                "citations": [], "passages": []}
    hits = [h for h in hits if h["score"] >= MIN_SCORE * 0.6]
    keys = _detect_acronyms(q)
    comparison = _compare(keys, hits) if len(keys) >= 2 else None
    picked = _best_sentences(q, hits, keys=keys)
    used = sorted({hi for _, hi, _ in picked})
    renum = {hi: n + 1 for n, hi in enumerate(used)}
    bullets = [(f"\u201c{s}\u201d [{renum[hi]}]" if verb else f"Data: {s} [{renum[hi]}]") for s, hi, verb in picked]
    if not picked:
        return {**base, "answered": False, "top_score": top, "citations": [], "passages": [],
                "answer": "I found related documents but no sentence in them answers this question directly, so I won't guess."}
    cites = [{"n": renum[hi], "label": hits[hi]["source"], "url": hits[hi]["url"], "kind": hits[hi]["kind"],
              "score": hits[hi]["score"]} for hi in used]
    gen = _ollama(q, [hits[hi] for hi in used])
    return {**base, "answered": True, "top_score": top,
            "answer": gen or ("From the retrieved NASA sources (quotes are verbatim; 'Data' lines restate real table rows):\n" + "\n".join("\u2022 " + b for b in bullets)),
            "bullets": [{"text": s, "n": renum[hi], "verbatim": verb} for s, hi, verb in picked],
            "generator": "ollama (constrained to retrieved passages)" if gen else base["generator"],
            "comparison": comparison, "citations": cites,
            "passages": [{"n": renum.get(i), "title": h["title"], "text": h["text"][:700], "url": h["url"], "source": h["source"],
                          "kind": h["kind"], "score": h["score"]} for i, h in enumerate(hits)]}


def stats() -> dict:
    ps = passages()
    kinds = pd.Series([p["kind"] for p in ps]).value_counts().to_dict()
    return {"n_passages": len(ps), "by_kind": kinds, "min_score": MIN_SCORE, "retriever": "TF-IDF 1-2 gram (scikit-learn)",
            "generator": "extractive quotes" + (" + ollama" if os.environ.get("IGNITE_LLM", "").lower() == "ollama" else "")}
