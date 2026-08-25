"""Assemble the pane's showfloor document — one join, everything the room renders.

Rail, stage and detail pane all render from the one document
`assemble_showfloor` returns, so the browser still never dials Temporal and
never reads the factory's disk (001's doctrine).  Four sources, each through a
seam that already exists:

* **spec order and state** — `factory.roadmap.models.read_roadmap`, ergane's own
  frontmatter reader; re-implementing that grammar here is the re-derivation
  constitution II forbids.
* **story identity, `requirement_keys`** — `specs/<dir>/workgraph.json`, through
  001's `Reader.workgraph` seam.
* **titles, priorities** — the spec's `### User Story <n> - <title> (Priority:
  P<n>)` headings.  Titles exist nowhere else.
* **live node state** — the `epic_status` answer, for the epic whose id is the
  spec dir.
* **landing facts** — `factory.workgraph.landed.landed_facts` over the landing
  branch, through `pane/landing.py`.  A workflow ages out; a landing does not.

The last two are **layered, never swapped** (009 plan D1).  `epic_status` is the
only thing that knows an attempt number, a persona, or any of the four stops
between `ready` and `merged`, so a live answer governs every story it places and
the branch overwrites none of it.  The branch answers for the rest: a story it
carries reads `merged` whether or not a workflow still exists and whether or not
anyone has attested the spec's frontmatter — which is the whole defect 009
exists for, an epic that finished reading `READY 0/3` for as long as the
operator slept.  A story *neither* can place takes the Unknown Rule and names
the read that failed; it never takes the ladder's first stop, because `ready` is
a claim and not an absence of information.

Any may fail and none may take the room down with it (constitution III): a
failed read appends one `{read, mode, detail}` note to *that spec's* entry —
transport and refusal told apart in `mode`, never only in prose — and every
other spec is untouched.

The ladder is derived here and not in the browser (plan D2), so card, rail and
pane cannot disagree about a stop.
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

from pane.landing import LANDING_READ
from pane.readers import QueryRefused, TransportFailed

# --- the ladder: DESIGN.md § The status ladder, as a table ----------------

#: The six stops, always six, in order (DESIGN.md).  No seventh: `tasks.md` boxes
#: are never ticked, so "task x of y" has no seam.
LADDER_STOPS: tuple[tuple[str, str], ...] = (
    ("ready", "ready"), ("building", "building"), ("verifying", "verifying"),
    ("pr_open", "pr open"), ("queue", "queue"), ("merged", "merged"),
)

STOP_KEYS: tuple[str, ...] = tuple(key for key, _label in LADDER_STOPS)
STOP_LABELS: dict[str, str] = dict(LADDER_STOPS)

#: DESIGN.md's state→ladder table for the states that name a stop; FAILED and
#: KILLED freeze the ladder instead of occupying one.
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

#: `WAITING_OPERATOR` is a park taken *inside* an attempt — the next attempt
#: overwrites it at `KEY_ISSUED` — so its stop is `building`, always gold.
STATE_TO_STOP["WAITING_OPERATOR"] = "building"

TERMINAL_STATES: frozenset[str] = frozenset({"FAILED", "KILLED"})

#: A stop's status.  `frozen` is its own word: a terminal ladder is neither done
#: nor ahead, DESIGN.md says it freezes.
STOP_DONE = "done"
STOP_ACTIVE = "active"
STOP_WAITING = "waiting"
STOP_AHEAD = "ahead"
STOP_FROZEN = "frozen"

#: DESIGN.md § Chips.  A live story's chip is its active stop's label — which is
#: how PASSED/PR_OPEN wear `pr open`.
CHIP_WAITING = "waiting on you"
CHIP_LANDED = "landed"
CHIP_MERGED = "merged"
CHIP_DRAFT = "draft"
CHIP_READY = "ready"

#: ergane's spec states → DESIGN.md's chips.  `deferred` (parked out of the build
#: order) wears `draft` rather than minting a chip outside the table.
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
    #: The paragraph under the heading, whitespace-collapsed.  Empty when there
    #: is none.
    intent: str = ""


#: The grammar, anchored per line.  `(.+?)` is non-greedy so a title with a
#: parenthesis does not swallow the priority.
_HEADING_RE = re.compile(
    r"^### User Story (\d+) - (.+?) \(Priority: (P\d)\)\s*$"
)

#: The spec's name, for the rail row and the stage header.  A spec without one
#: wears its directory name.
_SPEC_NAME_RE = re.compile(r"^# Feature Specification: (.+?)\s*$", re.MULTILINE)


def parse_story_headings(spec_md_text: str) -> dict[str, StoryHeading]:
    """Return `{story_key: StoryHeading}` for every heading of the grammar.

    A line off the grammar contributes nothing — the caller falls back to the
    `story_key` and names the miss (FR-002); a blank title is the same case.
    The function never raises: a non-matching line is not a heading.
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

    Never crosses a heading or a template label (`**Why this priority**`, …).
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
    *,
    dispatched: bool = False,
    attested: bool = True,
) -> dict:
    """Derive one story's ladder object from DESIGN.md's table (FR-003).

    `state` is the `epic_status` node state verbatim, or None when no epic ever
    ran — undispatched work is not a degraded read.  `STATE_TO_STOP` above is
    the stop half of DESIGN.md's table (PENDING→ready … MERGED→all six done);
    the rest of the rules:

    * `awaiting_operator is True` turns the active stop's tone `waiting` and the
      chip `waiting on you`, never moving the stop: the operator is waited on
      *at* the stop the work reached.
    * FAILED and KILLED freeze the ladder and carry `terminal_reason` verbatim.
    * A story of an undispatched spec rests at `ready` wearing its spec's own
      state as its chip (`draft` → `draft`).  A spec attested `landed` has every
      story done and no live answer to read, so its ladder is the six-done one.
    * `dispatched` says an epic *did* answer and did not name this node — 002's
      skew.  It rests at `ready` with no chip: a running epic is newer news
      than an attestation.
    * `attested=False` silences that `landed` exception: the caller read the
      landing branch, and the branch does not carry this story.  An attestation
      is a claim and a landing is a fact, so the fact wins and the caller names
      the disagreement (009 Edge Cases).  It is never the *reverse* switch — a
      branch that could not be read leaves the attestation speaking.

    A state this table has not learned lands with no stop and no chip, carrying
    the word verbatim (constitution III).
    """
    awaiting = awaiting_operator is True
    normalized = state if isinstance(state, str) and state else None

    if normalized is None:
        return _undispatched_ladder(
            spec_state, awaiting, terminal_reason, dispatched, attested
        )

    if normalized in TERMINAL_STATES:
        # `terminal_reason` verbatim: the pane never rewrites the factory's own
        # sentence.
        return _ladder(
            normalized, spec_state, [STOP_FROZEN] * 6, None, "terminal",
            normalized.lower(), True, terminal_reason, awaiting,
        )

    stop_key = STATE_TO_STOP.get(normalized)
    if stop_key is None:
        # A twelfth state: named, not guessed at.
        return _ladder(
            normalized, spec_state, [STOP_AHEAD] * 6, None, "unknown",
            None, False, terminal_reason, awaiting,
        )

    if normalized == "WAITING_OPERATOR":
        awaiting = True

    if stop_key == "merged":
        return _all_done_ladder(normalized, spec_state, awaiting, terminal_reason)

    index = STOP_KEYS.index(stop_key)
    statuses = [
        STOP_DONE if position < index
        else (STOP_WAITING if awaiting else STOP_ACTIVE) if position == index
        else STOP_AHEAD
        for position in range(6)
    ]
    return _ladder(
        normalized, spec_state, statuses, stop_key,
        "waiting" if awaiting else "normal",
        CHIP_WAITING if awaiting else STOP_LABELS[stop_key],
        False, terminal_reason, awaiting,
    )


