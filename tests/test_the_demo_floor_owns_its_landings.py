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
import os
import re
import shutil
from pathlib import Path

import pytest
import spawnwatch
from corpus import SpecFixture, build_landed_repository
from fastapi.testclient import TestClient

from pane.app import create_app
from pane.config import Settings
from pane.fixture_floor import FixtureReader
from pane.landing import CHANGED_FILES_READ, LANDING_READ, LandingFact, read_changed_files
from pane.readers import LiveReader, QueryRefused, TransportFailed, recorded_git_reads
from pane.review import ReviewReaders
from pane.showfloor import ShowfloorReaders

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


# --- the demo floor itself, over a corpus the test built --------------------


def record_document(path: Path, payload: object, *, seam: str, source: str) -> None:
    """Write one scratch recording and the envelope every recording carries.

    The envelope names the test as the source, because a scratch document that
    claimed the committed one's provenance would be exactly the lie the sidecar
    exists to prevent (spec 001 FR-009).
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    path.with_name(f"{path.stem}.envelope.json").write_text(
        json.dumps(
            {
                "captured_at": "2026-08-26T18:44:00Z",
                "seam": seam,
                "source": source,
                "notes": "Recorded by tests/test_the_demo_floor_owns_its_landings.py "
                "through the live seam, never hand-composed.",
            },
            indent=2,
        ),
        encoding="utf-8",
    )


def record_landing(root: Path, facts_by_spec: dict[str, dict[str, LandingFact]]) -> None:
    """Write a scratch floor's landing recording, in the live read's own shape.

    The facts are *read* from a repository the test built, through the same seam
    `scripts/record-fixtures.py` would use for the committed one — so a scratch
    floor is a recording and not a shape invented to make an assertion pass
    (constitution V).  The envelope says so, because a document that claimed the
    committed one's provenance would be the lie the envelope exists to prevent.
    """
    record_document(
        root / "landing" / "landing-facts.json",
        {
            spec_dir: {key: dataclasses.asdict(fact) for key, fact in facts.items()}
            for spec_dir, facts in facts_by_spec.items()
        },
        seam="pane.landing.read_landing_facts over factory.workgraph.landed.landed_facts",
        source="a repository this test built under its own tmp_path",
    )


@pytest.fixture
def demo_floor(landed, tmp_path, monkeypatch, credentials):
    """A demo floor whose recording holds the landings `landed`'s branch carries.

    The corpus is a real git repository with real landing commits, and the
    recording is those same landings read through the live seam — so the two
    sources *agree* at the start of a test, and the test can then take the git
    history away and ask whether the answer moved (FR-003).
    """
    monkeypatch.chdir(tmp_path)
    for key in list(os.environ):
        if key.startswith(("ERGANE_", "FACTORY_", "TEMPORAL_")):
            monkeypatch.delenv(key, raising=False)

    root = scratch_floor(tmp_path)
    record_landing(root, {SPEC: landed.landing_facts(SPEC)})

    for name, value in {
        "PANE_DEMO": "1",
        "PANE_FIXTURES_ROOT": str(root),
        "PANE_SPECS_ROOT": str(landed.specs_root),
        "PANE_ATTENTION_DB": str(tmp_path / "attention.db"),
    }.items():
        monkeypatch.setenv(name, value)

    return create_app(Settings.from_env())


def rooms(client: TestClient) -> dict[str, dict]:
    """What the three rooms answer, as documents, for one client."""
    return {
        path: client.get(path).json()
        for path in ("/api/floor", "/api/showfloor", f"/api/review/{SPEC}")
    }


# --- T005, FR-002: proven at the spawn point -------------------------------


def test_no_room_spawns_a_subprocess_in_demo_mode(demo_floor, auth_headers, monkeypatch):
    """Plan D4: intercept the spawn, do not admire the answer.

    Both halves are asserted at once.  The audit hook sees every
    `subprocess.Popen` in the process, whatever composed the command line — and
    the two ergane surfaces the live read rides are replaced with functions that
    refuse, so reaching either is a failure with a name on it rather than a
    subprocess this hook then has to notice.
    """
    import factory.workgraph.landed
    import factory.workgraph.worktree

    def refuse(*args, **kwargs):
        raise AssertionError("demo mode reached the live git-backed read")

    monkeypatch.setattr(factory.workgraph.landed, "landed_facts", refuse)
    monkeypatch.setattr(factory.workgraph.worktree, "_git", refuse)

    client = TestClient(demo_floor, headers=auth_headers)
    with spawnwatch.watching() as spawned:
        answers = rooms(client)

    assert [str(spawn) for spawn in spawned if spawn.is_git] == []
    assert [str(spawn) for spawn in spawned] == []
    assert spawnwatch.errors() == []
    assert all(answer for answer in answers.values())


def test_the_landing_read_itself_spawns_nothing_in_demo_mode(demo_floor):
    """The read on its own, without a room around it (FR-002)."""
    reader = FixtureReader(Path(demo_floor.state.settings.fixtures_root))

    with spawnwatch.watching() as spawned:
        facts = reader.landing_facts(SPEC)

    assert sorted(facts) == STORIES
    assert [str(spawn) for spawn in spawned] == []


def test_the_watcher_sees_a_spawn_when_one_happens(landed):
    """A watcher that never fires would pass every test above for nothing."""
    with spawnwatch.watching() as spawned:
        landed.landing_facts(SPEC)

    assert [spawn for spawn in spawned if spawn.is_git] != []
    assert spawnwatch.errors() == []


# --- T006, FR-003, SC-001: no git history at all ---------------------------


def test_every_room_answers_the_same_in_a_directory_that_is_not_a_repository(
    demo_floor, landed, auth_headers
):
    """SC-001, and the property `CLAUDE.md` already claimed for every gate.

    The checkout is destroyed between the two reads — not shallowed, removed:
    after `.git` goes, `specs/` sits in a plain directory, which is what a runner
    handed the review room on the night this spec was written.  Every room must
    answer exactly what it answered while the branch was there.
    """
    client = TestClient(demo_floor, headers=auth_headers)

    with_history = rooms(client)
    shutil.rmtree(landed.repo / ".git")
    assert not (landed.repo / ".git").exists()
    without_history = rooms(client)

    assert without_history == with_history


def test_the_rooms_answer_from_the_recording_and_not_from_the_branch(
    demo_floor, landed, auth_headers
):
    """A demo room that agreed with the branch by accident would prove nothing.

    So the branch is made to disagree: `.git` goes, and the landings the rooms
    render are still the recording's — the showfloor's landing SHAs and the
    review room's document both, and the review room does not refuse the epic it
    can no longer see on any branch (011 FR-004, the refusal this spec exists to
    stop mis-firing).
    """
    client = TestClient(demo_floor, headers=auth_headers)
    shutil.rmtree(landed.repo / ".git")

    recorded = FixtureReader(Path(demo_floor.state.settings.fixtures_root)).landing_facts(SPEC)

    review = client.get(f"/api/review/{SPEC}")
    assert review.status_code == 200
    assert {story["story_key"]: story["commit"] for story in review.json()["stories"]} == {
        key: fact.commit for key, fact in recorded.items()
    }

    entry = next(
        entry
        for entry in client.get("/api/showfloor").json()["rail"]
        if entry["spec_dir"] == SPEC
    )
    assert {story["story_key"]: story["facts"]["landing_sha"] for story in entry["stories"]} == {
        key: fact.commit for key, fact in recorded.items()
    }


def test_a_spec_the_recording_does_not_name_degrades_in_the_room_and_is_not_refused(
    demo_floor, landed, auth_headers
):
    """SC-003: named on screen, never rendered as an epic that did not land.

    The spec the recording holds nothing for is the case that cost 011 its
    ladder.  The review room must render, name the read it could not make, and
    **not** refuse the epic — a refusal is a claim about the branch, and nobody
    read one.
    """
    client = TestClient(demo_floor, headers=auth_headers)
    unrecorded = "918-a-spec-the-recording-misses"
    shutil.copytree(landed.specs_root / SPEC, landed.specs_root / unrecorded)

    response = client.get(f"/api/review/{unrecorded}")

    assert response.status_code == 200
    document = response.json()
    landing_note = next(note for note in document["notes"] if note["read"] == LANDING_READ)
    assert unrecorded in landing_note["detail"]
    assert landing_note["mode"] == "transport"
    assert document["stories"], "the room rendered no stories at all"
    assert all(story["commit"] is None for story in document["stories"])


# --- T009, FR-004: the live read is exactly what it was --------------------


@pytest.fixture
def live_app(landed, tmp_path, monkeypatch, credentials):
    """The same corpus with no demo floor behind it: `PANE_DEMO` unset."""
    monkeypatch.chdir(tmp_path)
    for key in list(os.environ):
        if key.startswith(("ERGANE_", "FACTORY_", "TEMPORAL_")):
            monkeypatch.delenv(key, raising=False)
    monkeypatch.delenv("PANE_DEMO", raising=False)
    monkeypatch.setenv("PANE_SPECS_ROOT", str(landed.specs_root))
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    return create_app(Settings.from_env())


def test_a_reader_with_no_recording_is_bound_to_the_live_read(landed):
    """The binding's own answer, before any room asks it anything."""
    reader = LiveReader(landed.specs_root)

    assert recorded_git_reads(reader) is None

    readers = ShowfloorReaders.from_reader(reader, landed.specs_root, landing_branch="dev")
    assert {key: fact.commit for key, fact in readers.landing_facts(SPEC).items()} == {
        key: fact.commit for key, fact in landed.landing_facts(SPEC).items()
    }


