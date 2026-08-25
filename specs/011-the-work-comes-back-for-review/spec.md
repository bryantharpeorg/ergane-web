---
state: draft
depends_on_landed: [007-a-spec-remembers-its-build]
# TBD — CAPTURED, NOT REFINED. Recorded 2026-08-25 from operator intent so the
# idea survives the session that had it. NO Work Graph on purpose: `state: draft`
# never dispatches, and it must not be flipped `ready` until the Open Questions
# are answered and the body is refined to the corpus's standard.
# `ergane spec validate` will refuse it today; that is correct for a sketch.
#
# TWO REASONS IT MUST NOT BE FLIPPED, AND THE SECOND IS NOT PROCEDURAL:
#   - its output is a new spec, which is a write, and constitution I forbids
#     spec editing by name (010's Open Question 1 governs both specs);
#   - it proposes driving a real browser from the pane's own process, which is
#     subprocess execution on the operator's host behind one bearer token.
#     Constitution VI has never had to reason about a blast radius like that.
#
# The `depends_on_landed` edge is provisional: this room reuses 007's per-spec
# history assets, so 007 is the honest floor. The real edge set is decided at
# refinement, and 007 is itself an unrefined sketch.
#
# 009 is reserved for the Showfloor's rank-wrap, occlusion and honest-degradation
# defects (docs/pane-review-2026-08-25.md F1/F2/F4). The numbering gap is
# deliberate.
---

# Feature Specification: The work comes back for review (TBD)

**Feature Branch**: `011-the-work-comes-back-for-review`
**Created**: 2026-08-25 · **Status**: Draft — unrefined sketch
**Input**: operator request, verbatim below

## Operator intent (as captured)

> after the coding is done. i want a way to review the work that was completed.
> This could be something with a text box that allows feedback, ideally it would
> be associated with a playwright browser session navigating the parts of
> ergane-web that were changed because of the specs/stories and allow us to take
> notes to create another spec with refined direction based on the review.

The second of two **HITL** surfaces for the product owner. 010 is how work
enters the floor; this is how the floor's output comes back. Together they close
the loop: idea → spec → build → review → idea.

## The precedent, and why it is the strongest evidence this spec has

This room already exists as a manual ritual, performed twice, and both times it
paid for itself:

- `docs/pane-review-2026-08-24.md` — recorded after 004 landed a green gate over
  a room whose stations were all outside the canvas.
- `docs/pane-review-2026-08-25.md` — recorded after 005; found three defects
  (F1 a clipped rank, F2 an opaque box painted over its own heading, F3 a suite
  pinning the live corpus) that **all four gates passed**. F1 and F3 became spec
  008, which dispatched at 7:40 AM CT and was complete by 8:44 AM.

That is the whole product in one paragraph: a gate that never renders cannot see
a defect that is only visible, and the review is what converts "looks not great"
into a spec the factory can take. This room automates a ritual with a measured
track record, not a hypothesis.

## Sketch

A review room, scoped to one landed epic. Three tracks, left to right:

| track | holds |
|---|---|
| **what changed** | the epic's stories, each with its landing SHA, PR and squash subject; the changed-file list; the routes those files reach |
| **the thing itself** | a live browser at one of those routes — real render, both themes, a width the operator picks — beside the *measured* numbers for that screen |
| **the notes** | one note per observation, each anchored to a story, a route, a width, a theme and a screenshot |

The room's output is a **captured TBD spec** in exactly the shape of 007 and 010:
operator intent verbatim, a sketch, open questions, no Work Graph, `state: draft`.
It never writes a dispatchable spec, and it never flips anything ready — that is
010's problem, and 010 has not solved it either.

**The measurement is the point, not the screenshot.** The 08-25 review was
useful because it reported "235px of graph hidden at 1280, US4 fully invisible,
scrollbar height 0px" rather than "the graph looks cut off." The harness that
produced those numbers is already committed —`measureLaws` in
`web/tests/smoke/showfloor.spec.ts` — and was run against the *running service*
rather than a fixture. A review room that renders a route and does not run that
sweep beside it has rebuilt the screenshot, which is the thing the constitution's
principle IV already rejects.