def _ladder(
    state: str | None,
    spec_state: str | None,
    statuses: list[str],
    stop_key: str | None,
    tone: str,
    chip: str | None,
    frozen: bool,
    terminal_reason: str | None,
    awaiting: bool,
) -> dict:
    """The one shape every ladder has: six stops, a stop, a tone and a chip."""
    return {
        "state": state,
        "spec_state": spec_state,
        "stops": [
            # `at` is the instant the factory recorded for this stop.  Only
            # `merged` can be stamped today — it is the one stop the branch
            # holds a commit for (FR-002a) — and the slot is on every stop so
            # the six have one shape, filled by `_stamped` where it is known and
            # left None where it is not (the Unknown Rule, never a dash here).
            {"key": key, "label": label, "status": status, "at": None}
            for (key, label), status in zip(LADDER_STOPS, statuses, strict=True)
        ],
        "stop": STOP_LABELS[stop_key] if stop_key is not None else None,
        "stop_key": stop_key,
        "tone": tone,
        "chip": chip,
        "frozen": frozen,
        "terminal_reason": terminal_reason,
        "awaiting_operator": awaiting,
    }


def _all_done_ladder(
    state: str | None, spec_state: str | None, awaiting: bool, terminal_reason: str | None
) -> dict:
    """All six stops done — MERGED, or a spec the operator attested `landed`."""
    statuses = [STOP_DONE] * 5 + [STOP_WAITING if awaiting else STOP_DONE]
    return _ladder(
        state, spec_state, statuses, "merged",
        "waiting" if awaiting else "done",
        CHIP_WAITING if awaiting else CHIP_MERGED,
        False, terminal_reason, awaiting,
    )


