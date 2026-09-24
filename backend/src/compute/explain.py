"""Explanation layer.

Default: deterministic templates that only restate fields of the prediction object.
Optional: a LOCAL LLM through Ollama (set FLAME_LLM=ollama, FLAME_LLM_MODEL=llama3.2 etc.).
The LLM only rephrases; any number in its output that does not appear in the prediction
object makes us discard the LLM text and fall back to the template.
"""
from __future__ import annotations
import json, os, re, urllib.request

NICE = {"no_spread": "no spread", "marginal_spread": "marginal (near-limit) spread", "spread": "sustained spread"}


def _fmt(x: float) -> str:
    return f"{x:g}"


def _exp(e: dict) -> str:
    return (f"{e['report_id']} ({_fmt(e['oxygen_pct'])}% O2, {_fmt(e['pressure_kpa'])} kPa, "
            f"{_fmt(e['flow_cm_s'])} cm/s {e['flow_direction']}, {e['material']}): observed {NICE[e['outcome']]}"
            f" - {e['outcome_detail']}")


def template(p: dict) -> dict:
    i = p["inputs"]
    cond = (f"{_fmt(i['oxygen_pct'])}% O2, {_fmt(i['pressure_kpa'])} kPa, {_fmt(i['flow_cm_s'])} cm/s "
            f"{i['flow_direction']} flow, material {i['material']}")
    m = p["model"]
    if not p["in_training_range"]:
        lines = [f"No prediction. The requested conditions ({cond}) are outside the published experimental envelope "
                 f"used to train this model.",
                 *[f"- {r}" for r in p.get("range_violations", [])],
                 "A fire-safety tool must not guess outside its evidence. The closest real experiments are listed for reference only."]
        return {"source": "template", "text": "\n".join(lines)}
    pr = p["probabilities"][p["prediction"]]
    lines = [f"At {cond}, the model predicts {NICE[p['prediction']]} (probability {pr:g}).",
             f"Model: {m['type']} trained on {m['n_train']} published microgravity tests; stratified cross-validated accuracy {m['cv_accuracy']:g}."]
    if p.get("supporting_experiment"):
        lines.append("Evidence on the predicted side: " + _exp(p["supporting_experiment"]) + ".")
    if p.get("contrast_experiment"):
        lines.append("Nearest evidence on the other side of the boundary: " + _exp(p["contrast_experiment"]) + ".")
    u = p.get("uncertainty") or {}
    if u:
        lines.append(f"Confidence: {u['level']} (top probability {u['max_probability']:g}, "
                     f"{u['neighbours_agreeing']} of 3 nearest experiments agree).")
    if u.get("level") == "low":
        lines.append("Treat this as a flag for testing, not as a clearance: the nearest published data disagree or are sparse.")
    return {"source": "template", "text": "\n".join(lines)}


def _numbers(text: str) -> set[str]:
    return {n.rstrip(".") for n in re.findall(r"\d+(?:\.\d+)?", text)}


def maybe_llm(p: dict, abstracts: list[dict]) -> dict | None:
    if os.environ.get("FLAME_LLM", "").lower() != "ollama":
        return None
    facts = {"prediction_object": {k: p[k] for k in ("inputs", "in_training_range", "prediction", "probabilities", "model",
                                                     "nearest_experiments", "contrast_experiment") if k in p},
             "abstracts": [{"report_id": a["report_id"], "title": a["title"], "snippet": a["abstract_snippet"]} for a in abstracts]}
    prompt = ("You explain a fire-safety model output to a spacecraft operator in 4 sentences. Use ONLY the JSON facts. "
              "Never introduce a number that is not in the JSON. Cite report ids exactly.\nFACTS:\n" + json.dumps(facts))
    try:
        req = urllib.request.Request(os.environ.get("FLAME_LLM_URL", "http://localhost:11434/api/generate"),
                                     data=json.dumps({"model": os.environ.get("FLAME_LLM_MODEL", "llama3.2"),
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
