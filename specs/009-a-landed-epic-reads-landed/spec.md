---
state: landed
depends_on_landed: [006-the-desk-matches-the-stage]
# Attested landed 2026-08-25. US1 aff31ee23ac0 (#53), US2 d303cd1df842 (#57),
# US3 a966b3c05a53 (#59), US4 578e4fba606f (#61) - all four observed on dev by
# content, not by a merged flag.
#
# Dispatched 5:05:12 PM CT, complete 7:42 PM CT: 2h37m for four serial stories.
# Six attempts for four stories - US1 and US2 each took a second pass, US3 and
# US4 first-attempt. Every judge verdict PASS, including the two that followed a
# rework. Agent build ran 8m17s to 27m05s (median ~13m), and landing overhead
# ~15m a story; both are far under the 24-84m the older baseline records, which
# is the number to re-measure from now on.
#
# THE REWORK ON US1 AND US2 IS WORTH READING BEFORE THE NEXT EPIC. I predicted
# US1 attempt 2 was a doomed deterministic loop and recommended pausing for an
# operator hand-fix. The agent fixed both defects itself and did it better than
# the fix I had in mind: it exempted `unknown` from the chip-border assertion
# AND strengthened it with positive Unknown-Rule assertions, and it scoped
# `fetch-depth: 0` to the smoke job alone rather than all four gates. The pause
# cost about thirty minutes of US2 not starting. A ladder that has attempts left
# is evidence I do not have; spend it before spending the operator's hands.
#
# Drafted 2026-08-25 under D-018, and widened the same afternoon under D-019.
# Both amended DESIGN.md FIRST -- the order constitution VIII demands.
# Flipped `ready` 2026-08-25 by the operator.
#
# US4 AND THE US1 WIDENING CAME FROM THE OPERATOR LOOKING AT THE ROOM. Reading
# a landed story's detail pane: "all of the `-` on the right should be
# checkboxes or something right? with a timestamp or some sort of data on when
# that happened?" The dots were already lit -- every stop read `done`. The `-`
# is the Unknown Rule filling the slot where a timestamp belongs, and the stop
# schema carries no time field at all. Half of what is missing is on the branch
# already (when it merged, its SHA, its PR) and US1 now delivers it; the other
# half needs the durable build-history store that does not exist (N47, and
# spec 007's blocking Open Question).
#
# Then: "that explains the selected story but what about the goal of the
# overarching spec? a story is under a spec right?" It is, and the pane could
# not say what a spec was for. `_intent_after()` lifts a story's intent and
# nothing lifts the spec's `## Context` -- which all ten specs in the corpus
# carry, under that heading or `## Sketch`. US4 closes it, and closes the
# layout jump D-016 left behind in the same change: the band under the stage
# stops emptying itself when a story is picked.
#
# WHY THIS SPEC. At 3:22 PM CT the operator looked at the Showfloor and asked
# "006 seems out of date?". It was not out of date. Spec 006 had merged all
# three of its stories eleven minutes earlier and the room rendered it
# `READY 0/3` -- every story at the FIRST stop of a six-stop ladder, which in
# this room's vocabulary means not started. The room stated the opposite of the
# truth, confidently, about the one thing it exists to report.
#
# THIS SPEC IS SMALLER THAN THE REVIEW THAT PROMPTED IT, AND THAT IS THE POINT.
# Four defects were queued for 009. Three were re-measured before drafting and
# three are gone:
#
#   F1 a wide rank is clipped -- GONE, and it was never what it looked like.
#     The 08-25 review measured a FABRICATED topology: the Showfloor could not
#     find those specs' work graphs and fell back to an edgeless flat rank of
#     four cards, which is what overflowed. The archives landed in #40 and the
#     real graphs are all serial chains. Eighteen renders across the corpus at
#     1280/1600/2560: clipping 0px everywhere, empty space below the graph 0px
#     everywhere. Synthetic 8/10/14-sibling ranks do not clip either, because
#     the stage lays an edgeless set out vertically. D-018 discharges D-016's
#     deferral rather than renewing it.
#   F2 the degraded note paints over its own heading -- INSTANCE FIXED,
#     incidentally, when 006 rewrote global.css. Measured today: zero occlusion
#     hits. The LAW GAP is real and survives as US2 below, because a guarantee
#     the suite does not carry is a guarantee this repository does not have.
#   F4 fabricated topology -- GONE, cured by #40 and 006.
#
# What is left is one live defect, one structural guard, and one hermeticity
# defect found while running the gates for #50. Nothing here is speculative:
# every story names a measurement taken on 2026-08-25 against the live pane.
---

# Feature Specification: A landed epic reads landed

**Feature Branch**: `009-a-landed-epic-reads-landed`
**Created**: 2026-08-25 · **Status**: Draft
**Input**: the operator's question at 3:22 PM CT, and D-018

