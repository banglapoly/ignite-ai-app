"""Server-side, crawlable HTML injected into index.html for every page route.

AI tools and search engines that do not run JavaScript still get the real content:
the science, the environments with sourced facts, safety measures, data sources and
model details. React replaces this markup when it mounts.
"""
from __future__ import annotations
from html import escape as e
from . import facts as F

TITLE = "IGNITE-AI"
TAGLINE = "Predictive Fire Safety Analytics for Space Station Orbit & Rocket Transit"


def _a(url, label):
    return f'<a href="{e(url)}">{e(label)}</a>'


PAGES = [
    ("/", "Home", "IGNITE-AI \u00b7 Predictive Fire Safety Analytics for Space Station Orbit & Rocket Transit",
     "Open-source tool that predicts flame spread over spacecraft materials from published NASA microgravity and partial-gravity experiments."),
    ("/simulator", "3D Flame Simulator", "IGNITE-AI \u00b7 3D Flame Simulator",
     "Interactive 3D flame for Earth, Moon, Mars, ISS and transit-cabin conditions with sourced environment data and oxygen, pressure and airflow sliders."),
    ("/predict", "Prediction & Experiments", "IGNITE-AI \u00b7 Prediction & Experiments",
     "Flame-spread prediction with a range guard, decision boundary over real NASA tests, nearest experiments and FLEX CO2 data."),
    ("/ask", "Ask IGNITE-AI", "IGNITE-AI \u00b7 Ask IGNITE-AI",
     "Local question answering over a NASA combustion knowledge base; answers are verbatim quotes with source links."),
    ("/safety", "Safety Measures", "IGNITE-AI \u00b7 Fire Safety Measures",
     "Spacecraft fire detection, ventilation shutdown, suppression, material selection and crew procedures from NASA sources."),
    ("/data", "Data & Model", "IGNITE-AI \u00b7 Data & Model",
     "The 143-row NASA flame-spread dataset with quotes and the honest model card: cross-validation, per-gravity accuracy, confusion matrix."),
    ("/sources", "Sources & Citations", "IGNITE-AI \u00b7 Sources & Citations",
     "NASA PSI investigations, NTRS reports, environment and safety sources, FLEX data, and the AI-use disclosure."),
]
PAGE_INFO = {p[0]: p for p in PAGES}
_OUTCOME = {"spread": "sustained spread", "marginal_spread": "marginal spread", "no_spread": "no spread"}


def _nav(route):
    cur = ' aria-current="page"'
    items = "".join(f'<li><a href="{p}"{cur if p == route else ""}>{e(label)}</a></li>' for p, label, *_ in PAGES)
    return f'<nav aria-label="Pages"><ul>{items}</ul></nav>'


def _crisis():
    return ("<section><h2>The Microgravity Fire Crisis</h2>"
            "<p>Fire changes character when gravity is removed. On Earth, hot gases rise and cooler air is pulled in at the base, which gives the "
            "familiar flickering teardrop flame. In the free fall of orbit that buoyant flow disappears: "
            "\u201clow-momentum flames tend to be rounded or even spherical\u201d (" + _a(F.S["nasa_combustion"][1], "NASA") + "). "
            "Near-limit flames can be very hard to see: in NASA tests at low airflow \u201cthe entire flame is pale violet and nearly invisible\u201d ("
            + _a(F.S["friedman2000"][1], "NASA/TM-2000-210337") + "), and the FLEX experiment found cool flames in which fuel kept "
            "\u201cburning\u201d after the visible flame went out (" + _a(F.S["nasa_combustion"][1], "NASA") + ").</p></section>")


def _environments(env_counts):
    out = ["<section><h2>Environments</h2>"]
    for env in F.ENVIRONMENTS.values():
        out.append(f"<h3>{e(env['short'])}</h3><p>{e(env['tagline'])}</p><ul>")
        for f in env["facts"]:
            src = f" \u2014 source: {_a(f['source']['url'], f['source']['label'])}" if f["source"] else ""
            tag = " (ESTIMATE, not a measurement)" if f["kind"] == "estimate" else ""
            q = f" \u201c{e(f['quote'])}\u201d" if f["quote"] else ""
            out.append(f"<li><strong>{e(f['label'])}:</strong> {e(f['value'])}{tag}.{q}{src}{(' ' + e(f['note'])) if f['note'] else ''}</li>")
        c = env_counts.get(env["id"], {})
        out.append(f"</ul><p>Training data at this gravity: {c.get('n', 0)} real experiments. {e(env['data_note'])}</p>")
    out.append("</section>")
    return "".join(out)


