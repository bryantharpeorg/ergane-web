---
state: ready
# Drafted 2026-08-21 by an operator-session interview; see docs/decisions.md
# (D-001…D-009 are that interview's record; every decision cited below is one of
# its entries).
#
# WHY THIS SPEC IS FIRST. D-008 ordered milestone one as a tracer bullet: before
# any spectacle and before any verb, something real on screen, fed by the
# factory's real seams, in a repository the factory itself can build (D-003).
# This spec is that bullet. It makes the four gates in ergane.yaml exist and
# pass (the repo is DRAFT until they do), records the Fixture floor both later
# epics' gates replay, stands up the library-backed backend D-005 decided on,
# and renders a read-only Desk. The Showfloor is 002; the Answer verb and the
# token are 003; both declare `depends_on_landed` on this spec in their
# frontmatter — the roadmap's cross-spec edge. (Merge-edge is a node-level
# word; a spec waits on another spec as *landed*.)
#
# WHY THE FIXTURE FLOOR IS HERE AND NOT LATER. D-008 again: 002's Playwright
# gate needs a floor to stage and 003's needs attention to answer, and neither
# can require a live factory inside a gate (constitution IV — every gate runs
# headless). The fixture floor is also the demo mode: the pane must be showable
# with no factory behind it, and the pane must not be able to tell (CONTEXT.md,
# "Fixture floor").
#
# WHAT THIS SPEC DELIBERATELY DOES NOT BUILD. No write of any kind — not even
# the webhook intake (003 owns it, with the token, per D-001's one-verb rule).
# No DAG staging (D-004 is 002's charter). No live in-flight spend: the factory
# records spend at attempt teardown and nowhere else, so the only honest number
# is spend to date, and this spec says so in its requirements.
#
# EVERY SCENARIO BELOW IS SCORED FROM THE DIFF. Constitution IV, inherited from
# ergane's constitution VIII via D-003: the judge sees the diff and these
# criteria, never a screen. A scenario only an eye could score was rewritten
# until a committed test could score it instead.
---

# Feature Specification: the desk sees the floor

## Context

The factory already answers the operator's morning question on the terminal:
`ergane status` renders the floor in one screen (ergane spec 046). What it
cannot do is sit on a second monitor and stay current, show a paged node the
moment `awaiting_operator` flips, or put the floor in front of someone without
a shell. That is the Pane's job — and before the Pane can carry its one verb or
stage its spectacle, it has to prove the boring half: that it can see the floor
at all, degrade honestly when it cannot (constitution III), and be built and
gated by the factory it watches.

Four stories, strictly ordered. A scaffold that makes the declared gates real; a
recorded Fixture floor; a backend that reads through ergane's own seams; a Desk
that renders what it read. Nothing here writes anything.

## User Scenarios & Testing

**Evidence rule for every scenario in this spec**: the judge is given the diff
and these criteria — never a terminal, never a screen (constitution IV).
"Proven by a committed test" means a test in the diff that one of the four
`ergane.yaml` gates runs headless.

### User Story 1 - The declared gates exist and pass (Priority: P1)

As the factory dispatching a node against this repository, I read
`ergane.yaml`, run its four gate commands in a fresh checkout after the
documented setup, and all four exit 0 — because the two package worlds those
commands assume (`pane/` under `uv`, `web/` under `npm`) now exist.

**Why this priority**: `ergane.yaml` is a promise the repository does not yet
keep — a gate whose command is not installed is a FAIL, not a skip. Until this
story lands, no other story in any spec can be verified at all.

**Independent Test**: fresh clone, run the documented setup (`uv sync` —
resolving `ergane-cli` from the pinned source `pyproject.toml` names — and
`npm ci --prefix web`), then the four gate commands verbatim from
`ergane.yaml`; all exit 0.

**Acceptance Scenarios**:

1. **Given** a fresh checkout containing this diff, **When** `uv sync` and
   `npm ci --prefix web` have run, **Then** `uv run pytest -q`,
   `npm --prefix web run typecheck`, `npm --prefix web run test:unit`, and
   `npm --prefix web run test:smoke` all exit 0 — each gate runs at least one
   real committed test, none exits 0 by matching nothing.
