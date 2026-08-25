# Tasks: the Desk matches the stage

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) ·
**Authority**: `DESIGN.md` (D-015) § The Desk in this world

No Setup phase; US1 carries the groundwork it needs first.

---

## Phase 1: User Story 1 - The Desk wears the world (Priority: P1) 🎯 MVP

**Goal**: second-world tokens, fluid frame, every carried-over guarantee green.

**Independent test**: render at 1280/1600/2560 in both themes; run the whole
inherited Desk suite list.

- [ ] T001 [US1] In `web/src/desk/Desk.tsx` and the Desk styles, remove the fixed content cap and fill the app frame's interior (max `96rem` comes from the frame, not the Desk); keep section order exactly — attention, floor, health+spend — the order 001's tests assert (FR-001) (spec US1-S1)
- [ ] T002 [US1] Restyle Desk surfaces onto the § Colors tokens and § Tables treatment — panels to `--surface`, wells to `--sunken`, hairline grids, chips via the shared `ladder.ts` chip mapping, numerals tabular mono right-aligned; no colour literal outside the token set (FR-002) (spec US1-S2)
- [ ] T003 [US1] Run the carried-over suites and reconcile selector drift only: attention-first order, countdown anchor, Unknown Rule, segmentation byte-preservation and 400-char bound, transport ≠ refusal, zero-non-GET, Answer present. Each moved selector is named in the moving test file's header; no assertion subject changes (FR-003) (spec US1-S3)
- [ ] T004 [US1] Playwright: widths 1280/1600/2560 asserting content width grows past 1600; both `colorScheme` emulations asserting token grounds and chip colours from computed styles (FR-001, FR-002) (spec US1-S1, US1-S2)

**Checkpoint**: the Desk is visibly the second world and nothing it promised
before is broken.

---

## Phase 2: User Story 2 - Epic rows without collisions (Priority: P1)

**Goal**: one legible row per epic, ladders from the document, overlap
outlawed Desk-wide.

**Independent test**: fixture floor's six epics; content, reuse, and the
no-overlap law at two widths, both themes.

- [ ] T005 [US2] Subscribe the Desk's floor section to the showfloor document (`/api/showfloor` + its SSE event) in the existing client module; the Desk reads ladders and chips from it and derives nothing (FR-005) (spec US2-S2)
- [ ] T006 [US2] Rewrite `web/src/desk/EpicRow.tsx`: mono epic id, epic chip with story count, one six-stop mini-ladder per story labelled by `story_key`, spend under the Unknown Rule — flex/grid flow, no absolute positioning (plan D2) (FR-004) (spec US2-S1)
- [ ] T007 [US2] Delete `MilestoneBar.tsx`, `NodeChevron.tsx`, `milestones.ts`, `rank.ts` and their tests **in the same diff** as the replacing `EpicRow` suite; replacement headers name the assertions they succeed; gates must still collect (plan D4) (FR-004) (spec US2-S1)
- [ ] T008 [US2] `EpicRow.test.tsx`: six fixture epics — row content, ladder-per-story counts, killed epic's frozen ladder + `killed` chip + `terminal_reason` in the row's `title` attribute; and the document-wins test — feed a document whose ladder contradicts a naive `state` reading, assert the rendered stop is the document's (FR-004, FR-005, FR-007) (spec US2-S1, US2-S2, US2-S4)
- [ ] T009 [US2] Add the Desk-wide no-overlap law to `web/tests/smoke/desk.spec.ts`: at 1280 and 1600, both themes, no two text-carrying leaf boxes overlap >4px in both axes — the assertion that catches the measured `"COMPLETED · epic-002" × "dispatch"` class (FR-006) (spec US2-S3)
- [ ] T010 [US2] Run all four gates; every US1 carried-over suite still green (spec US2-S3)

**Checkpoint**: the floor reads as rows of ladders; the collision class is
outlawed by a committed law.

---

## Phase 3: User Story 3 - The stale fold (Priority: P2)

**Goal**: live clocks lead; expired items collapse to verbatim one-liners.

**Independent test**: recorded attention fixtures split live/expired by the
document's reference instant.

- [ ] T011 [US3] In `web/src/desk/AttentionStrip.tsx`, partition items by `expires_at` against the document's reference instant (never `Date.now()` — 001 FR-019); live cards render exactly as today, above; expired items render inside a `<details class="stale">` whose `<summary>` states the count; when no item is expired the fold does not render at all (FR-008) (spec US3-S1, US3-S3)
- [ ] T012 [US3] In `web/src/desk/AttentionItem.tsx`, add the one-line stale variant: kind, correlation id, `expired <duration> ago` computed from the factory-written `expires_at` and the reference instant; opening shows the item's stored text and times verbatim — no re-derivation, no rewording (FR-009) (spec US3-S2)
- [ ] T013 [US3] Move items between live and fold only on SSE-driven re-render — no local timer (spec Edge Cases) (FR-008)
- [ ] T014 [US3] `AttentionStrip.test.tsx`: a reference instant splitting the fixtures — live above, folded below, summary count; verbatim text and `expires_at` inside the fold; all-live floor renders no fold; a Question/Notice with no `expires_at` never folds (FR-008, FR-009) (spec US3-S1..S3, Edge Cases)
- [ ] T015 [US3] Full gates from clean state; 001/003/004/005 suites and both new laws green — the finished Desk, both themes, headless (SC-001..SC-003) (spec US3-S1)

**Checkpoint**: the Desk leads with what can still be answered; nothing the
factory said is hidden or reworded.

---

## Dependencies

```
US1 ──merged──▶ US2 ──merged──▶ US3
```

All three touch `web/src/desk/` and the shared stylesheet; serial by the
corpus's standing contention rule.

## Out of scope for every phase

- Anything the Showfloor owns (005).
- Any change to Answer, auth, routes, or what the Desk shows.
