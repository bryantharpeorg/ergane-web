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
- **`raw-harness/`** — on-cue states produced by `scripts/record-fixtures-harness.py`:
  ergane's own interpreter test harness (`tests/test_interpreter.py`: scripted attempts,
  scripted landing snapshots) run as a worker against the **real** Temporal server, with
  the **real** notify activities, the **real** verification store and the **real** webhook
  adapter posting to a local recorder. Every document there is a verbatim seam output
  (run `run-20260822T174042Z-a692e2`, 53 documents, `raw-harness/manifest.json`).

| Requirement | Path | Seam |
|---|---|---|
| FloorStatus, busy floor | `floor/floor-live.json` | `collect_floor` during the live epic |
| FloorStatus, quiet floor (no epics, empty queue) | `floor/floor-quiet.json` | `collect_floor` over this repo's `specs/`, three drafts, nothing running |
| `workgraph.json` ×3 | `workgraphs/002-expense-notes.json` (2 nodes, merge edge), `workgraphs/077-…-runs-in-the-loop.json` (5 nodes, **both edge kinds, a same-rank pair**), `workgraphs/001-trip-expenses.json` (inferred merge edges, `inferred_edges` populated) | `ergane spec derive` |
| `epic_status` through the landing run on a live floor | `epic-status/002-expense-notes/*.json` — 13 distinct answers polled at 3 s: RUNNING → VERIFYING (four judge FAIL/retry cycles) → PASSED → ENQUEUED → MERGED, epic COMPLETED | Temporal query `epic_status` |
| `epic_status` through the landing run, every transition | `raw-harness/epic-status/fx-landing-*.json` — 14 answers: PASSED, PR_OPEN, ENQUEUED, MERGED for each of three nodes | harness landing scene |
| `awaiting_operator: true` while `state: VERIFYING` | `raw-harness/epic-status/fx-paged-5e2e8a-paged.json` | ladder exhausted → real EscalationWorkflow child open |
| `WAITING_OPERATOR` (question park) | `raw-harness/epic-status/fx-question-e8c371-waiting-operator.json` | `## OPERATOR QUESTION` marker → QuestionWorkflow |
| `epic_status` refusal variant | `raw-harness/epic-status/refusal.json` (the `ergane build status --json` document: `refusal`, `nodes: {}`), `refusal-exception.json` | closed execution queried under `NOT_OPEN` through the CLI's own `_query_status` |
| `epic_status` naming a node its `workgraph.json` does not declare (FR-026) | `epic-status/skew/status-names-us3.json` paired with `workgraphs/002-expense-notes.json` | two verbatim documents; the pairing is the operator's (see envelope) |
| Open Escalations incl. `expires_at` ≠ send + 3600 s | `raw-harness/escalations/open_escalations.json` (15-min expiry), `open_escalations-2.json` (20-min), store rows beside them | `open_escalations`, `factory.verify.store` |
| A stored Question with factory-written `expires_at` | `raw-harness/questions/pending_questions.json` (+ `expired-question.json`, `answered-question.json`) | `pending_questions` / `get_question` |
| Webhook payloads | `raw-harness/webhook/question.json` (`actions: []`), `escalation.json` (`esc:<12hex>:<CHOICE>` ×4), `notice-supervision.json` (`correlation_id: "supervision"`), `notice-roadmap.json` (`roadmap-…`), `question-expired.json`, `escalation-standalone.json`; the raw journal `webhook-received.jsonl` | the real `WebhookAdapter.deliver` |
| Usage rollup with NULLs | `usage/rollup-by-persona.json` (judge `prompt_tokens` NULL → totals NULL), `usage/rollup-by-node.json` | `rollup` over `open_readonly` of the real ledger |
| Doctor findings | `doctor/findings.json` — five findings filed through `ergane findings report` from this dogfood round | `list_findings` over `connect_readonly` |
| Bridge rulings | `raw-harness/bridge/{resolved,already_resolved,unknown,expired,unauthorized}.json`, `malformed-relay.json` | `CallbackBridge.handle_relay` |

States observed across all `epic_status` documents: PENDING, RUNNING, VERIFYING, PASSED,
PR_OPEN, ENQUEUED, MERGED, WAITING_OPERATOR (eight of eleven; KEY_ISSUED is transient,
FAILED is written by nothing in 0.2.0, KILLED needs a killed epic — none recorded).
The shape test asserts membership in the eleven, not coverage.

Sweep note: the credential sweep must anchor secret-looking prefixes on a word boundary —
`the-desk-sees-the-floor` contains the substring `sk-sees`.

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
systemctl --user stop ergane-worker && PYTHONPATH=~/code/ergane $PY scripts/record-fixtures-harness.py --out fixtures/raw-harness
```

When a contract gains a field, re-record; never hand-edit a payload (FR-008).
Credential sweep (`uv run pytest -q -k credential`) must pass before commit (FR-012).