def _undispatched_ladder(
    spec_state: str | None,
    awaiting: bool,
    terminal_reason: str | None,
    dispatched: bool,
    attested: bool = True,
) -> dict:
    """The ladder of a story no epic answered for: it rests at `ready`.

    `landed` is the exception, the operator's own word: an attested spec's
    stories are all merged and nothing live will say so again.  It lapses once
    an epic *is* answering, the newer of the two sources — and once the landing
    branch has been read and does not carry the story (`attested=False`), which
    is the older and harder of the two.
    """
    if spec_state == "landed" and not dispatched and attested:
        return _all_done_ladder(None, spec_state, awaiting, terminal_reason)

    statuses = [STOP_WAITING if awaiting else STOP_ACTIVE] + [STOP_AHEAD] * 5
    chip = None if dispatched else SPEC_STATE_CHIPS.get(spec_state or "")
    return _ladder(
        None, spec_state, statuses, "ready",
        "waiting" if awaiting else "normal",
        CHIP_WAITING if awaiting else chip,
        False, terminal_reason, awaiting,
    )


def landed_ladder(spec_state: str | None) -> dict:
    """The ladder of a story the landing branch carries (FR-001).

    All six stops done, `merged`, with no live `state` — because there is none:
    the workflow that would have said `MERGED` may have aged out years ago and
    the commit is still there.  The same shape a live `MERGED` produces, so the
    card, the rail and the pane cannot tell the two sources apart, which is the
    point: a landed epic reads landed.
    """
    return _all_done_ladder(None, spec_state, False, None)


def unplaceable_ladder(spec_state: str | None) -> dict:
    """The ladder of a story neither source could place (FR-004).

    The Unknown Rule, spelt exactly as a state the table has not learned is
    spelt: no stop, no chip, tone `unknown`.  **Not** the first stop — `ready`
    is a claim that nothing has started, and the whole of 009 is that the room
    made that claim for eleven minutes about an epic that had finished.  The
    read that could not be made is named in the entry's notes by the caller.
    """
    return _ladder(
        None, spec_state, [STOP_AHEAD] * 6, None, "unknown", None, False, None, False
    )


def _stamped(ladder: dict, at: str | None) -> dict:
    """The same ladder with the landing commit's instant on its `merged` stop.

    Only a stop that is `done` is stamped: an instant on a stop the work has not
    reached would be a time for something that has not happened.  This never
    moves a stop or changes a status — a live answer still governs where the
    story is (FR-003); the branch only says *when* the last stop happened, which
    is a fact no `epic_status` answer carries at all.
    """
    if at is None:
        return ladder
    for stop in ladder["stops"]:
        if stop["key"] == "merged" and stop["status"] == STOP_DONE:
            stop["at"] = at
    return ladder


# --- the reads ------------------------------------------------------------

#: The live fields a story takes from the `epic_status` answer.  All optional: a
#: field the answer did not carry is named in the story's `unknown` rather than
#: defaulted to a lie (001's discipline).
LIVE_FACTS = (
    "state", "attempt", "awaiting_operator", "terminal_reason", "landing_state",
    "pr_number", "verified", "branch", "persona", "history", "landing_history",
)


