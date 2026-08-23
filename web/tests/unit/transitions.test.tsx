/**
 * The flow, as marker lifecycles (US3-S1..S4).
 *
 * Every motion claim in this spec is a claim about a marker a document
 * applies, clears, or suppresses — never about a computed animation. Fake
 * timers drive the clearing; reduced motion is the control.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { act } from "react";
import EpicStage from "../../src/showfloor/EpicStage";
import { TRANSITION_MS } from "../../src/showfloor/transitions";
import type { StageDocument } from "../../src/showfloor/types";
import { stageFromWorkgraph } from "./support/stage-builder";

import workgraph077 from "../../../fixtures/workgraphs/077-a-scanner-the-operator-chooses-runs-in-the-loop.json?raw";
import showfloorCss from "../../src/showfloor/showfloor.css?raw";

vi.mock("@xyflow/react", () => import("./support/xyflow-double"));

/** A 077 stage in which every declared node is given a live state. */
function stageWith(states: Record<string, string | null>): StageDocument {
  const overrides: Record<
    string,
    { state: string | null; attempt: number; awaiting_operator: boolean; landing_state: null }
  > = {};
  for (const [id, state] of Object.entries(states)) {
    overrides[id] = {
      state,
      attempt: 1,
      // us3 is the paged node throughout, so data-waiting has something to say.
      awaiting_operator: id === "us3",
      landing_state: null,
    };
  }
  return stageFromWorkgraph(workgraph077, overrides);
}

const PENDING_FLOOR = {
  us1: "PENDING",
  us2: "PENDING",
  us3: "VERIFYING",
  us4: "PENDING",
  us5: "PENDING",
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.removeChild(container);
  vi.useRealTimers();
  Reflect.deleteProperty(window, "matchMedia");
});

async function show(stage: StageDocument): Promise<void> {
  await act(async () => {
    root.render(<EpicStage stage={stage} />);
  });
}

function station(id: string): Element | null {
  return container.querySelector(`[data-station][data-node-id="${id}"]`);
}

/** Report reduced motion the way a browser that asks for it would. */
function askForReducedMotion(): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      matches: query.includes("prefers-reduced-motion: reduce"),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
}

describe("landing run", () => {
  it("carries the landing stage through PASSED → PR_OPEN → ENQUEUED → MERGED and lands on the shelf", async () => {
    for (const stage of ["PASSED", "PR_OPEN", "ENQUEUED", "MERGED"]) {
      await show(stageWith({ ...PENDING_FLOOR, us2: stage }));

      expect(station("us2")?.getAttribute("data-landing-stage")).toBe(stage);
      // The token rides the landing line at the same stage.
      expect(
        container.querySelector(
          `[data-landing-line] [data-landing-token][data-node-id="us2"][data-landing-stage="${stage}"]`,
        ),
      ).not.toBeNull();
    }

    const shelfCard = container.querySelector(
      '[data-landed-shelf] [data-node-id="us2"]',
    );
    expect(shelfCard).not.toBeNull();
    expect(shelfCard?.getAttribute("data-state")).toBe("MERGED");
    expect(
      container.querySelectorAll("[data-landed-shelf] [data-shelf-card]").length,
    ).toBe(1);
    expect(container.querySelector("[data-landed-shelf]")?.textContent).toContain(
      "MERGED ×1",
    );

    // The route stays whole: the merged node still stops on the map, once.
    expect(
      container.querySelectorAll('[data-station][data-node-id="us2"]').length,
    ).toBe(1);
  });

  it("omits the landing marker for a node short of the line", async () => {
    await show(stageWith({ ...PENDING_FLOOR, us2: "RUNNING" }));

    expect(station("us2")?.hasAttribute("data-landing-stage")).toBe(false);
    expect(station("us1")?.hasAttribute("data-landing-stage")).toBe(false);
    expect(
      container.querySelector("[data-landed-shelf]")?.textContent,
    ).toContain("MERGED ×0");
  });
});

