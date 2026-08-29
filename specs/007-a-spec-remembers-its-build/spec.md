---
state: draft
depends_on_landed: [005-one-epic-on-stage, 006-the-desk-matches-the-stage]
# TBD — CAPTURED, NOT REFINED. Recorded 2026-08-24 from operator intent, mid-005
# build, so the idea survives the session that had it. This spec has NO Work
# Graph on purpose: `state: draft` never dispatches, and it must not be flipped
# `ready` until the Open Questions below are answered and the body is refined to
# the corpus's standard (scenarios provable from the diff, a compiled graph,
# plan.md and tasks.md). `ergane spec validate` will refuse it today; that is
# correct and expected for a sketch.
#
# RE-MEASURED 2026-08-29, AND HELD AT DRAFT. Every blocker below was read off a
# tree or a store on this date rather than carried forward from the sketch, and
# the shape of the spec changed under it in three ways.
#
# 1. THE ROOT PREREQUISITE IS STILL OPEN, MEASURED AGAINST THE RELEASE AND NOT
# INFERRED FROM SILENCE. `ergane-cli` 0.5.0 is on PyPI; this repository pins
# 0.2.0 (D-011) and the host runs 0.2.0. The 0.5.0 wheel was pulled and read:
#
#   - `VerificationResult`'s field list is IDENTICAL to 0.2.0's. No `dispatch_id`,
#     no `persona`, no `model_alias`; `grep -rn dispatch_id factory/` over the
#     whole wheel returns nothing. `upsert_result`'s docstring still reads
#     "Keyed on `(epic_id, node_id, attempt, form)`: a `record_verification` that
#     runs a second time updates the row the first one wrote instead of adding
#     another." So N28 stands, a re-dispatch still destroys the previous one, and
#     PR-1 and PR-2 are both open.
#   - `expected_artifacts` is still the anti-rubber-stamp check and its one caller
#     still passes an empty list literally -- the call moved from
#     `factory/workgraph/workflow.py:2314` to `:2433` and did not change. PR-3 is
#     open.
#   - What 0.5.0 DID add is `ergane spec new` (PR-7's Create slice) and no verb
#     that declares state, which is 010's blocker and not this spec's.
#
# 2. MOST OF THE SKETCH SHIPPED IN OTHER ROOMS WHILE IT SAT. This is the change
# that matters most, because it means refining this spec from its own body would
# rebuild four things that already exist:
#
#   | the sketch's candidate content        | where it actually lives now        |
#   |---------------------------------------|------------------------------------|
#   | per-attempt gates, commands, durations,| 013, in the Showfloor detail pane, |
#   | judge verdict, the ladder that ran     | over `node_history` (D-020)        |
#   | model and persona per attempt          | 013 FR-003 renders `unknown` BY    |
#   |                                        | DESIGN -- that cell is PR-2        |
#   | landing PR, SHA, merge time            | 009, replayed by 016               |
#   | a dense reading room per landed epic   | 011, at `/review/<spec-dir>`       |
#   | the story graph with final states      | 005 / 008 / 019                    |
#   | coverage and security artifacts        | 015 EMITS them; 015's Out of scope |
#   |                                        | forbids the pane READING them,     |
#   |                                        | pending PR-3's typed collector     |
#
#   Open Question 4 chose "a third room" when the pane had two. It has four.
#
# 3. A BLOCKER THE SKETCH COULD NOT HAVE KNOWN: THE TOKEN GRID HAS NO DATA.
# PR-10, filed 2026-08-28 off 165 ledger rows, measured that the `subscription`
# route reports no usage at all -- 015, 017 and 018 carry zero counts, and the
# last builder row carrying any was 002:us2 on 2026-08-23. `rollup` is approved
# and works; the numbers are gone. Open Question 2's answer (tokens, never
# dollars) is unaffected and still stands. What is affected is that the panel it
# describes would render empty for every epic this repository has built since.
#
# AND THE ESCAPE HATCH IN OPEN QUESTION 1 IS SHUT. That question allowed "a
# pane-side archive is chosen instead" of waiting for ergane. D-021 -- decided
# the evening after this sketch was captured -- names "writing anywhere outside
# `specs/`" forbidden by name in constitution I. The one precedent that would
# reopen it is `pane/attention_store.py`, whose own docstring calls itself "the
# one store the pane writes"; extending that to a build-history archive is a
# D-entry, not a refinement of this spec, and no such entry exists.
#
# WHAT IS LEFT THAT IS BUILDABLE TODAY, recorded so it is not re-derived: a
# spec-level rollup over seams already approved -- rework ratio and wall clock
# from `node_history`, gate pass/fail counts, landing facts, and RESOLVED
# ESCALATION HISTORY, which is store-lifetime durable and rendered in no room.
# That is a smaller thing than this spec, it overlaps 011 and 013, and whether it
# earns a fifth room is an open decision rather than a settled cut.
#
# NOTHING HERE FLIPS ANYTHING. Still `state: draft`, still no Work Graph, still
# no plan.md and no tasks.md; `ergane spec validate` still refuses it and that is
# still correct.
---

