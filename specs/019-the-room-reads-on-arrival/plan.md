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
- **US3 is backend-only too.** `stop.at` is already in the document contract and
  `DetailPane.stepsOf` already renders it with a `—` fallback; every stop but
  `merged` is `null` because nothing fills it. So US3 fills a field the room
  reads today. Its proof is a pytest over the filled ladder. **It touches no
  file under `web/`.**

All three carry empty `depends_on` and empty `depends_on_merged`, so the epic
dispatches as three concurrent nodes and lands in whatever order the queue
takes them.

## Decisions

- **D1 — all three stories dispatch together.** US2 shares nothing with either
  of the others: it is the only story under `web/`. US1 and US3 share the
  *file* `pane/showfloor.py` and nothing else — US1 rewrites `_intent_after`'s
  paragraph guard, US3 fills `stop.at` inside the `derive_ladder` family. No
  symbol, no signature and no protocol is common to the two, so a rebase in the
  merge queue merges two disjoint hunks.

  **This is a deliberate departure from `CLAUDE.md`'s "prefer
  `depends_on_merged` when stories share files", and the reason it is safe here
  is the reason that rule exists.** The collision it was written for is 002 ∥
  003, recorded in `ergane.yaml`: 003 changed a reader protocol and added four
  required `Settings` fields, and 002's tests had been written against the old
  signatures. Nothing conflicted textually; two tests died semantically. A
  paragraph reader and a ladder assembler cannot do that to each other. If
  either node finds itself changing a signature the other could be reading, the
  graph is wrong — stop and say so rather than pressing on (see Named traps).

- **D2 — the risk that remains is the gate, not the diff.** Three nodes run the
  five gates at once. `gates/smoke-webserver-ports-collide-across-concurrent-nodes`
  is **resolved**, which is precisely this case; the still-open
  `gates/concurrent-epics-collide-on-a-fixed-gate-port` is about leaked
  webServer children across *epics*. If a smoke gate dies on a bound port
  rather than on an assertion, that finding is the first place to look and the
  failure is not the story's.

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

- **Do not widen US3 into `web/`.** `stop.at` is already rendered with a `—`
  fallback. A node editing `DetailPane.tsx` has either missed that or is
  changing how the column looks, which is D-019's business and not this
  story's.

- **US1 and US3: stay inside your own function.** The two run at the same time
  in one file. Neither may reorganise imports, rename a shared constant, or
  refactor scaffolding either could touch. A tidy-up that is free in a serial
  build is a merge conflict in a concurrent one.

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
