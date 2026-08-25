# Implementation Plan: The gates show their work

**Spec**: `specs/013-the-gates-show-their-work/spec.md` · **Landing branch**: `dev`
**Authority**: D-020 (constitution II's seam list), constitution III and VI.
No `DESIGN.md` amendment: the section reuses the detail pane's existing
vocabulary — chips, the facts grid treatment, the well for degradation.

## The shape

Three stories, serial. US2 draws what US1 makes available; US3 measures what US2
draws. All three reach `pane/showfloor.py` and the detail pane component.

## Decisions

- **D1 — the reader is the seam and nothing else.** `node_history(conn, epic_id,
  node_id)` over `connect_readonly`. No SQL in this repository, no column the
  reader does not return, no table it does not cover. D-020 grants exactly these
  functions and constitution II makes anything else a defect by construction.
- **D2 — unknown is a rendering, not a gap to fill.** The store carries no model
  and no persona. Resolving them from `personas.yaml` would be wrong rather than
  approximate: the DEBUGGER rung relabels the persona and never re-resolves
  `model_alias`, so the registry disagrees with reality precisely on the
  escalated attempt an operator is looking at.
- **D3 — the section names its own limit.** One line, in the section, saying the
  record is the current dispatch's and does not survive a re-dispatch. This is
  constitution III applied to the pane's own retention rather than to a read.
- **D4 — the tail is failure-only, collapsed, and swept.** Raw process output on
  a page is new for this repository. It gets the credential sweep every other
  surface gets, and a passing gate renders none at all — the tail is evidence for
  a failure, not decoration for a success.
- **D5 — concurrency is data, not layout taste.** `concurrent_gates` says which
  gates ran together; draw that. Do not infer it from durations.

## Named traps

- **`AttemptTiming` brackets a verification, not a story.** Its own docstring in
  ergane says so: "the dispatch-to-verification-start interval and merge-queue
  time are not in this table at all. A caller reporting these as anything other
  than the wall-time of an attempt's verification is reporting something the
  store cannot support." Label the number *verification*, never *wall clock*.
  `ergane status` gets this right — "verified in 1m02s" — and this section must
  match it.
- **The boundary gate is not CI.** These records are the gates ergane ran in its
  own sandbox. The forge ran its own checks on the merge ref and they can
  disagree — that divergence rejected a landing in this very epic, 009/us1. Do
  not label this section "CI"; it is the gate run. PR-4 is the ask that would let
  it be more.
- **A re-dispatch overwrites these rows (N28).** Two attempts shown today may be
  one attempt tomorrow. That is what D3's line is for, and it is why this spec
  does not call itself a history.
- **The corpus tests must not pin the live corpus.** `tests/corpus.py` and the
  guard from 008/US1 exist for this. Construct a store in a tmp tree; never
  assert that a named spec has a given attempt count, because it will change.
- **`PLAYWRIGHT_BROWSERS_PATH=0` is read from the environment on every
  invocation** (D-013), and is already on both the install and the test run.

## Gates

`uv run pytest -q` · `npm --prefix web run typecheck` · `test:unit` · `test:smoke`.
