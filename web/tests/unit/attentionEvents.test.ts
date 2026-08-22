import { describe, expect, it } from "vitest";
import { handleEvent } from "../../src/api/events";
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

describe("SSE attention event handling", () => {
  it("applies floor and attention events by upserting on id", () => {
    let doc: FloorDocument | null = null;
    const onFloor = (d: FloorDocument) => {
      doc = d;
    };
    const onAttention = (item: AttentionItem) => {
      if (!doc) return;
      const index = doc.attention.items.findIndex((i) => i.id === item.id);
      if (index === -1) {
        doc.attention.items.push(item);
      } else {
        doc.attention.items[index] = item;
      }
    };

    handleEvent(JSON.stringify({ type: "floor", data: floorDoc("q1") }), onFloor);
    expect(doc!.attention.items).toHaveLength(1);
    expect(doc!.attention.items[0].text).toBe("initial");

    handleEvent(JSON.stringify({ type: "attention", data: attentionItem("e2", "new") }), onFloor, onAttention);
    expect(doc!.attention.items).toHaveLength(2);
    expect(doc!.attention.items[1].id).toBe("e2");

    const updated = attentionItem("q1", "updated");
    updated.kind = "question";
    updated.actions = [];
    handleEvent(JSON.stringify({ type: "attention", data: updated }), onFloor, onAttention);
    expect(doc!.attention.items).toHaveLength(2);
    expect(doc!.attention.items[0].text).toBe("updated");

    handleEvent(JSON.stringify({ type: "unknown", data: { ignored: true } }), onFloor, onAttention);
    expect(doc!.attention.items).toHaveLength(2);
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
});
