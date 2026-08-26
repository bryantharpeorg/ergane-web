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

## D-016 · The stage takes the room the pane is not using, and the scroll is furniture (decided 2026-08-25)

**Inside D-015's frame, not a replacement for it.** `DESIGN.md` stays the visual authority and the
second world stands. This entry amends three clauses of it after reading the room on a real
monitor rather than in a test viewport.

**What was measured.** The Showfloor on a 3008px-wide display, dark, spec 004 selected and no
story picked: the app frame caps at 96rem, so 1,520px of the screen is empty ground; of the
1,486px that remain, the detail track holds a fixed `26rem` — 403px — to show two sentences of
room explanation; the stage gets 770px; the graph needs 797px. It scrolled, and it scrolled inside
the host operating system's own widget, a light grey trough with stepper buttons in a dark room.
Three widths, every spec on the floor, before and after collapsing the empty track:

| width | graph needs | stage today | clipped | stage with the track collapsed | clipped |
|---|---|---|---|---|---|
| 1280 | 797px | 562px | 235px | 965px | 0 |
| 1600 | 797px | 770px | 27px | 1173px | 0 |
| 3008 | 797px | 770px | 27px | 1173px | 0 |

**Decided.** (a) The `26rem` detail track collapses to `0` while nothing is selected, and the
stage takes the width. (b) The room's two-sentence explanation moves beneath the stage above the
legend row — the same words, in a place that does not cost the graph its width; it is relocated,
never hidden, which constitution III would forbid. (c) The stage's horizontal scroll is styled
furniture: thin, no stepper buttons, thumb on `--rule`, transparent trough, both themes, always
rendered rather than fading in.

**What this does not decide.** The 96rem frame cap stays as `DESIGN.md` § Layout and 004's FR-007
have it; a graph that still outgrows a full-width stage still scrolls. Wrapping an over-wide rank
onto a second row — the fix that would retire the scroll for the chained-four shape even with a
story selected — is deferred: rendering it proves the geometry works and the wires do not, because
`Wires.tsx` draws rank-to-rank left→right and a row break leaves a stub. That is a spec of its own,
with the wire case in it, not a clause here.

**Why an entry at all.** Constitution VIII: appearance changes are the operator's to take, and the
authority is amended before the spec that builds to it, never after. Spec 008 cites these clauses.

---

## D-017 · FR-001's measured width pair is corrected to 1280 → 1600 (decided 2026-08-25)

**Raised by** the `006-the-desk-matches-the-stage` US1 node, which could not satisfy the
requirement as drafted and would not quietly weaken the test to look as though it had.

**The conflict.** Spec 006 FR-001 asks that the Desk fill the app frame "fluidly to its
`96rem`, with measured width growth between 1600 and 2560", and US1-S1 restates it as "its
width at 2560 exceeds its width at 1600". No implementation can satisfy that clause while
obeying `DESIGN.md`:

- § Typography fixes the root at `15.5px`; § Layout caps the app frame at `max-width: 96rem`.
  96 × 15.5 = **1488px**, so the cap already binds at 1600 and there is no growth left above it.
- § The Desk in this world asks for "**Fluid width** — the Desk fills the frame **like the
  Showfloor**". The Showfloor is landed doing exactly that, and `showfloor.spec.ts` ("the frame
  is fluid to 96rem", FR-007) measures growth on **1280 → 1600**, then asserts the cap binds and
  the frame centres at 2560. FR-001 reads as that clause carried over with its viewports
  mis-transcribed.
- **D-016 already ruled on the cap itself**, yesterday, in as many words: "The 96rem frame cap
  stays as `DESIGN.md` § Layout and 004's FR-007 have it." Raising the cap was not on the table
  for a node to take, and D-016 says why: "appearance changes are the operator's to take".

**What was measured** on the Desk in this diff, fixture floor, root 15.5px:

| viewport | frame | content | margin per side |
|---|---|---|---|
| 1280 | 1280px | 1278px | 0 |
| 1600 | 1488px | 1486px | 56px |
| 2560 | 1488px | 1486px | 536px |

Growth below the cap is real (+208px, 1280 → 1600); above it the content is identical to the
pixel, because the frame centres instead of stretching.

**Decided.** Constitution VIII settles it — "where a spec's scenario and DESIGN.md disagree on an
*appearance*, DESIGN.md wins", and a width cap is appearance. FR-001 and US1-S1 are corrected to
name the pair that exists, **1280 → 1600**, and `desk-world.spec.ts` asserts the 1600/2560 pair as
**exact equality at the cap** — a stronger and more falsifiable claim than the growth the scenario
asked for, and deliberately not the `>=` an earlier attempt hedged with.

