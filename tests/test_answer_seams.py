"""The verb reaches the factory's seams, and reaches nothing else (spec 003 US2).

Every item under test is put into the store through the intake route, from the
recordings under `fixtures/webhook/` — the factory's own POST bodies — so what
the Desk answers here is what the factory actually delivered (constitution V).
Both settlement seams are substituted at the `Reader` boundary 001 defined, and
the recorder keeps the *arguments* rather than a count, because the scenarios are
about what the pane carried, not how often it called.

Nothing in this file types a correlation id, an escalation id, or a choice by
hand: every identifier is read out of a recording, so a test that passed while
the pane invented one would be impossible to write.
"""

import asyncio
import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from pane.app import create_app
from pane.attention_store import open_store
from pane.config import Settings
from pane.readers import FloorRead, StoredItem, TransportFailed

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"
WEBHOOK = FIXTURES / "webhook"

CREDENTIAL = "intake-credential-for-tests"

# Whose answers the factory is asked to judge.  A sentinel, so a hard-coded
# identity anywhere in the answer path shows up as an inequality rather than as
# a coincidence.
IDENTITY = "pane-answer-identity-sentinel"

# The deliveries every test in this file starts from: one Question, one
# Escalation, one Notice, all recorded.
SEEDED = ("question", "escalation", "notice-supervision")


def recorded(name: str) -> dict:
    return json.loads((WEBHOOK / f"{name}.json").read_text())


QUESTION = recorded("question")
ESCALATION = recorded("escalation")
NOTICE = recorded("notice-supervision")


class RecordingReader:
    """A `Reader` whose two settlement operations keep their arguments.

    `settle_question` returns whatever `ruling` is set to and `press_escalation`
    raises whatever `signal_raises` is set to, so a test chooses the factory's
    answer without ever reaching a factory.
    """

    reference_instant: str | None = None

    def __init__(self, attention_db: Path) -> None:
        self.attention_db = attention_db
        self.settled: list[tuple[str, str, str]] = []
        self.pressed: list[tuple[str, str, str, str]] = []
        self.ruling = "RESOLVED"
        self.signal_raises: Exception | None = None
        self.escalations = json.loads(
            (FIXTURES / "escalations" / "open_escalations.json").read_text()
        )
        # Set by the concurrency test: `settle_question` reports that it entered
        # and then waits, so a second request arrives while the first is out.
        self.entered: asyncio.Event | None = None
        self.gate: asyncio.Event | None = None

    async def settle_question(self, correlation_id: str, text: str, identity: str) -> str:
        self.settled.append((correlation_id, text, identity))
        if self.entered is not None:
            self.entered.set()
        if self.gate is not None:
            await self.gate.wait()
        return self.ruling

    async def press_escalation(
        self, correlation_id: str, escalation_id: str, choice: str, identity: str
    ) -> None:
        self.pressed.append((correlation_id, escalation_id, choice, identity))
        if self.signal_raises is not None:
            raise self.signal_raises

    # --- the reads 001 defined, enough for the assembly to run ---------------

    async def read_floor(self) -> FloorRead:
        return FloorRead(status={"epics": []}, running=[])

    async def epic_status(self, workflow_id: str, scene: str | None = None) -> dict:
        return {}

    def workgraph(self, epic_id_or_ref: str) -> dict:
        raise TransportFailed("workgraph", "no workgraph in this test")

    async def open_escalations(self) -> list[dict]:
        return self.escalations

    def stored_items(self) -> list[StoredItem]:
        from pane.attention_store import list_items

        conn = open_store(self.attention_db)
        try:
            return list_items(conn)
        finally:
            conn.close()

    def list_findings(self) -> list[dict]:
        return []

    def rollup(self) -> dict:
        return {"by": "persona", "filters": {}, "groups": [], "totals": {}}

    async def aclose(self) -> None:
        return None


