# Implementation Plan: the stage takes the room

**Branch**: `008-the-stage-takes-the-room` · **Date**: 2026-08-25
**Spec**: [spec.md](./spec.md) · **Authority**: `DESIGN.md` (D-016) § Layout,
§ Stage, § Detail pane

## Summary

Three subtractions, no additions. The corpus tests stop reading this morning's
repository; the empty detail track stops holding 403px of stage; the scroller
stops wearing the host operating system's widget. Zero backend logic changes,
zero dependency changes, zero new routes, and the entire proof burden is
measurement plus *survival* — every 005 guarantee stays green through all
three stories.

## Technical Context

TypeScript 5 strict, React 19, vitest, Playwright; Python/pytest for US1's
half. `PLAYWRIGHT_BROWSERS_PATH=0` on both install and test run (CLAUDE.md).

## Constitution Check

| principle | how |
|---|---|
| I | No verb, no write path, no control added. US2 moves an existing paragraph; US3 styles chrome. |
| II | No seam touched. The showfloor document is unchanged; only its tests and its CSS move. |
| III | The room's explanation is relocated, never withheld or truncated (FR-005 asserts the verbatim text and its visibility). |
| IV | Every scenario is a DOM, computed-style, stylesheet-text or request-log assertion, headless (SC-004). |
| V | US1 exists *because* the tests read live state instead of a recorded one. No fixture invented. |
| VI–VII | No route, no auth, no dependency change. |
| VIII | D-016 amended `DESIGN.md` before this spec was drafted; every appearance task cites its clause. |

## Project Structure

```
tests/test_showfloor_document.py          # US1: corpus conditions constructed, not read
tests/test_no_test_pins_live_corpus.py    # US1: the pattern guard (FR-001)

web/src/showfloor/
├── Showfloor.tsx        # US2: the grid's selected/unselected shape
├── DetailPane.tsx       # US2: the empty state leaves the column
└── showfloor.css        # US2: collapsing track · US3: the scroll's clothes

web/tests/smoke/showfloor.spec.ts   # US1: the pulse case · US2: FR-004..008 · US3: FR-009..011
web/tests/unit/DetailPane.test.tsx  # US2: carried over, selector drift only
```

## Decisions

### D1 — the empty state moves, it does not disappear

`[data-detail-empty]` keeps its hook and its words. What changes is where it
mounts: beneath the stage, above the legend row. A `display: none` would pass
005's `toHaveCount(1)` and would be a lie — constitution III forbids hiding
what the room says, and FR-005 therefore asserts computed visibility and box
position, not presence.

### D2 — the track collapses in the grid, not by unmounting the column

`grid-template-columns` resolves to `17rem minmax(0,1fr) 0` while nothing is
selected and to the authored three-track shape once something is. Keeping one
grid means the stage's width change is a track change the browser animates or
does not, with no remount, no re-measure race, and nothing for `Wires.tsx` to
disagree with. The wires re-measure on `resize`; a track change fires no
`resize`, so **the selection change must re-measure the wires explicitly** —
see Risks.

### D3 — US1 constructs corpus conditions the way the suite already knows how

`test_an_unparseable_workgraph_is_told_apart_from_a_missing_one` already passes
a `workgraph` reader into `assemble()`. That is the pattern; US1 spreads it to
every test that currently depends on what `specs/` and `docs/dags/` happen to
hold. The guard test (FR-001) is what stops the pattern coming back — a
convention nothing enforces is a convention that decays.

### D4 — the scrollbar is tokens, not a second stylesheet

Both themes come from the same rules because every colour is a `var(--…)`.
FR-010 asserts the absence of literals so the dark/light split cannot be
re-introduced as two blocks — the failure mode `DESIGN.md`'s three-block theme
pattern exists to prevent.

## Story-by-story approach

**US1** rewrites the corpus tests first, then proves itself by mutating a
scratch corpus into the exact state that is red today (005 `landed` plus its
archived graph) and running the suite green. It also fixes the pulse smoke
case, which fails for the same family of reason: it waits on live floor state.

**US2** changes the grid and moves the empty state, then lands the FR-007 sweep
— every spec on the floor, three widths, both themes, `scrollWidth` equals
`clientWidth`. The sweep is the deliverable; the CSS is two lines.

**US3** styles the scroller and lands the computed-style and stylesheet-text
assertions, including the fitting case gaining no chrome.

## Risks and traps

- **The wires do not know the track moved.** `Wires.tsx` measures card boxes in
  `requestAnimationFrame` after mount and on `resize`. Collapsing or restoring
  the detail track relays the stage without firing `resize`, so the paths will
  keep the old geometry until something else nudges them. Re-measure on the
  selection change explicitly, and assert it: pick a story, then read a wire's
  `d` attribute and compare it with the unselected geometry. A stale wire is
  the defect this story is most likely to ship, and it is invisible to every
  law FR-014 committed.
- **Selector drift breaking carried-over suites silently.** 005's
  `DetailPane` unit suite and the FR-015 smoke block are the deliverable of a
  landed story; a failing carried-over test is a defect in *this* diff, never a
  test to relax.
- **`scrollbar-gutter` is not the answer.** Reserving a gutter makes the fitting
  case lose width to chrome it does not need — FR-011 is written to catch
  exactly that shortcut.
- **Overlay scrollbars make the affordance environment-dependent.** Headless
  Chromium reports a scrollbar height of 0 where the operator's browser renders
  a full classic widget. Assert the *authored rules*, never the rendered
  scrollbar's box, or the gate will disagree with the machine the operator is
  looking at.
- **US1 must not weaken an assertion to pass it.** Constructing a condition is
  the fix; deleting the assertion is not. Every test US1 rewrites keeps what it
  proved, and the story's diff must show the same contract asserted from a
  constructed corpus.

## Complexity Tracking

No deviation requested. No dependency, route, verb, seam or fixture change.
