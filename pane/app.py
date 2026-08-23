import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from factory.notify.redact import install_redaction, register_secret
from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from sse_starlette import EventSourceResponse

from pane.answer import create_answer_router
from pane.attention import assemble_attention_section
from pane.attention_store import open_store
from pane.auth import require_viewer
from pane.config import Settings
from pane.events import EVENT_TYPES, AttentionBroadcaster, floor_events
from pane.fixture_floor import FixtureReader
from pane.floor_document import assemble_floor_document
from pane.intake import create_intake_router
from pane.readers import LiveReader, Reader

log = logging.getLogger("pane")


def _make_reader(settings: Settings) -> Reader:
    if settings.demo:
        return FixtureReader(
            settings.fixtures_root,
            transport_fail=settings.transport_fail,
            attention_db=settings.attention_db,
            demo_ruling=settings.demo_ruling,
        )
    return LiveReader(settings.specs_root, attention_db=settings.attention_db)


def create_app(settings: Settings | None = None) -> FastAPI:
    if settings is None:
        settings = Settings.from_env()

    # Every log record in this process has the intake credential removed at
    # creation, so no line the pane writes can carry it (FR-017, D-P2).  The
    # token and its startup refusal are US4's.
    install_redaction()
    if settings.intake_credential:
        register_secret(settings.intake_credential)
    else:
        log.warning("intake closed: PANE_INTAKE_CREDENTIAL is not set")

    reader = _make_reader(settings)
    store = open_store(settings.attention_db)
    broadcaster = AttentionBroadcaster()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        await reader.aclose()
        store.close()

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)

    # The two things intake touches, reachable by name rather than by closure:
    # US2's answer route publishes on the same broadcaster and writes the same
    # store, and a test can subscribe the way an open `GET /api/events` does.
    app.state.attention_store = store
    app.state.attention_broadcaster = broadcaster
    router = APIRouter(dependencies=[Depends(require_viewer)])

    @router.get("/api/floor")
    async def api_floor():
        document = await assemble_floor_document(reader)
        return JSONResponse(document)

    @router.get("/api/attention")
    async def api_attention():
        degraded: list[dict] = []
        items = await assemble_attention_section(reader, degraded=degraded)
        return JSONResponse({"items": items, "degraded": degraded})

    @router.get("/api/events")
    async def api_events(request: Request):
        return EventSourceResponse(
            _serialize_floor_events(
                floor_events(
                    reader,
                    interval_s=settings.poll_interval_s,
                    should_stop=request.is_disconnected,
                    broadcaster=broadcaster,
                )
            )
        )

    # The one route the factory reaches, mounted behind the same dependency as
    # every other (001's dated open interim).  US4 gives it the credential
    # comparison and makes it the one enumerated exception to the token.
    router.include_router(create_intake_router(store=store, broadcaster=broadcaster))

    # The one verb.  Behind the same dependency as every read, writing the same
    # store and publishing on the same broadcaster (constitution I).
    router.include_router(
        create_answer_router(
            store=store,
            broadcaster=broadcaster,
            reader=reader,
            identity=settings.answer_identity,
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
        event_type = envelope.get("type")
        if event_type in EVENT_TYPES:
            yield {
                "event": event_type,
                "data": json.dumps(envelope),
            }
        else:
            yield {"data": json.dumps(envelope)}


app = create_app()
