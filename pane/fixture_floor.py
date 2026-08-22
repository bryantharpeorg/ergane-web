"""Fixture reader: replays recorded factory documents under `fixtures/`.

`load_document` returns `(payload, envelope)` from a JSON payload file and its
sidecar `*.envelope.json`.  A missing payload, missing envelope, or an envelope
with `"status": "pending"` raises `TransportFailed` — the README's rule that a
missing document is a degraded read, never an empty floor.

`FixtureReader` implements the `Reader` protocol.  It assembles the demo floor
from the recorded `floor-live.json` plus a scene table (`SCENES`) that covers
every on-cue epic status document the Desk must render.  Each scene row is an
`EpicRef`; when no workgraph was recorded for a scene, the workgraph read falls
through to the missing-document rule and produces an honest transport failure.
"""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from factory.cli.nouns import build

from pane.readers import EpicRef, FloorRead, TransportFailed


def _fixture(*relative_parts: str) -> Path:
    """Return an absolute path to a file under the repository's `fixtures/` tree."""
    return Path(__file__).resolve().parents[1] / "fixtures" / Path(*relative_parts)


@dataclass(frozen=True)
class Scene:
    epic_id: str
    status_path: Path
    workgraph_path: Path | None
    scene: str


SCENES = (
    Scene(
        epic_id="002-expense-notes",
        status_path=_fixture("epic-status/002-expense-notes/002-expense-notes-013-us1=MERGED-MERGED_us2=MERGED-MERGED.json"),
        workgraph_path=_fixture("workgraphs/002-expense-notes.json"),
        scene="polled",
    ),
    Scene(
        epic_id="fx-landing-f0a0d6",
        status_path=_fixture("epic-status/landing/final.json"),
        workgraph_path=None,
        scene="landing",
    ),
    Scene(
        epic_id="fx-paged-5e2e8a",
        status_path=_fixture("epic-status/paged/paged.json"),
        workgraph_path=None,
        scene="paged-while-verifying",
    ),
    Scene(
        epic_id="fx-question-e8c371",
        status_path=_fixture("epic-status/question/waiting-operator.json"),
        workgraph_path=None,
        scene="question",
    ),
    Scene(
        epic_id="fx-landing-f0a0d6",
        status_path=_fixture("epic-status/refusal.json"),
        workgraph_path=None,
        scene="refusal",
    ),
    Scene(
        epic_id="fx-landing-f0a0d6",
        status_path=_fixture("epic-status/skew/status-names-us3.json"),
        workgraph_path=_fixture("workgraphs/002-expense-notes.json"),
        scene="skew",
    ),
)


def load_document(path: Path, *, read: str) -> tuple[Any, dict]:
    """Load a payload JSON file and its envelope sidecar.

    Raises `TransportFailed` if either file is missing or the envelope marks the
    document as not yet recorded (``"status": "pending"``).
    """
    if not path.exists():
        raise TransportFailed(read, f"{path}: not recorded yet (fixtures/README.md)")

    envelope_path = path.with_suffix(".envelope.json")
    if path.suffix == ".json":
        envelope_path = path.with_suffix("")  # strip .json
        envelope_path = envelope_path.with_name(f"{envelope_path.name}.envelope.json")
    if not envelope_path.exists():
        raise TransportFailed(read, f"{envelope_path}: not recorded yet (fixtures/README.md)")

    payload = json.loads(path.read_text())
    envelope = json.loads(envelope_path.read_text())

    if envelope.get("status") == "pending":
        raise TransportFailed(read, f"{path}: not recorded yet (fixtures/README.md)")

    return payload, envelope


