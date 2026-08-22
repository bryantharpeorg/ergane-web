import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from sse_starlette import EventSourceResponse

from pane.auth import require_viewer
from pane.config import Settings
from pane.events import EVENT_TYPES, floor_events
from pane.fixture_floor import FixtureReader
from pane.floor_document import assemble_floor_document
from pane.readers import LiveReader, Reader


def _make_reader(settings: Settings) -> Reader:
    if settings.demo:
        return FixtureReader(settings.fixtures_root, transport_fail=settings.transport_fail)
    return LiveReader(settings.specs_root)


def create_app(settings: Settings | None = None) -> FastAPI:
    if settings is None:
        settings = Settings.from_env()

    reader = _make_reader(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        await reader.aclose()

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    router = APIRouter(dependencies=[Depends(require_viewer)])

    @router.get("/api/floor")
    async def api_floor():
        document = await assemble_floor_document(reader)
        return JSONResponse(document)

    @router.get("/api/events")
    async def api_events(request: Request):
        return EventSourceResponse(
            _serialize_floor_events(
                floor_events(
                    reader,
                    interval_s=settings.poll_interval_s,
                    should_stop=request.is_disconnected,
                )
            )
        )

    dist_root = settings.web_dist
    resolved_root = dist_root.resolve()

    @router.get("/{path:path}")
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

    app.include_router(router)
    return app


async def _serialize_floor_events(generator):
    """Wrap floor events so the SSE `data:` line is a JSON envelope."""
    async for envelope in generator:
        if envelope.get("type") == "floor":
            yield {
                "event": "floor",
                "data": json.dumps(envelope),
            }
        else:
            yield {"data": json.dumps(envelope)}


app = create_app()
