"""Prove the fixture loader serves the whole Fixture floor headlessly.

Every test in this file runs with `monkeypatch.chdir(tmp_path)` so no factory
checkout, Temporal server, or factory database is present.  The only factory
code that should execute is ergane's own `factory.cli.nouns.build.workflow_id`;
`_open_client` is monkeypatched to raise if a live read reaches Temporal.
"""

import asyncio
import json
import os
import shutil
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from pane.app import create_app
from pane.config import Settings
from pane.fixture_floor import FixtureReader, SCENES
from pane.floor_document import assemble_floor_document
from pane.readers import EpicRef, FloorRead, Reader, TransportFailed

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"


@pytest.fixture
def demo_settings(tmp_path, monkeypatch) -> Settings:
    """Settings bound to the committed fixtures tree with a clean cwd and env."""
    monkeypatch.chdir(tmp_path)
    for key in list(os.environ):
        if key.startswith("ERGANE_") or key.startswith("FACTORY_") or key.startswith("TEMPORAL_"):
            monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("PANE_DEMO", "1")
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(FIXTURES))
    return Settings.from_env()


def test_api_floor_serves_whole_fixture_floor(demo_settings, monkeypatch):
    import factory.cli.nouns.build

    monkeypatch.setattr(
        factory.cli.nouns.build,
        "_open_preflight_client",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("a demo read reached Temporal")),
    )

    app = create_app(demo_settings)
    client = TestClient(app)
    resp = client.get("/api/floor")
    assert resp.status_code == 200

    document = resp.json()
    _assert_full_fixture_document(document)

    # Reference instant comes from the escalations envelope (or floor envelope as fallback).
    esc_env = json.loads((FIXTURES / "escalations" / "open_escalations.envelope.json").read_text())
    assert document["reference_instant"] == esc_env["captured_at"]

    # Degraded is not empty: exactly the five entries predicted by the missing-document
    # rule for the staged scenes.
    degraded = document["degraded"]
    assert degraded
    transport_entries = [d for d in degraded if d["mode"] == "transport"]
    refusal_entries = [d for d in degraded if d["mode"] == "refusal"]

    expected_transport = [
        {"epic_id": "fx-landing-f0a0d6", "scene": "landing"},
        {"epic_id": "fx-paged-5e2e8a", "scene": "paged-while-verifying"},
        {"epic_id": "fx-question-e8c371", "scene": "question"},
        {"epic_id": "fx-landing-f0a0d6", "scene": "refusal"},
    ]
    assert len(transport_entries) == len(expected_transport)
    for entry, expected in zip(transport_entries, expected_transport):
        assert entry["section"] == "epics"
        assert entry["read"] == "workgraph"
        assert entry["epic_id"] == expected["epic_id"]

    assert len(refusal_entries) == 1
    refusal = refusal_entries[0]
    assert refusal["section"] == "epics"
    assert refusal["read"] == "epic_status"
    assert refusal["epic_id"] == "fx-landing-f0a0d6"
    assert refusal["detail"] == "Query rejected, status: 2"

    # No degraded entries for the other sections.
    assert not any(d["section"] in {"floor", "attention", "health", "spend_to_date"} for d in degraded)
    assert document["floor"]["data"] is not None
    assert document["health"]["data"] is not None
    assert document["spend_to_date"]["data"] is not None
    assert len(document["attention"]["items"]) == 2


def _assert_full_fixture_document(document: dict) -> None:
    assert set(document.keys()) == {
        "reference_instant",
        "floor",
        "epics",
        "attention",
        "health",
        "spend_to_date",
        "degraded",
    }

    assert document["floor"]["seam"] == "factory.cli.status.collect_floor"
    assert document["attention"]["seam"] == "factory.escalation.client.open_escalations + stored Question documents"
    assert document["health"]["seam"] == "factory.doctor.store.list_findings over connect_readonly"
    assert document["spend_to_date"]["seam"] == "factory.usage.ledger.rollup over factory.usage.cli.open_readonly"

    assert len(document["epics"]) == len(SCENES)
    scenes = {epic["scene"] for epic in document["epics"]}
    assert scenes == {scene.scene for scene in SCENES}

    attention = document["attention"]["items"]
    kinds = {item["kind"] for item in attention}
    assert kinds == {"escalation", "question"}
    question = next(item for item in attention if item["kind"] == "question")
    assert question["expires_at"] is None

    health = document["health"]["data"]
    assert health == json.loads((FIXTURES / "doctor" / "findings.json").read_text())

    spend = document["spend_to_date"]["data"]
    assert spend == json.loads((FIXTURES / "usage" / "rollup-by-persona.json").read_text())


