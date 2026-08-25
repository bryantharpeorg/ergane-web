"""Prove the showfloor document joins four sources honestly (005 US1).

**008 US1 rewrote how this file gets its conditions, not what it proves.** It
used to assert over the repository as it stood that morning — that 001 said
`landed`, that 005 said `ready`, that 005 had no compiled graph in the archive.
None of those is a claim about the document; each is a claim about a file an
operator edits between builds, and all three went red the day an operator
attested 005 and archived the derived graphs, with no line of `pane/` touched.

So every corpus condition asserted below is now *constructed* — through
`tests/corpus.py`, the one helper allowed to name the repository's own specs and
archive, and allowed only to cut recorded material from them. The contracts are
the ones this file always proved: a spec whose frontmatter says `landed`
produces the `landed` chip and six done stops; a spec with no compiled graph
degrades to its own headings and says so; the two 052 fault shapes stay told
apart in `mode`. What changed is where the "given" comes from.

The two fault shapes are still the recorded ones — asked of the `FixtureReader`
rather than constructed, so the exceptions that reach the assembly are the
factory's own (constitution V). `tests/test_no_test_pins_live_corpus.py` is the
guard that keeps the convention from decaying again (FR-001).
"""

import asyncio
import json
import os
from pathlib import Path

import pytest
from corpus import (
    SpecFixture,
    build_corpus,
    copy_repository_corpus,
    derived_graph,
    entry_for,
    recorded_body,
)
from factory.cli.nouns import build
from factory.workgraph.workflow import NodeState
from fastapi.testclient import TestClient

from pane.app import create_app
from pane.config import Settings
from pane.fixture_floor import FixtureReader
from pane.readers import QueryRefused, TransportFailed
from pane.showfloor import (
    LADDER_STOPS,
    STOP_KEYS,
    ShowfloorReaders,
    assemble_showfloor,
    derive_ladder,
    parse_spec_name,
    parse_story_headings,
)

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"
SPECS = ROOT / "specs"

#: The four story keys the recorded spec body declares, and so the four a
#: constructed spec carries unless a fixture gives it a body of its own.
RECORDED_STORY_KEYS = ["US1", "US2", "US3", "US4"]


# --- readers over conditions a test constructs -----------------------------


def answering(spec_dir: str, outcome):
    """One spec answers `outcome`; no other has an epic.  `outcome` is a
    recorded answer or an exception to raise — how the two 052 fault shapes
    reach the assembly unchanged."""

    async def epic_status(asked: str) -> dict | None:
        if asked != spec_dir:
            return None
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    return epic_status


def recorded_answer(*parts: str) -> dict:
    return json.loads((FIXTURES.joinpath(*parts)).read_text())


def recorded_refusal() -> QueryRefused:
    """The refusal the Fixture floor raises: a recorded degraded answer, the
    CLI's rendering of a `WorkflowQueryRejectedError`, asked for rather than
    constructed."""
    reader = FixtureReader(FIXTURES)
    workflow_id = build.workflow_id("077-a-scanner-the-operator-chooses-runs-in-the-loop")
    with pytest.raises(QueryRefused) as caught:
        asyncio.run(reader.epic_status(workflow_id))
    return caught.value


def recorded_transport_failure() -> TransportFailed:
    """The transport failure the Fixture floor raises when a read cannot be made."""
    reader = FixtureReader(FIXTURES, transport_fail=frozenset({"epics"}))
    with pytest.raises(TransportFailed) as caught:
        asyncio.run(reader.epic_status(build.workflow_id("002-expense-notes")))
    return caught.value


# --- FR-002: the headings -------------------------------------------------


def test_well_formed_headings_parse_to_titles_and_priorities():
    """`### User Story <n> - <title> (Priority: P<n>)` yields title, priority.

    Over the recorded spec body — the grammar as a real spec writes it, rather
    than a sample written to match the regex (constitution V).
    """
    text = f"# Feature Specification: One epic on stage\n{recorded_body()}"

    headings = parse_story_headings(text)

    assert sorted(headings) == RECORDED_STORY_KEYS
    assert headings["US1"].title == "The declared gates exist and pass"
    assert headings["US1"].priority == "P1"
    assert headings["US4"].title == "The Desk renders the floor, read-only"
    assert headings["US4"].priority == "P2"
    assert headings["US1"].intent
    assert parse_spec_name(text) == "One epic on stage"
    assert parse_spec_name("no name here") is None


