"""A landed epic reads landed (009 US1: FR-001 … FR-004, FR-002a).

At 3:22 PM CT on 2026-08-25 the operator looked at the Showfloor and asked "006
seems out of date?".  It was not out of date.  Spec 006 had merged all three of
its stories eleven minutes earlier and the room rendered it `READY 0/3` — every
story at the *first* stop of a six-stop ladder, which in this room's vocabulary
means not started.  The room stated the opposite of the truth about the one
thing it exists to report, and it would have gone on doing so until a human
edited one line of frontmatter.

The defect is a missing source, not a wrong rule.  `epic_status` is the only
thing that knows an attempt number, a persona, or the four stops between `ready`
and `merged` — and it knows nothing at all once the workflow has aged out.  The
landing branch knows, and never forgets.  So the two are **layered**: the live
answer governs every story it places, the branch answers for the rest, and a
story neither can place takes the Unknown Rule rather than the ladder's first
stop.  `ready` is a claim that nothing has started; it is not an absence of
information, and rendering it for one is the defect being fixed.

**Every condition below is constructed** (008 US1, `tests/corpus.py`).  Nothing
here asserts what this repository's own branch carries this morning — an
assertion like that passes today and goes red the next time a spec lands, with
no line of `pane/` touched.  Two builders supply the two halves:
`landing_facts_for` composes what a reader returns, and
`build_landed_repository` writes a real git repository under the test's own
`tmp_path` so `factory.workgraph.landed.landed_facts` is exercised as itself.
"""

import asyncio
from pathlib import Path

import pytest
from corpus import (
    SpecFixture,
    build_corpus,
    build_landed_repository,
    entry_for,
    git,
    landing_facts_for,
    landing_read,
    landing_subject,
)

from pane.config import DEFAULT_LANDING_BRANCH, Settings
from pane.landing import (
    AssemblyLanding,
    LandingFact,
    LandingReader,
    pr_number_of,
    reader_for,
)
from pane.readers import QueryRefused, TransportFailed
from pane.showfloor import assemble_showfloor

#: The spec directories this file constructs.  Three digits outside the range
#: this repository's corpus uses, so no assertion here can collide with a real
#: spec's name or a real spec's state.
FINISHED = "910-finished-and-unattested"
IN_FLIGHT = "911-still-building"
ATTESTED = "912-attested-but-not-landed"

#: The four stories the recorded spec body declares.
STORY_KEYS = ["US1", "US2", "US3", "US4"]


def stops_of(story: dict) -> list[str]:
    return [stop["status"] for stop in story["ladder"]["stops"]]


def assemble(corpus, **overrides) -> dict:
    return corpus.assemble(**overrides)


# --- FR-001, FR-002: landing truth outlives the workflow -------------------


def test_a_spec_landed_by_content_reads_merged_with_no_live_answer(tmp_path):
    """US1-S1: every landed story's ladder reads `merged`, and n/n.

    The 3:22 PM condition exactly: the frontmatter still says `ready` — nobody
    has attested anything — and no epic answers for the spec, because the
    workflow is gone.  Before 009 this rendered `READY 0/4`.
    """
    corpus = build_corpus(tmp_path, SpecFixture(FINISHED, state="ready"))
    landed = landing_read({FINISHED: landing_facts_for(FINISHED, STORY_KEYS)})

    entry = corpus.entry(FINISHED, landing_facts=landed)

    assert [story["ladder"]["stop_key"] for story in entry["stories"]] == ["merged"] * 4
    assert all(stops_of(story) == ["done"] * 6 for story in entry["stories"])
    assert entry["stories_landed"] == entry["stories_total"] == 4
    assert entry["chip"] == "landed"
    # Nothing degraded: the branch answered, and what it said was the truth.
    assert entry["notes"] == []
    # And the frontmatter was never edited to get there.
    assert entry["state"] == "ready"


