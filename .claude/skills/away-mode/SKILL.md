---
name: "away-mode"
description: "Put this session on a self-paced loop that keeps the factory floor moving while the operator is away: land what is verified, attest what is complete, dispatch what is ready, answer what agents ask, and park anything that needs a human. Use when leaving the keyboard, going to bed, or asking the session to babysit the floor. `/away-mode off` ends it."
compatibility: "Requires the ergane CLI on PATH via ~/.config/ergane/ergane-env.sh, gh authenticated, a checkout of this repository, and the ergane-worker/-temporal/-bridge user units running"
metadata:
  inherited_from: "bryantharpeorg/ergane .claude/skills — adapted 2026-08-22: env script at ~/.config/ergane/ergane-env.sh, runtime root at $ERGANE_ROOT"
  author: "operator session, 2026-08-17"
user-invocable: true
disable-model-invocation: true
---

# Away mode

The operator has left. Nothing else changes about how this repository works —
the same gates, the same queue, the same constitution — but one thing changes
about **you**: there is no longer anyone to catch a bad call before it costs a
night. So the whole skill reduces to one asymmetry.

> **A parked node costs a wait. A wrong call costs the night.**
> When the two are close, park.

That is not timidity. It is the measured trade: on 2026-08-16 the factory lost
three verified nodes, and every one of them was lost in the landing path by an
automated actor being confident — not by an agent writing bad code.

## Turning it on and off

- `/away-mode` — start the loop.
- `/away-mode <note>` — start it with an extra standing constraint for tonight
  (`/away-mode don't touch 032`, `/away-mode back by 7am`). Treat the note as
  binding and repeat it back in the first tick's log line.
- `/away-mode off` — stop. Call `ScheduleWakeup({stop: true})`, `TaskStop` every
  monitor you armed, and write a closing entry to the away log.

On the very first tick, before anything else, say in one short message what you
are about to do and what you will not do without them. Then work.

## The mechanism

This is a self-paced loop, not a cron job.

