# Tasks: the pane fits the screen

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)
**Findings**: [`docs/pane-review-2026-08-24.md`](../../docs/pane-review-2026-08-24.md)

Every task cites the FR it implements and the acceptance scenario it is scored
against. Layout tasks cite the `DESIGN.md` line they conform to, because every
defect here is a divergence from a document that already specifies the answer —
no task is free to choose a layout.

There is no Setup or Foundational phase. Shared groundwork lives inside the phase
of the story that needs it first: `layout.ts`'s height function is US1's, and US2
consumes it.

---

## Phase 1: User Story 1 - The stage is the size of its graph (Priority: P1) 🎯 MVP

**Goal**: a stage occupies the space its graph needs, and an epic with nothing
staged renders as a line of text rather than a screen of nothing.

**Independent test**: build stage documents of zero, two and five nodes from the
Fixture floor, render each headless, assert rendered height against node count
and rank depth.

- [ ] T001 [US1] In `web/src/showfloor/layout.ts`, export `stageHeight(nodes, edges): number` computing the laid-out graph's height from its rank depth and the 140px row spacing `DESIGN.md:224` names (`stations sit 160px apart on a row, 140px between rows`), plus the stage padding `DESIGN.md:224` gives as `1.5rem 2rem 3rem`; the function reads only the stage document and never the viewport, `window`, or a CSS unit that resolves against it (FR-002) (spec US1-S3)
- [ ] T002 [US1] In `web/src/showfloor/EpicStage.tsx:61`, delete the inline `style={{ height: 300 }}` on `.epic-stage-map` and drive the map's height from `stageHeight()` — as a prop or a CSS custom property on the element, not a literal; every graph currently receives the same 300px, which is the whole of FR-002's violation (FR-002) (spec US1-S3)
- [ ] T003 [US1] In `web/src/showfloor/EpicStage.tsx`, branch before the map is constructed: when `stage.nodes.length === 0`, render the header and the degraded notes and **no** `.epic-stage-map` element and no `<ReactFlow>` at all — the notice must survive (constitution III); absence of the canvas is the assertion, not a reduced height (FR-001) (spec US1-S1)
- [ ] T004 [US1] In `web/src/showfloor/showfloor.css`, remove `min-height: 200px` from `.epic-stage-map` (line 77) so the computed height is the only source; leave `min-width: 1040px` alone — it is `DESIGN.md:224`'s stated map width and US2 depends on it (FR-002) (spec US1-S3)
- [ ] T005 [US1] Add to `web/tests/unit/layoutStage.test.ts`: feed `stageHeight()` a 2-node single-rank graph and a 5-node multi-rank graph built from the Fixture floor's own stage documents, assert the two results differ, and assert the difference equals the rank delta times the 140px row spacing — a constant-height implementation fails here (FR-002) (spec US1-S3)
- [ ] T006 [US1] Add to `web/tests/unit/EpicStage.test.tsx`: render a stage document whose `nodes` is `[]` and whose `notes` carries a workgraph transport failure; assert `container.querySelector('.epic-stage-map')` is `null`, assert no `[data-station]` exists, and assert the degraded note's text is present — the canvas is gone and the notice is not (FR-001) (spec US1-S1)
- [ ] T007 [US1] Add to `web/tests/smoke/showfloor.spec.ts`: render the Fixture floor at 1440×1000, measure every `[data-epic-stage]`'s bounding height, and assert each stage with zero `[data-station]` descendants is under one quarter of the median height of the stages that have stations — the comparison is taken **within the same render** so it cannot drift with viewport or font (FR-001) (spec US1-S2)
- [ ] T008 [US1] Add to `web/tests/unit/` a sweep over `web/src/showfloor/showfloor.css` asserting no rule matching `.epic-stage`, `.epic-stage-map` or their descendants declares `height: 100vh`, `min-height: 100vh`, or `height: 100%`; the sweep reads only that file — `web/src/styles/global.css` is not this story's diff and is not swept (FR-003) (spec US1-S4)
- [ ] T009 [US1] Run `npm --prefix web run test:unit` and `test:smoke`; the existing `Showfloor.test.tsx`, `EpicStage.test.tsx` and 002/US3's reduced-motion assertions must still pass unchanged — a layout change that relaxes an existing test has widened its scope (spec US1-S1, US1-S3)