def test_the_landing_branch_is_read_through_erganes_own_seam(tmp_path):
    """FR-001, over a real repository the test built (plan D2).

    `landed_facts` is the library `ergane spec landed` calls; the pane imports
    it and shells nothing (constitution II).  This is the only test here that
    goes all the way to git, and it is the one that proves the wiring: the
    others drive the layering through the reader seam.
    """
    corpus = build_landed_repository(
        tmp_path,
        SpecFixture(FINISHED, state="ready"),
        SpecFixture(IN_FLIGHT, state="ready"),
        landings={FINISHED: STORY_KEYS, IN_FLIGHT: ["US1"]},
    )

    document = asyncio.run(
        assemble_showfloor(corpus.specs_root, corpus.landing_reader())
    )

    finished = entry_for(document, FINISHED)
    assert finished["stories_landed"] == 4
    assert finished["chip"] == "landed"

    # The spec whose first story landed and whose other three did not: the
    # branch places one and the room says so, rather than rounding either way.
    building = entry_for(document, IN_FLIGHT)
    assert building["stories_landed"] == 1
    assert [story["ladder"]["stop_key"] for story in building["stories"]] == [
        "merged", "ready", "ready", "ready",
    ]
    assert document["degraded"] == []


def test_stories_landed_counts_content_not_attestation(tmp_path):
    """FR-002: an unattested finished epic reports its true count."""
    corpus = build_corpus(tmp_path, SpecFixture(FINISHED, state="ready"))
    partly = landing_read({FINISHED: landing_facts_for(FINISHED, ["US1", "US2"])})

    unread = corpus.entry(FINISHED)
    counted = corpus.entry(FINISHED, landing_facts=partly)

    # Without the read the room can only repeat the frontmatter, and says 0/4.
    assert unread["stories_landed"] == 0
    assert counted["stories_landed"] == 2
    assert counted["stories_total"] == 4
    assert counted["chip"] != "landed", "two of four landed is not a landed epic"


# --- FR-002a: the three facts the branch already holds ---------------------


def test_a_landed_storys_detail_names_when_it_merged_its_sha_and_its_pr(tmp_path):
    """US1-S2 and SC-004: three facts instead of three dashes.

    The operator's own reading of the pane — "all of the `-` on the right should
    be checkboxes or something right? with a timestamp or some sort of data on
    when that happened?".  Half of what was missing is on the branch already.
    """
    facts = landing_facts_for(FINISHED, STORY_KEYS, first_pr=47, merged_at="2026-08-25T15:36:32Z")
    corpus = build_corpus(tmp_path, SpecFixture(FINISHED, state="ready"))

    entry = corpus.entry(FINISHED, landing_facts=landing_read({FINISHED: facts}))
    us1 = entry["stories"][0]

    # The `merged` stop carries the landing commit's instant, and it is the
    # only stop that carries one: the branch holds one commit for this story.
    merged = [stop for stop in us1["ladder"]["stops"] if stop["key"] == "merged"][0]
    assert merged["at"] == "2026-08-25T15:36:32Z"
    assert [stop["at"] for stop in us1["ladder"]["stops"][:5]] == [None] * 5

    # The landing SHA, and the PR number read out of the squash subject the
    # merge queue wrote — not invented, and not a number from anywhere else.
    assert us1["facts"]["landing_sha"] == facts["US1"].commit
    assert us1["facts"]["pr_number"] == 47
    assert facts["US1"].subject == landing_subject(FINISHED, "US1", 47)

    # Every fact the branch cannot supply stays unknown (FR-002a): this adds no
    # store and reads no history the branch does not hold.
    for field in ("attempt", "persona", "verified", "history", "landing_history"):
        assert us1["facts"][field] is None


def test_a_story_the_branch_cannot_place_carries_no_sha_and_no_instant(tmp_path):
    """FR-002a's other half: the absence is an absence, never a stand-in."""
    corpus = build_corpus(tmp_path, SpecFixture(FINISHED, state="ready"))

    entry = corpus.entry(FINISHED, landing_facts=landing_read({}))
    us1 = entry["stories"][0]

    assert us1["facts"]["landing_sha"] is None
    assert us1["facts"]["pr_number"] is None
    assert [stop["at"] for stop in us1["ladder"]["stops"]] == [None] * 6


def test_the_pr_number_is_read_from_the_subject_and_never_guessed():
    """The grammar, and its absence: a subject naming no PR yields none."""
    assert pr_number_of(landing_subject(FINISHED, "US2", 48)) == 48
    assert pr_number_of("Merge branch 'factory/910-x/us2' into dev") is None
    assert pr_number_of("910-x/us2: US2") is None
    assert pr_number_of(None) is None
    assert pr_number_of("") is None


