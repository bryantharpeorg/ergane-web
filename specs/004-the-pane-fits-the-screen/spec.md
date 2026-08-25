---
state: landed
# Attested landed 2026-08-24. US1 cda0cdfe9831 (#24), US2 bc020b2c8218 (#25),
# US3 f3c60731c97e (#26), US4 0d5a0d149852 (#27) - all four observed on dev,
# all four on attempt 1 with a clean judge (4/4, 4/4, 4/4, 4/4). Dispatched
# 15:55 CT, complete 17:01 CT: 66 minutes for four stories on claude-opus-5.
#
# VERIFIED BY RENDER, NOT ONLY BY GATE. The post-004 build was served from a
# scratch clone and measured with the same Playwright harness that found the
# defects, at the same viewports:
#   S1  landing line off-viewport   10 elements / +121px  ->  0 at 1280 and 1440
#   S2  empty stage height          514px x3              ->  117px
#   S3  stage height vs node count  constant              ->  2-node 449, 5-node 587
#   D1  longest escalation block    1,334 (one paragraph) ->  249 (nine blocks)
#   D2  spend rows / unknown cells  32 / 14               ->  4 / 6
#   D3  Desk page height            3,625px               ->  3,536px
#
# D3 moved least, and that is correct rather than disappointing: health and spend
# are grid siblings, so the spend table shrank while its row stays sized by its
# neighbour. D3 was rated low because it was derivative of D2, and it was.
#
# The durable half of this spec is the invariants, not the repairs. The smoke
# gate now asserts no text element sits beyond the viewport outside a scrollable
# wrapper - the assertion that would have caught S1 on the attempt that
# introduced it, and the closest this repository can come to fixing N44 without
# changing ergane.
depends_on_landed: [001-the-desk-sees-the-floor, 002-the-showfloor-stages-an-epic, 003-an-answer-reaches-the-factory]
# Drafted 2026-08-24 from `docs/pane-review-2026-08-24.md` — the first browser render of
# the pane, taken two hours after the last of twelve stories landed.
#
# WHY THIS SPEC EXISTS. Twelve stories passed `uv run pytest -q`, `tsc --noEmit`,
# vitest, a headless Playwright smoke and a judge scoring every acceptance
# scenario. Not one of those draws a pixel. When the pane was finally rendered,
# the Showfloor's landing line sat 121px past the right edge of a 1440px
# viewport, three empty epics reserved 1,542px of blank canvas between them, and
# the Desk's escalation body was 1,334 characters in a single paragraph. Six
# renders across three viewports produced **zero console errors**. The pane was
# never broken. It was unlooked-at, and no gate in the loop can tell those apart.
#
# SO THIS SPEC HAS TWO JOBS, AND THE SECOND IS THE DURABLE ONE. It repairs the
# seven findings; and it commits, as tests, the layout invariants that would have
# caught them on the attempt that introduced them. Every scenario below is a
# measurement a headless browser can take — a bounding box compared against a
# scroll extent, a rendered height compared against a node count, a character
# count. None of them asks anyone to look.
#
# WHAT THIS SPEC DOES NOT TOUCH. Every contractual claim the pane makes held on
# inspection and stays untouched: sixteen `factory.*` seam imports with nothing
# re-derived (constitution II), exactly two non-GET routes in the whole backend
# (constitution I), the token guard mounted on the router rather than per-route
# (constitution VI), both edge kinds rendering distinctly, zero buttons on the
# Showfloor, and degraded reads named in place with transport distinguished from
# refusal (constitution III). The factory built the contract correctly and
# composed the screen badly; only the composition is in scope here.
#
# DESIGN.md WAS AMENDED FIRST, ON 2026-08-24, AND THAT ORDER MATTERS. Constitution
# VIII makes `DESIGN.md` the visual authority, so a node that edited it would be
# reasoning in a circle. Two rules were settled there before this spec was
# finished: the Body segmentation rule (Attention Item) and the Spend Strip's
# shape rule (Tables). The first only made measurable what `DESIGN.md:270` had
# always required — "one sentence per choice" — which the first build satisfied
# nowhere. The second closed a real silence about which metrics belong on a Desk.
# Every requirement below is now scored against a document that already agrees
# with it.
---

# Feature Specification: The pane fits the screen

