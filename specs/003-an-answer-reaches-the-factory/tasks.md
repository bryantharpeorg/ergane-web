---

description: "Task list for an answer reaches the factory"
---

# Tasks: an answer reaches the factory

**Input**: Design documents from `/specs/003-an-answer-reaches-the-factory/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), data-model.md, contracts/api.md

**Tests**: Every acceptance scenario in `spec.md` names a committed test (constitution IV), so test tasks are not optional here — each story's phase carries the pytest, vitest, or Playwright test that proves its scenarios, and the judge scores the diff by them.

**Organization**: Tasks are grouped by user story so each story can be implemented and proven on its own. There is no Setup or Foundational phase: Ergane dispatches one node per user story and nothing else, so shared groundwork sits inside the phase of the story that needs it first (US1).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Include exact file paths in descriptions
- `(spec USn-Sk)` cites the acceptance scenario a task exists to prove; `(FR-nnn)` the requirement it carries. A task cites only scenarios and requirements of the story whose phase it sits in.

## Path Conventions

Two package worlds in one repository, per plan.md's Structure Decision: the backend
under `pane/` with tests under `tests/` (run by `uv run pytest -q`); the frontend under
`web/src/` with vitest files under `web/tests/unit/` and the Playwright smoke under
`web/tests/smoke/`. Paths marked *(001)* exist in the base because 001 landed —
`pane/app.py`, `pane/config.py`, `pane/readers.py` (the `Reader` protocol,
`TransportFailed`, `QueryRefused`, `LiveReader`), `pane/fixture_floor.py`
(`FixtureReader`, the demo reference instant), `pane/floor_document.py`,
`pane/events.py` (`floor_events()`), `pane/auth.py` (`require_viewer`), and the
Desk under `web/src/desk/`. Where 001 named a module differently, the tree wins and
the task's intent binds. Recorded fixtures live under `fixtures/` and **no task below
adds or edits one** (constitution V, FR-018).

Every rendering task names the `DESIGN.md` section it implements (constitution VIII).

---

## Phase 1: User Story 1 - Intake: the factory's POST becomes an Attention item (Priority: P1) 🎯 MVP

**Goal**: The backend exposes the route `ERGANE_WEBHOOK_URL` points at; the factory's bare POST is classified (Question / Escalation / Notice), durably stored, pushed over SSE as an `attention` event, and present in the attention list for any client that connects later. Malformed payloads are refused with non-2xx and nothing stored; answerable items are idempotent on correlation id, Notices are not.

**Independent Test**: POST the Fixture floor's recorded Question, Escalation, and Notice payloads at the route and assert storage, classification, and the SSE event; POST malformed variants and assert refusal with nothing stored; fetch the attention list with no stream connected and find the items.

### Foundation for User Story 1

The settings, the pane-side store, and the broadcaster. They sit inside US1 rather
than in a phase of their own because no agent is handed a phase that names no story;
US2–US4 all import these files and each waits on this story's *merge*.

- [ ] T001 [US1] Extend 001's `Settings` in `pane/config.py` *(001)* with `intake_credential: str | None` (`PANE_INTAKE_CREDENTIAL`), `answer_identity: str` (`PANE_ANSWER_IDENTITY`, default `factory.notify.adapter.UNKNOWN_SENDER`), and `attention_db: Path` (`PANE_ATTENTION_DB`, default `.pane/attention.db`; in demo mode a fresh file under a per-process temp dir); in `create_app()` in `pane/app.py` *(001)* call `factory.notify.redact.install_redaction()` and `register_secret(settings.intake_credential)` when set, so no log record in the process can carry it; when it is unset log exactly one line `intake closed: PANE_INTAKE_CREDENTIAL is not set`. Do **not** read a token here — the token and its startup refusal are US4's, and 001's committed smoke runs with none configured (FR-001)
- [ ] T002 [US1] Create `pane/attention_store.py` with the `attention` table exactly as data-model.md specifies (`seq`, `correlation_id`, `kind` CHECK, `text`, `actions_json`, `received_at`, `last_ruling`, `last_ruling_at`, `pressed_choice`, `signal_state` CHECK, `signalled_at`) and the partial unique index `attention_answerable_id ON attention(correlation_id) WHERE kind != 'notice'`; expose `open_store(path) -> sqlite3.Connection` (creates the schema idempotently, `PRAGMA journal_mode=WAL`), `upsert_delivery(conn, *, kind, correlation_id, text, actions, received_at) -> tuple[StoredItem, bool]` using `INSERT OR IGNORE` for answerable kinds and a plain `INSERT` for notices, committing before it returns, `get_item(conn, correlation_id) -> StoredItem | None`, and `list_items(conn) -> list[StoredItem]` in `seq` order. Stdlib `sqlite3` only — no new dependency (FR-001, FR-004)
- [ ] T003 [US1] Add `AttentionBroadcaster` to 001's `pane/events.py` *(001)*: `subscribe() -> asyncio.Queue`, `unsubscribe(queue)`, `publish(item: dict) -> None` (puts `{"type": "attention", "data": item}` on every subscriber queue synchronously — no await between storage and publish — and caches nothing, per 001 R-007); extend `floor_events()` so that between polls it waits on its subscriber queue with the remaining poll interval as the timeout and yields any `attention` envelope it receives, so one `GET /api/events` subscription carries both types and a consumer ignoring unknown types is unaffected (FR-005)
- [ ] T004 [US1] Extend `FixtureReader` in `pane/fixture_floor.py` *(001)* so that in demo mode it opens the store at `settings.attention_db` and seeds it by passing each of `fixtures/webhook/question.json`, `fixtures/webhook/escalation.json`, `fixtures/webhook/notice-supervision.json` through the **same** `upsert_delivery` call intake uses — the loader serves the recording, it never hand-builds an item; a missing recording is a degraded read in words (001's loader rule). Retire 001's stand-in attention source ("the recorded Question payloads served by the loader") in favour of the seeded store, so the attention section has one source in both modes (FR-002, FR-005)

### Implementation for User Story 1

- [ ] T005 [US1] Create `pane/intake.py` with `POST /intake/{credential}` and mount it in `pane/app.py` *(001)* behind 001's `require_viewer` like every other route — the dependency still admits every request in this story (001's dated interim) and the `{credential}` path segment is carried but not yet compared; US4 closes both, and the comparison is US4's requirement, not this story's. The handler: parse the body as `{correlation_id, text, actions[]}` exactly as `factory/notify/webhook.py` sends it, classify (T006), `upsert_delivery` (T002) with `received_at` from the app clock, `publish` (T003), respond `202 {"stored": "<kind>", "correlation_id": …}` — in that order, with no Temporal call, no `Reader` call, no settlement seam, and no factory-store read anywhere in the handler, so the factory's 10-second window is spent on one insert and one fan-out (FR-001, FR-005) (spec US1-S1, US1-S6)
- [ ] T006 [US1] In `pane/intake.py` implement `classify(body) -> Literal["question","escalation","notice"]` and its refusal: `correlation_id` matching `^[0-9a-f]{12}$` with `actions == []` → question; 12-hex with non-empty `actions` where **every** action is `{label: str, payload: str}` and every payload matches `^esc:[0-9a-f]{12}:[A-Za-z0-9_]+$` → escalation; non-12-hex `correlation_id` with `actions == []` → notice; missing `correlation_id`, missing `text`, a non-object body, actions beside a non-12-hex id, or any non-matching action payload → raise `Malformed`, which the route turns into `422 {"error": "malformed"}` with nothing stored (FR-002, FR-003) (spec US1-S3, US1-S4)
- [ ] T007 [US1] In `pane/intake.py` make re-delivery idempotent for answerable kinds: a second POST for a stored Question/Escalation correlation id takes the `INSERT OR IGNORE` path, answers `202` with the same body as the first delivery, and publishes nothing new; a Notice always stores a new row and publishes — the factory reuses `"supervision"` and `"roadmap-<root>"` across distinct events (FR-004) (spec US1-S5)
- [ ] T008 [US1] Create `pane/attention.py` with `assemble_attention(stored: list[StoredItem], open_escalations: Sequence[OpenEscalation], *, in_flight: frozenset[str] = frozenset()) -> list[dict]` producing the `AttentionItem` shape in data-model.md: union by correlation id so a stored Escalation and its `open_escalations` entry are one item (the open entry's `expires_at` rides along — 001 already reads it; the questions-store join and the escalation-fate read are US3's), `expires_at: null` for a stored Question or Notice, `settlement.state` `"none"` for a Notice and `"waiting"` otherwise, `id` = correlation id for answerable items and `"notice:<seq>"` for a Notice. Expose it as `GET /api/attention` → `{"items": [...], "degraded": [...]}` in `pane/app.py` *(001)* behind `require_viewer`, and make `assemble_floor_document` in `pane/floor_document.py` *(001)* build its `attention` section with the same function (FR-002, FR-005) (spec US1-S7)
- [ ] T009 [US1] Add `.pane/` to `.gitignore` and document in `README.md` *(001)* the env variables `PANE_INTAKE_CREDENTIAL`, `PANE_ANSWER_IDENTITY`, `PANE_ATTENTION_DB`, and the shape the operator configures on the factory side — `ERGANE_WEBHOOK_URL=http://<pane-host>:8787/intake/<PANE_INTAKE_CREDENTIAL>` — with the note that the value never appears in a log, page, event, or fixture (FR-001)

