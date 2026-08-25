"""Assemble the pane's showfloor document — one join, everything the room renders.

The second world's Showfloor is a master–detail: a rail of every spec, one
stage holding one epic's work graph, one pane explaining one story.  All three
regions render from the single document `assemble_showfloor` returns, so the
browser still never dials Temporal and never reads the factory's disk (001's
doctrine, unchanged).

Four sources are joined, and each is read through a seam that already exists:

======================  ===========================================================
datum                   source
======================  ===========================================================
spec order and state    ``factory.roadmap.models.read_roadmap`` — ergane's own
                        frontmatter reader, which walks ``specs/<dir>/spec.md`` in
                        sorted order and reads a spec with no frontmatter as
                        ``draft``.  Re-implementing that grammar here would be the
                        re-derivation constitution II forbids.
story identity, FR keys ``specs/<dir>/workgraph.json`` — the compiled graph, read
                        through 001's ``Reader.workgraph`` seam.
titles, priorities      the spec's own ``### User Story <n> - <title> (Priority:
                        P<n>)`` headings.  Titles exist nowhere else: the compiled
                        graph carries ``story_key`` and ``requirement_keys`` only.
live node state         the ``epic_status`` answer, through 001's reader, for the
                        epic whose id is the spec dir.
======================  ===========================================================

Every one of those reads may fail, and none of them may take the room down with
it (constitution III).  A failed read appends one ``{read, mode, detail}`` note
to *that spec's* entry — transport and refusal distinguished in ``mode``, never
only in prose — and every other spec is untouched.  A spec whose compiled graph
cannot be read still renders: its stories come from its own headings, which is
less than the graph knows and more than nothing, and the miss is named.

The ladder is derived **here** and not in the browser (plan D2), so card, rail
and detail pane cannot disagree about a stop, and the whole mapping is one
table unit-tested against all eleven of ergane's ``NodeState`` members.
"""

from __future__ import annotations

import dataclasses
import json
import re
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from pane.readers import Reader

from pane.readers import QueryRefused, TransportFailed

# --------------------------------------------------------------------------
# The ladder: DESIGN.md § The status ladder, as a table
# --------------------------------------------------------------------------

#: The six stops, always six, in order (DESIGN.md).  `key` is what code joins
#: on; `label` is the word DESIGN.md prints and the word a chip wears.  There is
#: no seventh stop: `tasks.md` boxes are never ticked, so "task x of y" has no
#: seam and this system does not render elements that can never fill.
LADDER_STOPS: tuple[tuple[str, str], ...] = (
    ("ready", "ready"),
    ("building", "building"),
    ("verifying", "verifying"),
    ("pr_open", "pr open"),
    ("queue", "queue"),
    ("merged", "merged"),
)

STOP_KEYS: tuple[str, ...] = tuple(key for key, _label in LADDER_STOPS)
STOP_LABELS: dict[str, str] = dict(LADDER_STOPS)

#: DESIGN.md's state→ladder table, verbatim and complete for the nine states
#: that name a stop.  `FAILED` and `KILLED` freeze the ladder instead of
#: occupying a stop, and `WAITING_OPERATOR` is handled just below.
STATE_TO_STOP: dict[str, str] = {
    "PENDING": "ready",
    "KEY_ISSUED": "building",
    "RUNNING": "building",
    "VERIFYING": "verifying",
    "PASSED": "pr_open",
    "PR_OPEN": "pr_open",
    "ENQUEUED": "queue",
    "MERGED": "merged",
}

#: `WAITING_OPERATOR` is a park taken *inside* an attempt — ergane's workflow
#: sets it in `_run_node` and the next attempt overwrites it at `KEY_ISSUED` —
#: so the stop it rests on is `building`.  Its tone is never anything but gold:
#: ergane derives `awaiting_operator` true for this state at the answer's seam
#: (`pending_escalation_id is not None or state == WAITING_OPERATOR`), so the
#: override below fires whether or not the answer carried the flag.
STATE_TO_STOP["WAITING_OPERATOR"] = "building"

#: The two states that freeze the ladder and carry `terminal_reason` verbatim.
TERMINAL_STATES: frozenset[str] = frozenset({"FAILED", "KILLED"})

