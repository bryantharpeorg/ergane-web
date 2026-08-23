"""US1: the factory's POST becomes a stored Attention item.

Every test runs with `monkeypatch.chdir(tmp_path)` so no factory checkout,
Temporal server, or factory database is present.  Factory seams are substituted
with recorders so the tests prove only storage and SSE are touched.
"""

import asyncio
import json
import os
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from pane.app import create_app
from pane.attention_store import open_store
from pane.config import Settings
from pane.events import AttentionBroadcaster

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"
WEBHOOK = FIXTURES / "webhook"


@pytest.fixture
def intake_settings(tmp_path, monkeypatch) -> Settings:
    """Demo settings with a fresh attention db and an intake credential."""
    monkeypatch.chdir(tmp_path)
    for key in list(os.environ):
        if key.startswith("ERGANE_") or key.startswith("FACTORY_") or key.startswith("TEMPORAL_"):
            monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("PANE_DEMO", "1")
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(FIXTURES))
    monkeypatch.setenv("PANE_INTAKE_CREDENTIAL", "intake-test-credential")
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    return Settings.from_env()


@pytest.fixture
def empty_intake_settings(tmp_path, monkeypatch) -> Settings:
    """Demo settings with an empty attention db and an intake credential."""
    monkeypatch.chdir(tmp_path)
    for key in list(os.environ):
        if key.startswith("ERGANE_") or key.startswith("FACTORY_") or key.startswith("TEMPORAL_"):
            monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("PANE_DEMO", "1")
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(FIXTURES))
    monkeypatch.setenv("PANE_INTAKE_CREDENTIAL", "intake-test-credential")
    db_path = tmp_path / "attention-empty.db"
    monkeypatch.setenv("PANE_ATTENTION_DB", str(db_path))
    open_store(db_path).close()
    return Settings.from_env()


@pytest.fixture
def empty_intake_client(empty_intake_settings) -> TestClient:
    return TestClient(create_app(empty_intake_settings))


@pytest.fixture
def intake_client(intake_settings) -> TestClient:
    return TestClient(create_app(intake_settings))


def _load_payload(name: str) -> dict:
    return json.loads((WEBHOOK / name).read_text())


def _count_attention_rows(path: Path) -> int:
    conn = open_store(path)
    try:
        return conn.execute("SELECT COUNT(*) FROM attention").fetchone()[0]
    finally:
        conn.close()


def _clear_attention_store(path: Path) -> None:
    conn = open_store(path)
    try:
        conn.execute("DELETE FROM attention")
        conn.commit()
    finally:
        conn.close()


def _collect_attention_event(queue: asyncio.Queue, timeout: float = 1.0) -> dict | None:
    async def _wait():
        try:
            return await asyncio.wait_for(queue.get(), timeout=timeout)
        except asyncio.TimeoutError:
            return None

    return asyncio.run(_wait())


def test_post_question_classifies_stores_and_pushes_event(empty_intake_client, empty_intake_settings):
    _clear_attention_store(empty_intake_settings.attention_db)
    payload = _load_payload("question.json")
    app = empty_intake_client.app
    queue: asyncio.Queue = asyncio.run(app.state.broadcaster.subscribe())

    resp = empty_intake_client.post("/intake/intake-test-credential", json=payload)
    assert resp.status_code == 202
    assert resp.json()["stored"] == "question"
    assert resp.json()["correlation_id"] == payload["correlation_id"]

    assert _count_attention_rows(empty_intake_settings.attention_db) == 1

    event = _collect_attention_event(queue)
    assert event is not None
    assert event["type"] == "attention"
    data = event["data"]
    assert data["kind"] == "question"
    assert data["correlation_id"] == payload["correlation_id"]
    assert data["text"] == payload["text"]
    assert data["actions"] == []

    # Exactly one event, and it was already on the queue when the response returned:
    # storage and the push happen in the same handling (FR-005).
    assert queue.empty()


def test_post_escalation_preserves_actions_in_order(empty_intake_client, empty_intake_settings):
    _clear_attention_store(empty_intake_settings.attention_db)
    payload = _load_payload("escalation.json")

    resp = empty_intake_client.post("/intake/intake-test-credential", json=payload)
    assert resp.status_code == 202
    assert resp.json()["stored"] == "escalation"

    conn = open_store(empty_intake_settings.attention_db)
    try:
        row = conn.execute(
            "SELECT kind, actions_json FROM attention WHERE correlation_id = ?",
            (payload["correlation_id"],),
        ).fetchone()
    finally:
        conn.close()

    assert row["kind"] == "escalation"
    stored_actions = json.loads(row["actions_json"])
    assert stored_actions == payload["actions"]


