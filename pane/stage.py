"""Assemble one stage document per running epic.

`assemble_stage(epic_id, workgraph_or_failure, live_outcome)` is a pure join:
it merges a parsed `workgraph.json` with the `epic_status` answer for that
epic, without touching disk, Temporal, or the network.  Every partial or
failed read is named in the document's `notes`; the static file is the
structural truth.
"""

from __future__ import annotations

from typing import Any

from pane.readers import QueryRefused, TransportFailed

LIVE_FIELDS = ("state", "attempt", "awaiting_operator", "landing_state")


def assemble_stage(
    epic_id: str,
    workgraph_or_failure: dict | TransportFailed | Exception,
    live_outcome: dict | TransportFailed | QueryRefused,
) -> dict:
    """Return a stage document joining `workgraph.json` with an `epic_status` answer.

    The function is intentionally pure: it takes the outcomes 001's reader
    already returned, not a reader object.  This lets tests drive every 052
    fault shape with no live floor.

    Parameters
    ----------
    epic_id:
        The epic id, used only in note detail strings.
    workgraph_or_failure:
        Either the parsed `workgraph.json` document, a `TransportFailed` for a
        missing document, or a `json.JSONDecodeError` for an unparseable one.
    live_outcome:
        Either the parsed `epic_status` answer, a `TransportFailed`, or a
        `QueryRefused`.
    """
    notes: list[dict] = []

    # Workgraph read failed -> named degraded entry, no live join attempted.
    if isinstance(workgraph_or_failure, Exception):
        notes.append(_workgraph_failure_note(epic_id, workgraph_or_failure))
        return {
            "epic_id": epic_id,
            "nodes": [],
            "edges": [],
            "notes": notes,
            "degraded": True,
        }

    workgraph = workgraph_or_failure
    nodes: list[dict] = []
    edges: list[dict] = []
    static_nodes = workgraph.get("nodes", [])
    static_ids = {node.get("id") for node in static_nodes}

    # Live answer failure -> static nodes with all live fields unknown.
    status_nodes: dict[str, dict] = {}
    if isinstance(live_outcome, (TransportFailed, QueryRefused)):
        notes.append(_epic_status_failure_note(live_outcome))
        degraded = True
    else:
        status_nodes = live_outcome.get("nodes", {}) or {}
        degraded = False

    for node in static_nodes:
        node_id = node.get("id")
        if node_id is None:
            continue
        live = status_nodes.get(node_id, {}) if status_nodes is not None else {}
        nodes.append(_stage_node(node, live))

    for node in static_nodes:
        node_id = node.get("id")
        if node_id is None:
            continue
        for dep in node.get("depends_on", []) or []:
            edges.append({"source": dep, "target": node_id, "kind": "pass"})
        for dep in node.get("depends_on_merged", []) or []:
            edges.append({"source": dep, "target": node_id, "kind": "merge"})

    # Stray live-only ids are named in notes, never drawn.
    for live_id in status_nodes:
        if live_id not in static_ids:
            notes.append({
                "read": "epic_status",
                "mode": "undeclared",
                "detail": (
                    f"answer names node id '{live_id}', which workgraph.json "
                    f"does not declare; not drawn"
                ),
            })

    return {
        "epic_id": epic_id,
        "nodes": nodes,
        "edges": edges,
        "notes": notes,
        "degraded": degraded,
    }


def _stage_node(declared: dict, live: dict) -> dict:
    """Join one declared node with its live status fields, preserving unknowns."""
    unknown: list[str] = []
    live_values: dict[str, Any] = {}

    for field in LIVE_FIELDS:
        if field in live:
            live_values[field] = live[field]
        else:
            live_values[field] = None
            unknown.append(field)

    awaiting = live_values.get("awaiting_operator")
    waiting_on_operator = awaiting is True

    return {
        "id": declared.get("id"),
        "story_key": declared.get("story_key"),
        "persona": declared.get("persona"),
        "state": live_values.get("state"),
        "attempt": live_values.get("attempt"),
        "awaiting_operator": awaiting,
        "landing_state": live_values.get("landing_state"),
        "waiting_on_operator": waiting_on_operator,
        "unknown": unknown,
    }


def _epic_status_failure_note(exc: TransportFailed | QueryRefused) -> dict:
    mode = "transport" if isinstance(exc, TransportFailed) else "refusal"
    return {
        "read": "epic_status",
        "mode": mode,
        "detail": str(exc),
    }


def _workgraph_failure_note(epic_id: str, exc: Exception) -> dict:
    if isinstance(exc, TransportFailed):
        mode = "transport"
    else:
        # json.JSONDecodeError and any other parse failure.
        mode = "unparseable"
    return {
        "read": "workgraph",
        "mode": mode,
        "detail": str(exc),
    }
