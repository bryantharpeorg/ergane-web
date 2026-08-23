"""AST sweep + unit tests proving the backend never shells, never writes, never hard-codes paths.

The sweep walks every Python source file under ``pane/`` and asserts the
forbidden patterns are absent.  Unit tests assert each live read calls its ergane
seam exactly once and that failure modes are classified correctly.
"""

import ast
import inspect
import os
import re
import sqlite3
from pathlib import Path

import pytest
from temporalio.service import RPCError
from temporalio.client._exceptions import WorkflowQueryRejectedError

from pane.readers import LiveReader, TransportFailed, QueryRefused

ROOT = Path(__file__).resolve().parents[1]
PANE = ROOT / "pane"


def pane_py_sources():
    for path in sorted(PANE.rglob("*.py")):
        if path.name == "__init__.py" and not path.read_text().strip():
            continue
        yield path


def _literals(node: ast.AST) -> list[str]:
    out: list[str] = []
    for child in ast.walk(node):
        if isinstance(child, ast.Constant) and isinstance(child.value, str):
            out.append(child.value)
    return out


def test_no_subprocess_imports():
    forbidden = {"subprocess", "asyncio.create_subprocess_exec", "asyncio.create_subprocess_shell"}
    for path in pane_py_sources():
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    assert alias.name not in forbidden, f"{path}: imports {alias.name}"
            if isinstance(node, ast.ImportFrom):
                assert node.module not in forbidden, f"{path}: imports from {node.module}"


def test_no_os_system_or_popen():
    forbidden_calls = {"system", "popen"}
    for path in pane_py_sources():
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.Attribute) and node.attr in forbidden_calls:
                value = node.value
                if isinstance(value, ast.Name) and value.id == "os":
                    assert False, f"{path}: calls os.{node.attr}"


def test_no_ergane_cli_literals():
    for path in pane_py_sources():
        source = path.read_text()
        tree = ast.parse(source)
        literals = _literals(tree)
        for lit in literals:
            if lit == "__doc__":
                continue
            assert not lit.startswith("ergane "), f"{path}: literal starts with 'ergane ': {lit!r}"
            assert "ergane doctor" not in lit, f"{path}: literal contains 'ergane doctor': {lit!r}"


def test_no_literal_store_paths():
    forbidden_substrings = {
        ".ergane/",
        ".factory/",
        "doctor.db",
        "ledger.db",
    }
    for path in pane_py_sources():
        source = path.read_text()
        for substring in forbidden_substrings:
            assert substring not in source, f"{path}: contains forbidden literal {substring!r}"


# The one pane module permitted to open a store for writing: its own delivery
# store (`PANE_ATTENTION_DB`).  Named here, so a second writable store in a
# second file fails this sweep.
WRITABLE_STORE_OWNER = "attention_store.py"

# The only ways a pane module may open a *factory* store.  Every one is
# read-only by construction and belongs to the ergane distribution.
FACTORY_STORE_OPENERS = {
    "factory.doctor.store.connect_readonly",
    "factory.usage.cli.open_readonly",
    "factory.verify.store.connect_readonly",
}


def _sqlite_connect_calls(tree: ast.AST) -> list[ast.Call]:
    """Every `sqlite3.connect(...)` call in a module."""
    calls = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if isinstance(func, ast.Attribute) and func.attr == "connect":
            value = func.value
            if isinstance(value, ast.Name) and value.id == "sqlite3":
                calls.append(node)
        if isinstance(func, ast.Name) and func.id == "connect":
            calls.append(node)
    return calls


