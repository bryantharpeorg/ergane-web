# Tasks: A gate tells the truth twice

The two phases are independent and dispatch together. Nothing in Phase 2 waits on
anything in Phase 1, and they share no file.

## Phase 1: User Story 1 - A test proves degradation without destroying live state

- [ ] T001 [US1] Replace the `shutil.rmtree` of the fixture's `.git` in
      `test_the_live_read_never_falls_back_to_a_recording` with a rename, so the
      checkout becomes unwalkable without taking a directory away from a
      concurrent git process (spec US1-S1, FR-001, plan D1).
- [ ] T002 [US1] Keep the assertion exactly as it stands: the live read still
      raises `TransportFailed` or `QueryRefused`, and the raised error still
      names `LANDING_READ` (spec US1-S2, FR-002).
- [ ] T003 [US1] Add a guard test that scans `tests/` and fails if any test
      removes a `.git` directory, reading the source rather than executing it
      (spec US1-S3, FR-003, plan D2).
- [ ] T004 [US1] Leave the fixture's own teardown able to clean up after the
      rename (plan Named traps).
- [ ] T005 [US1] Prove the fix by control: run the altered file twenty
      consecutive times and record that no `shutil` `FileNotFoundError` occurs
      (spec SC-001, plan Gates).

## Phase 2: User Story 2 - A graph says where it came from

- [ ] T006 [US2] Return the source alongside the graph from `_read_workgraph` in
      `pane/floor_document.py`, taken from which of its three branches ran and
      from nothing else (spec US2-S1, US2-S2, FR-004, FR-005, plan D3).
- [ ] T007 [US2] Carry that provenance onto the epic in the floor document,
      beside the graph it explains and never in `degraded` (spec US2-S2, FR-005,
      plan D4).
- [ ] T008 [US2] Leave a graph that was never read without a provenance, so the
      unparseable and both-absent paths keep 012's meanings unchanged (spec Edge
      Cases, FR-007, plan Named traps).
- [ ] T009 [US2] Add `specs/*/workgraph.json` to `.gitignore`, without removing
      any file already on disk (spec US2-S3, FR-006, plan D5).
- [ ] T010 [US2] Test that a seam-satisfied read reports the seam as its source
      and still does not open the archive (spec US2-S1, FR-004, FR-007).
- [ ] T011 [US2] Test that an archive-satisfied read reports the archive as its
      source and produces no `degraded` entry (spec US2-S2, FR-005).
- [ ] T012 [US2] Test that `git status --porcelain` is silent after a graph is
      derived to the seam's path (spec US2-S3, SC-003).
- [ ] T013 [US2] Test the four layout laws at every width and in both themes the
      Desk suite already sweeps (spec US2-S4, FR-008).
