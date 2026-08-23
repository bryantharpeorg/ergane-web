"""Shared helpers for the pane's pytest suite.

`seeded_items` puts the recorded webhook deliveries through the same
`upsert_delivery` call the intake route uses, so a stub reader standing in for
the live one serves the recordings the way the factory would have delivered
them — never a hand-built item (constitution V).
"""

import tempfile
from pathlib import Path

from pane.attention_store import StoredItem, list_items, open_store, upsert_delivery
from pane.fixture_floor import SEEDED_DELIVERIES, load_document
from pane.intake import classify


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
