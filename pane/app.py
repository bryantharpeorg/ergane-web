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
from pane.auth import Unauthorized, require_viewer, unauthorized_handler
from pane.config import Settings
from pane.draft import read_trio
from pane.events import EVENT_TYPES, AttentionBroadcaster, floor_events
from pane.fixture_floor import FixtureReader
from pane.floor_document import assemble_floor_document
from pane.intake import create_intake_router
from pane.readers import LiveReader, Reader
from pane.review import (
    EpicNotLanded,
    ReviewReaders,
    SpecNotFound,
    assemble_review,
)
from pane.showfloor import ShowfloorReaders, assemble_showfloor

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

    # No token, no pane.  In every mode, demo included: a backend that starts
    # without one would serve the whole floor open, and 001's dated interim is
    # closed as of this story (FR-014, T054).
    if not settings.token:
        raise ValueError(
            "PANE_TOKEN is not set; the pane refuses to start rather than serve open"
        )

    # Every log record in this process has both credentials removed at creation,
    # so no line the pane writes — uvicorn's access log included — can carry one
    # (FR-017, D-P2).
    install_redaction()
    register_secret(settings.token)
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
    # `require_viewer` reads the two configured credentials from here, so the one
    # dependency stays one function rather than a closure per app (D-P11).
    app.state.settings = settings
    app.add_exception_handler(Unauthorized, unauthorized_handler)
    router = APIRouter(dependencies=[Depends(require_viewer)])

    @router.get("/api/floor")
    async def api_floor():
        document = await assemble_floor_document(reader)
        return JSONResponse(document)

    # 005 US1: the whole Showfloor in one document, on the same guarded router
    # as `/api/floor`, so `require_viewer` covers it by construction — no
    # per-route auth code here, and none wanted (constitution VI).
    @router.get("/api/showfloor")
    async def api_showfloor():
        document = await assemble_showfloor(
            settings.specs_root,
            ShowfloorReaders.from_reader(
                reader, settings.specs_root, landing_branch=settings.landing_branch
            ),
        )
        return JSONResponse(document)

    # 014 US1: the drafting table's read.  Mounted before the SPA catch-all
    # below, because `/{path:path}` matches `/api/draft/…` too and a route
    # registered after it is a route nothing ever reaches.
    @router.get("/api/draft/{spec_dir}")
    async def api_draft(spec_dir: str):
        return JSONResponse(read_trio(settings.specs_root, spec_dir))

    # 011 US1: the review room's one document, on the same guarded router as
    # every other read.  Two answers are refusals rather than documents and both
    # say which: 404 for a spec directory this corpus does not have, and 409 for
    # an epic the landing branch does not carry whole — a review of half an epic
    # is a review of nothing, so the room names the unmerged stories and stops
    # (FR-004).  The room itself is served by the guarded catch-all, like every
    # other room, so `/review/<spec-dir>` is behind the same token (FR-006).
    @router.get("/api/review/{spec_dir}")
    async def api_review(spec_dir: str):
        try:
            document = assemble_review(
                settings.specs_root,
                spec_dir,
                ReviewReaders.from_reader(
                    reader, settings.specs_root, landing_branch=settings.landing_branch
                ),
            )
        except SpecNotFound as miss:
            return JSONResponse(miss.as_document(), status_code=404)
        except EpicNotLanded as refusal:
            return JSONResponse(refusal.as_document(), status_code=409)
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
                    specs_root=settings.specs_root,
                    landing_branch=settings.landing_branch,
                )
            )
        )

    # The one route the factory reaches, mounted behind the same dependency as
    # every other.  US4 gave `require_viewer` the credential comparison, which
    # makes intake the one enumerated exception to the token — never an
    # exception to being guarded.
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
