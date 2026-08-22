# Decision Log

Format: one entry per decision, newest last. Entries are immutable — supersede, don't
edit. All entries below were decided in the design interview of 2026-08-21, each
confirmed explicitly by the operator.

---

## D-001 · The pane is a glass with one verb (decided)

Ergane already has two operator surfaces: the operator CLI (deliberate acts — ready a
spec, promote, dispatch, forget) and the notify channel (Telegram/webhook transports
carrying Questions and Escalations). A web pane could have been a third full console,
a strictly read-only status board, or something between.

The factory's own vocabulary makes Escalations time-critical: buttons with a one-hour
expiry. A pane that shows an escalation but cannot press its button forces a
context-switch to another surface mid-decision — which defeats a minimal operator
pane. But every write the pane carries drags in authentication, idempotency, and the
defect class ergane's spec 079 exists for: a pressed button must do what it says.

**Decided:** the pane is read-only everywhere except one verb — **Answer** —
resolving Questions and pressing Escalation buttons through the factory's existing
answer seam. It never grows a second write. If pane-side dispatch or promotion is
ever wanted, that is a superseding entry here, not a feature PR.

Rejected: a pure glass (leaves the one genuinely screen-worthy interrupt
unactionable); a full operator console (duplicates deliberate-act semantics across
two surfaces and doubles the auth burden).

---

## D-002 · Two rooms: Showfloor and Desk (decided)

A spectacle (live DAG of building epics) and a working surface (attention, floor
detail, health, spend) have opposed design pressures: the first optimizes for a
projector and a visitor's first ten seconds, the second for an operator's glance.
Fused into one page, the spectacle wins and the operator loses.

**Decided:** one application, two routes with opposite temperaments. The
**Showfloor** is full-bleed spectacle and pure glass — no verb, projector-safe. The
**Desk** ranks waiting-on-you first and is the only room where Answer renders. An
escalation arriving while the Showfloor is up shows as a badge deep-linking to the
Desk; the spectacle never grows buttons.

Rejected: the DAG as the pane's centerpiece with answer cards overlaid (each surface
compromises the other); the verb on both rooms (costs the projector-safe property).

---

## D-003 · The factory builds its own pane (decided)

ergane-web's specs could have been rich design documents for interactive coding
sessions. But the sibling repository is an agentic software factory whose product
principle includes creating greenfield repos from specs, and the strongest possible
demonstration of the Showfloor is the pane watching the factory build the pane.

**Decided:** ergane-web's specs are authored in ergane's Spec Kit dialect —
`spec.md` with Given/When/Then acceptance scenarios per story — and ergane-web is
structured as a wireable target repository (`factory.yaml` gates, constitution,
`ergane init`-clean layout). Hard consequence, inherited from ergane's constitution
VIII: every acceptance scenario must be provable from the diff by the judge, and
every gate must run headless. A scenario only a human eye can score is a defect in
the spec.

Rejected: freeform design docs (no dogfooding, no judge discipline); a hybrid
two-artifact flow (two documents to keep honest).

---

## D-004 · The Showfloor stages the workgraph itself (decided)

The metaphor question: graph, factory-floor map, or assembly line. The assembly line
maximizes motion but flattens the DAG — dependencies become implicit exactly where
ergane's glossary is most insistent (pass-edge vs merge-edge are different promises,
and conflating them once dispatched nodes against bases missing their code).

**Decided:** the spectacle is the workgraph, not a decoration over it. Each running
epic renders its DAG left-to-right — declaration order is scheduling order, so layout
follows the contract — with nodes as state-lit cards (attempt pips, persona badge),
merge-edges drawn solid and pass-edges dashed, and the landing run (PASSED → PR →
queue → MERGED) animated as flow into a landed shelf. Transitions pulse; idle epics
dim. The viz teaches the domain's distinctions instead of hiding them.

Rejected: floor-map-with-zoom (DAG detail one level down at rest); assembly-line
stations (maximum motion, implicit edges).

---

## D-005 · Library-backed plumbing; reads and writes ride ergane's seams (decided)

Ergane's spec 046 already took a position on this surface: "the web status board —
it renders its own view from its own reads." Its FR-008 takes the complementary one:
a second implementation of "ready" is a defect. Both are satisfied at once by reading
through the ergane package's own functions rather than shelling the CLI or
re-deriving state from Temporal and SQLite by hand.

**Decided:** one Python backend imports the ergane distribution and uses its
documented seams — `collect_floor` for the floor, `open_escalations` for attention,
`rollup` for spend, the doctor store's read-only reader for findings — and answers
through the same cores the CLI uses: `CallbackBridge.handle_relay` for Questions,
the `escalation_resolved` signal for Escalations. The factory's `ERGANE_WEBHOOK_URL`
points at this backend, so attention arrives as an event; the browser is fed by SSE,
with floor state refreshed by a backend poll over `epic_status`. The 052 doctrine is
binding: transport failure and query refusal are two different failure modes, any
answer may be partial, and a missing key never crashes a view.

Rejected: CLI-shelling (stable contracts but poll-only, a process per read, and
`doctor` has no `--json`); independent reads (fully decoupled but re-derives
readiness — the named defect class).

---

## D-006 · Stack: FastAPI + React/Vite/TypeScript, React Flow for the DAG (decided)

Because of D-003, implementer agents write every line, so the stack is chosen for
agent reliability and gate-checkability as much as for the product: React/TypeScript
is the most in-distribution frontend stack for coding models; React Flow
(@xyflow/react) with dagre auto-layout gives pan/zoom and custom node components
without inventing a rendering engine; FastAPI is the natural host for the
library-backed seams and SSE.