**What this does not change.** No token, no cap, no `DESIGN.md` clause, and no rendered pixel: the
Desk's geometry is what D-016 and § Layout already required. The defect FR-001 exists to retire —
the first world's hard 1216px content cap, and the 672px of dead margin per side it left at 2560 —
is retired at every width, and `desk-world.spec.ts` proves it at all three the scenario names.

**What this leaves open.** At 2560 a 1488px frame still strands 536px per side. That is the cap
working as designed, not a defect in this spec; if the operator wants the Desk to use that room,
it is a `DESIGN.md` amendment to § Layout and a new entry here — with the Showfloor's "centred at
the cap" assertion moving with it — and it is the operator's to take, not a node's.

---

## D-018 · The room's claims outlive the workflow, and a fourth layout law (decided 2026-08-25)

**Raised by** the operator, from the pane's own Showfloor at 3:22 PM CT on 2026-08-25, looking at a
spec that had finished eleven minutes earlier.

### The defect

`006-the-desk-matches-the-stage` had all three stories merged on `dev` — `55920c9`, `9872850`,
`5cb5441`, observed by content. The Showfloor rendered it **`READY 0/3`**, with every story parked at
the `ready` stop of the ladder. Not "unknown", not "the live read is gone": *ready*, which in this
room's vocabulary means **not started**. The room stated the opposite of the truth, with confidence,
about the only thing it exists to report.

The mechanism is one line. `pane/showfloor.py:518`:

```python
landed = sum(1 for story in stories if story["ladder"]["stop_key"] == "merged")
```

The ladder comes from `readers.epic_status(spec_dir)` — a Temporal query against a **live workflow**.
When 006's workflow completed, the query answered nothing, `dispatched` went `False`, `live_nodes`
went empty, and `_stories` fell back to the spec's frontmatter `state:`, which still read `ready`
because nobody had attested it yet. Every story inherited that stop.

**So the room's landing truth has exactly one source, and that source is designed to disappear.** A
Temporal workflow ends when the epic ends, and retention is 72 hours besides. The window in which a
finished epic reads as unstarted opens the moment the last story merges and closes only when a human
edits a YAML frontmatter line by hand. For 006 that window was eleven minutes because the operator
happened to be watching. Overnight, under `/away-mode`, it is however long the operator sleeps — and
the pane spends that whole time telling them nothing has started.

**Git already knows the answer.** `ergane spec landed specs/<dir> --default-branch dev` reports every
story's landing SHA by content, from the branch, with no workflow involved. It is the same seam the
corpus already trusts for attestation. The room does not ask it.

### What is decided

1. **Landing truth is read from the corpus, not only from the live workflow.** A story that is landed
   on the landing branch by content reads `merged`, whether or not a workflow still exists to say so
   and whether or not the frontmatter has been attested. `epic_status` remains the authority for
   everything *in flight* — attempt, persona, the four stops before `merged` — because only it knows
   those. The two are layered, not swapped: live where live exists, corpus underneath.

2. **A read whose live source is gone renders as gone, never as a default.** Where neither source can
   answer, the ladder shows the Unknown Rule's vocabulary — constitution III, "a value the factory did
   not record is shown as unknown, never as zero". Falling back to the *first* stop of a six-stop
   ladder is exactly the "shown as zero" failure the principle names, wearing a different costume.

3. **A fourth layout law: no element with an opaque background may paint over a text leaf that is not
   its own.** `DESIGN.md` § Layout carries three laws today — containment, nothing past the viewport,
   no two text leaves overlapping. On 2026-08-25 a degraded note rendered unreadable in both themes,
   its heading cut mid-word, and **all three laws passed**. They measure *glyph* geometry via a `Range`
   over each leaf, deliberately and correctly, because inline fragment rects in Chromium carry the whole
   inline box's height. That decision is right and it is precisely the blind spot: an opaque box painted
   over text is not a text-leaf overlap. No glyphs intersected. The text was simply not readable. The
   instance was fixed incidentally when 006 rewrote `global.css` for the second world — measured today,
   zero occlusion hits — but nothing prevents its return, and a law the suite does not carry is a
   guarantee the repository does not have.

### What is deliberately NOT decided, and the measurements that closed it

**The rank wrap is dropped, not deferred again.** D-016 deferred wrapping an over-wide rank by name,
on the evidence of the 2026-08-25 review: 235px of graph hidden at 1280, US4 fully invisible, on specs
001 and 002. That evidence does not survive re-measurement, and the reason matters.

The review measured a **fabricated** topology. At the time the Showfloor could not find a work graph
for those specs and fell back to listing their stories as an edgeless flat rank — four cards side by
side, which is what overflowed. The archives landed in `#40`, and the real graphs are these:

| spec | true topology |
|---|---|
| 001, 002, 005 | `us1 → us2 → us3 → us4`, serial on `depends_on_merged` |
| 006, 008 | `us1 → us2 → us3`, serial |

