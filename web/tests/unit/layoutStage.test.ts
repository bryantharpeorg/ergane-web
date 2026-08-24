import { describe, expect, it } from "vitest";
import {
  ROW_SPACING,
  layoutStage,
  rankDepth,
  stageHeight,
} from "../../src/showfloor/layout";
import { stageFromWorkgraph } from "./support/stage-builder";

import workgraph002 from "../../../fixtures/workgraphs/002-expense-notes.json?raw";
import workgraph077 from "../../../fixtures/workgraphs/077-a-scanner-the-operator-chooses-runs-in-the-loop.json?raw";

describe("layoutStage", () => {
  it("places every edge source strictly left of its target", () => {
    const stage = stageFromWorkgraph(workgraph077, {
      us1: { state: "PENDING", attempt: 1, awaiting_operator: false, landing_state: null },
      us2: { state: "PENDING", attempt: 1, awaiting_operator: false, landing_state: null },
      us3: { state: "RUNNING", attempt: 1, awaiting_operator: false, landing_state: null },
      us4: { state: "VERIFYING", attempt: 1, awaiting_operator: false, landing_state: null },
      us5: { state: "PASSED", attempt: 1, awaiting_operator: false, landing_state: null },
    });
    const layout = layoutStage(stage);

    const positions = new Map(layout.nodes.map((n) => [n.id, n.position]));

    for (const edge of stage.edges) {
      const sx = positions.get(edge.source)?.x;
      const tx = positions.get(edge.target)?.x;
      expect(sx).toBeDefined();
      expect(tx).toBeDefined();
      expect(sx).toBeLessThan(tx!);
    }
  });

  it("orders same-rank nodes by declaration order vertically", () => {
    const stage = stageFromWorkgraph(workgraph077, {
      us1: { state: "PENDING", attempt: 1, awaiting_operator: false, landing_state: null },
      us2: { state: "PENDING", attempt: 1, awaiting_operator: false, landing_state: null },
    });
    const layout = layoutStage(stage);

    const us1 = layout.nodes.find((n) => n.id === "us1");
    const us2 = layout.nodes.find((n) => n.id === "us2");

    expect(us1?.position.x).toBe(us2?.position.x);
    expect(us1?.position.y).toBeLessThan(us2?.position.y!);
  });

  it("is deterministic across two calls", () => {
    const stage = stageFromWorkgraph(workgraph077, {
      us1: { state: "PENDING", attempt: 1, awaiting_operator: false, landing_state: null },
      us2: { state: "PENDING", attempt: 1, awaiting_operator: false, landing_state: null },
      us3: { state: "RUNNING", attempt: 1, awaiting_operator: false, landing_state: null },
      us4: { state: "VERIFYING", attempt: 1, awaiting_operator: false, landing_state: null },
      us5: { state: "PASSED", attempt: 1, awaiting_operator: false, landing_state: null },
    });
    const a = layoutStage(stage);
    const b = layoutStage(stage);

    for (const node of a.nodes) {
      const other = b.nodes.find((n) => n.id === node.id);
      expect(other?.position.x).toBe(node.position.x);
      expect(other?.position.y).toBe(node.position.y);
    }
  });
});

/**
 * FR-002 (spec US1-S3): the stage is the size of its graph.
 *
 * Both documents are the Fixture floor's own. `002-expense-notes` declares two
 * stories in a single file — `us2` depends on `us1` merging — so every rank
 * holds one station and the graph is one row deep. `077` declares five, of
 * which `us1` and `us2` are both roots, so its deepest rank holds two and the
 * graph is two rows deep. One row of difference, and the height must move by
 * the one row-spacing figure DESIGN.md names.
 */
describe("stageHeight", () => {
  const two = stageFromWorkgraph(workgraph002);
  const five = stageFromWorkgraph(workgraph077);

  it("reads the rank depth the fixtures actually declare", () => {
    expect(two.nodes.length).toBe(2);
    expect(five.nodes.length).toBe(5);
    expect(rankDepth(two.nodes, two.edges)).toBe(1);
    expect(rankDepth(five.nodes, five.edges)).toBe(2);
  });

  it("moves by the rank delta times the 140px row spacing", () => {
    const shallow = stageHeight(two.nodes, two.edges);
    const deep = stageHeight(five.nodes, five.edges);

    // A constant-height stage — the `height: 300` this story removes — fails
    // here and fails first.
    expect(deep).not.toBe(shallow);

    const delta = rankDepth(five.nodes, five.edges) - rankDepth(two.nodes, two.edges);
    expect(ROW_SPACING).toBe(140);
    expect(deep - shallow).toBe(delta * ROW_SPACING);
    expect(deep - shallow).toBe(140);
  });

  it("does not derive from the viewport", () => {
    const before = stageHeight(five.nodes, five.edges);

    const innerHeight = window.innerHeight;
    const innerWidth = window.innerWidth;
    try {
      Object.defineProperty(window, "innerHeight", { value: 4000, configurable: true });
      Object.defineProperty(window, "innerWidth", { value: 320, configurable: true });
      expect(stageHeight(five.nodes, five.edges)).toBe(before);
    } finally {
      Object.defineProperty(window, "innerHeight", { value: innerHeight, configurable: true });
      Object.defineProperty(window, "innerWidth", { value: innerWidth, configurable: true });
    }
  });

  it("costs an unstaged epic nothing, because it renders no canvas", () => {
    expect(stageHeight([], [])).toBe(0);
  });
});
