# Tasks: The demo floor owns its landings

## Phase 1: User Story 1 - The demo floor's landings are recorded, like everything else

- [ ] T001 [US1] Teach `FixtureReader` to replay `fixtures/landing/landing-facts.json`,
      returning the live read's shape per spec directory (spec US1-S4, plan D2).
- [ ] T002 [US1] Report a spec the fixture does not name, or a fixture that will
      not parse, as a NAMED degraded read — never an empty result (spec US1-S5,
      Edge Cases, plan D3).
- [ ] T003 [US1] Bind demo mode's `landing_facts` to that replay at the call
      sites that build readers, leaving `pane/landing.py` alone (spec US1-S1,
      plan D1).
- [ ] T004 [US1] Leave the `PANE_DEMO=0` path reading `landed_facts` exactly as
      today (spec US1-S3, FR-004, plan Named traps).
- [ ] T005 [US1] Test that no git subprocess is spawned under `PANE_DEMO=1`, by
      intercepting the spawn point rather than by checking the answer (spec
      US1-S1, FR-002, plan D4).
- [ ] T006 [US1] Test that every room renders identically in a directory that is
      not a git repository at all (spec US1-S2, SC-001).
- [ ] T007 [US1] Test that the replayed shape matches the live read's field for
      field (spec US1-S4).
- [ ] T008 [US1] Test the missing-spec and unparseable-fixture paths produce a
      named degraded read (spec US1-S5, SC-003).
- [ ] T009 [US1] Test that `PANE_DEMO=0` still reaches the live read (spec
      US1-S3).
- [ ] T010 [US1] Record the fixture's provenance in `fixtures/README.md` beside
      the others: what it is, the seam and branch it came from, and how to
      re-record it (constitution V).
