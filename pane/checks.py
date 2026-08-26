"""What each of ergane's exported checkers says about one spec (014 US2).

The drafting table's second half. US1 gave the room three documents; this module
gives it three **answers**, each one the return value of a function the ergane
distribution exports, attributed to that function by name.

## Why this is a list and never a verdict

`ergane spec validate` is the command an operator would want quoted here, and it
has no library form. Its whole composition — which layers run, in what order,
which of their answers are refusals and which are information, and what the exit
code reads — lives in `_validate_command(args: argparse.Namespace) -> int`
(`factory/cli/nouns/spec.py:231`), a private CLI handler that prints and returns
an integer. Nothing in the distribution exports it.

Three of its layers *are* exported, and constitution II admits exactly those
three by name (D-022): `derive_workgraph`, `check_slice_coverage` and
`check_prompt_assembly`. The same clause forbids composing them: "a composed
verdict is re-derived policy, not a borrowed seam". So this module calls the
three, carries each answer under the name of the function that produced it, and
composes nothing. There is no total, no count of failures, no `ok` field and no
summary — `VERDICT_UNAVAILABLE` is what the room says instead, and FR-009
requires it on screen (plan D2; spec 014's frontmatter; filed to ergane as
PR-8).

A green pill an operator reads as "validated" is the most expensive lie this
room could tell, because the act it precedes — flipping `state: ready` — spends
tokens, opens pull requests and moves `dev` within 300 seconds.

## Three answers, and the third state they need

DESIGN.md § The drafting table fixes the vocabulary: "a check carries one of
three: `passed`, `refused`, `not run`. `not run` is muted and unbordered, and it
means an input was missing — never a failure the spec earned."

That third state is FR-010, and it is the whole reason this module decides what
to *call* before it calls it. Two of the three checkers take a compiled graph,
and `check_prompt_assembly` reads the trio off disk and reports an unreadable
`tasks.md` as a finding — a *failure*, phrased "no node of this epic can be
handed a prompt until it is there". That phrasing is right for `spec validate`,
which is run against a spec its author says is finished. It is wrong for a
drafting table, where a spec with no `tasks.md` is the ordinary shape of eight
of this corpus's fourteen spec directories. Reporting it as a refusal would
paint most of the corpus red for having no defect at all — constitution III
inverted, the same defect 012 was written to fix on the Desk.

So a checker whose inputs are not all present is **not called**, and its row says
which input was missing. Nothing is softened: what is suppressed is a claim the
pane would otherwise make on the checker's behalf, not a message the checker
actually produced. Every message a checker *did* produce rides verbatim.

## Severity is read, never decided

`check_slice_coverage` returns findings that carry their own `informational`
flag, and the flag is the seam's: a task inside no slice and naming no story is
"expected in a setup or verification phase the operator works by hand, a defect
anywhere else", in the seam's own words. This module reads that field onto the
row. It does not invent a severity, and it does not reclassify one — a finding
the seam marked informational is never counted as a refusal, and a finding it
did not mark is never dismissed as one.
"""

from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
from typing import Any

from pane.sweep import sweep

#: The three exported checkers, under the names FR-006 and FR-008 attribute
#: their answers to.  These strings are the functions' own names — an answer
#: attributed to anything else would be an answer attributed to the pane.
DERIVE_WORKGRAPH = "derive_workgraph"
CHECK_PROMPT_ASSEMBLY = "check_prompt_assembly"
CHECK_SLICE_COVERAGE = "check_slice_coverage"

#: Where each name is imported from, carried beside it so the attribution names
#: a surface an operator can go read rather than a bare identifier.
SEAMS = {
    DERIVE_WORKGRAPH: "factory.workgraph.derive.derive_workgraph",
    CHECK_PROMPT_ASSEMBLY: "factory.workgraph.preflight.check_prompt_assembly",
    CHECK_SLICE_COVERAGE: "factory.workgraph.preflight.check_slice_coverage",
}

#: The three answers a row may carry (DESIGN.md § The drafting table).  There is
#: deliberately no fourth, and deliberately no aggregate of them anywhere.
PASSED = "passed"
REFUSED = "refused"
NOT_RUN = "not_run"

