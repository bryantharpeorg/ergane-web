---
description: A mission-control ledger on a cool grey ground, both themes; one epic on stage at a time, its stories told as status ladders; state is always a worded chip, never colour alone.
---

# Design System: Ergane pane — the second world

**Authority.** This document is the pane's visual authority under constitution
VIII. It is the **second** world: D-015 (2026-08-24) replaced the first — the
light-sage mid-century world D-012 recorded — after the operator approved the
`Showfloor Redrawn` proposal. The approved comp is committed at
`.impeccable/mocks/showfloor-redrawn.html`; the first world's comps remain
beside it as history (`desk.html`, `showfloor.html`, `tokens.css` are the old
world and are **not** authorities anymore). Where a spec's scenario and this
document disagree on an *appearance*, this document wins; on *what is shown*,
the spec wins.

**Why the world changed.** The first build proved the old world's central
staging idea wrong at the root: one full stage per epic, stacked, produced six
screens of mostly-empty canvas, a landing rail and legend per epic, and graphs
laid out beside their own boxes. The second world's unit is the **selection** —
one epic on stage, chosen from a rail, explained in a pane — and its signature
is the **status ladder**: every story wears the same six stops from ready to
merged, so the whole floor reads as progress bars a glance can sweep.

## Overview

The pane is an operator's ledger, not a dashboard of gauges: white cards on a
cool blue-grey ground, hairline grids, mono numerals, serif only where a thing
has a *name*. It is calm at rest and speaks in chips. Exactly one element
pulses — the ladder stop that is running now — and it stops under
`prefers-reduced-motion`. The one verb (Answer) lives at the Desk; the
Showfloor never grows a button.

## Colors

Both themes are binding. Tokens are defined on `:root` (light), redefined under
`@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])`,
and again under `:root[data-theme="dark"]`, so an explicit choice beats the OS
in both directions. `body` takes `background: var(--ground)` explicitly. No
colour may have its only definition inside a theme block.

| token | light | dark | job |
|---|---|---|---|
| `--ground` | `#EDF0F2` | `#0D1418` | page ground |
| `--surface` | `#FFFFFF` | `#131E24` | cards, rail, panes |
| `--sunken` | `#E3E8EB` | `#0A1013` | wells, code, empty ladder stops |
| `--ink` | `#14202A` | `#D8E3E8` | text |
| `--muted` | `#566873` | `#8A9EA9` | secondary text |
| `--faint` | `#7D8F9A` | `#6B7F8A` | tertiary, provenance |
| `--rule` | `#C7D1D7` | `#27373F` | borders |
| `--hairline` | `#D8E0E4` | `#1E2C33` | inner grids |
| `--accent` | `#0E6F79` | `#46B7C1` | the one accent: selection, links, "now" |
| `--accent-w` | `#DCEDEF` | `#102D31` | accent wash |
| `--olive` | `#5A6B2F` | `#A9BC62` | done / merged / landed |
| `--olive-w` | `#EBEFD9` | `#20260F` | done wash |
| `--gold` | `#7E5D12` | `#D3A845` | waiting on the operator |
| `--gold-w` | `#F4EBD4` | `#2B2210` | waiting wash |
| `--alarm` | `#9E3319` | `#E2795A` | killed, failed, regressed |
| `--alarm-w` | `#F6E3DD` | `#2E1710` | alarm wash |
| `--shadow` | `0 1px 2px rgba(20,32,42,.05), 0 8px 24px -12px rgba(20,32,42,.14)` | `0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.6)` | the one shadow, on cards |

### Named Rules

- **State is never colour alone.** Every state-bearing element carries its word:
  chips say `merged`, ladder stops pair with the detail pane's named steps.
- **Semantic hues are not the accent.** Olive/gold/alarm carry state; teal
  carries attention and selection. A button background may only be `--accent`.
- **Washes take their own hue's ink.** Text on `--gold-w` is `--gold`, never
  `--ink` — chips are `border: 1px solid currentColor` over the wash.

## Typography

**System stacks only — nothing downloads.** The first world's vendored OFL
faces under `web/public/fonts/` are retired from these surfaces (the files may
remain in the tree; nothing may load them). No remote stylesheet, ever.

```
--serif: ui-serif, "Iowan Old Style", Georgia, "Times New Roman", serif;
--sans:  ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--mono:  ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
```

