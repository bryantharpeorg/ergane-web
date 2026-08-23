"""Outermost reader seam for the Ergane web pane.

`Reader` is a protocol with two implementations: `FixtureReader` replays recorded
factory documents under `fixtures/`, and `LiveReader` (US3) calls ergane's own
seams.  Downstream assembly never learns which implementation it was handed.

This module is the only place that knows about the two failure modes a read can
return: `TransportFailed` (the read could not be made) and `QueryRefused` (the
read was made and the other side declined to answer).  `assemble_floor_document`
in `pane/floor_document.py` catches only these two exception classes.
"""

import dataclasses
import enum
import json
from pathlib import Path
import sqlite3

from typing import Any, Protocol

from pane import attention_store
from pane.attention_store import StoredItem


class TransportFailed(Exception):
    """A read could not be made (connection refused, missing store, missing fixture)."""

    def __init__(self, read: str, detail: str) -> None:
        self.read = read
        self.detail = detail
        super().__init__(f"{read}: {detail}")


class QueryRefused(Exception):
    """A read was made and the factory declined to answer (query rejected/refused)."""

    def __init__(self, read: str, detail: str) -> None:
        self.read = read
        self.detail = detail
        super().__init__(f"{read}: {detail}")


@dataclasses.dataclass(frozen=True)
class EpicRef:
    epic_id: str
    workflow_id: str
    scene: str | None
    workgraph_ref: str


@dataclasses.dataclass(frozen=True)
class FloorRead:
    status: dict | None
    running: list[EpicRef]


class Reader(Protocol):
    """Outermost reader seam.  `assemble_floor_document` uses this protocol only."""

    reference_instant: str | None

    async def read_floor(self) -> FloorRead:
        """Return the current FloorStatus-like document and a list of running epics."""
        ...

    async def epic_status(self, workflow_id: str, scene: str | None = None) -> dict:
        """Return the `epic_status` answer for the given workflow id.

        `scene` is an optional hint used by fixture mode to disambiguate multiple
        recorded scenes that share the same epic id; live readers may ignore it.
        """
        ...

    def workgraph(self, epic_id_or_ref: str) -> dict:
        """Return the workgraph document for the given epic id or scene ref."""
        ...

    async def open_escalations(self) -> list[dict]:
        """Return open escalation documents."""
        ...

    def stored_items(self) -> list["StoredItem"]:
        """Return every Attention item the factory has delivered to the pane.

        Spec 003 replaces 001's `stored_questions()` stand-in with this: the
        attention section has one source and one code path in both modes, and
        the assembly reaches the pane's delivery store through this seam rather
        than by importing `Settings`.
        """
        ...

    async def settle_question(self, correlation_id: str, text: str, identity: str) -> str:
        """Settle one Question through the factory and return its ruling, verbatim.

        The only way a Question is ever answered: an `InboundRelay` of exactly
        three terms handed to `CallbackBridge.handle_relay`, whose
        `BridgeOutcome` string comes back as the call's return.  The pane never
        judges validity, expiry, or authorization — the factory rules and this
        seam carries the word (FR-006).
        """
        ...

    async def press_escalation(
        self, correlation_id: str, escalation_id: str, choice: str, identity: str
    ) -> None:
        """Send one `escalation_resolved` signal; return nothing, because a signal does.

        A Temporal signal has no return, so a press can only be accepted or have
        raised.  Raising is the caller's SIGNAL_FAILED — the one ruling the pane
        derives, because it is the one fact it can observe (FR-008).
        """
        ...

    def list_findings(self) -> list[dict]:
        """Return doctor findings."""
        ...

    def rollup(self) -> dict:
        """Return the usage rollup."""
        ...

    async def aclose(self) -> None:
        """Close any long-lived resources held by the reader."""
        ...