@dataclasses.dataclass(frozen=True)
class ShowfloorReaders:
    """The per-spec reads the document needs, injected rather than imported.

    Callables, so every 052 fault shape is drivable from a committed test with
    no live floor.  `workgraph` returns the parsed graph or raises
    `TransportFailed` / `QueryRefused` / `json.JSONDecodeError`; `epic_status`
    returns that spec's epic's answer, or `None` when none was dispatched.

    `landing_facts` is 009's third read: `{story_key: LandingFact}` for one
    spec, off the landing branch, raising the same two exceptions as the others.
    `None` means *this build has no landing read at all* — not that nothing
    landed.  The distinction is load-bearing in both directions: with no reader
    the document behaves exactly as it did before 009 (the spec's attestation
    still speaks for a story nothing else places), and with a reader that
    *failed* a story nothing else places takes the Unknown Rule instead.
    """

    workgraph: Callable[[str], dict]
    epic_status: Callable[[str], Awaitable[dict | None]]
    reference_instant: str | None = None
    landing_facts: Callable[[str], dict[str, Any]] | None = None
    #: The branch `landing_facts` reads, for the wording of a disagreement note.
    #: A setting, never a literal spelt into a reader (009 plan D3).
    landing_branch: str | None = None

    @classmethod
    def from_reader(
        cls,
        reader: "Reader",
        specs_root: Path | str,
        *,
        archive_root: Path | None = None,
        landing_branch: str | None = None,
    ) -> "ShowfloorReaders":
        """Bind the reads to 001's reader seam.

        The graph lives beside its spec — `specs/<dir>/workgraph.json` — but a
        target repo's is compiled on the operator's checkout and not committed
        there; this repository archives that same `ergane spec derive` output
        under `docs/dags/<dir>.json` (CLAUDE.md).  So: seam first, archive
        second.  The live half is bound to the epics `read_floor` reports,
        matched by `epic_id == spec_dir`; a spec with no epic gets `None`,
        undispatched rather than degraded.

        The landing half reads the repository the corpus lives in — `specs/` is
        a directory *of* the target repository, so its parent is the checkout
        whose landing branch carries the landings.  The branch is the caller's
        setting (`Settings.landing_branch`, D-011's `dev` by default); a caller
        that passes none takes that same default rather than a name typed here.
        """
        from pane.config import DEFAULT_LANDING_BRANCH
        from pane.landing import LandingReader

        root = Path(specs_root)
        archive = archive_root if archive_root is not None else root.parent / "docs" / "dags"
        branch = landing_branch or DEFAULT_LANDING_BRANCH
        bound = _BoundReads(reader, archive)
        return cls(
            workgraph=bound.workgraph,
            epic_status=bound.epic_status,
            reference_instant=getattr(reader, "reference_instant", None),
            landing_facts=LandingReader(root.parent, branch).facts,
            landing_branch=branch,
        )