#: What the room says where a verdict would go (FR-009).  It is a sentence and
#: not a chip on purpose: the absence of the CLI's answer is a fact about what
#: the distribution exports, and an operator who reads three attributed rows
#: without it will supply the missing composition themselves.
VERDICT_UNAVAILABLE = (
    "These are three checks, not a verdict. `ergane spec validate` composes five "
    "layers into one exit code inside a private CLI handler the distribution does "
    "not export, so the pane cannot obtain that verdict and does not compose one "
    "of its own. Read each answer under the name of the seam that gave it."
)

#: The reason a graph-dependent row carries when the deriver *refused* — the
#: FR-007 case.  The CLI skips the same layer for the same reason and says so in
#: nearly these words; the point both times is that a check reported against a
#: graph that does not exist is a claim about nothing.
NO_GRAPH_REFUSED = (
    "the work graph did not compile, so there are no nodes to check against — "
    "read the deriver's own refusal above"
)

#: And when the deriver was never run at all, because there was no `spec.md` to
#: hand it.  A different fact from a refusal, and saying "did not compile" for it
#: would report a compilation nobody attempted.
NO_GRAPH_UNCOMPILED = (
    "no work graph was compiled, so there are no nodes to check against — the "
    "deriver did not run"
)


def run_checks(
    *,
    spec_path: Path | None,
    specs_root: Path | str,
    spec_text: str | None,
    plan_text: str | None,
    tasks_text: str | None,
) -> dict[str, Any]:
    """Ask each exported checker about this spec and carry what it said.

    `spec_path` is the resolved spec directory, or `None` when the room never
    formed one — a refused directory name, in which case every row is `not run`
    for want of every input.

    The three texts are the ones the room has already read (`pane/draft.py`), so
    the bytes a checker answers about are provably the bytes the operator is
    looking at.  `None` is *absent*, which is what makes a row `not run` rather
    than a refusal.

    Always answers; never raises.  A checker that raises something other than
    its own documented refusal is a degraded read, and the room says so in the
    row rather than returning a 500 for a page the operator opened to read three
    documents.
    """
    graph, derivation = _derivation(
        spec_path=spec_path,
        specs_root=specs_root,
        spec_text=spec_text,
        tasks_text=tasks_text,
    )
    # Why the two graph-dependent rows have no graph, in the deriver's terms
    # rather than in one sentence that covers both cases badly.  `None` here
    # means there *is* a graph and neither row needs the excuse.
    no_graph = None
    if graph is None:
        no_graph = (
            NO_GRAPH_REFUSED
            if derivation["state"] == REFUSED
            else NO_GRAPH_UNCOMPILED
        )

    return {
        "checks": [
            derivation,
            _assembly(
                graph=graph,
                no_graph=no_graph,
                spec_path=spec_path,
                spec_text=spec_text,
                plan_text=plan_text,
                tasks_text=tasks_text,
            ),
            _coverage(
                graph=graph,
                no_graph=no_graph,
                spec_path=spec_path,
                tasks_text=tasks_text,
            ),
        ],
        # The compiled graph itself, in the shape `workgraph.json` holds — the
        # deriver's result carried rather than described (T011).  US3 draws it;
        # `None` is a graph that does not exist, and FR-013 draws no stage for
        # one.
        "graph": None if graph is None else asdict(graph),
        "verdict_unavailable": VERDICT_UNAVAILABLE,
    }


# --- the three rows ----------------------------------------------------------


