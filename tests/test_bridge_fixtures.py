"""What the operator recorded from the Question seam, and the one nobody could.

Five `BridgeOutcome` rulings were captured from a real `CallbackBridge` against a
real question: RESOLVED, ALREADY_RESOLVED, UNKNOWN, EXPIRED, UNAUTHORIZED.  This
file asserts each is on disk in the recorded shape, that its envelope names the
seam it came through, and that its `outcome` is a member of ergane's own
`BridgeOutcome` — so a fixture that drifted from the contract fails here rather
than in the pane (FR-018, constitution V).

Two things this file is careful *not* to do, because both are how an invented
fixture would slip in.

It never identifies a ruling recording by a substring of its envelope's `seam`.
`bridge/malformed-relay.envelope.json` reads
``WebhookAdapter.relay(event) → None (never reaches handle_relay)`` — a string
containing the word `handle_relay` while naming the exact opposite fact.  A
recording is a ruling if and only if its `outcome` is non-null.

And it never writes a stand-in for SIGNAL_FAILED.  That ruling needs an
orchestrator the signal cannot reach, a state the capture could not stage, so
`fixtures/bridge/SIGNAL_FAILED.json` is absent by fact rather than by oversight.
The case skips by name.  The pane still derives SIGNAL_FAILED at runtime from
the signal RPC raising — an observation, not a recording — and
`web/tests/unit/RulingLine.test.tsx` proves it renders, because the renderer
only ever sees a string.

Every document here is opened read-only and no fixture is modified.
"""

import json
from pathlib import Path

import pytest

from factory.notify.service import BridgeOutcome

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"
BRIDGE = FIXTURES / "bridge"

#: The five the operator captured from the real seam, named for their ruling.
RECORDED_RULINGS = ("RESOLVED", "ALREADY_RESOLVED", "UNKNOWN", "EXPIRED", "UNAUTHORIZED")

#: The one that was never recordable.  Named here so the skip says which.
UNRECORDABLE_RULING = "SIGNAL_FAILED"

#: The adapter's refusal, recorded beside the rulings and not one of them.
ADAPTER_REFUSAL = "malformed-relay"


def read(path: Path) -> dict:
    """Parse a fixture document without opening it for writing."""
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def envelope_path(payload_path: Path) -> Path:
    return payload_path.with_name(f"{payload_path.stem}.envelope.json")


# --- (a) the five recorded rulings --------------------------------------------


@pytest.mark.parametrize("ruling", RECORDED_RULINGS)
def test_each_recorded_ruling_is_on_disk_in_the_recorded_shape(ruling):
    payload_path = BRIDGE / f"{ruling}.json"
    assert payload_path.exists(), f"{payload_path}: not recorded (fixtures/README.md)"

    document = read(payload_path)
    assert set(document) == {"relay", "outcome"}

    # The relay that produced it: exactly the three terms an `InboundRelay` is
    # made of, so the recording documents the call and not just its answer.
    assert isinstance(document["relay"], dict)
    assert set(document["relay"]) == {"correlation_id", "reply_text", "sender_identity"}

    # The file is named for its ruling, and the ruling is the factory's word.
    assert document["outcome"] == ruling
    assert document["outcome"] == payload_path.stem
    assert ruling in {member.value for member in BridgeOutcome}


@pytest.mark.parametrize("ruling", RECORDED_RULINGS)
def test_each_recorded_ruling_names_the_seam_it_came_through(ruling):
    path = envelope_path(BRIDGE / f"{ruling}.json")
    assert path.exists(), f"{path}: not recorded (fixtures/README.md)"

    sidecar = read(path)

    assert sidecar.get("captured_at"), f"{path}: no captured_at"
    seam = sidecar.get("seam", "")
    assert "CallbackBridge" in seam, f"{path}: seam does not name CallbackBridge: {seam!r}"
    assert "handle_relay" in seam, f"{path}: seam does not name handle_relay: {seam!r}"

    # The sidecar points at its own payload, by the path relative to `fixtures/`.
    assert sidecar.get("document") == f"bridge/{ruling}.json"


# --- (b) the adapter refusal, which is not a ruling ---------------------------