Every one is a chain. Measured across the whole corpus at 1280, 1600 and 2560 — eighteen renders —
**clipping is 0px everywhere, and the empty space below the graph is 0px everywhere.** Both halves of
F1 are gone. The clipped rank was a symptom of the fabricated topology, and archiving the DAGs cured
the disease; 008's collapsing detail track had already taken the rest.

An attempt to reproduce the wide rank synthetically — injecting eight, ten and fourteen edgeless
sibling stories into a real epic's document and rendering at all three widths — also produced **no
clipping at any size**, because the stage lays an edgeless set out vertically rather than as one
horizontal rank. There is no shape in reach that reproduces the defect.

So there is nothing to fix here, and a spec that wrapped ranks would be designing for a geometry that
does not occur, with a wire-drawing complication (`Wires.tsx` draws rank-to-rank left-to-right and a
row break leaves a stub diagonal) as its cost. **If a genuinely parallel spec ever lands and clips,
that is the moment to write it, with the real measurement in hand.** D-016's deferral is discharged.

**Why an entry at all.** Constitution VIII: appearance changes are the operator's to take, and the
authority is amended before the spec that builds to it, never after. Clause 3 adds a law to
`DESIGN.md` § Layout; clauses 1 and 2 are behavioural and bind spec 009's stories. Spec 009 cites
these clauses.

---

## D-019 · The stage says what its spec is for (decided 2026-08-25)

**Raised by** the operator, from the pane, at 4:15 PM CT: *"that explains the selected story but what
about the goal of the overarching spec? a story is under a spec right?"*

### The gap

`pane/showfloor.py:161` carries `_intent_after()`, which lifts the one-sentence intent that follows
each `### User Story` heading. It is the reason the detail pane can say what US1 is for. There is no
equivalent for the spec itself: the showfloor document carries `name` — a title — and no prose. The
room can explain a story and cannot explain the epic that contains it.

The text already exists and is already consistent. Every refined spec in the corpus opens its body
with `## Context`, a paragraph stating why the spec exists; the three unrefined sketches open with
`## Sketch`, which serves the same role. Ten of ten. The parser walks past it.

### The second defect this closes

`DESIGN.md` § Detail pane, amended yesterday under D-016, moved the room's two-sentence explainer out
of the collapsed `26rem` track and beneath the stage. That was right, and it left a smaller problem
behind: the explainer is shown **only while nothing is selected**, so picking a story empties the
band under the graph. Content vanishing on click reads as a glitch, and the operator reported it as
one in the same message.

Both are one fix. The band under the stage should hold the thing that is *always* true of what is on
screen — the spec's own goal — rather than a generic description of the room that stops being
interesting after the first visit.

### What is decided

1. **The showfloor document carries a spec-level intent**, read from `## Context` and falling back to
   `## Sketch`, through the same text parse that already lifts story intents. A spec with neither
   renders no band rather than an empty one.

2. **It renders beneath the stage, above the legend row, and it does not depend on selection.** This
   is the band D-016 gave to the room explainer; the spec's goal takes it. The two do not stack — two
   explanations under one graph is noise.

3. **The room's own explainer retires to the empty case**: no spec selected at all. It has done its
   job once the operator has picked something, and it is the less specific of the two.

### What this is not

It is not the spec's whole body. One paragraph, the first under the heading, treated as prose and
truncated by the same rules as any other read — not a rendered Markdown document, and not a link to
one. The reading room for a spec's full history is 007, and it is still a sketch.

**Why an entry at all.** Constitution VIII: composition is appearance, and the authority is amended
before the spec that builds to it. This entry amends `DESIGN.md` § Stage and § Detail pane. Spec 009
US4 cites these clauses.

---

## D-020 · The verify store's evidence readers join the approved seams (decided 2026-08-25)

**Raised by** spec 013, which cannot render a gate step without reading the record ergane already
keeps of it.

**The question 007 left open.** 007's Open Question 3 ruled that the pane never opens
`verification.db` raw, that a durable history store would ship "with its **own** ergane-exported
read-only reader", and that such a reader "joins the constitution II list by a D-entry when it
exists". The premise was that no reader existed. It was wrong: two do, and both are exported,
typed and already load-bearing inside ergane itself.

- **`factory.verify.store.node_history(conn, epic_id, node_id) -> list[VerificationResult]`** — every
  verification of one node, oldest attempt first. Its docstring calls it "the canonical per-node
  query from the DDL — what retry prompts quote and what an escalation's failure history is built
  from". It returns the whole evidence bundle: gate results, judge verdict, diff check, ladder
  summary, timestamps.
