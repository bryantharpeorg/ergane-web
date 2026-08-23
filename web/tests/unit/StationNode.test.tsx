import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";

vi.mock("@xyflow/react", () => import("./support/xyflow-double"));

import StationNode from "../../src/showfloor/StationNode";

describe("StationNode", () => {
  it("renders live state, one attempt pip, and persona", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    act(() =>
      createRoot(container).render(
        <StationNode
          data={{
            node: {
              id: "us1",
              story_key: "US1",
              persona: "implementer",
              state: "ENQUEUED",
              attempt: 1,
              awaiting_operator: false,
              landing_state: null,
              waiting_on_operator: false,
              unknown: [],
            },
          }}
        />,
      ),
    );

    const station = container.querySelector("[data-station]");
    expect(station).not.toBeNull();
    expect(station?.getAttribute("data-state")).toBe("ENQUEUED");
    expect(station?.getAttribute("data-state-style")).toBe("ENQUEUED");
    expect(station?.querySelectorAll("[data-attempt-pip]").length).toBe(1);
    expect(station?.querySelector("[data-persona]")?.getAttribute("data-persona")).toBe("implementer");

    document.body.removeChild(container);
  });

  it("renders three pips for attempt 3", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    act(() =>
      createRoot(container).render(
        <StationNode
          data={{
            node: {
              id: "us2",
              story_key: "US2",
              persona: "implementer",
              state: "RUNNING",
              attempt: 3,
              awaiting_operator: false,
              landing_state: null,
              waiting_on_operator: false,
              unknown: [],
            },
          }}
        />,
      ),
    );

    const station = container.querySelector("[data-station]");
    expect(station?.querySelectorAll("[data-attempt-pip]").length).toBe(3);

    document.body.removeChild(container);
  });

  it("marks unknown and invents no pips when all live fields are null", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    act(() =>
      createRoot(container).render(
        <StationNode
          data={{
            node: {
              id: "us3",
              story_key: "US3",
              persona: "implementer",
              state: null,
              attempt: null,
              awaiting_operator: null,
              landing_state: null,
              waiting_on_operator: false,
              unknown: ["state", "attempt", "awaiting_operator", "landing_state"],
            },
          }}
        />,
      ),
    );

    const station = container.querySelector("[data-station]");
    expect(station?.getAttribute("data-state")).toBe("unknown");
    expect(station?.getAttribute("data-state-style")).toBe("unknown");
    expect(station?.querySelectorAll("[data-attempt-pip]").length).toBe(0);
    expect(station?.querySelector("[data-persona]")?.getAttribute("data-persona")).toBe("implementer");

    document.body.removeChild(container);
  });

  it("renders unrecognized state with unknown style and raw text, no throw", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    act(() =>
      createRoot(container).render(
        <StationNode
          data={{
            node: {
              id: "us4",
              story_key: "US4",
              persona: "implementer",
              state: "HIBERNATING",
              attempt: null,
              awaiting_operator: false,
              landing_state: null,
              waiting_on_operator: false,
              unknown: [],
            },
          }}
        />,
      ),
    );

    const station = container.querySelector("[data-station]");
    expect(station?.getAttribute("data-state")).toBe("HIBERNATING");
    expect(station?.getAttribute("data-state-style")).toBe("unknown");
    expect(station?.textContent).toContain("HIBERNATING");

    document.body.removeChild(container);
  });

  it("sets waiting marker while preserving raw VERIFYING state", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    act(() =>
      createRoot(container).render(
        <StationNode
          data={{
            node: {
              id: "us5",
              story_key: "US5",
              persona: "implementer",
              state: "VERIFYING",
              attempt: 2,
              awaiting_operator: true,
              landing_state: null,
              waiting_on_operator: true,
              unknown: [],
            },
          }}
        />,
      ),
    );

    const station = container.querySelector("[data-station]");
    expect(station?.getAttribute("data-state")).toBe("VERIFYING");
    expect(station?.getAttribute("data-waiting")).toBe("true");

    document.body.removeChild(container);
  });
});