# --- FR-003: the live answer governs every story it names ------------------


def test_a_live_answer_governs_every_story_it_names(tmp_path):
    """US1-S3: the two sources disagree, and the live one wins where it speaks.

    The branch says all four stories landed.  The live answer — an epic that is
    running *right now*, which is newer news than any commit — says US1 is
    building on its second attempt and US2 is verifying, and names neither US3
    nor US4.  Live governs the two it names, attempt and persona included; the
    branch fills only the two it does not.
    """
    corpus = build_corpus(tmp_path, SpecFixture(IN_FLIGHT, state="ready"))
    branch = landing_read({IN_FLIGHT: landing_facts_for(IN_FLIGHT, STORY_KEYS)})

    async def answer(spec_dir: str) -> dict | None:
        if spec_dir != IN_FLIGHT:
            return None
        return {
            "epic_state": "RUNNING",
            "nodes": {
                "us1": {"state": "RUNNING", "attempt": 2, "persona": "builder"},
                "us2": {"state": "VERIFYING", "attempt": 1, "persona": "judge"},
            },
        }

    entry = corpus.entry(IN_FLIGHT, epic_status=answer, landing_facts=branch)
    us1, us2, us3, us4 = entry["stories"]

    # The stops before `merged` come from the live answer unchanged, and the
    # corpus overwrote none of them.
    assert us1["ladder"]["stop_key"] == "building"
    assert us1["ladder"]["state"] == "RUNNING"
    assert us1["facts"]["attempt"] == 2
    assert us1["facts"]["persona"] == "builder"
    assert us2["ladder"]["stop_key"] == "verifying"
    assert us2["facts"]["persona"] == "judge"

    # Only the stories the live answer did not name are filled from the branch.
    assert us3["ladder"]["stop_key"] == "merged"
    assert us4["ladder"]["stop_key"] == "merged"
    assert entry["stories_landed"] == 2


def test_the_corpus_fills_a_pr_number_the_live_answer_did_not_carry(tmp_path):
    """FR-003 at the field level: fill an absence, overwrite nothing."""
    corpus = build_corpus(tmp_path, SpecFixture(IN_FLIGHT, state="ready"))
    branch = landing_read(
        {IN_FLIGHT: landing_facts_for(IN_FLIGHT, ["US1", "US2"], first_pr=61)}
    )

    async def answer(spec_dir: str) -> dict | None:
        if spec_dir != IN_FLIGHT:
            return None
        return {
            "epic_state": "RUNNING",
            # US1 merged and the answer carries its own PR number; US2 merged
            # and the answer says nothing about a PR at all.
            "nodes": {
                "us1": {"state": "MERGED", "pr_number": 999},
                "us2": {"state": "MERGED"},
            },
        }

    entry = corpus.entry(IN_FLIGHT, epic_status=answer, landing_facts=branch)
    us1, us2 = entry["stories"][0], entry["stories"][1]

    assert us1["facts"]["pr_number"] == 999, "a live PR number was overwritten"
    assert us2["facts"]["pr_number"] == 62
    assert "pr_number" not in us2["unknown"], "a fact the branch supplied read unknown"


# --- FR-004: a story neither source can place ------------------------------


@pytest.mark.parametrize("mode", ["transport", "refusal"])
def test_a_story_neither_source_can_place_takes_the_unknown_rule(mode, tmp_path):
    """US1-S4: the Unknown Rule and a named read — never the first stop.

    The trap 009's plan names: it would be easy to fix the ladder's default in
    one place and reintroduce it one layer down.  A `ready` here would mean "no
    epic answered and I could not read the branch either" rendered as "nothing
    has started", which is the same false claim in a new costume.
    """
    failure = (
        TransportFailed("landed_facts", "the repository could not be read")
        if mode == "transport"
        else QueryRefused("landed_facts", "the landing branch could not be resolved")
    )
    corpus = build_corpus(tmp_path, SpecFixture(FINISHED, state="ready"))

    entry = corpus.entry(FINISHED, landing_facts=landing_read(failure=failure))

    for story in entry["stories"]:
        ladder = story["ladder"]
        assert ladder["stop_key"] is None
        assert ladder["stop"] is None
        assert ladder["tone"] == "unknown"
        assert ladder["chip"] is None
        assert stops_of(story) == ["ahead"] * 6
        assert f"{story['story_key']} ladder" in entry["unknown"]

    # The read is named in the entry's degraded notes, with the two modes told
    # apart in `mode` and not only in prose (001's discipline).
    assert entry["notes"] == [
        {"read": "landed_facts", "mode": mode, "detail": failure.detail}
    ]
    # "A total is unknown when any row in scope is" (DESIGN.md's Unknown Rule):
    # the count is still an integer, because the rail draws `n/n`, and the entry
    # says beside it that nobody knows the number.
    assert "stories_landed" in entry["unknown"]


