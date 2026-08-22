import { expect, test } from "@playwright/test";

test("page loads with sage ground and vendored fonts", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Ergane");

  const stylesheets = await page.locator('link[rel="stylesheet"]').all();
  const scripts = await page.locator('script[src]').all();
  const preconnects = await page.locator('link[rel="preconnect"]').all();

  const hrefs = await Promise.all(
    stylesheets.map(async (link) => link.getAttribute("href"))
  );
  const srcs = await Promise.all(
    scripts.map(async (script) => script.getAttribute("src"))
  );

  expect(hrefs).toContain("/fonts/fonts.css");

  for (const url of [...hrefs, ...srcs]) {
    expect(url).toBeTruthy();
    expect(url).not.toContain("https://");
  }

  expect(preconnects).toHaveLength(0);

  const htmlBg = await page.evaluate(() => {
    const html = document.documentElement;
    return window.getComputedStyle(html).backgroundColor;
  });
  expect(htmlBg).toBe("rgb(227, 232, 224)");

  await expect(page.locator(".mast .mark")).toBeVisible();
});
