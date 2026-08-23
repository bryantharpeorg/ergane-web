---
state: landed
depends_on_landed: [001-the-desk-sees-the-floor]
# Attested landed 2026-08-23. US1 c493fec31a2e (#15), US2 0131f5c0f194 (#16),
# US3 593101dd6bef (#17), US4 572118c7e1e2 (#18) — all four observed on dev.
# Every story built on claude-opus-5 (subscription route, nothing metered) and
# passed on attempt 1 with a clean judge: 7/7, 7/7, 7/7, 5/5. Zero escalations,
# zero rework; the last three landed unattended between 00:43 and 06:32 CT.
# An earlier dispatch of US1 also passed but was discarded: its worktree was
# three landings stale, so gates and judge scored it against a base that no
# longer merged (feedback log N41). Rebuilt against current dev.
# Drafted 2026-08-21 by an operator-session interview; see docs/decisions.md.
#
# WHY THIS SPEC. D-001 gave the pane exactly one verb — Answer — because an
# Escalation is buttons with a one-hour window, and a pane that shows one but
# cannot press it forces a phone-fumble mid-decision. This spec is that verb,
# whole: the intake the factory's ERGANE_WEBHOOK_URL points at, the Answer the
# Desk carries, the verbatim rendering of every ruling the factory hands back,
# and the token gate D-007 put in front of all of it. Everything rides seams
# the factory already exports (D-005): intake is the factory's own webhook
# payload, Questions settle through the same bridge core `ergane answer` uses,
# Escalations through the `escalation_resolved` signal. The two seams are not
# symmetric and this spec does not pretend they are: `handle_relay` returns
# the factory's ruling; a Temporal signal returns nothing, so an Escalation's
# fate is learned from the factory's own status reads. The pane's token
# decides who can see; the bridge's responder list decides whose Question
# answers count (D-007) — the escalation signal seam performs no responder
# check today, a factory-side gap this spec names rather than papers over.
#
# Verified this session against the sibling tree: factory/notify/webhook.py
# sends a bare JSON POST with no auth header and treats everything after the
# endpoint origin as a credential to redact — which is why the intake guard
# rides the operator-configured URL, not a header the factory never sends.
#
# Order (D-008): the `depends_on_landed` above is the cross-spec edge the
# roadmap's scheduler enforces — merge-edge is the node-level word inside one
# epic — and the operator readies this spec only after 001's scaffold,
# gates, and Fixture floor are in the base. This repository contains no
# application code today; this spec extends 001's surface, it does not assume
# code 001 has not landed.
---

# Feature Specification: an answer reaches the factory

## Context

The factory has one synchronous request to a human: a Question asks for
knowledge, an Escalation asks for a choice with 3600 seconds on the clock. The
factory delivers both by POSTing to whatever `ERGANE_WEBHOOK_URL` names, waits
10 seconds, and counts any non-2xx as undelivered. The same URL carries more
than those two kinds: the factory resolves exactly one notify adapter, so
supervision alerts (`correlation_id: "supervision"`,
`factory/supervision/alert.py`) and roadmap notices
(`correlation_id: "roadmap-<root>"`) ride the identical transport —
actionless pages that expect no answer but must never be silently lost,
because the supervision alert is the "orchestrator is down" page itself.

The factory runs no inbound listener of its own, by design: a Question
settles through `CallbackBridge.handle_relay` — the same core `ergane answer`
uses — which returns the factory's ruling synchronously; an Escalation
settles through the `escalation_resolved` signal on the workflow whose id is
the correlation id — and a Temporal signal returns nothing, so the only press
outcomes the pane can observe are signal-accepted and signal-failed, with the
escalation's actual fate reported by the factory's own reads
(`escalation_status`, `open_escalations`).

This spec makes the Pane that webhook target and gives the Desk its only verb.
The rule, stated once: **the pane carries the operator's Answer to the
factory's seam and carries the factory's ruling back, verbatim — it invents no
choice, softens no word, and settles nothing itself.** A pane that marks an
item resolved because a button was pressed has grown a second source of truth;
a pane that renders SIGNAL_FAILED as a friendly "something went wrong" has
hidden the one fact that matters — nothing was recorded, resending is safe.