2. **Given** the diff, **When** `web/tsconfig.json` and `web/package.json` are
   read, **Then** the compiler runs with `strict: true` and the `typecheck`
   script is `tsc --noEmit` — decidable from the committed files alone.
3. **Given** the smoke gate, **When** `npm --prefix web run test:smoke` runs,
   **Then** Playwright launches headless — the committed Playwright config
   declares it, and no gate opens a headed browser or waits on a human.
4. **Given** the diff's `pyproject.toml` and `web/package.json`, **When** their
   direct dependency lists are read, **Then** every entry is on the
   constitution VII approved list or among FR-005's named toolchain additions
   — the sweep reads the two manifests, never the lockfiles, which record
   transitive resolution and are exempt.
5. **Given** a reader with a fresh clone, **When** they open the repository
   README, **Then** the setup commands (`uv sync`, `npm ci --prefix web`) and
   the four gate commands are documented verbatim — decidable from the diff.

---

### User Story 2 - The Fixture floor is recorded (Priority: P1)

As a gate (this spec's, 002's, or 003's), I replay a recorded set of real
factory documents — a floor, a workgraph, live epic state, attention, webhook
payloads — through the same code paths live data uses, so a pane that renders
the Fixture floor correctly renders the real floor correctly.

**Why this priority**: every later scenario in this spec, and both later
epics' gates, replay this fixture set (D-008). Recorded, never invented
(constitution V): a hand-invented shape produces a pane that renders the
fixture and not the factory. Because a sandboxed attempt has no floor to
record from, the recorded payloads are committed with this spec before it is
readied (see Assumptions); this story's diff carries the loader, envelope,
tests, and README — never a new payload — so recorded-vs-invented is
decidable from history instead of trust.

**Independent Test**: the committed shape tests validate every fixture document
against ergane's published contracts, and the backend started with the demo
flag serves the whole Fixture floor with no factory present.

**Acceptance Scenarios**:

1. **Given** the diff, **When** the `fixtures/` directory is read, **Then** it
   contains at least: one FloorStatus document (the `ergane status --json`
   shape, per `factory.cli.status.collect_floor`); one empty-floor
   FloorStatus variant (no epics, an empty queue); one `workgraph.json`; one
   set of `epic_status` answers for that workgraph's epic; one additional
   `epic_status` variant recorded as a query refusal (degraded); open
   Escalation documents (the `open_escalations` shape); and two webhook
   payloads — one Question, one Escalation — plus a `fixtures/README.md`
   naming when and from which floor each document was recorded and how to
   re-record it.
2. **Given** the committed shape tests, **When** `uv run pytest -q` runs,
   **Then** every fixture document validates against its ergane contract:
   workgraph nodes carry `id`, `story_key`, `persona`, `spec_ref`,
   `requirement_keys`, `depends_on`, `depends_on_merged`,
   `timeout_override_s` (ergane specs/005-workgraph-interpreter/contracts/
   workgraph-schema.md, plus `depends_on_merged` per ergane
   specs/007-parallel-dispatch — the 005 contract predates merge edges, and
   `factory.workgraph.models.WorkNode` carries the assembled shape); every
   `epic_status` node state is one of the eleven (PENDING, KEY_ISSUED,
   RUNNING, VERIFYING, PASSED, PR_OPEN, ENQUEUED, MERGED, FAILED, KILLED,
   WAITING_OPERATOR); the Question payload's `actions` list is empty — the
   key is always present, the transport emits it unconditionally; the
   Escalation payload's action payloads match `esc:<12 hex>:<CHOICE>` and its
   `correlation_id` is 12 hex.
3. **Given** the recorded `epic_status` answers, **When** the shape tests run,
   **Then** at least one node has `awaiting_operator` true while its `state`
   reads VERIFYING — the paged-while-verifying case that a naive renderer
   drops — proven by a committed test asserting the fixture contains it.
4. **Given** the backend started with the demo-mode env flag (`PANE_DEMO=1`)
   on a host with no factory checkout, no Temporal, and no factory database,
   **When** its endpoints are exercised, **Then** the entire Fixture floor is
   served — proven by a committed test that sets the flag and touches nothing
   outside the repository.
5. **Given** the loader, **When** demo mode substitutes fixtures for live
   reads, **Then** the substitution happens only at the outermost reader seam
   — the functions standing in for `collect_floor`, the `epic_status` query,
   `open_escalations`, `rollup`, and `list_findings` — and the floor-document
   assembly downstream of that seam is one code path exercised by both modes,
   proven by a committed test that runs the same assembly against both a
   fixture-backed reader and a stub live reader.
6. **Given** every file under `fixtures/`, **When** the committed credential
   sweep runs, **Then** no fixture contains a credential value — no bearer
   token, no key material, no value of any `*_TOKEN`/`*_KEY` environment
   variable (constitution VI) — proven by that sweep test.

---

### User Story 3 - The backend reads the floor through ergane's seams (Priority: P1)

As the Desk (and later the Showfloor), I fetch one floor document from the
backend and subscribe to one event stream, and everything in them was read
through a function the ergane distribution exports — never a shelled CLI, never
re-derived state — and every read that failed says so as a named fact instead
of an empty section.

**Why this priority**: D-005 is the load-bearing decision of the whole pane —
reads ride ergane's seams or the pane re-derives "ready" and inherits the
defect class ergane's spec 046 names. And constitution III makes honest
degradation the pane's one job: a beautiful floor that lies when unreachable
has failed.

**Independent Test**: in demo mode, the floor-document endpoint returns one
JSON document carrying floor, epics, attention, health, and spend to date; the
degraded fixtures surface as two distinct failure modes; the SSE endpoint
yields events headless.

**Acceptance Scenarios**:

1. **Given** demo mode, **When** the floor-document endpoint is fetched,
   **Then** it returns one JSON document with sections for: the floor (the
   FloorStatus shape from `factory.cli.status.collect_floor`); epics — each
   running epic's `workgraph.json` nodes joined with its `epic_status` answer
   (state, attempt, persona, `awaiting_operator`, landing_state); attention
   (open Escalations from `factory.escalation.client.open_escalations` plus
   stored Question documents as FR-013 defines them — in this spec, the
   Fixture floor's recorded Question payloads); health (findings from
   `factory.doctor.store.connect_readonly` + `list_findings`); and spend to
   date (`factory.usage.ledger.rollup` over
   `factory.usage.cli.open_readonly`) — proven by a committed test asserting
   the document's sections and their provenance seams.
2. **Given** a reader that fails with a transport error and a reader whose
   query is refused (the recorded refusal fixture), **When** the floor
   document is assembled, **Then** each produces a degraded entry naming the
   section that could not be learned and which of the two modes failed it —
   transport failure and query refusal are two different facts (ergane spec
   052) — proven by one committed test per mode asserting the two entries
   differ.
3. **Given** an `epic_status` answer missing keys (a partial answer), **When**
   the floor document is assembled, **Then** assembly does not raise, every
   missing field takes its default, and no absent value is rendered as zero —
   unmeasured is unknown — proven by a committed test that deletes keys from a
   recorded answer and asserts the document.
4. **Given** a ledger rollup containing NULL (unmeasured), **When** the floor
   document is assembled, **Then** the spend-to-date section carries unknown
   for that value, distinct from `0`, and the document labels the section
   `spend_to_date` — no field, key, or label in the document says "live" —
   proven by a committed test.
5. **Given** demo mode, **When** a client subscribes to the SSE endpoint,
   **Then** it receives at least one floor event per poll cycle, and the poll
   loop queries `epic_status` on workflow id `epic-<epic_id>` for each running
   epic — proven by a committed test that consumes one event headless and by a
   committed test of the poll loop against the fixture-backed reader.
6. **Given** the backend source, **When** the committed read-only sweep runs,
   **Then** no code path shells the `ergane` CLI (in particular, never
   `ergane doctor`, which writes and has no `--json`), the doctor store is
   opened only via `connect_readonly`, and the ledger only via
   `open_readonly` — proven by that sweep plus unit tests of the reader
   modules.
7. **Given** every route in the backend, **When** the app's route table is
   inspected by a committed test, **Then** each route is mounted behind one
   shared auth dependency whose 001 implementation admits every request — the
   single seam spec 003's token will occupy — proven by that test.

---

### User Story 4 - The Desk renders the floor, read-only (Priority: P2)

As an operator glancing at the Desk, I see what is waiting on me first — every
Attention item with its time left — then the floor's detail (epics and their
nodes), a health strip, and spend to date. Where a read degraded, the section
says so in place. Nothing on the Desk can be pressed to write.

