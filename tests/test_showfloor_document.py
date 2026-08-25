"""Prove the showfloor document joins four sources honestly (005 US1).

Every assertion is over committed material: this repository's own `specs/`
corpus, the compiled graphs archived under `docs/dags/`, and the recorded
Fixture floor.  Nothing here needs a live factory, and no shape is invented —
the two 052 fault shapes are produced by asking the `FixtureReader` for reads
the recording genuinely cannot answer, and the exceptions it raises are carried
into the assembly verbatim (constitution V).
"""

import asyncio
import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from factory.cli.nouns import build
from factory.workgraph.workflow import NodeState

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
DAGS = ROOT / "docs" / "dags"

#: The spec whose compiled graph this repository committed and whose headings
#: are the parser's well-formed case.  Both files are in the diff's tree.
ARCHIVED_SPEC = "001-the-desk-sees-the-floor"


# --------------------------------------------------------------------------
# helpers: readers built from committed artifacts
# --------------------------------------------------------------------------


def archive_workgraph(spec_dir: str) -> dict:
    """The compiled graph this repository archived, or a transport failure.

    `docs/dags/<dir>.json` is the artifact `ergane spec derive` wrote before
    dispatch (CLAUDE.md); a spec with no archived graph is exactly the
    "no compiled workgraph" edge case the spec names, and it fails the way the
    reader seam fails.
    """
    path = DAGS / f"{spec_dir}.json"
    if not path.is_file():
        raise TransportFailed("workgraph", f"{path}: no compiled graph")
    return json.loads(path.read_text())


async def no_epic(spec_dir: str) -> dict | None:
    """No epic is running for this spec: undispatched, not degraded."""
    return None


def static_readers(**overrides) -> ShowfloorReaders:
    fields = {"workgraph": archive_workgraph, "epic_status": no_epic}
    fields.update(overrides)
    return ShowfloorReaders(**fields)


def assemble(specs_root=SPECS, readers: ShowfloorReaders | None = None) -> dict:
    return asyncio.run(
        assemble_showfloor(specs_root, readers if readers is not None else static_readers())
    )


def entry_for(document: dict, spec_dir: str) -> dict:
    return next(entry for entry in document["rail"] if entry["spec_dir"] == spec_dir)


def recorded_refusal() -> QueryRefused:
    """The refusal the Fixture floor actually raises, carried out of the reader.

    `fixtures/epic-status/refusal.json` is a recorded degraded answer — the
    CLI's rendering of a `WorkflowQueryRejectedError` — so asking the fixture
    reader for it is how a refusal is obtained here rather than constructed.
    """
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


# --------------------------------------------------------------------------
# FR-002: the headings
# --------------------------------------------------------------------------


def test_well_formed_headings_parse_to_titles_and_priorities():
    """`### User Story <n> - <title> (Priority: P<n>)` yields title and priority."""
    text = (SPECS / "005-one-epic-on-stage" / "spec.md").read_text()

    headings = parse_story_headings(text)

    assert sorted(headings) == ["US1", "US2", "US3", "US4"]
    assert headings["US1"].title == (
        "The showfloor document: everything the room renders, in one join"
    )
    assert headings["US1"].priority == "P1"
    assert headings["US3"].title == "The stage: one graph, drawn inside its box"
    # The intent is the paragraph under the heading, verbatim words only.
    assert headings["US1"].intent.startswith("As the pane's backend, I assemble one")


def test_parse_story_headings_never_raises_on_arbitrary_text():
    """A parser that crashes the floor on bad input would fail constitution III."""
    for text in ("", "### User Story", "###User Story 1 - x (Priority: P1)", "\x00\n---\n"):
        assert parse_story_headings(text) == {}


def test_a_heading_off_the_grammar_contributes_nothing():
    """Three near-misses and one blank title: none of them is a heading."""
    text = "\n".join(
        [
            "### User Story 1 - Good one (Priority: P1)",
            "### User Story 2 — em dash instead of hyphen (Priority: P2)",
            "### User Story 3 - no priority at all",
            "### User Story 4 -    (Priority: P1)",
        ]
    )

    headings = parse_story_headings(text)

    assert sorted(headings) == ["US1"]
    assert headings["US1"].title == "Good one"


def test_spec_name_parses_and_falls_back(tmp_path):
    assert parse_spec_name((SPECS / "005-one-epic-on-stage" / "spec.md").read_text()) == (
        "One epic on stage"
    )
    assert parse_spec_name("no name here") is None


