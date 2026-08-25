"""Typed SSE event stream for the pane.

Each subscriber gets its own ``floor_events`` generator.  The app holds no
shared snapshot; a reconnecting client receives a full floor document as its
first event (001 FR-018), and no event is ever cached (001 R-007).

Spec 003 adds one type to the vocabulary: ``attention``, pushed by intake in the
same handling as the storage that admitted it.  One ``GET /api/events``
subscription carries both types, and a consumer that ignores unknown types is
unaffected by the addition (001 FR-016).

Spec 005 adds the third: ``showfloor``, one event per spec whose rail entry
changed since the previous poll, carrying that entry re-assembled.  Additive the
way ``attention`` was — a consumer written against 001 or 003 sees a type it does
not know and ignores it (005 FR-005).
"""

import asyncio
import time
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from pane.readers import Reader


EVENT_TYPES = ("floor", "attention", "showfloor")


class AttentionBroadcaster:
    """Fans one accepted Attention item out to every open stream, synchronously.

    ``publish`` does not await: intake stores, publishes, and answers, with
    nothing between the commit and the fan-out.  Nothing is cached — a
    subscriber that was not connected reads the item from the attention list
    instead (FR-005).
    """

    def __init__(self) -> None:
        self._subscribers: list[asyncio.Queue] = []

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers.append(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        if queue in self._subscribers:
            self._subscribers.remove(queue)

    def publish(self, item: dict) -> None:
        envelope = {"type": "attention", "data": item}
        for queue in list(self._subscribers):
            queue.put_nowait(envelope)


async def floor_events(
    reader: "Reader",
    *,
    interval_s: float,
    reference_instant: str | None = None,
    should_stop: Callable[[], Awaitable[bool]] | None = None,
    broadcaster: AttentionBroadcaster | None = None,
    specs_root: Path | str | None = None,
) -> Any:
    """Yield typed ``{type, data}`` events until the subscriber disconnects.

    The first event is produced immediately so a fresh subscription starts with
    a full snapshot.  Between polls the generator waits on its own broadcaster
    queue with the remaining poll interval as the timeout, yielding every
    ``attention`` envelope it receives as it arrives.

    ``specs_root`` opts the stream into ``showfloor`` events: each poll
    re-assembles the document and yields one event per rail entry that differs
    from the previous poll's, so a node state changing between two assemblies
    reaches the browser as the changed spec's entry and nothing else.  The first
    poll differs from nothing and so yields every entry — a fresh subscription
    starts with the whole room, the way 001's first ``floor`` event does
    (FR-018).  ``previous`` is this generator's own: no baseline is shared
    between subscribers and nothing is cached across them (001 R-007).
    """
    from pane.floor_document import assemble_floor_document
    from pane.showfloor import ShowfloorReaders, assemble_showfloor

    queue = broadcaster.subscribe() if broadcaster is not None else None
    previous: dict[str, dict] = {}
    try:
        while True:
            document = await assemble_floor_document(reader, reference_instant=reference_instant)
            yield {"type": "floor", "data": document}

            if specs_root is not None:
                showfloor = await assemble_showfloor(
                    specs_root,
                    ShowfloorReaders.from_reader(reader, specs_root),
                    reference_instant=reference_instant,
                )
                for entry in showfloor["rail"]:
                    spec_dir = entry["spec_dir"]
                    if previous.get(spec_dir) != entry:
                        previous[spec_dir] = entry
                        yield {"type": "showfloor", "data": entry}

            deadline = time.monotonic() + interval_s
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                if queue is None:
                    await asyncio.sleep(remaining)
                    break
                try:
                    envelope = await asyncio.wait_for(queue.get(), timeout=remaining)
                except (asyncio.TimeoutError, TimeoutError):
                    break
                yield envelope

            if should_stop is not None and await should_stop():
                return
    finally:
        if queue is not None and broadcaster is not None:
            broadcaster.unsubscribe(queue)
