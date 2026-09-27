"""Export the server-rendered page text for static hosting (Netlify).

Writes frontend/prerender/pages.json ({route: {title, description, html}}) and
frontend/public/llms.txt from the same code the FastAPI server uses at request time
(src/content/static_html.py), so the prerendered pages on a static host carry the same
readable text as the pages served by the local backend.

Run from backend/:  python -m scripts.export_static
(setup.bat runs it before the frontend build; re-run it after changing data or content.)
"""
from __future__ import annotations
import json, pathlib, sys

HERE = pathlib.Path(__file__).resolve()
BACKEND = HERE.parents[1]
sys.path.insert(0, str(BACKEND))

from app.main import _static_block  # noqa: E402  (same function the server uses)
from src.content import static_html  # noqa: E402
from src.compute.predict import artifacts  # noqa: E402

FRONTEND = BACKEND.parent / "frontend"


def build_pages() -> dict:
    pages = {}
    for route, label, title, desc in static_html.PAGES:
        pages[route] = {"label": label, "title": title, "description": desc, "html": _static_block(route)}
    pages["/404"] = {"label": "Not found", "title": "IGNITE-AI \u00b7 Page not found",
                     "description": "Page not found.", "html": _static_block("/404")}
    return pages


def build_llms() -> str:
    _, card, df = artifacts()
    return static_html.llms_txt(card, len(df), df["report_id"].nunique())


def main() -> None:
    out = FRONTEND / "prerender" / "pages.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(build_pages(), ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    (FRONTEND / "public" / "llms.txt").write_text(build_llms(), encoding="utf-8", newline="\n")
    print(f"wrote {out.relative_to(BACKEND.parent)} and frontend/public/llms.txt")


if __name__ == "__main__":
    main()
