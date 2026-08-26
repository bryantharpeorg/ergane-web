/**
 * The review room, in a browser (011 US2: FR-007 … FR-011).
 *
 * The room renders a changed route in a **same-origin frame** at a width and a
 * theme the operator picks, and measures the four layout laws *inside that
 * frame* from the parent document. This file is where that stops being a claim:
 * a headless gate can assert a component tree, but only a real browser lays a
 * document out, and layout is the whole subject.
 *
 * ── no spec directory is named here ────────────────────────────────────────
 *
 * Which epic is reviewable is a fact about the corpus and moves with it, so the
 * one this file uses is **discovered**: the first spec the review route answers
 * `200` for whose changed files reach at least one room. Naming one would make
 * this suite go red the day an epic lands with no line of source touched — the
 * defect `tests/test_no_test_pins_live_corpus.py` exists to stop coming back.
 *
 * ── what a frame lets this suite do that nothing else could ────────────────
 *
 * The measurement the room renders and the measurement this suite takes are the
 * same function (`measureLawsIn`, `web/src/review/laws.ts`), so the numbers
 * beside the frame can be checked against the numbers Playwright reads out of
 * that frame's own document. That is the assertion that makes FR-008 mean
 * something: a room that rendered *a* number would pass a weaker one.
 *
 * ── FR-011 is the joke this corpus should not make ─────────────────────────
 *
 * A review room that violates the laws it measures. So the room itself is swept
 * at every width and in both themes, with the frame on the page and a route
 * rendered in it — including 2560px of frame inside a 1280px room, which is the
 * case that would take the document sideways if the frame's scroller were not
 * there.
 */

import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import { measureLaws } from "./support/laws";
import { measureLawsIn } from "../../src/review/laws";

/** The widths the suite sweeps, and the two themes DESIGN.md renders. */
const WIDTHS = [1280, 1600, 2560];
const THEMES = ["light", "dark"] as const;

type Reader = Pick<APIRequestContext, "get">;

interface ReviewRoute {
  path: string;
  kind: string | null;
}

/**
 * A landed epic this corpus can review, and the rooms its changes reach.
 *
 * Memoised per worker: every case below needs it, and walking the corpus once
 * per test would cost more wall clock than the page loads it sets up.
 */
let discovered: Promise<{ specDir: string; rooms: string[] }> | null = null;

function reviewable(request: Reader) {
  if (discovered !== null) return discovered;
  discovered = (async () => {
    const document = (await (await request.get("/api/showfloor")).json()) as {
      rail?: { spec_dir?: string }[];
    };
    for (const entry of document.rail ?? []) {
      if (entry.spec_dir === undefined) continue;
      const response = await request.get(
        `/api/review/${encodeURIComponent(entry.spec_dir)}`,
      );
      if (response.status() !== 200) continue;
      const review = (await response.json()) as { routes?: ReviewRoute[] };
      const rooms = (review.routes ?? [])
        .filter((route) => route.kind === "room")
        .map((route) => route.path);
      if (rooms.length > 0) return { specDir: entry.spec_dir, rooms };
    }
    throw new Error("no epic this backend serves is both landed whole and reaches a room");
  })();
  return discovered;
}

/**
 * The room, open on a reviewable epic, with the frame rendered *and measured*.
 *
 * The last clause is why this helper exists. The frame's `load` fires when its
 * document has loaded, which is before the room inside it has read anything and
 * rendered — so a suite that asserted on the first figures it saw would be
 * asserting about an empty shell, and would go green over a room that never
 * measured the page at all. Waiting for the leaf count to pass the same floor
 * every other sweep in this repository uses is what makes the wait non-vacuous.
 */
async function openRoom(page: Page, request: Reader): Promise<{ specDir: string; rooms: string[] }> {
  const found = await reviewable(request);
  await page.goto(`/review/${encodeURIComponent(found.specDir)}`);
  await page.waitForSelector("[data-track='the-thing-itself']");
  await page.waitForSelector("[data-measured]:not([data-measured='none'])");
  await expect
    .poll(async () => Number(await figure(page, "text leaves")), {
      message: "the room never measured a rendered document in the frame",
    })
    .toBeGreaterThan(10);
  return found;
}

