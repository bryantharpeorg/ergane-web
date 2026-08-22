import os
from pathlib import Path

import pytest
import tomllib
import yaml
from fastapi import FastAPI
from fastapi.testclient import TestClient

from pane.app import create_app


def test_create_app_returns_fastapi():
    app = create_app()
    assert isinstance(app, FastAPI)


def test_spa_serves_index_html(tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html>desk</html>")
    os.environ["PANE_WEB_DIST"] = str(dist)
    client = TestClient(create_app())
    for path in ("/", "/desk"):
        resp = client.get(path)
        assert resp.status_code == 200
        assert resp.text == "<html>desk</html>"


def test_spa_rejects_escape(tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html>desk</html>")
    # Write a file outside dist so escape would be detectable if allowed
    (tmp_path / "secret.txt").write_text("secret")
    os.environ["PANE_WEB_DIST"] = str(dist)
    app = create_app()

    async def run_request():
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/../secret.txt",
            "raw_path": b"/../secret.txt",
            "query_string": b"",
            "headers": [(b"host", b"testserver")],
            "server": ("testserver", 80),
            "client": None,
            "scheme": "http",
            "root_path": "",
            "state": {},
            "app": app,
        }
        events = []

        async def receive():
            return {"type": "http.request", "body": b""}

        async def send(message):
            events.append(message)

        await app(scope, receive, send)
        return events

    import asyncio

    events = asyncio.run(run_request())
    start = events[0]
    assert start["status"] in (404, 403)


def test_spa_unbuilt_returns_503(tmp_path):
    empty = tmp_path / "empty"
    empty.mkdir()
    os.environ["PANE_WEB_DIST"] = str(empty)
    client = TestClient(create_app())
    resp = client.get("/")
    assert resp.status_code == 503
    assert "web/dist" in resp.text
    assert "npm --prefix web run build" in resp.text
