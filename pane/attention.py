"""Assemble the attention section and the attention list from the pane-side store.

This module is the one place the attention rules live.  It is called by
`assemble_floor_document` in exactly one line; that keeps the floor document
assembly pure and lets this module carry all the ranking/settlement logic added
in later stories.
"""

from typing import Any, Sequence


def assemble_attention(
    stored: Sequence[dict],
    open_escalations: Sequence[dict],
    *,
    in_flight: frozenset[str] = frozenset(),
) -> tuple[list[dict], list[dict]]:
    """Return `(all_items, degraded_entries)` for the attention section.

    `stored` comes from the pane-side SQLite store.  `open_escalations` comes
    from `Reader.open_escalations()`.  The two are unioned by correlation id.
    Returns all assembled items and any degraded entries produced by the join.
    """
    degraded: list[dict] = []
    escalation_lookup = {esc.get("escalation_id"): esc for esc in open_escalations if esc.get("escalation_id")}

    items: list[dict] = []
    for row in stored:
        item = _assemble_item(row, escalation_lookup, in_flight)
        if item.get("degraded"):
            degraded.append(item["degraded"])
        items.append(item)

    items.sort(key=_rank_key)
    return items, degraded


def _assemble_item(row: dict, escalation_lookup: dict[str, dict], in_flight: frozenset[str]) -> dict:
    kind = row["kind"]
    if kind == "notice":
        item_id = f"notice:{row['seq']}"
    else:
        item_id = row["correlation_id"]

    expires_at = None
    resolution = None
    degraded = None

    if kind == "escalation":
        esc = escalation_lookup.get(row["correlation_id"])
        if esc is not None:
            expires_at = esc.get("expires_at")
            resolution = esc.get("resolution")

    settlement = _derive_settlement(row, in_flight, resolution)

    return {
        "id": item_id,
        "kind": kind,
        "correlation_id": row["correlation_id"],
        "text": row["text"],
        "actions": row["actions"],
        "expires_at": expires_at,
        "settlement": settlement,
        "degraded": degraded,
    }


def _derive_settlement(row: dict, in_flight: frozenset[str], resolution: Any) -> dict:
    kind = row["kind"]
    if kind == "notice":
        return {"state": "none", "ruling": None, "signal": None, "pressed_choice": None, "resolution": None}

    if resolution is not None:
        return {"state": "settled", "ruling": None, "signal": None, "pressed_choice": None, "resolution": resolution}

    if row.get("last_ruling") == "RESOLVED":
        return {"state": "settled", "ruling": "RESOLVED", "signal": None, "pressed_choice": None, "resolution": None}

    if row["correlation_id"] in in_flight:
        return {"state": "in_flight", "ruling": row.get("last_ruling"), "signal": None, "pressed_choice": None, "resolution": None}

    return {"state": "waiting", "ruling": row.get("last_ruling"), "signal": None, "pressed_choice": None, "resolution": None}


def _rank_key(item: dict) -> tuple:
    """Rank waiting/ruled first (escalation before question before notice), then in_flight, then settled."""
    rank_order = {"waiting": 0, "ruled": 0, "in_flight": 1, "settled": 2, "none": 3}
    kind_order = {"escalation": 0, "question": 1, "notice": 2}
    state = item["settlement"]["state"]
    return (rank_order.get(state, 0), kind_order.get(item["kind"], 2), item.get("expires_at") or "")