"""Assemble the pane's showfloor document — one join, everything the room renders.

Rail, stage and detail pane all render from the one document
`assemble_showfloor` returns, so the browser still never dials Temporal and
never reads the factory's disk (001's doctrine).  Five sources, each through a
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
* **the gate run** — `factory.verify.store.node_history` over
  `connect_readonly`, through 001's reader seam (013 D-020).  Per story, per
  attempt: the gates that ran with their outcomes and durations, the loop
  summary the attempt ran under, and the judge's per-scenario findings.  It sits
  in its own section on the story and degrades inside it, so a store the pane
  cannot open costs the operator the gate run and nothing else.

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
from pane.readers import QueryRefused, TransportFailed, recorded_git_reads
from pane.sweep import sweep

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

#: The stop statuses that say the work reached this stop, and so the only ones
#: an instant may land on (019 FR-013).  `ahead` has not happened, and there is
#: no time for something that has not happened; `frozen` is DESIGN.md's word for
#: a ladder that stopped saying "reached" at all, and a terminal node's recorded
#: instants stay where the store put them, in the gate-run section.
STOPS_REACHED: frozenset[str] = frozenset({STOP_DONE, STOP_ACTIVE, STOP_WAITING})

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


#: Where a spec states its own goal, and the order the two are tried.  Every
#: refined spec in the corpus opens its body with `## Context`, a paragraph
#: saying why the spec exists; the ones still unrefined open with `## Sketch`,
#: which serves the same role (D-019).  `## Context` first, `## Sketch` when
#: the spec does not carry one.
_SPEC_INTENT_HEADINGS = ("## Context", "## Sketch")


def parse_spec_intent(spec_md_text: str) -> str:
    """The spec's own goal — one paragraph, or `""` when it states none.

    This is `parse_story_headings`' operation performed one heading level up:
    the *same* `_intent_after` paragraph reader, pointed at the spec's own
    opening heading instead of a `### User Story` one (009 plan D6).  A second
    parser would be free to disagree with the first about where a paragraph
    ends, and the room would then explain a story and its spec by two different
    rules.

    Never the section and never a Markdown render — the first paragraph,
    whitespace-collapsed, treated as prose (D-019, "What this is not").  A spec
    carrying neither heading, or a heading with nothing under it, says nothing
    here; the caller renders no band at all rather than an empty one (FR-011),
    because an empty bordered strip under the graph is furniture standing in
    for an answer.
    """
    lines = spec_md_text.splitlines()
    for heading in _SPEC_INTENT_HEADINGS:
        for index, line in enumerate(lines):
            if line.strip() != heading:
                continue
            intent = _intent_after(lines, index)
            if intent:
                return intent
            # The heading is there and states nothing.  Fall through to the
            # next one rather than stop: "no goal stated" is the answer only
            # when neither heading carries a paragraph.
            break
    return ""


#: A Spec Kit template label — `**Label**:` — which ends a paragraph wherever it
#: stands, blank line before it or not (FR-002).
#:
#: The **shape** is the whole test, and that is 019 US1's fix (plan D3).  The
#: guard here used to end a paragraph at any line *beginning* with `**`, which
#: caught the labels and also caught the second line of any paragraph whose wrap
#: happened to land on a bold word — so a goal band read `… — and` and stopped,
#: asserting on screen that the spec's goal ended there.  `[^*]+` cannot cross a
#: `**`, so a prose line carrying two bold phrases and a colon somewhere after
#: them is prose, and only `**…**:` is a label.
_TEMPLATE_LABEL_RE = re.compile(r"^\*\*[^*]+\*\*\s*:")

#: Inline marks, removed so the band renders prose (FR-003, plan D4).  This is
#: not a Markdown render and brings no dependency with it (constitution VII):
#: the pairs come off and the words they wrapped stay, in order.  D-019 asked
#: for the spec's goal "treated as prose", and `**` is what the *file* carries,
#: not what a reader reads.
#:
#: Code spans are lifted out before emphasis is touched and put back after, so
#: a bold phrase may span one (`**the `flag` matters**`) and an underscore
#: inside a code span is never read as emphasis.  Bold is matched before italic
#: and tolerates a single `*` inside itself.  The underscore forms are flanked:
#: the `_` in `parse_spec_intent` is a word's own character.
_CODE_SPAN_RE = re.compile(r"`+([^`]*)`+")
_INLINE_MARK_RES: tuple[re.Pattern[str], ...] = (
    re.compile(r"\*\*((?:[^*]|\*(?!\*))+)\*\*"),
    re.compile(r"\*([^*]+)\*"),
    re.compile(r"(?<![\w\\])__([^_]+)__(?!\w)"),
    re.compile(r"(?<![\w\\])_([^_]+)_(?!\w)"),
)

#: Where a lifted code span sits while emphasis is stripped around it.  NUL
#: cannot occur in a spec's prose, and an unpaired one is left where it is.
_HELD_SPAN_RE = re.compile(r"\x00(\d+)\x00")


def _strip_marks(text: str) -> str:
    """`text` with inline emphasis and code marks removed, words in order.

    Pairs only (FR-003): an unmatched `*`, `_` or backtick is a character the
    spec meant, and the reader leaves it alone rather than guessing at a mark.
    """
    held: list[str] = []

    def hold(match: re.Match[str]) -> str:
        held.append(match.group(1))
        return f"\x00{len(held) - 1}\x00"

    stripped = _CODE_SPAN_RE.sub(hold, text)
    for pattern in _INLINE_MARK_RES:
        stripped = pattern.sub(r"\1", stripped)
    return _HELD_SPAN_RE.sub(lambda match: held[int(match.group(1))], stripped)


def _intent_after(lines: list[str], heading_index: int) -> str:
    """The first paragraph under a heading, whitespace-collapsed, as prose.

    The one reader (FR-004): `parse_story_headings` points it at a
    `### User Story` heading and `parse_spec_intent` at the spec's own opening
    one, so a story's intent and its spec's goal cannot end in different
    places or carry marks the other has stripped.

    A blank line, a heading, a rule or a template label ends the paragraph; a
    continuation line that merely *starts* bold does not (FR-001, FR-002).  A
    heading with nothing under it collects nothing and answers `""`, and the
    caller draws no band at all (FR-005).
    """
    collected: list[str] = []
    for line in lines[heading_index + 1 :]:
        stripped = line.strip()
        if not stripped:
            if collected:
                break
            continue
        if (
            stripped.startswith("#")
            or stripped.startswith("---")
            or _TEMPLATE_LABEL_RE.match(stripped)
        ):
            break
        collected.append(stripped)
    return _strip_marks(" ".join(collected))


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
            # `at` is the instant the factory recorded for this stop.  The slot
            # is on every stop so the six have one shape; which of them a seam
            # can actually fill is `STOP_INSTANT_SEAMS` below, and a stop no
            # seam records is left None (the Unknown Rule, never a dash here —
            # the dash is the room's word, drawn where it finds a null).
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


#: Which approved seam records each stop's instant, and which stops none does
#: (019 FR-011, FR-012).  It is written down because FR-012 asks for the gap to
#: be an answer rather than a silence: four of the six stops have no seam at all
#: in the ergane distribution this pane rides, so their `at` stays None and the
#: room's own `—` is what says so.  Stop by stop:
#:
#: * `ready` — nothing records when a node became dispatchable.
#: * `building` — nothing records when an attempt started.  The evidence store's
#:   `started_at` brackets one *verification*, not one build, and reaching back
#:   from it to a build's start is exactly the derivation FR-014 forbids.
#: * `verifying` — `factory.verify.store.node_history`'s own `started_at`.
#: * `pr open` — nothing.  The `epic_status` answer carries `pr_number` and
#:   `landing_state` and no instant for either.
#: * `queue` — nothing.  The merge queue's `Landing.enqueued_at` is workflow
#:   state that `NodeStatus` does not carry, and `landing_history` records only
#:   the five terminal outcomes, none of which is an enqueue.
#: * `merged` — two seams for one event: the landing branch's own commit date
#:   (009 FR-002a), and the queue's `landing_history` entry whose outcome is
#:   `MERGED`.  The branch answers first, which is the order `DetailPane`
#:   already reads them in.
STOP_INSTANT_SEAMS: dict[str, str | None] = {
    "ready": None,
    "building": None,
    "verifying": "node_history.started_at",
    "pr_open": None,
    "queue": None,
    "merged": "landing branch commit date, else landing_history MERGED",
}


def _stamp(ladder: dict, key: str, at: str | None) -> None:
    """Put one seam's own instant on one stop, where the work reached it.

    Three rules, and each is a requirement rather than a taste.  A stop the work
    has not reached is never stamped (FR-013).  A stop that already carries an
    instant keeps it, so the two seams that answer for `merged` cannot take
    turns between refreshes.  And `at` is used exactly as the seam wrote it —
    nothing here parses, reformats or compares one instant with another
    (FR-014); anything that is not a non-empty string is no answer at all and is
    left to the Unknown Rule.
    """
    if not isinstance(at, str) or not at:
        return
    for stop in ladder["stops"]:
        if stop["key"] != key:
            continue
        if stop["at"] is None and stop["status"] in STOPS_REACHED:
            stop["at"] = at
        return


def _stamped(ladder: dict, at: str | None) -> dict:
    """The same ladder with the landing commit's instant on its `merged` stop.

    Only a stop the work reached is stamped: an instant on a stop the work has
    not reached would be a time for something that has not happened.  This never
    moves a stop or changes a status — a live answer still governs where the
    story is (FR-003); the branch only says *when* the last stop happened, which
    is a fact no `epic_status` answer carries at all.
    """
    _stamp(ladder, "merged", at)
    return ladder


def _stamp_recorded_instants(
    ladder: dict, landing_history: Any, attempts: list[dict]
) -> dict:
    """Every remaining stop an approved seam recorded an instant for (FR-011).

    `STOP_INSTANT_SEAMS` above is the coverage in words and this is the same
    thing in code: two stops are filled from the seams that record them, and
    four are left None for the room's `—` to answer (FR-012).  Each value is
    read straight out of the record it belongs to and none is worked out from
    another stop's (FR-014) — which is why there are two small readers below
    rather than one clever one.

    Called after `_stamped`, so the landing branch keeps `merged` where it could
    answer and the queue's own observation fills it only where the branch was
    not read or does not carry the story.
    """
    _stamp(ladder, "verifying", _verification_started_at(attempts))
    _stamp(ladder, "merged", _queue_merged_at(landing_history))
    return ladder


def _verification_started_at(attempts: list[dict]) -> str | None:
    """When the evidence store says this node's verification first started.

    `node_history` returns a node's attempts oldest first and the `verifying`
    stop is reached once, so the first of them is the instant the story got
    there.  A retry's own interval is not lost by taking it: the gate-run
    section carries every attempt's `started_at` and `finished_at` under the
    store's own names (013 FR-001), where they bracket a verification rather
    than standing in for a stop.
    """
    for attempt in attempts:
        started = attempt.get("started_at")
        if isinstance(started, str) and started:
            return started
    return None


def _queue_merged_at(landing_history: Any) -> str | None:
    """When the merge queue observed this node's landing merge.

    The last `MERGED` entry of the answer's own `landing_history` — the same
    entry `DetailPane.mergedAt` reads, chosen the same way, so the document and
    the pane cannot name two instants for one landing.  Every other outcome the
    queue records (`CHECKS_FAILED`, `CONFLICT`, `DEQUEUED_BY_HUMAN`, `STALLED`)
    is a thing that happened *at* the queue stop and not the stop being reached,
    so none of them stamps anything.
    """
    if not isinstance(landing_history, list):
        return None
    for entry in reversed(landing_history):
        if not isinstance(entry, dict) or entry.get("outcome") != "MERGED":
            continue
        at = entry.get("at")
        if isinstance(at, str) and at:
            return at
    return None


# --- the reads ------------------------------------------------------------

#: The live fields a story takes from the `epic_status` answer.  All optional: a
#: field the answer did not carry is named in the story's `unknown` rather than
#: defaulted to a lie (001's discipline).
LIVE_FACTS = (
    "state", "attempt", "awaiting_operator", "terminal_reason", "landing_state",
    "pr_number", "verified", "branch", "persona", "history", "landing_history",
)


# --- the gate run: what the factory recorded about each attempt -----------

#: The two facts the evidence store does not carry, and that the pane will not
#: invent.  `verification_results` has eighteen columns and none of them names
#: the model an attempt ran on or the persona it ran as.  Resolving either from
#: the persona registry would be *wrong* rather than approximate: the DEBUGGER
#: rung relabels the persona without re-resolving `model_alias`, so the registry
#: disagrees with reality on precisely the escalated attempt an operator is
#: reading (013 D2, FR-003).  So both render unknown, and they are named here so
#: the section can say which two rather than leaving two blank cells.
EVIDENCE_UNKNOWN: tuple[str, ...] = ("model", "persona")


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
    #: 013's fourth read: `(epic_id, node_id) -> list[VerificationResult]`, the
    #: evidence store's own `node_history` seam, raising the same two exceptions
    #: as the others.  `None` means *this build has no evidence read at all*,
    #: and the document then reads exactly as it did before 013 — every story
    #: carries an evidence section with no attempts in it, which is the same
    #: shape as a node the factory has never verified.  A build that has the
    #: reader and cannot use it is the other case, and that one is a note.
    node_history: Callable[[str, str], list[dict]] | None = None
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

        **The landing half is the one read a recording can stand in for** (016
        FR-001, plan D1).  A reader that has one — the demo floor's — answers it
        from `fixtures/`, so a room's answer never depends on the git history of
        the machine that ran it; a reader that has none reads the repository the
        corpus lives in, exactly as before, and that path is untouched (FR-004).
        (`specs/` is a directory *of* the target repository, so its parent is
        the checkout whose landing branch carries the landings.)  The branch is
        the caller's setting (`Settings.landing_branch`, D-011's `dev` by
        default); a caller that passes none takes that same default rather than
        a name typed here.
        Its reader outlives this binding on purpose (`pane.landing.reader_for`):
        the branch scan is expensive and pure, so it is memoised on the head for
        the process, and only the *head resolution* is this assembly's own.
        """
        from pane.config import DEFAULT_LANDING_BRANCH
        from pane.landing import AssemblyLanding, reader_for

        root = Path(specs_root)
        archive = archive_root if archive_root is not None else root.parent / "docs" / "dags"
        branch = landing_branch or DEFAULT_LANDING_BRANCH
        bound = _BoundReads(reader, archive)
        recorded = recorded_git_reads(reader)
        return cls(
            workgraph=bound.workgraph,
            epic_status=bound.epic_status,
            reference_instant=getattr(reader, "reference_instant", None),
            landing_facts=(
                recorded.landing_facts
                if recorded is not None
                else AssemblyLanding(reader_for(root.parent, branch)).facts
            ),
            landing_branch=branch,
            node_history=bound.node_history,
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

    def node_history(self, epic_id: str, node_id: str) -> list[dict]:
        """The evidence read, straight through: the seam is the whole of it.

        No archive fallback, unlike `workgraph` above.  A compiled graph has a
        second honest home in this repository because `ergane spec derive`
        writes one there; a verification does not — it exists in the factory's
        store or it does not exist, and standing anything else in for it would
        be the pane inventing a gate run.
        """
        return self._reader.node_history(epic_id, node_id)

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
    intent = ""
    try:
        text = (root / spec_dir / "spec.md").read_text(encoding="utf-8")
    except OSError as exc:
        notes.append({"read": "spec.md", "mode": "transport", "detail": str(exc)})
    else:
        headings = parse_story_headings(text)
        name = parse_spec_name(text)
        intent = parse_spec_intent(text)

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
        # The evidence read is the epic's, and the epic's id *is* the spec
        # directory — the same identity `_BoundReads.epic_status` matches a
        # running epic on.  It is passed down rather than read here because the
        # record is per node: one read per story, each degrading on its own.
        evidence_read=readers.node_history, epic_id=spec_dir,
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
        # The band under the stage (US4, FR-010).  Always present, so the room
        # never has to tell a missing field from a spec that stated nothing;
        # `""` is the spec saying nothing, and the band is not rendered for it.
        "intent": intent,
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
    evidence_read: Callable[[str, str], list[dict]] | None = None,
    epic_id: str = "",
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
                unknown, landing, landing_failed, evidence_read, epic_id,
            )
            for node in nodes
            if node.get("id") is not None
        ]
        source = "workgraph"
    else:
        stories = [
            _story(
                story_key, None, headings, live_nodes, dispatched, spec_state,
                unknown, landing, landing_failed, evidence_read, epic_id,
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
    evidence_read: Callable[[str, str], list[dict]] | None = None,
    epic_id: str = "",
) -> dict:
    """One story: identity, title, requirement keys, ladder, landing, evidence."""
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

    # --- the times the other seams already have (019 FR-011)
    #
    # The gate run is read here rather than in the `return` below because the
    # evidence store is one of those seams: it is the only thing that records
    # when a verification started, which is when the `verifying` stop happened.
    # `STOP_INSTANT_SEAMS` names the whole coverage, and the four stops no seam
    # records stay None on purpose.
    evidence = _story_evidence(evidence_read, epic_id, node_id)
    _stamp_recorded_instants(ladder, facts["landing_history"], evidence["attempts"])

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
        # The gate run (013 FR-001).  Its own section, with its own degradation
        # inside it: a store the pane cannot read says so *here*, and the
        # ladder, the facts and every other spec on the rail are untouched by it
        # (FR-002).  That is why nothing below appends to `notes` — a note there
        # is the room's word for "this rail entry is degraded", and an evidence
        # store that is not there does not make the epic's state unknown.  Read
        # above, where the `verifying` stop takes its instant from it.
        "evidence": evidence,
        # The live fields the answer did not carry, named rather than defaulted.
        # An undispatched epic is not missing them; an answer that *was* read
        # and skipped this node — 002's skew — is missing all, and says so.
        "unknown": missing if dispatched else [],
    }


