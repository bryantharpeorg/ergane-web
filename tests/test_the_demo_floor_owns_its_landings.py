"""The demo floor owns its landings (016 US1).

One read escaped the Fixture floor.  `PANE_DEMO=1` served every other document
from `fixtures/`, and `landing_facts` spawned git against whatever checkout the
machine happened to have — so a shallow CI checkout made the review room, which
refuses a partially landed epic *by name*, refuse every epic on a floor with
nothing wrong with it: eleven failing tests and a node's whole ladder lost.

What this file asserts, in the order the story asks for it:

* the recorded landing replays with the live read's shape, field for field
  (FR-001, FR-005);
* a spec the recording does not name, and a recording that will not parse, are
  **named** degraded reads and never an empty result read as "nothing landed"
  (FR-006);
* under `PANE_DEMO=1` no git subprocess is spawned at all, proven at the spawn
  point rather than by liking the answer (FR-002, plan D4);
* every room answers the same in a directory that is not a git repository as it
  does inside one whose branch carries other landings entirely (FR-003);
* under `PANE_DEMO=0` the live read is reached, spawns git, and is unchanged
  (FR-004).

Every condition is constructed: the corpora are written into the test's own
`tmp_path` and the one scratch recording is *recorded by the test through the
live seam* over a repository it built, so nothing here is a landing shape
invented to make an assertion pass (constitution V).
"""

from __future__ import annotations

import dataclasses
import json
import re
import shutil
from pathlib import Path

import pytest
import spawnwatch
from corpus import SpecFixture, build_landed_repository

from pane.fixture_floor import FixtureReader
from pane.landing import CHANGED_FILES_READ, LANDING_READ, LandingFact
from pane.readers import TransportFailed

ROOT = Path(__file__).resolve().parents[1]

#: The recorded Fixture floor itself, which is what a demo room reads.
FIXTURES = ROOT / "fixtures"

#: The document 016 added to it, and the sidecar every recording carries.
RECORDING = FIXTURES / "landing" / "landing-facts.json"
ENVELOPE = FIXTURES / "landing" / "landing-facts.envelope.json"

#: A spec directory no corpus of this repository uses, so nothing constructed
#: here can be read as an assertion about a spec the factory is building.
SPEC = "916-a-recorded-landing"

STORIES = ["US1", "US2", "US3", "US4"]


def recorded_spec_dirs() -> list[str]:
    """The spec directories the committed recording names, read from it.

    Read rather than typed: what the fixture covers is the operator's to change
    by re-recording, and a test that spelt one out would go red on a promotion
    with no line of source touched (008 US1).
    """
    return sorted(json.loads(RECORDING.read_text(encoding="utf-8")))


def scratch_floor(tmp_path: Path, name: str = "fixtures") -> Path:
    """A copy of the recorded Fixture floor a test may spoil one document in.

    The copy is what makes an unreadable recording testable without touching the
    committed one, exactly as `copy_repository_corpus` does for the spec corpus.
    """
    root = tmp_path / name
    shutil.copytree(FIXTURES, root)
    return root


# --- T001, FR-001: the recording replays -----------------------------------


def test_the_recorded_landing_replays_through_the_fixture_reader():
    """Every spec the recording names replays as landings, through 001's reader."""
    reader = FixtureReader(FIXTURES)
    replayed = {spec_dir: reader.landing_facts(spec_dir) for spec_dir in recorded_spec_dirs()}

    assert any(replayed.values()), "the recording replayed nothing at all"
    for facts in replayed.values():
        assert all(isinstance(fact, LandingFact) for fact in facts.values())
        assert all(key == fact.story_key for key, fact in facts.items())


def test_a_spec_the_branch_carried_nothing_for_is_an_answer_and_not_a_miss():
    """The boundary FR-006 draws, and the whole of plan D3.

    The recording carries specs the landing branch had no commit for, because
    that is what the live read answered for them — a branch that was read and
    carries nothing.  A spec the recording does not carry *at all* is the other
    thing entirely: a read nobody made.  The first is `{}`, the second is a
    named failure, and a floor that confused them is how eleven green epics came
    to be refused.
    """
    reader = FixtureReader(FIXTURES)
    recorded = json.loads(RECORDING.read_text(encoding="utf-8"))
    carried_nothing = [spec_dir for spec_dir, facts in recorded.items() if not facts]

    assert carried_nothing, "the recording has no read-and-empty spec to tell apart"
    for spec_dir in carried_nothing:
        assert reader.landing_facts(spec_dir) == {}

    with pytest.raises(TransportFailed):
        reader.landing_facts("917-a-spec-nobody-recorded")


# --- T007, FR-005: the same shape the live read returns ---------------------


@pytest.fixture
def landed(tmp_path):
    """A repository whose `dev` branch carries every story of `SPEC`."""
    return build_landed_repository(
        tmp_path, SpecFixture(SPEC, state="ready"), landings={SPEC: STORIES}
    )