**Evidence rule for every scenario below**: the judge is given the diff and
these criteria — never a terminal, never a browser a human reads (constitution
IV). Every scenario is proven by a committed test — pytest for the backend,
vitest for the Desk's rendering, the headless Playwright smoke against the
Fixture floor — with factory seams substituted at the module boundary and
their recorded shapes taken from the Fixture floor (constitution V).

## User Scenarios & Testing

### User Story 1 - Intake: the factory's POST becomes an Attention item (Priority: P1)

The backend exposes the route `ERGANE_WEBHOOK_URL` points at. The factory's
POST `{correlation_id, text, actions[]}` is answered 2xx within the factory's
10-second window, stored as an Attention item — a 12-hex `correlation_id`
with no actions makes a Question, with actions an Escalation carrying exactly
the delivered choice payloads, and a non-12-hex `correlation_id` with no
actions makes a Notice: the supervision alerts and roadmap notices that ride
the same adapter, rendered but never answerable — and pushed over SSE
immediately. A payload the pane cannot carry is refused with non-2xx, because
to the factory non-2xx *is* the word "undelivered".

**Why this priority**: nothing downstream exists without it. The verb, the
rulings, and the countdowns all act on items this route admits.

**Independent Test**: POST the Fixture floor's recorded Question and
Escalation payloads at the route and assert storage, classification, and the
SSE event; POST malformed variants and assert refusal with nothing stored.

**Acceptance Scenarios**:

1. **Given** the Fixture floor's recorded Question payload — a 12-hex
   `correlation_id`, `text`, empty `actions` — **When** it is POSTed to the
   intake route with the intake credential, **Then** the response is 2xx, one
   Attention item is stored as a Question, and one SSE event carrying it is
   emitted in the same handling — proven by a committed test.
2. **Given** the recorded Escalation payload with actions
   `[{label, payload: "esc:<12hex>:<CHOICE>"}...]`, **When** POSTed, **Then**
   the stored Escalation carries every label and payload byte-for-byte, in
   delivery order — proven by a committed test.
3. **Given** each malformed variant — missing `correlation_id`, missing
   `text`, a payload carrying actions whose `correlation_id` is not 12 hex
   characters, or any action whose payload does not match
   `esc:<12hex>:<CHOICE>` — **When** POSTed, **Then** the response is non-2xx
   and nothing is stored — proven by one committed parametrized test. An
   Escalation whose buttons the pane could never press is undelivered, and
   non-2xx is how the factory learns it.
4. **Given** an actionless payload whose `correlation_id` is not 12 hex — the
   supervision alert's `"supervision"`, a roadmap notice's `"roadmap-<root>"`
   — **When** POSTed, **Then** the response is 2xx and the payload is stored
   as a Notice: rendered text, no controls, no settlement state, one SSE
   event — proven by a committed test. The factory resolves one notify
   adapter; a pane that refuses this class as malformed silently drops the
   "orchestrator is down" page, and non-2xx would be the pane telling the
   factory its own alert was undelivered.
5. **Given** a `correlation_id` already stored, **When** the same payload is
   POSTed again, **Then** the response is 2xx and exactly one Attention item
   exists for that id — proven by a committed test. The factory's 10-second
   timeout makes re-delivery of a served request possible; intake is
   idempotent on the correlation id. Notices are exempt: the factory reuses
   `"supervision"` and `"roadmap-<root>"` across distinct events, so each
   accepted Notice stores its own item — a duplicated page is ordinary, a
   deduplicated-away alert is a silent one.
6. **Given** the intake handling with every factory seam substituted, **When**
   a payload is accepted, **Then** only storage and the SSE push are touched —
   no Temporal call, no settlement seam — proven by a committed test asserting
   the substituted seams saw zero calls. The 10-second window is spent on
   storage alone.