### Desk rendering for User Story 1

- [ ] T010 [US1] Extend the attention item types in `web/src/api/floorDocument.ts` *(001)* with `kind: "notice"`, `actions: {label: string; payload: string}[]`, `settlement`, `degraded`, and nullable `expires_at` per data-model.md, and extend 001's SSE consumer `web/src/api/events.ts` *(001)* to apply `{type: "attention", data: AttentionItem}` events by upserting on `data.id` into the Desk's attention list (a later `floor` event's attention section replaces the whole list, so nothing is lost with the stream); unknown event types stay ignored (FR-005) (spec US1-S1)
- [ ] T011 [US1] Render the Notice kind in 001's `web/src/desk/AttentionItem.tsx` *(001)* per DESIGN.md § Components › Attention Item: the kind word "Notice" in aqua-ink with the low-rank 3px inset aqua stripe (§ Colors › The Attention Ranking Rule), the clock slot reading "no clock" at 1.25rem (§ Typography › Clock), the delivered text verbatim as Body prose, and the answer column carrying only the italic tinted-slate line "Asks for nothing; no answer exists." — no control of any kind (FR-002)

### Tests for User Story 1

- [ ] T012 [US1] Create `tests/test_intake.py` with an app fixture that sets `PANE_INTAKE_CREDENTIAL`, points `PANE_ATTENTION_DB` at `tmp_path`, installs a recording `Reader` (every operation records and returns a fixture-shaped value), and loads the recorded payloads from `fixtures/webhook/*.json`; test: POST `fixtures/webhook/question.json` at `/intake/<credential>` → 2xx, exactly one stored row of kind `question`, and a queue subscribed before the POST holds exactly one `attention` event carrying that item by the time the response returns (spec US1-S1)
- [ ] T013 [US1] In `tests/test_intake.py` POST `fixtures/webhook/escalation.json` → the stored row's `actions_json` decodes to the delivered list byte-for-byte, label and payload, in delivery order, and the stored kind is `escalation` (spec US1-S2)
- [ ] T014 [US1] In `tests/test_intake.py` one `pytest.mark.parametrize` over the malformed variants derived from the recorded payloads — `correlation_id` removed, `text` removed, the Escalation's id replaced by a non-12-hex string while its actions stay, one action payload rewritten to not match `esc:<12hex>:<CHOICE>`, a non-object body — each → non-2xx and `SELECT COUNT(*) FROM attention` unchanged (spec US1-S3)
- [ ] T015 [US1] In `tests/test_intake.py` POST `fixtures/webhook/notice-supervision.json` and the same payload with `correlation_id` `"roadmap-003-an-answer-reaches-the-factory"` → each 2xx, stored as kind `notice` with `actions_json == "[]"`, `settlement.state == "none"` and `expires_at is None` in the list, and one `attention` event each (spec US1-S4)
- [ ] T016 [US1] In `tests/test_intake.py` POST the recorded Question twice and the recorded Escalation twice → 2xx both times and exactly one row per correlation id; POST the Notice twice → two rows (spec US1-S5)
- [ ] T017 [US1] In `tests/test_intake.py` with the recording `Reader` installed and a recorder in place of the Temporal client, accept one payload of each kind → the `Reader` and the client saw zero calls; only the store and the broadcaster were touched (spec US1-S6)
- [ ] T018 [US1] In `tests/test_intake.py` with no subscriber on the stream, POST the recorded Escalation, then `GET /api/attention` and `GET /api/floor` → the item is present in both with its delivered text and actions (spec US1-S7)
- [ ] T019 [US1] In `tests/test_intake.py` start the app with `PANE_DEMO=1` and no factory → `GET /api/attention` lists the three recorded payloads (one Question, one Escalation, one Notice) with the same shapes intake produces, proving the seed rode the intake path (spec US1-S7)
- [ ] T020 [P] [US1] Create `web/tests/unit/attentionEvents.test.ts` (vitest): feed a `floor` event, then an `attention` event for a new id, then an `attention` event updating an existing id, then an event of unknown type → the list holds the upsert results and the unknown type changed nothing (spec US1-S1)
- [ ] T021 [P] [US1] Create `web/tests/unit/AttentionItem.notice.test.tsx` (vitest, jsdom): render an item built from `fixtures/webhook/notice-supervision.json` → the kind word "Notice" renders, the clock slot reads "no clock", the text renders verbatim, and the item contains zero `button`, `input`, `textarea`, `select`, or `form` elements (spec US1-S4)

**Checkpoint**: The factory can point `ERGANE_WEBHOOK_URL` at the pane and every delivery lands, is classified, is pushed, and is listed — nothing can be answered yet

---

## Phase 2: User Story 2 - The verb: Answer rides the factory's seams (Priority: P1)

**Goal**: On the Desk a Question offers free text and an Escalation offers exactly the factory's delivered buttons. A submit calls `CallbackBridge.handle_relay` once with the correlation id, the text verbatim, and the configured identity; a press sends the `escalation_resolved` signal once with `[escalation_id, choice, identity]` to the workflow whose id is the correlation id. The pane settles nothing itself, refuses empty text locally, and issues at most one settlement call per item at a time.

**Independent Test**: With the `Reader` substituted, submit a Question and press an Escalation button on the Fixture floor and assert exactly one seam call each, carrying exactly the factory's identifiers; render the recorded Escalation and count its controls.

### Implementation for User Story 2

- [ ] T022 [US2] Add two operations to the `Reader` protocol in `pane/readers.py` *(001)* and implement them on `LiveReader`: `async settle_question(correlation_id: str, text: str, identity: str) -> str` builds `factory.notify.adapter.InboundRelay(correlation_id=…, reply_text=text, sender_identity=identity)`, constructs `factory.notify.service.CallbackBridge(db_path=resolve_env_path(ERGANE_VERIFICATION_DB_PATH_ENV, FACTORY_VERIFICATION_DB_PATH_ENV, DEFAULT_VERIFICATION_DB_PATH), client=<the Temporal client LiveReader holds>, adapter=resolve_adapter(WEBHOOK_ADAPTER))` and returns `(await bridge.handle_relay(relay)).value`; `async press_escalation(correlation_id: str, escalation_id: str, choice: str, identity: str) -> None` does `await client.get_workflow_handle(correlation_id).signal(factory.notify.service.SIGNAL_NAME, args=[escalation_id, choice, identity])` and lets any exception propagate — the caller's SIGNAL_FAILED. Implement the fixture halves on `FixtureReader` in `pane/fixture_floor.py` *(001)*: `settle_question` returns the `outcome` recorded in `fixtures/bridge/<settings.demo_ruling>.json` (a new `Settings.demo_ruling` from `PANE_DEMO_RULING`, default `RESOLVED`; a missing recording is a degraded read in words, not an invented ruling), `press_escalation` returns without sending (FR-006, FR-008)
- [ ] T023 [US2] Extend `pane/attention_store.py` with `record_ruling(conn, correlation_id, ruling: str, at: str)` (writes `last_ruling`/`last_ruling_at`, Question rows only) and `record_press(conn, correlation_id, choice: str, signal_state: Literal["accepted","SIGNAL_FAILED"], at: str)` (Escalation rows only) — the only two code paths that write a settlement column, and neither deletes a row (FR-009)
- [ ] T024 [US2] Create `pane/answer.py` with `POST /api/attention/{correlation_id}/answer` mounted in `pane/app.py` *(001)* behind `require_viewer`, owning a module-level in-flight registry (`set[str]` under an `asyncio.Lock`). Order: unknown id → `404 {"error":"no_such_item"}`; Notice → `422 {"error":"not_answerable"}`; id already in flight → `409 {"error":"in_flight"}` (no seam call); Question with `text` empty or whitespace-only after `.strip()` → `422 {"error":"empty_answer"}` (no seam call — `handle_relay` has no empty-answer guard and `_settle_question` would park the node on nothing); Escalation whose `payload` is not byte-equal to one stored delivered action → `422 {"error":"not_delivered"}`. Then add the id to the registry, call exactly one `Reader` operation — `settle_question(correlation_id, text, settings.answer_identity)` for a Question, or parse `escalation_id` and `choice` from the delivered payload `esc:<escalation_id>:<choice>` and call `press_escalation(correlation_id, escalation_id, choice, settings.answer_identity)` for an Escalation, the workflow id being the correlation id and nothing invented — record the result (`record_ruling` with the returned string verbatim; `record_press` with `"accepted"`, or `"SIGNAL_FAILED"` when the send raised), remove the id from the registry in a `finally`, publish one `attention` event with the updated item, and respond `200 {"kind": "question", "ruling": <verbatim>}` or `200 {"kind": "escalation", "signal": "accepted"|"SIGNAL_FAILED"}` (FR-006, FR-008, FR-009)
- [ ] T025 [US2] Extend `pane/attention.py`'s `assemble_attention` with the settlement derivation in data-model.md: `in_flight` when the id is in the registry (pass the registry's snapshot in) or when an Escalation's `signal_state == "accepted"` and the factory's `resolution` is still null; `settled` only when a Question's `last_ruling == "RESOLVED"` or the factory read carries a non-null `resolution` (in this story that read is the `open_escalations` entry's `resolution`; US3 adds the rest); `ruled` for any other `last_ruling` or a `SIGNAL_FAILED` press; `waiting` otherwise. Order the list waiting/ruled → in_flight → settled, with Escalation before Question before Notice inside a rank (DESIGN.md § Colors › The Attention Ranking Rule). A press or submit changes no item's rank by itself (FR-009)
- [ ] T026 [US2] Create `web/src/api/answer.ts` with `answerQuestion(id: string, text: string)` and `pressChoice(id: string, payload: string)` — each one `POST /api/attention/{id}/answer` with a JSON body, returning the response body typed as `{kind, ruling?}` / `{kind, signal?}` and never interpreting it; this file is the only place in `web/src/` that issues a non-GET request (FR-006, FR-008)
- [ ] T027 [US2] Create `web/src/desk/AnswerColumn.tsx` and mount it as the answer column of 001's `web/src/desk/AttentionItem.tsx` *(001)*, per DESIGN.md § Components › Attention Item › Answer column (min-width 220px) and § Components › Buttons: an Escalation renders one `<button>` per delivered action, label verbatim, delivery order, the first as Answer-primary (teal fill, white text) and the rest as Choice-secondary (mist fill, graphite 1.5px border, left-aligned), each with its `esc:<12hex>:<CHOICE>` payload as a block under the label in Red Hat Mono 0.6875rem tinted slate (§ Typography › The Factory Speaks in Mono Rule); a Question renders the reply `<textarea>` per § Inputs / Fields (white fill, 1.5px hairline, 3px radius, placeholder "Reply to the node. Sent as your identity; the factory rules on it.") and one Answer button; a Notice renders the "Asks for nothing" line and no control; focus ring `2px solid #1F7A78` offset 2px; nothing else is rendered — no dismiss, snooze, resolve, or second verb, and none of the words dashboard/console/app/board/action/mutation/resolve in its copy (§ Do's and Don'ts) (FR-007)
- [ ] T028 [US2] In `web/src/desk/AnswerColumn.tsx` add the two local guards: a Question submit whose text is empty or whitespace-only issues no request and leaves the item unchanged; while a request for this item is pending (local state) or the item's `settlement.state` is `"in_flight"`, every control is disabled per § Buttons › Disabled (opacity 0.45, `cursor: not-allowed`, no transform) and a second press or submit issues no request. Nothing in this component changes the item's rank — the list and the `attention` events are the only inputs to rank (FR-006, FR-009)
- [ ] T029 [US2] Create `web/src/desk/rank.ts` with `rankAttention(items) -> items` ordering by `settlement.state` (waiting/ruled → in_flight → settled) then kind (escalation → question → notice) and use it in 001's `web/src/desk/AttentionStrip.tsx` *(001)*, so rank is derived from the backend's settlement state and from nothing local (FR-009)
- [ ] T030 [US2] Amend 001's two zero-write sweeps so they become one-write sweeps (plan.md D-P13): `web/tests/unit/noVerb.test.ts` *(001)* now asserts that the only non-GET request issued from `web/src/` is the POST in `web/src/api/answer.ts` to `/api/attention/{id}/answer`, and that no other file contains a `fetch(` with a non-GET method, a `<form>`, or a write-issuing control; `web/tests/smoke/desk.spec.ts` *(001)* now asserts that the Desk's full run issues zero non-GET requests **other than** to `/api/attention/*/answer` — the control against the defect D-001 forbids, scored as work (FR-007, FR-009) (spec US2-S4)

