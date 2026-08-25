# Implementation Plan: the Desk matches the stage

**Branch**: `006-the-desk-matches-the-stage` · **Date**: 2026-08-24
**Spec**: [spec.md](./spec.md) · **Authority**: `DESIGN.md` (D-015) § The Desk
in this world

## Summary

Bring the Desk onto the second world's tokens and retire the three measured
defects 004 left open: the 1216px cap, the label-collision class, and the
permanently stale attention. Content contract untouched; the change is
composition and clothing, and the proof burden is mostly *survival* — every
guarantee suite from 001/003/004 stays green through the change.

## Technical Context

TypeScript 5 strict, React 19, vitest, Playwright. **Zero backend change**:
the Desk gains its ladders from the showfloor document 005 already serves
(one added fetch/SSE subscription in the existing client module). Zero
dependency change.

## Constitution Check

| principle | how |
|---|---|
| I | The Answer verb and its five buttons are untouched; the fold adds a disclosure, not a verb. |
| II | Ladders come from the document; the Desk derives nothing (FR-005 asserts it). |
| III | The fold is layout, never editing (FR-009); Unknown Rule restated; expired is a fact, not an emergency. |
| IV | Every scenario is a DOM/computed-style/request-log assertion; SC-004. |
| V | No fixture invented; live/expired split comes from the recorded reference instant. |
| VI–VII | No route, no auth, no dependency change. |
| VIII | DESIGN.md § The Desk in this world was written first (D-015); tasks cite it. |

## Project Structure

```
web/src/desk/
├── Desk.tsx            # US1: frame fill, section order preserved
├── EpicRow.tsx         # US2: rewritten — id, chip, per-story mini-ladders, spend
├── AttentionStrip.tsx  # US3: live cards + the stale fold
├── AttentionItem.tsx   # US3: one-line stale variant (full card untouched)
└── (deleted: MilestoneBar.tsx, NodeChevron.tsx, milestones.ts, rank.ts —
   the first world's state pictures; their tests replaced in the same diff)

web/src/showfloor/ladder.ts   # consumed, not modified — the shared model

web/tests/unit/{EpicRow,AttentionStrip}.test.tsx   # rewritten subjects
web/tests/smoke/desk.spec.ts                        # + no-overlap law, widths, themes
```

## Decisions

### D1 — the Desk consumes the showfloor document

The old Desk derived its own state pictures (chevrons, milestone diamonds)
from the floor document; the rooms could disagree. Now one derivation exists —
005's backend ladder — and the Desk renders it verbatim. FR-005's test feeds a
document whose ladder deliberately contradicts a naive reading of `state` and
asserts the document wins, so the no-derivation rule is enforced, not assumed.

### D2 — collisions die by construction *and* by law

The measured overlaps came from absolutely-positioned labels sharing track
space (milestone bar). The new row is a flex/grid flow where overlap is
impossible by construction — and FR-006 still lands the no-overlap assertion
Desk-wide, because the law, not the layout, is what stops the class returning.

### D3 — stale is a fold, not a deletion

Constitution III forbids hiding what the factory said. Expired items remain
reachable, verbatim, timestamps factory-written — one line each under a
disclosure whose summary states the count. A fold with nothing in it never
renders (the task-stop lesson: no element that can never fill).

### D4 — deletions ship with their replacements

`MilestoneBar`/`NodeChevron` tests lose their subjects; the replacing
`EpicRow` suite lands in the same diff, headers naming what each assertion
succeeds (plan discipline carried from 005 D4). The gates must demonstrably
still collect real tests in this story's own diff.

## Story-by-story approach

**US1** applies tokens and fluid width, then runs the *entire* carried-over
suite list and fixes only selector drift, naming each move. The story is done
when the Desk looks like the second world and every old guarantee is green.

**US2** rewrites `EpicRow` around the document's ladders and deletes the
milestone bar world; lands the Desk-wide no-overlap law.

**US3** splits the attention strip: live cards above, stale fold below,
one-line entries verbatim; SSE moves items on re-render, no local timers.

## Risks and traps

- **Selector drift breaking guarantee suites silently.** The suites are the
  deliverable; a failing carried-over test is a defect in this spec's diff,
  never a test to relax. FR-003 makes the discipline a scenario.
- **The reference instant.** Live-vs-expired is computed against the
  document's reference instant (001's FR-019), never `Date.now()` — or the
  fixture floor's split changes with the wall clock and the tests flake.
- **Chip vocabulary creep.** Every chip must come from `DESIGN.md` § Chips;
  a new state word starts in the design system, not in a component.

## Complexity Tracking

No deviation requested. No dependency, route, verb, or fixture change.
