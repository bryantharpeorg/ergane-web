"""The route `ERGANE_WEBHOOK_URL` points at (spec 003 US1).

Every payload here is a recording under `fixtures/webhook/` — the factory's own
POST body as the recorder received it — and the malformed variants are derived
from those recordings rather than invented (constitution V).  Every factory seam
is substituted at the `Reader` boundary 001 defined, and a recorder stands in for
the Temporal client, so the scenario that says intake touches neither can be
proven from the diff.
"""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from pane.app import create_app
from pane.attention_store import open_store
from pane.config import Settings
from pane.readers import FloorRead, StoredItem, TransportFailed

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"
WEBHOOK = FIXTURES / "webhook"

CREDENTIAL = "intake-credential-for-tests"


def recorded(name: str) -> dict:
    """One recorded webhook delivery, exactly as the factory sent it."""
    return json.loads((WEBHOOK / f"{name}.json").read_text())


class RecordingReader:
    """A `Reader` that records every call and returns fixture-shaped values.

    Intake must call none of these.  Every operation appends to `calls`, so the
    scenario asserting zero seam calls reads its evidence straight off this list.
    """

    reference_instant: str | None = None

    def __init__(self, attention_db: Path) -> None:
        self.attention_db = attention_db
        self.calls: list[str] = []
        self.client = RecordingTemporalClient()

    async def read_floor(self) -> FloorRead:
        self.calls.append("read_floor")
        return FloorRead(status={"epics": []}, running=[])

    async def epic_status(self, workflow_id: str, scene: str | None = None) -> dict:
        self.calls.append("epic_status")
        return {}

    def workgraph(self, epic_id_or_ref: str) -> dict:
        self.calls.append("workgraph")
        raise TransportFailed("workgraph", "no workgraph in this test")

    async def open_escalations(self) -> list[dict]:
        self.calls.append("open_escalations")
        return json.loads((FIXTURES / "escalations" / "open_escalations.json").read_text())

    def stored_items(self) -> list[StoredItem]:
        # The one seam through which the pane's delivery store reaches the
        # assembly; intake writes it directly and calls this never.
        from pane.attention_store import list_items

        self.calls.append("stored_items")
        conn = open_store(self.attention_db)
        try:
            return list_items(conn)
        finally:
            conn.close()

    def list_findings(self) -> list[dict]:
        self.calls.append("list_findings")
        return []

    def rollup(self) -> dict:
        self.calls.append("rollup")
        return {"by": "persona", "filters": {}, "groups": [], "totals": {}}

    async def aclose(self) -> None:
        return None


class RecordingTemporalClient:
    """Stands where 001's Temporal client stands; intake must never reach it.

    Installed over `factory.cli.nouns._open_client`, the one factory function
    that hands out a client, so *opening* one is recorded even before a call is
    made on it.
    """

    def __init__(self) -> None:
        self.opened: list[str] = []
        self.calls: list[str] = []

    def get_workflow_handle(self, workflow_id: str):
        self.calls.append(f"get_workflow_handle:{workflow_id}")
        raise AssertionError("intake reached the Temporal client")


