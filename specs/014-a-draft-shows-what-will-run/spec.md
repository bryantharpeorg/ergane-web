---
state: landed
depends_on_landed: [012-the-desk-finds-the-graph]
# Attested landed 2026-08-26. US1 d919ad83fb2c (#78), US2 b44cb747043c (#81),
# US3 7004b7b92d52 (#82) - all three observed on dev by content, not by a merged
# flag.
#
# FR-001 IS ATTESTED OPEN, AND THAT IS THE POINT OF READING THIS BLOCK. It says
# the room MUST render the trio as markdown. It does not: US1 shipped an honest
# source-view, labelled in `web/src/draft/Markdown.tsx` as exactly that, because
# no markdown renderer is on the approved roster and constitution VII forbids a
# node adding one. It raised the mandated stop-and-ask, waited, and landed before
# the answer arrived - the operator approved `marked` LEXER ONLY six minutes
# later. The judge then returned PASS on attempts 2 and 3.
#
# So this epic attests as landed while carrying a requirement its own source file
# says it does not satisfy. That is recorded rather than smoothed over, and the
# gap it exposes is filed as verify/judge-passes-a-story-that-states-its-own-
# requirement-unmet: nothing distinguishes SATISFIED from HONESTLY DEFERRED, so a
# well-argued comment can retire a MUST. FR-001 is closed by a follow-up spec that
# lands `marked` lexer-only into that one file plus the roster, constitution VII
# and a D-entry - the file itself says "when the operator approves one, this file
# is the only file that changes."
#
# Dispatched 11:55 PM CT 25 Aug, complete 12:17 PM CT 26 Aug. Six attempts for
# three stories, and every failure was environmental rather than a defect in the
# work: US1 spent attempts on a BASE_MOVED collision with 011 running
# concurrently (the roadmap ignored `max_concurrent_epics: 1`), and US2 lost
# attempts 1 and 2 to leaked Playwright servers holding the smoke gate's fixed
# ports, then attempt 3 to the ladder rung the operator question consumed. Every
# judge verdict that ran was PASS.
#
# US1'S RECOVERY IS THE ONE TO KEEP. On attempt 3 as `debugger`, with its single
# recovery cycle already spent and no rung behind it, it resolved a two-node file
# collision unaided: rebased, reconciled `web/src/routes.ts`, and added the
# manifest rows 011 had just landed - including one the operator's own prepared
# hand-fix had missed. A ladder with rungs left is evidence the operator does not
# have yet.
#
# Flipped `ready` 2026-08-25, 11:36 PM CT. The hold is discharged: D-022 landed on
# dev at d337d16 (#72), so the seam amendment and `DESIGN.md` § The drafting table
# are both on the branch a node will build from.
#
# Carved out of 010 by the operator, 2026-08-25 ~10:35 PM CT, on the finding that
# 010's move 3 is the only part of the grooming room buildable today: it writes
# nothing, and every seam it needs is exported. 010 keeps moves 1, 2 and 4 and
# stays `draft` until ergane exports an authoring seam (PR-7).
#
# `state: draft` until the operator flips it. It is refined, it validates, and it
# has a Work Graph -- unlike 007/010/011 it is not a sketch. It is held only
# because D-022 must land first: it amends constitution II's seam list and adds a
# DESIGN.md section, and a node may not build against a decision that is still on
# a branch.
#
# THE ROOM DELIBERATELY DOES NOT CLAIM TO BE `ergane spec validate`. That verb has
# no library form -- its whole policy lives in `_validate_command(args:
# argparse.Namespace) -> int` (`factory/cli/nouns/spec.py:231`), a private CLI
# handler that prints and returns an exit code. Composing its five checks in this
# repository would re-derive the validation policy in a second language, which is
# the D-005 defect class. Filed to ergane as PR-8. US2 below renders each exported
# checker's own answer, attributed, and says plainly that the composed verdict is
# not available.
---

# Feature Specification: A draft shows what will run

**Feature Branch**: `014-a-draft-shows-what-will-run`
**Created**: 2026-08-25 · **Status**: Refined, held on D-022
**Input**: 010's move 3, carved out on the operator's instruction

## Context

