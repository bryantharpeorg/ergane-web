"""Prove the stage document joins workgraph.json with epic_status honestly.

Every assertion is against `assemble_stage` or the assembled floor document, with
recorded fixtures and injected fault shapes at the reader seam — no live floor.
"""

import asyncio
import json
from pathlib import Path

import pytest

from fastapi.testclient import TestClient

from pane.app import create_app
from pane.config import Settings
from pane.floor_document import assemble_floor_document
from pane.readers import EpicRef, FloorRead, Reader, QueryRefused, TransportFailed
from pane.stage import assemble_stage

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"


def _load(path: Path) -> dict:
    return json.loads(path.read_text())


def _stage_doc() -> dict:
    return _load(FIXTURES / "workgraphs" / "002-expense-notes.json")


def _status_doc_001() -> dict:
    return _load(
        FIXTURES
        / "epic-status"
        / "002-expense-notes"
        / "002-expense-notes-001-us1=ENQUEUED-ENQUEUED_us2=PENDING.json"
    )


def test_complete_join():
    """Every declared node appears once, joined with live fields, edges tagged."""
    graph = _stage_doc()
    answer = _status_doc_001()

    stage = assemble_stage("002-expense-notes", graph, answer)

    assert stage["epic_id"] == "002-expense-notes"
    assert [n["id"] for n in stage["nodes"]] == ["us1", "us2"]

    us1 = next(n for n in stage["nodes"] if n["id"] == "us1")
    assert us1["story_key"] == "US1"
    assert us1["persona"] == "implementer"
    assert us1["state"] == "ENQUEUED"
    assert us1["attempt"] == 1
    assert us1["awaiting_operator"] is False
    assert us1["landing_state"] == "ENQUEUED"
    assert us1["waiting_on_operator"] is False
    assert us1["unknown"] == []

    us2 = next(n for n in stage["nodes"] if n["id"] == "us2")
    assert us2["story_key"] == "US2"
    assert us2["persona"] == "implementer"
    assert us2["state"] == "PENDING"
    assert us2["attempt"] == 0  # factory recorded 0, so it is preserved
    assert us2["awaiting_operator"] is False
    assert us2["landing_state"] is None
    assert us2["unknown"] == []

    assert stage["edges"] == [{"source": "us1", "target": "us2", "kind": "merge"}]
    assert stage["notes"] == []
    assert stage["degraded"] is False


def test_077_edges_both_kinds_with_transport_status():
    """A workgraph with both edge kinds tags them in declaration order."""
    graph = _load(FIXTURES / "workgraphs" / "077-a-scanner-the-operator-chooses-runs-in-the-loop.json")
    stage = assemble_stage("077-a-scanner-the-operator-chooses-runs-in-the-loop", graph, TransportFailed("epic_status", "unreachable"))

    assert [n["id"] for n in stage["nodes"]] == ["us1", "us2", "us3", "us4", "us5"]

    edge_kinds = [(e["source"], e["target"], e["kind"]) for e in stage["edges"]]
    assert edge_kinds == [
        ("us2", "us3", "pass"),
        ("us3", "us4", "pass"),
        ("us2", "us4", "merge"),
        ("us4", "us5", "pass"),
    ]

    assert stage["degraded"] is True
    assert stage["notes"] == [{
        "read": "epic_status",
        "mode": "transport",
        "detail": "epic_status: unreachable",
    }]



def test_node_absent_from_live_answer():
    """A node present in workgraph.json but absent from the answer stays static with unknown live fields."""
    graph = _stage_doc()
    answer = _status_doc_001()
    del answer["nodes"]["us2"]

    stage = assemble_stage("002-expense-notes", graph, answer)

    us2 = next(n for n in stage["nodes"] if n["id"] == "us2")
    assert us2["story_key"] == "US2"
    assert us2["persona"] == "implementer"
    assert us2["state"] is None
    assert us2["attempt"] is None
    assert us2["awaiting_operator"] is None
    assert us2["landing_state"] is None
    assert us2["waiting_on_operator"] is False
    assert set(us2["unknown"]) == {"state", "attempt", "awaiting_operator", "landing_state"}

    assert stage["edges"] == [{"source": "us1", "target": "us2", "kind": "merge"}]



