"""The status column carries the times its seams already have (019 US3).

The detail pane's six steps have drawn one instant since 009 — `merged`, off the
landing branch — and five dashes beside five green dots.  US3 fills the stops an
approved seam already records and writes down, in the spec and in
`STOP_INSTANT_SEAMS`, which stops none records.  Four claims, one per acceptance
scenario:

* **US3-S1** — a stop a seam timed shows that seam's instant: `verifying` from
  `factory.verify.store.node_history`'s own `started_at`, `merged` from the
  landing branch's commit date and, where the branch did not answer, from the
  queue's own `landing_history` entry (FR-011).
* **US3-S2** — a stop no seam records stays null, so the room draws its `—`
  (FR-012), and `STOP_INSTANT_SEAMS` names which four those are.
* **US3-S3** — a stop the work has not reached carries no time at all, even when
  a seam holds an instant from an earlier pass through it (FR-013).
* **US3-S4** — every instant shown is the recording seam's own value, never one
  worked out from another stop's (FR-014, constitution V).

**Nothing here pins the live corpus.**  `tests/corpus.py` writes the spec, the
graph and the frontmatter into a scratch tree; the live answers are this
repository's recorded ones under `fixtures/epic-status/`, asked for by name and
never typed out; and the evidence store is written beside them through ergane's
own writer and read through the seam the pane reads it with.  So what is proved
is the wiring, and no assertion moves when the operator attests a spec or
re-dispatches an epic (008 US1).
"""

from __future__ import annotations

import ast
import copy
import dataclasses
import json
from pathlib import Path

from factory.activities.verify_activities import DEFAULT_VERIFICATION_DB_PATH
from factory.mergequeue.models import ObservedOutcome, QueueOutcome
from factory.env import (
    ERGANE_VERIFICATION_DB_PATH_ENV,
    FACTORY_VERIFICATION_DB_PATH_ENV,
)
from factory.verify import store as verify_store
from factory.verify.models import (
    GateResult,
    GateStatus,
    OutputCheck,
    OverallVerdict,
    VerificationForm,
    VerificationResult,
)

from corpus import (
    SpecFixture,
    build_corpus,
    landing_facts_for,
    landing_read,
)
from pane.readers import LiveReader
from pane.showfloor import STOP_INSTANT_SEAMS, STOP_KEYS, STOPS_REACHED

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"
SHOWFLOOR_SOURCE = ROOT / "pane" / "showfloor.py"

#: A directory name no repository uses, so nothing asserted here can be
#: satisfied by a spec that happens to exist.
SPEC_DIR = "919-a-constructed-status-column"
NODE_ID = "us1"
STORY_KEY = "US1"


# --- the conditions ---------------------------------------------------------


def recorded_answer(*parts: str) -> dict:
    """One of this repository's recorded `epic_status` answers, verbatim."""
    return json.loads(FIXTURES.joinpath(*parts).read_text(encoding="utf-8"))


def answering(answer: dict):
    """`SPEC_DIR`'s epic answers `answer`; no other spec has an epic."""

    async def epic_status(asked: str) -> dict | None:
        return answer if asked == SPEC_DIR else None

    return epic_status


def evidence_store(monkeypatch, tmp_path: Path) -> Path:
    """Point ergane's evidence-store resolver at a store under `tmp_path`.

    The names of the variables and the store's filename both come from ergane
    rather than being spelt here, and `chdir` closes the resolver's last door —
    its final fallback is relative to the working directory, and a relative
    fallback resolved inside this test's own scratch tree cannot reach a store
    the operator has (`tests/test_evidence_section.py`, same reasoning).
    """
    root = tmp_path / "runtime-root"
    root.mkdir(exist_ok=True)
    monkeypatch.chdir(tmp_path)
    path = root / Path(DEFAULT_VERIFICATION_DB_PATH).name
    monkeypatch.setenv(ERGANE_VERIFICATION_DB_PATH_ENV, str(path))
    monkeypatch.delenv(FACTORY_VERIFICATION_DB_PATH_ENV, raising=False)
    return path