### Tests for User Story 2

- [ ] T031 [US2] Create `tests/test_answer_seams.py` with an app fixture whose store is seeded through intake from `fixtures/webhook/*.json`, `PANE_ANSWER_IDENTITY` set to a sentinel, and a recording `Reader` whose `settle_question` / `press_escalation` record their arguments; test: POST `{"text": "ship it"}` for the recorded Question → exactly one `settle_question` call with `(correlation_id, "ship it", <sentinel identity>)` — the relay built from exactly those three terms — and zero `press_escalation` calls (spec US2-S1)
- [ ] T032 [US2] In `tests/test_answer_seams.py` POST the recorded Escalation's first delivered payload (read from `fixtures/webhook/escalation.json`, not typed by hand) → exactly one `press_escalation` call whose `escalation_id` and `choice` equal the two fields parsed from that payload, whose first argument (the workflow id) equals the item's `correlation_id`, and whose identity is the sentinel; zero `settle_question` calls; a payload not among the delivered actions → 422 and zero calls (spec US2-S3)
- [ ] T033 [US2] In `tests/test_answer_seams.py` make the recording `settle_question` block on an `asyncio.Event`; issue two concurrent POSTs for the same Question → one returns `409 in_flight`, the recorder saw one call, and the attention list reports `settlement.state == "in_flight"` while blocked (spec US2-S5)
- [ ] T034 [US2] In `tests/test_answer_seams.py` after a `settle_question` returning `"RESOLVED"`, the Question's `settlement.state` is `"settled"` and it sorts after every waiting item; after one returning `"UNKNOWN"`, the state is `"ruled"` and the rank is unchanged; after an accepted press the Escalation's state is `"in_flight"` and it stays in the list with its `resolution` null until the substituted `open_escalations` reports one — at which point and only then it is `"settled"` (spec US2-S6)
- [ ] T035 [US2] In `tests/test_answer_seams.py` parametrize over `""`, `"   "`, `"\n\t"` → `422 empty_answer`, zero seam calls, and the stored row byte-identical before and after (spec US2-S7)
- [ ] T036 [P] [US2] Create `web/tests/unit/AnswerColumn.test.tsx` (vitest, jsdom): render the item built from `fixtures/webhook/escalation.json` → exactly as many `button` elements as delivered actions, each label text equal to the recorded label, in delivery order, each payload rendered under it verbatim (spec US2-S2)
- [ ] T037 [P] [US2] In `web/tests/unit/AnswerColumn.test.tsx` for each of Question, Escalation, Notice: the only interactive elements are the delivered choice buttons or the textarea plus one Answer button, and the Notice has none; assert no element whose text matches /dismiss|snooze|resolve|pause|kill|ready/i exists outside a delivered label (spec US2-S4)
- [ ] T038 [P] [US2] In `web/tests/unit/AnswerColumn.test.tsx` with `fetch` mocked to a pending promise: press the same button twice → one request; render an item whose `settlement.state` is `"in_flight"` → every control disabled (spec US2-S5); submit an empty and a whitespace-only reply → zero requests and the textarea keeps its value (spec US2-S7)
- [ ] T039 [P] [US2] Create `web/tests/unit/rank.test.ts`: items in waiting, ruled, in_flight, and settled states sort waiting/ruled → in_flight → settled with Escalation before Question before Notice; a locally pending item given to `rankAttention` unchanged keeps its place — only a changed `settlement` moves it (spec US2-S6)

