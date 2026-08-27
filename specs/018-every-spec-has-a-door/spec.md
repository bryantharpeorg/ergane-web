---
state: ready
depends_on_landed: [014-a-draft-shows-what-will-run]
# Carved out of 010 on 2026-08-26 by D-025, on the same reasoning D-022 used when
# it carved 014 out of 010: what is left of the grooming room after the writes are
# removed is worth building on its own, and it is buildable now.
#
# NOTHING GATES THIS SPEC. It reads one seam this repository already imports, it
# writes nothing, it needs no ergane capability that does not exist, and it does
# not wait on the `ergane-cli` pin bump 010 waits on. `depends_on_landed` names
# 014 because this is 014's room and its bare route; 014 is landed.
#
# WHAT IT FIXES IS A LIVE DEFECT IN A LANDED ROOM. Measured 2026-08-26:
# `grep -rn "draftPathFor" web/src --include=*.tsx` returns nothing. No room in
# the pane links to the drafting table. 014 shipped `/draft/<spec-dir>` and left
# bare `/draft` naming no room, deliberately -- "a drafting table with no spec is
# a table with nothing on it" (`web/src/routes.ts`). That was right about a table
# and wrong about a door: the room is reachable today only by an operator who
# types a URL from memory, which is not a room, it is a keyboard shortcut.
---

# Feature Specification: Every spec has a door

**Feature Branch**: `018-every-spec-has-a-door`
**Created**: 2026-08-26 · **Status**: Refined
**Input**: D-025, § The corpus index is carved out as 018

## Context

The pane has four rooms. Three of them are on the Masthead. The fourth —
014's drafting table, landed 2026-08-26 — is on nothing.

That is not a cosmetic gap. The drafting table is the room where the operator
reads a spec's trio, sees what each of ergane's checkers says about it, and looks
at the graph the factory would run. It is the room a spec is *reviewed* in. A
room nobody can find is a room nobody reviews in, and the corpus it serves has
seventeen directories in it.

There is also nothing that answers the question the operator actually asks first,
which is not "show me spec 014" but **"what is in the corpus, and what state is
each one in"**. Today that is `ergane spec list` in a terminal, and the pane —
which is looking at the same tree, behind the same token, with the same reader
already imported — has no answer.

**One seam already supplies both.** `factory.roadmap.models.read_roadmap` returns
every spec directory in sorted order with its declared state, and this repository
already imports it: `pane/showfloor.py:647` uses it for the epic rail's order and
state. It owns the frontmatter grammar, the sort, and the `state` default for a
spec with no frontmatter at all — so nothing here parses any of that. D-025
ratifies it into constitution II's approved list, where it should have been since
the Showfloor took it.

## User Scenarios & Testing

### User Story 1 - The corpus opens on one page, and every spec has a door (Priority: P1)

As an operator, I open `/draft` and see every spec in the corpus with its declared
state, and one click takes me to any of their drafting tables.

**Why this priority**: it is the whole spec. There is no second half to defer, and
the room it makes reachable is already built and already landed.

**Acceptance Scenarios**:

1. **Given** a corpus of spec directories, **When** `/draft` is requested with the
   bearer token, **Then** every directory `read_roadmap` returns is listed, in the
   order it returned them, each carrying the state it declared (FR-001, FR-003).
2. **Given** any listed spec, **When** its row is rendered, **Then** the row links
   to that spec's drafting table at `/draft/<spec-dir>`, and the link is the row
   itself rather than a separate control (FR-002).
3. **Given** a spec declaring each of `draft`, `ready`, `deferred` and `landed`,
   **When** the index renders, **Then** each state renders as the chip DESIGN.md's
   vocabulary gives it, and no row carries a glyph from the eleven-state grammar
   (FR-004).
4. **Given** a corpus root that cannot be read — absent, unreadable, or holding a
   spec whose frontmatter will not parse — **When** the index is requested,
   **Then** it degrades honestly, naming what could not be learned, and does not
   render an empty corpus (FR-005).
5. **Given** any successful read, **When** the index renders, **Then** it names the
   working-tree revision it read and the instant it read it, on the same terms
   014's trio does (FR-006).
6. **Given** no bearer token, **When** `/draft` is requested, **Then** the answer is
   401, like every other route (FR-007).
7. **Given** the Masthead, **When** any room renders, **Then** the drafting table is
   offered as a room beside the Desk and the Showfloor, and is current when the
   path is under `/draft` with or without a spec named (FR-008).