def verification(
    attempt: int, started_at: str, finished_at: str, verdict: OverallVerdict
) -> VerificationResult:
    """One recorded verification of `NODE_ID`, bracketed by its own interval.

    `started_at` and `finished_at` are deliberately far apart: a stop that took
    the wrong end of the bracket, or a middle of it, is visible in an assertion
    rather than plausible.
    """
    return VerificationResult(
        epic_id=SPEC_DIR,
        node_id=NODE_ID,
        attempt=attempt,
        form=VerificationForm.PHASE,
        gate_results=[
            GateResult(
                name="test",
                command="uv run pytest -q",
                status=GateStatus.PASS,
                exit_code=0,
                duration_s=11.5,
                output_tail=None,
                concurrent_gates=1,
            )
        ],
        output_check=OutputCheck(
            write_scope="worktree",
            has_diff=True,
            expected_artifacts=[],
            artifacts_present=None,
            passed=True,
        ),
        judge=None,
        verdict=verdict,
        judge_unavailable=False,
        criteria_drift=False,
        criteria_sha256="c" * 64,
        spec_ref=f"{SPEC_DIR}:{STORY_KEY}",
        started_at=started_at,
        finished_at=finished_at,
    )


#: Two attempts of one node, the second an hour after the first.  The `verifying`
#: stop is reached once — at the first — and the second is here so that a stop
#: taking "the latest attempt" instead is a failing assertion and not a coin
#: toss.
FIRST = verification(1, "2026-08-25T18:00:00Z", "2026-08-25T18:10:15Z", OverallVerdict.FAIL)
SECOND = verification(2, "2026-08-25T19:02:00Z", "2026-08-25T19:03:31Z", OverallVerdict.PASS)


def record(path: Path, *results: VerificationResult) -> None:
    """Write `results` through ergane's own writer, schema and all."""
    conn = verify_store.connect(path)
    try:
        for result in results:
            verify_store.upsert_result(conn, result)
    finally:
        conn.close()


def story_of(entry: dict, story_key: str = STORY_KEY) -> dict:
    return next(story for story in entry["stories"] if story["story_key"] == story_key)


def stops_of(entry: dict, story_key: str = STORY_KEY) -> dict[str, dict]:
    return {stop["key"]: stop for stop in story_of(entry, story_key)["ladder"]["stops"]}


def entry_for(monkeypatch, tmp_path: Path, answer: dict, **overrides) -> dict:
    """The rail entry for `SPEC_DIR`, with both seams bound to this test's own
    conditions: a store under `tmp_path` read through the pane's reader, and a
    recorded live answer."""
    path = evidence_store(monkeypatch, tmp_path)
    record(path, FIRST, SECOND)
    corpus = build_corpus(tmp_path, SpecFixture(SPEC_DIR, state="ready"))
    reader = LiveReader(corpus.specs_root)
    return corpus.entry(
        SPEC_DIR,
        epic_status=answering(answer),
        node_history=reader.node_history,
        **overrides,
    )


# --- US3-S1: a stop a seam timed shows that seam's instant (FR-011) ---------


def test_the_verifying_stop_shows_the_instant_the_evidence_store_recorded(
    monkeypatch, tmp_path
):
    """US3-S1, FR-011: the store's own `started_at`, on the stop it belongs to.

    The answer is the recorded one for a node that has PASSED, so `verifying` is
    behind it and `merged` is still ahead — the instant lands on the stop the
    work reached and nowhere else.
    """
    answer = recorded_answer("epic-status", "question", "04-RUNNING_us1-PASSED.json")
    entry = entry_for(monkeypatch, tmp_path, answer)
    stops = stops_of(entry)

    # The seam's own value, asked for rather than typed: what `node_history`
    # returned for the first attempt is what the stop carries.
    attempts = story_of(entry)["evidence"]["attempts"]
    assert [attempt["attempt"] for attempt in attempts] == [1, 2]
    assert stops["verifying"]["at"] == attempts[0]["started_at"] == FIRST.started_at
    assert stops["verifying"]["status"] == "done"

    # And it is the stop that was reached: nothing ahead of the work is stamped.
    assert stops["merged"]["status"] == "ahead"
    assert stops["merged"]["at"] is None


