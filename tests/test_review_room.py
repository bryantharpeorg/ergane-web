"""The review room's first track: what an epic changed (011 US1).

Every condition here is **constructed** — a git repository this test writes
under its own `tmp_path`, with one commit per landing in the merge queue's own
subject grammar (`tests/corpus.py`).  Nothing reads this repository's branch,
this morning's spec states or the archive of derived graphs, because a review
room asserted over the live corpus would go red the day an epic lands with no
line of source touched (008 US1, `tests/test_no_test_pins_live_corpus.py`).

The four things asserted, in the order the story asks for them:

* a landed epic renders story by story with the SHA, the PR number and the
  squash subject the branch carries (FR-001), and the file list each of those
  commits changed (FR-002);
* every changed file names the routes it reaches, and one that matches no
  pattern reads as reaching no known route rather than vanishing (FR-003);
* an epic with an unmerged story is refused *by name* (FR-004);
* the route answers 401 without the token (FR-006).

A landing read that **failed** is the case kept separate from all of them: not
knowing whether a story merged is a degraded read, named as one, and never a
story reported unmerged on the strength of a read nobody made (constitution III).
"""

from __future__ import annotations

import dataclasses
import json

import pytest
from corpus import SpecFixture, build_landed_repository, landing_subject
from fastapi.testclient import TestClient

from pane.app import create_app
from pane.auth import REFUSAL_BODY
from pane.config import Settings
from pane.landing import CHANGED_FILES_READ, read_changed_files
from pane.readers import QueryRefused, TransportFailed
from pane.review import EpicNotLanded, SpecNotFound, assemble_review

#: The spec every constructed corpus in this file is built around.  A directory
#: number no corpus of this repository uses, so nothing here can be read as an
#: assertion about a spec the factory is actually building.
SPEC = "912-a-landed-epic"

#: The four stories the recorded body carries, and files with real route
#: mappings for two of them — so the resolution asserted below is the committed
#: manifest's own answer and not a fixture's idea of one.
TOUCHED = {
    f"{SPEC}:US1": ["pane/showfloor.py", "web/src/showfloor/Stage.tsx"],
    f"{SPEC}:US2": ["web/src/desk/Desk.tsx", "docs/decisions.md"],
    f"{SPEC}:US3": ["pane/a_module_no_pattern_names.py"],
    f"{SPEC}:US4": ["web/src/api/answer.ts"],
}

STORIES = ["US1", "US2", "US3", "US4"]


@pytest.fixture
def landed(tmp_path):
    """A repository whose branch carries every story of `SPEC`."""
    return build_landed_repository(
        tmp_path,
        SpecFixture(SPEC, state="ready"),
        landings={SPEC: STORIES},
        files_by_story=TOUCHED,
    )


@pytest.fixture
def half_landed(tmp_path):
    """The same epic with two of its four stories still unmerged."""
    return build_landed_repository(
        tmp_path,
        SpecFixture(SPEC, state="ready"),
        landings={SPEC: ["US1", "US2"]},
        files_by_story=TOUCHED,
    )


def story_of(document: dict, story_key: str) -> dict:
    return next(story for story in document["stories"] if story["story_key"] == story_key)


# --- T003: the changed-file read, over ergane's own git helper -------------


def test_a_commit_names_the_files_it_changed(landed):
    facts = landed.landing_facts(SPEC)
    changed = read_changed_files(landed.repo, facts["US1"].commit)
    assert changed == sorted(TOUCHED[f"{SPEC}:US1"])


def test_an_unknown_revision_is_a_refusal_and_not_an_empty_change(landed):
    """The Unknown Rule's shape: git ran and declined, so the read is refused."""
    with pytest.raises(QueryRefused) as raised:
        read_changed_files(landed.repo, "0" * 40)
    assert raised.value.read == CHANGED_FILES_READ


def test_a_repository_that_is_not_there_is_a_transport_failure(tmp_path):
    with pytest.raises(TransportFailed) as raised:
        read_changed_files(tmp_path / "nothing", "HEAD")
    assert raised.value.read == CHANGED_FILES_READ


# --- FR-001, FR-002: the branch answers for every story --------------------


def test_every_story_renders_with_its_sha_pr_and_squash_subject(landed):
    document = assemble_review(landed.specs_root, SPEC, landed.review_readers())

    assert [story["story_key"] for story in document["stories"]] == STORIES
    facts = landed.landing_facts(SPEC)
    for index, story_key in enumerate(STORIES):
        story = story_of(document, story_key)
        assert story["commit"] == facts[story_key].commit
        assert story["short_commit"] == facts[story_key].commit[:12]
        assert story["pr_number"] == 41 + index
        assert story["subject"] == landing_subject(SPEC, story_key, 41 + index)
        assert story["merged_at"] is not None
        assert story["unknown"] == []


