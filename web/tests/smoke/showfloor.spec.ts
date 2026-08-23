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
