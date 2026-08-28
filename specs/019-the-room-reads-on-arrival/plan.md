# Implementation Plan: The room reads on arrival

**Spec**: `specs/019-the-room-reads-on-arrival/spec.md` · **Landing branch**: `dev`
**Authority**: constitution III and V; D-016 (the detail track is a story's track);
D-019 (the goal band, and "treated as prose"). **No `DESIGN.md` amendment and no
decision entry.** Nothing here changes a token, a grid, a face or the ladder — the
room is already the approved comp, and every story below changes what *arrives* in
it.

## The shape

Three stories, and the split is chosen so that two of them can be built at the
same time.

- **US1 is backend-only.** The whole defect is in `pane/showfloor.py`'s paragraph
  reader, and the fix belongs there rather than in `Stage.tsx`: `SpecGoal` renders
  `{intent}` and should go on rendering exactly what it is handed. Its proof is a
  pytest over the reader. **It touches no file under `web/`.**
- **US2 is web-only.** The selection is `Showfloor.tsx` state. Its proof is a
  vitest over the default-selection function plus a smoke assertion that the
  arriving room has a filled pane. **It touches no file under `pane/`.**
- **US3 touches both**, which is why it waits for both.

## Decisions

- **D1 — US1 and US2 share no file, so they dispatch together.** Both carry
  empty `depends_on` and empty `depends_on_merged`. `ergane.yaml`'s note on
  `max_concurrent_epics` is about two *epics* colliding in the merge queue; two
  stories of one epic that touch disjoint package worlds are the case that note
  explicitly leaves open ("raise this again only for epics that share no
  package"). If either story is later widened to touch the other's world, the
  graph is wrong and must be chained — see Named traps.

- **D2 — US3 waits on `depends_on_merged`, not `depends_on`.** It edits
  `pane/showfloor.py` (US1's file) and the web room (US2's world), and every node
  branches from `dev` at dispatch. Merged, not merely finished, is the only
  ordering that hands it a tree with both changes in it.

- **D3 — the label guard becomes a shape, not a prefix.** Today any line starting
  with `**` ends the paragraph. Replace the prefix test with a match on the label
  *shape* — `**…**` followed by a colon — which is what every Spec Kit label
  actually is (`**Why this priority**:`, `**Feature Branch**:`). A wrapped bold
  phrase mid-paragraph does not match it, which is the entire bug.

- **D4 — strip marks, do not render Markdown.** FR-003 removes `**`, `*`, `` ` ``
  and `_` pairs and keeps the words. It does **not** produce HTML, does not
  linkify, and does not introduce a Markdown dependency (constitution VII —
  nothing new goes on the roster for this). D-019 said "never a Markdown render",
  and this honours it: rendering would make the band a document, stripping makes
  it the sentence D-019 asked for.

- **D5 — the default story is derived, never remembered.** US2's FR-008 is a
  *derivation* keyed on the selected spec, not a stored last-pick. A remembered
  selection is how a room shows a story of a spec that is no longer on stage.

- **D6 — US2's rule is the rail's rule, one level down.** `defaultSelection` in
  `Showfloor.tsx` already resolves "building, else newest landed, else first" for
  the rail. The story rule is the same sentence about stories, and it belongs
  beside it, exported and unit-tested the same way — not inlined into the
  component where no test can reach it.

- **D7 — US3 establishes its seam coverage before it fills anything.** Its first
  task is to write down which of the six stops the approved seams record an
  instant for. FR-012 then makes the remainder an answer on screen (`—`) and in
  the spec (named), which is constitution III applied to a column rather than to
  a read.

## Named traps

- **Do not turn the story selection into a route.** 005 US4 decided this and
  D-016 rests on it: a spec is a place, a story is a reading. A second path
  segment makes the back button walk an operator's every glance. FR-010 is not a
  formality.

- **Do not make the track permanent.** US2 fills the pane on arrival; it must not
  delete the collapse. A spec with no stories still collapses to `0` (FR-009), and
  a build that pins the track open has replaced D-016 rather than served it.

- **Do not widen US1 into `web/`.** If US1's node finds itself editing
  `Stage.tsx`, the concurrency in D1 is void and it has almost certainly put the
  strip in the wrong layer. The band renders what it is handed.

- **Do not widen US2 into `pane/`.** Same trap, the other direction. Everything
  US2 needs is already in the showfloor document.

- **Do not invent an instant.** US3's easiest wrong answer is deriving `pr open`
  from the merge time, or `building` from the attempt's end minus its duration.
  FR-014 forbids it: a stop shows its own seam's value or it shows `—`.

- **Do not touch the fixtures.** Constitution V, and 016's plan says it in as many
  words: a node regenerating a recording from its own branch is inventing one. If
  a story appears to need a fresher fixture to pass, the story is wrong — say so
  rather than re-record.

## Gates

The five in `ergane.yaml`, unchanged. US1 adds pytest cases and moves backend
coverage; US2 adds vitest cases and a smoke assertion. Both coverage floors are
committed (`pyproject.toml`, `web/vitest.config.ts`) and neither should need
moving — if one does, that is a signal the story grew past its own world.
