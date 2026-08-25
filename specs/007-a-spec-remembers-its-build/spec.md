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
  first dispatch to last landing, tokens and spend by persona for this epic,
  gate pass/fail counts.
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

## Open questions (answer before refining)

1. **Retention.** `verification_results` upserts on
   `(epic_id, node_id, attempt, form)` — a re-dispatch **overwrites** the
   previous dispatch's evidence (ergane finding N28). A history page renders
   what survives; does it say so, or does ergane grow dispatch-scoped
   history first?
2. **Subscription-route usage is invisible** (no gateway, no ledger rows) —
   the cost panel for an Opus-built spec would read `unknown` across the
   board. Render honestly-unknown, or wait for an ergane seam?
3. **Seam legality.** Does reading `verification_results` for display need a
   constitution II list amendment (D-entry) or an ergane-side exported
   reader? Decide before any code.
4. **Where does it live?** Third room vs a mode of the Showfloor (the rail
   already lists every spec; a landed spec's stage could *be* this page).
5. Route naming: `/spec/<dir>` vs `/showfloor/<dir>/history`.

## Out of scope (already known)

- Any write path; this is a reading room.
- Task-level progress (no seam — N46).
- Cross-repo history; this pane reads one target repo.

## Work Graph

Deliberately absent — see the frontmatter note. Refine with `/speckit-plan`
and `/speckit-tasks` after 005 and 006 land and the Open Questions are
answered.
