"""Prove the SSE endpoint yields typed floor events and the poll loop queries epics."""

import asyncio
import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from pane.app import create_app
from pane.config import Settings
from pane.events import EVENT_TYPES, AttentionBroadcaster, floor_events
from pane.fixture_floor import FixtureReader

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"


@pytest.fixture
def demo_settings(tmp_path, monkeypatch) -> Settings:
    monkeypatch.chdir(tmp_path)
    for key in list(os.environ):
        if key.startswith("ERGANE_") or key.startswith("FACTORY_") or key.startswith("TEMPORAL_"):
            monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("PANE_DEMO", "1")
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(FIXTURES))
    return Settings.from_env()


def test_floor_events_yields_one_event():
    reader = FixtureReader(FIXTURES, transport_fail=frozenset())

    async def collect_one():
        events = []
        async for event in floor_events(reader, interval_s=0.01):
            events.append(event)
            if len(events) == 1:
                return events
        return events

    result = asyncio.run(collect_one())
    assert len(result) == 1
    assert result[0]["type"] == "floor"
    document = result[0]["data"]
    assert set(document.keys()) == {
        "reference_instant",
        "floor",
        "epics",
        "attention",
        "health",
        "spend_to_date",
        "degraded",
    }


def test_poll_loop_queries_each_running_epic(demo_settings):
    reader = FixtureReader(FIXTURES, transport_fail=frozenset())
    proxy = _RecordingReader(reader)

    async def collect_one():
        async for event in floor_events(proxy, interval_s=0.01):
            return event

    asyncio.run(collect_one())

    running = asyncio.run(reader.read_floor()).running
    assert len(running) > 0
    # Fixture mode may stage multiple scenes for one epic id; the poll loop calls
    # epic_status once per EpicRef, and every call uses workflow_id epic-<epic_id>.
    for ref in running:
        calls = [c for c in proxy.calls if c["method"] == "epic_status" and c["workflow_id"] == ref.workflow_id]
        assert len(calls) >= 1, f"expected at least one epic_status call for {ref.workflow_id}"
        for call in calls:
            assert call["workflow_id"] == f"epic-{ref.epic_id}"


def test_api_events_stream_one_event(demo_settings, tmp_path, monkeypatch, auth_headers):
    monkeypatch.setenv("PANE_POLL_INTERVAL_S", "0.01")
    settings = Settings.from_env()
    app = create_app(settings)

    async def drive_asgi():
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/api/events",
            "raw_path": b"/api/events",
            "query_string": b"",
            # Spec 003 US4 (T056): `GET /api/events` is behind the closed gate
            # like every other route, so the stream is opened with the token.
            "headers": [
                (b"host", b"testserver"),
                (b"authorization", auth_headers["Authorization"].encode("ascii")),
            ],
            "server": ("testserver", 80),
            "client": None,
            "scheme": "http",
            "root_path": "",
            "state": {},
            "app": app,
        }
        messages = []

        async def receive():
            # Disconnect immediately after the first event.
            return {"type": "http.disconnect"}

        async def send(message):
            messages.append(message)

        await app(scope, receive, send)
        return messages

    messages = asyncio.run(drive_asgi())

    body_messages = [m for m in messages if m["type"] == "http.response.body"]
    assert body_messages
    first_chunk = body_messages[0]["body"].decode("utf-8")
    data_line = next(line for line in first_chunk.splitlines() if line.startswith("data:"))
    envelope = json.loads(data_line.removeprefix("data:").strip())
    assert envelope["type"] == "floor"
    assert "data" in envelope
    document = envelope["data"]
    assert set(document.keys()) == {
        "reference_instant",
        "floor",
        "epics",
        "attention",
        "health",
        "spend_to_date",
        "degraded",
    }


def test_one_subscription_carries_both_types(tmp_path):
    """`floor_events` drains the broadcaster between polls (FR-005).

    One `GET /api/events` subscription carries the poll's `floor` snapshots and
    every `attention` item intake admits, interleaved.  Nothing is cached: an
    item published before a subscriber existed is not replayed to it — that
    client reads it from the attention list instead.
    """
    reader = FixtureReader(FIXTURES, transport_fail=frozenset(), attention_db=tmp_path / "a.db")
    broadcaster = AttentionBroadcaster()

    item = {"id": "800ee6b4c7df", "kind": "question", "text": "which?"}

    async def collect() -> list[dict]:
        events: list[dict] = []
        # Published before anyone subscribed: no subscriber, no delivery.
        broadcaster.publish({"id": "unheard", "kind": "question", "text": "nobody was listening"})

        stream = floor_events(reader, interval_s=0.05, broadcaster=broadcaster)
        events.append(await anext(stream))          # the immediate floor snapshot
        broadcaster.publish(item)                    # intake, mid-interval
        events.append(await anext(stream))          # drained before the next poll
        events.append(await anext(stream))          # the next poll
        await stream.aclose()
        return events

    events = asyncio.run(collect())

    assert [event["type"] for event in events] == ["floor", "attention", "floor"]
    assert events[1]["data"] == item
    assert set(events[2]["data"].keys()) == set(events[0]["data"].keys())


def test_event_types_vocabulary():
    """001's vocabulary plus the one type spec 003 declares (FR-005).

    `attention` is a declared extension, not a redefinition: a consumer that
    ignores unknown types is unaffected until it opts in, so every surface built
    against 001 keeps working unchanged.
    """
    assert EVENT_TYPES == ("floor", "attention")


class _RecordingReader:
    def __init__(self, reader: FixtureReader) -> None:
        self._reader = reader
        self.calls: list[dict] = []

    @property
    def reference_instant(self) -> str | None:
        return self._reader.reference_instant

    async def read_floor(self):
        self.calls.append({"method": "read_floor"})
        return await self._reader.read_floor()

    async def epic_status(self, workflow_id: str, scene: str | None = None):
        self.calls.append({"method": "epic_status", "workflow_id": workflow_id, "scene": scene})
        return await self._reader.epic_status(workflow_id, scene=scene)

    def workgraph(self, epic_id_or_ref: str):
        self.calls.append({"method": "workgraph", "ref": epic_id_or_ref})
        return self._reader.workgraph(epic_id_or_ref)

    async def open_escalations(self):
        self.calls.append({"method": "open_escalations"})
        return await self._reader.open_escalations()

    def stored_items(self):
        self.calls.append({"method": "stored_items"})
        return self._reader.stored_items()

    async def read_question(self, correlation_id: str):
        self.calls.append({"method": "read_question", "correlation_id": correlation_id})
        return await self._reader.read_question(correlation_id)

    async def read_escalation_fate(self, correlation_id: str):
        self.calls.append({"method": "read_escalation_fate", "correlation_id": correlation_id})
        return await self._reader.read_escalation_fate(correlation_id)

    def list_findings(self):
        self.calls.append({"method": "list_findings"})
        return self._reader.list_findings()

    def rollup(self):
        self.calls.append({"method": "rollup"})
        return self._reader.rollup()

    async def aclose(self):
        return await self._reader.aclose()