@pytest.fixture
def answer_app(tmp_path, monkeypatch):
    """The app with a store seeded through intake and both seams substituted."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PANE_INTAKE_CREDENTIAL", CREDENTIAL)
    monkeypatch.setenv("PANE_ANSWER_IDENTITY", IDENTITY)
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(FIXTURES))
    monkeypatch.delenv("PANE_DEMO", raising=False)

    settings = Settings.from_env()
    assert settings.answer_identity == IDENTITY

    reader = RecordingReader(tmp_path / "attention.db")
    monkeypatch.setattr("pane.app._make_reader", lambda _settings: reader)

    app = create_app(settings)
    app.state.recording_reader = reader

    # Seeded the way the factory seeds it: through the intake route.  Not inside
    # a `with`, because the lifespan's shutdown closes the store this app spends
    # the rest of the test reading.
    seeding_client = TestClient(app)
    for name in SEEDED:
        response = seeding_client.post(f"/intake/{CREDENTIAL}", json=recorded(name))
        assert 200 <= response.status_code < 300, response.text

    return app


@pytest.fixture
def client(answer_app):
    return TestClient(answer_app)


@pytest.fixture
def reader(answer_app) -> RecordingReader:
    return answer_app.state.recording_reader


@pytest.fixture
def store(answer_app, tmp_path):
    conn = open_store(tmp_path / "attention.db")
    yield conn
    conn.close()


def answer_url(correlation_id: str) -> str:
    return f"/api/attention/{correlation_id}/answer"


def row(store, correlation_id: str) -> tuple:
    return tuple(
        store.execute(
            "SELECT * FROM attention WHERE correlation_id = ? ORDER BY seq", (correlation_id,)
        ).fetchone()
    )


def listed(client) -> list[dict]:
    response = client.get("/api/attention")
    assert response.status_code == 200
    return response.json()["items"]


def item_for(client, correlation_id: str) -> dict:
    for item in listed(client):
        if item["correlation_id"] == correlation_id:
            return item
    raise AssertionError(f"{correlation_id} is not in the attention list")


# --- US2-S1: a Question settles through handle_relay, and through nothing else -


def test_a_submitted_question_makes_exactly_one_handle_relay_call(client, reader):
    """The relay is built from exactly three terms, and the third is configured.

    `settle_question` is the pane's whole side of `CallbackBridge.handle_relay`:
    the correlation id the factory delivered, the operator's text verbatim, and
    the identity `PANE_ANSWER_IDENTITY` names.  A fourth term, or a term the pane
    composed, would show up here as an argument that is not one of these three.
    """
    correlation_id = QUESTION["correlation_id"]

    response = client.post(answer_url(correlation_id), json={"text": "ship it"})

    assert response.status_code == 200
    assert response.json() == {"kind": "question", "ruling": "RESOLVED"}

    assert reader.settled == [(correlation_id, "ship it", IDENTITY)]
    # A Question is never settled by a signal: the two seams are not
    # interchangeable and the pane never reaches for the wrong one.
    assert reader.pressed == []


def test_the_submitted_text_reaches_the_seam_byte_for_byte(client, reader):
    """Verbatim means verbatim: no strip, no normalise, no truncation."""
    text = "  Option A.\n\nThe (epic, node, attempt) tuple collides across re-runs.\t"

    response = client.post(answer_url(QUESTION["correlation_id"]), json={"text": text})

    assert response.status_code == 200
    assert [sent for (_id, sent, _identity) in reader.settled] == [text]


def test_the_ruling_the_factory_returned_is_passed_through_verbatim(client, reader):
    """Including a string this build has never heard of (US3 renders it; US2 carries it)."""
    reader.ruling = "A_RULING_THIS_BUILD_HAS_NEVER_SEEN"

    response = client.post(answer_url(QUESTION["correlation_id"]), json={"text": "ship it"})

    assert response.json()["ruling"] == "A_RULING_THIS_BUILD_HAS_NEVER_SEEN"
    assert item_for(client, QUESTION["correlation_id"])["settlement"]["ruling"] == (
        "A_RULING_THIS_BUILD_HAS_NEVER_SEEN"
    )


def test_a_notice_and_an_unknown_id_reach_no_seam(client, reader):
    """Neither has a settlement to reach, so neither may spend a seam call."""
    notice = client.post(answer_url(NOTICE["correlation_id"]), json={"text": "ship it"})
    assert notice.status_code == 422
    assert notice.json() == {"error": "not_answerable"}

    unknown = client.post(answer_url("ffffffffffff"), json={"text": "ship it"})
    assert unknown.status_code == 404
    assert unknown.json() == {"error": "no_such_item"}

    assert reader.settled == []
    assert reader.pressed == []


# --- US2-S3: a press sends one signal, carrying only what was delivered -------


def test_a_pressed_choice_sends_exactly_one_escalation_resolved_signal(client, reader):
    """Escalation id and choice are parsed from the delivered payload; the workflow id is the correlation id.

    The payload is read out of `fixtures/webhook/escalation.json` rather than
    typed here, and the two fields the signal carries are then re-derived from
    that same recorded string — so nothing in this assertion could agree with a
    pane that invented either one.
    """
    correlation_id = ESCALATION["correlation_id"]
    delivered = ESCALATION["actions"][0]["payload"]
    _prefix, expected_escalation_id, expected_choice = delivered.split(":", 2)

    response = client.post(answer_url(correlation_id), json={"payload": delivered})

    assert response.status_code == 200
    assert response.json() == {"kind": "escalation", "signal": "accepted"}

    assert reader.pressed == [
        (correlation_id, expected_escalation_id, expected_choice, IDENTITY)
    ]
    # The workflow the signal was sent to is the item's correlation id, and the
    # escalation id inside the payload is a separate term that happens to match
    # it here because the factory minted both (ergane 041 FR-004).
    (workflow_id, escalation_id, _choice, _identity) = reader.pressed[0]
    assert workflow_id == correlation_id
    assert escalation_id == expected_escalation_id

    # An Escalation is never settled through the bridge.
    assert reader.settled == []


@pytest.mark.parametrize("index", range(len(ESCALATION["actions"])))
def test_every_delivered_choice_presses_its_own_payload(client, reader, index):
    """Each recorded choice sends its own `<CHOICE>` and no other's."""
    delivered = ESCALATION["actions"][index]["payload"]
    _prefix, escalation_id, choice = delivered.split(":", 2)

    response = client.post(answer_url(ESCALATION["correlation_id"]), json={"payload": delivered})

    assert response.status_code == 200
    assert reader.pressed == [
        (ESCALATION["correlation_id"], escalation_id, choice, IDENTITY)
    ]