**Why this priority**: P2 only because it consumes the three P1 stories; it is
the story that puts something real on screen, which is the tracer bullet's
point (D-008). The Desk ranks attention above everything else because that is
what a Desk is for (D-002, CONTEXT.md).

**Independent Test**: the Playwright smoke drives the full stack in demo mode
against the Fixture floor and asserts DOM order, node detail, degraded notices,
the spend label, and the absence of any write.

**Acceptance Scenarios**:

1. **Given** the Fixture floor in demo mode, **When** the Desk route loads in
   the headless Playwright smoke, **Then** every Attention item renders before
   any floor detail in DOM order, and each item names its kind and — where
   the factory supplied an `expires_at` — its time left, computed against
   demo mode's pinned reference instant (the fixture envelope's capture
   instant, per FR-019) so the assertion holds on any run date; a recorded
   Question webhook payload carries no expiry, so it shows no deadline rather
   than a minted one — 003's questions-store read supplies the factory-written
   value — proven by committed Playwright assertions.
2. **Given** an Escalation whose `expires_at` precedes the reference instant
   but whose `resolution` is empty, **When** the Desk renders it, **Then** it
   reads expired — never a negative duration — proven by a committed unit
   test of the time-left rendering fed a reference instant past `expires_at`.
3. **Given** the fixture epic, **When** floor detail renders, **Then** each
   node shows its state, attempt, and Persona, and the state component renders
   all eleven node states distinctly — proven by a committed unit test that
   feeds it each of the eleven and asserts eleven distinct renderings.
