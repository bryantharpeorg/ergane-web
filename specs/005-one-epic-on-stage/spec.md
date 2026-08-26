---
state: landed
# Attested landed 2026-08-25. US1 ee9c0863b08d (#33), US2 bd74ce6e7344 (#34),
# US3 485b77503e3d (#35), US4 bc7818ff7db6 (#36) - all four observed on dev.
# Dispatched 10:10 PM CT 2026-08-24, complete 12:26 AM CT 2026-08-25: 2h16m for
# four stories on claude-opus-5, every attempt judged PASS (5 of 5).
#
# US1 took two attempts and the second was not a code defect. It branched from a
# dev that did not yet carry spec 007, whose deliberately story-less TBD sketch
# landed underneath it mid-build; the boundary gate ran green on the branch and
# GitHub ran the checks on the merge, where two of US1's own assertions failed.
# The recovery did not weaken them - it replaced "every entry renders stories"
# with "an entry renders exactly the stories its spec declares, and one that
# declares none names `stories` in `unknown` rather than going quiet." A
# story-less spec is now a supported shape of the corpus, which 007 needs.
# Filed against ergane as N48: the gate certifies a tree CI never tests.
#
# FR-014 landed stronger than it was written. The three laws are asserted at
# 1280 and 1600 in both themes over every rail entry, and US3 added two guards
# this spec did not ask for: a floor on the sweep itself (>20 elements, >10 text
# leaves) so a sweep over an empty page cannot pass for the wrong reason, and a
# mutation control that plants an escape, a runaway and a collision into the
# live room and asserts each law goes red for its own violation. 004's defect -
# nine of nine stations outside the canvas under a green gate - cannot recur
# silently.
#
# Subtraction, as D1 promised: EpicStage, LandingLine, RouteEdge, StationNode,
# layout, motion, transitions and states are deleted, @xyflow/react and
# @dagrejs/dagre are out of package.json, and tokens.css is now a pure alias
# layer over the second world's tokens with no colour literal of its own - so
# the Desk keeps working unrestyled until 006 changes its world.
#
# Drafted 2026-08-24 under D-015, the operator-approved second world. The comp is
# committed at `.impeccable/mocks/showfloor-redrawn.html`; DESIGN.md was replaced
# FIRST, so every appearance requirement below is scored against a document that
# already agrees with it - the order constitution VIII demands.
---

# Feature Specification: One epic on stage

**Feature Branch**: `005-one-epic-on-stage`
**Created**: 2026-08-24
**Status**: Draft
**Input**: D-015; `.impeccable/mocks/showfloor-redrawn.html` (approved comp);
`docs/pane-review-2026-08-24.md` (the measurements that retired the first world)

## Context

The Showfloor becomes a master–detail: a rail of every spec with its status, a
stage holding exactly one epic's work graph, and a detail pane for the selected
story. The signature is the **status ladder** — six stops, ready → building →
verifying → pr open → queue → merged — worn identically by every story as a
mini-rail on its node card and expanded to named, timestamped steps in the
detail pane. `DESIGN.md` § The status ladder fixes the vocabulary and the
mapping from the eleven `epic_status` node states; this spec wires it to data.

Everything renders from one new backend document so the browser still never
dials Temporal or reads the factory's disk (001's doctrine, unchanged). The
room keeps zero buttons: the one verb stays at the Desk, and the Showfloor's
whole relationship to attention is the appbar badge.

There is deliberately **no task-level stop**: `tasks.md` boxes are never
ticked, so "task x of y" has no seam, and this pane does not render elements
that can never fill (D-015; the gap is ergane feedback N46). If ergane grows
the seam, the stop is added to `DESIGN.md` first, then specced.

## User Scenarios & Testing

### User Story 1 - The showfloor document: everything the room renders, in one join (Priority: P1)

As the pane's backend, I assemble one showfloor document: every spec with its
declared state and story count, and for each story its identity, title,
requirement keys, ladder stop, and landing facts — joining the roadmap's
frontmatter, the compiled workgraph, the spec's own headings, and the live
`epic_status` answer, tolerant of every partial, refused, or unreachable read
the 052 doctrine names.

**Why this priority**: it is the spine; rail, stage and pane all render this
document, and it is the only story that touches the backend.

**Independent Test**: call the assembler against the recorded Fixture floor
and this repository's own specs; assert shape, ladder derivation, title
parsing, and every degraded mode from committed fixtures alone.

**Acceptance Scenarios**:

1. **Given** this repository's `specs/` and the Fixture floor, **When** the
   document assembles, **Then** it carries one rail entry per spec directory
   in directory order — `spec_dir`, declared `state` (a spec with no
   frontmatter reads `draft`), stories landed of total — and per story:
   `story_key`, title, priority, `requirement_keys` copied from the compiled
   workgraph, and a ladder object — proven by a committed unit test over the
   fixtures (FR-001).
