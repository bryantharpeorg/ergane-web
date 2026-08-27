---
state: draft
depends_on_landed: [014-a-draft-shows-what-will-run]
# REFINED 2026-08-26 by D-025, from the sketch captured 2026-08-25. Every one of
# the six open questions the sketch carried is answered in that entry; none of
# them are open here any more, and the sketch's "OQ1 is BLOCKING" banner was
# already stale when it was written -- D-021 amended constitution I the same day.
#
# THIS SPEC IS REFINED AND STILL MUST NOT BE FLIPPED. What holds it is not a
# question and not a principle. It is a capability in another repository:
#
#   ergane 087-the-operators-checkout-is-an-input   (N50: nowhere durable to write)
#          088-intent-is-declared-by-a-verb          (the seam itself, library-first)
#          -> ergane-cli release to PyPI
#          -> `ergane-cli` pin bumped off 0.2.0 in this repository, BY HAND
#          -> then, and only then, flip this spec `ready`
#
# `depends_on_landed` CANNOT EXPRESS THAT EDGE. It names spec directories in this
# corpus and nothing else, so "blocked on another repository's release" has no
# frontmatter spelling and never will. The mechanism is `state: draft` plus the
# operator, which is the mechanism that lost a flip of 013 inside a multi-file PR
# on 2026-08-25 (#58, redone as #60). D-025 makes the operator hold both acts --
# he lands the pin bump himself and he flips this spec himself -- so the spec
# cannot dispatch early, because the person who would flip it is the person who
# has not yet bumped it.
#
# `depends_on_landed` names 014 because this room is 014's room: the Declare
# control lives on the drafting table, beside the checks that justify pressing it.
# 018 is not an edge -- it is a door onto the same room, and this spec does not
# need it to be open.
#
# WHAT WAS CUT, so nobody rebuilds it from the old sketch. This spec claimed four
# moves. It now claims one verb, Declare. Create, Commission and Save are named
# out of scope below with their reasons, and all three keep their constitutional
# standing under D-021 clause 2 -- they have no requirement behind them, which is
# a different thing from being forbidden. The reading half of the old move 3 is
# not cut; it shipped, as 014, and this spec builds on it rather than repeating it.
#
# NO plan.md AND NO tasks.md, DELIBERATELY. `ergane spec validate` refuses this
# spec today for want of them, and that refusal is correct: the trio is written
# when the seam's real shape is known, not against the shape this spec assumes.
# See § Assumptions -- if ergane 088 ships a different signature, this spec is
# re-refined before it dispatches rather than adapted to inside an attempt.
---

# Feature Specification: An idea becomes a spec

**Feature Branch**: `010-an-idea-becomes-a-spec`
**Created**: 2026-08-25 · **Refined**: 2026-08-26 · **Status**: Refined, held at draft
**Input**: operator request of 2026-08-25, narrowed by D-025

## The gap, stated precisely

Declaring a spec `ready` is the most expensive act in this product. Within 300
seconds the roadmap scheduler dispatches nodes that spend tokens, open pull
requests and move the landing branch.

It is performed by editing two characters in a markdown file.

Nothing validates the transition. Nothing records who made it or when. Nothing
can refuse it — a spec parked forever behind an unlanded dependency will sit at
`ready` and the only signal is a `parked` count with no name in it. And because
the act is indistinguishable from any other text edit, it can be lost the way any
other text edit can: on 2026-08-25 a flip of spec 013 was carried in a pull
request that had been armed for auto-merge *before* the edit was written. The
branch merged its pre-flip tree, 013 landed reading `draft`, and #60 existed only
to redo it.

The operator asked for a grooming room. After D-025 removed everything from that
request that has no seam to ride, what is left is this one act — and it is the
half worth having, because it is the half that is dangerous today.

## The rule this spec is asking for

**A spec's declared state changes through a verb that shows its bytes, states its
consequence, and can refuse.** Not through an editor, and not through a pane that
knows what frontmatter looks like.

Three things follow, and each is a clause of constitution I rather than a
preference:

- **The pane composes nothing.** It calls a seam for the exact bytes, renders
  them, and calls the seam again to apply the same Change the operator saw. A
  pane that wrote `state: ready` itself would be re-implementing the roadmap's
  readiness rules in a second language in a second repository — D-005 by
  construction, and the reason clause 1 refused this spec for the whole of its
  short life.