def test_a_story_whose_heading_cannot_be_parsed_falls_back_and_is_named(tmp_path):
    """FR-002: `story_key` stands in, and the miss lands in that spec's `unknown`.

    The malformed case is this repository's own committed spec with exactly one
    heading damaged — the em dash a copy-paste produces — so the well-formed and
    malformed inputs differ by one character and nothing else is invented.
    """
    original = (SPECS / ARCHIVED_SPEC / "spec.md").read_text()
    damaged = original.replace(
        "### User Story 3 - ", "### User Story 3 — ", 1
    )
    assert damaged != original

    spec_dir = tmp_path / ARCHIVED_SPEC
    spec_dir.mkdir()
    (spec_dir / "spec.md").write_text(damaged)

    document = assemble(specs_root=tmp_path)
    entry = entry_for(document, ARCHIVED_SPEC)

    stories = {story["story_key"]: story for story in entry["stories"]}
    assert stories["US3"]["title"] == "US3"
    assert stories["US3"]["priority"] is None
    assert entry["unknown"] == ["US3 title"]

    # Degraded, never crashed: every other story kept the heading's own words.
    assert stories["US1"]["title"] == "The declared gates exist and pass"
    assert stories["US4"]["title"] == "The Desk renders the floor, read-only"


# --------------------------------------------------------------------------
# FR-003: the ladder table
# --------------------------------------------------------------------------

#: DESIGN.md § The status ladder, transcribed: the stop each of ergane's eleven
#: `NodeState` members lands on.  `None` is the frozen ladder, which occupies no
#: stop at all.
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
    """Eleven states, no more and no fewer — read off ergane's own enum.

    If ergane grows a twelfth state this test fails here rather than letting the
    pane silently render it as nothing.
    """
    assert set(DESIGN_TABLE) == {member.name for member in NodeState}
    assert len(DESIGN_TABLE) == 11


@pytest.mark.parametrize("state", sorted(DESIGN_TABLE))
def test_every_node_state_lands_on_its_design_md_stop(state):
    ladder = derive_ladder(state, False, None, "ready")

    assert ladder["stop"] == DESIGN_TABLE[state]
    assert ladder["state"] == state
    assert [stop["key"] for stop in ladder["stops"]] == list(STOP_KEYS)
    assert len(ladder["stops"]) == 6


def test_the_six_stops_are_design_md_s_six_in_order():
    assert [label for _key, label in LADDER_STOPS] == [
        "ready",
        "building",
        "verifying",
        "pr open",
        "queue",
        "merged",
    ]


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


# --------------------------------------------------------------------------
# FR-001: the document over this repository's own specs
# --------------------------------------------------------------------------


def test_one_rail_entry_per_spec_directory_in_directory_order():
    document = assemble()

    on_disk = sorted(
        path.name for path in SPECS.iterdir() if (path / "spec.md").is_file()
    )
    assert [entry["spec_dir"] for entry in document["rail"]] == on_disk
    assert len(on_disk) >= 5


def test_each_rail_entry_carries_its_declared_state_and_story_count():
    document = assemble()

    states = {entry["spec_dir"]: entry["state"] for entry in document["rail"]}
    assert states["001-the-desk-sees-the-floor"] == "landed"
    assert states["005-one-epic-on-stage"] == "ready"
    assert states["006-the-desk-matches-the-stage"] == "draft"

    landed = entry_for(document, "001-the-desk-sees-the-floor")
    assert (landed["stories_landed"], landed["stories_total"]) == (4, 4)
    assert landed["chip"] == "landed"

    ready = entry_for(document, "005-one-epic-on-stage")
    assert ready["stories_landed"] == 0
    assert ready["stories_total"] == 4
    assert ready["chip"] == "ready"


def test_a_spec_with_no_frontmatter_reads_draft(tmp_path):
    """FR-001's parenthesis, and ergane's own roadmap grammar (`read_roadmap`)."""
    spec_dir = tmp_path / "900-no-frontmatter"
    spec_dir.mkdir()
    body = (SPECS / "005-one-epic-on-stage" / "spec.md").read_text().split("\n---\n", 1)[1]
    (spec_dir / "spec.md").write_text(body)

    entry = entry_for(assemble(specs_root=tmp_path), "900-no-frontmatter")

    assert entry["state"] == "draft"
    assert entry["chip"] == "draft"
    assert all(story["ladder"]["stop"] == "ready" for story in entry["stories"])