@pytest.fixture
def intake_app(tmp_path, monkeypatch):
    """The app with intake configured, a store under tmp_path, and no factory."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PANE_INTAKE_CREDENTIAL", CREDENTIAL)
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(FIXTURES))
    monkeypatch.delenv("PANE_DEMO", raising=False)

    settings = Settings.from_env()
    reader = RecordingReader(tmp_path / "attention.db")
    monkeypatch.setattr("pane.app._make_reader", lambda _settings: reader)

    async def fake_open_client():
        reader.client.opened.append("_open_client")
        return reader.client

    monkeypatch.setattr("factory.cli.nouns._open_client", fake_open_client)

    app = create_app(settings)
    app.state.recording_reader = reader
    return app


@pytest.fixture
def client(intake_app):
    return TestClient(intake_app)


@pytest.fixture
def store(intake_app, tmp_path):
    """A second connection to the same store, so a test reads what intake wrote."""
    conn = open_store(tmp_path / "attention.db")
    yield conn
    conn.close()


def count(store) -> int:
    return store.execute("SELECT COUNT(*) FROM attention").fetchone()[0]


def rows(store, correlation_id: str) -> list:
    return store.execute(
        "SELECT * FROM attention WHERE correlation_id = ? ORDER BY seq", (correlation_id,)
    ).fetchall()


def subscribe(app):
    """Subscribe to the broadcaster the way an open `GET /api/events` does."""
    from pane.events import AttentionBroadcaster

    broadcaster = app.state.attention_broadcaster
    assert isinstance(broadcaster, AttentionBroadcaster)
    return broadcaster.subscribe()


def drain(queue) -> list[dict]:
    events = []
    while not queue.empty():
        events.append(queue.get_nowait())
    return events


# --- US1-S1: a Question is stored and pushed in the same handling -------------


def test_recorded_question_is_stored_and_pushed(intake_app, client, store):
    payload = recorded("question")

    queue = subscribe(intake_app)
    response = client.post(f"/intake/{CREDENTIAL}", json=payload)
    events = drain(queue)

    assert 200 <= response.status_code < 300
    assert response.json() == {"stored": "question", "correlation_id": payload["correlation_id"]}

    stored_rows = rows(store, payload["correlation_id"])
    assert len(stored_rows) == 1
    assert stored_rows[0]["kind"] == "question"
    assert stored_rows[0]["text"] == payload["text"]
    assert stored_rows[0]["actions_json"] == "[]"

    # By the time the response returned, the event was already on the queue.
    assert len(events) == 1
    assert events[0]["type"] == "attention"
    item = events[0]["data"]
    assert item["kind"] == "question"
    assert item["correlation_id"] == payload["correlation_id"]
    assert item["text"] == payload["text"]
    # Intake stores no expiry: the countdown anchors on a factory clock, joined
    # at list time and never at intake (plan D-P9).
    assert item["expires_at"] is None


# --- US1-S2: an Escalation carries every delivered choice, byte-for-byte ------


def test_recorded_escalation_stores_every_delivered_choice(client, store):
    payload = recorded("escalation")

    response = client.post(f"/intake/{CREDENTIAL}", json=payload)
    assert 200 <= response.status_code < 300
    assert response.json()["stored"] == "escalation"

    stored_rows = rows(store, payload["correlation_id"])
    assert len(stored_rows) == 1
    assert stored_rows[0]["kind"] == "escalation"

    delivered = json.loads(stored_rows[0]["actions_json"])
    assert delivered == payload["actions"]
    assert [a["label"] for a in delivered] == [a["label"] for a in payload["actions"]]
    assert [a["payload"] for a in delivered] == [a["payload"] for a in payload["actions"]]


# --- US1-S3: a payload the pane cannot carry is refused, and stores nothing ---


def _without(payload: dict, key: str) -> dict:
    variant = dict(payload)
    variant.pop(key)
    return variant


def _non_hex_id_with_actions() -> dict:
    variant = dict(recorded("escalation"))
    variant["correlation_id"] = "not-twelve-hex"
    return variant


def _broken_action_payload() -> dict:
    variant = json.loads(json.dumps(recorded("escalation")))
    variant["actions"][1]["payload"] = "kill-the-node"
    return variant


MALFORMED = [
    pytest.param(_without(recorded("question"), "correlation_id"), id="question-without-correlation-id"),
    pytest.param(_without(recorded("escalation"), "correlation_id"), id="escalation-without-correlation-id"),
    pytest.param(_without(recorded("question"), "text"), id="question-without-text"),
    pytest.param(_without(recorded("notice-supervision"), "text"), id="notice-without-text"),
    pytest.param(_non_hex_id_with_actions(), id="actions-beside-a-non-12-hex-id"),
    pytest.param(_broken_action_payload(), id="action-payload-that-cannot-be-pressed"),
    pytest.param(["not", "an", "object"], id="non-object-body"),
]


@pytest.mark.parametrize("payload", MALFORMED)
def test_malformed_delivery_is_refused_and_stores_nothing(client, store, payload):
    before = count(store)

    response = client.post(f"/intake/{CREDENTIAL}", json=payload)

    # To the factory, non-2xx *is* the word "undelivered".  An Escalation whose
    # buttons the pane could never press has not been delivered.
    assert not (200 <= response.status_code < 300), response.status_code
    assert count(store) == before


# --- US1-S4: the notices that ride the same adapter ---------------------------


@pytest.mark.parametrize(
    "name,correlation_id",
    [("notice-supervision", "supervision"), ("notice-roadmap", "roadmap-fx-945757")],
)
def test_recorded_notice_is_stored_rendered_and_never_answerable(
    intake_app, client, store, name, correlation_id
):
    payload = recorded(name)
    assert payload["correlation_id"] == correlation_id

    queue = subscribe(intake_app)
    response = client.post(f"/intake/{CREDENTIAL}", json=payload)
    events = drain(queue)

    assert 200 <= response.status_code < 300
    assert response.json()["stored"] == "notice"

    stored_rows = rows(store, correlation_id)
    assert len(stored_rows) == 1
    assert stored_rows[0]["kind"] == "notice"
    assert stored_rows[0]["actions_json"] == "[]"
    assert stored_rows[0]["last_ruling"] is None
    assert stored_rows[0]["signal_state"] is None

    assert len(events) == 1
    item = events[0]["data"]
    assert item["kind"] == "notice"
    assert item["text"] == payload["text"]
    assert item["actions"] == []
    assert item["expires_at"] is None
    assert item["settlement"]["state"] == "none"

    listed = client.get("/api/attention").json()["items"]
    notice = next(i for i in listed if i["correlation_id"] == correlation_id)
    assert notice["settlement"]["state"] == "none"
    assert notice["expires_at"] is None


# --- US1-S5: idempotent for answerable kinds, never for a Notice --------------


def test_redelivery_is_idempotent_for_answerable_kinds_and_never_for_notices(client, store):
    question = recorded("question")
    escalation = recorded("escalation")
    notice = recorded("notice-supervision")

    first = client.post(f"/intake/{CREDENTIAL}", json=question)
    second = client.post(f"/intake/{CREDENTIAL}", json=question)
    assert 200 <= first.status_code < 300
    assert 200 <= second.status_code < 300
    assert second.json() == first.json()
    assert len(rows(store, question["correlation_id"])) == 1

    third = client.post(f"/intake/{CREDENTIAL}", json=escalation)
    fourth = client.post(f"/intake/{CREDENTIAL}", json=escalation)
    assert 200 <= third.status_code < 300
    assert 200 <= fourth.status_code < 300
    assert fourth.json() == third.json()
    assert len(rows(store, escalation["correlation_id"])) == 1

    # The factory reuses "supervision" and "roadmap-<root>" across distinct
    # events; a deduplicated-away alert is a silent one.
    client.post(f"/intake/{CREDENTIAL}", json=notice)
    client.post(f"/intake/{CREDENTIAL}", json=notice)
    assert len(rows(store, notice["correlation_id"])) == 2


# --- US1-S6: the ten-second window is spent on storage alone ------------------


def test_intake_touches_only_the_store_and_the_broadcaster(intake_app, client, store):
    reader: RecordingReader = intake_app.state.recording_reader
    reader.calls.clear()
    reader.client.calls.clear()
    reader.client.opened.clear()

    for name in ("question", "escalation", "notice-supervision"):
        response = client.post(f"/intake/{CREDENTIAL}", json=recorded(name))
        assert 200 <= response.status_code < 300

    assert reader.calls == [], f"intake called factory seams: {reader.calls}"
    assert reader.client.opened == [], "intake opened a Temporal client"
    assert reader.client.calls == [], f"intake reached Temporal: {reader.client.calls}"
    assert count(store) == 3


# --- US1-S7: SSE is the fast path, never the only path ------------------------


def test_an_item_stored_with_no_stream_connected_is_in_the_list(client):
    payload = recorded("escalation")

    response = client.post(f"/intake/{CREDENTIAL}", json=payload)
    assert 200 <= response.status_code < 300

    listed = client.get("/api/attention").json()["items"]
    item = next(i for i in listed if i["correlation_id"] == payload["correlation_id"])
    assert item["kind"] == "escalation"
    assert item["text"] == payload["text"]
    assert item["actions"] == payload["actions"]

    document = client.get("/api/floor").json()
    in_floor = next(
        i for i in document["attention"]["items"] if i["correlation_id"] == payload["correlation_id"]
    )
    assert in_floor["text"] == payload["text"]
    assert in_floor["actions"] == payload["actions"]


def test_demo_floor_lists_the_recorded_deliveries_through_the_intake_path(tmp_path, monkeypatch):
    """The demo seed rides `upsert_delivery`, so it produces the shapes intake does."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PANE_DEMO", "1")
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(FIXTURES))
    monkeypatch.delenv("PANE_ATTENTION_DB", raising=False)
    monkeypatch.delenv("PANE_INTAKE_CREDENTIAL", raising=False)

    client = TestClient(create_app(Settings.from_env()))
    body = client.get("/api/attention").json()

    kinds = [item["kind"] for item in body["items"]]
    assert sorted(kinds) == ["escalation", "notice", "question"]

    for name in ("question", "escalation", "notice-supervision"):
        payload = recorded(name)
        item = next(i for i in body["items"] if i["correlation_id"] == payload["correlation_id"])
        assert item["text"] == payload["text"]
        assert item["actions"] == payload["actions"]