describe("transition lifecycle", () => {
  it("applies the marker on an observed change and clears it after TRANSITION_MS", async () => {
    vi.useFakeTimers();

    await show(stageWith({ ...PENDING_FLOOR, us4: "RUNNING" }));
    expect(container.querySelectorAll("[data-transition]").length).toBe(0);

    await show(stageWith({ ...PENDING_FLOOR, us4: "VERIFYING" }));
    expect(
      container.querySelector('[data-node-id="us4"][data-transition="true"]'),
    ).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(TRANSITION_MS);
    });
    expect(
      container.querySelector('[data-node-id="us4"][data-transition="true"]'),
    ).toBeNull();
    expect(container.querySelectorAll("[data-transition]").length).toBe(0);

    // A third, identical document changed nothing, so it marks nothing.
    await show(stageWith({ ...PENDING_FLOOR, us4: "VERIFYING" }));
    expect(container.querySelectorAll("[data-transition]").length).toBe(0);
  });

  it("marks only the node whose state moved", async () => {
    vi.useFakeTimers();

    await show(stageWith({ ...PENDING_FLOOR, us4: "RUNNING" }));
    await show(stageWith({ ...PENDING_FLOOR, us4: "VERIFYING" }));

    const marked = container.querySelectorAll('[data-transition="true"]');
    expect(marked.length).toBe(1);
    expect(marked[0].getAttribute("data-node-id")).toBe("us4");
  });
});

describe("first paint control", () => {
  it("shelves an already-MERGED node without marking a transition", async () => {
    vi.useFakeTimers();

    await show(stageWith({ ...PENDING_FLOOR, us1: "MERGED" }));

    expect(
      container.querySelector('[data-landed-shelf] [data-node-id="us1"]'),
    ).not.toBeNull();
    expect(station("us1")?.getAttribute("data-landing-stage")).toBe("MERGED");
    // Markers fire on observed change, never on first paint.
    expect(container.querySelectorAll("[data-transition]").length).toBe(0);
  });
});

describe("reduced motion control", () => {
  it("suppresses every transition marker while state, landing stage, waiting, and edge kind stay legible", async () => {
    askForReducedMotion();
    vi.useFakeTimers();

    // The landing run of T042, under reduced motion.
    for (const landing of ["PASSED", "PR_OPEN", "ENQUEUED", "MERGED"]) {
      await show(stageWith({ ...PENDING_FLOOR, us2: landing }));

      expect(container.querySelectorAll("[data-transition]").length).toBe(0);

      // Every state is still distinguishable without motion.
      expect(station("us2")?.getAttribute("data-state")).toBe(landing);
      expect(station("us2")?.getAttribute("data-landing-stage")).toBe(landing);
      expect(station("us1")?.getAttribute("data-state")).toBe("PENDING");
      expect(station("us3")?.getAttribute("data-state")).toBe("VERIFYING");
      expect(station("us3")?.getAttribute("data-waiting")).toBe("true");
      expect(station("us1")?.hasAttribute("data-waiting")).toBe(false);

      // Both edge kinds stay distinguishable.
      expect(
        container.querySelectorAll('[data-edge-kind="pass"]').length,
      ).toBe(3);
      expect(
        container.querySelectorAll('[data-edge-kind="merge"]').length,
      ).toBe(1);
    }

    expect(
      container.querySelector('[data-landed-shelf] [data-node-id="us2"]'),
    ).not.toBeNull();

    // The state-change sequence of T043, under reduced motion.
    await show(stageWith({ ...PENDING_FLOOR, us4: "RUNNING" }));
    await show(stageWith({ ...PENDING_FLOOR, us4: "VERIFYING" }));
    expect(container.querySelectorAll("[data-transition]").length).toBe(0);
    expect(station("us4")?.getAttribute("data-state")).toBe("VERIFYING");

    await act(async () => {
      vi.advanceTimersByTime(TRANSITION_MS * 4);
    });
    expect(container.querySelectorAll("[data-transition]").length).toBe(0);
  });

  it("authors every animation inside a prefers-reduced-motion: no-preference block", () => {
    const gated: [number, number][] = [];
    const opener = /@media\s*\(\s*prefers-reduced-motion:\s*no-preference\s*\)\s*\{/g;
    let opened: RegExpExecArray | null;
    while ((opened = opener.exec(showfloorCss)) !== null) {
      const start = opened.index + opened[0].length;
      let depth = 1;
      let cursor = start;
      while (cursor < showfloorCss.length && depth > 0) {
        if (showfloorCss[cursor] === "{") depth += 1;
        else if (showfloorCss[cursor] === "}") depth -= 1;
        cursor += 1;
      }
      gated.push([start, cursor - 1]);
    }
    expect(gated.length).toBeGreaterThan(0);

    const declarations = /animation\s*:/g;
    const positions: number[] = [];
    let found: RegExpExecArray | null;
    while ((found = declarations.exec(showfloorCss)) !== null) {
      positions.push(found.index);
    }
    // The three authored motions plus the transition pulse.
    expect(positions.length).toBeGreaterThanOrEqual(3);
    for (const position of positions) {
      expect(
        gated.some(([start, end]) => position > start && position < end),
      ).toBe(true);
    }
  });
});
