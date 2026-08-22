"""Webhook intake route: the factory's POST becomes a stored Attention item.

`POST /intake/{credential}` accepts the factory's bare JSON, classifies it,
stores it durably, pushes an `attention` SSE event, and responds 2xx.  No
Temporal call, no settlement seam, no factory-store read: the 10-second window
is spent on storage and fan-out alone.
"""

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from pane.attention_store import StoredItem, open_store, upsert_delivery
from pane.auth import require_viewer
from pane.config import Settings
from pane.events import AttentionBroadcaster


_HEX_12 = re.compile(r"^[0-9a-f]{12}$")
_ACTION_PAYLOAD = re.compile(r"^esc:[0-9a-f]{12}:[A-Za-z0-9_]+$")


class Malformed(Exception):
    """Raised when the incoming payload does not match the factory's contract."""


@dataclass(frozen=True)
class Body:
    correlation_id: str
    text: str
    actions: list[dict]


def parse_body(raw: Any) -> Body:
    if not isinstance(raw, dict):
        raise Malformed("body is not an object")
    correlation_id = raw.get("correlation_id")
    text = raw.get("text")
    actions = raw.get("actions", [])
    if correlation_id is None or text is None:
        raise Malformed("missing correlation_id or text")
    if not isinstance(correlation_id, str) or not isinstance(text, str):
        raise Malformed("correlation_id or text is not a string")
    if not isinstance(actions, list):
        raise Malformed("actions is not a list")
    return Body(correlation_id=correlation_id, text=text, actions=actions)


def classify(body: Body) -> Literal["question", "escalation", "notice"]:
    is_12_hex = bool(_HEX_12.fullmatch(body.correlation_id))
    has_actions = len(body.actions) > 0

    if is_12_hex and not has_actions:
        return "question"

    if is_12_hex and has_actions:
        for action in body.actions:
            if not isinstance(action, dict):
                raise Malformed("action is not an object")
            label = action.get("label")
            payload = action.get("payload")
            if not isinstance(label, str) or not isinstance(payload, str):
                raise Malformed("action missing label or payload")
            if not _ACTION_PAYLOAD.fullmatch(payload):
                raise Malformed(f"action payload does not match required grammar: {payload!r}")
        return "escalation"

    if not is_12_hex and not has_actions:
        return "notice"

    raise Malformed("payload cannot be carried")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_intake_router(settings: Settings, broadcaster: AttentionBroadcaster) -> APIRouter:
    # US1 intentionally mounts intake behind `require_viewer` exactly like every other
    # route; the credential segment is carried, not compared here. US4 closes both.
    router = APIRouter(dependencies=[Depends(require_viewer)])

    @router.post("/intake/{credential}")
    async def intake(credential: str, request: Request) -> JSONResponse:
        body = await request.json()
        parsed = parse_body(body)
        kind = classify(parsed)
        received_at = _utc_now()

        conn = open_store(settings.attention_db)
        try:
            result = upsert_delivery(
                conn,
                kind=kind,
                correlation_id=parsed.correlation_id,
                text=parsed.text,
                actions=parsed.actions,
                received_at=received_at,
            )
        finally:
            conn.close()

        if result.inserted:
            broadcaster.publish(_item_to_attention(result.item))

        return JSONResponse(
            status_code=202,
            content={"stored": kind, "correlation_id": parsed.correlation_id},
        )

    return router


def _item_to_attention(item: StoredItem) -> dict:
    """Build the public AttentionItem shape from a stored row."""
    kind = item["kind"]
    if kind == "notice":
        item_id = f"notice:{item['seq']}"
    else:
        item_id = item["correlation_id"]

    return {
        "id": item_id,
        "kind": kind,
        "correlation_id": item["correlation_id"],
        "text": item["text"],
        "actions": item["actions"],
        "expires_at": None,
        "settlement": {"state": "none" if kind == "notice" else "waiting", "ruling": None, "signal": None, "pressed_choice": None, "resolution": None},
        "degraded": None,
    }
