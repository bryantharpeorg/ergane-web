/**
 * The review room, in a real browser (011 US2: FR-007 … FR-011).
 *
 * **Nothing here names a spec directory.** The corpus moves — an operator adds,
 * renames or refines a spec between builds, and epics land — and 008 US1 is the
 * subtraction of every assertion that turned red when they did. So the epic this
 * file opens is *discovered*: the Showfloor's own rail is walked and the first
 * entry whose review document the backend will actually serve is taken. A
 * partly landed epic is a 409 by design (FR-004), so the walk is the only honest
 * way to find one that is not.
 *
 * What is proved here, and only here, is what a browser can prove:
 *
 * * a changed route renders in a **same-origin frame** at the width and in the
 *   theme the operator selected (US2-S1, FR-007);
 * * the four layout laws are measured **inside that frame** and their measured
 *   numbers render beside it — proved by planting a violation in the frame's own
 *   document and requiring the room's figures to report it while the room itself
 *   stays clean (US2-S2, FR-008);
 * * the served revision is named on every render, and the mismatch band is
 *   present exactly when the document says the revision lacks the epic (US2-S3,
 *   US2-S4, FR-009, FR-010);
 * * § Layout's four containment laws report zero violations over the room
 *   itself, at every width and in both themes the suite sweeps (US2-S5, FR-011)
 *   — the joke this corpus should not make is a review room that violates the
 *   laws it measures;
 * * and the room issues no request that is not a GET of this origin, which is
 *   the runtime half of D-023's argument. The source half is
 *   `tests/unit/noVerb.test.ts`: the room spawns nothing, drives nothing and
 *   writes nothing, and neither test alone would show it.
 */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { measureLaws } from "./support/laws";

/** The widths the suite sweeps, and the two themes DESIGN.md renders. */
const WIDTHS = [1280, 1600, 2560] as const;
const THEMES = ["light", "dark"] as const;

/** The half of a request context this file uses. */
interface Reader {
  get: (url: string) => Promise<{ status: () => number; json: () => Promise<unknown> }>;
}

/** One route the epic reaches, as the review document carries it. */
interface DocumentRoute {
  path: string;
  kind: string | null;
}

/**
 * An epic the backend will serve a review of, discovered rather than named.
 *
 * Memoised per worker: every case below needs it, and re-walking the corpus once
 * per test would cost more wall clock than the page loads it exists to set up.
 */
let discovered: Promise<{ specDir: string; rooms: string[] }> | null = null;

function reviewable(request: Reader) {
  if (discovered !== null) return discovered;
  discovered = (async () => {
    const rail = (await (await request.get("/api/showfloor")).json()) as {
      rail?: { spec_dir?: string }[];
    };
    for (const entry of rail.rail ?? []) {
      if (entry.spec_dir === undefined) continue;
      const answer = await request.get(
        `/api/review/${encodeURIComponent(entry.spec_dir)}`,
      );
      // 409 is a partly landed epic and 404 a directory that is not there;
      // neither is a room to look at, and both are US1's assertions anyway.
      if (answer.status() !== 200) continue;
      const document = (await answer.json()) as { routes?: DocumentRoute[] };
      const rooms = (document.routes ?? [])
        .filter((route) => route.kind === "room")
        .map((route) => route.path);
      if (rooms.length > 0) return { specDir: entry.spec_dir, rooms };
    }
    throw new Error("no epic the backend serves has a review with a room in it");
  })();
  return discovered;
}

/** The room, open on a fully landed epic, with the frame loaded and measured. */
async function openRoom(
  page: Page,
  request: Reader,
): Promise<{ specDir: string; rooms: string[] }> {
  const epic = await reviewable(request);
  await page.goto(`/review/${encodeURIComponent(epic.specDir)}`);
  await page.waitForSelector("[data-track='the-thing-itself']");
  await page.waitForSelector("[data-measured='taken']");
  return epic;
}

/** What the frame's own document says about itself, read across the boundary. */
async function insideTheFrame(page: Page) {
  return page.evaluate(() => {
    const frame = document.querySelector("iframe.rv-render") as HTMLIFrameElement | null;
    if (frame === null) return null;
    const inner = frame.contentDocument;
    if (inner === null) return null;
    return {
      path: frame.contentWindow?.location.pathname ?? null,
      theme: inner.documentElement.getAttribute("data-theme"),
      clientWidth: inner.documentElement.clientWidth,
      ground: getComputedStyle(inner.body).backgroundColor,
      elementWidth: Math.round(frame.getBoundingClientRect().width),
    };
  });
}

