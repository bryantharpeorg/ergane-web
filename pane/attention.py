"""Assemble the Attention list the Desk reads.

Every rule of that list lives here and nowhere else: the union of what the
factory *delivered* (the pane's own store, through `Reader.stored_items()`) with
what the factory *reports* (`open_escalations`, and from US3 the questions store
and the escalation fate), the settlement state derived at read time, and the
rank.  `pane/floor_document.py` reaches this module in exactly one call, so the
two epics building over that file cannot collide and 001's purity sweep over its
source still passes (plan D-P16).

Nothing here deletes a row and nothing here mints a settlement: a press or a
submit moves nothing.  `settled` is the factory's word alone (D-P8).
"""

from typing import TYPE_CHECKING, Any, Sequence

from pane.attention_store import StoredItem
from pane.readers import QueryRefused, TransportFailed

if TYPE_CHECKING:
    from pane.readers import Reader


# The rank DESIGN.md § Colors › The Attention Ranking Rule states: high =
# Escalation, medium = Question, low = Notice.
_KIND_RANK = {"escalation": 0, "question": 1, "notice": 2}

# waiting and ruled first, then in flight, then settled (data-model.md).
_STATE_GROUP = {"waiting": 0, "ruled": 0, "none": 0, "in_flight": 1, "settled": 2}


def settlement_state(
    item: StoredItem,
    *,
    resolution: str | None,
    in_flight: bool,
) -> str:
    """Derive one item's settlement state; read time only, nowhere else."""
    if item.kind == "notice":
        return "none"
    if in_flight:
        return "in_flight"
    if resolution is not None:
        return "settled"
    if item.last_ruling == "RESOLVED":
        return "settled"
    if item.signal_state == "SIGNAL_FAILED":
        return "ruled"
    if item.signal_state == "accepted":
        return "in_flight"
    if item.last_ruling is not None:
        return "ruled"
    return "waiting"


def assemble_attention(
    stored: list[StoredItem],
    open_escalations: Sequence[dict],
    *,
    in_flight: frozenset[str] = frozenset(),
) -> list[dict]:
    """Build the Desk's Attention items from what was delivered and what is open.

    The union is by correlation id: a stored Escalation and its
    `open_escalations` entry are one item, and the open entry's `expires_at` and
    `resolution` ride along — 001 already reads that seam.  A Question or a
    Notice carries `expires_at: null` here; the questions-store join is US3's,
    and intake never writes an expiry of the pane's own making (D-P9).
    """
    by_correlation: dict[str, dict] = {}
    for entry in open_escalations:
        escalation_id = entry.get("escalation_id")
        if isinstance(escalation_id, str):
            by_correlation[escalation_id] = entry

    items: list[dict] = []
    seen: set[str] = set()

    for item in stored:
        open_entry = by_correlation.get(item.correlation_id) if item.kind == "escalation" else None
        resolution = open_entry.get("resolution") if open_entry else None
        expires_at = open_entry.get("expires_at") if open_entry else None
        state = settlement_state(
            item,
            resolution=resolution,
            in_flight=item.correlation_id in in_flight,
        )
        items.append(
            {
                "id": item.correlation_id if item.kind != "notice" else f"notice:{item.seq}",
                "kind": item.kind,
                "correlation_id": item.correlation_id,
                "text": item.text,
                "actions": item.actions,
                "expires_at": expires_at,
                "settlement": {
                    "state": state,
                    "ruling": item.last_ruling,
                    "signal": item.signal_state,
                    "pressed_choice": item.pressed_choice,
                    "resolution": resolution,
                },
                "degraded": None,
                "_seq": item.seq,
            }
        )
        seen.add(item.correlation_id)

    # An escalation the factory reports open but never delivered here — the pane
    # started after the page, or the delivery was refused.  It renders with the
    # factory's own words and no controls, because no payload was delivered for
    # it; hiding it would be the Desk lying about what waits.
    for index, (escalation_id, entry) in enumerate(by_correlation.items()):
        if escalation_id in seen:
            continue
        question = entry.get("question")
        items.append(
            {
                "id": escalation_id,
                "kind": "escalation",
                "correlation_id": escalation_id,
                "text": question if isinstance(question, str) else "",
                "actions": [],
                "expires_at": entry.get("expires_at"),
                "settlement": {
                    "state": "settled" if entry.get("resolution") is not None else "waiting",
                    "ruling": None,
                    "signal": None,
                    "pressed_choice": None,
                    "resolution": entry.get("resolution"),
                },
                "degraded": None,
                "_seq": len(stored) + index,
            }
        )

    items.sort(key=_rank_key)
    for item in items:
        del item["_seq"]
    return items


async def assemble_attention_section(
    reader: "Reader",
    *,
    degraded: list[dict],
    unsettled_only: bool = False,
    in_flight: frozenset[str] | None = None,
) -> list[dict]:
    """Read both sources through the seam and assemble; degrade honestly.

    A failed read appends one degraded entry per read, in 001's two modes, and
    the section is still present with the items the other read produced.

    `unsettled_only` is the settlement contract of contracts/api.md § Attention
    list › What each surface carries: the floor document carries only unsettled
    items, because 002's Showfloor badge counts them as "waiting on you" and this
    data model never deletes a row; `GET /api/attention` carries every item.

    `in_flight` left unnamed reads the live registry, so both surfaces and every
    `floor` event report an item whose settlement call is out — a reconnecting
    Desk renders it in flight without having issued the call itself.  Imported
    here rather than at module scope because `pane/answer.py` imports this
    module, and because `pane/floor_document.py`'s call into the assembly is one
    line that two epics build over (plan D-P16).
    """
    if in_flight is None:
        from pane.answer import IN_FLIGHT

        in_flight = IN_FLIGHT.snapshot()

    try:
        escalations = await reader.open_escalations()
    except (TransportFailed, QueryRefused) as exc:
        degraded.append(_degraded_entry(exc))
        escalations = []

    try:
        stored = reader.stored_items()
    except (TransportFailed, QueryRefused) as exc:
        degraded.append(_degraded_entry(exc))
        stored = []

    items = assemble_attention(stored, escalations, in_flight=in_flight)
    if unsettled_only:
        items = [item for item in items if item["settlement"]["state"] != "settled"]
    return items


def _rank_key(item: dict) -> tuple[Any, ...]:
    state = item["settlement"]["state"]
    return (
        _STATE_GROUP.get(state, 0),
        _KIND_RANK.get(item["kind"], 3),
        item["expires_at"] or "",
        item["_seq"],
    )


def _degraded_entry(exc: TransportFailed | QueryRefused) -> dict:
    from pane.floor_document import _redact_secrets

    return {
        "section": "attention",
        "mode": "transport" if isinstance(exc, TransportFailed) else "refusal",
        "epic_id": None,
        "read": exc.read,
        "detail": _redact_secrets(exc.detail),
    }
