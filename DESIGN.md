---
name: Ergane pane
description: A launch-telemetry mission timeline in a mid-century modern palette on a light sage ground; state is always glyph + caption, never colour alone.
colors:
  ground: "#E3E8E0"
  panel: "#F4F6F1"
  panel-deep: "#D2D9CE"
  ink: "#23292A"
  ink-soft: "#5C6962"
  rule: "#BDC7BA"
  walnut: "#3E4A3C"
  teal: "#1F7A78"
  teal-ink: "#0E4F4D"
  mustard: "#D9A521"
  mustard-ink: "#7A5A06"
  olive: "#6E7F3E"
  olive-ink: "#415022"
  clay: "#B9774F"
  clay-ink: "#7A4A2B"
  aqua: "#8FB8C9"
  aqua-ink: "#3E6C80"
  white: "#FFFFFF"
typography:
  clock:
    fontFamily: "Red Hat Mono, SF Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "clamp(1.9rem, 2.6vw, 2.6rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.02em"
  display:
    fontFamily: "Red Hat Display, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Red Hat Display, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Red Hat Text, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  small:
    fontFamily: "Red Hat Text, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  caption:
    fontFamily: "Red Hat Display, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
  micro:
    fontFamily: "Red Hat Text, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.06em"
  mono:
    fontFamily: "Red Hat Mono, SF Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
rounded:
  tight: "3px"
  track: "2px"
  chip: "999px"
spacing:
  s1: "0.25rem"
  s2: "0.5rem"
  s3: "0.75rem"
  s4: "1rem"
  s5: "1.5rem"
  s6: "2rem"
  s7: "3rem"
components:
  button-answer:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.white}"
    typography: "{typography.caption}"
    rounded: "{rounded.tight}"
    padding: "0.5em 0.9em"
  button-answer-hover:
    backgroundColor: "{colors.teal-ink}"
    textColor: "{colors.white}"
  button-choice:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.tight}"
    padding: "0.5em 0.9em"
  button-choice-hover:
    backgroundColor: "{colors.panel-deep}"
    textColor: "{colors.ink}"
  input-reply:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.small}"
    rounded: "{rounded.tight}"
    padding: "0.5rem 0.75rem"
  attention-item:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tight}"
    padding: "1rem 1.5rem"
  degraded-well:
    backgroundColor: "{colors.panel-deep}"
    textColor: "{colors.ink}"
    typography: "{typography.small}"
    rounded: "{rounded.tight}"
    padding: "0.75rem 1rem"
  comp-tag:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.micro}"
    rounded: "{rounded.tight}"
    padding: "0.4em 0.6em"
---

# Design System: Ergane pane

<!-- Audience: headless implementer agents building web/ from specs in a sandbox with no network.
     Every value here is literal. Where this file and .impeccable/mocks/tokens.css disagree, this file wins
     (one known disagreement: the font @import; see Typography). -->

## Overview

**Creative North Star: "The Mission Timeline"**

The pane is launch telemetry for a software factory. An operator glances at it from the terminal beside it and needs one second to know whether anything is waiting on them. So the Desk opens on a row of T-minus clocks, not a grid of metric cards, and every running epic below it reads along one shared milestone bar (PASSED, PR_OPEN, ENQUEUED, MERGED). The Showfloor is the same world seen as a transit map: stories are stations on a route, the landing run is one shared line on the right edge, and the brightest moving thing on the page is a token travelling that line. A jam at ENQUEUED is a place you can point to.

The material is mid-century modern on a light sage ground: cool green-cast neutrals, graphite ink, deep-moss headings, and four state hues (teal, mustard, olive, clay) that are muted enough to sit in an enterprise room. It is flat, hairline-ruled, tight-cornered, and dense; the one shadow in the system sits under the one thing you can press. Motion exists in exactly three places, all of which stop under `prefers-reduced-motion`.

