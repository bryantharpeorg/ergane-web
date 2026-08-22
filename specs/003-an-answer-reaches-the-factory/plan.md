# Implementation Plan: an answer reaches the factory

**Branch**: `003-an-answer-reaches-the-factory` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-an-answer-reaches-the-factory/spec.md`

## Summary

The pane becomes the target of the factory's `ERGANE_WEBHOOK_URL` and the Desk gets
its one verb. Four stories in merge order: an **intake** route that turns the
factory's bare POST into a stored Attention item (Question, Escalation, or Notice)
and pushes it over SSE; the **Answer** itself, riding `CallbackBridge.handle_relay`
for Questions and the `escalation_resolved` signal for Escalations; **honesty** —
every `BridgeOutcome` string rendered verbatim, SIGNAL_FAILED alone retriable, every
countdown anchored on a factory-written `expires_at`; and the **token** that closes
the auth seam 001 shipped open, with the intake route guarded by the credential the
operator embeds in the webhook URL.

The technical approach extends 001's tree in place rather than redesigning it. The
FastAPI app under `pane/` gains one intake route, one answer route, one pane-side
SQLite store of delivered items (stdlib `sqlite3`, no new dependency), an attention
broadcaster that 001's `floor_events()` generator drains alongside its poll, and four
more operations on 001's `Reader` seam — two reads (`read_question`,
`read_escalation_fate`) and two settlements (`settle_question`, `press_escalation`) —
implemented once on `LiveReader` against ergane's functions and once on
`FixtureReader` against the Fixture floor. The React Desk under `web/` gains an
answer column on 001's attention item, a ruling line, and a rank derived from the
backend's settlement state. Everything is proven by committed pytest, vitest, and
headless Playwright tests against the Fixture floor, with the factory's seams
substituted at the `Reader` boundary (constitution IV, V).

Two asymmetries shape the whole design and are not papered over: `handle_relay`
returns the factory's ruling synchronously, while a Temporal signal returns nothing,
so an Escalation press can only be *signal-accepted* or *SIGNAL_FAILED*, and its fate
arrives through the factory's own reads. And the pane's token decides who can see,
while the factory's `escalation.authorized_responders` decides whose Question answers
count — the pane performs no responder check of its own.

## Technical Context

**Language/Version**: Python 3.12 under `uv` (backend); TypeScript 5 under `strict`,
Node 20 under `npm` (frontend). Both worlds, the `Reader` seam, the floor document,
the SSE envelope, the open auth dependency, and the Desk exist in the base because 001
landed (`depends_on_landed`). 001's tree, as its plan names it and as this plan
assumes it: `pane/app.py` (`create_app()`, the guarded SPA catch-all serving
`web/dist`), `pane/config.py` (`Settings` from env), `pane/readers.py` (`Reader`
protocol, `TransportFailed`, `QueryRefused`, `LiveReader`), `pane/fixture_floor.py`
(`FixtureReader`, envelopes, the demo reference instant), `pane/floor_document.py`
(`assemble_floor_document`), `pane/events.py` (`floor_events()`, the `{type, data}`
envelope), `pane/auth.py` (`require_viewer`, open); `GET /api/floor`, `GET
/api/events`; `web/src/api/floorDocument.ts`, `web/src/api/events.ts`,
`web/src/desk/{Desk,AttentionStrip,AttentionItem,DegradedWell}.tsx`,
`web/src/desk/timeLeft.ts`; tests under `tests/`, `web/tests/unit/`,
`web/tests/smoke/`. Where the landed tree names something differently, the tree wins
and the task's intent binds.

**Primary Dependencies**: unchanged from the constitution VII roster. Backend:
`fastapi`, `uvicorn`, `sse-starlette`, `httpx`, `pytest` (+`pytest-asyncio`), and
`ergane-cli==0.2.0` from PyPI (D-011), whose seams this spec imports:

| Seam | Import | Used for |
|---|---|---|
| `CallbackBridge.handle_relay(relay: InboundRelay) -> BridgeOutcome` | `factory.notify.service` | settling a Question (FR-006) |
| `InboundRelay(correlation_id, reply_text, sender_identity)` | `factory.notify.adapter` | the three terms a Question answer is made of |
| `BridgeOutcome` (str Enum: RESOLVED, MALFORMED, UNKNOWN, INVALID_CHOICE, EXPIRED, ALREADY_RESOLVED, SIGNAL_FAILED, UNAUTHORIZED, BRIDGE_ERROR) | `factory.notify.service` | the ruling vocabulary; the pane renders the string, never the enum's meaning |
| `SIGNAL_NAME == "escalation_resolved"` | `factory.notify.service` | the signal a press sends (FR-008) |
| `client.get_workflow_handle(correlation_id).signal(SIGNAL_NAME, args=[escalation_id, choice, identity])` | the Temporal client 001's `LiveReader` already holds | settling an Escalation; the workflow id *is* the correlation id (ergane 041 FR-004) |
| `ESCALATION_STATUS_QUERY == "escalation_status"` → `OpenEscalation(escalation_id, epic_id, node_id, question, expires_at, resolution)` | `factory.escalation.workflow` | an Escalation's fate and its `expires_at` (FR-009, FR-012) |
| `open_escalations(client) -> tuple[OpenEscalation, ...]` | `factory.escalation.client` | already read by 001; the Escalation countdown anchor and fallback fate |
| `get_question(conn, question_id) -> QuestionRecord | None`, `pending_questions(conn)` over `connect_readonly(path)` | `factory.verify.store` | a Question's factory-written `expires_at` and `resolution` (FR-019) |
| `resolve_env_path(ERGANE_VERIFICATION_DB_PATH_ENV, FACTORY_VERIFICATION_DB_PATH_ENV, DEFAULT_VERIFICATION_DB_PATH)` | `factory.env` + `factory.activities.verify_activities` | the questions-store path, resolved the way `ergane answer` resolves it — never hard-coded |
| `install_redaction()`, `register_secret(value)` | `factory.notify.redact` | every log record in the process has the token and the intake credential removed at creation (FR-017) |
| `WEBHOOK_ADAPTER`, `resolve_adapter(WEBHOOK_ADAPTER)` | `factory.notify.webhook`, `factory.notify.adapter` | the adapter handed to `CallbackBridge(adapter=…)` so constructing the bridge resolves no other transport's config |
| `UNKNOWN_SENDER` | `factory.notify.adapter` | the identity when `PANE_ANSWER_IDENTITY` is unset |

Frontend: `react`, `react-dom`, `typescript`, `vite`, `vitest`, `@playwright/test`,
`jsdom`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`. No `@xyflow/react`
or `framer-motion` use in this spec. **No new dependency of any kind.**

