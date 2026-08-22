# Data model: the desk sees the floor

The pane owns no persisted entity (FR-018). What it has are *documents in flight*:
borrowed shapes from ergane, wrapped in pane-side envelopes, assembled once per
read. The field-level contract is in [contracts/floor-document.md](./contracts/floor-document.md);
this file names the entities, where their truth comes from, and the invariants the
tests hold.

## Borrowed shapes (ergane owns them; the pane never redefines them)

| Shape | Owner in ergane 0.2.0 | Fixture |
|---|---|---|
| `FloorStatus` (`specs_root, roadmap, epics[EpicView], queue, drafts, pace, readiness_basis, notes, degraded`) | `factory.cli.status.FloorStatus` | `floor/floor-live.json`, `floor/floor-quiet.json` |
| `WorkGraph` / `WorkNode` (`id, story_key, persona, spec_ref, requirement_keys, depends_on, depends_on_merged, timeout_override_s`) | `factory.workgraph.models` | `workgraphs/*.json` |
| `epic_status` answer (`epic_state, nodes{id → NodeStatus}, worker_revision, landing_config, landing_overrides`) | `EpicWorkflow.epic_status`; `NodeStatus` in `factory.workgraph.workflow` | `epic-status/**/*.json` |
| `NodeState` (eleven values) | `factory.workgraph.models.NodeState` | — |
| Query refusal (`epic_id, workflow_id, refusal, refusal_type, nodes: {}`) | the shape `ergane build status --json` prints | `epic-status/harness/refusal.json` |
| `OpenEscalation` (`escalation_id, epic_id, node_id, question, expires_at, resolution`) | `factory.escalation.workflow.OpenEscalation` | `escalations/open_escalations.json` |
| Webhook payload (`correlation_id, text, actions[]`) | `factory/notify/webhook.py` | `webhook/question.json`, `webhook/escalation.json`, `webhook/notice-supervision.json` |
| `Finding` (`key, category, severity, status, summary, refs, notes, source, occurrences, first_seen, last_seen, promoted_spec, resolved_at, resolution`) | `factory.doctor.models.Finding`; `Severity` ∈ {critical, warning, info}; `Status` ∈ {open, promoted, resolved, regressed} | `doctor/findings.json` |
| Rollup (`by, filters, groups[{key, metrics…}], totals{metrics…}`; a metric may be `null`) | `factory.usage.ledger.rollup` | `usage/rollup-by-persona.json` |
| Envelope sidecar (`captured_at, seam, source, host, ergane_version, notes, sequence?, status?`) | `scripts/record-fixtures.py::write` | every `*.envelope.json` |

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
scene)`. The composed running list of the demo floor is `SCENES` followed by any
epic `floor-live.json` lists that no scene covers. Invariants: every path exists in
the committed layout; a polled directory contributes its highest `sequence`; the
table covers the paged-while-verifying, refusal, skew, and landing-run scenes.

### Node card
One `WorkNode` joined with one `NodeStatus` (see contract `NodeCard`).
Invariants: `declared` is false iff the workgraph lacks the id; every live field
has a default; `awaiting_operator: true` marks the node waiting on the operator
regardless of `state`; the paged-while-verifying node keeps `state: VERIFYING`.

### Attention item
`kind`, `id`, `expires_at`, `resolution`, `source`, `document`. Invariants:
`expires_at` is copied from the borrowed document and never computed; a Question
payload has `expires_at: null`; ordering is escalations before questions, then
ascending `expires_at` (nulls last).

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
