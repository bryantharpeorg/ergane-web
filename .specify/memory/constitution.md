# Ergane Web Constitution

Ergane Web is the operator pane for an Ergane factory: one application, two rooms —
the Showfloor (spectacle) and the Desk (attention) — that renders the factory's
state and carries exactly one verb. It is built *by* the factory it watches. The
decision log lives in `docs/decisions.md` (D-001…D-009); this constitution distills
the non-negotiables that every spec, plan, and implementation in this repository
must honor. Factory-side standards for how agents work (test-first, salvage,
attribution) are ergane's constitution and are not repeated here.

## Core Principles

### I. A Glass With Few Verbs, Admitted By Test (NON-NEGOTIABLE)

The pane displays; the operator CLI acts. A write path exists only where this
principle names it, and a named write may be built only once it passes every clause
of the guard below (D-001, amended by D-021).

**The verbs.** **Answer** — resolving a Question or an Escalation through the
factory's existing answer seam. And the four **grooming writes**, each of which
touches a spec's own files and nothing else: **Create** a spec draft, **Commission**
its trio, **Save** an edit to that trio, **Declare** its state `ready` or `deferred`.

**The guard. Every clause, or the write is forbidden.**

1. **Seam.** The write rides a surface the ergane distribution exports (principle
   II). No exported seam, no write — and this clause is doing all the work today:
   `ergane spec` exports `list`, `validate`, `derive` and `landed`, and all four are
   read-only, so **not one of the four grooming writes is currently buildable**.
   Filed to ergane as PR-7.
2. **Named.** The write is one of the four above. A write this principle does not
   name is a defect in the requirement, not a gap in the principle.
3. **Scoped.** It touches `specs/` in the operator's own tree and nothing else.
   Never the factory's stores, never the runtime root, never a file the pane did not
   render for the operator first.
4. **Confirmed.** The operator sees the exact bytes that will be written, and
   confirms, in the room, before the write happens. No write is a side effect of
   navigation, of another write, or of a background refresh.
5. **Reported.** The pane renders what the seam returned — including a refusal —
   without softening it (principle III).
6. **Consequence stated.** A write that starts a factory says so on the control.
   Declaring a spec `ready` causes the roadmap to dispatch within 300 seconds: nodes
   that spend tokens, open pull requests and move the landing branch. That sentence,
   or its equivalent, is on screen before the operator confirms.

**Still forbidden, by name.** Dispatching an epic; killing, pausing or resetting a
workflow; resolving an escalation by any path but Answer; writing anywhere outside
`specs/`; and writing to any factory store. Pause buttons and dispatch forms remain
what D-001 called them.

**What this amendment is not.** It is not permission to write today. It replaces a
fixed list of forbidden writes with a test, so that the moment ergane exports an
authoring seam the pane can use it without amending the constitution again. Until
then clause 1 refuses all four verbs, and a room that needs one composes the change
and hands the operator the file to save.

### II. Borrowed Seams, Never Re-Derived Logic

Every read and every write rides a surface the ergane distribution already exports:
`collect_floor`, `open_escalations`, `rollup`, the doctor store's read-only reader,
the verify store's Question reader over `connect_readonly`, the Temporal queries
the factory's workflows answer (`epic_status`, `roadmap_status`,
`escalation_status`), `CallbackBridge.handle_relay`, the `escalation_resolved`
signal, and the verify store's evidence readers `node_history`, `attempt_timings`,
`pending_escalations` and `get_escalation` over `connect_readonly`, and the
roadmap's corpus reader `read_roadmap`, and the spec-corpus checkers
`derive_workgraph`, `check_slice_coverage` and `check_prompt_assembly` (list
amended by D-010, D-020, D-022 and D-025). Composing those
last three into a verdict is forbidden: `ergane spec validate` has no library form,
so a composed verdict is re-derived policy, not a borrowed seam (D-022).
Re-implementing
readiness, blockers, escalation listing, or answer settlement in this repository is
a defect by construction — ergane's spec 046 names the re-derivation of "ready" as
one, and D-005 extends that doctrine to every seam. Never shell `ergane doctor` from
the pane: it writes, and it has no `--json`.

### III. Every Read Degrades Honestly

Ergane's 052 doctrine is binding on this repository. Transport failure and query
refusal are two different failure modes and are rendered differently, in-section,
naming what could not be learned. Any Temporal answer may be partial; a missing key
never crashes a view; a value the factory did not record is shown as unknown, never
as zero — spend is **spend to date** (ledger-truth, written at teardown), and no
view may label it live. A pane that renders a beautiful floor and lies when the
floor is unreachable has failed at its one job.

### IV. Provable From the Diff, Checkable Headless (NON-NEGOTIABLE)

Inherited from ergane's constitution VIII and sharpened for a visual surface: every
acceptance criterion must be decidable by the judge from the diff alone, and every
gate must run headless. Visual behaviour is asserted through committed tests —
pytest, `tsc --noEmit`, vitest, Playwright against the fixture floor — never through
"looks right" or a screenshot a human must read. A criterion only an eye can score
is a defect in the spec, not in the agent that failed it.

