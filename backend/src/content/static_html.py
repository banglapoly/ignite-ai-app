"""Server-side, crawlable HTML injected into index.html for every page route.

AI tools and search engines that do not run JavaScript still get the real content:
the science, the environments with sourced facts, safety measures, data sources and
model details. React replaces this markup when it mounts.
"""
from __future__ import annotations
from html import escape as e
from . import facts as F

TITLE = "IGNITE-AI"
TAGLINE = "A research workspace for combustion-condition investigations"


def _a(url, label):
    return f'<a href="{e(url)}">{e(label)}</a>'


PAGES = [
    ("/", "Home", "IGNITE-AI \u00b7 Combustion investigation workspace",
     "Research workspace that keeps a combustion question, saved conditions, cited experiments, and material comparisons together. Not a flight-safety certification."),
    ("/dashboard", "Dashboard", "IGNITE-AI \u00b7 Investigation dashboard",
     "Guest dashboard of saved investigations, recent activity, and the next missing step. Storage is this browser only."),
    ("/simulator", "Sandbox", "IGNITE-AI \u00b7 Condition sandbox",
     "Illustrative 3D flame and the gravity, oxygen, pressure, airflow, gas-mix, and material controls, with the option to save a scenario."),
    ("/workspace", "Investigation", "IGNITE-AI \u00b7 Investigation",
     "One investigation: question, private notes, scenario history, cited evidence, model estimate, and material comparison."),
    ("/how-it-works", "How it works", "IGNITE-AI \u00b7 How it works",
     "Plain guide: start an investigation, set gravity, oxygen, pressure and airflow, read the estimate and the cited tests, and save notes in this browser."),
    ("/learn", "Learn", "IGNITE-AI \u00b7 Learn",
     "How to read experiment evidence, a statistical estimate, and the illustrative flame, including partial-gravity provenance."),
    ("/predict", "Evidence", "IGNITE-AI \u00b7 Evidence and model estimate",
     "Range guard, decision boundary over loaded tests, and nearest experiments with quotes. Min/max bands are not joint tests."),
    ("/ask", "Ask", "IGNITE-AI \u00b7 Ask the knowledge base",
     "Local question answering over a NASA combustion knowledge base; answers are verbatim quotes with source links."),
    ("/safety", "Safety notes", "IGNITE-AI \u00b7 Safety notes",
     "Spacecraft fire detection, ventilation shutdown, suppression, material selection and crew procedures from NASA sources."),
    ("/data", "Model", "IGNITE-AI \u00b7 Model and loaded data",
     "Model card, per-gravity accuracy, confusion matrix, and which data catalogs this build has loaded."),
    ("/sources", "Sources", "IGNITE-AI \u00b7 Sources and citations",
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
        out.append(f"<h3>{e(env['short'])}</h3><p>{e(env['tagline'])}</p>")
        if env.get("key_findings"):
            out.append("<p><strong>Key findings:</strong></p><ol>")
            for k in env["key_findings"]:
                loc = f", {e(k['loc'])}" if k.get("loc") else ""
                out.append(f"<li>{e(k['text'])} \u201c{e(k['quote'])}\u201d \u2014 source: {_a(k['source']['url'], k['source']['label'])}{loc}</li>")
            out.append("</ol>")
        out.append("<ul>")
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
    out.append("</ul><h2>Data, software and assets</h2><ul>"
               "<li>Data: NASA PSI, NASA NTRS and NASA web pages only; no non-NASA data sources (some PSI publication lists link to journal articles by DOI).</li>"
               "<li>Software: React, three.js, @react-three/fiber, drei, postprocessing, Vite, TypeScript, FastAPI, scikit-learn, NumPy, SciPy, pandas, joblib (all open source).</li>"
               "<li>3D scene: procedural geometry and shaders; no downloaded models or textures. Logo: created with AI image generation, then vectorized.</li>"
               f"<li>Source code: {_a('https://github.com/banglapoly/ignite-ai-app', 'github.com/banglapoly/ignite-ai-app')} (Apache-2.0).</li>"
               "</ul></section>")
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
           f'<header><p><img src="/logo.svg" alt="IGNITE-AI logo" width="40" height="40" class="static-logo"> <strong>{TITLE}</strong>: {e(TAGLINE)}</p>{_nav(route)}</header>']
    if info is None:
        out.append("<main><h1>Page not found</h1><p>Try one of the pages listed above.</p></main>")
    else:
        out.append("<main>")
        if route == "/":
            out.append(f"<h1>{TITLE}</h1><p><strong>{e(TAGLINE)}</strong></p>"
                       "<p>IGNITE-AI helps an engineer or researcher ask which published combustion tests are near a chosen gravity, oxygen, pressure, "
                       "airflow, gas mix, and material, and where the loaded dataset does not support an estimate. A guest investigation stores the question, "
                       "scenario history, and private notes in this browser. It is a research and education aid. It does not certify a material, clear a vehicle, "
                       "or claim that a challenge brief has been verified.</p>"
                       '<p><a href="/dashboard">Open the dashboard</a> · <a href="/simulator">Open the sandbox</a> · <a href="/learn">Learn how to read a result</a></p>')
            out.append("<section><h2>What an investigation keeps</h2><ul>"
                       "<li>Your title and question.</li>"
                       "<li>Saved scenario conditions and history: gravity preset, oxygen, pressure, airflow, flow direction, gas mix, and material.</li>"
                       "<li>Ranked published experiments with citations. That is the evidence.</li>"
                       "<li>A statistical model estimate only inside the loaded envelope. Class shares are not a calibrated confidence or a risk score.</li>"
                       "<li>An illustrative 3D flame. It is not a combustion simulation.</li>"
                       "<li>A comparison of materials under shared oxygen, pressure, airflow, and gravity. Unsupported combinations stay visible as limitations.</li>"
                       "<li>A full JSON backup, which includes private notes, and a parameter file or link, which does not.</li></ul></section>")
            out.append("<section><h2>Pages</h2><ul>" + "".join(f'<li><a href="{p}">{e(l)}</a>: {e(d)}</li>' for p, l, _, d in PAGES[1:]) + "</ul></section>")
            m = card["metrics"]
            out.append(f"<section><h2>Numbers from the loaded model card</h2><ul><li>{n_rows} flame-spread rows from {n_reports} reports in this build</li>"
                       f"<li>Gravity counts are on the model card (0, 0.165, 0.38, and 1 g where rows exist)</li>"
                       f"<li>Cross-validated accuracy {m['cv_accuracy']} beside majority baseline {m['majority_baseline_accuracy']}</li>"
                       f"<li>{len(F.INVESTIGATIONS)} PSI investigation entries are listed in the bundled source notes</li></ul>"
                       "<p>These figures are whatever the shipped model card and source list contain. A later official data release is not loaded and is not estimated.</p></section>")
        else:
            out.append(f"<h1>{e(info[1])}</h1><p>{e(info[3])}</p>")
            if route == "/simulator":
                out.append("<p>The sandbox is the free-form condition editor. The 3D view is an illustrative rendering driven by the inputs and the model output (flame shape from \u221ag buoyancy scaling, size and colour from O2 and pressure, skew from airflow). It is not a combustion simulation and not evidence. "
                           "Environment tabs: Earth (1 g), Moon (0.165 g), Mars (0.38 g), ISS microgravity (~0 g) and a transit cabin (coasting spaceflight is free fall; powered-flight thrust phases are not modelled). "
                           "Choosing Moon or Mars sets that gravity preset. It does not mean a habitat fire was tested on that body. The facility named on each loaded row is the provenance.</p>")
                out.append("<p>Save the current point into a new investigation, or add it to the last one you opened. The green slider band is the separate minimum and maximum of that one input. It is not a jointly tested box.</p>")
                out.append(_environments(env_counts))
            elif route == "/dashboard":
                out.append("<section><h2>Guest dashboard</h2>"
                           "<p>The dashboard lists investigations saved in this browser, the latest activity, and a next step chosen from what is missing: a question, a saved scenario, a material comparison, private notes, or a backup. "
                           "There is no account in this prototype. The guest id is a label for this browser’s storage adapter, not authentication and not encryption. "
                           "If storage is blocked, the session stays in memory and says so. If the saved JSON is corrupt or from an unknown schema version, it is left in place until you choose to replace it. "
                           "Import accepts a versioned workspace backup or a parameter file. A parameter file restores conditions only.</p>"
                           "<p>Guided investigations walk question, conditions, evidence, comparison, and notes. The sandbox shows every section at once and is the same control set as the condition editor. "
                           "Nothing here syncs to another device. Download a full backup before treating the browser as an archive.</p></section>")
            elif route == "/workspace":
                out.append("<section><h2>One investigation</h2>"
                           "<p>An investigation has a title, a question, private notes, saved scenarios, and saved material comparisons. "
                           "Notes are omitted from parameter links and from the parameter JSON. A full backup includes them and is still just a file you download. "
                           "Opening a parameter link does not create an account and does not reveal another person’s notes.</p>"
                           "<p>Evidence is the nearest loaded experiments, ranked by Euclidean distance over range-scaled oxygen, pressure, and airflow, plus penalties when the material, gravity, or flow direction differ. "
                           "Similarity is 1/(1+distance). It ranks distance. It is not a probability that two tests are the same case. "
                           "A joint match is reported only when a loaded row is within the stated tolerances on oxygen, pressure, airflow, and the same material, gravity, and flow direction, and the gas mix is oxygen/nitrogen. "
                           "Otherwise an in-range model class is labeled as a min/max box, not as a tested combination. Gas mixes other than oxygen/nitrogen, unknown materials, and untested gravity pairings produce no estimate.</p>"
                           "<p>The model estimate and the 3D flame are shown in separate sections so they are not read as measurements. "
                           "Comparisons recompute each material at the shared oxygen, pressure, airflow, gravity, and gas mix. Two saved scenarios that differ in more than the material are labeled as two points, not as a controlled comparison.</p></section>")
            elif route == "/how-it-works":
                m = card["metrics"]
                out.append("<section><h2>What this is for</h2>"
                           "<p>IGNITE-AI helps you investigate how flames behave when gravity is very small, and how that compares with normal Earth gravity. "
                           "It is a learning and research aid. It does not certify a material or clear a vehicle.</p></section>")
                out.append("<section><h2>Walkthrough</h2><ol>"
                           "<li>Start a new investigation from the top bar or from Today. Write a title and the question.</li>"
                           "<li>Choose guided steps, or the sandbox if you want the controls first.</li>"
                           "<li>Set gravity (Earth 1 g, Moon preset 0.165 g, Mars preset 0.38 g, ISS or transit about 0 g), oxygen in percent, pressure in kPa, and ventilation in cm/s. "
                           "The green band is the lowest and highest tested value of that one input. It is not a jointly tested box. A gravity preset is not a habitat test.</li>"
                           "<li>Read the estimate only when the point is inside the loaded tests. The class shares are not a calibrated confidence or a risk score. Outside the loaded tests there is no estimate.</li>"
                           "<li>Compare materials at the same oxygen, pressure, airflow, gravity, and gas mix. Unsupported combinations stay visible as limitations.</li>"
                           "<li>Use the ranked experiments and their report links as the evidence. The 3D flame is an illustration, not a measurement.</li>"
                           "<li>Save notes in this browser. A full backup includes them. A parameter link does not.</li>"
                           "<li>Return to Today for saved investigations and the next missing step. Nothing is synced to another device.</li>"
                           "<li>Switch Light, Dark, or System in the top bar. System follows this computer. The choice is stored in this browser.</li>"
                           "</ol></section>")
                out.append(f"<section><h2>The model</h2><p>The classifier in this build is trained on {n_rows} flame-spread rows from {n_reports} NASA reports. "
                           f"Stratified cross-validated accuracy is {m['cv_accuracy']}. The majority-class baseline on the same rows is {m['majority_baseline_accuracy']}. "
                           "These numbers are read from the model card. Use them to study the loaded record, not as a safety certification.</p></section>")
            elif route == "/learn":
                out.append(_crisis())
                out.append("<section><h2>Three different outputs</h2><ul>"
                           "<li><strong>Experiment evidence.</strong> Published rows, a distance rank, a quote, and a link. This is the evidence.</li>"
                           "<li><strong>Statistical model estimate.</strong> A class share from the gradient-boosting model, only inside the loaded envelope. Not a calibrated confidence, a risk score, or a certificate.</li>"
                           "<li><strong>Illustrative flame.</strong> A qualitative 3D sketch. Not flame physics and not additional evidence.</li></ul>"
                           "<p>Partial-gravity presets select 0.165 g or 0.38 g and show cited context. Whether a row exists, and in which facility, is read from the loaded table. "
                           "Drop-tower, centrifuge, parabolic-flight, and rocket facilities are not the same thing as a surface habitat test. "
                           "Safety notes, sources, and the model card stay on their own pages.</p></section>")
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
               'Machine-readable summary: <a href="/llms.txt">/llms.txt</a>; API: <a href="/docs">/docs</a>; source code: <a href="https://github.com/banglapoly/ignite-ai-app">GitHub</a>.</p></footer></div>')
    return "\n".join(out)


def llms_txt(card: dict, n_rows: int, n_reports: int) -> str:
    m = card["metrics"]
    lines = [f"# {TITLE}", "", f"> {TAGLINE}", "",
             "Open-source (Apache-2.0) research workspace for combustion-condition investigations. Model estimates use only the published experiments loaded in this build and are not a certification.",
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
