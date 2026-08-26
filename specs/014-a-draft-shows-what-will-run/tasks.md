# Tasks: A draft shows what will run

## Phase 1: User Story 1 - The trio reads together

- [ ] T001 [US1] Add the `/draft/<spec-dir>` route behind the existing bearer-token
      dependency, resolving `<spec-dir>` as a single directory name against the
      configured specs root and refusing anything containing a separator (spec
      US1-S5, plan D5).
- [ ] T002 [US1] Read `spec.md`, `plan.md` and `tasks.md` from that directory and
      return them in that order (spec US1-S1).
- [ ] T003 [US1] Report an absent `plan.md` or `tasks.md` as absent, producing no
      `degraded` entry (spec US1-S2, plan D3).
- [ ] T004 [US1] Carry the working-tree revision read and the read instant on the
      document (spec US1-S3).
- [ ] T005 [US1] Degrade honestly when the directory cannot be read, naming the
      path attempted, and render no trio (spec US1-S4).
- [ ] T006 [US1] Render the three documents as markdown in one view. If no markdown
      renderer is already vendored in `web/`, STOP and ask the operator rather than
      adding a dependency (spec US1-S1, constitution VII, plan Named traps).
- [ ] T007 [US1] Show the revision and read instant on screen (spec US1-S3).
- [ ] T008 [US1] Test the three-document read over a spec directory constructed in
      `tmp_path` (spec US1-S1). Never pin the live corpus.
- [ ] T009 [US1] Test that a directory with only `spec.md` renders and degrades
      nothing (spec US1-S2).
- [ ] T010 [US1] Test the unreadable-directory path and the 401 (spec US1-S4, US1-S5).

## Phase 2: User Story 2 - Each check answers in its own name

- [ ] T011 [US2] Call `derive_workgraph` on the spec text and carry its result or
      its `DerivationError` message verbatim (spec US2-S1, US2-S2, plan D1).
- [ ] T012 [US2] Call `check_slice_coverage` and `check_prompt_assembly`, carrying
      each answer attributed to the function that produced it (spec US2-S3).
- [ ] T013 [US2] When the graph did not compile, mark every graph-dependent check
      as not run rather than failed (spec US2-S2, US2-S5, FR-010).
- [ ] T014 [US2] When `tasks.md` is absent, mark the checks that need it as not
      run (spec US2-S5).
- [ ] T015 [US2] Render the results as an attributed list, with no composite
      verdict, and state on screen that `ergane spec validate`'s verdict is not
      available to the pane (spec US2-S4, plan D2). Do not add a summary chip.
- [ ] T016 [US2] Test that a compiling graph reports success attributed to the
      deriver (spec US2-S1).
- [ ] T017 [US2] Test that a `DerivationError` renders unsoftened and suppresses
      graph-dependent checks (spec US2-S2).
- [ ] T018 [US2] Test the not-run path for a missing `tasks.md` (spec US2-S5).
- [ ] T019 [US2] Test that no composite verdict appears anywhere in the rendered
      view (spec US2-S4, SC-003).

## Phase 3: User Story 3 - The graph draws what will run

- [ ] T020 [US3] Draw the compiled graph with the Showfloor's existing stage
      assets in the unlit form, carrying no run state on any node (spec US3-S1,
      plan D4).
- [ ] T021 [US3] Stroke `depends_on_merged` and `depends_on` edges with the two
      strokes `DESIGN.md` names (spec US3-S2).
- [ ] T022 [US3] Draw no stage at all when the graph did not compile (spec US3-S3).
- [ ] T023 [US3] Test the unlit render against a constructed multi-node graph
      (spec US3-S1).
- [ ] T024 [US3] Test that a non-compiling graph draws no stage (spec US3-S3).
- [ ] T025 [US3] Playwright: zero violations of the four layout laws at every
      width and in both themes the suite sweeps (spec US3-S4).
