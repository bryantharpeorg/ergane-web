"""Prove transport failure and query refusal are two distinct degraded facts."""

import asyncio
import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from pane.app import create_app
from pane.config import Settings
from pane.fixture_floor import FixtureReader
from pane.floor_document import assemble_floor_document
from pane.readers import (
    EpicRef,
    FloorRead,
    QueryRefused,
    Reader,
    TransportFailed,
)

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


def test_transport_rollup_entry(demo_settings):
    """A reader whose rollup raises TransportFailed produces a transport entry."""
    reader = _StubReaderWithRollupFailure(FIXTURES)
    document = asyncio.run(assemble_floor_document(reader))

    spend_degraded = [d for d in document["degraded"] if d["section"] == "spend_to_date"]
    assert len(spend_degraded) == 1
    entry = spend_degraded[0]
    assert entry["mode"] == "transport"
    assert entry["read"] == "rollup"
    assert "ledger.db" in entry["detail"]

    # Other sections remain intact.
    assert document["floor"]["data"] is not None
    assert document["health"]["data"] is not None
    assert document["attention"]["items"]


def test_fixture_refusal_and_missing_workgraph_coexist(demo_settings):
    """The refusal scene yields both a refusal (epic_status) and a transport (workgraph)."""
    reader = FixtureReader(FIXTURES, transport_fail=frozenset())
    document = asyncio.run(assemble_floor_document(reader))

    degraded = document["degraded"]
    refusal_entries = [d for d in degraded if d["mode"] == "refusal"]
    transport_entries = [d for d in degraded if d["mode"] == "transport"]

    # The recorded refusal fixture is a QueryRefused.
    assert len(refusal_entries) == 1
    refusal = refusal_entries[0]
    assert refusal["section"] == "epics"
    assert refusal["read"] == "epic_status"
    assert refusal["epic_id"] == "fx-landing-f0a0d6"
    assert refusal["detail"] == "Query rejected, status: 2"

    # The absent workgraph for the refusal scene is a transport failure.
    # Because `fx-landing-f0a0d6` has two scenes without graphs (landing and refusal),
    # there are two workgraph transport entries for that epic id; the test names both.
    workgraph_transport = [
        d for d in degraded
        if d["mode"] == "transport" and d["read"] == "workgraph" and d["epic_id"] == "fx-landing-f0a0d6"
    ]
    assert len(workgraph_transport) == 2

    # The two modes are different facts.
    assert refusal["mode"] != workgraph_transport[0]["mode"]
    assert refusal["section"] == workgraph_transport[0]["section"]

    # Spend transport failure can coexist with the refusal-scene degradation.
    spend_fail_reader = _StubReaderWithRollupFailure(FIXTURES)
    spend_fail_document = asyncio.run(assemble_floor_document(spend_fail_reader))
    assert any(d["mode"] == "transport" and d["section"] == "spend_to_date" for d in spend_fail_document["degraded"])


def test_bug_exception_propagates():
    """A non-degraded exception from a reader is a bug and must propagate."""
    reader = _BuggyReader(FIXTURES)
    with pytest.raises(RuntimeError, match="bug in reader"):
        asyncio.run(assemble_floor_document(reader))


class _StubReaderWithRollupFailure:
    reference_instant: str | None = None

    def __init__(self, root: Path) -> None:
        self.root = root

    async def read_floor(self) -> FloorRead:
        status = json.loads((self.root / "floor" / "floor-live.json").read_text())
        running = [
            EpicRef(
                epic_id="002-expense-notes",
                workflow_id="epic-002-expense-notes",
                scene=None,
                workgraph_ref="002-expense-notes",
            )
        ]
        return FloorRead(status=status, running=running)

    async def epic_status(self, workflow_id: str, scene: str | None = None) -> dict:
        return json.loads((self.root / "epic-status" / "002-expense-notes" / "002-expense-notes-013-us1=MERGED-MERGED_us2=MERGED-MERGED.json").read_text())

    def workgraph(self, epic_id_or_ref: str) -> dict:
        return json.loads((self.root / "workgraphs" / f"{epic_id_or_ref}.json").read_text())

    async def open_escalations(self) -> list[dict]:
        return json.loads((self.root / "escalations" / "open_escalations.json").read_text())

    def stored_items(self) -> list[dict]:
        doc = json.loads((self.root / "webhook" / "question.json").read_text())
        return [
            {
                "seq": 1,
                "correlation_id": doc["correlation_id"],
                "kind": "question",
                "text": doc["text"],
                "actions_json": "[]",
                "actions": [],
                "received_at": doc.get("received_at", "2026-08-22T17:41:12Z"),
                "last_ruling": None,
                "last_ruling_at": None,
                "pressed_choice": None,
                "signal_state": None,
                "signalled_at": None,
            }
        ]

    def list_findings(self) -> list[dict]:
        return json.loads((self.root / "doctor" / "findings.json").read_text())

    def rollup(self) -> dict:
        raise TransportFailed("rollup", "ledger.db: unable to open database file")

    async def aclose(self) -> None:
        return None


class _BuggyReader:
    reference_instant: str | None = None

    def __init__(self, root: Path) -> None:
        self.root = root

    async def read_floor(self) -> FloorRead:
        raise RuntimeError("bug in reader")

    async def epic_status(self, workflow_id: str, scene: str | None = None) -> dict:
        return {}

    def workgraph(self, epic_id_or_ref: str) -> dict:
        return {}

    async def open_escalations(self) -> list[dict]:
        return []

    def stored_items(self) -> list[dict]:
        return []

    def list_findings(self) -> list[dict]:
        return []

    def rollup(self) -> dict:
        return {}

    async def aclose(self) -> None:
        return None
