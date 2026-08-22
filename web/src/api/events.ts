/**
 * Typed SSE consumer for the pane's event stream.
 *
 * Handles the one committed event type (`floor`) and silently ignores any
 * unknown type or malformed payload. The optional third argument is reserved
 * for spec 003's `attention` event; leaving it off keeps 001/002 call sites
 * compiling unchanged.
 */

import type { AttentionItem, FloorDocument } from "./floorDocument";

export function handleEvent(
  raw: string,
  onFloor: (doc: FloorDocument) => void,
  onAttention?: (item: AttentionItem) => void,
): void {
  let envelope: { type?: string; data?: unknown };
  try {
    envelope = JSON.parse(raw);
  } catch {
    return;
  }

  if (envelope.type === "floor") {
    onFloor(envelope.data as FloorDocument);
    return;
  }

  if (envelope.type === "attention" && onAttention) {
    onAttention(envelope.data as AttentionItem);
    return;
  }

  // Unknown types are silently ignored (001 FR-016).
}

export function subscribeFloor(
  url: string,
  onFloor: (doc: FloorDocument) => void,
  onAttention?: (item: AttentionItem) => void,
): () => void {
  const source = new EventSource(url);

  const namedHandler = (event: MessageEvent) => {
    handleEvent(event.data, onFloor, onAttention);
  };

  const messageHandler = (event: MessageEvent) => {
    handleEvent(event.data, onFloor, onAttention);
  };

  source.addEventListener("floor", namedHandler);
  source.addEventListener("message", messageHandler);

  return () => {
    source.removeEventListener("floor", namedHandler);
    source.removeEventListener("message", messageHandler);
    source.close();
  };
}
