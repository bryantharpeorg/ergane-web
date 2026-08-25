# Pane review — the two screens as delivered

**2026-08-24, operator session.** The pane at `dev` `8edaff2`, served under `PANE_DEMO=1`
against the recorded Fixture floor, rendered with Playwright at 1440×1000 and 1280×1000.

Every number below is measured in a browser, not read off a screenshot. That distinction is the
point: the twelve stories that built these screens passed four gates and a judge, and **nothing in
that loop ever rendered a pixel**. The first render happened two hours after the last story landed.

Each finding carries three things: what was measured, which committed intent it violates, and a
draft acceptance scenario written to be scoreable headlessly — so the fix can be specified rather
than eyeballed.

---

## What holds, and should not be lost in a fix

Worth stating first, because the failures below are all compositional and none of them are
contractual:

- **Both edge kinds render and differ** — 6 pass-edges, 6 merge-edges (002/US2).
- **The attention badge is a count and a link, nothing else** — `3 waiting on you → Desk` (002/US4).
- **The Showfloor has zero buttons, inputs or forms.** US4's "never grows a button, a form, or a
  verb" is exactly honoured.
- **The Desk has five buttons**: an escalation's four choices plus Answer. That is the one verb and
  nothing else (constitution I).
- **Degraded reads name the read and the reason in place**, and transport failure renders
  differently from a refusal (constitution III).

The factory built the contract correctly. It composed the screen badly.

---

## Showfloor

**Intent (002/US2, US3).** Each running epic's workgraph laid out left to right, dependencies
flowing rightward, declaration order preserved, both edge kinds visibly different — "and all of it
remains legible with animation off, on either theme, **filling the screen edge to edge**."

### S1 — the landing line is off the viewport, because its scroll wrapper does not scroll

**Severity: high. A whole component of the primary screen is off the display at every width tested.**

Measured at 1440×1000, and identically at 1280×1000:

```
+121px past the viewport right edge   <aside class="landing-line">
+102px                                <div class="landing-line-track">
+102px                                <div class="landing-station">   passed
+102px                                <div class="landing-station">   pr open
+102px                                <div class="landing-station">   enqueued
+102px                                <div class="landing-station">   merged
```

Ten elements in total. Nothing is clipped by a *parent* — `documentElement.scrollWidth` equals
`clientWidth`, so the page reports no horizontal overflow at all. The lane is simply laid out
beyond the right edge with no way to reach it.

**The intent it violates is more specific than "don't clip things."** `DESIGN.md:224` specifies the
mechanism exactly:

> The map is an SVG of min-width 1040px **inside a horizontally scrolling wrapper**; stations sit
> 160px apart on a row, 140px between rows, **the landing line lives at x=930** with its four
> stations 64px apart.

At x=930 inside a 1040px map, the landing line is *inside* the map by design. So this is not a
misplaced element — **the horizontally scrolling wrapper is absent or not scrolling**, and the
content that was supposed to be reachable by scrolling is instead unreachable.

`DESIGN.md:307` names it as a signature element: *"one olive 3px vertical line at the right edge of
every map… labelled 'landing line', with four 16px stations bottom to top."*

**Draft scenario**

> **Given** the fixture floor at viewport widths 1280 and 1440, **When** the Showfloor renders,
> **Then** every `[data-landing-line]` and its four stations lie fully within their scroll
> wrapper's scrollable extent, and the wrapper's `scrollWidth` exceeds its `clientWidth` whenever
> the map's min-width does — proven by a committed Playwright assertion comparing bounding boxes
> against the wrapper, not the viewport.

### S2 — an epic with no staged nodes still reserves a full-height stage

**Severity: high — it is the largest single source of dead space.**

```
stage                    height   stations   station area / stage area
fx-landing-f0a0d6         514px      0                0%
fx-paged-5e2e8a           514px      0                0%
fx-question-e8c371        514px      0                0%
```

**1,542px of guaranteed-empty canvas** across three stages, each also carrying its own landing lane
and legend. These are epics whose workgraph read failed — the Desk renders them correctly as
degraded, and the Showfloor renders a full empty stage for each.

**Draft scenario**

> **Given** a stage document whose node list is empty, **When** the Showfloor renders that epic,
> **Then** the epic renders as a named, collapsed row carrying its degraded notice and no stage
> canvas, and the rendered height of that row is less than one quarter of a populated stage's —
> proven by a committed unit test over the stage component and a Playwright height assertion.

### S3 — populated stages are 5–23% full

**Severity: medium. Directly contradicts "filling the screen edge to edge."**

Station bounding area as a fraction of stage area:

```
002-expense-notes      2 stations     6%
077-a-scanner          5 stations    23%
fx-landing-f0a0d6      2 stations     5%
```

A two-node graph occupies a 1376×562 canvas. `DESIGN.md:224` fixes station spacing at 160px
horizontal and 140px vertical, so a two-node graph *should* be small — which means the defect is
that the **stage does not shrink to its content**, not that the nodes are too far apart.

**Draft scenario**

> **Given** a stage document with N nodes and a known rank depth, **When** the stage renders,
> **Then** the stage's height equals the laid-out graph's height plus the padding `DESIGN.md`
> names, and does not depend on the viewport — proven by a committed test asserting stage height
> for a 2-node and a 5-node graph differ by the rank spacing, not by a constant.