def test_two_failure_modes_two_notes():
    """Transport failure and query refusal are two distinguishable notes."""
    graph = _stage_doc()

    refusal = assemble_stage("002-expense-notes", graph, QueryRefused("epic_status", "Query rejected, status: 2"))
    transport = assemble_stage("002-expense-notes", graph, TransportFailed("epic_status", "temporal connection refused"))

    for stage in (refusal, transport):
        assert [n["id"] for n in stage["nodes"]] == ["us1", "us2"]
        assert stage["edges"] == [{"source": "us1", "target": "us2", "kind": "merge"}]
        assert len(stage["notes"]) == 1
        assert stage["notes"][0]["read"] == "epic_status"
        assert stage["degraded"] is True
        for node in stage["nodes"]:
            assert node["state"] is None
            assert node["attempt"] is None
            assert node["awaiting_operator"] is None
            assert node["landing_state"] is None

    assert refusal["notes"][0]["mode"] == "refusal"
    assert transport["notes"][0]["mode"] == "transport"



def test_missing_keys_take_defaults():
    """Missing NodeStatus keys default to None, are named in unknown, and never read as zero."""
    graph = _stage_doc()
    answer = _status_doc_001()
    # Delete three expected keys from us1; leave state intact.
    for key in ("attempt", "awaiting_operator", "landing_state"):
        answer["nodes"]["us1"].pop(key, None)

    stage = assemble_stage("002-expense-notes", graph, answer)

    us1 = next(n for n in stage["nodes"] if n["id"] == "us1")
    assert us1["state"] == "ENQUEUED"
    assert us1["attempt"] is None
    assert us1["awaiting_operator"] is None
    assert us1["landing_state"] is None
    assert us1["waiting_on_operator"] is False
    assert set(us1["unknown"]) == {"attempt", "awaiting_operator", "landing_state"}



def test_live_only_id_is_noted_not_drawn():
    """An id in the answer but not in the file is named in notes; nodes stay exactly the file's."""
    graph = _stage_doc()
    answer = _load(FIXTURES / "epic-status" / "skew" / "status-names-us3.json")

    stage = assemble_stage("fx-landing-f0a0d6", graph, answer)

    assert [n["id"] for n in stage["nodes"]] == ["us1", "us2"]
    assert all(n["id"] != "us3" for n in stage["nodes"])
    assert len(stage["notes"]) == 1
    assert stage["notes"][0]["read"] == "epic_status"
    assert stage["notes"][0]["mode"] == "undeclared"
    assert "'us3'" in stage["notes"][0]["detail"]
    assert stage["degraded"] is False