Roles: **serif** for things with names (spec names, detail titles, section
headings); **mono** for identity and data (spec ids, story ids, chips, labels,
timestamps, numerals — always `font-variant-numeric: tabular-nums`); **sans**
for running prose.

### The ramp

Base `15.5px`. Steps, by role — a size off this ramp is a defect:

| step | size | use |
|---|---|---|
| `micro` | `.66rem` mono, uppercase, `.09em` tracking | grid labels, legends, section kickers |
| `tag` | `.74rem` mono | chips (`.62rem` inside chips), timestamps, sub-lines |
| `small` | `.82rem` | node titles, table cells, kv values |
| `body` | `.9rem` | detail prose, findings |
| `title` | `1.15rem` serif 600 | detail-pane title |
| `name` | `1.2rem` serif 600 | spec name beside its id |
| `display` | `1.6rem` mono 700 | the spec id — the biggest thing on the stage |

## Layout

- **App frame**: full-bleed surface card, `max-width: 96rem`, centred; never a
  hard content cap below 96rem. The appbar is one row: brand, room nav with a
  2px accent underline on the active room, and the attention badge pushed to
  the far edge.
- **Showfloor grid**: `17rem` epic rail · `1fr` stage · `26rem` detail pane.
  Below `1180px` the detail pane drops to a full-width row beneath; below
  `820px` the rail stacks above the stage.
- **Containment is a design law.** No element carrying text may cross the
  viewport's right edge except inside an ancestor whose `overflow-x` scrolls,
  and every stage element sits inside its stage's box. No two text leaves may
  overlap. These are committed test assertions, not aspirations.
- Spacing rhythm: card padding `.65–.8rem`, section padding `1.3–1.8rem`,
  stage rank gap `1.6rem`, rail row padding `.6rem 1.2rem`.

## Elevation & Depth

Flat with one lift: `--shadow` on stage node cards and the app frame. Nothing
else floats; wells and grids are tonal (`--sunken`, hairlines). No
backdrop-filter, no glass, no gradient anywhere.

## Shapes

Rectangles with `2px` radius on cards, `0` on chips. Selection is a 3px accent
left bar on rail rows and a 2px accent outline on the selected node card.

## Components

### Chips (state vocabulary)

Mono `.62rem` 600 uppercase, `.08em` tracking, `padding .24em .55em`,
`border: 1px solid currentColor`, squared. The full vocabulary — a chip outside
this table is a defect:

| chip | colours | worn by |
|---|---|---|
| `landed` / `merged` | olive on olive-w | landed specs, merged stories |
| `building` / `verifying` / `queue` | accent on accent-w | live work |
| `ready` | muted on sunken | reviewed, waiting its turn |
| `draft` | faint, transparent, **dashed border** | unreviewed specs |
| `waiting on you` | gold on gold-w | `awaiting_operator`, open escalations |
| `killed` / `failed` | alarm on alarm-w | terminal states, regressed findings |

### The status ladder (signature)