**Checkpoint**: three zero-node epics render as rows with notices and no canvas; a
5-node stage is measurably taller than a 2-node one.

---

## Phase 2: User Story 2 - The landing line is reachable (Priority: P1)

**Goal**: the landing line and its four stations are on the screen, reachable by
scrolling the map horizontally, exactly as `DESIGN.md` describes.

**Independent test**: render the Showfloor at 1280 and 1440 and assert the lane's
bounding box lies within its scroll wrapper's scrollable extent.

- [ ] T010 [US2] In `web/src/showfloor/showfloor.css:48`, change `.epic-stage`'s `grid-template-columns` from `220px 1fr auto` to `220px 1fr` — `DESIGN.md:224` specifies the route as `a grid 220px 1fr` (epic name and meta on the left, the map on the right); the third `auto` column is the divergence that puts the lane past the container (FR-004) (spec US2-S1)
- [ ] T011 [US2] In `web/src/showfloor/EpicStage.tsx:88`, stop rendering `<LandingLine>` as a sibling of `.epic-stage-map` and render it **inside** the map, so it sits within the scrolling wrapper; `DESIGN.md:224` places it at `x=930` inside a map of `min-width: 1040px`, i.e. inside the map by 110px (FR-004) (spec US2-S1)
- [ ] T012 [US2] In `web/src/showfloor/LandingLine.tsx` and `showfloor.css:105`, remove `grid-column: 3` / `grid-row: 1 / 3` from `.landing-line` and position it at `DESIGN.md:224`'s `x=930` within the map's coordinate space, keeping the four stations 64px apart and the olive 3px line with its 1px sage centre stroke `DESIGN.md:307` names (FR-004, FR-007) (spec US2-S1, US2-S4)
- [ ] T013 [US2] In `web/src/showfloor/showfloor.css:74-80`, confirm `.epic-stage-map` keeps `min-width: 1040px` and an `overflow-x` that scrolls, so a map wider than its cell is reachable rather than clipped — this is the affordance `DESIGN.md:224` names as "a horizontally scrolling wrapper" and the one the current build does not provide (FR-005) (spec US2-S2)
- [ ] T014 [US2] Add to `web/tests/smoke/showfloor.spec.ts`: at viewport widths **1280 and 1440**, for every `[data-landing-line]`, read its bounding box and its scroll wrapper's `scrollWidth`/`clientWidth`/`scrollLeft`, and assert the lane's right edge lies within the wrapper's scrollable extent — measured against the **wrapper**, never the viewport, because a wrapper that scrolls is the specified behaviour and viewport containment would forbid it (FR-004) (spec US2-S1)
- [ ] T015 [US2] Add to `web/tests/smoke/showfloor.spec.ts`: for a map whose content exceeds its wrapper, assert `scrollWidth > clientWidth` and that computed `overflow-x` is `auto` or `scroll` — so "the content is reachable" is asserted rather than assumed (FR-005) (spec US2-S2)
- [ ] T016 [US2] Add to `web/tests/smoke/showfloor.spec.ts`: at 1280 and 1440, walk every element carrying text, and assert none has a right edge beyond `document.documentElement.clientWidth` **except** descendants of an element whose computed `overflow-x` scrolls; the exception is explicit so the assertion separates intended horizontal scroll from content laid out into nowhere — the distinction the current defect hides, and the assertion that would have caught it (FR-006) (spec US2-S3)
- [ ] T017 [US2] Add to `web/tests/unit/` (beside the existing `StationNode.test.tsx`): render a stage document whose nodes span the landing run and assert all four stations — PASSED, PR_OPEN, ENQUEUED, MERGED — are present with their labels, and that MERGED renders its count form (`MERGED ×3`) per `DESIGN.md:307` (FR-007) (spec US2-S4)
- [ ] T018 [US2] Run all four gates; `Legend.test.tsx` and the 002/US2 edge-kind assertions must still pass — moving the lane inside the map must not disturb the two edge strokes or the legend that explains them (spec US2-S1, US2-S4)