7. **Given** an accepted item stored while no client is connected to the
   stream, **When** a client later fetches the attention list, **Then** the
   item is present in it — proven by a committed test. SSE is the fast path,
   never the only path.

---

### User Story 2 - The verb: Answer rides the factory's seams (Priority: P1)

On the Desk, a Question offers free text and an Escalation offers exactly the
buttons the factory sent. Submitting a Question calls
`CallbackBridge.handle_relay` with the correlation id, the text verbatim, and
the configured answer identity, and receives the factory's ruling as the
call's return; pressing an Escalation button sends the `escalation_resolved`
signal with `[escalation_id, choice, identity]` to the workflow whose id is
the correlation id — a send that returns nothing, so a press produces only
signal-accepted or signal-failed. Both are derived from what the factory
delivered, never fabricated. The pane settles nothing itself.

**Why this priority**: P1 — this is D-001's entire justification. A pane that
renders an Escalation it cannot answer is the rejected pure glass.

**Independent Test**: with both seams substituted, submit a Question and press
an Escalation button on the Fixture floor and assert exactly one seam call
each, carrying exactly the factory's identifiers.

**Acceptance Scenarios**:

1. **Given** a stored Question on the Desk, **When** the operator submits free
   text, **Then** exactly one `handle_relay` call is made, carrying an
   `InboundRelay` of the item's correlation id, the submitted text verbatim,
   and the configured answer identity — and no signal is sent — proven by a
   committed test with the bridge substituted.
2. **Given** a stored Escalation with three delivered actions, **When** the
   Desk renders it, **Then** exactly three choice controls render, labels
   verbatim, in delivery order, with no control added, dropped, or reworded —
   proven by a committed test against the Fixture floor.
3. **Given** a pressed button whose payload is `esc:a1b2c3d4e5f6:KILL`,
   **When** it settles, **Then** exactly one `escalation_resolved` signal is
   sent with args `[a1b2c3d4e5f6, KILL, <configured identity>]` to the
   workflow whose id is the item's correlation id — escalation id and choice
   parsed from the payload, workflow id from the correlation id, none invented
   — proven by a committed test with the signal seam substituted.
4. **Given** any Attention item, **When** rendered, **Then** the only controls
   present are the factory's delivered choices and a Question's free-text
   entry — no local resolve, dismiss, snooze, or second verb of any kind —
   proven by a committed test. This is the control against the defect D-001
   forbids: a change that "improves" the Desk by adding a convenience write
   has broken the constitution, not helped the operator.
5. **Given** an Answer whose ruling has not yet returned, **When** the
   operator presses or submits again, **Then** no second settlement call is
   issued while one is in flight for that item — proven by a committed test.
6. **Given** a Question whose `handle_relay` call returned RESOLVED, **When**
   the ruling arrives, **Then** and only then does the Question leave the
   waiting rank; **Given** a pressed Escalation whose signal was accepted,
   **Then** it renders as in flight and leaves the waiting rank only when a
   factory read (`escalation_status` or `open_escalations`) reports its
   resolution — a press or submit alone changes no item's rank — proven by
   committed tests.
7. **Given** a stored Question, **When** the operator submits empty or
   whitespace-only text, **Then** zero settlement calls are made and the item
   is unchanged — proven by a committed test with the bridge substituted.
   `handle_relay` has no empty-answer guard of its own — `_settle_question`
   would signal the empty string through and park the node on nothing — so
   this local refusal is load-bearing, not redundant.

---

### User Story 3 - Honesty: rulings verbatim, countdowns from factory clocks (Priority: P2)

Every Question settlement ruling renders as the factory's word — the
`BridgeOutcome` string `handle_relay` returned: RESOLVED, UNKNOWN,
ALREADY_RESOLVED, EXPIRED, UNAUTHORIZED, SIGNAL_FAILED — with SIGNAL_FAILED
presented as retriable, because it alone means nothing was recorded. An
Escalation press has two honest words only: SIGNAL_FAILED when the signal RPC
raised — the same "nothing was recorded" — and the resolution the factory's
own reads later report; the other rulings belong to the Question seam and the
pane never mints them for a press. Every answerable item shows its time left
counted down to the factory's `expires_at`, never to a deadline the pane made
up from its own receipt clock.

