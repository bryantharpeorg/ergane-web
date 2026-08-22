---
name: "build-metrics"
description: "Measure what the factory has actually produced: lines of code by language and module, commit-size distribution with outliers trimmed, and the story rework rate with its trend over time. Use when asked how big the codebase is, how large a typical change is, how often stories need a second attempt, or whether the factory is getting better."
compatibility: "Requires a checkout of this repository, python3, git, and perl (for the bootstrapped cloc). Reads $ERGANE_ROOT/*.db read-only; does not need the worker or Temporal running."
metadata:
  inherited_from: "bryantharpeorg/ergane .claude/skills — adapted 2026-08-22: env script at ~/.config/ergane/ergane-env.sh, runtime root at $ERGANE_ROOT"
  author: "operator session, 2026-08-19"
user-invocable: true
disable-model-invocation: false
---

# Build metrics

Three families of measurement, each with a script under `scripts/`. Run only
what was asked for — the rework analysis is the expensive-to-interpret one and
nobody wants a LOC table when they asked about attempt counts.

| Question | Script |
| --- | --- |
| How big is this, by language and by module? | `scripts/loc.py` |
| How large is a typical commit? Does anything ever get deleted? | `scripts/commit_sizes.py` |
| How often does a story need reworking, and is that improving? | `scripts/rework.py` |

All three take an optional repo path and default to the current directory:

```bash
python3 .claude/skills/build-metrics/scripts/rework.py
```

`ergane` is **not on PATH** — anything shelling out to the CLI needs
`uv run ergane`, after `eval "$(~/.config/ergane/ergane-env.sh)"`. The scripts here
deliberately avoid the CLI and read git and the SQLite stores directly, so they
work with the worker down.

## The traps, which are most of the value

Every one of these produced a wrong number first.

### Three commits carry half the churn

The initial 350-file import, the 2.3 MB replay-history capture, and one
spec-drop commit total 179,577 lines — 48% of all churn ever. Raw mean commit
size is 928; trimmed it is 359. **Report both and say which you mean.** A raw
mean here is not a summary, it is a description of three commits.

Note that the Tukey lower fence comes out negative, so **nothing trims from the
low end** — the "outliers on either side" framing doesn't apply. The low tail is
5 zero-churn commits and a run of 2–6 line fixes, all real work. The symmetric
10% trim lands in the same place, which is how you know the low end wasn't
distorting anything.

### 30% of the repo is a machine-generated recording

`tests/fixtures/replay-032/` is ten Temporal replay histories at 5,963 lines
each — 59,630 lines, all JSON, none of it authored. Any "how big is the
codebase" answer that includes it is off by a third. `scripts/loc.py` reports it
as its own row for exactly this reason.

### The insertion:deletion ratio measures youth, not discipline

Repo-wide it reads ~19:1, which looks alarming and means nothing: 116 Python
files were written once and never revisited, and you cannot delete from a file
nobody came back to. The growth-adjusted version buckets files by how many
commits touched them, and the ratio falls monotonically — 50:1 at 2–3 touches,
11.9:1 at 13+. **Quote the 13+ bucket.** `scripts/commit_sizes.py` prints it.

### Rework has two honest definitions, 13 points apart

- **Verification rework** — the story's first attempt was verified `FAIL`.
  Reads 23.3%.
- **Dispatch rework** — the story was dispatched more than once, for any reason.
  Reads 36.8%.

The gap is 16 stories whose first attempt died before verification could judge
it: `agent_error`, `timeout`, `killed`, `question`. Those absolutely are rework
— the story was built twice — and the verification store cannot see them because
nothing was ever verified. **Lead with the dispatch number.** Give the
verification number as the narrower "the gates rejected it" figure.

### `usage_records` has ~2 rows per attempt, not 1

One row per persona: `implementer`, `judge`, and `debugger` when the ladder
climbs. 363 rows over 117 stories is *not* 3.1 attempts per story — it is 1.69.
Always count `distinct attempt` per `(epic_id, node_id)`. Dividing row counts by
story counts overstates rework by roughly 2×.

### The stores do not cover everything that landed

The ledger holds 117 stories. Git shows 148 distinct story landings. The 45
missing ones cluster on `033-ergane-install`, `034-ergane-init`,
`040-manifest-rename` and `041-escalation-workflow` — the specs in flight when
an agent ran `rm -rf .factory` on 2026-08-14. The restic restore came from that
day's 03:06Z snapshot, so everything after it is gone.

`scripts/rework.py` re-runs this cross-check every time and prints the coverage
percentage. **Say it out loud in the report.** The missing slice is not random,
and it does not bias in a knowable direction: `040` and `033/us1` landed
first-attempt (which would drag the measured rate down), while the same era
burned twelve attempts overnight on other stories (which would push it up).
Report the estimate and refuse to call it a census.

### Daily buckets are noise at this volume

116 stories over 14 days means single-digit denominators — you will get 100%
rework days off one story. Use **weekly** buckets and a **rolling 20-story
window** ordered chronologically, which is what the script emits. A rolling
window over stories rather than days is the one that shows a learning curve if
there is one, because it holds the denominator fixed.

### Read the stores read-only, always

`sqlite3.connect("file:{ERGANE_ROOT}/verification.db?mode=ro", uri=True)`. This is
the live store. A skill that reports on the factory must not be a skill that
writes to it, and the one time a test asserted something about that store it
ended in `rm -rf`.

### cloc is not installed and sudo does not work here

`scripts/loc.py` bootstraps it: fetch the standalone Perl script from
`raw.githubusercontent.com/AlDanial/cloc/master/cloc` into the scratchpad and
run it with the system perl. **The GitHub releases URL 404s** and the 404 body
gets executed as Perl, producing `Can't locate object method "Not" via package
"Found"` — which looks like a Perl problem and is actually a download problem.

## What to conclude, not just what to print

**Pair the rework trend with the findings ledger.** Rework rate is the outcome
metric for the whole detect-and-promote loop; `ergane findings list` is the
input side. As of 2026-08-19 the input side is working (204 open findings, real
defects, correctly identified) and the output side is flat (rework 34.4% →
40.5% → 34.9% across three weeks). Two promotions out of 242 findings is the
mechanism connecting them, and it is not running fast enough to move the
number. That pairing is the report's actual finding; the tables are supporting
evidence.

**Separate growth-phase artifacts from structural ones.** In a four-week-old
greenfield, an additive commit ratio and a findings backlog that outruns
resolution are what health looks like — they correct themselves as the tree
matures. What does not correct itself is anything that compounds with dispatch
volume: tests authored by the same process that wrote the code (2.19:1 and
growing monotonically), and gate count as Goodhart surface. If asked to
editorialise, sort the criticisms by that axis rather than by severity.

**A flat trend is a finding, not a null result.** "No improvement over three
weeks and 116 stories" is a stronger, more actionable claim than any single
rate. Say it plainly when it is true.

## Baseline

`reference/baseline-2026-08-19.md` holds the full numbers as measured on
2026-08-19, so a later run has something to diff against. Re-measure rather
than quoting it — but do report which way a number moved, and by how much.