## Why

The pane has one job: render the factory's state honestly. Constitution III is
explicit that a value the factory did not record is shown as unknown, **never as
zero**. A six-stop ladder defaulting to its first stop is that same failure in a
different costume — `ready` is not an absence of information, it is a claim, and
it was false for eleven minutes about a spec that had finished.

The window is not eleven minutes in general. It opens when the last story merges
and closes only when a human hand-edits a frontmatter line. Under `/away-mode` it
is however long the operator sleeps, and the pane spends all of it reporting that
nothing has started.

## User Scenarios & Testing

### User Story 1 - Landing truth outlives the workflow (Priority: P1)

As an operator, when an epic finishes, the room says so — whether or not a
Temporal workflow still exists to be queried, and whether or not anyone has
attested the spec's frontmatter yet.

**Why this priority**: it is the live defect, and every hour the pane runs
unattended is an hour it can be wrong about the floor.

**Acceptance Scenarios**:

1. **Given** a spec whose stories are all landed on the landing branch by
   content, **and** no live `epic_status` answer for it, **When** the showfloor
   document is assembled, **Then** every landed story's ladder reads `merged`
   and the entry's `stories_landed` equals its story count — proven by a
   committed test that constructs exactly this condition through the reader
   seams (FR-001, FR-002).
2. **Given** that same landed story, **When** its detail is assembled, **Then**
   the `merged` stop carries the landing commit's timestamp, and the facts grid
   carries the landing SHA and the pull request number parsed from the squash
   subject — the three facts the branch already holds — while every fact the
   branch cannot supply stays under the Unknown Rule (FR-002a).
3. **Given** a spec with a live `epic_status` answer, **When** the document is
   assembled, **Then** the live answer governs every story it names — attempt,
   persona and the stops before `merged` come from it unchanged — and the
   corpus supplies only stories the live answer does not carry, proven by a
   test in which the two sources disagree (FR-003).
4. **Given** a story that neither the live answer nor the corpus can place,
   **When** the document is assembled, **Then** its ladder renders under the
   Unknown Rule rather than defaulting to the first stop, and the read is named
   in the entry's degraded notes (FR-004).

---

### User Story 2 - The fourth law is committed, not assumed (Priority: P2)

As an operator, the suite refuses a build in which an opaque box paints over
text it does not own — the failure mode that rendered a degraded note
unreadable in both themes while all three existing laws passed.

**Why this priority**: the instance is already fixed; this makes it stay fixed.

**Acceptance Scenarios**:

1. **Given** every route the smoke suite already sweeps, at every width and in
   both themes, **When** the laws are measured, **Then** a fourth law asserts
   that no element with a non-transparent computed background intersects a text
   leaf that is not its own descendant and paints above it, and it reports zero
   violations (FR-005).
2. **Given** a mutation control that plants an inline element with an opaque
   background over neighbouring text, **When** the suite runs, **Then** the
   fourth law fails — proving the law can go red (FR-006).
3. **Given** the three existing laws, **When** that same planted mutation runs,
   **Then** they still pass, documenting in a committed assertion that the
   fourth law covers a gap the other three structurally cannot (FR-007).

---

### User Story 3 - The suite reads no host state (Priority: P3)

As an operator, every gate is hermetic, so a green suite on the boundary means
the same thing as a green suite on my machine.

**Why this priority**: real and reproducible, but it misleads the operator
rather than the factory.

**Acceptance Scenarios**:

1. **Given** `tests/test_readonly_sweep.py::test_operational_error_becomes_transport`,
   **When** it runs with `ERGANE_ROOT` pointing at a populated runtime root,
   **Then** it passes — it constructs its own failure condition rather than
   relying on the absence of the operator's `doctor.db` (FR-008).
2. **Given** the whole pytest suite, **When** it runs with `ERGANE_ROOT` set to
   a real runtime root, **Then** it passes in full, proven by a committed test
   that asserts no test module reads a path outside the repository (FR-009).

---

### User Story 4 - The stage says what its spec is for (Priority: P2)

As an operator, the band under the graph tells me what this epic is *for*,
whether or not a story is selected.

**Why this priority**: it closes a missing concept and a layout jump with one
change. The pane can explain a story and cannot explain the spec that contains
it; and the band under the stage currently empties the moment a story is picked,
which reads as a glitch.

**Acceptance Scenarios**:

1. **Given** a spec whose body carries a `## Context` heading, **When** the
   showfloor document is assembled, **Then** the entry carries that section's
   first paragraph as a spec-level intent, lifted by the same text parse that
   already reads story intents (FR-010).
2. **Given** a spec whose body carries `## Sketch` and no `## Context`, **When**
   the document is assembled, **Then** the `## Sketch` paragraph is used; and
   given a spec with neither, **Then** the entry carries no intent and the band
   is not rendered at all rather than rendered empty (FR-011).
