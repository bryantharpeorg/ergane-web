# Tasks: The gates show their work

## Phase 1: User Story 1 - The evidence reaches the pane

- [ ] T001 [US1] Add an evidence reader to `pane/readers.py` calling
      `factory.verify.store.node_history` over `connect_readonly` — the seam
      only, no SQL of this repository's own (spec US1-S1).
- [ ] T002 [US1] Resolve the store path from configuration the way the other
      read-only stores are resolved (spec US1-S1).
- [ ] T003 [US1] Carry per-attempt gates, ladder summary and judge findings on
      the story in the showfloor document (spec US1-S1).
- [ ] T004 [US1] Degrade in-section on a failed read, naming the read, without
      affecting another section (spec US1-S2).
- [ ] T005 [US1] Render model and persona as unknown; do not consult the persona
      registry (spec US1-S3).
- [ ] T006 [US1] Test the assembled document over a constructed store: gates,
      ladder and findings present (spec US1-S1). Construct it; never pin the
      live corpus.
- [ ] T007 [US1] Test the unreadable-store path: one degraded entry, other
      sections intact (spec US1-S2).
- [ ] T008 [US1] Test that model and persona are unknown and that no registry
      lookup happens (spec US1-S3).

## Phase 2: User Story 2 - The gate run reads as a timeline

- [ ] T009 [US2] Render the gate steps in the detail pane: name, outcome,
      duration, command (spec US2-S1).
- [ ] T010 [US2] Draw gates recorded as concurrent as concurrent, from
      `concurrent_gates` and not from durations (spec US2-S1).
- [ ] T011 [US2] Label the interval *verification*, never wall clock — the store
      cannot support the latter (spec US2-S1, plan trap 1).
- [ ] T012 [US2] Show a failing gate's output tail collapsed; render none for a
      passing gate (spec US2-S2).
- [ ] T013 [US2] Put any rendered tail through the repository's credential sweep
      (spec US2-S3).
- [ ] T014 [US2] Name in the section that the record is current-only and does
      not survive re-dispatch (spec US2-S4).
- [ ] T015 [US2] Test the collapsed-tail behaviour both ways (spec US2-S2).
- [ ] T016 [US2] Test the sweep against a planted credential-shaped string (spec
      US2-S3).

## Phase 3: User Story 3 - The section is honest at every width

- [ ] T017 [US3] Playwright: the four layout laws report zero violations across
      every width and both themes the suite sweeps (spec US3-S1).
- [ ] T018 [US3] A story with no recorded attempt renders no section, not an
      empty one (spec US3-S2).
- [ ] T019 [US3] Test the no-attempt case (spec US3-S2).
