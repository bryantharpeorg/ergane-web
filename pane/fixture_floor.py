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
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from factory.cli.nouns import build

from pane import attention_store
from pane.attention_store import StoredItem
from pane.readers import EpicRef, FloorRead, TransportFailed


# The recorded deliveries the demo floor is seeded from, in the order the
# recorder captured them.  One of each kind the intake route admits.
SEEDED_DELIVERIES = (
    "question.json",
    "escalation.json",
    "notice-supervision.json",
)


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
        epic_id="077-a-scanner-the-operator-chooses-runs-in-the-loop",
        status_path=_fixture("epic-status/refusal.json"),
        workgraph_path=_fixture("workgraphs/077-a-scanner-the-operator-chooses-runs-in-the-loop.json"),
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
        demo_ruling: str = "RESOLVED",
    ) -> None:
        self.root = root.resolve()
        self.transport_fail = transport_fail
        self.demo_ruling = demo_ruling

        # The demo floor gets its own delivery store, seeded from the recorded
        # webhook payloads through the same call intake uses.  A reader built
        # without a path gets a fresh one, so a demo floor never inherits a warm
        # store from a previous process.
        if attention_db is None:
            attention_db = Path(tempfile.mkdtemp(prefix="pane-fixture-")) / "attention.db"
        self.attention_db = Path(attention_db)
        self._store: Any = None
        self._seeded = False

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

    def stored_items(self) -> list[StoredItem]:
        """Serve the seeded delivery store — the same store intake writes.

        The demo floor's Attention items are the recordings, admitted through the
        intake path rather than hand-built here: the loader serves the recording
        and never invents one (constitution V).  A recording that is missing is a
        degraded read in words, exactly as every other fixture read is.
        """
        self._check_fail("attention", "stored_items")
        self._seed()
        return attention_store.list_items(self._attention_store())

    def _attention_store(self):
        if self._store is None:
            self._store = attention_store.open_store(self.attention_db)
        return self._store

    def _seed(self) -> None:
        """Put each recorded delivery through `upsert_delivery`, once."""
        if self._seeded:
            return

        from pane.intake import classify

        conn = self._attention_store()
        for name in SEEDED_DELIVERIES:
            payload, envelope = load_document(self.root / "webhook" / name, read="stored_items")
            attention_store.upsert_delivery(
                conn,
                kind=classify(payload),
                correlation_id=payload["correlation_id"],
                text=payload["text"],
                actions=payload.get("actions", []),
                # The recorder's own instant: provenance, never a countdown anchor.
                received_at=envelope["captured_at"],
            )
        self._seeded = True

    async def aclose(self) -> None:
        if self._store is not None:
            self._store.close()
            self._store = None

    async def settle_question(self, correlation_id: str, text: str, identity: str) -> str:
        """Replay the recorded ruling named by `PANE_DEMO_RULING`.

        Every recorded document is `{"relay": {...}, "outcome": "<RULING>"}`, so
        this returns its `outcome` string and nothing else — no bridge is
        constructed and no store is touched.  Five rulings were recorded:
        RESOLVED, ALREADY_RESOLVED, UNKNOWN, EXPIRED, UNAUTHORIZED.
        SIGNAL_FAILED is not among them — it needs an orchestrator the signal
        cannot reach, a state the capture could not stage — and
        `bridge/malformed-relay.json` is the adapter's refusal, not a ruling.  A
        name with no document on disk raises `TransportFailed` naming the path
        it looked for, exactly as every other fixture read does.
        """
        doc, _ = load_document(
            self.root / "bridge" / f"{self.demo_ruling}.json", read="settle_question"
        )
        return doc["outcome"]

    async def press_escalation(
        self, correlation_id: str, escalation_id: str, choice: str, identity: str
    ) -> None:
        """Accept the press and send nothing: the demo floor has no workflow.

        A signal returns nothing when it succeeds, so returning is the whole of
        what an accepted press looks like from the caller's side.
        """
        return None

    async def read_question(self, correlation_id: str) -> dict | None:
        """The recorded `QuestionRecord` for this id, from the questions store read.

        `questions/pending_questions.json` is an **object**, not a bare array:
        `pending_questions` holds the list the seam returned and `get_question`
        holds the single row it answered for that id.  The list is what is
        matched on, so a document that grows a second pending question needs no
        change here.  An id in neither is `None` — the factory's store has no
        such question, and the item keeps no deadline (FR-012).
        """
        self._check_fail("attention", "read_question")
        doc, _ = load_document(
            self.root / "questions" / "pending_questions.json", read="read_question"
        )
        for row in doc["pending_questions"]:
            if row.get("question_id") == correlation_id:
                return row
        return None

    async def read_escalation_fate(self, correlation_id: str) -> dict | None:
        """The matching entry of the recorded `open_escalations` array, or None.

        A bare JSON array, recorded from the seam 001 already reads.  Its one
        entry carries `resolution: null`, so a pressed fixture Escalation stays
        in flight — the demo floor has no workflow to change its mind, and
        inventing a resolution here would be the pane minting a ruling for a
        press (FR-010).
        """
        self._check_fail("attention", "escalation_status")
        doc, _ = load_document(
            self.root / "escalations" / "open_escalations.json", read="escalation_status"
        )
        for entry in doc:
            if entry.get("escalation_id") == correlation_id:
                return entry
        return None

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
