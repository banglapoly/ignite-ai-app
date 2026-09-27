"""Harvest NASA Physical Sciences Informatics (PSI) combustion-science investigation metadata
and their public "Experimental table" CSVs.

PSI (https://psi.nasa.gov/physci/repo/) is NASA's official open repository for ISS physical-science
data. Its web app reads a public JSON API; we call the same public endpoints, anonymously:
  search:        https://psi.nasa.gov/geode-py/ws/repo/search?term=combustion&type=investigation
  investigation: https://psi.nasa.gov/geode-py/ws/repo/investigations/<PSI-id>
  file link:     https://psi.nasa.gov/geode-py/ws/studies/<PSI-id>/download?file=<name>&version=<v>&redirect=false
PSI data are released under CC0-1.0 (stated per investigation in the metadata).

Output: data/psi/psi_investigations.json and data/psi/tables/<PSI-id>_experimental_table.csv
Run from backend/:  python scripts/fetch_psi.py
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://psi.nasa.gov"
OUT = Path(__file__).resolve().parents[1] / "data" / "psi"
UA = {"User-Agent": "IGNITE-AI research harvester (NASA Space Apps 2026)"}

KEEP = ["accession", "title", "investigationAcronym", "objective", "approach", "hypothesis", "researchImpacts",
        "experimentHardware", "flightProgram", "managingNasaCenter", "investigationStartDate", "investigationEndDate",
        "releaseDate", "doi", "licenseName", "licenseIdentifier", "subResearchArea", "researchArea", "totalFileSize"]


def get(url: str, raw: bool = False):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    return data if raw else json.loads(data)


def main() -> None:
    (OUT / "tables").mkdir(parents=True, exist_ok=True)
    s = get(f"{BASE}/geode-py/ws/repo/search?term=combustion&size=300&type=investigation")
    ids = sorted({h["_source"]["Accession"] for h in s["hits"]["hits"]
                  if (h["_source"].get("Research Area") or "") == "Combustion Science"},
                 key=lambda x: int(x.split("-")[1]))
    out = []
    for acc in ids:
        d = get(f"{BASE}/geode-py/ws/repo/investigations/{acc}")
        rec = {k: d.get(k) for k in KEEP}
        rec["url"] = f"{BASE}/physci/repo/data/investigations/{acc}"
        rec["n_files"] = len(d.get("added") or [])
        exts: dict[str, int] = {}
        for f in d.get("added") or []:
            e = f["file_name"].rsplit(".", 1)[-1].lower()
            exts[e] = exts.get(e, 0) + 1
        rec["file_types"] = exts
        rec["publications"] = [
            {k: p.get(k) for k in ("title", "authors", "journal", "year", "doi", "link", "pubmedId") if p.get(k)}
            for p in (d.get("publications") or [])]
        rec["experimental_tables"] = []
        for ti, t in enumerate(d.get("experimentalTable") or []):
            name, ver = t["file_name"], t.get("version", 1)
            q = urllib.parse.urlencode({"file": name, "version": ver, "redirect": "false"})
            try:
                link = get(f"{BASE}/geode-py/ws/studies/{acc}/download?{q}", raw=True).decode().strip().strip('"')
                blob = get(link, raw=True)
                local = OUT / "tables" / (f"{acc}_experimental_table.csv" if ti == 0 else f"{acc}_experimental_table_{ti + 1}.csv")
                local.write_bytes(blob)
                rec["experimental_tables"].append({"file_name": name, "local": str(local.relative_to(OUT.parent.parent)),
                                                   "bytes": len(blob)})
            except Exception as e:  # noqa: BLE001
                rec["experimental_tables"].append({"file_name": name, "error": str(e)})
        out.append(rec)
        print(acc, rec["investigationAcronym"], "files:", rec["n_files"], "tables:", rec["experimental_tables"])
        time.sleep(0.3)
    (OUT / "psi_investigations.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print("wrote", len(out), "investigations")


if __name__ == "__main__":
    main()
