---
state: draft
depends_on_landed: [001-the-desk-sees-the-floor]
# Drafted 2026-08-21 by an operator-session interview; see docs/decisions.md.
#
# WHY THIS SPEC. D-004 settled the metaphor argument: the spectacle IS the
# workgraph, not a decoration over it. The factory's own history is the
# reason — conflating pass-edges with merge-edges once dispatched nodes
# against bases missing the code they imported, and a staging that hides that
# distinction teaches the next operator to repeat the mistake. So the
# Showfloor draws the contract: nodes left to right in declaration order
# (declaration order IS scheduling order), merge-edges solid, pass-edges
# dashed, states lit from the same epic_status answer the CLI reads.
#
# D-002 gives this room its temperament: full-bleed, projector-safe, pure
# glass. The only interactive things on the whole floor are pan/zoom and one
# badge that leads to the Desk — the verb lives there and only there (D-001).
# D-005 binds the plumbing: every read rides ergane's seams, and 052's
# degraded-reads doctrine is not optional — a floor the pane cannot read is
# rendered as exactly that, never as an empty floor. D-006 fixes the stack:
# @xyflow/react with dagre layout, motion via CSS/Framer Motion, gates
# already named in factory.yaml.
#
# D-008 sequences it: this spec depends on 001-the-desk-sees-the-floor
# landing first — its worktrees' base must contain the scaffold, the
# gates, the recorded fixture floor, and the backend reads. The workgraph
# grammar scopes edges to one spec, but the roadmap grammar carries exactly
# this cross-spec edge: the `depends_on_landed` above declares it, and the
# scheduler refuses to dispatch this spec until 001 is landed. The operator
# who flips this spec ready is the backstop, not the mechanism.
#
# Constitution IV is the drafting discipline. This repository contains no
# application code yet; every scenario below is scored by the judge from the
# diff alone and checked headless by the four gates. Animation is specified
# as state markers, marker lifecycles, and reduced-motion behaviour — never
# as pixels a human eye must read.
---

# Feature Specification: the Showfloor stages an epic

## Context

Two documents describe a running epic, and neither is sufficient alone.
`<specs_root>/<spec-dir>/workgraph.json` is the static truth — nodes, story
keys, personas, pass-edges (`depends_on`) and merge-edges
(`depends_on_merged`), in declaration order. The base grammar is the
published contract (ergane
`specs/005-workgraph-interpreter/contracts/workgraph-schema.md`), which
predates merge-edges and does not name them; `depends_on_merged` is defined
by ergane's `factory/workgraph/models.py` (`WorkNode.depends_on_merged`) and
accepted by `factory/workgraph/derive.py`, and the Fixture floor's recorded
`workgraph.json` carries the field exactly as the factory writes it.
Live state is deliberately not in that file. The Temporal query `epic_status`
on workflow id `epic-<epic_id>` is the live truth — per-node state, attempt
count, landing progress, and the derived `awaiting_operator` flag. The
Showfloor's whole job is the honest join of the two, staged as a
left-to-right DAG for every epic the floor says is running, on top of the
floor read 001 established (`factory.cli.status.collect_floor`).

The Showfloor is pure glass. It carries no verb, offers nothing to press, and
is safe to leave on a projector. When Attention items exist it says so as a
count badge that deep-links to the Desk — and that is the entire extent of
its opinion about attention.

**Evidence rule for every scenario in this spec**: the judge is given the
diff and these criteria — never a running browser a human watches. Every
runtime claim is proven by a committed test — vitest, pytest, or headless
Playwright — replaying the Fixture floor. A scenario only an eye can score is
a defect in this spec (constitution IV).

## User Scenarios & Testing

### User Story 1 - The join: one stage document per running epic (Priority: P1)

As the pane's backend, I assemble, for each running epic, one stage document
that merges the epic's static workgraph with its live `epic_status` answer —
tolerant of every partial, refused, or unreachable read the 052 doctrine
names — and hand it to the browser over the SSE event stream 001
established. The browser never dials Temporal and never reads the factory's
disk.