**Why this priority**: P2 only because it renders what US2 produces. It is the
constitution-III half of the verb: a carried Answer whose refusal is softened
is worse than no verb at all.

**Independent Test**: drive all six Question rulings through the rendering
path and assert the verbatim strings and the retriability split; render a
fixture Escalation and a fixture Question whose factory-reported `expires_at`
disagrees with intake-time arithmetic and assert the reported value wins.

**Acceptance Scenarios**:

1. **Given** each of the six rulings — RESOLVED, UNKNOWN, ALREADY_RESOLVED,
   EXPIRED, UNAUTHORIZED, SIGNAL_FAILED — **When** it returns from
   `handle_relay` for a Question, **Then** the ruling string renders verbatim
   on that item, in place — proven by one committed test iterating all six.
2. **Given** a ruling string the pane does not recognize, **When** it arrives,
   **Then** it renders verbatim as itself — never remapped to a friendlier
   word, never a crash — proven by a committed test. The factory's vocabulary
   may grow; the pane's honesty must not depend on knowing it.
3. **Given** SIGNAL_FAILED — returned by `handle_relay` for a Question, or
   derived from the signal RPC raising for an Escalation press, the one
   ruling the pane may derive itself because it means exactly "nothing was
   recorded" — **When** rendered, **Then** the item's Answer controls remain
   live and the rendering says nothing was recorded and resending is safe —
   proven by a committed test.
4. **Given** any of the other five rulings, **When** rendered, **Then** the
   item does not invite resending the same Answer — proven by a committed
   test. This is the control: making every ruling retriable would let a stale
   press re-answer a settled item.
5. **Given** a Fixture floor Escalation whose `expires_at` reported through
   `open_escalations` differs from intake time plus 3600 seconds, **When** the
   Desk renders its countdown, **Then** the countdown targets the reported
   `expires_at` — the factory's clock wins over the pane's — proven by a
   committed test.
6. **Given** a Fixture floor Question whose stored `expires_at` — the value
   the factory wrote at send time, carried by the stored Question documents
   the attention read assembles — differs from intake receipt time plus 28800
   seconds, **When** the Desk renders its countdown, **Then** the countdown
   targets the stored `expires_at` — proven by a committed test.
7. **Given** an item whose `expires_at` has passed, **When** rendered,
   **Then** it shows as expired but is not deleted by the pane, and a late
   Answer still goes to the factory — a Question's ruling renders per
   scenario 1, a pressed Escalation's fate per the factory's resolution read
   — proven by a committed test. Expiry is the factory's ruling to make; the
   countdown is only a forecast of it.

---

### User Story 4 - The token: one gate in front, the factory's ruling behind (Priority: P2)

Every route but intake — which FR-015 guards with the URL-carried credential —
and the SSE stream sit behind the single shared bearer token (D-007). An
unauthenticated request gets one refusal shape that leaks nothing. The token
and the answer identity are two distinct configured values: the token decides
who can see, and the factory's bridge — checking the identity against
`escalation.authorized_responders` and returning UNAUTHORIZED — decides whose
Question answers count. The escalation signal seam performs no responder
check today: `EscalationWorkflow._answer` accepts the first offered choice
whatever identity rides with it, so an unauthorized identity's direct signal
would settle an escalation. That is a factory-side gap this spec surfaces,
not one the pane can close — a pane-side responder check would be the second
source of truth D-001 forbids.

**Why this priority**: P2 in build order because it hardens surfaces the
earlier stories create; non-negotiable in substance (constitution VI). The
epic is not done until this story is.

**Independent Test**: enumerate the backend's registered routes and assert
each refuses without the token; answer a fixture Question with a valid token
and a non-responder identity and assert UNAUTHORIZED renders unsoftened.

**Acceptance Scenarios**:

1. **Given** every route the backend registers, the SSE stream included,
   **When** each is requested without the token, **Then** each refuses with
   the one refusal shape — proven by one committed parametrized test that
   enumerates the routes from the application object, not from a hand-kept
   list. The intake route is the enumerated exception, not a silent one: for
   it the same test asserts refusal when neither the token nor FR-015's URL
   credential is present. A hand-kept list is how a new route ships
   unguarded.
2. **Given** a request with a wrong token, **When** refused, **Then** the
   refusal is byte-identical to the missing-token refusal and carries no floor
   data, no route names, and no credential echo — proven by a committed test.
3. **Given** the intake route, **When** the factory's bare POST arrives on the
   operator-configured URL carrying the intake credential, **Then** it is
   accepted; without the credential, it is refused per scenario 1's shape and
   nothing is stored — proven by a committed test. The credential rides the
   URL because the factory sends no headers: `factory/notify/webhook.py`
   itself treats everything after the endpoint origin as a secret to redact.
4. **Given** a valid token and a configured identity absent from
   `escalation.authorized_responders`, **When** a Question is answered,
   **Then** the factory's UNAUTHORIZED ruling — `handle_relay`'s return, the
   only seam that speaks it — renders verbatim on the item; the pane performs
   no responder check of its own and softens nothing — proven by a committed
   test with the ruling recorded on the Fixture floor per FR-018.
5. **Given** the committed tree, **When** a committed sweep test runs over
   every file of the Fixture floor and every committed fixture, **Then** no
   token value, no identity value, and no token-carrying URL appears in any of
   them — and a committed log-capture test around intake and settlement
   asserts log lines name correlation ids, never the token or the full intake
   path — proven by those two tests.

---

### Edge Cases

- The factory POSTs while no Desk is connected to the stream: the item is
  stored, and a Desk that connects later finds it in the attention list —
  SSE is the fast path, never the only path.
- An empty free-text submission on a Question issues no settlement call (US2
  scenario 7). `handle_relay` itself has no empty-answer guard — the
  emptiness checks live in the adapters' `relay` translations and the
  Telegram-only `handle_reply`, none of which the pane rides — so the pane's
  local refusal is the only thing standing between an empty submit and a
  node parked on an empty answer.
- The pane's clock is skewed against the factory's: a countdown may reach zero
  early or late; either way the rendering is a forecast and the factory's
  ruling on a late Answer is what the item finally shows (US3 scenario 7).
- The SSE connection drops mid-window: on reconnect the attention list is the
  source of truth; no item is lost with the stream.

## Requirements

### Functional Requirements

- **FR-001**: The backend MUST expose one intake route for
  `ERGANE_WEBHOOK_URL`, accepting the factory's POST
  `{correlation_id, text, actions[]}` exactly as `factory/notify/webhook.py`
  sends it, and MUST respond 2xx only after the Attention item is durably
  stored, well inside the factory's 10-second delivery window.
- **FR-002**: A payload with a 12-hex `correlation_id` and no actions MUST be
  stored as a Question; one with a 12-hex `correlation_id` and actions MUST
  be stored as an Escalation carrying every delivered label and payload
  verbatim, in delivery order; an actionless payload with a non-12-hex
  `correlation_id` — a supervision alert (`"supervision"`) or a roadmap
  notice (`"roadmap-<root>"`) — MUST be stored as a Notice: rendered
  verbatim, carrying no controls and no settlement state.
- **FR-003**: A malformed payload — missing `correlation_id`, missing `text`,
  actions accompanied by a non-12-hex `correlation_id`, or any action payload
  not matching `esc:<12hex>:<CHOICE>` — MUST be refused with non-2xx and MUST
  store nothing.
- **FR-004**: Intake MUST be idempotent on `correlation_id` for Questions and
  Escalations: re-delivery answers 2xx and creates no second Attention item.
  Notices are exempt — the factory reuses their correlation ids across
  distinct events, and deduplicating them would silence real alerts.
