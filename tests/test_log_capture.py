"""What the pane writes down while it works (spec 003 US4-S5, FR-017).

Intake and settlement are the two moments a credential could escape into a log
line, an SSE event, or the attention list, because they are the two moments the
pane is holding one. This captures every record at DEBUG around one intake POST,
one Question answer and one Escalation press, and asserts the same thing of all
three: the work is identified by its correlation id, and neither credential
appears — not the token, not the intake credential, and not the full
`/intake/<credential>` path, which is a credential wearing a URL's clothes.
"""

import json
import logging
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from pane.app import create_app
from pane.config import Settings

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"


def delivery(name: str) -> dict:
    return json.loads((FIXTURES / "webhook" / name).read_text())


QUESTION = delivery("question.json")
ESCALATION = delivery("escalation.json")


@pytest.fixture
def demo_app(tmp_path, monkeypatch, credentials):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PANE_DEMO", "1")
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(FIXTURES))
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    return create_app(Settings.from_env())


def captured_text(caplog) -> str:
    """Every captured record, message and arguments together."""
    return "\n".join(record.getMessage() for record in caplog.records)


def test_intake_and_settlement_log_correlation_ids_and_no_credential(
    demo_app, caplog, auth_headers, token, intake_credential
):
    client = TestClient(demo_app, headers=auth_headers)
    escalation_payload = ESCALATION["actions"][0]["payload"]

    with caplog.at_level(logging.DEBUG):
        # Seed the demo store the way a Desk opening the page does, then the
        # three moments: one delivery in, one answer out, one press out.
        assert client.get("/api/attention").status_code == 200
        intake = client.post(
            f"/intake/{intake_credential}", json=delivery("question-expired.json")
        )
        assert 200 <= intake.status_code < 300, intake.text

        answered = client.post(
            f"/api/attention/{QUESTION['correlation_id']}/answer",
            json={"text": "carried to the factory, and nothing else carried with it"},
        )
        assert answered.status_code == 200

        pressed = client.post(
            f"/api/attention/{ESCALATION['correlation_id']}/answer",
            json={"payload": escalation_payload},
        )
        assert pressed.status_code == 200

    text = captured_text(caplog)

    # Non-vacuous first: the three moments each wrote a line, and each line names
    # its work by correlation id. Without this the sweeps below would be a sweep
    # of an empty string.
    written = [record.getMessage() for record in caplog.records if record.name.startswith("pane.")]
    assert any(
        "intake stored" in message and delivery("question-expired.json")["correlation_id"] in message
        for message in written
    ), written
    assert any(
        "answer settled" in message and QUESTION["correlation_id"] in message
        for message in written
    ), written
    assert any(
        "answer signalled" in message and ESCALATION["correlation_id"] in message
        for message in written
    ), written

    # Every line the pane wrote about the work names the work, and none of them
    # names a credential: a settlement line with no correlation id is a line the
    # operator cannot join to anything (FR-017).
    for message in written:
        if "intake stored" in message or "answer settled" in message or "answer signalled" in message:
            assert "correlation_id=" in message, message
        assert token not in message
        assert intake_credential not in message

    # And nothing anywhere in the capture, from any logger, carries either value
    # or the intake path with the credential still on it.
    assert token not in text
    assert intake_credential not in text
    assert f"/intake/{intake_credential}" not in text


def test_a_record_carrying_a_credential_is_redacted_before_any_handler_sees_it(
    demo_app, caplog, token, intake_credential
):
    """`create_app` registered both values with `factory.notify.redact` (T054).

    The claim FR-017 makes is about *every* logger in the process, not only the
    pane's own — uvicorn's access log prints the request path, and that path is
    where the intake credential lives. The redaction is a log-record factory, so
    it fires at record creation and no handler can see the unredacted line. This
    proves it with a logger that knows nothing about any of it.
    """
    del demo_app  # built for its side effect: install_redaction + register_secret

    foreign = logging.getLogger("uvicorn.access")
    with caplog.at_level(logging.INFO):
        foreign.info('127.0.0.1 - "POST /intake/%s HTTP/1.1" 202', intake_credential)
        foreign.info("Authorization: Bearer %s", token)

    text = captured_text(caplog)
    assert text, "the foreign logger wrote nothing to capture"
    assert intake_credential not in text
    assert token not in text
    # The line survived; only the credential was removed, so the journal is still
    # legible to an operator debugging a delivery.
    assert "/intake/" in text
    assert "POST" in text


def test_the_attention_event_and_list_carry_no_credential(
    demo_app, auth_headers, token, intake_credential
):
    """The two things a browser actually receives, swept for both values."""
    client = TestClient(demo_app, headers=auth_headers)

    events: list[dict] = []
    broadcaster = demo_app.state.attention_broadcaster
    queue = broadcaster.subscribe()
    try:
        assert client.get("/api/attention").status_code == 200
        response = client.post(
            f"/intake/{intake_credential}", json=delivery("question-expired.json")
        )
        assert 200 <= response.status_code < 300, response.text
        while not queue.empty():
            events.append(queue.get_nowait())
    finally:
        broadcaster.unsubscribe(queue)

    assert events, "intake published no attention event to sweep"
    serialised = json.dumps(events)
    assert token not in serialised
    assert intake_credential not in serialised
    assert "Authorization" not in serialised

    listing = client.get("/api/attention")
    assert listing.status_code == 200
    body = listing.text
    assert token not in body
    assert intake_credential not in body
    assert "Authorization" not in body

    # Nor does the floor document, which carries the same assembly.
    floor = client.get("/api/floor").text
    assert token not in floor
    assert intake_credential not in floor
