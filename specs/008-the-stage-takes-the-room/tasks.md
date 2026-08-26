# Tasks: the stage takes the room

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) ·
**Authority**: `DESIGN.md` (D-016) § Layout, § Stage, § Detail pane

Every task cites its FR and the scenario it is scored against; appearance tasks
cite the `DESIGN.md` clause they conform to. No Setup phase: nothing is shared
across the three stories except the stylesheet, and the merge edges serialise
that.

---

## Phase 1: User Story 1 - The corpus tests assert shape, not this morning's corpus (Priority: P1) 🎯 MVP

**Goal**: the backend and smoke suites prove the showfloor document's contract
from conditions they construct, so an operator attesting a spec or archiving a
work graph cannot turn them red.

**Independent test**: mutate a scratch corpus to 005 `landed` with
`docs/dags/005-one-epic-on-stage.json` present; `uv run pytest -q` and
`npm --prefix web run test:smoke` both green.

- [ ] T001 [US1] In `tests/test_showfloor_document.py`, replace every assertion that reads a named spec's `state:` frontmatter with one that constructs the state through `assemble(readers=...)`: `test_the_rail_is_the_corpus_in_order` and the ladder-stop cases at :344 and :544 assert the *mapping* (a spec whose frontmatter says `landed` produces chip `landed` and stops through `merged`) over a constructed corpus, never over whatever `specs/` says today (FR-002) (spec US1-S2)
- [ ] T002 [US1] In `tests/test_showfloor_document.py`, rewrite `test_a_spec_with_no_compiled_workgraph_is_an_entry_with_a_note` to inject a `workgraph` reader returning `None` for a chosen spec — the shape `test_an_unparseable_workgraph_is_told_apart_from_a_missing_one` already uses — so the test proves "a missing graph degrades to headings" instead of proving "005 has no archived graph" (FR-002) (spec US1-S2)
- [ ] T003 [US1] Audit the rest of `tests/` and `web/tests/` for the same class and convert each: any assertion whose truth depends on a named spec's current frontmatter, on a named file existing under `docs/dags/`, or on which specs are in the floor's degraded list. Keep every contract that was asserted; change only where the condition comes from (FR-002) (spec US1-S2)
- [ ] T004 [US1] Create `tests/test_no_test_pins_live_corpus.py`: read every file under `tests/` and `web/tests/`, fail on a match for a named spec directory appearing beside a frontmatter-state assertion, and on a `docs/dags/<name>.json` literal outside a fixture-construction helper. Include a self-check that the guard would catch a planted violation, so a guard that matches nothing cannot pass (FR-001) (spec US1-S1)
- [ ] T005 [US1] In `web/tests/smoke/showfloor.spec.ts`, rewrite *the pulse is authored at 1.6s, and reduced motion suppresses it* to assert the authored `animation` declaration from the stylesheet and the `prefers-reduced-motion` override, instead of waiting for a selector that exists only while a real epic is building; the case must pass on an idle floor (FR-003) (spec US1-S3)
- [ ] T006 [US1] Prove it: in the story's own diff add a test that copies the corpus into a tmp tree, flips 005's frontmatter to `landed`, writes `docs/dags/005-one-epic-on-stage.json`, assembles against it, and asserts the document is well-formed — the exact condition that is red today (FR-002) (spec US1-S2)
- [ ] T007 [US1] Run `uv run pytest -q`, `npm --prefix web run typecheck`, `test:unit`, `test:smoke`. All four exit 0 (FR-001..003) (spec US1-S1..S3)

**Checkpoint**: PR #37 (attest 005 landed) and PR #40 (archive the derived work
graphs) can go green on rebase without either one touching source.

---

## Phase 2: User Story 2 - The stage takes the room the pane is not using (Priority: P1)

**Goal**: with nothing selected the detail track is `0`, the stage has the
width, the room's two sentences sit beneath the stage, and no stage on the
floor clips at any tested width.

**Independent test**: every spec, 1280/1600/2560, both themes, nothing
selected — `scrollWidth === clientWidth` on `.dag-scroll` for all of them.