1. Run **one tick** (below).
2. Append a line to the away log.
3. As the **last action of the turn**, call `ScheduleWakeup` with
   `prompt: "/away-mode"` (plus tonight's note, verbatim, if there was one) so
   the next firing re-enters this skill.
   - `delaySeconds`: **1200–1800** when something is genuinely in flight and a
     `<task-notification>` will wake you anyway. Shorter only when you are
     polling something the harness cannot notify you about — a merge queue that
     moves in minutes, a CI run you timed. Never poll a background task you
     started; you get woken when it finishes.
   - `noop: true` when the tick changed nothing. Long quiet stretches are the
     normal state of a healthy floor and should collapse in the operator's view.
   - `reason`: what you are waiting on, specifically. "watching #181 through the
     merge group" beats "checking again".
4. Stop when the floor is empty **and** everything left needs a human. Say so,
   `PushNotification` the one-line outcome, and stop. Do not idle-tick against
   an empty floor for hours; that is noise wearing the costume of diligence.

## One tick

Cheapest first, and **land before you dispatch** — a landed story unblocks the
next node's merge edge, so landing is what makes dispatch legal.

```bash
eval "$(~/.config/ergane/ergane-env.sh)"      # NOT `source` — it emits export lines
git fetch origin --quiet
uv run ergane status specs           # roadmap, epics, ready queue, drafts, pace
```

### 1. Land what is verified

Read the arm state and the queue **together** — neither column means anything
alone. `/floor-status` carries the full table; the one row that needs action is
`auto=false` **and not in the queue**, which is a dropped arm and is fixed with a
bare `gh pr merge <n>`. Every other combination is the queue working.

Then verify the landing **on the branch**, by content:

```bash
git fetch origin --quiet && git log origin/ergane-buildout -1 --format='%h %s'
uv run ergane spec landed specs/<dir> --default-branch ergane-buildout
```

**A pull request's `merged` flag can be true while the branch never moved.**
That is not a hypothesis — PR #176 reported merged on 2026-08-16, the file it
added 404'd on the branch, and the story had to be recovered by cherry-pick. A
merged flag is a claim. The branch head is the fact.

`--default-branch ergane-buildout` is not optional; `ergane spec landed` scans
`main`, and the factory does not land there.

### 2. Attest what is complete

When every story of a spec is on `ergane-buildout` by ancestry *and* content,
flip its frontmatter to `state: landed` with the convention already in the tree
(`specs/043-runtime-root-integrity/spec.md` is the model): the date, then each
story's landing SHA and PR number. Validate, branch, PR, arm.

Attestation is not bookkeeping — `ergane status` reads it to decide readiness,
so an unattested finished epic silently blocks whatever depended on it.

### 3. Answer what the agents ask

```bash
uv run ergane build answer <epic>        # pending questions, or answer one
uv run ergane escalations list           # what is waiting on a human
```

Questions from agents are yours to answer; that is the whole point of the
operator channel, and an unanswered question dead-waits its window and then
pages the operator anyway.

**Escalations are not.** Never press an escalation button on the operator's
behalf. Silence is a decision they are entitled to make, and expiry is part of
the contract. Log the escalation, `PushNotification` it if it is time-critical,
and leave it.

### 4. Dispatch what is ready

Only from `ergane status`'s **dispatchable** list. Re-derive the delta *at
dispatch time*, never reuse a remainder file from an earlier tick — the baseline
moved when you landed something, and a stale remainder re-runs landed stories.

```bash
uv run ergane spec derive specs/<dir> --target-repo "$PWD" --delta \
  -o specs/<dir>/workgraph-remainder.json
uv run ergane build start specs/<dir>/workgraph-remainder.json
```

If dispatch fails on a forge blip — a 503, a timeout, a read-after-write miss —
**retry on a bounded loop rather than concluding anything.** GitHub's transient
failures are minutes long; a dispatch that failed four times in a row succeeded
80 seconds later once the retry loop was doing the timing instead of a human.

If Ollama returns **429**, stop dispatching and back off a full hour. Do not
retry into a rate limit; you will only extend it.

### 5. Watch what is in flight

```bash
uv run ergane build status <epic-id>
git -C "$wt" log --oneline origin/ergane-buildout..HEAD | wc -l
```

A node that has produced no commit in well over the measured build range
(24–84 minutes, median ~55, on 2026-08-16) is a stall, not slowness.

**Do not trust the newest attempt directory to be the live attempt.** Read
`ATTEMPT_ARCHIVE` from the running bwrap process instead. A stale `attempt-4`
log from a killed morning run once produced a confident, entirely false report
that an agent had done work and never committed it.

### 6. File what you learned

Anything that broke and is not already in the ledger:

```bash
uv run ergane findings report --key <category>/<slug> --category <cat> \
  --severity warning --summary "..." --notes "<reproduction, not narration>"
```

A finding with a reproduction in it is worth a spec later. A finding that
describes a feeling is worth nothing. Findings *rising* during a hard night is
the healthy signal — a flat ledger through heavy running means you stopped
looking.

### 7. Log the tick

```bash
printf '%s  %s\n' "$(TZ=America/Chicago date +'%Y-%m-%d %-I:%M %p CT')" "<what changed, or 'quiet'>" \
  >> ~/ergane-ops/away-log.md
```

One line. The operator reads this file to reconstruct the night in one scroll;
it is the only durable record that this loop ran at all.

## Park list — never, while away

Each of these is here because doing it unattended cost something real.

| Do not | Because |
| --- | --- |
| Delete anything — remote refs, worktrees, store rows, branches | On 2026-08-14 an agent's `rm -rf .factory` destroyed three stores and both node worktrees; recovery took a restic snapshot and half a day |
| Terminate a workflow beyond a failed node's own retry ladder | A kill skips the sweep, and the survivors outlive it |
| Force-push anywhere outside a node's own branch | |
| Touch live systemd units, or dispatch a story that provisions the host | 042/US3 installs a Temporal unit on the machine this factory runs on |
| Modify factory code while an attempt is in flight | The worker imports it live |
| Restart the worker mid-attempt — and never with `nohup` | `systemctl --user restart ergane-worker.service`, between attempts, only |
| Flip a spec's state the operator deliberately held | The hold note names its release condition; if the condition needs a human, so does the flip |
| Widen a story's scope to make it pass | |
| Press an escalation button | Expiry is part of the contract |
| Retain to cross-session memory | Unattended runs are read-only against memory: recall yes, retain no |

When you hit one of these, do everything else in the tick, then write the parked
item into the log **and** send it as a `PushNotification` if it is blocking. The
operator wakes up to a decision queue, not a mystery.

## Judgement rules that do not fit a table

- **A green suite is evidence, not proof.** A fully green run has shipped a
  command that could not start. If a fix matters, prove it by control or
  mutation — break the thing on purpose and watch the test go red.
- **The merge-group build is the gate.** A pull request's own green check tests
  the branch, not the speculative merge, and those are different trees.
- **Report what you ran, not what you were told.** An agent's report is a claim.
  So is a judge verdict. So is a merged flag.
- **Correct yourself in one line and move on.** You will be wrong about
  something at 3 AM. Say what is true now; do not write an incident report about
  your own reasoning.
- **If a lesson would change how an implementer writes code, it belongs in that
  spec's plan as a named trap** — not in your head, and not in a memory file.
  Nothing dispatches a memory. The only path from what you learned to what an
  agent obeys runs through refinement.

## The morning message

When the operator returns, or when you stop, lead with what they have to decide,
not with what you did. Parked items first, then losses with their causes, then
landings. Timestamp it in Central. If the honest summary is "quiet, four stories
landed, nothing needs you" — say exactly that and stop there.
