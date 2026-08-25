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

import dataclasses
from typing import TYPE_CHECKING, Any, Sequence

from pane.attention_store import StoredItem
from pane.readers import QueryRefused, TransportFailed

if TYPE_CHECKING:
    from pane.readers import Reader


@dataclasses.dataclass(frozen=True)
class FactoryJoin:
    """What one factory read said about one item — or why it could not say.

    The two fields are the two only the factory may write: the `expires_at` it
    wrote at send time and the `resolution` it wrote when the item settled.  A
    join carrying neither is a factory that has nothing to report about this
    item, which is not a failure — the item keeps no deadline rather than one
    the pane arithmetic'd out of its own receipt clock (FR-012).
    """

    expires_at: str | None = None
    resolution: str | None = None
    degraded: dict | None = None


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
    """Derive one item's settlement state; read time only, nowhere else.

    The order of these branches is the rule itself (data-model.md), and each one
    is either the pane observing its own call or the factory reporting its own
    word.  Neither a press nor a submit appears here, because neither settles
    anything: `settled` is reachable only through the ruling `handle_relay`
    returned or the `resolution` a factory read carries (D-P8, FR-009).

    `in_flight` covers two facts that mean the same thing to the operator: a
    settlement call is out of this process right now (the registry in
    `pane/answer.py`), or a press was accepted and the factory has not yet said
    what became of it — a signal returns nothing, so an accepted press is a
    question asked and not yet answered.
    """
    if item.kind == "notice":
        # No countdown, no controls, no settlement: a Notice asks for nothing.
        return "none"
    if in_flight:
        return "in_flight"
    if resolution is not None:
        # The factory's own word, whatever it says, for either answerable kind.
        return "settled"
    if item.kind == "question":
        if item.last_ruling == "RESOLVED":
            return "settled"
        if item.last_ruling is not None:
            # Every other ruling — UNKNOWN, EXPIRED, ALREADY_RESOLVED,
            # UNAUTHORIZED, or a string this build has never seen — keeps the
            # item exactly where it was (FR-009).
            return "ruled"
        return "waiting"
    if item.signal_state == "SIGNAL_FAILED":
        # Nothing was recorded, so the item stays in the waiting rank with its
        # controls live (FR-011).
        return "ruled"
    if item.signal_state == "accepted":
        return "in_flight"
    return "waiting"


def assemble_attention(
    stored: list[StoredItem],
    open_escalations: Sequence[dict],
    *,
    in_flight: frozenset[str] = frozenset(),
    joins: dict[str, FactoryJoin] | None = None,
) -> list[dict]:
    """Build the Desk's Attention items from what was delivered and what is open.

    The union is by correlation id: a stored Escalation and its
    `open_escalations` entry are one item, and the open entry's `expires_at` and
    `resolution` ride along — 001 already reads that seam.

    `joins` is what the factory reads reported, one entry per answerable item,
    assembled by `assemble_attention_section` through the `Reader`.  A join
    **replaces** whatever the open-escalations entry carried, because it is the
    later and more specific word from the same factory; an item with no join
    falls back to that entry, and an item with neither keeps `expires_at: null`.
    `received_at` appears nowhere in this function, and that is the whole of
    FR-012: there is no code path here that could anchor a countdown on the
    pane's own clock (D-P9).
    """
    joins = joins or {}
    by_correlation: dict[str, dict] = {}
    for entry in open_escalations:
        escalation_id = entry.get("escalation_id")
        if isinstance(escalation_id, str):
            by_correlation[escalation_id] = entry

    items: list[dict] = []
    seen: set[str] = set()

    for item in stored:
        open_entry = by_correlation.get(item.correlation_id) if item.kind == "escalation" else None
        join = joins.get(item.correlation_id) if item.kind != "notice" else None
        if join is not None:
            resolution = join.resolution
            expires_at = join.expires_at
        else:
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
                # The join that could not be learned, named on the item that
                # lost it.  The item still renders, with its delivered text and
                # no deadline: what is missing is said, not filled in
                # (constitution III, FR-012).
                "degraded": join.degraded if join is not None else None,
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

    by_correlation = {
        entry.get("escalation_id"): entry
        for entry in escalations
        if isinstance(entry.get("escalation_id"), str)
    }
    joins = {
        item.correlation_id: await _join(
            reader, item, by_correlation.get(item.correlation_id)
        )
        for item in stored
        if item.kind != "notice"
    }

    items = assemble_attention(stored, escalations, in_flight=in_flight, joins=joins)
    if unsettled_only:
        items = [item for item in items if item["settlement"]["state"] != "settled"]
    return items


async def _join(
    reader: "Reader", item: StoredItem, open_entry: dict | None
) -> FactoryJoin:
    """Ask the factory what it knows about one item; never guess on its behalf.

    One read per answerable item, through the seam: a Question's stored record
    (FR-019) and an Escalation's fate.  Three outcomes and no fourth — the
    factory reported something, the factory has nothing to report (`None`, so no
    deadline), or the read failed in one of 001's two modes and says so on the
    item.  A Notice never reaches here: it asks for nothing, so there is nothing
    to join.
    """
    try:
        if item.kind == "question":
            record = await reader.read_question(item.correlation_id)
        else:
            record = await reader.read_escalation_fate(item.correlation_id)
            if record is None:
                # 001's list remains the fallback for an Escalation: a second
                # seam over the same fact, already read for this document.
                record = open_entry
    except (TransportFailed, QueryRefused) as exc:
        return FactoryJoin(degraded=_item_degraded(exc))

    if record is None:
        return FactoryJoin()
    return FactoryJoin(
        expires_at=record.get("expires_at"),
        resolution=record.get("resolution"),
    )


def _item_degraded(exc: TransportFailed | QueryRefused) -> dict:
    """The `{mode, what}` the item carries when its join could not be made."""
    from pane.floor_document import _redact_secrets

    return {
        "mode": "transport" if isinstance(exc, TransportFailed) else "refusal",
        "what": _redact_secrets(str(exc)),
    }


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