def test_the_merged_stop_shows_the_queues_own_observation(monkeypatch, tmp_path):
    """US3-S1, FR-011: `landing_history`'s `MERGED` entry, where the branch was
    not read at all — which is every build with no landing reader (009)."""
    answer = recorded_answer("epic-status", "question", "07-COMPLETED_us1-MERGED.json")
    entry = entry_for(monkeypatch, tmp_path, answer)
    stops = stops_of(entry)

    observed = [
        outcome["at"]
        for outcome in answer["nodes"][NODE_ID]["landing_history"]
        if outcome["outcome"] == "MERGED"
    ]
    assert observed, "the recorded answer must carry the queue's own observation"
    assert stops["merged"]["at"] == observed[-1]
    assert stops["verifying"]["at"] == FIRST.started_at


def test_the_branch_keeps_merged_where_both_seams_answer(monkeypatch, tmp_path):
    """FR-011 with two seams for one event: the branch answers first.

    `DetailPane.stepsOf` prefers `stop.at` over the queue's history for exactly
    this stop, so the document layering the two the other way round would make
    the pane and the document name two instants for one landing.
    """
    answer = recorded_answer("epic-status", "question", "07-COMPLETED_us1-MERGED.json")
    facts = landing_facts_for(SPEC_DIR, [STORY_KEY], merged_at="2026-08-25T15:36:32Z")
    entry = entry_for(
        monkeypatch,
        tmp_path,
        answer,
        landing_facts=landing_read({SPEC_DIR: facts}),
    )
    stops = stops_of(entry)

    queue_said = answer["nodes"][NODE_ID]["landing_history"][-1]["at"]
    assert stops["merged"]["at"] == facts[STORY_KEY].merged_at
    assert stops["merged"]["at"] != queue_said


# --- US3-S2: a stop no seam records (FR-012) -------------------------------


def test_the_four_stops_no_seam_records_stay_empty_for_the_rooms_dash(
    monkeypatch, tmp_path
):
    """US3-S2, FR-012: `ready`, `building`, `pr open` and `queue` carry nothing.

    Asserted on a story that has been all the way through: every seam this pane
    rides has said everything it has to say about it, and these four stops are
    still null.  `DetailPane` draws `—` for a null on a stop that was reached
    (`web/src/showfloor/DetailPane.tsx`), which is the answer FR-012 asks for —
    a recorded gap rather than a silence.
    """
    answer = recorded_answer("epic-status", "question", "07-COMPLETED_us1-MERGED.json")
    entry = entry_for(monkeypatch, tmp_path, answer)
    stops = stops_of(entry)

    unrecorded = [key for key, seam in STOP_INSTANT_SEAMS.items() if seam is None]
    assert unrecorded == ["ready", "building", "pr_open", "queue"]
    for key in unrecorded:
        assert stops[key]["at"] is None, key
        # Reached, so the room draws its dash rather than nothing at all.
        assert stops[key]["status"] in STOPS_REACHED, key


def test_the_seam_table_answers_for_every_stop_the_ladder_has():
    """FR-012's other half: the table names all six, in the ladder's own order,
    so a seventh stop cannot arrive with no answer about its instant."""
    assert tuple(STOP_INSTANT_SEAMS) == STOP_KEYS
    assert [key for key, seam in STOP_INSTANT_SEAMS.items() if seam is not None] == [
        "verifying",
        "merged",
    ]


# --- US3-S3: a stop the work has not reached (FR-013) ----------------------


def test_a_stop_the_story_has_not_reached_carries_no_time(monkeypatch, tmp_path):
    """US3-S3, FR-013: no instant on a stop the work has not got to.

    The sharp case, and the reason the rule is not "fill it if a seam has one":
    this node is building its second attempt, and the store holds the first
    attempt's verification.  An instant is available; `verifying` is ahead of
    the work; the ladder shows nothing rather than dating a stop the room draws
    as unreached.
    """
    answer = recorded_answer("epic-status", "question", "02-RUNNING_us1-RUNNING.json")
    entry = entry_for(monkeypatch, tmp_path, answer)
    stops = stops_of(entry)

    # The seam really did answer — the emptiness below is the rule, not a store
    # nobody could read.
    assert story_of(entry)["evidence"]["attempts"], "the store must hold a verification"

    assert stops["building"]["status"] == "active"
    for key in ("verifying", "pr_open", "queue", "merged"):
        assert stops[key]["status"] == "ahead", key
        assert stops[key]["at"] is None, key


