---
state: draft
depends_on_landed: []
# Written 2026-08-28 from a measured pass over the SHIPPED Showfloor, live and
# demo, at 1440 / 1600 / 2560 in both themes. Screenshots and measurements are
# in the session's scratchpad; every number below was read off a running pane,
# not estimated.
#
# WHAT THE PASS FOUND, AND WHAT IT DID NOT. The room is the approved comp. The
# second world's tokens are in `web/src/styles/global.css` byte for byte, the
# `17rem` · `1fr` · `26rem` grid is the mock's, the ladder is the mock's, the
# legend is mounted once, and the graph is inside a `.dag-scroll` whose
# `overflow-x: auto` measured `scrollWidth 797` against `clientWidth 770` — so
# 004's containment defect is genuinely fixed and no card crosses its box. On a
# live floor with `ERGANE_ROOT` loaded, the detail pane is RICHER than the comp:
# the gate-run block carries per-attempt, per-gate PASS/FAIL with durations and
# the command each gate ran. None of that needs work and none of it is in scope.
#
# What is left is the OPENING READING — the first two seconds, before an
# operator has clicked anything — and it is where all three stories below live.
#
# ONE FINDING WAS RE-MEASURED AND DEMOTED, and it is worth the ink because the
# first read of it was wrong. Under `PANE_DEMO=1` the room opens on 018 showing
# two `read degraded` slabs, an empty ladder and `LANDED 0/1`, which reads as a
# broken room. Under `PANE_DEMO=0` the same spec reads `LANDED 1/1`, `MERGED`,
# `pr #102`, sha `10ec6ba`, a full ladder and eleven FR keys. The staleness is
# the Fixture floor's, not the room's: `fixtures/landing/landing-facts.json`
# stops at 015 and `fixtures/workgraphs/` holds no pane spec at all. That is an
# operator re-recording (constitution V; 016's plan forbids a node regenerating
# a fixture from its own branch) and it is therefore NOT a story here. See
# § Out of scope.
#
# TWO MORE WERE TRACED UPSTREAM AND ARE NOT PANE DEFECTS. The metric cells
# `LAST STORY` and `SPEND TO DATE` read `unknown` on every spec, live included,
# because `ledger/usage-records-stopped-carrying-counts` — an OPEN CRITICAL
# doctor finding — records no per-request counts since 2026-08-26. The pane is
# already honest about it under the Unknown Rule. Filling those cells is
# ergane's work, not this repository's, and a story that "fixed" it here would
# be inventing a number (constitution V).
---

# Feature Specification: The room reads on arrival

**Feature Branch**: `019-the-room-reads-on-arrival`
**Created**: 2026-08-28 · **Status**: Draft — measured, not yet refined
**Input**: an operator's visual pass over the shipped Showfloor against the
approved `Showfloor Redrawn` comp, 2026-08-28

## Context

The Showfloor is the room an operator opens to see what the factory is doing,
and it is judged in its first two seconds — before any click, on whatever spec
the default selection lands on. That opening reading is the one part of the
room the second world never specified, because 005 specified what a *pick*
earns and 008 specified what a stage *takes*, and nobody specified what an
arrival *shows*.

Measured on 2026-08-28, arriving at `/showfloor` on a live floor: the rail
selects 018, the stage draws one card, the detail track collapses to zero, the
goal band under the graph reads `The pane has four rooms. **Two of them are on
the Masthead.** The other two — 011's` with the asterisks and backticks
printed, and 560px of empty surface sits below the legend. On 015 the same band
stops mid-sentence, at `` `ergane.yaml` declares four gates — `test`,
`typecheck`, `unit`, `smoke` — and ``, and says nothing further.

Three defects, one moment. None of them is a layout question and none needs a
token: the room is already the approved comp. What arrives is not.

## User Scenarios & Testing

### User Story 1 - The goal band says the whole sentence, as prose (Priority: P1)

As an operator, the band under the graph tells me what the spec on stage is
for, in one complete sentence I can read, so the stage explains itself without
my opening the spec file.

**Why this priority**: it is a wrong answer on screen, not a missing one. A
sentence that stops at `— and` is the room asserting that the spec's goal ends
there, and printed `**` marks tell an operator the pane is showing them a file
rather than reading it.

