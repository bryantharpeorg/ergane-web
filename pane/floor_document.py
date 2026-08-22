"""Assemble the pane's single floor document.

`assemble_floor_document(reader)` is the one code path shared by demo mode and
live mode.  It knows only the `Reader` protocol from `pane.readers`; it does not
import the config module, the fixture loader, or the process environment, and
it contains no branching on the demo environment flag.

Each section is wrapped in an envelope with the seam that produced it.  Read
failures are caught as `TransportFailed` or `QueryRefused` and turned into one
`DegradedEntry` per failed read; the section is still present with `data: null`
(or `items: []` for attention).  Any other exception propagates — a bug is not
a degraded read.

Partial answers are tolerated: every `NodeCard` field has its default, an absent
epic state is ``"unknown"``, and a value the factory did not record stays
``None``.  No integer coercion, no ``or 0`` fallbacks, and the word ``live`` is
nowhere in a key, seam, or label.
"""

import re
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from pane.readers import EpicRef, Reader


async def assemble_floor_document(reader: "Reader", *, reference_instant: str | None = None) -> dict:
    """Build the floor document by reading every section through `reader`."""
    degraded: list[dict] = []
    if reference_instant is None:
        reference_instant = reader.reference_instant

    # floor
    try:
        floor_read = await reader.read_floor()
        floor_data = floor_read.status
    except Exception as exc:
        mode, detail, read, epic_id = _classify(exc)
        if mode is None:
            raise
        degraded.append(_degraded_entry("floor", mode, read, detail, epic_id))
        floor_data = None
        floor_read = None

    # attention
    try:
        escalations = await reader.open_escalations()
    except Exception as exc:
        mode, detail, read, epic_id = _classify(exc)
        if mode is None:
            raise
        degraded.append(_degraded_entry("attention", mode, read, detail, epic_id))
        escalations = []

    try:
        questions = reader.stored_questions()
    except Exception as exc:
        mode, detail, read, epic_id = _classify(exc)
        if mode is None:
            raise
        degraded.append(_degraded_entry("attention", mode, read, detail, epic_id))
        questions = []

    attention_items = _rank_attention(escalations, questions)

    # health
    try:
        findings = reader.list_findings()
    except Exception as exc:
        mode, detail, read, epic_id = _classify(exc)
        if mode is None:
            raise
        degraded.append(_degraded_entry("health", mode, read, detail, epic_id))
        findings = None

    # spend
    try:
        rollup = reader.rollup()
    except Exception as exc:
        mode, detail, read, epic_id = _classify(exc)
        if mode is None:
            raise
        degraded.append(_degraded_entry("spend_to_date", mode, read, detail, epic_id))
        rollup = None

    # epics
    epic_refs = floor_read.running if floor_read else []
    epics = []
    for ref in epic_refs:
        epic_entry, epic_degraded = await _assemble_epic(reader, ref)
        epics.append(epic_entry)
        degraded.extend(epic_degraded)

    return {
        "reference_instant": reference_instant,
        "floor": {
            "seam": "factory.cli.status.collect_floor",
            "data": floor_data,
        },
        "epics": epics,
        "attention": {
            "seam": "factory.escalation.client.open_escalations + stored Question documents",
            "items": attention_items,
        },
        "health": {
            "seam": "factory.doctor.store.list_findings over connect_readonly",
            "data": findings,
        },
        "spend_to_date": {
            "seam": "factory.usage.ledger.rollup over factory.usage.cli.open_readonly",
            "data": rollup,
        },
        "degraded": degraded,
    }