**Checkpoint**: at 1280 and 1440 no text element sits past the viewport outside a
scrollable wrapper, and the landing line is reachable by scrolling the map.

---

## Phase 3: User Story 3 - The escalation reads as the choices it offers (Priority: P1)

**Goal**: the evidence is laid out as the decision it is, with the factory's
wording preserved exactly.

**AUTHORITY**: `DESIGN.md` → Attention Item → **Body segmentation rule**. One
block per choice token the payload carries, in the payload's order, no block over
400 characters, a choice-less payload rendering as exactly one block, and the
concatenated text equal to the payload byte-for-byte after whitespace
normalisation, emoji included. `DESIGN.md:270` has required "one sentence per
choice" since D-012; the rule was made measurable on 2026-08-24.

**Independent test**: feed the recorded escalation fixture to the attention
component; assert segmentation, byte-preservation, and the length bound.

- [ ] T019 [US3] In `web/src/desk/` add `escalationBody.ts` exporting `segmentBody(evidence: string, choices: string[]): string[]` — split the payload's evidence on the choice tokens it already contains (the `esc:<12hex>:<CHOICE>` forms the factory emits), returning one block per choice in the payload's order; a payload naming no choices returns a single-element array holding the whole evidence unchanged (FR-008, FR-011) (spec US3-S1, US3-S4)
- [ ] T020 [US3] In `web/src/desk/AttentionItem.tsx`, render an escalation's evidence through `segmentBody()` as one element per block rather than a single text node; preserve every character the factory sent — no trimming of emoji, no re-wording, no summarising (constitution III: the pane renders the factory's ruling without softening it) (FR-008, FR-009) (spec US3-S1, US3-S2)
- [ ] T021 [US3] In `web/src/desk/` styles, give each block the `DESIGN.md` structure the operator settles in the prerequisite above; do not introduce a colour, face or radius `DESIGN.md` does not name (constitution VIII) (FR-008) (spec US3-S1)
- [ ] T022 [US3] Add to `web/tests/unit/AttentionItem.notice.test.tsx`: feed the recorded escalation fixture whose evidence exceeds 400 characters, assert the rendered block count equals the number of choices the payload names (FR-008) (spec US3-S1)
- [ ] T023 [US3] Add to the same file: assert the concatenation of the rendered blocks' `textContent`, after whitespace normalisation, equals the payload's `evidence` string **byte-for-byte including its emoji** — this is the assertion that makes it impossible for a later change to rewrite the factory's words while claiming to lay them out (FR-009) (spec US3-S2)
- [ ] T024 [US3] Add to the same file: assert no rendered text block exceeds **400 characters** for any escalation the Fixture floor carries; assert the bound, never today's observed 1,334, so the test fails on regression rather than only on this fixture (FR-010) (spec US3-S3)
- [ ] T025 [US3] Add to the same file: feed the recorded **Question** fixture and the recorded **Notice** fixture — neither names choices — and assert each renders as exactly one block with its text intact and the length assertion still holding; a segmenter keyed on choices must degrade to the un-segmented case rather than crash on a payload with none (FR-011) (spec US3-S4)
- [ ] T026 [US3] Run all four gates; `desk.spec.ts`'s zero-non-GET-request assertion and the `noVerb.test.ts` sweep must still pass — restructuring a body must not introduce a control (constitution I) (spec US3-S1)

**Checkpoint**: the escalation reads as four consequences, and a test proves the
words are still the factory's.

---

## Phase 4: User Story 4 - The spend strip says something (Priority: P2)

**Goal**: what the run cost per persona, in the metrics that matter, with
unmeasured values honestly unknown.

**AUTHORITY**: `DESIGN.md` → Tables → **The Spend Strip's shape**. One row per
persona plus a total; exactly four columns in order — prompt tokens, completion
tokens, requests, spend. `cache_read_tokens`, `cache_write_tokens`, `rows` and
`unconfirmed_rows` are named there as ledger bookkeeping that does not belong on
a Desk. The set is closed and declared in that document, never read from the
rollup's keys.