def _malformed_variants() -> list[tuple[str, Any]]:
    """The refused variants, each derived from a recorded payload (spec US1-S3)."""
    question = _load_payload("question.json")
    escalation = _load_payload("escalation.json")

    no_correlation_id = {k: v for k, v in question.items() if k != "correlation_id"}
    no_text = {k: v for k, v in question.items() if k != "text"}

    # The Escalation as recorded, but with an id the pane could never press against.
    actions_with_non_hex_id = dict(escalation)
    actions_with_non_hex_id["correlation_id"] = "not-twelve-hex"

    # The Escalation as recorded, but with one action payload off the grammar —
    # buttons the pane could never press, so the delivery is undelivered.
    bad_action_payload = dict(escalation)
    bad_action_payload["actions"] = [dict(a) for a in escalation["actions"]]
    bad_action_payload["actions"][1]["payload"] = "kill-the-node"

    return [
        ("missing_correlation_id", no_correlation_id),
        ("missing_text", no_text),
        ("actions_with_non_hex_correlation_id", actions_with_non_hex_id),
        ("action_payload_off_grammar", bad_action_payload),
        ("non_object_body", "not an object"),
    ]


MALFORMED_VARIANTS = _malformed_variants()


@pytest.mark.parametrize(
    "body",
    [variant for _label, variant in MALFORMED_VARIANTS],
    ids=[label for label, _variant in MALFORMED_VARIANTS],
)
def test_malformed_variants_refuse_and_store_nothing(
    body, empty_intake_client, empty_intake_settings
):
    _clear_attention_store(empty_intake_settings.attention_db)
    before = _count_attention_rows(empty_intake_settings.attention_db)

    resp = empty_intake_client.post("/intake/intake-test-credential", json=body)

    # Non-2xx *is* the word "undelivered" to the factory.
    assert not (200 <= resp.status_code < 300)
    assert resp.status_code == 422
    assert resp.json()["error"] == "malformed"
    assert _count_attention_rows(empty_intake_settings.attention_db) == before


def test_malformed_variants_cover_every_refusal_the_spec_names():
    """The parametrized cases are the four the spec enumerates, plus a non-object body."""
    assert [label for label, _ in MALFORMED_VARIANTS] == [
        "missing_correlation_id",
        "missing_text",
        "actions_with_non_hex_correlation_id",
        "action_payload_off_grammar",
        "non_object_body",
    ]


def test_post_notices_stores_and_pushes_event(empty_intake_client, empty_intake_settings):
    _clear_attention_store(empty_intake_settings.attention_db)
    payloads = [
        _load_payload("notice-supervision.json"),
        _load_payload("notice-roadmap.json"),
    ]

    app = empty_intake_client.app
    queue: asyncio.Queue = asyncio.run(app.state.broadcaster.subscribe())

    for payload in payloads:
        resp = empty_intake_client.post("/intake/intake-test-credential", json=payload)
        assert resp.status_code == 202
        assert resp.json()["stored"] == "notice"

        # One `attention` event each, and only one.
        event = _collect_attention_event(queue)
        assert event is not None
        assert event["type"] == "attention"
        data = event["data"]
        assert data["kind"] == "notice"
        assert data["correlation_id"] == payload["correlation_id"]
        assert data["text"] == payload["text"]
        assert queue.empty()

    assert _count_attention_rows(empty_intake_settings.attention_db) == 2

    # Stored as notices carrying no actions at all.
    conn = open_store(empty_intake_settings.attention_db)
    try:
        rows = conn.execute("SELECT kind, actions_json FROM attention ORDER BY seq").fetchall()
    finally:
        conn.close()
    assert [row["kind"] for row in rows] == ["notice", "notice"]
    assert [row["actions_json"] for row in rows] == ["[]", "[]"]

    # In the list: no controls to render, no settlement state, and no clock.
    body = empty_intake_client.get("/api/attention").json()
    notices = [item for item in body["items"] if item["kind"] == "notice"]
    assert len(notices) == 2
    for item in notices:
        assert item["settlement"]["state"] == "none"
        assert item["expires_at"] is None
        assert item["actions"] == []
        assert item["id"].startswith("notice:")


