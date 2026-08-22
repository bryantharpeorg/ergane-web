"""Pane-side SQLite store for delivered Attention items.

The factory's own questions store and escalation workflows remain the arbiters of
settlement; this module remembers only what the factory delivered and, later, what
the pane carried back. Stdlib `sqlite3` only.
"""

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal


StoredItem = dict

_ATTENTION_SCHEMA = """
CREATE TABLE IF NOT EXISTS attention (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    correlation_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('question', 'escalation', 'notice')),
    text TEXT NOT NULL,
    actions_json TEXT NOT NULL,
    received_at TEXT NOT NULL,
    last_ruling TEXT,
    last_ruling_at TEXT,
    pressed_choice TEXT,
    signal_state TEXT CHECK (signal_state IN ('accepted', 'SIGNAL_FAILED')),
    signalled_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS attention_answerable_id
ON attention(correlation_id) WHERE kind != 'notice';
"""


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def open_store(path: Path) -> sqlite3.Connection:
    """Open the pane-side attention store, creating its schema idempotently."""
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.executescript(_ATTENTION_SCHEMA)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


@dataclass(frozen=True)
class UpsertResult:
    item: StoredItem
    inserted: bool


def upsert_delivery(
    conn: sqlite3.Connection,
    *,
    kind: Literal["question", "escalation", "notice"],
    correlation_id: str,
    text: str,
    actions: list[dict],
    received_at: str | None = None,
) -> UpsertResult:
    """Store an accepted delivery. Answerable kinds are idempotent on correlation_id."""
    if received_at is None:
        received_at = _utc_now()
    actions_json = json.dumps(actions)

    if kind == "notice":
        conn.execute(
            """
            INSERT INTO attention (correlation_id, kind, text, actions_json, received_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (correlation_id, kind, text, actions_json, received_at),
        )
        conn.commit()
        inserted = True
    else:
        conn.execute(
            """
            INSERT OR IGNORE INTO attention
                (correlation_id, kind, text, actions_json, received_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (correlation_id, kind, text, actions_json, received_at),
        )
        conn.commit()
        inserted = conn.total_changes > 0

    item = get_item(conn, correlation_id)
    assert item is not None
    return UpsertResult(item=item, inserted=inserted)


def get_item(conn: sqlite3.Connection, correlation_id: str) -> StoredItem | None:
    """Return the most recently stored item for a correlation id, or None."""
    row = conn.execute(
        "SELECT * FROM attention WHERE correlation_id = ? ORDER BY seq DESC LIMIT 1",
        (correlation_id,),
    ).fetchone()
    if row is None:
        return None
    return _row_to_item(row)


def list_items(conn: sqlite3.Connection) -> list[StoredItem]:
    """Return every stored item in arrival order."""
    rows = conn.execute("SELECT * FROM attention ORDER BY seq").fetchall()
    return [_row_to_item(row) for row in rows]


def _row_to_item(row: sqlite3.Row) -> StoredItem:
    return {
        "seq": row["seq"],
        "correlation_id": row["correlation_id"],
        "kind": row["kind"],
        "text": row["text"],
        "actions": json.loads(row["actions_json"]),
        "actions_json": row["actions_json"],
        "received_at": row["received_at"],
        "last_ruling": row["last_ruling"],
        "last_ruling_at": row["last_ruling_at"],
        "pressed_choice": row["pressed_choice"],
        "signal_state": row["signal_state"],
        "signalled_at": row["signalled_at"],
    }
