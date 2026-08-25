/**
 * The SSE consumer applies `attention` events by upsert (spec 003 US1-S1).
 *
 * 001's vocabulary was one type; this proves the second one lands without
 * disturbing the first, and that a type neither of them knows still changes
 * nothing (001 FR-016).
 */

import { describe, expect, it, vi } from "vitest";
import { handleEvent, upsertAttention } from "../../src/api/events";
import type { AttentionItem, FloorDocument } from "../../src/api/floorDocument";

const waiting: AttentionItem["settlement"] = {
  state: "waiting",
  ruling: null,
  signal: null,
  pressed_choice: null,
  resolution: null,
};

const emptyDocument: FloorDocument = {
  reference_instant: null,
  floor: { seam: "factory.cli.status.collect_floor", data: null },
  epics: [],
  attention: { seam: "attention", items: [] },
  health: { seam: "health", data: null },
  spend_to_date: { seam: "spend", data: null },
  degraded: [],
};

function item(overrides: Partial<AttentionItem> = {}): AttentionItem {
  return {
    id: "800ee6b4c7df",
    kind: "question",
    correlation_id: "800ee6b4c7df",
    text: "I hit a fork on how the questions table should key its rows.",
    actions: [],
    expires_at: null,
    settlement: waiting,
    degraded: null,
    ...overrides,
  };
}

/** A subscriber that holds a document the way the Desk does. */
function subscriber() {
  let doc: FloorDocument | null = null;
  return {
    get doc(): FloorDocument | null {
      return doc;
    },
    onFloor: (next: FloorDocument) => {
      doc = next;
    },
    onAttention: (next: AttentionItem) => {
      doc = doc ? upsertAttention(doc, next) : doc;
    },
  };
}

function feed(sub: ReturnType<typeof subscriber>, type: string, data: unknown): void {
  handleEvent(JSON.stringify({ type, data }), sub.onFloor, sub.onAttention);
}

describe("attention events reach the Desk's list", () => {
  it("upserts a new id, updates an existing one, and ignores an unknown type", () => {
    const sub = subscriber();

    feed(sub, "floor", emptyDocument);
    expect(sub.doc?.attention.items).toHaveLength(0);

    const question = item();
    feed(sub, "attention", question);
    expect(sub.doc?.attention.items).toHaveLength(1);
    expect(sub.doc?.attention.items[0]).toEqual(question);

    const escalation = item({
      id: "d10263341dac",
      kind: "escalation",
      correlation_id: "d10263341dac",
      text: "⚠️ Verification escalation",
      actions: [{ label: "🛑 Kill the node", payload: "esc:d10263341dac:KILL" }],
      expires_at: "2026-08-22T17:56:11Z",
    });
    feed(sub, "attention", escalation);
    expect(sub.doc?.attention.items).toHaveLength(2);

    // Same id, new content: the item is replaced in place, not appended.
    const updated = item({ text: "the same question, re-delivered" });
    feed(sub, "attention", updated);
    expect(sub.doc?.attention.items).toHaveLength(2);
    expect(sub.doc?.attention.items[0].text).toBe("the same question, re-delivered");
    expect(sub.doc?.attention.items[1].id).toBe("d10263341dac");

    const before = sub.doc;
    feed(sub, "landing", { anything: true });
    expect(sub.doc).toBe(before);
  });

  it("a later floor event replaces the whole section, so nothing drifts", () => {
    const sub = subscriber();
    feed(sub, "floor", emptyDocument);
    feed(sub, "attention", item());
    expect(sub.doc?.attention.items).toHaveLength(1);

    feed(sub, "floor", emptyDocument);
    expect(sub.doc?.attention.items).toHaveLength(0);
  });

  it("a subscriber that passes no attention callback drops the event", () => {
    const onFloor = vi.fn();
    expect(() =>
      handleEvent(JSON.stringify({ type: "attention", data: item() }), onFloor),
    ).not.toThrow();
    expect(onFloor).toHaveBeenCalledTimes(0);
  });
});