**And the diff is not the tree** (D-014). The judge receives the requirement, its
scenarios, the previous attempt's feedback and the diff — not the gate results, and
not the base tree the diff applies to. Two consequences bind every scenario written
here. A scenario asserts what the diff **commits**, never what a command would **do**:
the gate rung measures the run, the judge scores the wiring, and a Then-clause of the
form "the command exits 0" asks the judge to simulate what it is forbidden to observe.
And where a scenario's subject depends on a file the diff does not touch, the scenario
says so in words — absent from the changed-file list reads to the judge as absent from
the repository. A criterion only a full checkout can score is the same defect as one
only an eye can score.

### V. Fixtures Are Recorded, Never Invented

The fixture floor is captured from real factory documents whose shapes come from
ergane's published contracts (`FloorStatus`, the workgraph schema, `epic_status`
answers, the webhook payload). Hand-inventing a shape because it is convenient
creates a pane that renders the fixture and not the factory. When a contract gains a
field, the fixture is re-recorded, not edited to taste.

### VI. The Token Guards Every Route; Identity Belongs to the Factory

Every route — the Showfloor included — sits behind the single shared bearer token
(D-007), with two recorded qualifications (D-010): the webhook intake route is
guarded by the credential carried in the operator-configured `ERGANE_WEBHOOK_URL`
instead, because the factory sends a bare POST with no headers; and spec 001 ships
its single auth seam open as a dated interim that spec 003 closes before any
deployment. The pane's token decides who can see; the factory's
`escalation.authorized_responders` decides whose answers count, and the pane renders
the factory's ruling — including UNAUTHORIZED, EXPIRED, and SIGNAL_FAILED — without
softening it. No credential value (token, intake credential, master key, virtual
key) may appear in a rendered page, an SSE event, a log line, or a committed
fixture.

### VII. Ask Before Adding Dependencies

No new dependency — package, service, or tool — is added without explicit operator
approval first. Approved to date, Python: `fastapi`, `uvicorn`, `sse-starlette`,
`httpx`, `pytest` (+`pytest-asyncio`), and the `ergane-cli` distribution itself.
Node: `react`, `react-dom`, `typescript`, `vite`, `@xyflow/react`,
`@dagrejs/dagre`, `framer-motion`, `vitest`, `@playwright/test`, and — ratified by
D-010 — `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, and `jsdom`
(the typings ride their runtime package's approval; strict `tsc` cannot pass
without them). TypeScript runs
`strict`; a looser compiler option is a new dependency in spirit and needs the same
approval.

### VIII. The Pane Is Built to DESIGN.md

`DESIGN.md` at the repository root is the pane's visual authority (D-012): tokens,
type, the eleven-state glyph grammar, the two edge strokes, the milestone bar, the
attention ranking, the motion rules. A diff that renders anything the operator sees
obeys it the way a diff that touches a seam obeys Principle II. What DESIGN.md
states is not a suggestion: a colour, face, or radius it does not name is a defect,
not a choice. State is never carried by colour alone. No cream or beige ground, no
red, no remote stylesheet or script — the three faces are vendored under
`web/public/fonts/` and loaded from there. Where a spec's scenario and DESIGN.md
disagree on an *appearance*, DESIGN.md wins; where they disagree on *what is
shown*, the spec wins.

## Environment Constraints

- The backend runs on the factory host as a systemd user unit: it needs the factory
  checkout's filesystem — stores resolved through ergane's own resolvers (runtime
  root `.ergane/`, legacy `.factory/`; the ledger via its env chain) and
  `specs/*/workgraph.json` — plus Temporal reachable, per D-007 (paths corrected by
  D-010).
- The factory's `ERGANE_WEBHOOK_URL` points at the backend; the factory has no
  inbound listener of its own, and the pane must never expect one.
- Two package worlds live in one repository: `uv` owns the backend, `npm` owns
  `web/`. Gates are declared in `ergane.yaml` and nowhere else.
- **A gate does not inherit the attempt's `HOME`.** Gates run inside the factory's
  sandbox with a fresh tmpfs `HOME`, distinct from the one the attempt worked in.
  The worktree persists into the gate; a cache warmed in `HOME` during the attempt
  does not. Anything a gate command needs must therefore live **inside the
  worktree** or be fetched by the gate command itself — the boundary does have
  network egress. Concretely, `playwright install` run during an attempt (or from a
  `postinstall` hook) puts the browser in `$HOME/.cache/ms-playwright`, which the
  smoke gate cannot see. `PLAYWRIGHT_BROWSERS_PATH=0` moves the download into
  `web/node_modules`, which does persist — **but the variable is read from the
  environment on every Playwright invocation, so it must be set on the test run as
  well as on the install.** Setting it only in `postinstall` puts the browser in the
  worktree and then fails to look for it there. Set it inline in both scripts, e.g.
  `"test:smoke": "PLAYWRIGHT_BROWSERS_PATH=0 vite build && PLAYWRIGHT_BROWSERS_PATH=0 playwright test"`,
  or have the smoke script install the browser as its own first step. A gate that
  passes locally and fails in the factory with "just installed — please run
  `npx playwright install`" is this, and reinstalling harder will not fix it.
- `web/public/fonts/` (four OFL woff2 files and `fonts.css`) and `PRODUCT.md`,
  `DESIGN.md`, `.impeccable/` pre-exist the scaffold; the scaffold story keeps them.

## Governance

This constitution changes by superseding entry in `docs/decisions.md`, never by
silent edit. Where this repository's vocabulary and ergane's disagree about a
factory-side word, ergane's `CONTEXT.md` wins; pane-side words live in this
repository's `CONTEXT.md`.