The operator's request for a grooming room had four moves: capture an idea,
commission its trio, review and edit the trio, flip it ready. Three of them are
writes and **ergane exports no seam that writes** — `ergane spec` has `list`,
`validate`, `derive` and `landed`, and all four are read-only. D-021 admits those
writes by test rather than by list, and clause 1 of that test refuses all three
today for want of a seam (filed as PR-7).

Move 3 is different. Stripped of its editing half — the operator keeps editing in
their own editor — what remains writes nothing and reads only surfaces that
already exist:

> the three rendered side by side, with `ergane spec validate` live beside them

That is a **drafting table**: a room that shows what the factory will do with a
spec, before the operator flips it and finds out. Today that answer costs a
terminal, three `cat`s and a `spec derive` whose output is JSON.

**The room's value is concentrated in one moment.** Flipping `state: ready` is
the most expensive act in the product — the roadmap dispatches within 300 seconds,
spending tokens, opening pull requests and moving `dev`. Right now nothing shows
the operator what is about to run. The compiled Work Graph — the actual node set,
the actual edges, the actual personas — is derivable in milliseconds and has never
been on screen before dispatch.

## User Scenarios & Testing

### User Story 1 - The trio reads together (Priority: P1)

As an operator, I open one route and read a spec's three documents side by side,
and the room tells me which revision it read and when.

**Why this priority**: nothing else in the room is reachable without the page, and
the reading half alone replaces three terminal commands.

**Acceptance Scenarios**:

1. **Given** a spec directory carrying `spec.md`, `plan.md` and `tasks.md`,
   **When** `/draft/<spec-dir>` is requested with the bearer token, **Then** all
   three render as markdown in one view, in that order (FR-001).
2. **Given** a spec directory carrying only `spec.md` — the shape every sketch in
   this corpus has — **When** the route is requested, **Then** `spec.md` renders
   and the two absent documents each read as absent rather than as an error, and
   no `degraded` entry is produced (FR-002).
3. **Given** any successful read, **When** the view renders, **Then** it names the
   working-tree revision it read and the instant it read it (FR-003).
4. **Given** a spec directory that does not exist, **When** the route is
   requested, **Then** the room degrades honestly, naming the path it tried, and
   does not render an empty trio (FR-004).
5. **Given** no bearer token, **When** the route is requested, **Then** the answer
   is 401, like every other route (FR-005).

---

### User Story 2 - Each check answers in its own name (Priority: P2)

As an operator, I see what each of ergane's exported checkers says about this
spec, attributed to the checker that said it, and I am told plainly that this is
not the CLI's verdict.

**Why this priority**: it is the half the operator asked for, and it is only
honest once US1 has a page to put it on.

**Acceptance Scenarios**:

1. **Given** a spec whose `## Work Graph` compiles, **When** the checks run,
   **Then** the derivation reports success and names `derive_workgraph` as the
   seam that answered (FR-006).
2. **Given** a spec whose `## Work Graph` does not compile, **When** the checks
   run, **Then** the `DerivationError`'s own message renders unsoftened, and no
   other check claims a result that depends on a graph that does not exist
   (FR-007).
3. **Given** a spec with a compiled graph and a `tasks.md`, **When** the checks
   run, **Then** slice coverage and prompt assembly each render their own answer,
   each attributed to `check_slice_coverage` and `check_prompt_assembly`
   respectively (FR-008).
4. **Given** any set of check results whatsoever, **When** the view renders,
   **Then** no single composite PASS/FAIL verdict is shown, and the view states
   that `ergane spec validate`'s verdict is not available to the pane (FR-009).
5. **Given** a spec with no `tasks.md`, **When** the checks run, **Then** the
   checks that need one report that they could not run, rather than reporting a
   failure the spec did not earn (FR-010).

---

### User Story 3 - The graph draws what will run (Priority: P3)

As an operator, I see the node set and the edges the factory will actually
dispatch, drawn, before I flip the spec ready.

**Why this priority**: it is the moment the room exists for, and it needs US2's
compiled graph in hand.

**Acceptance Scenarios**:

1. **Given** a spec whose graph compiles to more than one node, **When** the view
   renders, **Then** the graph draws with the Showfloor's existing stage assets in
   an **unlit** form — no node carries a run state, because none has run
   (FR-011).
