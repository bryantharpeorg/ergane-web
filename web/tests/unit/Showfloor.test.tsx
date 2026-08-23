import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Showfloor from "../../src/showfloor/Showfloor";
import type { FloorDocument } from "../../src/api/floorDocument";

import workgraph077 from "../../../fixtures/workgraphs/077-a-scanner-the-operator-chooses-runs-in-the-loop.json?raw";
import { stageFromWorkgraph } from "./support/stage-builder";

vi.mock("@xyflow/react", () => import("./support/xyflow-double"));

const baseDoc: FloorDocument = {
  reference_instant: null,
  floor: { seam: "floor", data: { epics: [], queue: [], drafts: [] } },
  epics: [],
  attention: { seam: "attention", items: [] },
  health: { seam: "health", data: null },
  spend_to_date: { seam: "spend", data: null },
  degraded: [],
};

describe("Showfloor", () => {
  it("renders quiet floor and no epic-stage when zero epics run", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => baseDoc });

    await act(async () => {
      createRoot(container).render(<Showfloor />);
      await Promise.resolve();
    });

    expect(container.querySelector("[data-quiet-floor]")).not.toBeNull();
    expect(container.querySelector("[data-quiet-floor]")?.textContent?.toLowerCase()).toContain("quiet");
    expect(container.querySelector("[data-epic-stage]")).toBeNull();

    document.body.removeChild(container);
  });

  it("renders one epic-stage per running epic and no quiet floor", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const stage = stageFromWorkgraph(workgraph077, {
      us1: { state: "PENDING", attempt: 1, awaiting_operator: false, landing_state: null },
      us2: { state: "PENDING", attempt: 1, awaiting_operator: false, landing_state: null },
      us3: { state: "RUNNING", attempt: 1, awaiting_operator: false, landing_state: null },
      us4: { state: "VERIFYING", attempt: 1, awaiting_operator: false, landing_state: null },
      us5: { state: "PASSED", attempt: 1, awaiting_operator: false, landing_state: null },
    });

    const doc: FloorDocument = {
      ...baseDoc,
      epics: [
        {
          epic_id: "077-a-scanner-the-operator-chooses-runs-in-the-loop",
          workflow_id: "epic-077-a-scanner-the-operator-chooses-runs-in-the-loop",
          scene: null,
          epic_state: "RUNNING",
          nodes: [],
          stage,
          status_seam: "epic_status",
          workgraph_seam: "workgraph",
        },
        {
          epic_id: "002-expense-notes",
          workflow_id: "epic-002-expense-notes",
          scene: null,
          epic_state: "RUNNING",
          nodes: [],
          stage: { ...stage, epic_id: "002-expense-notes" },
          status_seam: "epic_status",
          workgraph_seam: "workgraph",
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => doc });

    await act(async () => {
      createRoot(container).render(<Showfloor />);
      await Promise.resolve();
    });

    expect(container.querySelectorAll("[data-epic-stage]").length).toBe(2);
    expect(container.querySelector("[data-quiet-floor]")).toBeNull();

    document.body.removeChild(container);
  });
});
