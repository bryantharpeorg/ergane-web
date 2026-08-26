"""Each exported checker answers in its own name (014 US2).

One claim per acceptance scenario, over spec directories this file builds under
its own `tmp_path`:

* **US2-S1** — a `## Work Graph` that compiles reports success, and the answer
  is attributed to `derive_workgraph` (FR-006).
* **US2-S2** — one that does not compile carries the `DerivationError`'s own
  message, byte for byte, and every check that would need the graph it did not
  produce reports **not run** rather than a failure (FR-007).
* **US2-S3** — with a graph and a `tasks.md`, slice coverage and prompt assembly
  each render their own answer under their own name (FR-008).
* **US2-S4** — the document carries no composite verdict of any kind and says,
  in words, that `ergane spec validate`'s verdict is not available to the pane
  (FR-009).  The view's half of that claim is `web/tests/unit/Draft.test.tsx`.
* **US2-S5** — a spec with no `tasks.md` — the shape most of this corpus has —
  reports the checks that need one as not run, and never as refused (FR-010).

**Attribution is asserted against the functions themselves**, not against string
literals this file also wrote: `DERIVE_WORKGRAPH == derive_workgraph.__name__`.
A rename in the distribution moves the assertion, which is the point — an answer
attributed to a name nothing exports is an answer attributed to the pane.

**Nothing here pins the live corpus** (008 US1, and this spec's plan trap).  The
spec directory names are ones no repository uses and every document's text is
written by the test that asserts it.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from factory.workgraph.derive import DerivationError, derive_workgraph
from factory.workgraph.preflight import check_prompt_assembly, check_slice_coverage
from fastapi.testclient import TestClient

from pane.app import create_app
from pane.checks import (
    CHECK_PROMPT_ASSEMBLY,
    CHECK_SLICE_COVERAGE,
    DERIVE_WORKGRAPH,
    NOT_RUN,
    PASSED,
    REFUSED,
    SEAMS,
)
from pane.config import Settings
from pane.draft import read_draft

#: A directory name no repository uses, so nothing below can be satisfied by a
#: spec that happens to exist.
SPEC_DIR = "921-a-constructed-check"

#: A spec whose `## Work Graph` compiles: two stories, each declaring the
#: requirement it implements, the second waiting for the first to merge.  Short
#: on purpose — every line is here because the deriver needs it, so a rejection
#: is never ambiguous about which line caused it.
SPEC = """# Feature Specification: A constructed check

## User Scenarios & Testing

### User Story 1 - The first story (Priority: P1)

As an operator, I read.

**Acceptance Scenarios**:

1. **Given** a thing, **When** it happens, **Then** it is so (FR-001).

---

### User Story 2 - The second story (Priority: P2)

As an operator, I check.

**Acceptance Scenarios**:

1. **Given** a thing, **When** it happens, **Then** it is so (FR-002).

## Requirements

### Functional Requirements

- **FR-001**: The first thing MUST happen.
- **FR-002**: The second thing MUST happen.

## Work Graph

```yaml
US1:
  depends_on: []
  depends_on_merged: []
  implements: [FR-001]
  timeout: 3600
US2:
  depends_on: []
  depends_on_merged: [US1]
  implements: [FR-002]
  timeout: 3600
```
"""

#: The same spec with one declaration renamed to a story it does not declare.
#: Two rejections fall out of the one edit — the node for a story that is not
#: there, and the story with no node — which is what makes this the right shape
#: for asserting that the whole collected message rides through.
BROKEN_SPEC = SPEC.replace("US2:\n  depends_on: []", "US7:\n  depends_on: []")

PLAN = "# Implementation Plan: A constructed check\n\nBuild it.\n"

#: A `tasks.md` whose phase headings name each story the way the assembler's
#: grammar requires, with every task inside its own story's slice.
TASKS = """# Tasks: A constructed check

## Phase 1: User Story 1 - The first story

- [ ] T001 [US1] Do the first thing (spec US1-S1).

## Phase 2: User Story 2 - The second story

