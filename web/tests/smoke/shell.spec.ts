import { test, expect } from "@playwright/test";

test("page loads on sage with only vendored assets", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Ergane");

  const styles = await page.locator("link[rel='stylesheet']").all();
  const scripts = await page.locator("script[src]").all();
  const preconnect = await page.locator("link[rel='preconnect']").all();

  const hrefs = await Promise.all(
    styles.map((el) => el.getAttribute("href"))
  );
  const srcs = await Promise.all(scripts.map((el) => el.getAttribute("src")));

  for (const href of hrefs) {
    expect(href).not.toContain("https://");
  }
  for (const src of srcs) {
    expect(src).not.toContain("https://");
  }
  expect(hrefs.some((h) => h?.endsWith("/fonts/fonts.css"))).toBe(true);
  expect(preconnect).toHaveLength(0);

  const html = page.locator("html");
  await expect(html).toHaveCSS("background-color", "rgb(227, 232, 224)");

  const mark = page.locator(".mast .mark");
  await expect(mark).toBeVisible();
});
