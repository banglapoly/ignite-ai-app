"""FastAPI service: /health /model /experiments /predict /boundary /corpus + static frontend."""
from __future__ import annotations
import pathlib
from typing import Literal
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from src.compute.predict import predict, artifacts, check_range
from src.compute.model import FEATURES, NUMERIC
from src.compute import retrieval, explain

ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT.parent / "frontend" / "dist"

app = FastAPI(title="Flame in Freefall API", version="1.0.0",
              description="Microgravity flame-spread regime explorer. All data from public NASA reports.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class PredictIn(BaseModel):
    oxygen_pct: float = Field(..., description="O2 mole/volume percent")
    pressure_kpa: float
    flow_cm_s: float = Field(..., ge=0)
    material: str
    flow_direction: Literal["opposed", "concurrent", "quiescent"] | None = None


@app.get("/api/health")
@app.get("/health")
def health():
    pipe, card, df = artifacts()
    return {"status": "ok", "n_train": card["model"]["n_train"], "cv_accuracy": card["model"]["cv_accuracy"]}


@app.get("/api/model")
@app.get("/model")
def model():
    return artifacts()[1]


@app.get("/api/experiments")
@app.get("/experiments")
def experiments(material: str | None = None):
    df = artifacts()[2]
    if material:
        df = df[df["material"] == material]
    return {"n": int(len(df)), "rows": df.fillna("").to_dict(orient="records")}


@app.post("/api/predict")
@app.post("/predict")
def do_predict(body: PredictIn):
    p = predict(body.model_dump())
    related = retrieval.search(retrieval.query_for(p["inputs"], p.get("prediction")), k=3)
    # abstracts of the reports behind the nearest experiments
    cited = []
    for e in p["nearest_experiments"] + ([p["contrast_experiment"]] if p.get("contrast_experiment") else []):
        rid = e["report_id"].replace("NTRS ", "")
        if rid not in [c["ntrs_id"] for c in cited]:
            d = retrieval.get_abstract(rid)
            if d:
                cited.append({"ntrs_id": rid, "title": d["title"], "abstract": (d.get("abstract") or "")[:600]})
    p["related_reports"] = related
    p["cited_abstracts"] = cited
    p["explanation"] = explain.explain(p, related)
    return p


@app.get("/api/boundary")
@app.get("/boundary")
def boundary(material: str, flow_direction: str, x: str = "oxygen_pct", y: str = "flow_cm_s",
             oxygen_pct: float | None = None, pressure_kpa: float | None = None, flow_cm_s: float | None = None,
             nx: int = Query(60, le=120), ny: int = Query(50, le=120)):
    pipe, card, df = artifacts()
    env = card["training_range"]["materials"].get(material)
    if env is None or x not in NUMERIC or y not in NUMERIC or x == y:
        raise HTTPException(400, "bad material or axes")
    fixed = {"oxygen_pct": oxygen_pct, "pressure_kpa": pressure_kpa, "flow_cm_s": flow_cm_s}
    third = [c for c in NUMERIC if c not in (x, y)][0]
    if fixed[third] is None:
        raise HTTPException(400, f"provide {third}")
    xs = np.linspace(env[x][0], env[x][1], nx) if env[x][1] > env[x][0] else np.array([env[x][0]])
    if env[y][1] > env[y][0]:
        ys = (np.linspace(np.sqrt(env[y][0]), np.sqrt(env[y][1]), ny) ** 2) if y == "flow_cm_s" else np.linspace(env[y][0], env[y][1], ny)
    else:
        ys = np.array([env[y][0]])
    gx, gy = np.meshgrid(xs, ys)
    grid = pd.DataFrame({x: gx.ravel(), y: gy.ravel()})
    grid[third] = fixed[third]
    grid["material"] = material
    grid["flow_direction"] = flow_direction
    classes = list(pipe.classes_)
    proba = pipe.predict_proba(grid[FEATURES])
    pred = [classes[i] for i in proba.argmax(1)]
    maxp = proba.max(1)
    in_rng = [check_range(r, card)[0] for r in grid[NUMERIC + ["material", "flow_direction"]].to_dict("records")]
    z = [p if ok else None for p, ok in zip(pred, in_rng)]
    pts = df[df["material"] == material].fillna("")
    return {"x": x, "y": y, "third": third, "third_value": fixed[third], "xs": xs.tolist(), "ys": ys.tolist(),
            "z": np.array(z, dtype=object).reshape(len(ys), len(xs)).tolist(),
            "confidence": np.round(maxp, 3).reshape(len(ys), len(xs)).tolist(),
            "points": pts[["row_id", "oxygen_pct", "pressure_kpa", "flow_cm_s", "flow_direction", "outcome", "report_id", "source_url"]].to_dict("records"),
            "envelope": env}


@app.get("/api/experiments.csv")
def experiments_csv():
    return FileResponse(ROOT / "data" / "experiments.csv", media_type="text/csv", filename="experiments.csv")


@app.get("/api/corpus")
@app.get("/corpus")
def corpus():
    docs, _, _ = retrieval.index()
    used = set(artifacts()[2]["report_id"].str.replace("NTRS ", "").tolist())
    return {"n": len(docs), "reports": [{"ntrs_id": d["ntrs_id"], "title": d["title"], "date": d.get("date", ""),
                                          "url": d["url"], "used_in_dataset": d["ntrs_id"] in used} for d in docs]}


if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = DIST / path
        if path and f.is_file():
            return FileResponse(f)
        return FileResponse(DIST / "index.html")
