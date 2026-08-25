# Implementation Plan: the Showfloor stages an epic

**Branch**: `002-the-showfloor-stages-an-epic` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-the-showfloor-stages-an-epic/spec.md`

## Summary

The Showfloor is the spectacle room D-002 decided and D-004 shaped: every
running epic's `workgraph.json` joined with its live `epic_status` answer and
staged left to right as a state-lit DAG — nodes as stations, pass-edges dashed,
merge-edges solid, the landing run moving up one shared landing line into a
landed shelf — on a full-bleed, projector-safe page whose only interactive
things are pan, zoom, and one badge that leads to the Desk.

Four stories, one merge-edged chain. **US1** is backend-only: a pure
`assemble_stage` join in `pane/stage.py`, called from 001's
`assemble_floor_document` where both inputs are already in hand, attached as
`stage` to each `EpicEntry` of the floor document, tolerant of every 052 fault
shape and proven by pytest with no floor present. **US2** creates the
Showfloor room under `web/src/showfloor/` — `@xyflow/react` for the viewport,
`@dagrejs/dagre` for the left-to-right layout, custom station and edge
components carrying machine-readable markers, the verbatim legend, the quiet
floor — mounted at `/showfloor` (001 R-010), with the Playwright smoke that
stages the Fixture floor headless. **US3** adds motion as marker lifecycles
(landing progress, transition apply-and-clear, idle), the reduced-motion
control, the eleven-state style map in both themes, and the measured
full-bleed. **US4** adds the attention badge and the no-verb sweep, run last
against the finished room.

Every runtime claim is a committed test one of the four `ergane.yaml` gates runs
headless (constitution IV). Appearance is DESIGN.md's (constitution VIII);
every task that renders cites the DESIGN.md section it implements. No new
dependency beyond the roster: `@xyflow/react` and `@dagrejs/dagre` are
constitution VII approvals that 001 did not need and this spec declares;
`framer-motion` is approved but unnecessary — the three authored motions are
CSS inside `@media (prefers-reduced-motion: no-preference)`.

## Technical Context

**Language/Version**: Python 3.12 under `uv` (001's `pyproject.toml`,
`[tool.uv] package = false`, `[tool.pytest.ini_options] pythonpath = ["."]`);
TypeScript `strict: true` (001's `web/tsconfig.json`, which includes `src`,
`tests/unit`, `tests/smoke`); Node as 001's `web/package.json` states.

**Primary Dependencies**: Backend — `fastapi`, `uvicorn`, `sse-starlette`,
`ergane-cli==0.2.0` (all 001's; this spec adds none). Frontend — `react`,
`react-dom`, `vite`, `@vitejs/plugin-react` (001's) plus `@xyflow/react` and
`@dagrejs/dagre` (roster entries, first declared by this spec's US2;
`@dagrejs/dagre` ships its own types, so no `@types/*` package is needed).
Test — `pytest`, `vitest` + `jsdom`, `@playwright/test` (001's). Not added:
`@types/node` (off roster; 001 R-009 — tests read files through Vite's `?raw`
imports, never `fs`), `framer-motion`, any router, any testing library.

**Storage**: none. The backend holds no state; the frontend holds the latest
floor document in memory and the transition bookkeeping of the last two.

**Testing**: `uv run pytest -q` for the join (tests under `tests/`);
`npm --prefix web run typecheck` (`tsc --noEmit`); `npm --prefix web run
test:unit` (vitest, jsdom, tests under `web/tests/unit/`, rendering with
`react-dom/client` + `act` and querying the container directly, as 001 does)
for layout, markers, lifecycles, style map, badge; `npm --prefix web run
test:smoke` (Playwright, headless chromium, `web/tests/smoke/`, against the
`PANE_DEMO=1` backend 001's `playwright.config.ts` starts on 8787) for the
staged Fixture floor, the full-bleed measurement, and the element sweep.

**Target Platform**: the factory host (systemd user unit, D-007) serving a
browser on the operator's laptop; a projector showing the Showfloor (D-002).
Demo mode (`PANE_DEMO=1`) on any host with no factory.

**Project Type**: web application — FastAPI backend under `pane/`, Vite/React
frontend under `web/`, two package worlds in one repository (D-006).

**Performance Goals**: none stated. A floor has single-digit running epics and
each workgraph single-digit nodes; dagre lays out such graphs in microseconds.
The SSE `floor` snapshot arrives on 001's `PANE_POLL_INTERVAL_S` cadence, which
this spec does not change (Assumptions).

**Constraints**: no write path (constitution I); every read through ergane's
seams and the browser never dials Temporal or reads the factory's disk
(constitution II, FR-002); two 052 failure modes rendered as two facts
(constitution III, FR-005); every claim decidable from the diff, headless
(constitution IV); fixtures recorded never invented (constitution V); no
credential in any page, event, log or fixture (constitution VI); roster-only
dependencies (constitution VII); DESIGN.md governs appearance — no remote
stylesheet, no red, no cream, state never by colour alone, motion gated by
`prefers-reduced-motion` (constitution VIII).

**Scale/Scope**: one backend module and its tests; one frontend room of about
ten components/modules with their unit tests; one Playwright spec; no new
routes, no new reads, no new endpoints.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|---|---|---|
| I. One verb | **PASS** | The Showfloor carries no verb. FR-016 forbids any control; US4's sweep asserts zero `button`/`form`/`input`/`select`/`textarea` and the flow mounts non-draggable, non-selectable. The badge is an `<a>`. |
| II. Borrowed seams | **PASS** | No new read. `assemble_stage` is a pure join over the outcomes 001's readers already return (`collect_floor` for the running list, the `epic_status` query, the specs root for `workgraph.json`), called inside 001's `assemble_floor_document`. Nothing re-derives readiness, blockers, or state; the `awaiting_operator` flag is read, never computed. Nothing shells the CLI. |
| III. Honest degradation | **PASS** | Transport failure and query refusal are two note modes (`transport`, `refusal` — 001's `DegradedEntry` words), rendered as two in-section notes (FR-005). Unrecorded live fields are null and named in `unknown`, never zero (FR-004). A dead `workgraph.json` is a named entry (US1-S6). A degraded attention read is a note, never `0` (FR-017). A quiet floor is a named element (FR-019). |
| IV. Provable headless | **PASS** | Every scenario names its committed test; motion is specified as marker lifecycles with fake timers, and reduced motion is the control; full-bleed is a measured bounding box; positions are asserted over `layoutStage`'s output, not pixels. |
| V. Fixtures recorded | **PASS** | No payload is added or edited. Tests replay `fixtures/workgraphs/*.json` and `fixtures/epic-status/**` and inject fault shapes at the reader seam or delete keys from a recorded answer inside the test, as 001's tests do. An empty attention list is constructed at the document level (US4-S2), as the spec directs. |
| VI. Token on every route | **PASS (inherited interim)** | `/showfloor` is served by 001's guarded SPA catch-all behind `pane.auth.require_viewer` (001 FR-017), which 003 closes. No credential reaches a page, an event, a log, or a test; stage notes quote reader error text, which 001's readers already scrub. |
| VII. Roster only | **PASS** | Adds `@xyflow/react` and `@dagrejs/dagre`, both named in constitution VII. Does not add `framer-motion`, `@types/dagre`, `@types/node`, or any router. No compiler option loosened. |
| VIII. Built to DESIGN.md | **PASS** | Tokens (001's `web/src/styles/tokens.css`, comp names kept), faces (`web/public/fonts/fonts.css`, linked by 001's `index.html`), the eleven-state glyph grammar, the two edge strokes, the landing line, the badge, the well, and the three motions are implemented from the named DESIGN.md sections; each rendering task cites its section. Where DESIGN.md's comp text ("unlocks on merge") and the spec's legend scenario disagree on *what is shown*, the spec's verbatim glossary strings win; the comp's short labels may accompany them. |

**Post-Phase-1 re-check**: PASS, unchanged. The design introduced no new
read, no write, no dependency beyond the two roster entries, and no persisted
state. One appearance matter DESIGN.md does not settle — a dark palette — is
resolved without inventing colour (Decision 4 below).

## Project Structure

### Documentation (this feature)

```text
specs/002-the-showfloor-stages-an-epic/
├── plan.md                      # This file
├── spec.md                      # Feature specification (not edited by this plan)
├── data-model.md                # Phase 1 — entities, invariants, the state vocabulary
├── contracts/
│   └── stage-document.md        # Phase 1 — the stage document shape, the DOM marker vocabulary, the normative strings, the style-map export
└── tasks.md                     # Phase 2 — the four story phases
```

Research (Phase 0) is folded into **Decisions** below rather than a separate
`research.md`: every unknown was closed against the constitution, D-004/D-006,
DESIGN.md, 001's plan and contracts, and the recorded fixtures, and the
decisions are short enough to live with their consequences. No quickstart is
written: the validation guide is the four gate commands in `ergane.yaml` and
the README 001 wrote.

### Source Code (repository root)

Files this spec **creates** are marked `+`; files 001 landed that this spec
**edits** are marked `~`; a file the concurrently-built 003 also writes is
marked `‖003` (Decision 11 — keep the hunks disjoint). 001's names are taken
from its plan (`specs/001-the-desk-sees-the-floor/plan.md`) and contracts; the
landed tree is the final word, and a task names the role beside the path.

```text
pane/
├── readers.py                   (001) Reader protocol, TransportFailed, QueryRefused — imported, never edited
├── fixture_floor.py             ~ (001) SCENES table — edited only if no scene stages a both-edge-kinds workgraph (Risks)   [US2]  ‖003
├── floor_document.py            ~ (001's assemble_floor_document) call assemble_stage per running epic; attach `stage`   [US1]  ‖003
└── stage.py                     + assemble_stage(epic_id, workgraph_or_failure, live_outcome) -> dict   [US1]

tests/                           (001's pytest directory; pythonpath = ["."])
├── test_stage.py                + the join: complete, absent node, two modes, missing keys, stray id, dead file, derived flag, wiring   [US1]
└── test_showfloor_attention.py  + the attention section's degraded entries for both modes, as the badge consumes them   [US4]

web/
├── package.json                 ~ add @xyflow/react, @dagrejs/dagre   [US2]
├── package-lock.json            ~ regenerated by npm   [US2]
├── src/
│   ├── App.tsx                  ~ (001's room switch on window.location.pathname) add the /showfloor case   [US2]
│   ├── Masthead.tsx             + the shared masthead extracted from App.tsx if 001 left it inline, with an optional `trailing` slot   [US2; slot filled in US4]
│   ├── api/floorDocument.ts     ~ (001's TS mirror of the floor document) add `stage?: StageDocument` to EpicEntry   [US2]  ‖003
│   ├── api/events.ts            (001's SSE consumer) imported, never forked
│   ├── styles/tokens.css        (001's DESIGN.md tokens) imported, never forked
│   ├── showfloor/
│   │   ├── Showfloor.tsx        + the route: floor fetch + subscription as Desk.tsx does, masthead, quiet floor, one EpicStage per running epic   [US2; badge in US4]
│   │   ├── EpicStage.tsx        + one epic: ReactFlow viewport, stage notes, Legend; LandingLine + idle in US3; non-interactive props in US4   [US2]
│   │   ├── StationNode.tsx      + the card: glyph + caption, state/style/waiting markers, pips, persona badge; landing/transition in US3   [US2]
│   │   ├── RouteEdge.tsx        + the edge: dashed pass-edge, solid double-rail merge-edge, kind markers   [US2]
│   │   ├── Legend.tsx           + the two verbatim definitions   [US2]
│   │   ├── LandingLine.tsx      + the four stations, tokens, the landed shelf   [US3]
│   │   ├── AttentionBadge.tsx   + the one link, or the degraded note   [US4]
│   │   ├── layout.ts            + layoutStage(): dagre LR + declaration-order tie-break   [US2]
│   │   ├── states.ts            + NODE_STATES, LIVE_STATES, LANDING_STAGES, STATE_STYLES, UNKNOWN_STYLE, resolveStateStyle; theme axis completed in US3   [US2]
│   │   ├── transitions.ts       + useTransitionMarkers(), TRANSITION_MS   [US3]
│   │   ├── motion.ts            + useReducedMotion()   [US3]
│   │   ├── types.ts             + StageDocument, StagedNode, StagedEdge, StageNote — the TS mirror of contracts/stage-document.md   [US2]
│   │   └── showfloor.css        + the room's styles over tokens.css: stations, edges, landing line, well; the three motions in US3   [US2]
│   └── routes.ts                + DESK_PATH = "/desk", SHOWFLOOR_PATH = "/showfloor" (if 001 exported no path constants; App.tsx made to use them)   [US2]
└── tests/
    ├── unit/                    (001's vitest directory)
    │   ├── support/
    │   │   ├── xyflow-double.tsx    + vitest double for @xyflow/react: renders nodeTypes/edgeTypes in plain elements, records mount props   [US2]
    │   │   ├── stage-builder.ts     + builds stage documents from a recorded workgraph (?raw import) plus stated live states   [US2]
    │   │   └── event-source-double.ts   + replaces window.EventSource so a test can emit typed SSE events   [US4]
    │   ├── layoutStage.test.ts      + [US2]
    │   ├── StationNode.test.tsx     + [US2]
    │   ├── EpicStage.test.tsx       + [US2; idle in US3; flow props in US4]
    │   ├── Legend.test.tsx          + [US2]
    │   ├── Showfloor.test.tsx       + [US2; badge-follows-events in US4]
    │   ├── transitions.test.tsx     + [US3]
    │   ├── states.test.ts           + [US3]
    │   └── AttentionBadge.test.tsx  + [US4]
    └── smoke/
        └── showfloor.spec.ts        + stages the Fixture floor headless: nodes once each, both edge kinds, legend; full-bleed in US3; sweep in US4   [US2]  ‖003
```

**Structure Decision**: the backend gains one pure module and no route; the
frontend gains one room directory and three test doubles, and touches 001's
tree in exactly four places (the room switch, the masthead, the `EpicEntry`
type, and the floor-document assembler). Everything that renders lives under
`web/src/showfloor/` — the surface brief's `primary_target` — so US3 and US4,
which edit the room US2 creates, edit one directory and the merge-edge chain
in the work graph orders them. Three of those four touches into 001's tree,
plus the smoke spec this spec creates, are also written by the concurrently
built 003 (`‖003` above); nothing in the work graph can order those, so each
task line names its sibling writer instead (Decision 11, tasks.md §
Concurrent epic).

## Decisions

**1. The stage is a key on 001's `EpicEntry`, not a second document.** The
spec's Key Entities say the stage document "is the per-epic entry within the
floor document 001 established — the pane still has one read". Adding a
`stage` key to each `EpicEntry` is additive: 001's `NodeCard` list, the Desk,
and 001's tests are untouched, the SSE `floor` snapshot carries every stage
for free, and the Showfloor and the Desk provably render the same document.
The stage is not derived from 001's `NodeCard`s because they cannot say
whether `landing_state: null` was recorded or defaulted; it is joined from the
same raw inputs, in the same function, so the two joins cannot be fed
different facts, and a test binds the stage's node ids to the cards marked
`declared: true`. Rejected: a `/showfloor` endpoint (a second read, a second
poll, and a second place for the two documents to disagree).

**2. `assemble_stage` is pure and takes outcomes, not readers.** Its inputs are
the parsed `workgraph.json` (or the `TransportFailed` / `JSONDecodeError` the
read produced) and the `epic_status` outcome 001's reader returns (an answer
mapping, `TransportFailed`, `QueryRefused`). That is what lets one pytest
drive every 052 fault shape with no Temporal, no disk, and no mocking of
network code — and what keeps FR-002 true by construction: a module that never
opens a file cannot read the factory's filesystem. Note modes reuse 001's
words, `transport` and `refusal`, plus `unparseable` for the one fact 001
does not classify (001 R-002 lets a decode error propagate; US1-S6 requires
002 to catch it at the call site and name it).

**3. The flow library is the viewport; the stage logic is ours and pure.**
`@xyflow/react` owns pan/zoom and node/edge rendering; `@dagrejs/dagre`
(`rankdir: "LR"`) owns rank assignment. The one invariant dagre does not
promise — equal-rank nodes in declaration order — is enforced in
`layoutStage()` by grouping nodes by computed `x` and reassigning the group's
`y` values in declaration order. Both invariants are unit-tested over the
recorded 077 workgraph, which carries both edge kinds and a same-rank pair.
Rejected: hand-rolled SVG (D-006 rejected it for the same reason: agents
would build layout and pan/zoom from scratch and the judge would score
invented code).

**4. The style map is total over theme × state, and the pane has one
palette.** FR-015 demands a defined style token per state in both light and
dark themes with no catch-all. DESIGN.md names one palette and no dark
variant, and constitution VIII says a colour DESIGN.md does not name is a
defect. So `STATE_STYLES` is `Record<NodeState, Record<Theme, StateStyle>>` —
eleven keys, each with `light` and `dark` — and the `dark` entries name the
same DESIGN.md tokens as `light`. The committed test asserts the *shape*
(every state, both themes, none resolving to `UNKNOWN_STYLE`); when a
superseding decision gives DESIGN.md a dark palette, the values change and
the shape does not. Rejected: inventing a dark palette (constitution VIII);
omitting the theme axis (fails FR-015 by omission).

**5. Motion is CSS; the marker is the contract.** The three DESIGN.md motions
(live-dot breathe, RUNNING station glow, landing-line token travel) are CSS
keyframes authored inside `@media (prefers-reduced-motion: no-preference)`.
The transition pulse FR-012 specifies is a `data-transition="true"` attribute
whose apply-and-clear lifecycle `useTransitionMarkers` drives with a timer
(`TRANSITION_MS`), seeded silently on the first document and skipped entirely
under reduced motion. Tests use fake timers; no test reads an animation.
`framer-motion` is on the roster but adds nothing a committed test could
assert, so it is not added.

**6. In vitest, `@xyflow/react` is a committed double.** React Flow renders
nodes only after measuring them with `ResizeObserver`, which jsdom does not
provide, so a unit test that mounted the real library would assert over an
empty viewport and pass vacuously. `web/tests/unit/support/xyflow-double.tsx`
replaces the library under `vi.mock("@xyflow/react", …)` at the top of each
test file that mounts a flow (001's `vite.config.ts` is not edited for it): it
renders every node through the `nodeTypes` component and every edge through
the `edgeTypes` component inside plain elements, and records the props it was
mounted with — which is exactly what US4-S5's "mounts with dragging and
selection disabled" test reads. The real library is exercised by the
Playwright smoke against the demo floor, where markers, edge classes, the
legend, and the bounding box are asserted in a real chromium. Rejected: a
`ResizeObserver` polyfill in jsdom (still measures nothing; nodes keep zero
size and the library keeps hiding them).

**7. A MERGED node renders twice by design.** DESIGN.md keeps merged stations
on the route (olive, so the route stays whole) and collects landings at the
top of the landing line ("MERGED ×3"). FR-011 says MERGED nodes render within
the landed shelf. Both hold: the station stays on the route (`[data-station]`,
counted once by SC-001) and a shelf card (`[data-shelf-card]`, the same
component) renders inside `[data-landed-shelf]`. The contract names both
markers so neither assertion is ambiguous.

**8. Stage documents for component tests come from a test builder, not from
a second join.** `web/tests/unit/support/stage-builder.ts` maps a recorded
`workgraph.json` — imported with Vite's `?raw` and `JSON.parse`d, as 001's
sweeps read sources; no `fs`, no `@types/node` — to the contract's
`nodes`/`edges` and lets a test state live fields per node. It is a fixture
builder typed against `types.ts`, used by tests only; product code never
builds a stage — the backend does. The smoke is the test that proves the real
backend's document renders.

**9. The legend says the spec's words.** US2-S5 makes two glossary strings
normative; DESIGN.md's comp labels the same kinds "unlocks on merge" /
"unlocks on verification". Spec wins on what is shown: the legend names
**pass-edge** and **merge-edge** with the verbatim definitions; the comp's
short labels may sit beside them in micro, and the test asserts only the
normative strings.

**10. The Showfloor owns its floor state the way the Desk does.** 001's
`Desk.tsx` fetches `/api/floor` and subscribes to `/api/events` through
`web/src/api/events.ts`; `Showfloor.tsx` does exactly the same through the
same consumer (one room is mounted at a time, so there is never a second
`EventSource`). The masthead 001 renders in `App.tsx` is extracted to
`web/src/Masthead.tsx` with an optional `trailing` slot so the Showfloor can
place the badge where DESIGN.md § Navigation puts it, without forking the nav.
FR-016's non-interactive flow props land in US4's diff, not US2's, because
FR-016 is US4's requirement and the judge grades a node's diff against its own
FRs; US2 mounts no chrome and nothing writes in the interval.

**11. 003 is concurrent, so the shared hunks are kept apart by hand.**
`ergane.yaml` declares `roadmap.max_concurrent_epics: 2` and both 002 and 003
carry exactly `depends_on_landed: [001-the-desk-sees-the-floor]`. The roadmap
grammar has no ordering edge between two specs and the workgraph grammar
scopes edges to one spec, so no graph change can sequence them: once 001
lands, both dispatch and every node branches from `dev`. Four files take a
diff from each epic — `pane/floor_document.py` (this spec's `stage` key in the
per-epic join loop vs 003's rebuild of the attention section),
`web/src/api/floorDocument.ts` (`stage?` on `EpicEntry` vs 003's
`AttentionItem` extension), `pane/fixture_floor.py` (at most one SCENES row vs
003's store seeding and four `FixtureReader` seam halves), and
`web/tests/smoke/showfloor.spec.ts` (created here, authenticated by 003's
token gate). The mitigation is the only one available: keep each hunk as small
and as far from the sibling's as the file allows, and name the sibling writer
on the task line so the implementer knows what not to touch (T006, T016,
T033). Two shared *shapes* are handled the same way — 001's `subscribeFloor`
gains an optional third argument in 003, so T025 calls it with two and never
re-types it; and the floor document's `attention.items` carries only unsettled
items per 003's `contracts/api.md`, which is what lets T049 keep
`items.length` as the count and what T053 deliberately stops short of
re-asserting. Rejected: a `depends_on_landed` edge from 003 to 002 (it would
serialise two independent epics to buy nothing this roster does not already
buy, and neither spec's stories need the other's code).

## Story-by-story approach

**US1 — the join (backend).** `pane/stage.py` exports `assemble_stage`. It
walks the file's nodes in order, looks each id up in the answer's `nodes`
mapping, copies the four live fields with nulls and an `unknown` list for
anything missing, derives `waiting_on_operator`, builds the edge list with
kinds, and appends notes: one per fault (`transport` / `refusal` /
`unparseable`) and one per live-only id. 001's `assemble_floor_document` calls
it once per running epic, inside the same try/except it already uses for the
two reads, and attaches the result as `stage`. The tests load
`fixtures/workgraphs/002-expense-notes.json` with a recorded answer from
`fixtures/epic-status/002-expense-notes/` for the complete case;
`fixtures/workgraphs/077-a-scanner-the-operator-chooses-runs-in-the-loop.json` for both edge kinds; `QueryRefused` as 001's
`FixtureReader` raises it for `fixtures/epic-status/refusal.json`
and `TransportFailed` as 001's transport tests raise it for the two modes; key
deletion on a recorded answer for the partial case; the skew pair
`fixtures/README.md` names — `fixtures/epic-status/skew/status-names-us3.json`
paired with `fixtures/workgraphs/002-expense-notes.json` — for the stray id;
and `fixtures/epic-status/paged/paged.json`, the
recorded paged-while-verifying answer, for the derived flag. Paths are the
README's committed layout, read from disk as recorded.

**US2 — the stage (frontend).** `types.ts` mirrors the contract and
`api/floorDocument.ts` gains `stage?`; `layout.ts` computes positions;
`states.ts` holds the vocabulary and the style lookup; `StationNode`,
`RouteEdge`, `Legend`, `EpicStage`, `Showfloor` render it, with the quiet
floor as a named element; `showfloor.css` builds on 001's `tokens.css`. The
route is added to `App.tsx`'s switch at `/showfloor`. The Playwright smoke
stages the demo floor and asserts SC-001. The two dependencies are added to
`web/package.json`.

**US3 — the flow.** `LandingLine` with the shelf; `data-landing-stage` on
stations; `transitions.ts` and `motion.ts`; the idle marker on `EpicStage`;
the three CSS motions under the reduced-motion gate; the theme axis of
`STATE_STYLES`; the full-bleed root and its Playwright measurement.

**US4 — the badge.** `AttentionBadge` reads the floor document's `attention`
section and its `degraded` entries for section `attention` — a count, or a
`transport` / `refusal` entry — and renders one `<a href="/desk">` or a
`[data-attention-degraded]` note in the masthead's `trailing` slot. The count
is `attention.items.length` with no filtering in the component: 003's
`contracts/api.md` declares that list carries only unsettled items, settled
ones being reachable through `GET /api/attention`, so the length is the number
waiting on the operator whichever epic lands first (Decision 11). The
`event-source-double` lets a test push `floor` events and watch the count
move. `EpicStage` gets its non-interactive flow props. The sweep runs in
Playwright against the finished room; the flow-props test reads the double's
recorded mount props. The backend-side test pins only the section's `degraded`
entries — the half of the attention section 003 does not redesign.

## Risks and traps

- **The demo floor must stage an epic carrying both edge kinds.** 001 R-003
  composes the demo running list from `fixtures/floor/floor-live.json`'s epics
  plus a committed scene table in `pane/fixture_floor.py` (code, not a
  payload). SC-001's "both edge kinds" clause needs a staged workgraph that
  carries both — `fixtures/workgraphs/077-a-scanner-the-operator-chooses-runs-in-the-loop.json`
  does (five nodes, three pass-edges, one merge-edge, and the `us1`/`us2`
  same-rank pair); `fixtures/workgraphs/002-expense-notes.json` carries only a
  merge-edge. If the landed scene table stages no such
  workgraph, US2 adds one scene row binding 077 to its recorded `epic_status`
  document if one exists by then — `fixtures/epic-status/` records
  `002-expense-notes/`, `landing/`, `paged/`, `question/`, `refusal.json`,
  `refusal-exception.json` and `skew/`, and nothing for 077, so today it does
  not — or, the honest fallback, stages 077 with its status read reported as
  the loader's missing-document `TransportFailed` (a `transport` note on a
  static graph, exactly what US1-S3 proves); either touches 001's code, never
  a payload (constitution V), and the Desk's degraded well then names one more
  transport fact, which 001's tests must still accept. The unit tests over
  the 077 workgraph hold regardless. The same honest degradation is the
  landing, paged, question, and refusal scenes' normal state: none of them has
  a recorded workgraph, so their workgraph read is the loader's
  missing-document `TransportFailed` and their nodes render `declared: false`
  — a fact the spec's US1-S6 already names, not a defect to design around.
- **Two epics write four of these files.** 002 and 003 run concurrently
  (Decision 11); `pane/floor_document.py`, `web/src/api/floorDocument.ts`,
  `pane/fixture_floor.py`, and `web/tests/smoke/showfloor.spec.ts` each have a
  writer in both. The trap is a diff that is *correct* and *wider than its
  task*: a reformatted import block, a signature tidied in passing, a
  test-file reorganisation. Whichever epic lands second then rebases by hand
  in the merge queue. tasks.md § Concurrent epic is the roster.
- **A test the gate does not collect proves nothing.** pytest collects
  `tests/` from the root; vitest collects `web/tests/unit/`; Playwright
  collects `web/tests/smoke/`. Check each gate's output names the new file.
- **No `fs` in web tests.** 001 has no `@types/node`; read recorded fixtures
  with Vite's `?raw` import and `JSON.parse`, read component sources for
  sweeps with `?raw` too.
- **React Flow's defaults are interactive.** Dragging, connecting, selecting,
  and focusing are on by default; `Controls` renders buttons. US2 mounts no
  chrome; US4 turns the four off and asserts it. Hide the attribution link
  only through the library's documented `proOptions` — DESIGN.md says the
  badge is the Showfloor's one link.
- **`persona` in a live answer can be `""` or `<unresolved>`.** The station's
  persona badge is the workgraph's `persona` (static truth), never the live
  field — a deliberate difference from 001's `NodeCard`, which prefers the
  live value when non-empty.
- **First paint is not a transition.** `useTransitionMarkers` must seed from
  the first document without marking; US3-S3 is the control and it fails a
  naive implementation that diffs against an empty map.
- **Unknown is not zero.** `attempt: null` renders no pips; `state: null`
  renders `data-state="unknown"`; a degraded attention read renders a note
  and never the numeral `0`. Every one of these has a committed negative
  assertion.
- **The paged-while-verifying case stays VERIFYING.** `data-state="VERIFYING"`
  plus `data-waiting="true"`, with DESIGN.md's ring and the word "paged";
  never re-labelled WAITING_OPERATOR.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Table intentionally empty.
