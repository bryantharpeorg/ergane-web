"""Countdowns anchor on factory clocks, and expiry is the factory's to rule on.

Every instant in this file is read out of a recorded document — never retyped —
so what is asserted is the join and not a constant a test author chose
(constitution V).  The two fixture items are the ones whose factory-reported
deadlines *disagree* with the arithmetic a pane inventing one would have done:

* the Escalation `d10263341dac` expires at its `sent_at` plus **900 s**
  (`fixtures/escalations/store-rows.json` shows both instants), which is neither
  3600 s after its `sent_at` nor 3600 s after the pane received it;
* the Question `800ee6b4c7df` expires at its `sent_at` plus 28800 s, written by
  the factory's own `_pending_question` — and the pane received the delivery
  fourteen seconds later, so receipt-time arithmetic lands on a different
  instant.

A pane anchoring on its own receipt clock therefore produces a *different*
value here rather than a plausible one, and these tests go red (FR-012).

The items are put into the store the way the factory puts them there: through
the intake route, from the recorded webhook payloads.  Both factory reads are
substituted at the `Reader` boundary 001 defined, so no test needs a live floor.
"""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from pane.app import create_app
from pane.config import Settings
from pane.readers import FloorRead, QueryRefused, StoredItem, TransportFailed

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"

CREDENTIAL = "intake-credential-for-tests"
IDENTITY = "pane-answer-identity-sentinel"

SEEDED = ("question", "escalation", "notice-supervision")


def recorded(*parts: str) -> dict | list:
    return json.loads((FIXTURES / Path(*parts)).read_text())


def delivery(name: str) -> dict:
    return json.loads((FIXTURES / "webhook" / f"{name}.json").read_text())


def envelope(*parts: str) -> dict:
    path = FIXTURES / Path(*parts)
    return json.loads(path.with_name(f"{path.name[: -len('.json')]}.envelope.json").read_text())


QUESTION = delivery("question")
ESCALATION = delivery("escalation")
NOTICE = delivery("notice-supervision")

#: The one recorded `open_escalations` row — a bare JSON array, one entry.
REPORTED_ESCALATION = recorded("escalations", "open_escalations.json")[0]
#: The one recorded questions-store row.  The document is an **object**: the
#: list lives under `pending_questions`, and it is never indexed as an array.
STORED_QUESTION = recorded("questions", "pending_questions.json")["pending_questions"][0]

#: 001's demo reference instant, from the escalation recording's own capture.
REFERENCE_INSTANT = envelope("escalations", "open_escalations.json")["captured_at"]


class JoinReader:
    """A `Reader` whose two US3 reads are set per test, and nothing else moves.

    `read_question` and `read_escalation_fate` each return whatever
    `question_record` / `escalation_fate` hold, or raise whatever
    `question_raises` / `fate_raises` hold.  The settlement seams record their
    arguments so the expiry scenarios can prove a late Answer still reaches the
    factory (US3-S7).
    """

    def __init__(self, attention_db: Path) -> None:
        self.attention_db = attention_db
        self.reference_instant: str | None = REFERENCE_INSTANT
        self.question_record: dict | None = STORED_QUESTION
        self.escalation_fate: dict | None = REPORTED_ESCALATION
        self.question_raises: Exception | None = None
        self.fate_raises: Exception | None = None
        self.escalations: list[dict] = recorded("escalations", "open_escalations.json")
        self.settled: list[tuple[str, str, str]] = []
        self.pressed: list[tuple[str, str, str, str]] = []
        self.ruling = "RESOLVED"

    async def read_question(self, correlation_id: str) -> dict | None:
        if self.question_raises is not None:
            raise self.question_raises
        record = self.question_record
        if record is None or record.get("question_id") != correlation_id:
            return None
        return record

    async def read_escalation_fate(self, correlation_id: str) -> dict | None:
        if self.fate_raises is not None:
            raise self.fate_raises
        fate = self.escalation_fate
        if fate is None or fate.get("escalation_id") != correlation_id:
            return None
        return fate

    async def settle_question(self, correlation_id: str, text: str, identity: str) -> str:
        self.settled.append((correlation_id, text, identity))
        return self.ruling

    async def press_escalation(
        self, correlation_id: str, escalation_id: str, choice: str, identity: str
    ) -> None:
        self.pressed.append((correlation_id, escalation_id, choice, identity))

    # --- 001's reads, enough for the document to assemble --------------------

    async def read_floor(self) -> FloorRead:
        return FloorRead(status={"epics": []}, running=[])

    async def epic_status(self, workflow_id: str, scene: str | None = None) -> dict:
        return {}

    def workgraph(self, epic_id_or_ref: str) -> dict:
        raise TransportFailed("workgraph", "no workgraph in this test")

    async def open_escalations(self) -> list[dict]:
        return self.escalations

    def stored_items(self) -> list[StoredItem]:
        from pane.attention_store import list_items, open_store

        conn = open_store(self.attention_db)
        try:
            return list_items(conn)
        finally:
            conn.close()

    def list_findings(self) -> list[dict]:
        return []

    def rollup(self) -> dict:
        return {"by": "persona", "filters": {}, "groups": [], "totals": {}}

    async def aclose(self) -> None:
        return None


