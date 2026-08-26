/**
 * The centre track: the frame and the numbers beside it (011 US2).
 *
 * What a DOM with no layout in it can prove, and it is the wiring rather than
 * the geometry: that the frame is a **same-origin frame on one of this pane's
 * own room paths**, that it carries the width and the theme the operator picked,
 * that the controls select and reach nothing, and that the panel beside it shows
 * **measured numbers rather than a verdict** (FR-008, § The review room).
 *
 * The geometry is the smoke suite's — `tests/smoke/review.spec.ts` renders the
 * room in a real browser, measures inside the frame at every width and in both
 * themes, and plants a violation to prove the numbers are the frame's and not
 * the room's. Neither half is sufficient alone: jsdom lays nothing out, and a
 * browser test cannot see that the source contains no `<input>` for a URL to be
 * typed into.
 *
 * **The one thing asserted here that could not be asserted anywhere else** is
 * the closed route set. D-023's safety argument is that the room reaches only
 * routes the backend resolved, so a route the document does not carry must not
 * be offerable — and an `api` or `shell` route must not be offered at all,
 * because there is nothing in it to look at.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";

import Measured from "../../src/review/Measured";
import TheThingItself from "../../src/review/TheThingItself";
import type { LawReport, Measurement } from "../../src/review/laws";
import type { ReviewDocument, ReviewRoute } from "../../src/api/reviewDocument";

const containers: HTMLElement[] = [];

function mount(node: JSX.Element): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  act(() => {
    createRoot(container).render(node);
  });
  return container;
}

afterEach(() => {
  for (const container of containers.splice(0)) container.remove();
});

/** The routes the backend resolved for an epic, in the manifest's order. */
const ROUTES: ReviewRoute[] = [
  { path: "/showfloor", kind: "room", name: "The Showfloor", stories: ["US1"] },
  { path: "/desk", kind: "room", name: "The Desk", stories: ["US2"] },
  { path: "/api/showfloor", kind: "api", name: "The showfloor document", stories: ["US1"] },
  { path: "/{path:path}", kind: "shell", name: "The guarded app shell", stories: ["US1"] },
];

function review(routes: ReviewRoute[] = ROUTES): ReviewDocument {
  return {
    spec_dir: "912-a-landed-epic",
    name: "A landed epic",
    landing_branch: "dev",
    story_source: "workgraph",
    stories: [],
    routes,
    served: {
      revision: "9c1d4e7a2b5f8c3d6e9a0b1c2d3e4f5a6b7c8d9e",
      short_revision: "9c1d4e7a2b5f",
      dirty: false,
      contains_epic: true,
      missing: [],
      unplaced: [],
      notes: [],
    },
    notes: [],
  };
}

function press(container: HTMLElement, selector: string): void {
  const control = container.querySelector(selector) as HTMLButtonElement | null;
  expect(control, `no control matched ${selector}`).not.toBeNull();
  act(() => {
    control!.click();
  });
}

function frameOf(container: HTMLElement): HTMLIFrameElement {
  const frame = container.querySelector("iframe.rv-render") as HTMLIFrameElement | null;
  expect(frame, "the room rendered no frame").not.toBeNull();
  return frame!;
}

