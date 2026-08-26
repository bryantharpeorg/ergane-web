---
state: landed
# Attested landed 2026-08-25. US1 55920c910bb8 (#47), US2 987285087d0e (#48),
# US3 5cb5441ea4bf (#49) - all three observed on dev by content.
# Dispatched 10:00 AM CT, complete 3:19 PM CT. Wall clock 5h19m, but only
# ~1h15m of it was work: US1 took two attempts (the second authored D-017,
# below), US2 landed first attempt, and US3 burned attempts 1-4 in THIRTEEN
# SECONDS without ever starting an agent.
#
# THE US3 STALL IS THE LESSON, AND IT IS NOT A CODE DEFECT. Every one of those
# four attempts died on "Failed to authenticate: OAuth session expired and could
# not be refreshed" - the `implementer` persona is `agent: subscription`, so it
# runs on the operator's own Claude Code login, and that session had expired.
# No agent ran, so nothing installed `web/node_modules`, so all four gate runs
# reported `tsc: not found` / `vitest: not found` / `vite: not found` (exit 127)
# and looked exactly like a broken build. The gate output named the symptom and
# never the cause. A `/login` at 2:50 PM CT refreshed the token; attempt 5
# passed 28 minutes later, first try, no code change. Filed as N52.
#
# D-017 WAS AUTHORED BY A NODE, NOT BY THE OPERATOR, AND IT STANDS. US1's
# scenario asked for measured width growth between 1600 and 2560. That is
# unsatisfiable: DESIGN.md fixes the root at 15.5px and caps the frame at 96rem
# = 1488px, so the cap already binds at 1600. The drafting error was the
# operator's - 005's FR-007 clause carried across with its viewport pair
# mis-transcribed. The node refused to weaken the test to `>=`, measured the
# geometry (1280 -> 1278px, 1600 -> 1486px, 2560 -> 1486px), amended FR-001 and
# US1-S1 to name the pair that exists, wrote D-017 to justify it, and asserted
# exact equality at the cap - a stronger claim than the growth it was asked for,
# verified by mutation. The operator ratifies it here. The mechanism that
# allowed it is filed as N51: the judge offered the rewrite as a remediation
# path, and `criteria_drift` stayed 0 because the hash is taken from the
# dispatch-time spec and never from the spec as the diff leaves it.
#
depends_on_landed: [005-one-epic-on-stage]
# Drafted 2026-08-24 under D-015. Spec 005 establishes the second world's tokens
# and the shared ladder; this spec brings the Desk into the same world and pays
# down the three Desk defects the 2026-08-24 review measured that 004 did not
# cover: the hard 1216px cap (672px of dead margin per side at 2560), the
# milestone-bar label collisions ("COMPLETED · epic-002" × "dispatch",
# "implementer" × "us1 · paged" — measured overlapping pairs on every epic row),
# and the permanently-stale fixture attention that fills half the viewport with
# countdowns pinned to a 22 Aug capture instant.
#
# WHAT DOES NOT CHANGE, AND IS RE-ASSERTED RATHER THAN TRUSTED: attention first
# in DOM order; the countdown anchor rule; the Unknown Rule; escalation body
# segmentation (≤400 chars, byte-preserved); transport ≠ refusal named in
# place; the Answer verb exactly where 003 put it. Every one of those already
# has a committed test; this spec's stories must keep them green while the
# clothing changes, and US1-S3 makes that survival an explicit scenario.
---

# Feature Specification: The Desk matches the stage

**Feature Branch**: `006-the-desk-matches-the-stage`
**Created**: 2026-08-24
**Status**: Draft
**Input**: D-015; `DESIGN.md` § The Desk in this world;
`docs/pane-review-2026-08-24.md` (Desk findings)

## Context

The Showfloor now wears the second world; a Desk still wearing the first is
two products in one window. This spec restyles the Desk onto 005's tokens and
fixes the three measured Desk defects 004 left open — width, collisions,
staleness. The Desk's *content* contract is untouched: what 001 and 003
decided is shown stays shown; only composition and clothing change.