def test_the_live_room_still_reads_the_branch_and_spawns_git(live_app, landed, auth_headers):
    """FR-004: the operator's own pane, over a real checkout, is untouched.

    Both live reads are asserted — the landings are the branch's commits, and
    each story carries the file list its commit changed, which only a git-backed
    read can supply.  The spawn the demo rooms must not make is the spawn this
    one must.
    """
    client = TestClient(live_app, headers=auth_headers)

    with spawnwatch.watching() as spawned:
        response = client.get(f"/api/review/{SPEC}")

    assert response.status_code == 200
    document = response.json()
    assert {story["story_key"]: story["commit"] for story in document["stories"]} == {
        key: fact.commit for key, fact in landed.landing_facts(SPEC).items()
    }
    assert all(story["files"] for story in document["stories"])
    assert [spawn for spawn in spawned if spawn.is_git] != []


def test_the_live_read_never_falls_back_to_a_recording(landed, tmp_path):
    """The Named trap: a demo-shaped read reaching live mode would replace real
    landings with a months-old recording, silently.  It cannot: a checkout the
    live read cannot walk is a degraded read, in words, and never the fixture.
    """
    shutil.rmtree(landed.repo / ".git")
    readers = ReviewReaders.from_reader(
        LiveReader(landed.specs_root), landed.specs_root, landing_branch="dev"
    )

    with pytest.raises((TransportFailed, QueryRefused)) as raised:
        readers.landing_facts(SPEC)

    assert raised.value.read == LANDING_READ


