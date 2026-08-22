"""Scaffold facts: the two package worlds, the four gates, the roster, and the README."""

import json
import os
from pathlib import Path

import tomllib
from fastapi import FastAPI
from fastapi.testclient import TestClient

from pane.app import create_app

REPO_ROOT = Path(__file__).resolve().parent.parent


def test_create_app_returns_fastapi():
    app = create_app()
    assert isinstance(app, FastAPI)


def test_spa_serves_index_and_blocks_escape(tmp_path):
    (tmp_path / "index.html").write_text("<!DOCTYPE html><html></html>")
    (tmp_path.parent / "secret.txt").write_text("secret")
    os.environ["PANE_WEB_DIST"] = str(tmp_path)
    try:
        app = create_app()
        client = TestClient(app)
        for path in ("/", "/desk", "/desk/attention"):
            resp = client.get(path)
            assert resp.status_code == 200, path
            assert "<!DOCTYPE html>" in resp.text, path
        resp = client.get("/%2e%2e/secret.txt")
        assert resp.status_code == 503
        assert "secret" not in resp.text
    finally:
        del os.environ["PANE_WEB_DIST"]
        (tmp_path.parent / "secret.txt").unlink(missing_ok=True)


def test_spa_503_when_dist_missing(tmp_path):
    empty = tmp_path / "empty"
    empty.mkdir()
    os.environ["PANE_WEB_DIST"] = str(empty)
    try:
        app = create_app()
        client = TestClient(app)
        resp = client.get("/")
        assert resp.status_code == 503
        assert "web/dist is not built" in resp.text
        assert "npm --prefix web run build" in resp.text
    finally:
        del os.environ["PANE_WEB_DIST"]


# ——— gate facts ———


def test_ergane_yaml_gates():
    text = (REPO_ROOT / "ergane.yaml").read_text()
    assert "version: 2" in text
    gates_block = text.split("gates:")[1]
    gate_lines = []
    for ln in gates_block.splitlines():
        if not ln.strip() or ln.strip().startswith("#"):
            continue
        if not ln.startswith("  "):
            break
        gate_lines.append(ln)
    commands = [ln.split(":", 1)[1].strip().strip('"') for ln in gate_lines]
    assert commands == [
        "uv run pytest -q",
        "npm --prefix web run typecheck",
        "npm --prefix web run test:unit",
        "npm --prefix web run test:smoke",
    ]


def test_package_scripts_and_postinstall():
    pkg = json.loads((REPO_ROOT / "web" / "package.json").read_text())
    assert pkg["scripts"]["typecheck"] == "tsc --noEmit"
    assert "playwright install chromium" in pkg["scripts"]["postinstall"]


def test_tsconfig_is_strict():
    cfg = json.loads((REPO_ROOT / "web" / "tsconfig.json").read_text())
    assert cfg["compilerOptions"]["strict"] is True


def test_playwright_is_headless():
    cfg = (REPO_ROOT / "web" / "playwright.config.ts").read_text()
    assert "headless: true" in cfg
    assert "headless: false" not in cfg


# ——— dependency roster ———


def test_dependency_roster_only():
    py_approved = {
        "ergane-cli",
        "fastapi",
        "uvicorn",
        "sse-starlette",
        "httpx",
        "pytest",
        "pytest-asyncio",
    }
    node_approved = {
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

    with open(REPO_ROOT / "pyproject.toml", "rb") as f:
        py = tomllib.load(f)

    def _normalize(dep: str) -> str:
        # Strip version specifiers and PEP 508 extras/whitespace.
        name = dep.split("==")[0].split(">=")[0].split("<")[0].split("~=")[0]
        return name.strip().split("[")[0].strip().lower()

    py_deps = {_normalize(name) for name in py["project"]["dependencies"]}
    py_dev = {_normalize(name) for name in py["dependency-groups"]["dev"]}
    for dep in py_deps | py_dev:
        assert dep in py_approved, dep

    pkg = json.loads((REPO_ROOT / "web" / "package.json").read_text())
    node_deps = set(pkg.get("dependencies", {}))
    node_dev = set(pkg.get("devDependencies", {}))
    for dep in node_deps | node_dev:
        assert dep in node_approved, dep


# ——— README and assets ———


def test_readme_documents_commands_verbatim():
    readme = (REPO_ROOT / "README.md").read_text()
    commands = [
        "uv sync",
        "npm ci --prefix web",
        "uv run pytest -q",
        "npm --prefix web run typecheck",
        "npm --prefix web run test:unit",
        "npm --prefix web run test:smoke",
        "npm --prefix web run build",
        "PANE_DEMO=1 uv run uvicorn pane.app:app --port 8787",
    ]
    for cmd in commands:
        assert cmd in readme, cmd


def test_fonts_self_hosted_and_linked():
    fonts_dir = REPO_ROOT / "web" / "public" / "fonts"
    for name in (
        "RedHatDisplay.woff2",
        "RedHatText.woff2",
        "RedHatText-italic.woff2",
        "RedHatMono.woff2",
        "fonts.css",
    ):
        assert (fonts_dir / name).exists(), name

    html = (REPO_ROOT / "web" / "index.html").read_text()
    assert 'href="/fonts/fonts.css"' in html
    assert "https://" not in html