**Why this priority**: it is the spine. Every card, edge, pulse, and shelf in
the stories below renders this document; if the join lies or crashes, the
spectacle is a liability on a projector instead of an asset.

**Independent Test**: assemble stage documents from the Fixture floor's
recorded workgraphs and `epic_status` answers — complete, partial, refused,
and unreachable — and assert the document's contents without any frontend.

**Acceptance Scenarios**:

1. **Given** a Fixture floor epic whose `epic_status` answer covers every
   node in its `workgraph.json`, **When** the stage document is assembled,
   **Then** it carries every declared node exactly once — joined with its
   live state, attempt count, and `awaiting_operator` flag — and every edge
   tagged as pass-edge (`depends_on`) or merge-edge (`depends_on_merged`),
   preserving declaration order — proven by a committed test.

2. **Given** a node present in `workgraph.json` but absent from the live
   answer's node mapping, **When** the document is assembled, **Then** that
   node appears as its static self — id, story key, persona, edges — with
   every live field marked unknown, and assembly does not raise — proven by
   a committed test.

3. **Given** the two 052 failure modes — transport failure reaching Temporal,
   and a query the workflow refused — **When** each occurs for an epic,
   **Then** the stage document carries the static graph plus a degraded note
   naming which read failed and how, and the two modes produce two
   distinguishable notes — proven by a committed test driving both fault
   shapes.

4. **Given** a live answer with missing keys — a NodeStatus lacking fields
   the pane expects — **When** the document is assembled, **Then** every
   missing key takes its default, a value the factory did not record renders
   as unknown and never as zero, and nothing crashes — proven by a committed
   test.

5. **Given** a live answer whose node mapping carries an id the
   `workgraph.json` does not declare, **When** the document is assembled,
   **Then** the graph contains exactly the file's nodes, and the stray id is
   named in the document's notes rather than drawn — the file is the
   structural truth — proven by a committed test.

6. **Given** a running epic whose `workgraph.json` is missing or
   unparseable, **When** the floor is assembled, **Then** that epic stages
   as a named degraded entry and every other epic's document is unaffected —
   proven by a committed test.

7. **Given** a node whose `awaiting_operator` flag is true while its state
   string still reads `VERIFYING`, **When** the document is assembled,
   **Then** the staged node carries the waiting-on-operator marking — the
   derived flag wins over the raw state — proven by a committed test.

---

### User Story 2 - The stage: the DAG drawn as the contract reads (Priority: P1)

As a visitor watching the Showfloor, I see each running epic's workgraph
laid out left to right — dependencies flowing rightward, declaration order
preserved — with each node a state-lit card and the two edge kinds visibly
different, because pass-edge and merge-edge are different promises and the
staging teaches the distinction instead of hiding it.

**Why this priority**: this is the spectacle D-004 decided, and it is
independently demonstrable the moment it renders the Fixture floor — which
is also the demo mode D-008 requires: showable with no live factory behind
it.

**Independent Test**: render stage documents built from the Fixture floor in
a headless browser and assert positions, order, card contents, and edge
classes from the DOM.

**Acceptance Scenarios**:

1. **Given** a staged epic with at least one edge, **When** the layout runs,
   **Then** every edge's source node is positioned strictly left of its
   target node — proven by a committed test over the computed positions.

2. **Given** two nodes in the same layout rank, **When** the layout runs,
   **Then** their vertical order follows their declaration order in
   `workgraph.json` — declaration order is scheduling order, and the stage
   honors the contract — proven by a committed test.

3. **Given** a staged node with live state, **When** its card renders,
   **Then** the card carries a machine-readable state marker equal to the
   state string, one attempt pip per attempt counted in the live answer, and
   a persona badge naming the node's persona; a node whose live fields are
   unknown carries an unknown marker and invents no pips — proven by a
   committed test.

4. **Given** an epic with both edge kinds, **When** its edges render,
   **Then** merge-edges carry the solid style marker and pass-edges the
   dashed style marker, distinguishable by class or attribute — never by a
   screenshot — proven by a committed test.

