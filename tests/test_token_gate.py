"""One gate in front, the factory's ruling behind (spec 003 US4).

**Every credential in this file is minted at run time and never typed.** The good
token and intake credential come from `tests/conftest.py`'s `secrets.token_hex(16)`
values; every wrong one is a second `secrets.token_hex(16)` asserted unequal to
the good one; and every header is built with an f-string, so what this committed
file actually holds after `Bearer ` is `{token}` or `{wrong}`. A literal here is
exactly what `tests/test_credential_sweep.py` exists to catch, and a test file
that planted one would make its sibling fail.
"""

import base64
import json
import re
import secrets
import tokenize
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from support import registered_api_routes

from pane.app import create_app
from pane.auth import REFUSAL_BODY, REFUSAL_CHALLENGE_HEADER
from pane.config import Settings

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"
PANE = ROOT / "pane"

#: A syntactically valid stand-in for any path parameter: 12 hex is a well-formed
#: correlation id, a well-formed (and, at 12 characters, necessarily wrong) intake
#: credential, and a well-formed SPA path segment.
VALID_SEGMENT = "a1b2c3d4e5f6"

#: Substitutes `{name}` and `{name:converter}` alike.
PATH_PARAM = re.compile(r"\{[^}]+\}")


def delivery(name: str) -> dict:
    """One recorded webhook payload, as the factory sent it."""
    return json.loads((FIXTURES / "webhook" / name).read_text())


def concrete(path: str) -> str:
    return PATH_PARAM.sub(VALID_SEGMENT, path)


def assert_is_the_refusal(response) -> None:
    """The one shape, asserted the one way, wherever a refusal is expected."""
    assert response.status_code == 401
    assert response.content == REFUSAL_BODY
    assert response.headers["WWW-Authenticate"] == REFUSAL_CHALLENGE_HEADER
    assert response.headers["content-type"] == "application/json"


@pytest.fixture
def wrong(token, intake_credential) -> str:
    """A second minted value, proven to be neither configured credential."""
    value = secrets.token_hex(16)
    assert value != token
    assert value != intake_credential
    return value


