"""The route `ERGANE_WEBHOOK_URL` points at.

`factory/notify/webhook.py` POSTs a bare JSON body with no header and treats
everything after the origin as a secret, so the credential rides the path
(plan D-P1) and the whole delivery is `{correlation_id, text, actions[]}`.

To the factory, non-2xx *is* the word "undelivered": a payload the pane cannot
carry is refused with 422 and nothing is stored, because an Escalation whose
buttons the pane could never press has not been delivered.  Everything else is
answered 202 after one insert and one fan-out — no Temporal call, no `Reader`
call, no settlement seam, no factory-store read.  The factory's ten-second
window is spent on storage alone (FR-001, US1-S6).
"""

import re
import sqlite3
from datetime import datetime, timezone
from typing import Any, Callable, Literal

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from pane.attention import assemble_attention
from pane.attention_store import upsert_delivery
from pane.events import AttentionBroadcaster

# A Question's and an Escalation's correlation id.  A Notice's is anything else
# the factory's one notify adapter carries: "supervision", "roadmap-<root>", …
CORRELATION_ID = re.compile(r"^[0-9a-f]{12}$")

# The payload the factory puts on a delivered choice, and the only shape a
# press could ever parse back into (escalation id, choice).
ACTION_PAYLOAD = re.compile(r"^esc:[0-9a-f]{12}:[A-Za-z0-9_]+$")

Kind = Literal["question", "escalation", "notice"]


class Malformed(Exception):
    """A delivery the pane cannot carry; the route answers non-2xx and stores nothing."""


def classify(body: Any) -> Kind:
    """Classify one delivery, or refuse it (FR-002, FR-003).

    12-hex id with no actions → Question.  12-hex id with actions, every one of
    them `{label, payload}` with a payload matching `esc:<12hex>:<CHOICE>` →
    Escalation.  Non-12-hex id with no actions → Notice: the supervision alerts
    and roadmap notices that ride the same adapter, rendered but never
    answerable.  Anything else raises.
    """
    if not isinstance(body, dict):
        raise Malformed("body is not a JSON object")

    correlation_id = body.get("correlation_id")
    if not isinstance(correlation_id, str) or not correlation_id:
        raise Malformed("correlation_id is missing")

    if not isinstance(body.get("text"), str):
        raise Malformed("text is missing")

    actions = body.get("actions", [])
    if not isinstance(actions, list):
        raise Malformed("actions is not a list")

    answerable = bool(CORRELATION_ID.match(correlation_id))

    if actions:
        if not answerable:
            raise Malformed("actions delivered beside a correlation_id that is not 12 hex")
        for action in actions:
            if not isinstance(action, dict):
                raise Malformed("action is not an object")
            label = action.get("label")
            payload = action.get("payload")
            if not isinstance(label, str) or not isinstance(payload, str):
                raise Malformed("action is not {label, payload}")
            if not ACTION_PAYLOAD.match(payload):
                raise Malformed(f"action payload does not match esc:<12hex>:<CHOICE>: {payload!r}")
        return "escalation"

    return "question" if answerable else "notice"


def utc_now() -> str:
    """The pane's receipt instant: provenance only, never a countdown anchor."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def create_intake_router(
    *,
    store: sqlite3.Connection,
    broadcaster: AttentionBroadcaster,
    clock: Callable[[], str] = utc_now,
) -> APIRouter:
    """Build the intake router over one open store and one broadcaster."""
    router = APIRouter()

    # `:path`, so the credential-less `POST /intake/` reaches the one gate and
    # gets the one refusal rather than a router 404 or 405 that no other refused
    # request produces (US4-S3).  It also matches how the factory sees the URL:
    # `factory/notify/webhook.py` redacts *everything* after the origin, so the
    # whole tail is the secret, and the whole tail is what `require_viewer`
    # compares with `secrets.compare_digest`.
    @router.post("/intake/{credential:path}")
    async def intake(credential: str, request: Request) -> JSONResponse:
        # Already compared, by `pane.auth.require_viewer`, before this handler
        # was reached.  Comparing it again here would be the second auth path
        # D-P11 forbids, so the handler only carries it (FR-015).
        del credential

        try:
            body = await request.json()
        except Exception:
            return _malformed()

        try:
            kind = classify(body)
        except Malformed:
            return _malformed()

        item, created = upsert_delivery(
            store,
            kind=kind,
            correlation_id=body["correlation_id"],
            text=body["text"],
            actions=body.get("actions", []),
            received_at=clock(),
        )

        if created:
            # Same handling as the storage that admitted it, with nothing
            # awaited in between (FR-005).  A re-delivery of a served request
            # publishes nothing: the item the Desk holds is already this one.
            broadcaster.publish(assemble_attention([item], [])[0])

        return JSONResponse(
            {"stored": kind, "correlation_id": item.correlation_id},
            status_code=202,
        )

    return router


def _malformed() -> JSONResponse:
    return JSONResponse({"error": "malformed"}, status_code=422)