def _safety():
    out = ["<section><h2>Fire safety measures</h2>"]
    for sec in F.SAFETY:
        ap = sec.get("applies")
        scope = f" (applies to: {', '.join(ap)})" if isinstance(ap, (list, tuple)) and ap else ""
        out.append(f"<h3>{e(sec['title'])}{e(scope)}</h3><ul>")
        for f in sec["items"]:
            out.append(f"<li><strong>{e(f['label'])}:</strong> {e(f['value'])}. \u201c{e(f['quote'])}\u201d \u2014 {_a(f['source']['url'], f['source']['label'])}</li>")
        out.append("</ul>")
    out.append("</section>")
    return "".join(out)


def _model(card, n_rows, n_reports, flex, kb_stats):
    m = card["metrics"]
    g = m.get("oof_accuracy_by_gravity", {})
    cm = m.get("confusion_matrix", {})
    out = ["<section><h2>Model and data</h2><ul>"
           f"<li>Dataset: {n_rows} real flame-spread experiments transcribed from {n_reports} NASA reports (NTRS), each with a verbatim quote and page reference; "
           "by gravity: " + ", ".join(f"{k} g: {v['n']}" for k, v in g.items()) + ".</li>"
           f"<li>Model: {e(card['model']['estimator'])}; features {', '.join(card['model']['features'])}.</li>"
           f"<li>Stratified 5-fold cross-validated accuracy {m['cv_accuracy']} (balanced {m['cv_balanced_accuracy']}); repeated CV {m['repeated_cv_accuracy_mean']} \u00b1 {m['repeated_cv_accuracy_std']}; "
           f"leave-reports-out {m['leave_reports_out_accuracy']}; majority-class baseline {m['majority_baseline_accuracy']}.</li>"
           "<li>Out-of-fold accuracy by gravity: " + ", ".join(f"{k} g {v['accuracy']} (n={v['n']})" for k, v in g.items()) +
           ". Partial-gravity outputs rest on very few tests and are effectively lookups of the nearest published test.</li>"]
    if cm:
        out.append(f"<li>Confusion matrix (out-of-fold; rows = true {', '.join(cm['labels'])}): {cm['matrix']}.</li>")
    out.append("<li>Range guard: no prediction is returned for a material/gravity combination, oxygen, pressure, airflow or flow direction outside the tested envelope, or for gas mixes other than O2/N2.</li>")
    if flex.get("available"):
        out.append(f"<li>Separate real dataset: FLEX (PSI-69) experimental table, {flex['n_tests']} droplet-combustion tests, {flex['n_with_co2']} with added CO2 \u2014 shown as published, not used by the classifier.</li>")
    out.append(f"<li>Ask IGNITE-AI: retrieval over {kb_stats['n_passages']} passages (NTRS abstracts, PSI metadata and tables, experiment rows, NASA pages) with TF-IDF; answers are verbatim quotes with source links; declines when nothing relevant is found.</li></ul></section>")
    return "".join(out)


def _envelope(card):
    out = ["<section><h2>Tested envelope (where the model will predict)</h2><table><thead><tr><th>Material</th><th>Gravity (g)</th><th>Tests</th><th>O2 %</th><th>Pressure kPa</th><th>Flow cm/s</th></tr></thead><tbody>"]
    for mat, d in card["training_range"]["materials"].items():
        for gk, b in (d.get("by_gravity") or {}).items():
            out.append(f"<tr><td>{e(mat)}</td><td>{e(gk)}</td><td>{b.get('n', '')}</td><td>{b['oxygen_pct'][0]}\u2013{b['oxygen_pct'][1]}</td>"
                       f"<td>{b['pressure_kpa'][0]}\u2013{b['pressure_kpa'][1]}</td><td>{b['flow_cm_s'][0]}\u2013{b['flow_cm_s'][1]}</td></tr>")
    out.append("</tbody></table><p>Outside these boxes, for untested gravity levels, or for gas mixes other than O2/N2, the tool refuses to predict.</p></section>")
    return "".join(out)