def test_a_heading_off_the_grammar_contributes_nothing():
    """Near-misses, a blank title, arbitrary bytes: none is a heading, and a
    parser that crashed on bad input would fail constitution III."""
    for text in ("", "### User Story", "###User Story 1 - x (Priority: P1)", "\x00\n---\n"):
        assert parse_story_headings(text) == {}

    headings = parse_story_headings(
        "\n".join(
            [
                "### User Story 1 - Good one (Priority: P1)",
                "### User Story 2 — em dash instead of hyphen (Priority: P2)",
                "### User Story 3 - no priority at all",
                "### User Story 4 -    (Priority: P1)",
            ]
        )
    )
    assert sorted(headings) == ["US1"]
    assert headings["US1"].title == "Good one"


def test_an_unparseable_heading_falls_back_to_story_key_and_is_named(tmp_path):
    """FR-002: `story_key` stands in, the miss lands in that spec's `unknown`.

    The malformed input is the recorded spec body with one heading damaged — the
    em dash a copy-paste produces — so well-formed and malformed differ by one
    character.  The graph is archived with all four stories, which is what makes
    US3 a story whose *title* is missing rather than a story that vanished.
    """
    original = recorded_body()
    damaged = original.replace("### User Story 3 - ", "### User Story 3 — ", 1)
    assert damaged != original

    spec_dir = "910-a-damaged-heading"
    corpus = build_corpus(
        tmp_path, SpecFixture(spec_dir, state="ready", archived=False, body=damaged)
    )
    corpus.archive(spec_dir, derived_graph(spec_dir, RECORDED_STORY_KEYS))

    entry = corpus.entry(spec_dir)

    stories = {story["story_key"]: story for story in entry["stories"]}
    assert stories["US3"]["title"] == "US3"
    assert stories["US3"]["priority"] is None
    assert entry["unknown"] == ["US3 title"]

    # Degraded, never crashed: every other story kept the heading's own words.
    intact = parse_story_headings(original)
    for story_key in ("US1", "US2", "US4"):
        assert stories[story_key]["title"] == intact[story_key].title


# --- FR-003: the ladder table ---------------------------------------------

#: DESIGN.md § The status ladder, transcribed: the stop each of ergane's eleven
#: `NodeState` members lands on.  `None` is the frozen ladder: no stop.
DESIGN_TABLE = {
    "PENDING": "ready",
    "KEY_ISSUED": "building",
    "RUNNING": "building",
    "VERIFYING": "verifying",
    "PASSED": "pr open",
    "PR_OPEN": "pr open",
    "ENQUEUED": "queue",
    "MERGED": "merged",
    "FAILED": None,
    "KILLED": None,
    "WAITING_OPERATOR": "building",
}


def test_the_table_covers_exactly_ergane_s_node_states():
    """Eleven states and six stops, read off ergane's enum and DESIGN.md: a
    twelfth state fails here rather than being silently rendered as nothing."""
    assert set(DESIGN_TABLE) == {member.name for member in NodeState}
    assert len(DESIGN_TABLE) == 11
    assert [label for _key, label in LADDER_STOPS] == [
        "ready", "building", "verifying", "pr open", "queue", "merged",
    ]


@pytest.mark.parametrize("state", sorted(DESIGN_TABLE))
def test_every_node_state_lands_on_its_design_md_stop(state):
    ladder = derive_ladder(state, False, None, "ready")

    assert ladder["stop"] == DESIGN_TABLE[state]
    assert ladder["state"] == state
    assert [stop["key"] for stop in ladder["stops"]] == list(STOP_KEYS)
    assert len(ladder["stops"]) == 6


def test_stops_before_the_active_one_are_done_and_the_rest_ahead():
    ladder = derive_ladder("ENQUEUED", False, None, "ready")

    statuses = {stop["key"]: stop["status"] for stop in ladder["stops"]}
    assert statuses == {
        "ready": "done",
        "building": "done",
        "verifying": "done",
        "pr_open": "done",
        "queue": "active",
        "merged": "ahead",
    }
    assert ladder["chip"] == "queue"
    assert ladder["tone"] == "normal"


