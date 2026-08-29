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
- **The detail track is a story's track, not a permanent one** (2026-08-25).
  While no story is selected the pane holds nothing but the room's own
  explanation, and `26rem` of stage is a poor price for two sentences: the
  track collapses to `0` and the stage takes the width. Picking a story
  restores it. The stage is the room's subject; the pane is what a pick
  earns.
- **Containment is a design law.** No element carrying text may cross the
  viewport's right edge except inside an ancestor whose `overflow-x` scrolls,
  and every stage element sits inside its stage's box. No two text leaves may
  overlap. **And no element with an opaque background may paint over a text
  leaf that is not its own** (2026-08-25, D-018) — the first three laws measure
  glyph geometry through a `Range` over each leaf, which is correct and is
  exactly why they cannot see a box painted on top of readable text. A degraded
  note once rendered with its heading cut mid-word, in both themes, while all
  three passed. These are committed test assertions, not aspirations.
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
| `deferred` | muted, transparent, **dashed border** | specs parked out of the build order by operator choice |
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
`pointer-events: none`. **Under the stage, above the legend, the spec's own goal**
(2026-08-25, D-019): one paragraph lifted from the spec's `## Context` — or
`## Sketch` for a spec still unrefined — saying what this epic is *for*. It does
not depend on selection, because it is true of the graph either way, and a spec
carrying neither heading renders no band at all rather than an empty one. One
legend row under the stage, rendered once per page, never per epic. The stage scrolls horizontally when a graph outgrows it;
an epic whose stage document has no nodes renders as its degraded notice with
**no stage canvas at all**.

**When the stage does scroll, the scroll is furniture and wears the room's
clothes** (2026-08-25). Left unstyled, a scroller renders the host operating
system's widget — a light grey trough with stepper buttons, pasted into a dark
room — and it is the one surface in this pane the tokens never reached. Thin,
no stepper buttons, thumb on `--rule` and brighter on hover, trough
transparent, in both themes. It is always rendered rather than an overlay that
fades in: a graph continuing past the edge with no visible affordance is a
graph with pieces missing.

### Detail pane

For the selected story: id, serif title, the story's one-sentence intent, the
six named steps with timestamps, a facts grid (attempt `n of cap`, judge
verdict with scenario count, PR number, landing SHA, wall clock), and the
`requirement_keys` as sunken mono chips. `aria-live="polite"`.

When nothing is selected the pane's track is gone until a story is picked, so
the explanation never costs the graph its width (2026-08-25). **The band beneath
the stage belongs to the spec's own goal** (D-019), not to a description of the
room: the goal is true whether or not a story is selected, so nothing vanishes on
a click. The room's own two-sentence explainer retires to the genuinely empty
case — no spec picked at all — where it is the only thing there is to say.

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

### The drafting table in this world

The third room (D-022, spec 014) and the only one that renders **documents**
rather than state. Same tokens, same faces, same chips. What it adds is a reading
measure and a vocabulary for a check that has not been run.

- **Three documents, one column each, one scroll.** Running text holds the ramp's
  body size at a measure of roughly 68 characters; the three columns collapse to
  one below the width at which that measure cannot be held twice. A document is
  read, not scanned — this is the one place in the pane where prose sets the
  layout rather than a table.
- **The read stamp.** Every render names the working-tree revision and the instant
  it was read, in micro uppercase over a hairline, at the top of the view. The
  roadmap hard-resets the operator's checkout on a 300-second timer (N50); a
  document with no read instant is a claim that has quietly expired.
- **An absent document is quiet.** A `plan.md` that does not exist reads as the
  word `absent` in italic muted, in its own column, with no border and no colour.
  Most of this corpus has no `plan.md`; painting that red would be constitution
  III inverted. **Absent is not degraded, and present-but-empty is neither.**