def test_stories_carry_identity_title_priority_and_requirement_keys():
    entry = entry_for(assemble(), ARCHIVED_SPEC)

    assert entry["story_source"] == "workgraph"
    assert [story["story_key"] for story in entry["stories"]] == ["US1", "US2", "US3", "US4"]
    assert [story["id"] for story in entry["stories"]] == ["us1", "us2", "us3", "us4"]

    us1 = entry["stories"][0]
    assert us1["title"] == "The declared gates exist and pass"
    assert us1["priority"] == "P1"
    # Copied from the compiled workgraph, not re-derived from the spec's prose.
    compiled = archive_workgraph(ARCHIVED_SPEC)
    for story, node in zip(entry["stories"], compiled["nodes"], strict=True):
        assert story["requirement_keys"] == node["requirement_keys"]
        assert story["depends_on"] == node["depends_on"]
        assert story["depends_on_merged"] == node["depends_on_merged"]
    assert us1["requirement_keys"][:2] == ["US1", "FR-001"]

    assert entry["unknown"] == []
    assert entry["notes"] == []


def test_every_story_carries_a_ladder_object():
    document = assemble()

    for entry in document["rail"]:
        assert entry["stories"], f"{entry['spec_dir']} rendered with no stories"
        for story in entry["stories"]:
            ladder = story["ladder"]
            assert [stop["key"] for stop in ladder["stops"]] == list(STOP_KEYS)
            assert set(ladder) >= {"stop", "stop_key", "tone", "chip", "frozen", "state"}


def test_landing_facts_come_from_the_live_answer():
    """FR-001's landing facts: attempt, pr_number, landing_state, verified."""
    recorded = json.loads(
        (
            FIXTURES
            / "epic-status"
            / "002-expense-notes"
            / "002-expense-notes-001-us1=ENQUEUED-ENQUEUED_us2=PENDING.json"
        ).read_text()
    )

    async def answer(spec_dir: str) -> dict | None:
        return recorded if spec_dir == ARCHIVED_SPEC else None

    entry = entry_for(
        assemble(readers=static_readers(epic_status=answer)), ARCHIVED_SPEC
    )

    us1 = entry["stories"][0]
    assert us1["facts"]["attempt"] == 1
    assert us1["facts"]["pr_number"] == 20
    assert us1["facts"]["landing_state"] == "ENQUEUED"
    assert us1["facts"]["verified"] is True
    assert us1["ladder"]["stop"] == "queue"

    us2 = entry["stories"][1]
    assert us2["ladder"]["stop"] == "ready"
    assert us2["facts"]["pr_number"] is None

    assert entry["epic_id"] == ARCHIVED_SPEC
    assert entry["epic_state"] == "RUNNING"
    assert entry["chip"] == "queue"


def test_a_partial_answer_names_the_fields_it_did_not_carry():
    """001's discipline: a field the factory did not record is unknown, not zero."""

    async def answer(spec_dir: str) -> dict | None:
        if spec_dir != ARCHIVED_SPEC:
            return None
        return {"epic_state": "RUNNING", "nodes": {"us1": {"state": "RUNNING"}}}

    entry = entry_for(
        assemble(readers=static_readers(epic_status=answer)), ARCHIVED_SPEC
    )

    us1 = entry["stories"][0]
    assert us1["ladder"]["stop"] == "building"
    assert us1["facts"]["attempt"] is None
    assert "attempt" in us1["unknown"]
    assert "pr_number" in us1["unknown"]
    assert "state" not in us1["unknown"]


def test_a_waiting_story_makes_the_whole_rail_row_wait():
    recorded = json.loads(
        (FIXTURES / "epic-status" / "question" / "waiting-operator.json").read_text()
    )

    async def answer(spec_dir: str) -> dict | None:
        return recorded if spec_dir == ARCHIVED_SPEC else None

    entry = entry_for(
        assemble(readers=static_readers(epic_status=answer)), ARCHIVED_SPEC
    )

    assert entry["chip"] == "waiting on you"
    assert entry["stories"][0]["ladder"]["tone"] == "waiting"


