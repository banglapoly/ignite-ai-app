"""Server-side, crawlable HTML summary injected into index.html for `/` and `/demo`.

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


def build(card: dict, n_rows: int, n_reports: int, env_counts: dict, flex: dict, kb_stats: dict, route: str = "/") -> str:
    m = card["metrics"]
    g = m.get("oof_accuracy_by_gravity", {})
    out = [f'<div id="static-summary" style="max-width:900px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif;color:#dfe6f3;background:#05070d;line-height:1.5">',
           f"<header><h1>{TITLE}</h1><p><strong>{e(TAGLINE)}</strong></p>",
           "<p>IGNITE-AI is an open-source (Apache-2.0) tool that predicts whether a flame will spread over a spacecraft material "
           "under given oxygen, pressure, airflow and gravity conditions, using only published NASA experiments. It refuses to predict "
           "outside the conditions that were actually tested, shows the nearest real experiments with verbatim quotes, and answers "
           "questions from a NASA combustion knowledge base with citations.</p>"
           f'<p><a href="/demo">[ Explore Space Fire Safety Tool ]</a></p></header>']
    out.append("<section><h2>The Microgravity Fire Crisis</h2>"
               "<p>Fire changes character when gravity is removed. On Earth, hot gases rise and cooler air is pulled in at the base, which gives the "
               "familiar flickering teardrop flame. In the free fall of orbit that buoyant flow disappears: "
               "\u201clow-momentum flames tend to be rounded or even spherical\u201d (" + _a(F.S["nasa_combustion"][1], "NASA") + "). "
               "Near-limit flames can be very hard to see: in NASA tests at low airflow \u201cthe entire flame is pale violet and nearly invisible\u201d ("
               + _a(F.S["friedman2000"][1], "NASA/TM-2000-210337") + "), and the FLEX experiment found cool flames in which fuel kept "
               "\u201cburning\u201d after the visible flame went out (" + _a(F.S["nasa_combustion"][1], "NASA") + ").</p></section>")
    out.append("<section><h2>Environments</h2>")
    for env in F.ENVIRONMENTS.values():
        out.append(f"<h3>{e(env['short'])}</h3><p>{e(env['tagline'])}</p><ul>")
        for f in env["facts"]:
            src = f" \u2014 source: {_a(f['source']['url'], f['source']['label'])}" if f["source"] else ""
            tag = " (ESTIMATE, not a measurement)" if f["kind"] == "estimate" else ""
            q = f" \u201c{e(f['quote'])}\u201d" if f["quote"] else ""
            out.append(f"<li><strong>{e(f['label'])}:</strong> {e(f['value'])}{tag}.{q}{src}{(' ' + e(f['note'])) if f['note'] else ''}</li>")
        c = env_counts.get(env["id"], {})
        out.append(f"</ul><p>Training data at this gravity: {c.get('n', 0)} real experiments. {e(env['data_note'])}</p>")
    out.append("</section><section><h2>Fire safety measures</h2>")
    for sec in F.SAFETY:
        out.append(f"<h3>{e(sec['title'])}</h3><ul>")
        for f in sec["items"]:
            out.append(f"<li><strong>{e(f['label'])}:</strong> {e(f['value'])}. \u201c{e(f['quote'])}\u201d \u2014 {_a(f['source']['url'], f['source']['label'])}</li>")
        out.append("</ul>")
    out.append("</section><section><h2>Model and data</h2><ul>"
               f"<li>Dataset: {n_rows} real flame-spread experiments transcribed from {n_reports} NASA reports (NTRS), each with a verbatim quote and page reference; "
               f"by gravity: " + ", ".join(f"{k} g: {v['n']}" for k, v in g.items()) + ".</li>"
               f"<li>Model: {e(card['model']['estimator'])}; features {', '.join(card['model']['features'])}.</li>"
               f"<li>Stratified 5-fold cross-validated accuracy {m['cv_accuracy']} (balanced {m['cv_balanced_accuracy']}); repeated CV {m['repeated_cv_accuracy_mean']} \u00b1 {m['repeated_cv_accuracy_std']}; "
               f"leave-reports-out {m['leave_reports_out_accuracy']}; majority-class baseline {m['majority_baseline_accuracy']}.</li>"
               "<li>Out-of-fold accuracy by gravity: " + ", ".join(f"{k} g {v['accuracy']} (n={v['n']})" for k, v in g.items()) +
               ". Partial-gravity outputs rest on very few tests and are effectively lookups of the nearest published test.</li>"
               "<li>Range guard: no prediction is returned for a material/gravity combination, oxygen, pressure, airflow or flow direction outside the tested envelope, or for gas mixes other than O2/N2.</li>")
    if flex.get("available"):
        out.append(f"<li>Separate real dataset: FLEX (PSI-69) experimental table, {flex['n_tests']} droplet-combustion tests, {flex['n_with_co2']} with added CO2 \u2014 shown as published, not used by the classifier.</li>")
    out.append(f"<li>Ask IGNITE-AI: retrieval over {kb_stats['n_passages']} passages (NTRS abstracts, PSI metadata and tables, experiment rows, NASA pages) with TF-IDF; answers are verbatim quotes with source links; declines when nothing relevant is found.</li></ul></section>")
    out.append("<section><h2>Primary sources</h2><ul>" + "".join(f"<li>{_a(l['url'], l['label'])}</li>" for l in F.EXTRA_LINKS))
    for inv in F.INVESTIGATIONS:
        out.append(f"<li>{_a('https://psi.nasa.gov/physci/repo/data/investigations/' + inv['psi'], 'NASA PSI ' + inv['psi'] + ' ' + inv['acronym'])}</li>")
    out.append("</ul></section>")
    out.append("<section><h2>AI use and team</h2><p>AI coding assistants helped write the software; all data values were transcribed from and checked against the cited NASA documents. "
               "No paid AI API is used at runtime. Team members: [Team member names \u2014 placeholder].</p></section>")
    out.append('<footer><p>License: Apache-2.0. Machine-readable summary: <a href="/llms.txt">/llms.txt</a>; API: <a href="/docs">/docs</a>.</p></footer></div>')
    return "\n".join(out)


def llms_txt(card: dict, n_rows: int, n_reports: int) -> str:
    m = card["metrics"]
    lines = [f"# {TITLE}", "", f"> {TAGLINE}", "",
             "Open-source (Apache-2.0) flame-spread regime predictor for spacecraft materials, trained only on published NASA experiments.",
             f"- Dataset: {n_rows} experiments from {n_reports} NASA reports; CSV at /api/experiments.csv",
             f"- CV accuracy {m['cv_accuracy']} (balanced {m['cv_balanced_accuracy']}), leave-reports-out {m['leave_reports_out_accuracy']}, baseline {m['majority_baseline_accuracy']}",
             "- Gravity levels with data: 0 g, 0.165 g (Moon), 0.38 g (Mars), 1 g; the range guard refuses untested material/gravity combinations",
             "- Moon/Mars buoyancy scaling (sqrt g) values are labelled estimates", "",
             "## Pages", "- / : landing page", "- /demo : interactive tool (3D flame, environments, prediction, safety, Ask IGNITE-AI)", "",
             "## API", "- GET /health", "- GET /api/environments", "- GET /api/safety?env=iss", "- POST /api/predict", "- POST /api/ask {question}",
             "- GET /api/flex", "- GET /api/psi", "- GET /api/model", "", "## Sources"]
    lines += [f"- {l['label']}: {l['url']}" for l in F.EXTRA_LINKS]
    lines += [f"- NASA PSI {i['psi']} {i['acronym']}: https://psi.nasa.gov/physci/repo/data/investigations/{i['psi']}" for i in F.INVESTIGATIONS]
    lines += [f"- {v[0]}: {v[1]}" for v in F.S.values()]
    return "\n".join(lines) + "\n"
