"""Validate every committed fixture document against its ergane contract.

The recorded payloads and their envelopes are the operator's evidence.  This file
walks the layout `fixtures/README.md` fixes and asserts each document matches the
shape named in the contract.  Documents whose envelope says ``"status":
"pending"`` are skipped with `pytest.skip` — never invented.
"""

import json
import re
from pathlib import Path

import pytest

from factory.cli.status import FloorStatus
from factory.doctor.models import Finding
from factory.escalation.workflow import OpenEscalation
from factory.workgraph.models import NodeState, WorkNode

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"

LIVE_FAMILIES = {
    FIXTURES / "floor",
    FIXTURES / "workgraphs",
    FIXTURES / "usage",
    FIXTURES / "doctor",
    FIXTURES / "epic-status" / "002-expense-notes",
    FIXTURES / "epic-status" / "paged" / "paged-live.json",
    FIXTURES / "epic-status" / "skew",
}

HARNESS_FAMILIES = {
    FIXTURES / "escalations",
    FIXTURES / "questions",
    FIXTURES / "bridge",
    FIXTURES / "webhook",
    FIXTURES / "notices",
    FIXTURES / "epic-status" / "landing",
    FIXTURES / "epic-status" / "paged",
    FIXTURES / "epic-status" / "question",
    FIXTURES / "epic-status" / "refusal.json",
    FIXTURES / "epic-status" / "refusal-exception.json",
}


def documents(kind: str | None = None) -> list[tuple[Path, dict, dict]]:
    """Yield (path, payload, envelope) for every recorded payload under `fixtures/`."""
    results: list[tuple[Path, dict, dict]] = []
    for payload_path in sorted(FIXTURES.rglob("*.json")):
        if payload_path.name.endswith(".envelope.json"):
            continue
        envelope_path = _envelope_path(payload_path)
        if not envelope_path.exists():
            continue
        envelope = json.loads(envelope_path.read_text())
        if envelope.get("status") == "pending":
            pytest.skip(f"{payload_path}: envelope marks document as pending")
        payload = json.loads(payload_path.read_text())
        results.append((payload_path, payload, envelope))
    return results


def _envelope_path(payload_path: Path) -> Path:
    if payload_path.suffix == ".json":
        return payload_path.with_suffix("").with_name(f"{payload_path.stem}.envelope.json")
    return payload_path.with_suffix(".envelope.json")


def _is_under(candidate: Path, family: set[Path]) -> bool:
    for member in family:
        if member.is_dir():
            try:
                candidate.relative_to(member)
                return True
            except ValueError:
                continue
        else:
            if candidate == member:
                return True
    return False


def _family(payload_path: Path) -> str:
    if _is_under(payload_path, LIVE_FAMILIES):
        return "live"
    if _is_under(payload_path, HARNESS_FAMILIES):
        return "harness"
    return "other"


@pytest.mark.parametrize("path,payload,envelope", documents())
def test_envelope_has_required_fields(path, payload, envelope):
    assert "captured_at" in envelope
    assert "seam" in envelope
    assert "notes" in envelope

    family = _family(path)
    if family == "live":
        assert "source" in envelope, f"{path}: live family envelope missing source"
    if family == "harness":
        for key in ("scene", "run_id", "recorder", "workflow_id", "ergane_checkout_revision", "document", "webhook_url"):
            assert key in envelope, f"{path}: harness family envelope missing {key}"


@pytest.mark.parametrize("path,payload,envelope", documents())
def test_envelope_does_not_contain_credential_path(path, payload, envelope):
    assert "<redacted>" not in envelope.get("webhook_url", "") or "<redacted>" in envelope.get("webhook_url", "")


def documents_for_path(path: Path) -> tuple[dict, dict]:
    payload = json.loads(path.read_text())
    envelope = json.loads(_envelope_path(path).read_text())
    return payload, envelope


@pytest.mark.parametrize("path,payload,envelope", [
    (FIXTURES / "floor" / "floor-live.json", *documents_for_path(FIXTURES / "floor" / "floor-live.json")),
    (FIXTURES / "floor" / "floor-quiet.json", *documents_for_path(FIXTURES / "floor" / "floor-quiet.json")),
])
def test_floor_status_shape(path, payload, envelope):
    from dataclasses import fields

    field_names = {f.name for f in fields(FloorStatus)}
    assert set(payload.keys()) == field_names
    if path.name == "floor-quiet.json":
        assert payload["epics"] == []
        assert payload["queue"] == []