- [ ] T008 [US2] In `web/src/showfloor/Showfloor.tsx`, carry the selection into the grid: the `.cols` element gains a state hook (`data-selection="none" | "story"`) so the track shape is a CSS concern and not an inline style, and nothing remounts when it changes (`DESIGN.md` § Layout, D-016 clause a) (FR-004) (spec US2-S1)
- [ ] T009 [US2] In `web/src/showfloor/showfloor.css`, resolve `.showfloor .cols[data-selection="none"]` to `17rem minmax(0,1fr) 0` and leave the authored `17rem minmax(0,1fr) 26rem` for the selected case; the `1180px` and `820px` media rules keep their current behaviour in both selection states (`DESIGN.md` § Layout) (FR-004, FR-006) (spec US2-S1, US2-S3)
- [ ] T010 [US2] In `web/src/showfloor/DetailPane.tsx` and `Showfloor.tsx`, render `[data-detail-empty]` beneath the stage and above the legend row when nothing is selected, carrying the same two sentences verbatim; it is not rendered inside the collapsed track, and it is not `display: none` anywhere (`DESIGN.md` § Detail pane, D-016) (FR-005) (spec US2-S2)
- [ ] T011 [US2] Re-measure the wires when the selection changes: `Wires.tsx` measures on mount and `resize`, and a track collapse fires neither. Drive the same measure path from the selection change so the paths follow the cards (plan Risks) (FR-004) (spec US2-S1)
- [ ] T012 [US2] In `web/tests/smoke/showfloor.spec.ts`, add the FR-007 sweep: every spec in the rail × {1280, 1600, 2560} × {light, dark}, nothing selected, assert `scrollWidth === clientWidth` on `.dag-scroll`, and assert the sweep visited a floor of at least five specs so an empty rail cannot pass it (FR-007) (spec US2-S4)
- [ ] T013 [US2] Add the selection round-trip assertions: with nothing selected the stage's client width exceeds its selected-state width by the pane's track at each width; picking a story restores `26rem`, fills the pane, removes the beneath-stage explanation, and leaves a wire's `d` attribute consistent with the re-measured card boxes (FR-004, FR-006) (spec US2-S1, US2-S3)
- [ ] T014 [US2] Assert `[data-detail-empty]`'s text is the authored two sentences unchanged, its computed visibility is visible with non-zero box, and its box's top is below the stage's bottom (FR-005) (spec US2-S2)
- [ ] T015 [US2] Re-run FR-014's three layout laws across the FR-007 sweep with 005's element and text-leaf floors and 005's mutation control still going red on a planted escape, runaway and collision (FR-008) (spec US2-S5)
- [ ] T016 [US2] Run the carried-over `web/tests/unit/DetailPane.test.tsx` and the 005 FR-015 smoke block unchanged except for selector drift; name every selector moved in the test file's header (plan Risks) (FR-006) (spec US2-S3)

**Checkpoint**: 235px, 27px and 27px of hidden graph all read 0.

---

## Phase 3: User Story 3 - When the stage scrolls, the scroll wears the room's clothes (Priority: P2)

**Goal**: the one surface the tokens never reached joins the room, and a graph
that fits pays nothing for it.

**Independent test**: force a stage narrower than its graph; read computed
`scrollbar-width`/`scrollbar-color` and the stylesheet's `::-webkit-scrollbar`
rules in both themes.

- [ ] T017 [US3] In `web/src/showfloor/showfloor.css`, give `.showfloor .dag-scroll` `scrollbar-width: thin` and `scrollbar-color: var(--rule) transparent`, and add `::-webkit-scrollbar` rules: no `:horizontal` stepper buttons, a `var(--rule)` thumb brightening on hover, transparent track, and every colour a token — no literal in either rule (`DESIGN.md` § Stage, D-016 clause b) (FR-009, FR-010) (spec US3-S1, US3-S2)
- [ ] T018 [US3] In `web/tests/smoke/showfloor.spec.ts`, add computed-style assertions for `scrollbar-width` and `scrollbar-color` on a scrolling stage in both themes, resolving `--rule` from the theme rather than comparing a hard-coded colour (FR-009) (spec US3-S1)
- [ ] T019 [US3] Add a stylesheet-text assertion over the built CSS: the `::-webkit-scrollbar` block declares no stepper buttons, declares a hover state, and contains no `#`, `rgb(` or named-colour literal (FR-010) (spec US3-S2)
- [ ] T020 [US3] Assert the fitting case gains no horizontal chrome: on a stage whose graph fits, the scroller's `clientWidth` equals its `offsetWidth` less borders, and the graph's box matches US2's measurement — a `scrollbar-gutter` reservation must fail this (FR-011) (spec US3-S3)
- [ ] T021 [US3] Run all four gates; re-run the 005 constitution I sweeps (zero non-GET, no write control on the Showfloor) against the finished room (FR-009..011) (spec US3-S1..S3)

**Checkpoint**: the operator's browser and the gate agree about what the scroll
looks like, and the room that does not scroll is unchanged.
