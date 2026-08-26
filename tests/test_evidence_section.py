"""The gate run reaches the document, or says why it did not (013 US1).

Three claims, one per acceptance scenario, all made over a store this file
builds under its own `tmp_path`:

* **US1-S1** — the assembled document carries each attempt's gates (name,
  status, exit code, duration, concurrency), the ladder summary the attempt ran
  under, and the judge's per-scenario findings, read through
  `factory.verify.store.node_history` over `connect_readonly` (FR-001, D-020).
* **US1-S2** — a store that cannot be read degrades *inside* the evidence
  section, naming the read, and the rest of the document is byte-identical to
  what it would have been with no evidence read at all (FR-002).
* **US1-S3** — model and persona render unknown, and the persona registry is
  never consulted: proved twice, by a source sweep and by making a call to it
  raise (FR-003).

**Nothing here pins the live corpus.**  `tests/corpus.py` writes the specs, the
graph and the frontmatter into a scratch tree, and this file writes the
evidence store beside them through ergane's own writer — so no assertion below
moves when the operator attests a spec, archives a graph, or re-dispatches an
epic (008 US1, and 013's plan trap "the corpus tests must not pin the live
corpus").  The store is written with `factory.verify.store.upsert_result` and
read with the seam the pane reads it with, so what is proved is the wiring and
not a stand-in for it.
"""

from __future__ import annotations

import ast
import copy
from pathlib import Path

import pytest
from factory.activities.verify_activities import DEFAULT_VERIFICATION_DB_PATH
from factory.env import (
    ERGANE_VERIFICATION_DB_PATH_ENV,
    FACTORY_VERIFICATION_DB_PATH_ENV,
)
from factory.verify import store as verify_store
from factory.verify.models import (
    GateResult,
    GateStatus,
    JudgeOutcome,
    JudgeScenarioFinding,
    JudgeVerdict,
    OutputCheck,
    OverallVerdict,
    VerificationConfig,
    VerificationForm,
    VerificationResult,
    loop_summary,
)

from corpus import SpecFixture, build_corpus, entry_for
from pane.fixture_floor import FixtureReader
from pane.readers import (
    EVIDENCE_READ,
    LiveReader,
    QueryRefused,
    TransportFailed,
    UnconfiguredReader,
)
from pane.showfloor import EVIDENCE_UNKNOWN

ROOT = Path(__file__).resolve().parents[1]
PANE = ROOT / "pane"

#: The spec the constructed corpus carries, and the story the evidence is
#: written for.  A directory name no repository uses, so nothing here can be
#: satisfied by a spec that happens to exist.
SPEC_DIR = "910-a-constructed-gate-run"
NODE_ID = "us1"
STORY_KEY = "US1"

#: A marker planted in every `output_tail` this file writes.  US1 carried none
#: of them into the document; US2 carries the *failing* ones, swept (013 D4,
#: FR-006).  Finding this string on a gate that passed would mean the room had
#: been handed output it may not render.
PLANTED_TAIL = "tail-marker-from-a-gate-that-really-ran"


# --- the store this file builds -------------------------------------------


def evidence_store(monkeypatch, tmp_path: Path) -> Path:
    """Point ergane's evidence-store resolver at a store under `tmp_path`.

    The pane resolves this path through ergane's own `resolve_env_path` chain,
    so the way to hand it a store this test owns is to set the variables that
    chain reads.  The variable *names* and the store's *filename* both come from
    ergane rather than being spelt here: a distribution that renames either
    should move this test with it, not leave it quietly reading the operator's
    machine (`tests/test_readonly_sweep.py`'s `runtime_root`, same reasoning).

    The legacy name is cleared for the same reason `runtime_root` clears it, and
    `chdir` closes the last door: the resolver's final fallback is relative to
    the working directory, and a relative fallback resolved inside this test's
    own scratch tree cannot reach a store the operator has.
    """
    root = tmp_path / "runtime-root"
    root.mkdir(exist_ok=True)
    monkeypatch.chdir(tmp_path)
    path = root / Path(DEFAULT_VERIFICATION_DB_PATH).name
    monkeypatch.setenv(ERGANE_VERIFICATION_DB_PATH_ENV, str(path))
    monkeypatch.delenv(FACTORY_VERIFICATION_DB_PATH_ENV, raising=False)
    return path


def gate(
    name: str,
    status: GateStatus,
    exit_code: int | None,
    duration_s: float,
    concurrent_gates: int,
) -> GateResult:
    """One recorded gate command, with a marker where the tail goes."""
    return GateResult(
        name=name,
        command=f"uv run {name} -q",
        status=status,
        exit_code=exit_code,
        duration_s=duration_s,
        output_tail=PLANTED_TAIL,
        concurrent_gates=concurrent_gates,
    )