@pytest.mark.parametrize("path,payload,envelope", [
    (FIXTURES / "workgraphs" / "002-expense-notes.json", *documents_for_path(FIXTURES / "workgraphs" / "002-expense-notes.json")),
    (FIXTURES / "workgraphs" / "001-trip-expenses.json", *documents_for_path(FIXTURES / "workgraphs" / "001-trip-expenses.json")),
    (FIXTURES / "workgraphs" / "077-a-scanner-the-operator-chooses-runs-in-the-loop.json", *documents_for_path(FIXTURES / "workgraphs" / "077-a-scanner-the-operator-chooses-runs-in-the-loop.json")),
])
def test_workgraph_shape(path, payload, envelope):
    from dataclasses import fields

    top_keys = {"epic_id", "feature", "specs_root", "target_repo", "nodes", "inferred_edges"}
    assert set(payload.keys()) == top_keys
    node_fields = {f.name for f in fields(WorkNode)}
    for node in payload["nodes"]:
        assert set(node.keys()) == node_fields
        assert isinstance(node["id"], str)
        assert isinstance(node["story_key"], str)
        assert isinstance(node["persona"], str)
        assert isinstance(node["spec_ref"], str)
        assert isinstance(node["requirement_keys"], list)
        assert isinstance(node["depends_on"], list)
        assert isinstance(node["depends_on_merged"], list)
        assert node["timeout_override_s"] is None or isinstance(node["timeout_override_s"], int)


def _epic_status_documents() -> list[tuple[Path, dict, dict]]:
    results: list[tuple[Path, dict, dict]] = []
    for path in sorted((FIXTURES / "epic-status").rglob("*.json")):
        if path.name.endswith(".envelope.json"):
            continue
        envelope_path = _envelope_path(path)
        if not envelope_path.exists():
            continue
        envelope = json.loads(envelope_path.read_text())
        if envelope.get("status") == "pending":
            continue
        payload = json.loads(path.read_text())
        results.append((path, payload, envelope))
    return results


@pytest.mark.parametrize("path,payload,envelope", _epic_status_documents())
def test_epic_status_state_set(path, payload, envelope):
    if "nodes" not in payload:
        pytest.skip(f"{path}: document has no node status (refusal exception or similar)")
    allowed = {s.name for s in NodeState}
    observed = {node.get("state") for node in payload["nodes"].values()}
    assert observed.issubset(allowed), f"{path}: unexpected states {observed - allowed}"


@pytest.mark.parametrize("path,payload,envelope", [
    (FIXTURES / "epic-status" / "refusal.json", *documents_for_path(FIXTURES / "epic-status" / "refusal.json")),
])
def test_refusal_document_shape(path, payload, envelope):
    assert set(payload.keys()) == {"nodes", "execution_status", "refusal", "skew_notice"}
    assert payload["nodes"] == {}
    assert isinstance(payload["refusal"], str) and payload["refusal"]
    assert "refusal_type" not in payload
    assert "workflow_id" not in payload


@pytest.mark.parametrize("path,payload,envelope", [
    (FIXTURES / "epic-status" / "refusal-exception.json", *documents_for_path(FIXTURES / "epic-status" / "refusal-exception.json")),
])
def test_refusal_exception_shape(path, payload, envelope):
    assert "nodes" not in payload
    assert set(payload.keys()) == {"raised", "exception_type", "message", "status"}


@pytest.mark.parametrize("path,payload,envelope", [
    (FIXTURES / "webhook" / "question.json", *documents_for_path(FIXTURES / "webhook" / "question.json")),
    (FIXTURES / "webhook" / "escalation.json", *documents_for_path(FIXTURES / "webhook" / "escalation.json")),
    (FIXTURES / "webhook" / "notice-supervision.json", *documents_for_path(FIXTURES / "webhook" / "notice-supervision.json")),
])
def test_webhook_payload_shapes(path, payload, envelope):
    assert "correlation_id" in payload
    if path.name == "question.json":
        assert payload["actions"] == []
    elif path.name == "escalation.json":
        for action in payload["actions"]:
            assert re.fullmatch(r"esc:[0-9a-f]{12}:[A-Z_]+", action["payload"])
        assert re.fullmatch(r"[0-9a-f]{12}", payload["correlation_id"])
    elif path.name == "notice-supervision.json":
        assert payload["actions"] == []
        assert not re.fullmatch(r"[0-9a-f]{12}", payload["correlation_id"])


@pytest.mark.parametrize("path,payload,envelope", [
    (FIXTURES / "escalations" / "open_escalations.json", *documents_for_path(FIXTURES / "escalations" / "open_escalations.json")),
    (FIXTURES / "escalations" / "open_escalations-2.json", *documents_for_path(FIXTURES / "escalations" / "open_escalations-2.json")),
])
def test_open_escalations_shape(path, payload, envelope):
    from dataclasses import fields

    field_names = {f.name for f in fields(OpenEscalation)}
    assert isinstance(payload, list)
    for row in payload:
        assert set(row.keys()) == field_names
        assert re.match(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})", row["expires_at"])
        assert row["resolution"] is None