@pytest.fixture
def join_app(tmp_path, monkeypatch):
    """The app with the three recordings delivered through the intake route."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PANE_INTAKE_CREDENTIAL", CREDENTIAL)
    monkeypatch.setenv("PANE_ANSWER_IDENTITY", IDENTITY)
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(FIXTURES))
    monkeypatch.delenv("PANE_DEMO", raising=False)

    reader = JoinReader(tmp_path / "attention.db")
    monkeypatch.setattr("pane.app._make_reader", lambda _settings: reader)

    app = create_app(Settings.from_env())
    app.state.join_reader = reader

    seeding_client = TestClient(app)
    for name in SEEDED:
        response = seeding_client.post(f"/intake/{CREDENTIAL}", json=delivery(name))
        assert 200 <= response.status_code < 300, response.text

    return app


@pytest.fixture
def client(join_app, auth_headers):
    return TestClient(join_app, headers=auth_headers)


@pytest.fixture
def reader(join_app) -> JoinReader:
    return join_app.state.join_reader


@pytest.fixture
def store_path(join_app) -> Path:
    """The pane's own delivery store, so the receipt instant can be read back."""
    return join_app.state.join_reader.attention_db


def item_for(client, correlation_id: str) -> dict:
    response = client.get("/api/attention")
    assert response.status_code == 200
    for item in response.json()["items"]:
        if item["correlation_id"] == correlation_id:
            return item
    raise AssertionError(f"{correlation_id} is not in the attention list")


def received_at(store_path: Path, correlation_id: str) -> str:
    """When the pane received the delivery — the instant it must never anchor on."""
    from pane.attention_store import get_item, open_store

    conn = open_store(store_path)
    try:
        stored = get_item(conn, correlation_id)
    finally:
        conn.close()
    assert stored is not None
    return stored.received_at


# --- US3-S5: the Escalation's countdown is the factory's, not the pane's ------


def test_the_escalation_countdown_is_the_expires_at_open_escalations_reported(client):
    """The reported value, byte for byte, and no arithmetic of the pane's own."""
    correlation_id = ESCALATION["correlation_id"]
    assert REPORTED_ESCALATION["escalation_id"] == correlation_id

    item = item_for(client, correlation_id)

    assert item["expires_at"] == REPORTED_ESCALATION["expires_at"]