4. **Given** the fixture node whose `awaiting_operator` is true while its
   state reads VERIFYING, **When** it renders, **Then** the node is marked as
   waiting on the operator — the derived flag wins over the raw state for the
   waiting marker — proven by a committed unit test.
5. **Given** the fixture findings, **When** the health strip renders, **Then**
   it counts open and regressed findings by severity (critical, warning,
   info) — regressed is an active problem that has returned, and ergane's
   doctor triages open and regressed together — and counts no promoted or
   resolved finding — proven by a committed unit test covering all four
   statuses.
6. **Given** the fixture rollup with its NULL value, **When** the
   spend strip renders, **Then** its label contains the exact text
   "spend to date", the unmeasured value renders as unknown — never `0`, never
   a currency zero — and the word "live" appears nowhere in the strip — proven
   by committed unit and Playwright assertions.
7. **Given** the recorded refusal fixture, **When** the Desk renders, **Then**
   the affected section carries an in-section notice naming what could not be
   learned and which failure mode, the notice for a transport failure differs
   from the notice for a refusal, and every healthy section still renders —
   proven by committed Playwright assertions against both degraded fixtures.
8. **Given** the entire Desk smoke run, **When** it completes, **Then** the
   browser issued zero non-GET requests, and a committed sweep finds no form
   submission and no write-issuing control in the Desk's source — the Desk
   carries no verb; Answer is spec 003's, and only on the seams D-001 names —
   proven by a committed Playwright network assertion plus the sweep.
9. **Given** the empty-floor fixture (a floor document whose FloorStatus
   section has no epics and an empty queue, and whose attention section is
   empty) and an unreachable floor (a transport-failed floor read), **When**
   each renders, **Then** the two renderings differ — an empty floor reads as
   an empty floor, an unreachable floor as a degraded read — proven by a
   committed test asserting the two renderings differ (FR-025).
10. **Given** an `epic_status` answer naming a node id absent from that
    epic's `workgraph.json`, **When** the floor document assembles and the
    Desk renders, **Then** the node appears as a card marked undeclared —
    never a crash, never silently dropped — proven by a committed unit test
    (FR-026).

---

### Edge Cases

- An *empty floor* and an *unreachable floor* are two different facts and
  never share a rendering (FR-025).
