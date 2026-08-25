# Implementation Plan: the pane fits the screen

**Branch**: `004-the-pane-fits-the-screen` · **Date**: 2026-08-24
**Spec**: [spec.md](./spec.md) · **Findings**: [`docs/pane-review-2026-08-24.md`](../../docs/pane-review-2026-08-24.md)

## Summary

Four stories repair the composition of two rooms that already work, and commit
the layout invariants that would have caught the drift on the attempt that
introduced it.

Every defect here is a **divergence from `DESIGN.md`, not an absence of design**.
That is the plan's central fact and it shapes every task below: no story invents
a layout, and no story is free to choose one. Where the implementation and
`DESIGN.md` disagree, `DESIGN.md` wins (constitution VIII) and the task says so
with a line reference. Both places the first build had no measurable rule to obey were settled in
`DESIGN.md` on 2026-08-24, **before** this plan was finished — the Body
segmentation rule and the Spend Strip's shape rule. One made an existing
requirement measurable; the other closed a real silence. Neither was invented by
a node.

The root causes are small and already located:

| finding | root cause | file |
|---|---|---|
| S2, S3 | `style={{ height: 300 }}` inline on the map, constant for every graph | `EpicStage.tsx:61` |
| S1 | grid is `220px 1fr auto`; the lane is a DOM sibling in column 3 | `showfloor.css:48`, `EpicStage.tsx:88` |
| D1 | body relayed verbatim into one text node, no segmentation | `AttentionItem.tsx` |
| D2 | `flatMap(groups) × entries(metrics)` cross product | `SpendStrip.tsx:34-39` |

None of these is a redesign. Three are single-expression changes plus their tests.

## Technical Context

**Language**: TypeScript 5 (strict), React 19, `@xyflow/react`, vitest, Playwright.
No new dependency — constitution VII, and nothing here needs one.

**Surfaces touched**: `web/src/showfloor/` (US1, US2), `web/src/desk/` (US3, US4),
`web/src/styles/global.css` (all four, which is why the graph is serial), and
`web/tests/` throughout.

**Untouched**: `pane/` entirely. Every backend claim held on inspection — sixteen
`factory.*` seam imports, two non-GET routes, the token guard on the router. No
story here has cause to open a Python file, and a diff that does is out of scope.

**The fixture floor already carries every payload these stories need**: three
zero-node epics, a 1,334-character escalation, a Question, a Notice, and a rollup
with a NULL. Constitution V forbids inventing a fixture; none is needed.

## Constitution Check

| principle | how this feature satisfies it |
|---|---|
| **I — one verb** | No story adds a route, a control, or a write path. US3 restructures the *presentation* of an escalation body; the four choice buttons and the Answer verb are untouched. |
| **II — borrowed seams** | No story reads a factory surface. Every change is downstream of documents 001–003 already assemble. |
| **III — honest degradation** | US1 removes an empty epic's *canvas*, never its degraded notice — the scenario asserts the notice survives. US4's FR-014 restates 001's unknown-never-zero guarantee so a layout change cannot quietly drop it. |
| **IV — provable from the diff, headless** | Every scenario is a measurement a browser can take: a bounding box against a scroll extent, a rendered height against a node count, a character count, a column set. SC-005 states outright that no criterion in this spec can be satisfied by a screenshot. |
| **V — fixtures recorded** | No fixture is recorded or edited. Every scenario reads what `fixtures/` already holds. |
| **VI — token guards every route** | No route is added or altered. |
| **VII — ask before adding dependencies** | None added. |
| **VIII — built to DESIGN.md** | This is the principle the feature exists to restore. Every layout task cites the `DESIGN.md` line it is conforming to. |

**D-014 check**: every acceptance scenario asserts what the diff *commits* — a
committed test, a committed sweep, an absent declaration — and never what a
command would *do*. Where a scenario depends on a file outside its story's diff,
US1-S4 says so in words.

## Project Structure

### Documentation (this feature)