def _derivation(
    *,
    spec_path: Path | None,
    specs_root: Path | str,
    spec_text: str | None,
    tasks_text: str | None,
) -> tuple[Any, dict[str, Any]]:
    """`derive_workgraph` on the spec text: the graph, and the row (FR-006/007).

    The deriver is pure — text in, graph out — so the four identity fields are
    the caller's, exactly as `ergane spec derive` supplies them: the spec
    directory's own name is the epic id and the feature, and the specs root is
    the one the pane is configured with.  `target_repo` is carried into the
    artifact and read by nothing in derivation; the honest value for a pane that
    reads the operator's checkout is the checkout the specs root sits in.

    `tasks_text` is passed when there is one, for the reason the CLI passes it:
    with it the deriver infers the ordering edges two stories whose task slices
    name a common file need, and a graph derived without it is a different
    graph.  Without one, the row says so — the same sentence `spec derive` puts
    on stderr — rather than letting the operator read a schedule as checked that
    was never checked.
    """
    from factory.workgraph.derive import DerivationError, derive_workgraph

    if spec_text is None:
        return None, _row(
            DERIVE_WORKGRAPH,
            NOT_RUN,
            not_run_because=(
                "there is no `spec.md` to compile — the deriver is handed the "
                "spec's text and there is none to hand it"
            ),
        )

    epic_id = spec_path.resolve().name if spec_path is not None else ""
    try:
        graph = derive_workgraph(
            spec_text,
            epic_id=epic_id,
            feature=epic_id,
            specs_root=str(specs_root),
            target_repo=str(Path(specs_root).resolve().parent),
            tasks_text=tasks_text,
        )
    except DerivationError as refusal:
        # Verbatim, whole, and multi-line: the error carries one line per
        # rejected declaration, each naming the story and the shape rule, and
        # an author fixing one per render is the failure mode collecting them
        # exists to avoid (FR-007).
        return None, _row(DERIVE_WORKGRAPH, REFUSED, detail=str(refusal))
    except Exception as failure:  # pragma: no cover - a seam that broke, not a spec that did
        return None, _row(
            DERIVE_WORKGRAPH,
            NOT_RUN,
            not_run_because=(
                f"the deriver could not be run: {failure!r}. That is a fact "
                "about the seam, not about this spec."
            ),
        )

    nodes = len(graph.nodes)
    inferred = len(getattr(graph, "inferred_edges", ()) or ())
    detail = (
        f"the `## Work Graph` section compiles: {nodes} "
        f"{'node' if nodes == 1 else 'nodes'}, "
        f"{inferred} inferred {'edge' if inferred == 1 else 'edges'}"
    )
    if tasks_text is None:
        detail += (
            ". There is no `tasks.md` beside this spec, so no task-slice "
            "contention was checked and no ordering edge was inferred"
        )
    return graph, _row(DERIVE_WORKGRAPH, PASSED, detail=detail)


def _assembly(
    *,
    graph: Any,
    no_graph: str | None,
    spec_path: Path | None,
    spec_text: str | None,
    plan_text: str | None,
    tasks_text: str | None,
) -> dict[str, Any]:
    """`check_prompt_assembly` over every node of the graph (FR-008, FR-010).

    It takes the whole trio: the assembler builds each node's attempt prompt out
    of `spec.md`, `plan.md` and `tasks.md`, so a missing one of the three is an
    input it does not have.  The seam would report that as a finding phrased as
    a failure — right for `spec validate`, wrong here — so the row says which
    document is missing and that it did not run.
    """
    if graph is None or spec_path is None:
        return _row(
            CHECK_PROMPT_ASSEMBLY,
            NOT_RUN,
            not_run_because=no_graph or NO_GRAPH_UNCOMPILED,
        )

    missing = [
        name
        for name, text in (
            ("spec.md", spec_text),
            ("plan.md", plan_text),
            ("tasks.md", tasks_text),
        )
        if text is None
    ]
    if missing:
        return _row(
            CHECK_PROMPT_ASSEMBLY,
            NOT_RUN,
            not_run_because=(
                "a node's attempt prompt is assembled from all three documents, "
                f"and this spec has no {' and no '.join(missing)}"
            ),
        )

    from factory.workgraph.preflight import check_prompt_assembly

    try:
        findings = check_prompt_assembly(graph, spec_path, spec_text=spec_text)
    except Exception as failure:  # pragma: no cover - a seam that broke
        return _row(
            CHECK_PROMPT_ASSEMBLY,
            NOT_RUN,
            not_run_because=f"the checker could not be run: {failure!r}",
        )

    return _row(
        CHECK_PROMPT_ASSEMBLY,
        REFUSED if findings else PASSED,
        detail=None
        if findings
        else "every node of this graph can be handed an attempt prompt",
        findings=[
            _finding(
                detail=str(finding),
                document=finding.document,
                node_id=finding.node_id,
            )
            for finding in findings
        ],
    )


