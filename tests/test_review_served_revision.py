"""The revision the service is serving, and whether it holds the epic (011 US2).

FR-009 and FR-010, and the two reads underneath them.  The review room renders
the *running service*, which may not be running the tree the epic landed in —
and when it is not, every measurement on the screen and every note taken beside
it is about something other than the epic named at the top of the page.  So the
document names the served revision always, and says in three words which of the
three answers it has: the revision holds the epic, it does not, or it could not
be established.

**Every condition here is constructed** (008 US1,
`tests/test_no_test_pins_live_corpus.py`).  The pair of revisions FR-010 needs is
built by `tests/corpus.py`'s landed repository and then *moved backwards*: the
service is checked out at the commit before the last landing, so the branch
carries four stories and the served revision holds three.  Nothing here reads
this repository's own HEAD, which would be an assertion about this morning.

The three answers, kept apart, are the whole of constitution III in this module:

* `contains_epic is True` — every landing is reachable from the served revision;
* `contains_epic is False` — at least one is not, and `missing` names it with
  its SHA, because "the revision is wrong" is useless without "wrong by what";
* `contains_epic is None` — the revision, the landings or the containment read
  was not obtainable.  Unknown is never rendered as a mismatch, and a mismatch
  is never rendered as unknown: one of the two would send the operator hunting a
  deployment that is fine, and the other would let them review the wrong thing
  in silence.
"""

from __future__ import annotations

import dataclasses

import pytest
from corpus import SpecFixture, build_landed_repository
from fastapi.testclient import TestClient

from pane.app import create_app
from pane.config import Settings
from pane.landing import (
    CONTAINS_READ,
    commit_contained,
    read_served_revision,
)
from pane.readers import QueryRefused, TransportFailed
from pane.review import assemble_review

#: A directory number no corpus of this repository uses.
SPEC = "913-a-served-epic"

STORIES = ["US1", "US2", "US3", "US4"]


@pytest.fixture
def landed(tmp_path):
    """A repository whose branch carries every story of `SPEC`."""
    return build_landed_repository(
        tmp_path,
        SpecFixture(SPEC, state="ready"),
        landings={SPEC: STORIES},
    )


def served_of(corpus, **overrides) -> dict:
    document = assemble_review(
        corpus.specs_root, SPEC, corpus.review_readers(**overrides)
    )
    return document["served"]


def rewind(corpus, stories_back: int) -> None:
    """Check the repository out at the commit `stories_back` landings ago.

    The constructed pair of revisions FR-010 is about: the branch is unchanged
    and still carries every landing, and the tree the service is running from is
    behind it.  A detached HEAD is exactly the shape a deployment has when it was
    started from a tag or a pinned SHA, which is the case this exists for.
    """
    from corpus import git

    git(corpus.repo, "checkout", "--quiet", f"HEAD~{stories_back}")


# --- the two reads, on their own -------------------------------------------


def test_the_served_revision_is_the_checkout_head_and_says_whether_it_is_dirty(landed):
    revision, dirty = read_served_revision(landed.repo)

    from corpus import git

    assert revision == git(landed.repo, "rev-parse", "HEAD").strip()
    assert dirty is False

    (landed.repo / "pane_is_being_edited.py").write_text("x = 1\n", encoding="utf-8")
    _again, dirty_now = read_served_revision(landed.repo)
    assert dirty_now is True


def test_a_tree_that_is_not_a_repository_has_no_revision_to_withhold(tmp_path):
    """Unknown, not degraded — `pane/draft.py`'s rule, for the same reason.

    A scratch directory is not a checkout and never was one.  Reporting that as
    a failed read would put a note on every render of every corpus this suite
    constructs, which is how a rule this loose gets discovered late.
    """
    assert read_served_revision(tmp_path / "not-a-checkout") == (None, None)


def test_a_landing_on_the_branch_is_contained_by_the_branch_head(landed):
    revision, _dirty = read_served_revision(landed.repo)
    facts = landed.landing_facts(SPEC)

    for story_key in STORIES:
        assert commit_contained(landed.repo, revision, facts[story_key].commit) is True


def test_a_landing_after_the_served_revision_is_not_contained(landed):
    facts = landed.landing_facts(SPEC)
    rewind(landed, 1)
    revision, _dirty = read_served_revision(landed.repo)

    assert commit_contained(landed.repo, revision, facts["US3"].commit) is True
    assert commit_contained(landed.repo, revision, facts["US4"].commit) is False


def test_a_revision_git_does_not_know_is_a_refusal_and_never_a_false(landed):
    """The Unknown Rule's shape: git ran and declined, so the read is refused.

    `False` here would read as "the service is serving the wrong tree", which is
    a different and much louder claim than "the question could not be asked".
    """
    with pytest.raises(QueryRefused) as raised:
        commit_contained(landed.repo, "HEAD", "0" * 40)
    assert raised.value.read == CONTAINS_READ


def test_a_repository_that_is_not_there_is_a_transport_failure(tmp_path):
    with pytest.raises(TransportFailed) as raised:
        commit_contained(tmp_path / "nothing", "HEAD", "HEAD")
    assert raised.value.read == CONTAINS_READ


