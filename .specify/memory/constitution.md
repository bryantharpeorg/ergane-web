# Ergane Web Constitution

Ergane Web is the operator pane for an Ergane factory: one application, two rooms —
the Showfloor (spectacle) and the Desk (attention) — that renders the factory's
state and carries exactly one verb. It is built *by* the factory it watches. The
decision log lives in `docs/decisions.md` (D-001…D-009); this constitution distills
the non-negotiables that every spec, plan, and implementation in this repository
must honor. Factory-side standards for how agents work (test-first, salvage,
attribution) are ergane's constitution and are not repeated here.

## Core Principles

### I. A Glass With One Verb (NON-NEGOTIABLE)

The pane displays; the operator CLI acts. The single exception is **Answer** —
resolving a Question or an Escalation through the factory's existing answer seam.
No story, plan, or implementation may add a second write path, however small: no
pause buttons, no dispatch forms, no spec editing. A requirement that needs one is a
defect in the requirement (D-001).

### II. Borrowed Seams, Never Re-Derived Logic

Every read and every write rides a surface the ergane distribution already exports:
`collect_floor`, `open_escalations`, `rollup`, the doctor store's read-only reader,
the verify store's Question reader over `connect_readonly`, the Temporal queries
the factory's workflows answer (`epic_status`, `roadmap_status`,
`escalation_status`), `CallbackBridge.handle_relay`, the `escalation_resolved`
signal (list amended by D-010). Re-implementing
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
