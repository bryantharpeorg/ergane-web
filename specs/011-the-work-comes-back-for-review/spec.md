---
state: ready
depends_on_landed: [013-the-gates-show-their-work]
# Flipped `ready` 2026-08-25, 11:36 PM CT. The hold is discharged: D-023 landed on
# dev at 14020d9 (#74), so the Playwright substitution and `DESIGN.md` § The review
# room are on the branch. READ THE PLAYWRIGHT NOTE BELOW BEFORE READING THE SPEC --
# the operator asked for a browser session by name and this spec uses a same-origin
# frame instead.
#
# REFINED 2026-08-25, ~10:45 PM CT, on the operator's instruction. It was a sketch
# with seven open questions and no Work Graph; it now has three stories, fourteen
# functional requirements and a compiled graph. `ergane spec validate` passes.
#
# It stays `draft` because D-023 must land first -- it decides the room's mechanism
# and adds a DESIGN.md section, and a node may not build against a decision that is
# still on a branch. Flip it when D-023 is on dev.
#
# TWO OF THE SEVEN QUESTIONS WERE BLOCKERS AND BOTH ARE ANSWERED, ONE OF THEM BY
# SUBSTITUTING A MECHANISM THE OPERATOR DID NOT ASK FOR. Read this before flipping.
#
#   Q1 constitution I -- answered by D-021 and by option C, which this spec's own
#   body already recommended for itself: the room composes the spec and hands the
#   operator the file to save, writing nothing. D-021's clause 1 refuses the write
#   anyway for want of a seam (PR-7), so C is not a stopgap here; for a room whose
#   output is a draft by nature it may be the permanent answer.
#
#   Q2 driving a browser -- THE OPERATOR ASKED FOR PLAYWRIGHT AND THIS SPEC DOES
#   NOT USE IT. "ideally it would be associated with a playwright browser session
#   navigating the parts of ergane-web that were changed." A Playwright session
#   launched by the pane means the pane's own process spawning Chromium on the
#   operator's host, navigating URLs, executing page scripts and writing files, all
#   behind one bearer token that today grants only reads. Constitution VI has never
#   reasoned about that blast radius.
#
#   The substitution: the operator's OWN browser is the browser. The room renders
#   the changed routes in a same-origin iframe at a width and theme the operator
#   picks, and runs the measurement sweep inside that frame. Same three tracks,
#   same measured numbers, same notes -- no subprocess, no host filesystem writes,
#   no new credential surface, and nothing for a leaked token to spawn. D-023
#   records the Playwright envelope that WOULD be required if the operator wants it
#   after all, so reversing this costs a decision and not a redesign.
#
# The remaining five are answered in the body: Q3 by a committed route manifest
# (US1), Q4 by writing nothing at all (US3), Q5 by refusing a partially landed
# epic, Q6 by naming the served revision on screen (US2), Q7 by staying out of
# scope.
---

# Feature Specification: The work comes back for review

**Feature Branch**: `011-the-work-comes-back-for-review`
**Created**: 2026-08-25 · **Refined**: 2026-08-25 · **Status**: Refined, held on D-023
**Input**: operator request, verbatim below

## Operator intent (as captured)

> after the coding is done. i want a way to review the work that was completed.
> This could be something with a text box that allows feedback, ideally it would
> be associated with a playwright browser session navigating the parts of
> ergane-web that were changed because of the specs/stories and allow us to take
> notes to create another spec with refined direction based on the review.

The second of two **HITL** surfaces for the product owner. 010 is how work
enters the floor; this is how the floor's output comes back. Together they close
the loop: idea → spec → build → review → idea.

## The precedent, and why it is the strongest evidence this spec has

This room already exists as a manual ritual, performed twice, and both times it
paid for itself:

- `docs/pane-review-2026-08-24.md` — recorded after 004 landed a green gate over
  a room whose stations were all outside the canvas.
- `docs/pane-review-2026-08-25.md` — recorded after 005; found three defects
  (F1 a clipped rank, F2 an opaque box painted over its own heading, F3 a suite
  pinning the live corpus) that **all four gates passed**. F1 and F3 became spec
  008, which dispatched at 7:40 AM CT and was complete by 8:44 AM.

That is the whole product in one paragraph: a gate that never renders cannot see
a defect that is only visible, and the review is what converts "looks not great"
into a spec the factory can take. This room automates a ritual with a measured
track record, not a hypothesis.

## Sketch

A review room, scoped to one landed epic. Three tracks, left to right:

| track | holds |
|---|---|
| **what changed** | the epic's stories, each with its landing SHA, PR and squash subject; the changed-file list; the routes those files reach |
| **the thing itself** | a live browser at one of those routes — real render, both themes, a width the operator picks — beside the *measured* numbers for that screen |
| **the notes** | one note per observation, each anchored to a story, a route, a width, a theme and a screenshot |

The room's output is a **captured TBD spec** in exactly the shape of 007 and 010:
operator intent verbatim, a sketch, open questions, no Work Graph, `state: draft`.
It never writes a dispatchable spec, and it never flips anything ready — that is
010's problem, and 010 has not solved it either.

