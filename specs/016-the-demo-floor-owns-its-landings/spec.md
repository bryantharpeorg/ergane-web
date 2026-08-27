---
state: landed
depends_on_landed: []
# Attested landed 2026-08-26. US1 13d22b12e3d2 (#88), observed on dev by
# content, not by a merged flag.
#
# Dispatched 2:50 PM CT, complete 4:06 PM CT: 1h15m for one story, TWO ATTEMPTS
# FOR ONE STORY. Agent build 23m (attempt 1) and 42m (attempt 2); landing
# overhead ~9m. Landing history, verbatim: CHECKS_FAILED at 2026-08-26T20:15:49Z
# on `test`, MERGED at 2026-08-26T21:06:05Z.
#
# THE RECOVERY CYCLE WAS NOT THE DIFF'S FAULT, AND THE IRONY IS WORTH THE INK.
# This spec exists because the review room's smoke depended on the runner's git
# history. Attempt 1's diff was correct and its `test` gate went red anyway - on
# `test_the_live_read_never_falls_back_to_a_recording`, which proves the
# degradation path by `shutil.rmtree`-ing a real `.git`, and lost the race
# against git's own background maintenance:
#
#   FileNotFoundError: [Errno 2] No such file or directory: 'bitmap-ref-tips_5AH8V1'
#   /usr/lib/python3.12/shutil.py:715
#
# Attempt 2 passed WITHOUT touching that test, so nothing was fixed. The race is
# on dev now and will redden the gate at random. Filed as
# `gates/rmtree-of-a-live-dot-git-races-git-maintenance`, with the fix shape:
# make the checkout unwalkable by renaming rather than by deleting a directory
# another process owns. It is a candidate for the next spec that touches this
# suite; nothing here should be edited to chase it (N51).
#
# WHAT LANDED, BY NAME. `tests/spawnwatch.py` (+111) is the mechanism behind
# FR-002 - it watches the review path at runtime and fails on a git subprocess,
# rather than trusting an import scan. `pane/fixture_floor.py` (+124) gives the
# review room its recorded landings. `pane/landing.py` was NOT touched, honouring
# plan D1: the live read keeps its seam, and demo mode diverts before it.
#
# Flipped `ready` 2026-08-26, 2:37 PM CT, by the operator, the moment the spec
# itself landed at 7abd22f (#86). Nothing gates it: `depends_on_landed` is empty
# and the recorded fixture it needs is committed alongside it.
#
# WRITTEN 2026-08-26 FROM A DEFECT THAT COST A NIGHT. Spec 011's US2 died with
# its whole ladder overnight, and US3 was cascade-killed behind it, because
# eleven smoke tests failed on a floor with nothing wrong with it. The trigger
# was a shallow CI checkout; the defect is that the review room reads real git
# under `PANE_DEMO=1` while every other room serves the recorded Fixture floor.
#
# `CLAUDE.md` states the invariant this breaks, in as many words: "`PANE_DEMO=1`
# serves the recorded Fixture floor under `fixtures/` instead of a live factory.
# Every test runs against that fixture-backed seam; no gate needs a live floor."
# `pane/review.py` contains no reference to demo mode at all. It is the only room
# whose smoke depends on the git history of whatever machine happens to run it,
# and it is therefore the only room that cannot pass on a runner.
#
# THE TRIGGER IS WORTH RECORDING BECAUSE IT WILL RECUR AND THIS SPEC DOES NOT FIX
# IT. Measured on a runner, in one job, in one directory: the shell reported
# `is-shallow=false` with 91 commits immediately before the gate command, and the
# suite two minutes later read the same directory as shallow with one commit. Two
# workflow changes (#84, #85) deepen the history and neither survives to the test.
# What re-shallows it is unidentified. This spec makes that stop mattering rather
# than claiming to have solved it.
---

# Feature Specification: The demo floor owns its landings

**Feature Branch**: `016-the-demo-floor-owns-its-landings`
**Created**: 2026-08-26 · **Status**: Refined
**Input**: the loss of 011/US2 and US3 on the night of 2026-08-25

## Context

`PANE_DEMO=1` exists so a gate never needs a live factory. Every document the
rooms read in demo mode is replayed from `fixtures/` through `FixtureReader`:
the floor, the showfloor, attention, epic status, usage, findings, questions.