def test_a_killed_epic_freezes_every_one_of_its_ladders():
    recorded = json.loads((FIXTURES / "epic-status" / "killed" / "killed.json").read_text())

    async def answer(spec_dir: str) -> dict | None:
        return recorded if spec_dir == ARCHIVED_SPEC else None

    entry = entry_for(
        assemble(readers=static_readers(epic_status=answer)), ARCHIVED_SPEC
    )

    assert entry["chip"] == "killed"
    assert all(story["ladder"]["frozen"] for story in entry["stories"])
    assert all(story["ladder"]["chip"] == "killed" for story in entry["stories"])


# --------------------------------------------------------------------------
# FR-004: the two 052 fault shapes
# --------------------------------------------------------------------------


def test_a_refused_epic_status_renders_the_entry_with_a_refusal_note():
    refusal = recorded_refusal()

    async def answer(spec_dir: str) -> dict | None:
        if spec_dir == ARCHIVED_SPEC:
            raise refusal
        return None

    document = assemble(readers=static_readers(epic_status=answer))
    entry = entry_for(document, ARCHIVED_SPEC)

    assert entry["notes"] == [
        {"read": "epic_status", "mode": "refusal", "detail": refusal.detail}
    ]
    # Still rendered, and static: the graph is the structural truth even when
    # nothing live can be learned.
    assert len(entry["stories"]) == 4
    assert entry["stories"][0]["requirement_keys"][0] == "US1"
    assert all(story["ladder"]["state"] is None for story in entry["stories"])

    # And every healthy spec is untouched.
    healthy = entry_for(document, "005-one-epic-on-stage")
    assert not [note for note in healthy["notes"] if note["read"] == "epic_status"]


def test_an_unreachable_epic_status_renders_the_entry_with_a_transport_note():
    failure = recorded_transport_failure()

    async def answer(spec_dir: str) -> dict | None:
        if spec_dir == ARCHIVED_SPEC:
            raise failure
        return None

    entry = entry_for(
        assemble(readers=static_readers(epic_status=answer)), ARCHIVED_SPEC
    )

    assert entry["notes"] == [
        {"read": "epic_status", "mode": "transport", "detail": failure.detail}
    ]
    assert len(entry["stories"]) == 4


def test_a_story_the_answer_did_not_name_says_so(tmp_path):
    """002's skew shape: the graph declares a node the answer never mentions."""

    async def answer(spec_dir: str) -> dict | None:
        if spec_dir != ARCHIVED_SPEC:
            return None
        return {"epic_state": "RUNNING", "nodes": {"us1": {"state": "RUNNING", "attempt": 2}}}

    entry = entry_for(assemble(readers=static_readers(epic_status=answer)), ARCHIVED_SPEC)

    us4 = entry["stories"][3]
    assert us4["facts"]["state"] is None
    assert "state" in us4["unknown"]
    assert us4["ladder"]["stop"] == "ready"
    # No chip: the spec is attested `landed`, but a running epic is the newer
    # source and it said nothing about this node.
    assert us4["ladder"]["chip"] is None


def test_stories_stay_static_when_the_live_state_cannot_be_read():
    """FR-004: the entry renders, and its stories rest where the spec declares.

    A `ready` spec whose live read failed rests at `ready` — the pane shows what
    it can still stand behind, and never a stop it did not observe.  A spec the
    operator attested `landed` keeps its six-done ladders for the same reason:
    the attestation is a fact the failed read did not take away.
    """
    failure = recorded_transport_failure()

    async def answer(spec_dir: str) -> dict | None:
        raise failure

    document = assemble(readers=static_readers(epic_status=answer))

    ready = entry_for(document, "005-one-epic-on-stage")
    assert [note["mode"] for note in ready["notes"] if note["read"] == "epic_status"] == [
        "transport"
    ]
    for story in ready["stories"]:
        assert story["ladder"]["stop"] == "ready"
        assert story["ladder"]["state"] is None
        assert story["facts"]["attempt"] is None

    landed = entry_for(document, ARCHIVED_SPEC)
    assert all(story["ladder"]["stop"] == "merged" for story in landed["stories"])
    assert landed["chip"] == "landed"


