# Validation — the pane, from a fresh clone

**2026-08-23, 08:05–08:20 CT.** Run by the operator session against a clean
`git clone --branch dev` of this repository at `572118c`, in a scratch directory
outside the working tree. Every command below is quoted verbatim from
`ergane.yaml`, which is the only place the gates are declared.

This is Phase 6 of the build run: the factory verified each story against its own
gates and its own judge, twelve times. That is the factory agreeing with itself.
What follows is the independent check.

## Setup, exactly as `CLAUDE.md` documents it

```
uv sync                                            ok
npm ci --prefix web                                ok
PLAYWRIGHT_BROWSERS_PATH=0 npx --prefix web playwright install chromium   ok
```

No step needed a workaround. `CLAUDE.md`'s fresh-checkout instructions are
accurate.

## The four gates, verbatim

| gate | command | result |
|---|---|---|
| test | `uv run pytest -q` | **PASS** — 371 passed, 2 skipped, 0.93s |
| typecheck | `npm --prefix web run typecheck` | **PASS** — `tsc --noEmit` clean |
| unit | `npm --prefix web run test:unit` | **PASS** — 23 files, 153 tests, 1.02s |
| smoke | `npm --prefix web run test:smoke` | **FAILS INTERMITTENTLY — see below** |

### The smoke gate is ~50% flaky, and the factory could not have seen it

```
FAILED [showfloor] tests/smoke/showfloor.spec.ts:8
  the Showfloor stages the fixture floor read-only
  expect(foundStageWithNodes).toBe(true)   at showfloor.spec.ts:54
```

Measured over four full runs of the gate command: **2 failed, 2 passed.** Run in
isolation (`--project showfloor`), the same test passed **3 of 3**.

The assertion waits for `[data-epic-stage]` and then requires a `[data-station]`
inside it to be *visible*. `waitForSelector` returns when the stage container
exists, but a React Flow canvas lays its nodes out asynchronously and needs a
sized container; under the full suite — three projects, more contention — the
station is sometimes not yet visible when the assertion runs. Nothing about the
Showfloor is wrong: the same run's `pure glass sweep` and the other five tests
pass every time, and the stations render correctly in a browser.

**Why no gate caught it.** Each story's gate ran once, passed, and moved on. A
50% flake passes half the time, and the factory has no notion of running a gate
twice. The merge-group build re-runs the gates on the speculative merge — which
is why the queue is worth keeping — but it too runs once.

**Suggested fix (not applied here):** wait for the station rather than the stage —
`await page.waitForSelector("[data-station]")` before the per-epic loop, or
`await expect(firstStation).toBeVisible()` with Playwright's auto-retry instead of
`isVisible().catch(() => false)`, which converts "not ready yet" into "not there".

## The pane actually runs

`PANE_DEMO=1 … uvicorn pane.app:app` against the recorded Fixture floor.

**It refused to start at first, and that is correct:**

```
ValueError: PANE_TOKEN is not set; the pane refuses to start rather than serve open
```

Constitution VI, working. Spec 001 shipped its auth seam open as a dated interim
and 003 closed it, exactly as D-010 said it would. **`CLAUDE.md` is now stale on
this point** — it documents `PANE_DEMO=1 uv run uvicorn pane.app:app --port 8787`
with no token, which no longer starts.

With a token set:

| probe | result |
|---|---|
| `GET /api/floor` unauthenticated | **401** |
| `GET /showfloor` unauthenticated | **401** — the Showfloor is behind the token too (D-007) |
| `GET /api/floor` with bearer | 200 |
| `GET /api/attention` with bearer | 200 |

### The served floor document, checked against the constitution

```
keys: attention, degraded, epics, floor, health, reference_instant, spend_to_date
epics: 6 (fixture floor)
```

| principle | check | result |
|---|---|---|
| II — borrowed seams | `spend_to_date` names `factory.usage.ledger.rollup over factory.usage.cli.open_readonly`; `health` names `factory.doctor.store.list_findings over connect_readonly` | **pass** — the document cites the seam it rode |
| III — honest degradation | `degraded` carries a per-section entry with `mode: "transport"`, the epic id, which read failed, and a detail string; healthy sections still render | **pass** |
| III — spend is spend-to-date | field is literally `spend_to_date`; the string `live` appears **nowhere** in the document | **pass** |
| VI — no credential in a rendered payload | swept the served JSON for `sk-` prefixes, bearer tokens, `PANE_TOKEN`, master keys | **clean on all four** |
| FR-019 — pinned reference instant | `reference_instant: 2026-08-22T17:41:12Z` — the fixture envelope's capture instant, so time-left renders deterministically on any run date | **pass** |

## Verdict

**The pane is real and it obeys its constitution.** Three of four gates are green
from a clean clone; the fourth is a flaky assertion in a test, not a defect in the
Showfloor. The backend serves the recorded floor, refuses unauthenticated reads on
every route including the Showfloor, degrades in words rather than silence, labels
spend honestly, and leaks no credential.

**One defect found that the factory's own process could not find**, and it is the
kind Phase 6 exists for: a gate that passes on the attempt that writes it and
fails half the time thereafter.

## Not validated here

- **The live floor.** Only the recorded Fixture floor was exercised. The
  `ERGANE_WEBHOOK_URL`-to-pane smoke against a running factory has not been run.
- **The Answer verb end to end.** 003's intake and settlement are covered by
  committed tests; no answer has been relayed through a real
  `CallbackBridge.handle_relay` in this validation.
- **Visual conformance to `DESIGN.md`.** Constitution VIII is asserted through
  committed tests, not by an eye, and no eye has been applied.
