# Contract: the floor document and the event stream

The pane has one read. This document is what `GET /api/floor` returns and what
every `floor` event on `GET /api/events` carries. 002's Showfloor renders the same
document; 003 adds the `attention` event type and the Notice kind by extension.
Borrowed shapes are carried verbatim (constitution II, V); the pane adds only the
envelopes described here.

## Routes (spec 001)

| Route | Method | Auth | Body |
|---|---|---|---|
| `/api/floor` | GET | `require_viewer` (open in 001) | `FloorDocument` JSON |
| `/api/events` | GET | `require_viewer` | `text/event-stream`; each event `data:` line is one `Event` JSON |
| `/{path:path}` | GET | `require_viewer` | a file under `web/dist`, else `index.html`; `503` in words when no build exists |

No other route exists. `/docs`, `/redoc`, and `/openapi.json` are disabled.

## `FloorDocument`

```jsonc
{
  "reference_instant": "2026-08-22T17:19:31+00:00" | null,   // demo: the attention capture instant; live: null
  "floor": {
    "seam": "factory.cli.status.collect_floor",
    "data": FloorStatus | null                                  // verbatim `ergane status --json` shape
  },
  "epics": [ EpicEntry, ... ],                                  // one per running epic (FloorRead.running)
  "attention": {
    "seam": "factory.escalation.client.open_escalations + stored Question documents",
    "items": [ AttentionItem, ... ]                             // ranked: escalations, then questions; by expires_at
  },
  "health": {
    "seam": "factory.doctor.store.list_findings over connect_readonly",
    "data": [ Finding, ... ] | null                             // verbatim Finding rows
  },
  "spend_to_date": {
    "seam": "factory.usage.ledger.rollup over factory.usage.cli.open_readonly",
    "data": Rollup | null                                       // verbatim {by, filters, groups, totals}; NULL stays null
  },
  "degraded": [ DegradedEntry, ... ]
}
```

Rules:

- A section whose read failed keeps its `seam` and carries `data: null` (or
  `items: []` for attention) **and** one `DegradedEntry`; no section is omitted.
- No key, label, or string anywhere in the document contains the word `live`.
- Every field of a borrowed shape is passed through untouched; the pane does not
  rename, coerce, or default *inside* a borrowed document. Defaults apply only in
  the pane-side join (`NodeCard`).

### `EpicEntry`

```jsonc
{
  "epic_id": "002-expense-notes",
  "workflow_id": "epic-002-expense-notes",                     // factory.cli.nouns.build.workflow_id(epic_id)
  "scene": null | "paged-while-verifying",                     // demo only: which recorded scene this entry is
  "epic_state": "RUNNING" | "unknown",                         // from the epic_status answer; "unknown" when absent
  "nodes": [ NodeCard, ... ],                                   // workgraph order first, then undeclared nodes
  "status_seam": "EpicWorkflow.epic_status on epic-<epic_id>",
  "workgraph_seam": "<specs_root>/<epic_id>/workgraph.json"
}
```

An epic whose `epic_status` read failed still appears with `nodes` built from the
workgraph alone (every live field defaulted) and a `DegradedEntry` naming it. An
epic whose workgraph read failed appears with `nodes` built from the answer alone
(every node `declared: false`).

### `NodeCard`

```jsonc
{
  "id": "us1",
  "declared": true,                 // false when the answer names a node the workgraph does not (FR-026)
  "story_key": "US1" | null,
  "persona": "implementer" | null,  // status.persona when non-empty, else the workgraph's, else null
  "spec_ref": "002-expense-notes:US1" | null,
  "depends_on": ["us0"] | null,
  "depends_on_merged": ["us1"] | null,
  "state": "PENDING" | "KEY_ISSUED" | "RUNNING" | "VERIFYING" | "PASSED" | "PR_OPEN" | "ENQUEUED" | "MERGED" | "FAILED" | "KILLED" | "WAITING_OPERATOR" | "unknown",
  "attempt": 1 | null,
  "awaiting_operator": false,       // default false; true marks the node waiting on the operator regardless of state
  "landing_state": "PR_OPEN" | "ENQUEUED" | "MERGED" | "REJECTED" | "KILLED" | null,
  "pr_number": 12 | null,
  "verified": false
}
```

### `AttentionItem`

```jsonc
{
  "kind": "escalation" | "question",              // 003 adds "notice"
  "id": "8d1e0f3a2b4c",                           // escalation_id or the payload's correlation_id
  "expires_at": "2026-08-22T18:19:31+00:00" | null, // factory-written only; null for a Question payload in 001
  "resolution": null | "RESOLVED",               // escalations only; null while open
  "source": "open_escalations" | "stored_questions",
  "document": OpenEscalation | WebhookPayload     // verbatim
}
```

### `DegradedEntry`

```jsonc
{
  "section": "floor" | "epics" | "attention" | "health" | "spend_to_date",
  "mode": "transport" | "refusal",
  "epic_id": "053-worker-skew" | null,            // set for per-epic reads
  "read": "epic_status" | "workgraph" | "collect_floor" | "open_escalations" | "stored_questions" | "list_findings" | "rollup",
  "detail": "the seam's own message, verbatim"
}
```

`transport`: the read could not be made (connection refused, a store that does
not exist, a missing fixture document). `refusal`: the read was made and the
other side declined to answer (a Temporal query rejected or failed). They are
never merged into one entry, and a view renders them with different words.

## `Event` (SSE envelope)

```jsonc
{ "type": "floor", "data": FloorDocument }
```

- Exactly one type in 001: `floor`, a full snapshot per poll cycle. The first
  event on any subscription is a full snapshot, so a reconnecting client never
  applies a diff against state it no longer holds.
- Consumers ignore an event whose `type` they do not know, without error.
- The poll interval is `PANE_POLL_INTERVAL_S` (float seconds; committed default
  `15`).
- No credential value ever appears in an event.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `PANE_DEMO` | unset | `1` selects the fixture reader |
| `PANE_FIXTURES_ROOT` | `<repo>/fixtures` | where the fixture reader looks |
| `PANE_DEMO_TRANSPORT_FAIL` | unset | comma-separated sections whose demo reads raise `TransportFailed` |
| `PANE_SPECS_ROOT` | `factory.workgraph.cli.DEFAULT_SPECS_ROOT` | live: where `<epic_id>/workgraph.json` lives |
| `PANE_POLL_INTERVAL_S` | `15` | SSE poll cycle |
| `PANE_WEB_DIST` | `<repo>/web/dist` | the built frontend the catch-all serves |

Ledger, doctor store, and Temporal are resolved by ergane's own resolvers and
environment chain (`ERGANE_LEDGER_PATH`, the runtime root, `TEMPORAL_ADDRESS`);
the pane reads none of those variables itself.
