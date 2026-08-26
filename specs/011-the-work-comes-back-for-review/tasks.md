# Tasks: The work comes back for review

## Phase 1: User Story 1 - What changed reads from the branch

- [ ] T001 [US1] Add the `/review/<spec-dir>` route behind the existing bearer-token
      dependency (spec US1-S6).
- [ ] T002 [US1] Read each story's landing SHA, pull request number and squash
      subject from the landing branch, riding the same seam `pane/landing.py`
      already uses (spec US1-S1, plan Named traps).
- [ ] T003 [US1] Read the file list each landing commit changed, over the same git
      seam; import no `subprocess` (spec US1-S2).
- [ ] T004 [US1] Add the committed route manifest mapping source-path patterns to
      routes (spec US1-S3, plan D3).
- [ ] T005 [US1] Resolve each changed file to the routes it reaches; a file
      matching no pattern reads as reaching no known route and is never dropped
      (spec US1-S3).
- [ ] T006 [US1] Refuse an epic with any unmerged story, naming them (spec US1-S4,
      plan D4).
- [ ] T007 [US1] Render the what-changed track: stories, SHAs, PRs, subjects, files,
      routes (spec US1-S1, US1-S2, US1-S3).
- [ ] T008 [US1] Commit the test that every route the application serves appears in
      the manifest (spec US1-S5, FR-005).
- [ ] T009 [US1] Test the partial-epic refusal and the 401 over a constructed
      corpus (spec US1-S4, US1-S6). Never pin the live corpus.

## Phase 2: User Story 2 - The thing itself renders beside its numbers

- [ ] T010 [US2] Render a selected route in a same-origin frame at an
      operator-selected width and theme. Add no subprocess and no headless browser
      (spec US2-S1, plan D1, Named traps).
- [ ] T011 [US2] Run the four layout laws inside that frame, reusing `measureLaws`'
      logic rather than reimplementing it (spec US2-S2, plan D2).
- [ ] T012 [US2] Render the measured numbers beside the frame, not a pass/fail alone
      (spec US2-S2).
- [ ] T013 [US2] Name the revision the service is serving and whether it contains
      the epic under review (spec US2-S3, plan D5).
- [ ] T014 [US2] State a revision mismatch unmissably (spec US2-S4).
- [ ] T015 [US2] Test the mismatch statement over a constructed pair of revisions
      (spec US2-S4).
- [ ] T016 [US2] Playwright: the room itself reports zero violations of the four
      layout laws at every width and in both themes the suite sweeps (spec US2-S5,
      plan Named traps).

## Phase 3: User Story 3 - A note carries its coordinates, and the room writes nothing

- [ ] T017 [US3] Record a note carrying story, route, width, theme and the measured
      numbers at the instant of capture (spec US3-S1).
- [ ] T018 [US3] Freeze a note's coordinates at capture so a later view change does
      not rewrite them (spec Edge Cases, plan D6).
- [ ] T019 [US3] Compose the notes into a captured-TBD spec in the shape of 007 and
      010 — operator intent verbatim, sketch, open questions, no Work Graph,
      `state: draft` (spec US3-S2).
- [ ] T020 [US3] Present the composed draft for the operator to save, and write
      nothing: no file, no directory, no spec mutation (spec US3-S3, FR-014).
- [ ] T021 [US3] Test that a note's coordinates survive a view change (spec Edge
      Cases).
- [ ] T022 [US3] Test that the composed draft has the shape 007 and 010 have, over
      a constructed note set (spec US3-S2).
- [ ] T023 [US3] Commit a test asserting the review path writes nothing outside
      `tmp_path` (spec US3-S3, SC-003).
