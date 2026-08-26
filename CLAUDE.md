# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

The **operator pane** for [Ergane](https://github.com/bryantharpeorg/ergane), an agentic
software factory — and a target repository of that same factory (D-003). The pane is a
minimal web front end with two rooms: the **Desk** (read the floor at a glance: epics,
attention items, findings, spend) and the **Showfloor** (each epic's work graph staged as
a state-lit DAG). Today it has exactly one verb, **Answer**, and it never replaces the
CLI. D-021 admits four further *grooming* writes by test rather than by list, and every
one is refused today for want of an ergane authoring seam — see constitution I.

Start with `CONTEXT.md` (the conceptual model), then `docs/decisions.md` (D-001…D-022,
the binding design decisions), then `specs/`. `docs/greenfield-log.md` is the append-only
record of how the repository came to be.

## This file has two audiences

It is committed, so it is loaded both by an **operator session** on the host and by every
**dispatched node** Ergane runs inside a worktree of this repo. Sections marked
`[operator]` describe host machinery a sandboxed node cannot reach — a node has a
factory-owned `HOME`, no Docker, and no access to the operator's filesystem.

**The constitution governs, not this file.** `.specify/memory/constitution.md` is injected
into every node's prompt via the `standards` key in `ergane.yaml`. This file is
orientation; the constitution is binding. Where they disagree, the constitution wins.
Its eight principles in one line each: writes are admitted by a six-clause test and only
Answer passes it today (D-021); the pane
rides ergane's library seams, never shells the CLI and never re-implements the floor;
degradation is honest and explicit (a dead factory is shown, not hidden); every claim in a
spec is provable from the diff, headless; fixtures are recorded from a real floor, never
invented; one token guards every route and no credential reaches a page, an event, a log
or a fixture; dependencies come from the approved roster — ask before adding one; the pane
is built to `DESIGN.md`.

## Two package worlds, four gates

| World | Tool | Lives in | Gates |
|---|---|---|---|
| Backend (FastAPI, ergane seams) | `uv` | `pane/`, `pyproject.toml` | `uv run pytest -q` |
| Frontend (Vite + React + TypeScript, React Flow) | `npm` | `web/` | `npm --prefix web run typecheck` · `test:unit` · `test:smoke` |

Declared in `ergane.yaml` (schema v2) and nowhere else. Fresh-checkout setup is
`uv sync` then `npm ci --prefix web` (the smoke gate also needs
`npx --prefix web playwright install chromium`). Spec 001's scaffold story is what makes
every gate command exist and exit 0; until it lands, `ergane.yaml` is a promise.

**A gate does not inherit the attempt's `HOME`** (D-013). Gates run in the factory's sandbox
with a fresh tmpfs `HOME`; only the worktree survives from the attempt into the gate. Whatever a
gate needs must be inside the worktree or fetched by the gate command itself (the boundary has
egress). The Playwright browser is the case that bites. `PLAYWRIGHT_BROWSERS_PATH=0` puts it in
`web/node_modules`, which persists into the gate — but Playwright reads that variable from the
environment on **every** invocation, so setting it only in `postinstall` installs the browser into
the worktree and then fails to look for it there. Set it on the test run too:
`"test:smoke": "PLAYWRIGHT_BROWSERS_PATH=0 vite build && PLAYWRIGHT_BROWSERS_PATH=0 playwright test"`.

- The backend depends on `ergane-cli==0.2.0` from PyPI (D-011) and imports its seams
  (`factory.cli.status.collect_floor`, the `epic_status` Temporal query,
  `factory.escalation.client.open_escalations`, `factory.usage.ledger.rollup`,
  `factory.doctor.store`, `factory.verify.store`, `CallbackBridge.handle_relay`).
- `PANE_DEMO=1` serves the recorded **Fixture floor** under `fixtures/` instead of a live
  factory. Every test runs against that fixture-backed seam; no gate needs a live floor.
- SSE events are typed `{type, data}`; consumers ignore unknown types.

## Landing discipline

Applies to everyone, operator and node alike.

- **The landing branch is `dev`** (D-011). `main` is promoted from `dev` by the operator at
  milestones. Direct pushes to `dev` are refused by ruleset; every change goes through a PR
  and the merge queue.
- **Squash-only, and the PR title becomes the commit subject.** `ergane spec landed` reads
  the story out of that subject, so a vague title is work the factory cannot see it did.
  One story per PR.
- **Every gate in `ergane.yaml` has a job of the same name** in
  `.github/workflows/ergane-gates.yml`, and `dev` requires exactly those checks. A gate the
  forge does not run does not exist.
- The merge queue re-runs the gates on a `merge_group` event after the PR checks pass, so
  expect two workflow runs per landing.

## Specs: two status conventions that do not talk to each other

- **Ergane** reads YAML frontmatter at the top of `specs/<dir>/spec.md`: `state:`
  (`draft` | `ready` | `deferred` | `landed`) and `depends_on_landed: [...]`. A spec with
  no frontmatter reads as `draft` and never dispatches. 002 and 003 carry
  `depends_on_landed: [001-the-desk-sees-the-floor]`.
- **Spec Kit** writes `**Status**: Draft` as prose in the body. Ergane does not read it.

Only `state: ready` with every `depends_on_landed` edge landed will dispatch. Check what
Ergane sees: `ergane spec list specs`. The roadmap scheduler reads the **local working
tree** on a 300 s timer, so an uncommitted `ready` is live immediately — but the node
works in a worktree, which carries only committed files. Commit before you flip.

## A spec dispatches only through its `## Work Graph`

Ergane compiles one thing: the `## Work Graph` section holding exactly one fenced YAML
block, one entry per user story, five keys (`depends_on`, `depends_on_merged`,
`implements`, `timeout`, and nothing else). Prefer `depends_on_merged` when stories share
files — every node branches from `dev` at dispatch. A node's task slice is the `tasks.md`
section whose level-2 heading names its story (`## Phase n: User Story n - …`); task lines
carry `[USn]` and a `(spec USn-Sk)` citation. Setup/Foundational phases reach no agent —
shared groundwork goes inside the phase of the story that needs it first.

## Commands

`[operator]` Load the environment first — every `ergane` command needs it:

```bash
eval "$(~/.config/ergane/ergane-env.sh)"
```

`[operator]` Health, in the order worth checking:

```bash
ergane install --verify      # control-plane probes
ergane init --check          # per-repo readiness; writes nothing
ergane status                # what the floor is doing
ergane escalations list      # what is waiting on you
ergane findings list         # open defects
systemctl --user status ergane-worker ergane-bridge ergane-temporal
~/code/litellm/up.sh ps      # gateway; use up.sh, NOT bare docker compose
```

`[operator]` Dispatching by hand instead of waiting for the scheduler:

```bash
ergane spec validate specs/<dir>
ergane spec derive specs/<dir> --target-repo "$PWD" -o docs/dags/<dir>.json
ergane build start docs/dags/<dir>.json
ergane build status <epic-id>
```

Running the pane:

```bash
# PANE_TOKEN is not optional. Since 003 landed, the pane refuses to start without
# it rather than serve open (constitution VI) -- 001's open auth seam was a dated
# interim and D-010 said 003 would close it. It did.
export PANE_TOKEN="$(python3 -c 'import secrets;print(secrets.token_urlsafe(24))')"
PANE_DEMO=1 uv run uvicorn pane.app:app --port 8787   # fixture floor, no factory needed
npm --prefix web run dev                               # Vite dev server against it
```

Every route is behind that bearer token, the Showfloor included (D-007): an
unauthenticated `GET /api/floor` **or** `GET /showfloor` answers 401.

## Layout worth knowing

- **`specs/<feature>/`** — `spec.md` (the corpus the scheduler walks), `plan.md`,
  `tasks.md`. Three specs, tracer-bullet order: 001 the Desk → 002 the Showfloor ∥ 003
  the Answer.
- **`DESIGN.md`** — the pane's visual authority (constitution VIII, D-012): tokens, faces,
  the eleven-state glyph grammar, the milestone bar, motion. `PRODUCT.md` is the product
  truth behind it; `.impeccable/mocks/` holds the two comps it was recorded from.
  `web/public/fonts/` carries the vendored OFL faces — never load a remote stylesheet.
- **`docs/dags/`** — the derived work graphs, archived for review before dispatch.
- **`fixtures/`** — the recorded Fixture floor with `README.md` provenance. Recorded,
  never invented (constitution V). Credential sweep before every commit.
- **`.claude/skills/`** — 10 Spec Kit skills, committed so dispatched nodes can see them,
  plus five operator skills inherited from ergane's own `.claude/skills` and repointed at
  this repo's paths (`~/.config/ergane/ergane-env.sh`, `$ERGANE_ROOT` in place of
  `.factory/`): `floor-status` (measured status and an ETA from chain depth),
  `escalation-triage` (a decision brief; it never presses a button), `away-mode` (the
  self-paced overnight loop — park beats guess), `build-metrics` (LOC, commit sizes,
  rework rate; its `reference/baseline-2026-08-19.md` holds *ergane's* numbers, labelled
  as such), and `spec-html` (a spec trio as one page with the Work Graph drawn). `[operator]`
  in practice — a node has no CLI, no `gh`, and no runtime root
  (worktrees carry committed files; the operator's `~/.claude` is invisible to a node).
- **`.specify/`** — Spec Kit templates, scripts and `memory/constitution.md`.
- **`.ergane/`** — gitignored runtime root. Never commit it.

## `[operator]` Host machinery outside this repo

- **Gateway** — `~/code/litellm`, LiteLLM + Postgres on `127.0.0.1:4000`; Ergane mints a
  model-constrained virtual key per attempt. Drive it with `./up.sh`.
- **Secrets** — `~/.config/ergane/*.env`, mode 600, outside any repo. Never print values.
- **Registry** — `~/.config/ergane/personas.yaml` is the only place a model name may
  appear. This build: Kimi (`ollama-cloud/kimi-k2.7-code`) builds, GLM
  (`ollama-cloud/glm-5.2`) judges, `local/qwen3.6-27b` is every fallback, and no persona
  routes to a metered provider (D-011).
- **Feedback** — this build is a dogfooding run. Every friction point with ergane goes in
  `~/code/ergane-feedback-round2-2026-08-22.md` as it happens, with `file:line` into the
  read-only checkout at `~/code/ergane`.
