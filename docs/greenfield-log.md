# Greenfield log — how this repository came to exist

Raw material for a future write-up: *how to create a greenfield repo using ergane*.
Append-only, timestamped in Dallas time, written as it happened — entries record what
was done, by whom (operator session vs. dispatched agents), and what it cost in
questions, not just what came out. Analysis comes later; this file only records.

The method under test, in one line: **interview → decisions-as-docs → foundations →
multi-agent spec authoring with adversarial verification → (pending) refine → ready →
wire → dispatch — the factory builds the rest.**

---

## Entry 1 · 2026-08-21 7:22 PM CT — the ask

Operator opened an empty directory (`~/code/ergane-web`, not even a git repo) beside
the factory checkout and asked for a *minimal operator pane*, **specs only, no
building**, using the sibling repo's conventions as the mold. The session ran the
grill-with-docs skill: a one-question-at-a-time interview that resolves the design
tree branch by branch and writes each resolution into repo docs as it lands.

First move was not a question: recall from cross-session memory (Hindsight) plus a
read of ergane's `CONTEXT.md`, `README.md`, and tree. The interview only works if the
interviewer already speaks the domain language — Spec/Epic/Node/Attempt, Question vs
Escalation, pass-edge vs merge-edge — and ergane's glossary is strict enough to
answer several questions before they were asked.

## Entry 2 · 7:22–7:38 PM — Q1, and the pivot

**Q1 (glass or hands?)** settled the root: the pane is read-only except one verb —
Answer. Captured immediately as an ADR plus two glossary terms, before question two
was asked. Lesson candidate: *capture at the moment of resolution, not at the end* —
the decision text was still warm and the alternatives still articulable.

Q2 as originally posed (which of the CLI's eight operator questions get screen
space?) was rejected by the operator — not the options, the framing. He wanted
**both** density and spectacle: a flashy live visualization of epics/DAGs building
("demo awesomeness") *and* a proper operator pane. The interview absorbed the pivot
as new scope rather than as a contradiction. Session switched to plan mode here;
decisions kept accumulating in a plan file instead of repo docs until approval.

## Entry 3 · 7:38–7:46 PM — the factory already expected us

An Explore agent was dispatched to inventory ergane's data surfaces while the
interview continued. Its report changed the session's confidence more than any
answer: **ergane had already anticipated this repo.** Spec 046 places "the web status
board" out of scope with the sentence *"it renders its own view from its own reads"*;
spec 008 reserves room for "a second surface later". The seams were all there,
documented and contract-tested: `collect_floor`, the `epic_status`/`roadmap_status`/
`escalation_status` queries, the workgraph schema contract, the usage ledger's
"stable contract" rollup, the webhook adapter with no inbound listener by design, and
the single settling core (`CallbackBridge.handle_relay`).

One genuine gap surfaced *before any code existed*: there is no live in-flight spend
anywhere in the factory — the ledger is written at attempt teardown. The pane's specs
now say "spend to date" everywhere, and the gap is recorded instead of papered over.
Lesson candidate: *scout the target's seams mid-interview; the answers constrain the
questions that follow.*

## Entry 4 · 7:46–7:56 PM — the remaining branches, one recommendation each

Each question carried a recommended answer; the operator accepted six recommendations
and overrode one:

- **Q2′ two rooms** — Showfloor (pure-glass spectacle) + Desk (attention-first, sole
  home of Answer). Accepted.
- **Q3 who builds it** — the factory builds its own pane from Spec Kit specs;
  ergane-web is a wireable target repo. Accepted. This is the decision that turned
  "write specs" from a documentation task into a manufacturing input — every
  acceptance scenario now has to be judge-scorable from a diff and gate-checkable
  headless.
- **Q4 the metaphor** — the spectacle *is* the workgraph: state-lit DAG, solid
  merge-edges vs dashed pass-edges, landing flow into a landed shelf. Accepted.
- **Q5 plumbing** — library-backed: import the ergane distribution, ride its seams,
  webhook in, SSE out. Accepted.
- **Q6 stack** — FastAPI + React/Vite/TypeScript + React Flow/dagre, chosen
  explicitly for *agent buildability and gate-checkability*, not operator taste.
  Accepted.
