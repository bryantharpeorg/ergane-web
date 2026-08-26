# Implementation Plan: The gates measure themselves

**Spec**: `specs/015-the-gates-measure-themselves/spec.md` · **Landing branch**: `dev`
**Authority**: constitution IV and VII; `CLAUDE.md` § Two package worlds, four gates;
D-013 (the gate boundary's `HOME` is a tmpfs). No `DESIGN.md` amendment — nothing
here renders.

## The shape

Three stories, serial. Every one of them edits `ergane.yaml` and
`.github/workflows/ergane-gates.yml`; two stories editing one manifest concurrently
is N38, and N38 presents in the merge queue rather than in the pull request, which
is the expensive way to find out.

## Decisions

- **D1 — the floor is committed, not passed.** `--cov-fail-under=NN` on a command
  line hides the number inside the manifest string. Put it in `pyproject.toml`'s
  `[tool.coverage.report] fail_under` and the vitest config's
  `coverage.thresholds`, so a reader sees the floor without running anything and a
  change to it shows up in a diff as a change to a policy.

- **D2 — the floor is the measured baseline, not a round number.** Measure, then
  write that number down. A floor of 80 chosen because it is 80 either fails on
  the day it lands or is slack from the start. This story's job is to stop
  *regression*, not to assert a target the operator never set.

- **D3 — the artifact formats are chosen by what PR-3 will collect, not by taste.**
  Cobertura `coverage.xml` for Python and vitest's JSON summary for the frontend
  are what every collector already understands. Stable paths, standard formats,
  no bespoke wrapper. This is the whole reason the spec's frontmatter says the
  reversal of N54 is narrow.

- **D4 — `audit` fails on severity, not on existence.** A gate that goes red for a
  moderate advisory in a transitive dev dependency with no available fix is a gate
  that gets deleted within a week. Record everything in the JSON; fail on the
  declared threshold only.

- **D5 — a failed lookup is not an all-clear.** If the advisory database is
  unreachable, the gate fails naming the network. Reporting "0 vulnerabilities"
  from a lookup that never happened is constitution III's exact failure mode,
  applied to security.

## Named traps

- **A gate does not inherit the attempt's `HOME` (D-013).** Gates run in the
  factory's sandbox with a fresh tmpfs `HOME`; only the worktree survives. Any
  coverage or audit tool that caches into `$HOME` will work in the attempt and
  fail at the gate. Everything must resolve inside the worktree or be fetched by
  the gate command itself. This is the same class of bug as the Playwright browser
  path, and that one cost a full rework cycle.

- **A gate the forge does not run does not exist.** `CLAUDE.md` § Landing
  discipline: every gate in `ergane.yaml` needs a job of the same name in
  `.github/workflows/ergane-gates.yml`. US3 adds a fifth gate, so it adds a fifth
  job in the same diff. **It cannot add the branch ruleset requirement** — a node
  has no `gh` and no admin. That is operator work after landing, and it is stated
  in the spec's Assumptions so nobody tries.

- **Three new dependencies, and constitution VII binds.** `pytest-cov`,
  `@vitest/coverage-v8`, `pip-audit`. The operator approved exactly these three by
  approving this spec. **A fourth is a stop-and-ask, not a judgement call** — in
  particular, do not add an SBOM generator, a SARIF converter, or a second audit
  tool because the first one's output looked awkward.

- **Do not build a reader.** Nothing in `pane/` or `web/src` may open these
  artifacts. The spec's Out of scope says why, N54 says why, and PR-3 is the thing
  that makes reading them correct. A "small helper that just parses coverage.xml
  for the Desk" is the fragmentation this whole spec was written to avoid.

- **Coverage measurement changes test timing.** The backend suite runs in ~9
  seconds today; instrumentation will slow it. If the smoke gate's Playwright
  timings shift as a result, that is a real effect, not flakiness — do not paper
  over it by raising timeouts.

## Gates

The four in `ergane.yaml` while US1 and US2 land, five once US3 does. Each story's
own gate run exercises the artifact it adds, which is the cheapest possible proof
that the sandbox can produce it.
