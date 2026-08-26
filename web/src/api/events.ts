/**
 * Typed SSE consumer for the pane's event stream.
 *
 * 001 defined one type, `floor`. Spec 003 adds `attention`, pushed in the same
 * handling as the intake storage that admitted it. 005 adds `showfloor`, one
 * event per *rail entry* the backend re-assembled and found changed — not a
 * whole document (`pane/events.py`). Unknown types and malformed payloads are
 * still ignored silently.
 *
 * 006 US2 (T005) puts the third type to work at the Desk. The floor section's
 * ladders and chips are the showfloor document's own objects, so the Desk
 * subscribes to the same stream it already had open rather than opening a
 * second one, and the two rooms cannot drift apart between polls (FR-005).
 *
 * The `onAttention` and `onShowfloor` arguments are OPTIONAL (plan D-P14):
 * every landed call site compiles unchanged under `strict`, and a subscriber
 * that passes none drops those events exactly as it drops a type it has never
 * heard of.
 */

import type { AttentionItem, FloorDocument } from "./floorDocument";
import type { RailEntry, ShowfloorDocument } from "./showfloorDocument";

export function handleEvent(
  raw: string,
  onFloor: (doc: FloorDocument) => void,
  onAttention?: (item: AttentionItem) => void,
  onShowfloor?: (entry: RailEntry) => void,
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

  if (envelope.type === "showfloor" && onShowfloor) {
    onShowfloor(envelope.data as RailEntry);
  }
}

/**
 * Apply one `showfloor` event to a showfloor document by upserting on
 * `spec_dir`.
 *
 * The event carries one rail entry, so the upsert is the whole join: the entry
 * the backend just re-assembled replaces the one of the same spec, in place, and
 * a spec the document did not carry is appended rather than dropped. Nothing
 * here reads a ladder, and nothing here derives one — the entry is stored as it
 * arrived (FR-005).
 */
export function upsertRailEntry(
  doc: ShowfloorDocument,
  entry: RailEntry,
): ShowfloorDocument {
  const rail = doc.rail;
  const at = rail.findIndex((existing) => existing.spec_dir === entry.spec_dir);
  const next = at === -1 ? [...rail, entry] : rail.map((e, i) => (i === at ? entry : e));
  return { ...doc, rail: next };
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
  onShowfloor?: (entry: RailEntry) => void,
): () => void {
  const source = new EventSource(url);

  const namedHandler = (event: MessageEvent) => {
    handleEvent(event.data, onFloor, onAttention, onShowfloor);
  };

  const attentionHandler = (event: MessageEvent) => {
    handleEvent(event.data, onFloor, onAttention, onShowfloor);
  };

  // The third named channel, on the one subscription the room already has: a
  // second `EventSource` for the Desk's ladders would be a second poll of the
  // same backend for the same instant (005 FR-005).
  const showfloorHandler = (event: MessageEvent) => {
    handleEvent(event.data, onFloor, onAttention, onShowfloor);
  };

  const messageHandler = (event: MessageEvent) => {
    handleEvent(event.data, onFloor, onAttention, onShowfloor);
  };

  source.addEventListener("floor", namedHandler);
  source.addEventListener("attention", attentionHandler);
  source.addEventListener("showfloor", showfloorHandler);
  source.addEventListener("message", messageHandler);

  return () => {
    source.removeEventListener("floor", namedHandler);
    source.removeEventListener("attention", attentionHandler);
    source.removeEventListener("showfloor", showfloorHandler);
    source.removeEventListener("message", messageHandler);
    source.close();
  };
}
