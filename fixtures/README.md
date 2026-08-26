# The Fixture floor

Recorded documents from a real Ergane floor and from ergane's real seams — never
invented (constitution V). Every payload is written verbatim by
`scripts/record-fixtures.py` (seam reads) or `scripts/record-fixtures-harness.py`
(on-cue states driven through ergane's own test harness against the real Temporal
server). Provenance lives beside each payload in a `*.envelope.json` sidecar — the
capture instant, the seam, the source floor, notes — never inside it (spec 001 FR-009).

Capture window: **2026-08-22**, host `tharpebox`, `ergane-cli 0.2.0` (PyPI),
managed Temporal at `127.0.0.1:7233` namespace `ergane`, registry routing
`ollama-cloud/kimi-k2.7-code` (builds) / `ollama-cloud/glm-5.2` (judge).

## Layout (spec 001 FR-007 manifest → file)

Two capture families, both real:

- **`floor/`, `epic-status/002-expense-notes/`, `usage/`, `doctor/`, `workgraphs/`** — read from
  the live factory with `scripts/record-fixtures.py` while the two-story epic
  `002-expense-notes` built on Kimi in the sibling repository `ergane-test` (two PRs landed
  through its real merge queue; the repository was then forgotten from this factory).
- **`escalations/`, `questions/`, `bridge/`, `webhook/`, `notices/`, `epic-status/{landing,paged,question}/`, `epic-status/refusal*.json`** — on-cue states produced by `scripts/record-fixtures-harness.py`:
  ergane's own interpreter test harness (`tests/test_interpreter.py`: scripted attempts,
  scripted landing snapshots) run as a worker against the **real** Temporal server, with
  the **real** notify activities, the **real** verification store and the **real** webhook
  adapter posting to a local recorder. Every document there is a verbatim seam output
  (run `run-20260822T174042Z-a692e2`, 53 documents; the capture record — the run manifest and
  the raw webhook journal — is under `capture/`). The capture method is recorded in each
  envelope and here, never in a directory name: consumers read a document by what it *is*.

| Requirement | Path | Seam |
|---|---|---|
| FloorStatus, busy floor | `floor/floor-live.json` | `collect_floor` during the live epic |
| FloorStatus, quiet floor (no epics, empty queue) | `floor/floor-quiet.json` | `collect_floor` over this repo's `specs/`, three drafts, nothing running |
| `workgraph.json` ×3 | `workgraphs/002-expense-notes.json` (2 nodes, merge edge), `workgraphs/077-…-runs-in-the-loop.json` (5 nodes, **both edge kinds, a same-rank pair**), `workgraphs/001-trip-expenses.json` (inferred merge edges, `inferred_edges` populated) | `ergane spec derive` |
| `epic_status` through the landing run on a live floor | `epic-status/002-expense-notes/*.json` — 13 distinct answers polled at 3 s: RUNNING → VERIFYING (four judge FAIL/retry cycles) → PASSED → ENQUEUED → MERGED, epic COMPLETED | Temporal query `epic_status` |
| `epic_status` through the landing run, every transition | `epic-status/landing/*.json` — 14 answers: PASSED, PR_OPEN, ENQUEUED, MERGED for each of three nodes | harness landing scene |
| `awaiting_operator: true` while `state: VERIFYING` | `epic-status/paged/paged.json` (harness), `epic-status/paged/paged-live.json` (**live floor**, same shape) | ladder exhausted → real EscalationWorkflow child open |
| `KILLED`, every node, with a killed node's real attempt history | `epic-status/killed/killed.json` | this repository's own 001 after the operator answered `KILL_EPIC` |
| `WAITING_OPERATOR` (question park) | `epic-status/question/waiting-operator.json` | `## OPERATOR QUESTION` marker → QuestionWorkflow |
| `epic_status` refusal variant | `epic-status/refusal.json` (the `ergane build status --json` document: `refusal`, `nodes: {}`), `epic-status/refusal-exception.json` | closed execution queried under `NOT_OPEN` through the CLI's own `_query_status` |
| `epic_status` naming a node its `workgraph.json` does not declare (FR-026) | `epic-status/skew/status-names-us3.json` paired with `workgraphs/002-expense-notes.json` | two verbatim documents; the pairing is the operator's (see envelope) |
| Open Escalations incl. `expires_at` ≠ send + 3600 s | `escalations/open_escalations.json` (15-min expiry), `escalations/open_escalations-2.json` (20-min), store rows beside them | `open_escalations`, `factory.verify.store` |
| A stored Question with factory-written `expires_at` | `questions/pending_questions.json` (+ `questions/expired-question.json`, `questions/answered-question.json`) | `pending_questions` / `get_question` |
| Webhook payloads | `webhook/question.json` (`actions: []`), `webhook/escalation.json` (`esc:<12hex>:<CHOICE>` ×4), `webhook/notice-supervision.json` (`correlation_id: "supervision"`), `webhook/notice-roadmap.json` (`roadmap-…`), `webhook/question-expired.json`, `webhook/escalation-standalone.json`; the raw journal `capture/webhook-received.jsonl` | the real `WebhookAdapter.deliver` |
| Usage rollup with NULLs | `usage/rollup-by-persona.json` (judge `prompt_tokens` NULL → totals NULL), `usage/rollup-by-node.json` | `rollup` over `open_readonly` of the real ledger |
| Doctor findings | `doctor/findings.json` — five findings filed through `ergane findings report` from this dogfood round | `list_findings` over `connect_readonly` |
| Bridge rulings | `bridge/{RESOLVED,ALREADY_RESOLVED,UNKNOWN,EXPIRED,UNAUTHORIZED}.json` (each named for the ruling it records), `bridge/malformed-relay.json` | `CallbackBridge.handle_relay` |

