"""Prove every route is behind the single auth seam, and that the seam is shut.

2026-08-23: spec 003 US4 closes 001's dated open interim.  The structural rules
below are exactly as 001 landed them — every route's `dependant` tree contains
`pane.auth.require_viewer`, there is no `Mount` beside them and no `/docs` — and
the one assertion that pinned the interim open now pins it closed.
"""

import os
from pathlib import Path

import pytest
import secrets
from starlette.routing import Mount
from support import registered_api_routes, routes_with_enclosing_dependencies

from pane.app import create_app
from pane.auth import require_viewer
from pane.config import Settings

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"


@pytest.fixture
def demo_settings(tmp_path, monkeypatch, credentials) -> Settings:
    monkeypatch.chdir(tmp_path)
    for key in list(os.environ):
        if key.startswith("ERGANE_") or key.startswith("FACTORY_") or key.startswith("TEMPORAL_"):
            monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("PANE_DEMO", "1")
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(FIXTURES))
    return Settings.from_env()


def test_every_route_behind_require_viewer(demo_settings):
    """The rule 001 landed, over routes the walk actually reaches.

    Spec 003 US4 changed the walk, not the rule. FastAPI ≥ 0.141 keeps an
    included router's routes behind a wrapper rather than on
    `app.router.routes`, so reading only the top level found no `APIRoute` at
    all and this assertion passed over an empty list; and it applies an
    enclosing router's `dependencies` at dispatch rather than baking them into a
    sub-router's `dependant`, so reading only the dependant tree called
    `pane/intake.py`'s and `pane/answer.py`'s routes unguarded when they are not.
    `routes_with_enclosing_dependencies` reads both places. What is asserted is
    still exactly what 001 asserted: every route is behind `require_viewer`, and
    no `Mount` sits beside them.
    """
    app = create_app(demo_settings)
    guarded = routes_with_enclosing_dependencies(app)
    assert guarded, "no route was enumerated; the rule below would be vacuous"

    for route, dependencies in guarded:
        assert require_viewer in dependencies, f"{route.path} is not behind require_viewer"

    for route in app.router.routes:
        assert not isinstance(route, Mount), f"static mount {route.path} bypasses the auth seam"


def test_no_docs_routes_exist(demo_settings):
    app = create_app(demo_settings)
    paths = {route.path for route in registered_api_routes(app)}
    assert "/docs" not in paths
    assert "/redoc" not in paths
    assert "/openapi.json" not in paths


def test_the_closed_seam_refuses_a_request_without_authorization(demo_settings):
    """001's interim admitted everyone; US4's gate admits no one without the token.

    This is the same request 001 asserted was `200` — `GET /api/floor` with no
    `Authorization` header — and the whole of the change is in what it answers.
    """
    app = create_app(demo_settings)
    from fastapi.testclient import TestClient

    client = TestClient(app)
    resp = client.get("/api/floor")
    assert resp.status_code == 401
    assert resp.content == b'{"error":"unauthorized"}'
    assert resp.headers["WWW-Authenticate"] == 'Basic realm="ergane pane", Bearer'
    # Nothing of the floor rode out with the refusal.
    assert "floor" not in resp.text


def test_the_same_seam_admits_the_configured_token(demo_settings, auth_headers):
    """And the gate is a gate, not a wall: the token opens it (SC-006's premise)."""
    app = create_app(demo_settings)
    from fastapi.testclient import TestClient

    client = TestClient(app, headers=auth_headers)
    resp = client.get("/api/floor")
    assert resp.status_code == 200
    assert "floor" in resp.json()


def test_credential_minted_at_runtime_is_not_literal():
    token = secrets.token_hex(16)
    assert len(token) == 32
    assert "test_credential" not in token
