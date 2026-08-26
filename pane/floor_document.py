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

**The workgraph read is seam first, archive second** (012 US1).  The graph
belongs beside its spec, but a target repository's is compiled on the
operator's checkout and never written back, so this repository archives that
same `ergane spec derive` output under `docs/dags/<dir>.json` — and the Desk
reads it there when the seam is silent, the way the Showfloor has since 002.  A
read the archive satisfies is not a degradation and says nothing; when neither
source answers it is the *seam's* failure that is reported, because the seam is
where the graph belongs; and an archive that is found and will not parse is
reported as `unparseable`, never as the `transport` an absent file reads — the
operator is owed the difference between a graph that is missing and one that is
broken.  The fallback lives here rather than in `LiveReader` on purpose: the
seam should keep meaning "the path the factory would write", and what to do
when it is silent is a policy of the assembly that owns degradation.

**And a graph is joined only when it is about this epic's stories** (012 US2).
A graph found under the right name can still be about the wrong work — the
archive is compiled once and committed, and the stories under it can be renamed
— so the join asks one question first: does any story the graph declares answer
to a name the floor also names?  If none does, the mismatch is named in
`degraded` and the graph is joined nowhere, because a dependency read off it
would be one story's edge drawn on another story's row.  A *partial* difference
is not that: a story the floor names and the graph does not is the skew case
the pane has rendered since 001, and a story the graph declares and the floor
has not started is work not yet dispatched.
"""

import json
import re
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from pane.readers import EpicRef, Reader

from pane.attention import assemble_attention_section
from pane.readers import QueryRefused, TransportFailed
from pane.stage import assemble_stage


def archive_root_for(specs_root: Path | str) -> Path:
    """`docs/dags` beside the corpus — where the operator archives compiled graphs.

    The same derivation `ShowfloorReaders.from_reader` makes, spelt once here so
    the two rooms cannot drift apart on where the archive lives (`CLAUDE.md`
    § Layout worth knowing).
    """
    return Path(specs_root).parent / "docs" / "dags"


def _archive_root(reader: "Reader") -> Path | None:
    """The archive this reader's corpus has, or `None` for a reader with no corpus.

    Only a reader that reads a specs root has an archive beside it; the fixture
    reader replays recorded documents and has none, and for it the seam is the
    whole read exactly as it was before.
    """
    specs_root = getattr(reader, "specs_root", None)
    return None if specs_root is None else archive_root_for(specs_root)


#: An archive that is *there* and will not parse, either as bytes or as JSON.
#: Both are "exists and will not parse", which FR-005 separates from "absent".
UNPARSEABLE_ARCHIVE = (json.JSONDecodeError, UnicodeDecodeError)


def _read_workgraph(reader: "Reader", spec_dir: str, archive_root: Path | None) -> dict:
    """The seam's graph, else the archived one: `_BoundReads.workgraph`'s rule.

    Three outcomes, and the third is the one that is easy to get wrong:

    * the seam answers — the archive is never opened at all (FR-004);
    * the seam is silent and the archive answers — that graph is returned, and
      the caller has nothing to report, because it is not a degradation
      (FR-001, FR-002);
    * the seam is silent and the archive is **absent** — the seam's own failure
      is re-raised, not the archive's, because the seam is where the graph
      belongs (FR-003).

    An archive that is present and will not parse is none of those: it travels
    up as itself, so that `_assemble_epic` names it `unparseable` rather than
    `transport`.  A file that exists and is malformed is a different fact from
    a file that is not there, and the operator is owed the difference (FR-005).
    """
    try:
        return reader.workgraph(spec_dir)
    except (TransportFailed, QueryRefused) as first:
        if archive_root is None:
            raise
        archived = archive_root / f"{spec_dir}.json"
        try:
            return json.loads(archived.read_text(encoding="utf-8"))
        except UNPARSEABLE_ARCHIVE:
            # The archive is there.  Do NOT collapse this into the seam's
            # failure below: that would report `transport` for a file that was
            # found, which is precisely the confusion FR-005 forbids.
            raise
        except OSError:
            # No archive either.  The seam's failure is the one worth naming.
            raise first from None


def _story_names(node: dict) -> set[str]:
    """Every spelling one graph node answers to, case-folded.

    The two seams spell one story two ways — `us1` on the floor, `US1` in the
    graph — and `EpicRow.storyForCard` already folds them together on the other
    side of the wire.  A comparison that folded only one of them would call a
    match a mismatch.
    """
    names = set()
    for spelling in (node.get("id"), node.get("story_key")):
        if isinstance(spelling, str) and spelling:
            names.add(spelling.casefold())
    return names


def _graph_mismatch(workgraph_dict: dict, status_nodes: dict) -> str | None:
    """The sentence naming a graph that is about some other epic's stories, else `None`.

    The spec's edge case (012 US2): *"An archive whose node ids do not match the
    story keys the spec declares: the mismatch is named in `degraded`, and the
    row does not invent a topology from the half it recognises."*  The archive
    is the source that can drift — it is compiled once and committed, and a
    spec's stories can be renamed under it — but this check does not ask which
    source answered, because a graph about other stories does the same harm
    whichever door it came through.

    **Only a *total* disjunction is a mismatch, and that is the whole of the
    rule.**  A partial one is ordinary and is already rendered: a story the
    floor names and the graph does not is the skew case, which `_node_card`
    marks `declared: false`; a story the graph declares and the floor has not
    started is a story not yet dispatched.  Either can happen on a graph that is
    exactly right.  What cannot happen on a right graph is *no* story in common
    — and a topology drawn from that would be one story's dependency lent to
    another story's row, which is the fabrication this corpus has already paid
    for once (plan D4).

    A floor that named no stories at all — a refused `epic_status`, which the
    Fixture floor's scanner scene records — is not a disjunction to measure.
    There is nothing to disagree with, and the refusal is already in `degraded`
    under its own read.
    """
    graph_names: set[str] = set()
    for node in workgraph_dict.get("nodes", []):
        graph_names |= _story_names(node)
    floor_names = {key.casefold() for key in status_nodes if isinstance(key, str) and key}

    if not graph_names or not floor_names:
        return None
    if graph_names & floor_names:
        return None

    return (
        f"the graph declares {sorted(graph_names)} and the floor names "
        f"{sorted(floor_names)}; no story is common to both, so the graph is not "
        "joined and no dependency is drawn from it"
    )


async def assemble_floor_document(reader: "Reader", *, reference_instant: str | None = None) -> dict:
    """Build the floor document by reading every section through `reader`."""
    degraded: list[dict] = []
    # Resolved once for the whole document, never per epic, for the reason the
    # Showfloor resolves it once at its binding.
    archive_root = _archive_root(reader)
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
    attention_items = await assemble_attention_section(reader, degraded=degraded, unsettled_only=True)

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
        epic_entry, epic_degraded = await _assemble_epic(reader, ref, archive_root)
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


async def _assemble_epic(
    reader: "Reader", ref: "EpicRef", archive_root: Path | None = None
) -> tuple[dict, list[dict]]:
    """Assemble one EpicEntry and any degraded reads it produced."""
    degraded: list[dict] = []

    # status read
    try:
        status = await reader.epic_status(ref.workflow_id, scene=ref.scene)
    except (TransportFailed, QueryRefused) as exc:
        degraded.append(_degraded_entry("epics", _exc_mode(exc), exc.read, exc.detail, ref.epic_id))
        status = exc
    except Exception as exc:
        mode, detail, read, epic_id = _classify(exc, epic_id=ref.epic_id)
        if mode is None:
            raise
        degraded.append(_degraded_entry("epics", mode, read, detail, epic_id))
        status = exc

    # workgraph read: the seam, and the archive behind it (012 FR-001)
    try:
        workgraph = _read_workgraph(reader, ref.workgraph_ref, archive_root)
    except (TransportFailed, QueryRefused) as exc:
        degraded.append(_degraded_entry("epics", _exc_mode(exc), exc.read, exc.detail, ref.epic_id))
        workgraph = exc
    except UNPARSEABLE_ARCHIVE as exc:
        # 001 R-002 lets decode errors propagate; 002 names the failure at the
        # seam.  012 FR-005 extends the same naming to the archive behind it:
        # a graph that was found and will not parse reads `unparseable`, never
        # the `transport` an absent file reads.
        degraded.append(_degraded_entry("epics", "unparseable", "workgraph", str(exc), ref.epic_id))
        workgraph = exc
    except Exception as exc:
        mode, detail, read, epic_id = _classify(exc, epic_id=ref.epic_id)
        if mode is None:
            raise
        degraded.append(_degraded_entry("epics", mode, read, detail, epic_id))
        workgraph = exc

    status_dict = status if isinstance(status, dict) else None
    epic_state = _default(status_dict, "epic_state", "unknown")
    status_nodes: dict[str, dict] = _default(status_dict, "nodes", {}) if status_dict else {}

    workgraph_dict = workgraph if isinstance(workgraph, dict) else None

    # A graph that turns out to be about some other epic's stories is named
    # here and joined nowhere (012 US2, spec Edge Cases).  `joined_graph` is
    # what the row's dependencies are read from; `workgraph_dict` still answers
    # for the seam string below, because *where the graph was read from* is a
    # fact even when what it held cannot be joined.
    joined_graph = workgraph_dict
    if workgraph_dict is not None:
        mismatch = _graph_mismatch(workgraph_dict, status_nodes)
        if mismatch is not None:
            degraded.append(
                _degraded_entry("epics", "mismatch", "workgraph", mismatch, ref.epic_id)
            )
            joined_graph = None

    declared_nodes: list[dict] = []
    if joined_graph is not None:
        for node in joined_graph.get("nodes", []):
            node_id = node.get("id")
            if node_id is None:
                continue
            live = status_nodes.get(node_id, {})
            declared_nodes.append(_node_card(node_id, node, live, declared_flag=True))

    # nodes named by status but absent from workgraph
    workgraph_ids = {n.get("id") for n in joined_graph.get("nodes", [])} if joined_graph else set()
    for node_id, live in status_nodes.items():
        if node_id not in workgraph_ids:
            declared_nodes.append(_node_card(node_id, None, live, declared_flag=False))

    # spec root for the seam string
    if workgraph_dict is not None:
        workgraph_seam = workgraph_dict.get("specs_root")
        if workgraph_seam is None:
            workgraph_seam = f"<specs_root>/{ref.workgraph_ref}/workgraph.json"
        else:
            workgraph_seam = f"{workgraph_seam}/{ref.workgraph_ref}/workgraph.json"
    else:
        workgraph_seam = f"<specs_root>/{ref.workgraph_ref}/workgraph.json"

    # stage document: the Showfloor's joined graph
    stage = assemble_stage(
        ref.epic_id,
        workgraph,
        status,
    )

    entry = {
        "epic_id": ref.epic_id,
        "workflow_id": ref.workflow_id,
        "scene": ref.scene,
        "epic_state": epic_state,
        "nodes": declared_nodes,
        "stage": stage,
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


def _classify(exc: Exception, epic_id: str | None = None) -> tuple[str | None, str, str, str | None]:
    """Classify a reader exception into a degraded mode, or return (None, ...) if it should propagate."""
    from pane.readers import QueryRefused, TransportFailed

    if isinstance(exc, TransportFailed):
        return ("transport", exc.detail, exc.read, epic_id)
    if isinstance(exc, QueryRefused):
        return ("refusal", exc.detail, exc.read, epic_id)
    return (None, "", "", epic_id)


def _exc_mode(exc: TransportFailed | QueryRefused) -> str:
    return "transport" if isinstance(exc, TransportFailed) else "refusal"


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
