"""Prediction with a hard training-envelope guard and nearest real experiments.

The model never extrapolates: if the requested point falls outside the min/max of the
experiments for that material (or uses a flow direction never tested for that material),
no class is returned.
"""
from __future__ import annotations
import json, pathlib
from functools import lru_cache
import numpy as np
import pandas as pd
import joblib

from .model import ART, DATA, NUMERIC, FEATURES, CLASSES, GRAVITY, gkey

ROOT = pathlib.Path(__file__).resolve().parents[2]


@lru_cache(maxsize=1)
def artifacts():
    pipe = joblib.load(ART / "model.joblib")
    card = json.loads((ART / "model_card.json").read_text())
    df = pd.read_csv(DATA)
    return pipe, card, df


def _scale(card) -> dict:
    g = card["training_range"]["global"]
    return {c: max(g[c][1] - g[c][0], 1e-9) for c in NUMERIC}


GRAVITY_NAMES = {"0": "microgravity (~0 g)", "0.165": "lunar gravity (0.165 g)", "0.38": "Martian gravity (0.38 g)", "1": "Earth gravity (1 g)"}
GAS_MIXES = {"air": "O2/N2 (normal air or N2-diluted/enriched O2)"}
# Human-readable names used in refusal messages and explanations. MATERIAL_LABEL must match
# frontend/src/lib/api.ts (a test checks this); the in-browser copy is frontend/src/lib/offline/predict.ts.
MATERIAL_LABEL = {
    "SIBAL_fabric": "SIBAL cotton-fiberglass fabric",
    "cellulose_thin": "Thin cellulose (Kimwipes, 0.0076 cm)",
    "cellulose_double": "Thin cellulose, double (0.0152 cm)",
    "filter_paper": "Ashless filter paper (SSCE)",
    "PMMA_thick": "Thick PMMA (acrylic) slab",
    "cotton_jersey": "Cotton jersey fabric",
    "Nomex_HT90-40": "Nomex HT90-40 fabric",
    "Ultem_1000": "Ultem 1000 film",
    "Mylar_G": "Mylar G film",
    "silicone": "Silicone sheet",
}
GAS_LABEL = {"air": "Normal air (O\u2082/N\u2082)", "co2": "Carbon dioxide build-up", "methane": "Methane leak"}
QUANTITY = {"oxygen_pct": ("Oxygen", "%"), "pressure_kpa": ("Pressure", " kPa"), "flow_cm_s": ("Airflow", " cm/s")}


def mat_label(m: str) -> str:
    return MATERIAL_LABEL.get(m, m)


def check_range(inp: dict, card: dict) -> tuple[bool, list[str]]:
    reasons = []
    gas = inp.get("gas_mix", "air")
    mat = mat_label(inp["material"])
    if gas != "air":
        reasons.append(f"Gas mix \u201c{GAS_LABEL.get(gas, gas)}\u201d is not in the training data: every training experiment burned in "
                       "oxygen/nitrogen atmospheres only, so the model cannot say anything about it.")
    menv = card["training_range"]["materials"].get(inp["material"])
    if menv is None:
        return False, reasons + [f"Material \u201c{mat}\u201d is not in the training data."]
    gk = gkey(inp.get(GRAVITY, 0.0))
    env = menv["by_gravity"].get(gk)
    if env is None:
        tested = ", ".join(GRAVITY_NAMES.get(k, k + " g") for k in menv["by_gravity"])
        return False, reasons + [f"No real experiment with {mat} exists at {GRAVITY_NAMES.get(gk, gk + ' g')}. "
                                 f"This material was tested at: {tested}. The model will not guess across gravity levels."]
    for c in NUMERIC:
        lo, hi = env[c]
        v = float(inp[c])
        if v < lo - 1e-9 or v > hi + 1e-9:
            name, u = QUANTITY[c]
            reasons.append(f"{name} {v:g}{u} is outside the tested range of {lo:g}{u} to {hi:g}{u} for {mat}.")
    if inp["flow_direction"] not in env["flow_directions"]:
        reasons.append(f"{inp['flow_direction'].capitalize()} flow was never tested for {mat} "
                       f"(tested: {', '.join(env['flow_directions'])}).")
    g0 = float(inp.get(GRAVITY, 0.0)) == 0.0
    if g0 and float(inp["flow_cm_s"]) == 0 and inp["flow_direction"] != "quiescent":
        reasons.append("In microgravity, zero airflow means quiescent conditions: choose the quiescent (no flow) direction.")
    if float(inp["flow_cm_s"]) > 0 and inp["flow_direction"] == "quiescent":
        reasons.append("Quiescent (no flow) conditions need an airflow of 0 cm/s.")
    return (len(reasons) == 0), reasons


