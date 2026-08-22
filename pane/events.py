"""Typed SSE event stream for the pane.

Each subscriber gets its own ``floor_events`` generator.  The app holds no
shared snapshot; a reconnecting client receives a full floor document as its
first event (FR-018).

The ``AttentionBroadcaster`` carries `attention` events from intake to every
connected subscriber.  It is created by `create_app()` and drained by
`floor_events()` between poll intervals.
"""

import asyncio
from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from pane.readers import Reader


EVENT_TYPES = ("floor", "attention")


class AttentionBroadcaster:
    """Fan-out channel for `attention` events, scoped to the subscriber queues that exist."""

    def __init__(self) -> None:
        self._queues: set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()

    async def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        async with self._lock:
            self._queues.add(queue)
        return queue

    async def unsubscribe(self, queue: asyncio.Queue) -> None:
        async with self._lock:
            self._queues.discard(queue)

    def publish(self, item: dict) -> None:
        """Publish synchronously to every subscriber queue."""
        envelope = {"type": "attention", "data": item}
        for queue in self._queues:
            queue.put_nowait(envelope)


async def floor_events(
    reader: "Reader",
    *,
    interval_s: float,
    broadcaster: AttentionBroadcaster | None = None,
    reference_instant: str | None = None,
    should_stop: Callable[[], Awaitable[bool]] | None = None,
) -> Any:
    """Yield typed ``{type, data}`` floor snapshots and any `attention` events.

    The first event is produced immediately so a fresh subscription starts with
    a full snapshot.  After each event the generator waits for the next poll
    interval, but also drains the attention broadcaster during that window so
    `attention` events are delivered promptly.
    """
    from pane.floor_document import assemble_floor_document

    queue: asyncio.Queue | None = None
    if broadcaster is not None:
        queue = await broadcaster.subscribe()

    try:
        while True:
            document = await assemble_floor_document(reader, reference_instant=reference_instant)
            yield {"type": "floor", "data": document}

            if should_stop is not None and await should_stop():
                return

            if queue is None:
                await asyncio.sleep(interval_s)
                continue

            timeout = interval_s
            deadline = asyncio.get_event_loop().time() + timeout
            while timeout > 0:
                try:
                    envelope = await asyncio.wait_for(queue.get(), timeout=timeout)
                    yield envelope
                except asyncio.TimeoutError:
                    break
                timeout = deadline - asyncio.get_event_loop().time()
                if should_stop is not None and await should_stop():
                    return
    finally:
        if broadcaster is not None and queue is not None:
            await broadcaster.unsubscribe(queue)