**Independent test**: feed the recorded rollup fixture, including its NULL, and
assert row shape, metric set, and unknown rendering.

- [ ] T027 [US4] In `web/src/desk/SpendStrip.tsx:34-39`, replace `groups.flatMap(g => Object.entries(g).map(...))` — a cross product of every source with every ledger column — with one row per persona: the persona's name, then one cell per metric in the set `DESIGN.md` names, in that order, plus the existing total row (FR-012, FR-013) (spec US4-S1, US4-S2)
- [ ] T028 [US4] In the same file, read the metric set from a single exported constant rather than from the rollup's keys, so a new ledger column cannot reach the Desk without a `DESIGN.md` amendment and a diff (FR-013) (spec US4-S2)
- [ ] T029 [US4] In the same file, keep `renderValue`'s existing contract exactly: `null` renders as `<span className="unknown">unknown</span>` and never `0` or a currency zero; keep the heading text containing the exact string "spend to date"; introduce no occurrence of the word "live" (constitution III, restating 001's guarantee against this component's new shape) (FR-014) (spec US4-S3)
- [ ] T030 [US4] In the same file, render a persona's row even when every one of its values is unknown — a persona that spent nothing measurable is a fact about the run, and suppressing the row would make the strip lie by omission (FR-015) (spec US4-S4)
- [ ] T031 [US4] Add to `web/tests/unit/SpendStrip.test.tsx`: feed the recorded rollup fixture and assert the rendered `tbody tr` count equals the number of personas plus the total row — the current build renders 32 rows for the same fixture (FR-012) (spec US4-S1)
- [ ] T032 [US4] Add to the same file: assert the rendered column set equals `DESIGN.md`'s named set **exactly** — neither a superset nor a subset — so both a dropped metric and a new ledger column fail a gate (FR-013) (spec US4-S2)
- [ ] T033 [US4] Add to the same file: assert the fixture's NULL renders as unknown and not `0`, that the label contains "spend to date", and that the word "live" appears nowhere in the strip's rendered output (FR-014) (spec US4-S3)
- [ ] T034 [US4] Add to the same file: feed a rollup in which one persona's every value is `null` and assert that persona's row still renders with its name and its unknowns (FR-015) (spec US4-S4)
- [ ] T035 [US4] Add to `web/tests/smoke/desk.spec.ts`: assert the Desk's rendered spend table has one row per persona plus the total, so the shape is checked against the served document and not only against a unit fixture (FR-012) (spec US4-S1)
- [ ] T036 [US4] Run all four gates from a clean state; every 001, 002 and 003 test must still pass — this story is last precisely so its assertions run against a Desk whose other layout work is already merged (spec US4-S1, US4-S3)

**Checkpoint**: the spend strip is one row per persona, every column deliberate,
and a new ledger column cannot appear on the Desk without a design decision.

---

## Dependencies

```
US1 ──merged──▶ US2 ──merged──▶ US3 ──merged──▶ US4
```

Fully serial, on merge-edges. All four reach `web/src/styles/global.css`; US1 and
US2 both edit `showfloor.css` and `EpicStage.tsx`; US3 and US4 both edit
`web/src/desk/`. On 2026-08-22 two stories sharing `pane/config.py` each passed
their own gates and the second was rejected by the merge queue's speculative
build — the loser had to be rebuilt against the winner, not patched. Declaring
these independent while they share a stylesheet is that defect, invited.

## Out of scope for every phase

- The Showfloor's page-versus-container scroll model (`showfloor.css:9`). A story
  that changes it has widened its own scope.
- Restoring the module documentation stripped from `web/src/desk/` — 4 of 17 files
  documented against 12/12 in `web/src/showfloor/`, because 001/US4 deleted
  docstrings to get under the diff-size cap. Real, and a documentation sweep
  inside a layout story is exactly the scope creep that caused it.
- Any file under `pane/`. Every backend claim held on inspection.