- **`factory.verify.store.attempt_timings(conn, epic_id) -> list[AttemptTiming]`** — the narrow
  sibling, six columns across an epic, explicitly built for pace reporting.

Both are read-only by construction and are reached over `connect_readonly`, which constitution II
already names for the Question reader on the same store.

**Decided.** `node_history`, `attempt_timings`, `pending_escalations` and `get_escalation`, all over
`connect_readonly`, join the approved seam list in constitution II. The constitution's parenthetical
becomes "list amended by D-010 and D-020".

**What is still forbidden, and this is the part that matters.** The pane may call these functions and
nothing else. It may not open the database with its own SQL, may not read a column these readers do
not return, and may not reach for a table they do not cover. The whole point of principle II is that
ergane's internals may change shape without breaking the pane — and they already did once (N28). A
reader is a contract; a schema is not.

**What this does not solve.** These readers are exported and durable-*ish*, not durable. A
re-dispatch overwrites a node's rows (N28) and nothing here changes that. So a spec riding them
renders **the current record**, honestly labelled, and does not claim a history it cannot keep. The
durable store remains the prerequisite for 007, and is filed to the ergane agent as PR-1 in the
platform requirements section of the feedback log.

**And they do not carry the model.** `VerificationResult` has eighteen columns and none of them is
the persona or the model alias; the only authority is the epic's Temporal start payload, which
expires with the workflow. A consumer must render that as unknown rather than guess from the
registry, because the DEBUGGER rung relabels the persona without re-resolving the model and the two
disagree. Filed as PR-2.

**Why an entry at all.** Constitution II is a closed list by design, and adding to it is the
operator's act, not a node's. This entry is what makes spec 013 legal.

## D-021 · Constitution I admits writes by test, not by list (decided 2026-08-25)

**Raised by** the operator, 2026-08-25 ~10:30 PM CT, asked directly whether to hold principle I's
one-verb line or amend it so the two human-in-the-loop rooms — 010 (an idea becomes a spec) and 011
(the work comes back for review) — can be refined at all. The answer was to amend, with guarded
writes.

**What was wrong with the old shape.** Principle I forbade a *list*: "no pause buttons, no dispatch
forms, no spec editing." A list cannot distinguish a write that is dangerous from a write that is
merely a write, and it cannot express the one thing that actually governs safety here — whether the
write rides a seam ergane exports. So the principle refused a spec-authoring room on the same grounds
it refuses a kill button, which is not a distinction anybody would defend on the merits.

**Decided.** Principle I becomes a test with six clauses (seam, named, scoped, confirmed, reported,
consequence stated) over four named grooming writes: Create a spec draft, Commission its trio, Save
an edit to the trio, Declare it `ready` or `deferred`. Answer is unchanged. Dispatch, kill, pause,
reset, any write outside `specs/`, and any write to a factory store stay forbidden by name.

**Clause 1 refuses all four verbs today, and that is the point.** `ergane spec` exports `list`,
`validate`, `derive` and `landed`, and every one is read-only; `SpecState`'s own docstring
(`factory/roadmap/models.py:66`) says intent is *declared* by the operator and progress is *observed*,
which assumes a human with a text editor. There is no `spec new` and no `spec ready`. So this
amendment grants no capability on the day it lands. It changes what has to happen *next*: with the
old principle, building the grooming room required amending the constitution **and** waiting for a
seam; with this one, it requires only the seam. Filed to the ergane agent as **PR-7** in the
platform-requirements section of the feedback log.

**Why a test and not a longer list.** The failure mode a list produces is exactly what D-005 forbids:
faced with a refusal and a real need, an implementer re-derives the logic locally — a pane that flips
`state: ready` by writing two characters into markdown is re-implementing the roadmap's readiness
rules in a second language, in a second repository, guaranteed to drift. Clause 1 makes that
impossible to reach by accident, because there is nothing to ride.

**The clause that is doing the safety work after clause 1 is clause 6.** Declaring a spec `ready` is
the most expensive act in the product — the roadmap dispatches within 300 seconds, spending tokens,
opening pull requests and moving the landing branch. Today that act is performed by editing two
characters in a file, with no confirmation, no audit row and no precondition check; on 2026-08-25 a
flip of spec 013 was silently lost inside a multi-file pull request because of it (#58, redone as
#60). A control that states the consequence before it fires is strictly better than the `sed` it
replaces.

**Interim behaviour, and it is not a placeholder.** Until a seam exists, a room that needs one of the
four verbs **composes the change and hands the operator the file to save**, writing nothing itself.
That is 011's Option C, and for a review room — whose output is a draft by nature — it may turn out
to be the right permanent answer rather than a stopgap.

**Supersedes** the second sentence of D-001's rule. D-001 otherwise stands: a requirement that needs
a write this principle does not name is still a defect in the requirement.
