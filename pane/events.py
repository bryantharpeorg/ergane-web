"""Typed SSE event stream for the pane.

Each subscriber gets its own ``floor_events`` generator.  The app holds no
shared snapshot; a reconnecting client receives a full floor document as its
first event (FR-018).
"""

import asyncio
from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from pane.readers import Reader


EVENT_TYPES = ("floor",)


async def floor_events(
    reader: "Reader",
    *,
    interval_s: float,
    reference_instant: str | None = None,
    should_stop: Callable[[], Awaitable[bool]] | None = None,
) -> Any:
    """Yield typed ``{type, data}`` floor snapshots until the subscriber disconnects.

    The first event is produced immediately so a fresh subscription starts with
    a full snapshot.  After each event the generator sleeps for ``interval_s``
    seconds and polls again.
    """
    from pane.floor_document import assemble_floor_document

    while True:
        document = await assemble_floor_document(reader, reference_instant=reference_instant)
        yield {"type": "floor", "data": document}

        await asyncio.sleep(interval_s)

        if should_stop is not None and await should_stop():
            return
