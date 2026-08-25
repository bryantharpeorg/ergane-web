---
state: draft
depends_on_landed: [003-an-answer-reaches-the-factory]
# TBD — CAPTURED, NOT REFINED. Recorded 2026-08-25 from operator intent so the
# idea survives the session that had it. This spec has NO Work Graph on purpose:
# `state: draft` never dispatches, and it must not be flipped `ready` until the
# Open Questions below are answered and the body is refined to the corpus's
# standard. `ergane spec validate` will refuse it today; that is correct and
# expected for a sketch.
#
# IT MUST NOT BE FLIPPED FOR A SECOND REASON, AND THIS ONE IS NOT PROCEDURAL:
# every move this spec describes is a write, and constitution I forbids all of
# them by name -- "no pause buttons, no dispatch forms, no spec editing."
# Refining this spec to `ready` requires amending the constitution and a
# decision-log entry first. See Open Question 1; it blocks the other five.
#
# The `depends_on_landed` edge is provisional: 003 is the only landed precedent
# for a token-guarded write path, so it is the honest floor. The real edge set
# is decided at refinement.
#
# 009 is reserved for the Showfloor's rank-wrap, occlusion and honest-degradation
# defects (docs/pane-review-2026-08-25.md F1/F2/F4) -- decided code work, not
# captured intent. The gap in numbering is deliberate.
---

# Feature Specification: An idea becomes a spec (TBD)

**Feature Branch**: `010-an-idea-becomes-a-spec`
**Created**: 2026-08-25 · **Status**: Draft — unrefined sketch
**Input**: operator request, verbatim below

## Operator intent (as captured)

> the spec refinement step. how do we go from idea, to a refined spec via the UI
> integrated with the CLI/APIs. i want a way in the web to review the spec, tell
> it to go create its spec trio, then review the spec trio, make edits to it as
> needed, and then when im happy, change it to ready so the factory takes it.

Framed by the operator as one of two **HITL** surfaces for the product owner,
"could eventually also be built into things used for debugging sessions."
Its sibling is 011, which closes the other end of the same loop.

## Sketch

A grooming room. The Desk reads the floor, the Showfloor stages an epic, and
this room is where work *enters* the floor at all. Four moves, in order, each
one a place the operator can stop:

| # | move | today | in the room |
|---|---|---|---|
| 1 | capture an idea | a paragraph typed into a session that then ends | a persisted draft with a title, an id and a body |
| 2 | commission the trio | `/speckit-specify` in a Claude Code session | one control that asks the factory to author `spec.md`, `plan.md`, `tasks.md` |
| 3 | review and edit the trio | open three files in an editor | the three rendered side by side, editable, with `ergane spec validate` live beside them |
| 4 | flip it ready | `sed` the frontmatter, commit, push | one control that writes `state: ready` and lands it the way the corpus requires |

Move 3 is the one the operator asked for most concretely and the one with the
clearest shape: the trio is three markdown files, the validator already exists
and is fast, and the Work Graph is already drawable (`.claude/skills/spec-html`
draws it today). A room that rendered the trio, ran `ergane spec validate` on
every keystroke-settled edit, and drew the Work Graph as the operator changed
`depends_on` would be worth building even if moves 1, 2 and 4 never shipped.

Move 4 is the one with the consequences. Flipping `state: ready` is the single
most expensive act in the product: within 300 s the roadmap scheduler dispatches
nodes that spend tokens, open pull requests and move `dev`. Every other control
in the pane shows something; this one starts a factory.

## What already exists to build on

- **`ergane spec validate`** — frontmatter, work-graph and persona checks on one
  spec. Pure, fast, no side effects. The natural live gate behind move 3.
- **`ergane spec derive`** — compiles `spec.md` into `workgraph.json`. Also pure.
  Gives move 3 a drawable graph and a real "this is what the factory will run."
- **`ergane spec list` / `ergane spec landed`** — what the Desk already consumes.
- **The 10 committed Spec Kit skills** under `.claude/skills/speckit-*` — the
  authoring conventions for move 2, already in the tree and already read by
  dispatched nodes.
- **007's reading room**, if it ships: a spec's history is the context an
  operator wants while grooming the *next* one.

## What does not exist, and this is the load-bearing gap

