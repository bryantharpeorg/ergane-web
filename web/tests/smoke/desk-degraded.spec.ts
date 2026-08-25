import { expect, test } from "@playwright/test";

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
