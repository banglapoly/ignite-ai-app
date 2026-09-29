"""Sanity tests. Run from backend/:  python -m tests.test_core   (or pytest tests)"""
from src.compute.predict import predict
from src.compute import kb

SIBAL = {"material": "SIBAL_fabric", "pressure_kpa": 101.3, "flow_cm_s": 3, "flow_direction": "concurrent"}
MYLAR_MARS = {"material": "Mylar_G", "pressure_kpa": 70.3, "flow_cm_s": 0, "flow_direction": "concurrent", "gravity_g": 0.38}


def test_in_range_prediction_has_metadata():
    r = predict({**SIBAL, "oxygen_pct": 21})
    assert r["in_training_range"] is True
    assert r["prediction"] in {"spread", "marginal_spread", "no_spread"}
    assert abs(sum(r["probabilities"].values()) - 1) < 1e-6
    assert {"type", "n_train", "cv_accuracy", "features"} <= set(r["model"])
    assert len(r["nearest_experiments"]) == 3
    assert all(e["report_id"] and e["source_url"].startswith("https://ntrs.nasa.gov") for e in r["nearest_experiments"])


def test_out_of_range_is_refused():
    r = predict({**SIBAL, "oxygen_pct": 12})
    assert r["in_training_range"] is False
    assert r["prediction"] is None and r["range_violations"]
    r = predict({**SIBAL, "oxygen_pct": 21, "material": "unobtainium"})
    assert r["prediction"] is None


def test_o2_demo_crosses_boundary():
    """Killer demo: SIBAL, 1 atm, 3 cm/s concurrent, 21% -> 17% O2 changes class (supported by NTRS 20150008962)."""
    a = predict({**SIBAL, "oxygen_pct": 21})["prediction"]
    b = predict({**SIBAL, "oxygen_pct": 17})["prediction"]
    assert a != b, (a, b)


def test_untested_gravity_is_refused():
    """SIBAL was never tested at Martian gravity -> the guard must refuse, not extrapolate."""
    r = predict({**SIBAL, "oxygen_pct": 21, "flow_cm_s": 0, "flow_direction": "concurrent", "gravity_g": 0.38})
    assert r["prediction"] is None
    assert any("gravity" in v for v in r["range_violations"])


def test_non_air_gas_is_refused():
    r = predict({**SIBAL, "oxygen_pct": 21, "gas_mix": "co2"})
    assert r["prediction"] is None


def test_mars_mylar_crosses_boundary():
    """Olson & Ferkul 2012 Table I: Mylar G at Martian g burns at 18% O2 (ULOI*) and not at 17.5% (MOC*)."""
    a = predict({**MYLAR_MARS, "oxygen_pct": 18})
    b = predict({**MYLAR_MARS, "oxygen_pct": 17.5})
    assert a["in_training_range"] and b["in_training_range"]
    assert a["prediction"] != b["prediction"], (a["prediction"], b["prediction"])


def test_rag_declines_off_topic():
    r = kb.ask("What is the capital of France?")
    assert r["answered"] is False and not r["citations"]


def test_rag_cites_nasa_sources():
    r = kb.ask("Which fire extinguishers are used on the ISS?")
    assert r["answered"] is True and r["citations"]
    assert all(c["url"].startswith(("https://ntrs.nasa.gov", "https://psi.nasa.gov", "https://www.nasa.gov", "https://science.nasa.gov"))
               for c in r["citations"])
    assert "[1]" in r["answer"]


def test_every_page_has_static_text():
    """Each page route gets its own crawlable HTML (no JavaScript needed); no team/event placeholders anywhere."""
    from src.content import static_html
    from src.compute import psi_data
    from src.compute.predict import artifacts
    _, card, df = artifacts()
    envc = {k: {"n": 0} for k in ("earth", "moon", "mars", "iss", "transit")}
    for route, label, _title, _desc in static_html.PAGES:
        ex = [("Is lunar gravity more flammable than Earth?", kb.ask("Is lunar gravity more flammable than Earth?"))] if route == "/ask" else None
        html = static_html.build(card, len(df), df["report_id"].nunique(), envc, psi_data.flex_summary(), kb.stats(), route=route, df=df, ask_examples=ex)
        assert "<h1>" in html and all(f'href="{p}"' in html for p, *_ in static_html.PAGES), route
        assert "[Team" not in html and "Space Apps" not in html, route
        assert len(html) > 1500, (route, len(html))
    txt = static_html.llms_txt(card, len(df), df["report_id"].nunique())
    assert all(p in txt for p, *_ in static_html.PAGES) and "[Team" not in txt


