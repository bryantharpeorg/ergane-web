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
4. **Placement — OPEN: the operator wants more information.** The decision
   brief, for when 005's rebuilt room is real to look at:

   | | A — a mode of the Showfloor | B — a third room `/spec/<dir>` |
   |---|---|---|
   | navigation | none new; the rail already lists every spec; deep link `/showfloor/<dir>/history` | new top-level room beside Desk/Showfloor |
   | fit | a landed spec's stage naturally *is* its history (frozen ladders already render) | a reading room can be dense: attempt tables, token grids |
   | against | mixes "now" and "then" on the projector surface; the detail pane is small for attempt tables | third room in a two-room product; duplicates rail + graph |

   **Two facts would settle it:** (a) the primary scene — glanced on the
   projector (→ A) or researched at a desk (→ B); (b) how dense the durable
   store's per-story history actually is once it exists — a handful of rows
   fits A's detail pane, dozens want B's tables. Decide after using the
   second-world Showfloor for a while.

## Out of scope (already known)

- Any write path; this is a reading room.
- Task-level progress (no seam — N46).
- Cross-repo history; this pane reads one target repo.

## Work Graph

Deliberately absent — see the frontmatter note. Refine with `/speckit-plan`
and `/speckit-tasks` after 005 and 006 land and the Open Questions are
answered.
