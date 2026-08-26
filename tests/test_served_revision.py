"""The revision the room is really serving, and the mismatch it must not hide.

011 US2, FR-009 and FR-010 (T013, T014, T015).

The review room reviews the **running service**.  It builds no branch, renders
no screenshot of one, and drives no browser (D-023): the frame shows what this
pane is serving right now.  Which makes one question load-bearing for every
number on the screen — *is this process standing on a revision that carries the
epic under review?*  If it is not, the operator is measuring a different surface
from the one they think they are looking at, and no note taken under that
mistake is worth keeping.

Every condition here is **constructed**, like `tests/test_review_room.py`'s: a
git repository this file writes under its own `tmp_path`, landing by landing, so
nothing asserts this repository's branch or this morning's corpus (008 US1).
The pair of revisions FR-010 needs is built the way an operator really gets one
— the checkout is moved back to a commit from before the epic finished merging,
which is exactly the state of a pane that has been running since yesterday.

Three answers are kept apart throughout, and the third is not the second:

* **carried** — every story's landing is on the served revision;
* **not carried** — at least one measurably is not, and that is stated;
* **unknown** — the reads did not settle it, which is the Unknown Rule
  (constitution III) and never a mismatch the room invented.
"""

from __future__ import annotations

import dataclasses

import pytest
from conftest import bearer
from corpus import SpecFixture, build_landed_repository
from fastapi.testclient import TestClient

from pane.app import create_app
from pane.config import Settings
from pane.landing import SERVED_REVISION_READ, read_served_revision, revision_carries
from pane.readers import QueryRefused, TransportFailed
from pane.review import assemble_review

#: A directory number no corpus of this repository uses, so nothing here can be
#: read as an assertion about a spec the factory is actually building.
SPEC = "913-a-revision-under-review"

STORIES = ["US1", "US2", "US3", "US4"]

TOUCHED = {
    f"{SPEC}:US1": ["pane/showfloor.py"],
    f"{SPEC}:US2": ["web/src/desk/Desk.tsx"],
    f"{SPEC}:US3": ["web/src/showfloor/Stage.tsx"],
    f"{SPEC}:US4": ["web/src/api/answer.ts"],
}


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
def review_client(credentials, tmp_path, monkeypatch):
    """A `TestClient` over the app, serving a corpus the test built.

    A factory rather than a fixture over `landed`, because the interesting
    condition here is a checkout that has *moved*: the client is built after the
    test has stood the repository where it wants it.
    """

    def build(corpus) -> TestClient:
        monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
        settings = dataclasses.replace(
            Settings.from_env(), specs_root=corpus.specs_root, landing_branch="dev"
        )
        return TestClient(create_app(settings), headers=bearer(credentials["PANE_TOKEN"]))

    return build


def served(corpus, **overrides) -> dict:
    return assemble_review(
        corpus.specs_root, SPEC, corpus.review_readers(**overrides)
    )["served"]


# --- the two reads, as reads ----------------------------------------------


def test_the_served_revision_is_the_checkout_this_process_is_standing_on(landed):
    revision, branch = read_served_revision(landed.repo)

    assert revision == landed.git_head()
    assert branch == "dev"


def test_a_detached_checkout_names_no_branch_rather_than_naming_HEAD(landed):
    """`git rev-parse --abbrev-ref` answers the literal `HEAD` when detached.

    That is not a branch name, and a header that rendered it as one would be the
    room telling the operator it is serving a branch called HEAD.
    """
    first = landed.landing_facts(SPEC)["US1"].commit
    landed.check_out(first)

    revision, branch = read_served_revision(landed.repo)
    assert revision == first
    assert branch is None


def test_a_revision_carries_its_own_ancestors_and_not_its_descendants(landed):
    facts = landed.landing_facts(SPEC)
    head = landed.git_head()

    assert revision_carries(landed.repo, facts["US4"].commit, head)
    assert revision_carries(landed.repo, head, head)

    # Stand on the first landing: it cannot carry the three that came after it.
    landed.check_out(facts["US1"].commit)
    for story_key in ["US2", "US3", "US4"]:
        assert not revision_carries(
            landed.repo, facts[story_key].commit, facts["US1"].commit
        )


def test_an_unknown_revision_is_a_refusal_and_never_a_quiet_mismatch(landed):
    """git ran and declined, so the read is refused — not answered False.

    This is the whole reason the containment read counts commits rather than
    asking `merge-base --is-ancestor`, which answers by exit status and cannot
    be told apart from an unknown revision.  A room that rendered an unmeasured
    mismatch would be raising the alarm FR-010 exists to raise honestly.
    """
    with pytest.raises(QueryRefused) as raised:
        revision_carries(landed.repo, "0" * 40, landed.git_head())
    assert raised.value.read == SERVED_REVISION_READ


def test_a_repository_that_is_not_there_is_a_transport_failure(tmp_path):
    with pytest.raises(TransportFailed) as raised:
        read_served_revision(tmp_path / "nothing")
    assert raised.value.read == SERVED_REVISION_READ


# --- FR-009: the document names it, always --------------------------------


def test_the_document_names_the_revision_the_service_is_serving(landed):
    block = served(landed)

    assert block["revision"] == landed.git_head()
    assert block["short_revision"] == landed.git_head()[:12]
    assert block["branch"] == "dev"