- Drift between `workgraph.json` and a run — a node the answer names but the
  file does not declare — renders anyway, marked undeclared (FR-026).
- The doctor or ledger store absent on a live host (the resolved runtime
  root holds no `doctor.db` or `ledger.db` yet): the spend or health section
  degrades in-section as a transport-mode fact; the rest of the Desk renders.
- The SSE client disconnects and reconnects: the next event is a full floor
  snapshot, so a reconnecting Desk never renders a stale diff against a floor
  it no longer has.

## Requirements

### Functional Requirements

**Scaffold (US1)**

- **FR-001**: The repository MUST contain two package worlds: a `pane/` Python
  package exposing a FastAPI application, owned by `uv`, and a `web/`
  Vite/React/TypeScript application, owned by `npm`.
- **FR-002**: After documented setup (`uv sync`, `npm ci --prefix web`) in a
  fresh checkout, all four `ergane.yaml` gate commands MUST exit 0, and each
  MUST execute at least one committed test. `ergane.yaml` declares schema
  `version: 2` — v1 fixes the gate names to `test`/`lint`/`typecheck` and
  refuses `unit` and `smoke` as CONFIG_ERROR (ergane
  specs/002-verification-gating) — and `web/package.json` MUST run
  `playwright install chromium` in a `postinstall` script, so `npm ci
  --prefix web` alone leaves the smoke gate runnable with no third setup
  command.
- **FR-003**: TypeScript MUST compile under `strict: true`, and the
  `typecheck` gate MUST be `tsc --noEmit`.
- **FR-004**: The smoke gate MUST run Playwright headless; no gate may open a
  headed browser or require a human.
- **FR-005**: Every direct dependency declared in `pyproject.toml` and
  `web/package.json` MUST be on the constitution VII approved list or among
  the toolchain additions this spec approves: `@types/react` and
  `@types/react-dom` (a `@types/*` declaration package rides the approval of
  its runtime package — `react` ships no types, and strict `tsc --noEmit`
  cannot pass without them), `@vitejs/plugin-react`, and `jsdom` if the unit
  tests need a DOM. The operator's readying of this spec is the constitution
  VII approval act for these additions. Lockfiles (`uv.lock`,
  `web/package-lock.json`) record transitive resolution and are exempt from
  the sweep.
- **FR-006**: The README MUST document the setup and gate commands verbatim.

**Fixture floor (US2)**

