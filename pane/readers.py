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


#: The evidence read's name, spelt once and used by every degraded note the
#: gate-run section writes.  D-020 adds `node_history` to constitution II's list
#: of borrowed seams; this repository calls the read by the seam's own name so a
#: note in the section says which function could not answer (013 FR-002).
EVIDENCE_READ = "node_history"


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

    async def read_question(self, correlation_id: str) -> dict | None:
        """Return the factory's stored `QuestionRecord` for this id, or None.

        The two fields the Desk takes from it are the ones only the factory can
        write: the `expires_at` it wrote at send time, and the `resolution` it
        wrote when the question settled (FR-019, FR-012).  The record is carried
        as a plain document, the way `open_escalations` already carries
        `OpenEscalation` — the pane reads fields off it and re-derives nothing.

        `None` means the factory's store has no such question, which is not a
        failure: the item keeps no deadline (FR-012).  A store that cannot be
        opened is `TransportFailed` and a query that errors is `QueryRefused` —
        001's two modes, and neither is ever a missing deadline in disguise.
        """
        ...

    async def read_escalation_fate(self, correlation_id: str) -> dict | None:
        """Return what the factory reports about this Escalation, or None.

        Same two fields as `read_question`, and the same rule: `resolution` is
        the factory's word, passed through verbatim.  A press never reaches this
        read — a signal returns nothing, so an Escalation's fate arrives here or
        not at all (FR-010, FR-012).
        """
        ...

    def node_history(self, epic_id: str, node_id: str) -> list[dict]:
        """Return every recorded verification of one node, oldest attempt first.

        `factory.verify.store.node_history` over `connect_readonly`, and nothing
        else (013 FR-001, D-020).  Each entry is one `VerificationResult`
        carried as a plain document — the gates that ran, the loop summary the
        attempt ran under, the output check and the judge's per-scenario
        findings — the way `read_question` carries a `QuestionRecord`.

        An empty list is an answer: this node has no recorded verification.  A
        store that cannot be opened is `TransportFailed` and a store that
        answered with an error is `QueryRefused` — 001's two modes, and neither
        is ever an empty history in disguise (constitution III).
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

    def _verification_db(self) -> Path:
        """Where the factory keeps its evidence store, asked of ergane.

        One resolver for the three reads that need it — the Question settlement,
        the Question record, and 013's node history — through ergane's own
        `resolve_env_path` over its modern and legacy variable names, exactly as
        `ergane answer` resolves it.  A deployment that moved its runtime root
        moved all three with it, and no path is spelt in this repository.
        """
        from factory.activities.verify_activities import DEFAULT_VERIFICATION_DB_PATH
        from factory.env import (
            ERGANE_VERIFICATION_DB_PATH_ENV,
            FACTORY_VERIFICATION_DB_PATH_ENV,
            resolve_env_path,
        )

        return resolve_env_path(
            ERGANE_VERIFICATION_DB_PATH_ENV,
            FACTORY_VERIFICATION_DB_PATH_ENV,
            DEFAULT_VERIFICATION_DB_PATH,
        )

    async def settle_question(self, correlation_id: str, text: str, identity: str) -> str:
        """`CallbackBridge.handle_relay`, and nothing else, ever (FR-006).

        The questions store is resolved by `_verification_db` above — ergane's
        own chain, the way `ergane answer` resolves it — so a deployment that
        moved its runtime root moved this with it.  The adapter is named
        explicitly rather than left to the configured default, so constructing
        the bridge resolves no other transport's config.
        """
        from factory.notify.adapter import InboundRelay, resolve_adapter
        from factory.notify.service import CallbackBridge
        from factory.notify.webhook import WEBHOOK_ADAPTER

        client = await self._open_client()
        bridge = CallbackBridge(
            db_path=self._verification_db(),
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

    async def read_question(self, correlation_id: str) -> dict | None:
        """`get_question` over `connect_readonly`, and nothing else (FR-019).

        The store path is resolved through ergane's own chain, exactly as
        `settle_question` resolves it and exactly as `ergane answer` does, so a
        deployment that moved its runtime root moved this read with it.  The
        connection is read-only by construction — the factory's stores are the
        factory's, and the pane only ever looks.
        """
        from factory.verify import store as verify_store

        path = self._verification_db()
        try:
            conn = verify_store.connect_readonly(path)
        except (sqlite3.OperationalError, OSError) as exc:
            raise TransportFailed("read_question", str(exc)) from exc
        try:
            record = verify_store.get_question(conn, correlation_id)
        except sqlite3.Error as exc:
            # The store answered, and what it answered was a refusal.  001's
            # second mode, and a different sentence on the item than a store
            # that could not be opened at all (constitution III).
            raise QueryRefused("read_question", str(exc)) from exc
        finally:
            conn.close()

        return self._plain(record) if record is not None else None

    async def read_escalation_fate(self, correlation_id: str) -> dict | None:
        """The `escalation_status` query, falling back to the open-escalations list.

        The workflow id *is* the correlation id (ergane 041 FR-004).  A refused
        query is not the end of what can be honestly learned: `open_escalations`
        is a second seam over the same fact, already read by 001, so the refusal
        falls back to it and only becomes a `QueryRefused` on the item when that
        list has nothing to say either.  A transport failure does not fall back,
        because the fallback rides the same dead client.
        """
        from factory.cli.nouns import build
        from factory.escalation.workflow import ESCALATION_STATUS_QUERY

        client = await self._open_client()
        try:
            handle = client.get_workflow_handle(correlation_id)
            answer = await handle.query(ESCALATION_STATUS_QUERY)
        except build.TRANSPORT_FAILED as exc:
            raise TransportFailed("escalation_status", str(exc)) from exc
        except build.QUERY_REFUSED as exc:
            fallback = await self._open_escalation_entry(correlation_id)
            if fallback is None:
                raise QueryRefused("escalation_status", str(exc)) from exc
            return fallback

        if answer is None:
            return await self._open_escalation_entry(correlation_id)
        return self._plain(answer)

    async def _open_escalation_entry(self, correlation_id: str) -> dict | None:
        """The matching `open_escalations` row, or None: 001's read, reused."""
        for entry in await self.open_escalations():
            if entry.get("escalation_id") == correlation_id:
                return entry
        return None

    def node_history(self, epic_id: str, node_id: str) -> list[dict]:
        """`node_history` over `connect_readonly`, and no SQL of our own (FR-001).

        D-020 put this function on constitution II's list, so the whole of the
        pane's evidence read is one call to it: this repository writes no query,
        names no column and knows no table.  What comes back is the seam's own
        `VerificationResult` list, flattened by `_plain` into the plain document
        the assembly carries — the same treatment `open_escalations` and
        `read_question` already give ergane's dataclasses.

        Nothing about *when* a row was written is inferred here: the store keeps
        one row per `(epic, node, attempt, form)` and a re-dispatch overwrites
        it, which is a limit the section states rather than a gap this read can
        close (013 D3).
        """
        from factory.verify import store as verify_store

        path = self._verification_db()
        try:
            conn = verify_store.connect_readonly(path)
        except (sqlite3.OperationalError, OSError) as exc:
            # The store is named in the detail because the section's job is to
            # say *what could not be learned* (FR-002), and sqlite's own words
            # for a missing store are "unable to open database file" — which
            # names neither the store nor the deployment that moved it.
            raise TransportFailed(EVIDENCE_READ, f"{path}: {exc}") from exc
        try:
            rows = verify_store.node_history(conn, epic_id, node_id)
        except sqlite3.Error as exc:
            # The store answered, and what it answered was a refusal — a store
            # whose schema predates the columns this read wants, most often.
            # 001's second mode, and a different sentence in the section than a
            # store that could not be opened at all (constitution III).
            raise QueryRefused(EVIDENCE_READ, str(exc)) from exc
        finally:
            conn.close()

        return [self._plain(row) for row in rows]

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

    async def read_question(self, correlation_id: str) -> dict | None:
        raise TransportFailed("read_question", "no live reader is configured in this build")

    async def read_escalation_fate(self, correlation_id: str) -> dict | None:
        raise TransportFailed("escalation_status", "no live reader is configured in this build")

    def node_history(self, epic_id: str, node_id: str) -> list[dict]:
        raise TransportFailed(EVIDENCE_READ, "no live reader is configured in this build")

    def list_findings(self) -> list[dict]:
        raise TransportFailed("list_findings", "no live reader is configured in this build")

    def rollup(self) -> dict:
        raise TransportFailed("rollup", "no live reader is configured in this build")


async def _unconfigured_async(read: str) -> Any:
    raise TransportFailed(read, "no live reader is configured in this build")
