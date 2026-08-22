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


def test_malformed_variants_refuse_and_store_nothing(empty_intake_client, empty_intake_settings):
    _clear_attention_store(empty_intake_settings.attention_db)
    base = _load_payload("question.json")

    variants = [
        ({k: v for k, v in base.items() if k != "correlation_id"}, "missing correlation_id"),
        ({k: v for k, v in base.items() if k != "text"}, "missing text"),
        (
            {
                "correlation_id": "not-hex",
                "text": "bad",
                "actions": [{"label": "x", "payload": "esc:nothex:KILL"}],
            },
            "non-hex id with actions",
        ),
        (
            {
                "correlation_id": "a1b2c3d4e5f6",
                "text": "bad",
                "actions": [{"label": "x", "payload": "not-esc-payload"}],
            },
            "bad action payload",
        ),
        ("not an object", "non-object body"),
    ]

    before = _count_attention_rows(empty_intake_settings.attention_db)
    for variant, _label in variants:
        resp = empty_intake_client.post("/intake/intake-test-credential", json=variant)
        assert resp.status_code == 422, f"variant {_label} should be refused"
        assert resp.json()["error"] == "malformed"
    after = _count_attention_rows(empty_intake_settings.attention_db)
    assert after == before, f"expected {before} rows, found {after}"


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

        event = _collect_attention_event(queue)
        assert event is not None
        assert event["type"] == "attention"
        data = event["data"]
        assert data["kind"] == "notice"
        assert data["correlation_id"] == payload["correlation_id"]
        assert data["text"] == payload["text"]

    assert _count_attention_rows(empty_intake_settings.attention_db) == 2


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
    """No factory seam is exercised during intake handling."""
    from pane import fixture_floor
    from pane import readers

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

    monkeypatch.setattr(readers, "LiveReader", lambda specs_root, attention_db: RecordingReader())
    monkeypatch.setattr(fixture_floor, "FixtureReader", lambda root, **kwargs: RecordingReader())

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
    client = TestClient(create_app(settings))

    payload = _load_payload("question.json")
    resp = client.post("/intake/intake-test-credential", json=payload)
    assert resp.status_code == 202
    assert calls == []


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
    resp = intake_client.get("/api/attention")
    assert resp.status_code == 200
    body = resp.json()
    kinds = {item["kind"] for item in body["items"]}
    assert kinds == {"question", "escalation", "notice"}
