---
state: landed
depends_on_landed: []
# ATTESTED LANDED 2026-08-27. US1 36038d4 (#96), US2 1eed329 (#97), both MERGED,
# observed by content on `dev`. Every gate green on both landing attempts.
#
# 25 MINUTES FOR TWO PARALLEL STORIES, first boundary verification 8:31:57 PM CT
# to last merge 8:56:33 PM CT -- the fastest epic this repository has run, and
# the chain depth of 1 predicted below is why. Landing overhead 6:15 and 7:47.
#
# US2 TOOK TWO ATTEMPTS FOR A REASON THAT HAS NOTHING TO DO WITH US2. Attempt 1
# died at the boundary `smoke` gate after 1.32s at 2026-08-27T01:43:40Z, before
# one test ran, because 127.0.0.1:8787 was already held -- leaked Playwright
# webServer children from an earlier interrupted run, against the three fixed
# ports `web/playwright.config.ts` declares. Attempt 2 passed every gate four
# minutes later having changed nothing about it. Not concurrency: the roadmap
# ran at `max_concurrent_nodes: 1`. The full trace is in 015's attestation;
# known as `gates/concurrent-epics-collide-on-a-fixed-gate-port`.
#
# THE IRONY IS THE ONE 016 RECORDED, TWICE IN A ROW NOW. A spec written because
# the repository tells itself something true and reports something else lost an
# attempt to a gate reporting a port collision as a story defect.
#
# WHAT LANDED, BY NAME. US1: `tests/test_no_test_destroys_a_fixture_repository.py`
# (+202) is the mechanism, and its shape is the point -- a committed test that
# fails when ANY test destroys a live `.git`, rather than a patch to the one test
# that did; `tests/test_the_demo_floor_owns_its_landings.py` (+60/-18) stops
# racing git's background maintenance. US2: `pane/floor_document.py` (+52/-6)
# makes the Desk say which source answered, with
# `tests/test_desk_finds_the_graph.py` (+190) and a new
# `web/tests/smoke/support/widths.ts` (+35) behind it. `.gitignore` grew in both
# stories, which is the operator's scratch finally leaving the seam's path.
#
# US1 PASSED FIRST ATTEMPT, all four gates green at 2026-08-27T01:33:13Z.
# FLIPPED `ready` 2026-08-26, 8:25 PM CT, by the operator, in the same session
# that authored it. Both defects it fixes were filed the same evening with
# reproductions, and the floor was empty enough to take a second epic beside 015.
#
# WRITTEN 2026-08-26, 8:20 PM CT, FROM TWO FINDINGS FILED THE SAME EVENING, both
# with reproductions in the doctor ledger and both live on `dev` right now:
#
#   gates/rmtree-of-a-live-dot-git-races-git-maintenance   (US1)
#   pane/stale-hand-derived-workgraph-shadows-the-archive  (US2)
#
# NEITHER IS A REGRESSION AND NEITHER SPEC THAT PRODUCED THEM WAS WRONG. 016 was
# asked to take the review room off live git and it did; the test it wrote to
# prove that proves it by destroying a real `.git`, and races git's own
# background maintenance. 012 was asked to stop a false "unreachable" banner and
# it did; the seam it kept first has no writer, so in practice the only file that
# ever appears at that path is an operator's hand-derive output. Both defects sit
# in the gap between a correct decision and the world it landed in.
#
# THE TWO STORIES ARE INDEPENDENT AND RUN IN PARALLEL. US1 is confined to
# `tests/test_the_demo_floor_owns_its_landings.py`; US2 touches
# `pane/floor_document.py`, `.gitignore` and `tests/test_desk_finds_the_graph.py`.
# No file is reached by both, so `depends_on_merged` is empty on each and the
# chain depth is 1.
#
# US2 DOES NOT REVERSE 012, AND MUST NOT. 012's FR-004 -- a successful seam read
# never consults the archive -- stays true, has a committed test
# (`test_a_successful_seam_read_does_not_consult_the_archive`), and is not this
# spec's to weaken. The fix here is that the Desk SAYS which source answered, and
# that the operator's scratch stops accumulating at the seam's path. Making the
# read honest is not the same as making it choose differently.
#
# NO GIT READ MAY BE ADDED TO THE PANE TO SOLVE THIS. The obvious fix -- "prefer
# the archive when the seam file is untracked" -- requires asking git, and 016
# landed a runtime watcher (`tests/spawnwatch.py`) that fails the suite when the
# read path spawns one. That watcher is right and this spec obeys it.
---

