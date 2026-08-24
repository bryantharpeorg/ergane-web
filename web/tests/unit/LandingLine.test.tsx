/**
 * FR-004, FR-007 (spec US2-S1, US2-S4): the landing line is drawn inside the
 * map, and it carries the four stations DESIGN.md:307 names with their labels.
 *
 * The four stations are the point of the file. `DESIGN.md` calls the landing
 * line a Showfloor signature — "four 16px stations bottom to top: PASSED,
 * PR_OPEN, ENQUEUED, MERGED (MERGED shows a count, 'MERGED ×3')" — and the
 * whole component was off the screen at every width tested. A station lost to a
 * future layout change should fail a test rather than disappear quietly, so the
 * expected order and the expected labels are declared here rather than read
 * back off the component: a test that imports its own answer proves nothing.
 *
 * The count is asserted as the *form* `MERGED ×N` against the number of merged
 * nodes in the stage, not against a figure observed once. A stage with three
 * merged stories reads DESIGN.md's own example; a stage with none still reads
 * the form, because the station is unconditional.
 */

import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";

vi.mock("@xyflow/react", () => import("./support/xyflow-double"));

import EpicStage from "../../src/showfloor/EpicStage";
import type { LiveOverrides } from "./support/stage-builder";
import { stageFromWorkgraph } from "./support/stage-builder";

import workgraph077 from "../../../fixtures/workgraphs/077-a-scanner-the-operator-chooses-runs-in-the-loop.json?raw";

/** DESIGN.md:307, bottom to top, with the captions the line is labelled with. */
const STATIONS: ReadonlyArray<readonly [string, string]> = [
  ["PASSED", "passed"],
  ["PR_OPEN", "pr open"],
  ["ENQUEUED", "enqueued"],
  ["MERGED", "merged"],
];

function live(states: Record<string, string>): Record<string, LiveOverrides> {
  return Object.fromEntries(
    Object.entries(states).map(([id, state]) => [
      id,
      { state, attempt: 1, awaiting_operator: false, landing_state: null },
    ]),
  );
}

function render(states: Record<string, string>): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const stage = stageFromWorkgraph(workgraph077, live(states));
  act(() => createRoot(container).render(<EpicStage stage={stage} />));
  return container;
}

describe("the landing line", () => {
  it("is drawn inside the map's scrolling wrapper, not beside the stage", () => {
    const container = render({
      us1: "PASSED",
      us2: "PR_OPEN",
      us3: "ENQUEUED",
      us4: "MERGED",
      us5: "MERGED",
    });

    // FR-004: the lane shares the map's cell inside the scrolling wrapper — the
    // coordinate space DESIGN.md measures x=930 in — so it rides the map's
    // horizontal scroll. It was a third column of the stage, outside the
    // wrapper, with nothing that could scroll it into view.
    const wrapper = container.querySelector(".epic-stage-scroll");
    expect(wrapper).not.toBeNull();
    expect(wrapper!.querySelector(".epic-stage-map")).not.toBeNull();

    const lane = container.querySelector("[data-landing-line]");
    expect(lane).not.toBeNull();
    expect(wrapper!.contains(lane!)).toBe(true);

    // The stage no longer holds the lane anywhere outside that wrapper.
    const stage = container.querySelector("[data-epic-stage]") as HTMLElement;
    for (const found of Array.from(stage.querySelectorAll("[data-landing-line]"))) {
      expect(found.closest(".epic-stage-scroll")).toBe(wrapper);
    }

    document.body.removeChild(container);
  });

  it("carries all four stations DESIGN.md:307 names, bottom to top, with their labels", () => {
    const container = render({
      us1: "PASSED",
      us2: "PR_OPEN",
      us3: "ENQUEUED",
      us4: "MERGED",
      us5: "MERGED",
    });

    const lane = container.querySelector("[data-landing-line]") as HTMLElement;

    for (const [stage, caption] of STATIONS) {
      const station = lane.querySelectorAll(`[data-landing-station="${stage}"]`);
      expect(station.length, `${stage} is missing from the landing line`).toBe(1);
      expect(
        station[0].querySelector(".landing-station-label")?.textContent,
      ).toBe(caption);
    }

    // Source order is bottom to top; CSS draws it in that direction. A station
    // reordered by a future change fails here rather than moving silently.
    const drawn = Array.from(
      lane.querySelectorAll("[data-landing-station]"),
    ).map((element) => element.getAttribute("data-landing-station"));
    expect(drawn).toEqual(STATIONS.map(([stage]) => stage));

    // Each story rides the station its state names.
    for (const [id, stage] of [
      ["us1", "PASSED"],
      ["us2", "PR_OPEN"],
      ["us3", "ENQUEUED"],
    ] as const) {
      expect(
        lane.querySelector(
          `[data-landing-station="${stage}"] [data-landing-token][data-node-id="${id}"]`,
        ),
        `${id} does not ride ${stage}`,
      ).not.toBeNull();
    }

    document.body.removeChild(container);
  });

  it("renders MERGED in its count form", () => {
    const three = render({
      us1: "PASSED",
      us2: "PR_OPEN",
      us3: "MERGED",
      us4: "MERGED",
      us5: "MERGED",
    });

    // DESIGN.md:307's own example: "MERGED shows a count, 'MERGED ×3'".
    expect(
      three.querySelector("[data-landed-shelf] .landed-shelf-count")?.textContent,
    ).toBe("MERGED ×3");
    document.body.removeChild(three);

    // The form, not the figure: nothing merged still reads MERGED ×0, and the
    // four stations are still on the line. Suppressing the count when it is
    // zero would make the line disappear exactly when the run is empty.
    const none = render({
      us1: "PENDING",
      us2: "PENDING",
      us3: "RUNNING",
      us4: "PENDING",
      us5: "PENDING",
    });

    expect(
      none.querySelector("[data-landed-shelf] .landed-shelf-count")?.textContent,
    ).toBe("MERGED ×0");
    expect(none.querySelectorAll("[data-landing-station]").length).toBe(
      STATIONS.length,
    );
    for (const [stage] of STATIONS) {
      expect(
        none.querySelector(`[data-landing-station="${stage}"]`),
        `${stage} is missing when nothing is on the run`,
      ).not.toBeNull();
    }

    document.body.removeChild(none);
  });
});
