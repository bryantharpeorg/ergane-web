# Implementation Plan: A spec reads its record

**Spec**: `specs/020-a-spec-reads-its-record/spec.md` · **Landing branch**: `dev`
**Authority**: constitution II (borrowed seams), III (honest degradation), IV
(provable claims), V (recorded fixtures), VI (one token), VIII (built to
`DESIGN.md`); D-020 (the verify store's readers are approved); D-027 (this room's
visual authority). `DESIGN.md` § The record room in this world is amended in the
same pull request as this trio and before any story builds to it.

## The shape

Five stories, **2 → 1 → 2**. Two independent derivations, one assembly that needs
both, two surfaces that need the assembly and not each other.

```
US1 ─┐
     ├─→ US3 ─┬─→ US4
US2 ─┘        └─→ US5
```

The shape is not decoration. US3's whole substance is the join — it is the first
place a story present in the work graph but absent from the evidence store has to
be reconciled (FR-014), and neither US1 nor US2 can discover that alone. US4 and
US5 answer two different questions about the same document (does it read, and can
the demo floor carry it) and touch disjoint trees.

**Every spec this repository has dispatched was a straight line.** 001–015 are
chains; 019 is three isolated nodes. This is the first graph with a join in it,
which means the stage draws a shape it has never drawn, and the drafting table at
`/draft/020-a-spec-reads-its-record` is where to look at it **before** flipping
`ready` — 014 US3 stages the compiled graph through the same `ranksOf`/`edgesOf`
the Showfloor uses. Longest-path ranking puts this at three columns of 2 / 1 / 2.

## Decisions

- **D1 — the concurrent pairs are file-disjoint by construction, and here are the
  paths.** `max_concurrent_nodes` is 2, so US1‖US2 and US4‖US5 really do run at
  once, and N38 presents in the merge queue rather than in the pull request.

  | | writes | never touches |
  |---|---|---|
  | US1 | `pane/build_record.py`, `tests/test_build_record.py` | anything US2 writes |
  | US2 | `pane/pace.py`, `tests/test_pace.py` | anything US1 writes |
  | US4 | `web/src/record/**`, `web/src/routes.ts`, `route-manifest.json`, `web/tests/**` | `scripts/`, `fixtures/`, `pane/` |
  | US5 | `scripts/record-fixtures.py`, `fixtures/README.md`, `tests/test_record_fixtures.py` | `web/**` |

  US1 and US2 are **new files only**. Neither registers itself anywhere; US3 does
  all the wiring, which is what keeps them apart. A story that finds itself
  needing to edit `pane/readers.py` has drifted out of its slice — stop and say
  so rather than take the edit.

- **D2 — the two derivations own no I/O.** `build_record` takes the list of
  documents `Reader.node_history` returns; `pace` takes landing facts and
  `attempt_timings` rows. Both are pure functions over plain documents. This is
  what makes them independently testable with no fixture floor, no store and no
  network, and it is why they can be built concurrently at all.

- **D3 — `attempt_timings` is the epic-wide read and US3 owns adding it.** D-020
  approved it; nothing has called it. It answers six columns across a whole epic
  in one call, where `node_history` answers one node — so the assembly makes one
  call rather than one per story. Adding it to the `Reader` protocol,
  `LiveReader`, `FixtureFloor` and `UnconfiguredReader` is one coherent edit and
  belongs to the join, not to either leaf.

- **D4 — the room states its own reach, on 013's precedent.** 013 FR-008 made the
  gate-run section say its record is current-only. This room shows more of the
  same record over a whole spec, so the same statement is load-bearing in more
  places: FR-015 puts it on the document rather than in a component, so every
  surface that renders the document inherits it and no future room can drop it by
  forgetting.

- **D5 — unknown is a value, not an absence.** FR-005, FR-009 and FR-017 are one
  rule applied three times. The failure mode this repository has already shipped
  once — 007's own body names it, six lit stops beside six dashes — is a room that
  renders a gap as a fact. Every cell the facts cannot fill carries the word.

- **D6 — the door is part of the room.** 018 landed because 014 shipped a room
  reachable only by typing a URL from memory, which is a keyboard shortcut and not
  a room. FR-020 puts the door in US4 rather than deferring it, so this spec cannot
  repeat that.

- **D7 — US5 writes the recorder, and the operator runs it.** A dispatched node
  has a factory-owned `HOME` and cannot reach the operator's runtime root, so it
  cannot record a fixture from a live floor. What a node *can* do is add the verb
  to `scripts/record-fixtures.py` and prove it against a controlled input. The
  recording itself is an operator act afterwards, exactly as the 016 landing
  recording was. FR-023 is what keeps the room honest in the interval.

## Named traps

- **N38 — concurrent stories that share a file fail in the merge queue.** D1 is
  the mitigation and it is the only one. The boundary gate tests the branch; the
  queue tests the merge (N48), so a pair that collides passes every check a node
  can see and then fails where a node cannot.

- **A re-dispatch overwrites the evidence this room renders (N28).** Not a bug in
  this spec — it is the reason FR-015 exists. Do not build a cache, a snapshot or
  an archive to work around it: constitution I forbids the pane writing outside
  `specs/`, and the durable store is ergane PR-1.

- **`node_history` returns nothing for a story built before the current
  dispatch**, and that is indistinguishable from a story that never ran, from the
  pane's side. FR-014 and FR-003 are the two halves of saying so rather than
  guessing.

- **The persona/model trap is a correctness trap, not a cosmetic one (PR-2).** The
  debugger rung relabels the persona without re-resolving the model, so the
  registry and the attempt disagree and only the expired Temporal payload knows
  which is right. FR-005 forbids the guess for that reason and not for tidiness.

- **Layout laws are measured, not asserted (011).** FR-018's three widths in two
  themes are a measurement the smoke gate takes, and the review room already owns
  the machinery — reuse `web/src/review/laws.ts` rather than writing a second
  thing that decides what a violation is.

- **The credential sweep anchors on a word boundary** (`fixtures/README.md`'s
  sweep note). US5 records real store output; a sweep that misses is a credential
  in a committed fixture, which is constitution VI's one unrecoverable failure.

## Gates

All five, unchanged: `test`, `typecheck`, `unit`, `smoke`, `audit`. US1 and US2
move backend coverage, so both must land above `[tool.coverage.report]
fail_under`; US4 moves `web/src` coverage against
`test.coverage.thresholds.lines` in `web/vitest.config.ts`. Neither floor is
raised by this spec (015's ratchet is still the operator's).