@pytest.fixture
def gated_app(tmp_path, monkeypatch, credentials):
    """The demo app with both credentials configured and a store under tmp_path."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PANE_DEMO", "1")
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(FIXTURES))
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    return create_app(Settings.from_env())


def stored_count(app) -> int:
    return app.state.attention_store.execute("SELECT COUNT(*) FROM attention").fetchone()[0]


# --- T062 / US4-S1: every registered route, enumerated from the app ----------


def test_every_registered_route_refuses_without_the_token(gated_app):
    """The list comes from the application object; a hand-kept one ships a hole.

    Enumeration is the whole assertion here, so it is also asserted *about*: a
    walk that silently found nothing would let this test pass while the pane
    served every route open.
    """
    routes = registered_api_routes(gated_app)
    paths = {route.path for route in routes}

    # Non-vacuous, and specifically so: these are the routes 001, US1 and US2
    # mounted, and the walk must have reached all of them before the loop below
    # means anything.
    assert paths >= {
        "/api/floor",
        "/api/attention",
        "/api/events",
        "/api/attention/{correlation_id}/answer",
        "/intake/{credential:path}",
        "/{path:path}",
    }

    client = TestClient(gated_app)
    checked = 0
    for route in routes:
        for method in sorted(m for m in route.methods if m not in ("HEAD", "OPTIONS")):
            response = client.request(method, concrete(route.path))
            assert_is_the_refusal(response)
            checked += 1
    assert checked >= len(paths)


def test_the_stream_refuses_before_it_yields_an_event(gated_app):
    """`GET /api/events` is refused at the gate, so no event is ever produced."""
    client = TestClient(gated_app)
    with client.stream("GET", "/api/events") as response:
        assert response.status_code == 401
        body = b"".join(response.iter_bytes())
    assert body == REFUSAL_BODY
    assert b"data:" not in body
    assert response.headers["WWW-Authenticate"] == REFUSAL_CHALLENGE_HEADER


def test_the_spa_catchall_refuses_with_the_same_shape(gated_app):
    """001 mounted the shell itself behind the seam, so the shell refuses too."""
    client = TestClient(gated_app)
    for path in ("/", "/desk", "/showfloor", "/assets/index.js"):
        assert_is_the_refusal(client.get(path))


def test_intake_with_a_wrong_credential_refuses_and_stores_nothing(gated_app, wrong):
    """The one enumerated exception is an exception to *which* credential, not to being guarded."""
    client = TestClient(gated_app)
    before = stored_count(gated_app)

    response = client.post(f"/intake/{wrong}", json=delivery("question.json"))

    assert_is_the_refusal(response)
    assert stored_count(gated_app) == before


# --- T063 / US4-S2: the refusal is one shape, byte-identical -----------------


def basic(username: str, secret: str) -> dict[str, str]:
    """`Basic base64(user:secret)`, encoded at run time from a minted value."""
    encoded = base64.b64encode(f"{username}:{secret}".encode()).decode()
    return {"Authorization": f"Basic {encoded}"}


def test_wrong_and_missing_credentials_are_byte_identical(gated_app, wrong):
    client = TestClient(gated_app)

    for path in ("/api/floor", "/api/attention", "/api/events"):
        responses = [
            client.get(path, headers={"Authorization": f"Bearer {wrong}"}),
            client.get(path, headers=basic("pane", wrong)),
            client.get(path),
        ]
        shapes = {
            (
                response.status_code,
                response.headers["WWW-Authenticate"],
                response.headers["content-type"],
                response.content,
            )
            for response in responses
        }
        assert len(shapes) == 1, f"{path} refuses three ways in more than one shape"
        for response in responses:
            assert_is_the_refusal(response)


def test_the_refusal_body_carries_nothing_at_all(gated_app, wrong, token, intake_credential):
    """No route name, no floor data, no credential echo, no correlation id."""
    client = TestClient(gated_app)
    body = client.get("/api/floor", headers={"Authorization": f"Bearer {wrong}"}).text

    assert body == '{"error":"unauthorized"}'

    for route in registered_api_routes(gated_app):
        # `/{path:path}` is the catch-all; its literal prefix is "/" and every
        # body contains no "/" at all, which the equality above already fixes.
        assert route.path not in body

    assert token not in body
    assert intake_credential not in body
    assert wrong not in body
    assert "floor" not in body

    # And no correlation id the demo floor was seeded with rides out either.
    for name in ("question.json", "escalation.json", "notice-supervision.json"):
        assert delivery(name)["correlation_id"] not in body


def test_basic_with_any_username_is_admitted_exactly_as_bearer_is(gated_app, token):
    """The browser's prompt has a username field the seam has no use for."""
    client = TestClient(gated_app)

    bearer = client.get("/api/floor", headers={"Authorization": f"Bearer {token}"})
    for username in ("pane", "anything", "operator"):
        as_basic = client.get("/api/floor", headers=basic(username, token))
        assert as_basic.status_code == 200 == bearer.status_code
        assert as_basic.json().keys() == bearer.json().keys()


# --- T064 / US4-S3: the intake credential, and only it, opens intake ---------


def test_the_configured_credential_admits_a_bare_post(gated_app, intake_credential):
    """The factory sends no header at all; the URL is the whole of its credential."""
    client = TestClient(gated_app)
    before = stored_count(gated_app)

    response = client.post(f"/intake/{intake_credential}", json=delivery("question.json"))

    assert 200 <= response.status_code < 300, response.text
    assert stored_count(gated_app) == before + 1


def test_intake_without_the_credential_is_refused_and_stores_nothing(gated_app, token):
    """A token is not an intake credential, and neither is nothing."""
    client = TestClient(gated_app)
    before = stored_count(gated_app)
    payload = delivery("question.json")

    for path in ("/intake/not-the-credential", "/intake/"):
        response = client.post(path, json=payload, headers={"Authorization": f"Bearer {token}"})
        assert_is_the_refusal(response)
        assert stored_count(gated_app) == before, f"{path} stored something"