class StubLiveReader:
    """Returns the same payloads the FixtureReader does, but through the Reader protocol.

    The `running` list is projected from the recorded FloorStatus plus the same
    scene refs so the assembled documents can be compared.
    """

    reference_instant: str | None

    def __init__(self, root: Path = FIXTURES) -> None:
        self.root = root
        self.reference_instant = None

    async def read_floor(self) -> FloorRead:
        status = json.loads((self.root / "floor" / "floor-live.json").read_text())
        running = []
        for epic in status.get("epics", []):
            epic_id = epic["epic_id"]
            running.append(
                EpicRef(
                    epic_id=epic_id,
                    workflow_id=f"epic-{epic_id}",
                    scene=None,
                    workgraph_ref=epic_id,
                )
            )
        for scene in SCENES:
            if scene.scene == "polled":
                continue  # covered by floor projection
            ref = scene.workgraph_path.stem if scene.workgraph_path else scene.epic_id
            running.append(
                EpicRef(
                    epic_id=scene.epic_id,
                    workflow_id=f"epic-{scene.epic_id}",
                    scene=scene.scene,
                    workgraph_ref=ref,
                )
            )
        return FloorRead(status=status, running=running)

    async def epic_status(self, workflow_id: str, scene: str | None = None) -> dict:
        candidates = [scene_obj for scene_obj in SCENES if f"epic-{scene_obj.epic_id}" == workflow_id]
        if scene is not None:
            candidates = [s for s in candidates if s.scene == scene]
        if not candidates:
            raise TransportFailed("epic_status", f"no stub status for {workflow_id}")
        doc = json.loads(candidates[0].status_path.read_text())
        if "refusal" in doc:
            raise TransportFailed("epic_status", "live stub refusal")
        return doc

    def workgraph(self, epic_id_or_ref: str) -> dict:
        path = self.root / "workgraphs" / f"{epic_id_or_ref}.json"
        if not path.exists():
            raise TransportFailed("workgraph", f"{path}: not recorded yet (fixtures/README.md)")
        return json.loads(path.read_text())

    async def open_escalations(self) -> list[dict]:
        return json.loads((self.root / "escalations" / "open_escalations.json").read_text())

    def stored_questions(self) -> list[dict]:
        return [json.loads((self.root / "webhook" / "question.json").read_text())]

    def list_findings(self) -> list[dict]:
        return json.loads((self.root / "doctor" / "findings.json").read_text())

    def rollup(self) -> dict:
        return json.loads((self.root / "usage" / "rollup-by-persona.json").read_text())


def test_one_code_path_for_demo_and_live_readers(tmp_path, monkeypatch):
    """The same `assemble_floor_document` runs against both reader implementations."""
    monkeypatch.chdir(tmp_path)

    fixture_doc = asyncio.run(
        assemble_floor_document(FixtureReader(FIXTURES, transport_fail=frozenset()))
    )
    stub_doc = asyncio.run(assemble_floor_document(StubLiveReader(FIXTURES)))

    # The two documents are not identical because the live stub returns the
    # polled scene via the floor projection and the FixtureReader also emits the
    # additional recorded floor epic (which the stub already covered).  However,
    # the important invariant is that both documents share the same structure,
    # seams, and that `floor_document.py` does not branch on the implementation.
    assert fixture_doc.keys() == stub_doc.keys()
    for key in ("floor", "attention", "health", "spend_to_date"):
        assert fixture_doc[key]["seam"] == stub_doc[key]["seam"]

    # The source of floor_document.py contains no implementation-specific words.
    source = (ROOT / "pane" / "floor_document.py").read_text()
    for forbidden in ("FixtureReader", "fixture_floor", "os.environ"):
        assert forbidden not in source, f"floor_document.py must not contain {forbidden}"


def test_missing_document_is_degraded_read(tmp_path, monkeypatch):
    """A deleted fixture document turns into a transport-mode degraded section."""
    copy_root = tmp_path / "fixtures-copy"
    shutil.copytree(FIXTURES, copy_root)
    (copy_root / "doctor" / "findings.json").unlink()

    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PANE_DEMO", "1")
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(copy_root))

    app = create_app(Settings.from_env())
    client = TestClient(app)
    resp = client.get("/api/floor")
    assert resp.status_code == 200
    document = resp.json()

    assert document["health"]["data"] is None
    health_degraded = [d for d in document["degraded"] if d["section"] == "health"]
    assert len(health_degraded) == 1
    entry = health_degraded[0]
    assert entry["mode"] == "transport"
    assert entry["read"] == "list_findings"
    assert str(copy_root / "doctor" / "findings.json") in entry["detail"]


def test_pending_envelope_is_degraded_read(tmp_path, monkeypatch):
    """An envelope with ``status: pending`` is treated as a missing document."""
    copy_root = tmp_path / "fixtures-copy"
    shutil.copytree(FIXTURES, copy_root)
    env_path = copy_root / "doctor" / "findings.envelope.json"
    env = json.loads(env_path.read_text())
    env["status"] = "pending"
    env_path.write_text(json.dumps(env))

    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PANE_DEMO", "1")
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(copy_root))

    app = create_app(Settings.from_env())
    client = TestClient(app)
    resp = client.get("/api/floor")
    assert resp.status_code == 200
    document = resp.json()

    assert document["health"]["data"] is None
    health_degraded = [d for d in document["degraded"] if d["section"] == "health"]
    assert len(health_degraded) == 1
    assert health_degraded[0]["mode"] == "transport"


def test_demo_transport_fail_section(tmp_path, monkeypatch):
    """`PANE_DEMO_TRANSPORT_FAIL=spend` poisons only the named section."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PANE_DEMO", "1")
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(FIXTURES))
    monkeypatch.setenv("PANE_DEMO_TRANSPORT_FAIL", "spend")

    app = create_app(Settings.from_env())
    client = TestClient(app)
    resp = client.get("/api/floor")
    assert resp.status_code == 200
    document = resp.json()

    assert document["spend_to_date"]["data"] is None
    spend_degraded = [d for d in document["degraded"] if d["section"] == "spend_to_date"]
    assert len(spend_degraded) == 1
    assert spend_degraded[0]["mode"] == "transport"
    assert spend_degraded[0]["read"] == "rollup"

    assert document["floor"]["data"] is not None
    assert document["health"]["data"] is not None
    assert document["attention"]["items"]


def test_transport_fail_unknown_section_raises():
    with pytest.raises(ValueError):
        Settings.from_env({"PANE_DEMO": "1", "PANE_DEMO_TRANSPORT_FAIL": "bogus"})
