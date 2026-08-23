---
name: "floor-status"
description: "Report what the factory floor is doing right now and when the remaining work will land: active nodes, per-spec backlog, and an ETA table derived from measured cycle times rather than guesses. Use when asked for status, an ETA, or what is left to build."
compatibility: "Requires the ergane CLI on PATH via ~/.config/ergane/ergane-env.sh, gh authenticated, and a checkout of this repository"
metadata:
  inherited_from: "bryantharpeorg/ergane .claude/skills — adapted 2026-08-22: env script at ~/.config/ergane/ergane-env.sh, runtime root at $ERGANE_ROOT"
  author: "operator session, 2026-08-16"
user-invocable: true
disable-model-invocation: false
---

# Floor status

Answer three questions, in this order, and never from memory:

1. **What is running?** — dispatched nodes with the **persona and model each is
   on**, and open pull requests.
2. **What is left?** — landed-versus-total per spec.
3. **When does it land?** — an ETA table driven by **chain depth**, not story count.

The whole point is that every number is measured. `CLAUDE.md` says this
repository can answer questions about itself; a status report that recites a
remembered figure is worse than no report, because it reads as evidence.

## Ask the tree first

```bash
eval "$(~/.config/ergane/ergane-env.sh)"     # NOT `source` — it emits export lines
git fetch origin --quiet
```

**Open pull requests, with their arm state:**

```bash
gh pr list --repo bryantharpeorg/ergane --state open \
  --json number,mergeStateStatus,autoMergeRequest \
  --jq '.[] | "#\(.number) \(.mergeStateStatus) auto=\(.autoMergeRequest!=null)"'
```

`auto=false` on its own means nothing, and reading it as a dropped arm will
send you re-arming PRs that are already merging. **A PR's `autoMergeRequest`
goes null the moment it enters the merge queue**, so the armed-and-progressing
state and the arm-dropped state look identical in that column. You have to ask
the queue:

```bash
gh api graphql -f query='{repository(owner:"bryantharpeorg",name:"ergane"){
  mergeQueue(branch:"ergane-buildout"){entries(first:10){nodes{
    position state pullRequest{number}}}}}}' \
  --jq '.data.repository.mergeQueue.entries.nodes[]? | "q\(.position) #\(.pullRequest.number) \(.state)"'
```

Read the two together:

| `auto=` | in the queue | meaning |
| --- | --- | --- |
| `true` | no | armed, waiting on checks — fine |
| `false` | **yes** | in the queue — fine, this is the normal post-entry state |
| `false` | **no** | **the arm dropped.** Work stalled on you, not on the queue |
| `true` | yes | transient, mid-entry |

Only the third row needs action: re-enqueue with a bare `gh pr merge <n>`.
The drop is real and it happened repeatedly on 2026-08-16 — but so did the
false alarm, which cost a `gh pr merge` against a PR already at queue position
one. Check both before you touch anything.

**Backlog per spec** — `landed` reads git, `state:` reads frontmatter, and they
disagree whenever nobody has attested a completed epic:

```bash
for d in <spec-dirs>; do
  t=$(grep -c '^### User Story' specs/$d/spec.md)
  l=$(uv run ergane spec landed specs/$d --default-branch ergane-buildout 2>/dev/null | grep -c 'landed at')
  printf "  %-30s %s/%s\n" "$d" "$l" "$t"
done
```

**`--default-branch ergane-buildout` is not optional.** `ergane spec landed`
scans `main` by default and the factory does not land there, so the default
under-reports between promotions.

**Chain depth per spec**, which is what actually governs the ETA:

```bash
uv run ergane spec derive specs/$d --target-repo "$PWD" --json 2>/dev/null | uv run python -c "
import json,sys
g=json.load(sys.stdin).get('graph',{})
nodes={n['id']:(n.get('depends_on_merged') or []) for n in g.get('nodes',[])}
def depth(i,seen=()):
    if i in seen: return 0
    return 1+max([depth(d,seen+(i,)) for d in nodes.get(i,[])] or [0])
print('depth', max([depth(i) for i in nodes] or [0]), 'nodes', len(nodes))"
```

**Node progress**, for anything dispatched into a worktree — commits against the
node's own base, and the last subject line:

```bash
git -C "$wt" log --oneline origin/ergane-buildout..HEAD | wc -l
git -C "$wt" log -1 --format='%s'
```

