# Implementation Plan: one epic on stage

**Branch**: `005-one-epic-on-stage` · **Date**: 2026-08-24
**Spec**: [spec.md](./spec.md) · **Authority**: `DESIGN.md` (D-015) ·
**Comp**: `.impeccable/mocks/showfloor-redrawn.html`

## Summary

Rebuild the Showfloor as a master–detail — epic rail, one stage, one detail
pane — wearing the second world's tokens, with the six-stop status ladder as
the signature. One new backend document feeds all three regions. The stage is
plain DOM and SVG: React Flow leaves with the component that misused it, which
retires the fitView defect class by construction rather than by test.

The durable half is FR-014: containment, viewport, and no-overlap as committed
assertions at two widths in both themes. 004's lesson, made law.

## Technical Context

**Backend**: Python/FastAPI (`pane/`), reusing 001's readers, degraded-entry
words, and SSE plumbing. One new module and one new GET route; no auth change
(the router guard covers it by construction).

**Frontend**: TypeScript 5 strict, React 19, vitest, Playwright.
**Dependency change**: `@xyflow/react` and `@dagrejs/dagre` are removed from
the Showfloor and, once nothing imports them, from `package.json` — a
subtraction, permitted without asking (constitution VII gates additions).

**Data sources for US1, all already granted by D-007's environment:**

| datum | source |
|---|---|
| spec state, order | `specs/*/spec.md` frontmatter (a missing block reads `draft`) |
| graph, `story_key`, `requirement_keys` | `specs/<dir>/workgraph.json` |
| story titles, priorities | `spec.md` headings `### User Story <n> - <title> (Priority: P<n>)` |
| live node state, attempts, landing | `epic_status` via 001's reader |
| spend | the rollup 001 already serves |

Titles exist **nowhere** but the headings — verified against the compiled
workgraph, which carries `story_key` and `requirement_keys` only. Hence the
parse-with-named-fallback contract in FR-002.

## Constitution Check

| principle | how |
|---|---|
| I — one verb | No write path. Node cards are selection buttons; the zero-non-GET sweep proves they write nothing. The badge is a link. |
| II — borrowed seams | The document joins surfaces 001 already reads plus the repo's own files. Nothing re-derives factory logic; ladder stops are a *presentation* mapping over `epic_status` states, fixed in DESIGN.md. |
| III — honest degradation | FR-002's named title fallback; FR-004's per-read notes with transport ≠ refusal; the Unknown Rule on spend; frozen ladders carry `terminal_reason` verbatim. |
| IV — provable, headless | SC-005: every scenario is a DOM, request-log, or diff assertion. D-014 wording throughout — scenarios assert what the diff commits. |
| V — fixtures recorded | None invented; the floor already holds every needed shape. |
| VI — token guards | New route mounts on the guarded router like every other. |
| VII — dependencies | Net removal of two. Zero additions. |
| VIII — built to DESIGN.md | The authority was replaced first (D-015); every appearance task cites its section. |

## Project Structure

```
pane/
└── showfloor.py                 # US1: the document join + /api/showfloor

web/src/
├── styles/global.css            # US2: second-world tokens (both themes)
├── showfloor/
│   ├── Showfloor.tsx            # US2: frame, routing, selection state
│   ├── Rail.tsx                 # US2
│   ├── Stage.tsx                # US3: header, metrics, ranks
│   ├── NodeCard.tsx             # US3: id/title/chip/ladder/sub
│   ├── Wires.tsx                # US3: measured-box SVG paths
│   ├── DetailPane.tsx           # US4
│   ├── ladder.ts                # US1..: shared stop model + chip mapping
│   └── showfloor.css            # US2–US4
└── (deleted: EpicStage.tsx, LandingLine.tsx, RouteEdge.tsx, StationNode.tsx,
   layout.ts, motion.ts, transitions.ts — the first world's room)

tests/test_showfloor_document.py           # US1
web/tests/unit/{Rail,Stage,NodeCard,DetailPane,ladder,tokens2}.test.*  # US2–US4
web/tests/smoke/showfloor.spec.ts          # rewritten: FR-014's three laws
```

## Decisions

### D1 — plain DOM + SVG, not a graph library

The wires are cubic paths between measured card boxes, redrawn on resize;
ranks are flex columns. This is ~60 lines against a library whose fit
behaviour already shipped one invisible-graph regression. The comp was built
exactly this way and is the proof of feasibility. Deleting the old room's
seven modules outright (not editing them) keeps US3's diff legible.

### D2 — the ladder is one shared model, derived in the backend

`ladder.ts` renders; **the stop is decided server-side** in the document
(FR-003), so the mapping lives in one place, is unit-tested against all
eleven states, and the browser never re-derives state. The chip is the same
object's `label` — card, rail and pane cannot disagree.

### D3 — titles parse, and the parse is allowed to fail politely

The heading grammar is stable across all five specs of this corpus, but FR-002
still requires the named fallback because a parser that crashes the floor on a
malformed heading would fail constitution III. `story_key` is always present
in the compiled graph; the fallback is honest, visible, and cheap.

### D4 — old smoke assertions are replaced, not accreted

002/004 smoke tests assert the old room (stations, landing line, per-epic
stages). US3 **replaces** `showfloor.spec.ts` wholesale with the second
world's assertions rather than keeping dead selectors green. The
constitutional guarantees that must survive — zero non-GET, no write control,
reduced motion, both-themes legibility — are re-stated against the new DOM in
US3/US4. A deleted assertion is legitimate only because its *subject* is
deleted; each replacement names its predecessor in the test file's header.

## Story-by-story approach

**US1** builds `pane/showfloor.py` beside 001's readers: pure assembly
functions first (`parse_story_headings`, `derive_ladder`, `assemble_showfloor`),
then the route and SSE wiring. Ladder derivation is a table, not conditionals
scattered across renderers.

**US2** rewrites `global.css` tokens to the D-015 set (three-block theme
pattern), builds frame + rail + routing, and lands the both-themes and
no-remote-asset assertions. From here the app is visibly the second world.

**US3** deletes the seven first-world modules, builds Stage/NodeCard/Wires,
and lands FR-014 — the three laws — plus the legend-once and empty-stage
assertions. This story carries the highest risk and sits third so the
document and tokens beneath it are already merged.

**US4** builds the detail pane, accessibility, reduced motion, and re-proves
the constitution I sweeps against the finished room.

## Risks and traps

- **Wires need layout before they can draw.** Measure in
  `requestAnimationFrame` after mount and on `resize`; assert in a real
  browser (Playwright), not jsdom, where boxes are zero. The unit tests for
  Wires assert path *count and class*, the smoke asserts geometry.
- **`prefers-color-scheme` in tests**: use Playwright's `colorScheme`
  emulation; never stamp `data-theme` to fake the un-stamped default state.
- **Deleting `LandingLine` removes 004's tests' subjects.** D4 governs: the
  replacement suite must land in the same diff as the deletion, or the smoke
  gate collects nothing from this room — the gate-matching-nothing defect 001
  US1-S1 exists to prevent.
- **The rollup and `epic_status` shapes differ between fixture epics** — the
  document must treat every field as possibly absent (001's `unknown`
  discipline), and the tests must cover the fixture epic that refuses.
- **Do not restyle the Desk here.** Global tokens will bleed into Desk
  surfaces; US2 may adjust Desk styles only as far as keeping its existing
  tests green. The Desk's world change is 006's whole job.

## Complexity Tracking

No deviation requested. One route added (guarded by construction), two
dependencies removed, zero added, no fixture invented, no auth or verb change.