- **The consequence is on the control.** Clause 6. Not in a tooltip, not in a
  modal, not in a paragraph above the fold: in the label the operator reads last.
- **A refusal is rendered, not softened.** Clause 5 and principle III. If the seam
  says the transition is illegal, or that the tree moved under the preview, the
  room says exactly that, in the seam's words.

## Requirements this spec does not meet on its own

`ergane spec` exports four read-only verbs today. **Every requirement below is
unbuildable until the seam described in D-025 exists in an installed
`ergane-cli`**, and this spec does not describe that seam — ergane 088 does. The
frontmatter says what has to land first, in order. An implementer who finds
`factory.roadmap`'s authoring functions absent has not found a defect; they have
found this spec dispatched too early, and should stop rather than compose the
bytes locally.

## User Scenarios & Testing

### User Story 1 - The operator declares a spec ready, and sees what that costs (Priority: P1)

As an operator, I change a spec's declared state from the room I reviewed it in,
seeing the exact bytes before they are written and the consequence before I press.

**Why this priority**: it is the whole spec, and it is the act that has already
cost this build a story.

**Acceptance Scenarios**:

1. **Given** a spec on its drafting table, **When** the room renders, **Then** the
   transitions the seam reports as legal for that spec are offered, and no others,
   and the pane decides none of them itself (FR-001, FR-004).
2. **Given** the operator chooses a transition, **When** the room responds,
   **Then** it renders the seam's composed Change — the exact bytes that would be
   written — as a document, and nothing has been written yet (FR-002).
3. **Given** the composed Change on screen and the transition is to `ready`,
   **When** the confirming control renders, **Then** its own label states that the
   roadmap dispatches within 300 seconds, spending tokens, opening pull requests
   and moving the landing branch (FR-003).
4. **Given** the operator confirms, **When** the write is applied, **Then** the
   seam is called with the same Change that was rendered, and the pane composes no
   bytes of its own at any point in the exchange (FR-004, FR-005).
5. **Given** the working tree moved between the preview and the confirmation,
   **When** the operator confirms, **Then** the seam's refusal renders in its own
   words, nothing is written, and the room does not retry (FR-006).
6. **Given** any answer from the seam, **When** the room renders it, **Then** it is
   shown unsoftened and is not reduced to a success or failure pill (FR-007).
7. **Given** a successful apply, **When** the room renders the spec's state again,
   **Then** the state shown is re-read through the seam, never the state the room
   believes it just wrote (FR-008).
8. **Given** any confirmed write, **When** the diff of the operator's tree is
   inspected, **Then** nothing outside that spec's own files under `specs/` has
   changed (FR-009).
9. **Given** `PANE_DEMO=1`, **When** a Declare is confirmed, **Then** it is applied
   to the demo corpus and this repository's own `specs/` is byte-identical before
   and after (FR-010).
10. **Given** no bearer token, **When** any route this story adds is requested,
    **Then** the answer is 401, like every other route (FR-011).

---

### Edge Cases

- **A spec whose state cannot legally change at all.** The room offers no
  transition and says why in the seam's words. It does not render a disabled
  control with no explanation, and it does not decide the answer itself.
- **The seam refuses because a `depends_on_landed` edge is unlanded.** Rendered
  verbatim, naming the unmet edge. This is the case `ergane spec list` cannot name
  today and is a large part of why the verb is worth having.
- **The operator opens two tabs on the same spec.** The second confirmation
  carries a Change computed against a revision that no longer matches; the seam
  refuses it. The room does not deduplicate, does not lock, and does not guess.
- **The apply succeeds and the re-read fails.** Two facts, rendered as two facts:
  the write's own result, and a degraded read that names what could not be
  re-learned. Never a rendered state the room inferred.

## Requirements

### Functional Requirements

- **FR-001**: The drafting table MUST offer exactly the transitions the seam
  reports as legal for that spec, and MUST NOT offer, hide, or order them by any
  rule of its own.
- **FR-002**: Choosing a transition MUST render the seam's composed Change — the
  exact bytes that would be written — before anything is written, in the room's
  reading measure.