def test_a_revision_that_carries_every_landing_says_so_plainly(landed):
    block = served(landed)

    assert block["contains_epic"] is True
    assert block["missing"] == []
    assert block["unplaced"] == []


# --- FR-010: the constructed pair of revisions (T015) ---------------------


def test_a_revision_from_before_the_epic_finished_is_a_mismatch_by_name(landed):
    """The pair: the branch carries four landings, the checkout carries two.

    This is the condition an operator hits without doing anything unusual — the
    pane has been running since before the epic merged — and it is the one that
    makes every measurement on the screen about a different surface.
    """
    facts = landed.landing_facts(SPEC)
    landed.check_out(facts["US2"].commit)

    block = served(landed)

    assert block["revision"] == facts["US2"].commit
    assert block["contains_epic"] is False
    # Named, not counted: the operator has to know *which* stories they are not
    # looking at, because those are the ones their notes would be wrong about.
    assert block["missing"] == ["US3", "US4"]
    assert block["unplaced"] == []


def test_the_document_still_lists_every_story_under_a_mismatch(landed):
    """A mismatch states a fact about the render; it refuses nothing.

    The room has to keep rendering, or the operator cannot see what it is they
    are not looking at.  The refusal in this room is FR-004's, and it is about
    an epic that has not landed — not about where the process happens to stand.
    """
    facts = landed.landing_facts(SPEC)
    landed.check_out(facts["US1"].commit)

    document = assemble_review(landed.specs_root, SPEC, landed.review_readers())

    assert [story["story_key"] for story in document["stories"]] == STORIES
    assert document["served"]["contains_epic"] is False
    assert document["served"]["missing"] == ["US2", "US3", "US4"]


def test_one_story_absent_is_already_an_epic_the_revision_does_not_carry(landed):
    facts = landed.landing_facts(SPEC)
    landed.check_out(facts["US3"].commit)

    block = served(landed)
    assert block["missing"] == ["US4"]
    assert block["contains_epic"] is False


# --- constitution III: a read that failed is not a mismatch ----------------


def test_a_revision_that_will_not_read_is_unknown_and_not_a_mismatch(landed):
    def refuse() -> tuple[str, str | None]:
        raise TransportFailed(SERVED_REVISION_READ, "git could not be run")

    document = assemble_review(
        landed.specs_root, SPEC, landed.review_readers(served_revision=refuse)
    )

    block = document["served"]
    assert block["revision"] is None
    assert block["short_revision"] is None
    # Not False. Not knowing where the process is standing is not evidence that
    # it is standing in the wrong place.
    assert block["contains_epic"] is None
    assert block["missing"] == []
    assert block["unplaced"] == STORIES

    note = next(n for n in document["notes"] if n["read"] == SERVED_REVISION_READ)
    assert note["mode"] == "transport"
    assert note["detail"] == "git could not be run"


def test_a_containment_read_that_was_refused_is_unknown_and_named_once(landed):
    def refuse(commit: str, revision: str) -> bool:
        raise QueryRefused(SERVED_REVISION_READ, "bad revision")

    document = assemble_review(
        landed.specs_root, SPEC, landed.review_readers(revision_carries=refuse)
    )

    block = document["served"]
    # The revision itself read fine, so it is named; what could not be settled
    # is whether it carries the epic.
    assert block["revision"] == landed.git_head()
    assert block["contains_epic"] is None
    assert block["unplaced"] == STORIES
    assert block["missing"] == []

    # One sentence, not four: the check asks git once per story, and a room that
    # renders one note per read would otherwise repeat itself down the page.
    named = [n for n in document["notes"] if n["read"] == SERVED_REVISION_READ]
    assert len(named) == 1
    assert named[0]["mode"] == "refused"


def test_a_measured_absence_settles_it_even_beside_a_read_that_did_not(landed):
    """One story absent and another unplaced is still an epic not carried.

    False beats None here and the order matters: a revision measurably missing a
    landing is a revision the operator is not reviewing from, whatever else the
    reads could not say.
    """
    facts = landed.landing_facts(SPEC)
    head = landed.check_out(facts["US3"].commit)

    def sometimes(commit: str, revision: str) -> bool:
        if commit == facts["US1"].commit:
            raise QueryRefused(SERVED_REVISION_READ, "bad revision")
        return revision_carries(landed.repo, commit, revision)

    block = served(landed, revision_carries=sometimes)

    assert block["revision"] == head
    assert block["unplaced"] == ["US1"]
    assert block["missing"] == ["US4"]
    assert block["contains_epic"] is False


def test_a_build_that_binds_no_such_read_says_unknown_rather_than_inventing_one(landed):
    block = served(landed, served_revision=None, revision_carries=None)

    assert block["revision"] is None
    assert block["branch"] is None
    assert block["contains_epic"] is None
    assert block["unplaced"] == STORIES


# --- the route serves it --------------------------------------------------


def test_the_route_carries_the_served_revision_to_the_room(landed, review_client):
    document = review_client(landed).get(f"/api/review/{SPEC}").json()

    assert document["served"]["revision"] == landed.git_head()
    assert document["served"]["contains_epic"] is True