def test_an_unreadable_branch_does_not_disturb_a_story_the_live_answer_placed(tmp_path):
    """The Unknown Rule fills a gap; it never overwrites an answer."""
    corpus = build_corpus(tmp_path, SpecFixture(IN_FLIGHT, state="ready"))
    failure = TransportFailed("landed_facts", "the repository could not be read")

    async def answer(spec_dir: str) -> dict | None:
        if spec_dir != IN_FLIGHT:
            return None
        return {"epic_state": "RUNNING", "nodes": {"us1": {"state": "RUNNING"}}}

    entry = corpus.entry(
        IN_FLIGHT, epic_status=answer, landing_facts=landing_read(failure=failure)
    )

    assert entry["stories"][0]["ladder"]["stop_key"] == "building"
    assert entry["stories"][1]["ladder"]["tone"] == "unknown"


def test_a_build_with_no_landing_read_reads_as_it_did_before(tmp_path):
    """No reader is not a failed read (`ShowfloorReaders`).

    The distinction matters in both directions: a build without the read must
    not paint every story unknown, and a build *with* one that failed must not
    quietly rest at `ready`.
    """
    corpus = build_corpus(tmp_path, SpecFixture(FINISHED, state="ready"))

    entry = corpus.entry(FINISHED)

    assert [story["ladder"]["stop_key"] for story in entry["stories"]] == ["ready"] * 4
    assert entry["notes"] == []
    assert entry["unknown"] == []


# --- the Edge Cases: an attestation is a claim, a landing is a fact --------


def test_an_attestation_does_not_override_a_branch_that_lacks_the_stories(tmp_path):
    """The spec's second Edge Case, and the trap in the other direction.

    Where the frontmatter says `landed` and the branch does not carry the
    stories, the branch wins and the disagreement is named.  Letting the
    attestation short-circuit the read would reproduce 009's own defect class
    with the sign flipped — a claim believed because it was convenient.
    """
    corpus = build_corpus(tmp_path, SpecFixture(ATTESTED, state="landed"))

    entry = corpus.entry(ATTESTED, landing_facts=landing_read({}), )

    assert [story["ladder"]["stop_key"] for story in entry["stories"]] == ["ready"] * 4
    assert entry["stories_landed"] == 0
    assert [note["mode"] for note in entry["notes"]] == ["disagreement"]
    detail = entry["notes"][0]["detail"]
    assert "attests state: landed" in detail
    for story_key in STORY_KEYS:
        assert story_key in detail


def test_an_attestation_the_branch_confirms_earns_no_note(tmp_path):
    """The other side: agreement is not a disagreement."""
    corpus = build_corpus(tmp_path, SpecFixture(ATTESTED, state="landed"))
    landed = landing_read({ATTESTED: landing_facts_for(ATTESTED, STORY_KEYS)})

    entry = corpus.entry(ATTESTED, landing_facts=landed)

    assert entry["notes"] == []
    assert entry["stories_landed"] == 4


def test_an_attested_landing_is_not_a_landing_on_the_branch(tmp_path):
    """`LandedKind.ATTESTED` is the frontmatter answering for itself.

    ergane's own reader gap-fills an attested spec's stories from the commit
    that introduced the attestation.  That is exactly the claim being checked,
    so the assembly believes only `observed` and `historical` — commits that
    carry the story.
    """
    corpus = build_corpus(tmp_path, SpecFixture(ATTESTED, state="landed"))
    attested = landing_facts_for(ATTESTED, STORY_KEYS, kind="attested")

    assert not any(fact.on_branch for fact in attested.values())

    entry = corpus.entry(ATTESTED, landing_facts=landing_read({ATTESTED: attested}))

    assert entry["stories_landed"] == 0
    assert [note["mode"] for note in entry["notes"]] == ["disagreement"]


