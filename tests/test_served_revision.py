"""The revision the service is serving, and whether it carries the epic (011 US2).

FR-009 and FR-010, and the question the room could not otherwise answer.  The
review room reviews the **running service** — the operator's own browser renders
this pane's routes in a same-origin frame (D-023) — so the whole review is worth
nothing if the service is not serving the epic under review.  Every note taken
under a mismatch is about a different surface, and nothing on the screen says so.

Every condition here is **constructed**: a git repository the test writes under
its own `tmp_path`, with one commit per landing, and a served revision made to
agree or disagree with the branch by checking the repository out at one commit or
another.  That constructed *pair* is what T015 asks for, and it is the only way
to assert the mismatch without pinning this repository's own history — a review
room asserted over the live corpus goes red the day an epic lands with no line of
source touched (008 US1, `tests/test_no_test_pins_live_corpus.py`).

**The third answer is the one worth the file.**  `contains_epic` is `True`,
`False`, or `None`, and the third is not a nicety: a checkout cloned shallow
cannot place a commit it does not have, and a room that answered `False` on the
strength of a read nobody made would spend FR-010's alarm on a fact it never
established.  That alarm has to be believed the one time it is real, so the tests
below drive both failures and require an unknown rather than a mismatch.
"""

from __future__ import annotations

import dataclasses
import json

import pytest
from corpus import SpecFixture, build_landed_repository, git
from fastapi.testclient import TestClient

from pane.app import create_app
from pane.config import Settings
from pane.landing import LANDING_READ
from pane.readers import QueryRefused, TransportFailed
from pane.review import EpicNotLanded, ReviewReaders, assemble_review
from pane.revision import (
    CONTAINS_READ,
    SERVED_REVISION_READ,
    read_served_revision,
    revision_contains,
)

#: A directory number no corpus of this repository uses, so nothing here can be
#: read as an assertion about a spec the factory is actually building.
SPEC = "913-the-thing-itself"

STORIES = ["US1", "US2", "US3", "US4"]

TOUCHED = {
    f"{SPEC}:US1": ["pane/showfloor.py"],
    f"{SPEC}:US2": ["web/src/desk/Desk.tsx"],
    f"{SPEC}:US3": ["web/src/review/Review.tsx"],
    f"{SPEC}:US4": ["web/src/api/answer.ts"],
}


@pytest.fixture
def landed(tmp_path):
    """A repository whose `dev` carries every story of `SPEC`, and is checked out."""
    return build_landed_repository(
        tmp_path,
        SpecFixture(SPEC, state="ready"),
        landings={SPEC: STORIES},
        files_by_story=TOUCHED,
    )


def serve(corpus, revision: str) -> None:
    """Check the repository out at `revision`, so that is what it is serving.

    A detached checkout and not a flag: the point of the constructed pair is that
    the *service* is somewhere the branch is not, which is the condition FR-010
    exists for, and a test that faked it by passing a different string would
    prove nothing about the read that has to notice.
    """
    git(corpus.repo, "checkout", "--quiet", "--detach", revision)


def commit_before_any_landing(corpus) -> str:
    """The commit the corpus was built at, before the first story landed."""
    facts = corpus.landing_facts(SPEC)
    return git(corpus.repo, "rev-parse", f"{facts['US1'].commit}~1").strip()


def served_of(corpus, **overrides) -> dict:
    return assemble_review(
        corpus.specs_root, SPEC, corpus.review_readers(**overrides)
    )["served"]


# --- the read itself -------------------------------------------------------


def test_the_read_names_the_revision_the_checkout_is_on(landed):
    head = git(landed.repo, "rev-parse", "HEAD").strip()
    served = read_served_revision(landed.repo)

    assert served.revision == head
    assert served.short_revision == head[:12]
    assert served.branch == "dev"
    assert served.subject is not None
    assert served.committed_at is not None


def test_a_detached_checkout_has_a_revision_and_no_branch(landed):
    """A detached head is an ordinary state, not a failed read.

    The Unknown Rule on the branch alone: the revision is exactly as knowable as
    it was, and a read that failed over a missing branch name would lose the one
    fact the header is for.
    """
    serve(landed, commit_before_any_landing(landed))
    served = read_served_revision(landed.repo)

    assert served.revision == git(landed.repo, "rev-parse", "HEAD").strip()
    assert served.branch is None


def test_a_repository_that_is_not_there_is_a_transport_failure(tmp_path):
    with pytest.raises(TransportFailed) as raised:
        read_served_revision(tmp_path / "nothing")
    assert raised.value.read == SERVED_REVISION_READ


def test_a_revision_carries_its_own_commit_and_its_ancestors(landed):
    facts = landed.landing_facts(SPEC)
    head = git(landed.repo, "rev-parse", "HEAD").strip()

    assert revision_contains(landed.repo, head, head) is True
    assert revision_contains(landed.repo, head, facts["US1"].commit) is True


