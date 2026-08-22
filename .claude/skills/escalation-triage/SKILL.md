---
name: "escalation-triage"
description: "Investigate an open verification escalation and hand the operator a decision brief: what actually failed, whether it is deterministic or flaky, what each button would do in this specific case, and one recommendation with its reasoning. Use when an escalation arrives on Telegram or `ergane escalations list` shows one. Never answers the escalation itself."
compatibility: "Requires the ergane CLI on PATH via ~/.config/ergane/ergane-env.sh, gh authenticated, and a checkout of this repository"
metadata:
  inherited_from: "bryantharpeorg/ergane .claude/skills — adapted 2026-08-22: env script at ~/.config/ergane/ergane-env.sh, runtime root at $ERGANE_ROOT"
  author: "operator session, 2026-08-17"
user-invocable: true
disable-model-invocation: false
---

# Escalation triage

An escalation is the factory saying "I have evidence I cannot act on." The
job here is to gather the evidence it couldn't, classify the failure, and
hand the operator a decision — **not to make it**.

> **Never press a button.** Not Retry, not Kill, not Pause — not via
> Telegram, not via any CLI resolve verb. Silence is a decision the operator
> is entitled to make, and expiry is part of the contract. The deliverable
> of this skill is a brief, and it ends with a recommendation, full stop.

## 1. Find it

```bash
eval "$(~/.config/ergane/ergane-env.sh)"     # NOT `source` — it emits export lines
uv run ergane escalations list      # the only verb; there is no `show`
```

Note the **deadline and the default**. Convert the deadline to Central and
put it in the first line of the brief — it is the only number that makes
this urgent, and the operator reads Telegram on a phone, in UTC, tired.

## 2. Reconstruct what happened — never from the escalation's own evidence

The evidence field can say `log unavailable: could not list checks
(GH_REFUSED)` while the failure underneath is completely real. A refused
*lookup* is not an absent *failure*. Pull everything yourself:

**The PR and the actual CI log:**

```bash
git fetch origin --quiet
gh pr list --repo bryantharpeorg/ergane --head factory/<epic>/<story> \
  --state all --json number,state,mergeStateStatus,autoMergeRequest
gh pr checks <n> --repo bryantharpeorg/ergane        # note the run URL and its age
gh run view <run-id> --repo bryantharpeorg/ergane --log-failed 2>/dev/null \
  | grep -E 'FAILED|Error|assert' | head -20
```

Note **which SHA the failing run tested**. If the branch tip has not moved
since that run, nothing new was ever tested — a re-check that comes back
red is the *same* red, not a second failure.

**The attempt ladder** — classify every rung before reasoning about any:

```bash
ls -la $ERGANE_ROOT/transcripts/<epic>/<story>/          # one dir per attempt, mtime = end
tail -c 2000 $ERGANE_ROOT/transcripts/<epic>/<story>/attempt-N/stdout.log
```

Each attempt ended one of three ways, and they mean different things:

| Ending | Signal |
| --- | --- |
| Real work, new commits | Code-level signal — read what it changed |
| `429` / `RateLimitError` in the tail | **No signal at all.** A quota death says nothing about the story |
| Clean exit, zero new commits, "it was flaky" | A verdict, not a fix — verify it yourself before believing it |

**Whether an attempt is live right now** (changes what you may touch):

```bash
ps -eo pid,etime,args | grep '[A]TTEMPT_ARCHIVE'     # bracket trick, or the grep matches itself
```

Never `pgrep -f <epic-name>` — your own shell wrapper's command string
contains the epic name and matches. This has produced a confident false
"agent is running" twice.

**Branch state, three tips that must be told apart:**

```bash
git -C $ERGANE_ROOT/worktrees/<epic>/<story> log -3 --oneline    # local worktree
git ls-remote origin refs/heads/factory/<epic>/<story>       # what CI can see
gh pr checks <n> ...                                         # what CI actually ran on
```

## 3. The decisive question: deterministic, or flaky?

The gate and CI are **different machines with different physics**, and a
red that is deterministic across that boundary cannot be retried away:

- The **gate** runs in a bwrap sandbox: `--clearenv`, no D-Bus socket, no
  systemd user bus, tmpfs `/tmp`, minimal env (`USER` is not set).
- **CI** runs on a GitHub runner: a working systemd user bus, `USER` set,
  a full environment.

A test that consults *real host state* — shells out to `systemctl`, reads
an env var, opens a real socket, checks a real path outside the repo —
passes in one environment and fails in the other **every single time**.
Read the failing test and grep it for unmocked host probes:

```bash
grep -n 'subprocess\|systemctl\|os.environ\|getenv\|socket\|shutil.which' <failing test file>
```

If the failing assertion depends on host state, and the branch tip is
unchanged since the failing run, you are looking at a **loop**: the gate
will stay green, CI will stay red, and every Retry buys one more attempt
that concludes "flaky" — because in *its* sandbox, it genuinely is green.
Attempt 4 of 042/us3 did exactly this on 2026-08-17: re-ran 3491 tests
green in the sandbox and called a deterministic runner-side failure a
flaky runtime condition.

If instead the failure involves a real clock, a shared port, or passes on
re-run *in the same environment*, flaky is plausible and Retry is cheap.

## 4. Say what each button does — in this case, not in general

Write one line per option, concrete to the evidence:

- **Retry** — dispatches a fresh recovery attempt that inherits the branch.
  Worth it when the failure is quota noise, transient infra, or something
  the agent can see and reproduce. Worthless against a sandbox/runner
  divergence: the agent *cannot* reproduce the failure where it lives.
- **Kill** — ends the node **and every node that depends on it** (check
  `depends_on_merged` in the workgraph). The work survives on the node
  branch for salvage, but a relaunch resumes the dead run's tree unless
  the sidecar and node branch are cleared by hand, and landed story
  numbers are immutable — re-doing killed work takes new numbers.
- **Pause the epic** — stops the deadline clock and dispatches nothing.
  The opening move when the fix is operator-shaped: a one-test patch to
  the node branch, a spec-plan trap plus re-dispatch, or anything that
  needs a human's hands. Note that an already-armed PR still merges on
  its own if its checks go green while the epic is paused.

## 5. Deliver the brief

Lead with the clock, end with one recommendation:

1. **Deadline in CT and the default** — "expires 6:38 PM CT, default KILL."
2. **What failed, mechanically** — two or three sentences, from the log you
   pulled, not from the evidence field.
3. **The classification** — deterministic or flaky, and the one fact that
   proves it (usually: which environments disagree, and whether the tested
   SHA moved).
4. **The per-button consequences** from step 4.
5. **One recommendation with its reasoning**, plus what you will do the
   moment the operator presses each button — so the choice costs them one
   tap, not a conversation.

Then stop. If the operator is away and the deadline is near, send the
brief as a `PushNotification` — the deadline firing unanswered is a
legitimate outcome, but it should never be an *uninformed* one.

## Hard rules

- **No buttons, ever.** Recommending is the job; deciding is the operator's.
- **Never modify factory code while an attempt is in flight** — check step
  2's live-attempt probe before even proposing a patch.
- An operator-side push to a node branch is an escape hatch, not a habit:
  it needs the operator's explicit authorization, and it must still face
  CI and the merge queue like everything else.
- Distinguish what you ran from what you were told. An agent's "green" is
  a claim about *its* sandbox; the merge-group build is the gate.