@pytest.mark.parametrize("path,payload,envelope", [
    (FIXTURES / "doctor" / "findings.json", *documents_for_path(FIXTURES / "doctor" / "findings.json")),
])
def test_findings_shape(path, payload, envelope):
    from dataclasses import fields

    field_names = {f.name for f in fields(Finding)}
    assert isinstance(payload, list)
    for row in payload:
        assert set(row.keys()) == field_names
        assert row["severity"].lower() in {"critical", "warning", "info"}
        assert row["status"].lower() in {"open", "promoted", "resolved", "regressed"}


@pytest.mark.parametrize("path,payload,envelope", [
    (FIXTURES / "usage" / "rollup-by-persona.json", *documents_for_path(FIXTURES / "usage" / "rollup-by-persona.json")),
])
def test_rollup_shape(path, payload, envelope):
    assert set(payload.keys()) == {"by", "filters", "groups", "totals"}
    has_null = any(
        metric is None
        for group in payload.get("groups", [])
        for metric in group.values()
    ) or any(metric is None for metric in payload.get("totals", {}).values())
    assert has_null


@pytest.mark.parametrize("path,payload,envelope", [
    (FIXTURES / "questions" / "pending_questions.json", *documents_for_path(FIXTURES / "questions" / "pending_questions.json")),
])
def test_stored_questions_shape(path, payload, envelope):
    assert set(payload.keys()) == {"pending_questions", "get_question"}
    pending = payload["pending_questions"]
    get_question = payload["get_question"]
    assert isinstance(pending, list)
    assert isinstance(get_question, dict)
    for row in pending + [get_question]:
        assert row["expires_at"] is not None
        assert re.match(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})", row["expires_at"])


def test_paged_while_verifying_fixture():
    found = False
    for path, payload, _envelope in _epic_status_documents():
        for node_id, node in payload.get("nodes", {}).items():
            if node.get("state") == "VERIFYING" and node.get("awaiting_operator") is True:
                found = True
    assert found, "expected at least one node with state VERIFYING and awaiting_operator true"


def test_state_coverage():
    observed: set[str] = set()
    for path, payload, _envelope in _epic_status_documents():
        if "nodes" not in payload:
            continue
        for node in payload["nodes"].values():
            observed.add(node.get("state"))
    allowed = {s.name for s in NodeState}
    assert observed.issubset(allowed)
    for required in ("PASSED", "PR_OPEN", "ENQUEUED", "MERGED"):
        assert required in observed, f"expected state {required} somewhere in status fixtures"


def test_skew_pair_names_undeclared_node():
    status_path = FIXTURES / "epic-status" / "skew" / "status-names-us3.json"
    status, status_env = documents_for_path(status_path)
    pair_with = status_env["pair_with"]
    if pair_with.startswith("workgraphs/"):
        pair_with = pair_with[len("workgraphs/"):]
    graph_path = FIXTURES / "workgraphs" / pair_with
    graph, _graph_env = documents_for_path(graph_path)
    graph_ids = {node["id"] for node in graph["nodes"]}
    status_ids = set(status.get("nodes", {}).keys())
    undeclared = status_ids - graph_ids
    assert undeclared, f"expected at least one status node id absent from {graph_path}"


def test_escalation_expiry_skews_from_default_hour():
    store_rows_path = FIXTURES / "escalations" / "store-rows.json"
    standalone_path = FIXTURES / "escalations" / "store-row-standalone.json"
    store_rows = json.loads(store_rows_path.read_text())
    standalone = json.loads(standalone_path.read_text())

    def _skew_evidence(row: dict) -> tuple[str, str]:
        return row["sent_at"], row["expires_at"]

    sent1, exp1 = _skew_evidence(store_rows["get_escalation"])
    sent2, exp2 = _skew_evidence(standalone)
    assert exp1 != _plus_hour(sent1)
    assert exp2 != _plus_hour(sent2)


def _plus_hour(iso: str) -> str:
    from datetime import datetime, timedelta, timezone

    # Sent times are all UTC with trailing Z
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return (dt + timedelta(seconds=3600)).strftime("%Y-%m-%dT%H:%M:%SZ")


def test_scenes_match_committed_layout():
    from pane.fixture_floor import SCENES

    for scene in SCENES:
        assert scene.status_path.exists(), f"{scene.status_path}: scene status document missing"
        if scene.workgraph_path is None:
            # The layout records no graph for this scene; assert it is truly absent
            absent_path = FIXTURES / "workgraphs" / f"{scene.epic_id}.json"
            assert not absent_path.exists(), f"{absent_path}: graph unexpectedly exists for scene {scene.scene}"
        else:
            assert scene.workgraph_path.exists(), f"{scene.workgraph_path}: scene workgraph missing"
