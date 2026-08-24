import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import EpicStage from "../../src/showfloor/EpicStage";
import { stageHeight } from "../../src/showfloor/layout";
import { stageFromWorkgraph } from "./support/stage-builder";
import { mountedProps } from "./support/xyflow-double";

import workgraph002 from "../../../fixtures/workgraphs/002-expense-notes.json?raw";
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

describe("EpicStage idle marker", () => {
  function stageOf(states: Record<string, string | null>) {
    const overrides: Record<
      string,
      { state: string | null; attempt: number | null; awaiting_operator: boolean; landing_state: null }
    > = {};
    for (const [id, state] of Object.entries(states)) {
      overrides[id] = {
        state,
        attempt: state === null ? null : 1,
        awaiting_operator: state === "WAITING_OPERATOR",
        landing_state: null,
      };
    }
    return stageFromWorkgraph(workgraph077, overrides);
  }

  function idleOf(states: Record<string, string | null>): string | null {
    const container = document.createElement("div");
    document.body.appendChild(container);
    act(() => createRoot(container).render(<EpicStage stage={stageOf(states)} />));
    const marker = container
      .querySelector("[data-epic-stage]")
      ?.getAttribute("data-idle") ?? null;
    document.body.removeChild(container);
    return marker;
  }

  const SETTLED = { us1: "MERGED", us2: "FAILED", us3: "PENDING", us4: null, us5: "KILLED" };

  it("marks a stage with no node in the live set idle", () => {
    expect(idleOf(SETTLED)).toBe("true");
  });

  it("does not mark a stage carrying a live node idle", () => {
    expect(idleOf({ ...SETTLED, us3: "RUNNING" })).toBe("false");
    expect(idleOf({ ...SETTLED, us3: "WAITING_OPERATOR" })).toBe("false");
    expect(idleOf({ ...SETTLED, us3: "KEY_ISSUED" })).toBe("false");
    expect(idleOf({ ...SETTLED, us3: "VERIFYING" })).toBe("false");
    expect(idleOf({ ...SETTLED, us3: "PASSED" })).toBe("false");
    expect(idleOf({ ...SETTLED, us3: "PR_OPEN" })).toBe("false");
    expect(idleOf({ ...SETTLED, us3: "ENQUEUED" })).toBe("false");
  });
});

describe("EpicStage flow mounts non-interactive", () => {
  it("turns dragging, selection, connecting and focusing off, and keeps pan and zoom", () => {
    // The element sweep sees no button, form, input, select or textarea — but
    // the D-006 stack enables dragging and selection by default over plain
    // divs that sweep cannot see, so the mount props are the assertion.
    mountedProps.length = 0;

    const container = document.createElement("div");
    document.body.appendChild(container);

    const stage = stageFromWorkgraph(workgraph077, {
      us1: { state: "PENDING", attempt: 1, awaiting_operator: false, landing_state: null },
      us2: { state: "RUNNING", attempt: 1, awaiting_operator: false, landing_state: null },
    });

    act(() => createRoot(container).render(<EpicStage stage={stage} />));

    expect(mountedProps.length).toBe(1);
    const props = mountedProps[0];

    expect(props.nodesDraggable).toBe(false);
    expect(props.elementsSelectable).toBe(false);
    expect(props.nodesConnectable).toBe(false);
    expect(props.nodesFocusable).toBe(false);
    expect(props.edgesFocusable).toBe(false);

    // Pan and zoom are gestures, and they stay on: they mount no chrome.
    expect(props.panOnDrag).toBe(true);
    expect(props.zoomOnScroll).toBe(true);
    expect(props.zoomOnPinch).toBe(true);

    document.body.removeChild(container);
  });
});

/**
 * FR-001 (spec US1-S1): zero nodes is not a small stage, it is no stage.
 *
 * The assertion is the *absence* of the canvas, not a height under some
 * threshold — absence is exact and a threshold is a guess. What must survive is
 * the notice: constitution III says a read the factory could not answer is
 * shown, in words, naming what could not be learned.
 */
describe("EpicStage with nothing staged", () => {
  const TRANSPORT_DETAIL =
    "workgraph: fixtures/workgraphs/fx-landing-f0a0d6.json: not recorded yet (fixtures/README.md)";

  function renderEmpty(): HTMLElement {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const stage = {
      epic_id: "fx-landing-f0a0d6",
      nodes: [],
      edges: [],
      notes: [
        { read: "workgraph", mode: "transport", detail: TRANSPORT_DETAIL },
      ],
      degraded: true,
    };

    act(() => createRoot(container).render(<EpicStage stage={stage} />));
    return container;
  }

  it("renders no stage canvas at all", () => {
    const container = renderEmpty();

    expect(container.querySelector(".epic-stage-map")).toBeNull();
    expect(container.querySelectorAll("[data-station]").length).toBe(0);
    expect(container.querySelector("[data-react-flow]")).toBeNull();

    document.body.removeChild(container);
  });

  it("keeps the epic's name and its degraded notice", () => {
    const container = renderEmpty();

    const stage = container.querySelector("[data-epic-stage]");
    expect(stage).not.toBeNull();
    expect(stage?.getAttribute("data-epic-id")).toBe("fx-landing-f0a0d6");
    expect(container.querySelector(".epic-stage-name")?.textContent).toBe(
      "fx-landing-f0a0d6",
    );

    const note = container.querySelector("[data-stage-note][data-mode='transport']");
    expect(note).not.toBeNull();
    expect(note?.getAttribute("data-read")).toBe("workgraph");
    expect(note?.textContent).toContain("workgraph");
    expect(note?.textContent).toContain("transport");
    expect(note?.textContent).toContain(TRANSPORT_DETAIL);

    document.body.removeChild(container);
  });
});

/**
 * FR-002 (spec US1-S3): the height the component hands the map is the computed
 * one, and it is different for a different graph. The inline `height: 300` this
 * story removes would pass neither assertion.
 */
describe("EpicStage map height", () => {
  function mapOf(workgraphRaw: string): HTMLElement {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const stage = stageFromWorkgraph(workgraphRaw);
    act(() => createRoot(container).render(<EpicStage stage={stage} />));
    const map = container.querySelector(".epic-stage-map") as HTMLElement;
    document.body.removeChild(container);
    return map;
  }

  it("carries the computed height and no literal", () => {
    const two = stageFromWorkgraph(workgraph002);
    const five = stageFromWorkgraph(workgraph077);

    const shallow = mapOf(workgraph002);
    const deep = mapOf(workgraph077);

    expect(shallow.style.getPropertyValue("--stage-height")).toBe(
      `${stageHeight(two.nodes, two.edges)}px`,
    );
    expect(deep.style.getPropertyValue("--stage-height")).toBe(
      `${stageHeight(five.nodes, five.edges)}px`,
    );
    expect(deep.style.getPropertyValue("--stage-height")).not.toBe(
      shallow.style.getPropertyValue("--stage-height"),
    );
    expect(shallow.style.height).toBe("");
  });

  it("pins the fit at zoom 1 so the stations keep DESIGN.md's spacing", () => {
    mountedProps.length = 0;
    mapOf(workgraph077);

    expect(mountedProps.length).toBe(1);
    expect(mountedProps[0].fitViewOptions?.minZoom).toBe(1);
    expect(mountedProps[0].fitViewOptions?.maxZoom).toBe(1);
  });
});