def test_the_reported_escalation_expiry_is_not_intake_time_plus_3600(client, store_path):
    """The disagreement the scenario turns on, asserted rather than assumed.

    `store-rows.json` records the factory's own `sent_at` beside the `expires_at`
    it wrote: fifteen minutes, not an hour.  So a pane that had minted "receipt +
    3600 s" — or even "sent_at + 3600 s" — would be showing the operator a
    deadline the factory never wrote, and this test is what catches it.
    """
    from datetime import datetime, timedelta

    correlation_id = ESCALATION["correlation_id"]
    store_row = recorded("escalations", "store-rows.json")["get_escalation"]
    sent_at = datetime.fromisoformat(store_row["sent_at"])
    reported = datetime.fromisoformat(REPORTED_ESCALATION["expires_at"])

    assert reported - sent_at == timedelta(seconds=900)
    assert reported != sent_at + timedelta(seconds=3600)

    delivered_at = datetime.fromisoformat(received_at(store_path, correlation_id))
    assert reported != delivered_at + timedelta(seconds=3600)

    item = item_for(client, correlation_id)
    assert item["expires_at"] == REPORTED_ESCALATION["expires_at"]


def test_a_factory_reported_expiry_replaces_whatever_the_open_list_carried(client, reader):
    """The later, more specific word wins — and it is still the factory's."""
    correlation_id = ESCALATION["correlation_id"]
    reader.escalation_fate = {
        **REPORTED_ESCALATION,
        "expires_at": "2026-08-22T18:11:11Z",
    }

    item = item_for(client, correlation_id)

    assert item["expires_at"] == "2026-08-22T18:11:11Z"
    assert item["expires_at"] != REPORTED_ESCALATION["expires_at"]


def test_the_open_escalations_entry_remains_the_fallback(client, reader):
    """`escalation_status` silent, the list still speaking: 001's read stands in."""
    correlation_id = ESCALATION["correlation_id"]
    reader.escalation_fate = None

    item = item_for(client, correlation_id)

    assert item["expires_at"] == REPORTED_ESCALATION["expires_at"]


# --- US3-S6: the Question's countdown is the one the factory stored -----------


def test_the_question_countdown_is_the_stored_expires_at(client):
    correlation_id = QUESTION["correlation_id"]
    assert STORED_QUESTION["question_id"] == correlation_id

    item = item_for(client, correlation_id)

    assert item["expires_at"] == STORED_QUESTION["expires_at"]


def test_the_stored_question_expiry_is_not_receipt_time_plus_28800(client, store_path):
    """Send time plus eight hours, not receipt time plus eight hours.

    The factory wrote the expiry when it *sent* the question; the pane received
    the delivery afterwards.  The two arithmetics differ by exactly that lag, so
    a countdown built from the receipt clock is wrong by it — quietly, and in the
    operator's favour, which is the worst way to be wrong about a deadline.
    """
    from datetime import datetime, timedelta

    correlation_id = QUESTION["correlation_id"]
    sent_at = datetime.fromisoformat(STORED_QUESTION["sent_at"])
    stored = datetime.fromisoformat(STORED_QUESTION["expires_at"])
    delivered_at = datetime.fromisoformat(received_at(store_path, correlation_id))

    assert stored - sent_at == timedelta(seconds=28800)
    assert delivered_at > sent_at
    assert stored != delivered_at + timedelta(seconds=28800)

    item = item_for(client, correlation_id)
    assert item["expires_at"] == STORED_QUESTION["expires_at"]
    assert datetime.fromisoformat(item["expires_at"]) != delivered_at + timedelta(seconds=28800)


def test_a_question_the_store_has_no_row_for_keeps_no_deadline(client, reader):
    """No row, no deadline — and certainly not one minted to fill the gap."""
    reader.question_record = None

    item = item_for(client, QUESTION["correlation_id"])

    assert item["expires_at"] is None
    assert item["degraded"] is None


def test_a_notice_is_joined_to_nothing_and_keeps_no_deadline(client):
    item = item_for(client, NOTICE["correlation_id"])

    assert item["expires_at"] is None
    assert item["settlement"]["state"] == "none"


