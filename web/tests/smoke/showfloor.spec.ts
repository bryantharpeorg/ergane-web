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
