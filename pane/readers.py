"""Outermost reader seam for the Ergane web pane.

`Reader` is a protocol with two implementations: `FixtureReader` replays recorded
factory documents under `fixtures/`, and `LiveReader` (US3) calls ergane's own
seams.  Downstream assembly never learns which implementation it was handed.

This module is the only place that knows about the two failure modes a read can
return: `TransportFailed` (the read could not be made) and `QueryRefused` (the
read was made and the other side declined to answer).  `assemble_floor_document`
in `pane/floor_document.py` catches only these two exception classes.
"""

from dataclasses import dataclass
from typing import Any, Protocol


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


@dataclass(frozen=True)
class EpicRef:
    epic_id: str
    workflow_id: str
    scene: str | None
    workgraph_ref: str


@dataclass(frozen=True)
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

    def stored_questions(self) -> list[dict]:
        """Return stored Question documents (US3: factory.verify.store)."""
        ...

    def list_findings(self) -> list[dict]:
        """Return doctor findings."""
        ...

    def rollup(self) -> dict:
        """Return the usage rollup."""
        ...


class UnconfiguredReader:
    """Placeholder reader used when the app is not in demo mode and no live reader is wired."""

    reference_instant: str | None = None

    async def read_floor(self) -> FloorRead:
        raise TransportFailed("collect_floor", "no live reader is configured in this build")

    async def epic_status(self, workflow_id: str, scene: str | None = None) -> dict:
        raise TransportFailed("epic_status", "no live reader is configured in this build")

    def workgraph(self, epic_id_or_ref: str) -> dict:
        raise TransportFailed("workgraph", "no live reader is configured in this build")

    async def open_escalations(self) -> list[dict]:
        raise TransportFailed("open_escalations", "no live reader is configured in this build")

    def stored_questions(self) -> list[dict]:
        raise TransportFailed("stored_questions", "no live reader is configured in this build")

    def list_findings(self) -> list[dict]:
        raise TransportFailed("list_findings", "no live reader is configured in this build")

    def rollup(self) -> dict:
        raise TransportFailed("rollup", "no live reader is configured in this build")


async def _unconfigured_async(read: str) -> Any:
    raise TransportFailed(read, "no live reader is configured in this build")