def _coverage(
    *,
    graph: Any,
    no_graph: str | None,
    spec_path: Path | None,
    tasks_text: str | None,
) -> dict[str, Any]:
    """`check_slice_coverage` over the authored tasks (FR-008, FR-010).

    The seam's own `None` is *not checked* and says so in its docstring — "there
    is no `tasks.md` to locate a slice in, so the lint has no opinion".  The row
    carries that as `not run`, which is the same fact in this room's vocabulary,
    and the two are never conflated with the empty list, which is the lint having
    looked and found nothing.

    Severity is the seam's: `CoverageFinding.informational` marks the tasks that
    reach no node and name no story, which the seam calls "expected in a setup or
    verification phase the operator works by hand".  Those are stated and never
    counted, here as in the CLI, and the counting this row does is of the
    findings the seam did *not* mark.
    """
    if graph is None or spec_path is None:
        return _row(
            CHECK_SLICE_COVERAGE,
            NOT_RUN,
            not_run_because=no_graph or NO_GRAPH_UNCOMPILED,
        )
    if tasks_text is None:
        return _row(
            CHECK_SLICE_COVERAGE,
            NOT_RUN,
            not_run_because=(
                "there is no `tasks.md` to locate a task slice in, so the lint "
                "has no opinion about this spec"
            ),
        )

    from factory.workgraph.preflight import check_slice_coverage

    try:
        findings = check_slice_coverage(graph, spec_path, tasks_text=tasks_text)
    except Exception as failure:  # pragma: no cover - a seam that broke
        return _row(
            CHECK_SLICE_COVERAGE,
            NOT_RUN,
            not_run_because=f"the checker could not be run: {failure!r}",
        )

    if findings is None:
        return _row(
            CHECK_SLICE_COVERAGE,
            NOT_RUN,
            not_run_because=(
                "the checker read no `tasks.md`, so it has no opinion about "
                "this spec"
            ),
        )

    defects = [finding for finding in findings if not finding.informational]
    return _row(
        CHECK_SLICE_COVERAGE,
        REFUSED if defects else PASSED,
        detail=None
        if defects
        else "every task written for a story is inside that story's slice",
        findings=[
            _finding(
                detail=str(finding),
                informational=finding.informational,
                task_ids=list(finding.task_ids),
                story_key=finding.story_key,
            )
            for finding in findings
        ],
    )


# --- the two shapes ----------------------------------------------------------


def _row(
    check: str,
    state: str,
    *,
    detail: str | None = None,
    not_run_because: str | None = None,
    findings: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """One check's answer, under the name of the function that gave it.

    `check` and `seam` are the attribution FR-006 and FR-008 require, and they
    are the function's own name and import path rather than a label this
    repository chose — a row that said "work graph" would be the pane's word for
    what a seam answered.

    Every string a seam produced goes through the repository's credential sweep
    on its way out.  A checker's message quotes paths and task ids off the
    operator's own disk, and constitution VI is absolute about what may reach a
    rendered page.
    """
    return {
        "check": check,
        "seam": SEAMS[check],
        "state": state,
        "detail": None if detail is None else sweep(detail),
        "not_run_because": None if not_run_because is None else sweep(not_run_because),
        "findings": findings or [],
    }


def _finding(
    *,
    detail: str,
    informational: bool = False,
    document: str | None = None,
    node_id: str | None = None,
    task_ids: list[str] | None = None,
    story_key: str | None = None,
) -> dict[str, Any]:
    """One thing a checker said, in its own words.

    `detail` is `str(finding)` — the seam's own `__str__`, never a paraphrase.
    The structured fields ride beside it so the room can render the coordinates
    without parsing them back out of the sentence, which is the same discipline
    US1's degraded note applies to the path it tried.
    """
    return {
        "detail": sweep(detail),
        "informational": informational,
        "document": document,
        "node_id": node_id,
        "task_ids": task_ids or [],
        "story_key": story_key,
    }
