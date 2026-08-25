---
state: draft
depends_on_landed: [005-one-epic-on-stage]
# Drafted 2026-08-25 under D-016, which amended DESIGN.md FIRST -- the order
# constitution VIII demands. Three clauses moved: the detail track collapses
# while nothing is selected, the room's explanation moves beneath the stage,
# and the stage's horizontal scroll becomes styled furniture.
#
# WHY THIS SPEC. 005 landed the second world and it reads well. Then it was
# rendered on a real 3008px monitor instead of a test viewport, and two things
# were true at once: the room was right, and the graph had pieces missing. A
# fixed `26rem` detail track held 403px to show two sentences of explanation
# while nothing was selected; the stage got 770px; the graph needed 797. It
# scrolled -- inside the host operating system's own widget, a light grey
# trough with stepper buttons, in a dark room. Neither defect is visible to a
# gate: FR-014's three laws sanction a scrolling ancestor by design, and no law
# in this repository has ever looked at a scrollbar.
#
# US1 IS NOT COSMETIC AND IT GOES FIRST. `tests/test_showfloor_document.py`
# reads the repository's live `specs/` and `docs/dags/` corpus and asserts the
# transient state of named specs. Two operator changes have already gone red
# against it without touching a line of source: PR #37 (attesting 005 `landed`)
# and PR #40 (archiving the derived work graphs for 004-006). Nothing lands
# until the corpus tests assert shape instead of a named spec's current state.
#
# WHAT THIS SPEC DELIBERATELY DOES NOT DO. It does not raise the 96rem frame
# cap, and it does not wrap an over-wide rank onto a second row. Wrapping was
# rendered and measured before this spec was written: the geometry works and
# the wires do not, because `Wires.tsx` draws rank-to-rank left-to-right and a
# row break leaves a stub diagonal. That is a spec of its own with the wire
# case in it, and D-016 defers it by name.
---

# Feature Specification: The stage takes the room

**Feature Branch**: `008-the-stage-takes-the-room`
**Created**: 2026-08-25
**Status**: Draft
**Input**: D-016; `DESIGN.md` § Layout, § Stage, § Detail pane (amended
2026-08-25); `docs/pane-review-2026-08-25.md` F1 and F3; the live render at
1280 / 1600 / 3008 that produced the measurements below

## Context

The Showfloor's graph is clipped at every width this repository has ever
tested, and the space it needs is already on the screen — held by a detail
track that has nothing in it. The fix is subtraction: while no story is
selected, the `26rem` track collapses and the stage takes the width. The
room's two-sentence explanation is not deleted; it moves beneath the stage,
where it costs nothing.

Measured on the live pane, dark, before any change, over every spec on the
floor. `stage` is the scroller's client width; `needs` is its scroll width:

| width | graph needs | stage today | clipped | stage with the empty track collapsed | clipped |
|---|---|---|---|---|---|
| 1280 | 797px | 562px | **235px** | 965px | **0** |
| 1600 | 797px | 770px | **27px** | 1173px | **0** |
| 3008 | 797px | 770px | **27px** | 1173px | **0** |

The second defect is what the clipping looked like when it happened. There is
no `scrollbar` rule anywhere in `web/src/showfloor/showfloor.css`, so the
scroller renders the host operating system's widget — and the pane's tokens,
which reach every other surface in the room, do not reach the one piece of
chrome the operator actually had to touch.

The third is why neither of the first two can land. The corpus tests read the
live repository and assert what a named spec's frontmatter says today, so the
epic's own success turns its suite red: 005 verified itself while `ready`, and
attesting it `landed` breaks `test_showfloor_document.py:344`. Archiving the
missing work graphs breaks
`test_a_spec_with_no_compiled_workgraph_is_an_entry_with_a_note`, which needs
005 to be the spec that has no compiled graph. Constitution V says fixtures
are recorded, never invented — and never *live*.

## User Scenarios & Testing

### User Story 1 - The corpus tests assert shape, not this morning's corpus (Priority: P1)

As the pane's test suite, I prove the showfloor document's contract from
conditions I construct, so that an operator attesting a spec or archiving a
work graph cannot turn me red without touching a line of source.

**Why this priority**: it is a hard prerequisite. Two operator PRs are open and
red against it right now, and this spec's own two stories change the corpus
they read.

**Independent Test**: flip 005's frontmatter to `landed` and add
`docs/dags/005-one-epic-on-stage.json` in a scratch tree; run `uv run pytest -q`
and `npm --prefix web run test:smoke`; both stay green.