- [ ] T002 [US2] Do the second thing (spec US2-S1).
"""

#: The same, with US2's work written into US1's phase: the silent wrong answer
#: `check_slice_coverage` exists to catch — assembly succeeds, and the node
#: building US2 is never shown the task written for it.
MISPLACED_TASKS = """# Tasks: A constructed check

## Phase 1: User Story 1 - The first story

- [ ] T001 [US1] Do the first thing (spec US1-S1).
- [ ] T002 [US2] Do the second thing, in the wrong phase (spec US2-S1).

## Phase 2: User Story 2 - The second story

- [ ] T003 [US2] Do the second thing (spec US2-S1).
"""

#: The same, plus a verification phase the operator works by hand.  The seam
#: marks those findings `informational` in its own return value, and this file
#: asserts the row reads that flag rather than counting them.
ORPHAN_TASKS = TASKS + """
## Phase 3: Verification

- [ ] T003 Run the four gates by hand.
"""

#: A `tasks.md` no phase of which names a story: every node loses its slice, and
#: the assembler refuses each one by name.
UNSLICED_TASKS = """# Tasks: A constructed check

## Phase 1: Setup

- [ ] T001 Do a thing nobody's node will ever be handed.
"""


def build_spec(root: Path, spec_dir: str = SPEC_DIR, **documents: str) -> Path:
    """A spec directory under `root` carrying exactly the documents named.

    A document whose text is not passed is not written — the way absence is
    constructed here, and the common shape in this corpus rather than an error.
    """
    path = root / spec_dir
    path.mkdir(parents=True, exist_ok=True)
    for name, text in documents.items():
        (path / name.replace("_", ".")).write_text(text, encoding="utf-8")
    return path


@pytest.fixture
def specs_root(tmp_path) -> Path:
    root = tmp_path / "specs"
    root.mkdir()
    return root


def rows(document: dict) -> dict[str, dict]:
    return {row["check"]: row for row in document["checks"]}


# --- attribution ----------------------------------------------------------


def test_every_row_is_named_for_the_function_that_answers_it():
    """FR-006/FR-008: the names are the exported functions', not this pane's."""
    assert DERIVE_WORKGRAPH == derive_workgraph.__name__
    assert CHECK_PROMPT_ASSEMBLY == check_prompt_assembly.__name__
    assert CHECK_SLICE_COVERAGE == check_slice_coverage.__name__
    # And the seam each one names is the module it is actually imported from,
    # so the attribution points somewhere an operator can go read.
    assert SEAMS[DERIVE_WORKGRAPH] == (
        f"{derive_workgraph.__module__}.{derive_workgraph.__name__}"
    )
    assert SEAMS[CHECK_PROMPT_ASSEMBLY] == (
        f"{check_prompt_assembly.__module__}.{check_prompt_assembly.__name__}"
    )
    assert SEAMS[CHECK_SLICE_COVERAGE] == (
        f"{check_slice_coverage.__module__}.{check_slice_coverage.__name__}"
    )


# --- US2-S1: a graph that compiles ----------------------------------------


def test_a_compiling_graph_reports_success_attributed_to_the_deriver(specs_root):
    """FR-006: success, under `derive_workgraph`'s own name."""
    build_spec(specs_root, spec_md=SPEC, plan_md=PLAN, tasks_md=TASKS)

    row = rows(read_draft(specs_root, SPEC_DIR))[DERIVE_WORKGRAPH]

    assert row["state"] == PASSED
    assert row["seam"] == "factory.workgraph.derive.derive_workgraph"
    assert row["findings"] == []
    assert row["not_run_because"] is None


def test_the_compiled_graph_itself_is_carried_not_described(specs_root):
    """T011: the deriver's *result*, in the shape `workgraph.json` holds.

    Compared node for node against the graph `derive_workgraph` returns when
    called directly on the same text, so the room cannot be showing a graph it
    built itself.
    """
    build_spec(specs_root, spec_md=SPEC, plan_md=PLAN, tasks_md=TASKS)

    document = read_draft(specs_root, SPEC_DIR)
    expected = derive_workgraph(
        SPEC,
        epic_id=SPEC_DIR,
        feature=SPEC_DIR,
        specs_root=str(specs_root),
        target_repo=str(Path(specs_root).resolve().parent),
        tasks_text=TASKS,
    )

    assert document["graph"] is not None
    assert [node["id"] for node in document["graph"]["nodes"]] == [
        node.id for node in expected.nodes
    ]
    assert document["graph"]["nodes"][1]["depends_on_merged"] == ["us1"]
    assert document["graph"]["epic_id"] == SPEC_DIR


