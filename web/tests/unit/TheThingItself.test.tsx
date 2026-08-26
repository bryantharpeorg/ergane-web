/**
 * The room's centre track, rendered (011 US2: FR-007, FR-008).
 *
 * What is proved here is the half a browser is not needed for: that the room
 * *offers* the routes the document gave it and no others, that the frame it
 * renders is the route the operator picked at the width and theme they picked,
 * and that every figure a measurement produces reaches the screen rather than
 * being collapsed into a tick.
 *
 * The other half — that the numbers are of the frame's own document, laid out —
 * belongs to `web/tests/smoke/review.spec.ts`, because `jsdom` has no layout in
 * it and a measurement there would be a measurement of nothing. The two halves
 * meet at `LawReport`: this file constructs one and asserts what the room does
 * with it; the smoke suite takes a real one and asserts that it is the room's.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import TheThingItself, {
  DEFAULT_WIDTH,
  Measured,
  WIDTHS,
  hiddenPast,
} from "../../src/review/TheThingItself";
import type { LawReport } from "../../src/review/laws";
import type { ReviewRoute } from "../../src/api/reviewDocument";

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

/** The routes an epic reaches, in the shape `assemble_review` emits them. */
function routes(): ReviewRoute[] {
  return [
    { path: "/", kind: "room", name: "The Desk", stories: ["US1"] },
    { path: "/showfloor", kind: "room", name: "The Showfloor", stories: ["US2"] },
    { path: "/api/floor", kind: "api", name: "The floor document", stories: ["US1"] },
    { path: "/{path:path}", kind: "shell", name: "The guarded app shell", stories: ["US1"] },
  ];
}

/**
 * One measurement, in the shape `measureLawsIn` answers.
 *
 * The numbers are the ones the 2026-08-25 manual review actually reported —
 * `235px of graph hidden at 1280` — because the whole reason this room exists is
 * that a figure of that shape is worth automating and a green tick is not.
 */
function report(overrides: Partial<LawReport> = {}): LawReport {
  return {
    swept: 402,
    leaves: 181,
    painters: 46,
    escaped: [],
    past: [],
    overlapping: [],
    occluded: [],
    documentScrollWidth: 1515,
    roomScrollsSideways: false,
    viewport: 1280,
    ...overrides,
  };
}

describe("the frame renders the route, width and theme the operator picked (FR-007)", () => {
  it("renders a same-origin frame at the first room route by default", () => {
    const container = mount(<TheThingItself routes={routes()} specDir="011-a-spec" />);

    const frame = container.querySelector("[data-render-frame]") as HTMLIFrameElement;
    expect(frame).not.toBeNull();
    // A path of this origin, never an operator-typed URL and never an absolute
    // one: the frame is same-origin or the sweep cannot read it (D-023).
    expect(frame.getAttribute("src")).toBe("/");
    expect(frame.getAttribute("src")?.startsWith("/")).toBe(true);
    expect(frame.getAttribute("data-render-route")).toBe("/");
    expect(frame.getAttribute("data-render-width")).toBe(String(DEFAULT_WIDTH));
    // The width both manual reviews were taken at, and the one every defect
    // they found was found at.
    expect(DEFAULT_WIDTH).toBe(1280);
    expect(WIDTHS).toContain(DEFAULT_WIDTH);
    expect(frame.getAttribute("data-render-theme")).toBe("light");
  });

  it("offers every room the epic reaches, and nothing that is not a room", () => {
    const container = mount(<TheThingItself routes={routes()} specDir="011-a-spec" />);

    const offered = Array.from(container.querySelectorAll("[data-route-pick]")).map(
      (pick) => pick.getAttribute("data-route-pick"),
    );
    expect(offered).toEqual(["/", "/showfloor"]);
    // An `api` route is a document and the `shell` is the catch-all that serves
    // the rooms. Offering either would be the room inviting a review of JSON.
    expect(container.querySelector("[data-route-pick='/api/floor']")).toBeNull();
    expect(container.querySelector("[data-route-pick='/{path:path}']")).toBeNull();
  });

  it("moves the frame to the route the operator picks", () => {
    const container = mount(<TheThingItself routes={routes()} specDir="011-a-spec" />);
    const pick = container.querySelector("[data-route-pick='/showfloor']") as HTMLElement;

    act(() => {
      pick.click();
    });

    const frame = container.querySelector("[data-render-frame]") as HTMLIFrameElement;
    expect(frame.getAttribute("src")).toBe("/showfloor");
    expect(frame.getAttribute("data-render-route")).toBe("/showfloor");
    expect(pick.getAttribute("aria-pressed")).toBe("true");
  });

  it("renders at the width and the theme the operator picks", () => {
    const container = mount(<TheThingItself routes={routes()} specDir="011-a-spec" />);

    act(() => {
      (container.querySelector("[data-width-pick='2560']") as HTMLElement).click();
    });
    act(() => {
      (container.querySelector("[data-theme-pick='dark']") as HTMLElement).click();
    });

    const frame = container.querySelector("[data-render-frame]") as HTMLIFrameElement;
    expect(frame.getAttribute("data-render-width")).toBe("2560");
    expect(frame.getAttribute("width")).toBe("2560");
    expect(frame.getAttribute("data-render-theme")).toBe("dark");
    // Both themes are offered and exactly two: DESIGN.md renders two.
    expect(container.querySelectorAll("[data-theme-pick]")).toHaveLength(2);
  });

  it("says so plainly when the epic reaches no screen this pane serves", () => {
    // Not an empty frame and not a blank column: § Don't opens with "don't
    // render an element that can never fill".
    const container = mount(
      <TheThingItself
        routes={[{ path: "/api/floor", kind: "api", name: "The floor document", stories: [] }]}
        specDir="011-a-spec"
      />,
    );

    expect(container.querySelector("[data-render-frame]")).toBeNull();
    expect(container.querySelector("[data-no-route]")).not.toBeNull();
    expect(container.textContent).toContain("nothing to render");
  });

  it("drives no browser, opens no window and reaches no origin of its own (D-023)", () => {
    const container = mount(<TheThingItself routes={routes()} specDir="011-a-spec" />);
    const frame = container.querySelector("[data-render-frame]") as HTMLIFrameElement;

    // The frame's address is a path this application serves, resolved by the
    // browser against this origin. A room that accepted an absolute URL would
    // have reintroduced every question D-023 closed.
    for (const pick of Array.from(container.querySelectorAll("[data-route-pick]"))) {
      expect(pick.getAttribute("data-route-pick")?.startsWith("/")).toBe(true);
      expect(pick.getAttribute("data-route-pick")).not.toContain("//");
    }
    expect(frame.getAttribute("src")?.includes(":")).toBe(false);
  });
});

