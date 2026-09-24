"""Sanity tests. Run from backend/:  python -m tests.test_core   (or pytest tests)"""
from src.compute.predict import predict

SIBAL = {"material": "SIBAL_fabric", "pressure_kpa": 101.3, "flow_cm_s": 3, "flow_direction": "concurrent"}


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


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("PASS", name)
