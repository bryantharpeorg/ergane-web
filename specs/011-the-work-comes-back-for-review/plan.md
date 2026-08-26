# Implementation Plan: The work comes back for review

**Spec**: `specs/011-the-work-comes-back-for-review/spec.md` · **Landing branch**: `dev`
**Authority**: constitution I (as amended by D-021), II, III, IV, VI and VIII;
D-023 for the mechanism and the room's face.

## The shape

Three stories, serial. US2 needs US1's route list to have anything to render; US3
needs US2's measurements to have coordinates to anchor a note to. All three reach
the same new route module and the same view, so `depends_on_merged` throughout —
two nodes extending one view is N38, which surfaces in the merge queue rather than
in the pull request.

## Decisions

- **D1 — the operator's browser is the browser.** A same-origin frame, measured
  from the parent document. The pane spawns nothing, writes nothing and reaches no
  URL of its own. The spec's frontmatter and § Questions carry the reasoning at
  length; the short version is that a web server that launches Chromium behind a
  bearer token is a different product with a different threat model, and this room
  does not need to be that product to do its job.

- **D2 — measure with the harness that already found the defects.** `measureLaws`
  in `web/tests/smoke/showfloor.spec.ts` produced "235px of graph hidden at 1280,
  US4 fully invisible, scrollbar height 0px" on 2026-08-25. Reuse that logic
  against the frame's document. A second implementation of the four laws is a
  second answer to the same question, and the two will disagree.

- **D3 — the route manifest is honest and dumb.** A committed mapping from source
  path patterns to routes, plus a test that every route the application serves
  appears in it. Deriving it from the router is fragile; asking the operator each
  time makes the room useless for the one thing it exists to do. A manifest that
  can rot silently is worthless, which is why FR-005's test is a requirement and
  not a nicety.

- **D4 — the room refuses a partially landed epic rather than reviewing part of
  it.** A review of half an epic produces notes about a surface that is about to
  change, and the operator cannot tell which half they looked at.

- **D5 — the served revision is stated, always, and the mismatch is unmissable.**
  The room reviews the running service. If the service is not serving the epic
  under review, everything on screen is about something else. This is the honest
  half of the question the spec could not otherwise answer without building a
  branch.

- **D6 — a note's coordinates are immutable once taken.** Change the width after
  taking a note and the note keeps the width it was taken at. A note whose
  coordinates follow the current view is not a record of anything.

## Named traps

- **Do not add Playwright, a headless browser, or any subprocess.** The spec
  substitutes a mechanism the operator asked for by name, and the substitution is
  the whole safety argument. A node that "helpfully" adds a screenshot service has
  reintroduced every question D-023 closed. If the frame genuinely cannot do
  something the spec requires, that is a **stop and ask**, not a licence.

- **Write nothing. Not a screenshot, not a draft, not a directory.** FR-014 is
  absolute and it is the reason questions 1 and 4 are closed. `open(..., "w")`
  anywhere in this diff outside a test's `tmp_path` is a refusal.

- **The changed-file read rides ergane's git wrapper, not a new one.**
  `pane/landing.py` already reaches `factory.workgraph.worktree._git` and its
  module docstring states the doctrine: a gap in ergane's exported surface is worth
  a finding, not a licence to write git ourselves. Follow it; do not `import
  subprocess`.

- **A frame is same-origin or the sweep cannot read it.** The room renders this
  pane's own routes. Never accept an operator-typed URL, never render a
  cross-origin document, and never relax a frame policy to make something render —
  a frame that will not load is a finding about the route, not an obstacle.

- **The four layout laws apply to this room too (FR-011).** A review room that
  violates the laws it measures is the joke this corpus should not make.

## Gates

The four in `ergane.yaml`, unchanged.