#: A stop's status on a rendered ladder.  `frozen` is the fourth because a
#: terminal ladder is neither done nor ahead — DESIGN.md says it freezes, and a
#: word for that is the difference between showing a fact and implying one.
STOP_DONE = "done"
STOP_ACTIVE = "active"
STOP_WAITING = "waiting"
STOP_AHEAD = "ahead"
STOP_FROZEN = "frozen"

#: The chip a story wears, from DESIGN.md § Chips.  `pr open` is the one word
#: the chip table does not spell out while the ladder table does: PASSED and
#: PR_OPEN map to the `pr open` stop, and the chip is that stop's label wearing
#: the accent-on-accent-w colours the table gives all live work.
CHIP_WAITING = "waiting on you"
CHIP_LANDED = "landed"
CHIP_MERGED = "merged"
CHIP_DRAFT = "draft"
CHIP_READY = "ready"

#: The declared spec states ergane's roadmap grammar allows, mapped to the chip
#: vocabulary DESIGN.md fixes.  `deferred` has no chip of its own — it is a spec
#: parked out of the build order by operator choice, which is what `draft`'s
#: faint dashed chip already says — so it wears `draft` rather than minting a
#: seventh chip outside the table.
SPEC_STATE_CHIPS: dict[str, str] = {
    "draft": CHIP_DRAFT,
    "ready": CHIP_READY,
    "deferred": CHIP_DRAFT,
    "landed": CHIP_LANDED,
}


@dataclasses.dataclass(frozen=True)
class StoryHeading:
    """One `### User Story <n> - <title> (Priority: P<n>)` heading, parsed."""

    story_key: str
    title: str
    priority: str
    #: The paragraph directly under the heading — the story's one-sentence
    #: intent, whitespace-collapsed.  Empty when the heading has no prose under
    #: it; never invented.
    intent: str = ""


#: The grammar, anchored per line.  `(.+?)` is non-greedy so a title containing
#: a parenthesis does not swallow the priority; the whole line must match, so a
#: heading of any other shape contributes nothing and the caller falls back.
_HEADING_RE = re.compile(
    r"^### User Story (\d+) - (.+?) \(Priority: (P\d)\)\s*$"
)

#: `# Feature Specification: <name>` — the spec's name, for the rail row and the
#: stage header.  A spec without one falls back to its directory name.
_SPEC_NAME_RE = re.compile(r"^# Feature Specification: (.+?)\s*$", re.MULTILINE)


def parse_story_headings(spec_md_text: str) -> dict[str, StoryHeading]:
    """Return `{story_key: StoryHeading}` for every heading of the grammar.

    A line that does not match the grammar contributes nothing — the caller
    falls back to the `story_key` and names the miss (FR-002).  A heading whose
    title is present but blank is treated the same way, because a blank title
    renders as nothing and a rail row with nothing in it is worse than one
    wearing its own id.

    The function never raises on arbitrary text: anything that is not a
    matching line is simply not a heading.
    """
    headings: dict[str, StoryHeading] = {}
    lines = spec_md_text.splitlines()

    for index, line in enumerate(lines):
        match = _HEADING_RE.match(line)
        if match is None:
            continue
        number, title, priority = match.groups()
        title = title.strip()
        if not title:
            # Parses, says nothing.  The spec's Edge Cases put this case with
            # the unparseable one deliberately.
            continue
        story_key = f"US{int(number)}"
        headings[story_key] = StoryHeading(
            story_key=story_key,
            title=title,
            priority=priority,
            intent=_intent_after(lines, index),
        )

    return headings


def parse_spec_name(spec_md_text: str) -> str | None:
    """Return the `# Feature Specification: <name>` name, or None if absent."""
    match = _SPEC_NAME_RE.search(spec_md_text)
    if match is None:
        return None
    name = match.group(1).strip()
    return name or None


