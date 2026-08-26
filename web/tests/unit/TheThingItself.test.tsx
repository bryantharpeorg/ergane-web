/**
 * The room's centre track and its header, rendered (011 US2).
 *
 * FR-007 through FR-010. What is proved here is what a browser with no layout
 * can prove: that the frame is built from a route the document named, at the
 * width and in the theme the operator picked; that the measured numbers are
 * rendered as numbers with their units and not as a verdict; and that the
 * served revision is stated on every document and unmissably when it is the
 * wrong one.
 *
 * **What is deliberately not here.** jsdom performs no layout — every box it
 * reports is zero — so the *values* the four laws produce cannot be asserted in
 * this suite at all. They are asserted where a real browser can produce them:
 * `web/tests/smoke/review.spec.ts` runs the sweep against a frame the pane is
 * really serving, and `showfloor.spec.ts`'s mutation controls are what prove the
 * four still go red on a planted defect. A unit test that stubbed a `LawReport`
 * and then asserted the stub would be measuring nothing (constitution IV).
 */

import { afterEach, describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import type { ReviewRoute, ServedRevision } from "../../src/api/reviewDocument";
import type { LawReport } from "../../src/layoutLaws";
import LawReadout from "../../src/review/LawReadout";
import { RevisionBand, ServedStamp } from "../../src/review/ServedRevision";
import TheThingItself, {
  THEMES,
  WIDTHS,
  framedRoutes,
  unframeableRoutes,
} from "../../src/review/TheThingItself";

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

function route(overrides: Partial<ReviewRoute> = {}): ReviewRoute {
  return { path: "/desk", kind: "room", name: "The Desk", stories: ["US1"], ...overrides };
}

const ROOMS = [
  route({ path: "/", name: "The Desk" }),
  route({ path: "/desk" }),
  route({ path: "/showfloor", name: "The Showfloor" }),
  route({ path: "/review", name: "The review room" }),
  route({ path: "/api/showfloor", kind: "api", name: "the showfloor document" }),
];

function served(overrides: Partial<ServedRevision> = {}): ServedRevision {
  return {
    revision: "0a0dea35b54fbdb5385312b3edc99ca7ccec53a4",
    short_revision: "0a0dea35b54f",
    branch: "dev",
    contains_epic: true,
    missing: [],
    unplaced: [],
    ...overrides,
  };
}

function report(overrides: Partial<LawReport> = {}): LawReport {
  return {
    swept: 214,
    leaves: 96,
    painters: 31,
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

// --- FR-007: the frame ----------------------------------------------------

describe("the frame renders a route the document named, at a chosen width and theme", () => {
  it("frames the first room route, at the first width, in the first theme", () => {
    const container = mount(<TheThingItself routes={ROOMS} />);

    const frame = container.querySelector("iframe[data-render]") as HTMLIFrameElement;
    expect(frame).not.toBeNull();
    expect(frame.getAttribute("data-render-route")).toBe("/");
    expect(frame.getAttribute("data-render-width")).toBe(String(WIDTHS[0]));
    expect(frame.getAttribute("data-render-theme")).toBe(THEMES[0]);
    // Same origin, by construction: a path, never a URL.
    expect(frame.getAttribute("src")).toBe("/");
    expect(frame.style.width).toBe(`${WIDTHS[0]}px`);
  });

  it("moves the frame to the route the operator picks", () => {
    const container = mount(<TheThingItself routes={ROOMS} />);

    const pick = container.querySelector(
      '[data-pick="route"] [data-option="/showfloor"]',
    ) as HTMLButtonElement;
    act(() => {
      pick.click();
    });

    const frame = container.querySelector("iframe[data-render]") as HTMLIFrameElement;
    expect(frame.getAttribute("src")).toBe("/showfloor");
    expect(pick.getAttribute("aria-pressed")).toBe("true");
  });

  it("resizes the frame to the width the operator picks, and says which is chosen", () => {
    const container = mount(<TheThingItself routes={ROOMS} />);

    act(() => {
      (
        container.querySelector('[data-pick="width"] [data-option="2560"]') as HTMLButtonElement
      ).click();
    });

    const frame = container.querySelector("iframe[data-render]") as HTMLIFrameElement;
    expect(frame.style.width).toBe("2560px");
    expect(frame.getAttribute("data-render-width")).toBe("2560");
    expect(
      container.querySelector('[data-pick="width"] [data-option="1280"]')?.getAttribute("data-chosen"),
    ).toBe("false");
  });

  it("carries the theme the operator picks onto the frame", () => {
    const container = mount(<TheThingItself routes={ROOMS} />);

    act(() => {
      (
        container.querySelector('[data-pick="theme"] [data-option="dark"]') as HTMLButtonElement
      ).click();
    });

    const frame = container.querySelector("iframe[data-render]") as HTMLIFrameElement;
    expect(frame.getAttribute("data-render-theme")).toBe("dark");
    expect(frame.getAttribute("title")).toContain("dark");
  });

  it("offers the widths and the themes the suite already sweeps, and no others", () => {
    const container = mount(<TheThingItself routes={ROOMS} />);

    const widths = [...container.querySelectorAll('[data-pick="width"] [data-option]')].map(
      (option) => option.getAttribute("data-option"),
    );
    expect(widths).toEqual(WIDTHS.map(String));
    expect(widths).toEqual(["1280", "1600", "2560"]);

    const themes = [...container.querySelectorAll('[data-pick="theme"] [data-option]')].map(
      (option) => option.getAttribute("data-option"),
    );
    expect(themes).toEqual(["light", "dark"]);
  });
});

describe("the frame takes screens and never this room or a document route", () => {
  it("offers every room route but the review room's own", () => {
    expect(framedRoutes(ROOMS).map((entry) => entry.path)).toEqual([
      "/",
      "/desk",
      "/showfloor",
    ]);
  });

  it("names the ones it will not take, with the reason, rather than dropping them", () => {
    const named = Object.fromEntries(
      unframeableRoutes(ROOMS).map(([entry, why]) => [entry.path, why]),
    );
    expect(Object.keys(named).sort()).toEqual(["/api/showfloor", "/review"]);
    expect(named["/review"]).toContain("itself");
    expect(named["/api/showfloor"]).toContain("not a screen");
  });

  it("renders those reasons in the room, so nothing is silently missing", () => {
    const container = mount(<TheThingItself routes={ROOMS} />);

    expect(
      container.querySelector('[data-unframeable-route="/review"]')?.textContent,
    ).toContain("itself");
    expect(container.querySelector('[data-unframeable-route="/api/showfloor"]')).not.toBeNull();
  });

  it("says so plainly when nothing this epic changed can be framed", () => {
    const container = mount(
      <TheThingItself routes={[route({ path: "/review", kind: "room" })]} />,
    );

    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("[data-no-frameable]")?.textContent).toContain(
      "put in a frame",
    );
  });
});

// --- FR-008: the numbers, not a verdict -----------------------------------

describe("the measured numbers render beside the frame, with their units", () => {
  /**
   * The 2026-08-25 review's own measurement, in the shape the room renders.
   *
   * `235px of graph hidden at 1280` is the line that earned this room, so the
   * figures are that line: a 1280px frame over a document 1515px wide, with the
   * card that reached past the edge named by law (b).
   */
  const measurement = {
    at: { route: "/showfloor", width: 1280, theme: "dark" },
    report: report({ past: ["div.stage-card[us4] at 1515px"], documentScrollWidth: 1515 }),
    frameWidth: 1280,
    frameHeight: 720,
    unmeasured: null,
  };

  it("names the coordinates the figures belong to", () => {
    const container = mount(<LawReadout measurement={measurement} />);
    const laws = container.querySelector("[data-laws]") as HTMLElement;

    expect(laws.getAttribute("data-laws")).toBe("measured");
    expect(laws.getAttribute("data-at-route")).toBe("/showfloor");
    expect(laws.getAttribute("data-at-width")).toBe("1280");
    expect(laws.getAttribute("data-at-theme")).toBe("dark");
  });

  it("renders all four laws with their counts and units", () => {
    const container = mount(<LawReadout measurement={measurement} />);

    for (const key of ["a", "b", "c", "d"]) {
      expect(container.querySelector(`[data-law="${key}"]`), `law (${key})`).not.toBeNull();
    }
    const b = container.querySelector('[data-law="b"]') as HTMLElement;
    expect(b.getAttribute("data-found")).toBe("1");
    expect(b.textContent).toContain("elements");
  });

  it("shows what a law found and not only that it found something", () => {
    const container = mount(<LawReadout measurement={measurement} />);

    const violations = container.querySelector('[data-violations="b"]') as HTMLElement;
    expect(violations.textContent).toContain("div.stage-card[us4] at 1515px");
  });

  it("carries the figure the 2026-08-25 review was written around", () => {
    // `235px of graph hidden at 1280` is not a law — a stage may scroll — but it
    // is the number that told the operator what to look at, so it is a figure.
    const container = mount(<LawReadout measurement={measurement} />);

    const hidden = container.querySelector('[data-measure="hidden"]') as HTMLElement;
    expect(hidden.textContent).toContain("235");
    expect(hidden.textContent).toContain("px");
  });

  it("shows the floors that make a green sweep mean something", () => {
    const container = mount(<LawReadout measurement={measurement} />);

    expect(container.querySelector('[data-measure="swept"]')?.textContent).toContain("214");
    expect(container.querySelector('[data-measure="leaves"]')?.textContent).toContain("96");
    expect(container.querySelector('[data-measure="painters"]')?.textContent).toContain("31");
  });

  it("reports a sweep that did not run as unmeasured, never as zero violations", () => {
    const container = mount(
      <LawReadout
        measurement={{
          at: { route: "/desk", width: 1280, theme: "light" },
          report: null,
          frameWidth: 1280,
          frameHeight: 720,
          unmeasured: "the frame has not produced a document this page can read",
        }}
      />,
    );

    expect(container.querySelector("[data-laws]")?.getAttribute("data-laws")).toBe("unmeasured");
    expect(container.querySelector('[data-law="a"]')).toBeNull();
    expect(container.querySelector(".degraded")?.textContent).toContain(
      "not produced a document",
    );
  });
});

// --- FR-009, FR-010: the served revision ----------------------------------

describe("the room names the revision it is serving (FR-009)", () => {
  it("names it, its branch, and that it carries the epic", () => {
    const container = mount(<ServedStamp served={served()} />);
    const stamp = container.querySelector("[data-served]") as HTMLElement;

    expect(stamp.textContent).toContain("0a0dea35b54f");
    expect(stamp.textContent).toContain("dev");
    expect(stamp.textContent).toContain("carries this epic");
    expect(stamp.getAttribute("data-contains")).toBe("true");
  });

  it("names no branch for a detached checkout rather than one called HEAD", () => {
    const container = mount(<ServedStamp served={served({ branch: null })} />);

    expect(container.querySelector("[data-branch]")).toBeNull();
    expect(container.querySelector("[data-served]")?.textContent).not.toContain("HEAD");
  });

  it("says unknown when the revision would not read, and never says mismatch", () => {
    const container = mount(
      <ServedStamp
        served={served({
          revision: null,
          short_revision: null,
          branch: null,
          contains_epic: null,
          unplaced: ["US1"],
        })}
      />,
    );
    const stamp = container.querySelector("[data-served]") as HTMLElement;

    expect(stamp.getAttribute("data-contains")).toBe("unknown");
    expect(stamp.textContent).toContain("revision unknown");
    expect(stamp.textContent).not.toContain("does not carry");
  });

  it("distinguishes a containment nobody could settle from one that failed", () => {
    const container = mount(<ServedStamp served={served({ contains_epic: null })} />);
    const stamp = container.querySelector("[data-served]") as HTMLElement;

    expect(stamp.getAttribute("data-contains")).toBe("unknown");
    expect(stamp.textContent).toContain("0a0dea35b54f");
    expect(stamp.textContent).toContain("unknown");
  });
});

describe("a mismatch is stated where it cannot be missed (FR-010)", () => {
  const mismatched = served({ contains_epic: false, missing: ["US3", "US4"] });

  it("takes a full-width band and names every story the revision does not carry", () => {
    const container = mount(<RevisionBand served={mismatched} />);
    const band = container.querySelector("[data-mismatch]") as HTMLElement;

    expect(band).not.toBeNull();
    expect(band.getAttribute("role")).toBe("status");
    expect(band.textContent).toContain("not serving the epic you are reviewing");
    expect(container.querySelector('[data-missing="US3"]')).not.toBeNull();
    expect(container.querySelector('[data-missing="US4"]')).not.toBeNull();
  });

  it("says what that costs the operator, not only that it happened", () => {
    const container = mount(<RevisionBand served={mismatched} />);

    expect(container.querySelector("[data-mismatch]")?.textContent).toContain(
      "a note taken here is about something else",
    );
  });

  it("adds the stories it could not place at all, beside the ones it could", () => {
    const container = mount(
      <RevisionBand served={served({ contains_epic: false, missing: ["US4"], unplaced: ["US1"] })} />,
    );

    expect(container.querySelector('[data-missing="US4"]')).not.toBeNull();
    expect(container.querySelector('[data-unplaced="US1"]')).not.toBeNull();
  });

  it("renders no band at all when the revision carries the epic", () => {
    const container = mount(<RevisionBand served={served()} />);
    expect(container.querySelector("[data-mismatch]")).toBeNull();
  });

  it("renders no band for a containment the reads did not settle", () => {
    // The Unknown Rule (constitution III). An alarm the room did not measure is
    // the one lie that would cost this alarm its meaning.
    const container = mount(
      <RevisionBand served={served({ contains_epic: null, unplaced: ["US1", "US2"] })} />,
    );
    expect(container.querySelector("[data-mismatch]")).toBeNull();
  });
});