/** The four laws measured inside the frame, by the suite rather than the room. */
async function measureFrame(page: Page) {
  return page.evaluate(`(() => {
    const frame = document.querySelector("[data-render-frame]");
    const doc = frame.contentDocument;
    return (${measureLawsIn.toString()})(doc);
  })()`) as Promise<ReturnType<typeof measureLawsIn>>;
}

/** One figure the room rendered, as it reads on the screen. */
async function figure(page: Page, label: string): Promise<string> {
  return (
    (await page.locator(`[data-figure='${label}'] .rv-figure-value`).textContent()) ?? ""
  ).trim();
}

/**
 * A measurement of the frame that the room agrees with, and the room's own.
 *
 * The room measures on a settle — a debounce over the frame document's own
 * `resize` and mutations — so its figures trail a change by a fraction of a
 * second by design. Polling until the two agree is what lets the assertions
 * below compare *numbers* rather than compare a screenshot of a race.
 */
async function agreed(page: Page): Promise<ReturnType<typeof measureLawsIn>> {
  let last = await measureFrame(page);
  await expect
    .poll(
      async () => {
        last = await measureFrame(page);
        return (await figure(page, "text leaves")) === String(last.leaves);
      },
      { message: "the room never reported the frame's own leaf count" },
    )
    .toBe(true);
  return last;
}

// --- FR-007: a same-origin frame, at the width and theme picked ------------

test("a route renders in a same-origin frame at the selected width and theme", async ({
  page,
  request,
}) => {
  const { rooms } = await openRoom(page, request);

  const frame = page.locator("[data-render-frame]");
  await expect(frame).toHaveAttribute("data-render-route", rooms[0]);

  // Same origin, and therefore readable: this is the whole of D-023's
  // substitution. A cross-origin frame would answer `null` here and the room
  // could not measure a thing.
  const address = await frame.evaluate(
    (element) => (element as HTMLIFrameElement).contentDocument?.location.href ?? null,
  );
  expect(address, "the frame's document is not reachable from this document").not.toBeNull();
  expect(new URL(address as string).origin).toBe(new URL(page.url()).origin);
  expect(new URL(address as string).pathname).toBe(rooms[0]);

  // The width the operator picked is the width the frame is laid out at — the
  // element's own content box, not merely the attribute this document set on
  // it. (What the *document inside* then reports is a couple of pixels less
  // when it has a scrollbar of its own, which is why the room renders the
  // measured viewport as its own figure rather than echoing the control.)
  for (const width of [1600, 1280]) {
    await page.locator(`[data-width-pick='${width}']`).click();
    await expect(frame).toHaveAttribute("data-render-width", String(width));
    await expect
      .poll(async () => frame.evaluate((element) => element.clientWidth))
      .toBe(width);
  }

  // And the theme: `global.css` lets an explicit `data-theme` beat the media
  // query, which is how a light page renders dark inside a dark-emulating room
  // and the other way round.
  for (const theme of THEMES) {
    await page.locator(`[data-theme-pick='${theme}']`).click();
    await expect(frame).toHaveAttribute("data-render-theme", theme);
    await expect
      .poll(async () =>
        frame.evaluate(
          (element) =>
            (element as HTMLIFrameElement).contentDocument?.documentElement.getAttribute(
              "data-theme",
            ) ?? null,
        ),
      )
      .toBe(theme);
  }
});

test("a route the operator picks is the route the frame goes to", async ({
  page,
  request,
}) => {
  const { rooms } = await openRoom(page, request);
  test.skip(rooms.length < 2, "this epic reaches one room, so there is nothing to pick between");

  const frame = page.locator("[data-render-frame]");
  await page.locator(`[data-route-pick='${rooms[1]}']`).click();

  await expect(frame).toHaveAttribute("data-render-route", rooms[1]);
  await expect
    .poll(async () =>
      frame.evaluate(
        (element) =>
          (element as HTMLIFrameElement).contentDocument?.location.pathname ?? null,
      ),
    )
    .toBe(rooms[1]);
});

// --- FR-008: measured inside the frame, and the numbers are on the screen --

