/**
 * A Notice renders and asks for nothing (spec 003 US1-S4).
 *
 * The item is built from the recorded supervision payload — the factory's own
 * words — and the assertion that matters is the absence of every control: a
 * Notice has no settlement state to reach, so a button on one would be a second
 * verb with nowhere to go (constitution I, DESIGN.md § Components › Attention
 * Item).
 */

import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import AttentionItemView from "../../src/desk/AttentionItem";
import type { AttentionItem, FloorDocument } from "../../src/api/floorDocument";

import noticeRaw from "../../../fixtures/webhook/notice-supervision.json?raw";

const recorded = JSON.parse(noticeRaw) as { correlation_id: string; text: string; actions: [] };

const noticeItem: AttentionItem = {
  id: "notice:1",
  kind: "notice",
  correlation_id: recorded.correlation_id,
  text: recorded.text,
  actions: recorded.actions,
  expires_at: null,
  settlement: {
    state: "none",
    ruling: null,
    signal: null,
    pressed_choice: null,
    resolution: null,
  },
  degraded: null,
};

const doc = { reference_instant: "2026-08-22T17:41:27Z" } as FloorDocument;

function render(item: AttentionItem): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    createRoot(container).render(<AttentionItemView item={item} doc={doc} />);
  });
  return container;
}

describe("the Notice kind", () => {
  it("renders the kind word, the no-clock slot, and the delivered text verbatim", () => {
    const container = render(noticeItem);

    const article = container.querySelector("article.item");
    expect(article).not.toBeNull();
    expect(article?.getAttribute("data-kind")).toBe("notice");
    // DESIGN.md § Colors › The Attention Ranking Rule: low rank = aqua.
    expect(article?.className).toContain("low");

    expect(container.querySelector(".kind")?.textContent).toBe("Notice");
    expect(container.querySelector(".no-clock")?.textContent).toBe("no clock");
    expect(container.querySelector(".clock")).toBeNull();
    expect(container.querySelector(".no-deadline")).toBeNull();
    expect(container.querySelector(".until")).toBeNull();

    expect(container.querySelector(".prose")?.textContent).toBe(recorded.text);

    document.body.removeChild(container);
  });

  it("carries the one italic line and not a single control", () => {
    const container = render(noticeItem);

    expect(container.querySelector(".asks-nothing")?.textContent).toBe(
      "Asks for nothing; no answer exists.",
    );

    for (const tag of ["button", "input", "textarea", "select", "form"]) {
      expect(container.querySelectorAll(tag).length).toBe(0);
    }

    document.body.removeChild(container);
  });
});