#: The ladder every attempt below ran under, composed by ergane's own
#: `loop_summary` rather than typed out: the one line the section shows above
#: the gates is the factory's sentence, not this repository's (FR-001).
LADDER = loop_summary(
    VerificationConfig(),
    ("gates", "diff_check", "judge"),
    ("test", "typecheck", "unit", "smoke"),
)

PASSING_CHECK = OutputCheck(
    write_scope="worktree",
    has_diff=True,
    expected_artifacts=[],
    artifacts_present=None,
    passed=True,
)


def failed_attempt() -> VerificationResult:
    """Attempt 1: two gates ran together, one of them failed, the judge did not.

    `judge=None` is the store's word for "the judge never ran" — a failing gate
    means asking one could not change the outcome — and it is a different fact
    from a judge that ran and disagreed.
    """
    return VerificationResult(
        epic_id=SPEC_DIR,
        node_id=NODE_ID,
        attempt=1,
        form=VerificationForm.PHASE,
        gate_results=[
            gate("test", GateStatus.PASS, 0, 12.5, 1),
            gate("typecheck", GateStatus.FAIL, 2, 3.25, 1),
            gate("smoke", GateStatus.TIMEOUT, None, 600.0, 0),
        ],
        output_check=PASSING_CHECK,
        judge=None,
        verdict=OverallVerdict.FAIL,
        judge_unavailable=False,
        criteria_drift=False,
        criteria_sha256="a" * 64,
        spec_ref=f"{SPEC_DIR}:{STORY_KEY}",
        started_at="2026-08-25T18:00:00Z",
        finished_at="2026-08-25T18:10:15Z",
        loop_summary=LADDER,
        loop_digest="d" * 64,
    )


def judged_attempt() -> VerificationResult:
    """Attempt 2: every gate green, and the judge with one finding per scenario."""
    return VerificationResult(
        epic_id=SPEC_DIR,
        node_id=NODE_ID,
        attempt=2,
        form=VerificationForm.PHASE,
        gate_results=[
            gate("test", GateStatus.PASS, 0, 11.0, 2),
            gate("typecheck", GateStatus.PASS, 0, 4.0, 2),
            gate("smoke", GateStatus.PASS, 0, 41.5, 2),
        ],
        output_check=PASSING_CHECK,
        judge=JudgeVerdict(
            outcome=JudgeOutcome.RETRY,
            findings=[
                JudgeScenarioFinding(
                    scenario=f"{STORY_KEY}-S1",
                    passed=True,
                    reasoning="the diff carries the read and the section that draws it",
                ),
                JudgeScenarioFinding(
                    scenario=f"{STORY_KEY}-S2",
                    passed=False,
                    reasoning="the degraded path names the section but not the read",
                ),
            ],
            feedback="name the read in the note",
            judge_attempt=1,
            truncated_input=False,
            model_alias="judge-of-record",
        ),
        verdict=OverallVerdict.FAIL,
        judge_unavailable=False,
        criteria_drift=False,
        criteria_sha256="b" * 64,
        spec_ref=f"{SPEC_DIR}:{STORY_KEY}",
        started_at="2026-08-25T18:30:00Z",
        finished_at="2026-08-25T18:31:02Z",
        loop_summary=LADDER,
        loop_digest="d" * 64,
    )


def record(path: Path, *results: VerificationResult) -> None:
    """Write `results` through ergane's own writer, schema and all."""
    conn = verify_store.connect(path)
    try:
        for result in results:
            verify_store.upsert_result(conn, result)
    finally:
        conn.close()


def corpus_for(tmp_path: Path):
    """A one-spec corpus in a scratch tree, cut from the recorded material."""
    return build_corpus(tmp_path, SpecFixture(SPEC_DIR, state="ready"))


def story_of(entry: dict, story_key: str) -> dict:
    return next(story for story in entry["stories"] if story["story_key"] == story_key)


# --- US1-S1: the evidence reaches the document ----------------------------