def test_merged_is_all_six_done():
    ladder = derive_ladder("MERGED", False, None, "ready")

    assert [stop["status"] for stop in ladder["stops"]] == ["done"] * 6
    assert ladder["chip"] == "merged"
    assert ladder["tone"] == "done"
    assert ladder["frozen"] is False


@pytest.mark.parametrize(
    "state", [name for name, stop in DESIGN_TABLE.items() if stop is not None]
)
def test_awaiting_operator_turns_the_active_stop_gold_without_moving_it(state):
    """FR-003's override: the tone changes, the stop does not."""
    plain = derive_ladder(state, False, None, "ready")
    waiting = derive_ladder(state, True, None, "ready")

    assert waiting["stop"] == plain["stop"]
    assert waiting["tone"] == "waiting"
    assert waiting["chip"] == "waiting on you"
    assert waiting["awaiting_operator"] is True
    assert "waiting" in [stop["status"] for stop in waiting["stops"]]


def test_waiting_operator_is_gold_even_when_the_answer_omits_the_flag():
    """ergane derives the flag from the state; the pane must not need it told."""
    ladder = derive_ladder("WAITING_OPERATOR", None, None, "ready")

    assert ladder["tone"] == "waiting"
    assert ladder["chip"] == "waiting on you"
    assert ladder["awaiting_operator"] is True


@pytest.mark.parametrize("state", ["FAILED", "KILLED"])
def test_terminal_states_freeze_the_ladder_and_carry_the_reason_verbatim(state):
    reason = "gate 'smoke' failed: 3 assertions, see attempt 2's evidence"

    ladder = derive_ladder(state, False, reason, "ready")

    assert ladder["frozen"] is True
    assert ladder["stop"] is None
    assert [stop["status"] for stop in ladder["stops"]] == ["frozen"] * 6
    assert ladder["terminal_reason"] == reason
    assert ladder["chip"] == state.lower()
    assert ladder["tone"] == "terminal"


def test_a_story_of_an_undispatched_spec_rests_at_ready():
    """FR-003's last clause: draft → draft, ready → ready, landed → merged."""
    draft = derive_ladder(None, False, None, "draft")
    assert draft["stop"] == "ready"
    assert draft["chip"] == "draft"
    assert draft["state"] is None

    ready = derive_ladder(None, False, None, "ready")
    assert ready["stop"] == "ready"
    assert ready["chip"] == "ready"

    landed = derive_ladder(None, False, None, "landed")
    assert [stop["status"] for stop in landed["stops"]] == ["done"] * 6
    assert landed["chip"] == "merged"

    # …unless an epic is answering for the spec and did not name this node.
    skewed = derive_ladder(None, False, None, "landed", dispatched=True)
    assert skewed["stop"] == "ready"
    assert skewed["chip"] is None


def test_a_state_the_table_has_not_learned_is_named_not_guessed_at():
    ladder = derive_ladder("TELEPORTING", False, None, "ready")

    assert ladder["stop"] is None
    assert ladder["chip"] is None
    assert ladder["tone"] == "unknown"
    assert ladder["state"] == "TELEPORTING"


# --- FR-001: the document over a corpus the test constructs ----------------

#: The three declarations a rail must render, written into a scratch corpus so
#: the mapping is what is asserted — frontmatter word in, chip and ladder out —
#: and never which word this repository's own specs happen to carry today.
ATTESTED = "910-attested-landed"
IN_FLIGHT = "911-ready-to-build"
CAPTURED = "912-still-a-draft"


def three_state_corpus(tmp_path):
    return build_corpus(
        tmp_path,
        SpecFixture(ATTESTED, state="landed", name="attested landed"),
        SpecFixture(IN_FLIGHT, state="ready", name="ready to build"),
        SpecFixture(CAPTURED, state="draft", name="still a draft"),
    )