def test_answerable_idempotent_notice_is_not(empty_intake_client, empty_intake_settings):
    _clear_attention_store(empty_intake_settings.attention_db)
    question = _load_payload("question.json")
    escalation = _load_payload("escalation.json")
    notice = _load_payload("notice-supervision.json")

    for _ in range(2):
        resp = empty_intake_client.post("/intake/intake-test-credential", json=question)
        assert resp.status_code == 202
    for _ in range(2):
        resp = empty_intake_client.post("/intake/intake-test-credential", json=escalation)
        assert resp.status_code == 202
    for _ in range(2):
        resp = empty_intake_client.post("/intake/intake-test-credential", json=notice)
        assert resp.status_code == 202

    conn = open_store(empty_intake_settings.attention_db)
    try:
        rows = conn.execute(
            "SELECT kind, COUNT(*) as c FROM attention GROUP BY kind"
        ).fetchall()
        counts = {row["kind"]: row["c"] for row in rows}
    finally:
        conn.close()

    assert counts.get("question") == 1
    assert counts.get("escalation") == 1
    assert counts.get("notice") == 2


def test_intake_touches_only_store_and_broadcaster(intake_settings, monkeypatch):
    """Accepting a payload of each kind touches no factory seam (spec US1-S6).

    The 10-second delivery window is spent on one insert and one fan-out: no
    Temporal call, no settlement seam, no factory-store read.
    """
    import pane.app

    calls: list[str] = []

    class RecordingReader:
        reference_instant = None

        async def read_floor(self):
            calls.append("read_floor")
            return {"running": []}

        async def epic_status(self, workflow_id, scene=None):
            calls.append("epic_status")
            return {}

        def workgraph(self, epic_id_or_ref):
            calls.append("workgraph")
            return {}

        async def open_escalations(self):
            calls.append("open_escalations")
            return []

        def stored_items(self):
            calls.append("stored_items")
            return []

        def list_findings(self):
            calls.append("list_findings")
            return []

        def rollup(self):
            calls.append("rollup")
            return {}

        async def aclose(self):
            return None

    # Patch the names `create_app` actually reads. `pane.app` binds `FixtureReader`
    # and `LiveReader` at import, so patching their defining modules would leave the
    # real readers in place and make `calls` a list nothing could ever append to.
    recording_reader = RecordingReader()
    monkeypatch.setattr(pane.app, "LiveReader", lambda specs_root, attention_db: recording_reader)
    monkeypatch.setattr(pane.app, "FixtureReader", lambda root, **kwargs: recording_reader)

    # A recorder in place of the Temporal client: opening one at all is a call.
    import factory.cli.nouns

    async def _refuse_to_open_a_client():
        calls.append("temporal_client")
        raise AssertionError("intake opened a Temporal client")

    monkeypatch.setattr(factory.cli.nouns, "_open_client", _refuse_to_open_a_client)

    settings = Settings(
        demo=True,
        fixtures_root=FIXTURES,
        transport_fail=frozenset(),
        web_dist=Path("/nonexistent"),
        poll_interval_s=15.0,
        specs_root=Path("/nonexistent"),
        intake_credential="intake-test-credential",
        answer_identity="unknown",
        attention_db=intake_settings.attention_db,
        demo_ruling="RESOLVED",
    )
    app = create_app(settings)

    # The substitution really took effect — otherwise `calls` proves nothing.
    assert app.state.broadcaster is not None
    assert app.state.reader is recording_reader

    client = TestClient(app)

    for name in ("question.json", "escalation.json", "notice-supervision.json"):
        resp = client.post("/intake/intake-test-credential", json=_load_payload(name))
        assert resp.status_code == 202

    assert calls == []

    # And the recorder is wired: a read through it does register.
    asyncio.run(app.state.reader.open_escalations())
    assert calls == ["open_escalations"]


def test_item_appears_in_attention_list_without_stream(intake_client, intake_settings):
    payload = _load_payload("escalation.json")
    resp = intake_client.post("/intake/intake-test-credential", json=payload)
    assert resp.status_code == 202

    resp = intake_client.get("/api/attention")
    assert resp.status_code == 200
    body = resp.json()
    ids = {item["id"] for item in body["items"]}
    assert payload["correlation_id"] in ids

    resp = intake_client.get("/api/floor")
    assert resp.status_code == 200
    floor = resp.json()
    floor_ids = {item["id"] for item in floor["attention"]["items"]}
    assert payload["correlation_id"] in floor_ids