def _intent_after(lines: list[str], heading_index: int) -> str:
    """The first paragraph under a story heading, whitespace-collapsed.

    Stops at the next blank line after the paragraph starts, and refuses to
    cross another heading or one of the spec template's bold labels
    (`**Why this priority**`, `**Independent Test**`, …) — those are structure,
    not the story's intent.
    """
    collected: list[str] = []
    for line in lines[heading_index + 1 :]:
        stripped = line.strip()
        if not stripped:
            if collected:
                break
            continue
        if stripped.startswith("#") or stripped.startswith("**") or stripped.startswith("---"):
            break
        collected.append(stripped)
    return " ".join(collected)


def derive_ladder(
    state: str | None,
    awaiting_operator: bool | None,
    terminal_reason: str | None,
    spec_state: str | None,
) -> dict:
    """Derive one story's ladder object from DESIGN.md's table (FR-003).

    `state` is the `epic_status` node state verbatim, or None when no epic has
    ever been dispatched for this spec — undispatched work is not a degraded
    read, it is work that has not started.

    The rules, all from DESIGN.md § The status ladder:

    * PENDING→ready, KEY_ISSUED/RUNNING→building, VERIFYING→verifying,
      PASSED/PR_OPEN→pr open, ENQUEUED→queue, MERGED→all six done.
    * `awaiting_operator is True` overrides the active stop's tone to
      ``waiting`` and the chip to ``waiting on you``.  It never moves the stop:
      the operator is being waited on *at* the stop the work reached.
    * FAILED and KILLED freeze the ladder — no stop is done, none is active —
      and carry `terminal_reason` verbatim, untouched and unsummarized.
    * A story of an undispatched spec rests at `ready`, wearing its spec's own
      declared state as its chip (`draft` → `draft`).  A spec attested `landed`
      has no live answer to read and every story done, so its ladder is the
      six-done one and its chip is `merged`.

    A state ergane grows later and this table has not learned lands with no
    stop and no chip rather than being guessed at, and carries the word verbatim
    in `state` so the miss is visible (constitution III).
    """
    awaiting = awaiting_operator is True
    normalized = state if isinstance(state, str) and state else None

    if normalized is None:
        return _undispatched_ladder(spec_state, awaiting, terminal_reason)

    if normalized in TERMINAL_STATES:
        return {
            "state": normalized,
            "spec_state": spec_state,
            "stops": [
                {"key": key, "label": label, "status": STOP_FROZEN}
                for key, label in LADDER_STOPS
            ],
            "stop": None,
            "stop_key": None,
            "tone": "terminal",
            "chip": normalized.lower(),
            "frozen": True,
            # Verbatim.  The pane never rewrites the factory's own sentence.
            "terminal_reason": terminal_reason,
            "awaiting_operator": awaiting,
        }

    stop_key = STATE_TO_STOP.get(normalized)
    if stop_key is None:
        # A twelfth state.  Named, not guessed at.
        return {
            "state": normalized,
            "spec_state": spec_state,
            "stops": [
                {"key": key, "label": label, "status": STOP_AHEAD}
                for key, label in LADDER_STOPS
            ],
            "stop": None,
            "stop_key": None,
            "tone": "unknown",
            "chip": None,
            "frozen": False,
            "terminal_reason": terminal_reason,
            "awaiting_operator": awaiting,
        }

    # `WAITING_OPERATOR` is the operator being waited on whether or not the
    # answer carried the flag; ergane derives the flag from the state itself.
    if normalized == "WAITING_OPERATOR":
        awaiting = True

    if stop_key == "merged":
        return _all_done_ladder(normalized, spec_state, awaiting, terminal_reason)

    index = STOP_KEYS.index(stop_key)
    stops = []
    for position, (key, label) in enumerate(LADDER_STOPS):
        if position < index:
            status = STOP_DONE
        elif position == index:
            status = STOP_WAITING if awaiting else STOP_ACTIVE
        else:
            status = STOP_AHEAD
        stops.append({"key": key, "label": label, "status": status})

    return {
        "state": normalized,
        "spec_state": spec_state,
        "stops": stops,
        "stop": STOP_LABELS[stop_key],
        "stop_key": stop_key,
        "tone": "waiting" if awaiting else "normal",
        "chip": CHIP_WAITING if awaiting else STOP_LABELS[stop_key],
        "frozen": False,
        "terminal_reason": terminal_reason,
        "awaiting_operator": awaiting,
    }


