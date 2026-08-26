import { expect, test } from "@playwright/test";

import { measureLaws } from "./support/laws";

test("degraded modes render distinctly and healthy sections survive", async ({ page }) => {
  await page.goto("/desk");

  // The refusal scene's epic status is refused.
  const refusal = page.locator('.degraded[data-mode="refusal"]');
  await expect(refusal).toBeVisible();
  await expect(refusal).toContainText("refused its query");
  await expect(refusal).toHaveAttribute(
    "data-epic-id",
    "077-a-scanner-the-operator-chooses-runs-in-the-loop",
  );

  // Health read failed with transport mode.
  const healthTransport = page.locator(
    '.degraded[data-mode="transport"][data-section="health"]',
  );
  await expect(healthTransport).toBeVisible();
  await expect(healthTransport).toContainText("could not be reached");
  await expect(healthTransport).toContainText("list_findings");

  // The two visible wells differ in wording.
  const refusalText = await refusal.textContent();
  const transportText = await healthTransport.textContent();
  expect(refusalText).not.toBe(transportText);
  expect(refusalText).not.toContain("could not be reached");
  expect(transportText).not.toContain("refused its query");

  // Healthy sections still render despite the health failure.
  await expect(page.locator("section.attention")).toBeVisible();
  await expect(page.locator("section.floor article.epic").first()).toBeVisible();
  await expect(page.locator("section.spend")).toBeVisible();

  // No remote stylesheet was loaded.
  const remoteStyles = await page.locator('link[rel="stylesheet"][href^="https://"]').count();
  expect(remoteStyles).toBe(0);
});

/**
 * 009 US2 (FR-005). The fourth law over the room D-018 watched it fail in.
 *
 * The defect that bought the law was **a degraded note**: on 2026-08-25 one
 * rendered with its heading cut mid-word, in both themes, while the three
 * laws that existed all passed. This backend is the one that produces degraded
 * wells — `PANE_DEMO_TRANSPORT_FAIL=health` on 8788 — so the law is measured
 * here, over both wells, at both widths and in both themes, and not only over
 * the healthy floor that never showed the defect.
 *
 * Laws (a), (b) and (c) ride along in the same pass. (a) has no stage to
 * measure in this room; (b) and (c) are `desk.spec.ts`'s over the healthy
 * floor and are asserted here as well, because a degraded floor is a different
 * layout and the wells are the part of it that moves.
 */
test("no well paints over the text it is explaining, in either theme", async ({ page }) => {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const width of [1280, 1600]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/desk");

      // Both wells on the screen before anything is measured: a sweep of a
      // floor that had not degraded yet would pass for the wrong reason.
      await page.waitForSelector('.degraded[data-mode="refusal"]');
      await page.waitForSelector('.degraded[data-mode="transport"][data-section="health"]');

      const where = `${width} in ${scheme}`;
      const report = await measureLaws(page);

      expect(report.swept, `${where}: the degraded Desk rendered text`).toBeGreaterThan(40);
      expect(report.leaves, `${where}: the degraded Desk has text leaves`).toBeGreaterThan(20);
      expect(report.painters, `${where}: the degraded Desk paints backgrounds`).toBeGreaterThan(5);

      expect(report.occluded, `${where}: a box paints over text it does not own`).toEqual([]);
      expect(report.overlapping, `${where}: two text leaves overlap`).toEqual([]);
      expect(report.past, `${where}: text past the viewport`).toEqual([]);
      expect(report.escaped, `${where}: a stage child escaped its stage`).toEqual([]);
    }
  }
});