**Checkpoint**: An operator at the Desk can answer a Question and press an Escalation, and each reaches the factory's seam exactly once with the factory's own identifiers

---

## Phase 3: User Story 3 - Honesty: rulings verbatim, countdowns from factory clocks (Priority: P2)

**Goal**: Every `BridgeOutcome` string renders verbatim — unknown strings as themselves — with SIGNAL_FAILED alone retriable; an Escalation press renders only signal-failed, in flight, or the factory-read resolution; countdowns anchor on the factory-written `expires_at` read from `open_escalations`/`escalation_status` and the questions store, never on receipt arithmetic; an expired item stays, reads expired, and still accepts a late Answer.

**Independent Test**: Drive all six Question rulings and an unknown one through the rendering path and assert the verbatim strings and the retriability split; render a fixture Escalation and a fixture Question whose factory-reported `expires_at` disagrees with intake-time arithmetic and assert the reported value wins.

### Implementation for User Story 3

- [ ] T040 [US3] Add `read_question(correlation_id: str) -> QuestionRecord | None` to the `Reader` protocol in `pane/readers.py` *(001)*: `LiveReader` opens the factory's questions store with `factory.verify.store.connect_readonly(resolve_env_path(ERGANE_VERIFICATION_DB_PATH_ENV, FACTORY_VERIFICATION_DB_PATH_ENV, DEFAULT_VERIFICATION_DB_PATH))` and calls `factory.verify.store.get_question(conn, correlation_id)` (`pending_questions(conn)` available for the list), raising `TransportFailed` when the store cannot be opened and `QueryRefused` when the query errors — 001's two modes; `FixtureReader` in `pane/fixture_floor.py` *(001)* answers from the rows of `fixtures/questions/pending_questions.json` (FR-019, FR-012)
- [ ] T041 [US3] Add `read_escalation_fate(correlation_id: str) -> OpenEscalation | None` to the `Reader` protocol in `pane/readers.py` *(001)*: `LiveReader` queries `factory.escalation.workflow.ESCALATION_STATUS_QUERY` on `client.get_workflow_handle(correlation_id)` (the workflow id is the correlation id), a rejected query raising `QueryRefused` and an RPC failure `TransportFailed`, falling back to the matching `open_escalations` entry 001 already reads; `FixtureReader` answers from the matching entry of `fixtures/escalations/open_escalations.json` (absent → `None`, so a pressed fixture Escalation stays in flight). The `resolution` it returns is the factory's word, passed through verbatim (FR-012, FR-010)
- [ ] T042 [US3] Extend `pane/attention.py`'s `assemble_attention` with the two joins from data-model.md, taking the `Reader` (or the two reads) as inputs: each stored Question takes `expires_at` and `resolution` from `read_question`, each stored Escalation from `read_escalation_fate` (the `open_escalations` entry remains the fallback); a factory-reported `expires_at` **replaces** anything present, `received_at` is never used as an anchor, and an item with no factory value keeps `expires_at: null`; a non-null `resolution` makes the item `settled` with `settlement.resolution` verbatim; a `TransportFailed`/`QueryRefused` join attaches `degraded: {mode, what}` to the item, which still renders with its delivered text; items past `expires_at` are never dropped (FR-012, FR-013, FR-019)
- [ ] T043 [US3] Create `web/src/desk/ruling.ts` (pure, no DOM): `describeRuling(kind, settlement) -> {word: string | null, retriable: boolean, sentence: string}` where `word` is the ruling string exactly as received (a Question's `ruling`, an Escalation's `"SIGNAL_FAILED"`, or the factory read's `resolution`) with no mapping table — an unrecognized string is returned as itself — `retriable` is true for `"SIGNAL_FAILED"` and for nothing else, and the sentence for SIGNAL_FAILED says "nothing was recorded; resending is safe", for an accepted-but-unconfirmed press "in flight — waiting for the factory's read", and for a factory-read resolution "the factory reports <resolution>" (FR-010, FR-011)
- [ ] T044 [US3] Create `web/src/desk/RulingLine.tsx` and mount it in the body column of 001's `web/src/desk/AttentionItem.tsx` *(001)* per DESIGN.md § Components › Attention Item › Body column: the ruling sentence as Small olive-ink 500 text ("Your last answer on <id…> was RESOLVED — …") with the ruling word set in Red Hat Mono, verbatim, uppercase as the factory wrote it (§ Typography › The Factory Speaks in Mono Rule); refusals render the same way in the same place, never in red (§ Colors › The No-Red Rule) and never as a field error (§ Inputs / Fields › Error: none). Wire `describeRuling` into `web/src/desk/AnswerColumn.tsx`: when `retriable` the controls stay live and enabled; for every other ruling the controls do not invite resending (the Answer button and choices are removed for a `settled` item and disabled for a `ruled` one, with no "resend" affordance); an in-flight Escalation shows the in-flight sentence and disabled controls (FR-010, FR-011)
- [ ] T045 [US3] Audit and extend 001's `web/src/desk/timeLeft.ts` *(001)* and its use in the clock column of `web/src/desk/AttentionItem.tsx` *(001)* per DESIGN.md § Components › Attention Item › Countdown anchor rule and Clock column: the only inputs are `expires_at` and the document's `reference_instant` (001 R-008); `expires_at == null` renders the clock slot as "no clock" and no "until" line; a past `expires_at` renders the word "expired" in the clock slot with the absolute expiry beneath, the item stays rendered in its rank, and its controls stay live so a late Answer still goes to the factory (FR-012, FR-013)

### Tests for User Story 3

- [ ] T046 [P] [US3] Create `web/tests/unit/RulingLine.test.tsx` (vitest, jsdom): iterate RESOLVED, UNKNOWN, ALREADY_RESOLVED, EXPIRED, UNAUTHORIZED, SIGNAL_FAILED as a Question's `settlement.ruling` → each string renders verbatim inside the item, in the body column, in a mono-face element (spec US3-S1)
- [ ] T047 [P] [US3] In `web/tests/unit/RulingLine.test.tsx` render `"BRIDGE_ERROR"`, `"MALFORMED"`, and `"A_WORD_THE_FACTORY_MAY_SAY_LATER"` as rulings → each renders as itself, nothing throws, and no friendlier word is substituted; create `web/tests/unit/ruling.test.ts` asserting `describeRuling` returns `word` identical to its input for any string (spec US3-S2)
- [ ] T048 [P] [US3] In `web/tests/unit/AnswerColumn.test.tsx` render a Question with ruling `"SIGNAL_FAILED"` and an Escalation with `settlement.signal == "SIGNAL_FAILED"` → the controls are present and enabled and the text "nothing was recorded" and "resending is safe" both render (spec US3-S3); for each of RESOLVED, UNKNOWN, ALREADY_RESOLVED, EXPIRED, UNAUTHORIZED → no enabled control that would resend the same Answer and no "resend" text (spec US3-S4)
- [ ] T049 [US3] Create `tests/test_rulings_and_countdowns.py`: with a `Reader` whose `read_escalation_fate` returns the entry of `fixtures/escalations/open_escalations.json` whose `expires_at` is not its send time plus 3600 s (the README names the 900 s / 1200 s escalation) and the store seeded with an Escalation of that correlation id through intake, `GET /api/attention` carries exactly the reported `expires_at`; and in `web/tests/unit/timeLeft.test.ts` *(001)* the clock for that item, against the demo `reference_instant`, targets the reported value and not receipt + 3600 s (spec US3-S5)
- [ ] T050 [US3] In `tests/test_rulings_and_countdowns.py` with `read_question` returning the row of `fixtures/questions/pending_questions.json` and the store seeded by POSTing a Question payload carrying that row's `question_id` through intake (the payload's `text` taken from `fixtures/webhook/question.json`), the list carries the row's `expires_at` and not `received_at` + 28800 s; a correlation id the read returns `None` for yields `expires_at: null`; `web/tests/unit/timeLeft.test.ts` asserts the Desk targets the stored value and renders "no clock" for the null (spec US3-S6)
- [ ] T051 [US3] In `tests/test_rulings_and_countdowns.py` with a `reference_instant` past the fixture items' `expires_at`: the items are still listed; a Question POST still reaches the substituted `settle_question` and its returned string (the demo `FixtureReader` with `PANE_DEMO_RULING=EXPIRED` serving `fixtures/bridge/EXPIRED.json`) comes back verbatim; an Escalation press still reaches `press_escalation` and the item reads in flight; and `web/tests/unit/timeLeft.test.ts` renders "expired" with the controls live (spec US3-S7)
- [ ] T052 [US3] In `tests/test_rulings_and_countdowns.py` make `read_question` raise `TransportFailed` and `read_escalation_fate` raise `QueryRefused` → the two items carry `degraded` entries that differ in `mode`, both still render their delivered text, both have `expires_at: null` and no minted deadline (spec US3-S6)
- [ ] T053 [P] [US3] Create `tests/test_bridge_fixtures.py`: for each of RESOLVED, UNKNOWN, ALREADY_RESOLVED, EXPIRED, UNAUTHORIZED, SIGNAL_FAILED, `fixtures/bridge/<OUTCOME>.json` exists, its recorded `outcome` is that string and a member of `factory.notify.service.BridgeOutcome`, its `*.envelope.json` sidecar names `CallbackBridge.handle_relay` as the seam and carries a capture instant; assert no file under `fixtures/` claims to be an Escalation ruling (no envelope naming the `escalation_resolved` signal as a ruling source) — the signal returns nothing and no fixture may pretend otherwise; and the test modifies no fixture (FR-018) (spec US3-S1)

