---
state: landed
depends_on_landed: [009-a-landed-epic-reads-landed]
# Attested landed 2026-08-25. US1 a4a276a7b941 (#63), US2 b654af4cf511 (#64),
# US3 346c736e52e8 (#65) - all three observed on dev by content.
#
# Dispatched 7:43:23 PM CT, complete 9:00 PM CT: 1h17m for three serial
# stories, THREE ATTEMPTS FOR THREE STORIES - no rework at all, every judge
# verdict PASS. Agent build 17m34s, 18m27s, 23m08s; landing overhead ~8m a
# story. The cleanest epic of the build, and the one with the most unknowns in
# it: four of its cells render `unknown` by design because the platform has no
# attestation surface behind them (PR-2 through PR-5 in the feedback log).
#
# IT RAN BEFORE 012, WHICH IS NOT WHAT THE OPERATOR WAS TOLD. I forecast 012
# first and 013 second. 013 was already `ready` on dev while 012's flip was
# still sitting on the #62 branch, and the roadmap reads the working tree - so
# the moment #62 merged at 7:47 PM the scheduler took the spec that had been
# dispatchable the longest. A spec's readiness is a fact about the branch, not
# about the order the operator flipped things.
#
# Flipped ready 2026-08-25 by the operator. This is a second PR because the
# first one lost the flip: #58 was armed for auto-merge before the edit was
# made, merged the pre-flip tree, and the force-push landed on a branch whose
# PR was already closed. Everything else in #58 -- D-020, the constitution
# amendment, the refined body, plan, tasks and the derived graph -- landed
# correctly; only this line did not.
#
# NO EDGE ON 012, AND THE SCHEDULER MAKES THE QUESTION MOOT ANYWAY.
# `ergane.yaml` sets `max_concurrent_epics: 1`, so 012 and 013 queue behind
# one another whatever their edges say. The module check was done before that
# was read, and is kept because it is the answer if the cap is ever raised:
# 012 D3 puts its fallback in `pane/floor_document.py` and says in as many
# words that it must NOT go inside `LiveReader`; 013 T001 adds a new reader to
# `pane/readers.py` and renders from `pane/showfloor.py`. Disjoint.
#
# Refined 2026-08-25, 7:00 PM CT, under D-020 -- which amended constitution II
# FIRST, the order the constitution demands for a seam. Held `draft` pending the
# operator's go; 009 is mid-build and 012 is queued behind it.
#
# THE SCOPE IS THE HALF THIS REPOSITORY OWNS. The operator: "we need a way to
# visualize all of the CI steps, SBOM is another. this is something that you
# should show but we should provide feedback to ergane to support at the
# platform level." The platform half is filed as PR-1..PR-6 in the feedback log
# and is deliberately NOT waited on here.
#
# WHAT CHANGED BETWEEN THE SKETCH AND THIS. The sketch assumed the record was
# unreachable. It is not. `factory.verify.store.node_history` returns the whole
# per-node evidence bundle and `attempt_timings` returns an epic's verification
# timings -- both exported, both typed, both already load-bearing inside ergane
# (node_history is what retry prompts quote). D-020 adds them to constitution
# II's list. 007's Open Question 3 assumed no reader existed and was wrong.
#
# WHAT IS STILL UNAVAILABLE, AND IS RENDERED UNKNOWN RATHER THAN GUESSED:
#   - the model an attempt ran on. Eighteen columns, none of them the model.
#     Guessing from personas.yaml is WRONG, not merely imprecise: the DEBUGGER
#     rung relabels the persona without re-resolving `model_alias`, so the two
#     disagree exactly when it matters. PR-2.
#   - coverage, SBOM, scan results. Nothing measures them. PR-3.
#   - the forge's own check runs. The store holds the boundary gate only, and
#     the two disagree -- that divergence rejected a landing in this very epic. PR-4.
#   - story wall clock. `AttemptTiming`'s docstring warns its interval brackets
#     one verification, not one story. PR-5.
# Each is a cell that reads unknown. Never a zero, never a plausible guess.
---

