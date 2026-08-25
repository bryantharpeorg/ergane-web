import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const PASS_EDGE_TEXT =
  "An ordering-only dependency: the predecessor must reach a verdict, and nothing about its code is guaranteed to be present";
const MERGE_EDGE_TEXT =
  "A content dependency: the predecessor's work must be merged before the dependent's worktree is created, so the dependent's base contains that code";

test("the Showfloor stages the fixture floor read-only", async ({ page, request }) => {
  const requests: { method: string }[] = [];
  page.on("request", (req) => requests.push({ method: req.method() }));

  await page.goto("/showfloor");
  await page.waitForSelector("[data-epic-stage]");

  const floorResponse = await request.get("/api/floor");
  const floorDoc = (await floorResponse.json()) as {
    epics: Array<{
      epic_id: string;
      stage?: {
        nodes: Array<{ id: string }>;
        edges: Array<{ kind: string }>;
      };
    }>;
  };

  let stagedEpicCount = 0;
  let passEdgeCount = 0;
  let mergeEdgeCount = 0;

  for (const epic of floorDoc.epics) {
    if (!epic.stage || epic.stage.nodes.length === 0) continue;
    stagedEpicCount++;

    const stages = page.locator(`[data-epic-stage][data-epic-id="${epic.epic_id}"]`);
    const stageCount = await stages.count();
    expect(stageCount).toBeGreaterThanOrEqual(1);

    let foundStageWithNodes = false;
    for (let i = 0; i < stageCount; i++) {
      const stage = stages.nth(i);
      const firstStation = stage.locator("[data-station]").first();
      const hasNodes = await firstStation.isVisible().catch(() => false);
      if (!hasNodes) continue;
      foundStageWithNodes = true;

      for (const node of epic.stage.nodes) {
        const station = stage.locator(`[data-station][data-node-id="${node.id}"]`);
        await expect(station).toHaveCount(1);
        const state = await station.getAttribute("data-state");
        expect(state).not.toBeNull();
        expect(state).not.toBe("");
      }
    }
    expect(foundStageWithNodes).toBe(true);

    for (const edge of epic.stage.edges) {
      if (edge.kind === "pass") passEdgeCount++;
      if (edge.kind === "merge") mergeEdgeCount++;
    }
  }

  expect(stagedEpicCount).toBeGreaterThan(0);

  const passEdges = page.locator(".edge-pass[data-edge-kind='pass']");
  const mergeEdges = page.locator(".edge-merge[data-edge-kind='merge']");
  const passVisible = await passEdges.count();
  const mergeVisible = await mergeEdges.count();
  expect(passVisible + mergeVisible).toBeGreaterThan(0);
  expect(passEdgeCount > 0 || passVisible > 0).toBe(true);
  expect(mergeEdgeCount > 0 || mergeVisible > 0).toBe(true);

  const legendPass = page.locator("[data-legend-kind='pass']").first();
  const legendMerge = page.locator("[data-legend-kind='merge']").first();
  await expect(legendPass).toContainText(PASS_EDGE_TEXT);
  await expect(legendMerge).toContainText(MERGE_EDGE_TEXT);

  expect(requests.filter((r) => r.method !== "GET")).toHaveLength(0);
});

test("full-bleed is measured", async ({ page }) => {
  await page.goto("/showfloor");
  await page.waitForSelector("[data-showfloor-root]");

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const box = await page.locator("[data-showfloor-root]").boundingBox();
  expect(box).not.toBeNull();

  expect(box!.x).toBe(0);
  expect(box!.y).toBe(0);
  expect(box!.width).toBe(viewport!.width);
  expect(box!.height).toBe(viewport!.height);
});

