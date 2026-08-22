# Data model: the desk sees the floor

The pane owns no persisted entity (FR-018). What it has are *documents in flight*:
borrowed shapes from ergane, wrapped in pane-side envelopes, assembled once per
read. The field-level contract is in [contracts/floor-document.md](./contracts/floor-document.md);
this file names the entities, where their truth comes from, and the invariants the
tests hold.

## Borrowed shapes (ergane owns them; the pane never redefines them)

| Shape | Owner in ergane 0.2.0 | Fixture |
|---|---|---|
| `FloorStatus` (`specs_root, roadmap, epics[EpicView], queue, drafts, pace, readiness_basis, notes, degraded`) | `factory.cli.status.FloorStatus` | `fixtures/floor/floor-live.json`, `fixtures/floor/floor-quiet.json` |
| `WorkGraph` / `WorkNode` (`id, story_key, persona, spec_ref, requirement_keys, depends_on, depends_on_merged, timeout_override_s`) | `factory.workgraph.models` | `fixtures/workgraphs/*.json` — exactly three graphs: `001-trip-expenses.json`, `002-expense-notes.json`, `077-a-scanner-the-operator-chooses-runs-in-the-loop.json` |
| `epic_status` answer (`epic_state, nodes{id → NodeStatus}, worker_revision, landing_config, landing_overrides`) | `EpicWorkflow.epic_status`; `NodeStatus` in `factory.workgraph.workflow` | `fixtures/epic-status/**/*.json` |
| `NodeState` (eleven values) | `factory.workgraph.models.NodeState` | — |
| Query refusal — the recorded payload's keys are exactly `nodes` (an empty object), `execution_status`, `refusal`, `skew_notice`. There is **no** `refusal_type` and **no** `workflow_id` in the payload; the workflow id lives in the envelope. | the shape `ergane build status --json` prints when `handle.query` is rejected under `NOT_OPEN` | `fixtures/epic-status/refusal.json`; the raised-exception record beside it is `fixtures/epic-status/refusal-exception.json` (`raised, exception_type, message, status` — no `nodes` key at all) |
| `OpenEscalation` (`escalation_id, epic_id, node_id, question, expires_at, resolution`) | `factory.escalation.workflow.OpenEscalation` | `fixtures/escalations/open_escalations.json` (one row), `fixtures/escalations/open_escalations-2.json` (two rows, differing `expires_at`) |
| Stored Question row (`question_id, workflow_id, epic_id, node_id, attempt, question_text, sent_at, expires_at, message_id, resolution, answer_text, resolved_at`) | `factory.verify.store` (`pending_questions` / `get_question`) | `fixtures/questions/pending_questions.json` — an **object** with keys `pending_questions` (a list of rows) and `get_question` (one row), not a bare array; also `expired-question.json` (`outcome`, `get_question`) and `answered-question.json` (one row). Read by 003, not by 001. |
| Webhook payload (`correlation_id, text, actions[]`) | `factory/notify/webhook.py` | `fixtures/webhook/question.json`, `fixtures/webhook/escalation.json`, `fixtures/webhook/notice-supervision.json` |
| `Finding` (`key, category, severity, status, summary, refs, notes, source, occurrences, first_seen, last_seen, promoted_spec, resolved_at, resolution`) | `factory.doctor.models.Finding`; `Severity` ∈ {critical, warning, info}; `Status` ∈ {open, promoted, resolved, regressed} | `fixtures/doctor/findings.json` |
| Rollup (`by, filters, groups[{key, metrics…}], totals{metrics…}`; a metric may be `null`) | `factory.usage.ledger.rollup` | `fixtures/usage/rollup-by-persona.json`, `fixtures/usage/rollup-by-node.json` |
| Envelope sidecar — **two capture families, two key sets** (see below) | `scripts/record-fixtures.py::write`, `scripts/record-fixtures-harness.py` | every `*.envelope.json` |

### Envelope keys by capture family

Provenance lives beside the payload, never inside it (FR-009). The key set is
not uniform, and a shape test that assumes it is will fail against the
committed set:

| Scope | Keys |
|---|---|
| Every sidecar, both families | `captured_at`, `seam`, `notes` |
| Live family — `fixtures/floor/`, `fixtures/epic-status/002-expense-notes/`, `fixtures/workgraphs/`, `fixtures/usage/`, `fixtures/doctor/`, `fixtures/epic-status/skew/` | \+ `source` |
| Harness family — `fixtures/epic-status/{landing,paged,question}/`, `fixtures/epic-status/refusal.json`, `fixtures/epic-status/refusal-exception.json`, `fixtures/escalations/`, `fixtures/questions/`, `fixtures/bridge/`, `fixtures/webhook/`, `fixtures/notices/` | \+ `scene`, `run_id`, `recorder`, `workflow_id`, `ergane_checkout_revision`, `document`, `webhook_url` |
| Per-document extras, **not** family-wide | `host` + `ergane_version` on the seam-read captures (`floor/`, `doctor/`, `usage/`, `epic-status/002-expense-notes/`); `ergane_version` only on `workgraphs/`; `sequence` on the polled `epic-status/002-expense-notes/` directory; `pair_with` on `epic-status/skew/` (which carries neither `host` nor `ergane_version`) |

A sidecar carrying `"status": "pending"` marks a document the operator has not
recorded yet; the loader treats it as a missing document (transport-mode
degraded read), never as an empty payload. No committed sidecar carries that
key today.

## Pane-side entities

### Floor document
One assembled read: `floor`, `epics[]`, `attention`, `health`, `spend_to_date`,
`degraded[]`, `reference_instant`. Produced only by
`pane.floor_document.assemble_floor_document(reader, *, reference_instant)`.