def test_with_no_credential_configured_intake_is_closed_and_says_so(
    tmp_path, monkeypatch, credentials, caplog
):
    """Unset means closed — every POST refused, and one line at startup saying it."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PANE_DEMO", "1")
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(FIXTURES))
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    monkeypatch.delenv("PANE_INTAKE_CREDENTIAL", raising=False)

    with caplog.at_level("WARNING", logger="pane"):
        app = create_app(Settings.from_env())

    assert "intake closed: PANE_INTAKE_CREDENTIAL is not set" in caplog.text

    client = TestClient(app)
    payload = delivery("question.json")
    for path in ("/intake/", "/intake/anything", f"/intake/{secrets.token_hex(16)}"):
        assert_is_the_refusal(client.post(path, json=payload))
        assert stored_count(app) == 0


# --- T065 / US4-S4: the factory's UNAUTHORIZED, rendered unsoftened ----------


class IdentityRecordingReader:
    """The demo reader, with the identity each settlement seam was handed kept."""

    def __init__(self, inner) -> None:
        self._inner = inner
        self.identities: list[str] = []

    def __getattr__(self, name):
        return getattr(self._inner, name)

    async def settle_question(self, correlation_id: str, text: str, identity: str) -> str:
        self.identities.append(identity)
        return await self._inner.settle_question(correlation_id, text, identity)

    async def press_escalation(
        self, correlation_id: str, escalation_id: str, choice: str, identity: str
    ) -> None:
        self.identities.append(identity)
        return await self._inner.press_escalation(correlation_id, escalation_id, choice, identity)


def test_the_factory_unauthorized_ruling_renders_verbatim(
    tmp_path, monkeypatch, credentials, auth_headers, answer_identity
):
    """A valid token, an identity no `authorized_responders` list holds.

    The token let the operator *see*; the factory decided their answer did not
    *count* and said so in one word. The pane carries that word back and softens
    nothing — the ruling is the `outcome` key of `fixtures/bridge/UNAUTHORIZED.json`,
    one of the five the operator recorded from a real `handle_relay` (FR-018).
    """
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PANE_DEMO", "1")
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(FIXTURES))
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    monkeypatch.setenv("PANE_DEMO_RULING", "UNAUTHORIZED")

    from pane.fixture_floor import FixtureReader

    recorder = IdentityRecordingReader(
        FixtureReader(
            FIXTURES,
            transport_fail=frozenset(),
            attention_db=tmp_path / "attention.db",
            demo_ruling="UNAUTHORIZED",
        )
    )
    monkeypatch.setattr("pane.app._make_reader", lambda _settings: recorder)

    app = create_app(Settings.from_env())
    client = TestClient(app, headers=auth_headers)

    correlation_id = delivery("question.json")["correlation_id"]
    # The demo floor seeds its store through the seam on the first read, exactly
    # as a Desk opening the page does.
    assert client.get("/api/attention").status_code == 200

    response = client.post(
        f"/api/attention/{correlation_id}/answer",
        json={"text": "an answer from an identity the factory does not know"},
    )

    recorded_outcome = json.loads((FIXTURES / "bridge" / "UNAUTHORIZED.json").read_text())["outcome"]
    assert response.status_code == 200
    assert response.json() == {"kind": "question", "ruling": recorded_outcome}
    assert response.json()["ruling"] == "UNAUTHORIZED"

    # The identity went to the seam exactly as configured — not normalised, not
    # checked, not replaced (FR-016).
    assert recorder.identities == [answer_identity]

    # And it is on the item, still in the factory's word.
    item = next(
        entry
        for entry in client.get("/api/attention").json()["items"]
        if entry["correlation_id"] == correlation_id
    )
    assert item["settlement"]["ruling"] == "UNAUTHORIZED"


def test_no_pane_module_runs_a_responder_check(gated_app):
    """`authorized_responders` appears in no executable line under `pane/`.

    Comments and docstrings may name the factory's check — the pane's job is to
    explain the boundary it does not cross — but a *reference* to it would be the
    second source of truth D-001 forbids. The distinction is drawn with the
    tokenizer rather than by eye.
    """
    del gated_app

    offenders: list[str] = []
    for path in sorted(PANE.rglob("*.py")):
        with path.open("rb") as handle:
            for token_info in tokenize.tokenize(handle.readline):
                if token_info.type in (tokenize.COMMENT, tokenize.STRING):
                    continue
                if "authorized_responders" in token_info.string:
                    offenders.append(f"{path}:{token_info.start[0]}")
    assert not offenders, "\n".join(offenders)