def test_a_recorded_change_list_puts_the_review_room_s_file_rows_back(
    demo_floor, landed, auth_headers
):
    """The missing change list is a gap in the recording, not one in the code.

    `changed_files` comes back naming the document it wanted because nothing is
    recorded for it yet, and this repository will not hand-write one
    (constitution V, `fixtures/README.md`).  So the test records one the way
    `scripts/record-fixtures.py changed-files` does — through the live seam, over
    a repository it built — puts it on the demo floor, and takes the branch away:
    the rows come back, from the recording, with no source touched.
    """
    root = Path(demo_floor.state.settings.fixtures_root)
    for fact in FixtureReader(root).landing_facts(SPEC).values():
        recorded = read_changed_files(landed.repo, fact.commit)
        assert recorded, "the constructed landing changed nothing"
        record_document(
            root / "changed-files" / f"{fact.commit}.json",
            recorded,
            seam="pane.landing.read_changed_files over factory.workgraph.worktree._git",
            source=f"the repository this test built, commit {fact.commit}",
        )

    shutil.rmtree(landed.repo / ".git")
    client = TestClient(demo_floor, headers=auth_headers)
    document = client.get(f"/api/review/{SPEC}").json()

    assert all(story["files"] for story in document["stories"])
    assert all(story["notes"] == [] for story in document["stories"])
