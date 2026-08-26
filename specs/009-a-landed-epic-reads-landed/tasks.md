# Tasks: A landed epic reads landed

Three phases, one per story, serial on `depends_on_merged`.

## Phase 1: User Story 1 - Landing truth outlives the workflow

- [ ] T001 [US1] Find ergane's exported surface for landing facts — the library
      the `spec landed` verb calls, not the verb (spec US1-S1). If none is
      exported, report a finding and stop; do not write git plumbing here.
- [ ] T002 [US1] Add the landing-branch setting to `pane/config.py`, defaulting
      to `dev`, and never hard-code the branch (spec US1-S1).
- [ ] T003 [US1] Extend `ShowfloorReaders` with a landing-facts reader that
      degrades through the same `TransportFailed`/`QueryRefused` vocabulary as
      every other read (spec US1-S3).
- [ ] T004 [US1] In `pane/showfloor.py`, layer the corpus read under the live
      `epic_status` answer: live governs every story it names; the corpus fills
      `merged` for the rest (spec US1-S2).
- [ ] T005 [US1] Compute `stories_landed` from the layered result so an
      unattested finished epic reports its true count (spec US1-S1).
- [ ] T006 [US1] A story neither source can place takes the Unknown Rule and is
      named in the entry's degraded notes — never the ladder's first stop
      (spec US1-S3).
- [ ] T007 [US1] Extend `tests/corpus.py` to construct a spec that is landed by
      content with no live workflow, and assert `merged` and `n/n` (spec
      US1-S1). Construct it; never pin the repository's live corpus.
- [ ] T008 [US1] Test that a live answer and the corpus disagreeing resolves to
      the live answer for every story the live answer names (spec US1-S2).
- [ ] T009a [US1] Carry the landing commit's timestamp on the `merged` stop, and
      the landing SHA and the PR number parsed from the squash subject in the
      facts — the three the branch already holds (spec US1-S2).
- [ ] T009b [US1] Leave every fact the branch cannot supply under the Unknown
      Rule; add no store and read no history the branch does not hold (spec
      US1-S2).
- [ ] T009c [US1] Test that a landed story's detail names when it merged, its SHA
      and its PR, and that the rest stay unknown (spec US1-S2, SC-004).
- [ ] T009 [US1] Test the unplaceable-story path: Unknown Rule, degraded note,
      not `ready` (spec US1-S4).
- [ ] T010 [US1] Test that frontmatter attesting `landed` does not override a
      branch that lacks the stories, and that the disagreement is named (spec
      Edge Cases).

## Phase 2: User Story 2 - The fourth law is committed, not assumed

- [ ] T011 [US2] Add the fourth law to the existing `measureLaws` harness in
      `web/tests/smoke/`: no element with a non-transparent computed background
      may paint over a text leaf it does not own (spec US2-S1).
- [ ] T012 [US2] Run it over every route, width and theme the sweep already
      covers, and keep the existing element/leaf floors so an empty page cannot
      pass (spec US2-S1).
- [ ] T013 [US2] Add the mutation control: plant an inline element with an
      opaque background over neighbouring text, assert law four goes red (spec
      US2-S2).
- [ ] T014 [US2] In the same control, assert laws one through three stay green
      against that planted violation (spec US2-S3).
- [ ] T015 [US2] Update `DESIGN.md`'s § Layout citation in the harness header so
      the law's authority is readable from the test (spec US2-S1).

## Phase 3: User Story 3 - The suite reads no host state

- [ ] T016 [US3] Rewrite `test_operational_error_becomes_transport` to construct
      its own failure condition instead of relying on the operator's runtime
      root being absent (spec US3-S1).
- [ ] T017 [US3] Sweep the suite for other reads of paths outside the repository
      and give each the same treatment (spec US3-S2).
- [ ] T018 [US3] Add a committed test asserting no test module reads a path
      outside the repository's own tree (spec US3-S2).
- [ ] T019 [US3] Verify `uv run pytest -q` passes with `ERGANE_ROOT` set to a
      populated runtime root and with it unset, and that the two agree (spec
      US3-S2, SC-003).

## Phase 4: User Story 4 - The stage says what its spec is for

- [ ] T020 [US4] Extend the spec-text parse in `pane/showfloor.py` to lift the
      first paragraph of `## Context` as a spec-level intent, reusing the parse
      that already reads story intents (spec US4-S1).
- [ ] T021 [US4] Fall back to `## Sketch` when `## Context` is absent; a spec
      with neither carries no intent (spec US4-S2).
- [ ] T022 [US4] Carry the intent on the rail entry in the showfloor document
      (spec US4-S1).
- [ ] T023 [US4] Render the band beneath the stage, above the legend row,
      independent of selection; render nothing when there is no intent (spec
      US4-S2, US4-S3).
- [ ] T024 [US4] Move the room's own two-sentence explainer to the
      no-spec-selected case only (spec US4-S4).
- [ ] T025 [US4] Playwright: the band reads identically with and without a story
      selected, across both themes (spec US4-S3, SC-005).
- [ ] T026 [US4] Playwright: with no spec selected the room explainer occupies
      the band; with a spec selected the spec's goal does (spec US4-S4).
- [ ] T027 [US4] Test a spec with neither heading: no band, not an empty one
      (spec US4-S2).
