import { describe, expect, it } from "vitest";
import { handleEvent, upsertAttentionItem } from "../../src/api/events";
import type { AttentionItem, FloorDocument } from "../../src/api/floorDocument";

function floorDoc(id: string): FloorDocument {
  return {
    reference_instant: null,
    floor: { seam: "test", data: null },
    epics: [],
    attention: {
      seam: "test",
      items: [
        {
          id,
          kind: "question",
          correlation_id: id,
          text: "initial",
          actions: [],
          expires_at: null,
          settlement: { state: "waiting", ruling: null, signal: null, pressed_choice: null, resolution: null },
          degraded: null,
        },
      ],
    },
    health: { seam: "test", data: null },
    spend_to_date: { seam: "test", data: null },
    degraded: [],
  };
}

function attentionItem(id: string, text: string): AttentionItem {
  return {
    id,
    kind: "escalation",
    correlation_id: id,
    text,
    actions: [{ label: "Kill", payload: `esc:${id}:KILL` }],
    expires_at: null,
    settlement: { state: "waiting", ruling: null, signal: null, pressed_choice: null, resolution: null },
    degraded: null,
  };
}

/**
 * Drive the production consumer the way `Desk.tsx` does: `onFloor` replaces the
 * document, `onAttention` applies the shipped `upsertAttentionItem`. The test
 * defines no upsert of its own, so what it proves is the code that ships.
 */
function subscriber() {
  let doc: FloorDocument | null = null;
  const feed = (envelope: unknown) =>
    handleEvent(
      JSON.stringify(envelope),
      (d) => {
        doc = d;
      },
      (item) => {
        if (doc !== null) doc = upsertAttentionItem(doc, item);
      },
    );
  return {
    feed,
    get items(): AttentionItem[] {
      return doc === null ? [] : doc.attention.items;
    },
    get doc(): FloorDocument | null {
      return doc;
    },
  };
}

describe("SSE attention event handling", () => {
  it("applies floor and attention events by upserting on id", () => {
    const sub = subscriber();

    sub.feed({ type: "floor", data: floorDoc("q1") });
    expect(sub.items).toHaveLength(1);
    expect(sub.items[0].text).toBe("initial");

    // A new id appends.
    sub.feed({ type: "attention", data: attentionItem("e2", "new") });
    expect(sub.items).toHaveLength(2);
    expect(sub.items[1].id).toBe("e2");

    // An existing id replaces in place, without growing or reordering the list.
    const updated = { ...attentionItem("q1", "updated"), kind: "question" as const, actions: [] };
    sub.feed({ type: "attention", data: updated });
    expect(sub.items).toHaveLength(2);
    expect(sub.items[0].id).toBe("q1");
    expect(sub.items[0].text).toBe("updated");
    expect(sub.items[1].id).toBe("e2");

    // An unknown type changes nothing (001 FR-016).
    sub.feed({ type: "unknown", data: { ignored: true } });
    expect(sub.items).toHaveLength(2);
    expect(sub.items[0].text).toBe("updated");

    // A later `floor` event replaces the whole attention section.
    sub.feed({ type: "floor", data: floorDoc("q1") });
    expect(sub.items).toHaveLength(1);
    expect(sub.items[0].text).toBe("initial");
  });

  it("drops attention events when no onAttention callback is provided", () => {
    let doc: FloorDocument | null = null;
    const onFloor = (d: FloorDocument) => {
      doc = d;
    };

    handleEvent(JSON.stringify({ type: "floor", data: floorDoc("q1") }), onFloor);
    handleEvent(JSON.stringify({ type: "attention", data: attentionItem("e2", "new") }), onFloor);
    expect(doc!.attention.items).toHaveLength(1);
  });

  it("upserts without mutating the document it was handed", () => {
    const before = floorDoc("q1");
    const originalItems = before.attention.items;

    const after = upsertAttentionItem(before, attentionItem("e2", "new"));

    expect(after).not.toBe(before);
    expect(after.attention.items).toHaveLength(2);
    // The caller's document is untouched, so React sees a genuinely new reference.
    expect(before.attention.items).toBe(originalItems);
    expect(before.attention.items).toHaveLength(1);
  });

  it("ignores a malformed payload rather than throwing", () => {
    const sub = subscriber();
    sub.feed({ type: "floor", data: floorDoc("q1") });

    handleEvent("{not json", () => {}, () => {});
    expect(sub.items).toHaveLength(1);
  });
});
