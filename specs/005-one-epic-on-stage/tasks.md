# Tasks: one epic on stage

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) ·
**Authority**: `DESIGN.md` (D-015) · **Comp**: `.impeccable/mocks/showfloor-redrawn.html`

Every task cites its FR and the scenario it is scored against; appearance
tasks cite the `DESIGN.md` section they conform to. No Setup phase: the shared
ladder model is US1's, where it is needed first.

---

## Phase 1: User Story 1 - The showfloor document: everything the room renders, in one join (Priority: P1) 🎯 MVP

**Goal**: one backend document carrying rail entries, stories with titles and
requirement keys, derived ladder stops, and honest degradation.

**Independent test**: assemble against the Fixture floor and this repo's
specs; assert shape, derivation, parsing, and every fault mode from fixtures.

- [ ] T001 [US1] Create `pane/showfloor.py` with `parse_story_headings(spec_md_text) -> dict[str, StoryHeading]` matching `^### User Story (\d+) - (.+?) \(Priority: (P\d)\)$` per line; return `story_key` (`US<n>`), title, priority; a heading that does not match contributes nothing — the caller falls back — and the function never raises on arbitrary text (FR-002) (spec US1-S2)
- [ ] T002 [US1] In `pane/showfloor.py`, add `derive_ladder(state, awaiting_operator, terminal_reason, spec_state) -> Ladder` implementing `DESIGN.md` § The status ladder's table as a mapping, not scattered conditionals: PENDING→ready, KEY_ISSUED/RUNNING→building, VERIFYING→verifying, PASSED/PR_OPEN→"pr open", ENQUEUED→queue, MERGED→done-through-six; `awaiting_operator is True` overrides the active stop's tone to `waiting`; FAILED/KILLED freeze the ladder with `terminal_reason` copied verbatim; a story of a `draft`/`ready` spec rests at `ready` with the spec's own state carried for the rail chip (FR-003) (spec US1-S3)
- [ ] T003 [US1] In `pane/showfloor.py`, add `assemble_showfloor(specs_root, readers) -> dict`: walk spec directories in sorted order; per spec read frontmatter state (absent block → `draft`, 001's reader conventions), `workgraph.json` (`story_key`, `requirement_keys`, `depends_on`, `depends_on_merged` per node), headings via T001 with `story_key` fallback named in that spec's `unknown` list, and the live `epic_status` via 001's reader; emit rail entry (dir, state, landed/total) + stories (identity, title, priority, requirement_keys, ladder via T002, facts: attempt, pr_number, landing_state, verified) (FR-001, FR-002) (spec US1-S1, US1-S2)
- [ ] T004 [US1] In `pane/showfloor.py`, degrade per read: workgraph transport/unparseable and `epic_status` transport/refusal each append `{read, mode, detail}` with 001's `DegradedEntry` words, keep the entry rendered (stories static at `ready` when live state is unreadable), and leave every other spec untouched (FR-004) (spec US1-S4)
- [ ] T005 [US1] Mount `GET /api/showfloor` on the guarded router in `pane/app.py` beside `/api/floor` — the router-level `require_viewer` covers it by construction; no per-route auth code (FR-001) (spec US1-S1)
- [ ] T006 [US1] Extend `pane/events.py` with a typed `showfloor` event carrying the changed spec's re-assembled entry, reusing 001's SSE stream; consumers ignore unknown types (FR-005) (spec US1-S5)
- [ ] T007 [US1] Create `tests/test_showfloor_document.py`: heading parse (well-formed → title; malformed fixture → `story_key` fallback named in `unknown`); ladder table driven with **all eleven** states plus the `awaiting_operator` override and a draft-spec story, each asserted against the DESIGN.md stop; assembly over this repo's own five specs asserting order, counts and requirement_keys; both 052 fault shapes over the recorded degraded fixtures asserting `mode` distinguishes them (FR-001..004) (spec US1-S1..S4)
- [ ] T008 [US1] Add an events test driving one state change through T006 and asserting the typed payload; run `uv run pytest -q` — the full 001–004 backend suite must stay green (FR-005) (spec US1-S5)

**Checkpoint**: `curl /api/showfloor` (with the token) returns the whole floor,
ladders derived, faults named.

---

## Phase 2: User Story 2 - The rail and the frame: the world's tokens, and a spec to pick (Priority: P1)

**Goal**: the second world's tokens in both themes, a fluid frame, a rail that
selects, deep links.

**Independent test**: render rail + frame against the fixture document in both
themes; assert tokens, chips, routing from the DOM.

- [ ] T009 [US2] Rewrite the token layer of `web/src/styles/global.css` to `DESIGN.md` § Colors: full light set on `:root`; dark redefined under `@media (prefers-color-scheme: dark)` guarded `:root:not([data-theme="light"])` and again under `:root[data-theme="dark"]`; `body { background: var(--ground); color: var(--ink) }`; the type stacks and ramp from § Typography; **delete every `@font-face` and font preload — nothing may load a font file** (FR-006, FR-007) (spec US2-S1, US2-S2)
- [ ] T010 [US2] Keep the Desk's existing tests green while T009 lands: adjust Desk selectors/styles only as far as token renames require — the Desk's restyle is spec 006, and a Desk visual change beyond token names is scope widened (plan D4, § Risks) (FR-006) (spec US2-S1)
- [ ] T011 [US2] Rebuild `web/src/showfloor/Showfloor.tsx` as the frame: appbar (brand, room nav with 2px accent underline, attention badge as a link to `/` carrying the count from the document), `17rem / 1fr / 26rem` grid with `DESIGN.md` § Layout's 1180/820 breakpoints, `max-width: 96rem` (FR-007) (spec US2-S2)
- [ ] T012 [US2] Create `web/src/showfloor/Rail.tsx`: one row per rail entry — mono id, chip from `web/src/showfloor/ladder.ts`'s shared chip mapping (`landed n/n`, `building k/n`, `ready`, dashed `draft`, gold `waiting on you`, alarm `killed`), muted name — selection wash + 3px accent bar per `DESIGN.md` § Epic rail (FR-008) (spec US2-S3)
- [ ] T013 [US2] Wire selection to the URL: `/showfloor/<spec-dir>` selects; unknown dir falls back to default with an in-page named miss; bare `/showfloor` selects the building epic, else newest landed — logic in `Showfloor.tsx`, covered by unit tests over fixture variants (FR-009) (spec US2-S4)
- [ ] T014 [US2] Create `web/tests/unit/tokens2.test.ts`: sweep the stylesheet asserting every § Colors token is defined on bare `:root`, redefined in both dark blocks, and no colour literal appears only inside a theme block; assert zero `@font-face` and zero `fonts/` references anywhere in `web/src` (FR-006, FR-007) (spec US2-S1)
- [ ] T015 [US2] Add `web/tests/unit/Rail.test.tsx` (chips per state variant, order, counts) and Playwright coverage: both `colorScheme` emulations asserting the two grounds differ; layout at 1280/1600/2560 asserting the stage column grows; the request log asserting no font or remote asset; both routes asserting selection (FR-006..009) (spec US2-S1, S2, S4)

**Checkpoint**: the app is visibly the second world; the rail picks and the
URL remembers.

---

## Phase 3: User Story 3 - The stage: one graph, drawn inside its box (Priority: P1)

**Goal**: the selected epic's header, metrics, cards and wires — with the
three layout laws as committed assertions.

**Independent test**: fixture graphs of 0, 2 and 5 nodes at 1280 and 1600 in
both themes; geometry asserted from measured boxes.

- [ ] T016 [US3] Delete the first world's room: `EpicStage.tsx`, `LandingLine.tsx`, `RouteEdge.tsx`, `StationNode.tsx`, `layout.ts`, `motion.ts`, `transitions.ts` and their now-subjectless tests — **in the same commit as their replacements** (plan D4): each replacement test file's header names the assertion it succeeds, and `npm --prefix web run test:smoke` must still collect and pass in this story's own diff (FR-011) (spec US3-S2)
- [ ] T017 [US3] Remove `@xyflow/react` and `@dagrejs/dagre` from `web/package.json` once no import remains; lockfile regenerates via `npm install` — a dependency subtraction, permitted without asking (constitution VII gates additions) (FR-011) (spec US3-S2)
- [ ] T018 [US3] Create `web/src/showfloor/Stage.tsx`: header (display-size mono id, serif name, live story's chip) and the metrics grid — stories, merged, FR count, last-story wall clock, spend to date — spend rendered through the shared unknown helper: `unknown` for NULL, never `0`, the word "live" nowhere (FR-010), per `DESIGN.md` § Stage and § The Unknown Rule (spec US3-S1)
- [ ] T019 [US3] In `Stage.tsx`, lay ranks left→right in declaration order (rank = longest merge-path depth, matching the deriver's ordering), each story a `web/src/showfloor/NodeCard.tsx`: block id, small title, chip, six-stop mini-ladder (4px bars, done olive / active accent-pulse / waiting gold / ahead sunken), mono sub-line — card and ladder styles per `DESIGN.md` § The status ladder and § Stage (FR-011) (spec US3-S2)
- [ ] T020 [US3] Create `web/src/showfloor/Wires.tsx`: after layout (rAF post-mount, and on `resize`), draw one cubic path per edge between measured card boxes into an absolutely-positioned `pointer-events: none` SVG behind the cards — `depends_on_merged` solid 2px `var(--olive)`, `depends_on` dashed 2px `var(--rule)` (FR-012) (spec US3-S3)
- [ ] T021 [US3] Render the edge legend exactly once per page, in `Showfloor.tsx` below the stage — never inside a per-epic component, the first world's repetition defect (FR-012) (spec US3-S3)
- [ ] T022 [US3] In `Stage.tsx`, branch before the canvas: a stage document with zero nodes renders the epic's degraded notice and no canvas element at all — carried over from 004's FR-001, restated so the rebuilt component keeps the guarantee (FR-013) (spec US3-S4)
- [ ] T023 [US3] Unit tests: `Stage.test.tsx` (header, metrics incl. NULL spend, empty→no canvas, rank count differs between the 2-node and 5-node fixtures), `NodeCard.test.tsx` (ladder states incl. frozen terminal with verbatim `terminal_reason`), `Wires` path count/class per fixture edges (FR-010..013) (spec US3-S1, S2, S4)
- [ ] T024 [US3] Rewrite `web/tests/smoke/showfloor.spec.ts` with FR-014's three laws, at 1280 and 1600, in both `colorScheme` emulations, over the whole fixture floor: (a) every descendant box of a stage inside the stage's box or inside a scrolling ancestor within it; (b) no text-carrying element past `documentElement.clientWidth` except inside an ancestor whose computed `overflow-x` is `auto`/`scroll`; (c) no two text-carrying leaf boxes overlapping by more than 4px in both axes. Header comment names the 004 assertions this suite replaces and why each is succeeded (FR-014) (spec US3-S5)
- [ ] T025 [US3] Run all four gates; the merge-group build is the gate that matters — this story's diff deletes seven modules and their tests, so `test:unit` and `test:smoke` must demonstrably still collect real tests (list collected counts in the PR body) (spec US3-S5)

**Checkpoint**: one epic on stage, wires told apart, and the three laws
enforced by the suite.

---

## Phase 4: User Story 4 - The detail pane: one story, told whole (Priority: P2)

**Goal**: the reading surface — steps, facts, requirement keys — plus
accessibility and the room-wide sweeps, against the finished room.

**Independent test**: drive selection headless on the fixture document;
assert pane content, keyboard path, and the sweeps.

- [ ] T026 [US4] Create `web/src/showfloor/DetailPane.tsx`: story id, serif title, intent line, the six named steps (mono name, dot, timestamp; done/active/waiting/pending states per `DESIGN.md` § Detail pane), facts grid (attempt `n of cap`, judge verdict with scenario count, PR, landing SHA, wall clock — absences as `—`), requirement-key chips; empty-selection state explains the room in two sentences (FR-015) (spec US4-S1, US4-S2)
- [ ] T027 [US4] Accessibility: node cards are `<button>`s focusable in rank order with `:focus-visible` outlines (`DESIGN.md` § Shapes); the pane is `aria-live="polite"`; the ladder pulse is suppressed under `prefers-reduced-motion` (FR-016) (spec US4-S2)
- [ ] T028 [US4] Unit tests: `DetailPane.test.tsx` over merged, building, waiting and ready fixture stories — step states and timestamps, `—` absences, FR chips, empty state (FR-015) (spec US4-S1)
- [ ] T029 [US4] Extend the smoke: keyboard walk rail→card→pane; reduced-motion emulation asserting no animation on the active bar; `aria-live` present (FR-016) (spec US4-S2)
- [ ] T030 [US4] Re-prove constitution I against the finished room: the full smoke run issues zero non-GET requests; a committed source sweep over `web/src/showfloor/` finds no `form`/`input` and no `button` outside `NodeCard`/rail rows; the badge is an `<a>` to `/` whose text is the count (FR-017) (spec US4-S3)
- [ ] T031 [US4] Run all four gates from a clean state; every backend test from 001–004 and the Desk's suites must pass unchanged — this spec must not have restyled the Desk beyond token names (plan § Risks) (spec US4-S3)

**Checkpoint**: the room reads, the keyboard works, and the constitution is
re-proven on the rebuilt floor.

---

## Dependencies

```
US1 ──merged──▶ US2 ──merged──▶ US3 ──merged──▶ US4
```

Serial on merge-edges: each story renders what the previous merged, and
US2–US4 share `web/src/showfloor/` and `global.css` — the contention class
that cost a rebuild on 2026-08-22.

## Out of scope for every phase

- Any Desk change beyond token-name compatibility (spec 006's job).
- A task-progress ladder stop (no seam — N46).
- Any write path or auth change.
