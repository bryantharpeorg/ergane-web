import { describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import recorded from "../../../fixtures/webhook/notice-supervision.json";
import AttentionItemView from "../../src/desk/AttentionItem";
import type { AttentionItem, FloorDocument } from "../../src/api/floorDocument";

const baseDoc: FloorDocument = {
  reference_instant: null,
  floor: { seam: "test", data: null },
  epics: [],
  attention: { seam: "test", items: [] },
  health: { seam: "test", data: null },
  spend_to_date: { seam: "test", data: null },
  degraded: [],
};

// `recorded` is the committed delivery itself, imported rather than typed out
// here: the text this asserts is rendered verbatim is the factory's own bytes
// (constitution V).

const noticeItem: AttentionItem = {
  id: "notice:1",
  kind: "notice",
  correlation_id: recorded.correlation_id,
  text: recorded.text,
  actions: recorded.actions,
  expires_at: null,
  settlement: { state: "none", ruling: null, signal: null, pressed_choice: null, resolution: null },
  degraded: null,
};

async function renderToBody(item: AttentionItem, doc: FloorDocument) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(AttentionItemView, { item, doc }));
    await Promise.resolve();
  });
  return container;
}

describe("Notice AttentionItem rendering", () => {
  it("renders the recorded payload as a Notice", () => {
    // The recording is the supervision alert the spec names: a non-12-hex
    // correlation id with no actions.
    expect(recorded.correlation_id).toBe("supervision");
    expect(recorded.actions).toEqual([]);
    expect(/^[0-9a-f]{12}$/.test(recorded.correlation_id)).toBe(false);
  });

  it("renders kind word, no clock, verbatim text, and zero controls", async () => {
    const container = await renderToBody(noticeItem, baseDoc);

    try {
      expect(container.textContent).toContain("Notice");
      expect(container.textContent).toContain("no clock");
      expect(container.textContent).toContain(recorded.text);
      expect(container.textContent).toContain("Asks for nothing; no answer exists.");

      // Low rank, aqua stripe (DESIGN.md § Colors › The Attention Ranking Rule).
      const article = container.querySelector("article");
      expect(article?.className).toContain("low");
      expect(article?.getAttribute("data-kind")).toBe("notice");

      // No settlement state and no clock are rendered for a Notice.
      expect(container.querySelector(".clock")).toBeNull();
      expect(container.textContent).not.toContain("no deadline from the factory");

      expect(container.querySelectorAll("button")).toHaveLength(0);
      expect(container.querySelectorAll("input")).toHaveLength(0);
      expect(container.querySelectorAll("textarea")).toHaveLength(0);
      expect(container.querySelectorAll("select")).toHaveLength(0);
      expect(container.querySelectorAll("form")).toHaveLength(0);
      expect(container.querySelectorAll("a")).toHaveLength(0);
    } finally {
      document.body.removeChild(container);
    }
  });
});