def test_the_unrecorded_and_the_unreached_are_told_apart(monkeypatch, tmp_path):
    """US3-S2 against US3-S3: both are null, and the pair says which is which.

    The document carries one `at` and one `status` per stop, and the room reads
    them together: a null on a reached stop draws `—`, a null on an `ahead` stop
    draws nothing.  So the two absences are distinguishable without the pane
    inventing a third value for "no seam".
    """
    merged = recorded_answer("epic-status", "question", "07-COMPLETED_us1-MERGED.json")
    running = recorded_answer("epic-status", "question", "02-RUNNING_us1-RUNNING.json")

    second = tmp_path / "second"
    second.mkdir()

    unrecorded = stops_of(entry_for(monkeypatch, tmp_path, merged))["building"]
    unreached = stops_of(entry_for(monkeypatch, second, running))["verifying"]

    assert (unrecorded["at"], unrecorded["status"]) == (None, "done")
    assert (unreached["at"], unreached["status"]) == (None, "ahead")


# --- US3-S4: the seam's own value, never another stop's (FR-014) -----------


def test_no_stop_carries_a_value_that_belongs_to_another(monkeypatch, tmp_path):
    """US3-S4, FR-014: every instant shown is one a seam wrote, on its own stop.

    Two traps the plan names, both refused here: `merged` is not the attempt's
    end, and `verifying` is not the merge time counted backwards.  The check is
    made against the whole set of instants the seams recorded, so a stop that
    took *any* other record's value fails whether or not it happens to look
    plausible.
    """
    answer = recorded_answer("epic-status", "question", "07-COMPLETED_us1-MERGED.json")
    entry = entry_for(monkeypatch, tmp_path, answer)
    stops = stops_of(entry)

    queue_said = answer["nodes"][NODE_ID]["landing_history"][-1]["at"]
    shown = {key: stop["at"] for key, stop in stops.items() if stop["at"] is not None}

    assert shown == {"verifying": FIRST.started_at, "merged": queue_said}

    # The ends of a verification bracket a verification, not a stop: neither is
    # on the ladder anywhere (013's own warning, kept true here).
    ends = {FIRST.finished_at, SECOND.finished_at, SECOND.started_at}
    assert ends.isdisjoint(shown.values())


def test_a_rejection_the_queue_recorded_never_stamps_the_merge(monkeypatch, tmp_path):
    """US3-S4, FR-014 inside one seam.

    `landing_history` records five outcomes and only `MERGED` is a stop being
    reached — the other four are things that happened *at* the queue and left
    the landing where it was.  A landing rejected once and recovered carries
    both entries, and the `merged` stop takes the merge's own instant and not
    the first thing in the list.  The rejection is composed through ergane's own
    `ObservedOutcome`, so its shape is the contract's rather than this file's.
    """
    answer = copy.deepcopy(
        recorded_answer("epic-status", "question", "07-COMPLETED_us1-MERGED.json")
    )
    node = answer["nodes"][NODE_ID]
    merged = node["landing_history"][-1]
    rejected = dataclasses.asdict(
        ObservedOutcome(
            at="2026-08-22T16:02:11Z",
            outcome=QueueOutcome.CHECKS_FAILED,
            failing_checks=("test",),
        )
    )
    node["landing_history"] = [rejected, merged]

    stops = stops_of(entry_for(monkeypatch, tmp_path, answer))

    assert stops["merged"]["at"] == merged["at"]
    assert rejected["at"] not in {stop["at"] for stop in stops.values()}


def test_the_document_never_computes_an_instant():
    """FR-014 structurally: nothing in the assembly can do date arithmetic.

    A stop's instant is a string copied from the record that holds it, and the
    module that assembles the document imports no clock and no date library to
    do anything else with — so "derived from another stop" is not a discipline
    the reviewer has to re-check line by line.
    """
    tree = ast.parse(SHOWFLOOR_SOURCE.read_text(encoding="utf-8"))
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split(".")[0])

    assert imported.isdisjoint({"datetime", "time", "calendar", "zoneinfo"})