**The measurement is the point, not the screenshot.** The 08-25 review was
useful because it reported "235px of graph hidden at 1280, US4 fully invisible,
scrollbar height 0px" rather than "the graph looks cut off." The harness that
produced those numbers is already committed —`measureLaws` in
`web/tests/smoke/showfloor.spec.ts` — and was run against the *running service*
rather than a fixture. A review room that renders a route and does not run that
sweep beside it has rebuilt the screenshot, which is the thing the constitution's
principle IV already rejects.

**A note is not prose.** Each note carries the coordinates that make it
reproducible: story, route, width, theme, the measured numbers at capture, and
the screenshot. F2 was findable because the review recorded the exact box
(`362..1049 × 220..300`, 80px tall, glyphs at `241..278`) — a textarea full of
paragraphs would not have carried that.

## User Scenarios & Testing

### User Story 1 - What changed reads from the branch (Priority: P1)

As an operator, I open a landed epic and see exactly what it changed and which
screens those changes reach.

**Why this priority**: the other two tracks are navigation and note-taking over
this one, and neither is reachable without it.

**Acceptance Scenarios**:

1. **Given** an epic every story of which is merged, **When** `/review/<spec-dir>`
   is requested with the bearer token, **Then** each story renders with its landing
   SHA, its pull request number and its squash subject (FR-001).
2. **Given** those landing commits, **When** the view renders, **Then** each story
   carries the list of files its commit changed (FR-002).
3. **Given** a committed route manifest mapping path patterns to routes, **When**
   the view renders, **Then** each changed file names the routes it reaches, and a
   file matching no pattern reads as reaching no known route rather than being
   dropped (FR-003).
4. **Given** an epic with at least one story not yet merged, **When** the route is
   requested, **Then** the room refuses and names the unmerged stories — a review
   of half an epic is a review of nothing (FR-004).
5. **Given** the route manifest, **When** the suite runs, **Then** a committed test
   asserts every route the application serves appears in it, so the manifest cannot
   silently rot (FR-005).
6. **Given** no bearer token, **When** the route is requested, **Then** the answer
   is 401 (FR-006).

---

### User Story 2 - The thing itself renders beside its numbers (Priority: P2)

As an operator, I look at a changed screen — at a width and in a theme I choose —
and the four layout laws are measured on what I am looking at, not on a fixture.

**Why this priority**: it is the half a headless gate cannot do, and it is the half
that found every defect the two manual reviews found.

**Acceptance Scenarios**:

1. **Given** a route from US1, **When** the operator selects it, **Then** it
   renders in a same-origin frame at the selected width and theme (FR-007).
2. **Given** a rendered frame, **When** the sweep runs, **Then** the four layout
   laws are measured inside that frame and their results render beside it, with the
   measured numbers — not a pass/fail alone (FR-008).
3. **Given** any render, **When** the view renders, **Then** it names the revision
   the service is currently serving, and says plainly whether that revision
   contains the epic under review (FR-009).
4. **Given** a served revision that does not contain the epic's stories, **When**
   the view renders, **Then** that fact is stated where the operator cannot miss
   it, because they are then reviewing something other than what they think
   (FR-010).
5. **Given** both themes at every width the suite already sweeps, **When** the room
   itself renders, **Then** the four layout laws report zero violations on the room
   (FR-011).

---

### User Story 3 - A note carries its coordinates, and the room writes nothing (Priority: P3)

As an operator, each observation I record carries what makes it reproducible, and
the room hands me a spec draft to save rather than saving one.

**Why this priority**: it is the output of the whole room, and it needs both other
tracks to have coordinates to record.

**Acceptance Scenarios**:

1. **Given** a rendered route, **When** the operator records a note, **Then** the
   note carries the story, the route, the width, the theme and the measured numbers
   at the instant of capture (FR-012).
2. **Given** one or more notes, **When** the operator asks for the draft, **Then**
   the room composes a captured-TBD spec in the shape of 007 and 010 — operator
   intent verbatim, a sketch, open questions, no Work Graph, `state: draft` — and
   presents it for the operator to save (FR-013).
3. **Given** the composed draft, **When** anything at all happens, **Then** the
   pane writes no file, creates no directory and mutates no spec: the operator
   saves it, or does not (FR-014).

---

### Edge Cases

- An epic whose stories landed across more than one dispatch: the room reviews
  what is on the branch, which is the union, and says so.
- A note taken and then the width changed: the note keeps the coordinates it was
  taken at. A note whose coordinates are mutable is not reproducible.
- A route in the manifest that 404s: rendered as the 404 it is. The room shows what
  the service does, not what the manifest expected.

## Requirements

### Functional Requirements

- **FR-001**: Each story MUST render with its landing SHA, pull request number and
  squash subject, read from the landing branch.
- **FR-002**: Each story MUST carry the file list its landing commit changed.
- **FR-003**: Each changed file MUST name the routes it reaches via a committed
  route manifest; an unmatched file MUST read as reaching no known route.
