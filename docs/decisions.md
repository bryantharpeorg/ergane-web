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

## D-011 · The build run's operating choices: `dev`, `ergane.yaml`, PyPI, Kimi/GLM, no metered Opus (decided)

Decided 2026-08-22 in the dispatch interview, the session that installs ergane on
a clean host and lets the factory build this pane. D-010's open checklist left
four things to the operator at wiring; this entry rules on them and on two facts
that moved since the corpus was written.

1. **Landing branch is `dev`** (operator override of D-008's assumed `buildout`).
   `main` is promoted from `dev` by the operator after the landed output is
   validated against the specs. `ergane.yaml` carries `landing_branch: dev`.
2. **The manifest is `ergane.yaml`**, not `factory.yaml`. Ergane's resolver
   (`factory/verify/factory_yaml.py`, `resolve_manifest_path`) honors the legacy
   name with a one-time deprecation warning per process; the preferred name avoids
   that warning in every attempt. Mentions in live documents (README, constitution,
   draft specs) follow the rename; earlier decisions and log entries keep the old
   name because they describe the past.
3. **`ergane-cli` resolves from PyPI**, pinned `==0.2.0` (published 2026-08-22).
   Spec 001's assumption that the distribution was unpublished is amended; the
   git-source `[tool.uv.sources]` reference stays the documented fallback for a
   seam newer than the release.
4. **Ladder**: `max_attempts: 6`, `debugger_cycles: 3` — the same rungs the
   sibling test repository runs. Nothing promotes to a closer automatically.
5. **Persona routing for this build**, recorded here because the registry lives
   outside this repo (`~/.config/ergane/personas.yaml`, constitution VII):
   architect, implementer, debugger, researcher → `ollama-cloud/kimi-k2.7-code`;
   judge → `ollama-cloud/glm-5.2`; every fallback `local/qwen3.6-27b`. **No persona
   routes to a metered provider.** The gateway-routed `closer` alias
   (`anthropic/claude-opus-5`, per-token) is omitted from the registry; the one
   opt-in rung for a stubborn story is `opus-closer` on ergane's `subscription`
   agent (operator's own Claude Code login, `fallback: null`), dispatched by hand
   and only after the operator is asked.
6. **Dispatch path**: all three work graphs are derived by hand
   (`ergane spec derive`, archived under `docs/dags/`) for review, then each spec
   is flipped `ready` and the roadmap scheduler dispatches it. 002 and 003 are
   readied together once 001 has landed.
7. **The Fixture floor is recorded hybrid**: live captures from a running floor
   through ergane's real seam functions, plus on-cue states (refusal, awaiting
   operator, Question/Notice payloads, bridge rulings) provoked by driving the
   same seams under ergane's own test harnesses. Provenance per document in
   `fixtures/README.md`. Rejected: purely synthetic fixtures (constitution V
   forbids inventing them); waiting for a naturally busy floor (no second epic
   exists until this build runs).

Rejected alternatives: keeping `buildout` (the operator's branch convention is
`dev`); routing the whole build through one model (the judge must not share the
builder's blind spots — D-008's reasoning, now applied to model choice); a
`closer` on the metered alias "just in case" (a default that can bill is not
opt-in; constitution VII's registry rule means the only safe absence is omission).

## D-012 · A design system the factory's nodes inherit (decided)

Decided 2026-08-22, between wiring and fixture capture, when the operator asked
that the pane inherit a visual system rather than leave appearance to each
implementer. No system existed in ergane to inherit (its `.impeccable/` is a hook
cache), so one was set for this repository through a design interview and two
rolled direction rounds with operator steers.

1. **The world**: a launch-telemetry *mission timeline* — T-minus clocks for
   attention items (anchored on the factory's `expires_at`), one milestone bar every
   epic shares (PASSED → PR_OPEN → ENQUEUED → MERGED), large tabular numerals — fused
   on the Showfloor with a *visible transit* staging: the work graph as a route map,
   the landing run as a line with stations a node's token travels through.
2. **The palette**: mid-century modern on a light **sage** ground — the operator
   ruled out cream/beige ("anything but Claude beige") and red, and asked for a tame,
   calm primary. Teal is the one accent; mustard, olive, clay carry verifying,
   landing, and waiting-on-you; aqua carries upstream states. Every state is a glyph
   plus a caption, never colour alone.
3. **Where it lives**: `PRODUCT.md` (product truth), `DESIGN.md` (the visual
   authority, recorded from the built comps), `.impeccable/mocks/` (the two comps and
   `tokens.css`), `.impeccable/surfaces/` (the Desk and Showfloor briefs). All
   committed so dispatched nodes, which cannot see the operator's home, read them
   from the worktree.
4. **Constitution amended**: Principle VIII binds every rendering diff to
   `DESIGN.md`; the environment constraints name the pre-existing `web/public/fonts/`
   (Red Hat Display/Text/Mono, OFL, vendored as variable woff2) that the scaffold
   must keep. No roster change: the faces are files, not packages.
5. **Specs**: 001 (US4), 002, and 003 reference DESIGN.md in their Assumptions; their
   functional requirements and work graphs are unchanged — appearance is governed by
   the constitution, not re-specified per story.

Rejected: inheriting another repository's system (kalshi-trader's, tokenomics'):
neither was made for an operator pane, and a borrowed identity is a borrowed
argument. Rejected: leaving appearance to the implementer — eleven states, two edge
kinds, and a paged-while-verifying case are exactly what an agent guesses wrong.