```
specs/004-the-pane-fits-the-screen/
├── spec.md          # 4 stories, FR-001..FR-015, the Work Graph
├── plan.md          # this file
└── tasks.md         # the slice each node reads
```

### Source Code (repository root)

```
web/src/showfloor/
├── EpicStage.tsx        # US1: the inline height; US2: the lane's placement
├── LandingLine.tsx      # US2: moves inside the map, or its column is defined
├── layout.ts            # US1: stage height becomes a function of rank depth
└── showfloor.css        # US1, US2: the grid and the map cell

web/src/desk/
├── AttentionItem.tsx    # US3: segmentation of the escalation body
└── SpendStrip.tsx       # US4: one row per persona

web/tests/unit/
├── EpicStage.test.tsx        # US1
├── layoutStage.test.ts       # US1
├── AttentionItem.notice.test.tsx  # US3
└── SpendStrip.test.tsx       # US4

web/tests/smoke/
└── showfloor.spec.ts    # US1, US2: the viewport invariants
```

## Decisions

### D1 — the landing line moves inside the map, it does not get a wider grid

`DESIGN.md:224` specifies the route as a grid `220px 1fr` — **two** columns — with
the landing line **inside the SVG at x=930**. The implementation added a third
`auto` column and made the lane a DOM sibling:

```css
.epic-stage     { grid-template-columns: 220px 1fr auto; }
.epic-stage-map { grid-column: 2; min-width: 1040px; }
.landing-line   { grid-column: 3; }
```

Column 2 is forced to at least 1040px, column 1 is 220px, and column 3 lands past
the container — measured at **+121px** past a 1440px viewport, and identically at
1280.

**There are two possible fixes and only one of them is legal.** Widening the
container or making column 3 shrink would put the lane on screen and would be a
divergence from `DESIGN.md` that no test would catch. The lane belongs inside the
scrolling map, where the specified x=930 places it inside the specified 1040px
min-width, reachable by the horizontal scroll `DESIGN.md:224` already names.

**US2 conforms the implementation to the document.** If the operator prefers the
sibling layout, that is a `DESIGN.md` amendment and this decision is void — but it
is not a choice a node may make.

### D2 — stage height is computed, never constant

`EpicStage.tsx:61` renders `style={{ height: 300 }}`. Every graph gets 300px,
which is why a two-node stage measured 5–6% full and three zero-node epics
reserved 514px each.

Height belongs in `layout.ts` beside the spacing constants it already holds, as a
function of rank depth and the 140px row spacing `DESIGN.md:224` names. The
inline style goes; the computed value arrives as a prop or a CSS custom property.

**Zero nodes is not a small stage, it is no stage.** US1-S1 asserts the canvas
element is *absent* rather than short — absence is exact, a threshold is a guess,
and an epic with a failed workgraph read should read as a line of text carrying
its notice.

### D3 — structuring an escalation is not editing it

**`DESIGN.md:270` always required this.** "A micro label 'What each button does'
followed by one sentence per choice" has been in the design system since D-012;
the first build rendered 1,334 characters in one paragraph. The 2026-08-24
amendment did not add a requirement, it made an existing one measurable — one
block per choice token, 400-character bound, byte-for-byte preservation — because
"one sentence per choice" is not something a gate can score and this feature
exists to stop shipping rules that only a reader could enforce.

Constitution III forbids softening what the factory said, and the node that
relayed the payload verbatim was right to. US3 segments the body on the choice
tokens the payload already contains and asserts, byte-for-byte after whitespace
normalisation, that the rendered text still equals the payload — **emoji
included**. That assertion is the whole safety property: it makes it impossible
for a future change to quietly rewrite the factory's words while claiming to lay
them out.

### D4 — the spend strip's metric set is now closed, and closed is the point

`DESIGN.md`'s Spend Strip shape rule declares four columns — prompt tokens,
completion tokens, requests, spend — one row per persona plus a total, and states
that `cache_read_tokens`, `cache_write_tokens`, `rows` and `unconfirmed_rows` are
ledger bookkeeping that does not belong on a Desk.