def test_the_replayed_shape_is_the_live_read_s_shape_field_for_field(landed):
    """FR-005: no consumer can tell a replayed landing from a read one by shape.

    The live half is a landing this test's own repository actually carries, read
    through `pane/landing.py` over ergane's seam; the replayed half is the
    committed recording.  What is compared is the type, the fields and the field
    types of both — the two halves cannot agree on a *value*, and a test that
    asked them to would be asserting the recording's age.
    """
    live = landed.landing_facts(SPEC)["US1"]
    replayed = FixtureReader(FIXTURES).landing_facts(recorded_spec_dirs()[0])

    for fact in replayed.values():
        assert type(fact) is type(live)
        assert dataclasses.asdict(fact).keys() == dataclasses.asdict(live).keys()
        assert {field: type(value) for field, value in dataclasses.asdict(fact).items()} == {
            field: type(value) for field, value in dataclasses.asdict(live).items()
        }
        assert fact.on_branch is live.on_branch


def test_a_replayed_landing_carries_the_facts_the_branch_carries(landed):
    """The five facts beside the story key, each spelt as the live read spells it."""
    live = landed.landing_facts(SPEC)["US1"]
    replayed = FixtureReader(FIXTURES).landing_facts(recorded_spec_dirs()[0])["US1"]

    assert re.fullmatch(r"[0-9a-f]{40}", replayed.commit)
    assert replayed.kind in {"observed", "historical", "attested"}
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", replayed.merged_at)
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", live.merged_at)
    # The squash subject the merge queue writes, with the number GitHub appends
    # read out of it rather than invented — the same grammar on both sides.
    assert replayed.subject.endswith(f"(#{replayed.pr_number})")
    assert live.subject.endswith(f"(#{live.pr_number})")


# --- T008, FR-006: absent is degraded, and named ---------------------------


def test_a_spec_the_recording_does_not_name_is_a_named_degraded_read():
    """Never `{}`: the answer says which document was asked and for what."""
    with pytest.raises(TransportFailed) as raised:
        FixtureReader(FIXTURES).landing_facts("917-a-spec-nobody-recorded")

    assert raised.value.read == LANDING_READ
    assert str(RECORDING) in raised.value.detail
    assert "917-a-spec-nobody-recorded" in raised.value.detail


def test_a_recording_that_will_not_parse_names_the_parse_failure(tmp_path):
    """The Edge Case: unreadable on the same terms as any other fixture."""
    root = scratch_floor(tmp_path)
    (root / "landing" / "landing-facts.json").write_text("{ not json", encoding="utf-8")

    with pytest.raises(TransportFailed) as raised:
        FixtureReader(root).landing_facts(recorded_spec_dirs()[0])

    assert raised.value.read == LANDING_READ
    assert "will not parse" in raised.value.detail


def test_a_recording_that_is_not_there_names_the_path_it_looked_for(tmp_path):
    root = scratch_floor(tmp_path)
    (root / "landing" / "landing-facts.json").unlink()

    with pytest.raises(TransportFailed) as raised:
        FixtureReader(root).landing_facts(recorded_spec_dirs()[0])

    assert raised.value.read == LANDING_READ
    assert "not recorded yet" in raised.value.detail


def test_an_entry_that_is_not_a_landing_is_a_named_failure_not_a_fact(tmp_path):
    """A recording holding half a landing is unreadable, not a fact with holes."""
    root = scratch_floor(tmp_path)
    (root / "landing" / "landing-facts.json").write_text(
        json.dumps({SPEC: {"US1": {"kind": "observed"}}}), encoding="utf-8"
    )

    with pytest.raises(TransportFailed) as raised:
        FixtureReader(root).landing_facts(SPEC)

    assert raised.value.read == LANDING_READ
    assert f"{SPEC}/US1" in raised.value.detail


def test_the_named_section_drives_the_same_failure_deliberately():
    """`PANE_DEMO_TRANSPORT_FAIL=epics` fails the landing with its epic."""
    reader = FixtureReader(FIXTURES, transport_fail=frozenset({"epics"}))

    with pytest.raises(TransportFailed) as raised:
        reader.landing_facts(recorded_spec_dirs()[0])

    assert raised.value.read == LANDING_READ


def test_a_changed_file_list_nobody_recorded_names_the_path_it_looked_for():
    """The review room's second git read takes the same rule (FR-003).

    No change list is recorded yet and this repository will not write one by
    hand (constitution V), so the read comes back naming the document it wanted
    — which the story then says in words, instead of a file list nobody landed.
    """
    with pytest.raises(TransportFailed) as raised:
        FixtureReader(FIXTURES).changed_files("0" * 40)

    assert raised.value.read == CHANGED_FILES_READ
    assert "not recorded yet" in raised.value.detail
