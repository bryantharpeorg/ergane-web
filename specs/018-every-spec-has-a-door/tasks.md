# Tasks: Every spec has a door

## Phase 1: User Story 1 - The corpus opens on one page, and every spec has a door

- [ ] T001 [US1] Read the corpus through `factory.roadmap.models.read_roadmap`,
      returning one entry per spec directory in the seam's own order carrying the
      state it declared, in a module of its own rather than inside `read_draft`
      (spec US1-S1, FR-001, FR-003, plan D1, D2).
- [ ] T002 [US1] Report a corpus that cannot be read as a NAMED degraded entry in
      the pane's existing vocabulary, and an empty corpus as an empty corpus —
      never one as the other (spec US1-S4, FR-005, plan Named traps).
- [ ] T003 [US1] Carry the working-tree revision and read instant on the index
      document, through the reader `pane/draft.py` already uses, keeping its
      Unknown Rule behaviour for a directory that is not a repository (spec
      US1-S5, FR-006, plan D3).
- [ ] T004 [US1] Serve the index at bare `/api/draft` on the guarded router, so
      the token covers it by construction and it answers 401 without one (spec
      US1-S6, FR-007).
- [ ] T005 [US1] Render the index as a table: spec directory in mono, its declared
      state as that state's chip from `DESIGN.md`'s vocabulary, and no glyph from
      the eleven-state grammar (spec US1-S3, FR-004, plan D4).
- [ ] T006 [US1] Make the row itself the link to `draftPathFor(specDir)`, with no
      separate control (spec US1-S2, FR-002, plan D5).
- [ ] T007 [US1] Give a `landed` row, and only a `landed` row, an additional
      labelled link to `reviewPathFor(specDir)` (spec US1-S2a, FR-010, plan D5,
      Named traps).
- [ ] T008 [US1] Route bare `/draft` to the index in the app shell, leaving
      `/draft/<spec-dir>` reaching 014's trio view unchanged (spec US1-S1, FR-001,
      plan Named traps).
- [ ] T009 [US1] Add the drafting table to the Masthead, current for any path
      under `/draft` with or without a spec named, and add nothing else (spec
      US1-S7, FR-008, plan D6).
- [ ] T010 [US1] List the new API route and every new source path's pattern in
      `route-manifest.json`, so both manifest tests pass (spec US1-S1, FR-009,
      plan Named traps).
- [ ] T011 [US1] Test that the index's order and declared states are exactly what
      `read_roadmap` returned over a constructed corpus, and that no frontmatter
      is parsed in this repository (spec US1-S1, SC-001).
- [ ] T012 [US1] Test the unreadable-corpus and empty-corpus paths produce their
      two different answers (spec US1-S4, SC-002).
- [ ] T013 [US1] Unit-test that every row's href equals `draftPathFor(specDir)`,
      and that a `landed` row — and only a `landed` row — also carries
      `reviewPathFor(specDir)` (spec US1-S2, US1-S2a, SC-003).
- [ ] T014 [US1] Test that `/api/draft` answers 401 without the bearer token
      (spec US1-S6, FR-007).
- [ ] T015 [US1] Smoke-test the navigation this spec exists to create: Masthead →
      index → a spec's drafting table, with no typed URL anywhere in the test
      (spec US1-S7, SC-005).