def test_the_adapter_refusal_is_recorded_as_a_refusal_and_not_as_a_ruling():
    """`relay: null, outcome: null` — no bridge call happened, so no ruling did."""
    document = read(BRIDGE / f"{ADAPTER_REFUSAL}.json")

    assert document["relay"] is None
    assert document["outcome"] is None
    # The event that could not be turned into a relay is kept, because that is
    # the fact being recorded.
    assert isinstance(document["event"], dict)


def test_the_ruling_set_is_identified_by_outcome_and_never_by_the_seam_string():
    """The trap this test exists to avoid, asserted as the trap it is.

    `malformed-relay.envelope.json`'s seam contains the word `handle_relay` while
    saying the call never reached it.  A sweep keying on that substring would
    admit the refusal as a sixth ruling; keying on a non-null `outcome` cannot.
    """
    refusal_seam = read(envelope_path(BRIDGE / f"{ADAPTER_REFUSAL}.json"))["seam"]
    assert "handle_relay" in refusal_seam
    assert "never reaches handle_relay" in refusal_seam

    by_outcome = {
        path.stem
        for path in BRIDGE.glob("*.json")
        if not path.name.endswith(".envelope.json") and read(path).get("outcome") is not None
    }

    assert by_outcome == set(RECORDED_RULINGS)
    assert ADAPTER_REFUSAL not in by_outcome


# --- (c) the ruling nobody could record ---------------------------------------


def test_signal_failed_is_absent_by_fact_and_no_stand_in_was_written():
    missing = BRIDGE / f"{UNRECORDABLE_RULING}.json"
    if not missing.exists():
        pytest.skip(
            f"{missing}: SIGNAL_FAILED needs an orchestrator the signal cannot reach, "
            "so it was never recordable; the pane derives it at runtime instead "
            "(constitution V, FR-018)"
        )

    # Reached only if someone recorded it for real, from the real seam.
    sidecar = read(envelope_path(missing))
    assert "handle_relay" in sidecar.get("seam", "")
    assert read(missing)["outcome"] == UNRECORDABLE_RULING


def test_signal_failed_is_still_a_ruling_the_factory_can_return():
    """Unrecorded is not unreal: it is a `BridgeOutcome` member all the same."""
    assert UNRECORDABLE_RULING in {member.value for member in BridgeOutcome}
    assert UNRECORDABLE_RULING not in set(RECORDED_RULINGS)


# --- (d) no fixture pretends an Escalation press produced a ruling ------------


def test_no_fixture_claims_the_escalation_signal_returned_a_ruling():
    """A Temporal signal returns nothing, and no recording may suggest otherwise.

    An Escalation press can only be signal-accepted or SIGNAL_FAILED, and its
    fate arrives through the factory's own reads.  A fixture naming
    `escalation_resolved` as the source of a ruling would be the pane teaching
    itself to mint one (FR-010, FR-018).
    """
    offenders = []
    for path in FIXTURES.rglob("*.envelope.json"):
        seam = read(path).get("seam") or ""
        if "escalation_resolved" in seam:
            offenders.append(path)

    assert offenders == [], f"a fixture names the signal as a ruling source: {offenders}"

    # And no ruling recording lives outside `fixtures/bridge/`, where the five
    # captured from `handle_relay` are the whole set.
    for path in FIXTURES.rglob("*.json"):
        if path.name.endswith(".envelope.json") or path.parent == BRIDGE:
            continue
        document = read(path)
        if not isinstance(document, dict):
            continue
        outcome = document.get("outcome")
        if isinstance(outcome, str):
            # `questions/expired-question.json` records the factory's own
            # question-store outcome, not a bridge ruling for a press.
            assert path.parent != BRIDGE
            assert "escalation" not in path.name, f"{path}: an Escalation ruling recording"


def test_reading_these_fixtures_modifies_none_of_them():
    """The sweep is a read: every document is byte-identical afterwards."""
    documents = sorted(p for p in BRIDGE.glob("*.json"))
    before = {path: path.read_bytes() for path in documents}

    for path in documents:
        read(path)

    for path, content in before.items():
        assert path.read_bytes() == content, f"{path}: modified by a read"