class LiveReader:
    """Reads the factory floor through ergane's published library seams.

    Every read here is an import from the `ergane-cli` distribution.  No
    subprocess is spawned, no `ergane` CLI is shelled, and every factory store is
    opened read-only.  Temporal failures are classified using ergane's own
    ``TRANSPORT_FAILED`` / ``QUERY_REFUSED`` tuples.
    """

    reference_instant: str | None = None

    def __init__(self, specs_root: Path, *, attention_db: Path | None = None) -> None:
        self.specs_root = Path(specs_root)
        self.attention_db = Path(attention_db) if attention_db is not None else None
        self._client: Any = None
        self._store: Any = None

    def _plain(self, value: Any) -> Any:
        """Serialize ergane dataclasses, enums, and paths into plain JSON values."""
        if value is None:
            return None
        if isinstance(value, (str, int, float, bool)):
            return value
        if isinstance(value, enum.Enum):
            return value.name
        if isinstance(value, Path):
            return str(value)
        if isinstance(value, (tuple, list)):
            return [self._plain(v) for v in value]
        if isinstance(value, dict):
            return {k: self._plain(v) for k, v in value.items()}
        if dataclasses.is_dataclass(value) and not isinstance(value, type):
            return {
                f.name: self._plain(getattr(value, f.name))
                for f in dataclasses.fields(value)
            }
        raise TypeError(f"cannot serialize {type(value)}")

    async def _open_client(self) -> Any:
        if self._client is None:
            from factory.cli.nouns import _open_client

            self._client = await _open_client()
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client._close()
            self._client = None
        if self._store is not None:
            self._store.close()
            self._store = None

    async def read_floor(self) -> FloorRead:
        from factory.cli.nouns import build
        from factory.cli.status import collect_floor

        try:
            status = await collect_floor(self.specs_root)
        except build.TRANSPORT_FAILED as exc:
            raise TransportFailed("collect_floor", str(exc)) from exc
        except build.QUERY_REFUSED as exc:
            raise QueryRefused("collect_floor", str(exc)) from exc

        plain = self._plain(status)
        running = [
            EpicRef(
                epic_id=e["epic_id"],
                workflow_id=build.workflow_id(e["epic_id"]),
                scene=None,
                workgraph_ref=e["epic_id"],
            )
            for e in plain.get("epics", [])
        ]
        return FloorRead(status=plain, running=running)

    async def epic_status(self, workflow_id: str, scene: str | None = None) -> dict:
        from factory.cli.nouns import build
        from factory.workgraph.workflow import EpicWorkflow

        client = await self._open_client()
        try:
            handle = client.get_workflow_handle(workflow_id)
            answer = await handle.query(EpicWorkflow.epic_status)
        except build.TRANSPORT_FAILED as exc:
            raise TransportFailed("epic_status", str(exc)) from exc
        except build.QUERY_REFUSED as exc:
            raise QueryRefused("epic_status", str(exc)) from exc
        return self._plain(answer)

    def workgraph(self, epic_id_or_ref: str) -> dict:
        path = self.specs_root / epic_id_or_ref / "workgraph.json"
        try:
            return json.loads(path.read_text())
        except (OSError, ValueError) as exc:
            raise TransportFailed("workgraph", str(exc)) from exc

    async def open_escalations(self) -> list[dict]:
        from factory.cli.nouns import build
        from factory.escalation.client import open_escalations

        client = await self._open_client()
        try:
            rows = await open_escalations(client)
        except build.TRANSPORT_FAILED as exc:
            raise TransportFailed("open_escalations", str(exc)) from exc
        except build.QUERY_REFUSED as exc:
            raise QueryRefused("open_escalations", str(exc)) from exc
        return [self._plain(row) for row in rows]

    def stored_items(self) -> list[StoredItem]:
        """Read the pane's delivery store — the same store intake writes.

        The path is handed to the constructor by `create_app`; a reader built
        without one has no store to read, which is a transport failure in words
        rather than a silently empty Attention section.
        """
        if self.attention_db is None:
            raise TransportFailed("stored_items", "no attention store is configured in this build")
        try:
            conn = self._attention_store()
        except (sqlite3.OperationalError, OSError) as exc:
            raise TransportFailed("stored_items", str(exc)) from exc
        return attention_store.list_items(conn)

    def _attention_store(self):
        if self._store is None:
            self._store = attention_store.open_store(self.attention_db)
        return self._store

    async def settle_question(self, correlation_id: str, text: str, identity: str) -> str:
        """`CallbackBridge.handle_relay`, and nothing else, ever (FR-006).

        The questions store is resolved the way `ergane answer` resolves it —
        through ergane's own `resolve_env_path` over its modern and legacy
        variable names — so a deployment that moved its runtime root moved this
        with it.  The adapter is named explicitly rather than left to the
        configured default, so constructing the bridge resolves no other
        transport's config.
        """
        from factory.activities.verify_activities import DEFAULT_VERIFICATION_DB_PATH
        from factory.env import (
            ERGANE_VERIFICATION_DB_PATH_ENV,
            FACTORY_VERIFICATION_DB_PATH_ENV,
            resolve_env_path,
        )
        from factory.notify.adapter import InboundRelay, resolve_adapter
        from factory.notify.service import CallbackBridge
        from factory.notify.webhook import WEBHOOK_ADAPTER

        client = await self._open_client()
        bridge = CallbackBridge(
            db_path=resolve_env_path(
                ERGANE_VERIFICATION_DB_PATH_ENV,
                FACTORY_VERIFICATION_DB_PATH_ENV,
                DEFAULT_VERIFICATION_DB_PATH,
            ),
            client=client,
            adapter=resolve_adapter(WEBHOOK_ADAPTER),
        )
        relay = InboundRelay(
            correlation_id=correlation_id,
            reply_text=text,
            sender_identity=identity,
        )
        outcome = await bridge.handle_relay(relay)
        return outcome.value

    async def press_escalation(
        self, correlation_id: str, escalation_id: str, choice: str, identity: str
    ) -> None:
        """The `escalation_resolved` signal on the workflow the correlation id names.

        The workflow id *is* the correlation id (ergane 041 FR-004); nothing is
        invented here and nothing is caught — a raising RPC is the caller's
        SIGNAL_FAILED, which is an observation rather than a ruling.
        """
        from factory.notify.service import SIGNAL_NAME

        client = await self._open_client()
        handle = client.get_workflow_handle(correlation_id)
        await handle.signal(SIGNAL_NAME, args=[escalation_id, choice, identity])

    def list_findings(self) -> list[dict]:
        from factory.cli.nouns import build
        from factory.doctor import cli as doctor_cli
        from factory.doctor import store as doctor_store
        from factory.workgraph.worktree import resolve_factory_root

        root, _choice, _env = resolve_factory_root()
        path = doctor_cli._resolve_store_path_for_root(root)
        try:
            conn = doctor_store.connect_readonly(path)
        except (sqlite3.OperationalError, OSError) as exc:
            raise TransportFailed("list_findings", str(exc)) from exc
        try:
            rows = doctor_store.list_findings(conn)
        finally:
            conn.close()

        return [self._plain(row) for row in rows]

    def rollup(self) -> dict:
        from factory.cli.nouns import build
        from factory.usage import cli as usage_cli
        from factory.usage import ledger as usage_ledger

        path = usage_cli._default_ledger_path()
        try:
            conn = usage_cli.open_readonly(path)
        except (sqlite3.OperationalError, OSError) as exc:
            raise TransportFailed("rollup", str(exc)) from exc
        try:
            result = usage_ledger.rollup(conn, by="persona")
        finally:
            conn.close()

        return self._plain(result)