# Feature Specification: A gate tells the truth twice

**Feature Branch**: `017-a-gate-tells-the-truth-twice`
**Created**: 2026-08-26 · **Status**: Refined
**Input**: two findings filed 2026-08-26 while attesting 011 and 016

## Context

Two defects landed on `dev` this evening inside otherwise-correct work. They have
nothing in common mechanically and one thing in common exactly: **each is a place
where the repository tells itself something true and reports something else.**

**The first cost a full attempt already.** `016`'s US1 went red on CI at
`2026-08-26T20:15:28Z` with:

```
FileNotFoundError: [Errno 2] No such file or directory: 'bitmap-ref-tips_5AH8V1'
/usr/lib/python3.12/shutil.py:715
FAILED tests/test_the_demo_floor_owns_its_landings.py::test_the_live_read_never_falls_back_to_a_recording
```

`bitmap-ref-tips` is git's own pack-bitmap temporary file. The test builds a real
repository, then does `shutil.rmtree(landed.repo / ".git")` to prove the live
landing read degrades honestly against a checkout it cannot walk — and git may
still have a maintenance child writing into that directory while `rmtree` walks
it. Attempt 2 passed **without touching that test**, so nothing was fixed: the
race is on `dev` and will redden the `test` gate at random, on any runner, at a
cost of one recovery rung each time. The assertion is right. Deleting a directory
another process owns is what is wrong, and the assertion does not need it.

**The second is silent, which makes it worse.** `pane/readers.py:326` reads
`specs/<dir>/workgraph.json`, and 012 deliberately made that seam **first** —
*"the seam is where the graph belongs."* That ordering is right for a
factory-written graph and this one has no writer: 012's own Context records that
nothing in the factory writes that path, because the roadmap derives its graph
in-process and never writes it back. So the only file that ever appears there is
an operator's `ergane spec derive` output, and a stale, unreviewed, untracked file
outranks `docs/dags/<dir>.json` — the graph the operator archived and reviewed
before dispatch.

Measured on the operator's checkout, 2026-08-26:

```
specs/012-*/workgraph.json     984 B   2026-08-25  7:43 PM CT   untracked
specs/013-*/workgraph.json    1329 B   2026-08-25  7:43 PM CT   untracked
specs/014-*/workgraph.json    1411 B   2026-08-25 11:40 PM CT   untracked
```

Three specs whose Desk row draws yesterday's topology, reporting nothing, because
012's FR-002 requires a seam-satisfied read to produce no `degraded` entry. A
successful read and a correct read are indistinguishable in the document.

This is constitution III at its narrowest reading: the pane may not render a
confident floor it cannot vouch for. The read is not failing, so honest
degradation never fires — the document simply has no vocabulary for *"this came
from somewhere, and here is where."*

## User Scenarios & Testing

### User Story 1 - A test proves degradation without destroying live state (Priority: P1)

As an operator, the `test` gate is red only when something is wrong, so a red gate
is worth acting on.

**Why this priority**: it is on `dev` now, it fires nondeterministically, and each
firing costs a recovery rung on work that was already correct.

**Acceptance Scenarios**:

1. **Given** the fixture repository built by the `landed` fixture, **When** the
   test makes that checkout unwalkable, **Then** it does so without removing or
   emptying a `.git` directory that a concurrent process may hold open (FR-001).
2. **Given** the altered test, **When** the live landing read runs against that
   checkout, **Then** it still raises `TransportFailed` or `QueryRefused` naming
   the landing read, exactly as before (FR-002).
3. **Given** the suite, **When** the whole file is run repeatedly, **Then** no
   test in it removes a `.git` directory from a repository it did not create
   solely for deletion, proven by a committed assertion over the source
   (FR-003).

---

### User Story 2 - A graph says where it came from (Priority: P2)

As an operator, an epic's row tells me whether its topology came from the factory
or from a file on my disk, so I can tell a current graph from a stale one.

**Why this priority**: it is silent, so it costs trust rather than time, and it
misleads exactly when the operator is trusting the room most.