def distances(inp: dict, df: pd.DataFrame, card: dict) -> np.ndarray:
    s = _scale(card)
    d2 = np.zeros(len(df))
    for c in NUMERIC:
        d2 += ((df[c].to_numpy(dtype=float) - float(inp[c])) / s[c]) ** 2
    d = np.sqrt(d2)
    d += np.where(df["material"].to_numpy() == inp["material"], 0.0, 1.0)      # material mismatch penalty
    d += np.where(np.isclose(df[GRAVITY].to_numpy(dtype=float), float(inp.get(GRAVITY, 0.0))), 0.0, 1.0)  # gravity mismatch
    d += np.where(df["flow_direction"].to_numpy() == inp["flow_direction"], 0.0, 0.25)
    return d


def _exp_record(r: pd.Series, dist: float) -> dict:
    return {
        "row_id": r["row_id"], "report_id": r["report_id"], "source_url": r["source_url"],
        "source_title": r["source_title"], "source_location": r["source_location"], "quote": r["quote"],
        "oxygen_pct": float(r["oxygen_pct"]), "pressure_kpa": float(r["pressure_kpa"]),
        "flow_cm_s": float(r["flow_cm_s"]), "flow_direction": r["flow_direction"], "gravity_g": float(r[GRAVITY]),
        "material": r["material"], "material_detail": r["material_detail"], "facility": r["facility"],
        "outcome": r["outcome"], "outcome_detail": r["outcome_detail"], "distance": round(float(dist), 4),
    }


def predict(inp: dict, k: int = 3) -> dict:
    pipe, card, df = artifacts()
    inp = {"oxygen_pct": float(inp["oxygen_pct"]), "pressure_kpa": float(inp["pressure_kpa"]),
           "flow_cm_s": float(inp["flow_cm_s"]), "material": inp["material"],
           "flow_direction": inp.get("flow_direction") or ("quiescent" if float(inp["flow_cm_s"]) == 0 else "concurrent"),
           GRAVITY: float(inp.get(GRAVITY) or 0.0), "gas_mix": inp.get("gas_mix") or "air"}
    ok, reasons = check_range(inp, card)
    d = distances(inp, df, card)
    order = np.argsort(d, kind="stable")
    nearest = [_exp_record(df.iloc[i], d[i]) for i in order[:k]]
    model_meta = {**card["model"], "oof_accuracy_by_gravity": card["metrics"].get("oof_accuracy_by_gravity", {})}
    out = {"inputs": inp, "in_training_range": ok, "model": model_meta}
    if not ok:
        out.update({"prediction": None, "probabilities": None, "range_violations": reasons,
                    "nearest_experiments": nearest, "contrast_experiment": None,
                    "uncertainty": None,
                    "explanation_facts": {"refused": True}})
        return out
    X = pd.DataFrame([inp])[FEATURES]
    proba = pipe.predict_proba(X)[0]
    classes = list(pipe.classes_)
    probs = {c: round(float(proba[classes.index(c)]), 3) for c in CLASSES}
    pred = max(probs, key=probs.get)
    # contrast: nearest same-material experiment with a different outcome (the "other side")
    same = (df["material"].to_numpy() == inp["material"]) & np.isclose(df[GRAVITY].to_numpy(dtype=float), inp[GRAVITY])
    contrast = None
    for i in order:
        if same[i] and df.iloc[i]["outcome"] != pred:
            contrast = _exp_record(df.iloc[i], d[i]); break
    support = None
    for i in order:
        if same[i] and df.iloc[i]["outcome"] == pred:
            support = _exp_record(df.iloc[i], d[i]); break
    top = sorted(probs.values(), reverse=True)
    near_d = float(d[order[0]])
    agree = sum(1 for e in nearest if e["outcome"] == pred)
    level = "low"
    if top[0] >= 0.8 and near_d < 0.08 and agree >= 2:
        level = "high"
    elif top[0] >= 0.6 and near_d < 0.2:
        level = "medium"
    out.update({
        "prediction": pred, "probabilities": probs,
        "nearest_experiments": nearest, "supporting_experiment": support, "contrast_experiment": contrast,
        "uncertainty": {"max_probability": top[0], "margin_to_second": round(top[0] - top[1], 3),
                        "nearest_distance": round(near_d, 4), "neighbours_agreeing": agree, "level": level,
                        "note": "Distance is Euclidean over range-normalised O2, pressure and flow (+1 for a different material, +1 for a different gravity level)."},
    })
    return out
