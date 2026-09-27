"""IGNITE-AI FastAPI service + static frontend.

Pages: / /simulator /predict /ask /safety /data /sources (each served with its own crawlable static HTML inside #root;
       /demo redirects to /simulator for old links).
API:   /health /api/model /api/experiments(.csv) /api/predict /api/boundary /api/corpus
       /api/environments /api/safety /api/flex /api/psi /api/ask /api/kb  /llms.txt
"""
from __future__ import annotations
import mimetypes, pathlib, re
mimetypes.add_type("application/manifest+json", ".webmanifest")
from functools import lru_cache
from typing import Literal
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, RedirectResponse
from html import escape
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from src.compute.predict import predict, artifacts, check_range
from src.compute.model import FEATURES, NUMERIC, GRAVITY, gkey
from src.compute import retrieval, explain, kb, psi_data
from src.content import facts as F, static_html

ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT.parent / "frontend" / "dist"

app = FastAPI(title="IGNITE-AI API", version="2.0.0",
              description="Predictive fire safety analytics for space station orbit & rocket transit. All data from public NASA sources.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class PredictIn(BaseModel):
    oxygen_pct: float = Field(..., description="O2 mole/volume percent")
    pressure_kpa: float
    flow_cm_s: float = Field(..., ge=0)
    material: str
    flow_direction: Literal["opposed", "concurrent", "quiescent"] | None = None
    gravity_g: float = Field(0.0, ge=0, description="gravity level in Earth g (data exist for 0, 0.165, 0.38, 1)")
    gas_mix: Literal["air", "co2", "methane"] = "air"


class AskIn(BaseModel):
    question: str = Field(..., max_length=500)


@app.get("/api/health")
@app.get("/health")
def health():
    pipe, card, df = artifacts()
    return {"status": "ok", "app": "IGNITE-AI", "n_train": card["model"]["n_train"], "cv_accuracy": card["model"]["cv_accuracy"],
            "gravity_levels": card["training_range"]["gravity_levels"]}


@app.get("/api/model")
def model():
    return artifacts()[1]


@app.get("/api/experiments")
def experiments(material: str | None = None, gravity_g: float | None = None):
    df = artifacts()[2]
    if material:
        df = df[df["material"] == material]
    if gravity_g is not None:
        df = df[np.isclose(df[GRAVITY], gravity_g)]
    return {"n": int(len(df)), "rows": df.fillna("").to_dict(orient="records")}


@app.post("/api/predict")
def do_predict(body: PredictIn):
    p = predict(body.model_dump())
    related = retrieval.search(retrieval.query_for(p["inputs"], p.get("prediction")), k=3)
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
def boundary(material: str, flow_direction: str, x: str = "oxygen_pct", y: str = "flow_cm_s", gravity_g: float = 0.0,
             oxygen_pct: float | None = None, pressure_kpa: float | None = None, flow_cm_s: float | None = None,
             nx: int = Query(60, le=120), ny: int = Query(50, le=120)):
    pipe, card, df = artifacts()
    menv = card["training_range"]["materials"].get(material)
    env = (menv or {}).get("by_gravity", {}).get(gkey(gravity_g))
    if env is None or x not in NUMERIC or y not in NUMERIC or x == y:
        raise HTTPException(400, "no data for this material at this gravity level, or bad axes")
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
    grid[GRAVITY] = gravity_g
    grid["material"] = material
    grid["flow_direction"] = flow_direction
    classes = list(pipe.classes_)
    proba = pipe.predict_proba(grid[FEATURES])
    pred = [classes[i] for i in proba.argmax(1)]
    maxp = proba.max(1)
    in_rng = [check_range(r, card)[0] for r in grid[NUMERIC + [GRAVITY, "material", "flow_direction"]].to_dict("records")]
    z = [p if ok else None for p, ok in zip(pred, in_rng)]
    pts = df[(df["material"] == material) & np.isclose(df[GRAVITY], gravity_g)].fillna("")
    return {"x": x, "y": y, "third": third, "third_value": fixed[third], "gravity_g": gravity_g, "xs": xs.tolist(), "ys": ys.tolist(),
            "z": np.array(z, dtype=object).reshape(len(ys), len(xs)).tolist(),
            "confidence": np.round(maxp, 3).reshape(len(ys), len(xs)).tolist(),
            "points": pts[["row_id", "oxygen_pct", "pressure_kpa", "flow_cm_s", "flow_direction", "outcome", "report_id", "source_url"]].to_dict("records"),
            "envelope": env}


@app.get("/api/experiments.csv")
def experiments_csv():
    return FileResponse(ROOT / "data" / "experiments.csv", media_type="text/csv", filename="experiments.csv")


@app.get("/api/corpus")
def corpus():
    docs, _, _ = retrieval.index()
    used = set(artifacts()[2]["report_id"].str.replace("NTRS ", "").tolist())
    return {"n": len(docs), "reports": [{"ntrs_id": d["ntrs_id"], "title": d["title"], "date": d.get("date", ""),
                                          "url": d["url"], "used_in_dataset": d["ntrs_id"] in used} for d in docs]}


def _env_counts() -> dict:
    pipe, card, df = artifacts()
    out = {}
    for eid, env in F.ENVIRONMENTS.items():
        g = env["gravity_g"]
        sub = df[np.isclose(df[GRAVITY], g)]
        mats = {m: v["by_gravity"][gkey(g)] for m, v in card["training_range"]["materials"].items() if gkey(g) in v["by_gravity"]}
        out[eid] = {"n": int(len(sub)), "outcomes": sub["outcome"].value_counts().to_dict(),
                    "reports": sorted(sub["report_id"].unique().tolist()), "materials": mats,
                    "oof_accuracy": card["metrics"].get("oof_accuracy_by_gravity", {}).get(gkey(g))}
    return out


@app.get("/api/environments")
def environments():
    counts = _env_counts()
    return {"environments": [{**env, "dataset": counts[eid]} for eid, env in F.ENVIRONMENTS.items()],
            "gas_mixes": F.GAS_MIXES}


@app.get("/api/safety")
def safety(env: str | None = None):
    secs = F.SAFETY if not env else [s for s in F.SAFETY if env in s["applies"]]
    return {"env": env, "sections": secs}


@app.get("/api/flex")
def flex(co2_only: bool = False, rows: bool = False):
    s = psi_data.flex_summary()
    if rows:
        s["rows"] = psi_data.flex_rows(co2_only)
    return s


@app.get("/api/psi")
def psi():
    meta = {i["accession"]: i for i in psi_data.investigations()}
    invs = []
    for inv in F.INVESTIGATIONS:
        m = meta.get(inv["psi"], {})
        invs.append({**inv, "title": m.get("title", ""), "url": m.get("url", f"https://psi.nasa.gov/physci/repo/data/investigations/{inv['psi']}"),
                     "platform": m.get("flightProgram", ""), "hardware": m.get("experimentHardware", ""),
                     "start": m.get("investigationStartDate", ""), "end": m.get("investigationEndDate", ""),
                     "objective": (m.get("objective") or "")[:600], "doi": m.get("doi", ""), "license": m.get("licenseIdentifier", ""),
                     "n_files": m.get("n_files", 0), "file_types": m.get("file_types", {}), "n_publications": len(m.get("publications") or []),
                     "tables": [t["file_name"] for t in m.get("experimental_tables", [])]})
    return {"investigations": invs, "links": F.EXTRA_LINKS, "tables": psi_data.table_catalog(), "sources": {k: {"label": v[0], "url": v[1]} for k, v in F.S.items()}}


@app.post("/api/ask")
def ask_post(body: AskIn):
    return kb.ask(body.question)


@app.get("/api/ask")
def ask_get(q: str = Query(..., max_length=500)):
    return kb.ask(q)


@app.get("/api/kb")
def kb_stats():
    return kb.stats()


ASK_EXAMPLES = ["Is lunar gravity more flammable than Earth?", "How do flames look in microgravity?", "What does the crew do when a fire alarm goes off on the ISS?"]


@lru_cache(maxsize=16)
def _static_block(route: str) -> str:
    pipe, card, df = artifacts()
    ex = [(q, kb.ask(q)) for q in ASK_EXAMPLES] if route == "/ask" else None
    return static_html.build(card, len(df), df["report_id"].nunique(), _env_counts(), psi_data.flex_summary(), kb.stats(),
                             route=route, df=df, ask_examples=ex)


@app.get("/llms.txt", include_in_schema=False)
def llms():
    pipe, card, df = artifacts()
    return PlainTextResponse(static_html.llms_txt(card, len(df), df["report_id"].nunique()))


def _page(route: str, request: Request | None = None) -> HTMLResponse:
    info = static_html.PAGE_INFO.get(route)
    html = (DIST / "index.html").read_text(encoding="utf-8")
    html = re.sub(r'<div id="root">\s*</div>', lambda _: f'<div id="root">{_static_block(route)}</div>', html, count=1)
    if request is not None:  # social previews need an absolute image URL; use the host the page was requested on
        proto = request.headers.get("x-forwarded-proto", request.url.scheme).split(",")[0].strip()
        host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
        if re.fullmatch(r"[A-Za-z0-9.\-:\[\]]+", host or "") and proto in ("http", "https"):
            html = html.replace('content="/og-image.png"', f'content="{proto}://{host}/og-image.png"')
    if info:
        html = re.sub(r"<title>.*?</title>", lambda _: f"<title>{escape(info[2])}</title>", html, count=1, flags=re.S)
        html = re.sub(r'<meta name="description" content="[^"]*"', lambda _: f'<meta name="description" content="{escape(info[3])}"', html, count=1)
    else:
        html = re.sub(r"<title>.*?</title>", "<title>IGNITE-AI \u00b7 Page not found</title>", html, count=1, flags=re.S)
    return HTMLResponse(html, status_code=200 if info else 404)


if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/demo", include_in_schema=False)
    @app.get("/demo/", include_in_schema=False)
    def demo_redirect(request: Request):
        q = request.url.query
        return RedirectResponse("/simulator" + (f"?{q}" if q else ""), status_code=308)

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str, request: Request):
        f = DIST / path
        if path and f.is_file() and f.resolve().is_relative_to(DIST.resolve()):
            return FileResponse(f)
        return _page("/" + path.strip("/"), request)