def test_demo_seeds_store_through_intake_path(intake_client, intake_settings):
    """PANE_DEMO=1 with no factory lists the three recorded payloads (spec US1-S7)."""
    resp = intake_client.get("/api/attention")
    assert resp.status_code == 200
    items = resp.json()["items"]

    kinds = sorted(item["kind"] for item in items)
    assert kinds == ["escalation", "notice", "question"]
    assert len(items) == 3

    # The seed rode the intake path, so each item carries the recorded bytes and
    # the same shape intake produces.
    by_kind = {item["kind"]: item for item in items}
    for name, kind in (
        ("question.json", "question"),
        ("escalation.json", "escalation"),
        ("notice-supervision.json", "notice"),
    ):
        recorded = _load_payload(name)
        item = by_kind[kind]
        assert item["correlation_id"] == recorded["correlation_id"]
        assert item["text"] == recorded["text"]
        assert item["actions"] == recorded["actions"]

    assert by_kind["question"]["expires_at"] is None
    assert by_kind["notice"]["settlement"]["state"] == "none"
    assert by_kind["escalation"]["settlement"]["state"] == "waiting"


def test_redelivery_on_a_shared_connection_is_not_reported_as_inserted(tmp_path):
    """`upsert_delivery` reports the insert it performed, not the connection's history.

    Regression: `conn.total_changes` counts every change since the connection was
    opened, so on a connection that has already stored something — the demo seed
    reuses one, and so will US2's store writes — a re-delivery the partial unique
    index ignored was reported as a fresh insert. Intake publishes on that flag, so
    the bug is a duplicate `attention` event for a re-delivered item (FR-004).
    """
    from pane.attention_store import upsert_delivery

    conn = open_store(tmp_path / "shared.db")
    try:
        first = upsert_delivery(
            conn, kind="question", correlation_id="800ee6b4c7df", text="t", actions=[]
        )
        second = upsert_delivery(
            conn, kind="question", correlation_id="800ee6b4c7df", text="t", actions=[]
        )

        assert first.inserted is True
        assert second.inserted is False
        assert conn.execute("SELECT COUNT(*) FROM attention").fetchone()[0] == 1

        # A notice on the same connection still inserts every time (FR-004 exemption).
        third = upsert_delivery(
            conn, kind="notice", correlation_id="supervision", text="a", actions=[]
        )
        fourth = upsert_delivery(
            conn, kind="notice", correlation_id="supervision", text="b", actions=[]
        )
        assert third.inserted is True
        assert fourth.inserted is True
        assert conn.execute(
            "SELECT COUNT(*) FROM attention WHERE kind = 'notice'"
        ).fetchone()[0] == 2
    finally:
        conn.close()


def test_redelivery_publishes_no_second_event(empty_intake_client, empty_intake_settings):
    """A re-delivered answerable item answers 2xx and pushes nothing new (spec US1-S5)."""
    _clear_attention_store(empty_intake_settings.attention_db)
    payload = _load_payload("question.json")
    queue: asyncio.Queue = asyncio.run(
        empty_intake_client.app.state.broadcaster.subscribe()
    )

    first = empty_intake_client.post("/intake/intake-test-credential", json=payload)
    second = empty_intake_client.post("/intake/intake-test-credential", json=payload)

    assert first.status_code == 202
    assert second.status_code == 202
    assert second.json() == first.json()

    assert _collect_attention_event(queue) is not None
    assert _collect_attention_event(queue, timeout=0.1) is None


def test_missing_recording_degrades_in_words_rather_than_shortening_the_list(tmp_path):
    """A recording the seed cannot read is a degraded read, never a quieter floor."""
    import asyncio as _asyncio

    from pane.fixture_floor import FixtureReader
    from pane.floor_document import assemble_floor_document
    from pane.readers import TransportFailed

    empty_root = tmp_path / "fixtures"
    (empty_root / "webhook").mkdir(parents=True)

    reader = FixtureReader(empty_root, attention_db=tmp_path / "attention.db")

    with pytest.raises(TransportFailed):
        reader.stored_items()

    document = _asyncio.run(assemble_floor_document(reader))
    attention_degraded = [d for d in document["degraded"] if d["section"] == "attention"]
    assert attention_degraded, "a missing recording must be said out loud"
    assert attention_degraded[0]["mode"] == "transport"
    assert "not recorded yet" in attention_degraded[0]["detail"]
    assert document["attention"]["items"] == []


