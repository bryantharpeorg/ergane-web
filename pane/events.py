"""Typed SSE event stream for the pane.

Each subscriber gets its own ``floor_events`` generator.  The app holds no
shared snapshot; a reconnecting client receives a full floor document as its
first event (001 FR-018), and no event is ever cached (001 R-007).

Spec 003 adds one type to the vocabulary: ``attention``, pushed by intake in the
same handling as the storage that admitted it.  One ``GET /api/events``
subscription carries both types, and a consumer that ignores unknown types is
unaffected by the addition (001 FR-016).
"""

import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from pane.readers import Reader


EVENT_TYPES = ("floor", "attention")


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
) -> Any:
    """Yield typed ``{type, data}`` events until the subscriber disconnects.

    The first event is produced immediately so a fresh subscription starts with
    a full snapshot.  Between polls the generator waits on its own broadcaster
    queue with the remaining poll interval as the timeout, yielding every
    ``attention`` envelope it receives as it arrives.
    """
    from pane.floor_document import assemble_floor_document

    queue = broadcaster.subscribe() if broadcaster is not None else None
    try:
        while True:
            document = await assemble_floor_document(reader, reference_instant=reference_instant)
            yield {"type": "floor", "data": document}

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