def test_a_revision_that_predates_a_commit_does_not_carry_it(landed):
    facts = landed.landing_facts(SPEC)
    before = commit_before_any_landing(landed)

    assert revision_contains(landed.repo, before, facts["US1"].commit) is False


def test_a_commit_the_checkout_never_saw_is_refused_and_not_a_False(landed):
    """The whole reason the count is asked for rather than `--is-ancestor`.

    A shallow checkout and a revision that omits the epic answer the same way
    under an exit code; here they cannot, because git's own failure comes back as
    a refusal by name.
    """
    head = git(landed.repo, "rev-parse", "HEAD").strip()

    with pytest.raises(QueryRefused) as raised:
        revision_contains(landed.repo, head, "0" * 40)
    assert raised.value.read == CONTAINS_READ


# --- FR-009: the document names it, always ---------------------------------


def test_the_document_names_the_revision_the_service_is_serving(landed):
    served = served_of(landed)

    assert served["revision"] == git(landed.repo, "rev-parse", "HEAD").strip()
    assert served["short_revision"] == served["revision"][:12]
    assert served["branch"] == "dev"
    assert served["unknown"] == []
    assert served["notes"] == []


def test_a_revision_that_carries_every_landing_contains_the_epic(landed):
    served = served_of(landed)

    assert served["contains_epic"] is True
    assert served["missing"] == []


# --- FR-010: a mismatch, over a constructed pair of revisions (T015) -------


def test_a_revision_that_predates_the_epic_states_the_mismatch_by_name(landed):
    """The pair: `dev` carries the whole epic, and the service is serving a
    revision from before any of it landed.  Every story is named, with its title,
    because a mismatch stated without its particulars is a warning the operator
    cannot act on."""
    serve(landed, commit_before_any_landing(landed))

    served = served_of(landed)

    assert served["contains_epic"] is False
    assert [story["story_key"] for story in served["missing"]] == STORIES
    assert all(story["title"] for story in served["missing"])
    assert served["notes"] == []


def test_a_revision_that_carries_half_the_epic_names_only_the_half_it_lacks(landed):
    """The pair that matters most, because it is the one an operator hits.

    The service is serving a revision taken between two landings: half the epic
    is on the screen and half is not, and a header that said only *mismatch*
    would leave the reviewer unable to tell which of their notes are about work
    that is really there.
    """
    facts = landed.landing_facts(SPEC)
    serve(landed, facts["US2"].commit)

    served = served_of(landed)

    assert served["contains_epic"] is False
    assert [story["story_key"] for story in served["missing"]] == ["US3", "US4"]


def test_the_epic_is_contained_again_when_the_service_returns_to_the_branch(landed):
    """The other half of the pair: nothing about the mismatch is sticky.

    Without this the test above would pass over a room that reported every epic
    missing, which is the failure mode the whole `None` answer exists to prevent.
    """
    serve(landed, commit_before_any_landing(landed))
    assert served_of(landed)["contains_epic"] is False

    git(landed.repo, "checkout", "--quiet", "dev")
    assert served_of(landed)["contains_epic"] is True


# --- constitution III: a read nobody made is never a mismatch --------------


def test_a_containment_read_that_failed_is_unknown_and_not_a_mismatch(landed):
    def refuse(revision: str, commit: str) -> bool:
        raise QueryRefused(CONTAINS_READ, "the checkout is shallow")

    served = served_of(landed, revision_contains=refuse)

    assert served["contains_epic"] is None
    assert served["missing"] == []
    assert [note["read"] for note in served["notes"]] == [CONTAINS_READ]
    assert served["notes"][0]["mode"] == "refused"


def test_a_served_revision_that_will_not_read_costs_the_header_and_no_more(landed):
    def fail() -> None:
        raise TransportFailed(SERVED_REVISION_READ, "git could not be run")

    document = assemble_review(
        landed.specs_root, SPEC, landed.review_readers(served_revision=fail)
    )

    assert document["served"]["revision"] is None
    assert document["served"]["contains_epic"] is None
    assert document["served"]["unknown"] == [
        "revision",
        "branch",
        "committed_at",
        "subject",
    ]
    assert [note["read"] for note in document["served"]["notes"]] == [
        SERVED_REVISION_READ
    ]
    assert document["served"]["notes"][0]["mode"] == "transport"
    # And the room still renders everything the branch did answer.
    assert [story["story_key"] for story in document["stories"]] == STORIES