2. **Given** a graph declaring `depends_on_merged` edges, **When** it draws,
   **Then** those edges render with the merge stroke DESIGN.md already names, and
   `depends_on` edges with the other (FR-012).
3. **Given** a graph that did not compile, **When** the view renders, **Then** no
   stage is drawn at all — an empty stage is a claim about a graph, and there is
   no graph (FR-013).
4. **Given** both themes at every width the suite already sweeps, **When** the
   view renders, **Then** the four layout laws report zero violations (FR-014).

---

### Edge Cases

- A spec whose `plan.md` is present but empty: it renders as present-and-empty,
  which is different from absent, and the distinction is on screen.
- A spec directory outside `specs/`: refused. The route resolves a directory name
  against the configured specs root and never accepts a path.
- A markdown document containing a fenced YAML block that looks like a Work
  Graph: the room renders documents and derives the graph through the seam; it
  never parses a graph out of rendered text.

## Requirements

### Functional Requirements

- **FR-001**: `/draft/<spec-dir>` MUST render `spec.md`, `plan.md` and `tasks.md`
  as markdown, in that order, in one view.
- **FR-002**: An absent `plan.md` or `tasks.md` MUST read as absent and MUST NOT
  produce a `degraded` entry — most of this corpus's specs have neither.
- **FR-003**: The view MUST name the working-tree revision read and the read
  instant.
- **FR-004**: An unreadable spec directory MUST degrade honestly, naming the path
  attempted.
- **FR-005**: The route MUST answer 401 without the bearer token.
- **FR-006**: A compiled graph MUST report success attributed to
  `derive_workgraph`.
- **FR-007**: A `DerivationError` MUST render its own message unsoftened, and no
  graph-dependent check may report a result.
- **FR-008**: Slice coverage and prompt assembly MUST each render an answer
  attributed to the exported checker that produced it.
- **FR-009**: The view MUST NOT render a composite PASS/FAIL verdict, and MUST
  state that `ergane spec validate`'s verdict is unavailable to the pane.
- **FR-010**: A check that cannot run for want of an input MUST report that it did
  not run, never a failure.
- **FR-011**: A compiled graph MUST draw with the Showfloor's stage assets in an
  unlit form, with no run state on any node.
- **FR-012**: `depends_on_merged` and `depends_on` edges MUST render with the two
  strokes DESIGN.md names.
- **FR-013**: A graph that did not compile MUST draw no stage.
- **FR-014**: The view MUST report zero violations of the four layout laws at
  every width and in both themes the suite sweeps.

### Key Entities

- **The trio** — `spec.md`, `plan.md`, `tasks.md` under `specs/<dir>/`.
- **The exported checkers** — `factory.workgraph.derive.derive_workgraph`,
  `factory.workgraph.preflight.check_slice_coverage` and `check_prompt_assembly`,
  joining the approved seam list by D-022.

## Success Criteria

- **SC-001**: An operator reads a spec's whole trio and its compiled graph in one
  page, without a terminal.
- **SC-002**: A spec whose Work Graph will not compile says so, in the deriver's
  own words, before anything dispatches.
- **SC-003**: No screen in this room claims a verdict the pane did not obtain from
  a seam.

## Assumptions

- The specs root is the one the pane is already configured with; the route
  resolves a directory *name* against it and never a path.
- `plan.md` and `tasks.md` absent is the common case, not the error case: eight of
  this corpus's fourteen spec directories have at least one of them missing.

## Out of scope

- **Editing anything.** The operator edits in their own editor; this room reads.
  D-021's four grooming writes all fail clause 1 for want of a seam.
- **Flipping a spec ready.** That is 010's move 4 and it is blocked on PR-7.
- **Claiming the CLI's verdict.** Blocked on PR-8, and faking it is the defect
  this spec's frontmatter exists to prevent.

## Work Graph

```yaml
US1:
  depends_on: []
  depends_on_merged: []
  implements: [FR-001, FR-002, FR-003, FR-004, FR-005]
  timeout: 3600
US2:
  depends_on: []
  depends_on_merged: [US1]
  implements: [FR-006, FR-007, FR-008, FR-009, FR-010]
  timeout: 3600
US3:
  depends_on: []
  depends_on_merged: [US2]
  implements: [FR-011, FR-012, FR-013, FR-014]
  timeout: 3600
```