- **FR-005**: An accepted Attention item MUST be pushed over the SSE stream in
  the same handling as its storage — as an `attention` event, a declared
  extension of 001's typed event vocabulary (FR-016 there): consumers ignore
  unknown types, so surfaces built before this spec are unaffected until they
  opt in — and MUST also appear in the Desk's attention list for clients that
  connect later.
- **FR-006**: A Question MUST settle only through `CallbackBridge.handle_relay`
  with an `InboundRelay` of the item's correlation id, the operator's text
  verbatim, and the configured answer identity — never a hand-rolled store
  write or signal. An empty or whitespace-only submission MUST issue no
  settlement call: `handle_relay` carries no empty-answer guard of its own,
  so the pane's local refusal is the only one.
- **FR-007**: An Escalation MUST render exactly the factory's delivered
  choices — one control per action, label verbatim, delivery order — and MUST
  NOT add, drop, reorder, or reword any choice.
- **FR-008**: A pressed choice MUST settle only through the
  `escalation_resolved` signal with args `[escalation_id, choice, identity]`
  on the workflow whose id is the correlation id, with escalation id and
  choice parsed from the pressed action's payload, never fabricated.
- **FR-009**: The pane MUST NOT settle anything itself: a Question leaves the
  waiting rank only on the ruling `handle_relay` returns, an Escalation only
  when a factory read (`escalation_status` or `open_escalations`) reports its
  resolution, an unruled Answer renders as in flight, and at most one
  settlement call per item is in flight at a time.
- **FR-010**: Every Question settlement ruling — the `BridgeOutcome` string
  `handle_relay` returns: RESOLVED, UNKNOWN, ALREADY_RESOLVED, EXPIRED,
  UNAUTHORIZED, SIGNAL_FAILED — MUST render verbatim on its item, and an
  unrecognized ruling string MUST render as itself, never remapped. An
  Escalation press yields no ruling — the signal returns nothing — so the
  pane MUST render only what it can observe: SIGNAL_FAILED when the signal
  RPC raised, in flight while accepted but unconfirmed, and the resolution
  the factory read reports; it MUST NOT mint any other ruling for a press.
- **FR-011**: SIGNAL_FAILED MUST present as retriable — controls live, wording
  saying nothing was recorded — and no other ruling may invite resending the
  same Answer.
- **FR-012**: Countdowns MUST anchor on factory truth: an Escalation's on the
  `expires_at` reported through `open_escalations`, a Question's on the
  `expires_at` the factory wrote at send time — read from the factory's
  questions store per FR-019, a read this spec adds to the attention
  assembly — never on receipt-time arithmetic; a factory-reported `expires_at` MUST win over
  anything the pane inferred at intake, and the pane MUST NOT present a
  deadline computed from its own receipt clock as the factory's. An item the
  factory read has not yet supplied an `expires_at` for shows no deadline
  rather than a minted one.
- **FR-013**: An item past its `expires_at` MUST render as expired without
  being deleted by the pane; a late Answer still goes to the factory and its
  ruling renders per FR-010.
- **FR-014**: Every route and the SSE stream — except the intake route, which
  FR-015 guards with the URL-carried credential instead — MUST require the
  shared bearer token from environment/config; a request with a missing or
  wrong token MUST receive one refusal shape carrying no floor data, no route
  names, and no credential echo, identical in both cases. Closing this seam
  amends the smoke setup 001 and 002 committed — those smokes now
  authenticate with the configured token — and this spec declares that
  rewrite of landed tests as in scope, so the judge scores it as work, not
  drift.
- **FR-015**: The intake route MUST be guarded by a credential carried in the
  operator-configured `ERGANE_WEBHOOK_URL` — the factory sends a bare POST
  with no headers — and an intake POST without it MUST be refused per FR-014
  with nothing stored.
- **FR-016**: The answer identity MUST be a configured value distinct from the
  token, passed verbatim to both settlement seams; the pane MUST perform no
  responder check of its own and MUST render the factory's UNAUTHORIZED
  ruling unsoftened. Only the Question seam speaks that ruling —
  `handle_relay` runs the `escalation.authorized_responders` check; the
  escalation signal seam does not, and the pane neither compensates for that
  gap nor hides it.
