import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import EpicStage from "../../src/showfloor/EpicStage";
import { stageFromWorkgraph } from "./support/stage-builder";

import workgraph077 from "../../../fixtures/workgraphs/077-a-scanner-the-operator-chooses-runs-in-the-loop.json?raw";

vi.mock("@xyflow/react", () => import("./support/xyflow-double"));

describe("EpicStage", () => {
  it("renders one station per declared node and distinguishes edge kinds", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const stage = stageFromWorkgraph(workgraph077, {
      us1: { state: "PENDING", attempt: 1, awaiting_operator: false, landing_state: null },
      us2: { state: "PENDING", attempt: 1, awaiting_operator: false, landing_state: null },
      us3: { state: "RUNNING", attempt: 1, awaiting_operator: false, landing_state: null },
      us4: { state: "VERIFYING", attempt: 1, awaiting_operator: false, landing_state: null },
      us5: { state: "PASSED", attempt: 1, awaiting_operator: false, landing_state: null },
    });

    act(() => createRoot(container).render(<EpicStage stage={stage} />));

    const stations = container.querySelectorAll("[data-station]");
    expect(stations.length).toBe(5);

    const passEdges = container.querySelectorAll(".edge-pass[data-edge-kind='pass']");
    const mergeEdges = container.querySelectorAll(".edge-merge[data-edge-kind='merge']");
    expect(passEdges.length).toBe(3);
    expect(mergeEdges.length).toBe(1);

    document.body.removeChild(container);
  });

  it("renders a refusal note and no stations when the stage has no nodes", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const stage = {
      epic_id: "fx-landing-f0a0d6",
      nodes: [],
      edges: [],
      notes: [{ read: "epic_status", mode: "refusal", detail: "Query rejected" }],
      degraded: true,
    };

    act(() => createRoot(container).render(<EpicStage stage={stage} />));

    expect(container.querySelectorAll("[data-station]").length).toBe(0);
    const note = container.querySelector("[data-stage-note][data-mode='refusal']");
    expect(note).not.toBeNull();
    expect(note?.textContent).toContain("epic_status");
    expect(note?.textContent).toContain("refusal");

    document.body.removeChild(container);
  });
});