**Acceptance Scenarios**:

1. **Given** the corpus tests, **When** any test needs a spec in a particular
   state, **Then** it constructs that state through the reader seams the module
   already accepts — as
   `test_an_unparseable_workgraph_is_told_apart_from_a_missing_one` already
   does — and no test asserts the value of a named spec's `state:` frontmatter
   or the presence of a named file under `docs/dags/`, proven by a committed
   test that greps the suite for those two patterns and fails on a match
   (FR-001).
2. **Given** the repository with 005 attested `landed` and its work graph
   archived, **When** the backend gate runs, **Then** every test in
   `tests/test_showfloor_document.py` passes, proven by the diff's own suite
   run against a corpus mutated to that state in a fixture (FR-002).
3. **Given** the smoke case *the pulse is authored at 1.6s, and reduced motion
   suppresses it*, **When** it runs against a floor with nothing building,
   **Then** it asserts the authored animation from the stylesheet rather than
   waiting for a selector that exists only while a real epic is mid-build, and
   it passes on an idle floor — proven by the committed case running green in
   this story's own gate (FR-003).

---

### User Story 2 - The stage takes the room the pane is not using (Priority: P1)

As a visitor with no story selected, the whole width the room is not using
belongs to the graph, and the two sentences that explain the room sit beneath
the stage instead of holding a column open.

**Why this priority**: it is the defect the operator hit on a real monitor, and
it retires the clipping at every width this repository tests.

**Independent Test**: render every spec on the fixture floor at 1280, 1600 and
2560, both themes, nothing selected; assert the scroller's `scrollWidth` equals
its `clientWidth`. Then pick a story and assert the pane returns at `26rem`.

**Acceptance Scenarios**:

1. **Given** the Showfloor with no story selected, **When** the grid resolves,
   **Then** the detail track computes to `0` and the stage track takes the
   width the pane released — proven by a committed Playwright assertion
   comparing the stage's client width with and without a selection at 1280,
   1600 and 2560 (FR-004).
2. **Given** no story selected, **When** the room renders, **Then**
   `[data-detail-empty]` still carries the room's two sentences, verbatim and
   unhidden, positioned beneath the stage above the legend row — proven by a
   committed assertion on its text, its computed visibility, and its box
   sitting below the stage's (FR-005).
3. **Given** a story is picked, **When** the pane fills, **Then** the detail
   track returns to `26rem`, every 005 US4 guarantee over the pane's contents
   still holds, and the explanation beneath the stage is gone — proven by the
   carried-over `DetailPane` suite passing unchanged plus one new assertion on
   the restored track (FR-006).
4. **Given** every spec on the fixture floor at 1280, 1600 and 2560 in both
   themes with nothing selected, **When** each stage renders, **Then** the
   scroller's `scrollWidth` equals its `clientWidth` for every one of them —
   the measurement that reads 235px, 27px and 27px today (FR-007).
5. **Given** the same sweep, **When** FR-014's three layout laws are measured,
   **Then** all three still hold with the same element and text-leaf floors
   005 committed, so the width the stage gained did not buy an escape
   (FR-008).

---

### User Story 3 - When the stage scrolls, the scroll wears the room's clothes (Priority: P2)

As an operator looking at a graph too wide for its stage, the scrollbar is part
of this room and not a piece of the host operating system, and it is visibly
there rather than an overlay I have to discover.

**Why this priority**: a graph wide enough to scroll still exists — a picked
story restores the pane, and a longer chain outgrows any width — so the
affordance has to be right even after US2.

**Independent Test**: force a stage narrower than its graph in a fixture
viewport; read the computed `scrollbar-width`, `scrollbar-color` and the
`::-webkit-scrollbar` rules from the stylesheet in both themes.

**Acceptance Scenarios**:

1. **Given** a stage whose graph outgrows it, **When** the scroller renders,
   **Then** its computed `scrollbar-width` is `thin` and its `scrollbar-color`
   resolves to the room's `--rule` on a transparent trough, in both themes —
   proven by committed computed-style assertions (FR-009).
2. **Given** the same scroller, **When** the stylesheet is read, **Then** the
   `::-webkit-scrollbar` rules declare no stepper buttons and a thumb that
   brightens on hover, and no colour in either rule is a literal — every one
   comes from a token, so the second theme is a token swap and not a second
   stylesheet (FR-010).