- **FR-017**: No credential value — the token, the intake credential, or the
  URL embedding either — may appear in a rendered page, an SSE event, a log
  line, or a committed fixture; intake and settlement log lines MUST identify
  work by correlation id.
- **FR-018**: The Fixture floor MUST carry ruling fixtures recorded from the
  real Question seam — one `BridgeOutcome` recording per ruling reachable
  through `handle_relay`, never hand-written (constitution V). No Escalation
  ruling fixture exists to record, because the signal seam returns nothing;
  no fixture may pretend otherwise. Ruling fixtures follow 001's provenance
  discipline: recorded and committed before this spec is readied — an
  operator act — and no attempt's diff adds or modifies one.
- **FR-019**: The attention assembly MUST join each live Question's
  factory-written `expires_at` from the factory's questions store —
  `factory.verify.store.get_question`/`pending_questions` over
  `connect_readonly` — extending 001's read, whose recorded Question payloads
  carry no expiry; a Question absent from the store keeps no deadline, per
  FR-012. The stored Question document 001's FR-007 records is this read's
  fixture evidence.

### Key Entities

- **Attention item**: one thing the factory delivered — a Question (free
  text) or an Escalation (choices), keyed by the factory's 12-hex correlation
  id, carrying the delivered text and actions verbatim, the factory's
  `expires_at`, and its settlement state: waiting, in flight, or ruled — or a
  Notice (a supervision alert or roadmap notice), rendered verbatim with no
  controls, no settlement state, and no countdown.
- **Delivered action**: one `{label, payload}` pair exactly as the factory
  sent it; the payload's grammar `esc:<12hex>:<CHOICE>` is the factory's, and
  the pane only parses it, never produces it.
- **Settlement ruling**: the factory's word on one carried Question Answer —
  the `BridgeOutcome` `handle_relay` returns: one of the six named outcomes,
  or any future string, rendered verbatim. SIGNAL_FAILED is the only ruling
  that means nothing was recorded, and the only one an Escalation press can
  surface — derived from the signal RPC raising; an Escalation's fate
  otherwise arrives as the resolution the factory's reads report.
- **Answer identity**: the configured responder value the settlement seams
  carry; judged solely by the factory against
  `escalation.authorized_responders`.
- **The shared token**: the single credential guarding every route and the
  stream (D-007); configured, never rendered, streamed, logged, or committed.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Committed backend tests prove the intake round trip: recorded
  Question and Escalation payloads yield 2xx, a correctly classified stored
  item, and one SSE event; a supervision alert and a roadmap notice yield 2xx
  and a stored Notice; every malformed variant yields non-2xx with nothing
  stored; re-delivery of an answerable item yields one item, not two.
- **SC-002**: Committed seam-substitution tests prove Answer's fidelity: one
  `handle_relay` call carrying the correlation id, verbatim text, and
  configured identity per Question submit; one `escalation_resolved` signal
  carrying `[escalation_id, choice, identity]` on the workflow id equal to the
  correlation id per press; zero settlement calls from anywhere else in the
  pane.
- **SC-003**: Committed rendering tests prove all six Question ruling strings
  render verbatim, an unrecognized string renders as itself, only
  SIGNAL_FAILED leaves the Answer controls live, and a pressed Escalation
  renders only signal-failed, in flight, or the factory-read resolution —
  never a minted ruling.
- **SC-004**: The committed route-enumeration test proves every registered
  route and the SSE stream refuse without the token — the intake route
  refusing when neither the token nor the URL credential is present — with
  byte-identical refusals for missing and wrong tokens.
- **SC-005**: The committed sweep and log-capture tests prove no credential
  value in any committed fixture and none in captured intake or settlement
  logs.
- **SC-006**: **Control.** The headless Playwright smoke, with the token
  configured, loads the Desk against the Fixture floor, submits a fixture
  Question's answer and sees the recorded ruling render, and presses a
  fixture Escalation's button and sees the item render as in flight — proving
  the gate guarded the pane without walling it off.