# Feature Specification: A spec remembers its build (TBD)

**Feature Branch**: `007-a-spec-remembers-its-build`
**Created**: 2026-08-24 · **Status**: Draft — unrefined sketch
**Input**: operator request, verbatim below; the second world's assets (D-015)

## Operator intent (as captured)

> At some point I'd also like to reuse some of these assets into a generic
> spec details view that shows historical details — something like `/spec/032`
> — and it would render all of the details about that spec: tokens, cost,
> attempts to build, user story details, etc.

## Sketch

A read-only historical page per spec at `/spec/<spec-dir>` — the Showfloor
shows the floor *now*; this page shows how a spec *got built*. One route, no
verb, behind the same token as everything else.

**Reuses the second world's assets** rather than inventing new ones:

| asset (from 005) | reused as |
|---|---|
| the DAG stage + node cards | the spec's story graph, final states frozen |
| the six-stop ladder | per story, fully resolved, with real timestamps |
| the detail pane | per-story history: attempts, verdicts, landing |
| the metrics grid | spec-level rollup: wall clock, attempts, tokens, spend |
| chips, tokens, both themes | as-is |

**Candidate content per spec** (to be culled at refinement):

- Header: spec id, name, state, decision-log references, landed date.
- Story graph with final ladders; selecting a story opens its history.
- Per story: every attempt (number, persona, model alias, verdict, judge
  outcome with scenario score, duration), landing history (PR, SHA, queue
  time), rework count.
- Spec-level: total attempts vs stories (the rework ratio), wall clock from
  first dispatch to last landing, **token counts by persona for this epic —
  never dollars** (operator decision, 2026-08-25), gate pass/fail counts.
- Provenance: which dispatch(es), `KILL`/re-dispatch events if any.

## Operator intent, expanded (2026-08-25, 6:20 PM CT)

> I think long term it would be good to show either on the spec, or on individual
> stories, something around all of the attestation data for each unit of work as
> well. desired state is that when a spec is finished and fully merged, the
> showroom view of it shows when each of the steps happened, how many attempts,
> which models ran which, did it escalate, and all of the attestation information
> that goes with it (test coverage, provenance, security scans, etc, etc)

This widens the sketch above in two directions. It adds **attestation** — coverage,
provenance, security — to what was a build-history page. And it reopens the
placement answer: "either on the spec, or on individual stories" is not the same
question Open Question 4 settled, because a per-story attestation strip on the
Showfloor is cheap and a full attestation page is not. Both may be right.

## What already exists, and how long it survives

Measured 2026-08-25 against this host's `verification.db`, `ledger.db` and the
Temporal start payloads. **Most of what the operator asked for is already
recorded.** It is ephemeral and unrendered, which are two different problems.