def test_every_story_carries_the_file_list_its_commit_changed(landed):
    document = assemble_review(landed.specs_root, SPEC, landed.review_readers())
    for story_key, expected in ((key.split(":")[1], value) for key, value in TOUCHED.items()):
        story = story_of(document, story_key)
        assert [entry["path"] for entry in story["files"]] == sorted(expected)


def test_the_stories_carry_the_titles_the_spec_declares(landed):
    document = assemble_review(landed.specs_root, SPEC, landed.review_readers())
    headings = landed.headings(SPEC)
    for story in document["stories"]:
        assert story["title"] == headings[story["story_key"]].title
        assert story["priority"] == headings[story["story_key"]].priority


# --- FR-003: each file names the routes it reaches -------------------------


def test_each_changed_file_names_the_routes_it_reaches(landed):
    document = assemble_review(landed.specs_root, SPEC, landed.review_readers())
    files = {entry["path"]: entry for entry in story_of(document, "US1")["files"]}

    assert files["pane/showfloor.py"]["routes"] == [
        "/", "/desk", "/showfloor", "/api/showfloor", "/api/events",
    ]
    assert files["web/src/showfloor/Stage.tsx"]["routes"] == ["/showfloor"]


def test_a_file_matching_no_pattern_reaches_no_known_route_and_is_kept(landed):
    document = assemble_review(landed.specs_root, SPEC, landed.review_readers())
    files = story_of(document, "US3")["files"]

    assert [entry["path"] for entry in files] == ["pane/a_module_no_pattern_names.py"]
    assert files[0]["routes"] == []
    assert files[0]["matched"] is False


def test_a_file_the_manifest_maps_to_nothing_is_kept_and_told_apart(landed):
    document = assemble_review(landed.specs_root, SPEC, landed.review_readers())
    files = {entry["path"]: entry for entry in story_of(document, "US2")["files"]}

    assert files["docs/decisions.md"]["routes"] == []
    assert files["docs/decisions.md"]["matched"] is True


def test_a_story_names_the_routes_its_whole_change_reaches(landed):
    document = assemble_review(landed.specs_root, SPEC, landed.review_readers())
    assert story_of(document, "US2")["routes"] == ["/", "/desk"]
    assert story_of(document, "US3")["routes"] == []


def test_the_epic_names_every_route_it_reaches_with_the_stories_that_reach_it(landed):
    document = assemble_review(landed.specs_root, SPEC, landed.review_readers())
    reached = {entry["path"]: entry for entry in document["routes"]}

    assert reached["/showfloor"]["stories"] == ["US1"]
    assert reached["/desk"]["stories"] == ["US1", "US2", "US4"]
    # The room's own kinds come from the manifest, so US2 can tell a screen it
    # may render in a frame from a document route it may not.
    assert reached["/showfloor"]["kind"] == "room"
    assert reached["/api/showfloor"]["kind"] == "api"


# --- FR-004: half an epic is refused, by name ------------------------------


def test_an_epic_with_an_unmerged_story_is_refused_naming_the_stories(half_landed):
    with pytest.raises(EpicNotLanded) as raised:
        assemble_review(half_landed.specs_root, SPEC, half_landed.review_readers())

    assert [story["story_key"] for story in raised.value.unmerged] == ["US3", "US4"]
    assert "US3" in str(raised.value) and "US4" in str(raised.value)
    # And the stories it names carry their titles, so the refusal reads as the
    # room's own sentence rather than as a list of keys.
    assert raised.value.unmerged[0]["title"] == half_landed.headings(SPEC)["US3"].title


def test_an_attested_story_no_commit_carries_is_not_a_landing(tmp_path):
    """The frontmatter answering for itself is a claim, not a merge (009)."""
    corpus = build_landed_repository(
        tmp_path,
        SpecFixture(SPEC, state="landed"),
        landings={SPEC: ["US1", "US2", "US3"]},
        files_by_story=TOUCHED,
    )
    with pytest.raises(EpicNotLanded) as raised:
        assemble_review(corpus.specs_root, SPEC, corpus.review_readers())
    assert [story["story_key"] for story in raised.value.unmerged] == ["US4"]


def test_a_spec_the_corpus_does_not_have_is_not_a_refusal(landed):
    with pytest.raises(SpecNotFound):
        assemble_review(landed.specs_root, "999-no-such-spec", landed.review_readers())