5. **Given** the Showfloor is rendered, **When** its legend is read, **Then**
   it names **pass-edge** beside the dashed sample and **merge-edge** beside
   the solid sample, each with its glossary definition quoted verbatim —
   pass-edge: "An ordering-only dependency: the predecessor must reach a
   verdict, and nothing about its code is guaranteed to be present";
   merge-edge: "A content dependency: the predecessor's work must be merged
   before the dependent's worktree is created, so the dependent's base
   contains that code" (ergane `CONTEXT.md`) — those quoted strings are the
   normative legend text — proven by a committed test asserting the legend
   text.

6. **Given** a state string the pane does not recognize, **When** its card
   renders, **Then** the card takes the unknown-state style and displays the
   raw string — a new factory state must never crash the floor — proven by a
   committed test.

7. **Given** a floor document with zero running epics, **When** the
   Showfloor renders, **Then** a named quiet-floor element is present — a
   machine-readable marker saying the floor is quiet — and the epic-stage
   region is absent; a blank page indistinguishable from a broken one fails
   — proven by a committed test.

---

### User Story 3 - The flow: landings move, transitions pulse, idle dims (Priority: P2)

As a visitor, I can tell at a glance what is moving: a node's landing run
(`PASSED` → `PR_OPEN` → `ENQUEUED` → `MERGED`) progresses visibly into a
landed shelf, a state change pulses, and an epic with nothing live dims —
and all of it remains legible with animation off, on either theme, filling
the screen edge to edge.

**Why this priority**: motion is what makes the Showfloor a spectacle rather
than a status table, but it is worthless if it cannot be asserted headless —
so every motion claim here is a marker-lifecycle claim, and the
reduced-motion scenario is the control that proves no information lives only
in the animation.

**Independent Test**: drive one staged node through successive stage
documents in a component test and assert the markers each state applies,
clears, and suppresses.

**Acceptance Scenarios**:

1. **Given** a node whose successive stage documents advance it
   `PASSED` → `PR_OPEN` → `ENQUEUED` → `MERGED`, **When** each document is
   applied, **Then** the card carries a landing-progress marker naming its
   current landing stage, and on `MERGED` the node renders within the landed
   shelf region — proven by a committed test driving the full sequence.

2. **Given** a node whose state differs between two successive stage
   documents, **When** the newer document is applied, **Then** a transition
   marker is applied to the card and subsequently cleared — the full
   lifecycle asserted, not inferred — proven by a committed test.

3. **Given** the first stage document the pane ever sees carries a node
   already `MERGED`, **When** that document is applied, **Then** the node
   renders within the landed shelf and no transition marker is applied —
   markers fire on observed change, not on first paint — proven by a
   committed test. **This is the first-paint control** for scenario 2.

4. **Given** the browser reports reduced motion, **When** the same sequences
   run, **Then** no animation plays — transition markers are suppressed or
   inert — and every state, landing stage, and edge kind remains
   distinguishable through non-motion means — proven by a committed test.
   **This is the control**: information that exists only as movement fails
   it.

5. **Given** an epic in which no node's state is in the live set
   {`KEY_ISSUED`, `RUNNING`, `VERIFYING`, `PASSED`, `PR_OPEN`, `ENQUEUED`,
   `WAITING_OPERATOR`}, **When** the floor renders, **Then** that epic's
   stage carries the idle marker, and an epic with any node in that set does
   not — proven by a committed test asserting both directions.

6. **Given** the pane's light theme and dark theme, **When** the state
   styles are resolved, **Then** every one of the eleven node states
   (`PENDING`, `KEY_ISSUED`, `RUNNING`, `VERIFYING`, `PASSED`, `PR_OPEN`,
   `ENQUEUED`, `MERGED`, `FAILED`, `KILLED`, `WAITING_OPERATOR`) maps to a
   defined style token in both themes with no state falling through to a
   catch-all — proven by a committed test over the exported style map.

7. **Given** the smoke's headless viewport, **When** the Showfloor route
   renders, **Then** the Showfloor root's bounding box equals the viewport
   dimensions — full-bleed is measured, not admired — proven by a committed
   Playwright assertion.

