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

## D-013 · The gate boundary's `HOME` is a tmpfs, and the specs say so (decided)

Decided 2026-08-22 during the first dispatch of spec 001, under the Governance rule that the
constitution changes by superseding entry and never by silent edit.

001/US1's first two attempts each brought three of the four gates green — `uv run pytest -q`,
`npm --prefix web run typecheck`, `npm --prefix web run test:unit` — and each failed the smoke
gate with Playwright's *"Looks like Playwright was just installed or updated. Please run …
`npx playwright install`"*. The attempt had already added a `postinstall` hook that runs exactly
that. The hook works: it warms `$HOME/.cache/ms-playwright` **in the attempt**. The gate then runs
in the factory's sandbox with a fresh tmpfs `HOME` (ergane, `factory/verify/gates.py:785`), so the
cache is not there. The boundary does have egress (`gates.py:810`), so the download would have
succeeded — it simply never ran.

The agent cannot observe this: from inside the attempt the browser is installed and the gate's
advice is to install it. Two attempts were spent on it, and a third was in flight when this was
recorded. **Nothing in the repository stated the fact**, so the constitution's Environment
Constraints and `CLAUDE.md` now do: only the worktree crosses from the attempt into the gate, so a
gate's dependencies live in the worktree (`PLAYWRIGHT_BROWSERS_PATH=0` → `web/node_modules`) or are
fetched by the gate command itself.

This changes no requirement and relaxes no gate. It is documentation of the environment the specs
were always written against — spec 001's Assumptions already contemplated the sandbox's network
posture, but not the boundary between an attempt's filesystem and its gate's. Reported to the
Ergane agent as finding N20 with the suggestion that the attempt prompt, or the gate's own
failure detail, carry this sentence so no target repository has to learn it by burning attempts.


## D-014 · The judge sees the diff, not the tree, and never the gate results (decided)

Decided 2026-08-22 during the third dispatch of spec 001, under the Governance rule that the
constitution changes by superseding entry and never by silent edit.

001/US1 failed nine consecutive attempts — six implementer, then all three debugger cycles —
across two dispatches. Every one of those nine records is identical in the two places that
matter: `gate_results` is `test PASS · typecheck PASS · unit PASS · smoke PASS`, and
`output_check` is `{"passed": true, "hygiene_violations": [], "size_refusal": null}`. The pytest
gate's own tail reads `12 passed in 0.14s`. The judge nevertheless failed US1-S1 every time, with
the same reasoning: that `uv run pytest -q` *would* fail, because `tests/test_scaffold.py` asserts
the five vendored faces exist under `web/public/fonts/` and no font file appears in the
changed-file list.

The fonts are in the base tree — this repository's own D-012 commit put them there — so they are
correctly absent from a diff that does not touch them. The claim is a counterfactual the same
record disproves one field earlier.

**Why it happened, in ergane.** `factory/verify/judge.py:240` assembles the judge's prompt from
four things: the requirement, its acceptance scenarios, the previous attempt's feedback, and the
diff. The gate results are not among them, although the loop order is `[gates, diff_check, judge]`
and the gates have therefore already run and been recorded. The system prompt
(`judge.py:133`) then instructs: *"if the evidence is not in the diff, the scenario does not
pass."* A scenario whose Then-clause is a runtime outcome consequently asks the judge to simulate
a run it is forbidden to observe, against a tree it was never shown.

**Why it happened, in this repository.** US1-S1 was written *"Given a fresh checkout containing
this diff … Then [the four gate commands] all exit 0."* That is a runtime outcome, and the phrase
"containing this diff" positively invites the reading that a file absent from the changed-file
list is absent from the checkout. It was the only scenario across all three specs phrased that
way, and it is the only scenario that deadlocked. The spec's own frontmatter already required
every criterion to be decidable from the diff; this one was not, and the rule failed to catch its
own violation.

**The rule.** An acceptance scenario asserts what the diff *commits*, never what a command would
*do*. The gate rung measures the run; the judge scores the wiring. Where a scenario's subject
depends on a file the diff does not touch, the scenario says so explicitly, because the judge
cannot see the base tree and will otherwise assume the file does not exist.

US1-S1 was rewritten to that rule and the epic re-dispatched. No requirement is relaxed: FR
coverage is unchanged, and the four gates still have to exit 0 — they are simply proved by the
rung that actually runs them. Reported to the Ergane agent as finding N26 with the suggestion
that `build_prompt` include the gate outcomes it already holds, so a judge asked about a gate can
read the answer instead of predicting it.

## D-015 · The second world: one epic on stage, a ladder per story (decided 2026-08-24)

**Supersedes D-012's content, not its mechanism.** D-012 made `DESIGN.md` the pane's visual
authority; that stands. This entry replaces what the document *says*: the light-sage mid-century
world — skewed chevrons, the per-epic landing line, the vertical stack of full stages, the
vendored OFL faces — is retired, and the operator-approved `Showfloor Redrawn` world takes its
place. The approved comp is committed at `.impeccable/mocks/showfloor-redrawn.html`; the first
world's comps remain beside it as history.

**Why.** The first build falsified the old staging idea with measurements, not taste: six epics
stacked as full stages produced three screens of guaranteed-empty canvas (514px each), populated
stages 5–23% full, a legend rendered once per epic, and — after 004's repair — graphs laid out
beside their own boxes (9 of 9 stations outside their maps). The unit was wrong. The second
world's unit is the selection: an epic rail, one stage, one detail pane, and a six-stop status
ladder worn identically by every story, fusing spec state, node state and landing state into one
glance.

**Decided with the operator, 2026-08-24:** the world applies to the **whole pane** (Showfloor
first, the Desk restyled in a following spec); **both themes** are binding, replacing the old
world's deliberate light-only stance; faces are **system stacks** — the vendored fonts are
retired from these surfaces and nothing may load a font file; the ladder has **six stops, not
seven** — task-level progress has no seam (`tasks.md` boxes are never ticked), and this pane does
not render elements that can never fill. The gap is filed to the ergane agent as N46; if a seam
appears, the stop is added to `DESIGN.md` first, then specced.

**What does not change:** the one verb stays at the Desk; the Showfloor has no button; state is
never colour alone; degradation stays honest and in place; the Unknown Rule, the countdown anchor
rule, and the escalation body-segmentation rule carry over word for word. Constitution unchanged —
this is an appearance decision inside VIII's frame, taken by the operator as VIII requires.