# --- the evidence section -------------------------------------------------


def _story_evidence(
    read: Callable[[str, str], list[dict]] | None,
    epic_id: str,
    node_id: str | None,
) -> dict:
    """One story's recorded verifications, or the sentence saying why none.

    Two keys and no third.  `attempts` is what `node_history` returned, oldest
    first, each shaped by `_attempt` below.  `note` is `None` when the read was
    made, and `{read, mode, detail}` when it was not — the room's own triple, so
    transport and refusal stay told apart here as everywhere else (001, 052).

    An empty `attempts` with no note is an answer and not an absence of one:
    this node has no recorded verification, which is what a story that has never
    been dispatched looks like.  The section renders nothing for it rather than
    an empty frame (013 FR-010, US3's to draw).

    **This never raises and never touches another section.**  The failure is
    caught here, at the one story it belongs to, so a store that cannot be
    opened costs the operator the gate run and nothing else — not the ladder,
    not the landing SHA, not the spec beside it on the rail (FR-002).
    """
    if read is None or node_id is None:
        return {"attempts": [], "note": None}

    try:
        rows = read(epic_id, node_id)
    except (TransportFailed, QueryRefused) as exc:
        return {
            "attempts": [],
            "note": {"read": exc.read, "mode": _exc_mode(exc), "detail": exc.detail},
        }

    return {"attempts": [_attempt(row) for row in rows], "note": None}


