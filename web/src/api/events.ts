/**
 * Typed SSE consumer for the pane's event stream.
 *
 * Handles two committed event types — `floor` and `attention` — and silently
 * ignores any unknown type or malformed payload. The `onAttention` argument is
 * optional (plan.md D-P14), so every landed call site compiles unchanged under
 * `strict` and a subscriber that passes none drops `attention` events exactly
 * as it drops an unknown type.
 */

import type { AttentionItem, FloorDocument } from "./floorDocument";

/**
 * Apply one `attention` event to a floor document, upserting on `item.id`.
 *
 * Returns a new document (new attention section, new items array) so React sees
 * a changed reference. A later `floor` event replaces the whole attention
 * section, so nothing is lost when the stream and the poll disagree.
 */
export function upsertAttentionItem(
  doc: FloorDocument,
  item: AttentionItem,
): FloorDocument {
  const items = doc.attention.items;
  const index = items.findIndex((existing) => existing.id === item.id);
  const next = index === -1 ? [...items, item] : items.map((existing, i) => (i === index ? item : existing));

  return { ...doc, attention: { ...doc.attention, items: next } };
}

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
