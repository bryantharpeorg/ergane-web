# The second world, rendered: what 005 got right and the three things it did not

**Recorded 2026-08-25, 1:30 AM CT, against the live pane at `192.168.10.156:8790`**, rebuilt from
`dev` at `bc7818f` (005 US1–US4 landed). Measured with the *committed* `measureLaws` harness from
`web/tests/smoke/showfloor.spec.ts`, extracted verbatim and run against the running service rather
than a test fixture, plus screenshots read as pixels.

This is the operator's checkpoint before 006. It exists because 004 shipped a green gate over a
room whose stations were all outside the canvas: **a gate that never renders cannot see a defect
that is only visible.**

## What the sweep says

42 screens — seven specs × three widths (1280, 1600, 2560) × both themes:

| law | violations |
|---|---|
| (a) every stage child inside its stage's box | 0 |
| (b) no text past the viewport | 0 |
| (c) no two text leaves overlap | 0 |
| document scrolls sideways | 0 |
| room scrolls sideways | 0 |

Sweep floor: minimum 95 elements and 56 text leaves measured per screen, so no screen passed by
being empty. **2560 was not in the spec** and holds anyway.

That table is true and it is not the whole truth. Three defects are on the screen and none of them
is a thing the three laws measure.

## F1 — a wide rank is clipped, with nothing to say so

The stage lays a rank out left-to-right at a fixed card width and lets `.dag-scroll` take the
overflow. Law (a) explicitly sanctions that scroll (DESIGN.md § Stage), so the laws pass. What the
operator sees is a graph with pieces missing and no scrollbar — the scroller's rendered scrollbar
height is **0px**, so there is no affordance at all.

| spec | width | graph hidden | cards cut | cards fully invisible |
|---|---|---|---|---|
| 001, 002 | 1280 | **235px** | US3 | **US4** |
| 001, 002 | 1600 | 27px | US4 | — |
| 001, 002 | 2560 | 27px | US4 | — |
| 005, 006 | any | 0 | — | — |

2560 is no better than 1600 because the frame caps at 96rem, as FR-007 asks — so **the widest
monitor in the house does not help.** At 1280 a landed epic renders with a quarter of its work
graph off-screen and nothing on the page admitting it.

The shape that triggers it is four independent stories in one rank; 001 and 002 are exactly that,
005 and 006 chain and so lay out vertically and are clean. And in the single-rank case the stage
wastes **633px of vertical space below the graph** while clipping it horizontally: the room has
the room, it is just spending it on the wrong axis.

Fix direction (not written here — this is a finding, not a spec): wrap a rank that exceeds the
stage's width onto a second row, using the vertical space that is already sitting empty. That
solves the clipping and the emptiness with one change.

## F2 — the degraded note paints over its own heading

On every spec with a degraded read — **four of the seven on the floor** (004, 005, 006, 007) — the
note renders like this, in both themes:

> A read for this spec deg␣␣␣␣␣␣␣␣␣␣␣␣␣␣␣␣␣␣␣␣␣␣␣
> ␣␣␣␣␣␣␣␣␣␣␣␣␣␣eboxadmin/code/ergane-web/fixtures/workgraphs/005-one-epic-on-stage.json: not
> recorded yet (fixtures/README.md)

The heading is cut mid-word at "deg", the words `workgraph` and `transport` are not visible at
all, and the path begins mid-string with its head hidden.

The cause is one line of CSS. `span.detail` is `display: inline` and carries an opaque background:

```html
<div class="degraded"><p class="lead">A read for this spec degraded.</p>
<p><span class="read num">workgraph</span> <span class="mode">transport</span>
<span class="detail">/home/…/005-one-epic-on-stage.json: not recorded yet (…)</span></p></div>
```

An inline element that wraps paints its background across the **whole inline box**, which measures
`362..1049 × 220..300` — 80px tall — while its glyphs sit on two lines inside a `<p>` at `241..278`.
The extra background covers the heading line above it (`p.lead` at `217..237`) and both labels
beside it (`362..496 × 242..257`). `display: inline-block`, or no background, ends it.

**Why no law caught it, and this is the part that matters for 006.** All three laws measure text
geometry. Law (c) compares glyph boxes via a `Range` over each leaf — deliberately, and correctly,
because inline fragment rects in Chromium carry the whole inline box's height and would report
collisions that are not on the screen. That decision is right, and it is also exactly the blind
spot: **an opaque box painted over text is not a text-leaf overlap.** No glyphs intersect here.
Nothing collides. The text is simply not readable.

If 006 leans on the no-overlap law Desk-wide (its FR-006 does), it inherits this hole. A fourth law
— *no element with an opaque background paints over a text leaf that is not its own* — would close
it, and is as mechanical as the other three.

## F3 — 005's own suite pins the live corpus, so attesting 005 turns it red

`PR #37` (attest 005 landed) fails `test` and `smoke` against a diff that changes **one frontmatter
line**:

```
tests/test_showfloor_document.py:344
>   assert states["005-one-epic-on-stage"] == "ready"
E   AssertionError: assert 'landed' == 'ready'

tests/test_showfloor_document.py:544
>   assert story["ladder"]["stop"] == "ready"
E   AssertionError: assert 'merged' == 'ready'
```

and the smoke case *the pulse is authored at 1.6s, and reduced motion suppresses it* times out
waiting for a selector that only exists while something is **building**.

These tests read the repository's live `specs/` corpus and assert the transient state of a spec
that was mid-build when they were written. The epic's own success is what breaks them: 005 verified
itself while `ready`, and the moment it is attested `landed` — the correct end state — its suite
goes red. The smoke case additionally needs a *live building epic* to exist on the floor, which is
true only while the factory happens to be running something.

This is a fixture discipline problem, not a layout one (constitution V: recorded, never invented —
and never *live*). The corpus tests should read a recorded corpus, or assert shape rather than a
named spec's current state. Until then **005 cannot be attested**, and `ergane status` will keep
reading it as `ready`.

## What is right, and should not be re-litigated

- **The master–detail room works.** Rail, stage, detail pane; selection deep-links; the selected
  row wears the wash and the accent bar. Both themes render as two different grounds and stay
  legible — the three-block theme pattern is in `global.css` verbatim.
- **The detail pane is the thing that was missing.** Story id, priority, the spec's own prose, the
  six-stop ladder with per-stop timestamps, the facts the factory recorded, and the requirement
  keys as chips. It is the readable per-story view the UX pass asked for.
- **The six-stop ladder reads at a glance** on the cards and in the pane, and `007` — a spec with
  no stories at all — renders as a rail row that says `no stories declared` and a stage with no
  canvas, rather than an empty box or a crash.
- **The laws are load-bearing where they apply**, and 005 shipped two guards the spec never asked
  for: a floor on the sweep (>20 elements, >10 leaves) so an empty page cannot pass, and a mutation
  control that plants an escape, a runaway and a collision and proves each law goes red.
- **React Flow is gone**, with `@dagrejs/dagre`, and `tokens.css` is now a pure alias layer with no
  colour of its own — so the Desk still works, unrestyled, until 006 changes its world.

## The decision this asks for

F3 blocks attestation today. F1 and F2 are visible on more than half the floor. All three are
Showfloor work, and 006 is the Desk — so the question is whether they become a spec 008 ahead of
006, or an amendment landed first. That is the operator's call at this checkpoint; nothing here
has been fixed in code.
