"""Harvest NTRS citation metadata + abstracts for microgravity combustion reports.

Uses the public NTRS API: https://ntrs.nasa.gov/api/citations/search
Output: data/corpus/ntrs_corpus.json  (one record per NTRS id)
"""
import json, pathlib, time, urllib.parse, urllib.request

QUERIES = [
    "microgravity flame spread oxygen flow velocity extinction",
    "microgravity flame spread thin fuel quenching limit",
    "opposed flow flame spread microgravity",
    "concurrent flow flame spread microgravity",
    "Saffire spacecraft fire experiment",
    "Burning and Suppression of Solids BASS",
    "SoFIE solid fuel ignition and extinction",
    "flammability limits microgravity PMMA",
    "limiting oxygen concentration microgravity material flammability",
    "NASA-STD-6001 upward flame propagation microgravity",
    "SIBAL solid inflammability boundary",
    "Flame Extinguishment Experiment FLEX droplet",
    "Advanced Combustion via Microgravity Experiments ACME",
    "Solid Surface Combustion Experiment",
    "DARTFire radiative flame spread",
    "Mist experiment microgravity",
    "spacecraft fire safety low gravity flammability",
    "cellulose flame spread microgravity oxygen",
    "Nomex flammability microgravity",
    "FLARE fire safety spacecraft",
    "microgravity smoldering",
    "ignition extinction solid fuel low speed flow microgravity",
]
out = pathlib.Path(__file__).resolve().parents[1] / "data" / "corpus" / "ntrs_corpus.json"
recs = {}
for q in QUERIES:
    url = "https://ntrs.nasa.gov/api/citations/search?" + urllib.parse.urlencode({"q": q, "page.size": 50})
    try:
        d = json.load(urllib.request.urlopen(url, timeout=60))
    except Exception as e:
        print("fail", q, e); continue
    for r in d.get("results", []):
        rid = str(r["id"])
        pubs = r.get("publications") or [{}]
        recs.setdefault(rid, {
            "ntrs_id": rid,
            "title": r.get("title", ""),
            "abstract": r.get("abstract", "") or "",
            "authors": [a.get("meta", {}).get("author", {}).get("name", "") for a in r.get("authorAffiliations", [])],
            "date": (pubs[0].get("publicationDate") or "")[:10],
            "doc_type": r.get("stiType", ""),
            "url": f"https://ntrs.nasa.gov/citations/{rid}",
            "pdf": [f"https://ntrs.nasa.gov{dl['links']['original']}" for dl in r.get("downloads", []) if dl.get("links", {}).get("original")],
            "queries": [],
        })["queries"].append(q)
    print(q, len(d.get("results", [])))
    time.sleep(0.5)
out.write_text(json.dumps(sorted(recs.values(), key=lambda x: x["ntrs_id"]), indent=1))
print("total", len(recs))