def test_the_rail_is_the_corpus_in_order(tmp_path):
    """FR-001 and scenario 1: dir, declared state, stories landed of total.

    The corpus is three specs this test wrote, so what is proved is the
    *mapping* — `landed` produces the `landed` chip and six done stops, `ready`
    produces `ready` and none, `draft` produces `draft` — over a given the test
    controls.  Attesting a spec in `specs/` moves nothing here.
    """
    corpus = three_state_corpus(tmp_path)

    document = corpus.assemble()

    assert [entry["spec_dir"] for entry in document["rail"]] == corpus.dirs
    assert corpus.dirs == [ATTESTED, IN_FLIGHT, CAPTURED]

    states = {entry["spec_dir"]: entry["state"] for entry in document["rail"]}
    assert states == {ATTESTED: "landed", IN_FLIGHT: "ready", CAPTURED: "draft"}

    landed = entry_for(document, ATTESTED)
    assert (landed["stories_landed"], landed["stories_total"]) == (4, 4)
    assert landed["chip"] == "landed"
    assert landed["name"] == "attested landed"
    assert all(
        [stop["status"] for stop in story["ladder"]["stops"]] == ["done"] * 6
        for story in landed["stories"]
    )

    ready = entry_for(document, IN_FLIGHT)
    assert ready["stories_landed"] == 0
    assert ready["stories_total"] == 4
    assert ready["chip"] == "ready"
    assert all(story["ladder"]["stop"] == "ready" for story in ready["stories"])

    draft = entry_for(document, CAPTURED)
    assert draft["chip"] == "draft"
    assert draft["stories_landed"] == 0


def test_a_spec_with_no_frontmatter_reads_draft(tmp_path):
    """FR-001's parenthesis, and ergane's own roadmap grammar (`read_roadmap`)."""
    corpus = build_corpus(tmp_path, SpecFixture("900-no-frontmatter", state=None))

    entry = corpus.entry("900-no-frontmatter")

    assert not corpus.spec_text("900-no-frontmatter").startswith("---")
    assert entry["state"] == "draft"
    assert entry["chip"] == "draft"
    assert all(story["ladder"]["stop"] == "ready" for story in entry["stories"])


def test_stories_carry_identity_title_priority_and_requirement_keys(tmp_path):
    corpus = build_corpus(tmp_path, SpecFixture(ATTESTED, state="landed"))

    entry = corpus.entry(ATTESTED)

    assert entry["story_source"] == "workgraph"
    assert [story["story_key"] for story in entry["stories"]] == RECORDED_STORY_KEYS
    assert [story["id"] for story in entry["stories"]] == ["us1", "us2", "us3", "us4"]

    # Titles and priorities come from the spec's own headings…
    headings = corpus.headings(ATTESTED)
    for story in entry["stories"]:
        heading = headings[story["story_key"]]
        assert story["title"] == heading.title
        assert story["priority"] == heading.priority
        assert story["intent"] == heading.intent

    # …and the graph's fields are copied from the graph, not re-derived from
    # the spec's prose.
    compiled = corpus.graph(ATTESTED)
    for story, node in zip(entry["stories"], compiled["nodes"], strict=True):
        assert story["requirement_keys"] == node["requirement_keys"]
        assert story["depends_on"] == node["depends_on"]
        assert story["depends_on_merged"] == node["depends_on_merged"]
    assert entry["stories"][0]["requirement_keys"][0] == "US1"

    assert entry["unknown"] == []
    assert entry["notes"] == []


def test_every_story_carries_a_ladder_object(tmp_path):
    corpus = three_state_corpus(tmp_path)
    document = corpus.assemble()

    graded = 0
    for entry in document["rail"]:
        # A spec renders every story it declares and no story it does not; a
        # spec declaring none renders empty and says so rather than going quiet.
        assert [story["story_key"] for story in entry["stories"]] == (
            corpus.declared_story_keys(entry["spec_dir"])
        )
        assert len(entry["stories"]) == entry["stories_total"]
        if not entry["stories"]:
            assert "stories" in entry["unknown"], f"{entry['spec_dir']} said nothing"
        for story in entry["stories"]:
            graded += 1
            ladder = story["ladder"]
            assert [stop["key"] for stop in ladder["stops"]] == list(STOP_KEYS)
            assert set(ladder) >= {"stop", "stop_key", "tone", "chip", "frozen", "state"}

    assert graded >= 4, "the sweep above is worthless if the corpus handed it nothing"


