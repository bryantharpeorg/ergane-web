/**
 * Rank comes from the backend's settlement state and from nothing local
 * (spec 003 US2-S6, FR-009).
 *
 * The point of these cases is negative as much as positive: the only input that
 * moves an item is its `settlement`, which the backend derives from the ruling
 * `handle_relay` returned or the `resolution` a factory read carries. A pane
 * that reordered on a press — that "helpfully" sank an item the operator had
 * just answered — would be settling something itself, which is exactly what
 * D-001 forbids and what the pane has no standing to do.
 */

import { describe, expect, it } from "vitest";
import { rankAttention } from "../../src/desk/rank";
import type { AttentionItem, AttentionSettlement } from "../../src/api/floorDocument";

function settlement(state: AttentionSettlement["state"]): AttentionSettlement {
  return { state, ruling: null, signal: null, pressed_choice: null, resolution: null };
}

function item(
  id: string,
  kind: AttentionItem["kind"],
  state: AttentionSettlement["state"],
): AttentionItem {
  return {
    id,
    kind,
    correlation_id: id,
    text: "",
    actions: [],
    expires_at: null,
    settlement: settlement(state),
    degraded: null,
  };
}

const ids = (items: AttentionItem[]) => items.map((i) => i.id);

describe("rankAttention", () => {
  it("orders waiting and ruled first, then in flight, then settled", () => {
    const items = [
      item("settled", "question", "settled"),
      item("in-flight", "question", "in_flight"),
      item("ruled", "question", "ruled"),
      item("waiting", "question", "waiting"),
    ];

    expect(ids(rankAttention(items))).toEqual(["ruled", "waiting", "in-flight", "settled"]);
  });

  it("keeps a ruled item in the waiting rank beside a waiting one", () => {
    // Every ruling but RESOLVED leaves the item where it was: UNKNOWN, EXPIRED,
    // UNAUTHORIZED, ALREADY_RESOLVED, or a SIGNAL_FAILED press.
    const items = [item("waiting", "question", "waiting"), item("ruled", "question", "ruled")];
    const ranked = rankAttention(items);

    expect(ranked.map((i) => i.settlement.state)).toEqual(["waiting", "ruled"]);
    expect(ids(ranked)).toEqual(["waiting", "ruled"]);
  });

  it("puts Escalation before Question before Notice inside one rank", () => {
    const items = [
      item("notice", "notice", "none"),
      item("question", "question", "waiting"),
      item("escalation", "escalation", "waiting"),
    ];

    expect(ids(rankAttention(items))).toEqual(["escalation", "question", "notice"]);
  });

  it("ranks by state before kind, so a settled Escalation sinks below a waiting Notice", () => {
    const items = [
      item("settled-escalation", "escalation", "settled"),
      item("waiting-notice", "notice", "none"),
    ];

    expect(ids(rankAttention(items))).toEqual(["waiting-notice", "settled-escalation"]);
  });

  it("moves nothing when the settlement did not change", () => {
    // A locally pending answer is not an input here at all: the same items,
    // handed back unchanged, come out in the same order. Only the backend
    // saying something different moves anything.
    const items = [
      item("a", "escalation", "waiting"),
      item("b", "escalation", "waiting"),
      item("c", "question", "waiting"),
      item("d", "notice", "none"),
    ];

    expect(ids(rankAttention(items))).toEqual(["a", "b", "c", "d"]);
    expect(ids(rankAttention(rankAttention(items)))).toEqual(["a", "b", "c", "d"]);
  });

  it("moves an item only when its settlement state changed", () => {
    const before = [
      item("a", "escalation", "waiting"),
      item("b", "escalation", "waiting"),
      item("c", "question", "waiting"),
    ];
    expect(ids(rankAttention(before))).toEqual(["a", "b", "c"]);

    // The factory reported a resolution for "a", and only then does it sink.
    const after = before.map((i) => (i.id === "a" ? item("a", "escalation", "settled") : i));
    expect(ids(rankAttention(after))).toEqual(["b", "c", "a"]);
  });

  it("returns a new array and leaves the one it was given alone", () => {
    const items = [
      item("settled", "question", "settled"),
      item("waiting", "question", "waiting"),
    ];
    const ranked = rankAttention(items);

    expect(ranked).not.toBe(items);
    expect(ids(items)).toEqual(["settled", "waiting"]);
  });
});
