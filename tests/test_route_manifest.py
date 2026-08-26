"""The route manifest, and the test that keeps it from rotting (011 US1).

FR-005 is a requirement rather than a nicety for one reason: a manifest that
can go stale in silence is worth nothing, and the review room's whole job is to
say which screens a landing commit reaches.  So the manifest is not trusted —
it is checked, here, against the application itself.

**What is asserted, and against what.**  Every API route the FastAPI app
registers is read off the app object with `support.registered_api_routes`, never
off a list kept by hand in this file: a route added to `pane/app.py` and not to
`route-manifest.json` fails this suite, which is the only thing that makes the
manifest's claim true rather than hoped.  The room half of the same guarantee is
`web/tests/unit/routeManifest.test.ts`, which reads the paths `web/src/routes.ts`
exports — the two halves together cover every route the pane serves, because the
rooms are served by the one catch-all this file also requires to be listed.

FR-003's other half is asserted here too: a source path no pattern matches
resolves to *no known route* and is never dropped, and that is a different
answer from a path a pattern deliberately maps to nothing.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from support import registered_api_routes

from pane.review import DEFAULT_MANIFEST_PATH, RouteManifest

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def manifest() -> RouteManifest:
    return RouteManifest.load()


# --- FR-005: the manifest cannot silently rot ------------------------------


def test_every_api_route_the_application_serves_is_in_the_manifest(app, manifest):
    """The one assertion FR-005 names, read off the app and not off a list."""
    served = {route.path for route in registered_api_routes(app)}
    # A sweep over nothing passes vacuously; the app really does mount routes.
    assert len(served) > 5

    listed = set(manifest.route_paths())
    missing = sorted(served - listed)
    assert not missing, (
        f"{DEFAULT_MANIFEST_PATH.name} does not list {missing}; a route the "
        "application serves and the manifest does not name is the rot FR-005 exists to stop"
    )


def test_the_manifest_names_no_route_the_application_does_not_serve(app, manifest):
    """The other direction: a listed API route is one the app really answers.

    The room paths are exempt because the guarded catch-all serves them all —
    they are listed by `web/src/routes.ts` and checked by the vitest half.
    """
    served = {route.path for route in registered_api_routes(app)}
    for route in manifest.routes:
        if route.kind in {"api", "shell"}:
            assert route.path in served, f"the manifest lists {route.path}, which nothing serves"


def test_every_route_a_pattern_names_is_a_declared_route(manifest):
    declared = set(manifest.route_paths())
    for pattern in manifest.patterns:
        for route in pattern.routes:
            assert route in declared, f"pattern {pattern.pattern!r} names undeclared route {route!r}"


def test_the_committed_manifest_covers_the_backend_and_the_room_sources(manifest):
    """Every source file of the two package worlds matches some pattern.

    Not a requirement of FR-003 — an unmatched file is a legible answer, not an
    error — but it is what keeps *today's* manifest honest, and it turns red the
    moment a module is added without a line saying where it can be seen.
    """
    unmatched = [
        str(path.relative_to(ROOT))
        for directory, suffixes in ((ROOT / "pane", {".py"}), (ROOT / "web" / "src", {".ts", ".tsx", ".css"}))
        for path in sorted(directory.rglob("*"))
        if path.is_file() and path.suffix in suffixes
        if not manifest.resolve(str(path.relative_to(ROOT))).matched
    ]
    assert not unmatched, f"no pattern names where these can be seen: {unmatched}"


# --- FR-003: a file names its routes, and a miss is still an answer --------


def test_a_changed_file_names_the_routes_it_reaches(manifest):
    resolved = manifest.resolve("web/src/desk/AttentionStrip.tsx")
    assert resolved.matched is True
    assert resolved.routes == ("/", "/desk")


def test_a_pattern_may_cross_directories(manifest):
    assert manifest.resolve("web/src/showfloor/wires/Wires.tsx").routes == ("/showfloor",)


def test_routes_come_back_in_manifest_order_and_without_repetition(manifest):
    resolved = manifest.resolve("pane/showfloor.py")
    assert resolved.routes == ("/", "/desk", "/showfloor", "/api/showfloor", "/api/events")


def test_a_file_matching_no_pattern_reads_as_reaching_no_known_route(manifest):
    """FR-003's second clause: never dropped, and never silently a hit."""
    resolved = manifest.resolve("pane/a_module_nobody_has_written_yet.py")
    assert resolved.matched is False
    assert resolved.routes == ()


def test_a_file_a_pattern_maps_to_nothing_is_a_different_answer(manifest):
    """A test file reaches no route *and the manifest says so*, which is not
    the same fact as no pattern matching it."""
    resolved = manifest.resolve("tests/test_route_manifest.py")
    assert resolved.matched is True
    assert resolved.routes == ()


# --- the loader ------------------------------------------------------------


def test_a_star_does_not_cross_a_separator(tmp_path):
    manifest = _written(
        tmp_path,
        routes=[{"path": "/room", "kind": "room", "name": "A room"}],
        patterns=[{"pattern": "web/src/*.tsx", "routes": ["/room"]}],
    )
    assert manifest.resolve("web/src/App.tsx").routes == ("/room",)
    assert manifest.resolve("web/src/desk/Desk.tsx").matched is False


def test_a_manifest_naming_an_undeclared_route_is_refused(tmp_path):
    with pytest.raises(ValueError, match="/nowhere"):
        _written(
            tmp_path,
            routes=[{"path": "/room", "kind": "room", "name": "A room"}],
            patterns=[{"pattern": "a.py", "routes": ["/nowhere"]}],
        )


def test_a_manifest_that_is_not_there_is_refused_by_name(tmp_path):
    with pytest.raises(OSError):
        RouteManifest.load(tmp_path / "nothing.json")


def _written(tmp_path: Path, *, routes: list[dict], patterns: list[dict]) -> RouteManifest:
    import json

    path = tmp_path / "route-manifest.json"
    path.write_text(json.dumps({"routes": routes, "patterns": patterns}), encoding="utf-8")
    return RouteManifest.load(path)