def test_no_pane_module_opens_a_factory_store_outside_its_readonly_seam():
    """A factory store is opened through ergane's read-only readers or not at all.

    Spec 003 gives the pane one store of its own, so the rule 001 wrote as "no
    `sqlite3.connect` anywhere under `pane/`" is narrowed here to its actual
    intent: the *factory's* stores stay read-only, opened only through the three
    seams below (constitution II).
    """
    for path in pane_py_sources():
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.Attribute) and node.attr == "connect":
                value = node.value
                if isinstance(value, ast.Attribute) and value.attr == "store":
                    assert False, f"{path}: references factory.doctor.store.connect"
                if isinstance(value, ast.Name) and value.id == "doctor_store":
                    assert False, f"{path}: calls connect on a doctor store alias"

    # Every store-opening call under `pane/` is either one of those three seams
    # or the pane's own writable connect in its own module.
    opening_names = {"connect", "connect_readonly", "open_readonly"}
    for path in pane_py_sources():
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            func = node.func
            name = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", None)
            if name not in opening_names:
                continue
            dotted = ast.unparse(func)
            if dotted == "sqlite3.connect":
                assert path.name == WRITABLE_STORE_OWNER, f"{path}: writable connect outside the store owner"
                continue
            tail = dotted.rsplit(".", 1)[-1]
            assert any(opener.endswith("." + tail) for opener in FACTORY_STORE_OPENERS), (
                f"{path}: opens a store through {dotted!r}, which is not a read-only ergane seam"
            )


def test_only_the_pane_own_store_opens_sqlite_for_writing():
    """`pane/attention_store.py` is the one file with a writable connect."""
    owners = set()
    for path in pane_py_sources():
        tree = ast.parse(path.read_text())
        if _sqlite_connect_calls(tree):
            owners.add(path.name)
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module == "sqlite3":
                # `from sqlite3 import connect` would hide the call from the
                # attribute sweep above; only the store owner may import names.
                assert path.name == WRITABLE_STORE_OWNER, f"{path}: imports from sqlite3"

    assert owners == {WRITABLE_STORE_OWNER}, (
        f"exactly one pane module may open a writable store; found {sorted(owners)}"
    )


def test_the_pane_store_connects_only_to_the_path_it_is_handed():
    """The one writable connect opens `PANE_ATTENTION_DB`, never a literal path."""
    path = PANE / WRITABLE_STORE_OWNER
    tree = ast.parse(path.read_text())

    open_store = next(
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef) and node.name == "open_store"
    )
    calls = _sqlite_connect_calls(tree)
    assert len(calls) == 1, f"{path}: expected exactly one sqlite3.connect"

    inside = _sqlite_connect_calls(open_store)
    assert len(inside) == 1, f"{path}: the connect must live in open_store(path)"

    (call,) = inside
    first_arg = call.args[0]
    assert isinstance(first_arg, ast.Name), f"{path}: connect must take the handed path"
    assert first_arg.id == open_store.args.args[0].arg

    # No string literal in the module names any store on disk.
    for literal in _literals(tree):
        assert not literal.endswith(".db"), f"{path}: hard-codes a store path {literal!r}"