**Storage**: one pane-side SQLite file (stdlib `sqlite3`) holding *delivered*
Attention items — the factory's own words, verbatim — plus the pane's record of what
it carried (last ruling, pressed choice, signal state). Path from `PANE_ATTENTION_DB`
(default `.pane/attention.db`, gitignored); demo mode seeds a fresh store from the
recorded webhook payloads at startup. This is not factory state: the factory's
questions store and escalation workflows remain the only arbiters of settlement, and
the pane opens the factory's stores read-only, exactly as 001 does.

**Testing**: pytest (`uv run pytest -q`) with the `Reader` substituted by recorders at
the seam 001 defined; vitest + jsdom under `web/tests/unit/` for the Desk's
rendering; Playwright headless chromium under `web/tests/smoke/` against `PANE_DEMO=1`
for the smoke, with the token supplied through Playwright's `httpCredentials`. No test
needs a live factory.

**Target Platform**: the factory host, a systemd user unit (D-007); the browser is
the operator's laptop beside the terminal. One origin: 001's backend serves
`web/dist` through its guarded catch-all (001 R-006).

**Project Type**: web service (FastAPI) + single-page front end (Vite/React), two
package worlds in one repository (D-006).

**Performance Goals**: the intake route must answer inside the factory's 10-second
delivery window with margin — it does one SQLite insert and one in-memory fan-out,
nothing else (US1-S6). No other goal stated.

**Constraints**: one verb (constitution I); borrowed seams only (II); honest
degradation (III); provable from the diff, headless (IV); fixtures recorded never
invented (V); one token on every route, no credential in any page, event, log, or
fixture (VI); roster-only dependencies (VII); rendering to DESIGN.md (VIII).