class UnconfiguredReader:
    """Placeholder reader used when the app is not in demo mode and no live reader is wired."""

    reference_instant: str | None = None

    async def aclose(self) -> None:
        return None

    async def read_floor(self) -> FloorRead:
        raise TransportFailed("collect_floor", "no live reader is configured in this build")

    async def epic_status(self, workflow_id: str, scene: str | None = None) -> dict:
        raise TransportFailed("epic_status", "no live reader is configured in this build")

    def workgraph(self, epic_id_or_ref: str) -> dict:
        raise TransportFailed("workgraph", "no live reader is configured in this build")

    async def open_escalations(self) -> list[dict]:
        raise TransportFailed("open_escalations", "no live reader is configured in this build")

    def stored_items(self) -> list["StoredItem"]:
        raise TransportFailed("stored_items", "no live reader is configured in this build")

    async def settle_question(self, correlation_id: str, text: str, identity: str) -> str:
        raise TransportFailed("settle_question", "no live reader is configured in this build")

    async def press_escalation(
        self, correlation_id: str, escalation_id: str, choice: str, identity: str
    ) -> None:
        raise TransportFailed("press_escalation", "no live reader is configured in this build")

    def list_findings(self) -> list[dict]:
        raise TransportFailed("list_findings", "no live reader is configured in this build")

    def rollup(self) -> dict:
        raise TransportFailed("rollup", "no live reader is configured in this build")


async def _unconfigured_async(read: str) -> Any:
    raise TransportFailed(read, "no live reader is configured in this build")