def test_a_captured_draft_declares_no_stories_and_is_named_not_dropped(tmp_path):
    """Constitution III over an empty corpus: a draft whose Work Graph is
    deliberately absent and whose body has no story headings is a rail entry
    with an empty stage and `stories` in `unknown` — not a spec the room drops.
    """
    corpus = build_corpus(
        tmp_path,
        SpecFixture(
            "902-captured-draft",
            state="draft",
            archived=False,
            body="\n## Work Graph\n\nAbsent.\n",
        ),
    )

    entry = corpus.entry("902-captured-draft")

    assert (entry["stories"], entry["unknown"]) == ([], ["stories"])
    assert (entry["state"], entry["chip"], entry["stories_total"]) == ("draft", "draft", 0)


def test_landing_facts_come_from_the_live_answer(tmp_path):
    """FR-001's landing facts: attempt, pr_number, landing_state, verified."""
    recorded = recorded_answer(
        "epic-status",
        "002-expense-notes",
        "002-expense-notes-001-us1=ENQUEUED-ENQUEUED_us2=PENDING.json",
    )
    corpus = build_corpus(tmp_path, SpecFixture(ATTESTED, state="landed"))

    entry = corpus.entry(ATTESTED, epic_status=answering(ATTESTED, recorded))

    us1 = entry["stories"][0]
    assert us1["facts"]["attempt"] == 1
    assert us1["facts"]["pr_number"] == 20
    assert us1["facts"]["landing_state"] == "ENQUEUED"
    assert us1["facts"]["verified"] is True
    assert us1["ladder"]["stop"] == "queue"

    us2 = entry["stories"][1]
    assert us2["ladder"]["stop"] == "ready"
    assert us2["facts"]["pr_number"] is None

    assert entry["epic_id"] == ATTESTED
    assert entry["epic_state"] == "RUNNING"
    assert entry["chip"] == "queue"


def test_a_partial_answer_names_the_fields_it_did_not_carry(tmp_path):
    """001's discipline: a field the factory did not record is unknown, not zero.

    And 002's skew with it: a node the answer never mentions is missing every
    live field and rests at `ready` with no chip even though its spec is
    attested `landed` — a state this test writes into the corpus rather than
    borrowing from whichever spec happens to carry it.
    """
    corpus = build_corpus(tmp_path, SpecFixture(ATTESTED, state="landed"))
    partial = {"epic_state": "RUNNING", "nodes": {"us1": {"state": "RUNNING"}}}

    entry = corpus.entry(ATTESTED, epic_status=answering(ATTESTED, partial))

    us1 = entry["stories"][0]
    assert us1["ladder"]["stop"] == "building"
    assert us1["facts"]["attempt"] is None
    assert "attempt" in us1["unknown"]
    assert "pr_number" in us1["unknown"]
    assert "state" not in us1["unknown"]

    us4 = entry["stories"][3]
    assert us4["facts"]["state"] is None
    assert "state" in us4["unknown"]
    assert us4["ladder"]["stop"] == "ready"
    assert us4["ladder"]["chip"] is None


def test_a_waiting_story_makes_the_whole_rail_row_wait(tmp_path):
    recorded = recorded_answer("epic-status", "question", "waiting-operator.json")
    corpus = build_corpus(tmp_path, SpecFixture(IN_FLIGHT))

    entry = corpus.entry(IN_FLIGHT, epic_status=answering(IN_FLIGHT, recorded))

    assert entry["chip"] == "waiting on you"
    assert entry["stories"][0]["ladder"]["tone"] == "waiting"


def test_a_killed_epic_freezes_every_one_of_its_ladders(tmp_path):
    recorded = recorded_answer("epic-status", "killed", "killed.json")
    corpus = build_corpus(tmp_path, SpecFixture(IN_FLIGHT))

    entry = corpus.entry(IN_FLIGHT, epic_status=answering(IN_FLIGHT, recorded))

    assert entry["chip"] == "killed"
    assert all(story["ladder"]["frozen"] for story in entry["stories"])
    assert all(story["ladder"]["chip"] == "killed" for story in entry["stories"])