def test_transport_and_refusal_are_distinguished_in_mode_not_only_in_prose():
    """The 052 doctrine's whole point: two modes, told apart by a field."""
    refusal = recorded_refusal()
    failure = recorded_transport_failure()

    async def answer(spec_dir: str) -> dict | None:
        if spec_dir == ARCHIVED_SPEC:
            raise refusal
        if spec_dir == "005-one-epic-on-stage":
            raise failure
        return None

    document = assemble(readers=static_readers(epic_status=answer))

    modes = {
        note["spec_dir"]: note["mode"]
        for note in document["degraded"]
        if note["read"] == "epic_status"
    }
    assert modes[ARCHIVED_SPEC] == "refusal"
    assert modes["005-one-epic-on-stage"] == "transport"
    assert modes[ARCHIVED_SPEC] != modes["005-one-epic-on-stage"]


def test_a_spec_with_no_compiled_workgraph_is_an_entry_with_a_note():
    """The spec's Edge Cases: a degraded note, not a crash and not an omission."""
    document = assemble()
    entry = entry_for(document, "005-one-epic-on-stage")

    assert [note["read"] for note in entry["notes"]] == ["workgraph"]
    assert entry["notes"][0]["mode"] == "transport"
    assert entry["story_source"] == "headings"
    # Rendered, with the stories the spec's own headings declare, and honest
    # about the one thing only the compiled graph knows.
    assert [story["story_key"] for story in entry["stories"]] == ["US1", "US2", "US3", "US4"]
    assert entry["stories"][0]["title"].startswith("The showfloor document")
    assert all(story["requirement_keys"] == [] for story in entry["stories"])

    healthy = entry_for(document, ARCHIVED_SPEC)
    assert healthy["notes"] == []


def test_an_unparseable_workgraph_is_told_apart_from_a_missing_one():
    truncated = (DAGS / f"{ARCHIVED_SPEC}.json").read_text()[:120]

    def workgraph(spec_dir: str) -> dict:
        if spec_dir == ARCHIVED_SPEC:
            return json.loads(truncated)
        return archive_workgraph(spec_dir)

    document = assemble(readers=static_readers(workgraph=workgraph))
    entry = entry_for(document, ARCHIVED_SPEC)

    assert [note["read"] for note in entry["notes"]] == ["workgraph"]
    assert entry["notes"][0]["mode"] == "unparseable"
    assert entry["notes"][0]["mode"] != "transport"
    assert len(entry["stories"]) == 4


def test_a_floor_that_cannot_be_read_names_itself_on_every_spec():
    """"No epic is running" and "I could not ask" are different sentences."""
    reader = FixtureReader(FIXTURES, transport_fail=frozenset({"floor"}))
    readers = ShowfloorReaders.from_reader(reader, SPECS, archive_root=DAGS)

    document = asyncio.run(assemble_showfloor(SPECS, readers))

    for entry in document["rail"]:
        floor_notes = [note for note in entry["notes"] if note["read"] == "collect_floor"]
        assert len(floor_notes) == 1, f"{entry['spec_dir']} did not name the dead floor"
        assert floor_notes[0]["mode"] == "transport"
        assert entry["epic_id"] is None
        assert entry["stories"], "a dead floor must not empty the rail"


def test_the_document_level_degraded_list_names_the_spec_each_note_came_from():
    refusal = recorded_refusal()

    async def answer(spec_dir: str) -> dict | None:
        if spec_dir == ARCHIVED_SPEC:
            raise refusal
        return None

    document = assemble(readers=static_readers(epic_status=answer))

    assert {"spec_dir", "read", "mode", "detail"} <= set(document["degraded"][0])
    assert any(
        note["spec_dir"] == ARCHIVED_SPEC and note["read"] == "epic_status"
        for note in document["degraded"]
    )


# --------------------------------------------------------------------------
# T005: the route
# --------------------------------------------------------------------------


@pytest.fixture
def demo_app(tmp_path, monkeypatch, credentials):
    monkeypatch.chdir(tmp_path)
    for key in list(os.environ):
        if key.startswith(("ERGANE_", "FACTORY_", "TEMPORAL_")):
            monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("PANE_DEMO", "1")
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(FIXTURES))
    monkeypatch.setenv("PANE_SPECS_ROOT", str(SPECS))
    return create_app(Settings.from_env())


def test_api_showfloor_serves_the_document(demo_app, auth_headers):
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
    unauthenticated = TestClient(demo_app)

    assert unauthenticated.get("/api/showfloor").status_code == 401
    assert unauthenticated.get("/api/showfloor", headers={"Authorization": "Bearer no"}).status_code == 401