test("pure glass sweep", async ({ page }) => {
  await page.goto("/showfloor");
  await page.waitForSelector("[data-epic-stage]");

  // The room is really staged before the sweep runs, so a clean sweep is a
  // fact about the rendered Showfloor and not about an empty page.
  expect(await page.locator("[data-epic-stage]").count()).toBeGreaterThan(0);

  // FR-016 / SC-006: no verb, anywhere in the room.
  await expect(page.locator("button, form, input, select, textarea")).toHaveCount(0);

  // The Fixture floor carries open Attention items, so the one badge is there —
  // and it is an anchor, the Showfloor's only link.
  const badges = page.locator("[data-attention-badge]");
  await expect(badges).toHaveCount(1);
  const tagName = await badges.first().evaluate((element) => element.tagName.toLowerCase());
  expect(tagName).toBe("a");
  expect(await badges.first().textContent()).toMatch(/^\d/);
  expect(await badges.first().getAttribute("href")).toBe("/desk");
});

/**
 * FR-001 / SC (spec US1-S2): the three zero-node epics in the Fixture floor
 * cost a line of text, not a screen of nothing.
 *
 * The comparison is taken inside one render — every height is measured from the
 * same page at the same viewport and font — so the bound cannot drift with the
 * window size or with a face that loads at a different metric. A quarter of the
 * median populated stage is the threshold the spec names.
 */
test.describe("the stage is the size of its graph", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("an epic with nothing staged is a row, not a screen", async ({ page }) => {
    await page.goto("/showfloor");
    await page.waitForSelector("[data-epic-stage]");

    const stages = page.locator("[data-epic-stage]");
    const count = await stages.count();
    expect(count).toBeGreaterThan(0);

    const empty: number[] = [];
    const populated: number[] = [];

    for (let i = 0; i < count; i++) {
      const stage = stages.nth(i);
      const stations = await stage.locator("[data-station]").count();
      const box = await stage.boundingBox();
      expect(box).not.toBeNull();
      (stations === 0 ? empty : populated).push(box!.height);
    }

    // The Fixture floor records three epics whose workgraph read failed, and
    // the assertion is worthless if the render carries neither kind.
    expect(empty.length).toBe(3);
    expect(populated.length).toBeGreaterThan(0);

    const sorted = [...populated].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 1
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
    expect(median).toBeGreaterThan(0);

    for (const height of empty) {
      expect(height).toBeLessThan(median / 4);
    }
  });

  test("a deeper graph gets a taller stage", async ({ page, request }) => {
    await page.goto("/showfloor");
    await page.waitForSelector("[data-epic-stage]");

    const floorResponse = await request.get("/api/floor");
    const floorDoc = (await floorResponse.json()) as {
      epics: Array<{
        epic_id: string;
        stage?: { nodes: Array<{ id: string }> };
      }>;
    };

    // FR-002: height follows the graph, so the five-node epic's map is taller
    // than the two-node one's. A constant height passes nothing here.
    const twoNode = floorDoc.epics.find(
      (epic) => epic.stage && epic.stage.nodes.length === 2,
    );
    const fiveNode = floorDoc.epics.find(
      (epic) => epic.stage && epic.stage.nodes.length === 5,
    );
    expect(twoNode).toBeDefined();
    expect(fiveNode).toBeDefined();

    const mapOf = async (epicId: string): Promise<number> => {
      const map = page
        .locator(`[data-epic-stage][data-epic-id="${epicId}"][data-staged="true"] .epic-stage-map`)
        .first();
      const box = await map.boundingBox();
      expect(box).not.toBeNull();
      return box!.height;
    };

    const shallow = await mapOf(twoNode!.epic_id);
    const deep = await mapOf(fiveNode!.epic_id);
    expect(deep).toBeGreaterThan(shallow);
  });
});

/**
 * FR-004, FR-005, FR-006 (spec US2-S1, US2-S2, US2-S3): the landing line and
 * its four stations are on the screen — reachable by scrolling the map
 * horizontally, exactly as `DESIGN.md` § Layout describes.
 *
 * Every measurement of the lane is taken against its **wrapper**, never
 * against the viewport. A wrapper that scrolls is the specified behaviour —
 * "The map is an SVG of min-width 1040px inside a horizontally scrolling
 * wrapper" — so a viewport-containment assertion would forbid the very thing
 * the document asks for. What is forbidden is content laid out into nowhere:
 * past the edge with nothing on the screen that scrolls to reach it, which is
 * what shipped and what the sweep below separates out.
 */
