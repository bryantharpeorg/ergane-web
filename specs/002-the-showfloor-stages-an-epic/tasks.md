---

description: "Task list for the Showfloor stages an epic"
---

# Tasks: the Showfloor stages an epic

**Input**: Design documents from `/specs/002-the-showfloor-stages-an-epic/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), data-model.md, contracts/stage-document.md

**Tests**: Every scenario in spec.md ends "proven by a committed test" (constitution IV), so test tasks are not optional here: each story's phase carries the tests one of the four `ergane.yaml` gates runs headless, and a story whose tests are missing has not implemented its scenarios.

**Organization**: Tasks are grouped by user story so each story can be implemented and demonstrated on its own. Ergane dispatches **one agent per user story and nothing else** — a task in no story's phase is handed to no agent — so there is no Setup or Foundational phase: the dependency declarations, test doubles, and shared modules sit inside the phase of the story that needs them first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Include exact file paths in descriptions
- `(spec USn-Sk)` cites the acceptance scenario the task exists to satisfy; `(FR-nnn)` names the requirement the story's `## Work Graph` entry implements; `DESIGN.md §` names the section a rendering task is built to (constitution VIII)

## Path Conventions

Two package worlds per plan.md's Structure Decision and 001's landed layout:
backend under `pane/` with pytest under `tests/` (001 R-009: `pythonpath =
["."]`); frontend under `web/src/showfloor/` with vitest files under
`web/tests/unit/` (flat, PascalCase per component, as 001 names them), test
doubles under `web/tests/unit/support/`, and the Playwright spec under
`web/tests/smoke/`. Unit tests render with `react-dom/client` + `act` and
query the container directly; fixtures and sources are read through Vite's
`?raw` import, never `fs` (no `@types/node` on the roster). A test the gate
does not collect proves nothing — confirm each gate's output names the new
file.

---

## Phase 1: User Story 1 - The join: one stage document per running epic (Priority: P1) 🎯 MVP

**Goal**: For each running epic, one stage document joining the static `workgraph.json` with the live `epic_status` answer — every node once, every edge tagged, every failed or partial read named — attached to 001's `EpicEntry` and carried by every SSE `floor` snapshot; pure, and proven by pytest with no floor present.

**Independent Test**: `uv run pytest -q` assembles stage documents from the Fixture floor's recorded workgraphs and `epic_status` answers — complete, partial, refused, unreachable, skewed, dead file — and asserts the document's contents without any frontend.

### Implementation for User Story 1