2. **Given** a spec whose `spec.md` carries headings of the grammar
   `### User Story <n> - <title> (Priority: P<n>)`, **When** titles resolve,
   **Then** each story's title is the heading's `<title>` text; a story whose
   heading cannot be parsed falls back to its `story_key` and the document
   names the miss in that spec's `unknown` list — degraded, never crashed, and
   never invented — proven by a committed unit test feeding one well-formed
   and one malformed heading fixture (FR-002).
3. **Given** a live `epic_status` answer, **When** ladder objects derive,
   **Then** each story's stop follows `DESIGN.md`'s mapping table exactly —
   PENDING→ready, KEY_ISSUED/RUNNING→building, VERIFYING→verifying,
   PASSED/PR_OPEN→pr open, ENQUEUED→queue, MERGED→done — with
   `awaiting_operator: true` overriding the active stop to `waiting`, FAILED
   and KILLED freezing the ladder and carrying `terminal_reason` verbatim, and
   a story of an undispatched spec resting at `ready` (its spec `draft` →
   `draft`) — proven by a committed unit test driving all eleven states plus
   the override (FR-003).
4. **Given** the two 052 fault shapes, **When** a spec's workgraph read or
   `epic_status` read fails, **Then** that spec's entry still renders with a
   note naming the read and the mode — transport and refusal distinguished in
   `mode`, never only in prose — and every healthy spec is unaffected — proven
   by committed tests over the recorded degraded fixtures (FR-004).
5. **Given** the document served, **When** a node state changes between
   successive assemblies, **Then** the SSE stream 001 established carries a
   typed event consumers can apply without refetching, and unknown event types
   are ignored — proven by a committed test over the events module (FR-005).

---

### User Story 2 - The rail and the frame: the world's tokens, and a spec to pick (Priority: P1)

As an operator, the pane wears the second world — both themes, system faces,
fluid frame — and the Showfloor opens on a rail of every spec, each with its
status chip, the building epic already selected.

**Why this priority**: it establishes the tokens every later story (and spec
006) consumes, and selection is the room's new unit.

**Independent Test**: render the rail against the fixture-backed document in
both themes headless; assert tokens, chips, selection, and routing from the
DOM.

**Acceptance Scenarios**:

1. **Given** the app shell, **When** styles load, **Then** the full token set
   `DESIGN.md` § Colors names is defined on `:root`, redefined under
   `prefers-color-scheme: dark` guarded as `:root:not([data-theme="light"])`
   and under `:root[data-theme="dark"]`, `body` takes
   `background: var(--ground)`, and no colour is defined only inside a theme
   block — proven by a committed sweep over the stylesheet plus a Playwright
   render under both `colorScheme` emulations asserting the two grounds
   differ (FR-006).
2. **Given** viewports 1280, 1600 and 2560, **When** the frame renders,
   **Then** the app frame is centred at `max-width: 96rem` and its interior is
   fluid — the stage column's width grows between 1280 and 1600 — and no font
   file or remote asset is requested, proven by a committed Playwright
   assertion on layout and on the request log (FR-007).
3. **Given** the fixture document, **When** the rail renders, **Then** it
   carries one row per spec in directory order — mono id, status chip from
   `DESIGN.md`'s chip vocabulary with the story count, name beneath — a
   `draft` spec wearing the dashed chip, a spec with `awaiting_operator`
   anywhere wearing `waiting on you` — proven by committed unit tests over
   fixture variants (FR-008).
4. **Given** the route `/showfloor/<spec-dir>`, **When** it loads, **Then**
   that spec is selected (rail wash + stage content), an unknown dir falls
   back to the default with the miss named in-page, and `/showfloor` bare
   selects the building epic, else the newest landed — proven by committed
   Playwright assertions on both routes (FR-009).

---

### User Story 3 - The stage: one graph, drawn inside its box (Priority: P1)

As a visitor, the selected epic fills the stage: its id and name large, a
metrics row, its stories as node cards joined by wires that tell the two edge
kinds apart — and every pixel of it inside the boxes that claim to contain it.

**Why this priority**: it is the room's spectacle and the direct replacement
for the component that shipped invisible graphs; the containment invariants
here are the ones 004 lacked.

**Independent Test**: render fixture graphs of zero, two and five nodes at two
widths in both themes; assert geometry, wires, and the three layout laws from
measured boxes.

**Acceptance Scenarios**:

1. **Given** the selected epic, **When** the stage renders, **Then** the
   header shows the mono spec id at display size with the serif name and the
   live story's chip, and the metrics grid shows stories, merged, FR count,
   last-story wall clock, and spend to date — spend obeying the Unknown Rule
   (`unknown`, never `0`, "live" nowhere) — proven by committed unit
   assertions over the fixture rollup (FR-010).