- **Q7 hosting/auth** — factory host, systemd user unit; the operator **overrode**
  the no-login recommendation and chose a single shared bearer token on every route.
- **Q8 shape of the corpus** — three tracer-bullet epics (desk → showfloor → answer)
  and ergane's doc dialect (immutable decision log, not ADR files; the one existing
  ADR was converted, not kept).

## Entry 5 · 8:04 PM — plan approved, with one instruction

The operator approved the execution plan with a single amendment: **"use dynamic
workflows."** Execution was reshaped as: foundations written inline by the operator
session (voice-sensitive, small), then a multi-agent workflow over the three specs.

## Entry 6 · 8:05–9:03 PM — foundations, then the fleet

Inline, in order: `git init` (branch `main`); `.specify/templates/` copied verbatim
from ergane; `CONTEXT.md` (six pane terms + flagged ambiguities); `docs/decisions.md`
seeded D-001…D-009 in ergane's immutable-log format; `.specify/memory/constitution.md`
(seven principles distilled from the decisions — notably "borrowed seams, never
re-derived logic" and "provable from the diff, checkable headless");
`factory.yaml` draft (four gates: `uv run pytest -q`, `tsc --noEmit` via npm,
vitest, Playwright smoke; `landing_branch: buildout` flagged as an assumption to
confirm at wiring); `README.md` in ergane's register, stating plainly that the repo
contains no code on purpose.

Then the workflow `author-ergane-web-specs` launched: a pipeline over the three spec
definitions — one author agent per spec (reading the template, two exemplar specs,
the foundations, and a verified seam-facts block) → three parallel adversarial
verifiers per spec (factory-surface truth re-grepped against the ergane tree;
judge-scorability of every scenario; language discipline against both glossaries and
the forbidden-word sweep) → a conditional fix agent per spec → one cross-spec
completeness critic checking coverage of D-001…D-009, seam consistency, dependency
declarations, contradictions, and gate realism. Up to 13 agents; no barrier between
specs, so each spec verifies while its siblings still author.

*Why verification got 9 of the 13 agents:* ergane's own spec 079 documents the
failure mode — a spec drafted against a stale tree cited dozens of wrong anchors and
had to be re-derived. Verification is cheaper than a factory attempt spent
discovering the spec lied.

## Entry 7 · 9:05 PM — status at time of writing

Workflow running. Pending for the next entries: the critic's verdict, fixes applied
per spec, final operator-session consistency pass, and — outside this session — the
remaining rungs of the ladder this log exists to describe: refine (plan/tasks per
spec), flip `state: draft → ready`, `ergane init --check` / `--wire`, dispatch 001,
and the moment the Showfloor first renders its own epic building.

---

## Entry 8 · 9:03–9:31 PM — the fleet's numbers

The workflow finished: 16 agents, zero errors, ~1.47M subagent tokens, 489 tool
calls, 28.5 minutes wall clock. Three authors produced ~450-line specs in parallel;
nine adversarial verifiers filed 50 findings that survived severity filtering; three
fix agents applied them (each fix agent re-verified every finding against the cited
sources before editing — and none was rejected as wrong); one critic then re-read
the whole corpus cold.

What verification caught that would have cost factory attempts:
- `factory.yaml` declared schema v1, whose gate vocabulary is closed
  (test/lint/typecheck); the declared `unit`/`smoke` gates would have died at
  CONFIG_ERROR in 0.0s on every dispatch. Moved to v2.
- Strict `tsc` over a React app cannot exit 0 with the constitution's approved
  dependency list — `@types/react` et al. were missing from the roster.
- The runtime root is `.ergane/` now (`.factory/` is legacy); hard-coded store
  paths in the drafts would have read nothing.
- Cross-spec ordering has a real mechanism — `depends_on_landed` in spec
  frontmatter, scheduler-enforced — where the drafts (and D-008's phrasing) had
  hand-waved "merge-edged on 001".
- The countdown trap: recorded webhook payloads carry no Question expiry, so any
  receipt-time arithmetic mints a deadline the factory never set.

## Entry 9 · 9:31–9:40 PM — the critic's verdict, one human ruling, convergence

The critic ruled NEEDS FIXES: 3 severe, 5 moderate, 4 minor — all cross-*document*
seams (contradictions between specs, unowned contracts, constitution drift), which
is exactly the class per-spec verification cannot see. One finding was a genuine
design decision the critic refused to invent: pointing `ERGANE_WEBHOOK_URL` at the
pane routes *all* notify traffic there, so payloads that are neither Question nor
Escalation (supervision alerts, roadmap notices) needed a ruling. The operator
chose: **Notice**, a third attention kind that asks for nothing — recorded as
D-010 alongside the ratified mechanical consequences (roster additions, schema v2,
runtime-root paths, auth interims, seam-list extension, the `depends_on_landed`
vocabulary correction).

The operator session then applied the full fix batch across six documents: 001 owns
the SSE event vocabulary (typed `{type, data}`, one `floor` event; consumers ignore
unknown types) and a fixture minimum sized so **one capture serves all three
epics**; 003 gained FR-019 (the verify-store Question read that supplies real
expiries) and declares its smoke-rewriting of landed tests as in-scope work; the
constitution and glossary were amended under D-010's authority.

Convergence checks: the forbidden-word sweep is clean; no "merge-edged on 001"
survives outside the superseded D-008 text; both dependent specs carry
`depends_on_landed`. Then the factory itself was asked: `ergane spec validate`
against 001 accepts the spec — its only refusals name the missing `plan.md` and
`tasks.md`, the refinement artifacts the next phase exists to produce. The corpus
is ready for operator review.

**Pre-ready checklist left open** (operator acts, in order): (1) review the three
specs; (2) capture the fixture payloads from a live floor — FR-007's list is the
manifest, and the floor should be busy when recorded; (3) confirm the sandbox has
network egress at gate time, or provide a cached channel; (4) confirm
`landing_branch: buildout` at wiring; (5) refine (plan.md/tasks.md), flip 001
ready, `ergane init --wire`, dispatch.

---

## Entry 10 · 2026-08-22 ~10:00–10:50 AM CT — the dispatch ask, and a clean host

A new session, a different shape of ask. The operator: *init yourself in the repo,
read the specs, then use Ergane via the CLI to create yourself — assemble the specs
into EpicWorkflow DAGs, execute them, validate the output against the specs — and
keep a full feedback log on both the installation and the build-out for the Ergane
agent.* Dogfooding that keeps the byproduct. Two constraints arrived mid-interview:
the build runs on Kimi (`kimi-k2.7-code`, Ollama Cloud) with GLM (`glm-5.2`) as
judge, and no persona may route to a metered provider — the gateway `closer` on
`anthropic/claude-opus-5` is gone; the subscription-routed `opus-closer` is the
only opt-in rung, and it asks first.

The host is bare: ergane was torn down 2026-08-19, no Temporal, no tool, no state.
LiteLLM is up at `127.0.0.1:4000` serving the four aliases the registry will name.
`ergane-cli 0.2.0` reached PyPI today — which retires spec 001's "unpublished"
assumption before the first attempt reads it. That, the landing branch, the
manifest rename, the ladder, the routing and the fixture method were settled in a
seven-question interview and recorded as **D-011**.

Phase 0, operator session, inline: branched `dev`; `factory.yaml` → `ergane.yaml`
(`landing_branch: dev`, `ladder: 6/3`); every live mention renamed (decisions and
earlier log entries left as written); 001's assumption amended to pin
`ergane-cli==0.2.0`; D-011; this entry; a `CLAUDE.md` for the two audiences that
will read it (operator sessions and dispatched nodes); the ten `speckit-*` skills
copied from the sibling test repo so nodes can see them. Zero questions asked of
the factory yet — it is not installed. The install is the next entry, and the
feedback log (`~/code/ergane-feedback-round2-2026-08-22.md`) starts there.

---

## Entry 11 · 2026-08-22 10:50 AM – 1:30 PM CT — install, wiring, a design system, and the floor recorded

**Install (10:50–11:05).** `uv tool install ergane-cli==0.2.0` from PyPI, then one
`ergane install --from-file` with a five-block answer file: config and registry written,
seven control-plane probes green in the same pass, zero prompts. The registry was rewritten
per D-011 — Kimi builds, GLM judges, `local/qwen3.6-27b` every fallback, and the metered
`closer` alias deleted outright; the only Opus rung left is `opus-closer` on ergane's
`subscription` agent, which never auto-promotes.

Temporal was the cost. `temporal.mode = "managed"` — spec 042's own path — is a dead end in
0.2.0: `worker install` never reads the declared mode, so the unit is never generated; the
generated wrapper drops every argument after the module name; and nothing creates the
directory the dev server's SQLite file lives in. Three patches to the tool venv (kept as
`.patch` under `~/code/ergane-patches/`) and the server came up. Meanwhile `install --verify`
had been printing `[PASS] temporal` the whole time, because in managed mode it does not dial.

**Wiring (11:02–11:06).** `ergane init --wire --non-interactive` did the entire GitHub side in
one verb — ruleset, merge queue, four named checks, `PR_TITLE`, `allow_auto_merge`, the gates
workflow, the roadmap schedule — and said in words that the default branch and the declared
landing branch disagreed. Two costs: it rewrote the committed `ergane.yaml` and silently
dropped `standards` (the key that injects the constitution into every node) and `ladder`; and
a freshly wired repo cannot land the workflow its own queue requires, so PR #1 went in through
a temporary enforcement toggle.

**A design system (11:10–12:20).** The operator asked that the pane inherit styling rather
than leave appearance to each implementer. Nothing existed to inherit, so one was set: a
product record, two rolled direction rounds with operator steers (no red; not cream or beige;
a tame primary), two built comps, a finish review, and `DESIGN.md` recorded from the built
world — a launch-telemetry mission timeline in a mid-century palette on sage, with the
Showfloor staged as a transit map. Constitution VIII now binds every rendering diff to it.
Recorded as **D-012**.

**The Fixture floor (11:45–1:00).** Hybrid, as decided. A two-story scratch spec was authored
into the sibling test repo and dispatched on Kimi: `us1` landed on attempt 1; `us2` failed the
judge three times for one specific gap (*no JavaScript intercepts the 422 and writes
`errors.note` into `#error-note`*), ran the debugger rung, and landed on attempt 4. **Zero
interventions, zero escalations, two PRs through a real merge queue.** A recorder polled
`epic_status` at three seconds throughout and kept every distinct answer. Then the worker was
stopped for three minutes and ergane's own interpreter harness was run as a worker against the
real Temporal — real notify activities, real store, real webhook adapter — to provoke the
states a happy floor never shows: a node paged while still reading VERIFYING, a query refusal,
escalations with 15- and 20-minute expiries, a question asked and answered and another expired,
six bridge rulings. 80 documents, every one verbatim from a seam, each with an envelope.

Then the sibling repo was forgotten from the factory: only `ergane-web` is provisioned. The
pane is now the factory's only work.

**Refinement (12:25–1:30).** A three-agent workflow authored `plan.md` and `tasks.md` for all
three specs, looping against `ergane spec validate` until clean, then one cross-spec critic.
Two things came out of it that no per-spec check could see. First, spec 002's FR-003 stated no
obligation — no MUST — so ergane refused to compile its work graph at all; the 002 author
diagnosed the exact one-word fix and, forbidden from editing spec.md, said so instead of
guessing. Second, **both authors independently cited the same wrong fixture paths**, because
the recorded set had a `raw-harness/` directory: capture method leaking into consumer paths.
Two independent agents making the same wrong guess is a design finding, not an author error —
the documents were promoted into a semantic layout and the citations now resolve.

The critic returned NEEDS_FIXES with 13 findings, none of them per-spec: assertions that
contradict the recorded documents, an epic that closes the auth seam while landed tests pin it
open, two concurrent epics writing the same four files with no edge available to order them,
and a demo Question that one epic changes out from under another's committed smoke. Each one
is a judge failure the factory would otherwise have discovered attempt by attempt.

---

*(Append below; entries are immutable once written.)*
