import { expect, test } from "@playwright/test";

function timeLeftText(expiresAt: string, reference: string): string {
  const expiry = new Date(expiresAt);
  const ref = new Date(reference);
  const diffMs = expiry.getTime() - ref.getTime();

  if (diffMs <= 0) {
    return "expired";
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  return `−${hh}:${mm}:${ss}`;
}

test("the Desk renders the fixture floor read-only", async ({ page, request }) => {
  const requests: { method: string; url: string }[] = [];
  page.on("request", (req) => {
    requests.push({ method: req.method(), url: req.url() });
  });

  await page.goto("/desk");
  await page.waitForSelector("section.attention article.item");

  // Learn the reference instant from the backend.
  const floorResponse = await request.get("/api/floor");
  expect(floorResponse.ok()).toBe(true);
  const floorDoc = (await floorResponse.json()) as {
    reference_instant: string | null;
    attention: { items: { kind: string; expires_at: string | null; id?: string | null }[] };
  };
  const referenceInstant =
    floorDoc.reference_instant ?? new Date().toISOString();

  const body = await page.evaluate(() => document.body.innerHTML);

  // Attention items render before any floor detail in DOM order.
  const lastItemIndex = body.lastIndexOf('article class="item');
  const firstFloorIndex = body.indexOf('section class="floor"');
  expect(lastItemIndex).toBeGreaterThan(-1);
  expect(firstFloorIndex).toBeGreaterThan(-1);
  expect(lastItemIndex).toBeLessThan(firstFloorIndex);

  // Each item names its kind and escalations show deterministic time left.
  const items = page.locator("section.attention article.item");
  const count = await items.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const kind = await item.getAttribute("data-kind");
    expect(kind).toMatch(/escalation|question/);
    await expect(item.locator(".kind")).toBeVisible();

    if (kind === "escalation") {
      const expiresAt = await item.getAttribute("data-expires-at");
      expect(expiresAt).not.toBeNull();
      const expected = timeLeftText(expiresAt as string, referenceInstant);
      await expect(item.locator(".clock")).toHaveText(expected);
    }
  }

  // The recorded Question carries no expiry.
  const question = page.locator('article.item[data-kind="question"]');
  await expect(question).toBeVisible();
  await expect(question.locator(".no-deadline")).toHaveText(
    "no deadline from the factory",
  );

  // Spend strip label and unknown rule.
  const spend = page.locator("section.spend");
  await expect(spend.locator("h2")).toHaveText(/spend to date/i);
  await expect(spend.locator(".unknown").first()).toHaveText("unknown");
  await expect(spend).not.toContainText(/live/i);

  // Paged scene: undeclared workgraph, but paged marker still present.
  const pagedRow = page.locator('article.epic[data-scene="paged-while-verifying"]');
  await expect(pagedRow).toBeVisible();
  const pagedChev = pagedRow.locator(".chev[data-paged]");
  await expect(pagedChev).toBeVisible();
  await expect(pagedChev).toHaveAttribute("data-undeclared", "true");
  await expect(pagedChev).toHaveAttribute("data-state", "VERIFYING");

  // Zero non-GET requests over the whole run.
  const nonGet = requests.filter((r) => r.method !== "GET");
  expect(nonGet).toHaveLength(0);
});