/** The room's own figure for one law, as an operator reads it. */
async function violationsOf(page: Page, law: string): Promise<number> {
  const value = await page
    .locator(`[data-law='${law}']`)
    .getAttribute("data-violations");
  expect(value, `the room rendered no figure for the ${law} law`).not.toBeNull();
  return Number(value);
}

/** Every request the page made, so a write anywhere would be visible. */
const requests: string[] = [];

test.beforeEach(({ page }) => {
  requests.length = 0;
  page.on("request", (request) => requests.push(`${request.method()} ${request.url()}`));
});

test.afterEach(() => {
  // D-023's runtime half: the room reads, and reaches nothing but this origin.
  const wrong = requests.filter(
    (entry) => !entry.startsWith("GET ") || !entry.includes(" http://127.0.0.1:"),
  );
  expect(wrong, "the review room issued a request it may not make").toEqual([]);
});

test("the frame renders a changed route at the selected width and theme (FR-007)", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const epic = await openRoom(page, request);

  // The frame is on one of the routes the backend resolved for this epic, and
  // it is this pane's own origin: nothing else could be measured from here.
  const frame = page.locator("iframe.rv-render");
  const src = await frame.getAttribute("src");
  expect(epic.rooms, "the frame is on a route the document did not carry").toContain(src);

  const first = await insideTheFrame(page);
  expect(first, "the frame's document was not reachable from the room").not.toBeNull();
  expect(first!.path).toBe(src);
  expect(first!.theme).toBe("light");

  // The width is the operator's. 1600 in a 1280 viewport is the case that
  // proves it: the frame is wider than the room it sits in.
  await page.locator("[data-width-choice='1600']").click();
  await page.waitForSelector("[data-measured-width='1600']");
  const widened = await insideTheFrame(page);
  expect(widened!.elementWidth).toBe(1600);
  expect(widened!.clientWidth).toBeGreaterThan(1280);
  expect(widened!.clientWidth).toBeLessThanOrEqual(1600);

  // And the theme is the operator's, applied to the frame's own root — an
  // explicit `data-theme` beats the operating system's preference in either
  // direction (`styles/global.css` § Colors).
  await page.locator("[data-theme-choice='dark']").click();
  await page.waitForSelector("[data-measured-theme='dark']");
  const darkened = await insideTheFrame(page);
  expect(darkened!.theme).toBe("dark");
  expect(
    darkened!.ground,
    "the frame's ground did not change with the theme",
  ).not.toBe(widened!.ground);
});

test("the four laws are measured inside the frame, with their numbers (FR-008)", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openRoom(page, request);

  await page.locator("[data-width-choice='1600']").click();
  await page.waitForSelector("[data-measured-width='1600']");

  // The figures are the *frame's*. The room's own viewport is 1280 and the
  // frame's is 1600, so a panel reporting the room would report 1280 here —
  // which is exactly the failure a measurement reaching for the ambient
  // document would produce, and it would look entirely plausible.
  const viewport = Number(
    (await page.locator("[data-figure='viewport'] .rv-figure-value").textContent())
      ?.replace(/[^\d]/g, ""),
  );
  expect(viewport).toBeGreaterThan(1280);
  expect(viewport).toBeLessThanOrEqual(1600);

  // Non-vacuous: a panel that swept no text cannot pass for having measured a
  // clean screen (001 US1-S1, in its smoke shape).
  const leaves = Number(
    (await page.locator("[data-figure='text swept'] .rv-figure-value").textContent())
      ?.replace(/[^\d]/g, ""),
  );
  expect(leaves, "the sweep inside the frame found no text at all").toBeGreaterThan(10);

  // All four, each with a count and never a verdict standing in for it.
  for (const law of ["escaped", "past", "overlapping", "occluded"]) {
    const row = page.locator(`[data-law='${law}']`);
    await expect(row).toHaveCount(1);
    expect(await row.textContent()).toMatch(/\d+ violations?/);
  }
});