describe("a selected route renders in a same-origin frame (US2-S1, FR-007)", () => {
  it("renders the epic's first room route, at a width and in a theme", () => {
    const container = mount(<TheThingItself review={review()} />);
    const frame = frameOf(container);

    // A path of this origin, taken from the document the backend assembled.
    // Never an absolute URL, and never anything the browser composed.
    expect(frame.getAttribute("src")).toBe("/showfloor");
    expect(frame.getAttribute("data-rendered-route")).toBe("/showfloor");
    expect(frame.getAttribute("data-rendered-width")).toBe("1280");
    expect(frame.getAttribute("data-rendered-theme")).toBe("light");
    expect(frame.style.width).toBe("1280px");
  });

  it("offers only routes an operator can look at", () => {
    const container = mount(<TheThingItself review={review()} />);
    const offered = Array.from(container.querySelectorAll("[data-route-choice]")).map(
      (control) => control.getAttribute("data-route-choice"),
    );
    // The document carries four routes; two of them are a JSON document and the
    // guarded catch-all, and neither has a render to review.
    expect(offered).toEqual(["/showfloor", "/desk"]);
  });

  it("moves the frame to the route the operator selected", () => {
    const container = mount(<TheThingItself review={review()} />);
    press(container, "[data-route-choice='/desk']");

    const frame = frameOf(container);
    expect(frame.getAttribute("src")).toBe("/desk");
    expect(frame.getAttribute("data-rendered-route")).toBe("/desk");
    expect(
      container
        .querySelector("[data-route-choice='/desk']")!
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("renders at the width the operator selected", () => {
    const container = mount(<TheThingItself review={review()} />);
    press(container, "[data-width-choice='2560']");

    const frame = frameOf(container);
    expect(frame.style.width).toBe("2560px");
    expect(frame.getAttribute("data-rendered-width")).toBe("2560");
  });

  it("renders in the theme the operator selected", () => {
    const container = mount(<TheThingItself review={review()} />);
    press(container, "[data-theme-choice='dark']");

    expect(frameOf(container).getAttribute("data-rendered-theme")).toBe("dark");
    expect(
      container.querySelector("[data-theme-choice='dark']")!.getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("draws no frame for an epic whose changes reach no screen", () => {
    // § Don't: "don't render an element that can never fill". A frame held open
    // over an epic with nothing to look at is furniture pretending to be
    // evidence.
    const container = mount(
      <TheThingItself review={review(ROUTES.filter((route) => route.kind !== "room"))} />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("[data-no-room]")).not.toBeNull();
  });

  it("names the frame for a reader who cannot see it", () => {
    const frame = frameOf(mount(<TheThingItself review={review()} />));
    expect(frame.getAttribute("title")).toBe(
      "/showfloor, rendered at 1280 px in the light theme",
    );
  });
});

describe("the numbers render beside the frame, not a pass (US2-S2, FR-008)", () => {
  const report: LawReport = {
    swept: 214,
    leaves: 96,
    painters: 31,
    escaped: [],
    past: ['div.node["US4"] at 1515px'],
    overlapping: [],
    occluded: [],
    documentScrollWidth: 1515,
    roomScrollsSideways: true,
    viewport: 1280,
  };
  const measurement: Measurement = {
    route: "/showfloor",
    width: 1280,
    theme: "light",
    report,
  };

  it("shows the figures the pass produced, each with its unit", () => {
    const container = mount(<Measured measurement={measurement} pending="…" />);

    const figure = (label: string) =>
      container.querySelector(`[data-figure='${label}']`)!.textContent;
    expect(figure("viewport")).toContain("1280 px");
    expect(figure("document")).toContain("1515 px");
    // The two that tell a clean sweep apart from a sweep that found nothing —
    // the way a visual gate goes green over a blank screen.
    expect(figure("text swept")).toContain("96 leaves");
    expect(figure("paint swept")).toContain("31 boxes");
  });

  it("names each law with its count and its measured descriptions", () => {
    const container = mount(<Measured measurement={measurement} pending="…" />);

    const past = container.querySelector("[data-law='past']")!;
    expect(past.getAttribute("data-violations")).toBe("1");
    expect(past.textContent).toContain("1 violation");
    // The description, verbatim: a count says something is wrong, and only this
    // says what and where. It is what "235px of graph hidden at 1280" was.
    expect(past.textContent).toContain('div.node["US4"] at 1515px');

    const clean = container.querySelector("[data-law='overlapping']")!;
    expect(clean.getAttribute("data-violations")).toBe("0");
    expect(clean.textContent).toContain("0 violations");
  });

  it("renders all four laws and no verdict over them", () => {
    const container = mount(<Measured measurement={measurement} pending="…" />);

    expect(Array.from(container.querySelectorAll("[data-law]")).map((law) =>
      law.getAttribute("data-law"),
    )).toEqual(["escaped", "past", "overlapping", "occluded"]);
    // No chip, no tick, no word standing in for the figures.
    expect(container.textContent).not.toContain("passed");
    expect(container.textContent).not.toContain("failed");
  });

  it("carries the coordinates the figures were taken at", () => {
    const container = mount(<Measured measurement={measurement} pending="…" />);
    const panel = container.querySelector("[data-measured]")!;

    expect(panel.getAttribute("data-measured-route")).toBe("/showfloor");
    expect(panel.getAttribute("data-measured-width")).toBe("1280");
    expect(panel.getAttribute("data-measured-theme")).toBe("light");
    expect(container.querySelector("[data-coordinates]")!.textContent).toContain(
      "1280 px",
    );
  });

  it("says a measurement has not been taken rather than reporting a clean one", () => {
    // A measurement that has not happened is not a measurement of zero
    // violations, and rendering it as one would tell the operator the screen is
    // clean before anything looked at it.
    const container = mount(
      <Measured measurement={null} pending="Loading /desk in the frame…" />,
    );
    expect(container.querySelector("[data-measured]")!.getAttribute("data-measured")).toBe(
      "pending",
    );
    expect(container.textContent).toContain("Loading /desk in the frame…");
    expect(container.querySelector("[data-law]")).toBeNull();
  });
});
