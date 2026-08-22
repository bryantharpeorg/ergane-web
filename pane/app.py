import mimetypes
import os
from pathlib import Path

from fastapi import FastAPI, Response


def _dist_root() -> Path:
    env = os.environ.get("PANE_WEB_DIST")
    if env:
        return Path(env).resolve()
    return Path(__file__).resolve().parent.parent / "web" / "dist"


def create_app() -> FastAPI:
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    dist = _dist_root()

    @app.get("/{path:path}")
    def spa(path: str) -> Response:
        if not dist.exists() or not (dist / "index.html").exists():
            return Response(
                content="web/dist is not built; run: npm --prefix web run build",
                media_type="text/plain",
                status_code=503,
            )

        requested = (dist / path.lstrip("/")).resolve()
        if not str(requested).startswith(str(dist)):
            return Response(
                content="web/dist is not built; run: npm --prefix web run build",
                media_type="text/plain",
                status_code=503,
            )

        if requested.is_file():
            target = requested
        else:
            target = dist / "index.html"

        media_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        return Response(
            content=target.read_bytes(),
            media_type=media_type,
        )

    return app


app = create_app()