# --- constitution III: a read that failed is not a story that did not land --


def test_a_failed_landing_read_degrades_rather_than_refusing_the_epic(landed):
    def refuses(spec_dir: str) -> dict:
        raise QueryRefused("landed_facts", "the branch could not be resolved")

    readers = dataclasses.replace(landed.review_readers(), landing_facts=refuses)
    document = assemble_review(landed.specs_root, SPEC, readers)

    assert [note["mode"] for note in document["notes"]] == ["refused"]
    assert document["notes"][0]["read"] == "landed_facts"
    for story in document["stories"]:
        assert story["commit"] is None
        assert "commit" in story["unknown"]
        assert story["files"] == []


def test_a_failed_changed_file_read_costs_that_story_its_files_and_no_more(landed):
    def refuses(commit: str) -> list[str]:
        raise TransportFailed(CHANGED_FILES_READ, "git could not be run")

    readers = dataclasses.replace(landed.review_readers(), changed_files=refuses)
    document = assemble_review(landed.specs_root, SPEC, readers)

    for story in document["stories"]:
        assert story["commit"] is not None
        assert story["files"] == []
        assert [note["read"] for note in story["notes"]] == [CHANGED_FILES_READ]
        assert story["notes"][0]["mode"] == "transport"


# --- FR-006 and the route itself -------------------------------------------


@pytest.fixture
def review_app(landed, credentials, tmp_path, monkeypatch):
    """The application, serving the constructed corpus and its own repository."""
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    settings = dataclasses.replace(
        Settings.from_env(), specs_root=landed.specs_root, landing_branch="dev"
    )
    # The graph where 001's own reader seam looks for it, so the story identity
    # this document renders is the compiled one and not the heading fallback.
    (landed.specs_root / SPEC / "workgraph.json").write_text(
        json.dumps(landed.graph(SPEC)), encoding="utf-8"
    )
    return create_app(settings)


def test_the_route_answers_401_without_the_token(review_app):
    client = TestClient(review_app)
    response = client.get(f"/api/review/{SPEC}")
    assert response.status_code == 401
    assert response.content == REFUSAL_BODY


def test_the_room_itself_answers_401_without_the_token(review_app):
    client = TestClient(review_app)
    assert client.get(f"/review/{SPEC}").status_code == 401


def test_the_route_serves_the_document_with_the_token(review_app, auth_headers):
    client = TestClient(review_app, headers=auth_headers)
    response = client.get(f"/api/review/{SPEC}")

    assert response.status_code == 200
    document = response.json()
    assert document["spec_dir"] == SPEC
    assert document["story_source"] == "workgraph"
    assert [story["story_key"] for story in document["stories"]] == STORIES
    assert story_of(document, "US1")["pr_number"] == 41


def test_the_route_refuses_a_partially_landed_epic_and_names_the_stories(
    half_landed, credentials, tmp_path, monkeypatch, auth_headers
):
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    settings = dataclasses.replace(
        Settings.from_env(), specs_root=half_landed.specs_root, landing_branch="dev"
    )
    client = TestClient(create_app(settings), headers=auth_headers)

    response = client.get(f"/api/review/{SPEC}")
    assert response.status_code == 409
    body = response.json()
    assert [story["story_key"] for story in body["unmerged"]] == ["US3", "US4"]
    assert body["spec_dir"] == SPEC
    assert body["landing_branch"] == "dev"


def test_a_spec_directory_the_corpus_does_not_have_is_a_404(review_app, auth_headers):
    client = TestClient(review_app, headers=auth_headers)
    assert client.get("/api/review/999-no-such-spec").status_code == 404


@pytest.mark.parametrize("asked", ["%2e%2e", "not a dir", "912-a-landed-epic%20"])
def test_a_spec_directory_off_the_grammar_is_a_miss_over_the_route(
    review_app, auth_headers, asked
):
    client = TestClient(review_app, headers=auth_headers)
    assert client.get(f"/api/review/{asked}").status_code == 404


@pytest.mark.parametrize("asked", ["..", ".", "", "a/b", "../specs", "~"])
def test_a_spec_directory_off_the_grammar_never_reaches_the_filesystem(landed, asked):
    """The grammar is checked before the path is built, not after.

    `..` and `.` are normalised away by any HTTP client before the route sees
    them, so the property is asserted where it actually lives: a spelling that
    could not name a spec is a miss, and no path is composed from it.
    """
    with pytest.raises(SpecNotFound):
        assemble_review(landed.specs_root, asked, landed.review_readers())