# --- FR-009: the document names the revision, always ------------------------


def test_the_document_names_the_served_revision_and_that_it_holds_the_epic(landed):
    served = served_of(landed)

    revision, _dirty = read_served_revision(landed.repo)
    assert served["revision"] == revision
    assert served["short_revision"] == revision[:12]
    assert served["dirty"] is False
    assert served["contains_epic"] is True
    assert served["missing"] == []
    assert served["unplaced"] == []
    assert served["notes"] == []


def test_a_revision_that_cannot_be_read_is_unknown_and_not_a_mismatch(landed):
    served = served_of(landed, served_revision=lambda: (None, None))

    assert served["revision"] is None
    assert served["short_revision"] is None
    # The load-bearing line: nothing is known, so nothing is claimed. A room
    # that read this as a mismatch would send the operator after a deployment
    # that is fine.
    assert served["contains_epic"] is None
    assert served["missing"] == []


# --- FR-010: the mismatch, over a constructed pair of revisions -------------


def test_a_served_revision_behind_the_branch_is_a_mismatch_naming_the_story(landed):
    facts = landed.landing_facts(SPEC)
    rewind(landed, 1)

    served = served_of(landed)

    assert served["contains_epic"] is False
    assert [entry["story_key"] for entry in served["missing"]] == ["US4"]
    assert served["missing"][0]["commit"] == facts["US4"].commit
    assert served["missing"][0]["short_commit"] == facts["US4"].commit[:12]


def test_a_served_revision_two_landings_back_names_both_stories_it_lacks(landed):
    rewind(landed, 2)

    served = served_of(landed)

    assert served["contains_epic"] is False
    assert [entry["story_key"] for entry in served["missing"]] == ["US3", "US4"]


def test_the_mismatch_survives_the_route_and_reaches_the_document(
    landed, credentials, tmp_path, monkeypatch, auth_headers
):
    """The wiring, not a stand-in for it: the app's own binding, over the pair.

    The reads are the ones `ReviewReaders.from_reader` binds, so what is proved
    here is that an operator opening the room on a service behind the branch is
    told so — and not merely that a function returns False when handed one.
    """
    rewind(landed, 1)
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    settings = dataclasses.replace(
        Settings.from_env(), specs_root=landed.specs_root, landing_branch="dev"
    )
    client = TestClient(create_app(settings), headers=auth_headers)

    response = client.get(f"/api/review/{SPEC}")

    assert response.status_code == 200
    served = response.json()["served"]
    assert served["revision"] is not None
    assert served["contains_epic"] is False
    assert [entry["story_key"] for entry in served["missing"]] == ["US4"]


# --- the third answer: the question could not be asked ----------------------


def test_a_containment_read_that_failed_is_a_note_and_leaves_it_unknown(landed):
    def refuses(revision: str, commit: str) -> bool:
        raise QueryRefused(CONTAINS_READ, "git declined the revision")

    served = served_of(landed, contains=refuses)

    assert served["contains_epic"] is None
    assert served["missing"] == []
    assert [note["read"] for note in served["notes"]] == [CONTAINS_READ]
    assert served["notes"][0]["mode"] == "refused"


def test_a_mismatch_already_established_survives_a_read_that_then_failed(landed):
    """A partial answer that already contains a "no" is a no.

    The walk sees `US3` absent from the served revision and then cannot ask
    about `US4`.  Reporting that as unknown would discard a mismatch this
    process has already established — which is the one direction of the rule
    that lets an operator go on reviewing the wrong tree.
    """
    rewind(landed, 2)
    truthful = landed.review_readers().contains
    facts = landed.landing_facts(SPEC)
    assert truthful is not None

    def ask(revision: str, commit: str) -> bool:
        if commit == facts["US4"].commit:
            raise QueryRefused(CONTAINS_READ, "git declined the revision")
        return truthful(revision, commit)

    served = served_of(landed, contains=ask)

    assert served["contains_epic"] is False
    assert [entry["story_key"] for entry in served["missing"]] == ["US3"]
    assert [note["read"] for note in served["notes"]] == [CONTAINS_READ]


def test_a_transport_failure_on_the_containment_read_says_transport(landed):
    def fails(revision: str, commit: str) -> bool:
        raise TransportFailed(CONTAINS_READ, "git could not be run")

    served = served_of(landed, contains=fails)

    assert served["contains_epic"] is None
    assert [note["mode"] for note in served["notes"]] == ["transport"]


def test_stories_the_branch_could_not_place_leave_containment_unknown(landed):
    """A landing read that failed is not a revision that lacks the epic.

    With no landing facts there is no commit to ask about, so the honest answer
    is that containment is unknown and every story is unplaced — never `True`
    (which would clear a deployment nobody checked) and never `False`.
    """

    def refuses(spec_dir: str):
        raise TransportFailed("landed_facts", "git could not be run")

    served = served_of(landed, landing_facts=refuses)

    assert served["contains_epic"] is None
    assert served["unplaced"] == STORIES
    assert served["missing"] == []
