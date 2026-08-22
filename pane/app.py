"""FastAPI application serving the operator pane and its single-page frontend."""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, PlainTextResponse


def create_app() -> FastAPI:
    """Create and return the pane FastAPI application."""
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

    dist_root = Path(
        os.environ.get("PANE_WEB_DIST", str(Path(__file__).resolve().parents[1] / "web" / "dist"))
    ).resolve()

    @app.get("/{path:path}", response_model=None)
    async def spa_catch_all(request: Request, path: str):
        """Serve a file from the built frontend, falling back to index.html."""
        target = (dist_root / path).resolve()

        # Refuse paths that escape the dist directory.
        if not str(target).startswith(str(dist_root) + os.sep) and target != dist_root:
            target = dist_root / "index.html"

        if target.is_file():
            return FileResponse(target)

        # If the requested file is missing, fall back to index.html so the SPA router
        # can render the room.
        index = dist_root / "index.html"
        if index.is_file():
            return FileResponse(index)

        return PlainTextResponse(
            "web/dist is not built; run: npm --prefix web run build",
            status_code=503,
        )

    return app


app = create_app()