### S4 — the window does not scroll; an inner container does

**Severity: medium — reachable, but it breaks the expected affordance.**

```
document.body.scrollHeight     58        window.scrollY after scrollTo(99999): 0
document.documentElement       1000
.showfloor  overflow-y: auto   scrollHeight 3336   clientHeight 1000
```

Content **is** reachable — forcing `.showfloor.scrollTop` reaches 2336 — but there is no page
scrollbar, and **four of six stages begin below the fold**. On a projected Showfloor (002/US4's
stated scene) with no pointer over the inner container, the screen appears frozen.

This one is a judgement call rather than a clear violation: an inner scroll region is a legitimate
choice for a kiosk surface. It is listed because it compounds S2 and S3 — 3,336px of content in a
1,000px viewport, most of it empty.

---

## Desk

**Intent (001/US4).** Attention first with time left, then floor detail, a health strip, and spend
to date; degraded reads named in place; nothing pressable that writes.

### D1 — the escalation body is one unbroken 1,334-character paragraph

**Severity: high. It is the most important thing on the page and the least readable thing on it.**

```
characters in the escalation body   1,334
paragraph / list / break elements       1
emoji inline in prose                   7
```

The body carries the full choice semantics — what RETRY does, what KILL does, what PAUSE_EPIC
leaves running, what KILL_EPIC cancels — as continuous prose with emoji embedded mid-sentence. The
four choice buttons beside it are correct and clear; the text explaining them is not.

The factory relayed the escalation payload verbatim, which is *right* — constitution III forbids
softening what the factory said. The defect is that verbatim relay was given no structure.

**Draft scenario**

> **Given** an escalation whose evidence exceeds 400 characters, **When** the Desk renders it,
> **Then** the evidence is rendered as structured content — one block per choice where the payload
> names choices — and no single text block exceeds 400 characters, with the payload's own wording
> preserved byte-for-byte — proven by a committed unit test over a recorded escalation fixture.

### D2 — the spend strip is 32 rows, 14 of them unknown

**Severity: high — the pivot this review was originally asked for.**

```
rows in the spend table              32
cells reading "unknown"              14      (44% of the table)
shape                                4 sources × 8 metrics
```

The cause is structural, not stylistic. `web/src/desk/SpendStrip.tsx`:

```tsx
{groups.flatMap((g) =>
  Object.entries(g).filter(([k]) => k !== "key")
    .map(([metric, value]) => <tr key={`${g.key}-${metric}`}>
```

`flatMap` over sources × `Object.entries` over metrics renders **whatever shape the rollup
happens to have**, with no opinion about which metrics belong on a Desk. `CACHE_READ_TOKENS:
unknown` appears four times because the ledger has the column, not because anyone decided it
mattered.

**This needs a design decision before it needs a spec.** `DESIGN.md` says nothing about the spend
strip's contents, so there is no authority to write a scenario against.

**Draft scenario, once the decision exists**

> **Given** a rollup grouped by persona, **When** the spend strip renders, **Then** it renders one
> row per persona carrying only the metrics `DESIGN.md` names, a value the factory did not record
> renders as unknown and never as zero, and the strip contains no row whose every value is unknown
> — proven by a committed unit test over the recorded rollup fixture.

### D3 — 3,625px tall at 1440 wide

**Severity: low on its own; it is mostly D2's consequence.** The spend table is roughly a third of
the page. Fixing D2 fixes most of this.

---

## What these findings have in common

Every contractual claim held. Every compositional one failed.

| checkable by a gate | held |
|---|---|
| seams ridden, not re-derived | ✅ 16 `factory.*` imports |
| one verb, no second write path | ✅ 2 non-GET routes in the whole backend |
| token guards every route | ✅ guard on the router, not per-route |
| both edge kinds distinct | ✅ 6 and 6 |
| no button on the Showfloor | ✅ 0 |
| degradation named in place | ✅ |

| needs someone to look | failed |
|---|---|
| is the component on the screen | ❌ S1 |
| does the layout fit its content | ❌ S2, S3 |
| can the operator read the thing that matters | ❌ D1 |
| does the table say anything | ❌ D2 |

**That is the whole review in one line.** These screens were verified by a loop with no eyes, and
they fail in exactly the ways a loop with no eyes cannot fail them.

The draft scenarios above are written to close that gap permanently: each is a measurement a
headless test can take. A spec built from them fixes the current defects *and* makes the class of
defect visible to the next twelve stories.

---

## Suggested routing

| finding | route |
|---|---|
| S1, S2, S3 | defects against `DESIGN.md` — it already specifies the scroll wrapper and the spacing. Spec 004 with the scenarios above. |
| S4 | judgement call — decide the projected-Showfloor scroll model first, then record it in `DESIGN.md`. |
| D1 | new requirement; `DESIGN.md` is silent on escalation body structure. |
| D2 | **design decision first** — which metrics belong on a Desk — then `DESIGN.md`, then a scenario. |

Specs 001–003 are `state: landed` and must not be amended: a landed story's fingerprint includes
its requirement keys, so editing `implements` after landing silently reopens the story. These go in
a new spec that declares `depends_on_landed` on all three.