**The closure is the durable part.** The current defect is not that four
particular columns are wrong; it is that the component reads its columns from the
rollup's keys, so the Desk shows whatever the ledger happens to carry. US4 reads
the set from a declared constant instead, which means a new ledger column cannot
reach the Desk without amending `DESIGN.md` and producing a diff.

### D5 — the graph is serial because the stylesheet is shared

All four stories reach `web/src/styles/global.css`; US1 and US2 both edit
`showfloor.css` and `EpicStage.tsx`; US3 and US4 both edit `web/src/desk/`.

On 2026-08-22 two stories of different epics that shared `pane/config.py` each
passed their own four gates and the second was rejected by the merge queue's
speculative build — `Settings.__init__()` gained four required arguments and the
first story's tests, written against the old signature, died. The loser had to be
**rebuilt against the winner, not patched**. Declaring these four independent
while they share a stylesheet is that defect, invited.

Serial costs four rounds at a measured ~20 minutes each. A collision costs a
rebuild plus the diagnosis that finds it.

## Story-by-story approach

### US1 — the stage is the size of its graph

Move height out of the component and into `layout.ts`; branch on an empty node
list before the canvas is constructed at all. The degraded notice is rendered by
the same component and must survive — the scenario asserts it does. Then sweep
the Showfloor's own stylesheet for viewport-derived heights, scoped to that file
because `global.css` is not this story's diff.

### US2 — the landing line is reachable

Draw the lane inside the map at the x `DESIGN.md` names, remove the third grid
column, and assert reachability against the **wrapper's scroll extent** rather
than the viewport — because a wrapper that scrolls is the specified behaviour and
a viewport-containment assertion would forbid the very thing the document asks
for. The viewport sweep in US2-S3 carries an explicit exception for scrollable
descendants for the same reason.

### US3 — the escalation reads as the choices it offers

Segment on the choice tokens present in the payload, preserve bytes, bound each
block at 400 characters, and degrade to one block when a payload names no choices
— a Question or a Notice must not crash a segmenter keyed on choices.

### US4 — the spend strip says something

One row per persona plus a total; columns equal `DESIGN.md`'s named set exactly,
neither superset nor subset. A persona whose every value is unknown still renders
— suppressing it would make the strip lie by omission.

## Risks and traps

**The 400-character bound is asserted, not the observed 1,334.** A test written
against today's fixture passes forever once the fixture changes. Every bound in
this feature is a property.

**`fitView` may fight a computed height.** `EpicStage.tsx` mounts ReactFlow with
`fitView`, which scales content to the container. If the container's height
becomes a function of the graph, `fitView` will re-fit to it — the two must be
reconciled deliberately, and a stage that computes a tall height and then scales
its content down to nothing satisfies FR-002 while failing its purpose. US1's
scenario 3 asserts the *stage's* height varies; a task should also confirm the
stations remain at the 160px/140px spacing `DESIGN.md` names after any fit.

**Reduced motion and both themes.** 002/US3 committed assertions that the
Showfloor stays legible with animation off. A layout change can break a reduced-
motion path without touching the motion code; the existing tests must keep
passing and are not to be relaxed.

**The Showfloor's inner scroll model is out of scope** (finding S4) and must not
be "fixed" incidentally. `.showfloor { overflow: auto }` at `showfloor.css:9`
stays as it is; a story that changes the page's scroll behaviour has widened its
own scope.

**Do not restore the stripped module documentation here.** `web/src/desk/` ships
4 of 17 files documented against 12/12 in `web/src/showfloor/`, because 001/US4
deleted docstrings to get under the diff-size cap. It is real and it is out of
scope — a documentation sweep inside a layout story is exactly the scope creep
that makes a diff too large to judge, which is the defect that caused it.

## Complexity Tracking

No constitutional deviation is requested. No dependency is added, no route is
added, no seam is re-derived, no fixture is invented, and every layout change
conforms an implementation to a document that already specifies it.
