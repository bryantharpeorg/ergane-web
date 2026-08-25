# Data Model: an answer reaches the factory

The pane stores one thing of its own — what the factory *delivered* and what the pane
*carried back* — and joins it at read time to what the factory *reports*. Nothing here
is a second source of truth: the factory's questions store and escalation workflows
settle; this store remembers.

## `attention` (pane-side, stdlib `sqlite3`, `PANE_ATTENTION_DB`)

One row per accepted intake POST.

| Column | Type | Meaning |
|---|---|---|
| `seq` | INTEGER PRIMARY KEY AUTOINCREMENT | arrival order; the only key a Notice has |
| `correlation_id` | TEXT NOT NULL | the factory's id, verbatim (12 hex for Question/Escalation; `supervision`, `roadmap-<root>`, … for a Notice) |
| `kind` | TEXT NOT NULL CHECK (kind IN ('question','escalation','notice')) | classified per FR-002 |
| `text` | TEXT NOT NULL | the factory's `text`, verbatim |
| `actions_json` | TEXT NOT NULL | the delivered `actions` list as JSON, in delivery order, byte-for-byte labels and payloads (`[]` for Question and Notice) |
| `received_at` | TEXT NOT NULL | ISO-8601 UTC, the pane's receipt instant — provenance only; **never** an anchor for a countdown (FR-012) |
| `last_ruling` | TEXT NULL | Question only: the `BridgeOutcome` string `handle_relay` last returned, verbatim |
| `last_ruling_at` | TEXT NULL | when it returned |
| `pressed_choice` | TEXT NULL | Escalation only: the `<CHOICE>` parsed from the pressed payload |
| `signal_state` | TEXT NULL CHECK (signal_state IN ('accepted','SIGNAL_FAILED')) | Escalation only: what the press produced; nothing else can be minted for a press (FR-010) |
| `signalled_at` | TEXT NULL | when the press settled at the RPC |

Index: `CREATE UNIQUE INDEX attention_answerable_id ON attention(correlation_id) WHERE
kind != 'notice'` — intake is idempotent for answerable items and never for Notices
(FR-004).

Invariants:

1. `kind = 'question'` ⇒ `actions_json = '[]'` and `correlation_id` is 12 hex.
2. `kind = 'escalation'` ⇒ every action payload matches `^esc:[0-9a-f]{12}:[A-Za-z0-9_]+$` and `correlation_id` is 12 hex.
3. `kind = 'notice'` ⇒ `actions_json = '[]'`, `correlation_id` is not 12 hex, and every settlement column is NULL forever.
4. `last_ruling` is written only from a `handle_relay` return; `signal_state` only from a signal send. No other code path writes either.
5. No row is ever deleted by the pane (FR-013).

## The Attention item as the Desk reads it (assembled, never stored)

`GET /api/attention` and the `attention` / `floor` events carry:

```text
AttentionItem
  id              'question'/'escalation' → correlation_id; 'notice' → "notice:<seq>"
  kind            'question' | 'escalation' | 'notice'
  correlation_id  verbatim
  text            verbatim
  actions         [{label, payload}] in delivery order (empty for question/notice)
  expires_at      ISO-8601 | null   — from the factory read (D-P9); null until joined or when absent
  settlement      { state: 'waiting' | 'in_flight' | 'ruled' | 'settled' | 'none',
                    ruling: string | null,          — Question: last_ruling verbatim
                    signal: 'accepted' | 'SIGNAL_FAILED' | null,   — Escalation press
                    pressed_choice: string | null,
                    resolution: string | null }     — the factory read's word, verbatim
  degraded        { mode: 'transport' | 'refusal', what: string } | null   — the join that could not be learned
```

Settlement state, derived at read time and nowhere else:

- `none` — a Notice; no countdown, no controls, no settlement (FR-002).
- `in_flight` — the correlation id is in `pane/answer.py`'s in-flight set, **or** an Escalation whose `signal_state = 'accepted'` and whose factory read reports no `resolution` yet (FR-009).
- `settled` — a Question whose `last_ruling = 'RESOLVED'`, or any item whose factory read reports a non-null `resolution`. Leaves the waiting rank (D-P8).
- `ruled` — a Question with any other `last_ruling`, or an Escalation whose `signal_state = 'SIGNAL_FAILED'`. Stays in the waiting rank; SIGNAL_FAILED alone keeps controls live (FR-011).
- `waiting` — everything else.

Rank order on the Desk: `waiting` and `ruled` first (Escalation before Question before
Notice per DESIGN.md's attention ranking), then `in_flight`, then `settled`. An item
whose `expires_at` has passed stays in its rank, reads expired, and keeps its controls
(FR-013).

**Which surface carries which items** (declared in contracts/api.md § Attention list ›
What each surface carries): the floor document's `attention` section carries only the
items whose state is not `settled`; `GET /api/attention` carries all of them, settled
last. No row is ever deleted (invariant 5), so without that split 002's Showfloor badge
— which counts `attention.items.length` as "waiting on you" — would count settled work
forever.

## The joins (read time, outermost reader seams)

| Stored kind | Factory read | Fields taken | Demo source |
|---|---|---|---|
| escalation | `Reader.read_escalation_fate(correlation_id)` — `LiveReader`: the `escalation_status` query on workflow `correlation_id`, falling back to the `open_escalations` entry 001 already reads | `expires_at`, `resolution` | `FixtureReader`: `fixtures/escalations/open_escalations.json` — a bare JSON **array**; its one entry is `d10263341dac`, the correlation id of `fixtures/webhook/escalation.json` |
| question | `Reader.read_question(correlation_id)` — `LiveReader`: `get_question(connect_readonly(<resolved questions store>), correlation_id)` | `expires_at`, `resolution` | `FixtureReader`: `fixtures/questions/pending_questions.json` — an **object** with keys `pending_questions` (list of rows) and `get_question` (one row), not a bare array; its one row is `800ee6b4c7df`, the correlation id of `fixtures/webhook/question.json`, carrying the factory-written `expires_at` `2026-08-23T01:41:13Z` (`sent_at` + 28800 s) |
| notice | none | — | — |

The stored attention item the Desk reads never carries an `expires_at` of the pane's
own making: before the join it is `null`, after the join it is whatever the factory
reported, and a failed join leaves it `null` with a `degraded` entry beside it.

A read that fails (`TransportFailed` / `QueryRefused`, 001's two modes) is a degraded
entry on the item; the item still renders, with no deadline (FR-012) and its delivered
text intact.

## Delivered action

`{label: str, payload: str}` exactly as `factory/notify/webhook.py` sent it. The pane
parses `payload` as `esc:<escalation_id>:<choice>` at press time and produces nothing
of its own; it refuses a press whose payload is not byte-equal to one it stored.
