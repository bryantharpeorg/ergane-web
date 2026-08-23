import { describe, expect, it } from "vitest";
import { layoutStage } from "../../src/showfloor/layout";
import { stageFromWorkgraph } from "./support/stage-builder";

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