def _attempt(row: dict) -> dict:
    """One `VerificationResult` as the room reads it.

    Field for field off the seam's own record — nothing is computed, nothing is
    joined, and nothing is looked up elsewhere.  Three things are worth saying
    about what is and is not here:

    * **`started_at` and `finished_at` bracket one verification, not one
      story.**  `AttemptTiming`'s own docstring in ergane says so: the
      dispatch-to-verification-start interval and the merge-queue time are not
      in this table at all.  They are carried under the store's own names so
      that whoever renders them cannot mistake them for a wall clock (plan trap
      1).
    * **`model` and `persona` are null, and say so in `unknown`.**  The store
      does not carry them and the persona registry is not asked (FR-003).
    * **The `output_tail` is failure-only and swept.**  US1 left it out of the
      document deliberately, to arrive with the sweep that guards it; `_gate`
      below is where it does (013 D4, FR-006/FR-007).
    """
    judge = row.get("judge")
    output_check = row.get("output_check") or {}

    return {
        "attempt": row.get("attempt"),
        "form": row.get("form"),
        "verdict": row.get("verdict"),
        # The interval of one *verification*.  See the docstring above.
        "started_at": row.get("started_at"),
        "finished_at": row.get("finished_at"),
        # Non-null exactly when a human completed the work instead of an agent.
        "provenance": row.get("provenance"),
        # The ladder the attempt ran under, as ergane wrote it: one line naming
        # the gates, the order, and the four caps (FR-001).
        "loop_summary": row.get("loop_summary"),
        "loop_digest": row.get("loop_digest"),
        "judge_unavailable": bool(row.get("judge_unavailable")),
        "criteria_drift": bool(row.get("criteria_drift")),
        "spec_ref": row.get("spec_ref"),
        "gates": [_gate(gate) for gate in row.get("gate_results") or []],
        "output_check": {
            "write_scope": output_check.get("write_scope"),
            "has_diff": output_check.get("has_diff"),
            "expected_artifacts": list(output_check.get("expected_artifacts") or []),
            "artifacts_present": output_check.get("artifacts_present"),
            "passed": output_check.get("passed"),
            "hygiene_violations": list(output_check.get("hygiene_violations") or []),
            "size_refusal": output_check.get("size_refusal"),
        },
        "judge": None if judge is None else {
            "outcome": judge.get("outcome"),
            "feedback": judge.get("feedback"),
            "judge_attempt": judge.get("judge_attempt"),
            "truncated_input": judge.get("truncated_input"),
            # The *judge's* registry alias, recorded in the row by the run that
            # used it.  Never the attempt's model, which nothing records — the
            # two are different facts and the key says which one this is.
            "model_alias": judge.get("model_alias"),
            "findings": [
                {
                    "scenario": finding.get("scenario"),
                    "passed": finding.get("passed"),
                    "reasoning": finding.get("reasoning"),
                }
                for finding in judge.get("findings") or []
            ],
        },
        # Unknown, deliberately, and not a gap to fill.  See `EVIDENCE_UNKNOWN`.
        "model": None,
        "persona": None,
        "unknown": list(EVIDENCE_UNKNOWN),
    }


