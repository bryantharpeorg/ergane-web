import { expect, test } from "@playwright/test";

test("page loads on sage with only same-origin resources", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveTitle("Ergane");

  const stylesheets = await page.locator("link[rel=stylesheet]").evaluateAll((els) =>
    els.map((el) => (el as HTMLLinkElement).href)
  );
  const scripts = await page.locator("script[src]").evaluateAll((els) =>
    els.map((el) => (el as HTMLScriptElement).src)
  );
  const preconnects = await page.locator("link[rel=preconnect]").evaluateAll((els) =>
    els.map((el) => (el as HTMLLinkElement).href)
  );

  const baseURL = new URL(page.url()).origin;

  for (const href of [...stylesheets, ...scripts, ...preconnects]) {
    expect(href.startsWith(baseURL) || href.startsWith("http://127.0.0.1:8787")).toBe(true);
  }

  expect(stylesheets.some((h) => h.endsWith("/fonts/fonts.css"))).toBe(true);

  const htmlBg = await page.evaluate(() => {
    return window.getComputedStyle(document.documentElement).backgroundColor;
  });
  expect(htmlBg).toBe("rgb(227, 232, 224)");

  await expect(page.locator(".mast .mark")).toBeVisible();
});
