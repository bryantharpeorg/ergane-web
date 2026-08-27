# Implementation Plan: Every spec has a door

**Spec**: `specs/018-every-spec-has-a-door/spec.md` · **Landing branch**: `dev`
**Authority**: constitution II (seams), III (honest degradation), VI (the token),
VIII (`DESIGN.md`); D-025 for the seam ratification and the face.
`DESIGN.md` § The drafting table already carries this room's two new rules — the
index's face and the `deferred` chip — so **no `DESIGN.md` amendment is part of
this story**. A node that finds itself editing `DESIGN.md` has left its lane.

## The shape

One story. It is a read, a route, a table and a nav entry, and splitting a table
from the route that feeds it would produce two diffs neither of which does
anything.

## Decisions

- **D1 — the index is a second read, not a widening of `read_draft`.**
  `pane/draft.py` answers "what does `specs/<dir>/` hold". The index answers "what
  does the corpus hold". They share a room and nothing else. Put the corpus read
  in its own module with its own document, the way `pane/showfloor.py` and
  `pane/review.py` each own theirs, and leave `read_draft`'s signature alone.

- **D2 — `read_roadmap` owns the grammar, and this repository parses nothing.**
  `factory.roadmap.models.read_roadmap` returns the entries in sorted order with
  each declared state, defaulting a spec with no frontmatter to `draft`. Take its
  order. Take its states. Do not sort, do not default, do not open a `spec.md`.
  `pane/showfloor.py:641-659` is the shape to copy, including its `RoadmapError`
  handling — a corpus that will not parse is a named degraded entry, not an
  exception reaching the route.

- **D3 — reuse 014's read stamp; do not write a second one.** The revision and
  read instant already come from `pane/draft.py` through
  `factory.workgraph.worktree._git`, and its Unknown Rule ruling — a directory
  that is not a repository yields `unknown`, not `degraded` — is a decision this
  story inherits rather than re-takes. Two stamps that disagreed about what a
  non-repository means is a defect waiting for the first constructed corpus.

- **D4 — a declared state wears a chip, never a glyph.** `DESIGN.md` § The
  drafting table, as amended by D-025: intent is declared, progress is observed,
  and the eleven-state glyph grammar describes only the second. All four of
  `draft`, `ready`, `deferred` and `landed` have chips in the vocabulary; use
  them and add none.

- **D5 — the row is the link.** No "open" button, no chevron affordance, no
  separate control column. The drafting-table link is the row itself; a `landed`
  row carries one additional, explicitly labelled link to its review room
  (FR-010). Both go through the helpers `web/src/routes.ts` already exports —
  `draftPathFor` and `reviewPathFor` — never through a second spelling of the
  path, because a room that linked to a hand-built URL is how the two grammars
  start to disagree.

- **D6 — the Masthead grows by exactly one entry.** The drafting table gets a nav
  item and is current for any path under `/draft`, with or without a spec named,
  on the pattern `isShowfloorPath` already sets. The review room does not: it has
  no bare form, so its door is a row in this index.

## Named traps

- **Do not compute readiness.** The index shows what each spec *declares*. Whether
  it could dispatch is `ergane spec validate`'s answer, it has no library form,
  and composing one here is what D-022 forbade by name. No "blocked" badge, no
  edge resolution, no parked count.

- **Do not render an empty corpus as a failed read, or a failed read as an empty
  corpus.** They are two different facts and FR-005 wants both spellings. An empty
  corpus says so in words and produces no degraded entry; an unreadable one names
  the seam and what could not be learned.

- **Do not offer the review room for a spec that is not `landed`.** That room
  refuses an epic the landing branch does not carry whole, with a 409. Offering it
  on a `draft` row is offering a refusal, which is worse than offering nothing.

- **Do not touch `read_draft`, `pane/checks.py`, or the trio view.** 014 is landed
  and attested. This story adds a door to its room; it does not walk inside.

- **`route-manifest.json` is not optional and is not review's job.**
  `tests/test_route_manifest.py` and `web/tests/unit/routeManifest.test.ts` fail on
  a route or a source pattern that is missing. Add the new API route, and add the
  new modules' patterns, in this same diff.

## Gates

The five in `ergane.yaml`, unchanged. `unit` and `test` both carry coverage floors
that this story's new modules must not drag under; a new module with no tests is
how a floor gets crossed by a diff that looked additive.