#: The one gate status that suppresses a tail (013 FR-006).  Everything else the
#: store can record — FAIL, TIMEOUT, CONFIG_ERROR, and a status it did not
#: record at all — is a gate whose output is evidence.  Written as *the pass*
#: rather than as a list of failures so that a status ergane adds later arrives
#: carrying its output instead of silently losing it.
GATE_PASSED = "PASS"


def _gate(gate: dict) -> dict:
    """One gate command's outcome: the five facts US1-S1 names, its command, and
    — on failure only — the tail it printed.

    `exit_code` is null exactly when there was no exit to read — the command hit
    its deadline or never ran — which is the store's own meaning and not a zero
    standing in for one.  `concurrent_gates` is how many *other* gate executions
    were in flight beside this one; it is carried as the count ergane recorded
    and never inferred from durations (013 D5).

    ## The tail, and the two rules it arrives under

    **Failure-only** (FR-006).  A passing gate's `output_tail` does not reach
    the document at all, so the room cannot render one by accident and no
    surface has to decide what to withhold: the tail is evidence for a failure,
    not decoration for a success.  The key is on every gate regardless,
    answered `None` where there is none — a key that appeared only on failures
    would make "this gate printed nothing" and "this gate is shaped differently"
    the same observation.  A recorded-but-empty tail is `None` too: a silent
    command wrote `""` into the store's column, and carrying that through would
    have the room draw a fold over nothing (§ Don'ts).

    **Swept** (FR-007).  This is the first raw process output this repository
    has ever rendered — text no author here wrote and no reviewer here read —
    and constitution VI is absolute about what may reach a rendered page.  It
    goes through `pane.sweep`, which is the *same* definition
    `tests/test_credential_sweep.py` runs over every committed file, so US2-S3's
    "the same credential sweep every other surface passes" is true as an
    identity and not as a resemblance.  Whole, not truncated: ergane already
    bounds the column at ≤32 KiB, and a second bound invented here would be the
    pane withholding evidence it had.
    """
    status = gate.get("status")
    return {
        "name": gate.get("name"),
        "command": gate.get("command"),
        "status": status,
        "exit_code": gate.get("exit_code"),
        "duration_s": gate.get("duration_s"),
        "concurrent_gates": gate.get("concurrent_gates"),
        "output_tail": _gate_tail(status, gate.get("output_tail")),
    }


def _gate_tail(status: str | None, tail: str | None) -> str | None:
    """The tail this gate may render: swept, or `None`.  See `_gate`."""
    if status == GATE_PASSED or not tail:
        return None
    swept = sweep(tail)
    return swept or None


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
