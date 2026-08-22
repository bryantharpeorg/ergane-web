import { test, expect } from "@playwright/test";

test("page loads with sage ground, masthead, and vendored fonts", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Ergane");

  const stylesheets = await page.locator("link[rel=stylesheet]").all();
  const scripts = await page.locator("script[src]").all();
  const preconnects = await page.locator("link[rel=preconnect]").all();

  const hrefs = await Promise.all(stylesheets.map((el) => el.getAttribute("href")));
  const srcs = await Promise.all(scripts.map((el) => el.getAttribute("src")));

  expect(hrefs).toContain("/fonts/fonts.css");

  for (const href of hrefs) {
    expect(href).not.toMatch(/^https?:\/\//);
  }
  for (const src of srcs) {
    expect(src).not.toMatch(/^https?:\/\//);
  }
  expect(preconnects.length).toBe(0);

  const bg = await page.evaluate(() => window.getComputedStyle(document.documentElement).backgroundColor);
  expect(bg).toBe("rgb(227, 232, 224)");

  await expect(page.locator(".mast .mark")).toBeVisible();
});
