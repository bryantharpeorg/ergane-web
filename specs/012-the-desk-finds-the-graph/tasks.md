# Tasks: The Desk finds the graph

## Phase 1: User Story 1 - The Desk reads the archive when the seam is silent

- [ ] T001 [US1] Resolve the archive root the way `ShowfloorReaders.from_reader`
      does — `specs_root.parent / "docs" / "dags"` — so the two rooms cannot
      drift on where the archive lives (spec US1-S1).
- [ ] T002 [US1] In `pane/floor_document.py`, try the seam first and fall back to
      `docs/dags/<dir>.json` when it has no graph (spec US1-S1, US1-S3).
- [ ] T003 [US1] A read satisfied by the archive appends no `degraded` entry, so
      the unreachable notice does not render (spec US1-S1).
- [ ] T004 [US1] When neither source answers, report the seam's failure, not the
      archive's, matching the Showfloor's stated reason (spec US1-S2).
- [ ] T005 [US1] An archive that exists and will not parse reports `unparseable`
      rather than `transport` (spec US1-S4).
- [ ] T006 [US1] Test the archive-satisfied path over a constructed corpus: graph
      present, `degraded` empty (spec US1-S1). Construct it; never pin the live
      corpus.
- [ ] T007 [US1] Test the neither-source path: exactly one entry, naming the seam
      (spec US1-S2, SC-003).
- [ ] T008 [US1] Test that a successful seam read does not touch the archive
      (spec US1-S3).
- [ ] T009 [US1] Test the unparseable-archive path (spec US1-S4).

## Phase 2: User Story 2 - The epic row draws the graph it now has

- [ ] T010 [US2] Draw each story's chevron from the dependency its graph declares
      (spec US2-S1).
- [ ] T011 [US2] Keep `UNDECLARED` meaning "no declared dependency"; never render
      it for a graph that could not be read (spec US2-S2).
- [ ] T012 [US2] Name a mismatch between archive node ids and declared story keys
      in `degraded`, and do not invent a topology from the recognised half (spec
      Edge Cases).
- [ ] T013 [US2] Test chevrons against a constructed graph with merge edges (spec
      US2-S1).
- [ ] T014 [US2] Test that a genuinely edgeless story still reads `UNDECLARED`
      (spec US2-S2).
- [ ] T015 [US2] Playwright: the Desk reports zero violations of the four layout
      laws at every width and in both themes the suite sweeps (spec US2-S3).