def test_a_failed_landing_read_leaves_containment_unknown_rather_than_missing(landed):
    """Not knowing what landed is not evidence that the revision omits it.

    `pane/review.py` already refuses to call an epic unmerged on a landing read
    nobody made; the header takes the same rule, or the room would answer *this
    revision does not contain the epic* about an epic it could not see.
    """

    def fail(spec_dir: str) -> dict:
        raise TransportFailed(LANDING_READ, "the branch could not be resolved")

    served = served_of(landed, landing_facts=fail)

    assert served["revision"] is not None
    assert served["contains_epic"] is None
    assert served["missing"] == []


def test_a_build_with_no_revision_read_is_unknown_and_files_no_note(landed):
    """A build that cannot ask is not a read that failed.

    Unknown on every field, and no note: a note names a read this pane made and
    lost, and there is nothing to name here.
    """
    readers = dataclasses.replace(
        landed.review_readers(), served_revision=None, revision_contains=None
    )
    served = assemble_review(landed.specs_root, SPEC, readers)["served"]

    assert served == {
        "revision": None,
        "short_revision": None,
        "branch": None,
        "committed_at": None,
        "subject": None,
        "contains_epic": None,
        "missing": [],
        "unknown": ["revision", "branch", "committed_at", "subject"],
        "notes": [],
    }


# --- the refusal is a render too (FR-009's "any render") ------------------


def test_the_partly_landed_refusal_carries_the_header(tmp_path):
    """A refusal is something the operator is looking at.

    So it carries the revision the service is serving, like every other render —
    and it reports the epic as not contained, naming the stories, because a
    story the branch never carried is one the served revision cannot be holding
    either.
    """
    corpus = build_landed_repository(
        tmp_path,
        SpecFixture(SPEC, state="ready"),
        landings={SPEC: ["US1", "US2"]},
        files_by_story=TOUCHED,
    )

    with pytest.raises(EpicNotLanded) as raised:
        assemble_review(corpus.specs_root, SPEC, corpus.review_readers())

    served = raised.value.as_document()["served"]
    assert served["revision"] == git(corpus.repo, "rev-parse", "HEAD").strip()
    assert served["contains_epic"] is False
    assert [story["story_key"] for story in served["missing"]] == ["US3", "US4"]


# --- over the route the room actually reads -------------------------------


@pytest.fixture
def review_app(landed, credentials, tmp_path, monkeypatch):
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    settings = dataclasses.replace(
        Settings.from_env(), specs_root=landed.specs_root, landing_branch="dev"
    )
    (landed.specs_root / SPEC / "workgraph.json").write_text(
        json.dumps(landed.graph(SPEC)), encoding="utf-8"
    )
    return create_app(settings)


def test_the_route_serves_the_header_with_the_document(review_app, auth_headers, landed):
    client = TestClient(review_app, headers=auth_headers)
    document = client.get(f"/api/review/{SPEC}").json()

    assert document["served"]["revision"] == git(
        landed.repo, "rev-parse", "HEAD"
    ).strip()
    assert document["served"]["contains_epic"] is True


def test_the_route_states_the_mismatch_when_the_service_moved(
    review_app, auth_headers, landed
):
    serve(landed, commit_before_any_landing(landed))
    client = TestClient(review_app, headers=auth_headers)

    document = client.get(f"/api/review/{SPEC}").json()

    assert document["served"]["contains_epic"] is False
    assert [story["story_key"] for story in document["served"]["missing"]] == STORIES


# --- the reads this module makes are reads (constitution I, FR-014) -------


#: Every git verb `pane/revision.py` is allowed to reach.  Both are reads of a
#: repository nobody is asking it to change, and the list is closed on purpose:
#: this is the second module in the pane to reach git, and the verbs that would
#: make it dangerous — `checkout`, `fetch`, `reset` — are one word away from the
#: two it uses.
READ_ONLY_VERBS = {"rev-parse", "rev-list"}


def test_the_module_reaches_two_git_verbs_and_both_are_reads(landed):
    """Read off the syntax, not off a grep of the prose.

    The module's own docstring argues about shallow checkouts and about
    fetching, so a substring search over the file would flag the reasoning as
    the offence.  What matters is which command it actually runs, so the verbs
    are read out of the `_git(...)` call sites themselves.
    """
    import ast
    from pathlib import Path

    source = (Path(__file__).resolve().parents[1] / "pane" / "revision.py").read_text()
    tree = ast.parse(source)

    verbs = {
        node.args[1].value
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "_git"
        and len(node.args) > 1
        and isinstance(node.args[1], ast.Constant)
    }

    assert verbs, "no git call was found, so this test proves nothing"
    assert verbs <= READ_ONLY_VERBS, f"pane/revision.py runs {verbs - READ_ONLY_VERBS}"
    # And it spawns nothing of its own: the git it runs is ergane's (plan's
    # Named traps, constitution II).
    assert "import subprocess" not in source
    assert "open(" not in source
