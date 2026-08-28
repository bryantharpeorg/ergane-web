# Tasks: The room reads on arrival

## Phase 1: User Story 1 - The goal band says the whole sentence, as prose

- [ ] T001 [US1] Replace `_intent_after`'s `**`-prefix guard with a match on the
      template-label shape — `**…**` followed by `:` — so a wrapped bold phrase
      no longer ends the paragraph (spec US1-S1, US1-S2, plan D3).
- [ ] T002 [US1] Strip inline emphasis and code marks from the collected
      paragraph, keeping the words in order, with no Markdown renderer and no
      new dependency (spec US1-S3, plan D4).
- [ ] T003 [US1] Keep `parse_spec_intent` and `parse_story_headings` on the one
      reader, so a spec goal and a story intent cannot end at different places
      (spec US1-S4, FR-004).
- [ ] T004 [US1] Leave the empty case alone: a spec stating no goal still
      returns `""` and the room draws no band (spec US1-S5, FR-005).
- [ ] T005 [US1] Test the wrapped-bold paragraph against this repository's own
      015 `## Context`, which is the recorded case that exposed the defect (spec
      US1-S1).
- [ ] T006 [US1] Test that a `**Label**:` line still ends a paragraph, including
      when no blank line precedes it (spec US1-S2).
- [ ] T007 [US1] Test that emphasis and code marks are gone and their words
      remain, against 018's `## Context` (spec US1-S3).
- [ ] T008 [US1] Test that a story intent obeys all three rules identically
      (spec US1-S4).
- [ ] T009 [US1] Confirm no file under `web/` is touched by this story (plan D1,
      Named traps).

## Phase 2: User Story 2 - The room opens on a story

- [ ] T010 [US2] Add a `defaultStory` derivation beside `defaultSelection` in
      `web/src/showfloor/Showfloor.tsx`, exported so a unit test can reach it:
      the story being built, else the newest merged, else the first (spec
      US2-S2, US2-S3, US2-S4, plan D6).
- [ ] T011 [US2] Resolve the room's story selection from that derivation on
      first render, so an arrival with no click already tells a story (spec
      US2-S1, FR-006).
- [ ] T012 [US2] Re-derive on a change of spec rather than remembering the last
      pick, so a story of the previous spec can never be shown (spec US2-S5,
      plan D5).
- [ ] T013 [US2] Leave the collapse intact for a spec carrying no stories: the
      track goes to `0` and the pane holds the room's own explanation (spec
      US2-S6, FR-009, plan Named traps).
- [ ] T014 [US2] Keep the selection out of the URL — no second path segment
      (spec US2-S7, FR-010, plan Named traps).
- [ ] T015 [US2] Unit-test the derivation over all four shapes: a building
      story, an all-merged spec, a spec that is neither, and a spec with no
      stories (spec US2-S1 through US2-S4, US2-S6).
- [ ] T016 [US2] Unit-test that changing the spec changes the story, and never
      to a story of the spec that was on stage (spec US2-S5).
- [ ] T017 [US2] Smoke-assert that arriving at `/showfloor` renders a filled
      detail pane and an uncollapsed track (spec US2-S1, SC-002).
- [ ] T018 [US2] Confirm no file under `pane/` is touched by this story (plan
      D1, Named traps).

## Phase 3: User Story 3 - The status column carries the times its seams already have

- [ ] T019 [US3] Establish, and write into the spec, which of the six stops the
      approved seams record an instant for and which none does (spec US3-S2,
      plan D7).
- [ ] T020 [US3] Fill each recorded instant into that stop's `at` in
      `pane/showfloor.py`, taking it from the seam that records it and from no
      other (spec US3-S1, US3-S4, FR-014).
- [ ] T021 [US3] Leave `at` null for a stop no seam records, so the room's
      existing `—` fallback answers for it (spec US3-S2, FR-012).
- [ ] T022 [US3] Leave a stop the story has not reached carrying no time at all
      (spec US3-S3, FR-013).
- [ ] T023 [US3] Change nothing under `web/`: `stepsOf` already renders `at`
      and the format is the room's (spec Edge Cases, plan D1, Named traps).
- [ ] T024 [US3] Test that each filled stop equals its seam's own value, and
      that no stop is derived from another (spec US3-S4, FR-014).
- [ ] T025 [US3] Test the unrecorded and unreached stops answer `—` and empty
      respectively, and that the two are distinguishable (spec US3-S2, US3-S3).
- [ ] T026 [US3] Stay inside the `derive_ladder` family — no import
      reorganisation, no shared rename — because US1 is editing the same file
      concurrently (plan D1, Named traps).
