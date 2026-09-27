"""TF-IDF retrieval over the NTRS report corpus (titles + abstracts), fully offline."""
from __future__ import annotations
import json, pathlib
import numpy as np
from functools import lru_cache
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel

ROOT = pathlib.Path(__file__).resolve().parents[2]
CORPUS = ROOT / "data" / "corpus" / "ntrs_corpus.json"

MATERIAL_WORDS = {
    "cellulose_thin": "thin cellulose Kimwipes paper fuel", "cellulose_double": "thin cellulose paper fuel thickness",
    "filter_paper": "ashless filter paper cellulosic Solid Surface Combustion Experiment",
    "SIBAL_fabric": "SIBAL cotton fiberglass fabric BASS Saffire", "cotton_jersey": "cotton fabric Saffire",
    "PMMA_thick": "PMMA polymethylmethacrylate thick fuel", "Nomex_HT90-40": "Nomex fabric flammability",
    "Ultem_1000": "Ultem polyetherimide flammability", "Mylar_G": "Mylar film flammability", "silicone": "silicone Saffire flammability",
}
OUTCOME_WORDS = {"no_spread": "extinction quenching blowoff limit", "marginal_spread": "near-limit extinction limit oscillatory",
                 "spread": "flame spread rate"}


@lru_cache(maxsize=1)
def index():
    docs = json.loads(CORPUS.read_text(encoding="utf-8"))
    texts = [(d.get("title", "") + ". " + (d.get("abstract") or "")) for d in docs]
    vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), min_df=1, sublinear_tf=True)
    mat = vec.fit_transform(texts)
    return docs, vec, mat


def search(query: str, k: int = 3, must_ids: list[str] | None = None) -> list[dict]:
    docs, vec, mat = index()
    sims = linear_kernel(vec.transform([query]), mat).ravel()
    order = np.argsort(-sims, kind="stable")   # stable: identical scores keep corpus order on every platform
    out, seen = [], set()
    for i in order:
        d = docs[i]
        if d["ntrs_id"] in seen:
            continue
        seen.add(d["ntrs_id"])
        ab = (d.get("abstract") or "").replace("\n", " ")
        out.append({"report_id": f"NTRS {d['ntrs_id']}", "title": d["title"], "date": d.get("date", ""),
                    "source_url": d["url"], "score": round(float(sims[i]), 4), "abstract_snippet": ab[:420] + ("..." if len(ab) > 420 else "")})
        if len(out) >= k:
            break
    return out


def get_abstract(ntrs_id: str) -> dict | None:
    docs, _, _ = index()
    for d in docs:
        if d["ntrs_id"] == ntrs_id:
            return d
    return None


def query_for(inp: dict, pred: str | None) -> str:
    q = ["microgravity flame spread", MATERIAL_WORDS.get(inp["material"], inp["material"]),
         f"{inp['flow_direction']} flow", "oxygen concentration", "low speed flow" if inp["flow_cm_s"] < 10 else "forced flow"]
    if pred:
        q.append(OUTCOME_WORDS[pred])
    if inp["pressure_kpa"] < 95:
        q.append("reduced pressure exploration atmosphere")
    return " ".join(q)