test("the four laws are measured inside the frame and their numbers render beside it", async ({
  page,
  request,
}) => {
  await openRoom(page, request);
  await page.locator("[data-width-pick='1280']").click();

  const measured = page.locator("[data-measured]");
  await expect(measured).toHaveAttribute("data-width", "1280");

  // The suite's own measurement of the same document, through the same
  // function. Non-vacuous first: a sweep that found no text would agree with a
  // room that reported nothing.
  const inside = await agreed(page);
  expect(inside.leaves, "the frame's document has no text in it").toBeGreaterThan(10);
  expect(inside.painters, "the frame's document paints nothing").toBeGreaterThan(0);
  // The frame is laid out at the width picked, and what the document inside it
  // *sees* is that width less its own scrollbar. Both facts matter, and the
  // second is why the room renders the measured viewport instead of echoing the
  // control: a figure that echoed the control would be a number about the knob
  // rather than about the render.
  await expect
    .poll(async () => page.locator("[data-render-frame]").evaluate((e) => e.clientWidth))
    .toBe(1280);
  expect(
    inside.viewport,
    "the frame is not laid out at the width picked",
  ).toBeGreaterThan(1280 - 40);
  expect(inside.viewport).toBeLessThanOrEqual(1280);

  // FR-008: the *numbers*, not a pass/fail. Every figure the room renders is
  // the one the measurement produced.
  expect(await figure(page, "frame")).toBe(`${inside.viewport}px`);
  expect(await figure(page, "document")).toBe(`${inside.documentScrollWidth}px`);
  expect(await figure(page, "text leaves")).toBe(String(inside.leaves));
  expect(await figure(page, "painters")).toBe(String(inside.painters));
  expect(await figure(page, "hidden past the edge")).toBe(
    `${Math.max(0, Math.round(inside.documentScrollWidth - inside.viewport))}px`,
  );

  // And each law by name, with its count — the shape the two manual reviews
  // reported in, which is what made them worth automating.
  const violations = async (law: string) =>
    Number(await page.locator(`[data-law='${law}']`).getAttribute("data-violations"));

  expect(await violations("a")).toBe(inside.escaped.length);
  expect(await violations("b")).toBe(inside.past.length);
  expect(await violations("c")).toBe(inside.overlapping.length);
  expect(await violations("d")).toBe(inside.occluded.length);

  // A count on its own would satisfy the four assertions above; the figures do
  // not exist unless the room drew all five of them.
  expect(await page.locator("[data-figure]").count()).toBe(5);
  expect(await page.locator("[data-law]").count()).toBe(4);
});

test("the numbers follow the width, because they are of that render and no other", async ({
  page,
  request,
}) => {
  await openRoom(page, request);

  await page.locator("[data-width-pick='1280']").click();
  await expect(page.locator("[data-measured]")).toHaveAttribute("data-width", "1280");
  await expect
    .poll(async () => page.locator("[data-render-frame]").evaluate((e) => e.clientWidth))
    .toBe(1280);
  const narrow = (await measureFrame(page)).viewport;
  await expect.poll(async () => figure(page, "frame")).toBe(`${narrow}px`);

  await page.locator("[data-width-pick='2560']").click();
  await expect(page.locator("[data-measured]")).toHaveAttribute("data-width", "2560");
  await expect
    .poll(async () => (await measureFrame(page)).viewport)
    .toBeGreaterThan(narrow);

  const wide = (await measureFrame(page)).viewport;
  await expect.poll(async () => figure(page, "frame")).toBe(`${wide}px`);
  // The figures are of *this* render: the one the room showed at 1280 is not
  // still on the screen after the operator asked for 2560.
  expect(wide).toBeGreaterThan(narrow);
});

// --- FR-009, FR-010: the served revision, on the screen -------------------