def test_prerendered_pages_are_current():
    """frontend/prerender/pages.json (static hosting) must match what the server renders now.
    If this fails, run `python -m scripts.export_static` in backend/ and commit the result."""
    import json, pathlib
    f = pathlib.Path(__file__).resolve().parents[2] / "frontend" / "prerender" / "pages.json"
    if not f.exists():
        return
    from scripts.export_static import build_pages
    committed = json.loads(f.read_text(encoding="utf-8"))
    fresh = build_pages()
    assert committed.keys() == fresh.keys()
    stale = [r for r in fresh if committed[r] != fresh[r]]
    assert not stale, f"stale prerendered pages {stale}: run python -m scripts.export_static"


def test_static_api_is_current():
    """frontend/public/static-api/*.json (used when the site runs without a backend) must match the API.
    If this fails, run `python -m scripts.export_static` in backend/ and commit the result."""
    import json, pathlib
    d = pathlib.Path(__file__).resolve().parents[2] / "frontend" / "public" / "static-api"
    if not d.exists():
        return
    from scripts.export_static import build_static_api
    fresh = json.loads(json.dumps(build_static_api(), ensure_ascii=False))
    stale = [k for k, v in fresh.items() if json.loads((d / f"{k}.json").read_text(encoding="utf-8")) != v]
    assert not stale, f"stale static API files {stale}: run python -m scripts.export_static"


def test_exported_trees_reproduce_the_model():
    """The browser predictor (plain trees in predictor.json) must give sklearn's probabilities."""
    import math
    import numpy as np
    import pandas as pd
    from scripts.export_static import build_predictor
    from src.compute.predict import artifacts
    from src.compute.model import FEATURES
    pm = build_predictor()
    pipe, card, df = artifacts()
    rng = np.random.default_rng(0)
    rows = df[FEATURES].sample(40, random_state=1).to_dict("records")
    for r in list(rows):   # plus jittered points between experiments
        rows.append({**r, "oxygen_pct": r["oxygen_pct"] + float(rng.normal(0, 2)), "flow_cm_s": max(0.0, r["flow_cm_s"] + float(rng.normal(0, 3)))})
    want = pipe.predict_proba(pd.DataFrame(rows)[FEATURES])
    cats = pm["features"]["categorical"]
    for r, w in zip(rows, want):
        x = [np.float32(r[c]) for c in pm["features"]["numeric"]]
        for c, vals in cats.items():
            x += [np.float32(1.0 if r[c] == v else 0.0) for v in vals]
        raw = list(pm["init"])
        for stage in pm["trees"]:
            for k, t in enumerate(stage):
                n = 0
                while t["l"][n] != -1:
                    n = t["l"][n] if x[t["f"][n]] <= t["t"][n] else t["r"][n]
                raw[k] += pm["learning_rate"] * t["v"][n]
        m = max(raw); e = [math.exp(v - m) for v in raw]; p = [v / sum(e) for v in e]
        assert max(abs(a - b) for a, b in zip(p, w)) < 1e-9, (r, p, w)


def test_refusals_are_human_readable():
    """Refusal reasons name quantities and materials in words (no raw ids like oxygen_pct=... or SIBAL_fabric)."""
    r = predict({**SIBAL, "oxygen_pct": 32.3})
    assert r["range_violations"] == ["Oxygen 32.3% is outside the tested range of 16.4% to 31% for SIBAL cotton-fiberglass fabric."], r["range_violations"]
    r = predict({**SIBAL, "oxygen_pct": 21, "gas_mix": "methane"})
    assert r["range_violations"][0].startswith("Gas mix \u201cMethane leak\u201d is not in the training data")
    for v in r["range_violations"] + predict({**SIBAL, "oxygen_pct": 12, "pressure_kpa": 20, "flow_cm_s": 90})["range_violations"]:
        assert "_" not in v and "=" not in v, v
    assert "\u2022 " in r["explanation"]["text"] if "explanation" in r else True


def test_material_labels_match_frontend():
    import re, pathlib
    from src.compute.predict import MATERIAL_LABEL
    ts = (pathlib.Path(__file__).resolve().parents[2] / "frontend/src/lib/labels.ts").read_text(encoding="utf-8")
    pairs = dict(re.findall(r"^\s*'?([\w\-]+)'?: '([^']*)',", ts, flags=re.M))
    assert pairs == MATERIAL_LABEL, (pairs, MATERIAL_LABEL)


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("PASS", name)