State is the product, so state is never colour alone. Every one of the eleven node states is carried by a glyph (a skewed square, filled, half-filled, hatched, crossed, or dashed) and a one-word caption. Unknown values are written as the word "unknown" in soft italic, never a fabricated zero. Degradation is said in so many words inside a moss-grey well. Rejected outright: cream or beige grounds, red anywhere, generic cards-of-metrics, gradient text, glass blur decoration, and neon-on-black.

**Key Characteristics:**
- Light sage ground (`ground`) with near-white mist panels (`panel`) and hairline rules; never cream, beige, or neutral grey.
- Four muted mid-century state hues, each paired with a darker "-ink" tone for text; teal is the single tame primary.
- Eleven node states, each a skewed-square glyph plus an uppercase caption; two edge kinds drawn distinctly.
- One shared milestone bar on the Desk and one shared landing line on the Showfloor.
- Flat tonal layering; one shadow token, reserved for pressable things.
- Three authored motions only (live-dot breathe, RUNNING glow, landing-line token travel), all gated by `prefers-reduced-motion`.
- One verb (Answer) on the Desk; no controls on the Showfloor.

## Colors

A cool, green-cast mid-century palette: sage ground, graphite ink, and four muted state hues that read as telemetry, not alarm.

### Primary
- **Teal** (`teal`, #1F7A78): the one accent. Live dot, the RUNNING station fill, the mark's diamond, the active nav underline, the Answer button, focus rings, the Desk's in-flight milestone token. The only hue used as a button background.
- **Teal Ink** (`teal-ink`, #0E4F4D): text on teal's behalf: links, the "live floor" label, RUNNING captions, Answer hover.

### Secondary (the three other state hues)
- **Mustard** (`mustard`, #D9A521) / **Mustard Ink** (`mustard-ink`, #7A5A06): VERIFYING, and attention rank medium (a Question). Fill for the VERIFYING station and chevron; ink for its caption, the Question kind label, the `warning` severity.
- **Olive** (`olive`, #6E7F3E) / **Olive Ink** (`olive-ink`, #415022): the landing run. PASSED, PR_OPEN, ENQUEUED, MERGED glyph strokes and fills, the milestone bar's done diamonds and fill, the `depends_on_merged` double rail, the landing line, the queue token, and the factory's RESOLVED ruling text.
- **Clay** (`clay`, #B9774F) / **Clay Ink** (`clay-ink`, #7A4A2B): WAITING_OPERATOR and attention rank high (an Escalation). Muted terracotta; it is the warmest hue in the system and it is never red. Fill for the WAITING_OPERATOR station, the paged ring, the Showfloor attention badge dot, the high-rank clock digits, the `critical` severity. In tokens.css these are named `--orange` / `--orange-ink`; keep those CSS names, the role is clay.

### Tertiary
- **Aqua** (`aqua`, #8FB8C9) / **Aqua Ink** (`aqua-ink`, #3E6C80): upstream, not yet live. PENDING (dashed) and KEY_ISSUED (hatched) glyph strokes, attention rank low (a Notice), the `info` severity.

### Neutral
- **Sage** (`ground`, #E3E8E0): the page ground, `<html>` background. Cool, green-cast; this is the brand commitment ("not cream, not beige").
- **Mist** (`panel`, #F4F6F1): panels, attention items, choice buttons, milestone diamonds at rest, station fills at rest, the halo around tokens.
- **Moss Grey** (`panel-deep`, #D2D9CE): wells and tracks: the milestone bar track, the degraded-state well, choice-button hover, the KILLED station fill.
- **Graphite** (`ink`, #23292A): body text, clock digits, the FAILED glyph, station strokes at rest, the `depends_on_merged` rail on non-merged routes.
- **Tinted Slate** (`ink-soft`, #5C6962): secondary text, table headers, micro labels, the dashed `depends_on` route, the KILLED glyph. It has a green cast; never substitute a neutral grey.
- **Hairline** (`rule`, #BDC7BA): 1px borders, dividers, table rules, milestone diamond strokes at rest.
- **Deep Moss** (`walnut`, #3E4A3C): h1/h2/h3 and the ERGANE mark. Despite the CSS name it is a deep moss, not brown.
- **White** (`white`, #FFFFFF): text on teal (Answer button) and the reply textarea background only.

### Named Rules
**The Never-Colour-Alone Rule.** Every hue that means something is doubled by a glyph and a caption (node states), a word (attention kind: Escalation / Question / Notice; severity: critical / warning / info), or a label (milestones). A reader with no colour perception loses nothing. Test: remove all `color`/`fill`/`background` declarations and every state must still be readable.

**The No-Red Rule.** Nothing in the pane is red. The highest-attention hue is clay (#B9774F) and the FAILED state is graphite (#23292A) with a cross glyph. Do not introduce a red, crimson, or "danger" token for any reason, including error states.

**The Ink-Pair Rule.** Each state hue is a pair: the base fills shapes (glyphs, stations, dots, tokens); the `-ink` tone colours text. Never set text in a base hue and never fill a shape with an ink tone (the one exception is the PENDING / KEY_ISSUED / PASSED outline glyphs, whose stroke is the ink or base as listed in the glyph table).

**The Attention Ranking Rule.** Attention items rank high / medium / low and each rank owns a hue: high = Escalation = clay, medium = Question = mustard, low = Notice = aqua. The rank is carried by the kind word in the item's `-ink` tone and by a 3px inset stripe on the item's left edge; a high item also takes a clay 1px border.

## Typography

**Display Font:** Red Hat Display (with "Avenir Next", "Segoe UI", system-ui, sans-serif)
**Body Font:** Red Hat Text (with "Avenir Next", "Segoe UI", system-ui, sans-serif)
**Label/Mono Font:** Red Hat Mono (with "SF Mono", ui-monospace, Menlo, Consolas, monospace)

**Character:** a geometric humanist family doing three jobs: Display for headings, captions, and buttons; Text for prose; Mono for every identifier, clock, count, and figure. The mono is what makes the pane read like the terminal beside it.

### Fonts policy (binding)
- **Self-host. Never load a remote stylesheet.** The comps (`.impeccable/mocks/tokens.css`) pull the three faces through a Google Fonts `@import`; that is a comp shortcut and it violates PRODUCT.md ("No CDN scripts or remote stylesheets"). Product code must not contain any `@import url(https://...)`, `<link rel="stylesheet" href="https://...">`, or `<link rel="preconnect">` to a font host.
- Ship Red Hat Display (weights 500, 600, 700), Red Hat Text (400, 500, and 400 italic), and Red Hat Mono (400, 500) as `.woff2` files under `web/public/fonts/`. The Red Hat fonts are licensed under the SIL Open Font License 1.1; include the OFL text beside the files.
- Declare them with `@font-face` in the global stylesheet with `font-display: swap`, using the family names exactly as above so the declared stacks resolve. If a face is unavailable in the build sandbox, the declared fallbacks (`"Avenir Next", "Segoe UI", system-ui, sans-serif` and `"SF Mono", ui-monospace, Menlo, Consolas, monospace`) must carry the page without layout change; never substitute a different web font.
- Body is antialiased (`-webkit-font-smoothing: antialiased`).

### Hierarchy
- **Clock** (Red Hat Mono 400, `clamp(1.9rem, 2.6vw, 2.6rem)`, line-height 1, letter-spacing -0.02em, `font-variant-numeric: tabular-nums`): the T-minus digits of an attention item, rendered `−HH:MM:SS`. A Notice's clock slot reads "no clock" at 1.25rem. A high-rank clock is clay-ink; others graphite.
- **Display** (Red Hat Display 600, 1.5rem, letter-spacing -0.01em, deep moss, `text-wrap: balance`): section heads ("Waiting on you", "The floor") and Showfloor epic names.
- **Headline** (Red Hat Display 600, 1.125rem, deep moss): lower Desk section heads (Health, Spend to date); the ERGANE mark is the same size at weight 700 with letter-spacing 0.02em.
- **Body** (Red Hat Text 400, 0.95rem, line-height 1.45, graphite): attention prose and notices; max measure 68ch.
- **Small** (Red Hat Text 400, 0.8125rem): tables, the "until" line, personas, metadata, the reply textarea.
- **Caption** (Red Hat Display 600, 0.8125rem, letter-spacing 0.02em): state chevron captions, the attention kind word, buttons, the nav (weight 500). On the Showfloor SVG the station caption is Red Hat Display 600 at 11px, uppercase, letter-spacing 0.04em.
- **Readout** (Red Hat Mono 400, `--fs-readout: 1.25rem`, tabular-nums, line-height 1): the three figures at the right of an epic timeline row and a Notice's "no clock" slot. The only step between Body and Display.
- **Micro** (Red Hat Text 500, 0.6875rem, letter-spacing 0.06em, uppercase, tinted slate): table headers, milestone labels, readout keys, "what each button does". On the Showfloor SVG the equivalent label is 10px.
- **Mono** (Red Hat Mono 400, 0.8125rem, tabular-nums): correlation ids, `esc:<12hex>:<CHOICE>` payloads, counts, node ids (12px weight 500 in the SVG), readout values (the **Readout** step, `--fs-readout: 1.25rem`), table figures, and any text the factory wrote verbatim (error strings).

### Named Rules
**The Factory Speaks in Mono Rule.** Anything the factory wrote or counted (ids, payloads, states in `UPPER_SNAKE`, figures, error messages, timestamps) is set in Red Hat Mono with tabular numerals. Prose the pane writes is Red Hat Text. Never the other way round.

**The Caption Case Rule.** State captions and micro labels are uppercase with tracking (0.02em to 0.08em). Prose is never uppercase and never tracked.

## Layout

Two rooms share one masthead: the ERGANE mark (teal rotated-square diamond, 0.55em, before the word), the Desk / Showfloor nav (active page has a 2px teal underline), and a right-aligned floor line (live dot, host, count of running epics, last read time). Masthead padding is `1rem 2rem 0.75rem` with a 1px hairline beneath; on the Showfloor it is sticky at the top on the sage ground.

**Desk.** A single column, max-width 1280px, centred, horizontal padding 2rem, bottom padding 3rem. Order is fixed: the attention strip (padding `1.5rem 0 1rem`, hairline beneath), then the floor (one timeline row per running epic), then a degraded well if any epic refused its query, then a two-column lower band (Health | Spend) with a 2rem gap. An attention item is a three-column grid `250px 1fr auto` with a 1.5rem gap; an epic row is `250px 1fr 300px`, 1rem vertical padding, hairline above (and below the last). The milestone bar is 56px tall; its track is 4px. Readouts right-align in three columns. Node chevrons wrap beneath the row in a flex line with a `0.5rem 1rem` gap.

**Showfloor.** A stage with padding `1.5rem 2rem 3rem` and a 2rem gap between routes. Each route is a grid `220px 1fr` (epic name and a meta paragraph on the left, the map on the right) with a hairline above. The map is an SVG of min-width 1040px inside a horizontally scrolling wrapper; stations sit 160px apart on a row, 140px between rows, the landing line lives at x=930 with its four stations 64px apart, and a same-rank pair stacks in one column joined by a vertical rail. Station squares are 40px (16px on the landing line) with `skewX(-12deg)`.

**Rhythm.** The spacing scale is `0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 3rem`. Dividers are hairlines, not whitespace; density is high and intentional.

**Responsive.** One breakpoint at `max-width: 900px`: the masthead wraps and its floor line drops to a full-width second line; Desk padding tightens to `0 1rem 2rem`; attention items and epic rows collapse to one column; readouts left-align; the milestone bar gains 32px side margins and hides its labels (the diamonds remain); the lower band stacks; the Showfloor route grid stacks and the map scrolls horizontally.

## Elevation & Depth

Flat tonal layering. Depth is carried by three neutral steps (sage ground, mist panel, moss-grey well) and 1px hairlines; nothing floats. The system has exactly one shadow token and the comps apply it to nothing at rest; it is reserved for a pressable element that needs lift. Tokens on the milestone bar and landing line get a 3px or 4px halo in the panel colour (`box-shadow: 0 0 0 4px` / SVG `stroke-width: 3`) so they read above the track: that is a cut-out, not a shadow.

### Shadow Vocabulary
- **Press** (`box-shadow: 0 2px 6px rgba(42, 42, 38, 0.12), 0 10px 24px -12px rgba(42, 42, 38, 0.18)`): the only shadow; permitted on a pressable control only (the Answer button at rest or on hover). Never on panels, items, tables, or maps.

### Named Rules
**The One-Shadow Rule.** Surfaces are flat. The single shadow token exists for the one thing you can press; if a surface cannot be pressed, it cannot carry a shadow.

**The Well Rule.** A state that needs to stand apart without alarm (a refused query, a degraded seam) sits in a moss-grey well (`panel-deep`, 3px radius, padding `0.75rem 1rem`) with a bold Display lead-in, in words. No icon, no hue.

## Shapes

Tight mid-century geometry. Corners are 3px everywhere (panels, items, buttons, wells, textarea); the only pill is the chip radius (999px), reserved for chips if any are introduced (none exist in the comps). The signature silhouette is the skewed square: stations are squares under `skewX(-12deg)`, chevron glyphs are squares under `skewX(-20deg)`, and milestone markers are 12px squares rotated 45deg into diamonds (the same diamond is the mark). Borders are 1px hairlines (`rule`) on panels and 1.5px graphite on buttons. Tracks and rails are rounded to 2px. The WAITING_OPERATOR glyph is the one organic shape, a bell (`border-radius: 50% 50% 2px 2px`), because it is the one state that pages a human.

## Components

### Buttons (Desk only; the Showfloor has none)
Character: compact, type-led, one accent.
- **Shape:** tight corners (3px), 1.5px border, padding `0.5em 0.9em`, Red Hat Display 600 at 0.8125rem.
- **Answer (primary):** teal (#1F7A78) fill, teal-ink border, white text. Hover: teal-ink fill. Used for the Answer submit and for the first escalation choice.
- **Choice (secondary):** mist fill, graphite 1.5px border, graphite text, left-aligned. Hover: moss-grey fill and `translateY(-1px)` over `0.18s cubic-bezier(0.16, 1, 0.3, 1)`. The `esc:<12hex>:<CHOICE>` payload sits under the label as a block in Red Hat Mono 400 at 0.6875rem, tinted slate (white at 80% on the Answer variant).
- **Focus:** `outline: 2px solid #1F7A78; outline-offset: 2px`. Always visible on keyboard focus; Answer is keyboard-reachable.
- **Disabled:** opacity 0.45, `cursor: not-allowed`, no transform.

### Inputs / Fields
- **Reply textarea:** white fill, 1.5px hairline border, 3px radius, padding `0.5rem 0.75rem`, Red Hat Text at 0.8125rem, min-height 4.5em, resize vertical. Placeholder says what happens: "Reply to the node. Sent as your identity; the factory rules on it."
- **Focus:** border turns teal and a 2px teal outline at 1px offset appears.
- **Error:** none; the factory's ruling is rendered as text in the item, not as a field error.

### Navigation
- **Masthead:** the mark, then Desk / Showfloor in Red Hat Display 500, tinted slate, no underline; the current room is graphite with a 2px teal bottom border. The floor line on the right is 0.8125rem tinted slate with the live dot (0.5em teal circle, breathing). On the Showfloor an attention badge ("2 waiting on you → Desk") sits at the far right in clay-ink with a clay bell dot; it is a link, the Showfloor's only one.
- **Mobile:** the masthead wraps; the floor line takes a full-width line beneath.

### Attention Item (signature)
Character: a clock with its answer beside it.
- **Container:** mist panel, 1px hairline, 3px radius, padding `1rem 1.5rem`, grid `250px 1fr auto`.
- **Rank stripe:** `box-shadow: inset 3px 0 0 <rank hue>` on the left edge. High (Escalation) = clay and the border itself turns clay; medium (Question) = mustard; low (Notice) = aqua. The kind word in the clock column repeats the rank in the matching ink tone.
- **Clock column:** kind word (Caption), the T-minus clock (Clock), then the "until" line (Small, tinted slate) stating the absolute expiry and the consequence ("until 12:45:43Z · then KILL the node").
- **Body column:** a mono "where" line (epic / story · attempt · correlation id), prose, and for an Escalation a micro label "What each button does" followed by one sentence per choice. The factory's ruling on the last answer lands here as Small olive-ink 500 text ("Your last answer on 8d1e… was RESOLVED — waiting workflow signalled."); refusals (UNKNOWN, ALREADY_RESOLVED, EXPIRED, UNAUTHORIZED, SIGNAL_FAILED) render the same way in the same place.
- **Answer column:** min-width 220px. Escalation: a stack of choice buttons, the first as Answer-primary. Question: the reply textarea and one Answer button. Notice: italic tinted-slate text "Asks for nothing; no answer exists." and no control.
- **Countdown anchor rule:** the clock counts down to the factory-written `expires_at` and nothing else. Never derive an expiry from the pane's own clock or from "received at". Ticking is a text update (`aria-live="polite"`), not an animation, so it is unaffected by `prefers-reduced-motion`.

### Epic Timeline Row and the Milestone Bar (signature)
Character: every epic reads the same way.
- **Row:** grid `250px 1fr 300px`; left column is the epic name (Display 600 at body size) over the epic id and state in mono micro, then the persona line; the middle is the bar; the right is three readouts (mono 1.25rem value over a micro key): stories left, attempts on the tracked story, spend to date.
- **Bar:** 56px tall. A 4px moss-grey track with an olive fill from the left. Five milestones at 0% / 34% / 56% / 78% / 100%: dispatch, PASSED, PR_OPEN, ENQUEUED, MERGED, each a 12px diamond (mist fill, 2px hairline stroke; done = olive fill and stroke, label olive-ink) under a micro label.
- **Milestone bar rule:** the bar tracks the furthest-behind open story: the fill and the primary token sit where the least-advanced not-yet-merged story is, so the bar can only read "done" when every story is. Other open stories may place additional tokens. (The comps label one row "furthest-along"; that is a comp inconsistency and not the rule.)
- **Token:** a 16px circle with a 4px mist halo; teal for a story in flight, mustard (`.verifying`) for VERIFYING, clay (`.waiting`) for one waiting on the operator or paged. Beneath it a mono micro chip on mist names the story and why it is there ("us4 · paged", "us2 · queued 4m").
- **Node line:** beneath the row, every story as a state chevron + mono story id.
- **Quiet floor:** when nothing runs, a hairline-bounded italic line in tinted slate says so; never a blank.

### State Chevrons and Stations: the eleven-state glyph grammar (signature)
One glyph family carries node state in both rooms. On the Desk it is a 0.95em inline glyph (`.chev i`) beside an uppercase Red Hat Display 600 caption at 0.8125rem; on the Showfloor it is a 40px SVG station (`skewX(-12deg)`, 2px stroke) with the story id in mono above and an uppercase 11px caption below. Base shape is a square skewed -20deg (Desk) / -12deg (Showfloor). Caption colour is always the state's ink tone.

| State | Glyph (fill / stroke) | Caption |
|---|---|---|
| PENDING | empty; 2px dashed aqua-ink outline (Desk: 2px inset aqua-ink, 1px radius) | pending |
| KEY_ISSUED | diagonal 45deg hatch in aqua-ink on mist (Desk: `repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)`) | key issued |
| RUNNING | solid teal fill, teal-ink stroke; glows (see Motion) | running |
| VERIFYING | solid mustard fill, mustard-ink stroke | verifying |
| VERIFYING + paged | VERIFYING glyph plus a dashed clay ring 8px outside it (Desk: `outline: 2px solid clay; outline-offset: 2px` and the word "paged" appended in clay-ink micro) | verifying · paged |
| PASSED | empty; 2px olive outline | passed |
| PR_OPEN | left half olive, right half mist; 2px olive outline | pr open |
| ENQUEUED | 78% olive from the left, rest mist; 2px olive outline | enqueued |
| MERGED | solid olive fill, olive-ink stroke | merged |
| FAILED | mist fill with a graphite 2px X across it; graphite stroke | failed |
| KILLED | moss-grey fill, tinted-slate stroke (Desk: tinted slate at 50% opacity and the caption struck through) | killed |
| WAITING_OPERATOR | solid clay fill, clay-ink stroke; on the Desk the glyph is a clay bell (`border-radius: 50% 50% 2px 2px`) | waiting on you |

Rules: the paged-while-verifying case keeps the VERIFYING state and adds the ring and the word; it is never rendered as WAITING_OPERATOR. A supplementary micro line under a Showfloor caption carries the detail ("attempt 3 of 6", "question · 6h 58m", "attempt 1 · 12m"). Captions are lowercase in the source and uppercased by CSS.

### Route Map and Landing Line (Showfloor signature)
- **Edge kinds, drawn distinctly:** `depends_on_merged` (unlocks on merge) is a solid double rail: a 4px stroke (graphite, or olive once the upstream story is merged) with a 1.5px sage stroke drawn over it to split it in two. `depends_on` (unlocks on verification) is a single 1.5px tinted-slate stroke with `stroke-dasharray: 4 5`. A legend naming both is drawn once per map in 10px micro.
- **Same rank:** stories of equal rank share one column, stacked 140px apart and joined by a vertical rail, labelled "same rank" in micro.
- **Landing line:** one olive 3px vertical line at the right edge of every map (with a 1px sage centre stroke), labelled "landing line", with four 16px stations bottom to top: PASSED, PR_OPEN, ENQUEUED, MERGED (MERGED shows a count, "MERGED ×3"). A story on the landing run is a 7px-radius token (teal; olive `.queue` once ENQUEUED) with a 3px mist stroke, placed between the stations it is between, labelled in micro with the story id and its situation ("us4 · held", "ENQUEUED · 4M"). A story short of the line is drawn at the end of its route with a hairline connector.
- **Refused query:** an epic the orchestrator will not describe is a route with no stations and an italic quiet line saying so. A quiet floor says so in the same voice.
- **No controls:** nothing on the Showfloor is a button, form, or input. The attention badge in the masthead is the one link.

### Tables (Health, Spend)
Collapsed borders, full width, Small size. Headers are micro (uppercase, tracked, tinted slate, weight 500) over a hairline; cells have `0.5rem 0.75rem 0.5rem 0` padding and a hairline beneath; numeric columns are right-aligned mono with no right padding. Severity is a Caption-weight micro word: critical = clay-ink, warning = mustard-ink, info = aqua-ink. Reference paths under a finding are mono micro in tinted slate.

**The Unknown Rule.** A NULL from the factory's rollup is rendered as the word "unknown" in Red Hat Text italic, tinted slate, at Small size, in the cell or readout where a figure would go. A total is unknown when any row in scope is unknown. Never print 0, a dash, or an empty cell for a NULL, and never style it as an error.

### Motion
Three authored motions and no others. All use the one easing, `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Live dot breathe** (masthead live dot, and the RUNNING chevron on the Desk): `scale(1) → scale(0.6)` with opacity `1 → 0.55`, 2.4s, infinite.
- **RUNNING station glow** (Showfloor): opacity `1 → 0.55 → 1`, 2.4s, infinite.
- **Landing-line token travel** (Showfloor): the queue token translates up the line by one station (`translateY(-90px)`), 6s, infinite, holding at each end.
- **Button hover:** `transform 0.18s` and `background 0.18s` on buttons (a transition, not an animation).

**The Reduced-Motion Rule.** Under `prefers-reduced-motion: reduce` all three animations are off: the live dot and RUNNING glyph render solid at rest, the token sits still at its current station. Author the Showfloor motions inside `@media (prefers-reduced-motion: no-preference)` and the Desk breathe with an explicit `animation: none` override. State is never carried by motion alone, so nothing is lost.

## Do's and Don'ts

### Do:
- **Do** put the page on sage (#E3E8E0) with mist panels (#F4F6F1) and moss-grey wells (#D2D9CE); every neutral has a green cast.
- **Do** double every state hue with a glyph and a caption, and every attention hue with the kind word; audit by stripping colour.
- **Do** keep teal (#1F7A78) the only button colour and the only focus ring (2px, 2px offset).
- **Do** set every factory-written value (ids, payloads, figures, states, error strings, clocks) in Red Hat Mono with tabular numerals.
- **Do** render NULL as the italic word "unknown" and propagate it to totals.
- **Do** anchor every countdown on the factory's `expires_at` and print the absolute expiry and its consequence beneath the clock.
- **Do** draw `depends_on_merged` as a solid double rail and `depends_on` as a 1.5px dashed (4 5) route, with a legend once per map.
- **Do** say degraded states in words inside a moss-grey well ("One epic refused its query. … Shown as unavailable, not hidden.").
- **Do** self-host Red Hat Display, Text, and Mono as woff2 under `web/public/fonts/` with `@font-face` and the declared fallback stacks.
- **Do** gate the three animations behind `prefers-reduced-motion` and leave the clock as a text update.
- **Do** use the pane's own words: Pane, Showfloor, Desk, Floor, Answer, Attention item, Notice, Fixture floor, quiet floor.

### Don't:
- **Don't** use a cream, beige, ivory, or warm-paper ground; the ground is sage and the panels are green-cast near-white.
- **Don't** use red, crimson, or any "danger" hue anywhere; the hottest colour is clay (#B9774F) and FAILED is graphite with an X.
- **Don't** lay out a grid of metric cards; the Desk opens on clocks and reads epics as timeline rows.
- **Don't** put a coloured `border-left` wider than 1px on any element except the attention item's 3px inset rank stripe.
- **Don't** use gradient text, `backdrop-filter` blur, glass panels, or neon-on-black; the pane is flat and light.
- **Don't** add a shadow to anything that cannot be pressed.
- **Don't** load a remote stylesheet, font, script, or icon set; the sandbox has no network and the product forbids CDNs.
- **Don't** carry state by colour alone, by motion alone, or by icon without a caption.
- **Don't** print 0, a dash, or an empty cell for a NULL, and never fabricate a zero total.
- **Don't** collapse the paged-while-verifying case into WAITING_OPERATOR; it stays VERIFYING with a clay ring and the word "paged".
- **Don't** put a button, form, input, or any non-link control on the Showfloor, or any non-GET request on the Desk other than Answer.
- **Don't** use the words dashboard, console, app, board, action, mutation, or resolve anywhere in the interface copy; the one verb is Answer and the factory's rulings (RESOLVED, UNKNOWN, ALREADY_RESOLVED, EXPIRED, UNAUTHORIZED, SIGNAL_FAILED) are quoted verbatim in mono.
- **Don't** use a neutral grey for secondary text or a brown for headings; `ink-soft` (#5C6962) and `walnut` (#3E4A3C) are both moss-tinted.