def _all_done_ladder(
    state: str | None, spec_state: str | None, awaiting: bool, terminal_reason: str | None
) -> dict:
    """All six stops done — MERGED, or a spec the operator attested `landed`."""
    stops = [
        {
            "key": key,
            "label": label,
            "status": STOP_WAITING if (awaiting and key == "merged") else STOP_DONE,
        }
        for key, label in LADDER_STOPS
    ]
    return {
        "state": state,
        "spec_state": spec_state,
        "stops": stops,
        "stop": STOP_LABELS["merged"],
        "stop_key": "merged",
        "tone": "waiting" if awaiting else "done",
        "chip": CHIP_WAITING if awaiting else CHIP_MERGED,
        "frozen": False,
        "terminal_reason": terminal_reason,
        "awaiting_operator": awaiting,
    }


def _undispatched_ladder(
    spec_state: str | None, awaiting: bool, terminal_reason: str | None
) -> dict:
    """The ladder of a story no epic has ever run: it rests at `ready`.

    `landed` is the exception, and it is the operator's own word: an attested
    spec's stories are all merged and nothing live will ever say so again.
    """
    if spec_state == "landed":
        return _all_done_ladder(None, spec_state, awaiting, terminal_reason)

    stops = [
        {
            "key": key,
            "label": label,
            "status": (STOP_WAITING if awaiting else STOP_ACTIVE) if key == "ready" else STOP_AHEAD,
        }
        for key, label in LADDER_STOPS
    ]
    chip = SPEC_STATE_CHIPS.get(spec_state) if spec_state is not None else None
    return {
        "state": None,
        "spec_state": spec_state,
        "stops": stops,
        "stop": STOP_LABELS["ready"],
        "stop_key": "ready",
        "tone": "waiting" if awaiting else "normal",
        "chip": CHIP_WAITING if awaiting else chip,
        "frozen": False,
        "terminal_reason": terminal_reason,
        "awaiting_operator": awaiting,
    }


# --------------------------------------------------------------------------
# The reads
# --------------------------------------------------------------------------

#: The live fields a story takes from the `epic_status` answer.  Every one is
#: optional: an answer may be partial, and a field it did not carry is named in
#: the story's `unknown` list rather than defaulted to a lie (001's discipline).
LIVE_FACTS = (
    "state",
    "attempt",
    "awaiting_operator",
    "terminal_reason",
    "landing_state",
    "pr_number",
    "verified",
    "branch",
    "persona",
    "history",
    "landing_history",
)


@dataclasses.dataclass(frozen=True)
class ShowfloorReaders:
    """The two per-spec reads the document needs, injected rather than imported.

    Keeping them as callables is what lets every 052 fault shape be driven from
    a committed test with no live floor and no live filesystem: a test hands in
    a function that raises `TransportFailed`, and the assembly cannot tell it
    from a factory that is down.

    `workgraph(spec_dir)` returns the parsed compiled graph, or raises
    `TransportFailed` / `QueryRefused` / `json.JSONDecodeError`.
    `epic_status(spec_dir)` returns the answer for the epic whose id is that
    spec dir, `None` when no epic has been dispatched for it, or raises the
    same two failures.
    """

    workgraph: Callable[[str], dict]
    epic_status: Callable[[str], Awaitable[dict | None]]
    reference_instant: str | None = None

    @classmethod
    def from_reader(
        cls,
        reader: "Reader",
        specs_root: Path | str,
        *,
        archive_root: Path | None = None,
    ) -> "ShowfloorReaders":
        """Bind the two reads to 001's reader seam.

        The compiled graph lives beside its spec — `specs/<dir>/workgraph.json`,
        ergane's own `ARTIFACT_NAME`, which is what `Reader.workgraph` resolves.
        This repository additionally commits an archive copy of the same
        artifact from the same `ergane spec derive` run under `docs/dags/<dir>.json`
        (CLAUDE.md, "the derived work graphs, archived for review before
        dispatch"), because a target repo's specs are compiled on the operator's
        checkout and the compiled file is not committed beside the spec.  When
        the seam has nothing, the archive is consulted and the path that
        answered is recorded on the entry, so the document never claims a graph
        it did not read.

        The live half is bound to the epics `read_floor` reports, matched by
        `epic_id == spec_dir` — the identity `ergane spec derive` gives an epic.
        A spec with no epic on the floor gets `None`: undispatched, not degraded.
        """
        root = Path(specs_root)
        archive = archive_root if archive_root is not None else root.parent / "docs" / "dags"
        bound = _BoundReads(reader, root, archive)
        return cls(
            workgraph=bound.workgraph,
            epic_status=bound.epic_status,
            reference_instant=getattr(reader, "reference_instant", None),
        )


