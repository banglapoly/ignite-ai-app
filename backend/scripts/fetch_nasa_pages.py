"""Fetch the text of a few public NASA web pages used as knowledge-base passages and citations.
Output: data/corpus/nasa_pages.json  (url, title, retrieved, paragraphs[]).  Run from backend/."""
from __future__ import annotations
import datetime, html, json, pathlib, re, urllib.request

PAGES = [
    "https://www.nasa.gov/missions/station/iss-research/studying-combustion-and-fire-safety/",
    "https://science.nasa.gov/mission/acme/",
    "https://science.nasa.gov/mission/sofie/",
]
OUT = pathlib.Path(__file__).resolve().parents[1] / "data" / "corpus" / "nasa_pages.json"


def text_of(url: str) -> tuple[str, list[str]]:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (IGNITE-AI harvester)"})
    s = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "ignore")
    title = html.unescape(re.search(r"<title>(.*?)</title>", s, re.S).group(1)).strip()
    s = re.sub(r"<script.*?</script>|<style.*?</style>", "", s, flags=re.S)
    main = re.search(r"<main.*?</main>", s, re.S)
    s = main.group(0) if main else s
    paras = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", p))).strip()
             for p in re.findall(r"<p[^>]*>(.*?)</p>", s, re.S)]
    junk = ("Min Read", "Keep Exploring", "APOD", "aerial sidekick", "touch the Sun", "Juno spacecraft", "We are driven",
            "Search this database", "Citations ")
    return title, [p for p in paras if len(p) > 60 and not any(j in p for j in junk)]


def main() -> None:
    out = []
    for u in PAGES:
        t, paras = text_of(u)
        out.append({"url": u, "title": t, "retrieved": datetime.date.today().isoformat(), "paragraphs": paras})
        print(u, len(paras))
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