@pytest.mark.parametrize(
    "payload",
    [
        # Shaped exactly like a delivered payload, and never delivered: the pane
        # refuses on what it stored, not on what parses.
        "esc:d10263341dac:RESUME_EPIC",
        # The right choice on another escalation's id.
        "esc:000000000000:KILL",
        "",
        "KILL",
    ],
)
def test_a_payload_the_factory_did_not_deliver_reaches_no_seam(client, reader, store, payload):
    before = row(store, ESCALATION["correlation_id"])

    response = client.post(answer_url(ESCALATION["correlation_id"]), json={"payload": payload})

    assert response.status_code == 422
    assert response.json() == {"error": "not_delivered"}
    assert reader.pressed == []
    assert reader.settled == []
    assert row(store, ESCALATION["correlation_id"]) == before


def test_a_signal_that_raised_is_recorded_as_signal_failed_and_nothing_else(client, reader):
    """The one ruling the pane derives, because it is the one fact it can observe."""
    reader.signal_raises = RuntimeError("the workflow could not be signalled")
    delivered = ESCALATION["actions"][0]["payload"]

    response = client.post(answer_url(ESCALATION["correlation_id"]), json={"payload": delivered})

    assert response.status_code == 200
    assert response.json() == {"kind": "escalation", "signal": "SIGNAL_FAILED"}

    settlement = item_for(client, ESCALATION["correlation_id"])["settlement"]
    assert settlement["signal"] == "SIGNAL_FAILED"
    # SIGNAL_FAILED means nothing was recorded, so the item keeps its place.
    assert settlement["state"] == "ruled"
    assert settlement["resolution"] is None