| the operator asked for | recorded? | where | survives |
|---|---|---|---|
| when each step happened | **yes** | `verification_results.started_at` / `finished_at`; Temporal event history | 72 h, and overwritten on re-dispatch (N28) |
| how many attempts | **yes** | `verification_results.attempt` | overwritten |
| which model ran which | **yes** | the epic's Temporal **start payload**, resolved against `personas.yaml` | 72 h |
| did it escalate | **yes** | `escalations`: `choices`, `history_summary`, `sent_at`, `expires_at`, `resolution`, `resolved_at`, `resolved_via`, `check_evidence` | store-lifetime |
| gate pass/fail, command, duration | **yes** | `verification_results.gate_results` — `name`, `command`, `status`, `exit_code`, `duration_s`, `output_tail` | overwritten |
| judge verdict, per scenario | **yes** | `verification_results.judge_verdict` — outcome plus a finding per scenario with its reasoning | overwritten |
| the ladder it ran under | **yes** | `loop_summary`, e.g. *"gates [test, typecheck, unit, smoke]; order [gates, diff_check, judge]; attempts=3, judge_retries=2, promotion=1, debugger=1, deadline=3600s"* | overwritten |
| tokens by persona | **yes** | `ledger.db` via `rollup` | persists |
| write scope / hygiene | **partial** | `output_check` — `write_scope`, `has_diff`, `hygiene_violations`, `size_refusal`. The dedicated `provenance` column is **empty** on every row inspected | overwritten |
| **test coverage** | **NO** | **nowhere** | — |
| **security scans** | **NO** | **nowhere** | — |

## The prerequisite nobody has named yet: the artifacts do not exist

`ergane.yaml` declares four gates — `test`, `typecheck`, `unit`, `smoke` — and
**not one of them emits an attestation artifact**. There is no `--cov`, no
`pip-audit`, no `npm audit`, no SAST, in the manifest, in
`.github/workflows/ergane-gates.yml`, in `pyproject.toml` or in
`web/package.json`. Grepped 2026-08-25; zero hits.

So the coverage and security halves of the operator's request are not a rendering
problem at all. **A page cannot show a number nothing measures.** That is its own
spec, it belongs to this repository rather than to ergane, and — unlike everything
else here — **it is not blocked on the durable store**. A coverage gate could land
tomorrow.

## Three workstreams, and only one of them is 007

| # | work | owner | blocked on |
|---|---|---|---|
| 1 | a durable, append-only build-history store with an exported read-only reader | **ergane** (N47) | nothing; it is the root prerequisite |
| 2 | gates that emit coverage and security artifacts, and a place to put them | **this repo** | nothing — can land today |
| 3 | the room that renders it all | **007, this spec** | 1 and 2 |

Sequencing them the other way round is how this becomes a page of em dashes. The
Showfloor already demonstrates the failure mode: a merged story's detail pane
renders six lit stops and six `-` beside them, because the ladder carries no
timestamp and the live answer is gone. Spec 009 recovers the three facts the
landing branch itself holds — merge time, SHA, PR — and stops there, deliberately,
because the rest has no source.

## Data sources — known and open

Known seams that already carry part of this:

- `factory.usage.ledger.rollup` filters by epic — tokens/spend per persona
  for the spec's epic (constitution II, already in the approved list).
- `epic_status` carries per-node `history` and `landing_history` — but only
  while the workflow is within Temporal retention (72h); a *historical* page
  cannot rely on it.
- The verification store holds per-attempt rows (gates, judge verdict,
  timestamps). The constitution's approved reader list currently names only
  its *Question* reader over `connect_readonly` — reading
  `verification_results` for display likely needs the seam list amended
  (a D-entry), or an ergane-exported reader.
- Landing facts derive from the forge (squash subjects attribute stories) —
  durable, already the corpus's source of truth for `landed`.

## Open questions — with the operator's answers (2026-08-25)