- [ ] T001 [US1] Create `pane/stage.py` exporting `assemble_stage(epic_id, workgraph, live) -> dict` per contracts/stage-document.md §1: walk the file's `nodes` in declaration order; copy `id`, `story_key`, `persona` from the file (never from the live answer — its `persona` can be `""` or `<unresolved>`); look each id up in the answer's `nodes` mapping; copy `state`, `attempt`, `awaiting_operator`, `landing_state` as-is, `None` when the key is absent or the node is absent, with every absent field named in `unknown`; never coerce `attempt` to `0` or `awaiting_operator` to `False`; set `waiting_on_operator = (awaiting_operator is True)` and leave `state` the raw string (FR-001, FR-004, FR-006) (spec US1-S1, US1-S2, US1-S4, US1-S7)
- [ ] T002 [US1] In `pane/stage.py`, build `edges` in declaration order — per node, each `depends_on` entry as `{source: dep, target: node.id, kind: "pass"}` then each `depends_on_merged` entry as `kind: "merge"`; `source` is the predecessor — exactly the file's edges and no inferred ones (FR-001) (spec US1-S1)
- [ ] T003 [US1] In `pane/stage.py`, accept the three `epic_status` outcomes 001's reader returns — an answer mapping, `pane.readers.TransportFailed`, `pane.readers.QueryRefused` — and for the two failures keep every node static (all four live fields `None`, all four named in `unknown`), append exactly one note `{read: "epic_status", mode: "transport" | "refusal", detail: str(exc)}` (001's `DegradedEntry` words, so the Desk's well and the Showfloor's note agree), and set `degraded: True`; the two modes differ in `mode`, never only in `detail` (FR-005) (spec US1-S3)
- [ ] T004 [US1] In `pane/stage.py`, for every id in the answer's `nodes` mapping that the file does not declare, append `{read: "epic_status", mode: "undeclared", detail: "live answer names node id '<id>', which workgraph.json does not declare; not drawn"}` and draw nothing — `nodes` stays exactly the file's; an undeclared note alone leaves `degraded: False` (FR-003) (spec US1-S5)
- [ ] T005 [US1] In `pane/stage.py`, accept the workgraph read's failure — `TransportFailed` (the file is missing, or its envelope says pending) or `json.JSONDecodeError` (unparseable) — and return a named degraded entry: `nodes: []`, `edges: []`, one `{read: "workgraph", mode: "transport" | "unparseable", detail: str(exc)}` note, `degraded: True`, so the epic still appears in `epics` (FR-005) (spec US1-S6)
- [ ] T006 [US1] In `pane/floor_document.py` (001's `assemble_floor_document`), at the point where each running epic's `workgraph.json` document and `epic_status` outcome are already in hand for the `NodeCard` join, call `assemble_stage(epic_id, workgraph_or_failure, live_outcome)` and attach the result as the `stage` key of that `EpicEntry` — additive: 001's `nodes`, `epic_state`, seams, and `scene` keys untouched, the Desk untouched; catch `json.JSONDecodeError` from the workgraph read there and pass it through as the failure (001 R-002 lets it propagate; 002 names it); no new reader, no new route, no new poll; one epic's failure never touches another's entry (FR-002, FR-005) (spec US1-S1, US1-S6)

### Tests for User Story 1

- [ ] T007 [P] [US1] Write `tests/test_stage.py::test_complete_join` loading `fixtures/workgraphs/002-expense-notes.json` and the recorded answer `fixtures/epic-status/002-expense-notes/002-expense-notes-001-us1=ENQUEUED-ENQUEUED_us2=PENDING.json` from disk as recorded (never a hand-built dict): every declared node appears exactly once in file order with `state`, `attempt`, `awaiting_operator`, `landing_state` copied from the answer and `unknown == []` — `us2`'s recorded `attempt: 0` and `landing_state: null` are copied as recorded, because a value the factory wrote is not an unknown; the `us1 → us2` edge is tagged `merge`; then load `fixtures/workgraphs/077-a-scanner-the-operator-chooses-runs-in-the-loop.json` with a `TransportFailed` live outcome and assert its four edges carry `pass` ×3 and `merge` ×1 in declaration order with `source` the predecessor (spec US1-S1)
- [ ] T008 [P] [US1] Write `tests/test_stage.py::test_node_absent_from_live_answer`: load the recorded 002-expense-notes answer, delete its `us2` entry in the test, assemble, and assert `us2` is present with `id`, `story_key`, `persona`, and its edge intact, all four live fields `None`, `unknown` naming all four, `waiting_on_operator` false, and assembly did not raise (spec US1-S2)
- [ ] T009 [P] [US1] Write `tests/test_stage.py::test_two_failure_modes_two_notes`: assemble once with the `QueryRefused` 001's `FixtureReader` raises for `fixtures/raw-harness/epic-status/refusal.json` (a document carrying a `refusal` key and `nodes: {}`) and once with a `TransportFailed` raised the way 001's transport tests raise it; assert each document keeps the static graph (every node, every edge), carries exactly one `epic_status` note, the two notes' `mode` values are `"refusal"` and `"transport"` respectively, and `degraded` is true in both (spec US1-S3)
- [ ] T010 [P] [US1] Write `tests/test_stage.py::test_missing_keys_take_defaults`: load a recorded answer, delete `attempt`, `awaiting_operator`, and `landing_state` from one NodeStatus in the test, assemble, and assert those three fields are `None` and named in `unknown`, `attempt` is not `0`, `waiting_on_operator` is false, `state` is still the recorded string, and nothing raised (spec US1-S4)
- [ ] T011 [P] [US1] Write `tests/test_stage.py::test_live_only_id_is_noted_not_drawn` over the recorded skew pair `fixtures/README.md` names: the live answer `fixtures/epic-status/skew/status-names-us3.json` (nodes `us1`, `us2`, `us3`) paired with `fixtures/workgraphs/002-expense-notes.json` (declares `us1`, `us2` only; the pairing is the envelope's `pair_with`), both read from disk as recorded: assert `nodes` has exactly `["us1", "us2"]`, no node carries `us3`, exactly one `undeclared` note names `us3`, and `degraded` is false (spec US1-S5)
- [ ] T012 [P] [US1] Write `tests/test_stage.py::test_dead_workgraph_is_a_named_entry`: drive `assemble_floor_document` with a reader double implementing 001's `Reader` protocol whose `workgraph()` raises `TransportFailed` for epic A, raises the real `json.JSONDecodeError` that `json.loads("{not json")` produces for epic B, and returns the recorded 002-expense-notes document for epic C (fault shapes at the seam, not fixtures); assert A's and B's `stage` have `nodes == []`, one `workgraph` note with `mode` `"transport"` and `"unparseable"` respectively, `degraded` true, and C's `stage` equals `assemble_stage` called on C's inputs alone (spec US1-S6)
- [ ] T013 [P] [US1] Write `tests/test_stage.py::test_derived_flag_wins` over `fixtures/raw-harness/epic-status/fx-paged-5e2e8a-paged.json` read from disk as recorded: its node `us1`, carrying `awaiting_operator: true` and `state: "VERIFYING"`, stages with `waiting_on_operator` true and `state` still `"VERIFYING"` (spec US1-S7)
- [ ] T014 [US1] Write `tests/test_stage.py::test_floor_document_carries_stage_and_stays_pure`: with `PANE_DEMO=1`, fetch `/api/floor` through 001's test client and assert every `epics` entry carries a `stage` whose node ids equal the ids of that entry's `NodeCard`s marked `declared: true`, in the same order, with every edge tagged, and that every `EpicEntry` key 001's contract names is still present; then assert by reading `pane/stage.py`'s source that it imports neither `subprocess`, `temporalio`, `pathlib`, nor `pane.readers`'s live reader and calls no `open` — the join is pure and the floor document is the only thing that crosses to the browser (FR-002) (spec US1-S1)

**Checkpoint**: The floor document — and every SSE `floor` snapshot — carries one honest stage per running epic; the Desk is unchanged; `uv run pytest -q` proves every fault shape with no factory present.

---

## Phase 2: User Story 2 - The stage: the DAG drawn as the contract reads (Priority: P1)

**Goal**: The Showfloor room at `/showfloor`: each running epic's stage laid out left to right with dagre, every node a state-lit station carrying machine-readable markers, pass-edges dashed and merge-edges solid by class, a verbatim legend, a named quiet floor — rendered against the Fixture floor in the headless smoke, which is also the demo mode.

**Independent Test**: `npm --prefix web run test:unit` asserts positions, order, card markers, edge classes, legend text, and the quiet floor from stage documents built over the recorded workgraphs; `npm --prefix web run test:smoke` stages the demo floor in headless chromium and asserts SC-001.

### Implementation for User Story 2

- [ ] T015 [US2] Add `@xyflow/react` and `@dagrejs/dagre` to `web/package.json` `dependencies` and regenerate `web/package-lock.json` with `npm install --prefix web`; both are constitution VII roster entries and `@dagrejs/dagre` ships its own types — add no `@types/*`, no router, no `framer-motion`; confirm 001's roster sweep in `tests/test_scaffold.py` still passes (FR-018) (spec US2-S1)
- [ ] T016 [P] [US2] Create `web/src/showfloor/types.ts` — `StageDocument`, `StagedNode`, `StagedEdge` (`kind: "pass" | "merge"`), `StageNote` — as the TypeScript mirror of contracts/stage-document.md §1 with every live field typed nullable, and add `stage?: StageDocument` to `EpicEntry` in 001's `web/src/api/floorDocument.ts` (spec US2-S3)
- [ ] T017 [P] [US2] Create `web/src/showfloor/states.ts` — `NODE_STATES` (the eleven), `LIVE_STATES`, `LANDING_STAGES`, `STATE_STYLES` with a `light` entry per state naming the glyph, fill, stroke, ink token, and caption from DESIGN.md's table (token names as 001's `web/src/styles/tokens.css` spells them), `UNKNOWN_STYLE` (the word "unknown" in soft italic per DESIGN.md's Unknown Rule, no hue), and `resolveStateStyle(state, theme)` returning `{style, known}` — `known: false` and `UNKNOWN_STYLE` only for `null` or a string outside the eleven (FR-010); DESIGN.md § State Chevrons and Stations, § Colors (Ink-Pair Rule, Never-Colour-Alone Rule, No-Red Rule) (spec US2-S3, US2-S6)
- [ ] T018 [US2] Create `web/src/showfloor/layout.ts` exporting `layoutStage(stage: StageDocument): LaidOutStage` — a dagre graph with `rankdir: "LR"`, one node per staged node, one edge per staged edge (`source → target`), then a deterministic tie-break: group positioned nodes by their `x`, and within each group reassign the group's sorted `y` values to the nodes in declaration order; station spacing 160px along a row and 140px between rows; returns positions plus the flow `nodes`/`edges` arrays with `type: "station"` / `type: "route"` and `className: "edge-pass" | "edge-merge"` (FR-007); DESIGN.md § Layout (Showfloor: same-rank pair stacks in one column joined by a vertical rail) (spec US2-S1, US2-S2)
- [ ] T019 [P] [US2] Create `web/tests/unit/support/stage-builder.ts` — `stageFromWorkgraph(workgraphJson, live?: Record<nodeId, Partial<live fields>>)` building a `StageDocument` from a recorded `fixtures/workgraphs/*.json` imported with Vite's `?raw` and `JSON.parse`d (every live field `null` and in `unknown` unless the test states it); typed against `types.ts`, used by tests only (spec US2-S1)
- [ ] T020 [P] [US2] Create `web/tests/unit/support/xyflow-double.tsx`, used by each flow-mounting test through `vi.mock("@xyflow/react", () => import("./support/xyflow-double"))` at the top of the file (001's `vite.config.ts` is not edited): exports `ReactFlow` rendering each node through `nodeTypes[node.type]` inside `<div data-rf-node>` and each edge through `edgeTypes[edge.type]` inside `<svg><g className={edge.className} data-rf-edge>` with no measurement, plus `ReactFlowProvider`, `Handle`, `Position`, `BaseEdge`, `getSmoothStepPath` shims; records every prop `ReactFlow` was mounted with on an exported `mountedProps` array (spec US2-S3)
- [ ] T021 [US2] Create `web/src/showfloor/StationNode.tsx` — the card rendered through the flow's `nodeTypes` (`station`): root `[data-station][data-node-id]` with `data-state` (the raw string, or `"unknown"` when null), `data-state-style` (the resolved key or `"unknown"`), one `[data-attempt-pip]` per counted attempt and none when `attempt` is null, `[data-persona]` from the static persona, `data-waiting="true"` iff `waiting_on_operator`; an unrecognized state takes `UNKNOWN_STYLE` and displays the raw string, never throws (FR-008, FR-010); DESIGN.md § State Chevrons and Stations (40px station under `skewX(-12deg)`, 2px stroke, story id in mono above, uppercase 11px caption below in the state's ink, paged-while-verifying = VERIFYING glyph + dashed clay ring + the word "paged", supplementary micro line "attempt n"), § Typography (The Factory Speaks in Mono Rule, The Caption Case Rule) (spec US2-S3, US2-S6)
- [ ] T022 [P] [US2] Create `web/src/showfloor/RouteEdge.tsx` — the edge rendered through `edgeTypes` (`route`): a smooth-step path whose `<g>` carries `className="edge-pass"` or `"edge-merge"` and `data-edge-kind` from `edge.data.kind` (FR-009); DESIGN.md § Route Map and Landing Line (`depends_on_merged` = solid double rail: 4px graphite stroke — olive once the upstream story is merged — with a 1.5px sage stroke over it; `depends_on` = single 1.5px tinted-slate stroke, `stroke-dasharray: 4 5`) (spec US2-S4)
- [ ] T023 [P] [US2] Create `web/src/showfloor/Legend.tsx` — `[data-legend]` with `[data-legend-kind="pass"]` showing the dashed sample, the word **pass-edge**, and the verbatim string from contracts/stage-document.md §3, and `[data-legend-kind="merge"]` likewise with the solid sample and **merge-edge**; DESIGN.md's short labels ("unlocks on verification" / "unlocks on merge") may accompany, the definitions are the normative text (FR-009); DESIGN.md § Route Map and Landing Line (a legend naming both is drawn once per map in 10px micro) (spec US2-S5)
- [ ] T024 [US2] Create `web/src/showfloor/EpicStage.tsx` — `[data-epic-stage][data-epic-id]` holding: the epic name (Display) and a meta line; the `ReactFlow` viewport over `layoutStage(stage)` with `nodeTypes={{station: StationNode}}`, `edgeTypes={{route: RouteEdge}}`, `fitView`, pan and zoom gestures on, and **no** `Controls`, `MiniMap`, or other chrome mounted; one `[data-stage-note][data-read][data-mode]` per stage note, in words, as a DESIGN.md well; and the `Legend` once per map (FR-008, FR-009); DESIGN.md § Elevation & Depth (The Well Rule: moss-grey well, 3px radius, bold Display lead-in, no icon, no hue), § Route Map and Landing Line (a refused query is a route with no stations and an italic quiet line saying so), § Layout (route grid `220px 1fr`, map min-width 1040px in a horizontally scrolling wrapper) (spec US2-S1, US2-S4)
- [ ] T025 [US2] Create `web/src/showfloor/Showfloor.tsx` — the route: fetch `/api/floor` and subscribe to `/api/events` through 001's `web/src/api/events.ts` consumer exactly as `web/src/desk/Desk.tsx` does (one room is mounted at a time, so never a second `EventSource` or a second consumer); render `Masthead` with its `trailing` slot empty for now; when the document lists zero running epics render `[data-quiet-floor]` saying in words that the floor is quiet and mount no `[data-epic-stage]`; otherwise one `EpicStage` per `epics` entry in document order (FR-019); DESIGN.md § Navigation (Masthead: the mark, Desk / Showfloor nav, floor line; sticky at the top on the Showfloor), § Epic Timeline Row (Quiet floor: a hairline-bounded italic line in tinted slate says so; never a blank) (spec US2-S7)
- [ ] T026 [US2] Create `web/src/showfloor/showfloor.css` — built on 001's `web/src/styles/tokens.css` custom properties (sage ground, mist panel, moss-grey well, graphite, tinted slate, hairline, deep moss, teal/mustard/olive/clay/aqua and their inks; the comp's `--orange` names for clay kept) and the faces 001's `index.html` already links from `web/public/fonts/fonts.css` (no `@import`, no remote stylesheet): the eleven glyph classes (dashed aqua-ink outline, 45° aqua-ink hatch, solid teal, solid mustard, olive outline, half olive, 78% olive, solid olive, graphite X on mist, moss-grey with tinted-slate stroke, solid clay), the two edge strokes, the well, and the stage layout; DESIGN.md § Colors, § Typography (Fonts policy), § Layout (Showfloor: stage padding `1.5rem 2rem 3rem`, 2rem gap between routes, stations 40px), § Shapes (3px corners, skewed squares, 2px tracks), § Do's and Don'ts (no cream, no red, no shadow on anything unpressable) (spec US2-S3)
- [ ] T027 [US2] In 001's `web/src/App.tsx` room switch on `window.location.pathname`, add the `/showfloor` case rendering `<Showfloor/>` (001 R-010 reserved it) and make the masthead's Showfloor nav entry point at it; if 001's masthead is inline in `App.tsx`, extract it unchanged into `web/src/Masthead.tsx` with an optional `trailing?: ReactNode` prop and make the Desk render it exactly as before; put `DESK_PATH = "/desk"` and `SHOWFLOOR_PATH = "/showfloor"` in `web/src/routes.ts` if 001 exported no path constants, and make `App.tsx` use them (spec US2-S7)

### Tests for User Story 2

- [ ] T028 [P] [US2] Write `web/tests/unit/layoutStage.test.ts` over `stageFromWorkgraph(077)`: for every staged edge the source's `x` is strictly less than the target's `x`; `us1` and `us2` (both rank 0 — neither has a dependency) share an `x` and `us1.y < us2.y` because `us1` is declared first; and the layout is deterministic across two calls (spec US2-S1, US2-S2)
- [ ] T029 [P] [US2] Write `web/tests/unit/StationNode.test.tsx` rendering the card directly with `react-dom/client` + `act` and node data: `state: "ENQUEUED", attempt: 1` → `data-state="ENQUEUED"`, exactly one `[data-attempt-pip]`, `[data-persona]` reading `implementer`; `attempt: 3` → three pips; all live fields null → `data-state="unknown"`, zero pips, persona still shown; `state: "HIBERNATING"` → `data-state="HIBERNATING"`, `data-state-style="unknown"`, the raw text visible, no throw; `waiting_on_operator: true` with `state: "VERIFYING"` → `data-waiting="true"` and `data-state` still `VERIFYING` (spec US2-S3, US2-S6)
- [ ] T030 [P] [US2] Write `web/tests/unit/EpicStage.test.tsx` (through `support/xyflow-double`) over `stageFromWorkgraph(077)`: the container holds one `[data-station]` per declared node, three `.edge-pass[data-edge-kind="pass"]` and one `.edge-merge[data-edge-kind="merge"]`, and the two kinds are distinguishable by class alone; also render a stage with `notes: [{read: "epic_status", mode: "refusal", …}]` and `nodes: []` and assert `[data-stage-note][data-mode="refusal"]` with the read named in its text and no `[data-station]` drawn (spec US2-S4)
- [ ] T031 [P] [US2] Write `web/tests/unit/Legend.test.tsx`: `[data-legend-kind="pass"]` text contains `pass-edge` and the exact string `An ordering-only dependency: the predecessor must reach a verdict, and nothing about its code is guaranteed to be present`; `[data-legend-kind="merge"]` contains `merge-edge` and `A content dependency: the predecessor's work must be merged before the dependent's worktree is created, so the dependent's base contains that code` (spec US2-S5)
- [ ] T032 [P] [US2] Write `web/tests/unit/Showfloor.test.tsx` (through `support/xyflow-double`, with `fetch` stubbed to return the document under test and `EventSource` stubbed inert): a floor document with `epics: []` renders `[data-quiet-floor]` whose text contains "quiet" and no `[data-epic-stage]`; a floor document with two epics renders two `[data-epic-stage]` and no `[data-quiet-floor]` — the two renderings differ (spec US2-S7)
- [ ] T033 [US2] Write `web/tests/smoke/showfloor.spec.ts` (against the `PANE_DEMO=1` backend 001's `playwright.config.ts` starts on 8787): open `/showfloor`; fetch `/api/floor` in the test and, for every `epics` entry, assert each `stage.nodes[i].id` has exactly one `[data-epic-stage][data-epic-id] [data-station][data-node-id]` carrying a non-empty `data-state`, and that at least one entry staged; assert at least one `.edge-pass` and one `.edge-merge` are present across the staged epics and differ in `data-edge-kind`; assert the legend strings of T031 are present (FR-018; SC-001). If the landed scene table in `pane/fixture_floor.py` stages no workgraph carrying both edge kinds, add one scene row binding `fixtures/workgraphs/077-a-scanner-the-operator-chooses-runs-in-the-loop.json` — to its recorded `epic_status` document if one exists, else with its status read reported as the loader's missing-document `TransportFailed` — editing code only, never a payload (plan.md § Risks and traps) (spec US2-S1, US2-S4, US2-S5)

**Checkpoint**: The Showfloor stages the Fixture floor headless with no factory behind it — the demo mode D-008 requires — and every card, edge, legend, and quiet-floor claim is asserted by selector.

---

## Phase 3: User Story 3 - The flow: landings move, transitions pulse, idle dims (Priority: P2)

**Goal**: Motion as marker lifecycles — landing progress on the shared landing line into a landed shelf, a transition marker applied and cleared on observed change and never on first paint, an idle marker per epic — with reduced motion as the control, every state styled in both themes with no catch-all, and the room full-bleed by measurement.

**Independent Test**: `npm --prefix web run test:unit` drives one staged node through successive stage documents with fake timers and asserts the markers each document applies, clears, and suppresses; `npm --prefix web run test:smoke` measures the root's bounding box against the viewport.

### Implementation for User Story 3

- [ ] T034 [US3] Create `web/src/showfloor/LandingLine.tsx` — `[data-landing-line]` with four `[data-landing-station]` children bottom to top (PASSED, PR_OPEN, ENQUEUED, MERGED), one token per node in a landing state placed at its stage and labelled with the story id in micro, and the MERGED end as `[data-landed-shelf]` holding one `[data-shelf-card][data-node-id][data-state="MERGED"]` (the `StationNode` card in shelf mode) per MERGED node plus the count ("MERGED ×n"); mount it at the right edge of `EpicStage` (FR-011); DESIGN.md § Route Map and Landing Line (one olive 3px vertical line with a 1px sage centre stroke labelled "landing line", 16px stations 64px apart, 7px-radius token — teal, olive `.queue` once ENQUEUED — with a 3px mist stroke; a story short of the line drawn at the end of its route with a hairline connector) (spec US3-S1)
- [ ] T035 [US3] In `web/src/showfloor/StationNode.tsx`, set `data-landing-stage` to the state string when it is one of `LANDING_STAGES` (PASSED, PR_OPEN, ENQUEUED, MERGED) and omit it otherwise (FR-011); DESIGN.md § State Chevrons and Stations (PASSED empty olive outline, PR_OPEN half, ENQUEUED 78%, MERGED solid olive) (spec US3-S1)
- [ ] T036 [US3] Create `web/src/showfloor/transitions.ts` exporting `TRANSITION_MS` and `useTransitionMarkers(stage, reducedMotion): Set<nodeId>` — keeps the previous document's `nodeId → state` in a ref; on the first document it seeds that map and marks nothing; on a later document every node whose state differs from the remembered one is added to the marked set and a `setTimeout(TRANSITION_MS)` removes it; under `reducedMotion` the marked set is never populated; timers are cleared on unmount (FR-012, FR-013) (spec US3-S2, US3-S3, US3-S4)
- [ ] T037 [P] [US3] Create `web/src/showfloor/motion.ts` exporting `useReducedMotion(): boolean` over `window.matchMedia("(prefers-reduced-motion: reduce)")`, subscribed to `change`, defaulting to `false` where `matchMedia` is absent (FR-013); DESIGN.md § Motion (The Reduced-Motion Rule) (spec US3-S4)
- [ ] T038 [US3] In `web/src/showfloor/EpicStage.tsx`, call `useReducedMotion()` and `useTransitionMarkers(stage, reducedMotion)` and pass `transition: marked.has(node.id)` into each station's data so `StationNode` renders `data-transition="true"` while marked and no attribute otherwise (FR-012) (spec US3-S2)
- [ ] T039 [US3] In `web/src/showfloor/EpicStage.tsx`, compute `idle = !stage.nodes.some(n => n.state !== null && LIVE_STATES.has(n.state))` and render `data-idle="true" | "false"` on `[data-epic-stage]`; in `web/src/showfloor/showfloor.css` an idle stage renders at opacity 0.55 (the rest value DESIGN.md's RUNNING glow names; no new colour) and nothing else changes — the marker carries the state (FR-014); D-004 (idle epics dim) (spec US3-S5)
- [ ] T040 [US3] In `web/src/showfloor/states.ts`, complete the theme axis: `STATE_STYLES: Record<NodeState, Record<Theme, StateStyle>>` with `Theme = "light" | "dark"`, every one of the eleven present under both, the `dark` entries naming the same DESIGN.md tokens as `light` (the pane has one palette; plan.md Decision 4) and `resolveStateStyle(state, theme)` indexing the map directly with no default branch for a known state (FR-015); DESIGN.md § Colors (spec US3-S6)
- [ ] T041 [US3] In `web/src/showfloor/showfloor.css`, author the three motions — RUNNING station glow (opacity `1 → 0.55 → 1`, 2.4s, infinite), landing-line token travel (`translateY(-90px)` up one station, 6s, infinite, holding at each end), and the masthead live-dot breathe if 001's `global.css` does not already gate it — inside `@media (prefers-reduced-motion: no-preference)` with the one easing `cubic-bezier(0.16, 1, 0.3, 1)`, plus the `[data-transition="true"]` pulse under the same gate; give `[data-showfloor-root]` `position: fixed; inset: 0; overflow: auto` on the sage ground so the route fills the viewport edge to edge with the masthead sticky inside it (FR-013, FR-015); DESIGN.md § Motion, § Layout (Showfloor) (spec US3-S4, US3-S7)

### Tests for User Story 3

- [ ] T042 [P] [US3] Write `web/tests/unit/transitions.test.tsx` (through `support/xyflow-double`, `vi.useFakeTimers`) `::landing run`: render `EpicStage` with a 077-based stage where `us2` is `PASSED`, then rerender with `PR_OPEN`, `ENQUEUED`, `MERGED`; after each document assert `[data-station][data-node-id="us2"]` carries `data-landing-stage` equal to that state, and after `MERGED` assert `[data-landed-shelf] [data-node-id="us2"]` exists and the shelf count reads one (spec US3-S1)
- [ ] T043 [P] [US3] Write `transitions.test.tsx::transition lifecycle`: first document `us4: RUNNING`, second `us4: VERIFYING` → `[data-node-id="us4"][data-transition="true"]` present immediately after the rerender; advance fake timers by `TRANSITION_MS` → the attribute is gone; a third identical document applies no marker (spec US3-S2)
- [ ] T044 [P] [US3] Write `transitions.test.tsx::first paint control`: the very first document rendered carries `us1: MERGED`; assert `[data-landed-shelf] [data-node-id="us1"]` exists and no element in the stage carries `data-transition` (spec US3-S3)
- [ ] T045 [P] [US3] Write `transitions.test.tsx::reduced motion control`: stub `window.matchMedia` to report `prefers-reduced-motion: reduce`, run the T042 and T043 sequences again, and assert no `[data-transition]` ever appears while `data-state`, `data-landing-stage`, `data-waiting`, and `data-edge-kind` still distinguish every state, landing stage, and edge kind at each step; also import `web/src/showfloor/showfloor.css?raw` and assert every `animation:` declaration sits inside a `prefers-reduced-motion: no-preference` block (spec US3-S4)
- [ ] T046 [P] [US3] Write `web/tests/unit/EpicStage.test.tsx::idle marker`: a stage whose nodes are `MERGED`, `FAILED`, `PENDING`, and `null` → `data-idle="true"`; the same stage with one node `RUNNING` → `data-idle="false"`; one node `WAITING_OPERATOR` → `"false"`; one node `KEY_ISSUED` → `"false"` (spec US3-S5)
- [ ] T047 [P] [US3] Write `web/tests/unit/states.test.ts`: `Object.keys(STATE_STYLES)` is exactly the eleven; for each state and each of `light`, `dark`, `resolveStateStyle(state, theme)` returns `known: true` and a style that is not `UNKNOWN_STYLE` and names a fill, stroke, ink, glyph, and caption; `resolveStateStyle("HIBERNATING", "light")` and `(null, "dark")` return `known: false` with `UNKNOWN_STYLE` (spec US3-S6)
- [ ] T048 [US3] In `web/tests/smoke/showfloor.spec.ts`, add `full-bleed is measured`: after `/showfloor` renders, read `page.viewportSize()` and `[data-showfloor-root]`'s `boundingBox()` and assert `x === 0`, `y === 0`, `width === viewport.width`, `height === viewport.height` (FR-015) (spec US3-S7)

**Checkpoint**: Every motion claim is a marker lifecycle a fake-timer test asserts, reduced motion proves nothing lives only in movement, the style map is total, and full-bleed is a number.

---

## Phase 4: User Story 4 - The badge: attention is counted here, answered there (Priority: P2)

**Goal**: One badge when Attention items exist — a count and a link to the Desk, nothing else — a degraded note in its place when the attention read failed, a count that moves with `floor` events, and a sweep proving the finished room carries no button, form, input, select, textarea, dragging, or selection.

**Independent Test**: `npm --prefix web run test:unit` renders the Showfloor against the Fixture floor's recorded Attention items, an empty attention list, and both degraded attention reads and asserts the badge's presence, count, target, and absence; `npm --prefix web run test:smoke` sweeps the rendered route's DOM; `uv run pytest -q` pins the degraded-entry shape the badge consumes.

### Implementation for User Story 4

- [ ] T049 [US4] Create `web/src/showfloor/AttentionBadge.tsx` taking the floor document's `attention` section and its `degraded` entries for `section: "attention"`: when a degraded entry exists, render `[data-attention-degraded][data-mode="transport" | "refusal"]` whose text names what could not be learned (the attention items) and the mode in words, and render no count; when `attention.items.length` is 0 render nothing; otherwise render exactly one `<a data-attention-badge href={DESK_PATH}>` whose text is the count (mono) followed by "waiting on you → Desk", with `DESK_PATH` imported from `web/src/routes.ts`, never retyped (FR-017); DESIGN.md § Navigation (the attention badge at the far right in clay-ink with a clay bell dot; it is a link, the Showfloor's only one), § Colors (The Attention Ranking Rule — clay for waiting-on-you; never red) (spec US4-S1, US4-S2, US4-S3)
- [ ] T050 [US4] In `web/src/showfloor/Showfloor.tsx`, render `<AttentionBadge/>` in `Masthead`'s `trailing` slot from the *current* floor document the room holds, so every `floor` event 001's consumer applies re-renders the count with no navigation and no reload; the Showfloor still opens no second `EventSource` (FR-017) (spec US4-S4)
- [ ] T051 [US4] In `web/src/showfloor/EpicStage.tsx`, mount `ReactFlow` with `nodesDraggable={false}`, `nodesConnectable={false}`, `elementsSelectable={false}`, `nodesFocusable={false}`, `edgesFocusable={false}`, keep pan (`panOnDrag`) and zoom (`zoomOnScroll`, `zoomOnPinch`) on, and hide the library's attribution link through `proOptions={{ hideAttribution: true }}` so the badge stays the room's one link — pure glass, asserted by T056 and T057 (FR-016); DESIGN.md § Route Map and Landing Line (No controls), § Components (Buttons: Desk only; the Showfloor has none) (spec US4-S5)

### Tests for User Story 4

- [ ] T052 [P] [US4] Write `web/tests/unit/AttentionBadge.test.tsx::count and target` (through `support/xyflow-double`, `fetch` stubbed, `EventSource` inert): render `Showfloor` against a floor document whose `attention.items` are the Fixture floor's recorded open items in 001's `AttentionItem` shape (built in the test from `fixtures/raw-harness/escalations/open_escalations.json` and `fixtures/raw-harness/webhook/question.json` via `?raw` imports — the README's committed paths — so N is the recording's open-item count, N > 0) and assert exactly one `[data-attention-badge]` whose text begins with `N` and whose `href` equals `/desk`; then the same document with `attention.items` replaced by `[]` at the document level (the recording itself is never emptied) and assert no `[data-attention-badge]` and no `[data-attention-degraded]` (spec US4-S1, US4-S2)
- [ ] T053 [P] [US4] Write `tests/test_showfloor_attention.py`: drive `assemble_floor_document` with a reader double whose `open_escalations()` raises `TransportFailed("attention")` in one run and `QueryRefused` in the other (the two fault shapes 001's `tests/test_degraded.py` injects at the seam) and assert the document's `degraded` list carries an entry with `section == "attention"` whose `mode` is `"transport"` in one and `"refusal"` in the other, that `attention.items == []` on a degraded section, and that the two entries differ by mode — this pins the shape `AttentionBadge` consumes to what the backend emits (spec US4-S3)
- [ ] T054 [P] [US4] Write `AttentionBadge.test.tsx::degraded reads`: feed floor documents carrying the two degraded entries T053 pins and assert `[data-attention-degraded][data-mode="transport"]` and `[data-mode="refusal"]` respectively, each naming attention in its text, no `[data-attention-badge]`, and no element in the masthead whose text is exactly `0` (spec US4-S3)
- [ ] T055 [US4] Create `web/tests/unit/support/event-source-double.ts` (installs a `window.EventSource` replacement exposing `emit(type, data)` that dispatches a `MessageEvent` carrying 001's `{type, data}` envelope, as `web/src/api/events.ts` consumes it) and write `web/tests/unit/Showfloor.test.tsx::badge follows floor events`: render `Showfloor`, emit a `floor` event whose `attention.items` carries N items, assert the badge reads `N`, emit another whose list carries N + 1, assert `N + 1`, and assert `window.location.pathname` did not change and no reload was requested; emit an event of an unknown type and assert nothing changed (spec US4-S4)
- [ ] T056 [US4] In `web/tests/smoke/showfloor.spec.ts`, add `pure glass sweep`: after `/showfloor` renders against the demo floor with at least one `[data-epic-stage]` present, assert `page.locator("button, form, input, select, textarea")` has count 0, and that every `[data-attention-badge]` is an `a` element (FR-016; SC-006) (spec US4-S5)
- [ ] T057 [US4] Write `web/tests/unit/EpicStage.test.tsx::flow mounts non-interactive`: render `EpicStage` through `support/xyflow-double` and assert the recorded `mountedProps` carry `nodesDraggable === false`, `elementsSelectable === false`, `nodesConnectable === false`, and `nodesFocusable === false` — the D-006 stack enables dragging and selection by default over plain `div`s the element sweep cannot see (spec US4-S5)

**Checkpoint**: All four stories independently functional. An escalation arriving mid-demo shows as one link to the Desk; nothing on the Showfloor can be pressed; the finished room passes the sweep.

---

## Operator verification

After every story has landed, the operator's own closing pass — not work for an
agent, so it carries no task id: run the four gate commands from
`ergane.yaml` in a fresh checkout, start the pane with `PANE_DEMO=1`, open
`/showfloor` beside `/desk`, and walk every acceptance scenario in spec.md
against what the gates already proved. If the landed scene table stages no
workgraph carrying both edge kinds and no `epic_status` recording for 077
exists, decide between the transport-fact fallback T033 names and a
re-recording per `fixtures/README.md` before flipping this spec ready.

---

## Dependencies & Execution Order

### Phase Dependencies

- **US1 (Phase 1)**: Depends on nothing inside this spec. Its base is 001 landed
  (`depends_on_landed` in the spec's frontmatter): the scaffold, the gates,
  the Fixture floor and its loader, `assemble_floor_document`, the SSE
  stream, the Desk at `/desk`.
- **US2 (Phase 2)**: Waits on US1 having **merged**, not merely verified — it
  renders the `stage` key US1 attaches, and a verification-gated edge would
  hand it a base with no stage in the document.
- **US3 (Phase 3)**: Waits on US2's merge. It edits `EpicStage.tsx`,
  `StationNode.tsx`, `states.ts`, `showfloor.css`, `EpicStage.test.tsx`, and
  the smoke spec US2 creates.
- **US4 (Phase 4)**: Waits on US3's merge. It edits `Showfloor.tsx`,
  `EpicStage.tsx`, `Showfloor.test.tsx`, `EpicStage.test.tsx`, and the smoke
  spec, and its sweep must run against the finished room with every piece of
  chrome already mounted.

This is the same shape as the `## Work Graph` block in `spec.md`, which is the
copy Ergane actually compiles. Change one and change the other.

### User Story Dependencies

- **US1 (P1)**: Standalone over 001's seams; backend only.
- **US2 (P1)**: Needs US1's stage document; creates the room every later story edits.
- **US3 (P2)**: Extends US2's station, stage, style map, stylesheet, and smoke.
- **US4 (P2)**: Extends US2's Showfloor and stage; asserts over the whole room.

### Within Each User Story

- The pure module before the component that renders it (`stage.py` before the
  assembler wiring; `layout.ts`/`states.ts`/`types.ts` before the components)
- Test doubles before the tests that need them (`xyflow-double` before any
  component test; `event-source-double` before the stream test)
- Component before the route that mounts it; route before the smoke
- Story complete before moving to the next priority

### Parallel Opportunities

- US1: T007–T013 are independent test functions and can be written together once T001–T005 exist; T006 and T014 follow
- US2: T016, T017, T019, T020 touch different files and can run together; T022 and T023 can run alongside T021; T028–T032 are independent test files
- US3: T037 alongside T036; T042–T047 are independent test cases once T034–T041 exist
- US4: T052, T053, T054 are independent once T049 exists; T055 and T057 after T050 and T051

---

## Parallel Example: the pure modules inside User Story 2

```bash
# Before any component is written, launch the four leaf modules together:
Task: "Create web/src/showfloor/types.ts mirroring contracts/stage-document.md §1 and add stage? to EpicEntry"
Task: "Create web/src/showfloor/states.ts with NODE_STATES, STATE_STYLES, UNKNOWN_STYLE, resolveStateStyle"
Task: "Create web/tests/unit/support/stage-builder.ts building StageDocuments from recorded workgraphs"
Task: "Create web/tests/unit/support/xyflow-double.tsx for vi.mock of @xyflow/react"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 — `pane/stage.py`, the wiring, the seven fault-shape tests
2. **STOP and VALIDATE**: `uv run pytest -q` green; `/api/floor` in demo mode carries a `stage` per epic and the Desk's tests still pass
3. Nothing is on screen yet, and that is the point: the join is the spine, and a Showfloor over a lying join is a liability on a projector

### Incremental Delivery

1. US1 → the stage document in every `floor` snapshot → pytest proves every fault shape
2. US2 → the room renders the Fixture floor headless → the demo mode exists
3. US3 → landings move, transitions pulse, idle dims, reduced motion proves the control → the spectacle
4. US4 → the badge and the sweep → projector-safe, asserted

US1 + US2 is the defensible cut line: a stageable, honest floor. US3 and US4
are each a self-contained pass over the room US2 created.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] labels map tasks to user stories for traceability, and to a dispatched agent: a task tagged for no story is work no agent is given
- `(spec USn-Sk)` cites the acceptance scenario a task exists to satisfy. A task may only cite a scenario of the story whose phase it sits in — a citation across stories reads as work filed under the wrong agent
- Every task that renders cites the DESIGN.md section it is built to; where DESIGN.md names a value (a stroke width, a radius, a token), that value is the implementation, not a suggestion (constitution VIII)
- The tasks most likely to be silently wrong are **T001** (coercing an absent `attempt` to `0` or an absent `awaiting_operator` to `false` — T008 and T010 exist to catch it), **T036** (diffing the first document against an empty map and pulsing every node on first paint — T044 is the control), and **T033**/**T056** (a smoke that passes because nothing rendered — both assert at least one staged epic first)
- A test the gate does not collect proves nothing: after adding a test file, confirm the gate's output names it
- Commit after each task or logical group; never commit a payload under `fixtures/` (constitution V)