**The cause is one guard in one function.** `_intent_after`
(`pane/showfloor.py:222`) ends the paragraph at any line beginning with `**`.
The guard exists to stop the reader crossing a Spec Kit template label
(`**Why this priority**: …`), and it also fires on the second line of any
paragraph whose wrap happens to land on a bold word — which is what 015's
`## Context` does. The same function serves story intents, so both readings
carry the defect.

**Acceptance Scenarios**:

1. **Given** a spec whose `## Context` paragraph wraps onto a line beginning
   with `**`, **When** the goal band is read, **Then** the whole paragraph is
   returned, through its final sentence (FR-001).
2. **Given** a paragraph followed immediately — with no blank line — by a
   template label of the form `**Label**:`, **When** it is read, **Then** the
   paragraph ends before the label and the label is not part of it (FR-002).
3. **Given** a paragraph carrying inline emphasis or code marks, **When** it is
   read, **Then** those marks are gone from the text and the words they wrapped
   remain, in order (FR-003).
4. **Given** a story heading's own intent paragraph, **When** it is read,
   **Then** it obeys FR-001 through FR-003 identically, because it is the same
   reader (FR-004).
5. **Given** a spec that states no goal under either heading, **When** the room
   renders, **Then** no band is drawn at all, exactly as today (FR-005).

---

### User Story 2 - The room opens on a story (Priority: P1)

As an operator, opening the Showfloor shows me a spec *and* a story of it, so
the pane is telling me something before I have clicked anything.

**Why this priority**: it is what makes the difference between the comp and the
shipped room at a glance. The comp opens with a story selected; that is why it
reads as full. Shipped, `selectedStory` begins `null`, D-016 collapses the
`26rem` detail track to zero, and the arrival is one row of cards over an empty
surface — measured 2026-08-28: content ends 440px into a 1000px frame.

**This does not contradict D-016.** D-016's rule is that *the track is a
story's track, not a permanent one* — it collapses when no story is being told,
and that stays true: a spec with no stories still collapses it. What changes is
that arrival is itself a reading, not an empty wait. The rail already picks a
default spec on the same reasoning; the pane is picking a default story on the
reasoning the rail was given.

**Acceptance Scenarios**:

1. **Given** a selected spec carrying at least one story, **When** the room
   first renders, **Then** a story is selected and the detail pane is telling
   it (FR-006).
2. **Given** a spec with a story the factory is working, **When** the room
   opens, **Then** that story is the one selected (FR-007).
3. **Given** a spec whose stories have all merged, **When** the room opens,
   **Then** the newest merged story is selected (FR-007).
4. **Given** a spec whose stories are neither building nor merged, **When** the
   room opens, **Then** the first story is selected (FR-007).
5. **Given** a story is open and the rail selection changes to another spec,
   **When** the new spec renders, **Then** it opens on *its own* default story
   and never on a story of the spec that was on stage (FR-008).
6. **Given** a selected spec carrying no stories at all, **When** the room
   renders, **Then** the detail track stays collapsed and the pane holds the
   room's own explanation, exactly as today (FR-009).
7. **Given** any of the above, **When** the URL is read, **Then** it names the
   spec and never the story: a pick is still a reading, not a place (FR-010).

---

### User Story 3 - The status column carries the times its seams already have (Priority: P2)

As an operator, the detail pane's status list tells me *when* each stop
happened, so the pane reads as a history rather than a checklist.

**Why this priority**: it is the comp's richest column and the shipped one is
almost empty — on 015/US1, live, five of six stops show a green dot beside a
bare `—`, and only `merged` carries an instant. A dot that says "done" beside a
time that says "unknown" is two readings of one fact, and the weaker one wins
the glance. P2 because, unlike US1 and US2, nothing on screen is *wrong*
today: it is thin, and thin is honest.

**Acceptance Scenarios**:

1. **Given** a story whose stops the approved seams record an instant for,
   **When** the pane tells it, **Then** each such stop shows that instant
   (FR-011).
2. **Given** a stop no approved seam records an instant for, **When** the pane
   tells it, **Then** it shows `—` and the spec names it as having no seam, so
   the gap is a recorded answer rather than a silence (FR-012).
3. **Given** a story that has not reached a stop, **When** the pane tells it,
   **Then** that stop reads as ahead and carries no invented time (FR-013).
4. **Given** any instant shown, **When** it is compared with the seam it came
   from, **Then** it is that seam's own value, not a value derived from another
   stop's (FR-014, constitution V).

---

### Edge Cases

- A paragraph that is nothing but a template label: the band renders nothing,
  under FR-005's existing rule.