1. **Retention — ANSWERED IN DIRECTION: long-term storage is required; where
   it lives is the open half.** The operator: "we'll need to figure out where
   to start storing that data long term so it's retained." A history page
   cannot ride `verification_results` (re-dispatch overwrites it, N28) or
   Temporal retention (72h). The durable store is a **prerequisite** of this
   spec, and it is most naturally ergane's: dispatch-scoped, append-only build
   history. Filed to the ergane agent as **N47** together with question 3;
   this spec stays draft until that lands or a pane-side archive is chosen
   instead.
2. **Cost display — ANSWERED: token counts only, never dollars.** Panels show
   prompt/completion tokens by persona; no `spend_usd` anywhere on this page.
   A subscription-built epic will honestly read `unknown` until usage for that
   route is recorded at all (N31/N46 territory) — rendered under the Unknown
   Rule, never as zero.
3. **Seam legality — ANSWERED: the recommendation stands.** The pane never
   opens `verification.db` raw. The durable history store from question 1
   ships with its **own ergane-exported read-only reader**, and that reader
   joins the constitution II list by a D-entry when it exists. No interim raw
   read, no pane-side SQL over ergane's private schema — the whole point of
   constitution II is that ergane's internals may change shape without
   breaking the pane (they already did once: N28).
4. **Placement — ANSWERED 2026-08-25: B, a third room at `/spec/<dir>`.**
   Decided after using the second-world Showfloor: the primary scene is
   researched at a desk, not glanced at on a projector, and the durable store's
   per-story history is dense enough (every attempt, every verdict, every gate)
   to want tables rather than a detail pane. The brief that produced the answer
   is kept below because the two facts it names are the ones that would reopen
   it:

   | | A — a mode of the Showfloor | B — a third room `/spec/<dir>` |
   |---|---|---|
   | navigation | none new; the rail already lists every spec; deep link `/showfloor/<dir>/history` | new top-level room beside Desk/Showfloor |
   | fit | a landed spec's stage naturally *is* its history (frozen ladders already render) | a reading room can be dense: attempt tables, token grids |
   | against | mixes "now" and "then" on the projector surface; the detail pane is small for attempt tables | third room in a two-room product; duplicates rail + graph |

   **The two facts that settled it:** (a) the primary scene — glanced on the
   projector (→ A) or researched at a desk (→ B); (b) how dense the durable
   store's per-story history actually is once it exists — a handful of rows
   fits A's detail pane, dozens want B's tables. Both read B. The third room is
   still a cost, and § "Out of scope" holds it to a reading room with no verb.

5. **The gates that would produce attestation — OPEN, and separable.** Coverage
   and security scanning do not exist in this repository. Adding them means
   choosing tools, deciding thresholds, deciding whether a coverage regression
   fails a gate (it should; a gate that only reports is a dashboard), and
   deciding where the artifacts land so a later reader can find them. None of
   that needs the durable store, and all of it needs deciding before this page
   can render a coverage number. **Recommendation: its own spec, before 007.**

6. **Placement, reopened — the operator now says "either on the spec, or on
   individual stories".** Open Question 4 answered B, a third room at
   `/spec/<dir>`, and that answer stands for the dense material: attempt tables,
   per-scenario judge findings, token grids. But a *per-story* attestation strip
   — coverage delta, scan result, attempt count — is small enough for the
   Showfloor's existing detail pane, and it is the thing an operator wants while
   looking at the graph rather than in a separate room. The likely answer is
   both, with the strip linking to the room. Decide once the store exists and
   the real density is known, not before.

## Out of scope (already known)

- Any write path; this is a reading room.
- Task-level progress (no seam — N46).
- Cross-repo history; this pane reads one target repo.

## Work Graph

Deliberately absent — see the frontmatter note. Refine with `/speckit-plan`
and `/speckit-tasks` after 005 and 006 land and the Open Questions are
answered.