async def _run_dead_workgraph_test():
    """Async helper so aclose() can be awaited."""

    class _StubReader:
        reference_instant: str | None = None

        async def read_floor(self) -> FloorRead:
            return FloorRead(
                status={"epics": []},
                running=[
                    EpicRef(epic_id="epic-a", workflow_id="epic-epic-a", scene=None, workgraph_ref="epic-a"),
                    EpicRef(epic_id="epic-b", workflow_id="epic-epic-b", scene=None, workgraph_ref="epic-b"),
                    EpicRef(epic_id="002-expense-notes", workflow_id="epic-002-expense-notes", scene=None, workgraph_ref="002-expense-notes"),
                ],
            )

        async def epic_status(self, workflow_id: str, scene: str | None = None) -> dict:
            if workflow_id == "epic-002-expense-notes":
                return _status_doc_001()
            return {"epic_state": "RUNNING", "nodes": {}}

        def workgraph(self, epic_id_or_ref: str) -> dict:
            if epic_id_or_ref == "epic-a":
                raise TransportFailed("workgraph", "fixtures/workgraphs/epic-a.json: not recorded yet")
            if epic_id_or_ref == "epic-b":
                raise json.JSONDecodeError("Expecting property name", "{not json", 1) from None
            return _stage_doc()

        async def open_escalations(self) -> list[dict]:
            return []

        def stored_questions(self) -> list[dict]:
            return []

        def list_findings(self) -> list[dict]:
            return []

        def rollup(self) -> dict:
            return {"by": "persona", "filters": {}, "groups": [], "totals": {}}

        async def aclose(self) -> None:
            return None

    reader = _StubReader()
    document = await assemble_floor_document(reader)
    await reader.aclose()

    epics = {e["epic_id"]: e for e in document["epics"]}

    a = epics["epic-a"]["stage"]
    assert a["nodes"] == []
    assert a["edges"] == []
    assert a["degraded"] is True
    assert len(a["notes"]) == 1
    assert a["notes"][0]["read"] == "workgraph"
    assert a["notes"][0]["mode"] == "transport"

    b = epics["epic-b"]["stage"]
    assert b["nodes"] == []
    assert b["edges"] == []
    assert b["degraded"] is True
    assert len(b["notes"]) == 1
    assert b["notes"][0]["read"] == "workgraph"
    assert b["notes"][0]["mode"] == "unparseable"

    c = epics["002-expense-notes"]["stage"]
    expected = assemble_stage("002-expense-notes", _stage_doc(), _status_doc_001())
    assert c == expected


def test_dead_workgraph_is_a_named_entry():
    """A missing or unparseable workgraph produces a named degraded stage without touching other epics."""
    asyncio.run(_run_dead_workgraph_test())



def test_derived_flag_wins():
    """awaiting_operator true marks the node regardless of raw state string."""
    answer = _load(FIXTURES / "epic-status" / "paged" / "paged.json")
    graph = {"epic_id": "fx-paged-5e2e8a", "feature": "fx-paged-5e2e8a", "nodes": [
        {"id": "us1", "story_key": "US1", "persona": "implementer", "spec_ref": "fx-paged-5e2e8a:US1", "requirement_keys": [], "depends_on": [], "depends_on_merged": [], "timeout_override_s": None}
    ]}

    stage = assemble_stage("fx-paged-5e2e8a", graph, answer)

    us1 = next(n for n in stage["nodes"] if n["id"] == "us1")
    assert us1["state"] == "VERIFYING"
    assert us1["awaiting_operator"] is True
    assert us1["waiting_on_operator"] is True



def test_floor_document_carries_stage_and_stays_pure():
    """The demo floor endpoint carries a stage per epic whose node ids match declared NodeCards."""
    settings = Settings(
        demo=True,
        fixtures_root=FIXTURES,
        web_dist=ROOT / "web" / "dist",
        specs_root=ROOT / "specs",
        transport_fail=frozenset(),
        poll_interval_s=15.0,
    )
    client = TestClient(create_app(settings))
    resp = client.get("/api/floor")
    assert resp.status_code == 200
    document = resp.json()

    for epic in document["epics"]:
        assert "stage" in epic
        stage = epic["stage"]
        declared_card_ids = [n["id"] for n in epic["nodes"] if n.get("declared") is True]
        stage_node_ids = [n["id"] for n in stage["nodes"]]
        assert stage_node_ids == declared_card_ids

        for edge in stage["edges"]:
            assert edge["kind"] in ("pass", "merge")

        for key in ("epic_id", "workflow_id", "scene", "epic_state", "nodes", "status_seam", "workgraph_seam"):
            assert key in epic

    # pane/stage.py never imports a reader, temporal, subprocess, pathlib, or open.
    source = (Path(__file__).resolve().parents[1] / "pane" / "stage.py").read_text()
    for banned in ("subprocess", "temporalio", "pathlib", "open(", "def workgraph"):
        assert banned not in source, f"stage.py must stay pure: found {banned!r}"
    assert "from pane.readers import" in source
    assert "TransportFailed" in source and "QueryRefused" in source