test("the numbers come from the frame's document and not the room's (FR-008)", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openRoom(page, request);

  // The control this file exists to be believed on. A violation is planted
  // *inside the frame* — text laid out past the frame's own right edge, outside
  // any scrolling ancestor — and the room's figures must report it. Measured
  // against the room instead, the plant is invisible: it is inside a document
  // `document.querySelectorAll` never walks.
  const planted = await page.evaluate(() => {
    const frame = document.querySelector("iframe.rv-render") as HTMLIFrameElement;
    const inner = frame.contentDocument!;
    const escapee = inner.createElement("div");
    escapee.textContent = "planted past the frame's right edge";
    escapee.setAttribute("data-planted", "true");
    escapee.style.position = "absolute";
    escapee.style.top = "0px";
    escapee.style.left = `${inner.documentElement.clientWidth + 400}px`;
    escapee.style.whiteSpace = "nowrap";
    inner.body.appendChild(escapee);
    return inner.documentElement.clientWidth;
  });
  expect(planted, "the frame laid out to nothing").toBeGreaterThan(0);

  // Re-measure by changing the width: the frame is not reloaded, so the plant
  // survives into the new measurement.
  await page.locator("[data-width-choice='1600']").click();
  await page.waitForSelector("[data-measured-width='1600']");

  expect(
    await violationsOf(page, "past"),
    "the room's figures did not see a violation planted inside the frame",
  ).toBeGreaterThan(0);
  expect(await page.locator("[data-law='past'] .rv-law-detail li").count()).toBeGreaterThan(
    0,
  );

  // And the room itself is still clean: the plant is in the frame, and the two
  // documents are measured apart.
  const room = await measureLaws(page);
  expect(room.past, "the plant leaked into the room's own sweep").toEqual([]);

  await page.evaluate(() => {
    const frame = document.querySelector("iframe.rv-render") as HTMLIFrameElement;
    frame.contentDocument!.querySelector("[data-planted]")?.remove();
  });
});

test("the room names the revision it is serving, and says whether it holds the epic (FR-009)", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const epic = await openRoom(page, request);

  const stamp = page.locator("[data-served]");
  await expect(stamp).toHaveCount(1);
  const contains = await stamp.getAttribute("data-contains");
  expect(["yes", "no", "unknown"]).toContain(contains);

  // Whichever of the three this deployment is, the room says it in words as
  // well as in an attribute — state is never carried by an attribute alone.
  const sentence = await stamp.textContent();
  expect(sentence).toContain("Serving");
  if (contains === "yes") expect(sentence).toContain(epic.specDir);

  // FR-010's invariant, asserted over whatever this service happens to be
  // serving: the band is present exactly when the revision lacks the epic. The
  // constructed mismatch itself is driven where a pair of revisions can be
  // built — `tests/test_review_served_revision.py` and
  // `tests/unit/Review.served.test.tsx`.
  const band = await page.locator("[data-mismatch]").count();
  expect(band, "the band and the header disagree about the served revision").toBe(
    contains === "no" ? 1 : 0,
  );
});

/**
 * § Layout's four laws over the review room itself (US2-S5, FR-011).
 *
 * "The four layout laws apply to this room too" — the plan's last named trap,
 * and the reason it is named is that a review room which violates the laws it
 * measures is the joke this corpus should not make. The room is swept with the
 * frame loaded and the numbers rendered beside it, which is the state it is
 * actually looked at in: a sweep over the room before its frame arrives would
 * pass over a layout no operator ever sees.
 *
 * The widths are the three the rest of the suite sweeps, and 2560 is the one
 * that bites: the frame takes the operator's width regardless of the room's, so
 * the scroller that holds it is the only thing standing between a 2560px frame
 * and a document that travels sideways.
 */
test.describe("the four laws over the review room (FR-011)", () => {
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      test(`reports zero violations at ${width} in ${theme}`, async ({ page, request }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme });
        await openRoom(page, request);

        const report = await measureLaws(page);

        // Non-vacuous first: a sweep that found no text cannot pass for having
        // laid it out correctly, and one that found no paint cannot pass law
        // (d) at all.
        expect(report.leaves, "the sweep found no text at all").toBeGreaterThan(10);
        expect(report.painters, "the sweep found nothing painted").toBeGreaterThan(0);
        // And the room really is the whole room: both tracks and the frame.
        await expect(page.locator("[data-track='what-changed']")).toHaveCount(1);
        await expect(page.locator("[data-track='the-thing-itself']")).toHaveCount(1);
        await expect(page.locator("iframe.rv-render")).toHaveCount(1);

        expect(report.escaped, "text outside a scrolling ancestor").toEqual([]);
        expect(report.past, "an element past its container").toEqual([]);
        expect(report.overlapping, "two text leaves overlapping").toEqual([]);
        expect(report.occluded, "an opaque box painted over text").toEqual([]);
        // The review room carries no `[data-showfloor-root]`, so "one
        // horizontal scroll, and it is the frame's" is held by the document's
        // own width — the same pair `desk.spec.ts` and `draft.spec.ts` assert,
        // and here it is what stops a 2560px frame taking the page with it.
        expect(report.documentScrollWidth, "the document is wider than the viewport")
          .toBeLessThanOrEqual(report.viewport + 1);
      });
    }
  }
});