**Checkpoint**: Every word the factory says about an Answer is on the item verbatim, the only retriable one is SIGNAL_FAILED, and every clock counts down to a time the factory wrote

---

## Phase 4: User Story 4 - The token: one gate in front, the factory's ruling behind (Priority: P2)

**Goal**: Every registered route and the SSE stream refuse without the shared token, with one refusal shape that leaks nothing and is byte-identical for a missing and a wrong token; the intake route is guarded by the credential in `ERGANE_WEBHOOK_URL` instead; the answer identity is a distinct configured value the factory alone judges, and its UNAUTHORIZED ruling renders unsoftened; no credential reaches a page, event, log line, or fixture. The smokes 001 and 002 committed now authenticate.

**Independent Test**: Enumerate the backend's registered routes from the application object and assert each refuses without the token; answer a fixture Question with a valid token and a non-responder identity and assert UNAUTHORIZED renders unsoftened; sweep every committed fixture and capture intake and settlement logs.

### Implementation for User Story 4

- [ ] T054 [US4] Extend `Settings` in `pane/config.py` *(001)* with `token: str` from `PANE_TOKEN`; in `create_app()` in `pane/app.py` *(001)* an unset or empty value raises at app creation in every mode, demo included, so the backend refuses to start rather than serve open; `register_secret(settings.token)` beside the intake credential, after `install_redaction()`, so no log record from any logger — uvicorn's access log included — can carry either value (FR-014, FR-017)
- [ ] T055 [US4] Close `require_viewer` in `pane/auth.py` *(001)* — the same function 001 mounted on every route, including the SPA catch-all and `/api/events`; no second path (plan.md D-P11): when `request.url.path` starts with `/intake/`, admit only when the intake credential is configured and `secrets.compare_digest(<path segment>, settings.intake_credential)`; for every other route, extract the presented secret from the `Authorization` header — the value after `Bearer `, or the password half of a decoded `Basic` pair (username ignored) — and admit only when `compare_digest(<presented>, settings.token)`. Every refusal is the one shape in contracts/api.md: status 401, header `WWW-Authenticate: Basic realm="ergane pane", Bearer`, body exactly `{"error":"unauthorized"}` — no route name, no floor data, no echo of what was sent — produced by one function so a missing and a wrong credential cannot differ by a byte (FR-014, FR-015)
- [ ] T056 [US4] Confirm `settings.answer_identity` is the value `pane/answer.py` passes verbatim to both `settle_question` and `press_escalation`, and that nothing under `pane/` reads `escalation.authorized_responders` or refuses an answer by identity — the factory's `handle_relay` runs that check and returns UNAUTHORIZED, the signal seam runs none, and the pane neither compensates for that gap nor hides it; document the gap in `README.md` *(001)* in one sentence citing `EscalationWorkflow._answer` (FR-016)
- [ ] T057 [US4] In 001's `web/src/desk/Desk.tsx` *(001)* render a 401 from `GET /api/floor`, `GET /api/attention`, or the stream as a degraded well in place of the affected section per DESIGN.md § Elevation & Depth › The Well Rule — bold Display lead-in, in words: "The pane's token was refused. Nothing can be read until one is presented." — no hue, no red (§ Colors › The No-Red Rule); the browser itself carries the token on every request after answering the challenge once, so no token is read, stored, or rendered by any file under `web/src/` (FR-014, FR-017)
- [ ] T058 [US4] Update `web/playwright.config.ts` *(001)*: set `use.httpCredentials = { username: "pane", password: process.env.PANE_TOKEN }`, and make every `webServer` entry (the 8787 demo backend and 001's degraded 8788 backend) export `PANE_TOKEN`, `PANE_INTAKE_CREDENTIAL`, and `PANE_ANSWER_IDENTITY` minted per run (`crypto.randomBytes`, never a literal in a committed file) alongside `PANE_DEMO=1`; confirm every committed smoke under `web/tests/smoke/` — 001's `shell.spec.ts` and `desk.spec.ts`, and 002's `showfloor.spec.ts` if it is in the base — passes against the closed gate, so the landed smokes now authenticate with the configured token (FR-014)
- [ ] T059 [US4] Create `web/tests/smoke/answer.spec.ts` (Playwright, headless chromium, `PANE_DEMO=1`, token configured): load the Desk, find the seeded fixture Question, type an answer, submit, and assert the ruling line renders the word recorded in `fixtures/bridge/RESOLVED.json` (the demo default); find the seeded fixture Escalation, press its first delivered button, and assert the item renders in flight with its controls disabled; assert the page's network log shows exactly two non-GET requests, both to `/api/attention/*/answer`; then, in a browser context with no `httpCredentials`, request the Desk and assert a 401 with the refusal body and no attention item in the response — proving the gate guarded the pane without walling it off (FR-014) (spec US4-S1)
- [ ] T060 [US4] Document in `README.md` *(001)*: `PANE_TOKEN`, `PANE_INTAKE_CREDENTIAL`, `PANE_ANSWER_IDENTITY` (and that the identity must appear in the factory's `escalation.authorized_responders` for Question answers to count), that the browser prompts once for the token and curl sends `Authorization: Bearer`, and the four gate commands unchanged; note that 001's open auth interim is closed as of this story (FR-014)

### Tests for User Story 4

- [ ] T061 [US4] Create `tests/test_token_gate.py`: build the app with `PANE_TOKEN` and `PANE_INTAKE_CREDENTIAL` set to sentinels; enumerate `app.routes`, keep every `APIRoute`, and for each `(path, method)` pair — substituting a syntactically valid segment for each path parameter — request it with no `Authorization` header and assert the refusal shape; for `/api/events` open the request and assert the 401 arrives before any event; for the SPA catch-all assert the same refusal; for `/intake/{credential}` request it with a wrong credential and no token and assert the same refusal with `SELECT COUNT(*) FROM attention` unchanged. The list of routes comes from the application object, never from a hand-kept list (spec US4-S1)
- [ ] T062 [US4] In `tests/test_token_gate.py` request the floor document, the attention list, and the stream with `Authorization: Bearer <wrong>`, with `Authorization: Basic base64("pane:<wrong>")`, and with none → status, `WWW-Authenticate`, `Content-Type`, and body bytes identical in all three cases; the body contains none of: any registered route path, the sentinel token, the wrong token, the word "floor" followed by data, or a correlation id from the seeded store; and `Authorization: Basic base64("anything:<sentinel token>")` is admitted exactly as `Bearer <sentinel token>` is (spec US4-S2)
- [ ] T063 [US4] In `tests/test_token_gate.py` POST `fixtures/webhook/question.json` at `/intake/<sentinel credential>` with no header → 2xx and one stored item; POST it at `/intake/not-the-credential` and at `/intake/` with `Authorization: Bearer <PANE_TOKEN>` and no credential → the refusal shape both times and no new row; with `PANE_INTAKE_CREDENTIAL` unset, every intake POST is refused and the startup log carries the one "intake closed" line (spec US4-S3)
- [ ] T064 [US4] In `tests/test_token_gate.py` with a valid token, `PANE_ANSWER_IDENTITY=not-a-responder`, and the demo `FixtureReader` serving `fixtures/bridge/UNAUTHORIZED.json` (`PANE_DEMO_RULING=UNAUTHORIZED`): POST a Question answer → `200 {"kind":"question","ruling":"UNAUTHORIZED"}` verbatim and the seam saw the identity unchanged; `web/tests/unit/RulingLine.test.tsx` renders `"UNAUTHORIZED"` as itself with no softer word; and a source sweep in the same pytest file asserts no file under `pane/` contains `authorized_responders` in executable code (spec US4-S4)
- [ ] T065 [US4] Extend 001's `tests/test_credential_sweep.py` *(001)*: with `PANE_TOKEN`, `PANE_INTAKE_CREDENTIAL`, and `PANE_ANSWER_IDENTITY` set to distinctive sentinels during the run, read every file under `fixtures/`, `web/tests/`, and `tests/` (including every `*.envelope.json`) and assert none contains a sentinel value, any `Bearer ` or `Basic ` literal followed by a token-shaped string, or a URL with `/intake/` followed by a non-placeholder segment; create `tests/test_log_capture.py` using `caplog` at DEBUG around one intake POST, one Question answer, and one Escalation press (the `Reader` substituted) → every captured line that mentions the work names its correlation id, and no captured line contains the token, the intake credential, or the full `/intake/<credential>` path; also assert the `attention` event payloads and the `GET /api/attention` body contain neither credential, and extend `web/tests/unit/AttentionItem.notice.test.tsx` with an assertion that the rendered item contains no `Authorization` value and no token-shaped string (spec US4-S5)

**Checkpoint**: All four stories land; the pane is the factory's webhook target, carries the one verb, says exactly what the factory said, and refuses anyone without the token

---

## Dependencies & Execution Order

### Phase Dependencies

- **US1 (Phase 1)**: Depends on 001 having landed (`depends_on_landed` in the spec's frontmatter), nothing inside this epic. Carries the shared groundwork — the `Settings` fields, `pane/attention_store.py`, the broadcaster in `pane/events.py`, and the attention-list shape — because every later story imports it.
- **US2 (Phase 2)**: Waits on US1's **merge** (`depends_on_merged`), not merely its verification: each node branches from `dev` at dispatch, and US2's answer route writes the store US1 creates.
- **US3 (Phase 3)**: Waits on US2's merge: the ruling line renders what US2's route records, and the countdown joins land in the assembly US2 extended.
- **US4 (Phase 4)**: Waits on US3's merge: the gate closes over every route the earlier stories mounted, and its UNAUTHORIZED test rides US3's ruling rendering.

This is the same chain as the `## Work Graph` block in `spec.md`, which is the copy
Ergane actually compiles. Change one and change the other. The chain is contention,
not logic: all four stories touch `pane/app.py` and `pane/attention.py`, three touch
`pane/readers.py`, `pane/fixture_floor.py`, `web/src/desk/AttentionItem.tsx`, and
`web/src/desk/AnswerColumn.tsx`.

### User Story Dependencies

- **US1 (P1)**: Standalone within the epic; assumes only 001's tree.
- **US2 (P1)**: Needs stored items to answer (US1) and the broadcaster to publish rulings on.
- **US3 (P2)**: Needs recorded rulings and presses in the store (US2) to render.
- **US4 (P2)**: Needs every route to exist (US1–US3) so the enumeration test has something to enumerate.

### Within Each User Story

- Store and `Reader` operations before the route that uses them
- Backend route before the frontend file that calls it
- Pure helpers (`ruling.ts`, `rank.ts`, `timeLeft.ts`) before the components that render them
- Tests are part of the story: a scenario with no committed test is a scenario the judge cannot score

### Parallel Opportunities

- **US1**: T020 and T021 (vitest) are independent of the pytest file and of each other
- **US2**: T036–T039 (vitest) touch different files from `tests/test_answer_seams.py` and can run alongside T031–T035
- **US3**: T046–T048 (vitest) and T053 (the fixture shape test) are independent of T049–T052
- **US4**: nothing is marked [P]; every task either edits `pane/auth.py` or depends on it

---

## Parallel Example: the vitest files inside User Story 2

```bash
# After T027–T029 land the components and the rank helper, launch together:
Task: "AnswerColumn.test.tsx — delivered choices verbatim, in order (US2-S2)"
Task: "AnswerColumn.test.tsx — only delivered controls (US2-S4)"
Task: "AnswerColumn.test.tsx — one request while pending; empty submit sends nothing (US2-S5, US2-S7)"
Task: "rank.test.ts — rank follows settlement state, never a local press (US2-S6)"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 — settings, store, broadcaster, the intake route, the Notice rendering, and the tests
2. **STOP and VALIDATE**: the four gates are green and the factory's recorded payloads round-trip through intake into the list and the stream
3. Point a factory's `ERGANE_WEBHOOK_URL` at the pane and watch an Escalation arrive

### Incremental Delivery

1. US1 → the factory's POST lands and is listed → demo
2. US2 → the operator answers and presses; the seams are called once each → demo
3. US3 → every ruling verbatim; every clock anchored on the factory → demo
4. US4 → the token closes the seam; the smokes authenticate; the epic is done

US4 sits last in build order only. Constitution VI makes it non-negotiable in
substance; SC-004 through SC-006 are part of this epic's definition of done.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] labels map tasks to user stories for traceability, and to a dispatched agent: a task tagged for no story is work no agent is given
- `(spec USn-Sk)` cites the acceptance scenario a task exists to satisfy. A task may only cite a scenario of the story whose phase it sits in — a citation across stories reads as work filed under the wrong agent
- Commit after each task or logical group; one story per PR, and the PR title names the story
- The three tasks most likely to be silently wrong: **T024** (the guards must run *before* the id enters the in-flight registry, and the registry must be released in a `finally`, or one raised seam call locks an item forever); **T042** (a join that falls back to `received_at` arithmetic when the factory read fails renders a minted deadline — the spec's named defect); **T055** (two refusal code paths will drift by a byte — one function, one constant body; and the Basic password must be compared with `compare_digest` exactly as the bearer value is)
- `fixtures/bridge/*.json`, `fixtures/questions/pending_questions.json`, `fixtures/escalations/open_escalations.json`, and `fixtures/webhook/*.json` are recorded by the operator before this spec is readied. A task that finds one missing treats it as a degraded read in words (001's loader rule) and never writes a stand-in