def test_the_document_carries_the_gates_the_ladder_and_the_findings(monkeypatch, tmp_path):
    """Both attempts, every gate fact US1-S1 names, the ladder, the findings."""
    path = evidence_store(monkeypatch, tmp_path)
    record(path, failed_attempt(), judged_attempt())
    corpus = corpus_for(tmp_path)
    reader = LiveReader(corpus.specs_root)

    entry = corpus.entry(SPEC_DIR, node_history=reader.node_history)
    evidence = story_of(entry, STORY_KEY)["evidence"]

    assert evidence["note"] is None
    assert [attempt["attempt"] for attempt in evidence["attempts"]] == [1, 2]

    first, second = evidence["attempts"]

    # The five gate facts the scenario enumerates, per gate, in the order the
    # attempt recorded them.
    assert [(g["name"], g["status"], g["exit_code"], g["duration_s"], g["concurrent_gates"])
            for g in first["gates"]] == [
        ("test", "PASS", 0, 12.5, 1),
        ("typecheck", "FAIL", 2, 3.25, 1),
        # A gate that hit its deadline has no exit to read; null, never a zero.
        ("smoke", "TIMEOUT", None, 600.0, 0),
    ]
    assert [g["command"] for g in first["gates"]] == [
        "uv run test -q", "uv run typecheck -q", "uv run smoke -q"
    ]

    # The ladder the attempt ran under, verbatim as ergane composed it.
    assert first["loop_summary"] == LADDER
    assert second["loop_summary"] == LADDER

    # The judge: one finding per scenario, each with its own reasoning, and
    # `None` where the judge never ran at all.
    assert first["judge"] is None
    assert [(f["scenario"], f["passed"]) for f in second["judge"]["findings"]] == [
        (f"{STORY_KEY}-S1", True),
        (f"{STORY_KEY}-S2", False),
    ]
    assert second["judge"]["findings"][1]["reasoning"].startswith("the degraded path")
    assert second["judge"]["outcome"] == "RETRY"

    # The interval is the *verification's* — the store cannot support a story's
    # wall clock and this document does not claim one.
    assert first["started_at"] == "2026-08-25T18:00:00Z"
    assert first["finished_at"] == "2026-08-25T18:10:15Z"
    assert "wall_clock" not in first


def test_the_read_is_the_seam_over_a_read_only_connection(monkeypatch, tmp_path):
    """`node_history` over `connect_readonly`, on the configured path, once.

    D-020 grants exactly this function, so the whole of the pane's evidence read
    must be a call to it: no query of this repository's own, no second opener,
    and the path taken from ergane's resolver rather than from anywhere else
    (T001, T002).
    """
    path = evidence_store(monkeypatch, tmp_path)
    record(path, judged_attempt())
    opened: list[str] = []
    asked: list[tuple[str, str]] = []

    real_connect = verify_store.connect_readonly
    real_history = verify_store.node_history

    def spy_connect(target):
        opened.append(str(target))
        return real_connect(target)

    def spy_history(conn, epic_id, node_id):
        asked.append((epic_id, node_id))
        return real_history(conn, epic_id, node_id)

    monkeypatch.setattr(verify_store, "connect_readonly", spy_connect)
    monkeypatch.setattr(verify_store, "node_history", spy_history)

    rows = LiveReader(tmp_path / "specs").node_history(SPEC_DIR, NODE_ID)

    assert opened == [str(path)]
    assert asked == [(SPEC_DIR, NODE_ID)]
    assert [row["attempt"] for row in rows] == [2]


def test_a_node_with_no_recorded_verification_is_an_answer(monkeypatch, tmp_path):
    """An empty history is an answer, and it is not a failed read.

    The two must stay apart: a story nothing has verified renders no section at
    all, and a store that could not be opened renders a sentence saying so
    (FR-010 against FR-002).  Both are checked here against the same store.
    """
    path = evidence_store(monkeypatch, tmp_path)
    record(path, judged_attempt())
    corpus = corpus_for(tmp_path)
    reader = LiveReader(corpus.specs_root)

    entry = corpus.entry(SPEC_DIR, node_history=reader.node_history)
    untouched = story_of(entry, "US2")["evidence"]

    assert untouched == {"attempts": [], "note": None}


def test_no_passing_gate_carries_a_tail_into_the_document(monkeypatch, tmp_path):
    """The half of US1's tail rule that outlives US1 (013 FR-006).

    US1 asserted that *no* gate carried its tail, because the sweep that guards
    one had not been written yet and the document was the wrong side of it.  US2
    wrote the sweep, and a failing gate's tail now arrives through it — so what
    is asserted here is the part that is permanent: **a gate that passed carries
    none**, whatever it printed.  Every gate written above has `PLANTED_TAIL` in
    its `output_tail`, so a passing gate that carried one would be found here
    however the rule was spelt, and `tests/test_gate_tail_sweep.py` owns the
    other half.
    """
    path = evidence_store(monkeypatch, tmp_path)
    record(path, failed_attempt(), judged_attempt())
    corpus = corpus_for(tmp_path)
    reader = LiveReader(corpus.specs_root)

    entry = corpus.entry(SPEC_DIR, node_history=reader.node_history)
    gates = [
        gate
        for attempt in story_of(entry, STORY_KEY)["evidence"]["attempts"]
        for gate in attempt["gates"]
    ]
    passing = [gate for gate in gates if gate["status"] == "PASS"]

    # A sweep over nothing passes for the wrong reason: attempt 2 is all green.
    assert len(passing) >= 4
    for gate in passing:
        assert gate["output_tail"] is None, f"{gate['name']} carried a tail it passed with"

    # And the ones that did not pass carry theirs, marker and all.
    failing = [gate for gate in gates if gate["status"] != "PASS"]
    assert failing
    for gate in failing:
        assert PLANTED_TAIL in (gate["output_tail"] or "")