const LAYOUT_WIDTHS = [1280, 1440] as const;

/** DESIGN.md § Layout (Showfloor): "an SVG of min-width 1040px". */
const MAP_MIN_WIDTH = 1040;

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

interface WrapperMeasure {
  description: string;
  overflowX: string;
  box: Box;
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollLeft: number;
}

interface LayoutMeasure {
  viewportWidth: number;
  /** The room's own scroll root, which scrolls the floor vertically. */
  room: { scrollWidth: number; clientWidth: number };
  lanes: Array<{
    epicId: string | null;
    box: Box;
    stations: Array<{ stage: string | null; box: Box }>;
    wrapper: WrapperMeasure | null;
  }>;
  maps: Array<{
    epicId: string | null;
    width: number;
    wrapper: WrapperMeasure | null;
  }>;
  sweep: {
    swept: number;
    excused: number;
    offenders: Array<{ description: string; right: number }>;
  };
}

/**
 * Load the Showfloor at one width and take every measurement the assertions
 * below need, in one pass over one render.
 *
 * An element's scroll wrapper is found by walking its ancestors for a computed
 * `overflow-x` that scrolls — the computed style, so a wrapper that only looks
 * like one in the stylesheet cannot satisfy it. The walk stops at the room's
 * own scroll root: that element scrolls the floor vertically, and counting it
 * as a horizontal wrapper would excuse everything on the page, the lane laid
 * out 121px past the container included. The room is instead held to a
 * stricter rule of its own below — it must not scroll horizontally at all — so
 * stopping the walk there hides nothing.
 */
async function measureLayout(page: Page, width: number): Promise<LayoutMeasure> {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/showfloor");
  await page.waitForSelector("[data-landing-line]");

  return page.evaluate(() => {
    const room = document.querySelector("[data-showfloor-root]") as HTMLElement;

    const describe = (element: Element): string => {
      const classes =
        typeof element.className === "string" && element.className.trim()
          ? `.${element.className.trim().split(/\s+/).join(".")}`
          : "";
      return `${element.tagName.toLowerCase()}${classes}`;
    };

    const boxOf = (element: Element): Box => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };

    const measureWrapper = (wrapper: HTMLElement): WrapperMeasure => ({
      description: describe(wrapper),
      overflowX: getComputedStyle(wrapper).overflowX,
      box: boxOf(wrapper),
      clientWidth: wrapper.clientWidth,
      clientHeight: wrapper.clientHeight,
      scrollWidth: wrapper.scrollWidth,
      scrollLeft: wrapper.scrollLeft,
    });

    const wrapperOf = (element: Element): HTMLElement | null => {
      let parent = element.parentElement;
      while (
        parent &&
        parent !== room &&
        parent !== document.body &&
        parent !== document.documentElement
      ) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (overflowX === "auto" || overflowX === "scroll") return parent;
        parent = parent.parentElement;
      }
      return null;
    };

    const epicOf = (element: Element): string | null =>
      element.closest("[data-epic-stage]")?.getAttribute("data-epic-id") ?? null;

    const lanes = Array.from(document.querySelectorAll("[data-landing-line]")).map(
      (lane) => {
        const wrapper = wrapperOf(lane);
        return {
          epicId: epicOf(lane),
          box: boxOf(lane),
          stations: Array.from(lane.querySelectorAll("[data-landing-station]")).map(
            (station) => ({
              stage: station.getAttribute("data-landing-station"),
              box: boxOf(station),
            }),
          ),
          wrapper: wrapper ? measureWrapper(wrapper) : null,
        };
      },
    );

    const maps = Array.from(document.querySelectorAll(".epic-stage-map")).map(
      (map) => {
        const wrapper = wrapperOf(map);
        return {
          epicId: epicOf(map),
          width: map.getBoundingClientRect().width,
          wrapper: wrapper ? measureWrapper(wrapper) : null,
        };
      },
    );

    // FR-006: every element carrying text, with the exception named explicitly.
    const viewportWidth = document.documentElement.clientWidth;
    const EPSILON = 0.5;
    let swept = 0;
    let excused = 0;
    const offenders: Array<{ description: string; right: number }> = [];

    /**
     * How far right the element is actually painted.
     *
     * A box inside an `overflow: hidden` ancestor is cut off at that
     * ancestor's edge, so its own right edge is not where it appears — React
     * Flow's node wrappers are the width of the canvas they pan inside, and
     * measuring their declared box would report content past the viewport that
     * no operator can see there. Scrolling ancestors are deliberately *not*
     * clipped here: content inside one is reachable, which is the exception
     * this sweep is about, and it is tested for below rather than assumed.
     */
    const visibleRight = (element: Element): number => {
      let right = element.getBoundingClientRect().right;
      let parent = element.parentElement;
      while (parent && parent !== document.documentElement) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (overflowX === "hidden" || overflowX === "clip") {
          const box = parent.getBoundingClientRect();
          right = Math.min(right, box.left + parent.clientWidth);
        }
        parent = parent.parentElement;
      }
      return right;
    };

    for (const element of Array.from(document.querySelectorAll("*"))) {
      const tag = element.tagName.toLowerCase();
      if (tag === "script" || tag === "style" || tag === "head" || tag === "title") {
        continue;
      }
      if (!(element.textContent ?? "").trim()) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      swept++;
      if (visibleRight(element) <= viewportWidth + EPSILON) continue;

      // Past the edge. That is intended horizontal scroll only if a wrapper
      // inside the room really scrolls and is itself on the screen, so the
      // operator has something to scroll. Anything else is laid out into
      // nowhere.
      const wrapper = wrapperOf(element);
      const reachable =
        wrapper !== null &&
        wrapper.scrollWidth > wrapper.clientWidth &&
        wrapper.getBoundingClientRect().right <= viewportWidth + EPSILON;

      if (reachable) excused++;
      else offenders.push({ description: describe(element), right: rect.right });
    }

    return {
      viewportWidth,
      room: { scrollWidth: room.scrollWidth, clientWidth: room.clientWidth },
      lanes,
      maps,
      sweep: { swept, excused, offenders },
    };
  });
}