class _BoundReads:
    """The production binding of `ShowfloorReaders` to 001's `Reader`."""

    def __init__(self, reader: "Reader", specs_root: Path, archive_root: Path) -> None:
        self._reader = reader
        self._specs_root = specs_root
        self._archive_root = archive_root
        self._refs: dict[str, Any] | None = None
        self._floor_failure: Exception | None = None
        #: Where the graph for each spec dir actually came from, for the entry.
        self.workgraph_seams: dict[str, str] = {}

    def workgraph(self, spec_dir: str) -> dict:
        try:
            graph = self._reader.workgraph(spec_dir)
        except (TransportFailed, QueryRefused) as first:
            archived = self._archive_root / f"{spec_dir}.json"
            try:
                graph = json.loads(archived.read_text(encoding="utf-8"))
            except OSError:
                # The archive has nothing either: the *seam's* failure is the
                # one worth naming, because the seam is where the graph belongs.
                raise first from None
            self.workgraph_seams[spec_dir] = str(archived)
            return graph
        self.workgraph_seams[spec_dir] = str(self._specs_root / spec_dir / "workgraph.json")
        return graph

    async def epic_status(self, spec_dir: str) -> dict | None:
        refs = await self._epic_refs()
        ref = refs.get(spec_dir)
        if ref is None:
            return None
        return await self._reader.epic_status(ref.workflow_id, scene=ref.scene)

    async def _epic_refs(self) -> dict[str, Any]:
        """The floor's running epics, keyed by epic id, read once per assembly.

        A floor read that failed is re-raised for every spec rather than
        remembered as an empty floor: "no epic is running" and "I could not ask"
        are different sentences, and only one of them is true.
        """
        if self._floor_failure is not None:
            raise self._floor_failure
        if self._refs is None:
            try:
                floor = await self._reader.read_floor()
            except (TransportFailed, QueryRefused) as exc:
                self._floor_failure = exc
                raise
            self._refs = {ref.epic_id: ref for ref in floor.running}
        return self._refs


# --------------------------------------------------------------------------
# The document
# --------------------------------------------------------------------------


async def assemble_showfloor(
    specs_root: Path | str,
    readers: ShowfloorReaders,
    *,
    reference_instant: str | None = None,
) -> dict:
    """Assemble the showfloor document: one rail entry per spec, in dir order.

    The rail's order is `read_roadmap`'s order, which is sorted spec-dir order —
    the deterministic order two operators see the same way.
    """
    root = Path(specs_root)
    if reference_instant is None:
        reference_instant = readers.reference_instant

    entries, corpus_notes = _read_corpus(root)

    rail: list[dict] = []
    degraded: list[dict] = list(corpus_notes)
    for spec_dir, spec_state in entries:
        entry = await _assemble_spec(root, spec_dir, spec_state, readers)
        rail.append(entry)
        for note in entry["notes"]:
            degraded.append({"spec_dir": spec_dir, **note})

    return {
        "reference_instant": reference_instant,
        "specs_root": str(root),
        "rail": rail,
        "degraded": degraded,
    }