---

### User Story 4 - The badge: attention is counted here, answered there (Priority: P2)

As an operator glancing at a projected Showfloor, I see one badge when
Attention items exist — a count and nothing else — and following it puts me
at the Desk. The Showfloor itself never grows a button, a form, or a verb.

**Why this priority**: it is the seam between D-002's two rooms. Without it
an escalation arriving mid-demo is invisible; with anything more than it,
the projector-safe property is gone.

**Independent Test**: render the Showfloor against the Fixture floor's
recorded Attention items, against a floor document whose attention list is
empty, and against both degraded attention reads, and assert the badge's
presence, count, target, and the absence of any interactive element.

**Acceptance Scenarios**:

1. **Given** a Fixture floor with N open Attention items (N > 0), **When**
   the Showfloor renders, **Then** it shows one badge whose count equals N
   and whose link targets the Desk route — proven by a committed test.

2. **Given** a floor document whose attention list is empty — constructed at
   the document level, since the recorded Fixture floor always carries open
   attention and constitution V forbids emptying the recording — **When**
   the Showfloor renders, **Then** no badge renders at all — proven by a
   committed test. **This is the control** for scenario 1.

3. **Given** the attention read degrades in each of the two 052 modes —
   transport failure and query refusal, injected at the reader seam exactly
   as US1 scenario 3 injects them — **When** the Showfloor renders, **Then**
   a degraded note renders in the badge's place naming what could not be
   learned, no count renders, and the note is never the numeral zero —
   proven by a committed test driving both fault shapes.

4. **Given** the Showfloor is up and a `floor` event — 001's SSE event
   vocabulary (FR-016 there) — arrives whose attention list carries a new
   Attention item, **When** the event is applied, **Then** the badge count
   updates without navigation or reload — proven by a committed test driving
   the stream with typed `floor` events.

5. **Given** the Showfloor route rendered against the Fixture floor, **When**
   the DOM is swept, **Then** it contains no `button`, `form`, `input`,
   `select`, or `textarea` element — the badge is an anchor, pan and zoom
   are gestures with no on-screen control chrome mounted — proven by a
   committed sweep test; and a committed test asserts the flow component
   mounts with node dragging and node selection disabled, because the D-006
   stack enables both by default over plain `div`s the element sweep cannot
   see. Pure glass is asserted, not promised.

---

### Edge Cases

- A floor with zero running epics renders a named quiet floor — the
  Showfloor says the floor is quiet; it never renders a blank page that is
  indistinguishable from a broken one.
- An `epic_status` answer may arrive mid-landing: a node already `MERGED` in
  the first document the pane ever sees renders on the landed shelf with no
  transition pulse — markers fire on observed change, not on first paint.
- The badge and a degraded attention read: if the Attention item read itself
  degrades, the Showfloor shows the degraded note in place of a count — an
  unknown count is never rendered as zero (constitution III).

## Requirements

### Functional Requirements

- **FR-001**: The backend MUST assemble one stage document per running epic,
  joining `<specs_root>/<spec-dir>/workgraph.json` with the `epic_status`
  query answer for workflow id `epic-<epic_id>`, keyed by node id, with
  every edge tagged pass-edge or merge-edge and declaration order preserved.
- **FR-002**: Every read MUST ride the seams 001 established —
  `factory.cli.status.collect_floor` for the floor's epics, the
  `epic_status` Temporal query for live state, the specs root for
  `workgraph.json` — and the browser MUST never dial Temporal or read the
  factory's filesystem. The pane re-derives no factory logic
  (constitution II).
- **FR-003**: The static file is the structural truth: the staged graph
  contains exactly the file's nodes and edges; a live-only node id is named
  in the document's notes, never drawn.
- **FR-004**: A node absent from the live answer MUST render as its static
  self with live fields unknown; a missing key MUST take its default; a
  value the factory did not record MUST render as unknown, never as zero.