# --- FR-004: the two 052 fault shapes -------------------------------------


@pytest.mark.parametrize("mode", ["refusal", "transport"])
def test_a_failed_epic_status_renders_the_entry_with_a_note_naming_the_mode(mode, tmp_path):
    """FR-004: in place, naming read and mode, healthy specs unaffected."""
    failure = recorded_refusal() if mode == "refusal" else recorded_transport_failure()
    corpus = three_state_corpus(tmp_path)

    document = corpus.assemble(epic_status=answering(ATTESTED, failure))
    entry = entry_for(document, ATTESTED)

    assert entry["notes"] == [{"read": "epic_status", "mode": mode, "detail": failure.detail}]
    # Still rendered, and static: the graph is the structural truth.
    assert len(entry["stories"]) == 4
    assert entry["stories"][0]["requirement_keys"][0] == "US1"
    assert all(story["ladder"]["state"] is None for story in entry["stories"])

    healthy = entry_for(document, IN_FLIGHT)
    assert not [note for note in healthy["notes"] if note["read"] == "epic_status"]


def test_stories_stay_static_when_the_live_state_cannot_be_read(tmp_path):
    """FR-004: the entry renders, its stories rest where the spec declares.

    A `ready` spec whose live read failed rests at `ready` — never a stop the
    pane did not observe — and a `landed` one keeps its six-done ladders: a fact
    the failed read did not take away.  Both states are written into the corpus
    here, so the claim is about the two declarations and not about which spec on
    the floor currently carries them.
    """
    failure = recorded_transport_failure()
    corpus = three_state_corpus(tmp_path)

    async def answer(spec_dir: str) -> dict | None:
        raise failure

    document = corpus.assemble(epic_status=answer)

    ready = entry_for(document, IN_FLIGHT)
    assert [note["mode"] for note in ready["notes"] if note["read"] == "epic_status"] == [
        "transport"
    ]
    for story in ready["stories"]:
        assert story["ladder"]["stop"] == "ready"
        assert story["ladder"]["state"] is None
        assert story["facts"]["attempt"] is None

    landed = entry_for(document, ATTESTED)
    assert all(story["ladder"]["stop"] == "merged" for story in landed["stories"])
    assert landed["chip"] == "landed"


def test_transport_and_refusal_are_distinguished_in_mode_not_only_in_prose(tmp_path):
    """The 052 doctrine's point: two modes, told apart by a field."""
    refusal = recorded_refusal()
    failure = recorded_transport_failure()
    corpus = three_state_corpus(tmp_path)

    async def answer(spec_dir: str) -> dict | None:
        if spec_dir == ATTESTED:
            raise refusal
        if spec_dir == IN_FLIGHT:
            raise failure
        return None

    document = corpus.assemble(epic_status=answer)

    modes = {
        note["spec_dir"]: note["mode"]
        for note in document["degraded"]
        if note["read"] == "epic_status"
    }
    assert modes[ATTESTED] == "refusal"
    assert modes[IN_FLIGHT] == "transport"
    assert modes[ATTESTED] != modes[IN_FLIGHT]


def test_a_spec_with_no_compiled_workgraph_is_an_entry_with_a_note(tmp_path):
    """The Edge Cases: a degraded note, not a crash and not an omission.

    The missing graph is *injected* at the `workgraph` reader — the shape
    `test_an_unparseable_workgraph_is_told_apart_from_a_missing_one` below
    already uses — so what is proved is "a graph this read could not fetch
    degrades the entry to headings", never "this repository has not archived
    that spec's graph yet".
    """
    corpus = three_state_corpus(tmp_path)

    def workgraph(spec_dir: str) -> dict:
        if spec_dir == IN_FLIGHT:
            raise TransportFailed("workgraph", f"{spec_dir}: no compiled graph")
        return corpus.workgraph(spec_dir)

    document = corpus.assemble(workgraph=workgraph)
    entry = entry_for(document, IN_FLIGHT)

    assert [note["read"] for note in entry["notes"]] == ["workgraph"]
    assert entry["notes"][0]["mode"] == "transport"
    assert entry["story_source"] == "headings"
    # From the spec's own headings, honest about what only the graph knows.
    assert [story["story_key"] for story in entry["stories"]] == RECORDED_STORY_KEYS
    assert entry["stories"][0]["title"] == corpus.headings(IN_FLIGHT)["US1"].title
    assert all(story["requirement_keys"] == [] for story in entry["stories"])

    healthy = entry_for(document, ATTESTED)
    assert healthy["notes"] == []
    assert healthy["story_source"] == "workgraph"