**Scale/Scope**: one operator, one token, one identity; tens of Attention items;
two new routes, one extended stream, one extended component, four new `Reader`
operations.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|---|---|---|
| I. One verb | **PASS** | The only non-GET requests the Desk issues are `POST /api/attention/{id}/answer` carrying a Question's text or one of the factory's delivered payloads, from one file (`web/src/api/answer.ts`). No dismiss, snooze, resolve, or pane-side settlement; a Notice renders with no control (US2-S4, FR-007). 001's zero-write sweeps are amended to permit exactly this one verb and nothing else. |
| II. Borrowed seams | **PASS** | Questions settle through `CallbackBridge.handle_relay`; Escalations through the `escalation_resolved` signal; expiry and fate come from `get_question`/`pending_questions`, `open_escalations`, and `escalation_status`; log redaction through `factory.notify.redact`. The pane re-derives nothing: it never decides validity, expiry, or authorization. Nothing shells the CLI. |
| III. Honest degradation | **PASS** | Every ruling string renders verbatim, an unknown string as itself; SIGNAL_FAILED alone says "nothing was recorded". A signal RPC raising is the one ruling the pane derives, because it is the one fact it can observe. A missing `expires_at` shows no deadline. An unreadable questions store or a refused `escalation_status` degrades in 001's two modes (`TransportFailed` / `QueryRefused`) on the item, which still renders. |
| IV. Provable, headless | **PASS** | Every scenario names its committed test; the route-enumeration test reads `app.routes`; the smoke runs Playwright headless with the token configured (SC-006). |
| V. Recorded fixtures | **PASS** | The six `BridgeOutcome` recordings under `fixtures/bridge/` and the webhook, escalation, and question documents are recorded by the operator before readying (FR-018); no task in this plan adds or edits a payload. `FixtureReader` replays them. |
| VI. Token on every route | **PASS** | `require_viewer` closes for every route 001 mounted it on — the floor document, the attention list, the answer route, the SSE stream, and the SPA catch-all — with intake guarded by the URL-carried credential (FR-015) inside the same dependency and enumerated as the one exception in the same test. Both credentials are registered with `register_secret` at startup so no log record carries them; the sweep test covers every committed fixture. |
| VII. Roster only | **PASS** | No new package. The store is stdlib `sqlite3`; the browser carries the token through the HTTP auth challenge it already implements. |
| VIII. Built to DESIGN.md | **PASS** | Every rendering task cites the DESIGN.md section it implements: *Components › Attention Item* (answer column, body-column ruling line, countdown anchor rule), *Components › Buttons* and *Inputs / Fields*, *Typography › The Factory Speaks in Mono Rule*, *Elevation & Depth › The Well Rule*, *Colors › The No-Red Rule* and *The Attention Ranking Rule*. No remote stylesheet; the faces stay under `web/public/fonts/`. |

**Post-design re-check**: PASS, unchanged. The design adds no dependency, no second
write path, and no pane-side judgement of an answer.

## Decisions

Recorded here rather than in a separate research file; each is the answer to a
question an implementer would otherwise have to guess.

- **D-P1 · The intake credential rides the URL path.** `ERGANE_WEBHOOK_URL` is
  `http(s)://<host>/intake/<credential>`. The route is `POST /intake/{credential}`
  and US4 compares the segment with `secrets.compare_digest` against
  `PANE_INTAKE_CREDENTIAL`. Why: `factory/notify/webhook.py` POSTs bare JSON with no
  header and already treats everything after the origin as a secret to redact (spec
  § Context). Unset credential = intake closed (every POST refused, one startup log
  line saying so).
