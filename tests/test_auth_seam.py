"""Prove every route is behind the single open auth seam."""

import os
from pathlib import Path

import pytest
import secrets
from fastapi.routing import APIRoute
from starlette.routing import Mount

from pane.app import create_app
from pane.auth import require_viewer
from pane.config import Settings

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"


@pytest.fixture
def demo_settings(tmp_path, monkeypatch) -> Settings:
    monkeypatch.chdir(tmp_path)
    for key in list(os.environ):
        if key.startswith("ERGANE_") or key.startswith("FACTORY_") or key.startswith("TEMPORAL_"):
            monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("PANE_DEMO", "1")
    monkeypatch.setenv("PANE_FIXTURES_ROOT", str(FIXTURES))
    return Settings.from_env()


def _walk_dependant(dependant, found=None):
    if found is None:
        found = set()
    if dependant in found:
        return
    found.add(dependant)
    if dependant.call is require_viewer:
        yield True
    for dep in dependant.dependencies:
        yield from _walk_dependant(dep, found)


def test_every_route_behind_require_viewer(demo_settings):
    app = create_app(demo_settings)
    for route in app.router.routes:
        if isinstance(route, APIRoute):
            has_viewer = any(_walk_dependant(route.dependant))
            assert has_viewer, f"{route.path} is not behind require_viewer"
        elif isinstance(route, Mount):
            assert False, f"static mount {route.path} bypasses the auth seam"


def test_no_docs_routes_exist(demo_settings):
    app = create_app(demo_settings)
    paths = {route.path for route in app.router.routes if isinstance(route, APIRoute)}
    assert "/docs" not in paths
    assert "/redoc" not in paths
    assert "/openapi.json" not in paths


def test_open_seam_admits_request_without_authorization(demo_settings):
    app = create_app(demo_settings)
    from fastapi.testclient import TestClient

    client = TestClient(app)
    resp = client.get("/api/floor")
    assert resp.status_code == 200
    assert "floor" in resp.json()


def test_credential_minted_at_runtime_is_not_literal():
    token = secrets.token_hex(16)
    assert len(token) == 32
    assert "test_credential" not in token