## Assumptions

- Answer's appearance — the clock, the choice buttons carrying their payloads, the
  reply field, the ruling line — is governed by `DESIGN.md` (constitution VIII,
  D-012). Scenarios here say *what* is shown and *what is sent*; DESIGN.md says
  *how it looks*.
- This spec depends on 001 landing first (`depends_on_landed`, D-008/D-010):
  its base contains the scaffold, gates, Fixture floor, and the Desk's
  attention read before any of its worktrees are cut. The repository contains no application code today;
  every scenario above is judged against code this epic and 001 land, not
  code presumed to exist.
- The factory's webhook sender POSTs bare JSON with no auth header and treats
  everything after the endpoint origin as a credential to redact — verified
  this session against `factory/notify/webhook.py`. FR-015's URL-carried
  credential follows from that fact, not from preference.
- The settlement seams are the same cores the CLI uses:
  `CallbackBridge.handle_relay` for Questions and the `escalation_resolved`
  signal for Escalations, reached through the Temporal client the 001 backend
  already holds (D-005, D-007). Only the Question seam returns a ruling; the
  signal returns nothing. The payload shapes and the Question-seam ruling
  shapes on the Fixture floor are recorded from the real seams, never
  invented (constitution V, FR-018) — which is exactly why no Escalation
  ruling fixture exists.
- An Escalation's `expires_at` comes from
  `factory.escalation.client.open_escalations`; the intake payload carries no
  expiry. A Question's comes from the questions store the factory writes at
  send time — `expires_at` on the row, readable through
  `factory.verify.store.get_question`/`pending_questions` — a read FR-019
  adds to the attention assembly; 001's recorded payloads carry no expiry —
  so both countdowns anchor on factory-written values, per FR-012.
- Settlement windows are the factory's: 3600 seconds for an Escalation, 28800
  for a Question. The pane displays them; it never enforces them.

## Out of Scope

- A second verb (D-001). No dispatch, promote, pause, kill, ready-flip, or
  spec edit from the pane — an item's only controls are the factory's
  delivered choices and a Question's free text.
- Redaction for a public Showfloor. D-007 rejected an unauthenticated window
  into live repo state; a superseding decision entry, not this spec, would
  change that.
- Multi-user identity: one token, one configured answer identity. Sessions,
  roles, and per-operator attribution are future decisions.
- Changing the factory's notify transports. The factory resolves exactly one
  adapter, so an operator who points `ERGANE_WEBHOOK_URL` at the pane has
  routed *all* notify traffic here — Questions, Escalations, supervision
  alerts, roadmap notices — which is why intake carries the Notice class
  rather than pretending Telegram still does. `ergane answer` keeps working
  regardless; it is a settling core, not a transport.
- Closing the factory's escalation-seam gap. The missing responder check in
  `EscalationWorkflow` is factory work; this spec surfaces it (US4) and
  refuses to paper over it pane-side.
- Factory-side re-delivery machinery. Non-2xx counts as undelivered and what
  the factory does next is the factory's business; the pane's whole contract
  is answering honestly.

## Work Graph

```yaml
US1:
  depends_on: []
  implements: [FR-001, FR-002, FR-003, FR-004, FR-005]
US2:
  depends_on: []
  depends_on_merged: [US1]
  implements: [FR-006, FR-007, FR-008, FR-009]
US3:
  depends_on: []
  depends_on_merged: [US2]
  implements: [FR-010, FR-011, FR-012, FR-013, FR-018, FR-019]
US4:
  depends_on: []
  depends_on_merged: [US3]
  implements: [FR-014, FR-015, FR-016, FR-017]
```

The chain is contention, not logic: all four stories touch the backend
application and three touch the Desk's item rendering, so each story's base
must contain its predecessor's merge — declaring them independent while they
share those files is the known dispatch-against-a-stale-base defect. us4 sits
last in build order only; constitution VI makes it non-negotiable in
substance, and SC-004 through SC-006 are part of this epic's definition of
done.
