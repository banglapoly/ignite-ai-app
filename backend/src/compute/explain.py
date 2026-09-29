"""Explanation layer.

Default: deterministic templates that only restate fields of the prediction object.
Optional: a LOCAL LLM through Ollama (set IGNITE_LLM=ollama, IGNITE_LLM_MODEL=llama3.2 etc.; the older
FLAME_LLM* names still work).
The LLM only rephrases; any number in its output that does not appear in the prediction
object makes us discard the LLM text and fall back to the template.
"""
from __future__ import annotations
import json, os, re, urllib.request

NICE = {"no_spread": "no spread", "marginal_spread": "marginal (near-limit) spread", "spread": "sustained spread"}


def _fmt(x: float) -> str:
    return f"{x:g}"


def _exp(e: dict) -> str:
    from .predict import mat_label
    return (f"{e['report_id']} ({_fmt(e['oxygen_pct'])}% O\u2082, {_fmt(e['pressure_kpa'])} kPa, "
            f"{_fmt(e['flow_cm_s'])} cm/s {e['flow_direction']}, {mat_label(e['material'])}): observed {NICE[e['outcome']]}"
            f" - {e['outcome_detail']}")


GNAME = {0.0: "microgravity (~0 g)", 0.165: "lunar gravity (0.165 g)", 0.38: "Martian gravity (0.38 g)", 1.0: "Earth gravity (1 g)"}


def template(p: dict) -> dict:
    i = p["inputs"]
    g = float(i.get("gravity_g", 0.0))
    from .predict import GAS_LABEL, mat_label
    gas = i.get("gas_mix", "air")
    cond = (f"{GNAME.get(round(g, 3), f'{g:g} g')}, oxygen {_fmt(i['oxygen_pct'])}%, pressure {_fmt(i['pressure_kpa'])} kPa, "
            f"airflow {_fmt(i['flow_cm_s'])} cm/s {i['flow_direction']}, {mat_label(i['material'])}"
            + ("" if gas == "air" else f", gas mix {GAS_LABEL.get(gas, gas)}"))
    m = p["model"]
    if not p["in_training_range"]:
        lines = [f"No prediction. The requested conditions ({cond}) are outside the published experimental envelope "
                 f"used to train this model.",
                 *[f"\u2022 {r}" for r in p.get("range_violations", [])],
                 "A fire-safety tool must not guess outside its evidence. The closest real experiments are listed for reference only."]
        return {"source": "template", "text": "\n".join(lines)}
    pr = p["probabilities"][p["prediction"]]
    lines = [f"At {cond}, the model predicts {NICE[p['prediction']]} (probability {pr:g}).",
             f"Model: {m['type'].replace('_', '-')} classifier trained on {m['n_train']} published tests across gravity levels (0, 0.165, 0.38 and 1 g); stratified cross-validated accuracy {m['cv_accuracy']:g}."]
    if p.get("supporting_experiment"):
        lines.append("Evidence on the predicted side: " + _exp(p["supporting_experiment"]) + ".")
    if p.get("contrast_experiment"):
        lines.append("Nearest evidence on the other side of the boundary: " + _exp(p["contrast_experiment"]) + ".")
    u = p.get("uncertainty") or {}
    if u:
        lines.append(f"Confidence: {u['level']} (top probability {u['max_probability']:g}, "
                     f"{u['neighbours_agreeing']} of 3 nearest experiments agree).")
    from .model import gkey
    acc_g = (m.get("oof_accuracy_by_gravity") or {}).get(gkey(g))
    if g > 0 and acc_g:
        lines.append(f"Caution: only {acc_g['n']} real experiments exist at this gravity level, so this output is essentially a lookup of the "
                     f"nearest published test (out-of-fold accuracy at this gravity {acc_g['accuracy']:g}).")
    if u.get("level") == "low":
        lines.append("Treat this as a flag for testing, not as a clearance: the nearest published data disagree or are sparse.")
    return {"source": "template", "text": "\n".join(lines)}


def _numbers(text: str) -> set[str]:
    return {n.rstrip(".") for n in re.findall(r"\d+(?:\.\d+)?", text)}


def maybe_llm(p: dict, abstracts: list[dict]) -> dict | None:
    if os.environ.get("IGNITE_LLM", os.environ.get("FLAME_LLM", "")).lower() != "ollama":
        return None
    facts = {"prediction_object": {k: p[k] for k in ("inputs", "in_training_range", "prediction", "probabilities", "model",
                                                     "nearest_experiments", "contrast_experiment") if k in p},
             "abstracts": [{"report_id": a["report_id"], "title": a["title"], "snippet": a["abstract_snippet"]} for a in abstracts]}
    prompt = ("You explain a fire-safety model output to a spacecraft operator in 4 sentences. Use ONLY the JSON facts. "
              "Never introduce a number that is not in the JSON. Cite report ids exactly.\nFACTS:\n" + json.dumps(facts))
    try:
        req = urllib.request.Request(os.environ.get("IGNITE_LLM_URL", os.environ.get("FLAME_LLM_URL", "http://localhost:11434/api/generate")),
                                     data=json.dumps({"model": os.environ.get("IGNITE_LLM_MODEL", os.environ.get("FLAME_LLM_MODEL", "llama3.2")),
                                                      "prompt": prompt, "stream": False}).encode(),
                                     headers={"Content-Type": "application/json"})
        text = json.load(urllib.request.urlopen(req, timeout=30)).get("response", "").strip()
    except Exception:
        return None
    allowed = _numbers(json.dumps(facts))
    bad = [n for n in _numbers(text) if n not in allowed]
    if bad or not text:
        return None
    return {"source": "ollama", "text": text}


def explain(p: dict, abstracts: list[dict]) -> dict:
    return maybe_llm(p, abstracts) or template(p)