def test_a_spec_with_no_tasks_still_compiles_and_says_what_went_unchecked(specs_root):
    """069-US2's contention inference needs a `tasks.md`; without one it is not
    run, and the row says so rather than letting a schedule read as checked."""
    build_spec(specs_root, spec_md=SPEC)

    row = rows(read_draft(specs_root, SPEC_DIR))[DERIVE_WORKGRAPH]

    assert row["state"] == PASSED
    assert "no `tasks.md`" in row["detail"]
    assert "no ordering edge was inferred" in row["detail"]


# --- US2-S2: a graph that does not compile --------------------------------


def test_a_derivation_error_renders_unsoftened(specs_root):
    """FR-007: the `DerivationError`'s own message, byte for byte.

    The expectation is the exception itself, raised by calling the seam on the
    same text — so a row that summarised, truncated or re-worded it fails here
    rather than reading plausibly.
    """
    build_spec(specs_root, spec_md=BROKEN_SPEC, plan_md=PLAN, tasks_md=TASKS)

    with pytest.raises(DerivationError) as raised:
        derive_workgraph(
            BROKEN_SPEC,
            epic_id=SPEC_DIR,
            feature=SPEC_DIR,
            specs_root=str(specs_root),
            target_repo=str(Path(specs_root).resolve().parent),
            tasks_text=TASKS,
        )

    row = rows(read_draft(specs_root, SPEC_DIR))[DERIVE_WORKGRAPH]

    assert row["state"] == REFUSED
    assert row["detail"] == str(raised.value)
    # And the whole collected list rides, not the first rejection: an author
    # fixing one per render is the failure mode collection exists to avoid.
    assert "US7" in row["detail"] and "US2" in row["detail"]
    assert row["detail"].count("\n  - ") == len(raised.value.rejections) == 2


def test_a_graph_that_did_not_compile_suppresses_every_dependent_check(specs_root):
    """FR-007: no other check claims a result that depends on a graph that is
    not there — and *not run* is what they claim instead, never a failure."""
    build_spec(specs_root, spec_md=BROKEN_SPEC, plan_md=PLAN, tasks_md=TASKS)

    document = read_draft(specs_root, SPEC_DIR)
    by_name = rows(document)

    for name in (CHECK_PROMPT_ASSEMBLY, CHECK_SLICE_COVERAGE):
        assert by_name[name]["state"] == NOT_RUN
        assert by_name[name]["findings"] == []
        assert by_name[name]["detail"] is None
        assert "did not compile" in by_name[name]["not_run_because"]
    # And no graph is carried, because there is none (FR-013's input).
    assert document["graph"] is None


# --- US2-S3: the two checks that take the graph ---------------------------


def test_slice_coverage_and_prompt_assembly_each_answer_in_their_own_name(specs_root):
    """FR-008: two answers, two names, neither standing in for the other."""
    build_spec(specs_root, spec_md=SPEC, plan_md=PLAN, tasks_md=TASKS)

    by_name = rows(read_draft(specs_root, SPEC_DIR))

    assert [row["check"] for row in read_draft(specs_root, SPEC_DIR)["checks"]] == [
        DERIVE_WORKGRAPH,
        CHECK_PROMPT_ASSEMBLY,
        CHECK_SLICE_COVERAGE,
    ]
    assert by_name[CHECK_PROMPT_ASSEMBLY]["state"] == PASSED
    assert by_name[CHECK_PROMPT_ASSEMBLY]["seam"].endswith("check_prompt_assembly")
    assert by_name[CHECK_SLICE_COVERAGE]["state"] == PASSED
    assert by_name[CHECK_SLICE_COVERAGE]["seam"].endswith("check_slice_coverage")