**Feature Branch**: `004-the-pane-fits-the-screen`
**Created**: 2026-08-24
**Status**: Draft
**Input**: `docs/pane-review-2026-08-24.md` — seven findings, each measured in a
browser at 1440×1000 and 1280×1000 against the recorded Fixture floor.

## Context

The pane's two rooms both render. Neither fits.

This is not a redesign. `DESIGN.md` already specifies, in detail, what these
screens should look like — including the mechanism that has failed. At
`DESIGN.md:224`:

> The map is an SVG of min-width 1040px **inside a horizontally scrolling
> wrapper**; stations sit 160px apart on a row, 140px between rows, **the landing
> line lives at x=930** with its four stations 64px apart.

At x=930 inside a 1040px map, the landing line is *inside* the map by design. It
is off the viewport because the horizontally scrolling wrapper that was supposed
to contain it is absent or inert — so the defect is not a misplaced element, it
is a missing affordance, and the fix is the one `DESIGN.md` already names.

The same pattern runs through every finding here. The delivered pane honours
every rule that a test could check and drifts from every rule that only a render
could check. That asymmetry is the thing worth fixing permanently, and it is why
the success criteria below are weighted toward the invariants rather than the
repairs: a repaired Showfloor that can drift again next quarter is worth less
than an invariant that cannot.

**Measured, not remembered.** Every number in this spec came from
`docs/pane-review-2026-08-24.md`, which took them from a Chromium instance
driving the running pane. Where a number appears in a scenario it is the
observed value, and the scenario asserts the property rather than the number
wherever the number is incidental.

## User Scenarios & Testing

### User Story 1 - The stage is the size of its graph (Priority: P1)

As a visitor watching the Showfloor, each epic's stage occupies the space its
graph actually needs — a two-node graph is a small stage, a five-node graph is a
larger one, and an epic with nothing staged is a line of text rather than a
screen of nothing.

**Why this priority**: it is the largest single source of dead space and it
blocks the rest. Three empty epics currently reserve 1,542px between them and
populated stages run 5–23% full, so every later story is composed against a
layout that wastes most of the screen. Fix the sizing first and the remaining
work is done against a stage that means something.

**Independent Test**: build stage documents from the Fixture floor — one with
zero nodes, one with two, one with five — render each headless, and assert
rendered height against node count and rank depth.

**Acceptance Scenarios**:

1. **Given** a stage document whose node list is empty, **When** the Showfloor
   renders that epic, **Then** the diff commits a component branch that emits a
   named row carrying the epic's degraded notice and **no stage canvas element**,
   and a committed unit test feeds it an empty stage document and asserts the
   canvas element is absent — proven by that test, not by a height threshold,
   because absence is exact and a threshold is a guess.
2. **Given** the three zero-node epics in the Fixture floor, **When** the
   Showfloor smoke renders, **Then** a committed Playwright assertion measures
   each such epic's rendered height and asserts it is under one quarter of the
   median populated stage's height in the same render — the comparison is taken
   within one render so it cannot drift with viewport or font.
3. **Given** stage documents of two and five nodes with known rank depth,
   **When** each renders, **Then** a committed unit test asserts the stage's
   computed height is a function of rank depth and the row spacing `DESIGN.md`
   names (140px between rows), and that the two heights differ — a stage whose
   height is constant across node counts fails this scenario.
