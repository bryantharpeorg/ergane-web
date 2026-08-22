"""US1 scaffold tests: gates, manifests, and the SPA backend."""
from __future__ import annotations

import re
import sys
import tomllib
from pathlib import Path

import pytest
import yaml
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from pane.app import create_app

ROOT = Path(__file__).resolve().parents[1]


# ——— Backend app ———

def test_create_app_returns_fastapi_app():
    app = create_app()
    assert isinstance(app, FastAPI)


@pytest.mark.anyio
async def test_spa_serves_index_when_built(tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("hello pane")

    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("PANE_WEB_DIST", str(dist))
        app = create_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for path in ("/", "/desk"):
            response = await client.get(path)
            assert response.status_code == 200, path
            assert response.text == "hello pane", path


@pytest.mark.anyio
async def test_spa_refuses_directory_escape(tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("safe")

    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("PANE_WEB_DIST", str(dist))
        app = create_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/../pyproject.toml")
        assert response.status_code == 200
        assert response.text == "safe"


@pytest.mark.anyio
async def test_spa_503_when_dist_missing(tmp_path):
    dist = tmp_path / "empty_dist"
    dist.mkdir()

    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("PANE_WEB_DIST", str(dist))
        app = create_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 503
        assert "web/dist" in response.text
        assert "npm --prefix web run build" in response.text


# ——— ergane.yaml gate facts ———

def test_ergane_yaml_schema_v2_and_four_gates():
    text = (ROOT / "ergane.yaml").read_text()
    data = yaml.safe_load(text)
    assert data.get("version") == 2
    gates = data.get("gates", {})
    assert gates == {
        "test": "uv run pytest -q",
        "typecheck": "npm --prefix web run typecheck",
        "unit": "npm --prefix web run test:unit",
        "smoke": "npm --prefix web run test:smoke",
    }


# ——— Frontend manifest facts ———

def test_package_json_typecheck_and_postinstall():
    package = json_load(ROOT / "web" / "package.json")
    assert package["scripts"]["typecheck"] == "tsc --noEmit"
    assert "playwright install chromium" in package["scripts"]["postinstall"]


def test_tsconfig_strict_true():
    tsconfig = json_load(ROOT / "web" / "tsconfig.json")
    assert tsconfig["compilerOptions"]["strict"] is True


def test_playwright_config_headless_true_not_false():
    text = (ROOT / "web" / "playwright.config.ts").read_text()
    assert "headless: true" in text
    assert "headless: false" not in text


# ——— Roster sweep ———

def test_pyproject_dependencies_are_approved():
    with open(ROOT / "pyproject.toml", "rb") as f:
        data = tomllib.load(f)

    deps = data["project"]["dependencies"]
    dev = data["dependency-groups"]["dev"]

    approved = {
        "ergane-cli", "fastapi", "uvicorn", "sse-starlette", "httpx",
        "pytest", "pytest-asyncio",
    }

    for dep in deps + dev:
        name = re.split(r"[\[=<>!~;]", dep)[0].strip()
        assert name in approved, f"{name!r} is not an approved Python dependency"


def test_package_json_dependencies_are_approved():
    package = json_load(ROOT / "web" / "package.json")

    approved = {
        "react", "react-dom",
        "typescript", "vite", "vitest", "@playwright/test",
        "@xyflow/react", "@dagrejs/dagre", "framer-motion",
        "@types/react", "@types/react-dom", "@vitejs/plugin-react", "jsdom",
    }

    for dep in {**package.get("dependencies", {}), **package.get("devDependencies", {})}:
        assert dep in approved, f"{dep!r} is not an approved Node dependency"


# ——— Fonts and README ———

def test_fonts_exist_and_index_links_them():
    for name in (
        "RedHatDisplay.woff2",
        "RedHatText.woff2",
        "RedHatText-italic.woff2",
        "RedHatMono.woff2",
        "fonts.css",
    ):
        assert (ROOT / "web" / "public" / "fonts" / name).is_file(), name

    html = (ROOT / "web" / "index.html").read_text()
    assert 'href="/fonts/fonts.css"' in html
    assert "https://" not in html


def test_readme_documents_setup_and_gates():
    readme = (ROOT / "README.md").read_text()
    commands = [
        "uv sync",
        "npm ci --prefix web",
        "uv run pytest -q",
        "npm --prefix web run typecheck",
        "npm --prefix web run test:unit",
        "npm --prefix web run test:smoke",
    ]
    for command in commands:
        assert command in readme, command


# ——— helpers ———

def json_load(path: Path) -> dict:
    import json

    return json.loads(path.read_text())
