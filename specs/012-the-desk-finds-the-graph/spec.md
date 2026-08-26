---
state: landed
depends_on_landed: [009-a-landed-epic-reads-landed]
# Attested landed 2026-08-25. US1 f503f3493a74 (#67), US2 c115aa13b1fb (#68) -
# both observed on dev by content, not by a merged flag.
#
# Dispatched 9:10:17 PM CT, complete 9:54 PM CT: 43m57s for two serial stories,
# the fastest epic of the build. Agent build 7m05s + 3m18s (US1, two attempts)
# and 19m10s (US2); landing overhead ~7m a story.
#
# THE ONE FAIL IN THIS EPIC IS THE MOST USEFUL EVENT OF THE NIGHT. US1 attempt 1
# passed ALL FOUR GATES - 506 passed, 2 skipped, typecheck clean, 346 unit, 57
# smoke - and the agent's own report claimed FR-005 satisfied. The judge read the
# diff instead of the gate output and found that `json.JSONDecodeError` is a
# `ValueError`, so it fell through the `except OSError` fallback AND through
# `_assemble_epic`'s `(TransportFailed, QueryRefused)` catch: an archive that
# existed and would not parse would have crashed the entire floor document rather
# than degrading one epic. RETRY. Attempt 2 salvaged FR-001 through FR-004
# untouched, widened the catch to `UnicodeDecodeError` as well - an invalid-UTF-8
# archive had the same crash path - and split US1-S4 into two assertions.
#
# A green suite is evidence, not proof. Four gates and the builder's own reading
# all agreed on a crash that the judge caught by reading the code. This is the
# argument for the judge rung existing at all, and it belongs in the record.
#
# Flipped `ready` 2026-08-25, 7:44 PM CT, by the operator's standing instruction
# ("flip 012 to ready once 009 lands"), the moment 009's US4 landed at
# 578e4fba606f and 009 read `landed` by content. The hold below is discharged:
# 009's US1 has merged, so `pane/floor_document.py` is settled on dev and this
# spec's US1 branches from a tree that already carries it.
#
# Drafted 2026-08-25, 5:35 PM CT, while 009 was mid-flight. Held `draft`
# deliberately: 009 is dispatched and serial, and this spec touches
# `pane/floor_document.py`, which 009's US1 also reaches. Flip it when 009 lands.
#
# THIS SPEC EXISTS BECAUSE THE OPERATOR SAW THE DESK AND I HAD TOLD THEM IT WAS
# FIXED. Spec 009's own frontmatter says "F4 fabricated topology -- GONE, cured
# by #40 and 006." That is true of the Showfloor and FALSE of the Desk, and the
# claim is mine. The Desk's reader has never had the archive fallback; the
# correction belongs here because 009 was already running and a spec's body may
# not be edited under a node that is reading it (N51).
#
# NO DESIGN.md AMENDMENT AND NO D-ENTRY. Nothing here changes an appearance:
# `DESIGN.md` § The Desk in this world already asks for chevrons carrying the
# graph, and constitution II already requires the seam-then-archive order that
# `pane/showfloor.py` implements. This spec makes the Desk obey decisions the
# repository has already taken. Constitution VIII is not engaged.
---

# Feature Specification: The Desk finds the graph

**Feature Branch**: `012-the-desk-finds-the-graph`
**Created**: 2026-08-25 · **Status**: Draft
**Input**: the operator's Desk at 5:27 PM CT, showing a banner about a file that
was never going to exist

## Context

The Desk renders a red-bordered notice on every epic it has ever shown:

> **Epic 009-a-landed-epic-reads-landed could not be reached.**
> The read `workgraph` failed before the factory answered: `[Errno 2] No such
> file or directory: 'specs/009-a-landed-epic-reads-landed/workgraph.json'`.
> Shown as unavailable, not hidden.

Every word of that is honest about what the code did and wrong about the world.
The graph is on disk, at `docs/dags/009-a-landed-epic-reads-landed.json`, where
the operator archives it before dispatch and where `CLAUDE.md` says it lives.

Three facts make this permanent rather than incidental:

1. **`specs/<dir>/workgraph.json` does not exist for any spec in this
   repository** — the roadmap derives its graph in-process and never writes it
   back, so the path the Desk reads is one nothing produces.
2. **The Showfloor already solved this.** `pane/showfloor.py:377` — *"seam
   first, archive second"* — tries the reader, falls back to
   `docs/dags/<dir>.json`, and re-raises the seam's failure only when neither
   answers, "because the seam is where the graph belongs".
3. **`pane/readers.py` has not been touched since spec 003.**
   `LiveReader.workgraph()` at line 243 reads one path and raises
   `TransportFailed`. The fallback was written for one room and never given to
   the other.

The banner is the visible half. The invisible half is worse: with no graph, the
Desk's epic row cannot know a single edge, so the chevrons that carry the
topology have nothing to draw. The operator's words were *"it doesn't actually
render the graph"* — that is the same defect, one layer down.

This is constitution III inverted. The principle exists so a pane never renders
a beautiful floor and lies when the floor is unreachable. Here the floor is
perfectly reachable and the pane says otherwise — an honest-degradation
mechanism firing on a condition that is not a degradation, which spends the
operator's trust on a false alarm every time they open the room.

