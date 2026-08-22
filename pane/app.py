"""FastAPI application for the Ergane operator pane."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse, PlainTextResponse


def _web_dist() -> Path:
    env = os.environ.get("PANE_WEB_DIST")
    if env:
        return Path(env).resolve()
    return Path(__file__).resolve().parents[1] / "web" / "dist"


def create_app() -> FastAPI:
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

    @app.get("/{path:path}")
    async def spa_catch_all(request: Request, path: str) -> Response:
        root = _web_dist()
        # Reject traversal using the original request path; HTTP clients normalize
        # ".." segments before the route sees them, so we inspect request.url.path.
        raw_path = request.url.path
        if "/../" in raw_path or raw_path.endswith("/..") or raw_path.startswith("../"):
            return PlainTextResponse("not found", status_code=404)

        safe_path = (root / path).resolve()
        # Refuse any resolved path outside the dist directory.
        try:
            safe_path.relative_to(root)
        except ValueError:
            return PlainTextResponse("not found", status_code=404)

        if safe_path.is_file():
            return FileResponse(safe_path)

        index = root / "index.html"
        if index.is_file():
            return FileResponse(index)

        return PlainTextResponse(
            "web/dist is not built; run: npm --prefix web run build",
            status_code=503,
        )

    return app


app = create_app()