Six stops, always six, in order: **ready · building · verifying · pr open ·
queue · merged**. On a node card it is six `4px`-tall bars with `3px` gaps:
done stops olive, the active stop accent with a 1.6s opacity pulse (the
pane's only animation; suppressed under reduced motion), waiting-on-you gold,
ahead `--sunken`. In the detail pane the same six stops expand to named steps —
mono name, dot, timestamp — pending steps in `--faint`.

There is **no seventh stop**: task-level progress ("task x of y") has no seam —
`tasks.md` boxes are never ticked — and this system does not render elements
that can never fill. When ergane emits task progress, the stop is added *here*
first, then in a spec.

**Eleven node states map onto the ladder and chips** — the state model is
unchanged, only its clothing:

| `epic_status` state | ladder | chip |
|---|---|---|
| PENDING | ready active | `ready` |
| KEY_ISSUED, RUNNING | building active | `building` |
| VERIFYING | verifying active | `verifying` |
| PASSED, PR_OPEN | pr open active | `pr open` |
| ENQUEUED | queue active | `queue` |
| MERGED | all six done | `merged` |
| FAILED, KILLED | ladder freezes; card carries `terminal_reason` verbatim | `failed` / `killed` |
| WAITING_OPERATOR (or `awaiting_operator` true in any state) | active stop turns gold | `waiting on you` |

### Epic rail

One row per spec in directory order: mono id in accent, status chip with the
story count (`landed 4/4`, `building 1/4`), name in muted small beneath.
Selection: accent-w wash + 3px accent bar. Rows are real links —
`/showfloor/<spec-dir>` — and the default selection is the epic that is
building, else the newest landed.

### Stage

Header: `display` id + `name` + the live story's chip. A metrics grid
(hairline 1px-gap grid on surface): stories, merged, FRs, last-story wall
clock, spend to date — spend obeys the Unknown Rule below. The graph: ranks
left→right in declaration order, node cards `11.5rem` wide (id block, title
small, chip, ladder, mono sub-line), wires drawn rank-to-rank — **merge edges
solid 2px olive, pass edges dashed 2px `--rule`** — behind the cards,
`pointer-events: none`. One legend row under the stage, rendered once per
page, never per epic. The stage scrolls horizontally when a graph outgrows it;
an epic whose stage document has no nodes renders as its degraded notice with
**no stage canvas at all**.

### Detail pane

For the selected story: id, serif title, the story's one-sentence intent, the
six named steps with timestamps, a facts grid (attempt `n of cap`, judge
verdict with scenario count, PR number, landing SHA, wall clock), and the
`requirement_keys` as sunken mono chips. `aria-live="polite"`. When nothing is
selected it explains the room in two sentences.

### Attention badge

The Showfloor's whole relationship to attention: a gold chip in the appbar —
count and destination (`1 waiting on you → Desk`) — and nothing else. No
button, no form, no verb on this room, ever.

### The Desk in this world

Same tokens, same chips, same tables. Specifics the Desk keeps from the first
world because they were right: attention first in DOM order; the **countdown
anchor rule** (clocks count to the factory-written `expires_at` only, tick as
text with `aria-live="polite"`, never derived from the pane's clock); degraded
reads named in place with transport ≠ refusal; escalation bodies segmented one
block per choice, ≤400 chars, byte-preserved. New in this world:

- **Fluid width** — the Desk fills the frame like the Showfloor; no 1216px cap.
- **Epic rows without collisions**: each epic is one row — id, chip, six-stop
  ladder per story as small inline rails, spend — with label slots that cannot
  overlap (a committed no-overlap assertion, the collision class the first
  world shipped).
- **The stale fold**: an attention item whose `expires_at` has passed collapses
  to one line (kind, id, "expired <ago>") under a `stale` fold that opens on
  demand. Expired is a fact, not an emergency; only live clocks get the full
  card.
- **Tables** (health, spend): micro uppercase headers over a hairline, cells
  `.5rem .8rem`, numerals right-aligned tabular mono. The spend strip stays
  one row per persona with exactly its four decided metrics (prompt tokens,
  completion tokens, requests, spend to date).

**The Unknown Rule** (unchanged, binding): a NULL from the factory renders as
the word `unknown` in italic muted — never `0`, a dash, or an empty cell; a
total is unknown when any row in scope is; the word "live" appears nowhere
near spend.

### Motion

Exactly one authored motion: the active ladder stop's 1.6s opacity pulse.
`prefers-reduced-motion` suppresses it. Countdown ticking is a text update,
not an animation. Nothing else moves.

## Do's and Don'ts

### Do:
- Put every state into words on the element that carries it.
- Compute layout from content — a stage is the size of its graph.
- Keep the whole status vocabulary in this file; a new chip starts here.
- Render both themes with equal care; test both.

### Don't:
- **Don't** render an element that can never fill (the task-stop lesson).
- **Don't** repeat a legend, rail, or explainer per item on a page.
- **Don't** let any text cross the viewport outside a scrolling ancestor, let
  two text leaves overlap, or let a child escape its stage — these are test
  assertions.
- **Don't** load any remote asset or any font file; the stacks are system.
- **Don't** add a button, form, or input to the Showfloor; the verb is the
  Desk's (constitution I).
- **Don't** use gradients, glass, glow, or a second shadow.

## Governance

This world changes the way the first one did: a superseding entry in
`docs/decisions.md`, never a silent edit. D-012 established the authority;
D-015 replaced its content. The `.impeccable/mocks/` comps record what was
approved; when this document and a comp disagree, this document wins.