The epic rows stop re-deriving their own state pictures: they render the
**same ladder objects** the showfloor document already carries (005/FR-003),
so the two rooms cannot disagree about a story's stop. The first world's
eleven-state chevron glyphs retire with the milestone bar; the state model is
unchanged and now speaks through chips and ladders (`DESIGN.md` § The status
ladder).

## User Scenarios & Testing

### User Story 1 - The Desk wears the world (Priority: P1)

As an operator, the Desk renders on the second world's tokens — both themes,
fluid frame, the new tables — and every guarantee the old Desk carried
survives the change of clothes.

**Independent Test**: render the Desk against the fixture floor in both themes
at three widths; assert tokens, fluidity, and that every carried-over suite
still passes.

**Acceptance Scenarios**:

1. **Given** the Desk route at viewports 1280, 1600 and 2560, **When** it
   renders, **Then** its content region fills the app frame's interior — its
   width at 1600 exceeds its width at 1280, and at 2560 it equals its width at
   1600 because the frame's `96rem` cap binds there — with no hard cap below
   that `96rem`, proven by committed Playwright measurements at all three
   widths (FR-001). *(Measured pair corrected from 1600 → 2560 by **D-017**:
   at `DESIGN.md`'s 15.5px root the cap is 1488px and already binds at 1600,
   so growth above it cannot exist; D-016 reaffirmed that the cap stays. The
   defect this retires — the first world's 1216px cap — is unchanged.)*
2. **Given** both `colorScheme` emulations, **When** the Desk renders,
   **Then** every surface takes its colour from the § Colors tokens — grounds
   differ between themes, chips read from the § Chips vocabulary, tables wear
   the § Tables treatment — proven by Playwright assertions on computed
   styles, not screenshots (FR-002).
3. **Given** the committed suites 001, 003 and 004 established for the Desk —
   attention-first DOM order, the countdown anchor rule, the Unknown Rule,
   escalation segmentation and byte-preservation, transport ≠ refusal, the
   zero-non-GET sweep and the Answer verb's presence — **When** this story's
   diff lands, **Then** every one of those tests passes unchanged, and where
   a selector had to move with the markup the assertion's subject is
   preserved and the change is named in the test file's header — proven by
   the gates plus the named-change discipline (FR-003).

---

### User Story 2 - Epic rows without collisions (Priority: P1)

As an operator scanning the floor, each epic is one legible row — id, status
chip, its stories as inline mini-ladders, spend — with nothing overlapping
anything, ever, by construction and by assertion.

**Independent Test**: render the fixture floor's six epics; assert row
content, ladder reuse, and the no-overlap law at two widths in both themes.

**Acceptance Scenarios**:

1. **Given** the fixture floor, **When** the floor section renders, **Then**
   each epic is one row carrying: mono epic id, the epic's chip with story
   count, one six-stop mini-ladder per story (labelled by `story_key`), and
   spend to date under the Unknown Rule — the milestone bar, dispatch
   diamonds and chevron glyphs of the first world are absent from the DOM —
   proven by committed unit tests (FR-004).
2. **Given** the showfloor document's ladder objects, **When** epic rows
   render, **Then** the ladders are the document's own — the Desk performs no
   state→stop derivation of its own, proven by a committed unit test feeding
   a document whose ladder deliberately disagrees with a naive state reading
   and asserting the document wins (FR-005).
3. **Given** viewports 1280 and 1600 in both themes, **When** the Desk
   renders, **Then** no two text-carrying leaf elements' boxes overlap by
   more than 4px in both axes anywhere on the page — the committed assertion
   that catches the measured collision class
   (`"COMPLETED · epic-002" × "dispatch"`) on the attempt that would
   reintroduce it (FR-006).
4. **Given** a story whose ladder is frozen terminal, **When** its row
   renders, **Then** the mini-ladder shows the frozen state and the row
   carries the `killed`/`failed` chip with `terminal_reason` available in the
   row's title attribute — never colour alone — proven by a committed unit
   test over the killed fixture epic (FR-007).

---

### User Story 3 - The stale fold (Priority: P2)

As an operator, only live clocks get full attention cards; an item whose
`expires_at` has passed collapses to one line under a `stale` fold, so the
Desk leads with what can still be answered.

**Independent Test**: render attention fixtures whose reference instant makes
some items live and some expired; assert the fold, the collapse, and the
untouched live cards.

**Acceptance Scenarios**:

1. **Given** attention items whose `expires_at` precedes the document's
   reference instant, **When** the strip renders, **Then** each renders as
   one line — kind, id, `expired <duration> ago` — inside a collapsed
   `stale` fold whose summary names the count, and the fold opens on demand;
   items with live clocks render full cards above it, unchanged — proven by
   committed unit tests over the recorded fixtures at a reference instant
   that splits them (FR-008).
2. **Given** an expired Escalation inside the fold, **When** it is opened,
   **Then** the item still shows its factory-written `expires_at` and its
   outcome text verbatim — collapsing is layout, never editing, and no
   countdown is re-derived from the pane's clock (the countdown anchor rule,
   restated against the fold) — proven by a committed unit test (FR-009).
