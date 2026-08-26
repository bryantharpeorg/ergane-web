"""Fixture reader: replays recorded factory documents under `fixtures/`.

`load_document` returns `(payload, envelope)` from a JSON payload file and its
sidecar `*.envelope.json`.  A missing payload, missing envelope, or an envelope
with `"status": "pending"` raises `TransportFailed` — the README's rule that a
missing document is a degraded read, never an empty floor.

**016 adds the two git-backed reads to the set this module replays.**  The
landing read escaped the Fixture floor until then: `PANE_DEMO=1` served every
other document from `fixtures/` while `landing_facts` spawned git against
whatever checkout happened to be on the machine, so a shallow one made the
review room refuse every epic on a floor with nothing wrong with it.  Both reads
now come from a recording through the same `load_document` rule as everything
else (016 plan D2), which is what makes a room's answer independent of the git
history of the machine that ran it.

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
from pane.landing import CHANGED_FILES_READ, LANDING_READ, LandingFact
from pane.readers import EVIDENCE_READ, EpicRef, FloorRead, TransportFailed
from pane.revision import CONTAINS_READ, SERVED_REVISION_READ, ServedRevision


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


def _payload(path: Path, *, read: str) -> Any:
    """`load_document`'s payload, with a parse failure named rather than raised.

    A document that will not parse could not be read, so it takes the same word
    as a document that is not there (016 Edge Cases, constitution III) and the
    file and the parser's own complaint are both in the note.  No caller ever
    meets a `JSONDecodeError` where it is catching 001's two failure modes.
    """
    try:
        payload, _ = load_document(path, read=read)
    except json.JSONDecodeError as exc:
        raise TransportFailed(read, f"{path}: will not parse ({exc})") from exc
    return payload


def _or_none(value: Any) -> str | None:
    """A recorded string, or the Unknown Rule for one the document left empty.

    A field a recording did not carry is unknown; it is never an empty string
    rendered as if the branch had answered with one (constitution III).
    """
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _replayed_landings(
    path: Path, spec_dir: str, recorded: Any
) -> dict[str, LandingFact]:
    """One spec's recorded landings as `pane/landing.py`'s own `LandingFact`s.

    The same type the live read returns, built from the same six fields, so no
    consumer can tell a replayed landing from a read one by its shape (016
    FR-005).  A recording whose entry is not a landing — no commit, no
    provenance — is a document that will not read, and takes the same named
    failure as one that will not parse rather than a fact with holes in it.
    """
    if not isinstance(recorded, dict):
        raise TransportFailed(
            LANDING_READ, f"{path}: {spec_dir} is not a mapping of story key to landing"
        )

    facts: dict[str, LandingFact] = {}
    for story_key, entry in recorded.items():
        if not isinstance(entry, dict) or not entry.get("commit") or not entry.get("kind"):
            raise TransportFailed(
                LANDING_READ, f"{path}: {spec_dir}/{story_key} is not a recorded landing"
            )
        facts[str(story_key)] = LandingFact(
            story_key=str(entry.get("story_key") or story_key),
            commit=str(entry["commit"]),
            kind=str(entry["kind"]),
            merged_at=entry.get("merged_at"),
            subject=entry.get("subject"),
            pr_number=entry.get("pr_number"),
        )
    return facts


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

    def node_history(self, epic_id: str, node_id: str) -> list[dict]:
        """The recorded verification history for one node of one epic.

        `verification/<epic_id>/<node_id>.json` — one recorded
        `factory.verify.store.node_history` answer per node, as the seam
        returned it.  **No such document is recorded yet**: the evidence store
        is written on the operator's host by a real build, and this repository
        does not invent one (constitution V).  Until one is captured the read
        takes `load_document`'s missing-document rule and comes back as a
        transport failure naming the path it looked for — which is what the
        section then says, in words, instead of drawing a gate run nobody ran.

        `PANE_DEMO_TRANSPORT_FAIL=epics` drives the same failure deliberately,
        because the evidence is the epic's and fails with it.
        """
        self._check_fail("epics", EVIDENCE_READ)
        doc, _ = load_document(
            self.root / "verification" / epic_id / f"{node_id}.json", read=EVIDENCE_READ
        )
        return doc

    # --- the landing branch, recorded like every other document ------------

    def landing_facts(self, spec_dir: str) -> dict[str, LandingFact]:
        """One spec's landings, replayed from `landing/landing-facts.json`.

        The recorded answer of `pane.landing.read_landing_facts` over ergane's
        own `landed_facts`, one entry per spec directory, carrying the live
        read's six fields per story (016 FR-001, FR-005).  It is replayed
        *through this reader* rather than beside it (016 plan D2): a second
        replay path would be a second set of rules for what a missing fixture
        means, and `load_document` already has the only set this repository
        wants.

        **A spec the recording does not name is a degraded read, named** (016
        FR-006, plan D3).  It is the missing-document rule one level deeper —
        the recording is a document per spec directory as much as it is a file —
        and it is the whole lesson of the defect this replay exists for: an
        empty landing result is indistinguishable from a fact, and the review
        room believed it.  Nothing here ever returns `{}`.

        `PANE_DEMO_TRANSPORT_FAIL=epics` drives the same failure deliberately,
        for the reason `node_history` takes that section: the landing is the
        epic's, and it fails with it.
        """
        self._check_fail("epics", LANDING_READ)
        path = self.root / "landing" / "landing-facts.json"
        recorded = _payload(path, read=LANDING_READ)
        if not isinstance(recorded, dict):
            raise TransportFailed(
                LANDING_READ,
                f"{path}: not a mapping of spec directory to landings",
            )
        landings = recorded.get(spec_dir)
        if landings is None:
            raise TransportFailed(
                LANDING_READ,
                f"{path}: no recorded landing for {spec_dir} (fixtures/README.md)",
            )
        return _replayed_landings(path, spec_dir, landings)

    def changed_files(self, commit: str) -> list[str]:
        """Every path one landing commit changed, as a recording holds it.

        The review room's second git-backed read, and the other half of what a
        demo floor must own if a room is to answer the same in a checkout with
        no history as in a full one (016 FR-003).  **No such document is
        recorded yet** — the same position `node_history` has been in since 013,
        and for the same reason: a hand-written change list would be a pane that
        renders the fixture and not the factory (constitution V).  Until one is
        captured the read takes `load_document`'s missing-document rule and
        comes back naming the path it looked for, which is what the story's
        note then says in words rather than a file list nobody landed.

        `fixtures/README.md` says what recording one would take.  The shape is
        `read_changed_files`' own: a sorted list of repository-relative paths,
        one document per landing commit.
        """
        self._check_fail("epics", CHANGED_FILES_READ)
        path = self.root / "changed-files" / f"{commit}.json"
        recorded = _payload(path, read=CHANGED_FILES_READ)
        if not isinstance(recorded, list):
            raise TransportFailed(
                CHANGED_FILES_READ, f"{path}: not a list of changed paths"
            )
        return sorted({str(entry).strip() for entry in recorded if str(entry).strip()})

    # --- the revision this floor was captured from (011 US2) ---------------

    def served_revision(self) -> ServedRevision:
        """The revision the recorded floor was serving, from `revision/served.json`.

        **A demo floor answers this from the recording and not from the host**
        (016 FR-002, FR-003).  The first instinct is the other way: the revision
        a service is serving is a fact about the process, so surely it must be
        read live or not at all.  It must not.  016's two requirements are
        unconditional — under `PANE_DEMO=1` no room spawns a subprocess, and
        every room answers the same in a checkout with no history as in a full
        one — and a demo floor is a recording of a floor with its header on.  The
        honest answer is the revision that floor was captured from, recorded like
        every other document here and carrying its provenance in the envelope
        beside it.

        The live half is untouched (011 FR-009): a `LiveReader` has a real
        checkout under it, offers no recording, and `ReviewReaders.from_reader`
        binds it to `pane.revision.read_served_revision`.
        """
        self._check_fail("epics", SERVED_REVISION_READ)
        path = self.root / "revision" / "served.json"
        recorded = _payload(path, read=SERVED_REVISION_READ)
        if not isinstance(recorded, dict) or not recorded.get("revision"):
            raise TransportFailed(
                SERVED_REVISION_READ, f"{path}: not a served revision"
            )
        return ServedRevision(
            revision=str(recorded["revision"]),
            branch=_or_none(recorded.get("branch")),
            committed_at=_or_none(recorded.get("committed_at")),
            subject=_or_none(recorded.get("subject")),
        )

    def revision_contains(self, revision: str, commit: str) -> bool:
        """Whether the recording places `commit` inside `revision`.

        The recording holds both answers by name — `carries` and `omits` — and a
        commit in neither is a read nobody made, which comes back as one.  A
        recording that answered `False` for every commit it had not been asked
        about would be inventing FR-010's alarm, and that alarm is worth nothing
        the first time it fires on a fact nobody established.

        `revision` is checked rather than assumed: a recording answers for the
        revision it was captured at, and a caller asking about another one is
        asking a question this document does not hold.
        """
        self._check_fail("epics", CONTAINS_READ)
        path = self.root / "revision" / "served.json"
        recorded = _payload(path, read=CONTAINS_READ)
        if not isinstance(recorded, dict):
            raise TransportFailed(CONTAINS_READ, f"{path}: not a served revision")
        if str(recorded.get("revision")) != revision:
            raise TransportFailed(
                CONTAINS_READ,
                f"{path}: recorded for {recorded.get('revision')}, not {revision}",
            )
        if commit in {str(entry) for entry in recorded.get("carries", [])}:
            return True
        if commit in {str(entry) for entry in recorded.get("omits", [])}:
            return False
        raise TransportFailed(
            CONTAINS_READ,
            f"{path}: no recorded answer for {commit} (fixtures/README.md)",
        )

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
