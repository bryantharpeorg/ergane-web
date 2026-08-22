# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One operator — the person who runs an Ergane factory on their own host and owns the
repositories it builds. They work in a terminal (`ergane status`, `ergane build …`,
`ergane answer …`) and keep the pane open **in a browser tab on the laptop beside that
terminal**: glanced at many times an hour, read closely only when the factory pages
them through Telegram or a webhook. Confirmed 2026-08-22. A second audience is
incidental: a visitor shown the Showfloor on that same screen. There is no team, no
roles, no sign-up — the pane is guarded by a single token on every route.

## Product Purpose

The pane shows what the factory is doing and what is waiting on the operator, and
carries exactly one write — **Answer** — for resolving a Question with knowledge or
an Escalation with a choice. Two rooms: the **Showfloor** (every running epic's work
graph staged as a state-lit DAG whose landings flow visibly to done; pure glass, no
verb) and the **Desk** (attention first, then floor detail, health findings, spend;
the only room where Answer renders). Success is an operator who can tell in one
glance whether anything needs them, and who answers from the pane instead of
hunting for a correlation id in a chat thread. Everything deliberate — ready a spec,
promote, dispatch, kill — stays in the CLI by design.

## Positioning

The pane is not a second console and does not compete with the CLI. Its mechanism:
it renders the factory's own documents through the factory's own library seams
(`collect_floor`, the `epic_status` Temporal query, `open_escalations`, the usage
rollup, the findings store, the Question store, the bridge's `handle_relay`) and never
re-implements, infers, or caches the floor. Degradation is honest: a dead orchestrator,
a refused query, an unreadable ledger are each said in so many words on the page
(constitution III). A quiet floor is a state, never a blank page.

## Operating Context

- Runs on the factory host behind one token (D-007); reached from the operator's own
  laptop browser next to the shell.
- Data arrives from a live floor, or from the committed **Fixture floor** under
  `fixtures/` when `PANE_DEMO=1` — the demo mode used by every gate and by anyone
  being shown the pane without a factory.
- Attention items arrive when the operator points the factory's `ERGANE_WEBHOOK_URL`
  at the pane: Questions (free-text reply), Escalations (a fixed menu of choices,
  `esc:<12hex>:<CHOICE>`), and Notices (supervision or roadmap alerts that ask for
  nothing). Every item shows the time it has left; the countdown anchors on the
  factory-written `expires_at`, never a pane-side clock.
- The Desk's Answer posts through the factory's bridge and renders the factory's
  ruling on every answer — RESOLVED, UNKNOWN, ALREADY_RESOLVED, EXPIRED,
  UNAUTHORIZED, SIGNAL_FAILED — including refusals.
- Live updates stream as SSE events `{type, data}`; consumers ignore unknown types.
- Factory vocabulary (Spec, Epic, Node, Attempt, Persona, Question, Escalation,
  Landing, Promotion) is defined by ergane's CONTEXT.md; the pane's own words
  (Pane, Showfloor, Desk, Floor, Answer, Attention item, Notice, Fixture floor,
  quiet floor) are in this repo's CONTEXT.md.

## Capabilities and Constraints

- Stack is decided (D-006): FastAPI backend under `pane/` (uv, `ergane-cli==0.2.0`
  from PyPI), Vite + React + TypeScript frontend under `web/`, `@xyflow/react` +
  `dagre` for the DAG. Dependencies only from the constitution VII roster; ask before
  adding one. No CDN scripts or remote stylesheets.
- The Showfloor renders no button, form, or input (constitution I / spec 002). The
  Desk issues no non-GET request except Answer.
- Eleven node states must each be distinguishable at a glance: PENDING, KEY_ISSUED,
  RUNNING, VERIFYING, PASSED, PR_OPEN, ENQUEUED, MERGED, FAILED, KILLED,
  WAITING_OPERATOR — plus the paged-while-verifying case (`awaiting_operator` true
  while the state still reads VERIFYING), which a naive renderer drops.
- Two edge kinds in every graph: `depends_on` (unlocks on verification) and
  `depends_on_merged` (unlocks on merge), rendered distinctly. Same-rank nodes are
  staged side by side.
- Spend rollups can carry NULL ("unknown, never fabricated 0"); the pane shows unknown
  as unknown.
- Four gates, all headless: `uv run pytest -q`, `npm --prefix web run typecheck`,
  `test:unit`, `test:smoke` (Playwright, chromium). Every visual claim in a spec must
  be provable from the diff by those gates.
- Built by the factory itself from specs 001 → 002 ∥ 003 (D-003); the implementers
  are headless agents that read DESIGN.md and the constitution, so every design
  decision must be stated, not implied.
- Undecided: none material. Open to later specs: auth beyond one token, multi-host.

## Brand Commitments

Name only: **Ergane** (Athena Ergane, patron of craftsmen and workers). No logo,
mark, or wordmark exists; confirmed 2026-08-22 that the pane establishes its own
identity under the name. Binding visual constraint the operator set on 2026-08-22
while choosing the direction: **a mid-century modern colour palette on a light sage
ground — explicitly not cream or beige ("anything but Claude beige") — no red anywhere, and a tame, calm primary** — "modern, digital vibes" blended with that palette;
the operator also asked that the pane be forward-thinking yet demo-safe in an
enterprise room (nothing whimsical, nothing that reads retro-kitsch). Voice, where the pane speaks at all, is the factory's:
precise, declarative, says what is happening in so many words, never cheerful filler
(see "Forbidden words" in the constitution: no dashboard/console/app, no
"action"/"mutation" for Answer).

## Evidence on Hand

- Real documents: `fixtures/` (recorded from a live floor and ergane's real seams;
  never invented — constitution V). Until recorded, there is no screenshot, no
  mock, and no prior pane to reference.
- ergane's own CLI output (`ergane status`, `ergane build status`) is the incumbent
  "interface" the operator reads today — terse, sectioned, monospace.
- No testimonials, benchmarks, or press; nothing may be fabricated.

## Product Principles

1. **One glance answers "does anything need me?"** — attention outranks everything;
   the rest of the Desk is detail.
2. **The factory's words, the factory's truth** — render what the seams say,
   including refusals and unknowns; never smooth, infer, or invent.
3. **Glass on the Showfloor, one hand on the Desk** — the spectacle has no controls;
   the Desk has exactly one verb.
4. **State must be legible without a legend** — eleven node states, two edge kinds,
   the paged-while-verifying case: each readable at a glance beside a terminal.
5. **Built by agents, so decided in writing** — what DESIGN.md does not state, an
   implementer will guess.

## Accessibility & Inclusion

Operator-stated need: none beyond general practice. Because node state is the
product, state must never be carried by color alone (shape, label, or motion
doubles every hue). Countdown and live-update motion must respect
`prefers-reduced-motion`. Keyboard-reachable Answer.