def test_live_reader_calls_each_seam_once(monkeypatch, tmp_path):
    """Every live read routes through exactly one ergane seam."""
    calls = {}

    def mark(name):
        async def async_wrapper(*args, **kwargs):
            calls[name] = calls.get(name, 0) + 1
            if name == "collect_floor":
                from factory.cli.status import FloorStatus
                return FloorStatus(
                    specs_root=tmp_path,
                    roadmap={},
                    epics=[{"epic_id": "002-expense-notes"}],
                    queue=[],
                    drafts=[],
                    pace={},
                    readiness_basis="now",
                    notes=[],
                    degraded=[],
                )
            if name == "epic_status":
                return DummyAnswer()
            if name == "open_escalations":
                return ()
            return None

        def sync_wrapper(*args, **kwargs):
            calls[name] = calls.get(name, 0) + 1
            if name == "list_findings":
                return []
            if name == "rollup":
                return {"by": "persona"}
            return None

        if name in ("collect_floor", "epic_status", "open_escalations"):
            return async_wrapper
        return sync_wrapper

    import factory.cli.status
    import factory.cli.nouns
    import factory.doctor.store
    import factory.escalation.client
    import factory.usage.cli
    import factory.usage.ledger
    import factory.workgraph.workflow

    monkeypatch.setattr(factory.cli.status, "collect_floor", mark("collect_floor"))
    monkeypatch.setattr(factory.cli.nouns, "_open_client", mark("_open_client"))
    # We cannot monkeypatch a workflow query method on the class because the
    # Temporal client fetches it via the class attribute at query time. Patch
    # the handle's query method instead by wrapping the fake client factory.
    real_open_client = factory.cli.nouns._open_client
    async def fake_open_client():
        calls["_open_client"] = calls.get("_open_client", 0) + 1
        return FakeTemporalClient()
    monkeypatch.setattr(factory.cli.nouns, "_open_client", fake_open_client)
    monkeypatch.setattr(factory.escalation.client, "open_escalations", mark("open_escalations"))
    monkeypatch.setattr(factory.doctor.store, "connect_readonly", mark("connect_readonly"))
    monkeypatch.setattr(factory.doctor.store, "list_findings", mark("list_findings"))
    monkeypatch.setattr(factory.usage.cli, "open_readonly", mark("open_readonly"))
    monkeypatch.setattr(factory.usage.ledger, "rollup", mark("rollup"))

    class FakeTemporalClient:
        def __init__(self):
            calls["epic_status"] = calls.get("epic_status", 0) + 1

        def get_workflow_handle(self, workflow_id):
            class Handle:
                async def query(self, query):
                    return DummyAnswer()
            return Handle()

    reader = LiveReader(tmp_path)

    import asyncio
    asyncio.run(reader.read_floor())
    assert calls["collect_floor"] == 1

    asyncio.run(reader.epic_status("epic-002-expense-notes"))
    assert calls["epic_status"] == 1

    asyncio.run(reader.open_escalations())
    assert calls["open_escalations"] == 1

    # list_findings should pass connect_readonly result to list_findings.
    class FakeConn:
        def close(self):
            pass
    monkeypatch.setattr(factory.doctor.store, "connect_readonly", lambda path: FakeConn())
    captured_findings = {}
    def capture_list_findings(conn):
        captured_findings["conn"] = conn
        return []
    monkeypatch.setattr(factory.doctor.store, "list_findings", capture_list_findings)
    reader.list_findings()
    assert isinstance(captured_findings["conn"], FakeConn)

    # rollup should pass open_readonly result to rollup with by="persona".
    class FakeLedgerConn:
        def close(self):
            pass
    ledger_conn = FakeLedgerConn()
    monkeypatch.setattr(factory.usage.cli, "open_readonly", lambda path: ledger_conn)
    captured = {}
    def capture_rollup(conn, *, by, epic=None, since=None):
        captured["conn"] = conn
        captured["by"] = by
        return {"by": by}
    monkeypatch.setattr(factory.usage.ledger, "rollup", capture_rollup)
    reader.rollup()
    assert captured["conn"] is ledger_conn
    assert captured["by"] == "persona"


def test_operational_error_becomes_transport():
    reader = LiveReader(Path("/nonexistent/specs"))

    with pytest.raises(TransportFailed):
        reader.list_findings()

    with pytest.raises(TransportFailed):
        reader.rollup()


def test_rpc_error_transport_and_query_rejected_refusal():
    from temporalio.service import RPCStatusCode

    reader = LiveReader(Path("/nonexistent/specs"))

    class FakeClient:
        def get_workflow_handle(self, workflow_id):
            class Handle:
                async def query(self, query):
                    raise RPCError("cannot reach Temporal", RPCStatusCode.UNAVAILABLE, b"")
            return Handle()

    reader._client = FakeClient()

    import asyncio
    with pytest.raises(TransportFailed):
        asyncio.run(reader.epic_status("epic-test"))

    class RefusingClient:
        def get_workflow_handle(self, workflow_id):
            class Handle:
                async def query(self, query):
                    raise WorkflowQueryRejectedError("rejected")
            return Handle()

    reader._client = RefusingClient()
    with pytest.raises(QueryRefused):
        asyncio.run(reader.epic_status("epic-test"))


import dataclasses

@dataclasses.dataclass
class DummyAnswer:
    epic_state: str = "RUNNING"
    nodes: dict = dataclasses.field(default_factory=dict)
    worker_revision: str = "abc"
    landing_config: dict = dataclasses.field(default_factory=dict)
    landing_overrides: dict = dataclasses.field(default_factory=dict)