# --- US1-S2: the read degrades in its own section -------------------------


def strip_evidence(document: dict) -> dict:
    """`document` with every story's evidence section removed."""
    without = copy.deepcopy(document)
    for entry in without["rail"]:
        for story in entry["stories"]:
            story.pop("evidence")
    return without


def test_an_unreadable_store_degrades_in_section_and_nowhere_else(monkeypatch, tmp_path):
    """The note is in the section, naming the read; nothing else moves.

    Proved two ways.  Positively: every story's evidence carries one
    `{read, mode, detail}` note whose `read` is the seam's own name and whose
    `mode` tells transport from refusal.  Negatively: the same document
    assembled with no evidence read at all is identical everywhere else — same
    ladders, same facts, same landing cells, same rail chip, and an empty
    `notes`/`degraded` pair, because a store the pane cannot open does not make
    the epic's state unknown (FR-002).
    """
    path = evidence_store(monkeypatch, tmp_path)
    assert not path.exists(), "the failure this test needs is the store's absence"
    corpus = corpus_for(tmp_path)
    reader = LiveReader(corpus.specs_root)

    degraded = corpus.assemble(node_history=reader.node_history)
    entry = entry_for(degraded, SPEC_DIR)

    for story in entry["stories"]:
        note = story["evidence"]["note"]
        assert note is not None, f"{story['story_key']} says nothing about the read"
        assert note["read"] == EVIDENCE_READ
        assert note["mode"] == "transport"
        assert str(path) in note["detail"]
        assert story["evidence"]["attempts"] == []

    # The other sections of the same story are intact, not blanked.
    story = story_of(entry, STORY_KEY)
    assert story["title"]
    assert story["ladder"]["stop_key"] == "ready"
    assert story["requirement_keys"]

    # And the rail entry is not degraded by it: `notes` is the room's word for
    # "this entry could not be assembled", and this entry was.
    assert entry["notes"] == []
    assert degraded["degraded"] == []

    # Everything but the evidence section is what it would have been.
    assert strip_evidence(degraded) == strip_evidence(corpus.assemble())


def test_a_refused_read_is_told_apart_from_a_missing_store(monkeypatch, tmp_path):
    """001's two modes reach the section unchanged (constitution III).

    A store that answered with an error is a refusal, and a section that called
    both "unavailable" would be the pane flattening the one distinction the 052
    doctrine turns on.
    """
    corpus = corpus_for(tmp_path)

    def refuse(epic_id: str, node_id: str) -> list[dict]:
        raise QueryRefused(EVIDENCE_READ, "no such column: concurrent_gates")

    entry = corpus.entry(SPEC_DIR, node_history=refuse)
    note = story_of(entry, STORY_KEY)["evidence"]["note"]

    assert note == {
        "read": EVIDENCE_READ,
        "mode": "refusal",
        "detail": "no such column: concurrent_gates",
    }
    assert entry["notes"] == []


def test_one_story_failing_leaves_its_neighbours_alone(monkeypatch, tmp_path):
    """A read that fails for one node fails for that node only (FR-002)."""
    corpus = corpus_for(tmp_path)

    def read(epic_id: str, node_id: str) -> list[dict]:
        if node_id == NODE_ID:
            raise TransportFailed(EVIDENCE_READ, "unable to open database file")
        return []

    entry = corpus.entry(SPEC_DIR, node_history=read)

    assert story_of(entry, STORY_KEY)["evidence"]["note"] is not None
    for story in entry["stories"]:
        if story["story_key"] != STORY_KEY:
            assert story["evidence"] == {"attempts": [], "note": None}


# --- US1-S3: unknown, and never resolved from the registry ----------------


