"""The pane's own store of what the factory delivered.

One row per accepted intake POST: the factory's words verbatim, plus the pane's
record of what it carried back.  This is *not* factory state — the factory's
questions store and its escalation workflows remain the only arbiters of
settlement — so this is the one store the pane writes, and the only place in
`pane/` permitted a writable `sqlite3.connect` (tests/test_readonly_sweep.py
asserts that by name).  Every factory store is still opened read-only through
ergane's own readers.

Stdlib `sqlite3` only: no new dependency (constitution VII).
"""

import json
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS attention (
    seq             INTEGER PRIMARY KEY AUTOINCREMENT,
    correlation_id  TEXT NOT NULL,
    kind            TEXT NOT NULL CHECK (kind IN ('question', 'escalation', 'notice')),
    text            TEXT NOT NULL,
    actions_json    TEXT NOT NULL,
    received_at     TEXT NOT NULL,
    last_ruling     TEXT NULL,
    last_ruling_at  TEXT NULL,
    pressed_choice  TEXT NULL,
    signal_state    TEXT NULL CHECK (signal_state IN ('accepted', 'SIGNAL_FAILED')),
    signalled_at    TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS attention_answerable_id
    ON attention(correlation_id) WHERE kind != 'notice';
"""

ANSWERABLE_KINDS = ("question", "escalation")


@dataclass(frozen=True)
class StoredItem:
    """One delivered Attention item, exactly as the factory sent it."""

    seq: int
    correlation_id: str
    kind: str
    text: str
    actions: list[dict] = field(default_factory=list)
    received_at: str = ""
    last_ruling: str | None = None
    last_ruling_at: str | None = None
    pressed_choice: str | None = None
    signal_state: str | None = None
    signalled_at: str | None = None


def open_store(path: Path) -> sqlite3.Connection:
    """Open (creating if needed) the pane's delivery store at `path`.

    The schema is created idempotently, so a fresh file and a warm one are the
    same call.  `check_same_thread=False` because one process-wide connection is
    read from the event loop and from the threadpool a sync route runs in.
    """
    path = Path(path)
    if path.parent and str(path.parent) not in ("", "."):
        path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


def upsert_delivery(
    conn: sqlite3.Connection,
    *,
    kind: str,
    correlation_id: str,
    text: str,
    actions: list[dict[str, Any]],
    received_at: str,
) -> tuple[StoredItem, bool]:
    """Store one delivery; return the stored item and whether this call created it.

    Answerable kinds take `INSERT OR IGNORE` against the partial unique index, so
    the factory's re-delivery of a served request stores nothing new (FR-004).  A
    Notice always inserts: the factory reuses `supervision` and `roadmap-<root>`
    across distinct events, and deduplicating them would silence real alerts.

    Commits before returning, so a 2xx is only ever answered over durable state.
    """
    actions_json = json.dumps(actions, ensure_ascii=False)

    if kind == "notice":
        conn.execute(
            "INSERT INTO attention (correlation_id, kind, text, actions_json, received_at)"
            " VALUES (?, ?, ?, ?, ?)",
            (correlation_id, kind, text, actions_json, received_at),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM attention WHERE seq = last_insert_rowid()"
        ).fetchone()
        return _item(row), True

    cursor = conn.execute(
        "INSERT OR IGNORE INTO attention (correlation_id, kind, text, actions_json, received_at)"
        " VALUES (?, ?, ?, ?, ?)",
        (correlation_id, kind, text, actions_json, received_at),
    )
    created = cursor.rowcount == 1
    conn.commit()

    stored = get_item(conn, correlation_id)
    if stored is None:  # pragma: no cover - the insert either landed or a row existed
        raise sqlite3.IntegrityError(f"{correlation_id}: neither stored nor found")
    return stored, created


def record_ruling(
    conn: sqlite3.Connection,
    correlation_id: str,
    ruling: str,
    at: str,
) -> None:
    """Write the `BridgeOutcome` string `handle_relay` returned, verbatim.

    Question rows only, and the only code path that writes `last_ruling` at all
    (data-model.md invariant 4).  Nothing is interpreted here: an unknown
    ruling is stored as itself, because the pane renders the factory's word and
    never its meaning.  No row is deleted and no other column is touched
    (FR-009).
    """
    conn.execute(
        "UPDATE attention SET last_ruling = ?, last_ruling_at = ?"
        " WHERE correlation_id = ? AND kind = 'question'",
        (ruling, at, correlation_id),
    )
    conn.commit()


def record_press(
    conn: sqlite3.Connection,
    correlation_id: str,
    choice: str,
    signal_state: str,
    at: str,
) -> None:
    """Write what one press produced: the choice sent, and accepted or SIGNAL_FAILED.

    Escalation rows only, and the only code path that writes `signal_state`.  A
    signal returns nothing, so these two words are everything a press can ever
    say — the pane mints no ruling for one (FR-010).  No row is deleted.
    """
    if signal_state not in ("accepted", "SIGNAL_FAILED"):
        raise ValueError(f"a press produces 'accepted' or 'SIGNAL_FAILED', not {signal_state!r}")

    conn.execute(
        "UPDATE attention SET pressed_choice = ?, signal_state = ?, signalled_at = ?"
        " WHERE correlation_id = ? AND kind = 'escalation'",
        (choice, signal_state, at, correlation_id),
    )
    conn.commit()


def get_item(conn: sqlite3.Connection, correlation_id: str) -> StoredItem | None:
    """Return the earliest stored item for `correlation_id`, or None."""
    row = conn.execute(
        "SELECT * FROM attention WHERE correlation_id = ? ORDER BY seq LIMIT 1",
        (correlation_id,),
    ).fetchone()
    return _item(row) if row is not None else None


def list_items(conn: sqlite3.Connection) -> list[StoredItem]:
    """Return every stored item in arrival order."""
    rows = conn.execute("SELECT * FROM attention ORDER BY seq").fetchall()
    return [_item(row) for row in rows]


def _item(row: sqlite3.Row) -> StoredItem:
    return StoredItem(
        seq=row["seq"],
        correlation_id=row["correlation_id"],
        kind=row["kind"],
        text=row["text"],
        actions=json.loads(row["actions_json"]),
        received_at=row["received_at"],
        last_ruling=row["last_ruling"],
        last_ruling_at=row["last_ruling_at"],
        pressed_choice=row["pressed_choice"],
        signal_state=row["signal_state"],
        signalled_at=row["signalled_at"],
    )