3. **Given** a graph that fits, **When** the stage renders, **Then** no
   scrollbar occupies layout and the graph's box is unchanged from US2's
   measurement — proven by a committed assertion that the fitting case gained
   no horizontal chrome (FR-011).

## Requirements

### Functional Requirements

- **FR-001**: No test under `tests/` or `web/tests/` MUST assert a named
  spec's `state:` frontmatter value or the presence of a named file under
  `docs/dags/`, and a committed guard test MUST enforce that by pattern and
  MUST itself go red on a planted violation.
- **FR-002**: `tests/test_showfloor_document.py` MUST construct every corpus
  condition it asserts through the module's reader seams, and MUST stay green
  against a corpus in which 005 is attested `landed` with its work graph
  archived.
- **FR-003**: The pulse smoke case MUST assert the authored animation and its
  reduced-motion override from the stylesheet rather than waiting on a live
  building epic, and MUST pass on an idle floor.
- **FR-004**: With no story selected the detail track MUST compute to `0` and
  the stage track MUST take the released width, with no remount and with the
  wires re-measured against the relaid cards.
- **FR-005**: `[data-detail-empty]` MUST render beneath the stage above the
  legend row, carrying its two sentences verbatim, visible, with a non-zero
  box — never hidden and never truncated.
- **FR-006**: Picking a story MUST restore the `26rem` track and every 005 US4
  guarantee over the pane's contents, and MUST remove the explanation from
  beneath the stage.
- **FR-007**: With nothing selected, every spec on the fixture floor MUST
  render a stage whose `scrollWidth` equals its `clientWidth` at 1280, 1600
  and 2560 in both themes, over a rail of at least five specs.
- **FR-008**: 005's FR-014 layout laws MUST hold across that sweep with 005's
  element and text-leaf floors, and 005's mutation control MUST still go red on
  a planted escape, runaway and collision.
- **FR-009**: The stage scroller MUST compute `scrollbar-width: thin` and
  `scrollbar-color` resolving to `--rule` over a transparent trough, in both
  themes.
- **FR-010**: The `::-webkit-scrollbar` rules MUST declare no stepper buttons
  and a hover-brightened thumb, and MUST contain no literal colour — every
  value a token.
- **FR-011**: A graph that fits its stage MUST gain no horizontal chrome; a
  reserved scrollbar gutter MUST fail this requirement.

## Success Criteria

- **SC-001**: `uv run pytest -q`, `npm --prefix web run typecheck`,
  `test:unit` and `test:smoke` all exit 0 from a fresh checkout.
- **SC-002**: With 005 attested `landed` and its work graph archived, the
  backend suite is green — the condition that is red today.
- **SC-003**: Zero clipped stages across the FR-007 sweep; the number this
  spec exists to move is 235/27/27 → 0/0/0.
- **SC-004**: Every scenario above is a DOM, computed-style, stylesheet or
  request-log assertion runnable headless (constitution IV).
- **SC-005**: No dependency added, no route added, no verb added, no fixture
  invented.

## Assumptions

- The pane keeps serving the recorded Fixture floor under `PANE_DEMO=1`; no
  live factory is needed by any gate.
- 2560 replaces 3008 in the committed sweep: it is the width 005 already
  measures, and the cap makes every width above 96rem identical to it.

## Out of Scope

- Raising or removing the 96rem frame cap (`DESIGN.md` § Layout, 004 FR-007).
- Wrapping an over-wide rank onto a second row, and the `Wires.tsx` row-break
  case it needs — deferred by D-016.
- The degraded note's `span.detail` occlusion (review F2) and the fabricated
  topology a degraded workgraph draws (review F4).
- Any Desk change; the Desk's world is 006's.

## Work Graph

```yaml
US1:
  depends_on: []
  implements: [FR-001, FR-002, FR-003]
US2:
  depends_on: []
  depends_on_merged: [US1]
  implements: [FR-004, FR-005, FR-006, FR-007, FR-008]
US3:
  depends_on: []
  depends_on_merged: [US2]
  implements: [FR-009, FR-010, FR-011]
```

Serial on merge-edges. US1 goes first because US2 and US3 both change the
corpus and the smoke suite US1 unpins, and because two operator PRs are held
red behind it. US2 and US3 both rewrite `web/src/showfloor/showfloor.css` and
extend `web/tests/smoke/showfloor.spec.ts` — the shared-file contention that
cost a rebuild on 2026-08-22 — so US3 waits for US2's merge rather than its
branch.