**Which persona and model each running node is on.** Report this in "what is
running" — a floor where one epic is on the house implementer and another is on
a subscription-routed Opus is two different cost and latency stories, and a
status that hides it is reporting an average nobody is experiencing.

Neither obvious source works. **`build status --json` does not carry `persona`
at all** — its node keys are attempt/branch/landing_history/landing_state/
pr_number/provenance/recovery_cycles/state/terminal_reason/verified. And the
on-disk `specs/<dir>/workgraph.json` **lies for anything the roadmap
dispatched**, because the roadmap derives its own graph in-process and never
writes it back: on 2026-08-20 the on-disk graph read `implementer` for all three
068 nodes while the running epic was `opus-closer` throughout.

**Pivot on persona, not on node.** A node-per-row table repeats `persona`,
`model` and `route` identically down every row of an epic — four nodes is the
same three values four times, and the repeated columns are exactly the ones
carrying the cost story. Name each persona once with the five or six fields
common to every node it runs, and collapse the nodes to one line:

```bash
eval "$(~/.config/ergane/ergane-env.sh)"
python3 .claude/skills/floor-status/scripts/running-by-persona.py
```

```
  implementer
    model      claude-opus-5
    route      subscription — unmetered
    fallback   none
    write      worktree
    timeout    14400s (4h)
    context    1,000,000
    nodes      002/us1 MERGED·1  002/us2 MERGED·1  002/us3 RUNNING·1  003/us1 RUNNING·1
    AT RUN     claude-opus-5, ollama-cloud/kimi-k2.7-code  ← differs from the registry

  debugger
    model      claude-opus-5
    ...
    nodes      003/us3 VERIFYING·2

  not yet dispatched
    nodes      002/us4 PENDING·0
```

Personas running live work sort first; undispatched nodes fall to their own
group rather than filling the table with em-dashes.