States observed across all `epic_status` documents: PENDING, RUNNING, VERIFYING, PASSED,
PR_OPEN, ENQUEUED, MERGED, WAITING_OPERATOR, **KILLED** (nine of eleven). KEY_ISSUED is
transient and was never caught between polls; FAILED is written by nothing in 0.2.0.
KILLED was recorded on 2026-08-22 from this repository's own epic after the operator
answered `KILL_EPIC` on the N26 deadlock — the factory building the pane supplied the
pane's own worst-case fixture. The shape test asserts membership in the eleven, not
coverage.

`killed.json` is worth reading for its `history` array specifically: a killed node keeps
every attempt it spent (here six — three `implementer`, then three `debugger`, each
`FAIL`/`RETRY`, each with its `model_alias`), while the nodes downstream of it are KILLED
at `attempt: 0` with `persona: ""` and `model_alias: "<unresolved>"`. A Showfloor that
renders a killed epic has to say those two things differently.

Sweep note: the credential sweep must anchor secret-looking prefixes on a word boundary —
`the-desk-sees-the-floor` contains the substring `sk-sees`.

### Not recorded yet: the per-node gate run (013 US1)

`FixtureReader.node_history` looks for `verification/<epic_id>/<node_id>.json` — one
recorded `factory.verify.store.node_history` answer per node — and **no such document
exists**. Until one is captured the read takes the missing-document rule above and comes
back as a transport failure naming the path it looked for, which is what the gate-run
section then says in words. That is deliberate: the evidence store is written on the
operator's host by a real build, and a hand-written gate run would be a pane that renders
the fixture and not the factory (constitution V).

Two things to get right when recording one. The answer's `output_tail` is raw process
output and has never been swept for a credential, so the sweep runs over the recording
before it is committed like every other file here (constitution VI). And the rows are
overwritten by a re-dispatch (N28) — a recording is one dispatch's record, and the
envelope should say which epic and which day it came from.

## Re-recording