def _read_corpus(root: Path) -> tuple[list[tuple[str, str | None]], list[dict]]:
    """Every spec dir and its declared state, through ergane's roadmap reader.

    `read_roadmap` is the seam that owns the frontmatter grammar: sorted order,
    `state` defaulting to `draft` when no block is present, and a refusal
    naming every fault when the corpus does not parse.  It emits nothing on
    failure by design, so a corpus it refuses falls back to the one thing that
    needs no grammar — a listing of the directories that hold a `spec.md` —
    with every state `None`, which the Unknown Rule renders as unknown.  The
    refusal itself is named at the document level, once.
    """
    from factory.roadmap.models import SPEC_NAME, RoadmapError, read_roadmap

    try:
        roadmap = read_roadmap(root)
    except RoadmapError as exc:
        listing: list[tuple[str, str | None]] = []
        try:
            for path in sorted(p for p in root.iterdir() if p.is_dir()):
                if (path / SPEC_NAME).is_file():
                    listing.append((path.name, None))
        except OSError as listing_exc:
            return [], [
                {
                    "spec_dir": None,
                    "read": "read_roadmap",
                    "mode": "unparseable",
                    "detail": str(exc),
                },
                {
                    "spec_dir": None,
                    "read": "specs_root",
                    "mode": "transport",
                    "detail": str(listing_exc),
                },
            ]
        return listing, [
            {
                "spec_dir": None,
                "read": "read_roadmap",
                "mode": "unparseable",
                "detail": str(exc),
            }
        ]
    except OSError as exc:
        return [], [
            {
                "spec_dir": None,
                "read": "specs_root",
                "mode": "transport",
                "detail": str(exc),
            }
        ]

    return [(entry.spec_dir, str(entry.state)) for entry in roadmap.entries], []


async def _assemble_spec(
    root: Path,
    spec_dir: str,
    spec_state: str | None,
    readers: ShowfloorReaders,
) -> dict:
    """One rail entry: the spec, its stories, and every read that failed."""
    notes: list[dict] = []
    unknown: list[str] = []

    # --- the spec text: titles, priorities, intents, the spec's name
    headings: dict[str, StoryHeading] = {}
    name: str | None = None
    try:
        text = (root / spec_dir / "spec.md").read_text(encoding="utf-8")
    except OSError as exc:
        notes.append({"read": "spec.md", "mode": "transport", "detail": str(exc)})
    else:
        headings = parse_story_headings(text)
        name = parse_spec_name(text)

    # --- the compiled graph: story identity and requirement keys
    graph: dict | None = None
    try:
        graph = readers.workgraph(spec_dir)
    except (TransportFailed, QueryRefused) as exc:
        notes.append({"read": exc.read, "mode": _exc_mode(exc), "detail": exc.detail})
    except json.JSONDecodeError as exc:
        notes.append({"read": "workgraph", "mode": "unparseable", "detail": str(exc)})

    # --- the live answer: node state and landing facts
    live_nodes: dict[str, dict] = {}
    epic_state: str | None = None
    dispatched = False
    try:
        answer = await readers.epic_status(spec_dir)
    except (TransportFailed, QueryRefused) as exc:
        notes.append({"read": exc.read, "mode": _exc_mode(exc), "detail": exc.detail})
    else:
        if answer is not None:
            dispatched = True
            epic_state = answer.get("epic_state")
            live_nodes = answer.get("nodes") or {}

    stories, story_source = _stories(
        spec_dir, spec_state, graph, headings, live_nodes, unknown
    )

    landed = sum(1 for story in stories if story["ladder"]["stop_key"] == "merged")

    return {
        "spec_dir": spec_dir,
        "name": name if name is not None else spec_dir,
        "state": spec_state,
        "chip": _rail_chip(spec_state, stories),
        "stories_landed": landed,
        "stories_total": len(stories),
        "epic_id": spec_dir if dispatched else None,
        "epic_state": epic_state,
        "stories": stories,
        "story_source": story_source,
        "workgraph_seam": _workgraph_seam(root, spec_dir, readers),
        "notes": notes,
        "unknown": unknown,
    }