- **FR-005**: Transport failure and query refusal are two failure modes and
  MUST render as two distinguishable in-section notes naming what could not
  be learned; one degraded epic MUST NOT blank the floor or any other epic.
- **FR-006**: A node with `awaiting_operator` true MUST carry the
  waiting-on-operator marking regardless of its raw state string.
- **FR-007**: Layout MUST be left-to-right: every edge's source strictly
  left of its target, and equal-rank nodes vertically ordered by declaration
  order.
- **FR-008**: Each card MUST carry a machine-readable state marker, attempt
  pips equal to the live attempt count, and a persona badge; unknown live
  state MUST be marked unknown and MUST NOT invent pips.
- **FR-009**: Merge-edges MUST render solid and pass-edges dashed,
  assertable by class or attribute, and a legend MUST name both kinds with
  the glossary definitions US2's legend scenario quotes verbatim.
- **FR-010**: An unrecognized state string MUST render as the unknown-state
  style displaying the raw value, without error.
- **FR-011**: Nodes in `PASSED`, `PR_OPEN`, `ENQUEUED`, and `MERGED` MUST
  carry a landing-progress marker naming the stage, and `MERGED` nodes MUST
  render within the landed shelf.
- **FR-012**: A state change between successive stage documents MUST apply a
  transition marker that is subsequently cleared; no marker fires on first
  paint.
- **FR-013**: Under reduced motion, no animation MUST play and every piece
  of information MUST remain available through non-motion means.
- **FR-014**: An epic with no node in the live-state set {`KEY_ISSUED`,
  `RUNNING`, `VERIFYING`, `PASSED`, `PR_OPEN`, `ENQUEUED`,
  `WAITING_OPERATOR`} MUST carry the idle marker; any epic with one MUST
  not.
- **FR-015**: The Showfloor MUST render full-bleed — mechanically: in the
  headless smoke, the Showfloor root's bounding box equals the viewport
  dimensions — and every node state MUST map to a defined style token in
  both the light and dark themes, with no catch-all fallback.
- **FR-016**: The Showfloor MUST offer no interaction beyond pan, zoom, and
  the badge anchor: nodes are neither draggable nor selectable, and the
  route's DOM contains no `button`, `form`, `input`, `select`, or
  `textarea`.
