"""US1 scaffold tests: gates exist, run, and each hits at least one committed test."""

import re
from pathlib import Path

import pytest
import tomllib
import yaml
from fastapi import FastAPI

from pane.app import create_app

REPO = Path(__file__).resolve().parents[1]


def test_create_app_returns_fastapi():
    app = create_app()
    assert isinstance(app, FastAPI)


def test_spa_serves_index_and_refuses_escape(tmp_path):
    index = tmp_path / "index.html"
    index.write_text("<html>ok</html>")
    forbidden = tmp_path.parent / "pyproject.toml"
    forbidden.write_text("secret\n")

    import os

    old = os.environ.get("PANE_WEB_DIST")
    os.environ["PANE_WEB_DIST"] = str(tmp_path)
    try:
        from pane.app import create_app as make_app

        app = make_app()
        from fastapi.testclient import TestClient

        client = TestClient(app)
        r = client.get("/")
        assert r.status_code == 200
        assert r.text == "<html>ok</html>"
        r2 = client.get("/desk")
        assert r2.status_code == 200
        assert r2.text == "<html>ok</html>"
        r3 = client.get("/%2e%2e/pyproject.toml")
        assert r3.status_code == 404
    finally:
        if old is None:
            os.environ.pop("PANE_WEB_DIST", None)
        else:
            os.environ["PANE_WEB_DIST"] = old


def test_spa_503_when_dist_missing(tmp_path):
    empty = tmp_path / "empty"
    empty.mkdir()
    import os

    old = os.environ.get("PANE_WEB_DIST")
    os.environ["PANE_WEB_DIST"] = str(empty)
    try:
        from pane.app import create_app as make_app

        app = make_app()
        from fastapi.testclient import TestClient

        client = TestClient(app)
        r = client.get("/")
        assert r.status_code == 503
        assert "web/dist" in r.text
        assert "npm --prefix web run build" in r.text
    finally:
        if old is None:
            os.environ.pop("PANE_WEB_DIST", None)
        else:
            os.environ["PANE_WEB_DIST"] = old


def test_ergane_yaml_schema_and_gate_commands():
    text = (REPO / "ergane.yaml").read_text()
    data = yaml.safe_load(text)
    assert data["version"] == 2
    gates = data["gates"]
    assert gates == {
        "test": "uv run pytest -q",
        "typecheck": "npm --prefix web run typecheck",
        "unit": "npm --prefix web run test:unit",
        "smoke": "npm --prefix web run test:smoke",
    }


def test_package_json_typecheck_and_postinstall():
    pkg = json_load(REPO / "web" / "package.json")
    assert pkg["scripts"]["typecheck"] == "tsc --noEmit"
    assert "playwright install chromium" in pkg["scripts"]["postinstall"]


def test_tsconfig_strict():
    ts = json_load(REPO / "web" / "tsconfig.json")
    assert ts["compilerOptions"]["strict"] is True


def test_playwright_headless_only():
    cfg = (REPO / "web" / "playwright.config.ts").read_text()
    assert "headless: true" in cfg
    assert "headless: false" not in cfg


def test_roster_sweep():
    pyproject = (REPO / "pyproject.toml").read_bytes()
    py = tomllib.loads(pyproject.decode("utf-8"))
    python_deps = {normalize_python(dep) for dep in py["project"]["dependencies"]}
    python_deps |= {
        normalize_python(dep) for dep in py["dependency-groups"]["dev"]
    }
    allowed_python = {
        "ergane-cli",
        "fastapi",
        "uvicorn",
        "sse-starlette",
        "httpx",
        "pytest",
        "pytest-asyncio",
    }
    assert python_deps <= allowed_python, python_deps

    pkg = json_load(REPO / "web" / "package.json")
    node_deps = set(pkg.get("dependencies", {}).keys())
    node_deps |= set(pkg.get("devDependencies", {}).keys())
    allowed_node = {
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
    assert node_deps <= allowed_node, node_deps


def test_fonts_and_index_are_vendored():
    fonts_dir = REPO / "web" / "public" / "fonts"
    for name in [
        "RedHatDisplay.woff2",
        "RedHatText.woff2",
        "RedHatText-italic.woff2",
        "RedHatMono.woff2",
        "fonts.css",
    ]:
        assert (fonts_dir / name).is_file(), name
    index = (REPO / "web" / "index.html").read_text()
    assert 'href="/fonts/fonts.css"' in index
    assert "https://" not in index


def test_readme_has_commands():
    readme = (REPO / "README.md").read_text()
    for cmd in [
        "uv sync",
        "npm ci --prefix web",
        "uv run pytest -q",
        "npm --prefix web run typecheck",
        "npm --prefix web run test:unit",
        "npm --prefix web run test:smoke",
    ]:
        assert cmd in readme, cmd


# Helpers


def json_load(path: Path) -> dict:
    import json

    return json.loads(path.read_text())


def normalize_python(spec: str) -> str:
    return re.split(r"[ <>=!~;\[\]\(]|==|!=|~>|>=|<=", spec, maxsplit=1)[0].strip()