**One read escaped.** `landing_facts` — 009's third read, the one that says which
stories of a spec the landing branch carries — reaches `factory.workgraph.landed`
and spawns git against the checkout, in demo mode exactly as in live mode. The
Showfloor has carried that since 009 and tolerated it, because a missing landing
read renders as `unknown` under the Unknown Rule and the room stays honest.

The review room cannot tolerate it. FR-004 refuses a partially landed epic **by
name**, so a landing read that sees nothing does not degrade — it produces a
confident refusal of every epic on the floor. On a runner whose checkout is
shallow, that is eleven failing tests reporting a floor that is entirely fine.

The failure is not that the read was wrong. It is that **a read which cannot see
is indistinguishable from a fact**, and the room believed it.

## User Scenarios & Testing

### User Story 1 - The demo floor's landings are recorded, like everything else (Priority: P1)

As an operator, the rooms in demo mode read landings from the Fixture floor, so a
gate's answer does not depend on the git history of the machine running it.

**Why this priority**: it is the whole spec, and it is what makes 011's suite
hermetic — the property `CLAUDE.md` already claims for every gate.

**Acceptance Scenarios**:

1. **Given** `PANE_DEMO=1`, **When** any room's landing facts are read, **Then**
   they come from the recorded fixture and **no git subprocess is spawned**
   (FR-001, FR-002).
2. **Given** `PANE_DEMO=1` and a checkout with no git history at all — a
   directory that is not a repository — **When** the Desk, the Showfloor and the
   review room render, **Then** every one answers exactly as it does in a full
   checkout (FR-003).
3. **Given** `PANE_DEMO=0`, **When** landing facts are read, **Then** the live
   git-backed read is used, unchanged (FR-004).
4. **Given** the recorded fixture, **When** it is read, **Then** it carries the
   same shape the live read returns — story key to commit, kind, merged instant,
   pull request number and subject — so no consumer can tell the two apart by
   shape (FR-005).
5. **Given** a spec the fixture does not name, **When** its landings are read in
   demo mode, **Then** the answer is an honest degraded read naming the missing
   fixture, never an empty result presented as "nothing landed" (FR-006).

---

### Edge Cases

- A fixture that exists and will not parse: a degraded read naming the parse
  failure, on the same terms as any other unreadable fixture.
- The fixture ageing behind `dev`: it is a recording of a real branch and ages
  like the recorded floor does. `fixtures/README.md` says so and says how to
  re-record.

## Requirements

### Functional Requirements

- **FR-001**: Under `PANE_DEMO=1`, landing facts MUST be read from the recorded
  fixture.
- **FR-002**: Under `PANE_DEMO=1`, a landing read MUST NOT spawn a git
  subprocess, proven by a committed test that intercepts the spawn point.
- **FR-003**: Under `PANE_DEMO=1`, every room MUST render identically whether or
  not the working directory is a git repository at all.
- **FR-004**: Under `PANE_DEMO=0`, the live git-backed read MUST be unchanged.
- **FR-005**: The fixture MUST carry the live read's shape exactly.
- **FR-006**: A spec absent from the fixture MUST produce an honest degraded read
  naming what was missing, never an empty result read as "nothing landed".

### Key Entities

- **`fixtures/landing/landing-facts.json`** — recorded from this repository's own
  `dev` at `d4aec99` through `pane.landing.read_landing_facts`, with provenance in
  its envelope. Committed by the operator with this spec; recorded, never invented
  (constitution V).

## Success Criteria

- **SC-001**: The whole smoke suite passes in a checkout with no git history.
- **SC-002**: No gate's answer depends on the depth of the checkout that ran it.
- **SC-003**: A missing or unreadable fixture is named on screen, never rendered
  as an epic that did not land.

## Assumptions

- The fixture is a snapshot and will age behind `dev`. That is the same contract
  every other recording in `fixtures/` carries.

## Out of scope

- **Why the runner re-shallows the checkout.** Unidentified, and it stops
  mattering once the demo read is hermetic. The two workflow guards stay as
  belt-and-braces for anything that genuinely needs live history.
- **Changing FR-004 of spec 011.** Refusing a partially landed epic is right; the
  defect was the read beneath it, not the refusal.

## Work Graph

```yaml
US1:
  depends_on: []
  depends_on_merged: []
  implements: [FR-001, FR-002, FR-003, FR-004, FR-005, FR-006]
  timeout: 3600
```