- **FR-007**: A `fixtures/` directory at the repository root MUST contain, at
  minimum — one capture serving all three epics, so later specs replay this
  set rather than re-record: one FloorStatus document; one empty-floor
  FloorStatus variant (no epics, an empty queue); `workgraph.json` files for
  at least two epics whose graphs jointly carry both edge kinds and a
  same-rank node pair (002 stages them); `epic_status` answers for those
  epics including one query-refusal variant, one node with
  `awaiting_operator` true while state reads VERIFYING, nodes covering the
  landing run (PASSED, PR_OPEN, ENQUEUED, MERGED), and one answer naming a
  node id its `workgraph.json` does not declare (FR-026); open Escalation
  documents including one whose `expires_at` differs from its send time plus
  3600 seconds (003's countdown anchor); one stored Question document from
  the factory's questions store carrying its factory-written `expires_at`
  (003's questions-store read); and recorded webhook payloads — one Question
  whose `actions` list is empty, one Escalation whose action payloads match
  `esc:<12 hex>:<CHOICE>`, and one actionless supervision or roadmap payload
  with a non-12-hex correlation id (003's Notice). The recorded payloads are
  committed before this spec is readied (see Assumptions); US2's diff adds
  the loader, envelope, tests, and README, never a payload.
- **FR-008**: Every fixture shape MUST follow ergane's published contracts
  (FloorStatus per `factory.cli.status.collect_floor` / `ergane status
  --json`; the workgraph schema at ergane
  specs/005-workgraph-interpreter/contracts/workgraph-schema.md, with
  `depends_on_merged` per ergane specs/007-parallel-dispatch — the 005
  contract predates merge edges, and `factory.workgraph.models.WorkNode`
  carries the assembled shape; `epic_status`/NodeStatus; `open_escalations`;
  the webhook payload of `factory/notify/webhook.py`), enforced by committed
  shape tests. When a contract gains a field, the fixture is re-recorded,
  never hand-edited.
- **FR-009**: Capture provenance and envelope metadata (the capture instant,
  source floor, a Question document's arrival time) MUST live beside the
  recorded payloads, never inside them.
- **FR-010**: A loader MUST serve the Fixture floor through the same
  floor-document assembly live reads use, substituting only at the outermost
  reader seam.
- **FR-011**: With the demo-mode env flag `PANE_DEMO=1`, the backend MUST
  serve the entire Fixture floor with no factory checkout, no Temporal, and
  no factory database present.
- **FR-012**: No fixture may contain a credential value; a committed sweep
  test MUST enforce this.

**Backend reads (US3)**

- **FR-013**: The backend MUST expose a floor-document endpoint assembling,
  via library import: the floor from `factory.cli.status.collect_floor`;
  per-epic live state from the Temporal query `epic_status` on workflow id
  `epic-<epic_id>`, joined onto that epic's `workgraph.json` nodes; attention
  from `factory.escalation.client.open_escalations` plus stored Question
  documents — which in this spec means the Fixture floor's recorded Question
  payloads served by the loader; the live pane-side Question store arrives
  with 003's webhook intake (see Assumptions); health from
  `factory.doctor.store.connect_readonly` + `list_findings`; spend to date
  from `factory.usage.ledger.rollup` over `factory.usage.cli.open_readonly`.
  Store paths MUST be resolved through ergane's own resolvers (the doctor
  store via factory.doctor's runtime-root resolution — `.ergane/doctor.db`,
  legacy `.factory/doctor.db` — and the ledger via the `ERGANE_LEDGER_PATH`
  chain), never hard-coded literal paths.
- **FR-014**: The backend MUST NOT shell the `ergane` CLI for any read, and
  MUST NOT invoke `ergane doctor` under any circumstances.
- **FR-015**: The 052 doctrine binds every read: transport failure and query
  refusal MUST be recorded as two distinct degraded modes naming the section
  they failed; any answer may be partial; every boundary field has a default;
  a missing key MUST never crash assembly; a value the factory did not record
  MUST surface as unknown, never zero.
- **FR-016**: The backend MUST expose an SSE endpoint whose events are typed —
  a committed envelope of `{type, data}` — and this spec defines exactly one
  type: `floor`, a full floor snapshot per poll cycle. This FR owns the event
  vocabulary: later specs add types only by extension (003 declares
  `attention`), and a consumer MUST ignore event types it does not know. The
  poll interval MUST be configurable by env with a committed default.
- **FR-017**: Every route MUST mount behind one shared auth dependency whose
  001 implementation admits every request — the single seam spec 003's token
  occupies. No second auth path may exist. This is a deliberate, dated
  interim against constitution VI's every-route token: the seam is
  introduced open in 001 and closed by 003 before any deployment (D-007);
  the operator's readying of this spec records the carve-out.
- **FR-018**: The backend MUST hold no factory state of its own and MUST open
  every factory store read-only; it performs no write in this spec.

**Desk (US4)**

- **FR-019**: The Desk route MUST render Attention items before any floor
  detail in DOM order, each naming its kind. Time left MUST come only from a
  factory-supplied `expires_at` — never from receipt-time arithmetic — and an
  item the factory has not supplied one for shows no deadline rather than a
  minted one (in this spec that is every recorded Question payload; 003's
  questions-store read supplies factory expiries, and its Notice kind never
  carries one). An expired-but-unresolved item reads expired, never a
  negative duration. Time left MUST be computed against an injectable
  reference instant — in demo mode defaulting to the fixture envelope's
  capture instant, live against the wall clock — so every committed assertion
  about time left is deterministic on any run date.
- **FR-020**: Floor detail MUST render epics and their nodes; a node MUST
  show state, attempt, and Persona; all eleven node states (PENDING,
  KEY_ISSUED, RUNNING, VERIFYING, PASSED, PR_OPEN, ENQUEUED, MERGED, FAILED,
  KILLED, WAITING_OPERATOR) MUST render distinctly; `awaiting_operator` true
  MUST mark a node as waiting on the operator regardless of raw state.
- **FR-021**: The health strip MUST count open and regressed findings by
  severity (critical, warning, info) — a regressed finding is an active
  problem that has returned, and ergane's doctor triages open and regressed
  together — and MUST NOT count promoted or resolved findings.
- **FR-022**: The spend strip MUST be labeled with the exact text
  "spend to date"; NULL/unmeasured MUST render as unknown, never zero; the
  word "live" MUST NOT label spend anywhere in the pane.
- **FR-023**: A degraded read MUST render in-section, naming what could not
  be learned and which failure mode, with transport failure and query refusal
  visually distinct; healthy sections MUST still render.
- **FR-024**: The Desk MUST carry no verb: no control that issues a write,
  and no non-GET request from the Desk route — asserted by a committed test.
- **FR-025**: An empty floor and an unreachable floor MUST never share a
  rendering: a floor document whose FloorStatus section has no epics and an
  empty queue, and whose attention section is empty, renders as an *empty
  floor*; a floor whose read degraded renders the degraded notice (FR-023);
  a committed test MUST assert the two renderings differ.
- **FR-026**: An `epic_status` answer naming a node id absent from that
  epic's `workgraph.json` (drift between file and run) MUST survive
  floor-document assembly and render as a node card marked undeclared —
  never a crash, never silently dropped — enforced by a committed unit test.

### Key Entities

- **Floor document**: the pane's one read — the backend-assembled JSON joining
  floor, epics (workgraph nodes + live state), attention, health, and spend to
  date, with a degraded list naming every read that failed and how. The Desk
  renders it; 002's Showfloor will render the same document.
- **Fixture floor**: the recorded document set under `fixtures/` plus its
  loader and the demo flag — evidence, not invention (CONTEXT.md); shapes are
  ergane's, provenance lives in the envelope.
- **Attention item**: one Question or Escalation — 003 adds the Notice kind —
  with its time left where the factory supplied an expiry; sourced from
  `open_escalations` and stored Question documents (in 001, the Fixture
  floor's recorded Question payloads — 003's intake fills the live store),
  ranked first on the Desk, resolved by nothing in this spec.
- **Node card**: one workgraph node joined with its live NodeStatus — state,
  attempt, Persona, waiting marker. The unit 002 will animate; here it only
  has to be true.
- **Borrowed shapes**: FloorStatus, NodeStatus, OpenEscalation, the webhook
  payload — owned by ergane's contracts. The pane renders them and never
  redefines them (constitution II, V).

## Success Criteria

### Measurable Outcomes

- **SC-001**: A fresh checkout plus the two documented setup commands yields
  four green gates — measured by the factory's own gate run against this
  spec's attempts, which is the same measurement.
- **SC-002**: The pane runs with the factory switched off: the smoke gate
  starts the backend with `PANE_DEMO=1` on a host with no factory checkout,
  no Temporal, and no factory database, and every Playwright assertion in
  US4 passes headless.
- **SC-003**: The two failure modes are two facts: the committed tests for
  transport failure and query refusal assert differing degraded entries at
  the document level and differing notices at the render level.
- **SC-004**: Unknown is never zero: committed tests show a NULL ledger value
  as unknown in the floor document and in the rendered strip, and assert the
  literal label "spend to date".
- **SC-005**: The Desk is verbless: the smoke's network log records zero
  non-GET requests across the full Desk run, and the write-control sweep
  finds nothing.
- **SC-006**: The fixtures are evidence: the recorded payloads were committed
  before this spec was readied, no attempt's diff adds or modifies a recorded
  payload, every shape test passes against them unmodified, and the
  credential sweep over `fixtures/` finds no credential value.

## Assumptions

- The pane's appearance is governed by `DESIGN.md` at the repository root
  (constitution VIII, D-012): tokens, faces (vendored under `web/public/fonts/`,
  which the scaffold keeps), the eleven-state glyph grammar, the attention ranking
  and the milestone bar. US1's scaffold links `web/public/fonts/fonts.css` and
  loads no remote stylesheet; US4's Desk renders to that document. A scenario here
  says *what* is shown; DESIGN.md says *how it looks*.
- The `ergane-cli` distribution is declared as a backend dependency
  (constitution VII approves it), resolved from a pinned source a fresh
  checkout can install — the PyPI release `ergane-cli==0.2.0`, pinned exactly
  in `pyproject.toml` and locked through `uv.lock` (D-011; the distribution
  was published 2026-08-22, so a bare name now resolves; a `[tool.uv.sources]`
  git reference commit-pinned through `uv.lock` is the fallback if a needed
  seam is newer than the release, and a local path breaks every checkout but
  the operator's) — and it exports the seams this spec names:
  `factory.cli.status.collect_floor`, the `epic_status`/`roadmap_status`
  queries, `factory.escalation.client.open_escalations`,
  `factory.usage.ledger.rollup` with `factory.usage.cli.open_readonly`, and
  `factory.doctor.store.connect_readonly` + `list_findings`. Gates never need
  a live factory: every test runs against the fixture-backed reader seam.
- Attempt sandboxes and CI runners have network egress at gate time: `uv sync`
  resolves `ergane-cli` from PyPI and `npm ci` fetches packages plus
  the Playwright chromium binary (FR-002). If the factory's sandbox denies
  egress, US1 cannot go green, and the operator must provide a cached or
  vendored channel before dispatch.
- The factory does durably store pending questions (the verify store's
  `questions` table, readable via `factory.verify.store.pending_questions`
  over `connect_readonly`), but this spec deliberately does not read it:
  live Questions reach the pane only via 003's webhook intake
  (`factory/notify/webhook.py` POSTs to `ERGANE_WEBHOOK_URL`; the factory
  has no inbound listener). In this spec, live attention is Escalations
  only, and the Desk renders that honestly; Question rendering is exercised
  through the Fixture floor, whose recorded payloads are what FR-013's
  "stored Question documents" names in 001.
- The fixture documents are captured from the sibling factory's floor and
  committed under `fixtures/` before this spec is readied — capture is an
  operator act at drafting time, not work a sandboxed attempt can perform;
  `fixtures/README.md` records the capture and re-capture procedure
  (constitution V).
- Deployment (systemd user unit on the factory host, D-007) is an operator
  act at wiring time, not a story in this spec; nothing here may assume more
  of the host than the demo mode needs.

## Out of Scope

- **The Showfloor** (spec 002) — no DAG staging, no React Flow usage, no
  animation. The floor document this spec builds is deliberately sufficient
  for 002 to render without new reads.
- **The Answer verb, the webhook intake, and the bearer token** (spec 003) —
  this spec leaves exactly one auth seam (FR-017) and builds no POST route,
  no settlement rendering, no identity handling.
- **Live in-flight spend** — it does not exist. The factory writes its ledger
  at attempt teardown; the pane's number is spend to date and this spec's
  wording is the contract for that label.
- **Any second write path** (D-001) — no pause, no dispatch, no spec editing,
  in this spec or any future one without a superseding decision entry.
- **Roadmap deep rendering** — the floor document carries what
  `collect_floor` returns; a richer roadmap view is a later spec's argument.

## Work Graph

```yaml
US1:
  depends_on: []
  implements: [FR-001, FR-002, FR-003, FR-004, FR-005, FR-006]
US2:
  depends_on: []
  depends_on_merged: [US1]
  implements: [FR-007, FR-008, FR-009, FR-010, FR-011, FR-012]
US3:
  depends_on: []
  depends_on_merged: [US2]
  implements: [FR-013, FR-014, FR-015, FR-016, FR-017, FR-018]
US4:
  depends_on: []
  depends_on_merged: [US3]
  implements: [FR-019, FR-020, FR-021, FR-022, FR-023, FR-024, FR-025, FR-026]
```

The chain is content, not contention: US2's loader and shape tests live in the
package US1 scaffolds, US3's endpoints are tested by replaying US2's fixtures,
and US4's smoke drives US3's backend in demo mode. A pass-edge would cut a
worktree from a base missing the code the story imports — the exact conflation
ergane's CONTEXT.md flags under "dependency" — so every edge is a merge-edge.