def _rows_table(df):
    out = [f"<section><h2>All {len(df)} training rows</h2><table><thead><tr><th>ID</th><th>g</th><th>O2 %</th><th>kPa</th><th>cm/s</th><th>Direction</th><th>Material</th><th>Outcome</th><th>Source</th><th>Where</th></tr></thead><tbody>"]
    for r in df.itertuples(index=False):
        out.append(f"<tr><td>{e(str(r.row_id))}</td><td>{r.gravity_g:g}</td><td>{r.oxygen_pct:g}</td><td>{r.pressure_kpa:g}</td><td>{r.flow_cm_s:g}</td><td>{e(str(r.flow_direction))}</td>"
                   f"<td>{e(str(r.material))}</td><td>{e(_OUTCOME.get(r.outcome, r.outcome))}</td><td>{_a(r.source_url, 'NTRS ' + str(r.report_id))}</td><td>{e(str(r.source_location))}</td></tr>")
    out.append("</tbody></table><p>CSV: <a href=\"/static-api/experiments.csv\">/static-api/experiments.csv</a></p></section>")
    return "".join(out)


def _sources(df):
    out = ["<section><h2>Primary sources: NASA Physical Sciences Informatics (PSI)</h2><ul>"]
    out += [f"<li>{_a(l['url'], l['label'])}</li>" for l in F.EXTRA_LINKS]
    for inv in F.INVESTIGATIONS:
        out.append(f"<li>{_a('https://psi.nasa.gov/physci/repo/data/investigations/' + inv['psi'], 'NASA PSI ' + inv['psi'] + ' ' + inv['acronym'])}</li>")
    out.append("</ul><h2>Reports behind the training rows (NTRS)</h2><ul>")
    reps = df.drop_duplicates("report_id").sort_values("report_id")
    out += [f"<li>{_a(r.source_url, 'NTRS ' + str(r.report_id))} \u2014 {e(str(r.source_title))}</li>" for r in reps.itertuples(index=False)]
    out.append("</ul><h2>Environment and safety sources</h2><ul>")
    out += [f"<li>{_a(v[1], v[0])}</li>" for v in F.S.values()]
    out.append("</ul></section>")
    return "".join(out)


def _ai_use():
    return ("<section><h2>AI-use disclosure</h2><p>AI coding assistants helped write the software; all data values were transcribed from and checked against the cited NASA documents. "
            "No AI system produced any training value. No paid or cloud AI API is used at runtime: predictions come from a scikit-learn model, explanations are deterministic templates, "
            "and Ask IGNITE-AI quotes retrieved passages verbatim. Optional local Ollama generation is off by default and its output is rejected if it contains numbers not in the retrieved text.</p></section>")


def _ask(examples):
    out = ["<section><h2>How Ask IGNITE-AI works</h2><p>Retrieval: TF-IDF (1\u20132-grams) over the knowledge base with a small fixed synonym list and at most three passages per source. "
           "Answer: the best-matching sentences shown verbatim with numbered citation links; lines built from real table rows are marked DATA; naming two or more investigations gives a side-by-side comparison from PSI metadata. "
           "It declines when the best match scores below 0.07, the question has no fire or space term, or fewer than 60% of the question's specific words appear in the retrieved passages.</p>"]
    for q, a in examples:
        out.append(f"<h3>Example: {e(q)}</h3>")
        if a.get("answered"):
            out.append("<ul>" + "".join((f"<li>\u201c{e(b['text'])}\u201d [{b.get('n')}]</li>" if b.get("verbatim") else f"<li>DATA: {e(b['text'])} [{b.get('n')}]</li>") for b in (a.get("bullets") or [])) + "</ul>")
            out.append("<p>Sources: " + "; ".join(f"[{c['n']}] {_a(c['url'], c['label'])}" for c in a.get("citations", [])) + "</p>")
        else:
            out.append(f"<p>{e(a.get('answer', ''))}</p>")
    out.append("</section>")
    return "".join(out)