4. **Given** any stage document, **When** the stage renders, **Then** the diff
   contains no viewport-derived height on the stage element — no `100vh`, no
   `height: 100%` on the stage or its canvas — proven by a committed sweep over
   `web/src/showfloor/` asserting those declarations are absent from the stage's
   own rules. *(`web/src/styles/global.css` is not part of this story's diff and
   is not swept here; the sweep is scoped to the Showfloor's own stylesheet.)*

---

### User Story 2 - The landing line is reachable (Priority: P1)

As a visitor watching the Showfloor, the landing line and its four stations are
on the screen — reachable by scrolling the map horizontally, exactly as
`DESIGN.md` describes, rather than laid out past the edge of a viewport that
reports no overflow.

**Why this priority**: it is the one finding that makes a whole component
unavailable. `DESIGN.md:307` calls the landing line a Showfloor signature — an
olive 3px line at the right edge of every map with four stations bottom to top —
and at both 1440 and 1280 it is 121px past the right edge with no scrollbar
anywhere on the page.

**Independent Test**: render the Showfloor headless at two widths and assert the
landing line's bounding box lies within its scroll wrapper's scrollable extent,
and that the wrapper is scrollable whenever the map's min-width exceeds it.

**Acceptance Scenarios**:

1. **Given** the Fixture floor at viewport widths 1280 and 1440, **When** the
   Showfloor renders, **Then** a committed Playwright assertion takes each
   `[data-landing-line]`'s bounding box and its scroll wrapper's `scrollWidth`
   and asserts the line's right edge lies within the wrapper's scrollable extent
   — measured against the wrapper, never against the viewport, because a wrapper
   that scrolls is the specified behaviour and viewport containment would forbid
   it.
2. **Given** a map whose content exceeds its wrapper, **When** the Showfloor
   renders, **Then** the wrapper's `scrollWidth` exceeds its `clientWidth` and
   its computed `overflow-x` is a scrolling value — proven by a committed
   Playwright assertion, so that "the content is reachable" is asserted rather
   than assumed.
3. **Given** the Showfloor at 1280 and 1440, **When** it renders, **Then** a
   committed Playwright assertion walks every element with text content and
   asserts none has a right edge beyond the viewport **except** descendants of a
   scrollable wrapper — the exception is named explicitly so the assertion
   distinguishes intended horizontal scroll from content laid out into nowhere,
   which is the distinction the current defect hides.
4. **Given** the four landing stations named in `DESIGN.md:307` — PASSED,
   PR_OPEN, ENQUEUED, MERGED — **When** a map renders, **Then** a committed unit
   test asserts all four are present in the DOM with their labels, and that
   MERGED carries its count form — so a station lost to a future layout change
   fails a test rather than disappearing quietly.

---

### User Story 3 - The escalation reads as the choices it offers (Priority: P1)

As an operator with an escalation waiting, the evidence is laid out as the
decision it is — the factory's wording preserved exactly, but structured so the
consequence of each choice can be read without parsing a paragraph.

**Why this priority**: it is the single most important element on the Desk and
measured 1,334 characters in one paragraph with seven emoji embedded mid-prose.
The four choice buttons beside it are already correct; only the text explaining
them is unreadable. An operator who cannot read the consequences under a
one-hour deadline is the failure mode D-001 gave the pane a verb to prevent.

**Why the factory was not wrong to emit it this way**: constitution III forbids
softening what the factory said, and the node relayed the payload verbatim, which
is correct. The defect is that verbatim relay was given no structure — and
structure is not softening.

**`DESIGN.md` already required this, and the build satisfied it nowhere.**
`DESIGN.md:270` has always said the body carries *"a micro label 'What each
button does' followed by one sentence per choice."* The delivered pane rendered
1,334 characters in one paragraph. This story is therefore a **defect against an
existing rule**, not a new requirement — the same class as US1 and US2.

`DESIGN.md`'s Body segmentation rule was made measurable on 2026-08-24 so the
requirement can be scored rather than admired: one block per choice token the
payload carries, in the payload's order, no block over 400 characters, a
choice-less payload rendering as exactly one block, and the concatenated text
equal to the payload byte-for-byte after whitespace normalisation.

**Independent Test**: feed a recorded escalation fixture to the attention
component and assert segmentation, byte-preservation of the payload text, and
that no rendered block exceeds the length bound.

**Acceptance Scenarios**:

1. **Given** the recorded escalation fixture whose evidence exceeds 400
   characters, **When** the Desk renders it, **Then** the diff commits a
   segmentation of the body into one block per choice the payload names, and a
   committed unit test asserts the block count equals the choice count in the
   payload — proven by that test against the committed fixture.
2. **Given** that same fixture, **When** the body renders, **Then** the
   concatenation of the rendered blocks' text equals the payload's evidence
   string byte-for-byte after whitespace normalisation, **including its emoji** —
   proven by a committed unit test, so that structuring can never become
   editing (constitution III).
3. **Given** any escalation the Fixture floor carries, **When** the Desk renders,
   **Then** a committed unit test asserts no single rendered text block exceeds
   400 characters — the bound is asserted, not the current 1,334, so the test
   fails on regression rather than only on today's fixture.
4. **Given** an escalation whose payload names no choices — a Question or a
   Notice — **When** the Desk renders it, **Then** the body renders as a single
   block and the test above still holds, proven by a committed unit test over the
   recorded Question and Notice fixtures — because segmentation keyed on choices
   must degrade to the un-segmented case rather than crash on a payload with
   none.

---

### User Story 4 - The spend strip says something (Priority: P2)

As an operator glancing at the Desk, the spend strip tells me what the run cost
per persona, in the metrics that matter, with unmeasured values honestly
unknown — rather than every column the ledger happens to have, crossed with every
source, most of them empty.

**Why this priority**: P2 because it is the least urgent of the four and the most
opinionated. It measured 32 rows with 14 cells reading `unknown` — 44% of the
table conveying nothing — and it is the last story so the Desk's other work is
merged before its layout changes.

**Why it is structural rather than cosmetic**: `web/src/desk/SpendStrip.tsx`
renders `groups.flatMap(g => Object.entries(g).map(...))` — a cross product of
whatever shape the rollup has, with no opinion about which metrics belong on a
Desk. `CACHE_READ_TOKENS: unknown` appears four times because the ledger has the
column, not because anyone decided it mattered.

**`DESIGN.md` now names the metric set.** The Spend Strip's shape rule, added
2026-08-24, declares the strip one row per persona plus a total, with exactly
four columns — prompt tokens, completion tokens, requests, spend — and states
that `cache_read_tokens`, `cache_write_tokens`, `rows` and `unconfirmed_rows` are
ledger bookkeeping that does not belong on a Desk. The set is closed and declared
there, not read from the rollup's keys, so a new ledger column cannot reach the
Desk without amending that document.

**Independent Test**: feed the recorded rollup fixture, including its NULL value,
to the spend component and assert row shape, metric set, and unknown rendering.

**Acceptance Scenarios**:

1. **Given** the recorded rollup fixture grouped by persona, **When** the spend
   strip renders, **Then** the diff commits one row per persona rather than one
   per persona-and-metric, and a committed unit test asserts the rendered row
   count equals the number of personas in the fixture plus its total row —
   proven by that test.
2. **Given** that fixture, **When** the strip renders, **Then** only the metrics
   `DESIGN.md` names appear as columns, and a committed unit test asserts the
   rendered column set equals that named set exactly — neither a superset nor a
   subset — so a new ledger column cannot silently appear on the Desk again.
3. **Given** the fixture's NULL value, **When** the strip renders, **Then** it
   renders as unknown and never as `0` or a currency zero, the label contains the
   exact text "spend to date", and the word "live" appears nowhere in the strip —
   proven by committed unit assertions. *(This restates 001's FR-020 rather than
   replacing it: the guarantee must survive a layout change, and a test that only
   001 committed would not be re-run against this diff's component.)*
4. **Given** a rollup in which every value for one persona is unknown, **When**
   the strip renders, **Then** that persona's row still renders with its name and
   its unknowns — proven by a committed unit test — because a persona that spent
   nothing measurable is a fact about the run, and suppressing the row would make
   the strip lie by omission.

---

### Edge Cases

- A stage document that is present but whose node list is empty is not the same
  as an epic whose workgraph read failed; both currently render a full empty
  stage, and US1 must keep the degraded notice while removing the canvas.
- A map narrower than its wrapper must not force a scrollbar; US2's scenario 2
  is conditioned on content exceeding the wrapper.
- An escalation payload naming choices the pane does not recognise still renders
  every block; segmentation is on the tokens present, not on a known list.

## Requirements

### Functional Requirements

- **FR-001**: An epic whose stage document has no nodes MUST render as a named
  row carrying its degraded notice, with no stage canvas element in the DOM.
- **FR-002**: A stage's rendered height MUST be a function of its graph's rank
  depth and the row spacing `DESIGN.md` names, and MUST NOT derive from the
  viewport.
- **FR-003**: The Showfloor's stage rules MUST contain no viewport-derived
  height (`100vh`, `height: 100%`) on the stage or its canvas.
- **FR-004**: Every map's landing line and its four stations MUST lie within the
  scrollable extent of the map's wrapper at viewport widths 1280 and 1440.
- **FR-005**: A map whose content exceeds its wrapper MUST make that wrapper
  horizontally scrollable, with `scrollWidth` exceeding `clientWidth`.
- **FR-006**: No element carrying text MUST have a right edge beyond the
  viewport except as a descendant of a scrollable wrapper.
- **FR-007**: The four landing stations named in `DESIGN.md:307` MUST be present
  with their labels, and MERGED MUST carry its count form.
- **FR-008**: An escalation body MUST be segmented into one block per choice the
  payload names, in the payload's order.
- **FR-009**: The concatenated rendered body MUST equal the payload's evidence
  byte-for-byte after whitespace normalisation, emoji included.
- **FR-010**: No rendered escalation text block MUST exceed 400 characters.
- **FR-011**: An attention payload naming no choices MUST render as one block.
- **FR-012**: The spend strip MUST render one row per persona, plus a total row.
- **FR-013**: The spend strip's columns MUST equal the metric set `DESIGN.md`
  names, exactly.
- **FR-014**: An unmeasured spend value MUST render as unknown, never zero; the
  label MUST contain "spend to date"; the word "live" MUST NOT appear.
- **FR-015**: A persona whose every value is unknown MUST still render its row.

## Success Criteria

- **SC-001**: The smoke gate renders both rooms at 1280 and 1440 and asserts no
  text-carrying element lies beyond the viewport outside a scrollable wrapper —
  the assertion that would have caught the landing line on the attempt that
  introduced it.
- **SC-002**: A committed test asserts stage height varies with node count, so a
  stage that stops sizing to its content fails a gate rather than a review.
- **SC-003**: A committed test asserts the escalation body's rendered text equals
  its payload byte-for-byte, so structure can never become editing.
- **SC-004**: A committed test asserts the spend strip's column set equals
  `DESIGN.md`'s named set exactly, so a new ledger column cannot reach the Desk
  without a design decision.
- **SC-005**: Every scenario in this spec is decided by a committed test reading
  the DOM or the diff. No criterion in this spec can be satisfied by a
  screenshot, and none requires an eye.

## Assumptions

- `DESIGN.md` carries both rules this feature is scored against, as of
  2026-08-24: the Body segmentation rule under Attention Item, and the Spend
  Strip's shape rule under Tables. Neither was invented by this spec — the first
  makes an existing requirement measurable, the second closes a genuine silence.
  Every layout requirement here now has an authority behind it.
- The Fixture floor already carries every payload these stories need — three
  zero-node epics, a 1,334-character escalation, a Question, a Notice, and a
  rollup with a NULL. No new fixture is recorded by this spec, and constitution V
  forbids inventing one.
- `web/src/styles/global.css` is shared by both rooms and is touched by more than
  one story here; the Work Graph chains all four on merge-edges for that reason.

## Out of Scope

- The Showfloor's scroll model — whether the window scrolls or an inner container
  does (finding S4). It is a judgement call about a projected surface, not a
  defect, and it wants a `DESIGN.md` decision before it wants a spec.
- Restoring the module documentation stripped from `web/src/desk/` when 001/US4
  fought the diff-size cap (4 of 17 files documented, against 12/12 in
  `web/src/showfloor/`). Real, and not a layout concern.
- Any change to the backend, the seams, the routes, or the auth model. Every
  contractual claim held on inspection.
- Visual restyling beyond what `DESIGN.md` already specifies. This spec repairs
  composition against the existing authority; it does not redesign.

## Work Graph

```yaml
US1:
  depends_on: []
  implements: [FR-001, FR-002, FR-003]
US2:
  depends_on: []
  depends_on_merged: [US1]
  implements: [FR-004, FR-005, FR-006, FR-007]
US3:
  depends_on: []
  depends_on_merged: [US2]
  implements: [FR-008, FR-009, FR-010, FR-011]
US4:
  depends_on: []
  depends_on_merged: [US3]
  implements: [FR-012, FR-013, FR-014, FR-015]
```

Every edge is a merge-edge and the chain is fully serial, which is deliberate
rather than conservative. US2 measures the stage US1 resizes — a content
dependency. US3 and US4 both edit `web/src/desk/` and both touch
`web/src/styles/global.css`, which US1 and US2 also reach; on 2026-08-22 two
stories of different epics that shared `pane/config.py` passed their own gates and
were rejected by the merge queue's speculative build, and the losing story had to
be rebuilt rather than patched. Declaring these four independent while they share
a stylesheet is exactly that defect, invited. Serial costs four rounds at a
measured ~20 minutes each; a collision costs a rebuild plus the diagnosis.

US4 runs last so its column-set assertion executes against a Desk whose other
layout work is already merged.