def test_model_and_persona_render_unknown(monkeypatch, tmp_path):
    """Null on every attempt, and named in `unknown` rather than left blank.

    The store has eighteen columns and none of them is the model an attempt ran
    on or the persona it ran as.  A blank cell would read as "nothing to say";
    naming both in `unknown` is the section saying *which two facts* it does not
    have (constitution III's Unknown Rule, 013 FR-003).
    """
    path = evidence_store(monkeypatch, tmp_path)
    record(path, failed_attempt(), judged_attempt())
    corpus = corpus_for(tmp_path)
    reader = LiveReader(corpus.specs_root)

    entry = corpus.entry(SPEC_DIR, node_history=reader.node_history)
    attempts = story_of(entry, STORY_KEY)["evidence"]["attempts"]

    assert attempts, "this test needs attempts to make its claim about"
    for attempt in attempts:
        assert attempt["model"] is None
        assert attempt["persona"] is None
        assert attempt["unknown"] == list(EVIDENCE_UNKNOWN) == ["model", "persona"]

    # The judge's own alias is a different fact and keeps its own key: it was
    # recorded by the run that used it, and it is never the attempt's model.
    assert attempts[1]["judge"]["model_alias"] == "judge-of-record"


def test_assembling_the_document_consults_no_persona_registry(monkeypatch, tmp_path):
    """A registry read during assembly is made to fail loudly, and none happens.

    `factory.config` *is* the persona registry — "the one place a model name is
    allowed to appear", by its own first line.  Making its loader raise turns
    any lookup on the assembly path into a failure of this test, which is a
    stronger claim than a source sweep alone: it covers the code the pane calls
    as well as the code it contains.
    """
    import factory.config

    def refuse(*args, **kwargs):
        raise AssertionError(
            "the pane resolved a persona from the registry; the DEBUGGER rung "
            "relabels a persona without re-resolving its model alias, so the "
            "registry disagrees with reality on the attempt being read (D2)"
        )

    monkeypatch.setattr(factory.config, "load_personas", refuse)
    monkeypatch.setattr(factory.config, "resolve_default_registry_path", refuse)

    path = evidence_store(monkeypatch, tmp_path)
    record(path, judged_attempt())
    corpus = corpus_for(tmp_path)
    reader = LiveReader(corpus.specs_root)

    document = corpus.assemble(node_history=reader.node_history)
    assert entry_for(document, SPEC_DIR)["stories"]


def test_no_pane_module_reaches_for_the_persona_registry():
    """Nothing under `pane/` imports the registry or names its file (FR-003).

    The module and the filename are both asked of ergane rather than spelt here,
    for the reason `runtime_root` gives about variable names: a distribution
    that renames either should move this guard with it rather than leave it
    passing over a name that no longer exists.
    """
    import factory.config

    registry_module = factory.config.__name__
    registry_file = factory.config.REGISTRY_FILENAME

    for path in sorted(PANE.rglob("*.py")):
        source = path.read_text(encoding="utf-8")
        assert registry_file not in source, f"{path}: names {registry_file}"

        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    assert alias.name != registry_module, f"{path}: imports {registry_module}"
            if isinstance(node, ast.ImportFrom):
                assert node.module != registry_module, (
                    f"{path}: imports from {registry_module}"
                )
                if node.module == "factory":
                    names = {alias.name for alias in node.names}
                    assert "config" not in names, f"{path}: imports factory's config"


# --- the seam exists on every reader --------------------------------------


def test_every_reader_implements_the_evidence_read():
    """The protocol gained a method, so all three implementations did too.

    A reader missing it would raise `AttributeError` out of the assembly — an
    exception `assemble_showfloor` does not catch and must never have to.
    """
    for implementation in (LiveReader, FixtureReader, UnconfiguredReader):
        assert callable(getattr(implementation, "node_history", None)), implementation


def test_the_unconfigured_build_says_so_in_the_reads_own_name():
    with pytest.raises(TransportFailed) as raised:
        UnconfiguredReader().node_history(SPEC_DIR, NODE_ID)
    assert raised.value.read == EVIDENCE_READ


def test_the_fixture_floor_degrades_rather_than_inventing_a_gate_run(tmp_path):
    """No verification document is recorded, so the demo floor says so.

    Constitution V: the fixture floor is captured from a real factory and an
    evidence store is written on the operator's host by a real build.  Until one
    is recorded the read takes `load_document`'s missing-document rule, which is
    a degraded read in words — never an invented gate run and never an empty
    history standing in for one.
    """
    reader = FixtureReader(ROOT / "fixtures")
    with pytest.raises(TransportFailed) as raised:
        reader.node_history(SPEC_DIR, NODE_ID)
    assert raised.value.read == EVIDENCE_READ