2. **Given** a stage document, **When** the graph lays out, **Then** ranks run
   left to right in declaration order, each story is a card carrying id,
   title, chip, six-stop mini-ladder and mono sub-line, and the card set for a
   2-node and a 5-node fixture differs in rank count as the workgraph
   declares — proven by committed unit tests (FR-011).
3. **Given** the epic's edges, **When** wires draw, **Then** every
   `depends_on_merged` edge is a solid 2px olive path and every `depends_on`
   edge a dashed 2px rule-coloured path, drawn behind the cards with
   `pointer-events: none`, and the one legend row renders exactly once on the
   page however many epics exist — proven by committed unit and Playwright
   assertions (FR-012).
4. **Given** a stage document with no nodes, **When** that epic is selected,
   **Then** the stage renders the epic's degraded notice and **no stage
   canvas element** — proven by a committed unit test asserting the canvas is
   absent from the DOM (FR-013).
5. **Given** viewports 1280 and 1600 in both themes, **When** the Showfloor
   renders the fixture floor, **Then** three committed assertions hold: every
   stage child's box lies inside its stage's box (or inside a scrolling
   ancestor within it); no element carrying text crosses the viewport's right
   edge except inside an ancestor whose computed `overflow-x` scrolls; and no
   two text-carrying leaf elements' boxes overlap — the assertions that would
   have caught the first world's clipped lane, the second build's escaped
   stations, and the Desk's label collisions on the attempt that introduced
   them (FR-014).

---

### User Story 4 - The detail pane: one story, told whole (Priority: P2)

As an operator, clicking a story fills the pane: its title, its intent, the
six stops named and timestamped, the facts (attempt, judge, PR, landing SHA,
wall clock), and the requirement keys it implements — and the room still
carries no verb.

**Why this priority**: P2 because it consumes US1–US3; it is the reading
surface the redesign exists to add.

**Independent Test**: drive selection headless against the fixture document;
assert pane content, accessibility, and the whole-room sweeps.

**Acceptance Scenarios**:

1. **Given** a selected story, **When** the pane renders, **Then** it shows
   the story id, serif title, intent line, six named steps — done steps with
   their timestamps, the active step marked, pending steps in faint, a
   `waiting` step in gold — a facts grid whose absent values render as `—`,
   and one sunken mono chip per requirement key — proven by committed unit
   tests over merged, building, waiting and ready fixture stories (FR-015).
2. **Given** no selection and a keyboard user, **When** the pane and cards
   render, **Then** the empty pane explains the room in two sentences; node
   cards are real buttons focusable in rank order with `:focus-visible`
   outlines; the pane is `aria-live="polite"`; and under
   `prefers-reduced-motion` the ladder pulse does not animate — proven by
   committed unit and Playwright assertions (FR-016).
3. **Given** the finished room, **When** the smoke suite drives it, **Then**
   the browser issued zero non-GET requests, a committed sweep finds no
   `button`, `form`, or `input` in the Showfloor's source outside the node
   cards' selection buttons — and those buttons write nothing, asserted by
   the zero-non-GET check — and the attention badge is a link to the Desk
   carrying only a count — proven by committed Playwright network and source
   sweeps (FR-017).

---

### Edge Cases

- A spec directory with no compiled `workgraph.json` is a rail entry with a
  degraded note, not a crash and not an omission (FR-004).
- A heading that parses but is empty falls back to `story_key` like an
  unparseable one (FR-002).
- An epic whose every story is merged shows six-done ladders and stays
  selectable; the rail chip reads `landed n/n`.
- Two epics building at once (a future concurrent floor): the rail default
  picks the first in directory order; both wear `building`.

## Requirements

### Functional Requirements

- **FR-001**: The backend MUST assemble one showfloor document: rail entries
  per spec in directory order (dir, declared state, landed/total) and per
  story `story_key`, title, priority, `requirement_keys`, ladder object, and
  landing facts.
- **FR-002**: Story titles MUST parse from `### User Story <n> - <title>
  (Priority: P<n>)` headings, falling back to `story_key` with the miss named
  in `unknown`.
- **FR-003**: Ladder stops MUST derive exactly per `DESIGN.md`'s state→ladder
  table, including the `awaiting_operator` gold override, frozen terminal
  ladders carrying `terminal_reason` verbatim, and draft/ready for
  undispatched work.
- **FR-004**: Every read MUST degrade per the 052 doctrine: in place, naming
  read and mode, transport distinguished from refusal, healthy sections
  unaffected.
- **FR-005**: State changes MUST reach the browser over 001's typed SSE
  stream; unknown event types are ignored.