def _stories(
    spec_dir: str,
    spec_state: str | None,
    graph: dict | None,
    headings: dict[str, StoryHeading],
    live_nodes: dict[str, dict],
    unknown: list[str],
) -> tuple[list[dict], str]:
    """The spec's stories, from the compiled graph when it was readable.

    When it was not, story identity falls back to the spec's own headings: a
    rail entry with a degraded note is what the spec's Edge Cases require, and
    an entry with no stories at all would be an omission dressed as a render.
    The fallback carries no `requirement_keys` — the graph is the only place
    they exist — and says so by leaving the list empty and naming the read in
    `notes`.
    """
    if graph is not None:
        nodes = graph.get("nodes") or []
        stories = [
            _story(node.get("story_key"), node, headings, live_nodes, spec_state, unknown)
            for node in nodes
            if node.get("id") is not None
        ]
        return stories, "workgraph"

    stories = [
        _story(story_key, None, headings, live_nodes, spec_state, unknown)
        for story_key in sorted(headings, key=_story_number)
    ]
    return stories, "headings"


def _story_number(story_key: str) -> int:
    digits = "".join(character for character in story_key if character.isdigit())
    return int(digits) if digits else 0


def _story(
    story_key: str | None,
    node: dict | None,
    headings: dict[str, StoryHeading],
    live_nodes: dict[str, dict],
    spec_state: str | None,
    unknown: list[str],
) -> dict:
    """One story: identity, title, requirement keys, ladder, landing facts."""
    node_id = node.get("id") if node else (story_key.lower() if story_key else None)
    if story_key is None and node_id is not None:
        story_key = node_id.upper()

    heading = headings.get(story_key) if story_key else None
    if heading is None:
        # Degraded, never crashed, never invented: the id is the honest title.
        title = story_key or node_id or "unknown"
        priority = None
        intent = ""
        if story_key is not None:
            unknown.append(f"{story_key} title")
    else:
        title = heading.title
        priority = heading.priority
        intent = heading.intent

    live = live_nodes.get(node_id, {}) if node_id is not None else {}
    facts: dict[str, Any] = {}
    missing: list[str] = []
    for field in LIVE_FACTS:
        if field in live:
            facts[field] = live[field]
        else:
            facts[field] = None
            missing.append(field)

    ladder = derive_ladder(
        facts["state"],
        facts["awaiting_operator"],
        facts["terminal_reason"],
        spec_state,
    )

    return {
        "id": node_id,
        "story_key": story_key,
        "title": title,
        "priority": priority,
        "intent": intent,
        "requirement_keys": list(node.get("requirement_keys") or []) if node else [],
        "depends_on": list(node.get("depends_on") or []) if node else [],
        "depends_on_merged": list(node.get("depends_on_merged") or []) if node else [],
        "ladder": ladder,
        "facts": facts,
        # The live fields the answer did not carry, named rather than defaulted.
        "unknown": missing if live else [],
    }


def _rail_chip(spec_state: str | None, stories: list[dict]) -> str | None:
    """The rail row's chip word: what the epic is doing, else what it declares.

    DESIGN.md's rail pairs the chip with the story count (`landed 4/4`,
    `building 1/4`), so the word has to be the *epic's* word, not a story's.
    Priority is the operator's: someone is being waited on, then something died,
    then what is live, then everything landed, then the declared intent.
    """
    if any(story["ladder"]["tone"] == "waiting" for story in stories):
        return CHIP_WAITING

    frozen = [story for story in stories if story["ladder"]["frozen"]]
    if frozen:
        return frozen[0]["ladder"]["chip"]

    live = [
        story
        for story in stories
        if story["ladder"]["state"] is not None and story["ladder"]["stop_key"] != "merged"
    ]
    if live:
        return live[0]["ladder"]["chip"]

    if stories and all(story["ladder"]["stop_key"] == "merged" for story in stories):
        return CHIP_LANDED

    if spec_state is not None:
        return SPEC_STATE_CHIPS.get(spec_state)
    return None


def _workgraph_seam(root: Path, spec_dir: str, readers: ShowfloorReaders) -> str:
    """The path the compiled graph was actually read from, for provenance."""
    bound = getattr(readers.workgraph, "__self__", None)
    seams = getattr(bound, "workgraph_seams", None)
    if isinstance(seams, dict) and spec_dir in seams:
        return seams[spec_dir]
    return str(root / spec_dir / "workgraph.json")


def _exc_mode(exc: TransportFailed | QueryRefused) -> str:
    """001's two words, and the difference the 052 doctrine turns on."""
    return "transport" if isinstance(exc, TransportFailed) else "refusal"