**Acceptance Scenarios**:

1. **Given** an epic whose graph is satisfied by the seam, **When** the floor
   document is assembled, **Then** the epic carries a provenance naming the seam,
   and the archive is still not consulted (FR-004, FR-007).
2. **Given** an epic whose seam is silent and whose archive answers, **When** the
   document is assembled, **Then** the epic carries a provenance naming the
   archive, and there is still no `degraded` entry, because a fallback that
   worked is not a degradation (FR-005).
3. **Given** the repository, **When** an operator derives a graph to
   `specs/<dir>/workgraph.json`, **Then** git does not report that file as
   untracked content, so it cannot accumulate unnoticed (FR-006).
4. **Given** both themes at every width the Desk suite already sweeps, **When**
   the row renders, **Then** the four layout laws report zero violations
   (FR-008).

---

### Edge Cases

- A seam file and an archive that disagree: the seam still wins (012 FR-004), and
  the provenance says so. This spec surfaces the disagreement; it does not
  arbitrate it.
- An archive that exists and will not parse: unchanged from 012 FR-005 — it reads
  `unparseable`, and provenance is not reported for a graph that was never read.
- A repository with no `docs/dags/` at all: unchanged. The seam's failure is the
  one reported (012 FR-003).

## Requirements

### Functional Requirements

- **FR-001**: A test that proves the live landing read degrades MUST make the
  checkout unwalkable without deleting a `.git` directory that a concurrent
  process may be writing to.
- **FR-002**: That test MUST continue to assert that the read raises
  `TransportFailed` or `QueryRefused` naming the landing read.
- **FR-003**: The suite MUST carry a committed assertion that no test in
  `tests/` removes a `.git` directory belonging to a fixture repository.
- **FR-004**: A workgraph satisfied by the seam MUST report a provenance naming
  the seam.
- **FR-005**: A workgraph satisfied by the archive MUST report a provenance
  naming the archive, and MUST NOT produce a `degraded` entry.
- **FR-006**: `specs/*/workgraph.json` MUST be ignored by git, so an operator's
  derive output cannot accumulate as untracked content.
- **FR-007**: A successful seam read MUST NOT consult the archive, unchanged
  from 012 FR-004.
- **FR-008**: The Desk MUST report zero violations of the four layout laws at
  every width and in both themes the suite already sweeps.

### Key Entities

- **The seam** — `LiveReader.workgraph()` at `pane/readers.py:326`, reading
  `specs/<dir>/workgraph.json`, a path with no writer in the factory.
- **The archive** — `docs/dags/<dir>.json`, the derived graph the operator
  commits before dispatch (`CLAUDE.md` § Layout worth knowing).
- **Provenance** — which of those two answered, named in the document beside the
  graph it explains.

## Success Criteria

- **SC-001**: The `test` gate passes on twenty consecutive runs of the altered
  file with no `FileNotFoundError` from `shutil`.
- **SC-002**: With a stale `specs/<dir>/workgraph.json` present, the Desk names
  the seam as the source; with it absent and an archive present, the Desk names
  the archive.
- **SC-003**: `git status --porcelain` reports nothing after
  `ergane spec derive specs/<dir> -o specs/<dir>/workgraph.json`.

## Assumptions

- Provenance is a fact about the read, so it travels with the epic in the floor
  document rather than in `degraded`, which is reserved for reads that failed.

## Out of scope

- **Changing which source wins.** 012 decided seam-first with a committed test
  and a recorded reason. Reversing it is a different spec with a different
  argument, and it is not this one.
- **Reading git from the pane to decide provenance.** 016 landed a runtime
  watcher that fails the suite when the read path spawns a git subprocess. That
  watcher is correct; the provenance here is known from which branch of the
  existing fallback ran, and needs no new read.
- **Consolidating the two workgraph readers.** Still 012's open item, still its
  own spec, still with the Desk's suite as its safety net.

## Work Graph

```yaml
US1:
  depends_on: []
  depends_on_merged: []
  implements: [FR-001, FR-002, FR-003]
  timeout: 3600
US2:
  depends_on: []
  depends_on_merged: []
  implements: [FR-004, FR-005, FR-006, FR-007, FR-008]
  timeout: 3600
```