**A note is not prose.** Each note carries the coordinates that make it
reproducible: story, route, width, theme, the measured numbers at capture, and
the screenshot. F2 was findable because the review recorded the exact box
(`362..1049 × 220..300`, 80px tall, glyphs at `241..278`) — a textarea full of
paragraphs would not have carried that.

## Open questions

1. **Constitution I — BLOCKING, shared with 010.** The room's output is a new
   spec file, which is spec editing, which § I forbids by name. 010's Open
   Question 1 decides for both. Option C there — the room composes the spec and
   hands the operator the file to save, writing nothing itself — costs this room
   much less than it costs 010, because a review's output is a draft by nature.

2. **Driving a browser is a new kind of power, and § VI has not met it.** A
   Playwright session launched by the pane means the pane's process spawns
   Chromium on the operator's host, navigates to URLs, executes page scripts and
   writes screenshot files — all reachable behind one bearer token that today
   only grants reads of the floor. Questions that need answers before any of it
   is designed: does the browser run in the pane's process or in a sandbox; is
   the URL set closed (only routes derived from the diff) or operator-typed; do
   the screenshots ever leave the host; and what does the token now authorize if
   it leaks? **Recommendation: the URL set is closed and derived, the browser is
   sandboxed, and this gets its own D-entry — not a paragraph inside a story.**

3. **Diff → route is a mapping nothing exports.** "The parts of ergane-web that
   were changed because of the specs/stories" requires knowing that
   `web/src/showfloor/showfloor.css` reaches `/showfloor/<dir>` and that
   `pane/readers.py` reaches both rooms. Candidates: declare it (a committed
   route manifest, honest and dumb), derive it from the router (fragile), or ask
   the operator each time (a fine v1). Getting this wrong shows the reviewer the
   wrong screens, which is worse than showing them none.

4. **Where do review artifacts live?** Screenshots and measurement snapshots are
   not fixtures — constitution V's "recorded, never invented" governs the
   *Fixture floor*, and mixing review captures into `fixtures/` would corrupt the
   provenance that makes that directory trustworthy. `docs/reviews/<date>/` is
   the obvious home, and it is a repo-size question the operator should decide
   before the first screenshot is written, not after a hundred are.

5. **What is reviewable, and when?** An epic whose stories are all `MERGED` is
   the clean case. Open: a partially landed epic, a spec whose stories landed
   across several dispatches, and whether a review can be reopened and appended
   to — the 08-24 and 08-25 reviews were separate documents about overlapping
   surfaces, and a room that cannot express "this is still true" will collect
   duplicates.

6. **Whose render is under review — the live pane, or a built branch?** The 08-25
   review measured the running service at `192.168.10.156:8790`, which serves
   whatever `web/dist` was last built from. Reviewing an epic means reviewing
   *its* tree, which may not be what is running. Building the branch under review
   is honest and slow; measuring the live service is fast and can be measuring
   the wrong code. Say which, in the room, on the screen.

7. **Debugging sessions.** Captured verbatim and deliberately not designed:
   "could eventually also be built into things used for debugging sessions." The
   same three tracks would serve it — changed files, a live render, anchored
   notes — but a debugging room wants a console and a network log, and that is a
   second product. Revisit after v1.

## Out of scope (already known)

- Dispatching the spec the review produces. It comes out `draft`, like 007 and
  010, and a human takes it from there.
- Reviewing anything but this pane. The room renders the target repo's own
  surfaces; a factory that built a non-web repo has nothing to navigate.
- Replacing the gates. A review finds what a headless gate cannot see; it does
  not excuse a gate that does not run (principle IV).

## Work Graph

Deliberately absent — see the frontmatter note. Refine with `/speckit-plan` and
`/speckit-tasks` after Open Questions 1 and 2 are decided and recorded as
D-entries.