- **FR-006**: The token set MUST match `DESIGN.md` § Colors, defined for both
  themes in the three-block pattern, with `body` grounded and no
  theme-block-only colours.
- **FR-007**: The frame MUST be fluid to `max-width: 96rem` with no interior
  hard cap, and the page MUST load no font file or remote asset.
- **FR-008**: The rail MUST render every spec with its chip from `DESIGN.md`'s
  vocabulary and its story count.
- **FR-009**: Selection MUST deep-link as `/showfloor/<spec-dir>`, defaulting
  to the building epic, else the newest landed; unknown dirs fall back with
  the miss named.
- **FR-010**: The stage header MUST carry id, name, live chip, and a metrics
  grid whose spend cell obeys the Unknown Rule.
- **FR-011**: The graph MUST lay ranks left→right in declaration order with
  node cards carrying id, title, chip, mini-ladder, sub-line.
- **FR-012**: Wires MUST distinguish merge (solid olive) from pass (dashed
  rule) edges, sit behind cards, and the legend MUST render exactly once.
- **FR-013**: A zero-node stage document MUST render its degraded notice with
  no stage canvas element.
- **FR-014**: Three layout laws MUST hold as committed assertions at 1280 and
  1600 in both themes: stage-child containment, no text past the viewport
  outside a scrolling ancestor, no overlapping text leaves.
- **FR-015**: The detail pane MUST render the selected story's title, intent,
  six named steps with timestamps and states, facts with `—` for absences,
  and requirement-key chips.
- **FR-016**: The room MUST be keyboard-operable with visible focus, the pane
  `aria-live="polite"`, and the ladder pulse suppressed under
  `prefers-reduced-motion`.
- **FR-017**: The room MUST issue zero non-GET requests and carry no write
  control; the badge is a count and a link to the Desk.

## Success Criteria

- **SC-001**: The smoke gate drives the fixture floor through rail → stage →
  detail headless, in both themes, at 1280 and 1600, with FR-014's three laws
  asserted on every render — the assertions the first two builds lacked.
- **SC-002**: A committed test drives all eleven node states plus the
  operator-waiting override through the ladder derivation and asserts each
  lands on the `DESIGN.md` table's stop.
- **SC-003**: Every 052 fault shape renders as a named, in-place degradation
  with the rest of the room healthy, proven from recorded fixtures.
- **SC-004**: The room passes the zero-non-GET and no-write-control sweeps —
  the constitution I guarantee, re-proven against the rebuilt room.
- **SC-005**: No criterion in this spec requires an eye: every scenario is
  decided by a committed test reading the DOM, the request log, or the diff.

## Assumptions

- `DESIGN.md` (D-015) is the appearance authority and was replaced before this
  spec was written; the comp is `.impeccable/mocks/showfloor-redrawn.html`.
- The Fixture floor already carries every payload needed — zero-node epics, a
  5-node graph, degraded reads, a NULL rollup. No fixture is invented
  (constitution V).
- The backend host can read `specs/<dir>/spec.md` and `workgraph.json` — the
  same filesystem D-007 already grants it. No new seam into ergane is needed;
  titles come from the spec text the factory itself compiles from.
- React Flow's removal is a dependency subtraction, permitted without asking;
  constitution VII gates additions only.

## Out of Scope

- The Desk's restyle and its fixes — spec 006, which consumes this spec's
  tokens (`depends_on_landed`).
- A "task x of y" ladder stop — no seam exists (N46); `DESIGN.md` gains the
  stop first if ergane grows one.
- Any write path, any auth change, any new route beyond the read-only
  showfloor document and deep link.
- Concurrent-epic staging beyond the rail default named in Edge Cases.

## Work Graph

```yaml
US1:
  depends_on: []
  implements: [FR-001, FR-002, FR-003, FR-004, FR-005]
US2:
  depends_on: []
  depends_on_merged: [US1]
  implements: [FR-006, FR-007, FR-008, FR-009]
US3:
  depends_on: []
  depends_on_merged: [US2]
  implements: [FR-010, FR-011, FR-012, FR-013, FR-014]
US4:
  depends_on: []
  depends_on_merged: [US3]
  implements: [FR-015, FR-016, FR-017]
```

Fully serial on merge-edges, deliberately: US2 renders the document US1 emits;
US3 draws inside the frame and tokens US2 establishes; US4 reads the selection
US3 renders — and all three frontend stories rewrite `web/src/showfloor/` and
touch `web/src/styles/global.css`, the shared-file contention that cost a
rebuild when two stories held it concurrently on 2026-08-22. US4 runs last so
its zero-non-GET and no-write-control sweeps execute against the finished
room with every piece of chrome mounted.
