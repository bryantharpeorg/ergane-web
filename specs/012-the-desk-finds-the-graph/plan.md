# Implementation Plan: The Desk finds the graph

**Spec**: `specs/012-the-desk-finds-the-graph/spec.md` · **Landing branch**: `dev`
**Authority**: constitution II and III, `DESIGN.md` § The Desk in this world.
No `DESIGN.md` amendment and no decision entry — see the spec's frontmatter.

## The shape

Two stories, serial. US2 cannot be written until US1 makes a graph available to
draw from, and both reach `pane/floor_document.py`.

## Decisions

- **D1 — copy the rule, not the code, and copy it exactly.**
  `pane/showfloor.py:377` already implements seam-then-archive, including the
  subtle part: when both fail, re-raise the **seam's** exception, not the
  archive's, "because the seam is where the graph belongs". Reproduce that
  ordering and that choice of failure. Do not invent a third behaviour.
- **D2 — the archive root is resolved once, not per call.**
  `ShowfloorReaders.from_reader` derives it as `specs_root.parent / "docs" /
  "dags"`. Use the same derivation so the two rooms cannot drift apart on where
  the archive lives.
- **D3 — the fallback goes where the Showfloor's does: at the binding, not
  inside `LiveReader`.** `LiveReader.workgraph()` is the *seam* — it should keep
  meaning "read the path the factory would write". The fallback is a policy
  about what to do when the seam is silent, and policy belongs at the call site
  that already owns degradation, which is `pane/floor_document.py`. Putting it
  inside `LiveReader` would make the seam lie about what it read.
- **D4 — `UNDECLARED` keeps its meaning.** It marks a story whose graph declares
  no dependency. It must never become the rendering for "no graph": that is how
  a fabricated topology gets back in, and this corpus has already paid for that
  once (the 08-25 review's F1 was a symptom of exactly it).

## Named traps

- **Do not fix this by writing `workgraph.json` into `specs/`.** It is tempting
  and it is wrong twice: the roadmap derives in-process and would not maintain
  it, and `specs/` is the corpus the scheduler reads — putting derived artefacts
  there makes a spec directory mean two things. The archive already exists and
  is already committed.
- **A read that succeeds from the archive must be silent.** The whole defect is
  a `degraded` entry for a non-degradation. Appending a note saying "served from
  archive" would keep the notice on screen and reproduce the complaint.
- **The corpus tests must not pin the live corpus.** `tests/corpus.py` and the
  guard `tests/test_no_test_pins_live_corpus.py` landed in 008/US1 for this
  reason. Construct a spec directory and an archive in a tmp tree; never assert
  that `009-a-landed-epic-reads-landed` is on the floor, because it will not be
  next week.
- **The Desk's carried-over guarantees are load-bearing.** `desk.spec.ts`,
  `Desk.test.tsx` and the chevron assertions have survived 001, 003 and 006
  unchanged. If a selector must move, name it in the test header the way 006/US1
  did — that discipline is FR-003 of 006 and it is why those suites still mean
  something.
- **`PLAYWRIGHT_BROWSERS_PATH=0` is read from the environment on every
  invocation** (D-013). It is already on both the install and the test run.

## Gates

`uv run pytest -q` · `npm --prefix web run typecheck` · `test:unit` · `test:smoke`.
