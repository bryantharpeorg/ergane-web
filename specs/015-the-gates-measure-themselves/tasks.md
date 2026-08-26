# Tasks: The gates measure themselves

## Phase 1: User Story 1 - The backend gate measures its own reach

- [ ] T001 [US1] Add `pytest-cov` to the backend dev dependencies (spec FR-001,
      constitution VII — approved by this spec and nothing more).
- [ ] T002 [US1] Configure coverage over `pane/` in `pyproject.toml`, writing
      Cobertura `coverage.xml` at the repository root plus a terminal summary
      (spec US1-S1, plan D3).
- [ ] T003 [US1] Measure the current figure and commit it as
      `[tool.coverage.report] fail_under` — the measured baseline, not a round
      number (spec US1-S3, plan D1, D2).
- [ ] T004 [US1] Update the `test` gate command in `ergane.yaml` and the `test` job
      in `.github/workflows/ergane-gates.yml` together (spec US1-S1, FR-011).
- [ ] T005 [US1] Verify nothing the coverage run needs lives in `HOME`, and that
      every artifact is written inside the worktree (spec US1-S4, D-013).
- [ ] T006 [US1] Prove the floor bites: with a control, drop coverage below the
      floor and observe the gate exit non-zero naming both numbers (spec US1-S2).
      A green run is evidence, not proof.

## Phase 2: User Story 2 - The frontend gate measures its own reach

- [ ] T007 [US2] Add `@vitest/coverage-v8` to `web` dev dependencies (spec FR-005).
- [ ] T008 [US2] Configure coverage over `web/src` in the vitest config, writing a
      machine-readable report at a declared path under `web/` plus a terminal
      summary (spec US2-S1, plan D3).
- [ ] T009 [US2] Measure and commit the frontend floor in the vitest config (spec
      US2-S3, plan D1, D2).
- [ ] T010 [US2] Update the `unit` gate command and its workflow job together
      (spec US2-S1, FR-011).
- [ ] T011 [US2] Prove the frontend floor bites by control (spec US2-S2).

## Phase 3: User Story 3 - A fifth gate inventories what this repository depends on

- [ ] T012 [US3] Add `pip-audit` to the backend dev dependencies (spec FR-008).
- [ ] T013 [US3] Add an `audit` gate to `ergane.yaml` that audits the `uv`
      lockfile and the `npm` lockfile, writing each result as JSON at a declared
      path (spec US3-S1).
- [ ] T014 [US3] Add an `audit` job of the same name to
      `.github/workflows/ergane-gates.yml` (spec US3-S4, FR-011). The branch
      ruleset is the operator's to change; do not attempt it.
- [ ] T015 [US3] Fail on the declared severity threshold only; record everything
      below it in the JSON (spec US3-S2, plan D4).
- [ ] T016 [US3] Fail with the network named when the advisory lookup cannot
      complete, and never emit an all-clear from a lookup that did not happen
      (spec US3-S3, plan D5).
- [ ] T017 [US3] Test the threshold behaviour and the unreachable-network
      behaviour over recorded audit output; do not depend on a live advisory
      feed in a test (spec US3-S2, US3-S3).