async def _assemble_epic(reader: "Reader", ref: "EpicRef") -> tuple[dict, list[dict]]:
    """Assemble one EpicEntry and any degraded reads it produced."""
    degraded: list[dict] = []

    # status read
    try:
        status = await reader.epic_status(ref.workflow_id, scene=ref.scene)
    except Exception as exc:
        mode, detail, read, epic_id = _classify(exc, epic_id=ref.epic_id)
        if mode is None:
            raise
        degraded.append(_degraded_entry("epics", mode, read, detail, epic_id))
        status = None

    # workgraph read
    try:
        workgraph = reader.workgraph(ref.workgraph_ref)
    except Exception as exc:
        mode, detail, read, epic_id = _classify(exc, epic_id=ref.epic_id)
        if mode is None:
            raise
        degraded.append(_degraded_entry("epics", mode, read, detail, epic_id))
        workgraph = None

    epic_state = _default(status, "epic_state", "unknown") if status else "unknown"
    status_nodes: dict[str, dict] = _default(status, "nodes", {}) if status else {}

    declared_nodes: list[dict] = []
    if workgraph is not None:
        for node in workgraph.get("nodes", []):
            node_id = node.get("id")
            if node_id is None:
                continue
            live = status_nodes.get(node_id, {})
            declared_nodes.append(_node_card(node_id, node, live, declared_flag=True))

    # nodes named by status but absent from workgraph
    workgraph_ids = {n.get("id") for n in workgraph.get("nodes", [])} if workgraph else set()
    for node_id, live in status_nodes.items():
        if node_id not in workgraph_ids:
            declared_nodes.append(_node_card(node_id, None, live, declared_flag=False))

    # spec root for the seam string
    if workgraph is not None:
        workgraph_seam = workgraph.get("specs_root")
        if workgraph_seam is None:
            workgraph_seam = f"<specs_root>/{ref.workgraph_ref}/workgraph.json"
        else:
            workgraph_seam = f"{workgraph_seam}/{ref.workgraph_ref}/workgraph.json"
    else:
        workgraph_seam = f"<specs_root>/{ref.workgraph_ref}/workgraph.json"

    entry = {
        "epic_id": ref.epic_id,
        "workflow_id": ref.workflow_id,
        "scene": ref.scene,
        "epic_state": epic_state,
        "nodes": declared_nodes,
        "status_seam": f"EpicWorkflow.epic_status on {ref.workflow_id}",
        "workgraph_seam": workgraph_seam,
    }

    return entry, degraded


def _default(container: dict | None, key: str, fallback: Any) -> Any:
    """Return container[key] if it exists, else fallback; never coerce a missing value."""
    if container is None:
        return fallback
    if key not in container:
        return fallback
    return container[key]


def _node_card(node_id: str, declared: dict | None, live: dict, *, declared_flag: bool) -> dict:
    """Join one workgraph node with its live status fields."""
    defaults = {
        "state": "unknown",
        "attempt": None,
        "awaiting_operator": False,
        "landing_state": None,
        "pr_number": None,
        "verified": False,
    }

    # Use an explicit None sentinel so an absent key does not fall through to a default.
    persona = _default(live, "persona", None)
    if persona is None and declared:
        persona = _default(declared, "persona", None)

    card = {
        "id": node_id,
        "declared": declared_flag,
        "story_key": _default(declared, "story_key", None),
        "persona": persona,
        "spec_ref": _default(declared, "spec_ref", None),
        "depends_on": _default(declared, "depends_on", None),
        "depends_on_merged": _default(declared, "depends_on_merged", None),
        "state": _default(live, "state", defaults["state"]),
        "attempt": _default(live, "attempt", defaults["attempt"]),
        "awaiting_operator": _default(live, "awaiting_operator", defaults["awaiting_operator"]),
        "landing_state": _default(live, "landing_state", defaults["landing_state"]),
        "pr_number": _default(live, "pr_number", defaults["pr_number"]),
        "verified": _default(live, "verified", defaults["verified"]),
    }
    return card


def _rank_attention(escalations: list[dict], questions: list[dict]) -> list[dict]:
    """Rank attention items: escalations first, then questions, ordered by expires_at."""
    items: list[dict] = []
    for esc in escalations:
        items.append({
            "kind": "escalation",
            "id": esc.get("escalation_id"),
            "expires_at": esc.get("expires_at"),
            "resolution": esc.get("resolution"),
            "source": "open_escalations",
            "document": esc,
        })
    for q in questions:
        items.append({
            "kind": "question",
            "id": q.get("correlation_id"),
            "expires_at": None,
            "resolution": None,
            "source": "stored_questions",
            "document": q,
        })

    def sort_key(item: dict) -> tuple:
        return (0 if item["kind"] == "escalation" else 1, item["expires_at"] or "")

    items.sort(key=sort_key)
    return items


def _classify(exc: Exception, epic_id: str | None = None) -> tuple[str | None, str, str, str | None]:
    """Classify a reader exception into a degraded mode, or return (None, ...) if it should propagate."""
    from pane.readers import QueryRefused, TransportFailed

    if isinstance(exc, TransportFailed):
        return ("transport", exc.detail, exc.read, epic_id)
    if isinstance(exc, QueryRefused):
        return ("refusal", exc.detail, exc.read, epic_id)
    return (None, "", "", epic_id)


def _degraded_entry(section: str, mode: str, read: str, detail: str, epic_id: str | None) -> dict:
    return {
        "section": section,
        "mode": mode,
        "epic_id": epic_id,
        "read": read,
        "detail": _redact_secrets(detail),
    }


def _redact_secrets(detail: str) -> str:
    """Mask bearer tokens and API keys that might leak in error messages."""
    return re.sub(r"sk-[A-Za-z0-9_\-]{8,}|Bearer \S+", "<redacted>", detail)
