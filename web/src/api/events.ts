/**
 * Typed SSE consumer for the pane's event stream.
 *
 * 001 defined one type, `floor`. Spec 003 adds `attention`, pushed in the same
 * handling as the intake storage that admitted it. Unknown types and malformed
 * payloads are still ignored silently.
 *
 * The `onAttention` argument is OPTIONAL (plan D-P14): every landed call site
 * compiles unchanged under `strict`, and a subscriber that passes none drops
 * `attention` events exactly as it drops a type it has never heard of.
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
  }
}

/**
 * Apply one `attention` event to a floor document by upserting on `item.id`.
 *
 * A later `floor` event replaces the whole attention section, so nothing drifts:
 * the stream is the fast path, the poll is the correction.
 */
export function upsertAttention(
  doc: FloorDocument,
  item: AttentionItem,
): FloorDocument {
  const items = doc.attention.items;
  const at = items.findIndex((existing) => existing.id === item.id);
  const next = at === -1 ? [...items, item] : items.map((e, i) => (i === at ? item : e));
  return { ...doc, attention: { ...doc.attention, items: next } };
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

  const attentionHandler = (event: MessageEvent) => {
    handleEvent(event.data, onFloor, onAttention);
  };

  const messageHandler = (event: MessageEvent) => {
    handleEvent(event.data, onFloor, onAttention);
  };

  source.addEventListener("floor", namedHandler);
  source.addEventListener("attention", attentionHandler);
  source.addEventListener("message", messageHandler);

  return () => {
    source.removeEventListener("floor", namedHandler);
    source.removeEventListener("attention", attentionHandler);
    source.removeEventListener("message", messageHandler);
    source.close();
  };
}