```bash
eval "$(~/.config/ergane/ergane-env.sh)"
PY=~/.local/share/uv/tools/ergane-cli/bin/python
$PY scripts/record-fixtures.py floor specs fixtures/floor/floor-quiet.json
$PY scripts/record-fixtures.py watch <epic-id> fixtures/epic-status/<epic-id> 7200
$PY scripts/record-fixtures.py escalations fixtures/escalations/open_escalations.json
$PY scripts/record-fixtures.py rollup "$ERGANE_LEDGER_PATH" fixtures/usage/rollup-by-persona.json --by persona
$PY scripts/record-fixtures.py findings "$ERGANE_ROOT/doctor.db" fixtures/doctor/findings.json
$PY scripts/record-fixtures.py questions "$ERGANE_VERIFICATION_DB_PATH" fixtures/questions/pending_questions.json
# on-cue states (stop the systemd worker first; the harness runs its own):
systemctl --user stop ergane-worker && sleep 95   # the harness refuses while another poller holds the queue
PYTHONPATH=~/code/ergane $PY scripts/record-fixtures-harness.py --out fixtures/raw-harness
# then promote raw-harness/* into the semantic layout above (see git log for the mapping)
systemctl --user start ergane-worker
```

When a contract gains a field, re-record; never hand-edit a payload (FR-008).
Credential sweep (`uv run pytest -q -k credential`) must pass before commit (FR-012).

## How the loader replays this set

US2's `FixtureReader` loads `fixtures/floor/floor-live.json` verbatim and then
composes the running-epic list from the scene table below.  Each row is an
`EpicRef`; the `workgraph_ref` is the row's recorded graph stem when one exists,
otherwise the epic id.  When a graph path is absent, the loader's
`load_document` raises `TransportFailed("workgraph", "<path>: not recorded yet
(fixtures/README.md)")`; the assembly catches that and emits one degraded entry
per scene.  This is honest degradation, not a defect: constitution V forbids
inventing a graph, and constitution III requires the failed read to be named.

| scene | epic id | status document | workgraph | what it stages |
|---|---|---|---|---|
| `polled` | `002-expense-notes` | `fixtures/epic-status/002-expense-notes/002-expense-notes-013-us1=MERGED-MERGED_us2=MERGED-MERGED.json` | `fixtures/workgraphs/002-expense-notes.json` | the live Kimi epic; `us1`/`us2` MERGED, epic COMPLETED |
| `landing` | `fx-landing-f0a0d6` | `fixtures/epic-status/landing/final.json` | — none recorded | the landing run's end state, three nodes MERGED |
| `paged-while-verifying` | `fx-paged-5e2e8a` | `fixtures/epic-status/paged/paged.json` | — none recorded | `us1` `VERIFYING` with `awaiting_operator: true` |
| `question` | `fx-question-e8c371` | `fixtures/epic-status/question/waiting-operator.json` | — none recorded | `us1` `WAITING_OPERATOR`, epic `PAUSED` |
| `refusal` | `fx-landing-f0a0d6` | `fixtures/epic-status/refusal.json` | — none recorded | `refusal` key → `QueryRefused`; the recorded string is `Query rejected, status: 2` |
| `skew` | `fx-landing-f0a0d6` | `fixtures/epic-status/skew/status-names-us3.json` | `fixtures/workgraphs/002-expense-notes.json` (its envelope's `pair_with`) | the answer names `us3`; the paired graph declares only `us1`, `us2` |

Three rows share the epic id `fx-landing-f0a0d6`; `scene` is what keeps them
distinct.  A clean `PANE_DEMO=1` run therefore carries five degraded entries:
four transport entries for the missing workgraphs above, plus one refusal entry
for the `refusal` scene.

`reference_instant` is the `captured_at` value of
`fixtures/escalations/open_escalations.envelope.json`, falling back to
`fixtures/floor/floor-live.envelope.json` when the escalations envelope is not
present.

`PANE_DEMO_TRANSPORT_FAIL` accepts a comma-separated list of section names from
`{floor, epics, attention, health, spend}` and makes the named demo reads raise
`TransportFailed` before touching disk.