3. **Given** a spec with an intent, **When** the room renders with no story
   selected **and** again with a story selected, **Then** the band appears
   beneath the stage above the legend row in both, with identical text — proven
   by a committed Playwright assertion across both selection states (FR-012).
4. **Given** the room with no spec selected at all, **When** it renders, **Then**
   the room's own two-sentence explainer appears there instead (FR-013).

---

### Edge Cases

- A spec landed on the branch whose frontmatter still reads `ready`: the room
  must read the branch, not the frontmatter. This is the exact 006 case.
- A spec attested `landed` whose stories are **not** on the branch: the corpus
  read disagrees with the attestation. The branch wins and the disagreement is
  named in the degraded notes; an attestation is a claim, a landing is a fact.
- A story landed under a squash subject that does not name it: unresolvable
  from the branch, so it takes the Unknown Rule rather than `ready`.

## Requirements

### Functional Requirements

- **FR-001**: The showfloor document MUST derive each story's landed state from
  landing facts on the landing branch, through an ergane-exported seam, and not
  solely from a live `epic_status` answer.
- **FR-002**: `stories_landed` MUST count stories landed by content, so an
  unattested finished epic reports its true count.
- **FR-002a**: A landed story's `merged` stop MUST carry the landing commit's
  timestamp, and its facts MUST carry the landing SHA and the PR number parsed
  from the squash subject. Facts the branch cannot supply MUST stay unknown; this
  requirement adds no new store and reads no history the branch does not hold.
- **FR-003**: A live `epic_status` answer MUST govern every story it names; the
  corpus read MUST NOT overwrite a live stop.
- **FR-004**: A story neither source can place MUST render under the Unknown
  Rule and MUST be named in the entry's degraded notes; it MUST NOT default to
  the ladder's first stop.
- **FR-005**: The smoke suite MUST assert a fourth layout law across every route,
  width and theme it already sweeps: no element with a non-transparent computed
  background may paint over a text leaf it does not own.
- **FR-006**: The fourth law MUST be proven falsifiable by a committed mutation
  control that plants the violation and observes the law go red.
- **FR-007**: The mutation control MUST also assert that the three existing laws
  pass against the planted violation, recording the gap the fourth law closes.
- **FR-008**: No test in the suite may depend on the absence of the operator's
  runtime root; each MUST construct its own failure condition.
- **FR-009**: A committed test MUST assert that the suite reads no path outside
  the repository's own tree.

- **FR-010**: The showfloor document MUST carry a spec-level intent read from the
  spec body's `## Context` section, through the same parse that reads story
  intents.
- **FR-011**: `## Sketch` MUST be used when `## Context` is absent; a spec with
  neither MUST carry no intent, and the band MUST NOT render empty.
- **FR-012**: The band MUST render beneath the stage above the legend row, with
  identical text, in both the selected and unselected states.
- **FR-013**: With no spec selected, the room's own explainer MUST occupy that
  band instead.

### Key Entities

- **Landing facts** — per-story landing SHAs on the landing branch, read by
  content through the seam the corpus already trusts for attestation.
- **The ladder** — six stops, `ready → building → verifying → pr open → queue →
  merged`, whose stop is now resolved from two layered sources.

## Success Criteria

- **SC-001**: A spec with every story merged and no live workflow renders
  `LANDED n/n`, with no frontmatter edit.
- **SC-002**: The four layout laws report zero violations across the existing
  sweep, and each is proven falsifiable by its own mutation control.
- **SC-004**: A landed story's detail pane names when it merged, its SHA and its
  PR, instead of three dashes.
- **SC-005**: The band beneath the stage reads the same before and after a story
  is picked, and no spec's goal is missing from the room.
- **SC-003**: `uv run pytest -q` passes with `ERGANE_ROOT` set to a populated
  runtime root and with it unset, and the two runs agree.

## Assumptions

- Landing facts are read through an ergane-exported surface (constitution II);
  this spec adds no SQL and no git plumbing of its own.
- The landing branch is `dev` (D-011) and is read from configuration, never
  hard-coded.

## Work Graph

```yaml
US1:
  depends_on: []
  depends_on_merged: []
  implements: [FR-001, FR-002, FR-003, FR-004]
  timeout: 3600
US2:
  depends_on: []
  depends_on_merged: [US1]
  implements: [FR-005, FR-006, FR-007]
  timeout: 3600
US3:
  depends_on: []
  depends_on_merged: [US2]
  implements: [FR-008, FR-009]
  timeout: 3600
US4:
  depends_on: []
  depends_on_merged: [US3]
  implements: [FR-010, FR-011, FR-012, FR-013]
  timeout: 3600
```
