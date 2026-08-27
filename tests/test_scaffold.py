import os
from pathlib import Path

import pytest
import tomllib
import yaml
from fastapi import FastAPI
from fastapi.testclient import TestClient

from pane.app import create_app


@pytest.fixture(autouse=True)
def scratch_delivery_store(monkeypatch, tmp_path):
    """`create_app()` with no settings opens a store; put it in scratch (009 US3).

    Every test below builds the application the way a deployment does, from the
    environment — and with `PANE_ATTENTION_DB` unset that resolves to
    `.pane/attention.db` *beside the working directory*, so running this file
    wrote a store into the repository and read it back on the next run.  The
    worktree does not carry that file into the gate, which is what made a green
    run here and a green run on the boundary two different facts.
    """
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))


def test_create_app_returns_fastapi():
    app = create_app()
    assert isinstance(app, FastAPI)


def test_spa_serves_index_html(tmp_path, auth_headers):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html>desk</html>")
    os.environ["PANE_WEB_DIST"] = str(dist)
    # Spec 003 US4 (T056): 001 mounted the catch-all behind the same dependency
    # as every API route, so the shell itself now needs the token.  `auth_headers`
    # is built from the value `tests/conftest.py` mints per run.
    client = TestClient(create_app(), headers=auth_headers)
    for path in ("/", "/desk"):
        resp = client.get(path)
        assert resp.status_code == 200
        assert resp.text == "<html>desk</html>"


def test_spa_rejects_escape(tmp_path, auth_headers):
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
            "headers": [
                (b"host", b"testserver"),
                (b"authorization", auth_headers["Authorization"].encode("ascii")),
            ],
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


def test_spa_unbuilt_returns_503(tmp_path, auth_headers):
    empty = tmp_path / "empty"
    empty.mkdir()
    os.environ["PANE_WEB_DIST"] = str(empty)
    client = TestClient(create_app(), headers=auth_headers)
    resp = client.get("/")
    assert resp.status_code == 503
    assert "web/dist" in resp.text
    assert "npm --prefix web run build" in resp.text


def test_ergane_yaml_gates():
    root = Path(__file__).resolve().parents[1]
    with open(root / "ergane.yaml", "rb") as f:
        cfg = yaml.safe_load(f)
    assert cfg["version"] == 2
    gates = cfg["gates"]
    # 015 US1: the `test` gate carries the coverage flags now.  The floor is
    # deliberately NOT among them -- `tests/test_the_gates_measure_themselves.py`
    # is where that is asserted, and why.
    assert gates["test"] == (
        "uv run pytest -q --cov=pane --cov-report=term-missing --cov-report=xml"
    )
    assert gates["typecheck"] == "npm --prefix web run typecheck"
    assert gates["unit"] == "npm --prefix web run test:unit"
    assert gates["smoke"] == "npm --prefix web run test:smoke"


def test_package_json_scripts_and_headless():
    root = Path(__file__).resolve().parents[1]
    pkg = json_load(root / "web" / "package.json")
    assert pkg["scripts"]["typecheck"] == "tsc --noEmit"
    assert "playwright install chromium" in pkg["scripts"]["postinstall"]

    pw_source = (root / "web" / "playwright.config.ts").read_text()
    assert "headless: true" in pw_source
    assert "headless: false" not in pw_source


def test_tsconfig_strict():
    root = Path(__file__).resolve().parents[1]
    tsconfig = json_load(root / "web" / "tsconfig.json")
    assert tsconfig["compilerOptions"]["strict"] is True


def test_dependency_roster():
    root = Path(__file__).resolve().parents[1]
    with open(root / "pyproject.toml", "rb") as f:
        pyproject = tomllib.load(f)
    py_deps = set(pyproject["project"]["dependencies"])
    py_dev = set(pyproject["dependency-groups"]["dev"])
    for dep in py_deps | py_dev:
        name = dep.split("[")[0].split("==")[0].split(">=")[0].split("<")[0].strip()
        assert name in APPROVED_PYTHON

    pkg = json_load(root / "web" / "package.json")
    node_deps = set(pkg.get("dependencies", {}).keys())
    node_dev = set(pkg.get("devDependencies", {}).keys())
    for dep in node_deps | node_dev:
        assert dep in APPROVED_NODE


def test_index_html_loads_no_font_file():
    """005 US2 (FR-007): the page fetches no font file and nothing remote.

    This assertion is the inverse of the one 001 committed here, and the
    inversion is the design's: D-015 replaced DESIGN.md's content on 2026-08-24,
    and § Typography of the second world is system stacks only -- "nothing
    downloads", "no remote stylesheet, ever".  The vendored faces may stay in the
    tree as history (the document says so), so their files are still asserted
    present; what may not survive is the link that loaded them.
    """
    root = Path(__file__).resolve().parents[1]
    fonts_dir = root / "web" / "public" / "fonts"
    for name in (
        "RedHatDisplay.woff2",
        "RedHatText.woff2",
        "RedHatText-italic.woff2",
        "RedHatMono.woff2",
        "fonts.css",
    ):
        assert (fonts_dir / name).is_file()

    index_html = (root / "web" / "index.html").read_text()
    assert 'href="/fonts/' not in index_html
    assert "stylesheet" not in index_html
    assert "https://" not in index_html


def test_readme_commands():
    root = Path(__file__).resolve().parents[1]
    readme = (root / "README.md").read_text()
    commands = [
        "uv sync",
        "npm ci --prefix web",
        "uv run pytest -q",
        "npm --prefix web run typecheck",
        "npm --prefix web run test:unit",
        "npm --prefix web run test:smoke",
    ]
    for cmd in commands:
        assert cmd in readme


APPROVED_PYTHON = {
    "ergane-cli",
    "fastapi",
    "uvicorn",
    "sse-starlette",
    "httpx",
    "pytest",
    "pytest-asyncio",
    # 015 US1 (T001): approved by the operator's flip of spec 015 to `ready`,
    # which names `pytest-cov`, `@vitest/coverage-v8` and `pip-audit` and
    # "nothing else" (constitution VII).  The other two are US2's and US3's to
    # add, in their own diffs, beside the gate that needs them.
    "pytest-cov",
}

APPROVED_NODE = {
    "react",
    "react-dom",
    "typescript",
    "vite",
    "@xyflow/react",
    "@dagrejs/dagre",
    "framer-motion",
    "vitest",
    "@playwright/test",
    "@types/react",
    "@types/react-dom",
    "@vitejs/plugin-react",
    "jsdom",
}


def json_load(path: Path):
    import json

    return json.loads(path.read_text())