- **FR-004**: An epic with an unmerged story MUST be refused, naming the stories.
- **FR-005**: A committed test MUST assert that every route the application serves
  appears in the route manifest.
- **FR-006**: The route MUST answer 401 without the bearer token.
- **FR-007**: A selected route MUST render in a same-origin frame at the selected
  width and theme.
- **FR-008**: The four layout laws MUST be measured inside that frame and their
  measured numbers rendered beside it.
- **FR-009**: The view MUST name the revision the service is serving and whether it
  contains the epic under review.
- **FR-010**: A served revision not containing the epic MUST be stated
  unmissably.
- **FR-011**: The room MUST report zero violations of the four layout laws at every
  width and in both themes the suite sweeps.
- **FR-012**: A note MUST carry story, route, width, theme and the measured numbers
  at capture.
- **FR-013**: The room MUST compose a captured-TBD spec in the shape of 007 and 010
  and present it for the operator to save.
- **FR-014**: The pane MUST write no file, create no directory and mutate no spec.

### Key Entities

- **The route manifest** — a committed mapping from source-path patterns to the
  routes those paths reach. Honest and dumb, guarded by FR-005's test.
- **The measurement sweep** — the four layout laws, already committed as
  `measureLaws` in `web/tests/smoke/showfloor.spec.ts`.
- **A note** — an observation plus the five coordinates that make it reproducible.

## Success Criteria

- **SC-001**: An operator reviews a landed epic's changed screens at chosen widths
  and themes without leaving the pane and without a terminal.
- **SC-002**: Every note carries enough to reproduce what it describes.
- **SC-003**: The room's output is a file the operator saves; nothing on disk
  changes because the room ran.

## Assumptions

- The pane is serving the tree under review, or says it is not. The room does not
  build a branch; FR-009 and FR-010 exist because of that.
- The route manifest lives in this repository and is maintained by whoever adds a
  route — FR-005's test is what makes that true rather than hoped.

## Questions, and how each was resolved

All seven are closed. Three were closed by a decision recorded in `docs/decisions.md`
and four inside this body.

| # | question | resolution |
|---|---|---|
| 1 | constitution I forbids spec editing | **option C** — the room composes and hands over; it writes nothing (D-021, FR-014) |
| 2 | driving a browser is a new kind of power | **not driven** — the operator's own browser renders a same-origin frame (D-023) |
| 3 | diff → route is a mapping nothing exports | **a committed manifest**, guarded by a test that every served route appears in it (FR-003, FR-005) |
| 4 | where do review artifacts live | **nowhere** — with no server-side screenshots there is no artifact to house (FR-014) |
| 5 | what is reviewable, and when | **a fully merged epic**; a partial one is refused by name (FR-004) |
| 6 | whose render is under review | **the running service**, with the served revision named and mismatch stated unmissably (FR-009, FR-010) |
| 7 | debugging sessions | **out of scope**, captured verbatim, revisit after v1 |

**On question 2, at length, because it is the one the operator will want to argue
with.** The ask was a Playwright session. What that costs is the pane's own process
spawning Chromium on the operator's host, navigating URLs, executing page scripts
and writing screenshot files — reachable behind one bearer token that today grants
only reads of the floor. The questions it opens are not rhetorical: does the browser
run in the pane's process or a sandbox, is the URL set closed or operator-typed, do
screenshots leave the host, and what does the token authorize if it leaks.

The frame answers all four by not asking them. The operator's browser is already
running, already rendering this origin, and already trusted with everything the pane
shows. A same-origin frame can be measured from the parent document with the sweep
that is already committed, which means the numbers come from the same harness that
found F1, F2 and F3 — not from a reimplementation.

**What is actually lost.** A server-side screenshot file to attach to a note, and
the ability to review a route the operator's browser cannot reach. Neither was
load-bearing: this spec's own body already says *"the measurement is the point, not
the screenshot,"* and the room reviews this pane, which is by definition reachable
from the browser looking at it.

**What would bring Playwright back.** Reviewing a *built branch* rather than the
running service (question 6's other horn), or reviewing a target repo that is not
this pane. Both are real futures. D-023 records the envelope they would need — closed
derived URL set, sandboxed browser, screenshots that never leave the host — so
reversing this costs a decision, not a redesign.

## Out of scope (already known)

- Dispatching the spec the review produces. It comes out `draft`, like 007 and
  010, and a human takes it from there.
- Reviewing anything but this pane. The room renders the target repo's own
  surfaces; a factory that built a non-web repo has nothing to navigate.
- Replacing the gates. A review finds what a headless gate cannot see; it does
  not excuse a gate that does not run (principle IV).

## Work Graph

```yaml
US1:
  depends_on: []
  depends_on_merged: []
  implements: [FR-001, FR-002, FR-003, FR-004, FR-005, FR-006]
  timeout: 3600
US2:
  depends_on: []
  depends_on_merged: [US1]
  implements: [FR-007, FR-008, FR-009, FR-010, FR-011]
  timeout: 3600
US3:
  depends_on: []
  depends_on_merged: [US2]
  implements: [FR-012, FR-013, FR-014]
  timeout: 3600
```