def test_a_reported_resolution_settles_the_item_in_the_factory_word(client, reader):
    """`settled` is reachable only through the factory's own word (D-P8)."""
    reader.question_record = {**STORED_QUESTION, "resolution": "ANSWERED"}

    item = item_for(client, QUESTION["correlation_id"])

    assert item["settlement"]["state"] == "settled"
    assert item["settlement"]["resolution"] == "ANSWERED"


# --- US3-S7: expiry is the factory's ruling; the countdown only forecasts it --


@pytest.fixture
def past_deadline(reader):
    """A reference instant later than both fixture items' expiry."""
    reader.reference_instant = "2026-08-24T00:00:00Z"
    return reader


def test_an_expired_item_is_still_listed_and_is_not_deleted(client, past_deadline):
    """Nothing here deletes a row, and a passed deadline is not an exception."""
    listed = client.get("/api/attention").json()["items"]
    ids = {item["correlation_id"] for item in listed}

    assert ESCALATION["correlation_id"] in ids
    assert QUESTION["correlation_id"] in ids

    escalation = item_for(client, ESCALATION["correlation_id"])
    question = item_for(client, QUESTION["correlation_id"])
    # Past, and still carrying the factory's own deadline for the Desk to read
    # "expired" from — not blanked, not recomputed.
    assert escalation["expires_at"] == REPORTED_ESCALATION["expires_at"]
    assert question["expires_at"] == STORED_QUESTION["expires_at"]
    assert escalation["expires_at"] < client.get("/api/floor").json()["reference_instant"]


def test_a_late_answer_still_reaches_the_factory_and_its_ruling_comes_back(
    client, reader, past_deadline
):
    """A late Answer is the factory's to rule on, so the pane still carries it."""
    correlation_id = QUESTION["correlation_id"]
    reader.ruling = recorded("bridge", "EXPIRED.json")["outcome"]

    response = client.post(
        f"/api/attention/{correlation_id}/answer", json={"text": "late, but sent"}
    )

    assert response.status_code == 200
    # Verbatim, and one of the five the operator recorded from the real seam.
    assert response.json() == {"kind": "question", "ruling": "EXPIRED"}
    assert reader.settled == [(correlation_id, "late, but sent", IDENTITY)]
    assert item_for(client, correlation_id)["settlement"]["ruling"] == "EXPIRED"


def test_a_late_press_still_reaches_the_signal_and_reads_in_flight(
    client, reader, past_deadline
):
    """And a pressed Escalation's fate is the factory's read, not a minted word."""
    correlation_id = ESCALATION["correlation_id"]
    payload = ESCALATION["actions"][0]["payload"]

    response = client.post(f"/api/attention/{correlation_id}/answer", json={"payload": payload})

    assert response.status_code == 200
    assert response.json() == {"kind": "escalation", "signal": "accepted"}
    assert len(reader.pressed) == 1

    item = item_for(client, correlation_id)
    # The recorded fate carries `resolution: null`, so the press stays in flight:
    # a signal returns nothing, and the pane mints no ruling for one (FR-010).
    assert item["settlement"]["state"] == "in_flight"
    assert item["settlement"]["ruling"] is None
    assert item["settlement"]["resolution"] is None


# --- US3-S6 (degraded): a join that could not be made says so, in two modes ---


def test_the_two_failure_modes_differ_and_neither_mints_a_deadline(client, reader):
    """001's two modes, on the items that lost their joins (constitution III)."""
    reader.question_raises = TransportFailed(
        "read_question", "questions store: unable to open database file"
    )
    reader.fate_raises = QueryRefused("escalation_status", "query rejected by the workflow")

    question = item_for(client, QUESTION["correlation_id"])
    escalation = item_for(client, ESCALATION["correlation_id"])

    assert question["degraded"] is not None
    assert escalation["degraded"] is not None
    assert question["degraded"]["mode"] == "transport"
    assert escalation["degraded"]["mode"] == "refusal"
    assert question["degraded"]["mode"] != escalation["degraded"]["mode"]

    # What could not be learned is named, not swallowed.
    assert "read_question" in question["degraded"]["what"]
    assert "escalation_status" in escalation["degraded"]["what"]

    # No deadline is minted to fill either gap, and both items still render
    # everything the factory delivered.
    assert question["expires_at"] is None
    assert escalation["expires_at"] is None
    assert question["text"] == QUESTION["text"]
    assert escalation["text"] == ESCALATION["text"]
    assert escalation["actions"] == ESCALATION["actions"]


