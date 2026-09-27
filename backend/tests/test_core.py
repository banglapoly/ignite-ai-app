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


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("PASS", name)
