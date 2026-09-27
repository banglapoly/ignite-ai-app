"""Readers for the real NASA PSI experimental tables (CC0-1.0) saved by scripts/fetch_psi.py.

Nothing here is modelled: FLEX rows are shown as published, and the summaries are plain
counts/means computed from those rows.
"""
from __future__ import annotations
import json, pathlib
from functools import lru_cache
import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[2]
PSI = ROOT / "data" / "psi"
TABLES = PSI / "tables"
FLEX_URL = "https://psi.nasa.gov/physci/repo/data/investigations/PSI-69"
FLEX_COLS = ["test", "identifier", "date", "gmt", "fuel", "pressure_mmhg", "x_o2", "x_n2", "x_co2", "x_he",
             "d0_mm", "d_ext_mm", "burning_rate", "burn_time_s", "test_end"]


def read_table(path: pathlib.Path) -> pd.DataFrame:
    for enc in ("utf-8-sig", "cp1252"):
        try:
            return pd.read_csv(path, encoding=enc)
        except UnicodeDecodeError:
            continue
    return pd.read_csv(path, encoding="latin-1")


@lru_cache(maxsize=1)
def investigations() -> list[dict]:
    p = PSI / "psi_investigations.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


@lru_cache(maxsize=1)
def flex() -> pd.DataFrame:
    p = TABLES / "PSI-69_experimental_table.csv"
    if not p.exists():
        return pd.DataFrame(columns=FLEX_COLS)
    d = read_table(p)
    d.columns = FLEX_COLS
    for c in ["pressure_mmhg", "x_o2", "x_n2", "x_co2", "x_he", "d0_mm", "d_ext_mm", "burning_rate", "burn_time_s"]:
        d[c] = pd.to_numeric(d[c], errors="coerce")   # non-numeric cells (e.g. '-') become blank, as in the source
    d["fuel"] = d["fuel"].astype(str).str.strip(); d["test_end"] = d["test_end"].astype(str).str.strip()
    d["pressure_kpa"] = (d["pressure_mmhg"] * 0.133322).round(1)
    return d


def flex_summary() -> dict:
    d = flex()
    if d.empty:
        return {"available": False}
    co2 = d[d["x_co2"] > 0]
    by = lambda x: {f"{k[0]}|{k[1]}": int(v) for k, v in x.groupby(["fuel", "test_end"]).size().items()}
    bins = pd.cut(d["x_co2"], [-0.01, 0.0, 0.1, 0.2, 0.3, 0.7], labels=["0", "0-0.10", "0.10-0.20", "0.20-0.30", ">0.30"])
    ext = d.assign(co2_bin=bins).groupby(["fuel", "co2_bin"], observed=True).agg(
        n=("test", "size"), mean_extinction_diameter_mm=("d_ext_mm", "mean"),
        mean_burn_time_s=("burn_time_s", "mean"), extinctions=("test_end", lambda s: int((s == "Extinction").sum()))).reset_index()
    ext = ext.round(3)
    return {
        "available": True, "source": {"label": "NASA PSI-69 FLEX experimental table (CC0-1.0)", "url": FLEX_URL},
        "n_tests": int(len(d)), "fuels": d["fuel"].value_counts().to_dict(),
        "test_end_counts": d["test_end"].value_counts().to_dict(), "by_fuel_end": by(d),
        "n_with_co2": int(len(co2)), "co2_max_mole_fraction": float(d["x_co2"].max()),
        "n_with_helium": int((d["x_he"] > 0).sum()),
        "o2_range": [float(d["x_o2"].min()), float(d["x_o2"].max())],
        "pressure_kpa_range": [float(d.loc[d["pressure_kpa"] > 0, "pressure_kpa"].min()), float(d["pressure_kpa"].max())],
        "by_co2": ext.to_dict(orient="records"),
        "notes": ["Droplet combustion (isolated methanol / heptane droplets; PSI lists the hardware as the Combustion Integrated Rack with the Multi-user Droplet Combustion Apparatus on the ISS), not flame spread over solids, so these rows are NOT used by the flame-spread classifier.",
                  "The 'burning rate' column header in the PSI table reads 'mm'; we show it as published without converting units.",
                  "One row lists an ambient pressure of 0 mmHg as published; it is excluded from the pressure range."],
    }


def flex_rows(co2_only: bool = False) -> list[dict]:
    d = flex()
    if co2_only:
        d = d[d["x_co2"] > 0]
    return d.fillna("").to_dict(orient="records")


def table_catalog() -> list[dict]:
    out = []
    for inv in investigations():
        for t in inv.get("experimental_tables", []):
            p = ROOT / t["local"]
            if not p.exists():
                continue
            d = read_table(p)
            out.append({"psi": inv["accession"], "acronym": inv.get("investigationAcronym") or inv["title"],
                        "file_name": t["file_name"], "local": t["local"], "n_rows": int(len(d)),
                        "columns": [str(c).strip() for c in d.columns], "url": inv["url"]})
    return out
