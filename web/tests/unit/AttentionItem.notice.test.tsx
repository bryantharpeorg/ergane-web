import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
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

const noticeItem: AttentionItem = {
  id: "notice:1",
  kind: "notice",
  correlation_id: "supervision",
  text: "ergane supervision: temporal — not reachable on 127.0.0.1:7233 (for 1m 35s)",
  actions: [],
  expires_at: null,
  settlement: { state: "none", ruling: null, signal: null, pressed_choice: null, resolution: null },
  degraded: null,
};

describe("Notice AttentionItem rendering", () => {
  it("renders kind word, no clock, verbatim text, and zero controls", () => {
    const { container } = render(
      <AttentionItemView item={noticeItem} doc={baseDoc} />,
    );

    expect(container.textContent).toContain("Notice");
    expect(container.textContent).toContain("no clock");
    expect(container.textContent).toContain(noticeItem.text);
    expect(container.textContent).toContain("Asks for nothing; no answer exists.");

    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(container.querySelectorAll("textarea")).toHaveLength(0);
    expect(container.querySelectorAll("select")).toHaveLength(0);
    expect(container.querySelectorAll("form")).toHaveLength(0);
  });
});
