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
the seam 001 defined, and — from US4 — a `tests/conftest.py` that mints the token,
intake credential, and answer identity with `secrets.token_hex` and hands out an
authenticated `TestClient`, because closing the gate rewrites every landed test that
calls a route; vitest + jsdom under `web/tests/unit/` for the Desk's
rendering; Playwright headless chromium under `web/tests/smoke/` against `PANE_DEMO=1`
for the smoke, with the token supplied through Playwright's `httpCredentials`. No test
needs a live factory, and no committed test file contains a credential literal.

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
operations plus one replaced (001's `stored_questions` becomes `stored_items`, so the
attention section has one source in both modes). Two epics build concurrently over
four shared files (D-P16).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|---|---|---|
| I. One verb | **PASS** | The only non-GET requests the Desk issues are `POST /api/attention/{id}/answer` carrying a Question's text or one of the factory's delivered payloads, from one file (`web/src/api/answer.ts`). No dismiss, snooze, resolve, or pane-side settlement; a Notice renders with no control (US2-S4, FR-007). 001's zero-write sweeps are amended to permit exactly this one verb and nothing else. |
| II. Borrowed seams | **PASS** | Questions settle through `CallbackBridge.handle_relay`; Escalations through the `escalation_resolved` signal; expiry and fate come from `get_question`/`pending_questions`, `open_escalations`, and `escalation_status`; log redaction through `factory.notify.redact`. The pane re-derives nothing: it never decides validity, expiry, or authorization. Nothing shells the CLI. |
| III. Honest degradation | **PASS** | Every ruling string renders verbatim, an unknown string as itself; SIGNAL_FAILED alone says "nothing was recorded". A signal RPC raising is the one ruling the pane derives, because it is the one fact it can observe. A missing `expires_at` shows no deadline. An unreadable questions store or a refused `escalation_status` degrades in 001's two modes (`TransportFailed` / `QueryRefused`) on the item, which still renders. |
| IV. Provable, headless | **PASS** | Every scenario names its committed test; the route-enumeration test reads `app.routes`; the smoke runs Playwright headless with the token configured (SC-006). |
| V. Recorded fixtures | **PASS** | The **five** `BridgeOutcome` recordings under `fixtures/bridge/` — `RESOLVED`, `ALREADY_RESOLVED`, `UNKNOWN`, `EXPIRED`, `UNAUTHORIZED`, each named for its ruling and shaped `{"relay": …, "outcome": "<RULING>"}` — plus `malformed-relay.json` (the adapter refusal: `relay: null`, `outcome: null`, no bridge call) and the webhook, escalation, and question documents are recorded by the operator before readying (FR-018); no task in this plan adds or edits a payload. `SIGNAL_FAILED` is **not** recorded: it needs an orchestrator the signal cannot reach, which the capture could not stage — so its shape test skips that case by name (tasks.md T053) and no stand-in is written. This is the principle working, not a gap: the pane still derives SIGNAL_FAILED at runtime from the signal RPC raising, which is an observation, not a recording. `FixtureReader` replays what exists. |
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
  from `fixtures/questions/pending_questions.json` (an object keyed
  `pending_questions` / `get_question`, not a bare array), `read_escalation_fate` from
  `fixtures/escalations/open_escalations.json` (a bare array of one entry),
  `settle_question` with the `outcome` recorded in
  `fixtures/bridge/<PANE_DEMO_RULING or RESOLVED>.json` — the five recorded rulings are
  RESOLVED, ALREADY_RESOLVED, UNKNOWN, EXPIRED, UNAUTHORIZED, and SIGNAL_FAILED is not
  among them because it was never recordable — and `press_escalation` as
  signal-accepted without sending. A `PANE_DEMO_RULING` naming a document that is not
  on disk is a degraded read in words (001's loader rule), never an invented value. The
  assembly and the routes are one code path in both modes.
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
- **D-P14 · `subscribeFloor` gains an OPTIONAL third argument.** 001's consumer is
  `subscribeFloor(url, onFloor)`; US1 needs it to deliver `attention` events too. The
  signature becomes `subscribeFloor(url, onFloor, onAttention?)` — third argument
  optional — so every landed call site compiles unchanged under `strict` and a
  subscriber that passes none drops `attention` events exactly as it drops an unknown
  type (001 FR-016). Why it matters: 002's `web/src/showfloor/Showfloor.tsx` calls the
  two-argument form and 002 and 003 build concurrently, landing in either order; a
  required third argument would break whichever landed second, in a file this spec has
  no business editing. *Rejected*: a second exported function (two consumers, two
  `EventSource` policies) and a required callback (breaks 002's call site).
- **D-P15 · The floor document's `attention.items` is the unsettled list; `GET
  /api/attention` is the whole list.** Nothing in this data model deletes a row, and
  002's Showfloor badge counts `attention.items.length` as "waiting on you" — so a
  settled item left in the floor document's section would be counted as waiting
  forever. The floor document carries only items whose `settlement.state` is not
  `settled`; the attention route carries every item in rank order with the settled
  ones last, so nothing is hidden and nothing is deleted. Declared in contracts/api.md
  § Attention list › What each surface carries and cited from tasks.md T008, the task
  that builds the list. Settlement is still the factory's word alone (D-P8): a press
  or a submit removes nothing from either surface.
- **D-P16 · 002 and 003 build concurrently; four shared files, named in the tasks that
  touch them.** The roadmap runs both epics after 001 lands
  (`roadmap.max_concurrent_epics: 2`) and there is no cross-spec ordering edge, so
  either may land first. The overlap: `pane/floor_document.py` (003 T008 ∥ 002 T006),
  `pane/fixture_floor.py` (003 T004/T022/T040/T041 ∥ 002 T033),
  `web/src/api/floorDocument.ts` (003 T010 ∥ 002 T016), and `web/src/api/events.ts`
  (003 T010 ∥ 002 T025/T055). Two rules follow. First, 003's edit to
  `pane/floor_document.py` is reduced to **one line** — the call into the new
  `pane/attention.py`, where every rule of the attention list lives — so the two
  epics' hunks cannot overlap and 001's purity sweep over that module still passes.
  Second, every task above names its concurrent sibling in its own text, because an
  implementer who does not know a file is contended will reformat it.

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
├── readers.py             # (001) US1: stored_items() replaces 001's stored_questions() on Reader + both impls;
│                          #       US2: settle_question / press_escalation on Reader + LiveReader;
│                          #       US3: read_question / read_escalation_fate
├── fixture_floor.py       # (001) US1: seed the store from fixtures/webhook; US2–US3: the fixture halves of the four ops
│                          #       ⚠ shared with 002 (its SCENES row) — D-P16
├── floor_document.py      # (001) US1: ONE line — the attention section calls pane/attention.py
│                          #       ⚠ shared with 002 (its stage join) — D-P16
├── events.py              # (001) US1: AttentionBroadcaster; floor_events() drains it between polls
├── auth.py                # (001) US4: require_viewer closes — token for every route, credential for intake
├── attention_store.py     # US1: sqlite3 store of delivered items; US2: record_ruling / record_press
├── attention.py           # US1: assemble_attention (union by id, rank); US2: settlement state; US3: the joins
├── intake.py              # US1: POST /intake/{credential}: validate, classify, store, push
└── answer.py              # US2: POST /api/attention/{id}/answer; in-flight registry; both seams

tests/
├── conftest.py                    # US4: mints the three values (secrets.token_hex) and the authenticated TestClient
├── test_intake.py                 # US1
├── test_answer_seams.py           # US2
├── test_rulings_and_countdowns.py # US3
├── test_bridge_fixtures.py        # US3: the five recordings exist and are recorded; malformed-relay is not a ruling;
│                                  #      SIGNAL_FAILED is skipped by name; no Escalation ruling fixture exists
├── test_token_gate.py             # US4
├── test_credential_sweep.py       # (001) US4: widened to every committed fixture and the three values
├── test_log_capture.py            # US4
├── test_readonly_sweep.py         # (001) US1: the sqlite3.connect rule narrowed to factory stores
├── test_fixture_loader.py         # (001) US1: attention assertions move to the seeded store; US4: authenticates
├── test_floor_document.py         # (001) US1: attention-section assertions follow the assembly
├── test_auth_seam.py              # (001) US4: the open-interim assertion becomes the closed-gate assertion
├── test_events.py                 # (001) US4: authenticates
├── test_scaffold.py               # (001) US4: the catch-all cases authenticate
└── test_stage.py                  # (002, if in the base) US4: its /api/floor fetch authenticates

web/src/
├── api/
│   ├── floorDocument.ts   # (001) US1: kind "notice", actions, settlement, nullable expires_at
│   │                      #       ⚠ shared with 002 (EpicEntry.stage) — D-P16
│   ├── events.ts          # (001) US1: applies `attention` events by upsert; subscribeFloor gains an
│   │                      #       OPTIONAL third argument (D-P14) — ⚠ shared with 002's call sites
│   └── answer.ts          # US2: the one POST the Desk issues
└── desk/
    ├── Desk.tsx           # (001) US4: a 401 renders the degraded well
    ├── AttentionStrip.tsx # (001) US2: rank from settlement state
    ├── AttentionItem.tsx  # (001) US1: Notice kind; US2: mounts AnswerColumn; US3: mounts RulingLine
    ├── AnswerColumn.tsx   # US2: delivered choices / reply field / "asks for nothing"; in-flight; US3: retriable split
    ├── RulingLine.tsx     # US3: the factory's word, verbatim, in mono
    ├── ruling.ts          # US3: pure — ruling string → {word, retriable, sentence}
    ├── rank.ts            # US2: pure — settlement state → order
    └── timeLeft.ts        # (001) US3: answerable + null → 001's "no deadline from the factory";
                           #       "no clock" stays the Notice slot's words; past → "expired"

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
├── desk.spec.ts                   # (001) US2: one non-GET permitted; US3: the demo Question now has a clock;
│                                  #       US4: authenticates
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
DOM where possible. **No Showfloor file is touched by this spec** — but 002 is building
at the same time and is not independent of it in two places, both settled here rather
than in 002's diff: its badge reads the floor document's `attention` section, which is
why D-P15 declares that section the *unsettled* list; and its room calls 001's
`subscribeFloor`, which is why D-P14 makes the new third argument optional. The four
files the two epics share, and the rule that keeps their hunks disjoint, are D-P16.

## Story-by-story shape

**US1 · Intake.** `Settings` gains the intake credential, identity, store path;
`pane/attention_store.py` (schema, `upsert_delivery`, `get_item`, `list_items`);
`AttentionBroadcaster` in `pane/events.py` with `floor_events()` draining one
subscriber queue between polls; `pane/intake.py` (`POST /intake/{credential}`:
validate → classify → store → publish → 202), mounted behind 001's still-open
`require_viewer` — the segment is carried, not yet compared; `pane/attention.py`'s
`assemble_attention` replaces 001's attention section (through a one-line call from
`pane/floor_document.py`, D-P16) and backs `GET /api/attention`, the two surfaces
splitting per D-P15; `FixtureReader` seeds the store from the recorded webhook
payloads and 001's `stored_questions()` becomes `stored_items()` on the `Reader`
protocol, implemented by both readers, so the store reaches assembly through the seam
and never through `Settings`. The Desk learns the Notice kind and applies `attention`
events, `subscribeFloor` gaining an optional third argument (D-P14). Three landed 001
tests are amended in scope and named in the tasks: `tests/test_readonly_sweep.py`
(the `sqlite3.connect` rule narrowed to factory stores, so the pane may own its own
store), `tests/test_fixture_loader.py`, and `tests/test_floor_document.py`.

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
verbatim and make SIGNAL_FAILED alone retriable; `timeLeft.ts` keeps 001's "no
deadline from the factory" for an answerable item the factory gave no expiry — "no
clock" stays the Notice slot's words — and renders "expired" for a past anchor, never
deleting. A shape test asserts the **five** bridge recordings exist with envelopes
naming `handle_relay`, that `malformed-relay.json` is the adapter refusal
(`relay: null`, `outcome: null`) and not a ruling, that the unrecorded SIGNAL_FAILED
case skips by name rather than being invented, and that no Escalation ruling fixture
exists. The questions-store join gives the seeded demo Question `800ee6b4c7df` a
factory-written `expires_at` for the first time, so 001's `web/tests/smoke/desk.spec.ts`
— which asserts that Question shows no clock — is amended here, declared in scope.

**US4 · The token.** `Settings` gains `token`; `create_app()` refuses without it and
registers both secrets with `factory.notify.redact`; `require_viewer` closes per D-P11
and D-P12 with intake as the enumerated exception; every committed smoke authenticates
through `httpCredentials`; the route-enumeration, refusal-bytes, intake-credential,
UNAUTHORIZED-verbatim, sweep, and log-capture tests land, and the SC-006 smoke proves
the gate guarded the pane without walling it off.

Closing the seam also rewrites the landed **pytest** suite, and FR-014's declaration
for the smokes is made here for pytest so the judge scores it as work: 001's
`tests/test_auth_seam.py` asserts in as many words that `GET /api/floor` with no
`Authorization` header is 200 — the dated interim — and `tests/test_fixture_loader.py`,
`tests/test_events.py`, `tests/test_scaffold.py`'s catch-all cases, and (if 002 is in
the base) `tests/test_stage.py::test_floor_document_carries_stage_and_stays_pure` all
call guarded routes with no credential. A new `tests/conftest.py` mints the three
values with `secrets.token_hex` — never a literal, so the credential sweep has nothing
to find — and hands out an authenticated `TestClient`; the open-interim assertion
becomes the closed-gate assertion; every file above threads the header. Without that,
US4's own diff turns the `uv run pytest -q` gate red.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Table intentionally empty.