**Decided:** FastAPI backend under `uv`; Vite/React/TypeScript frontend; DAG via
@xyflow/react + dagre; motion via CSS/Framer Motion. Gates: `pytest`,
`tsc --noEmit`, `vitest`, and a headless Playwright smoke against the fixture floor.
Two package worlds (uv + npm) in one repository, accepted.

Rejected: hand-rolled SVG/canvas renderer (total control, but agents build layout
and pan/zoom from scratch and the judge scores more invented code); Jinja + htmx
(one language, but the Showfloor's animation fights the grain).

---

## D-007 · The pane runs on the factory host, behind one token (decided)

The library seams read SQLite ledgers and per-spec `workgraph.json` straight off
disk, so the backend lives on the factory host with the factory checkout's
filesystem and Temporal reachable — a systemd user unit, the same supervision
pattern as `ergane worker install`.

**Decided:** every route — Showfloor included — sits behind a single shared bearer
token enforced in the backend. The operator chose the token over a bare
LAN-perimeter model deliberately: one revocable string is cheap, and demoing means
sharing it. Identity for Answer is a separate, configured value that must appear in
the factory's `escalation.authorized_responders`; the factory, never the pane, makes
the final authorization ruling — the pane's token decides who can *see*, the
factory's responder list decides whose answers *count*.

Rejected: no login with the network as perimeter (operator wants the gate); a public
read-only Showfloor (a public window into live repo and spend state needs a
redaction story first — supersede this entry when one exists).

---

## D-008 · Three epics, tracer-bullet order (decided)

**Decided:** milestone one is three specs, dependency-ordered, in ergane's
sentence-slug style:

1. `001-the-desk-sees-the-floor` — scaffold, gates, fixture floor, backend reads,
   and a read-only Desk. Something real on screen first.
2. `002-the-showfloor-stages-an-epic` — the spectacle, merge-edged on 001.
3. `003-an-answer-reaches-the-factory` — the verb and the token gate, merge-edged
   on 001.

The fixture floor lands in 001 because both later epics' gates replay it, and
because it doubles as the demo mode: the Showfloor must be showable with no live
factory behind it.

Rejected: spectacle-first (builds the fancy viz before the plain surface that
debugs it); two bigger epics (longer ladders, harder judging).

---

## D-009 · This repository speaks ergane's dialect (decided)

**Decided:** ergane-web mirrors the sibling repository's conventions — a
glossary-only `CONTEXT.md`, this immutable append-only decision log (no ADR files;
the interview's one pre-existing ADR was converted into D-001 and the `docs/adr/`
directory removed), `.specify/` templates and a constitution, numbered specs with
sentence slugs, and a committed `factory.yaml` naming the gates and the standards
document. Where this file and ergane's disagree about a factory-side word, ergane's
CONTEXT.md wins; pane-side words live here.

---

## D-010 · Verification's mechanical consequences, ratified in one entry (decided)

Decided 2026-08-21, after the spec corpus passed through adversarial verification
(nine verifier agents, one completeness critic) and the operator ruled on the one
genuinely open question. This entry ratifies the consequences that earlier decisions
forced but did not spell out; per Governance, the constitution amendments below are
authorized here, not silently edited.

1. **The Notice class** (operator-decided): a webhook payload that is neither
   Question nor Escalation — supervision alerts, roadmap notices — is a **Notice**,
   a third kind of Attention item that asks for nothing: no countdown, no buttons,
   no settlement. Pointing `ERGANE_WEBHOOK_URL` at the pane routes *all* notify
   traffic there; refusing this class would silently drop the "orchestrator is
   down" page. Dismissing a Notice is pane-local housekeeping, never a factory
   write — D-001's one-verb rule holds. Rejected: a separate non-attention strip
   (the glanceable badge would omit a dying orchestrator); refusing the class
   (loses supervision pages while the factory resolves exactly one adapter).
2. **Dependency roster additions** (forced by D-006): `@types/react`,
   `@types/react-dom`, `@vitejs/plugin-react`, `jsdom` — strict `tsc` over a React
   app cannot exit 0 without them. Constitution VII amended.
3. **`factory.yaml` schema v2** (forced by D-006's gate names): schema v1 fixes the
   gate vocabulary to test/lint/typecheck and refuses `unit`/`smoke` as
   CONFIG_ERROR before any gate runs.
4. **Runtime-root paths corrected**: ergane's runtime root is `.ergane/` (legacy
   `.factory/`), and store paths are resolved through ergane's own resolvers, never
   hard-coded. Constitution's environment constraints amended.
5. **Auth interims named** (qualifying D-007): the intake route is guarded by the
   credential carried in the operator-configured webhook URL (the factory sends a
   bare POST with no headers), and spec 001 ships its single auth seam open as a
   dated interim closed by spec 003 before any deployment. Constitution VI amended.
6. **Cross-spec ordering vocabulary** (correcting D-008's phrasing): specs 002 and
   003 declare `depends_on_landed: [001-…]` in frontmatter — the roadmap's
   scheduler-enforced edge. "Merge-edged on 001" was the wrong word; merge-edge is
   node-level, inside one epic's workgraph.
7. **Constitution II's seam list extended** to the surfaces the specs actually
   ride: the Temporal queries (`epic_status`, `roadmap_status`,
   `escalation_status`) and the verify store's Question reader.