# Feature Specification: The gates show their work

**Feature Branch**: `013-the-gates-show-their-work`
**Created**: 2026-08-25 · **Status**: Draft — refined, awaiting the operator's go
**Input**: operator request, verbatim above; the per-attempt record measured on
this host 2026-08-25; N54 as the platform-side counterpart

## What ergane already records and nothing renders

Read from a live `verification.db`, not assumed:

| record | content | rendered today |
|---|---|---|
| `gate_results` | per gate: `name`, `command`, `status`, `exit_code`, `duration_s`, `output_tail`, `concurrent_gates` | **no** |
| `loop_summary` | the ladder the attempt ran under — gates, order, `attempts`, `judge_retries`, `promotion`, `debugger`, `deadline` | **no** |
| `judge_verdict` | outcome, plus one finding per scenario with its reasoning | partially — the stop, not the findings |
| `output_check` | `write_scope`, `has_diff`, `hygiene_violations`, `size_refusal` | **no** |
| `escalations` | `choices`, `resolution`, `resolved_via`, `check_evidence`, `expires_at` | the badge, not the history |

Four gates, each with the command that ran, whether it passed, what it exited
with, how long it took and whether it ran beside another. That is a CI step
timeline already — it has simply never been drawn.

## Sketch

Per story, per attempt: the gate run as a row of steps. Each step carries its
name, its outcome, its duration, and — on failure — the tail ergane already
captured. Above them, the ladder the attempt ran under, because "attempt 2 of 6
with the debugger rung at 1" is the context that makes a failure legible. Beside
them, the judge's per-scenario findings, which today are reduced to a single
stop on a six-step ladder and are the most informative thing in the record.

**The shape must be open.** N54 asks ergane for typed attestation artifacts
(`sbom`, `coverage`, `scan`, `opaque`) collected at the gate boundary. When they
arrive they are more steps and more panels, not a new page. A design that
hard-codes four gate names will have to be rewritten the first time a repo
declares a fifth.

## What this spec must not do

- **Invent a coverage or SBOM convention for this repository.** No `--cov` in a
  gate command, no `pip-audit` step, no artifact path this repo alone knows.
  That is the per-repo fragmentation N54 argues against, and doing it here would
  undercut the finding while it is open.
- **Render a cell for a number nothing measures.** If coverage is absent it is
  absent — no zero, no placeholder, no "0%" that reads as a measurement. The
  Unknown Rule already covers this and 009 had to correct it once.
- **Add a second write path.** Constitution I. Nothing here re-runs a gate,
  re-triggers CI, or resolves an escalation.

## Decided (the sketch's open questions, answered)

1. **Where it lives: the Showfloor's detail pane, as a per-story section.** The
   data is per-story; the pane already renders per-story facts and the ladder;
   and 007's reading room does not exist. A separate room for a record that does
   not survive re-dispatch would be worse than no room.
2. **How much history: the current record, said out loud.** Everything here is
   overwritten on re-dispatch (N28). The section renders what the reader returns
   and names that limit on the page, rather than implying a history it cannot
   keep. When PR-1 lands this becomes a history with no redesign.
3. **The output tail is shown on failure only, collapsed, and swept.** It is the
   most useful thing in the record for a failed gate, and it is raw process
   output that has never been swept for a credential. Constitution VI is
   absolute. A passing gate renders no tail at all.
4. **Concurrency is drawn.** `concurrent_gates` records which gates ran
   together. A timeline that drew them serially would misstate the wall clock it
   exists to explain.

## Out of scope

- The durable store (N47) and the platform's attestation surface (N54). Both are
  ergane's, both are filed, and this spec is deliberately useful without either.
- Any per-repo coverage or security tooling, per the section above.

## User Scenarios & Testing