## User Scenarios & Testing

### User Story 1 - The Desk reads the archive when the seam is silent (Priority: P1)

As an operator, the Desk finds a graph that is on disk, and only tells me a read
failed when it actually did.

**Why this priority**: it is the whole spec, and the defect is on screen every
time the Desk is opened.

**Acceptance Scenarios**:

1. **Given** a spec with no `specs/<dir>/workgraph.json` **and** an archived
   `docs/dags/<dir>.json`, **When** the floor document is assembled, **Then**
   the epic carries the archived graph, no `workgraph` entry appears in
   `degraded`, and the notice does not render (FR-001, FR-002).
2. **Given** a spec with **neither** file, **When** the floor document is
   assembled, **Then** the `degraded` entry names the **seam's** failure rather
   than the archive's, matching the Showfloor's rule and its stated reason
   (FR-003).
3. **Given** a spec whose seam read succeeds, **When** the document is
   assembled, **Then** the archive is not consulted at all — seam first
   (FR-004).
4. **Given** an archived graph that is present but unparseable, **When** the
   document is assembled, **Then** the entry reads `unparseable` rather than
   `transport`, because a file that exists and will not parse is a different
   failure from one that is absent (FR-005).

---

### User Story 2 - The epic row draws the graph it now has (Priority: P2)

As an operator, an epic's row shows how its stories depend on each other,
because the graph is finally available to draw from.

**Why this priority**: it is the half the operator actually asked about, and it
is only reachable once US1 lands.

**Acceptance Scenarios**:

1. **Given** an epic whose archived graph declares merge edges, **When** its
   Desk row renders, **Then** each story's chevron reflects its declared
   dependency rather than `UNDECLARED`, proven by a committed test over a
   constructed corpus (FR-006).
2. **Given** an epic whose graph genuinely declares no edges for a story,
   **When** its row renders, **Then** that story reads `UNDECLARED` — the state
   keeps its meaning and is not repurposed as a fallback (FR-007).
3. **Given** both themes at every width the Desk suite already sweeps, **When**
   the row renders, **Then** the four layout laws report zero violations
   (FR-008).

---

### Edge Cases

- An archived graph for a spec with no running epic: the Desk shows the epic
  only when the floor reports it; the archive supplies the graph, never the
  existence of an epic.
- An archive whose node ids do not match the story keys the spec declares: the
  mismatch is named in `degraded`, and the row does not invent a topology from
  the half it recognises. Fabricating a graph is the defect this corpus already
  paid for once.

## Requirements

### Functional Requirements

- **FR-001**: The Desk's workgraph read MUST fall back to `docs/dags/<dir>.json`
  when the seam has no graph, in the same seam-then-archive order the Showfloor
  uses.
- **FR-002**: A read satisfied by the archive MUST NOT produce a `degraded`
  entry and MUST NOT render the unreachable notice.
- **FR-003**: When neither source answers, the reported failure MUST be the
  seam's, not the archive's.
- **FR-004**: A successful seam read MUST NOT consult the archive.
- **FR-005**: An archive that exists and will not parse MUST report
  `unparseable`, not `transport`.
- **FR-006**: Each story's chevron MUST reflect the dependency its graph
  declares.
- **FR-007**: `UNDECLARED` MUST continue to mean a story with no declared
  dependency, and MUST NOT be rendered for a graph that could not be read.
- **FR-008**: The Desk MUST report zero violations of the four layout laws at
  every width and in both themes the suite already sweeps.

### Key Entities

- **The archive** — `docs/dags/<spec-dir>.json`, the derived work graph the
  operator commits before dispatch (`CLAUDE.md` § Layout worth knowing).
- **The seam** — `LiveReader.workgraph()`, which reads the path the factory
  would write if the roadmap wrote one.

## Success Criteria

- **SC-001**: With 009 on the floor and its DAG archived, the Desk renders no
  unreachable notice.
- **SC-002**: The Desk's epic row shows each story's declared dependency.
- **SC-003**: Removing both the archive and the seam's file still produces one
  honest `degraded` entry naming the seam.

## Assumptions

- The archive root is `docs/dags/` relative to the repository root, as the
  Showfloor already resolves it; it is derived, never hard-coded per call site.

## Out of scope

- **Consolidating the two readers.** The honest long-term fix is one workgraph
  read for both rooms — the duplication is precisely why one got the fallback
  and the other did not. That is a refactor across `pane/readers.py`,
  `pane/floor_document.py` and `pane/showfloor.py`, and it would put every
  carried-over Desk guarantee at risk to fix a five-line defect. Do the small
  correct thing here; the consolidation is its own spec, with the Desk's suite
  as its safety net.

## Work Graph

```yaml
US1:
  depends_on: []
  depends_on_merged: []
  implements: [FR-001, FR-002, FR-003, FR-004, FR-005]
  timeout: 3600
US2:
  depends_on: []
  depends_on_merged: [US1]
  implements: [FR-006, FR-007, FR-008]
  timeout: 3600
```