def build(card: dict, n_rows: int, n_reports: int, env_counts: dict, flex: dict, kb_stats: dict, route: str = "/",
          df=None, ask_examples=None) -> str:
    info = PAGE_INFO.get(route)
    out = ['<div id="static-summary" style="max-width:960px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif;color:#dfe6f3;background:#05070d;line-height:1.5">',
           f'<header><p><img src="/logo.svg" alt="IGNITE-AI logo" width="40" height="40" class="static-logo"> <strong>{TITLE}</strong> \u2014 {e(TAGLINE)}</p>{_nav(route)}</header>']
    if info is None:
        out.append("<main><h1>Page not found</h1><p>Try one of the pages listed above.</p></main>")
    else:
        out.append("<main>")
        if route == "/":
            out.append(f"<h1>{TITLE}</h1><p><strong>{e(TAGLINE)}</strong></p>"
                       "<p>IGNITE-AI is an open-source (Apache-2.0) tool that predicts whether a flame will spread over a spacecraft material "
                       "under given oxygen, pressure, airflow and gravity conditions, using only published NASA experiments. It refuses to predict "
                       "outside the conditions that were actually tested, shows the nearest real experiments with verbatim quotes, and answers "
                       "questions from a NASA combustion knowledge base with citations.</p>"
                       '<p><a href="/simulator">[ Explore Space Fire Safety Tool ]</a></p>')
            out.append(_crisis())
            out.append("<section><h2>Pages</h2><ul>" + "".join(f'<li><a href="{p}">{e(l)}</a>: {e(d)}</li>' for p, l, _, d in PAGES[1:]) + "</ul></section>")
            m = card["metrics"]
            out.append(f"<section><h2>Key numbers</h2><ul><li>{n_rows} real NASA flame-spread experiments from {n_reports} reports</li>"
                       f"<li>4 gravity levels with data (0, 0.165, 0.38, 1 g)</li><li>Cross-validated accuracy {m['cv_accuracy']} vs majority baseline {m['majority_baseline_accuracy']}</li>"
                       "<li>24 NASA PSI combustion investigations in the knowledge base</li></ul></section>")
        else:
            out.append(f"<h1>{e(info[1])}</h1><p>{e(info[3])}</p>")
            if route == "/simulator":
                out.append("<p>The 3D view is an illustrative rendering driven by the inputs and the model output (flame shape from \u221ag buoyancy scaling, size and colour from O2 and pressure, skew from airflow). It is not a combustion simulation. "
                           "Environment tabs: Earth (1 g), Moon (0.165 g), Mars (0.38 g), ISS microgravity (~0 g) and a transit cabin (coasting spaceflight is free fall; powered-flight thrust phases are not modelled).</p>")
                out.append(_environments(env_counts))
            elif route == "/predict":
                out.append(_envelope(card))
                out.append(_model(card, n_rows, n_reports, flex, kb_stats))
            elif route == "/ask":
                out.append(_ask(ask_examples or []))
            elif route == "/safety":
                out.append(_safety())
            elif route == "/data":
                out.append(_model(card, n_rows, n_reports, flex, kb_stats))
                if df is not None:
                    out.append(_rows_table(df))
            elif route == "/sources":
                if df is not None:
                    out.append(_sources(df))
                out.append(_ai_use())
        out.append("</main>")
    out.append('<footer><p>License: Apache-2.0. Data: NASA PSI and NASA Technical Reports Server; NASA does not endorse this project. '
               'Machine-readable summary: <a href="/llms.txt">/llms.txt</a>; API: <a href="/docs">/docs</a>.</p></footer></div>')
    return "\n".join(out)


def llms_txt(card: dict, n_rows: int, n_reports: int) -> str:
    m = card["metrics"]
    lines = [f"# {TITLE}", "", f"> {TAGLINE}", "",
             "Open-source (Apache-2.0) flame-spread regime predictor for spacecraft materials, trained only on published NASA experiments.",
             f"- Dataset: {n_rows} experiments from {n_reports} NASA reports; CSV at /static-api/experiments.csv",
             f"- CV accuracy {m['cv_accuracy']} (balanced {m['cv_balanced_accuracy']}), leave-reports-out {m['leave_reports_out_accuracy']}, baseline {m['majority_baseline_accuracy']}",
             "- Gravity levels with data: 0 g, 0.165 g (Moon), 0.38 g (Mars), 1 g; the range guard refuses untested material/gravity combinations",
             "- Moon/Mars buoyancy scaling (sqrt g) values are labelled estimates", "",
             "## Pages"] + [f"- {p} : {label} \u2014 {desc}" for p, label, _, desc in PAGES] + ["",
             "## Data (static JSON, always available)"] + [f"- /static-api/{n}.json" for n in ("model", "environments", "experiments", "safety", "flex", "psi")] + ["",
             "## API (only where the FastAPI backend runs; the static site computes predictions and answers in the browser instead)",
             "- GET /health", "- GET /api/environments", "- GET /api/safety?env=iss", "- POST /api/predict", "- POST /api/ask {question}",
             "- GET /api/flex", "- GET /api/psi", "- GET /api/model", "", "## Sources"]
    lines += [f"- {l['label']}: {l['url']}" for l in F.EXTRA_LINKS]
    lines += [f"- NASA PSI {i['psi']} {i['acronym']}: https://psi.nasa.gov/physci/repo/data/investigations/{i['psi']}" for i in F.INVESTIGATIONS]
    lines += [f"- {v[0]}: {v[1]}" for v in F.S.values()]
    return "\n".join(lines) + "\n"