### User Story 1 - The evidence reaches the pane (Priority: P1)

As an operator, the pane can read what the factory recorded about an attempt,
through a seam rather than a query of my own.

**Acceptance Scenarios**:

1. **Given** a story with recorded verifications, **When** the showfloor
   document is assembled, **Then** it carries each attempt's gates — name,
   status, exit code, duration and concurrency — the ladder summary, and the
   judge's per-scenario findings, read through `node_history` over
   `connect_readonly` (FR-001).
2. **Given** the store is unreadable, **When** the document is assembled,
   **Then** the read degrades in the section's own vocabulary and names what
   could not be learned, and no other section is affected (FR-002).
3. **Given** any attempt, **When** the document is assembled, **Then** the
   model and persona render as unknown, because the store does not carry them,
   and the pane MUST NOT resolve them from the registry (FR-003).

---

### User Story 2 - The gate run reads as a timeline (Priority: P2)

As an operator, a story's detail shows me the gates that ran, in the shape they
ran in, with the failing one legible.

**Acceptance Scenarios**:

1. **Given** an attempt whose gates ran, **When** the detail renders, **Then**
   each gate appears with its name, outcome, duration and command, and gates
   recorded as concurrent render as concurrent (FR-004, FR-005).
2. **Given** a failed gate, **When** the detail renders, **Then** its output
   tail is available collapsed, and a passing gate renders no tail (FR-006).
3. **Given** any rendered tail, **When** the document is assembled, **Then** it
   has passed the same credential sweep every other surface passes (FR-007).
4. **Given** the section renders, **When** it does, **Then** it names that the
   record is the current one and does not survive re-dispatch (FR-008).

---

### User Story 3 - The section is honest at every width (Priority: P3)

As an operator, the new section obeys the four layout laws like everything else.

**Acceptance Scenarios**:

1. **Given** every width and both themes the suite already sweeps, **When** the
   section renders, **Then** the four layout laws report zero violations
   (FR-009).
2. **Given** a story with no recorded attempt, **When** the detail renders,
   **Then** the section does not render at all rather than rendering empty
   (FR-010).

---

## Requirements

### Functional Requirements

- **FR-001**: The document MUST carry per-attempt gate records, the ladder
  summary and the judge's per-scenario findings, read through `node_history`
  over `connect_readonly` (D-020).
- **FR-002**: A failed read MUST degrade in-section, naming what could not be
  learned, without affecting another section.
- **FR-003**: Model and persona MUST render unknown; the pane MUST NOT resolve
  them from the persona registry.
- **FR-004**: Each gate MUST render its name, outcome, duration and command.
- **FR-005**: Gates recorded as concurrent MUST render as concurrent.
- **FR-006**: A failing gate's output tail MUST be available collapsed; a
  passing gate MUST render none.
- **FR-007**: Any rendered tail MUST pass the repository's credential sweep.
- **FR-008**: The section MUST name that its record is current-only and does not
  survive re-dispatch.
- **FR-009**: The section MUST report zero violations of the four layout laws at
  every width and in both themes the suite sweeps.
- **FR-010**: A story with no recorded attempt MUST render no section, not an
  empty one.

## Success Criteria

- **SC-001**: A story that took two attempts shows both, with each gate's
  outcome and duration.
- **SC-002**: No cell shows a guessed model, and none shows a zero for an
  absence.
- **SC-003**: The four layout laws stay green across the existing sweep.

## Work Graph

```yaml
US1:
  depends_on: []
  depends_on_merged: []
  implements: [FR-001, FR-002, FR-003]
  timeout: 3600
US2:
  depends_on: []
  depends_on_merged: [US1]
  implements: [FR-004, FR-005, FR-006, FR-007, FR-008]
  timeout: 3600
US3:
  depends_on: []
  depends_on_merged: [US2]
  implements: [FR-009, FR-010]
  timeout: 3600
```