for (const width of LAYOUT_WIDTHS) {
  test.describe(`the pane fits the screen at ${width}`, () => {
    test("the landing line lies within its wrapper's scrollable extent", async ({
      page,
    }) => {
      const measure = await measureLayout(page, width);

      // The Fixture floor stages epics with graphs, so there are lanes to
      // measure; an empty list would satisfy every assertion below for nothing.
      expect(measure.lanes.length).toBeGreaterThan(0);

      for (const lane of measure.lanes) {
        const wrapper = lane.wrapper;
        expect(
          wrapper,
          `${lane.epicId}: the landing line has no scrolling wrapper inside the room`,
        ).not.toBeNull();

        // FR-004, measured against the wrapper and never the viewport: the
        // lane's whole box lies inside the extent the wrapper can scroll to.
        const inWrapper = (x: number): number =>
          x - wrapper!.box.left + wrapper!.scrollLeft;
        expect(
          inWrapper(lane.box.left),
          `${lane.epicId}: lane starts before the wrapper's scrollable extent`,
        ).toBeGreaterThanOrEqual(-0.5);
        expect(
          inWrapper(lane.box.right),
          `${lane.epicId}: lane ends ${(inWrapper(lane.box.right) - wrapper!.scrollWidth).toFixed(1)}px past the wrapper's scrollable extent`,
        ).toBeLessThanOrEqual(wrapper!.scrollWidth + 0.5);

        // The wrapper is on the screen, so that extent is one an operator can
        // actually reach.
        expect(wrapper!.box.right).toBeLessThanOrEqual(width + 0.5);

        // And the four stations with it. The wrapper scrolls in one axis only,
        // so a station outside its client box vertically is not reachable at
        // all — DESIGN.md's landing line is taller than a shallow graph's map,
        // and this is the assertion that says so.
        expect(lane.stations.length).toBe(4);
        for (const station of lane.stations) {
          expect(
            inWrapper(station.box.right),
            `${lane.epicId}: station ${station.stage} is past the wrapper's scrollable extent`,
          ).toBeLessThanOrEqual(wrapper!.scrollWidth + 0.5);
          expect(
            station.box.top,
            `${lane.epicId}: station ${station.stage} sits above the wrapper`,
          ).toBeGreaterThanOrEqual(wrapper!.box.top - 0.5);
          expect(
            station.box.bottom,
            `${lane.epicId}: station ${station.stage} sits below the wrapper`,
          ).toBeLessThanOrEqual(wrapper!.box.top + wrapper!.clientHeight + 0.5);
        }
      }
    });

    test("a map wider than its wrapper makes the wrapper scroll", async ({ page }) => {
      const measure = await measureLayout(page, width);

      expect(measure.maps.length).toBeGreaterThan(0);

      // FR-005: the affordance is unconditional — DESIGN.md gives every map a
      // horizontally scrolling wrapper, not only the ones that overflow today.
      for (const map of measure.maps) {
        expect(map.wrapper, `${map.epicId}: the map has no wrapper`).not.toBeNull();
        expect(["auto", "scroll"]).toContain(map.wrapper!.overflowX);
        // The wrapper can always reach DESIGN.md's stated map width.
        expect(map.wrapper!.scrollWidth).toBeGreaterThanOrEqual(MAP_MIN_WIDTH);
      }

      // And where the content really does exceed the wrapper, the wrapper says
      // so: `scrollWidth` exceeds `clientWidth`, asserted rather than assumed.
      // The Given is read from DESIGN.md's own 1040px map width against the
      // measured column, never from `scrollWidth` itself — a test that took its
      // premise from the value under test would prove nothing.
      const mustScroll = measure.maps.filter(
        (map) => MAP_MIN_WIDTH > map.wrapper!.clientWidth,
      );
      for (const map of mustScroll) {
        expect(
          map.wrapper!.scrollWidth,
          `${map.epicId}: a ${MAP_MIN_WIDTH}px map in a ${map.wrapper!.clientWidth}px wrapper that does not scroll`,
        ).toBeGreaterThan(map.wrapper!.clientWidth);
      }

      // Non-vacuity, and it is width-dependent by arithmetic rather than by
      // luck: the route's first column is 220px and DESIGN.md's map is 1040px,
      // so at 1280 the map cannot fit its column and every map must scroll. At
      // 1440 it can, and a map that fits is not a defect — the loop above still
      // binds every map that does not.
      if (width === 1280) {
        expect(mustScroll.length).toBe(measure.maps.length);
        expect(mustScroll.length).toBeGreaterThan(0);
      }
    });

    test("no text is laid out past the viewport outside a scrollable wrapper", async ({
      page,
    }) => {
      const measure = await measureLayout(page, width);

      expect(measure.viewportWidth).toBe(width);

      // The room scrolls the floor vertically. It must not scroll it sideways:
      // that is what makes the exception below name a bounded wrapper on the
      // screen rather than the whole page, and it is the measurement the
      // shipped build failed — its lane was reachable only by scrolling the
      // room itself, 121px past the container, which is why the defect could
      // hide behind "the content is reachable".
      expect(measure.room.scrollWidth).toBeLessThanOrEqual(
        measure.room.clientWidth,
      );

      // A sweep over nothing passes for the wrong reason, so it has to have
      // really walked the room.
      expect(measure.sweep.swept).toBeGreaterThan(20);

      // And an exception never exercised proves nothing either. Where the
      // measured column is narrower than DESIGN.md's 1040px map, the map really
      // does run past the viewport and really is excused — so at that width the
      // sweep is separating the two cases rather than finding neither.
      const mapOverflows = measure.maps.some(
        (map) => map.wrapper!.clientWidth < MAP_MIN_WIDTH,
      );
      if (mapOverflows) expect(measure.sweep.excused).toBeGreaterThan(0);

      expect(
        measure.sweep.offenders.map(
          (offender) => `${offender.description} at ${offender.right.toFixed(0)}px`,
        ),
      ).toEqual([]);
    });
  });
}
