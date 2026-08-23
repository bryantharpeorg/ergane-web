"""The degraded entries the Showfloor's attention badge consumes.

The badge renders a note — never a count, and never the numeral zero — when
the attention read degraded, and it reads that fact from the floor document's
`degraded` list.  So this pins exactly that half of the attention section and
nothing more: the two 052 fault shapes injected at the reader seam, as 001's
`tests/test_degraded.py` injects them, produce one `section == "attention"`
entry each, and the two entries are two different facts.

Deliberately silent about `attention["items"]`.  Spec
003-an-answer-reaches-the-factory is chartered to redesign that list (its US1
unions the pane's seeded store with the factory reads; its US3 keeps stored
items rendering when `open_escalations` fails), so an assertion on the items
here would be this epic pinning a shape its concurrent sibling changes.
"""

import asyncio
import json
from pathlib import Path

import pytest

from pane.floor_document import assemble_floor_document
from pane.readers import EpicRef, FloorRead, QueryRefused, TransportFailed

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"


class _ReaderWithAttentionFailure:
    """Every read recorded, except `open_escalations`, which fails on demand."""

    reference_instant: str | None = None

    def __init__(self, root: Path, failure: Exception) -> None:
        self.root = root
        self.failure = failure

    async def read_floor(self) -> FloorRead:
        status = json.loads((self.root / "floor" / "floor-live.json").read_text())
        running: list[EpicRef] = []
        return FloorRead(status=status, running=running)

    async def epic_status(self, workflow_id: str, scene: str | None = None) -> dict:
        raise AssertionError("no epic runs in this document")

    def workgraph(self, epic_id_or_ref: str) -> dict:
        raise AssertionError("no epic runs in this document")

    async def open_escalations(self) -> list[dict]:
        raise self.failure

    def stored_questions(self) -> list[dict]:
        return []

    def list_findings(self) -> list[dict]:
        return json.loads((self.root / "doctor" / "findings.json").read_text())

    def rollup(self) -> dict:
        return json.loads((self.root / "usage" / "rollup-by-persona.json").read_text())

    async def aclose(self) -> None:
        return None


def _attention_entries(failure: Exception) -> list[dict]:
    reader = _ReaderWithAttentionFailure(FIXTURES, failure)
    document = asyncio.run(assemble_floor_document(reader))
    return [d for d in document["degraded"] if d["section"] == "attention"]


@pytest.mark.parametrize(
    ("failure", "mode"),
    [
        (TransportFailed("open_escalations", "attention: connection refused"), "transport"),
        (QueryRefused("open_escalations", "attention: query rejected"), "refusal"),
    ],
    ids=["transport", "refusal"],
)
def test_degraded_attention_entry_names_its_mode(failure: Exception, mode: str) -> None:
    """A failed attention read is one degraded entry the badge can render."""
    entries = _attention_entries(failure)

    assert len(entries) == 1
    entry = entries[0]
    assert entry["section"] == "attention"
    assert entry["mode"] == mode
    assert entry["read"] == "open_escalations"


def test_the_two_attention_failures_are_two_different_facts() -> None:
    """Transport failure and query refusal differ by mode, not by wording alone."""
    transport = _attention_entries(
        TransportFailed("open_escalations", "attention: connection refused")
    )[0]
    refusal = _attention_entries(
        QueryRefused("open_escalations", "attention: query rejected")
    )[0]

    assert transport["mode"] == "transport"
    assert refusal["mode"] == "refusal"
    assert transport["mode"] != refusal["mode"]
    assert transport["section"] == refusal["section"] == "attention"