3. **Given** a floor whose every attention item is live, **When** the strip
   renders, **Then** no fold renders at all — an empty fold is an element
   that can never fill (FR-008).

---

### Edge Cases

- An item with no `expires_at` (a Question webhook payload, a Notice) is
  never stale — it has no clock to expire; it renders as 001 decided.
- An item that expires while the page is open moves to the fold on the next
  SSE-driven render, not by a local timer.
- The fold's summary count obeys the Unknown Rule's spirit: it states a
  number, never renders an empty shell.

## Requirements

### Functional Requirements

- **FR-001**: The Desk MUST fill the app frame fluidly to its `96rem`, with
  measured width growth between 1280 and 1600 and measured equality between
  1600 and 2560, where the cap binds (pair corrected by **D-017**; the Desk
  fills the frame "like the Showfloor", `DESIGN.md` § The Desk in this world).
- **FR-002**: Every Desk surface MUST take its colours, chips and table
  treatment from `DESIGN.md`'s second world, in both themes.
- **FR-003**: Every carried-over Desk guarantee suite MUST pass unchanged,
  with any selector move named in the test header.
- **FR-004**: Each epic MUST render as one row — id, chip, per-story
  mini-ladders, spend — with the first world's milestone bar and chevrons
  absent.
- **FR-005**: Epic-row ladders MUST be the showfloor document's own objects;
  the Desk performs no state derivation.
- **FR-006**: The Desk MUST render with no two text-carrying leaf elements
  overlapping by more than 4px in both axes, asserted at 1280 and 1600 in both
  themes.
- **FR-007**: Terminal stories MUST show frozen ladders and worded chips with
  `terminal_reason` reachable.
- **FR-008**: Expired attention MUST collapse to one-line entries under a
  `stale` fold that renders only when it has contents; live cards are
  untouched.
- **FR-009**: The fold MUST preserve factory-written times and outcome text
  verbatim; nothing is re-derived or reworded.

## Success Criteria

- **SC-001**: The four gates pass with every 001/003/004 Desk guarantee suite
  green, unedited in subject.
- **SC-002**: The no-overlap assertion runs against the whole Desk in the
  smoke gate — the collision class cannot ship again.
- **SC-003**: The fixture floor's Desk shows live attention above one
  collapsed stale fold, six one-row epics, and the four-metric spend strip,
  in both themes, headless.
- **SC-004**: No criterion in this spec requires an eye.

## Assumptions

- 005 is landed: tokens, ladder model, and the showfloor document exist.
- The recorded attention fixtures plus the document's reference instant
  suffice to produce both live and expired items; no fixture is invented.

## Out of Scope

- Any change to what the Desk *shows* (001/003's decisions stand).
- Any Answer-flow change.
- The Showfloor (005 owns it).

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
  implements: [FR-008, FR-009]
```

Serial on merge-edges: US2 lays rows on US1's tokens, US3 folds the strip US2
left in place, and all three touch `web/src/desk/` and the shared stylesheet —
the contention class this corpus now declares by default.
