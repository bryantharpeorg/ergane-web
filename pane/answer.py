"""The pane's one verb.

`POST /api/attention/{correlation_id}/answer` is the only non-GET route the Desk
issues and the only place in `pane/` that reaches a settlement seam.  Everything
it does with what it is given is *carry* it: a Question's text goes to
`CallbackBridge.handle_relay` verbatim through `Reader.settle_question`, and an
Escalation's escalation id and choice are **parsed out of the payload the factory
delivered** and sent as the `escalation_resolved` signal's args through
`Reader.press_escalation`.  The workflow id is the correlation id.  Nothing here
is invented, and nothing here settles: the factory rules, and the ruling arrives
as the call's return (a Question) or through a later factory read (an
Escalation), never from this module (FR-006, FR-008, FR-009).

The guards in front of the seam are refusals, not judgements.  The one that
carries weight is the empty-answer refusal: `handle_relay` has no empty-answer
guard of its own — it would signal the empty string through and park the node on
nothing — so this local refusal is load-bearing rather than redundant (FR-006).
"""

import asyncio
import logging
import sqlite3
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from pane.attention import assemble_attention
from pane.attention_store import get_item, record_press, record_ruling
from pane.events import AttentionBroadcaster
from pane.intake import utc_now


#: Settlement identifies its work by correlation id and by nothing else
#: (FR-017).  The identity is a configured value the factory judges, not a
#: credential, and the token never reaches this module at all.
log = logging.getLogger("pane.answer")


class InFlightRegistry:
    """The correlation ids with a settlement call out right now.

    Process memory, not the store, and deliberately (plan D-P5): a crash
    mid-call leaves nothing in flight, which is the truth — the pane cannot know
    whether the seam heard it, and a durable flag would keep asserting an
    in-flight call that no longer exists.  The lock makes claiming atomic, so
    two simultaneous presses cannot both reach the seam.
    """

    def __init__(self) -> None:
        self._ids: set[str] = set()
        self._lock = asyncio.Lock()

    async def claim(self, correlation_id: str) -> bool:
        """Take the slot for `correlation_id`; False when one is already out."""
        async with self._lock:
            if correlation_id in self._ids:
                return False
            self._ids.add(correlation_id)
            return True

    async def release(self, correlation_id: str) -> None:
        async with self._lock:
            self._ids.discard(correlation_id)

    def snapshot(self) -> frozenset[str]:
        """What the attention assembly reads, so a reconnecting Desk sees it too."""
        return frozenset(self._ids)


#: One registry per process, read by the attention assembly and written here.
IN_FLIGHT = InFlightRegistry()


def create_answer_router(
    *,
    store: sqlite3.Connection,
    broadcaster: AttentionBroadcaster,
    reader: Any,
    identity: str,
    registry: InFlightRegistry = IN_FLIGHT,
) -> APIRouter:
    """Build the answer router over one open store, one broadcaster, one seam."""
    router = APIRouter()

    @router.post("/api/attention/{correlation_id}/answer")
    async def answer(correlation_id: str, request: Request) -> JSONResponse:
        item = get_item(store, correlation_id)
        if item is None:
            return _refuse("no_such_item", 404)
        if item.kind == "notice":
            # A Notice has no settlement to reach; a control on one would be a
            # second verb with nowhere to go (constitution I).
            return _refuse("not_answerable", 422)

        if correlation_id in registry.snapshot():
            return _refuse("in_flight", 409)

        try:
            body = await request.json()
        except Exception:
            body = None
        if not isinstance(body, dict):
            body = {}

        if item.kind == "question":
            text = body.get("text")
            if not isinstance(text, str) or not text.strip():
                # Load-bearing, not redundant: `handle_relay` carries no
                # empty-answer guard, so `_settle_question` would signal the
                # empty string through and park the node on nothing (FR-006).
                return _refuse("empty_answer", 422)
        else:
            payload = body.get("payload")
            delivered = [action.get("payload") for action in item.actions]
            if not isinstance(payload, str) or payload not in delivered:
                # Byte-equal to one the factory delivered, or refused.  The
                # pane presses nothing it was not handed (FR-008).
                return _refuse("not_delivered", 422)

        if not await registry.claim(correlation_id):
            return _refuse("in_flight", 409)

        try:
            if item.kind == "question":
                ruling = await reader.settle_question(correlation_id, text, identity)
                record_ruling(store, correlation_id, ruling, utc_now())
                log.info(
                    "answer settled a question, correlation_id=%s, ruling=%s",
                    correlation_id,
                    ruling,
                )
                result = {"kind": "question", "ruling": ruling}
            else:
                escalation_id, choice = _parse_payload(payload)
                try:
                    await reader.press_escalation(
                        correlation_id, escalation_id, choice, identity
                    )
                except Exception:
                    # A signal returns nothing, so this raise is the only fact
                    # about the press the pane can observe.  It is derived, not
                    # minted: SIGNAL_FAILED means nothing was recorded (FR-010).
                    signal_state = "SIGNAL_FAILED"
                else:
                    signal_state = "accepted"
                record_press(store, correlation_id, choice, signal_state, utc_now())
                log.info(
                    "answer signalled an escalation, correlation_id=%s, signal=%s",
                    correlation_id,
                    signal_state,
                )
                result = {"kind": "escalation", "signal": signal_state}
        finally:
            await registry.release(correlation_id)

        updated = get_item(store, correlation_id)
        if updated is not None:
            # One event, carrying the item as it now stands.  No factory read
            # rides along, so `expires_at` is null here exactly as it is on the
            # event intake pushes; the next `floor` event carries the join
            # (plan D-P9).
            broadcaster.publish(
                assemble_attention([updated], [], in_flight=registry.snapshot())[0]
            )

        return JSONResponse(result, status_code=200)

    return router


def _parse_payload(payload: str) -> tuple[str, str]:
    """`esc:<escalation_id>:<choice>` → the two fields, taken and never invented.

    The payload was validated at intake against `^esc:[0-9a-f]{12}:[A-Za-z0-9_]+$`
    and matched byte-for-byte against a delivered action above, so this splits
    what the factory wrote rather than parsing an unknown string.
    """
    _prefix, escalation_id, choice = payload.split(":", 2)
    return escalation_id, choice


def _refuse(error: str, status: int) -> JSONResponse:
    return JSONResponse({"error": error}, status_code=status)
