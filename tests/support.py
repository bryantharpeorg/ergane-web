"""Shared helpers for the pane's pytest suite.

`seeded_items` puts the recorded webhook deliveries through the same
`upsert_delivery` call the intake route uses, so a stub reader standing in for
the live one serves the recordings the way the factory would have delivered
them — never a hand-built item (constitution V).

`registered_api_routes` is how every route-enumerating test reads the routes off
the application object rather than off a hand-kept list (spec 003 US4-S1).
"""

import tempfile
from pathlib import Path

from fastapi.routing import APIRoute

from pane.attention_store import StoredItem, list_items, open_store, upsert_delivery
from pane.fixture_floor import SEEDED_DELIVERIES, load_document
from pane.intake import classify


def registered_api_routes(app) -> list[APIRoute]:
    """Every `APIRoute` the app registers, however deeply the router nests them.

    FastAPI ≥ 0.141 does not splice an included router's routes into
    `app.routes`; it appends one `_IncludedRouter` wrapper holding the real
    routes on `original_router`. A walk that only looks at the top level
    therefore finds *nothing* here and every assertion over it passes
    vacuously — which is the exact failure mode a route-enumeration test exists
    to prevent. This walk recurses through both `routes` and `original_router`,
    so a route cannot hide from it by being mounted one level further down.
    """
    found: list[APIRoute] = []
    seen: set[int] = set()

    def walk(node) -> None:
        if id(node) in seen:
            return
        seen.add(id(node))
        if isinstance(node, APIRoute):
            found.append(node)
            return
        for child in getattr(node, "routes", ()) or ():
            walk(child)
        inner = getattr(node, "original_router", None)
        if inner is not None:
            walk(inner)

    walk(app.router)
    return found


def _own_dependency_callables(node) -> list:
    """The dependencies a router (or an include of one) imposes on what it holds."""
    depends = list(getattr(node, "dependencies", ()) or [])
    context = getattr(node, "include_context", None)
    if context is not None:
        depends += list(getattr(context, "dependencies", ()) or [])
    return [getattr(dep, "dependency", None) for dep in depends]


def routes_with_enclosing_dependencies(app) -> list[tuple[APIRoute, list]]:
    """Each route with every dependency callable that runs in front of it.

    Two places impose one, and a structural check must read both. A route
    declared straight on a router gets the router's `dependencies` baked into its
    own `dependant`; a route reached through `include_router` does not — FastAPI
    ≥ 0.141 applies the enclosing router's dependencies at dispatch instead. So
    `pane/intake.py`'s and `pane/answer.py`'s routes really are behind
    `require_viewer`, and really do not carry it in their own dependant tree.
    Reading only the tree would call them unguarded; reading only the enclosing
    routers would miss a route that carries its own. This reads both.
    """
    collected: list[tuple[APIRoute, list]] = []
    seen: set[int] = set()

    def own_tree(dependant, visited: set[int]) -> list:
        if id(dependant) in visited:
            return []
        visited.add(id(dependant))
        found = [dependant.call]
        for child in dependant.dependencies:
            found += own_tree(child, visited)
        return found

    def walk(node, inherited: list) -> None:
        if id(node) in seen:
            return
        seen.add(id(node))
        if isinstance(node, APIRoute):
            collected.append((node, inherited + own_tree(node.dependant, set())))
            return
        carried = inherited + _own_dependency_callables(node)
        for child in getattr(node, "routes", ()) or ():
            walk(child, carried)
        inner = getattr(node, "original_router", None)
        if inner is not None:
            walk(inner, carried)

    walk(app.router, [])
    return collected


def seeded_items(fixtures_root: Path) -> list[StoredItem]:
    """Every recorded delivery, stored in a fresh store and read back."""
    conn = open_store(Path(tempfile.mkdtemp(prefix="pane-stub-")) / "attention.db")
    for name in SEEDED_DELIVERIES:
        payload, envelope = load_document(Path(fixtures_root) / "webhook" / name, read="stored_items")
        upsert_delivery(
            conn,
            kind=classify(payload),
            correlation_id=payload["correlation_id"],
            text=payload["text"],
            actions=payload.get("actions", []),
            received_at=envelope["captured_at"],
        )
    return list_items(conn)