- **Checks are attributed, never totalled.** Each check renders as one row: the
  seam's own name in mono, its answer, and its message verbatim when it has one.
  There is **no summary chip and no composite verdict** — the pane cannot obtain
  one (spec 014's frontmatter says why), and a green pill the operator reads as
  "validated" would be the most expensive lie this room could tell.
- **A third chip state: `not run`.** Alongside the eleven-state glyph grammar,
  which describes *work*, a check carries one of three: `passed`, `refused`,
  `not run`. `not run` is muted and unbordered, and it means an input was missing
  — never a failure the spec earned.
- **The pre-dispatch stage is unlit.** A compiled Work Graph draws with the
  Showfloor's stage assets and the same two edge strokes, with every node in the
  unlit form. No node carries a run state, because none has run. Do not add a
  twelfth glyph for "not yet": that is the absence of state, not a state.
- **The index is a table, not a room of its own** (D-025, spec 018). Bare
  `/draft` lists the corpus in the roadmap's order: spec directory in mono, its
  declared state as the chip that state already owns, nothing else. A declared
  state is an *intent*, never a run state — it takes a chip from the vocabulary
  above and never a glyph from the eleven-state grammar, for the same reason the
  pre-dispatch stage is unlit. The row is the link; there is no separate control.
- **A write states its consequence on the control, not beside it** (D-025, spec
  010). A grooming write renders the seam's composed bytes as a document in the
  room's reading measure, and the control under them carries the consequence in
  its own label — the sentence the operator reads last, before the press, in the
  room's warning face when the write starts a factory. Not a tooltip, not a
  confirmation modal the eye learns to dismiss, and never a bare verb. A control
  whose consequence is one hop away is a control that will be pressed unread.

### The review room in this world

The fourth room (D-023, spec 011). Three tracks, left to right: what changed, the
thing itself, the notes. Same tokens, same chips, same tables.

- **A measured number is shown, never only a verdict.** The two manual reviews
  earned this room by reporting `235px of graph hidden at 1280`, `US4 fully
  invisible`, `scrollbar height 0px`. A green tick over that measurement throws
  away the thing that made the ritual worth automating. Numerals right-aligned
  tabular mono, the unit always present, the law named beside the figure.
- **The frame is furniture, and it is the widest thing on screen.** The rendered
  route gets the room's centre and the operator's chosen width; the two side
  tracks hold at a fixed measure and scroll independently. Nothing overlays the
  frame — an overlay on the thing under review is a defect the reviewer cannot see
  past.
- **The served revision is a header, not a footnote.** Micro uppercase over a
  hairline at the top of the view, always present. When the served revision does
  not contain the epic under review, the statement takes a full-width band above
  the frame in the room's warning face — not a chip, not a tooltip. Every note
  taken under a mismatch is about something else, and the reviewer must not be
  able to miss it.
- **A note renders its coordinates, not its prose first.** Story, route, width,
  theme, and the figures at capture, in mono; the observation follows. A note
  whose coordinates are collapsed behind a disclosure is a note nobody will
  reproduce.
- **The composed draft is shown as a document, never as a saved thing.** The room
  writes nothing (spec 011 FR-014). The control says *save this yourself* in those
  terms — a control that reads like a save button in a room that cannot save is
  the one lie this room could tell that the operator would not catch.

### The record room in this world

The fifth room (D-027, spec 020). One spec's build record, read at a desk rather
than glanced at on a projector — 007's Open Question 4 chose this over a mode of
the Showfloor and the density is why. Same tokens, same chips, same tables.

- **Tables, not a detail pane.** A story's attempts are rows: attempt number,
  verdict, the gates that ran with their outcomes, the ladder the attempt ran
  under. The Showfloor's detail pane holds one story's current state and is the
  right size for it; a spec's whole record is dozens of rows and wants a column
  it can scroll. Numerals right-aligned tabular mono, durations with the unit
  always present.
- **The reach statement is furniture, not a footnote.** *This is the current
  record and does not survive a re-dispatch* sits in micro uppercase over a
  hairline at the top of the record, always present, never behind a disclosure.
  A room that shows six attempts without saying it cannot show the seventh is
  making a completeness claim the store cannot honour.
- **Unknown is typeset, never omitted.** Persona, model, and any interval the
  facts cannot bound read `unknown` in the Unknown Rule's italic muted face, in
  the cell where the number would have gone. The cell is never blank, never `0`,
  never a dash, and the word "live" never appears beside it. A missing column is
  a question the operator stops asking; a column of `unknown` is a question with
  a filed answer.
- **Rework is the emphasis, because it is what the operator came for.** A story
  that took one attempt is quiet. A story that took more carries the count in the
  state vocabulary's attention face, and its extra attempts render as their own
  rows rather than as a badge — the second attempt's gate failure is the whole
  reason the row is interesting.
- **The room is reachable from the stage.** A landed spec's stage carries the
  door. 018 exists because 014 shipped a room reachable only by typing its URL,
  and a fifth room repeats that mistake more cheaply than the fourth did.

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
