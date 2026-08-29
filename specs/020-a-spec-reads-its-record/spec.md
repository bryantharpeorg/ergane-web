---
state: draft
depends_on_landed: []
# THE BUILDABLE HALF OF 007, CARVED OUT 2026-08-29 ON THE D-022/D-025 PRECEDENT.
# 007 stays draft and stays whole; this spec takes only the part of it that is
# provable from seams that exist, with data that survives, today. Its frontmatter
# re-measurement of the same date (#113) is the evidence behind every cut below.
#
# `depends_on_landed: []` IS CORRECT AND IS NOT AN OVERSIGHT. Every room this
# builds on -- 009's landing facts, 013's evidence read, 014's compiled-graph
# stage, 016's replayed demo floor -- is landed. Nothing in this corpus gates it.
# 007 is NOT an edge: this spec opens the room 007's Open Question 4 chose, and
# 007 later fills it when PR-1 makes a durable history exist. The dependency runs
# the other way, and `depends_on_landed` has no spelling for "is a prerequisite
# of", which is fine, because nothing needs one.
#
# IT IS SHAPED 2 -> 1 -> 2 ON PURPOSE, at the operator's request 2026-08-29, and
# the shape is honest rather than decorative. US1 and US2 are two independent
# derivations that share no file; US3 cannot exist without both; US4 and US5 both
# need US3 and neither needs the other. Every spec this repository has ever
# dispatched was a straight line (001-015 chains, 019 three isolated nodes), so
# this is the first work graph the stage will draw that has a join in it. That is
# a deliberate secondary purpose and it is NOT a reason to distort the work: if
# the decomposition below stops being the natural one, the graph changes, not the
# spec.
#
# THE CONCURRENCY IS DECLARED, NOT LUCKED INTO. `max_concurrent_nodes: 2` since
# 2026-08-28, and `ergane.yaml`'s own note says the graph now has to say what the
# 1-node dial used to hide. Each concurrent pair is file-disjoint by construction
# -- see plan.md D1, which lists the paths -- because N38 presents in the merge
# queue rather than in the pull request.
#
# NOT READY, AND THE OPERATOR FLIPS IT. Written by an operator session, not
# derived from a node. `ergane spec validate` should pass on it; that is a
# different claim from "the operator has read it".
---

# Feature Specification: A spec reads its record

**Feature Branch**: `020-a-spec-reads-its-record`
**Created**: 2026-08-29 · **Status**: Draft — written against measured seams
**Input**: the operator's request for the durable half of 007, 2026-08-29

## Context