def test_an_attestation_stands_when_the_branch_could_not_be_read(tmp_path):
    """A branch that could not be read overrules nothing.

    The attestation is silenced by a *fact*, not by the absence of one — so a
    failed read leaves the operator's own word standing rather than turning it
    into a disagreement with something nobody read.
    """
    corpus = build_corpus(tmp_path, SpecFixture(ATTESTED, state="landed"))
    failure = TransportFailed("landed_facts", "the repository could not be read")

    with_reader = corpus.entry(ATTESTED, landing_facts=landing_read(failure=failure))
    without_reader = corpus.entry(ATTESTED)

    assert without_reader["stories_landed"] == 4
    assert [note["mode"] for note in with_reader["notes"]] == ["transport"]
    assert not any(note["mode"] == "disagreement" for note in with_reader["notes"])


def test_the_branch_beats_the_frontmatter_over_a_real_repository(tmp_path):
    """Both Edge Cases at once, through the seam rather than through a stub."""
    corpus = build_landed_repository(
        tmp_path,
        SpecFixture(FINISHED, state="ready"),
        SpecFixture(ATTESTED, state="landed"),
        landings={FINISHED: STORY_KEYS},
    )

    document = asyncio.run(
        assemble_showfloor(corpus.specs_root, corpus.landing_reader())
    )

    # `ready` in the frontmatter, landed on the branch: the branch wins.
    assert entry_for(document, FINISHED)["stories_landed"] == 4
    # `landed` in the frontmatter, absent from the branch: the branch wins.
    attested = entry_for(document, ATTESTED)
    assert attested["stories_landed"] == 0
    assert [note["mode"] for note in attested["notes"]] == ["disagreement"]


# --- the landing branch is a setting --------------------------------------


def test_the_landing_branch_is_configured_and_never_hard_coded(monkeypatch):
    """Plan D3: D-011 makes it `dev` today, and it is still a setting."""
    monkeypatch.delenv("PANE_LANDING_BRANCH", raising=False)
    assert Settings.from_env(dict()).landing_branch == DEFAULT_LANDING_BRANCH
    assert DEFAULT_LANDING_BRANCH == "dev"

    moved = Settings.from_env({"PANE_LANDING_BRANCH": "main"})
    assert moved.landing_branch == "main"
    # Empty is not a branch name; it takes the default rather than degrading
    # every spec on the floor at once.
    assert Settings.from_env({"PANE_LANDING_BRANCH": ""}).landing_branch == "dev"


def test_the_configured_branch_is_the_branch_that_is_read(tmp_path):
    """A setting nothing reads is not a setting.

    Two branches in one repository, each carrying a different landing, and the
    document follows whichever one it was configured with.
    """
    corpus = build_landed_repository(
        tmp_path,
        SpecFixture(FINISHED, state="ready"),
        landings={FINISHED: ["US1"]},
        branch="dev",
    )
    repo = corpus.repo
    git(repo, "checkout", "--quiet", "-b", "release")
    for story_key in ["US2", "US3"]:
        (repo / "landings" / FINISHED / f"{story_key.lower()}.txt").write_text("x\n")
        git(repo, "add", "--all")
        git(repo, "commit", "--quiet", "-m", landing_subject(FINISHED, story_key, 90))
    git(repo, "checkout", "--quiet", "dev")

    on_dev = asyncio.run(assemble_showfloor(corpus.specs_root, corpus.landing_reader("dev")))
    on_release = asyncio.run(
        assemble_showfloor(corpus.specs_root, corpus.landing_reader("release"))
    )

    assert entry_for(on_dev, FINISHED)["stories_landed"] == 1
    assert entry_for(on_release, FINISHED)["stories_landed"] == 3


# --- the reader's own two failure modes ------------------------------------