- **FR-017**: When open Attention items exist the Showfloor MUST show one
  badge whose count equals the number of items and whose link targets the
  Desk; at zero items no badge renders; the count updates from applied
  `floor` events (001's typed event vocabulary) without reload; a degraded
  attention read renders as a note, never as zero.
- **FR-018**: The Showfloor MUST render completely against the Fixture floor
  with no live factory behind it — the smoke gate replays it headless, and
  it is the demo mode.
- **FR-019**: A floor with zero running epics MUST render a named,
  machine-readable quiet-floor element and no epic-stage region; the
  Showfloor MUST never render a blank page indistinguishable from a broken
  one.

### Key Entities

- **Stage document**: one running epic's staged view — the static workgraph
  joined with the live `epic_status` answer, plus the degraded notes naming
  every read that failed or came back partial. It is the per-epic entry
  within the floor document 001 established — the pane still has one read,
  and the Showfloor renders the same document the Desk does.
- **Staged node**: one WorkNode joined with its NodeStatus — static
  identity (id, story key, persona, edges) always present, live fields
  (state, attempt, landing stage, `awaiting_operator`) each individually
  optional.
- **Staged edge**: one dependency with its kind — pass-edge or merge-edge —
  carried from `depends_on` / `depends_on_merged`.
- **Landed shelf**: the region `MERGED` nodes collect into; the visible end
  of a Landing.
- **Attention badge**: the count of open Attention items and a link to the
  Desk; the Showfloor's only acknowledgment that attention exists.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The smoke gate stages the Fixture floor end to end in a
  headless browser: every node of the recorded epic's `workgraph.json`
  appears exactly once with its state marker, both edge kinds are present
  and distinguishable, and the legend names them.
- **SC-002**: A committed test drives both 052 fault shapes — transport
  failure and query refusal — and asserts two distinct named notes while the
  static graph still renders.
- **SC-003**: A committed test drives one node through
  `PASSED` → `PR_OPEN` → `ENQUEUED` → `MERGED` and asserts the
  landing-progress markers in order, the transition marker's apply-and-clear
  lifecycle, and the final render inside the landed shelf — and, as the
  first-paint control, that a first-ever document carrying a `MERGED` node
  renders it in the landed shelf with no transition marker applied.
- **SC-004**: The same drive under reduced motion asserts no animation
  markers fire and every state remains distinguishable.
- **SC-005**: A committed test asserts the badge count equals the Fixture
  floor's Attention item count, its link targets the Desk, and a floor
  document with an empty attention list renders no badge.
- **SC-006**: A committed sweep test asserts the rendered Showfloor route
  contains zero `button`, `form`, `input`, `select`, and `textarea`
  elements.
- **SC-007**: A committed test asserts a stage document missing one node's
  live state renders every declared node, with exactly the absent one
  marked unknown — and the suite fails if assembly raises.

## Assumptions

- **This spec's base contains 001-the-desk-sees-the-floor, landed.** The
  scaffold, the four gates of `factory.yaml`, the recorded Fixture floor,
  the backend's floor reads, the SSE event stream, and the Desk route it
  deep-links to are all 001's work. The workgraph grammar has no cross-spec
  edge, but the roadmap grammar does: this spec's frontmatter declares
  `depends_on_landed: [001-the-desk-sees-the-floor]`, and the scheduler
  refuses to dispatch it until that edge is satisfied. The operator who
  flips this spec ready is the backstop, not the binding word.
- The Fixture floor includes at least two running epics — US1 scenario 6's
  "every other epic's document is unaffected" is vacuous against a floor of
  one — and the exercised epic's workgraph carries both edge kinds, at
  least two nodes of identical dependency depth (the same-rank pair US2's
  ordering scenario requires), a node in a landing state, and a node absent
  from its live answer; the floor carries at least one open Attention item.
  If the recording lacks any of these, it is re-recorded from real factory
  documents per constitution V — never edited to taste.
- The backend's refresh over `epic_status` rides the polling mechanism 001
  established; its cadence is the implementer's choice, and every honesty
  requirement above is cadence-independent.
- The node state vocabulary is the eleven states US3's theme scenario
  enumerates; anything else the factory ever says is handled by FR-010, not
  by a crash.

## Out of Scope

- **Answering.** The verb, the webhook intake, identity, and settlement
  outcomes are 003's; nothing in this spec carries or renders an Answer.
- **Any interaction beyond pan, zoom, and the badge anchor.** No node
  click-through, no tooltip forms, no per-epic controls. Wanting one is a
  superseding entry in `docs/decisions.md`, not a feature PR.
- **The Desk's rendering** — attention detail, floor detail, health, and
  spend to date are 001's.
- **Historical replay or time-scrubbing** of the floor; the Showfloor stages
  now, not the past.
- **Layout aesthetics beyond the asserted invariants.** The judge scores
  positions, order, markers, and classes; it does not score beauty, and
  this spec asks it to score nothing it cannot see in the diff.

## Work Graph

```yaml
US1:
  depends_on: []
  implements: [FR-001, FR-002, FR-003, FR-004, FR-005, FR-006]
US2:
  depends_on: []
  depends_on_merged: [US1]
  implements: [FR-007, FR-008, FR-009, FR-010, FR-018, FR-019]
US3:
  depends_on: []
  depends_on_merged: [US2]
  implements: [FR-011, FR-012, FR-013, FR-014, FR-015]
US4:
  depends_on: []
  depends_on_merged: [US3]
  implements: [FR-016, FR-017]
```

US2 renders the document US1 emits — a content dependency, so a merge-edge,
not a pass-edge. US3 and US4 both edit the Showfloor room's components that
US2 creates; that chain is contention as much as logic, and declaring them
independent while they share those files is the defect merge-edges exist to
prevent. US4 runs last so its no-verb sweep (FR-016) executes against the
finished room, with every piece of chrome already mounted.