- **D-P2 · Three credentials, three env names, one registration.** `PANE_TOKEN`
  (who can see), `PANE_INTAKE_CREDENTIAL` (the factory's way in),
  `PANE_ANSWER_IDENTITY` (whose answers count — judged by the factory, defaulting to
  `UNKNOWN_SENDER` when unset). They are fields on 001's `Settings`
  (`pane/config.py`); `create_app()` calls `install_redaction()` and passes the first
  two to `register_secret`. US4 makes `create_app()` refuse without `PANE_TOKEN` in
  every mode, demo included — the smoke configures one (SC-006). US1 does not add
  that refusal, because 001's committed smoke runs with no token and US4 is where the
  smokes are rewritten (FR-014).
- **D-P3 · Classification is the spec's, verbatim.** 12-hex `correlation_id` + empty
  `actions` → Question; 12-hex + actions → Escalation (every action payload must match
  `^esc:[0-9a-f]{12}:[A-Za-z0-9_]+$`); non-12-hex + empty actions → Notice; anything
  else → refused with 422, nothing stored. `MALFORMED`/`INVALID_CHOICE`/`BRIDGE_ERROR`
  are members of `BridgeOutcome` the spec does not enumerate; they render verbatim like
  any string (US3-S2), never special-cased.
- **D-P4 · Idempotency is a partial unique index.** `CREATE UNIQUE INDEX … ON
  attention(correlation_id) WHERE kind != 'notice'`; intake uses `INSERT OR IGNORE`
  and answers 2xx either way. Notices always insert a new row (FR-004).
- **D-P5 · In-flight lives in process memory, not the store.** A `set[str]` of
  correlation ids guarded by an `asyncio.Lock` in `pane/answer.py`. A second answer for
  an item in the set gets 409 and no seam call (FR-009); the attention list reports
  `in_flight` for members so a reconnecting Desk renders it. A crash mid-call leaves
  nothing in flight, which is the truth.
- **D-P6 · The answer route decides by the stored kind.** `POST
  /api/attention/{correlation_id}/answer` with `{"text": …}` for a Question or
  `{"payload": "esc:<12hex>:<CHOICE>"}` for an Escalation. The payload must be one the
  factory delivered for that item — escalation id and choice are *parsed* from it,
  workflow id *is* the correlation id (FR-008). A Notice, an unknown id, an empty or
  whitespace-only text, or a payload not among the delivered actions → 4xx, zero seam
  calls.
- **D-P7 · Outcomes are recorded as the factory's strings.** A Question's
  `last_ruling` is `BridgeOutcome.value`; an Escalation's `signal_state` is
  `"accepted"` or `"SIGNAL_FAILED"` (the signal raised) with the pressed choice. The
  pane never mints a ruling for a press.
- **D-P8 · Rank is the factory's to change.** Waiting rank = every answerable item
  that is neither (a) a Question whose `last_ruling` is RESOLVED nor (b) an item a
  factory read reports a `resolution` for (`read_question(...).resolution` for a
  Question; `read_escalation_fate`/`open_escalations` for an Escalation). Every other
  ruling keeps the item where it was. A press or submit alone moves nothing.
- **D-P9 · Countdowns anchor on factory clocks, joined at list time, never at
  intake.** The attention assembly joins each Escalation to its `OpenEscalation`
  (`expires_at`, `resolution`) and each Question to its `QuestionRecord`
  (`expires_at`, `resolution`) through the `Reader`. Intake stores no expiry and the
  `attention` event pushed at intake carries `expires_at: null`; the next poll's
  `floor` event and every list fetch carry the joined value. An item the factory has
  not supplied one for shows no deadline (FR-012). Time left is computed in the
  browser against the document's `reference_instant`, exactly as 001 R-008 does.
- **D-P10 · Demo substitution stays at the `Reader` seam (001 FR-010).**
  `FixtureReader` seeds the attention store from `fixtures/webhook/*.json` at
  startup (through the same `upsert_delivery` intake uses), answers `read_question`
  from `fixtures/questions/pending_questions.json`, `read_escalation_fate` from
  `fixtures/escalations/open_escalations.json`, `settle_question` with the outcome
  recorded in `fixtures/bridge/<PANE_DEMO_RULING or RESOLVED>.json`, and
  `press_escalation` as signal-accepted without sending. A missing recording is a
  degraded read in words (001's loader rule), never an invented value. The assembly
  and the routes are one code path in both modes.
- **D-P11 · The browser carries the token through the HTTP auth challenge; curl and
  tests carry it as a bearer header; one function compares both.** 001 serves the
  shell itself through the guarded catch-all (R-006), so after US4 a browser's first
  navigation must already carry the token — and a browser cannot attach an
  `Authorization: Bearer` header to a navigation, nor can a cookie be set before some
  page has loaded. The one mechanism browsers implement for exactly this is the
  `WWW-Authenticate` challenge: the refusal advertises `Basic realm="ergane pane"`
  alongside `Bearer`; the browser prompts once and thereafter attaches
  `Authorization: Basic base64(<any username>:<token>)` to every same-origin request —
  navigations, `fetch`, and `EventSource` alike — so 001's SSE consumer needs no
  rewrite. `require_viewer` extracts the presented secret from either scheme (the
  bearer value, or the password half of the Basic pair; the username is ignored) and
  `compare_digest`s it against `PANE_TOKEN`. One token, one comparison, one refusal.
  Playwright supplies it as `httpCredentials`. The token never appears in a URL, a
  page, a fixture, or `sessionStorage`. *Rejected*: the URL fragment + `sessionStorage`
  + bearer header (cannot reach a guarded shell); a cookie set by JS (same
  bootstrapping gap, plus a second carrier on the answer route); a token-entry page
  (a second unguarded route the spec does not enumerate).
- **D-P12 · One refusal, fixed bytes.** Status 401, header `WWW-Authenticate: Basic
  realm="ergane pane", Bearer`, body exactly `{"error":"unauthorized"}` — for a
  missing token, a wrong token, and an intake POST carrying neither credential. No
  route name, no floor data, no echo. Produced by one function in `pane/auth.py`.
- **D-P13 · 001's zero-write sweeps become one-write sweeps in US2.** 001's
  `web/tests/unit/noVerb.test.ts` and `web/tests/smoke/desk.spec.ts` assert that the
  Desk issues no non-GET request. The verb is this spec's whole purpose, so US2 amends
  both to assert that the *only* non-GET request is the answer POST from
  `web/src/api/answer.ts` — the control US2-S4 demands. 001's spec anticipated this
  ("Answer is spec 003's"); the amendment is scored as work, not drift.

## Project Structure

### Documentation (this feature)

```text
specs/003-an-answer-reaches-the-factory/
├── plan.md              # This file
├── spec.md              # Feature specification
├── data-model.md        # The stored Attention item, its settlement states, the joins
├── contracts/
│   └── api.md           # Intake, answer, attention list, the `attention` event, the refusal
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

Paths marked *(001)* exist in the base; this spec edits them. Everything else is new.
The story whose diff creates or first edits each file is named.

```text
pane/
├── app.py                 # (001) US1: mount intake + /api/attention; US2: mount answer; US4: redaction, token refusal
├── config.py              # (001) US1: intake_credential, answer_identity, attention_db, demo_ruling; US4: token
├── readers.py             # (001) US2: settle_question / press_escalation on Reader + LiveReader;
│                          #       US3: read_question / read_escalation_fate
├── fixture_floor.py       # (001) US1: seed the store from fixtures/webhook; US2–US3: the fixture halves of the four ops
├── floor_document.py      # (001) US1: the attention section comes from pane/attention.py
├── events.py              # (001) US1: AttentionBroadcaster; floor_events() drains it between polls
├── auth.py                # (001) US4: require_viewer closes — token for every route, credential for intake
├── attention_store.py     # US1: sqlite3 store of delivered items; US2: record_ruling / record_press
├── attention.py           # US1: assemble_attention (union by id, rank); US2: settlement state; US3: the joins
├── intake.py              # US1: POST /intake/{credential}: validate, classify, store, push
└── answer.py              # US2: POST /api/attention/{id}/answer; in-flight registry; both seams

tests/
├── test_intake.py                 # US1
├── test_answer_seams.py           # US2
├── test_rulings_and_countdowns.py # US3
├── test_bridge_fixtures.py        # US3: the six recordings exist, are recorded, and no Escalation ruling fixture exists
├── test_token_gate.py             # US4
├── test_credential_sweep.py       # (001) US4: widened to every committed fixture and the three values
└── test_log_capture.py            # US4

web/src/
├── api/
│   ├── floorDocument.ts   # (001) US1: kind "notice", actions, settlement, nullable expires_at
│   ├── events.ts          # (001) US1: applies `attention` events by upsert
│   └── answer.ts          # US2: the one POST the Desk issues
└── desk/
    ├── Desk.tsx           # (001) US4: a 401 renders the degraded well
    ├── AttentionStrip.tsx # (001) US2: rank from settlement state
    ├── AttentionItem.tsx  # (001) US1: Notice kind; US2: mounts AnswerColumn; US3: mounts RulingLine
    ├── AnswerColumn.tsx   # US2: delivered choices / reply field / "asks for nothing"; in-flight; US3: retriable split
    ├── RulingLine.tsx     # US3: the factory's word, verbatim, in mono
    ├── ruling.ts          # US3: pure — ruling string → {word, retriable, sentence}
    ├── rank.ts            # US2: pure — settlement state → order
    └── timeLeft.ts        # (001) US3: null → "no clock"; past → "expired"

web/tests/unit/
├── attentionEvents.test.ts        # US1
├── AttentionItem.notice.test.tsx  # US1; US4 adds the no-token-in-page assertion
├── AnswerColumn.test.tsx          # US2; US3 adds the retriable split
├── noVerb.test.ts                 # (001) US2: exactly one write, from answer.ts
├── rank.test.ts                   # US2
├── RulingLine.test.tsx            # US3
├── ruling.test.ts                 # US3
└── timeLeft.test.ts               # (001) US3: anchor, null, expired cases
web/tests/smoke/
├── desk.spec.ts                   # (001) US2: one non-GET permitted; US4: authenticates
├── shell.spec.ts                  # (001) US4: authenticates
├── showfloor.spec.ts              # (002, if in the base) US4: authenticates
└── answer.spec.ts                 # US4: SC-006
web/playwright.config.ts           # (001) US4: httpCredentials; webServer exports the three values per run
```

**Structure Decision**: extend 001's two worlds in place. The backend grows one module
per concern so each story's diff is legible to the judge — the store, the assembly,
intake, answer — while the four seam operations land on 001's `Reader` protocol and
its two implementations, because that is the one boundary 001's loader test already
proves is the only place demo substitution happens (001 FR-010). The frontend keeps
001's attention item as the container and adds the answer column, the ruling line,
and the pure rank/ruling helpers as separate files so vitest can prove them without a
DOM where possible. No Showfloor file is touched; the badge 002 builds reads the same
attention section and needs nothing from this spec.

## Story-by-story shape

**US1 · Intake.** `Settings` gains the intake credential, identity, store path;
`pane/attention_store.py` (schema, `upsert_delivery`, `get_item`, `list_items`);
`AttentionBroadcaster` in `pane/events.py` with `floor_events()` draining one
subscriber queue between polls; `pane/intake.py` (`POST /intake/{credential}`:
validate → classify → store → publish → 202), mounted behind 001's still-open
`require_viewer` — the segment is carried, not yet compared; `pane/attention.py`'s
`assemble_attention` replaces 001's attention section and backs `GET
/api/attention`; `FixtureReader` seeds the store from the recorded webhook payloads.
The Desk learns the Notice kind and applies `attention` events.

**US2 · The verb.** `Reader` gains `settle_question(correlation_id, text, identity)
-> str` (`LiveReader`: build `InboundRelay`, construct `CallbackBridge(db_path=<resolved
questions store>, client=<its Temporal client>,
adapter=resolve_adapter(WEBHOOK_ADAPTER))`, return `handle_relay(...).value`;
`FixtureReader`: the recorded outcome) and `press_escalation(correlation_id,
escalation_id, choice, identity) -> None` (`LiveReader`:
`get_workflow_handle(correlation_id).signal(SIGNAL_NAME, args=[escalation_id, choice,
identity])`, raising is the caller's SIGNAL_FAILED; `FixtureReader`: return).
`pane/answer.py` owns the route, the in-flight set, the guards, and the store writes;
`pane/attention.py` derives settlement state. `web/src/desk/AnswerColumn.tsx` renders
exactly the delivered choices or the reply field, disables while in flight, and
issues the one POST; `rank.ts` orders by settlement state; 001's two zero-write
sweeps become one-write sweeps (D-P13).

**US3 · Honesty.** `Reader` gains `read_question(correlation_id) -> QuestionRecord |
None` and `read_escalation_fate(correlation_id) -> OpenEscalation | None`, raising
`TransportFailed`/`QueryRefused` in 001's two modes; `assemble_attention` joins
`expires_at` and `resolution`; `RulingLine.tsx` and `ruling.ts` render any string
verbatim and make SIGNAL_FAILED alone retriable; `timeLeft.ts` renders "no clock" for
null and "expired" for a past anchor, never deleting. A shape test asserts the six
bridge recordings exist with envelopes naming `handle_relay` and that no Escalation
ruling fixture exists.

**US4 · The token.** `Settings` gains `token`; `create_app()` refuses without it and
registers both secrets with `factory.notify.redact`; `require_viewer` closes per D-P11
and D-P12 with intake as the enumerated exception; every committed smoke authenticates
through `httpCredentials`; the route-enumeration, refusal-bytes, intake-credential,
UNAUTHORIZED-verbatim, sweep, and log-capture tests land, and the SC-006 smoke proves
the gate guarded the pane without walling it off.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Table intentionally empty.