`ergane spec` exports exactly four verbs — `list`, `validate`, `derive`,
`landed` — and **all four are read-only**. There is no `ergane spec new`, no
`ergane spec ready`, no authoring seam of any kind. Constitution II says every
read and every write rides a surface the ergane distribution already exports;
for moves 1, 2 and 4 there is nothing to ride. A pane that authored a spec trio
or mutated `state:` itself would be re-deriving factory logic by construction —
the defect class D-005 exists to prevent.

**So the largest part of this feature is not pane work at all.** It is an ergane
capability that does not exist yet, and it should be filed as such before this
spec is refined.

## Open questions

1. **Constitution I — BLOCKING, AND IT BLOCKS THE OTHER FIVE.** The pane has one
   verb, Answer, and § I names spec editing and dispatch forms as forbidden
   examples. This spec proposes three distinct writes: authoring files in the
   operator's tree, commissioning an agent to write them, and mutating a spec's
   readiness. Three ways out, and the choice is the operator's:

   | | A — amend § I | B — a second verb, scoped | C — the room is read-only |
   |---|---|---|---|
   | what changes | "one verb" becomes "two verbs: Answer and Ready" | a new principle that admits *corpus* writes to the target repo, and nothing else | the room renders, validates and draws; every write is a CLI command it shows you, copy-ready |
   | cost | the pane's founding constraint is gone; every future spec can argue for its own button | narrow, defensible, but needs the ergane seams that do not exist | ships on today's constitution; the operator still types |
   | honest name | a console | a glass with two verbs | a very good drafting table |

   C is not a consolation prize: moves 1 and 3 are almost entirely reading, and a
   room that validates and draws while the operator edits removes most of the
   friction without touching § I. A and B both need a D-entry before any work
   dispatches.

2. **Which seam authors the trio?** None exists (above). File it to the ergane
   agent as a finding and let the capability land there, or accept that move 2 is
   the pane shelling a Claude Code session — which constitution II forbids and
   the CLI-shelling ban makes explicit. **Recommendation: file it; do not design
   around it.**

3. **Where does the edit land — and what stops the roadmap from eating it?**
   `CLAUDE.md` is explicit that the scheduler reads the *local working tree*, so
   an uncommitted `ready` is live immediately, while a node's worktree carries
   only committed files. That already forces "commit before you flip." Worse,
   **N50**: `factory/activities/roadmap_activities.py:118` runs
   `git reset --quiet --hard origin/<default>` on the operator's working checkout
   on every roadmap tick, which destroys uncommitted tracked-file edits. An
   in-pane editor writing to the working tree would have the operator's draft
   deleted underneath them within 300 seconds. This is not a hypothetical: it
   happened to this session's own `DESIGN.md` edits on 2026-08-25. Any refinement
   of move 3 must write to a branch, or to a location outside the tracked tree,
   or wait for N50.

4. **Determinism and the credential boundary.** Today the pane's entire read path
   is deterministic — measured 2026-08-25: no model call anywhere behind a page,
   hash-identical responses in 50–65 ms. Move 2 puts an LLM behind a page for the
   first time, which drags in a model route, a key, a cost, a latency the SSE
   channel has never had to carry, and a failure mode (a refusal, a truncation)
   the honest-degradation principle has no vocabulary for yet. Constitution VI
   says no credential reaches a page, an event, a log or a fixture. Decide
   whether the authoring call is the *factory's* (dispatched, with the factory's
   own key, watched like any other node — which is coherent) or the *pane's*
   (which is a new credential surface, and probably a no).

5. **Concurrency with the operator's own CLI session.** The operator edits specs
   in Claude Code today. Two writers on one working tree, plus the roadmap's hard
   reset, is three. Whatever move 3 writes to must survive that, and the room has
   to render staleness honestly (principle III) rather than silently overwrite.

6. **Debugging sessions.** Captured verbatim from the operator and deliberately
   not designed: "could eventually also be built into things used for debugging
   sessions." Revisit once moves 1–4 have a shape; do not let it widen v1.

## Out of scope (already known)

- Dispatching, pausing, killing or retrying anything. This room's most
  consequential act is `state: ready`, and even that is Open Question 1.
- Editing a spec that is already `ready` or `landed` — the corpus is immutable
  once the factory has taken it.
- Multi-repo. The pane reads one target repo.

## Work Graph

Deliberately absent — see the frontmatter note. Refine with `/speckit-plan` and
`/speckit-tasks` after Open Question 1 is decided and recorded as a D-entry.