def test_an_unparseable_workgraph_is_told_apart_from_a_missing_one(tmp_path):
    corpus = three_state_corpus(tmp_path)
    truncated = json.dumps(corpus.graph(ATTESTED), indent=2)[:120]

    def workgraph(spec_dir: str) -> dict:
        if spec_dir == ATTESTED:
            return json.loads(truncated)
        return corpus.workgraph(spec_dir)

    document = corpus.assemble(workgraph=workgraph)
    entry = entry_for(document, ATTESTED)

    assert [note["read"] for note in entry["notes"]] == ["workgraph"]
    assert entry["notes"][0]["mode"] == "unparseable"
    assert entry["notes"][0]["mode"] != "transport"
    assert len(entry["stories"]) == 4


def test_a_corpus_ergane_refuses_is_named_not_half_rendered(tmp_path):
    """FR-004 over the frontmatter read: `read_roadmap` emits nothing on failure."""
    corpus = build_corpus(
        tmp_path,
        SpecFixture(
            "901-bad-frontmatter",
            state=None,
            archived=False,
            body="---\nstate: ready\nnot_a_key: 1\n---\n\n# x\n",
        ),
    )

    document = corpus.assemble()

    assert document["rail"] == []
    assert [note["read"] for note in document["degraded"]] == ["read_roadmap"]
    assert document["degraded"][0]["mode"] == "unparseable"


def test_a_floor_that_cannot_be_read_names_itself_on_every_spec(tmp_path):
    """ "No epic is running" and "I could not ask" are different sentences."""
    corpus = three_state_corpus(tmp_path)
    reader = FixtureReader(FIXTURES, transport_fail=frozenset({"floor"}))
    readers = ShowfloorReaders.from_reader(
        reader, corpus.specs_root, archive_root=corpus.archive_root
    )

    document = asyncio.run(assemble_showfloor(corpus.specs_root, readers))
    healthy = corpus.assemble()

    for entry in document["rail"]:
        floor_notes = [note for note in entry["notes"] if note["read"] == "collect_floor"]
        assert len(floor_notes) == 1, f"{entry['spec_dir']} did not name the dead floor"
        assert floor_notes[0]["mode"] == "transport"
        assert entry["epic_id"] is None
        # A dead floor costs the rail its live state, never its stories: each
        # spec still renders exactly the stories a healthy read renders.
        assert [story["story_key"] for story in entry["stories"]] == [
            story["story_key"] for story in entry_for(healthy, entry["spec_dir"])["stories"]
        ], "a dead floor must not empty the rail"


def test_the_document_level_degraded_list_names_the_spec_each_note_came_from(tmp_path):
    corpus = three_state_corpus(tmp_path)

    document = corpus.assemble(epic_status=answering(ATTESTED, recorded_refusal()))

    assert {"spec_dir", "read", "mode", "detail"} <= set(document["degraded"][0])
    assert any(
        note["spec_dir"] == ATTESTED and note["read"] == "epic_status"
        for note in document["degraded"]
    )


# --- FR-002: the corpus condition that was red ----------------------------


