# Contracts: an answer reaches the factory

Four surfaces. Every one but intake sits behind the shared token; intake sits behind
the credential in its own path. All bodies are JSON.

## The token (every route 001 mounted `require_viewer` on, D-P11)

One string, `PANE_TOKEN`, presented in either of two carriers and compared by one
function:

```http
Authorization: Bearer <token>                          # curl, pytest, the factory-side operator
Authorization: Basic base64(<any-username>:<token>)    # the browser, after answering the challenge once
```

The username in the Basic pair is ignored. Navigations, `fetch`, and `EventSource`
all carry the browser's stored answer, so the SPA catch-all, the floor document, the
attention list, the answer route, and the SSE stream are reachable from a browser
without any page loading first.

## The refusal (every guarded route, D-P12)

Missing token, wrong token, or an intake POST with neither credential — one shape,
byte-identical in every case:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Basic realm="ergane pane", Bearer
Content-Type: application/json

{"error":"unauthorized"}
```

Nothing else: no route name, no floor data, no echo of what was sent.

## Intake — `POST /intake/{credential}`

The route `ERGANE_WEBHOOK_URL` names. The factory sends exactly this and no header:

```json
{"correlation_id": "a1b2c3d4e5f6", "text": "…", "actions": [{"label": "Kill", "payload": "esc:a1b2c3d4e5f6:KILL"}]}
```

| Case | Response | Stored |
|---|---|---|
| `{credential}` ≠ `PANE_INTAKE_CREDENTIAL` (or none configured) | the refusal | nothing |
| 12-hex `correlation_id`, `actions == []` | `202 {"stored":"question","correlation_id":…}` | Question |
| 12-hex `correlation_id`, `actions` non-empty, every payload `^esc:[0-9a-f]{12}:[A-Za-z0-9_]+$` | `202 {"stored":"escalation",…}` | Escalation, labels and payloads verbatim, delivery order |
| non-12-hex `correlation_id`, `actions == []` | `202 {"stored":"notice",…}` | a new Notice row every time |
| already stored Question/Escalation id | `202` (same body as first delivery) | nothing new |
| missing `correlation_id` or `text`, non-12-hex id with actions, any malformed action payload, non-object body | `422 {"error":"malformed"}` | nothing |

Order inside the handler: validate → classify → commit → publish one `attention`
event → respond. No Temporal call, no settlement seam, no factory-store read.

## Attention list — `GET /api/attention`

`200` → `{"items": [AttentionItem, …], "degraded": [...]}` in rank order (see
data-model.md). The same list is the `attention` section of 001's floor document
(`GET /api/floor`), whose `reference_instant` the Desk counts down against.

## Answer — `POST /api/attention/{correlation_id}/answer`

Body is one of:

```json
{"text": "ship it"}                        // Question
{"payload": "esc:a1b2c3d4e5f6:KILL"}       // Escalation — must be a delivered payload
```

| Case | Seam call | Response |
|---|---|---|
| unknown id, or a Notice | none | `404 {"error":"no_such_item"}` / `422 {"error":"not_answerable"}` |
| id in flight | none | `409 {"error":"in_flight"}` |
| Question, `text` empty or whitespace-only | none | `422 {"error":"empty_answer"}` |
| Question, text present | one `handle_relay(InboundRelay(correlation_id, text, PANE_ANSWER_IDENTITY))` | `200 {"kind":"question","ruling":"<BridgeOutcome.value>"}` |
| Escalation, payload not among delivered | none | `422 {"error":"not_delivered"}` |
| Escalation, payload delivered | one `signal("escalation_resolved", args=[escalation_id, choice, identity])` on workflow `correlation_id` | `200 {"kind":"escalation","signal":"accepted"}` or `200 {"kind":"escalation","signal":"SIGNAL_FAILED"}` when the RPC raised |

The ruling string is passed through verbatim, unknown values included. After any
`200`, one `attention` event carrying the updated item is published.

## SSE — `GET /api/events` (001's endpoint, extended)

001 defines `{type: "floor", data: <floor document>}`. This spec adds:

```json
{"type": "attention", "data": <AttentionItem>}
```

Emitted in the same handling as intake storage and after every answer, interleaved
with the per-subscriber `floor` events 001's `floor_events()` already yields; no
event is cached (001 R-007). Consumers ignore types they do not know (001 FR-016).
The stream requires the token like every other route; the browser's `EventSource`
carries the stored challenge answer, so 001's consumer is unchanged in transport.

## Configuration

| Variable | Meaning | Unset |
|---|---|---|
| `PANE_TOKEN` | the shared token every route requires | backend refuses to start (US4 onward) |
| `PANE_INTAKE_CREDENTIAL` | the path segment `ERGANE_WEBHOOK_URL` carries | intake refuses every POST; one startup log line says so |
| `PANE_ANSWER_IDENTITY` | `sender_identity` / the signal's third arg | `factory.notify.adapter.UNKNOWN_SENDER` |
| `PANE_ATTENTION_DB` | the pane-side store path | `.pane/attention.db` |
| `PANE_DEMO_RULING` | demo mode: which recorded `fixtures/bridge/<OUTCOME>.json` a Question answer returns | `RESOLVED` |

No variable's value may appear in a page, an event, a log line, or a fixture.
