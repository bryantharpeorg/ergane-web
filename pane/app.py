import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, PlainTextResponse


def create_app() -> FastAPI:
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

    dist_root = Path(os.environ.get("PANE_WEB_DIST", Path(__file__).resolve().parents[1] / "web" / "dist"))

    resolved_root = dist_root.resolve()

    @app.get("/{path:path}")
    async def spa_catchall(request: Request, path: str):
        raw_path = request.scope.get("raw_path", b"").decode("utf-8")
        if ".." in raw_path:
            return PlainTextResponse("not found", status_code=404)

        target = (dist_root / path).resolve()
        try:
            target.relative_to(resolved_root)
        except ValueError:
            return PlainTextResponse("not found", status_code=404)

        if target.is_file():
            return FileResponse(target)

        index_html = (dist_root / "index.html").resolve()
        try:
            index_html.relative_to(resolved_root)
        except ValueError:
            return PlainTextResponse("not found", status_code=404)

        if index_html.is_file():
            return FileResponse(index_html)

        return PlainTextResponse(
            "web/dist is not built; run: npm --prefix web run build",
            status_code=503,
        )

    return app


app = create_app()