def test_the_document_survives_the_operator_attesting_and_archiving(tmp_path):
    """008 US1-S2, in one test: the edit that used to turn this file red.

    This repository's own corpus is *copied* into a scratch tree, so the
    material is the real thing and the conditions are still the test's own.  It
    is first put into a known pre-state — every spec `ready`, nothing archived —
    because trusting the copy to arrive in one would be the very dependence
    this story removes; then the operator's two open PRs are performed on it:
    every spec attested `landed`, every derived work graph archived beside it.
    That is a superset of "005 attested `landed` with its work graph archived",
    and it cannot go stale when a spec is renamed or a sixth one lands.

    The document is asserted well-formed on *both* sides of the edit, so what is
    proved is that the contract is indifferent to it — not that it happens to
    hold for one of the two.
    """
    corpus = copy_repository_corpus(tmp_path)
    assert corpus.dirs, "the repository's corpus copied as nothing"

    for spec_dir in corpus.dirs:
        corpus.attest(spec_dir, "ready")
        corpus.unarchive(spec_dir)

    before = corpus.assemble()
    assert_well_formed(before, corpus)
    assert {entry["chip"] for entry in before["rail"]} == {"ready"}
    # Nothing archived: every entry degrades to its own headings, and each one
    # names the read that could not be made rather than going quiet.
    assert all(entry["story_source"] == "headings" for entry in before["rail"])
    assert {note["read"] for note in before["degraded"]} == {"workgraph"}

    for spec_dir in corpus.dirs:
        corpus.attest(spec_dir, "landed")
        corpus.archive(spec_dir)

    after = corpus.assemble()
    assert_well_formed(after, corpus)
    assert after["degraded"] == [], "the attested, archived corpus degraded a read"

    # The edit landed, and it is exactly the one the operator makes.
    assert [entry["spec_dir"] for entry in after["rail"]] == corpus.dirs
    assert {entry["chip"] for entry in after["rail"]} == {"landed"}
    assert all(corpus.is_archived(spec_dir) for spec_dir in corpus.dirs)
    assert all(entry["story_source"] == "workgraph" for entry in after["rail"])
    assert all(
        entry["stories_landed"] == entry["stories_total"] for entry in after["rail"]
    )


def assert_well_formed(document: dict, corpus) -> None:
    """Every claim the showfloor document makes about itself, over any corpus."""
    assert set(document) == {"reference_instant", "specs_root", "rail", "degraded"}
    assert [entry["spec_dir"] for entry in document["rail"]] == corpus.dirs
    assert document["rail"], "a corpus with specs in it produced no rail"

    for entry in document["rail"]:
        assert entry["name"]
        assert entry["state"] in {"draft", "ready", "deferred", "landed"}
        assert [story["story_key"] for story in entry["stories"]] == (
            corpus.declared_story_keys(entry["spec_dir"])
        )
        assert entry["stories_total"] == len(entry["stories"])
        assert 0 <= entry["stories_landed"] <= entry["stories_total"]
        if not entry["stories"]:
            assert "stories" in entry["unknown"]
        for story in entry["stories"]:
            ladder = story["ladder"]
            assert [stop["key"] for stop in ladder["stops"]] == list(STOP_KEYS)
            assert ladder["spec_state"] == entry["state"]


# --- T005: the route ------------------------------------------------------


@pytest.fixture
def demo_app(tmp_path, monkeypatch, credentials):
    monkeypatch.chdir(tmp_path)
    for key in list(os.environ):
        if key.startswith(("ERGANE_", "FACTORY_", "TEMPORAL_")):
            monkeypatch.delenv(key, raising=False)
    for name, value in {
        "PANE_DEMO": "1",
        "PANE_FIXTURES_ROOT": str(FIXTURES),
        "PANE_SPECS_ROOT": str(SPECS),
    }.items():
        monkeypatch.setenv(name, value)
    return create_app(Settings.from_env())


def test_api_showfloor_serves_the_document(demo_app, auth_headers):
    """The route over the repository's real corpus — its *shape*, and only that.

    Whatever the corpus says today, the rail is one entry per spec directory in
    sorted order and the document has its four keys; nothing here reads a state
    or an archive, so an operator's attestation cannot reach it.
    """
    client = TestClient(demo_app, headers=auth_headers)

    response = client.get("/api/showfloor")

    assert response.status_code == 200
    document = response.json()
    assert set(document) == {"reference_instant", "specs_root", "rail", "degraded"}
    assert [entry["spec_dir"] for entry in document["rail"]] == sorted(
        path.name for path in SPECS.iterdir() if (path / "spec.md").is_file()
    )


def test_api_showfloor_is_behind_the_token_like_every_other_route(demo_app):
    """Constitution VI: the guard is the router's, so the route inherits it."""
    client = TestClient(demo_app)

    assert client.get("/api/showfloor").status_code == 401
    assert client.get("/api/showfloor", headers={"Authorization": "Bearer no"}).status_code == 401