Spec 007 asks for a room where a finished spec shows how it got built. Its
2026-08-29 re-measurement (#113) established what that costs today: the durable,
append-only store it wants is ergane PR-1 and is **not** in `ergane-cli` 0.5.0;
the model and persona that ran an attempt are PR-2 and are in no column; the
coverage and scan artifacts 015 emits are unreadable by the pane until PR-3
gives them a typed collector; and PR-10 measured away the token counts, so the
usage panel would render empty for every epic built since 002.

**What survived that audit is worth a room on its own.** The verify store's
`node_history` is on constitution II's approved list (D-020) and the pane
already reads it. The landing branch carries every merge instant, SHA and pull
request number, and 009 and 016 already read them live and replayed. Between
them a spec can answer, provably and today: *how many attempts did each story
take, what did each attempt's gates do, how long did the whole thing take, and
where did it need a second try.*

What it cannot answer is equally important and this spec renders it as
`unknown` rather than omitting the question — the discipline 013 already set
with FR-003 and FR-008.

**This room is 007's room, opened early.** 007's Open Question 4 chose a third
room at `/spec/<spec-dir>` over a mode of the Showfloor, on the reasoning that
the material is researched at a desk rather than glanced at on a projector.
That answer stands and this spec builds to it. When PR-1 lands, 007 fills the
same room with cross-dispatch history; it does not build a second one.

## User Scenarios & Testing

### User Story 1 - A story's attempts count themselves (Priority: P1)

As an operator, I can see how many attempts a story took, what each attempt's
gates did, and which attempts were rework — derived from the evidence the verify
store already keeps.

**Why this priority**: it is the question the operator asks first and the only
one the current record can answer completely. It is also a pure derivation over
documents a landed reader already returns, so it can be built and proved with no
new seam and no I/O.

**Acceptance Scenarios**:

1. **Given** the `node_history` documents for one story, **When** the record is
   derived, **Then** it reports the number of attempts, each attempt's verdict,
   and the gate outcomes recorded for it (FR-001).
2. **Given** a story whose history holds more than one attempt, **When** the
   record is derived, **Then** it is marked as rework and the count of extra
   attempts is stated (FR-002).
3. **Given** a story whose history is empty, **When** the record is derived,
   **Then** it reports *no recorded attempt* and never reports zero attempts as
   a measured fact (FR-003).
4. **Given** an attempt carrying a `loop_summary`, **When** the record is
   derived, **Then** the ladder that attempt ran under is carried verbatim and
   is not re-derived from the manifest (FR-004).
5. **Given** an attempt whose row carries no persona and no model — which is
   every row, by PR-2 — **When** the record is derived, **Then** both read
   `unknown` and the derivation does not consult the persona registry (FR-005).

---

### User Story 2 - A spec's clock reads from what landed (Priority: P1)

As an operator, I can see how long a spec took and where the time went, derived
from the landing facts the branch itself carries.

**Why this priority**: equal-first with US1 and independent of it. Wall clock is
the first question anyone asks a build history, and unlike US1's material it
comes from git rather than from a store that a re-dispatch overwrites — so it is
the half of this room that is durable in the strong sense.

**Acceptance Scenarios**:

1. **Given** the landing facts for a spec whose stories all merged, **When** the
   clock is derived, **Then** it reports the span from the first landing to the
   last, and each story's own merge instant (FR-006).
2. **Given** a spec with an unmerged story, **When** the clock is derived,
   **Then** the span is reported as open, naming the stories that have not
   landed, and is never presented as a completed duration (FR-007).
3. **Given** the store's `started_at` and `finished_at` for an attempt, **When**
   the clock is derived, **Then** any interval built from them is labelled as
   *verification* time and never as story time (FR-008).
4. **Given** any interval the available facts cannot bound, **When** the clock is
   derived, **Then** it reads `unknown` under the Unknown Rule — never `0`, never
   a dash (FR-009).

---

### User Story 3 - One route answers with the whole record (Priority: P2)

As an operator, a single guarded route returns one document holding both
derivations for one spec, and says in words whatever it could not read.

**Why this priority**: it is the join. Neither derivation is reachable from a
browser until something assembles them behind a route, and the assembly is the
first place the two can disagree about a story that exists in one and not the
other.

**Acceptance Scenarios**:

1. **Given** a spec directory, **When** `GET /api/spec/<spec-dir>` is called with
   the bearer token, **Then** it answers one document carrying US1's per-story
   record and US2's clock for every story the spec declares (FR-010).
2. **Given** no bearer token, **When** the route is called, **Then** it answers
   401 — the route and the room alike (FR-011).
3. **Given** a read that fails, **When** the document is assembled, **Then** the
   section that needed it degrades in place naming the read and the store, and
   the rest of the document still answers (FR-012).
4. **Given** the epic-wide pace read, **When** the document is assembled, **Then**
   it is taken through `factory.verify.store.attempt_timings` over
   `connect_readonly` — the reader D-020 approved and nothing in this repository
   has yet called — and the pane writes no SQL of its own (FR-013).
5. **Given** a story present in the work graph but absent from the evidence
   store, **When** the document is assembled, **Then** the story appears with its
   record stated as unrecorded rather than being dropped from the list (FR-014).
6. **Given** the document, **When** it is served, **Then** it states that its
   evidence is the **current record only** and does not survive a re-dispatch
   (FR-015).

---

### User Story 4 - The record room reads (Priority: P3)

As an operator, `/spec/<spec-dir>` renders that document as a reading room, in
the second world's tokens, at every supported width and in both themes.

**Why this priority**: the document is useless in a terminal, and this is the
room 007's Open Question 4 chose. It depends on US3 and on nothing US5 does.

**Acceptance Scenarios**:

1. **Given** the document, **When** the room renders, **Then** each story shows
   its attempts, its verdicts, its gate outcomes and its landing, as tables
   rather than as a detail pane (FR-016).
2. **Given** a cell the document reports as unknown, **When** the room renders,
   **Then** it reads `unknown` in the Unknown Rule's face and the word "live"
   appears nowhere near it (FR-017).
3. **Given** the room, **When** it renders at 1280, 1440 and 2560 in both themes,
   **Then** it reports zero violations of the four layout laws (FR-018).
4. **Given** every route the application serves, **When** the manifest test runs,
   **Then** `/spec/<spec-dir>` is in `route-manifest.json` and the test asserts
   it (FR-019).
5. **Given** a landed spec on the Showfloor, **When** the operator looks for its
   record, **Then** a door to this room is on the stage — the room is not
   reachable only by typing a URL, which is 018's lesson (FR-020).

---

### User Story 5 - The demo floor can carry the record (Priority: P3)

As an operator, the recorded floor can hold a real verification history, so the
room demonstrates against a recording rather than against an empty read.

**Why this priority**: `pane/fixture_floor.py` has said *"No such document is
recorded yet"* for `node_history` since 013, and 016's whole lesson is that a
demo floor which cannot answer a read is a room that reads broken. It depends on
US3's document shape and on nothing US4 does.

**Acceptance Scenarios**:

1. **Given** `scripts/record-fixtures.py`, **When** the operator runs its new
   verification verb against a live floor, **Then** it writes one document per
   node, verbatim as the seam returned it, with a provenance envelope beside it
   (FR-021).
2. **Given** a recorded verification document, **When** it is written, **Then**
   it passes this repository's credential sweep, and a document that does not is
   refused rather than redacted (FR-022).
3. **Given** `PANE_DEMO=1` and no recording for a spec, **When** the room is
   opened, **Then** it names the document it looked for, in words, and renders no
   invented history (FR-023).
4. **Given** `PANE_DEMO_TRANSPORT_FAIL=epics`, **When** the room is opened,
   **Then** the record section degrades exactly as a live transport failure would
   (FR-024).

---

### Edge Cases

- A spec whose stories landed under a *different* spec directory name (a rename):
  out of scope; the landing facts key on the directory the branch carries.
- A story that landed by a hand-pushed commit rather than through the queue: it
  has landing facts and no verification row. FR-014 is exactly this case.
- An epic re-dispatched after `build reset`: the store holds only the latest
  dispatch's rows. FR-015 is why the room says so instead of implying completeness.
- A spec with no stories at all (a sketch like 007): the room renders its header
  and states that the spec declares no work graph, rather than an empty table.

## Requirements

### Functional Requirements

- **FR-001**: The build record MUST report, per story, the attempt count, each
  attempt's verdict, and the gate outcomes recorded for that attempt.
- **FR-002**: A story with more than one recorded attempt MUST be marked as
  rework, with the number of extra attempts stated.
- **FR-003**: A story with no recorded attempt MUST be reported as unrecorded and
  MUST NOT be reported as zero attempts.
- **FR-004**: The ladder an attempt ran under MUST be carried verbatim from
  `loop_summary` and MUST NOT be re-derived from `ergane.yaml`.
- **FR-005**: Persona and model MUST read `unknown`; the derivation MUST NOT
  consult the persona registry to guess them.
- **FR-006**: The clock MUST report a spec's span from first landing to last, and
  each story's merge instant, from landing facts.
- **FR-007**: A spec with an unmerged story MUST report an open span naming those
  stories, and MUST NOT present it as a completed duration.
- **FR-008**: Any interval derived from the store's attempt timestamps MUST be
  labelled verification time, never story time.
- **FR-009**: Any interval the available facts cannot bound MUST read `unknown`,
  never `0` and never a dash.
- **FR-010**: `GET /api/spec/<spec-dir>` MUST answer one document carrying both
  derivations for every story the spec declares.
- **FR-011**: The route and the room MUST both answer 401 without the bearer token.
- **FR-012**: A failed read MUST degrade in-section naming the read and the store,
  and MUST NOT fail the whole document.
- **FR-013**: The epic-wide pace read MUST go through
  `factory.verify.store.attempt_timings` over `connect_readonly`; the pane MUST
  write no SQL of its own.
- **FR-014**: A story in the work graph with no evidence row MUST appear in the
  document as unrecorded rather than be omitted.
- **FR-015**: The document MUST state that its evidence is the current record only
  and does not survive a re-dispatch.
- **FR-016**: The room MUST render each story's attempts, verdicts, gate outcomes
  and landing as tables.
- **FR-017**: An unknown cell MUST render under the Unknown Rule, with no "live"
  wording adjacent.
- **FR-018**: The room MUST report zero violations of the four layout laws at
  1280, 1440 and 2560 in both themes.
- **FR-019**: `/spec/<spec-dir>` MUST be listed in `route-manifest.json`, and a
  committed test MUST assert the manifest matches the routes served.
- **FR-020**: A landed spec's stage MUST carry a door to this room.
- **FR-021**: `scripts/record-fixtures.py` MUST gain a verb that records
  verification history verbatim, one document per node, with a provenance
  envelope.
- **FR-022**: A recorded document MUST pass the credential sweep; one that does
  not MUST be refused rather than redacted.
- **FR-023**: Under `PANE_DEMO=1` with no recording, the room MUST name the
  document it looked for and MUST render no invented history.
- **FR-024**: `PANE_DEMO_TRANSPORT_FAIL=epics` MUST degrade the record section as
  a live transport failure does.

### Key Entities

- **The build record** — per story: attempts, verdicts, gate outcomes, the ladder
  each attempt ran under, and whether it was rework. Derived from `node_history`
  documents; owns no I/O.
- **The clock** — per spec: the landing span and each story's merge instant, plus
  verification intervals labelled as such. Derived from landing facts and
  `attempt_timings`; owns no I/O.
- **The record document** — the assembled answer of `/api/spec/<spec-dir>`, one
  entry per declared story, carrying both derivations and every read's degraded
  state.

## Success Criteria

- **SC-001**: For every landed spec in this corpus, the room answers with a
  per-story record and a span, or says in words what it could not read.
- **SC-002**: No number in the room is invented: every cell is traceable to a
  seam's own output or reads `unknown`.
- **SC-003**: The room never implies its evidence is complete history. The
  current-record statement is present whenever a record is shown.
- **SC-004**: The pane writes no SQL and names no column of ergane's schema.

## Assumptions

- **`attempt_timings` is legal and unused.** D-020 put it on constitution II's
  approved list with `node_history`; grepping `pane/` on 2026-08-29 shows
  `node_history` called and `attempt_timings` called nowhere. US3 is its first
  caller, which needs no new decision.
- **The room is `/spec/<spec-dir>`**, which 007's Open Question 4 chose. This
  spec opens it; 007 fills it later.
- **`DESIGN.md` carries this room before this spec builds it** (constitution
  VIII, the D-016/D-019/D-023 pattern). The section and its decision land in the
  same operator pull request as this trio, not inside an attempt.

## Out of scope

- **Cross-dispatch history.** The store keeps one row per
  `(epic, node, attempt, form)` and a re-dispatch overwrites it. That is ergane
  PR-1 and it is not in 0.5.0. FR-015 states the limit instead of working around
  it; **a pane-side archive is forbidden** by constitution I until a decision
  says otherwise, and no such decision exists.
- **Token counts, by persona or otherwise.** PR-10 measured 0 usage rows for
  every epic this repository built after 002. A panel whose every cell reads
  unknown teaches the operator to ignore the room. It returns when the data does.
- **Coverage and security attestation.** 015 emits the artifacts and forbids the
  pane reading them; PR-3 is the collector that changes that. Unchanged here.
- **Model and persona as facts.** PR-2. FR-005 renders them unknown, and guessing
  from the registry is specifically forbidden because the debugger rung relabels
  the persona without re-resolving the model.
- **Resolved escalation history.** It was in this spec's first draft and was cut
  on measurement: `pending_escalations` filters `WHERE resolution IS NULL` and
  its own docstring calls resolved rows "history"; `get_escalation` needs an id
  the pane does not have. **There is no exported reader that returns an epic's
  resolved escalations**, and constitution II forbids the pane writing the query
  itself. Filed as a new platform requirement rather than worked around.
- **Any write path.** This is a reading room.

## Work Graph

```yaml
US1:
  depends_on: []
  depends_on_merged: []
  implements: [FR-001, FR-002, FR-003, FR-004, FR-005]
  timeout: 3600
US2:
  depends_on: []
  depends_on_merged: []
  implements: [FR-006, FR-007, FR-008, FR-009]
  timeout: 3600
US3:
  depends_on: []
  depends_on_merged: [US1, US2]
  implements: [FR-010, FR-011, FR-012, FR-013, FR-014, FR-015]
  timeout: 3600
US4:
  depends_on: []
  depends_on_merged: [US3]
  implements: [FR-016, FR-017, FR-018, FR-019, FR-020]
  timeout: 3600
US5:
  depends_on: []
  depends_on_merged: [US3]
  implements: [FR-021, FR-022, FR-023, FR-024]
  timeout: 3600
```
