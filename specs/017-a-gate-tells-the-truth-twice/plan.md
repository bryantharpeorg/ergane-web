# Implementation Plan: A gate tells the truth twice

**Spec**: `specs/017-a-gate-tells-the-truth-twice/spec.md` · **Landing branch**: `dev`
**Authority**: constitution III (honest degradation) and IV (provable from the diff);
`CLAUDE.md` § Layout worth knowing, for where the archive lives. No `DESIGN.md`
amendment and no decision entry: US2 adds a fact to a document that already exists,
and `DESIGN.md` § The Desk already asks for chevrons carrying the graph. Constitution
VIII is not engaged. No new dependency, so constitution VII is not engaged either.

## The shape

Two stories, **fully parallel**. They share no file:

| story | writes |
|---|---|
| US1 | `tests/test_the_demo_floor_owns_its_landings.py`, one new guard test |
| US2 | `pane/floor_document.py`, `.gitignore`, `tests/test_desk_finds_the_graph.py` |

`depends_on_merged` is empty on both. Do not add an edge to serialise them — they
were separated deliberately so this spec costs one round, not two.

## Decisions

- **D1 — US1 renames, it does not delete.** The assertion wants a checkout the
  live read cannot walk. `Path.rename` on the `.git` directory produces exactly
  that and takes nothing away from a process that still holds it open. `chmod`
  is the tempting alternative and is worse: it does nothing when the suite runs
  as root, which is how it runs in some containers, and a guard that silently
  no-ops is a false green.

- **D2 — the guard in FR-003 reads the source, not the filesystem.** A test that
  tried to *catch* a destructive test at runtime would have to run it first. Scan
  `tests/` for the destructive call shape and assert it appears nowhere. That is
  cheap, deterministic, and it fails the moment someone reintroduces the pattern
  — which is the point, because the pattern is the kind that looks reasonable in
  review.

- **D3 — provenance rides the existing fallback, and adds no read.**
  `_read_workgraph` in `pane/floor_document.py:84` already has exactly three
  outcomes and knows which one it took. Return the source alongside the graph.
  Do **not** compute provenance by asking the filesystem or git which file
  exists — that is a second read that can disagree with the first, and 016's
  spawn watcher will fail the suite outright if it reaches git.

- **D4 — `degraded` is not where this goes.** `degraded` means a read failed.
  A fallback that answered is not a failure and 012 FR-002 forbids an entry for
  it. Provenance is a property of the epic's graph, so it travels with the epic.

- **D5 — `.gitignore` gets the pattern, and nothing else changes.** Do not delete
  the three files that are on the operator's disk today. They are the operator's,
  the away-mode park list forbids deleting things, and ignoring the path is what
  stops the accumulation.

## Named traps

- **012's FR-004 has a committed test and it must still pass.**
  `test_a_successful_seam_read_does_not_consult_the_archive` in
  `tests/test_desk_finds_the_graph.py:193`. If your change makes the archive get
  opened in order to *name* it, that test goes red and it is right to. Provenance
  is known from the branch taken, never from a probe.

- **Do not weaken the unparseable path.** 012 FR-005 distinguishes an archive
  that is absent from one that will not parse, and 012's US1 needed two attempts
  to get that right — `json.JSONDecodeError` is a `ValueError`, not an
  `OSError`, and the first attempt let it crash the whole floor document. A
  graph that was never read has no provenance; do not invent one for it.

- **The `landed` fixture builds a real repository.** That is why US1's race
  exists at all. Whatever US1 does to make the checkout unwalkable must leave the
  fixture's own teardown able to clean up afterwards.

- **The three untracked files on the operator's checkout are the reproduction,
  not the target.** Nothing in this spec removes them.

## Gates

The four in `ergane.yaml`. SC-001 asks for twenty consecutive runs of the altered
file — `pytest tests/test_the_demo_floor_owns_its_landings.py --count=20` is not
available without a plugin, so loop it in the shell rather than adding one; a new
dependency needs operator approval and this spec has none.