test("the header names the revision the service is serving, and whether it holds the epic", async ({
  page,
  request,
}) => {
  await openRoom(page, request);

  const header = page.locator("[data-served]");
  await expect(header).toBeVisible();

  // A revision, in full on the element and cut for the reader — never a tick
  // standing in for the fact.
  const revision = await header
    .locator("[data-served-revision]")
    .getAttribute("data-served-revision");
  expect(revision, "the header names no revision").toMatch(/^[0-9a-f]{7,40}$/);
  expect((await header.locator("[data-served-revision]").textContent())?.trim()).toBe(
    (revision as string).slice(0, 12),
  );

  // And the sentence FR-009 asks for, in one of its three forms.
  const contains = await header.locator("[data-contains]").getAttribute("data-contains");
  expect(["yes", "no", "unknown"]).toContain(contains);

  // FR-010's band is rendered when, and only when, the answer is `no`. A
  // mismatch is a full-width band; anything else must not raise one, or the
  // alarm stops being believed.
  const band = page.locator("[data-mismatch]");
  if (contains === "no") {
    await expect(band).toBeVisible();
    expect(await band.locator("[data-missing]").count()).toBeGreaterThan(0);
    // Above the frame, not beside it or under it: it is the last thing the
    // operator sees before they start reading a screen about something else.
    const order = await page.evaluate(() => {
      const mismatch = document.querySelector("[data-mismatch]");
      const frame = document.querySelector("[data-render-frame]");
      if (mismatch === null || frame === null) return null;
      return (
        mismatch.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
    expect(order, "the band is not above the frame").toBeTruthy();
  } else {
    await expect(band).toHaveCount(0);
  }
});

// --- FR-011: the room holds the laws it measures --------------------------

test.describe("§ Layout's four laws over the review room (FR-011)", () => {
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      test(`reports zero violations at ${width} in ${theme}`, async ({ page, request }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme });
        await openRoom(page, request);

        const report = await measureLaws(page);

        // Non-vacuous: a sweep that found no text cannot pass for having laid
        // it out correctly (001 US1-S1, in its smoke shape).
        expect(report.leaves, "the sweep found no text at all").toBeGreaterThan(10);
        expect(report.painters, "the sweep found nothing painted").toBeGreaterThan(0);
        // And the room is really the whole room: header, both tracks, and a
        // frame with something in it.
        await expect(page.locator("[data-served]")).toBeVisible();
        await expect(page.locator("[data-track='what-changed']")).toBeVisible();
        await expect(page.locator("[data-render-frame]")).toBeVisible();

        expect(report.escaped, "text outside a scrolling ancestor").toEqual([]);
        expect(report.past, "an element past its container").toEqual([]);
        expect(report.overlapping, "two text leaves overlapping").toEqual([]);
        expect(report.occluded, "an opaque box painted over text").toEqual([]);

        // The room carries no `[data-showfloor-root]`, so the sentence "§ Stage
        // sanctions one horizontal scroll and it is the stage's" is held here by
        // the document's own width, exactly as `desk.spec.ts` and `draft.spec.ts`
        // hold it. Without this the frame could travel and take the page with it.
        expect(report.roomScrollsSideways, "the room scrolls sideways").toBe(false);
        expect(
          report.documentScrollWidth,
          "the document is wider than the viewport",
        ).toBeLessThanOrEqual(report.viewport + 1);
      });
    }
  }

  test("a frame wider than the room scrolls, and does not take the document with it", async ({
    page,
    request,
  }) => {
    // The case the scroller exists for, and the one that would be a defect in
    // this room of exactly the kind it was built to find in others.
    await page.setViewportSize({ width: 1280, height: 900 });
    await openRoom(page, request);
    await page.locator("[data-width-pick='2560']").click();
    await expect(page.locator("[data-render-frame]")).toHaveAttribute(
      "data-render-width",
      "2560",
    );

    const scroller = await page.locator("[data-frame-scroll]").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        overflows: element.scrollWidth > element.clientWidth,
        axis: { x: style.overflowX, y: style.overflowY },
        right: element.getBoundingClientRect().right,
        viewport: document.documentElement.clientWidth,
      };
    });

    // Non-vacuous: if the frame fits, this case proves nothing about scrolling.
    expect(scroller.overflows, "a 2560px frame fits in a 1280px room").toBe(true);
    expect(scroller.axis.x).toBe("auto");
    expect(scroller.axis.y).toBe("hidden");
    // And the scroller itself is on screen — one already past the viewport
    // would excuse nothing.
    expect(scroller.right).toBeLessThanOrEqual(scroller.viewport + 0.5);

    const report = await measureLaws(page);
    expect(report.escaped).toEqual([]);
    expect(report.past).toEqual([]);
    expect(report.overlapping).toEqual([]);
    expect(report.occluded).toEqual([]);
    expect(report.documentScrollWidth).toBeLessThanOrEqual(report.viewport + 1);
  });
});