Invariants:
- Every section is present on every document; a failed read leaves `data: null`
  and adds exactly one `DegradedEntry`.
- `degraded` entries carry `mode ∈ {transport, refusal}`; the two modes never
  share an entry and never share a rendering.
- `spend_to_date` is the only spend section; no label contains "live".
- Assembly never raises for a missing key, a `null`, or an unknown state string.

### Reader (the outermost seam)
Protocol in `pane.readers.Reader`: `read_floor() → FloorRead(status, running[EpicRef])`,
`epic_status(workflow_id) → dict`, `workgraph(epic_id) → dict`,
`open_escalations() → list[dict]`, `stored_questions() → list[dict]`,
`list_findings() → list[dict]`, `rollup() → dict`, `reference_instant → str | None`.
Every method either returns a borrowed shape as plain JSON data or raises
`TransportFailed` / `QueryRefused`. Two implementations: `LiveReader`,
`FixtureReader`. Tests may supply stubs.

`EpicRef`: `epic_id`, `workflow_id` (= `factory.cli.nouns.build.workflow_id(epic_id)`),
`scene: str | None`, `workgraph_ref: str` (live: the epic id; demo: the scene's
workgraph file stem).

### Scene (demo only)
A row of `pane.fixture_floor.SCENES`: `(epic_id, status_path, workgraph_path,
scene)`, written out in tasks.md under T023. The composed running list of the demo
floor is `SCENES` followed by any epic `fixtures/floor/floor-live.json` lists that
no scene covers (it lists exactly one, `002-expense-notes`, which the polled scene
already covers). Invariants:

- Every `status_path` exists in the committed layout; a polled directory
  contributes its highest `sequence` envelope.
- `workgraph_path` is set for exactly two scenes — the polled `002-expense-notes`
  scene and the skew scene, which pairs with `fixtures/workgraphs/002-expense-notes.json`
  per its envelope's `pair_with`. `fixtures/workgraphs/` holds only three graphs,
  and the landing, paged, question and refusal scenes are **not** among them:
  their `workgraph_path` is `None`, the reader still reads
  `fixtures/workgraphs/<epic_id>.json`, that document is deliberately absent, and
  the read raises the loader's missing-document `TransportFailed`. Their nodes
  therefore render `declared: false`. That is honest degradation (constitution III),
  not a defect, so no test may assert `degraded == []` against the committed layout.
- `scene` is unique across the table and is what keeps rows distinct: three scenes
  (landing, refusal, skew) were recorded from the one epic `fx-landing-f0a0d6`.
- The table covers the polled live epic, the landing run, paged-while-verifying,
  the question park, the refusal, and the skew pair.

### Node card
One `WorkNode` joined with one `NodeStatus` (see contract `NodeCard`).
Invariants: `declared` is false iff the workgraph lacks the id — including the
whole-epic case where the workgraph read itself failed, which is every scene with
no recorded workgraph in demo mode; every live field has a default;
`awaiting_operator: true` marks the node waiting on the operator regardless of
`state`; the paged-while-verifying node keeps `state: VERIFYING`. `declared: false`
and the paged marker are independent: the paged scene has no recorded workgraph,
so its one card is both, and the undeclared caption must not swallow the paged
marker.

### Attention item
`kind`, `id`, `expires_at`, `resolution`, `source`, `document`. Invariants:
`expires_at` is copied from the borrowed document and never computed; a Question
payload has `expires_at: null`; ordering is escalations before questions, then
ascending `expires_at` (nulls last).

> Forward note (spec 003). 001's Question attention is a stand-in: the recorded
> webhook payload `fixtures/webhook/question.json`, which carries no expiry, so the
> item is served with `expires_at: null`. 003/US3 replaces that source with the
> factory-written `expires_at` from the questions store
> (`fixtures/questions/pending_questions.json` and the live
> `factory.verify.store`) and amends the tests 001 lands. 001 asserts the stand-in;
> it does not weaken its assertions for 003.

### Degraded entry
`section`, `mode`, `epic_id`, `read`, `detail`. Invariant: `detail` is the seam's
own message verbatim (a quoted error, never a paraphrase), with credential-shaped
substrings (`sk-…`, bearer values) redacted before it leaves the backend.

## Rendering derivations (frontend, pure functions, unit-tested)

| Function | Input | Output | Rule |
|---|---|---|---|
| `timeLeft(expiresAt, reference)` | ISO strings | `{kind: "none"}` / `{kind: "expired"}` / `{kind: "remaining", text: "−HH:MM:SS", seconds}` | `expiresAt == null → none`; `expiresAt ≤ reference → expired` (never negative) |
| `milestoneIndex(card)` | `NodeCard` | 0..4 | dispatch=0 for PENDING/KEY_ISSUED/RUNNING/VERIFYING/FAILED/KILLED/WAITING_OPERATOR/unknown; PASSED=1; PR_OPEN=2; ENQUEUED=3; MERGED=4 |
| `trackedStory(cards)` | `NodeCard[]` | the open card with the lowest `milestoneIndex` (ties: workgraph order) or `null` when all MERGED | DESIGN.md milestone bar rule |
| `healthCounts(findings)` | `Finding[]` | `{critical, warning, info}` over `status ∈ {open, regressed}` | FR-021 |
| `floorSummary(doc)` | `FloorDocument` | `"quiet"` / `"unreachable"` / `"busy"` | quiet iff `floor.data` present with no epics and empty queue **and** `attention.items` empty; unreachable iff a `degraded` entry has `section: "floor"` |
| `chevron(card)` | `NodeCard` | `{stateClass, caption, paged, undeclared}` | eleven captions per DESIGN.md; `paged = awaiting_operator && state === "VERIFYING"`; `WAITING_OPERATOR` caption "waiting on you"; undeclared caption "undeclared" |
