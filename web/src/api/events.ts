/**
 * Typed SSE consumer for the pane's event stream.
 *
 * Handles the one committed event type (`floor`) and silently ignores any
 * unknown type or malformed payload. The optional third argument is reserved
 * for spec 003's `attention` event; leaving it off keeps 001/002 call sites
 * compiling unchanged.
 */

import type { FloorDocument } from "./floorDocument";

export function handleEvent(
  raw: string,
  onFloor: (doc: FloorDocument) => void,
): void {
  let envelope: { type?: string; data?: unknown };
  try {
    envelope = JSON.parse(raw);
  } catch {
    return;
  }

  if (envelope.type !== "floor") {
    return;
  }

  onFloor(envelope.data as FloorDocument);
}

export function subscribeFloor(
  url: string,
  onFloor: (doc: FloorDocument) => void,
): () => void {
  const source = new EventSource(url);

  const namedHandler = (event: MessageEvent) => {
    handleEvent(event.data, onFloor);
  };

  const messageHandler = (event: MessageEvent) => {
    handleEvent(event.data, onFloor);
  };

  source.addEventListener("floor", namedHandler);
  source.addEventListener("message", messageHandler);

  return () => {
    source.removeEventListener("floor", namedHandler);
    source.removeEventListener("message", messageHandler);
    source.close();
  };
}