- A spec whose only story has a frozen ladder: US2 selects it — a killed story
  is the one an operator most needs open, and the pane already tells it.
- A story instant recorded in a different timezone or format from the others:
  it is shown in the room's existing instant format, unchanged; US3 adds no new
  formatting rule.

## Requirements

### Functional Requirements

- **FR-001**: A paragraph MUST be read through its end, including continuation
  lines that begin with `**`.
- **FR-002**: A line matching a template label — `**…**` followed by `:` — MUST
  still end the paragraph, at any position.
- **FR-003**: Inline emphasis and code marks MUST be removed from the text the
  band renders, leaving the words in order. This is D-019's "treated as prose"
  honoured, not amended: prose is what a reader reads, and `**` is what a file
  carries.
- **FR-004**: Story intents and spec goals MUST be read by the one reader, so
  the two cannot disagree about where a paragraph ends.
- **FR-005**: A spec stating no goal MUST render no band, unchanged.
- **FR-006**: On first render of a spec carrying stories, a story MUST be
  selected.
- **FR-007**: The default story MUST be the story being built; else the newest
  merged; else the first.
- **FR-008**: A change of spec MUST re-derive the default story for the new
  spec and MUST NOT carry the previous selection.
- **FR-009**: A spec carrying no stories MUST leave the track collapsed and the
  pane holding the room's explanation.
- **FR-010**: The story selection MUST NOT appear in the URL.
- **FR-011**: Every status stop whose instant an approved seam records MUST show
  that instant.
- **FR-012**: A stop no seam records MUST show `—`, and this spec MUST name
  which stops those are.
- **FR-013**: A stop not yet reached MUST carry no time.
- **FR-014**: An instant MUST be the recording seam's own value, never derived
  from another stop.

### Key Entities

- **`_intent_after` / `parse_spec_intent`** (`pane/showfloor.py`) — the one
  paragraph reader, serving both the spec goal and every story intent.
- **`Showfloor.tsx`'s `selectedStory`** — the room's story selection, held as
  state and deliberately not a route segment (005 US4, D-016).
- **The status stop list** (`DetailPane.tsx`, fed by `derive_ladder`) — six
  named stops per story.

## Success Criteria

- **SC-001**: No goal band on any spec in this repository's corpus ends
  mid-sentence, and none prints a `*` or a backtick.
- **SC-002**: Arriving at `/showfloor` with no path segment renders a filled
  detail pane whenever the default spec has a story.
- **SC-003**: Every stop in the status list either carries an instant or is
  named in this spec as having no seam that records one.

## Assumptions

- The seams that record stop instants are the ones already on the approved list
  (`epic_status`, the verification store, landing facts). US3 adds no seam and
  asks for no new one; it spends its first task establishing which stops those
  seams answer for, and FR-012 makes the remainder a recorded answer rather
  than an omission.
- `ready` is expected to be one of the stops with no recorded instant: the
  frontmatter flip is a text edit nothing observes today. That is spec 010's
  subject, not this one's.

## Out of scope

- **Re-recording the Fixture floor.** `fixtures/landing/landing-facts.json`
  stops at 015 and `fixtures/workgraphs/` carries no pane spec, so demo mode
  shows 016–018 as degraded reads. It is a real gap and it is an *operator*
  act: constitution V requires a recording from a real floor, and 016's plan
  names regenerating a fixture from a node's own branch as invention. A node
  must not do it and this spec does not ask one to.
- **`LAST STORY` and `SPEND TO DATE`.** Blocked upstream on the open critical
  finding `ledger/usage-records-stopped-carrying-counts`. The pane is already
  honest about the gap; filling it here would be inventing a number.
- **Any change to tokens, grid, ladder or legend.** The room is the approved
  comp and this spec does not touch `DESIGN.md`.
- **The empty surface below the legend.** Real, measured, and a layout question
  the comp does not answer either — the comp's own stage ends and stops. Worth
  a separate spec if it still reads badly once the pane opens filled.

## Work Graph

```yaml
US1:
  depends_on: []
  depends_on_merged: []
  implements: [FR-001, FR-002, FR-003, FR-004, FR-005]
  timeout: 3600
US2:
  depends_on: []
  depends_on_merged: []
  implements: [FR-006, FR-007, FR-008, FR-009, FR-010]
  timeout: 3600
US3:
  depends_on: []
  depends_on_merged: [US1, US2]
  implements: [FR-011, FR-012, FR-013, FR-014]
  timeout: 3600
```
