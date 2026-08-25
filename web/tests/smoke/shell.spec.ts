/**
 * The app shell, in the second world (005 US2: FR-006, FR-007).
 *
 * This file used to assert the first world — `page loads with sage ground,
 * masthead, and vendored fonts`, `href="/fonts/fonts.css"` among the page's
 * stylesheets and `rgb(227, 232, 224)` as the ground. D-015 retired both: the
 * ground is `--ground` in whichever theme is asked for, and § Typography loads
 * nothing at all. The inversion is the design's, not a relaxation.
 *
 * It also **did not run**: no project in `playwright.config.ts` matched it, so
 * the gate collected it nowhere — the "a gate that matches nothing does not
 * exist" defect this repository shipped once already (001 US1-S1). It has a
 * project now, on the same fixture-backed backend as the Desk's.
 */

import { test, expect } from "@playwright/test";

test("the shell loads the second world and downloads nothing", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  await page.goto("/");
  await expect(page).toHaveTitle("Ergane");

  const hrefs = await page.locator("link[rel=stylesheet]").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("href")),
  );
  const srcs = await page.locator("script[src]").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("src")),
  );

  // § Typography: system stacks only, no remote stylesheet, ever — and no
  // vendored face either.
  for (const href of hrefs) {
    expect(href).not.toMatch(/^https?:\/\//);
    expect(href).not.toContain("/fonts/");
  }
  for (const src of srcs) {
    expect(src).not.toMatch(/^https?:\/\//);
  }
  expect(await page.locator("link[rel=preconnect], link[rel=preload]").count()).toBe(0);

  // Measured rather than declared: nothing the page fetched was a font file or
  // left this origin.
  expect(requests.length).toBeGreaterThan(2);
  for (const url of requests) {
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:/);
    expect(url).not.toMatch(/\.(woff2?|ttf|otf|eot)(\?|$)/i);
  }

  // The ground is the token's, in the theme the browser asked for.
  const measured = await page.evaluate(() => ({
    body: getComputedStyle(document.body).backgroundColor,
    token: getComputedStyle(document.documentElement).getPropertyValue("--ground").trim(),
  }));
  expect(measured.token.toUpperCase()).toBe("#EDF0F2");
  expect(measured.body).toBe("rgb(237, 240, 242)");

  await expect(page.locator(".mast")).toHaveCount(1);
  await expect(page.locator(".mast .mark")).toBeVisible();
});

test("the shell wears the dark world when the browser asks for it", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  const measured = await page.evaluate(() => ({
    body: getComputedStyle(document.body).backgroundColor,
    token: getComputedStyle(document.documentElement).getPropertyValue("--ground").trim(),
  }));
  expect(measured.token.toUpperCase()).toBe("#0D1418");
  expect(measured.body).toBe("rgb(13, 20, 24)");
});