@pytest.mark.parametrize(
    "failing_read,mode",
    [("transport", "transport"), ("refusal", "refusal")],
)
def test_attention_list_degrades_in_words_when_a_read_fails(
    intake_settings, monkeypatch, failing_read, mode
):
    """A failed escalation read is said out loud, never a quietly shorter list.

    `GET /api/attention` joins each stored Escalation to its open-escalation entry.
    If that read fails the items must still render — with the failure named in
    `degraded`, in 001's two modes (constitution III).
    """
    import pane.app
    from pane.fixture_floor import FixtureReader
    from pane.readers import QueryRefused, TransportFailed

    real = FixtureReader(
        intake_settings.fixtures_root, attention_db=intake_settings.attention_db
    )

    class FailingEscalations:
        reference_instant = real.reference_instant

        def __getattr__(self, name):
            return getattr(real, name)

        async def open_escalations(self):
            if failing_read == "transport":
                raise TransportFailed("open_escalations", "temporal is not reachable")
            raise QueryRefused("open_escalations", "the workflow refused the query")

        async def aclose(self):
            return None

    monkeypatch.setattr(pane.app, "FixtureReader", lambda root, **kwargs: FailingEscalations())
    client = TestClient(create_app(intake_settings))

    resp = client.get("/api/attention")
    assert resp.status_code == 200
    body = resp.json()

    # The stored items still render; nothing is hidden by a failed join.
    assert len(body["items"]) == 3

    entries = [d for d in body["degraded"] if d["section"] == "attention"]
    assert len(entries) == 1
    assert entries[0]["mode"] == mode
    assert entries[0]["read"] == "open_escalations"
    assert entries[0]["detail"]

    # The Escalation renders without a deadline rather than with an invented one.
    escalation = next(item for item in body["items"] if item["kind"] == "escalation")
    assert escalation["expires_at"] is None


def test_unparseable_body_is_refused_cleanly(empty_intake_client, empty_intake_settings):
    """A body that is not JSON at all is refused, not raised (FR-003)."""
    _clear_attention_store(empty_intake_settings.attention_db)
    before = _count_attention_rows(empty_intake_settings.attention_db)

    resp = empty_intake_client.post(
        "/intake/intake-test-credential",
        content=b"{not json at all",
        headers={"content-type": "application/json"},
    )

    assert resp.status_code == 422
    assert resp.json()["error"] == "malformed"
    assert _count_attention_rows(empty_intake_settings.attention_db) == before


def test_empty_body_is_refused_cleanly(empty_intake_client, empty_intake_settings):
    """An empty body is refused the same way (FR-003)."""
    _clear_attention_store(empty_intake_settings.attention_db)
    before = _count_attention_rows(empty_intake_settings.attention_db)

    resp = empty_intake_client.post(
        "/intake/intake-test-credential",
        content=b"",
        headers={"content-type": "application/json"},
    )

    assert resp.status_code == 422
    assert resp.json()["error"] == "malformed"
    assert _count_attention_rows(empty_intake_settings.attention_db) == before


def test_one_subscription_carries_both_event_types(intake_settings):
    """`floor_events()` drains the broadcaster between polls (FR-005, T003).

    One `GET /api/events` subscription carries `floor` and `attention` alike, so a
    client that connected before the delivery sees the item without re-polling.
    """
    from pane.events import floor_events
    from pane.fixture_floor import FixtureReader

    reader = FixtureReader(
        intake_settings.fixtures_root, attention_db=intake_settings.attention_db
    )
    broadcaster = AttentionBroadcaster()

    async def _drive():
        # A long interval, so anything that arrives arrives by the drain and not
        # by the next poll coming round.
        stream = floor_events(reader, interval_s=30.0, broadcaster=broadcaster)
        first = await asyncio.wait_for(stream.__anext__(), timeout=5.0)

        # Published after the subscription exists, exactly as intake publishes.
        broadcaster.publish({"id": "d10263341dac", "kind": "escalation", "text": "x"})
        second = await asyncio.wait_for(stream.__anext__(), timeout=5.0)

        await stream.aclose()
        return first, second

    first, second = asyncio.run(_drive())

    assert first["type"] == "floor"
    assert second["type"] == "attention"
    assert second["data"]["id"] == "d10263341dac"


def test_publish_reaches_every_subscriber_and_no_one_else(intake_settings):
    """The broadcaster fans out to live subscribers and caches nothing (001 R-007)."""
    broadcaster = AttentionBroadcaster()

    async def _drive():
        first = await broadcaster.subscribe()
        second = await broadcaster.subscribe()

        broadcaster.publish({"id": "a"})

        # A subscriber that arrives after the publish gets no history.
        late = await broadcaster.subscribe()

        await broadcaster.unsubscribe(second)
        broadcaster.publish({"id": "b"})

        return first, second, late

    first, second, late = asyncio.run(_drive())

    assert [first.get_nowait()["data"]["id"] for _ in range(2)] == ["a", "b"]
    # Unsubscribed before the second publish: it saw only the first.
    assert second.get_nowait()["data"]["id"] == "a"
    assert second.empty()
    # Subscribed after the first publish: no replay, just what came next.
    assert late.get_nowait()["data"]["id"] == "b"
    assert late.empty()