def test_prompt_assembly_carries_the_assembler_s_own_refusal(specs_root):
    """FR-008: the refusal is the seam's sentence, per node, not a summary."""
    build_spec(specs_root, spec_md=SPEC, plan_md=PLAN, tasks_md=UNSLICED_TASKS)
    path = specs_root / SPEC_DIR

    graph = derive_workgraph(
        SPEC,
        epic_id=SPEC_DIR,
        feature=SPEC_DIR,
        specs_root=str(specs_root),
        target_repo=str(Path(specs_root).resolve().parent),
        tasks_text=UNSLICED_TASKS,
    )
    expected = check_prompt_assembly(graph, path, spec_text=SPEC)

    row = rows(read_draft(specs_root, SPEC_DIR))[CHECK_PROMPT_ASSEMBLY]

    assert row["state"] == REFUSED
    assert [finding["detail"] for finding in row["findings"]] == [
        str(finding) for finding in expected
    ]
    assert [finding["node_id"] for finding in row["findings"]] == ["us1", "us2"]
    assert {finding["document"] for finding in row["findings"]} == {"tasks.md"}


def test_slice_coverage_carries_the_lint_s_own_finding(specs_root):
    """FR-008: a task written for one story and cut into another's slice, in
    the words the seam refused it in."""
    build_spec(specs_root, spec_md=SPEC, plan_md=PLAN, tasks_md=MISPLACED_TASKS)

    row = rows(read_draft(specs_root, SPEC_DIR))[CHECK_SLICE_COVERAGE]

    assert row["state"] == REFUSED
    assert len(row["findings"]) == 1
    finding = row["findings"][0]
    assert finding["informational"] is False
    assert finding["task_ids"] == ["T002"]
    assert finding["story_key"] == "US2"
    assert "names story US2" in finding["detail"]


def test_an_informational_finding_is_stated_and_never_counted(specs_root):
    """The `informational` flag is the seam's own field, read and not decided.

    A `## Verification` phase the operator works by hand is a real convention in
    this corpus; a row that called it a refusal would refuse specs that are
    correct, which is what the seam's own flag exists to prevent.
    """
    build_spec(specs_root, spec_md=SPEC, plan_md=PLAN, tasks_md=ORPHAN_TASKS)

    row = rows(read_draft(specs_root, SPEC_DIR))[CHECK_SLICE_COVERAGE]

    assert row["state"] == PASSED
    assert [finding["informational"] for finding in row["findings"]] == [True]
    assert "T003" in row["findings"][0]["detail"]


# --- US2-S5: an input that is not there -----------------------------------


def test_a_spec_with_no_tasks_reports_not_run_and_never_a_failure(specs_root):
    """FR-010: the shape most of this corpus has earns no refusal.

    The seam *would* answer here — `check_prompt_assembly` reports an unreadable
    `tasks.md` as a finding phrased "no node of this epic can be handed a prompt
    until it is there".  That is right for `ergane spec validate`, run against a
    spec whose author says it is finished, and wrong for a drafting table where
    eight of fourteen spec directories have no `tasks.md` at all.  So the row
    says which input was missing instead.
    """
    build_spec(specs_root, spec_md=SPEC, plan_md=PLAN)

    by_name = rows(read_draft(specs_root, SPEC_DIR))

    assert by_name[DERIVE_WORKGRAPH]["state"] == PASSED
    for name in (CHECK_PROMPT_ASSEMBLY, CHECK_SLICE_COVERAGE):
        assert by_name[name]["state"] == NOT_RUN
        assert by_name[name]["findings"] == []
        assert "tasks.md" in by_name[name]["not_run_because"]


def test_a_spec_with_no_plan_does_not_run_the_assembler(specs_root):
    """FR-010 again: a prompt is assembled from all three documents, so a
    missing `plan.md` is an input the checker does not have.

    Slice coverage is unaffected — it needs the graph and `tasks.md` and has
    both — which is the point of three rows rather than one verdict.
    """
    build_spec(specs_root, spec_md=SPEC, tasks_md=TASKS)

    by_name = rows(read_draft(specs_root, SPEC_DIR))

    assert by_name[CHECK_PROMPT_ASSEMBLY]["state"] == NOT_RUN
    assert "plan.md" in by_name[CHECK_PROMPT_ASSEMBLY]["not_run_because"]
    assert by_name[CHECK_SLICE_COVERAGE]["state"] == PASSED