**The `AT RUN` line is the point of the pivot.** Grouping makes a model that
disagrees with the registry a single visible row instead of something you find
by diffing two columns by eye. It fires whenever the models observed on a
persona's nodes differ from what the registry names — which happens for real in
two ways: the DEBUGGER rung relabels the persona for the key alias and the
history record but never re-resolves `model_alias`, and an epic snapshots its
persona→model resolution at dispatch (`resolve_persona` is "called once at epic
start"), so a registry edit never reaches a running epic. Report the rung and
the model separately; they disagree.

**Where the data comes from, and two dead ends.** The script reads `ergane
status`, which prints persona *and* model per node and needs no Temporal CLI —
that matters under `temporal.mode = "managed"`, where no `temporal` binary
exists on the host. **`build status --json` does not carry `persona` at all**
— its node keys are attempt/branch/landing_history/landing_state/pr_number/
provenance/recovery_cycles/state/terminal_reason/verified. And the on-disk
`specs/<dir>/workgraph.json` **lies for anything the roadmap dispatched**,
because the roadmap derives its own graph in-process and never writes it back:
on 2026-08-20 the on-disk graph read `implementer` for all three 068 nodes while
the running epic was `opus-closer` throughout. Never run `ergane spec derive`
to find out — it writes `workgraph.json` into the checkout even with `--json`
and no `-o`, and that write trips the worktree-boundary detector against
whatever agent is running (N35).

The registry supplies everything below the persona name. `factory` lives in the
tool venv rather than on the system path, so the script locates
`~/.local/share/uv/tools/ergane-cli/lib/python*/site-packages` itself — you
should not have to remember which interpreter to run it with.

**`route` is the column that matters for cost.** `gateway` bills per token
through LiteLLM; `subscription` runs on the operator's own Claude Code login and
bills nothing per token. `closer` and `opus-closer` both point at Opus 5 and
differ only here.

**Confirm it at the process when an agent is actually mid-attempt**, because the
registry says what *should* have been resolved, not what is running:

```bash
systemctl --user status ergane-worker --no-pager | grep -oE '\-\-model [^ ]+' | sort | uniq -c
```

Two traps in reading that output. A node in VERIFYING or ENQUEUED has **no**
agent process, so an empty result is normal and is not a stalled epic. And a
line reading `--model anthropic/CHANGEME` is **not** a misconfigured node — it is
a pytest fixture's stub binary under `/tmp/pytest-of-*/`, spawned by a gate run,
and `anthropic/CHANGEME` is the test suite's own `MODEL_ALIAS` constant. Check
the parent before reporting it as a defect.

A model change also **cannot** be read from the ladder. The DEBUGGER rung
relabels the persona for the key alias and the history record but never
re-resolves `model_alias`, so an escalated attempt runs the model that just
failed — `interpreter/debugger-escalation-does-not-change-the-model`. Report the
rung and the model separately; they disagree.

## Building the ETA table

**Chain depth governs, not story count.** Six independent stories finish in one
round; six chained stories take six. Report per chain, and name the longest one
as the critical path explicitly — it is the only number that moves the finish.

Per-story wall time = **agent build + landing overhead**:

- **Agent build**: measured 24–84 minutes on 2026-08-16 across a dozen stories,
  median around 55. Re-measure from the current session's own task durations
  rather than reusing that range; it will drift with model and story shape.
- **Landing overhead**: boundary gate ~4:15, judge 2–4 minutes, PR and merge
  queue 10–20. Roughly 25 minutes, and **the judge can run concurrently with the
  gate** — it is network-bound and the gate is CPU-bound. Serialising them costs
  four minutes a story for nothing.

So a story is roughly **1.0–1.75 hours** with up to four nodes in parallel.

### State the assumptions the number rests on

A range without its assumptions is a guess wearing a decimal point. Always say:

- **Rework rate.** On 2026-08-16 it ran ~45% — five of eleven stories needed a
  second pass, each costing +20–55 minutes. Fold it *into* the ranges and say you
  have, rather than adding it as a surprise later.
- **What would blow the estimate**, concretely and from the record — not
  "unknowns". Two live incidents that day (test schedules created on the
  production namespace, a toolchain regression) each cost about an hour of
  operator attention and neither was predictable.
- **Sample size.** One day of data with 2–3× variance is a planning number, not
  a commitment. Say so.

### Every clock time is Dallas local

The operator is in Dallas. Report ETAs, forecasts and deadlines in
`America/Chicago` (`TZ=America/Chicago date`) and label them `CT` — "001 complete
by 5:10 PM CT", never "22:10Z". A UTC ETA makes the reader do arithmetic on every
row, which defeats a table meant to be skimmed.

Machine timestamps quoted **as evidence** — log lines, `epic_status` answers,
verification-store rows, GitHub API fields — stay verbatim in UTC, because
rewriting them breaks the search that would confirm them. Put the CT time beside
such a value, never in place of it.

### Then give the one number you would actually bet on

End with a single narrow claim backed by why — "048 complete within two hours,
because its last story is already three commits in". A table of ranges plus one
falsifiable bet is more useful than five confident ranges.

## Things that are not in the numbers and should be said anyway

- **Degraded surfaces with known expiries.** `ergane roadmap status specs`
  resolves the newest `roadmap-specs*` run regardless of whether it failed, so
  one failed run breaks the verb until it ages out of the 72-hour retention
  window.
- **Whether the roadmap schedule is paused**, and whether that is deliberate.
- **Findings direction.** Report the open/critical count *and* whether it rose.
  A day of hard running should raise it — findings come from running things, not
  from reading them — and a falling count during heavy work is the suspicious
  one.
- **File contention.** `depends_on_merged` models what a story needs to *exist*,
  not what it will *touch*. Two correctly-independent stories of one epic can
  both extend one file; `factory/cli/init.py` took eight commits in a day and
  cost two hand-merges and a rework cycle. If two in-flight nodes plausibly touch
  the same surface, that is a real risk line, and it will present as tests dying
  after a clean rebase rather than as a conflict.

## Rendering

**Every table in the report gets borders.** The running-nodes block above prints
its own; the rest — backlog, ETA, per-spec landed counts — are markdown tables,
so give them a header separator row and let them render as tables rather than as
aligned text. A status report is skimmed, and an unbordered column of states
reads as prose at a glance.

Keep the ETA table one row per *item*, not per spec, whenever a spec's nodes have
diverged: "068/us2 recovery → 2:15" and "068/us3 likely conflicts → 2:45" are two
different facts and collapsing them into "068 → afternoon" hides the one that
needs a decision.

## Honesty rules

- **"Everything is green" is almost never true.** Separate *green* from *not
  green but not blocking* and say both. The second list is the one worth reading.
- **Distinguish what you ran from what you were told.** An agent's report is
  evidence, not proof; a merge-group build is the gate, and a pull request's own
  green check proves little.
- **If a number moved since the last report, say which way and why.** An estimate
  that silently improves reads as noise; one that improves *because three of four
  nodes are nearly done* reads as information.
