---
state: draft
depends_on_landed: [009-a-landed-epic-reads-landed]
# TBD — CAPTURED AND SCOPED, NOT YET REFINED. Recorded 2026-08-25, 6:35 PM CT.
# Held `draft`: the renderable half below is real and could be written today,
# but the corpus should not carry a fifth in-flight spec while 009 is mid-build
# and 012 is waiting on it. Flip after 012.
#
# THIS SPEC IS THE SMALL HALF OF A LARGER ASK, ON PURPOSE. The operator's words:
# "we need a way to visualize all of the CI steps, SBOM is another. this is
# something that you should show but we should provide feedback to ergane to
# support at the platform level."
#
# That splits cleanly and this spec takes only the part this repository owns.
# Ergane records a genuinely good CI step record per attempt and nothing renders
# it. Ergane records no SBOM, no coverage and no scan result, and this repository
# MUST NOT invent per-repo conventions for them -- constitution II exists to stop
# exactly that, and a per-repo coverage file is an artifact nobody can read. That
# ask is filed to the ergane agent as N54, together with the retention half (N47).
#
# So: render what exists, shape it to accept what does not yet, and do not fake
# the difference. A cell for a number nothing measures is the em-dash failure
# 009 already had to correct once.
---

# Feature Specification: The gates show their work (TBD)

**Feature Branch**: `013-the-gates-show-their-work`
**Created**: 2026-08-25 · **Status**: Draft — scoped sketch
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

## Open questions

1. **Where does it live?** The same question 007's Open Question 6 reopened. A
   gate-step strip is small enough for the Showfloor's detail pane; a full
   per-attempt history with output tails wants 007's reading room. Likely both,
   and likely 013 should ship the strip and 007 the room — but that is a call to
   take once one of them is real to look at.
2. **How much history?** Everything here is overwritten on re-dispatch (N28) and
   expires with Temporal's 72 hours. For a *running or just-finished* epic the
   record is live and this spec is buildable today. For anything older it is
   gone, and that is N47. **This spec should be explicit that it renders the
   current record, not a history, until the durable store exists** — otherwise
   it inherits 007's blocker for no gain.
3. **Does an `output_tail` belong on a page at all?** It is raw gate output,
   arbitrary length, and it may carry paths from the sandbox. Constitution VI
   says no credential reaches a page; a gate tail is not a credential but it has
   never been swept for one. Decide whether it is shown, shown-on-demand, or
   summarised — and sweep it either way.
4. **Concurrency is recorded and worth drawing.** `concurrent_gates` says which
   gates ran together. The floor-status skill notes the judge runs concurrently
   with the gate because one is network-bound and the other CPU-bound. A
   timeline that draws them serially would misrepresent the wall clock it is
   trying to explain.

## Out of scope

- The durable store (N47) and the platform's attestation surface (N54). Both are
  ergane's, both are filed, and this spec is deliberately useful without either.
- Any per-repo coverage or security tooling, per the section above.

## Work Graph

Deliberately absent — this is a scoped sketch, not a refined spec. Refine with
`/speckit-plan` and `/speckit-tasks` once Open Questions 1 and 2 are decided.
