# Tasks: A spec reads its record

## Phase 1: User Story 1 - A story's attempts count themselves

- [ ] T001 [US1] Create `pane/build_record.py` with a pure derivation over the
      documents `Reader.node_history` returns — no I/O, no reader import, no
      store (spec US1-S1, plan D2).
- [ ] T002 [US1] Derive per story: attempt count, each attempt's verdict, and the
      gate outcomes recorded for that attempt (spec US1-S1, FR-001).
- [ ] T003 [US1] Mark a story with more than one recorded attempt as rework and
      state the number of extra attempts (spec US1-S2, FR-002).
- [ ] T004 [US1] Report an empty history as unrecorded, never as zero attempts
      (spec US1-S3, FR-003, plan D5).
- [ ] T005 [US1] Carry `loop_summary` verbatim as the ladder the attempt ran
      under; do not read `ergane.yaml` (spec US1-S4, FR-004).
- [ ] T006 [US1] Render persona and model as `unknown` and add a test that fails
      if the persona registry is ever consulted (spec US1-S5, FR-005, plan D5).
- [ ] T007 [US1] Cover every branch in `tests/test_build_record.py` with inline
      documents shaped as the seam returns them — this is a unit test over a pure
      function, not a fixture floor (spec US1-S1..S5, constitution IV).

## Phase 2: User Story 2 - A spec's clock reads from what landed

- [ ] T008 [US2] Create `pane/pace.py` with a pure derivation over landing facts
      and `attempt_timings` rows — no I/O, no reader import (spec US2-S1, plan D2).
- [ ] T009 [US2] Derive the span from first landing to last, and each story's
      merge instant, from landing facts (spec US2-S1, FR-006).
- [ ] T010 [US2] Report a spec with an unmerged story as an open span naming those
      stories, never as a completed duration (spec US2-S2, FR-007).
- [ ] T011 [US2] Label every interval built from the store's attempt timestamps as
      verification time; `AttemptTiming`'s own docstring is the authority for why
      it is not story time (spec US2-S3, FR-008).
- [ ] T012 [US2] Return `unknown` for any interval the facts cannot bound — never
      `0`, never a dash (spec US2-S4, FR-009, plan D5).
- [ ] T013 [US2] Cover every branch in `tests/test_pace.py` with inline documents
      (spec US2-S1..S4, constitution IV).

## Phase 3: User Story 3 - One route answers with the whole record

- [ ] T014 [US3] Add `attempt_timings` to the `Reader` protocol and implement it
      on `LiveReader` over `connect_readonly`, raising `TransportFailed` for a
      store that will not open and `QueryRefused` for one that answers with an
      error — 001's two modes (spec US3-S4, FR-013, plan D3).
- [ ] T015 [US3] Implement `attempt_timings` on `FixtureFloor` and
      `UnconfiguredReader` on the same terms as `node_history` (spec US3-S4,
      plan D3).
- [ ] T016 [US3] Create `pane/record_document.py` assembling US1's and US2's
      derivations into one document, one entry per story the spec's work graph
      declares (spec US3-S1, FR-010).
- [ ] T017 [US3] Reconcile the two sides: a story in the work graph with no
      evidence row appears as unrecorded rather than being dropped (spec US3-S5,
      FR-014).
- [ ] T018 [US3] Degrade in-section on a failed read, naming the read and the
      store, without failing the rest of the document (spec US3-S3, FR-012,
      constitution III).
- [ ] T019 [US3] Put the current-record statement on the document itself, so every
      surface inherits it (spec US3-S6, FR-015, plan D4).
- [ ] T020 [US3] Serve `GET /api/spec/{spec_dir}` from `pane/app.py` behind the
      same bearer token as every other route, and assert 401 without it (spec
      US3-S2, FR-011, constitution VI).
- [ ] T021 [US3] Cover the assembly in `tests/test_record_document.py`, including
      both degraded modes and the reconciliation (spec US3-S1..S6).

## Phase 4: User Story 4 - The record room reads

- [ ] T022 [US4] Add `/spec/<spec-dir>` to `web/src/routes.ts` with its path
      helper and predicate, following the review room's shape (spec US4-S4,
      FR-019).
- [ ] T023 [US4] Add the route to `route-manifest.json` and extend the committed
      manifest test so a room that is served and unlisted fails (spec US4-S4,
      FR-019).
- [ ] T024 [US4] Build the room under `web/src/record/`, rendering each story's
      attempts, verdicts, gate outcomes and landing as tables — `DESIGN.md` § The
      record room in this world is the authority (spec US4-S1, FR-016,
      constitution VIII).
- [ ] T025 [US4] Render every unknown cell under the Unknown Rule, with no "live"
      wording adjacent (spec US4-S2, FR-017, plan D5).
- [ ] T026 [US4] Put a door to this room on a landed spec's stage (spec US4-S5,
      FR-020, plan D6).
- [ ] T027 [US4] Measure the four layout laws at 1280, 1440 and 2560 in both
      themes with `web/src/review/laws.ts`, and assert zero violations in the
      smoke gate (spec US4-S3, FR-018, plan named traps).

## Phase 5: User Story 5 - The demo floor can carry the record

- [ ] T028 [US5] Add a verification verb to `scripts/record-fixtures.py` writing
      one document per node, verbatim as the seam returned it (spec US5-S1,
      FR-021, plan D7).
- [ ] T029 [US5] Write a provenance envelope beside each document — capture
      instant, seam, source floor, notes — never inside the payload (spec US5-S1,
      FR-021, spec 001 FR-009).
- [ ] T030 [US5] Run the credential sweep over each recorded document and refuse
      one that does not pass rather than redacting it; anchor secret-looking
      prefixes on a word boundary (spec US5-S2, FR-022, plan named traps).
- [ ] T031 [US5] Under `PANE_DEMO=1` with no recording, name the document that was
      looked for and render no invented history (spec US5-S3, FR-023,
      constitution V).
- [ ] T032 [US5] Make `PANE_DEMO_TRANSPORT_FAIL=epics` degrade the record section
      exactly as a live transport failure does (spec US5-S4, FR-024).
- [ ] T033 [US5] Record the recording procedure in `fixtures/README.md` beside the
      landing verb's, so re-recording is a command and never a hand edit (spec
      US5-S1, FR-021).