- **FR-003**: The confirming control MUST carry the consequence in its own label.
  For a transition to `ready` that sentence MUST name the 300-second dispatch, the
  spend, the pull requests and the landing branch.
- **FR-004**: The pane MUST NOT compose frontmatter bytes, MUST NOT decide which
  transitions are legal, and MUST NOT write a spec file itself. Both halves of the
  exchange MUST ride the seam.
- **FR-005**: The apply MUST be called with the same Change that was rendered and
  confirmed, carrying the revision it was computed against.
- **FR-006**: A refusal — illegal transition, unmet edge, or a tree that moved —
  MUST render in the seam's own words, MUST write nothing, and MUST NOT be retried
  by the room.
- **FR-007**: The seam's result MUST render unsoftened and MUST NOT be reduced to a
  composite success/failure indicator.
- **FR-008**: After an apply, the spec's declared state MUST be re-read through the
  seam before it is rendered.
- **FR-009**: A confirmed write MUST touch nothing but that spec's own files under
  `specs/`, proven by a committed test that inspects the tree.
- **FR-010**: Under `PANE_DEMO=1` the configured specs root MUST resolve to a copy
  of the corpus made in a temporary directory at startup, so no demo write and no
  gate run can reach the repository's own `specs/`.
- **FR-011**: Every route this story adds MUST answer 401 without the bearer token,
  and MUST be listed in `route-manifest.json` with every source path that reaches
  it.

### Key Entities

- **The Change** — the seam's composed write: the exact bytes, the path they would
  be written to, and the revision they were computed against. It is produced by the
  seam, rendered by the pane, handed back to the seam unmodified, and understood by
  neither the pane nor this spec beyond those three facts.
- **The demo corpus** — a copy of the configured specs root made in a temporary
  directory at startup under `PANE_DEMO=1`, on the shape `pane/config.py:109`
  already uses for the demo attention store. It is not a fixture and is not
  recorded: it is the live corpus, copied, so constitution V is not in play.

## Success Criteria

- **SC-001**: A committed test asserts the bytes rendered for confirmation are the
  seam's, byte-identical, with no frontmatter composition anywhere in this
  repository's diff.
- **SC-002**: A committed test asserts a Change computed against one revision and
  applied against another is refused, with the seam's message carried through.
- **SC-003**: A committed test asserts the tree after a confirmed write differs
  only inside the spec's own directory.
- **SC-004**: A committed test asserts the repository's own `specs/` is unchanged
  across a full demo-mode run of the write path.
- **SC-005**: A committed smoke test drives preview → consequence → confirm →
  applied result against the demo corpus, asserting the consequence sentence is on
  the control that performs the write.

## Assumptions

- The seam exposes a `plan`/`apply` pair per verb, with the plan carrying its
  revision. Ruled in D-025 and specified in ergane 088. If ergane ships a different
  shape, this spec is re-refined before it dispatches — not adapted to in an
  attempt.
- Copying the corpus at startup is cheap. Seventeen directories of markdown; the
  attention store already does the same thing on the same code path.

## Out of scope

- **Create.** `ergane spec new` produces a skeleton this room cannot then fill in,
  because Save is out of scope; the operator opens a session and runs
  `/speckit-specify`, which creates the directory itself and writes better content
  into it. A control whose product is a dead file is refused on its merits, not on
  principle (D-025).
- **Save.** Needs a content-write seam ergane 088 does not describe, and needs an
  answer to N50 for ordinary editing that is larger than the one 087 makes.
- **Commission.** It is a Claude Code invocation and should stay one. Putting a
  model route, a key, a cost and a refusal vocabulary behind a page is a second
  spec's problem, and it would end this pane's deterministic read path.
- **Attest.** `state: landed` is not one of constitution I's four named verbs.
  A control for it fails clause 2. It is a fine CLI verb and it does not come here.
- **Dispatching, pausing, killing or retrying anything.** Forbidden by name and
  unchanged by D-021 and D-025.
- **Multi-repo.** The pane reads one target repo.
- **Debugging sessions.** Captured from the operator on 2026-08-25 and deliberately
  not designed: "could eventually also be built into things used for debugging
  sessions." It does not widen this spec.

## Work Graph

```yaml
US1:
  depends_on: []
  depends_on_merged: []
  implements: [FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011]
  timeout: 5400
```