class FixtureReader:
    """Replays every document under `fixtures/` through the `Reader` protocol."""

    reference_instant: str | None

    def __init__(
        self,
        root: Path,
        *,
        transport_fail: frozenset[str] = frozenset(),
        attention_db: Path | None = None,
    ) -> None:
        self.root = root.resolve()
        self.transport_fail = transport_fail
        self._attention_db = attention_db

        try:
            _, esc_env = load_document(self.root / "escalations" / "open_escalations.json", read="open_escalations")
            captured_at = esc_env.get("captured_at")
        except TransportFailed:
            captured_at = None

        if captured_at is None:
            try:
                _, floor_env = load_document(self.root / "floor" / "floor-live.json", read="collect_floor")
                captured_at = floor_env.get("captured_at")
            except TransportFailed:
                captured_at = None

        self.reference_instant = captured_at

        if attention_db is not None:
            self._seed_attention_store(attention_db)

    def _seed_attention_store(self, path: Path) -> None:
        from pane.attention_store import open_store, upsert_delivery

        conn = open_store(path)
        try:
            for name, kind in (
                ("question.json", "question"),
                ("escalation.json", "escalation"),
                ("notice-supervision.json", "notice"),
                ("notice-roadmap.json", "notice"),
            ):
                payload_path = self.root / "webhook" / name
                if not payload_path.exists():
                    continue
                doc, _ = load_document(payload_path, read="webhook")
                upsert_delivery(
                    conn,
                    kind=kind,
                    correlation_id=doc["correlation_id"],
                    text=doc["text"],
                    actions=doc.get("actions", []),
                    received_at=self.reference_instant or doc.get("received_at"),
                )
        finally:
            conn.close()

    def _check_fail(self, section: str, read: str) -> None:
        if section in self.transport_fail:
            raise TransportFailed(read, f"PANE_DEMO_TRANSPORT_FAIL names {section}")

    async def read_floor(self) -> FloorRead:
        self._check_fail("floor", "collect_floor")
        status, _ = load_document(self.root / "floor" / "floor-live.json", read="collect_floor")

        recorded_ids = {epic.get("epic_id") for epic in status.get("epics", [])}
        running: list[EpicRef] = []
        for scene in SCENES:
            ref = scene.workgraph_path.stem if scene.workgraph_path else scene.epic_id
            running.append(
                EpicRef(
                    epic_id=scene.epic_id,
                    workflow_id=build.workflow_id(scene.epic_id),
                    scene=scene.scene,
                    workgraph_ref=ref,
                )
            )
        for epic in status.get("epics", []):
            epic_id = epic.get("epic_id")
            if epic_id and epic_id not in {r.epic_id for r in running}:
                running.append(
                    EpicRef(
                        epic_id=epic_id,
                        workflow_id=build.workflow_id(epic_id),
                        scene=None,
                        workgraph_ref=epic_id,
                    )
                )

        return FloorRead(status=status, running=running)

    async def epic_status(self, workflow_id: str, scene: str | None = None) -> dict:
        self._check_fail("epics", "epic_status")
        scene_obj = self._scene_for_workflow(workflow_id, scene_name=scene)
        doc, _ = load_document(scene_obj.status_path, read="epic_status")
        if "refusal" in doc:
            from pane.readers import QueryRefused
            raise QueryRefused("epic_status", doc["refusal"])
        return doc

    def workgraph(self, epic_id_or_ref: str) -> dict:
        self._check_fail("epics", "workgraph")
        path = self.root / "workgraphs" / f"{epic_id_or_ref}.json"
        doc, _ = load_document(path, read="workgraph")
        return doc

    async def open_escalations(self) -> list[dict]:
        self._check_fail("attention", "open_escalations")
        doc, _ = load_document(self.root / "escalations" / "open_escalations.json", read="open_escalations")
        return doc

    def stored_items(self) -> list[dict]:
        self._check_fail("attention", "stored_items")
        from pane.attention_store import list_items, open_store

        if self._attention_db is None:
            return []
        conn = open_store(self._attention_db)
        try:
            return list_items(conn)
        finally:
            conn.close()

    def list_findings(self) -> list[dict]:
        self._check_fail("health", "list_findings")
        doc, _ = load_document(self.root / "doctor" / "findings.json", read="list_findings")
        return doc

    def rollup(self) -> dict:
        self._check_fail("spend", "rollup")
        doc, _ = load_document(self.root / "usage" / "rollup-by-persona.json", read="rollup")
        return doc

    def _scene_for_workflow(self, workflow_id: str, *, scene_name: str | None = None) -> Scene:
        candidates = [scene for scene in SCENES if build.workflow_id(scene.epic_id) == workflow_id]
        if scene_name is not None:
            for scene in candidates:
                if scene.scene == scene_name:
                    return scene
        if candidates:
            return candidates[0]
        raise TransportFailed("epic_status", f"no fixture scene for {workflow_id}")