class _BoundReads:
    """The production binding of `ShowfloorReaders` to 001's `Reader`."""

    def __init__(self, reader: "Reader", archive_root: Path) -> None:
        self._reader = reader
        self._archive_root = archive_root
        self._refs: dict[str, Any] | None = None
        self._floor_failure: Exception | None = None

    def workgraph(self, spec_dir: str) -> dict:
        try:
            return self._reader.workgraph(spec_dir)
        except (TransportFailed, QueryRefused) as first:
            archived = self._archive_root / f"{spec_dir}.json"
            try:
                return json.loads(archived.read_text(encoding="utf-8"))
            except OSError:
                # Nothing archived either: the *seam's* failure is the one worth
                # naming, because the seam is where the graph belongs.
                raise first from None

    async def epic_status(self, spec_dir: str) -> dict | None:
        refs = await self._epic_refs()
        ref = refs.get(spec_dir)
        if ref is None:
            return None
        return await self._reader.epic_status(ref.workflow_id, scene=ref.scene)

    async def _epic_refs(self) -> dict[str, Any]:
        """The floor's running epics, keyed by epic id, read once per assembly.

        A failed read is re-raised for every spec rather than remembered as an
        empty floor: "no epic is running" and "I could not ask" differ.
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


# --- the document ---------------------------------------------------------


async def assemble_showfloor(
    specs_root: Path | str,
    readers: ShowfloorReaders,
    *,
    reference_instant: str | None = None,
) -> dict:
    """One rail entry per spec, in `read_roadmap`'s sorted spec-dir order."""
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

    `read_roadmap` owns the frontmatter grammar: sorted order, `state` defaulting
    to `draft`, a refusal naming every fault when the corpus does not parse.  It
    emits nothing on failure by design, and that discipline is kept.
    """
    from factory.roadmap.models import RoadmapError, read_roadmap

    def note(read: str, mode: str, detail: str) -> dict:
        return {"spec_dir": None, "read": read, "mode": mode, "detail": detail}

    try:
        roadmap = read_roadmap(root)
    except OSError as exc:
        return [], [note("specs_root", "transport", str(exc))]
    except RoadmapError as exc:
        return [], [note("read_roadmap", "unparseable", str(exc))]

    return [(entry.spec_dir, str(entry.state)) for entry in roadmap.entries], []


async def _assemble_spec(
    root: Path,
    spec_dir: str,
    spec_state: str | None,
    readers: ShowfloorReaders,
) -> dict:
    """One rail entry: the spec, its stories, every read that failed."""
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

    # --- the landing branch: which stories are on it, and what their commits say
    #     `landing is None` and `landing == {}` are different answers.  The
    #     first is "I could not ask"; the second is "I asked, and the branch
    #     carries none of them".  Only the second may silence an attestation.
    landing: dict[str, Any] | None = None
    landing_failed = False
    if readers.landing_facts is not None:
        try:
            landing = readers.landing_facts(spec_dir)
        except (TransportFailed, QueryRefused) as exc:
            landing_failed = True
            notes.append({"read": exc.read, "mode": _exc_mode(exc), "detail": exc.detail})

    stories, story_source = _stories(
        spec_state, graph, headings, live_nodes, dispatched, unknown,
        landing, landing_failed,
    )

    disagreement = _attestation_disagreement(
        spec_state, spec_dir, landing, stories, readers.landing_branch
    )
    if disagreement is not None:
        notes.append(disagreement)

    # `stories_landed` is counted off the *layered* ladders, so an epic that
    # finished with no live workflow and no attestation still reports n/n
    # (FR-002).  Counting the live answer alone is what reported 0/3.
    landed = sum(1 for story in stories if story["ladder"]["stop_key"] == "merged")

    # DESIGN.md's Unknown Rule, verbatim: "a total is unknown when any row in
    # scope is".  A story nothing could place makes the count of landed stories
    # a number nobody knows, and a `0` standing in for that is the zero
    # constitution III forbids.  The field stays an integer — the rail draws
    # `n/n` and there is no half of a fraction — and the entry says beside it
    # that the number is not one to trust.
    if any(
        story["ladder"]["stop_key"] is None and story["ladder"]["tone"] == "unknown"
        for story in stories
    ):
        unknown.append("stories_landed")

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
        "notes": notes,
        "unknown": unknown,
    }


def _stories(
    spec_state: str | None,
    graph: dict | None,
    headings: dict[str, StoryHeading],
    live_nodes: dict[str, dict],
    dispatched: bool,
    unknown: list[str],
    landing: dict[str, Any] | None = None,
    landing_failed: bool = False,
) -> tuple[list[dict], str]:
    """The spec's stories, from the compiled graph when it was readable.

    When it was not, identity falls back to the spec's own headings: an entry
    with no stories would be an omission dressed as a render.  The fallback
    carries no `requirement_keys` — the graph is the only place they exist — and
    says so with an empty list and the read named in `notes`.

    A spec can also declare none: a captured draft whose Work Graph is
    deliberately absent.  That entry is empty because the corpus is, not because
    a read failed — so it renders with `stories` in `unknown` rather than
    showing nothing and saying nothing.
    """
    if graph is not None:
        nodes = graph.get("nodes") or []
        stories = [
            _story(
                node.get("story_key"), node, headings, live_nodes, dispatched, spec_state,
                unknown, landing, landing_failed,
            )
            for node in nodes
            if node.get("id") is not None
        ]
        source = "workgraph"
    else:
        stories = [
            _story(
                story_key, None, headings, live_nodes, dispatched, spec_state,
                unknown, landing, landing_failed,
            )
            for story_key in sorted(headings, key=_story_number)
        ]
        source = "headings"

    if not stories:
        unknown.append("stories")
    return stories, source


def _story_number(story_key: str) -> int:
    digits = "".join(character for character in story_key if character.isdigit())
    return int(digits) if digits else 0


def _story(
    story_key: str | None,
    node: dict | None,
    headings: dict[str, StoryHeading],
    live_nodes: dict[str, dict],
    dispatched: bool,
    spec_state: str | None,
    unknown: list[str],
    landing: dict[str, Any] | None = None,
    landing_failed: bool = False,
) -> dict:
    """One story: identity, title, requirement keys, ladder, landing facts."""
    node_id = node.get("id") if node else (story_key.lower() if story_key else None)
    if story_key is None and node_id is not None:
        story_key = node_id.upper()

    heading = headings.get(story_key) if story_key else None
    if heading is None:
        # Degraded, never invented: the id is the honest title.
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

    # --- the two sources, layered (plan D1, FR-003)
    #
    # The live answer *places* a story when it carries a state for it; that is
    # the only thing that knows the four stops between `ready` and `merged`, so
    # where it speaks nothing below may overrule it.  Where it does not, the
    # branch answers, and where neither can, the Unknown Rule does.
    landing_fact = landing.get(story_key) if landing is not None and story_key else None
    on_branch = landing_fact is not None and landing_fact.on_branch
    placed_by_live = isinstance(facts["state"], str) and bool(facts["state"])

    if placed_by_live:
        ladder = derive_ladder(
            facts["state"],
            facts["awaiting_operator"],
            facts["terminal_reason"],
            spec_state,
            dispatched=dispatched,
        )
    elif on_branch:
        ladder = landed_ladder(spec_state)
    elif landing is not None or not landing_failed:
        # Either the branch answered and does not carry this story — in which
        # case an attestation may not speak over it — or this build has no
        # landing read at all, and the document reads as it did before 009.
        ladder = derive_ladder(
            None,
            facts["awaiting_operator"],
            facts["terminal_reason"],
            spec_state,
            dispatched=dispatched,
            attested=landing is None,
        )
    else:
        # The live answer did not place it and the branch could not be read.
        # `ready` here would be the very defect 009 fixes, one layer down.
        ladder = unplaceable_ladder(spec_state)
        if story_key is not None:
            unknown.append(f"{story_key} ladder")

    # --- the three facts the branch already holds (FR-002a)
    #
    # `landing_sha` is not a live field: `epic_status` carries no merge commit
    # at all, which is why DESIGN.md's landing SHA cell has drawn a dash since
    # 005.  `pr_number` *is* a live field, so the branch fills it only where the
    # answer did not — the corpus read overwrites no live fact, as it overwrites
    # no live stop.  Everything the branch cannot supply stays None: the Unknown
    # Rule, and no store is added and no history read that the branch lacks.
    facts["landing_sha"] = landing_fact.commit if on_branch else None
    if on_branch and facts["pr_number"] is None and landing_fact.pr_number is not None:
        facts["pr_number"] = landing_fact.pr_number
        if "pr_number" in missing:
            missing.remove("pr_number")
    _stamped(ladder, landing_fact.merged_at if on_branch else None)

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
        # An undispatched epic is not missing them; an answer that *was* read
        # and skipped this node — 002's skew — is missing all, and says so.
        "unknown": missing if dispatched else [],
    }


def _attestation_disagreement(
    spec_state: str | None,
    spec_dir: str,
    landing: dict[str, Any] | None,
    stories: list[dict],
    branch: str | None,
) -> dict | None:
    """The note a spec attested `landed` earns when the branch disagrees.

    An attestation is a claim and a landing is a fact.  Where the branch was
    read and does not carry every story the spec declares, the branch wins —
    `derive_ladder` has already refused the attestation — and the disagreement
    is *said*, because a claim silently overruled is as opaque as a claim
    silently believed (009 Edge Cases, constitution III).
    """
    if spec_state != "landed" or landing is None:
        return None

    unlanded = [
        story["story_key"] or story["id"] or "an unnamed story"
        for story in stories
        if story["facts"].get("landing_sha") is None
    ]
    if not unlanded:
        return None

    where = branch or "the landing branch"
    return {
        "read": LANDING_READ,
        "mode": "disagreement",
        "detail": (
            f"specs/{spec_dir}/spec.md attests state: landed, but {where} carries "
            f"no landing for {', '.join(unlanded)}"
        ),
    }


def _rail_chip(spec_state: str | None, stories: list[dict]) -> str | None:
    """The rail row's chip: what the epic is doing, else what it declares.

    DESIGN.md pairs it with the story count (`landed 4/4`), so the word is the
    *epic's*.  Priority is the operator's: someone waited on, something dead,
    what is live, all landed, the declaration.
    """
    if any(story["ladder"]["tone"] == "waiting" for story in stories):
        return CHIP_WAITING

    frozen = [story for story in stories if story["ladder"]["frozen"]]
    if frozen:
        return frozen[0]["ladder"]["chip"]

    live = [
        story for story in stories
        if story["ladder"]["state"] is not None and story["ladder"]["stop_key"] != "merged"
    ]
    if live:
        return live[0]["ladder"]["chip"]

    if stories and all(story["ladder"]["stop_key"] == "merged" for story in stories):
        return CHIP_LANDED

    if spec_state is not None:
        return SPEC_STATE_CHIPS.get(spec_state)
    return None


def _exc_mode(exc: TransportFailed | QueryRefused) -> str:
    """001's two words, and the difference the 052 doctrine turns on."""
    return "transport" if isinstance(exc, TransportFailed) else "refusal"