# --- US2-S5: at most one settlement call per item is in flight ---------------


async def test_a_second_answer_while_one_is_in_flight_reaches_no_seam(answer_app, reader):
    """One call goes out; the other is refused 409 and the list says why.

    The recorder blocks inside `settle_question`, so the second request arrives
    while the first is genuinely out at the seam rather than merely after it.
    """
    reader.entered = asyncio.Event()
    reader.gate = asyncio.Event()
    correlation_id = QUESTION["correlation_id"]

    transport = httpx.ASGITransport(app=answer_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://pane") as ac:
        first = asyncio.create_task(ac.post(answer_url(correlation_id), json={"text": "first"}))
        await asyncio.wait_for(reader.entered.wait(), timeout=5)

        second = await ac.post(answer_url(correlation_id), json={"text": "second"})
        assert second.status_code == 409
        assert second.json() == {"error": "in_flight"}

        # And a Desk reading the list right now is told the same thing, so a
        # browser that reconnected mid-answer renders it in flight.
        listing = await ac.get("/api/attention")
        blocked = next(
            item
            for item in listing.json()["items"]
            if item["correlation_id"] == correlation_id
        )
        assert blocked["settlement"]["state"] == "in_flight"

        reader.gate.set()
        first_response = await asyncio.wait_for(first, timeout=5)

    assert first_response.status_code == 200
    # One call, carrying the first request's text — the refused one spent nothing.
    assert reader.settled == [(correlation_id, "first", IDENTITY)]


async def test_the_slot_is_released_even_when_the_seam_raised(answer_app, reader):
    """A crashed call leaves nothing in flight, which is the truth (D-P5)."""
    reader.signal_raises = RuntimeError("the workflow could not be signalled")
    delivered = ESCALATION["actions"][0]["payload"]

    transport = httpx.ASGITransport(app=answer_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://pane") as ac:
        first = await ac.post(
            answer_url(ESCALATION["correlation_id"]), json={"payload": delivered}
        )
        second = await ac.post(
            answer_url(ESCALATION["correlation_id"]), json={"payload": delivered}
        )

    assert first.status_code == 200
    # Not 409: the first call is over, however it ended.
    assert second.status_code == 200
    assert len(reader.pressed) == 2


# --- US2-S6: the factory settles; a press or a submit moves nothing ----------


def test_a_resolved_question_leaves_the_waiting_rank_and_only_then(client, reader):
    reader.ruling = "RESOLVED"
    correlation_id = QUESTION["correlation_id"]

    before = item_for(client, correlation_id)
    assert before["settlement"]["state"] == "waiting"

    client.post(answer_url(correlation_id), json={"text": "ship it"})

    items = listed(client)
    settled_at = [i["correlation_id"] for i in items].index(correlation_id)
    assert items[settled_at]["settlement"]["state"] == "settled"

    # It sorts after every item still waiting on the operator.
    waiting_positions = [
        index
        for index, item in enumerate(items)
        if item["settlement"]["state"] in ("waiting", "ruled", "none")
    ]
    assert waiting_positions
    assert settled_at > max(waiting_positions)

    # And it leaves the floor document's section, which is what 002's badge
    # counts as "waiting on you" (D-P15).  Nothing was deleted.
    floor = client.get("/api/floor").json()
    assert correlation_id not in [i["correlation_id"] for i in floor["attention"]["items"]]


def test_any_other_ruling_keeps_the_question_exactly_where_it_was(client, reader):
    reader.ruling = "UNKNOWN"
    correlation_id = QUESTION["correlation_id"]

    before = [item["id"] for item in listed(client)]

    response = client.post(answer_url(correlation_id), json={"text": "is anybody there?"})
    assert response.json()["ruling"] == "UNKNOWN"

    after = listed(client)
    assert [item["id"] for item in after] == before
    assert item_for(client, correlation_id)["settlement"]["state"] == "ruled"
    # Still in the floor document's unsettled section: nothing has settled.
    floor = client.get("/api/floor").json()
    assert correlation_id in [i["correlation_id"] for i in floor["attention"]["items"]]


def test_an_accepted_press_renders_in_flight_until_the_factory_reports_a_resolution(
    client, reader
):
    """A signal returns nothing, so an accepted press is a question, not an answer."""
    correlation_id = ESCALATION["correlation_id"]
    delivered = ESCALATION["actions"][0]["payload"]

    client.post(answer_url(correlation_id), json={"payload": delivered})

    pressed = item_for(client, correlation_id)
    assert pressed["settlement"]["state"] == "in_flight"
    assert pressed["settlement"]["resolution"] is None
    assert pressed["settlement"]["pressed_choice"] == delivered.split(":", 2)[2]
    # Still in the list, and still in the floor document's unsettled section.
    floor = client.get("/api/floor").json()
    assert correlation_id in [i["correlation_id"] for i in floor["attention"]["items"]]

    # Now the factory reports it, through the read 001 already had.
    reader.escalations = [
        {**entry, "resolution": "KILL"} if entry["escalation_id"] == correlation_id else entry
        for entry in reader.escalations
    ]

    settled = item_for(client, correlation_id)
    assert settled["settlement"]["state"] == "settled"
    assert settled["settlement"]["resolution"] == "KILL"


def test_a_press_alone_changes_no_other_item_rank(client, reader):
    """The one thing that moved is the item the factory's read speaks about."""
    before = {item["id"]: item["settlement"]["state"] for item in listed(client)}

    client.post(
        answer_url(ESCALATION["correlation_id"]),
        json={"payload": ESCALATION["actions"][0]["payload"]},
    )

    after = {item["id"]: item["settlement"]["state"] for item in listed(client)}
    moved = {key for key in before if before[key] != after[key]}
    assert moved == {ESCALATION["correlation_id"]}


# --- US2-S7: the empty-answer refusal, which is load-bearing ------------------


@pytest.mark.parametrize("text", ["", "   ", "\n\t", " " * 0 + " \n "])
def test_an_empty_submission_reaches_no_seam_and_changes_no_row(client, reader, store, text):
    """`handle_relay` has no empty-answer guard, so this refusal is the only one.

    Without it `_settle_question` signals the empty string through and parks the
    node on nothing — which is why the assertion is zero seam calls and a
    byte-identical row, not merely a 4xx.
    """
    correlation_id = QUESTION["correlation_id"]
    before = row(store, correlation_id)

    response = client.post(answer_url(correlation_id), json={"text": text})

    assert response.status_code == 422
    assert response.json() == {"error": "empty_answer"}
    assert reader.settled == []
    assert reader.pressed == []
    assert row(store, correlation_id) == before
    assert item_for(client, correlation_id)["settlement"] == {
        "state": "waiting",
        "ruling": None,
        "signal": None,
        "pressed_choice": None,
        "resolution": None,
    }


def test_a_missing_or_non_string_text_is_refused_the_same_way(client, reader, store):
    correlation_id = QUESTION["correlation_id"]
    before = row(store, correlation_id)

    for body in ({}, {"text": None}, {"text": 7}, {"payload": "esc:800ee6b4c7df:KILL"}):
        response = client.post(answer_url(correlation_id), json=body)
        assert response.status_code == 422, body
        assert response.json() == {"error": "empty_answer"}, body

    assert reader.settled == []
    assert row(store, correlation_id) == before


# --- the event the answer publishes ------------------------------------------


def test_one_attention_event_carries_the_updated_item(answer_app, client, reader):
    """The same broadcaster intake publishes on, one event per settled answer."""
    broadcaster = answer_app.state.attention_broadcaster
    queue = broadcaster.subscribe()

    client.post(answer_url(QUESTION["correlation_id"]), json={"text": "ship it"})

    events = []
    while not queue.empty():
        events.append(queue.get_nowait())

    assert len(events) == 1
    (envelope,) = events
    assert envelope["type"] == "attention"
    assert envelope["data"]["correlation_id"] == QUESTION["correlation_id"]
    assert envelope["data"]["settlement"]["ruling"] == "RESOLVED"