def test_a_degraded_join_leaves_the_item_answerable(client, reader):
    """A read the pane could not make is not a reason to withhold the verb."""
    reader.question_raises = QueryRefused("read_question", "query refused")

    item = item_for(client, QUESTION["correlation_id"])
    assert item["settlement"]["state"] == "waiting"

    response = client.post(
        f"/api/attention/{QUESTION['correlation_id']}/answer", json={"text": "still answerable"}
    )
    assert response.status_code == 200


# --- US3-S7 through the demo reader, on the recording it actually replays -----


def test_the_demo_reader_replays_the_recorded_ruling_named_by_the_environment(
    tmp_path, monkeypatch, auth_headers
):
    """`PANE_DEMO_RULING=EXPIRED` serves the `outcome` key of the recording.

    The whole path, not a stand-in for it: the demo `FixtureReader` seeded from
    the recorded deliveries, the answer route, and
    `fixtures/bridge/EXPIRED.json` — one of the five the operator captured from
    the real `handle_relay`.  The ruling comes back verbatim and is stored
    verbatim, and the item is not deleted by having been ruled on (FR-013).
    """
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PANE_DEMO", "1")
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(FIXTURES))
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "demo.db"))
    monkeypatch.setenv("PANE_DEMO_RULING", "EXPIRED")

    client = TestClient(create_app(Settings.from_env()), headers=auth_headers)
    correlation_id = QUESTION["correlation_id"]

    # The demo floor seeds its store from the recordings on the first read
    # through the seam, which is what a Desk opening the page does.
    assert item_for(client, correlation_id)["kind"] == "question"

    response = client.post(
        f"/api/attention/{correlation_id}/answer", json={"text": "answered after the deadline"}
    )

    assert response.status_code == 200
    assert response.json()["ruling"] == recorded("bridge", "EXPIRED.json")["outcome"]
    assert response.json()["ruling"] == "EXPIRED"

    item = item_for(client, correlation_id)
    assert item["settlement"]["ruling"] == "EXPIRED"
    # Ruled, not settled: every ruling but RESOLVED keeps the item where it was.
    assert item["settlement"]["state"] == "ruled"
    # And the questions-store join still carries the factory's own deadline.
    assert item["expires_at"] == STORED_QUESTION["expires_at"]


def test_a_demo_ruling_with_no_recording_degrades_in_words_and_invents_nothing(
    tmp_path, monkeypatch, auth_headers
):
    """SIGNAL_FAILED has no document, so naming it names a missing path.

    The loader rule 001 wrote, holding at the one place it matters most: a
    ruling nobody could record is a degraded read, never a value the demo floor
    made up to have something to show (constitution V, FR-018).
    """
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PANE_DEMO", "1")
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(FIXTURES))
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "demo.db"))
    monkeypatch.setenv("PANE_DEMO_RULING", "SIGNAL_FAILED")

    assert not (FIXTURES / "bridge" / "SIGNAL_FAILED.json").exists()

    client = TestClient(create_app(Settings.from_env()), headers=auth_headers)
    assert item_for(client, QUESTION["correlation_id"])["kind"] == "question"

    with pytest.raises(TransportFailed) as raised:
        client.post(
            f"/api/attention/{QUESTION['correlation_id']}/answer", json={"text": "anything"}
        )

    assert "SIGNAL_FAILED.json" in str(raised.value)
    assert "not recorded yet" in str(raised.value)