def test_a_directory_that_is_not_a_checkout_is_a_transport_failure(tmp_path):
    """001's first mode: the read could not be made at all."""
    (tmp_path / "specs").mkdir()

    with pytest.raises(TransportFailed) as caught:
        LandingReader(tmp_path, "dev").facts(FINISHED)

    assert caught.value.read == "landed_facts"


def test_a_branch_the_repository_does_not_carry_is_a_refusal(tmp_path):
    """001's second mode: the read was made and git declined to answer."""
    corpus = build_landed_repository(tmp_path, SpecFixture(FINISHED, state="ready"))

    with pytest.raises(QueryRefused) as caught:
        LandingReader(corpus.repo, "no-such-branch").facts(FINISHED)

    assert caught.value.read == "landed_facts"


def test_the_read_is_repeated_only_when_the_branch_has_moved(tmp_path):
    """The scan is memoised on the head, because a poll runs it per spec.

    Landing facts are a pure function of (repository, head, spec), so repeating
    the scan while the branch stands still buys nothing and costs a full history
    walk per spec on every SSE poll.
    """
    corpus = build_landed_repository(
        tmp_path, SpecFixture(FINISHED, state="ready"), landings={FINISHED: ["US1"]}
    )
    reader = LandingReader(corpus.repo, "dev")

    first = reader.facts(FINISHED)
    assert reader.facts(FINISHED) is first, "the branch stood still and it re-read"

    (corpus.repo / "landings" / FINISHED / "us2.txt").write_text("x\n")
    git(corpus.repo, "add", "--all")
    git(corpus.repo, "commit", "--quiet", "-m", landing_subject(FINISHED, "US2", 92))

    moved = reader.facts(FINISHED)
    assert set(moved) == {"US1", "US2"}


def test_the_branch_scan_is_shared_by_every_assembly_of_a_process(tmp_path):
    """A memo rebuilt per request is not a memo.

    `ShowfloorReaders.from_reader` binds a fresh set of reads for every document
    the pane assembles, and the branch scan is most of a second over a corpus
    this size.  Paying it per request is what cost the smoke suite its budget,
    so the reader outlives the binding and only the head resolution is the
    assembly's own.
    """
    corpus = build_landed_repository(
        tmp_path, SpecFixture(FINISHED, state="ready"), landings={FINISHED: ["US1"]}
    )

    assert reader_for(corpus.repo, "dev") is reader_for(corpus.repo, "dev")
    # A different branch is a different question, and gets its own reader.
    assert reader_for(corpus.repo, "other") is not reader_for(corpus.repo, "dev")

    first = AssemblyLanding(reader_for(corpus.repo, "dev"))
    assert first.facts(FINISHED)["US1"].story_key == "US1"

    # A branch that moves is seen by the next assembly: the memo is keyed on
    # the head and on nothing resembling a clock.
    (corpus.repo / "landings" / FINISHED / "us2.txt").write_text("x\n")
    git(corpus.repo, "add", "--all")
    git(corpus.repo, "commit", "--quiet", "-m", landing_subject(FINISHED, "US2", 93))

    assert set(AssemblyLanding(reader_for(corpus.repo, "dev")).facts(FINISHED)) == {
        "US1", "US2",
    }


def test_a_landing_facts_shape_is_the_shape_the_assembly_reads():
    """The fact the reader returns, and what `on_branch` means on it."""
    observed = LandingFact(story_key="US1", commit="a" * 40, kind="observed")
    historical = LandingFact(story_key="US1", commit="b" * 40, kind="historical")
    attested = LandingFact(story_key="US1", commit="c" * 40, kind="attested")

    assert observed.on_branch and historical.on_branch
    assert not attested.on_branch
    # Absences are absences: no instant, no subject, no PR until the branch
    # supplies them.
    assert (observed.merged_at, observed.subject, observed.pr_number) == (None, None, None)


def test_the_repository_the_landing_read_opens_is_the_corpuss_own(tmp_path):
    """`specs/` is a directory *of* the checkout, so its parent is the repo."""
    corpus = build_landed_repository(
        tmp_path, SpecFixture(FINISHED, state="ready"), landings={FINISHED: ["US1"]}
    )

    assert corpus.specs_root.parent == corpus.repo
    assert Path(corpus.repo / ".git").is_dir()
