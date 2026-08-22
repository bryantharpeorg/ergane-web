import { describe, expect, it, vi } from "vitest";
import { handleEvent } from "../../src/api/events";
import type { FloorDocument } from "../../src/api/floorDocument";

const minimalDocument: FloorDocument = {
  reference_instant: null,
  floor: { seam: "factory.cli.status.collect_floor", data: null },
  epics: [],
  attention: { seam: "attention", items: [] },
  health: { seam: "health", data: null },
  spend_to_date: { seam: "spend", data: null },
  degraded: [],
};

describe("handleEvent", () => {
  it("calls onFloor once for a floor event", () => {
    const onFloor = vi.fn();
    handleEvent(JSON.stringify({ type: "floor", data: minimalDocument }), onFloor);
    expect(onFloor).toHaveBeenCalledTimes(1);
    expect(onFloor).toHaveBeenCalledWith(minimalDocument);
  });

  it("ignores an attention event without calling onFloor", () => {
    const onFloor = vi.fn();
    handleEvent(JSON.stringify({ type: "attention", data: {} }), onFloor);
    expect(onFloor).toHaveBeenCalledTimes(0);
  });

  it("ignores an unknown event type without calling onFloor", () => {
    const onFloor = vi.fn();
    handleEvent(JSON.stringify({ type: "nope" }), onFloor);
    expect(onFloor).toHaveBeenCalledTimes(0);
  });

  it("ignores malformed JSON without throwing", () => {
    const onFloor = vi.fn();
    expect(() => handleEvent("not json", onFloor)).not.toThrow();
    expect(onFloor).toHaveBeenCalledTimes(0);
  });
});