def test_a_sketch_with_only_a_spec_refuses_nothing(specs_root):
    """The commonest shape in this corpus: one `spec.md` and no more.

    Every row is either passed or not run; nothing on this page tells an
    operator their sketch is broken for being a sketch.
    """
    build_spec(specs_root, spec_md=SPEC)

    document = read_draft(specs_root, SPEC_DIR)

    assert [row["state"] for row in document["checks"]] == [PASSED, NOT_RUN, NOT_RUN]
    assert all(row["findings"] == [] for row in document["checks"][1:])


def test_no_spec_at_all_runs_nothing_and_refuses_nothing(specs_root):
    """A directory that is not there: FR-004's degraded read, and three rows
    that report not run rather than three failures the spec never earned."""
    document = read_draft(specs_root, "922-a-spec-that-is-not-there")

    assert document["documents"] == []
    assert document["degraded"]
    assert [row["state"] for row in document["checks"]] == [NOT_RUN] * 3
    assert "no `spec.md`" in document["checks"][0]["not_run_because"]
    assert document["graph"] is None


def test_a_refused_directory_name_runs_no_checker(specs_root):
    """A name the room would not form a path from runs no checker either — and
    reports that, rather than a refusal attributed to a seam never called."""
    document = read_draft(specs_root, "../elsewhere")

    assert [row["state"] for row in document["checks"]] == [NOT_RUN] * 3
    assert document["graph"] is None


# --- US2-S4: no composite verdict -----------------------------------------


#: Every word a composed verdict would arrive under.  A field this repository
#: adds later that totals the three rows will be caught by name here.
COMPOSITE_KEYS = {
    "verdict",
    "valid",
    "ok",
    "passed",
    "failed",
    "status",
    "summary",
    "score",
    "result",
    "checks_passed",
    "checks_failed",
    "failures",
    "problems",
}


def test_the_document_carries_no_composite_verdict(specs_root):
    """FR-009: three attributed answers and no fourth thing that totals them."""
    build_spec(specs_root, spec_md=SPEC, plan_md=PLAN, tasks_md=MISPLACED_TASKS)

    document = read_draft(specs_root, SPEC_DIR)

    assert COMPOSITE_KEYS.isdisjoint(document.keys())
    for row in document["checks"]:
        assert COMPOSITE_KEYS.isdisjoint(row.keys())
    # The three states are per row and nowhere aggregated: no key of the
    # document is a boolean the operator could read as a verdict.
    assert not [
        key for key, value in document.items() if isinstance(value, bool)
    ]


def test_the_document_says_the_cli_s_verdict_is_unavailable(specs_root):
    """FR-009: the pane states the absence rather than leaving a gap an
    operator would fill in by composing the rows themselves."""
    build_spec(specs_root, spec_md=SPEC, plan_md=PLAN, tasks_md=TASKS)

    statement = read_draft(specs_root, SPEC_DIR)["verdict_unavailable"]

    assert "ergane spec validate" in statement
    assert "not a verdict" in statement


# --- the route answers all of it ------------------------------------------


def test_the_route_answers_the_checks_behind_the_same_token(
    credentials, monkeypatch, tmp_path, specs_root, auth_headers
):
    """The checks ride the one document `GET /api/draft/<spec-dir>` already
    answers, behind the one dependency every route sits behind (FR-005)."""
    build_spec(specs_root, spec_md=SPEC, plan_md=PLAN, tasks_md=TASKS)
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    monkeypatch.setenv("PANE_SPECS_ROOT", str(specs_root))
    client = TestClient(create_app(Settings.from_env()), headers=auth_headers)

    answered = client.get(f"/api/draft/{SPEC_DIR}")
    assert answered.status_code == 200
    assert [row["check"] for row in answered.json()["checks"]] == [
        DERIVE_WORKGRAPH,
        CHECK_PROMPT_ASSEMBLY,
        CHECK_SLICE_COVERAGE,
    ]

    assert TestClient(create_app(Settings.from_env())).get(
        f"/api/draft/{SPEC_DIR}"
    ).status_code == 401