---

### Edge Cases

- **A corpus with no spec directories at all.** An empty corpus is a fact, not a
  failure: the index says the corpus is empty in words and produces no degraded
  entry. This is the `absent is quiet` rule from DESIGN.md § The drafting table,
  applied one level up.
- **A spec directory holding no `spec.md`.** `read_roadmap` owns that decision;
  whatever it returns is what the index shows. This repository does not second-
  guess it and does not walk the filesystem itself.
- **A spec whose declared state is one `SpecState` does not know.** `read_roadmap`
  refuses it as `unknown_state`; the refusal is rendered in its own words, and the
  rest of the corpus still lists.
- **A tree that is not a git repository.** The revision is `unknown`, not degraded
  — 014's Unknown Rule ruling (`pane/draft.py`), unchanged and reused rather than
  re-decided.

## Requirements

### Functional Requirements

- **FR-001**: Bare `/draft` MUST render every spec directory the corpus holds, in
  `read_roadmap`'s order, each with its declared state.
- **FR-002**: Every row MUST link to that spec's drafting table at
  `/draft/<spec-dir>`, using the `draftPathFor` helper `web/src/routes.ts` already
  exports rather than a second spelling of the path.
- **FR-003**: The corpus and its declared states MUST be read through
  `factory.roadmap.models.read_roadmap`. This repository MUST NOT parse spec
  frontmatter, MUST NOT sort the corpus itself, and MUST NOT decide what a spec
  with no frontmatter declares.
- **FR-004**: A declared state MUST render as the chip DESIGN.md's chip vocabulary
  gives it, and MUST NOT render as a glyph from the eleven-state grammar. Intent is
  declared; progress is observed; only the second has glyphs.
- **FR-005**: A corpus that cannot be read MUST degrade honestly in the pane's
  existing `degraded` vocabulary, naming the seam and what could not be learned,
  and MUST NOT render an empty index in place of a failed read.
- **FR-006**: The index MUST name the working-tree revision read and the read
  instant, through the same reader 014 uses.
- **FR-007**: `/draft` MUST answer 401 without the bearer token.
- **FR-008**: The Masthead MUST offer the drafting table as a room, and MUST mark
  it current for any path under `/draft`, with or without a spec named.
- **FR-009**: The API route this story adds, and every source path that reaches it,
  MUST be listed in `route-manifest.json`. The two committed tests that assert the
  manifest is complete are the gate on this, not review.

### Key Entities

- **The corpus index document** — one entry per spec: the directory name, the
  declared state, and nothing else. It carries the same `degraded` triple and the
  same read stamp every other document in this pane carries. It holds no counts,
  no summary and no derived readiness: whether a spec *can* dispatch is a
  computation ergane owns and D-022 already refused to re-derive here.

## Success Criteria

- **SC-001**: A committed test asserts the index's order and states are exactly
  what `read_roadmap` returned, over a constructed corpus, with no frontmatter
  parsing in this repository's diff.
- **SC-002**: A committed test asserts an unreadable corpus produces a named
  degraded entry and no empty index.
- **SC-003**: A committed unit test asserts every row's href equals
  `draftPathFor(specDir)` for the spec it names.
- **SC-004**: The manifest tests pass with the new route listed, proving the room
  is reachable from the manifest as well as from the Masthead.
- **SC-005**: A committed smoke test navigates from the Masthead to the index to a
  spec's drafting table without a typed URL — the defect this spec exists to close,
  asserted rather than described.

## Assumptions

- `read_roadmap` is the right and only seam for "what is in the corpus". Verified
  by reading `pane/showfloor.py:641-659`, which already takes it for the epic
  rail's order and state, and ratified into constitution II by D-025.
- The chip vocabulary covers all four declared states. True as of D-025, which
  added `deferred`; it was the one `SpecState` value with no face.

## Out of scope

- **Any write.** This room lists and links. Declaring a spec `ready` is 010's one
  verb and is blocked on an ergane seam that does not exist (D-025).
- **Readiness.** The index shows what each spec *declares*, never whether it could
  dispatch. That answer is `ergane spec validate`'s, it has no library form, and
  composing one here is what D-022 forbade by name.
- **Filtering, search, sorting by anything but `read_roadmap`'s order.** Seventeen
  rows do not need a control, and a second sort would be this repository deciding
  an order the seam already decided.

## Work Graph

```yaml
US1:
  depends_on: []
  depends_on_merged: []
  implements: [FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009]
  timeout: 3600
```