describe("the measured numbers render beside the frame (FR-008)", () => {
  it("renders every figure the measurement produced, not a verdict", () => {
    const container = mount(<Measured report={report()} width={1280} theme="light" />);

    const figure = (label: string) =>
      container.querySelector(`[data-figure='${label}'] .rv-figure-value`)?.textContent?.trim();

    expect(figure("frame")).toBe("1280px");
    expect(figure("document")).toBe("1515px");
    // The number the 08-25 review led with, derived once rather than left to
    // the reader to subtract.
    expect(figure("hidden past the edge")).toBe("235px");
    expect(figure("text leaves")).toBe("181");
    expect(figure("painters")).toBe("46");
    expect(container.querySelectorAll("[data-figure]")).toHaveLength(5);
  });

  it("names each of the four laws beside its figure", () => {
    const container = mount(<Measured report={report()} width={1280} theme="light" />);

    const laws = Array.from(container.querySelectorAll("[data-law]")).map((law) => [
      law.getAttribute("data-law"),
      law.getAttribute("data-violations"),
    ]);
    expect(laws).toEqual([
      ["a", "0"],
      ["b", "0"],
      ["c", "0"],
      ["d", "0"],
    ]);
  });

  it("renders a violation with its own measured particulars", () => {
    // A count on its own would not have found F1: what made the manual review
    // useful was `235px of graph hidden at 1280, US4 fully invisible`.
    const measured = report({
      past: ["div.card[\"US4\"] at 1515px"],
      overlapping: ['span.rank["3"] × span.title["A spec remembers"]'],
    });
    const container = mount(<Measured report={measured} width={1280} theme="light" />);

    const past = container.querySelector("[data-law='b']") as HTMLElement;
    expect(past.getAttribute("data-violations")).toBe("1");
    expect(past.textContent).toContain("1515px");

    const overlap = container.querySelector("[data-law='c']") as HTMLElement;
    expect(overlap.getAttribute("data-violations")).toBe("1");
    expect(overlap.textContent).toContain("A spec remembers");
  });

  it("carries the coordinates the figures were taken at", () => {
    // US3 anchors a note to these. A panel that did not say which width and
    // theme it measured would produce notes nobody could reproduce.
    const container = mount(<Measured report={report()} width={2560} theme="dark" />);
    const panel = container.querySelector("[data-measured]") as HTMLElement;

    expect(panel.getAttribute("data-width")).toBe("2560");
    expect(panel.getAttribute("data-theme")).toBe("dark");
  });

  it("reports nothing hidden as zero rather than as a negative", () => {
    expect(hiddenPast(report({ documentScrollWidth: 1280, viewport: 1280 }))).toBe(0);
    expect(hiddenPast(report({ documentScrollWidth: 1200, viewport: 1280 }))).toBe(0);
    expect(hiddenPast(report({ documentScrollWidth: 1515, viewport: 1280 }))).toBe(235);
  });
});
