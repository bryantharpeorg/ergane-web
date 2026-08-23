/**
 * A `window.EventSource` replacement for vitest.
 *
 * jsdom implements no EventSource at all, so a room's subscription is inert
 * under unit test and a test can neither drive it nor prove there is only one.
 * This double stands in for it: it records every source that was opened and
 * exposes `emit(type, data)`, which dispatches a `MessageEvent` carrying 001's
 * `{type, data}` envelope as `web/src/api/events.ts` consumes it — on the
 * named channel, the way an SSE `event: floor` frame arrives — plus
 * `emitOnMessageChannel`, which sends the same envelope down the unnamed
 * `message` channel the consumer also listens on.
 */

export class EventSourceDouble {
  readonly url: string;
  closed = false;
  private readonly target = new EventTarget();

  constructor(url: string) {
    this.url = url;
    openedSources.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    this.target.addEventListener(type, listener as EventListener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void): void {
    this.target.removeEventListener(type, listener as EventListener);
  }

  close(): void {
    this.closed = true;
  }

  /** Dispatch `{type, data}` on the named channel, as a typed SSE frame does. */
  emit(type: string, data: unknown): void {
    this.target.dispatchEvent(
      new MessageEvent(type, { data: JSON.stringify({ type, data }) }),
    );
  }

  /** Dispatch the same envelope on the unnamed `message` channel. */
  emitOnMessageChannel(type: string, data: unknown): void {
    this.target.dispatchEvent(
      new MessageEvent("message", { data: JSON.stringify({ type, data }) }),
    );
  }
}

/** Every source opened since the double was installed, in order. */
export const openedSources: EventSourceDouble[] = [];

/** Install the double; the returned function restores what was there before. */
export function installEventSourceDouble(): () => void {
  const holder = globalThis as unknown as { EventSource?: unknown };
  const original = holder.EventSource;
  openedSources.length = 0;
  holder.EventSource = EventSourceDouble;

  return () => {
    if (original === undefined) {
      delete holder.EventSource;
    } else {
      holder.EventSource = original;
    }
    openedSources.length = 0;
  };
}
