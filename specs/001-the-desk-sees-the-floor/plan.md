# Implementation Plan: the desk sees the floor

**Branch**: `001-the-desk-sees-the-floor` (lands on `dev`, D-011) | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-the-desk-sees-the-floor/spec.md`

## Summary

Four stories, one chain. A scaffold that makes the four `ergane.yaml` gates real in a
fresh checkout (`pane/` under `uv`, `web/` under `npm`, one committed test behind
every gate); a loader that replays the recorded Fixture floor under `fixtures/`
through the same floor-document assembly live reads use; a FastAPI backend whose
every read is an ergane library seam and whose every failure is a named fact; and a
read-only Desk that renders attention first, then the floor, health, and spend to
date — to `DESIGN.md`, headless-provable, with no verb.

The technical approach is the one D-005/D-006 decided and the constitution binds:
import ergane's functions, never shell the CLI, never re-derive the floor; one
`Reader` seam with two implementations (live, fixture) and one assembly downstream
of it; SSE events `{type, data}` with exactly one type (`floor`); a single open auth
dependency every route mounts behind; fixtures recorded, never invented, served
whole under `PANE_DEMO=1`; and a Desk built from `DESIGN.md`'s tokens, faces,
glyph grammar, milestone bar, attention ranking, and wells. Every scenario in
`spec.md` maps to a committed test one of the four gates runs.

## Technical Context

**Language/Version**: Python ≥ 3.12 (backend, `uv`-managed); TypeScript 5.x under
`strict: true` (frontend, `npm`-managed), Node 22 in CI (Node 20 works locally).

**Primary Dependencies** (constitution VII roster, nothing else):
- Python: `ergane-cli==0.2.0` (PyPI, D-011), `fastapi`, `uvicorn`, `sse-starlette`,
  `httpx`; dev: `pytest`, `pytest-asyncio`. `temporalio` is reached only as
  ergane's own transitive dependency and is never declared.
- Node: `react`, `react-dom`, `typescript`, `vite`, `@vitejs/plugin-react`,
  `@types/react`, `@types/react-dom`, `vitest`, `jsdom`, `@playwright/test`.
  `@xyflow/react`, `@dagrejs/dagre`, `framer-motion` are on the roster but are
  **not declared by this spec** — 002 adds them when it stages the DAG. No
  `@types/node`, no `@testing-library/*`, no router, no CSS framework: none is on
  the roster.

**Storage**: none of the pane's own (FR-018). Reads touch ergane's stores read-only
through ergane's openers (`connect_readonly`, `open_readonly`) and `workgraph.json`
files under the specs root; demo mode reads `fixtures/`.

**Testing**: `uv run pytest -q` (pytest + pytest-asyncio, `asyncio_mode = "auto"`);
`npm --prefix web run typecheck` (`tsc --noEmit`); `npm --prefix web run test:unit`
(vitest, jsdom environment); `npm --prefix web run test:smoke` (`vite build &&
playwright test`, headless chromium, against the backend in demo mode). Declared in
`ergane.yaml` and mirrored job-for-job in `.github/workflows/ergane-gates.yml`.

**Target Platform**: Linux; the backend as a systemd user unit on the factory host
(D-007, an operator act outside this spec); the frontend in the operator's browser.
Every gate runs in a sandbox with no factory, no Temporal, no factory database.

**Project Type**: web service + single-page frontend, one origin — the FastAPI app
serves `web/dist` through a guarded catch-all route so production and the smoke gate
share one shape.

**Performance Goals**: none stated. One operator, one browser tab, a poll every
`PANE_POLL_INTERVAL_S` seconds (default 15) per SSE subscriber.

**Constraints**: constitution I–VIII in full. No write path. No shelled CLI. Two
degraded modes, rendered differently, in-section. No credential in a page, event,
log, or fixture. No remote stylesheet, script, font, or icon. Sage ground, no red.
State never carried by colour alone. `prefers-reduced-motion` honoured.

**Scale/Scope**: one backend package (`pane/`, ~8 modules), one frontend app
(`web/src`, ~16 modules), two routes (`/api/floor`, `/api/events`) plus the SPA
catch-all, one rendered room (the Desk), ~20 committed test files across four gates.

## Constitution Check

*GATE: evaluated before design; re-checked after.*

| Principle | Status | Evidence in this plan |
|---|---|---|
| I. One verb (Answer), nothing else writes | **PASS** | No POST/PUT/DELETE route exists; the Desk renders no button, form, or input; a committed sweep and a Playwright network assertion prove it (US4-S8). Answer is 003's. |
| II. Borrowed seams, never re-derived | **PASS** | `LiveReader` imports `collect_floor`, `EpicWorkflow.epic_status` via `factory.cli.nouns._open_client` + `factory.cli.nouns.build.workflow_id`, `open_escalations`, `rollup` over `open_readonly`, `list_findings` over `connect_readonly`, and classifies failures with `factory.cli.nouns.build.TRANSPORT_FAILED` / `QUERY_REFUSED`. Nothing computes readiness, blockers, or state; a committed sweep forbids `subprocess`/`ergane` invocations in `pane/` (US3-S6). |
| III. Every read degrades honestly | **PASS** | Reader failures are two exception classes (`TransportFailed`, `QueryRefused`); assembly records one `degraded` entry per failed read naming section and mode; missing keys default; NULL stays `null` (never `0`); spend is labeled `spend_to_date`; a quiet floor and an unreachable floor are different renderings (FR-025). |
| IV. Provable from the diff, checkable headless | **PASS** | Every scenario names its test in `tasks.md`; Playwright runs headless chromium against `PANE_DEMO=1`; no gate needs a human, a screen, or a factory. |
| V. Fixtures recorded, never invented | **PASS** | US2's diff adds the loader, envelope handling, scene composition, tests, and README edits — never a payload. Shape tests validate every document against ergane's contracts; the demo floor composes recorded documents without editing one. |
| VI. Token on every route | **PASS (dated interim, D-010 §5)** | Every route — including the SPA catch-all — mounts behind `pane.auth.require_viewer`, whose 001 body admits every request; `/docs`, `/redoc`, `/openapi.json` are disabled so no unguarded route exists; a route-table test proves it (US3-S7). 003 closes the seam before any deployment. Credential sweep over `fixtures/` (US2-S6). |
| VII. Approved dependencies only | **PASS** | Both manifests carry only roster entries plus FR-005's named additions; a committed sweep reads the two manifests (US1-S4). No build backend is declared (`[tool.uv] package = false`) so nothing outside the roster is fetched. |
| VIII. Built to DESIGN.md | **PASS** | `web/src/styles/tokens.css` carries DESIGN.md's colour/type/rhythm tokens verbatim; `index.html` links `/fonts/fonts.css` and nothing remote; the Desk implements § Layout, § Attention Item, § Epic Timeline Row and the Milestone Bar, § State Chevrons (all eleven + paged), § Tables, The Unknown Rule, The Well Rule, § Motion (reduced-motion off switch). Each rendering task in `tasks.md` cites its section. |
| Env: stores through ergane's resolvers | **PASS** | Doctor store path via `factory.workgraph.worktree.resolve_factory_root` + `factory.doctor.cli._resolve_store_path_for_root`; ledger via `factory.usage.cli._default_ledger_path` (the `ERGANE_LEDGER_PATH` chain); specs root default `factory.workgraph.cli.DEFAULT_SPECS_ROOT`. No literal `.ergane/` or `.factory/` path in `pane/`. |
| Env: `web/public/fonts/`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/` pre-exist | **PASS** | The scaffold keeps all four; a committed test asserts the four woff2 files and `fonts.css` are still present and linked. |

**Post-design re-check**: PASS, unchanged. The design introduces no dependency
beyond the roster, no write, no second auth path, no invented fixture.

## Decisions

The plan's research, folded here because every unknown was closed by the spec,
the decision log, or a read of the ergane 0.2.0 source. Format: decision,
rationale, alternatives.

- **R-001 · One `Reader` protocol, two implementations, one assembly.**
  `pane/readers.py` declares the outermost seam: `read_floor()`,
  `epic_status(workflow_id)`, `workgraph(epic_id)`, `open_escalations()`,
  `stored_questions()`, `list_findings()`, `rollup()`, plus `reference_instant`.
  `LiveReader` (US3) calls ergane; `FixtureReader` (US2) reads `fixtures/`.
  `pane/floor_document.py::assemble_floor_document(reader, ...)` is the only
  assembly and is exercised by both (US2-S5). *Rejected*: branching on
  `PANE_DEMO` inside assembly (two code paths, the defect class FR-010 names).
- **R-002 · Failure is two exception classes at the seam.** `TransportFailed` and
  `QueryRefused` are raised by readers; assembly catches exactly these per read
  and appends `{"section", "mode", "detail", "epic_id"?}` to `degraded`. The live
  reader classifies with ergane's own `TRANSPORT_FAILED` / `QUERY_REFUSED`
  tuples (`factory.cli.nouns.build`); the fixture reader raises `QueryRefused`
  for a recorded refusal document (one carrying a `refusal` key) and
  `TransportFailed` for a document that is missing or whose envelope says
  `"status": "pending"`. Any other exception propagates: a bug is not a
  degraded read. *Rejected*: a boolean `degraded` flag (loses the 052 distinction).
- **R-003 · The demo floor is composed from recorded documents, declared in code.**
  `fixtures/floor/floor-live.json` was captured while one epic ran; the on-cue
  scenes (paged-while-verifying, refusal, skew, landing run) were provoked
  separately and are not listed by that floor. Constitution V forbids editing the
  recording to list them, so `FixtureReader.read_floor()` returns the recorded
  FloorStatus verbatim *and* a running-epic list composed from a committed scene
  table in `pane/fixture_floor.py` (one entry per recorded `epic_status` document
  the Desk must show, bound to its `workgraph.json` **where one was recorded** —
  only the polled `002-expense-notes` scene and the skew scene have one, and the
  skew pairing is the operator's, declared in that document's envelope under
  `pair_with`; a polled directory contributes
  its highest `sequence`). In live mode the running list is the projection
  `[epic.epic_id for epic in floor.epics]` — no re-derivation. A document entry
  composed from a scene carries `scene: "<file stem>"` so two scenes recorded
  from one epic id stay distinct rows. *Rejected*: a fixture manifest file under
  `fixtures/` (a judge could read it as a payload); extending the recorded
  FloorStatus in flight (edits a recording).
- **R-004 · Transport faults in demo mode are injected at the seam, not faked in
  a fixture.** `PANE_DEMO_TRANSPORT_FAIL=<section[,section]>` (sections: `floor`,
  `epics`, `attention`, `health`, `spend`) makes the named fixture reads raise
  `TransportFailed`. The smoke boots one clean backend (port 8787) and one with
  `PANE_DEMO_TRANSPORT_FAIL=health` (port 8788) so US4-S7 can assert the two
  notices differ on real pages. *Rejected*: a hand-written "transport failure"
  fixture (invented); deleting a document before the smoke (mutates the tree).
- **R-005 · Borrowed shapes are wrapped, never redefined.** The floor document
  carries FloorStatus, NodeStatus, OpenEscalation, the webhook payload, Finding,
  and the rollup verbatim as JSON; the pane adds only envelopes around them
  (section `seam`, attention `kind`/`expires_at`, node `declared`). TypeScript
  types in `web/src/api/floorDocument.ts` mirror `contracts/floor-document.md`
  and are what 002 consumes. *Rejected*: a pane-side schema that renames fields.
- **R-006 · One origin: the backend serves `web/dist` through a guarded route.**
  `GET /{path:path}` (behind `require_viewer`) resolves a file under `web/dist`
  or falls back to `index.html`, refusing `..`; with no build present it answers
  `503` in words. `test:smoke` is `vite build && playwright test`, whose
  `webServer` entries start the backend(s) with `cwd` at the repository root.
  *Rejected*: Vite dev server + proxy (two origins, a config knob per backend);
  `StaticFiles` mount (a `Mount` is not a route and sits outside the auth seam).
- **R-007 · Per-subscriber poll, no shared snapshot.** Each SSE subscription runs
  its own `floor_events()` generator: assemble, yield `{type: "floor", data}`,
  sleep `PANE_POLL_INTERVAL_S`, repeat, stop on disconnect. A reconnecting Desk
  gets a full snapshot as its first event (Edge Cases). The app holds no
  snapshot (FR-018). *Rejected*: a shared broadcaster with a cached last event.
- **R-008 · Time left is computed in the browser against a document-supplied
  reference instant.** The document's `reference_instant` is the capture instant
  of the attention recording (`fixtures/escalations/open_escalations.envelope.json`,
  falling back to the floor envelope) in demo mode and `null` live; the Desk
  computes against it when present and against the wall clock otherwise. Only a
  factory-written `expires_at` yields a clock; an item without one shows no
  deadline — in 001 that is the recorded webhook Question payload
  (`fixtures/webhook/question.json`), which carries none. *Rejected*: minting an
  expiry from receipt time (FR-019 forbids it). *Forward note*: spec 003/US3
  replaces 001's stand-in Question source with the questions store's
  factory-written `expires_at` (`fixtures/questions/pending_questions.json`,
  live `factory.verify.store`) and amends the 001 tests and smoke wording that
  assert "no deadline" — 003 declares those amendments task by task; 001 asserts
  the stand-in as it stands.
- **R-009 · No build backend, no `@types/node`, tsc scoped to the app and unit
  tests.** `pyproject.toml` sets `[tool.uv] package = false` and
  `[tool.pytest.ini_options] pythonpath = ["."]`; `uvicorn` and Playwright run
  from the repository root. `web/tsconfig.json` includes `src`, `tests/unit`, and
  `tests/smoke` with `strict: true` and `skipLibCheck: true` (a library-checking
  option, not a strictness one — the repository's own code stays fully strict);
  `vite.config.ts` and `playwright.config.ts` are transpiled by their own
  runners and are excluded from `tsc`. Unit tests render with
  `react-dom/client` + `act` from `react` and query the container directly;
  file-content sweeps read sources through Vite's `?raw` / `import.meta.glob`
  rather than Node's `fs`. *Rejected*: `hatchling` or `@types/node` (off roster).
- **R-010 · The Desk route is `/desk`; `/` renders it too.** No router package is
  on the roster; `App.tsx` switches on `window.location.pathname` (`/desk` and
  `/` → Desk; 002 adds `/showfloor`). The masthead nav links both rooms per
  DESIGN.md § Navigation; in 001 the Showfloor link is present and inert-safe
  (a GET navigation, not a control).

## Project Structure

### Documentation (this feature)

```text
specs/001-the-desk-sees-the-floor/
├── spec.md                      # Feature specification (unchanged by this plan)
├── plan.md                      # This file
├── data-model.md                # Entities: floor document, attention item, node card, degraded entry
├── contracts/
│   └── floor-document.md        # GET /api/floor and the SSE envelope — what 002 and 003 consume
└── tasks.md                     # Phase per story; every task cites its scenario
```

### Source Code (repository root)

Annotated with the story whose diff creates each file (later stories edit, never
re-create). Pre-existing files are marked `(kept)`.

```text
ergane.yaml                      # (kept) the four gates
README.md                        # US1: setup + gate commands verbatim (FR-006)
pyproject.toml                   # US1: [project] deps from the roster; ergane-cli==0.2.0; pytest config
uv.lock                          # US1: generated, committed
pane/
├── __init__.py                  # US1
├── app.py                       # US1: create_app(), SPA catch-all; US2: /api/floor; US3: /api/events, auth mount
├── config.py                    # US2: Settings from env (PANE_DEMO, PANE_FIXTURES_ROOT, PANE_DEMO_TRANSPORT_FAIL,
│                                #       PANE_WEB_DIST); US3: PANE_POLL_INTERVAL_S, PANE_SPECS_ROOT
├── readers.py                   # US2: Reader protocol, TransportFailed, QueryRefused, EpicRef, FloorRead, UnconfiguredReader;
│                                # US3: LiveReader (ergane seams)
├── fixture_floor.py             # US2: FixtureReader, envelopes, SCENES, reference instant
├── floor_document.py            # US2: assemble_floor_document (one code path); US3: defaults, partial answers
├── events.py                    # US3: floor_events() generator, the {type,data} envelope
└── auth.py                      # US3: require_viewer — the single open seam (FR-017)
tests/
├── test_scaffold.py             # US1: app imports, gate names, strict tsc, headless config, roster sweep, README
├── test_fixture_shapes.py       # US2: every document against its ergane contract
├── test_fixture_loader.py       # US2: demo serves the whole floor; one assembly, two readers; missing → transport
├── test_credential_sweep.py     # US2: no credential value under fixtures/
├── test_floor_document.py       # US3: sections + provenance; partial answers; NULL stays unknown; undeclared node
├── test_degraded.py             # US3: transport vs refusal entries differ
├── test_events.py               # US3: one SSE event headless; poll loop queries epic-<id>
├── test_readonly_sweep.py       # US3: no shelled CLI; stores opened read-only; resolvers not literals
└── test_auth_seam.py            # US3: every route behind require_viewer; no docs routes
web/
├── package.json                 # US1: scripts typecheck/test:unit/test:smoke/build/dev; postinstall playwright
├── package-lock.json            # US1: generated, committed
├── tsconfig.json                # US1: strict: true
├── vite.config.ts               # US1: @vitejs/plugin-react; vitest environment jsdom
├── playwright.config.ts         # US1: headless chromium; webServer → backend on 8787; US4: + degraded on 8788
├── index.html                   # US1: <link rel="stylesheet" href="/fonts/fonts.css">, nothing remote
├── public/fonts/                # (kept) RedHatDisplay/Text/Text-italic/Mono .woff2 + fonts.css
├── src/
│   ├── main.tsx                 # US1
│   ├── App.tsx                  # US1: masthead + room switch; US4: mounts <Desk/>
│   ├── styles/tokens.css        # US1: DESIGN.md tokens as CSS custom properties (comp names kept)
│   ├── styles/global.css        # US1: ground, body, headings, masthead, chevron grammar, wells, tables, motion
│   ├── api/floorDocument.ts     # US3: TS types mirroring contracts/floor-document.md
│   ├── api/events.ts            # US3: SSE consumer; ignores unknown event types.
│   │                            #      subscribeFloor(url, onFloor, onAttention?): 003 adds the third
│   │                            #      argument; it is optional, so 001's and 002's call sites compile unchanged
│   └── desk/
│       ├── Desk.tsx             # US4: fetch /api/floor, subscribe /api/events, fixed section order
│       ├── AttentionStrip.tsx   # US4
│       ├── AttentionItem.tsx    # US4
│       ├── timeLeft.ts          # US4: timeLeft(expiresAt, referenceInstant)
│       ├── EpicRow.tsx          # US4: timeline row + readouts + node line
│       ├── MilestoneBar.tsx     # US4: furthest-behind rule
│       ├── NodeChevron.tsx      # US4: eleven states + paged + undeclared
│       ├── HealthStrip.tsx      # US4
│       ├── healthCounts.ts      # US4
│       ├── SpendStrip.tsx       # US4
│       ├── DegradedWell.tsx     # US4: transport vs refusal wording
│       └── floorSummary.ts      # US4: quiet-floor vs unreachable-floor classification
└── tests/
    ├── unit/
    │   ├── tokens.test.ts       # US1
    │   ├── App.test.tsx         # US1
    │   ├── events.test.ts       # US3
    │   ├── timeLeft.test.ts     # US4
    │   ├── NodeChevron.test.tsx # US4
    │   ├── HealthStrip.test.tsx # US4
    │   ├── SpendStrip.test.tsx  # US4
    │   ├── Desk.test.tsx        # US4
    │   └── noVerb.test.ts       # US4: write-control sweep over web/src/desk
    └── smoke/
        ├── shell.spec.ts        # US1: page loads; fonts.css linked; no remote stylesheet
        └── desk.spec.ts         # US4: DOM order, time left, spend label, degraded notices, zero non-GET
```

**Structure Decision**: two package worlds in one repository, as D-006 accepted —
`pane/` is a plain importable package (no build backend) and `web/` is a standard
Vite app. The backend serves the built frontend so that production, the demo, and
the smoke gate are one shape (R-006). Tests live beside their world (`tests/` for
pytest, `web/tests/` for vitest and Playwright) so each gate's command finds its
own and nothing else.

## The reader seam and the floor document

```text
            LiveReader (US3)                 FixtureReader (US2)
   collect_floor · epic_status query ·      fixtures/** + *.envelope.json
   open_escalations · rollup/open_readonly  SCENES · PANE_DEMO_TRANSPORT_FAIL
   list_findings/connect_readonly · files
                 \                              /
                  \   raises TransportFailed / QueryRefused
                   \                          /
              assemble_floor_document(reader, reference_instant)   ← one code path
                               |
          {floor, epics, attention, health, spend_to_date, degraded, reference_instant}
                    /                         \
          GET /api/floor                 GET /api/events  → {type: "floor", data}
```

The contract is written once in [contracts/floor-document.md](./contracts/floor-document.md)
and mirrored once in `web/src/api/floorDocument.ts`. Rules the assembly enforces:

- `running epics` come from `FloorRead.running` (live: projected from
  `floor.epics`; demo: the scene table — R-003). For each, `workflow_id` is
  `factory.cli.nouns.build.workflow_id(epic_id)` (`epic-<epic_id>`), the
  `epic_status` read uses that id (US3-S5), and the workgraph read uses the epic id.
- A node's card is the workgraph node joined with `status.nodes[id]`; every live
  field defaults (`state: "unknown"`, `attempt: null`, `awaiting_operator: false`,
  `landing_state: null`, `persona` falls back to the workgraph's). A status node
  the workgraph does not declare becomes a card with `declared: false` and
  workgraph fields `null` (FR-026). Assembly never raises on a missing key.
- Each read that fails appends exactly one `degraded` entry with `mode` in
  `{"transport", "refusal"}`; the section it belongs to is still present with its
  `seam` and `data: null`. Healthy sections are untouched by a neighbour's failure.
- `spend_to_date.data` is the rollup verbatim; NULL is JSON `null` and is never
  coerced. No key, label, or string in the document contains the word "live".
- `reference_instant` is ISO-8601 UTC or `null` (R-008).

## Demo mode

`PANE_DEMO=1` selects `FixtureReader(root=PANE_FIXTURES_ROOT or <repo>/fixtures)`.
The loader reads every document through the layout `fixtures/README.md` fixes:

| Read | Fixture | Failure mapping |
|---|---|---|
| `read_floor()` | `fixtures/floor/floor-live.json` (running list from `SCENES` ∪ its `epics`) | missing/pending → `TransportFailed("floor")` |
| `epic_status(workflow_id)` | the scene's document under `fixtures/epic-status/**/` (tasks.md T023 names each) | a `refusal` key → `QueryRefused(doc["refusal"])`; missing → `TransportFailed` |
| `workgraph(ref)` | `fixtures/workgraphs/<ref>.json` — only `002-expense-notes.json` is reachable this way: it is the polled scene's own graph and, per its envelope's `pair_with`, the skew scene's | **no recorded graph for the landing, paged, question and refusal scenes** → the read of the absent `fixtures/workgraphs/<epic_id>.json` raises the loader's missing-document `TransportFailed`, one `degraded` entry per scene, and those scenes' nodes render `declared: false` |
| `open_escalations()` | `fixtures/escalations/open_escalations.json` | missing/pending → `TransportFailed("attention")` |
| `stored_questions()` | `fixtures/webhook/question.json` — the one recorded Question payload, which carries no expiry (003 replaces this source with the questions store) | missing → `[]` plus a transport entry |
| `list_findings()` | `fixtures/doctor/findings.json` | missing/pending → `TransportFailed("health")` |
| `rollup()` | `fixtures/usage/rollup-by-persona.json` | missing/pending → `TransportFailed("spend")` |

**The demo floor is degraded by construction, and that is the point.**
`fixtures/workgraphs/` holds exactly three graphs (`001-trip-expenses`,
`002-expense-notes`, `077-a-scanner-the-operator-chooses-runs-in-the-loop`); four
of the six staged scenes have none, because a scene provoked through the harness
never had a `workgraph.json` to record. Constitution V forbids inventing one and
constitution III requires the missing read to be said out loud, so a clean
`PANE_DEMO=1` run carries five `degraded` entries — one transport entry per
scene with no recorded graph (landing, paged, question, refusal) plus the refusal
scene's own `epic_status` refusal entry — and no test may assert `degraded == []`.

`fixtures/floor/floor-quiet.json` is not served by the demo route; it is loaded
directly by tests (FR-025). The webhook Escalation and Notice payloads, the stored
Question documents under `fixtures/questions/`, and the bridge rulings are
validated by US2's shape tests and left for 003. `PANE_DEMO_TRANSPORT_FAIL`
(R-004) is honoured only when `PANE_DEMO=1`.

## Gates, per story

| Gate | US1 proves | US2 proves | US3 proves | US4 proves |
|---|---|---|---|---|
| `uv run pytest -q` | scaffold facts (S1–S5) | shapes, loader, sweep (S1–S6) | document, degraded, events, sweeps, auth (S1–S7) | assembly half of S10 |
| `typecheck` | strict compiles | — | `floorDocument.ts`, `events.ts` | every Desk module |
| `test:unit` | tokens, masthead | — | unknown SSE types ignored | S2, S3, S4, S5, S6, S9, S10, S8 sweep |
| `test:smoke` | shell + fonts | — | — | S1, S6, S7, S8 |

Each gate has at least one committed test from US1 onward, so a fresh checkout is
green after `uv sync && npm ci --prefix web` at every story boundary.

## Story design notes

**US1 — the scaffold.** Creates both worlds and nothing the later stories must
undo. `pane/app.py` exposes `app = create_app()` with the SPA catch-all only;
`web/` is a Vite React app whose `index.html` links `/fonts/fonts.css` and whose
`tokens.css` transcribes DESIGN.md's frontmatter (keeping the comp's CSS names,
including `--orange`/`--orange-ink` for clay). The masthead (DESIGN.md § Layout,
§ Navigation) is the one thing rendered: the mark, Desk / Showfloor nav, a floor
line placeholder. The committed tests are real: pytest reads `ergane.yaml`,
`package.json`, `tsconfig.json`, `playwright.config.ts`, the two manifests, and
the README; vitest asserts the tokens file and the masthead; Playwright loads the
page headless and asserts the stylesheet set.

**US2 — the Fixture floor.** Adds `readers.py` (protocol + errors),
`fixture_floor.py` (envelopes, scenes, reference instant), the first
`floor_document.py`, `config.py`, and `GET /api/floor`. Shape tests validate each
recorded document against ergane's contracts by importing ergane's own types
(`factory.workgraph.models.WorkNode`, `NodeState`, `factory.doctor.models.Finding`)
where they exist and by field assertions where the contract is a JSON shape. The
credential sweep covers every byte under `fixtures/`. The one README edit is
**additive**: a new section documenting the scene table, the scene→workgraph
pairing, and the loader's missing-document rule. `fixtures/README.md`'s layout
table and its Re-recording block already match the committed tree and are not
rewritten. **No payload is added or
modified**; a test asserts `git` sees no change under `fixtures/**/*.json` other
than `README.md` is not possible from inside a diff, so the tasks forbid it in words
and the judge reads the diff.

**US3 — backend reads.** Adds `LiveReader`, the degraded-mode proofs, partial-answer
defaults, `events.py` + `GET /api/events`, `auth.py` and the guarded router, the
read-only sweep, and the frontend's typed SSE consumer (FR-016 binds the consumer
too). The live reader opens Temporal through `factory.cli.nouns._open_client()`,
queries `EpicWorkflow.epic_status` on `workflow_id(epic_id)`, and resolves stores
through ergane's resolvers — never a literal path, never a subprocess.

**US4 — the Desk.** Renders the document in DESIGN.md's order: attention strip
(T-minus clocks, rank stripes, kind word), the floor (one timeline row per epic
with the milestone bar tracking the furthest-behind open story, readouts, node
chevrons), a degraded well per refused epic, then Health | Spend. Every state is a
glyph plus a caption; the paged-while-verifying case keeps VERIFYING and adds the
clay ring and the word "paged"; an undeclared node is a card captioned "undeclared";
NULL is the italic word "unknown"; a quiet floor is a sentence; a transport failure
and a refusal are two different wells. Nothing is pressable.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

No violations. The one deliberate carve-out — the auth seam shipped open — is
recorded by D-010 §5 and FR-017, not introduced here.
