/**
 * The review room, in a real browser, against the floor `PANE_DEMO=1` serves.
 *
 * 011 US2, FR-007, FR-008 and FR-011 (T016). Three things a headless assertion
 * over a component cannot reach, and all three are the reason this file exists:
 *
 * 1. **The frame really renders another of this pane's rooms**, same origin,
 *    behind the same bearer token, at the width the operator picked. jsdom has
 *    no frames, no navigation and no layout; the only place this claim can be
 *    made is here.
 * 2. **The four laws really measure inside it.** `web/src/layoutLaws.ts` is one
 *    implementation with two callers (plan D2) — this suite evaluates it in the
 *    page, and the room calls it against `frame.contentDocument`. The proof that
 *    those are the same measurement is that a room framed here and swept
 *    directly by `measureLaws` agrees with the room's own numbers, and that is
 *    asserted below rather than argued.
 * 3. **The room holds the laws it measures** (FR-011). A review room that broke
 *    the four laws while reporting on them is the joke this corpus should not
 *    make (plan, Named traps), so the room is swept at every width and in both
 *    themes the rest of this suite sweeps: 1280/1600/2560, light and dark.
 *
 * **Nothing here pins the corpus.** The epic under review is discovered from
 * documents the pane serves — the showfloor's rail, then `/api/review/<dir>`
 * until one answers 200 with a room route that is not this room's. An epic
 * landing, or a spec being attested, must not turn a gate red with no line of
 * source touched (008 US1).
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { measureLaws } from "./support/laws";

/** The widths the rest of this suite sweeps, and the ones the room offers. */
const WIDTHS = [1280, 1600, 2560] as const;
const SCHEMES = ["light", "dark"] as const;

interface Reviewable {
  specDir: string;
  /** Every route the room will put in a frame, in the manifest's own order. */
  framed: string[];
  served: {
    revision: string | null;
    short_revision: string | null;
    contains_epic: boolean | null;
    missing: string[];
  };
}

/**
 * A landed epic this floor can review, found from the pane's own documents.
 *
 * The first spec of the rail whose review document answers 200 and reaches at
 * least one room route that is not the review room. A floor with none is a
 * floor this room cannot be smoked against at all, and that is a failure rather
 * than a skip — a gate that quietly matches nothing is the defect 001 US1-S1
 * exists to prevent.
 */
async function reviewable(page: Page): Promise<Reviewable> {
  const showfloor = await page.request.get("/api/showfloor");
  expect(showfloor.status(), "the floor answers with the token").toBe(200);
  const rail = ((await showfloor.json()).rail ?? []) as Array<{ spec_dir: string }>;
  expect(rail.length, "this floor has specs on it").toBeGreaterThan(0);

  for (const entry of rail) {
    const answer = await page.request.get(`/api/review/${entry.spec_dir}`);
    if (answer.status() !== 200) continue;
    const document = await answer.json();
    const framed = (document.routes as Array<{ path: string; kind: string | null }>)
      .filter((route) => route.kind === "room" && !route.path.startsWith("/review"))
      .map((route) => route.path);
    if (framed.length === 0) continue;
    return { specDir: entry.spec_dir, framed, served: document.served };
  }

  throw new Error("no epic on this floor is fully landed and reaches a framed room");
}

/**
 * Open the room and wait for the frame to have been measured at `at`.
 *
 * The readout carries the coordinates its figures belong to, so waiting on
 * *those* rather than on "a readout exists" is what keeps a width change from
 * being asserted against the previous width's numbers.
 */
async function measured(
  page: Page,
  at: { route: string; width: number; theme: string },
): Promise<void> {
  await page.waitForSelector(
    `[data-laws][data-at-route="${at.route}"][data-at-width="${at.width}"][data-at-theme="${at.theme}"]`,
  );
}

/**
 * Wait until the framed room has actually fetched and drawn its own document.
 *
 * **Measured, not assumed** (2026-08-26): a framed `/` answers 65 characters of
 * "Reading the floor…" for roughly a second, then 5,409 characters of Desk, and
 * the sweep goes from 14 text elements to 306 across that boundary. A test that
 * asserted a floor without waiting for it would be asserting the clock.
 *
 * This is also why the room has a **Measure again** control at all: the sweep
 * that runs at the frame's `load` measures a room that is still arriving, and
 * the honest answer is to show the figures with their floors and let the
 * operator ask again — not to guess at a settling delay in production code.
 */
async function filled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const element = document.querySelector("iframe[data-render]") as HTMLIFrameElement | null;
    const framed = element === null ? null : element.contentDocument;
    return framed !== null && (framed.body.textContent ?? "").trim().length > 1000;
  });
}

/** The framed document's own viewport width, whatever a scrollbar left of it. */
async function framedViewport(page: Page): Promise<{ frame: number; viewport: number }> {
  return page.evaluate(() => {
    const element = document.querySelector("iframe[data-render]") as HTMLIFrameElement;
    const framed = element.contentDocument as Document;
    return { frame: element.clientWidth, viewport: framed.documentElement.clientWidth };
  });
}

/** Every figure the readout renders, keyed by the measure it names. */
async function figures(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const out: Record<string, string> = {};
    for (const row of Array.from(document.querySelectorAll("[data-measure]"))) {
      const key = row.getAttribute("data-measure");
      const value = row.querySelector("td.num");
      if (key !== null && value !== null) out[key] = (value.textContent ?? "").trim();
    }
    for (const row of Array.from(document.querySelectorAll("[data-law]"))) {
      const key = row.getAttribute("data-law");
      if (key !== null) out[`law-${key}`] = row.getAttribute("data-found") ?? "";
    }
    return out;
  });
}

// --- FR-007: the frame renders the route, at the width, in the theme -------

test.describe("the frame renders a changed screen at a chosen width and theme (FR-007)", () => {
  test("puts one of the epic's own rooms in a same-origin frame", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    const epic = await reviewable(page);
    await page.goto(`/review/${epic.specDir}`);

    const frame = page.locator("iframe[data-render]");
    await expect(frame).toHaveCount(1);
    // The room offers the routes its own document named, and only those.
    const offered = await page
      .locator('[data-pick="route"] [data-option]')
      .evaluateAll((options) => options.map((option) => option.getAttribute("data-option")));
    expect(offered).toEqual(epic.framed);
    expect(await frame.getAttribute("src")).toBe(epic.framed[0]);

    // Same origin, and really rendered: the parent document can read inside it,
    // which is the whole of D-023's substitution. Waited for rather than caught
    // on the way past — a frame this test asked about before it had loaded one
    // reported an empty document and failed on the clock, twice in three full
    // suite runs on 2026-08-26.
    await filled(page);
    const inside = await page.evaluate(() => {
      const element = document.querySelector("iframe[data-render]") as HTMLIFrameElement;
      const framed = element.contentDocument as Document;
      return {
        origin: framed.location.origin,
        text: (framed.body.textContent ?? "").trim().length,
      };
    });
    expect(inside.origin).toBe(new URL(page.url()).origin);
    expect(inside.text, "the framed room rendered its own document").toBeGreaterThan(1000);
  });

  test("resizes the framed viewport to the chosen width, and dresses it in the chosen theme", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    const epic = await reviewable(page);
    await page.goto(`/review/${epic.specDir}`);
    await measured(page, { route: epic.framed[0], width: 1280, theme: "light" });
    // The frame does not reload for a width or a theme, so once it has filled
    // it stays filled for the whole sweep below.
    await filled(page);

    for (const width of WIDTHS) {
      await page.locator(`[data-pick="width"] [data-option="${width}"]`).click();
      for (const theme of SCHEMES) {
        await page.locator(`[data-pick="theme"] [data-option="${theme}"]`).click();
        await measured(page, { route: epic.framed[0], width, theme });
        const where = `${width} in ${theme}`;

        const boxes = await framedViewport(page);
        const dressed = await page.evaluate(() => {
          const element = document.querySelector("iframe[data-render]") as HTMLIFrameElement;
          const framed = element.contentDocument as Document;
          return framed.documentElement.getAttribute("data-theme");
        });

        // The frame *is* the width the operator chose, which is what makes a
        // measurement taken inside it a measurement at that width.
        expect(boxes.frame, `${where}: the frame is the chosen width`).toBe(width);
        expect(dressed, `${where}: the frame wears the chosen theme`).toBe(theme);

        // And the readout says both, separately and on purpose: a framed room
        // tall enough to scroll leaves its own viewport a classic scrollbar
        // narrower than the frame around it, and that difference is a figure
        // the operator should see rather than one the room should hide.
        const figured = await figures(page);
        expect(figured.chosen, `${where}: the readout names the frame's box`).toBe(
          String(width),
        );
        expect(figured.viewport, `${where}: and the viewport it measured inside it`).toBe(
          String(boxes.viewport),
        );
        expect(
          Number(figured.viewport),
          `${where}: which is the frame's width, less at most a scrollbar`,
        ).toBeGreaterThan(width - 40);
      }
    }
  });

  test("the room's own theme choice is the frame's, and never the page's", async ({ page }) => {
    // `global.css` resolves dark from `prefers-color-scheme` unless `:root`
    // carries `data-theme`. The operator's choice must reach the frame in both
    // directions, or "a theme I choose" would mean "the one my OS is in".
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 1600, height: 1000 });
    const epic = await reviewable(page);
    await page.goto(`/review/${epic.specDir}`);
    await measured(page, { route: epic.framed[0], width: 1280, theme: "light" });
    await filled(page);

    const grounds = await page.evaluate(() => {
      const element = document.querySelector("iframe[data-render]") as HTMLIFrameElement;
      const framed = element.contentDocument as Document;
      const view = framed.defaultView as Window;
      return {
        frame: view.getComputedStyle(framed.body).backgroundColor,
        room: getComputedStyle(document.body).backgroundColor,
      };
    });

    // The OS says dark; the operator chose light. They must not be the same
    // ground, or the choice reached nothing.
    expect(grounds.frame).not.toBe(grounds.room);
  });

  test("moves the frame to the route the operator picks", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    const epic = await reviewable(page);
    test.skip(epic.framed.length < 2, "this epic reaches only one framed room");
    await page.goto(`/review/${epic.specDir}`);
    await measured(page, { route: epic.framed[0], width: 1280, theme: "light" });

    const second = epic.framed[1];
    await page.locator(`[data-pick="route"] [data-option="${second}"]`).click();
    await measured(page, { route: second, width: 1280, theme: "light" });

    expect(await page.locator("iframe[data-render]").getAttribute("src")).toBe(second);
  });
});

// --- FR-008: the numbers are the gate's numbers ----------------------------

test.describe("the four layout laws are measured inside the frame (FR-008)", () => {
  test("the room's figures are the ones this suite's own harness produces", async ({ page }) => {
    // Plan D2's claim, asserted rather than argued: there is one implementation
    // of the four laws, so the room's numbers for a framed route and this
    // suite's numbers for that route rendered directly must agree.
    await page.setViewportSize({ width: 1600, height: 1000 });
    const epic = await reviewable(page);
    const route = epic.framed[0];

    await page.goto(`/review/${epic.specDir}`);
    await page.locator('[data-pick="width"] [data-option="1600"]').click();
    await measured(page, { route, width: 1600, theme: "light" });
    // The framed room fetches its own document after it loads, so the sweep at
    // load measured a room still arriving. This is what the control is for.
    await filled(page);
    await page.locator("[data-remeasure]").click();
    const roomsFigures = await figures(page);

    // The same route, at the same width and height, rendered as the page rather
    // than in a frame, and swept by the harness the gates use. The height
    // matters as much as the width: the frame is 720px tall, and a document
    // that scrolls has a narrower viewport than one that does not.
    await page.setViewportSize({ width: 1600, height: 720 });
    await page.goto(route);
    await page.waitForFunction(
      () => (document.body.textContent ?? "").trim().length > 1000,
    );
    const direct = await measureLaws(page);

    expect(roomsFigures.viewport, "same viewport").toBe(String(direct.viewport));
    expect(roomsFigures.document, "same document width").toBe(
      String(direct.documentScrollWidth),
    );
    // The four counts, from two callers of one function.
    expect(roomsFigures["law-a"]).toBe(String(direct.escaped.length));
    expect(roomsFigures["law-b"]).toBe(String(direct.past.length));
    expect(roomsFigures["law-c"]).toBe(String(direct.overlapping.length));
    expect(roomsFigures["law-d"]).toBe(String(direct.occluded.length));
  });

  test("reports measured numbers and not a verdict, over a frame that really rendered", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    const epic = await reviewable(page);
    await page.goto(`/review/${epic.specDir}`);
    await measured(page, { route: epic.framed[0], width: 1280, theme: "light" });
    await filled(page);
    await page.locator("[data-remeasure]").click();

    const figured = await figures(page);

    // A sweep over nothing passes for the wrong reason. The floors are on the
    // page, so the operator can see the pass was earned.
    expect(Number(figured.swept), "the frame rendered text").toBeGreaterThan(20);
    expect(Number(figured.leaves), "the frame has text leaves").toBeGreaterThan(10);
    expect(Number(figured.painters), "the frame paints backgrounds").toBeGreaterThan(3);
    // Figures, with their units, not four ticks.
    expect(figured.height, "the frame's height is a figure").toBe("720");
    expect(figured).toHaveProperty("hidden");
    await expect(page.locator('[data-measure="hidden"]')).toContainText("px");
    await expect(page.locator('[data-law="b"]')).toContainText("elements");
  });

  test("says unmeasured, never zero violations, when the sweep could not run", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    const epic = await reviewable(page);
    await page.goto(`/review/${epic.specDir}`);
    await measured(page, { route: epic.framed[0], width: 1280, theme: "light" });

    // Take the document out from under the sweep, the way a frame that has not
    // loaded one leaves it, and ask again.
    await page.evaluate(() => {
      const element = document.querySelector("iframe[data-render]") as HTMLIFrameElement;
      Object.defineProperty(element, "contentDocument", { get: () => null });
    });
    await page.locator("[data-remeasure]").click();

    await expect(page.locator('[data-laws="unmeasured"]')).toHaveCount(1);
    await expect(page.locator('[data-law="a"]')).toHaveCount(0);
    await expect(page.locator("[data-laws] .degraded")).toContainText("document");
  });
});

// --- FR-009, FR-010: the served revision, on the screen --------------------

test.describe("the room names the revision it is serving (FR-009, FR-010)", () => {
  test("the header is at the top of the view and says what the document said", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    const epic = await reviewable(page);
    await page.goto(`/review/${epic.specDir}`);

    const stamp = page.locator("[data-served]");
    await expect(stamp).toHaveCount(1);
    // Whatever the checkout this smoke runs against happens to be, the room
    // renders what the document said and nothing else — the condition is never
    // pinned here, only the agreement between the two.
    if (epic.served.revision === null) {
      await expect(stamp).toContainText("revision unknown");
    } else {
      await expect(stamp).toContainText(epic.served.short_revision as string);
    }
    expect(await stamp.getAttribute("data-contains")).toBe(
      epic.served.revision === null ? "unknown" : String(epic.served.contains_epic ?? "unknown"),
    );

    // A band only when the document measured a mismatch, and never otherwise.
    await expect(page.locator("[data-mismatch]")).toHaveCount(
      epic.served.contains_epic === false ? 1 : 0,
    );
  });
});

// --- FR-011: the room holds the laws it measures ---------------------------

test.describe("the review room holds the four layout laws (FR-011)", () => {
  test("all four hold over the whole room at every width, in both themes", async ({ page }) => {
    const epic = await reviewable(page);

    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`/review/${epic.specDir}`);

        // The subject has to be on the screen before anything is measured, or
        // the sweep would be passing over a page that does not carry it.
        await page.waitForSelector('[data-track="what-changed"] .rv-story');
        await page.waitForSelector('[data-track="the-thing-itself"] iframe[data-render]');
        await measured(page, { route: epic.framed[0], width: 1280, theme: "light" });
        // And the readout has to be full, over a frame that really filled: an
        // unmeasured room is a room with four fewer rows on it, and a room whose
        // figures are of a loading screen carries less text than the one the
        // operator actually reads. FR-011 is about the fuller page.
        await filled(page);
        await page.locator("[data-remeasure]").click();
        await page.waitForSelector('[data-laws="measured"] [data-law="d"]');

        const where = `${width} in ${scheme}`;
        const report = await measureLaws(page);

        expect(report.swept, `${where}: the room rendered text`).toBeGreaterThan(40);
        expect(report.leaves, `${where}: the room has text leaves`).toBeGreaterThan(20);
        expect(report.painters, `${where}: the room paints backgrounds`).toBeGreaterThan(5);

        // (a) every stage descendant inside its stage's box.
        expect(report.escaped, `${where}: a stage child escaped its stage`).toEqual([]);
        // (b) no text past the viewport's right edge outside a scroller — the
        // law the frame would break first, since the operator may choose a
        // width wider than the room they are standing in.
        expect(report.past, `${where}: text past the viewport`).toEqual([]);
        // (c) no two text leaves overlap.
        expect(report.overlapping, `${where}: two text leaves overlap`).toEqual([]);
        // (d) no opaque box paints over text it does not own.
        expect(report.occluded, `${where}: a box paints over text it does not own`).toEqual([]);

        // § Stage sanctions one horizontal scroll and it is the stage's. This
        // room has none: a 2560px frame inside a 1280px room is held by a
        // scroller around the frame, never by a page that scrolls sideways.
        expect(report.roomScrollsSideways, `${where}: the room scrolls sideways`).toBe(false);
        expect(
          report.documentScrollWidth,
          `${where}: the document is no wider than the frame`,
        ).toBeLessThanOrEqual(report.viewport + 1);
      }
    }
  });

  test("holds them with the widest frame the room offers, in both themes", async ({ page }) => {
    // The condition the laws are most likely to break in: the operator picks a
    // frame wider than the room they are standing in. The frame's holder is
    // what must absorb that, and this is what proves it does.
    const epic = await reviewable(page);

    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: 1280, height: 1000 });
      await page.goto(`/review/${epic.specDir}`);
      await measured(page, { route: epic.framed[0], width: 1280, theme: "light" });
      await filled(page);

      await page.locator('[data-pick="width"] [data-option="2560"]').click();
      await page.locator('[data-pick="theme"] [data-option="dark"]').click();
      await measured(page, { route: epic.framed[0], width: 2560, theme: "dark" });

      const where = `a 2560px frame in a 1280px room, ${scheme}`;
      const report = await measureLaws(page);

      expect(report.past, `${where}: text past the viewport`).toEqual([]);
      expect(report.overlapping, `${where}: two text leaves overlap`).toEqual([]);
      expect(report.occluded, `${where}: a box paints over text it does not own`).toEqual([]);
      expect(report.escaped, `${where}: a stage child escaped its stage`).toEqual([]);
      expect(report.roomScrollsSideways, `${where}: the room scrolls sideways`).toBe(false);
      expect(
        report.documentScrollWidth,
        `${where}: the document is no wider than the room`,
      ).toBeLessThanOrEqual(report.viewport + 1);
    }
  });

  test("would catch a collision in this room if one were planted", async ({ page }) => {
    // A green law is worth its green only if it goes red on the thing it
    // forbids — the discipline `desk.spec.ts` and `showfloor.spec.ts` both keep.
    // The plant is over the room's own text, not the frame's.
    const epic = await reviewable(page);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(`/review/${epic.specDir}`);
    await page.waitForSelector('[data-track="what-changed"] .rv-story');

    expect((await measureLaws(page)).overlapping).toEqual([]);

    await page.evaluate(() => {
      const target = document.querySelector(".rv-laws-head") as HTMLElement;
      const bounds = target.getBoundingClientRect();
      const planted = document.createElement("span");
      planted.className = "planted";
      planted.textContent = "planted";
      planted.style.position = "fixed";
      planted.style.left = `${bounds.left}px`;
      planted.style.top = `${bounds.top}px`;
      planted.style.width = `${Math.max(bounds.width, 40)}px`;
      planted.style.height = `${Math.max(bounds.height, 20)}px`;
      document.body.appendChild(planted);
    });

    const planted = await measureLaws(page);
    expect(planted.overlapping.length, "the law catches a planted collision").toBeGreaterThan(0);
    expect(planted.overlapping.join(" ")).toContain("planted");

    await page.evaluate(() => {
      for (const element of Array.from(document.querySelectorAll(".planted"))) element.remove();
    });
    expect((await measureLaws(page)).overlapping).toEqual([]);
  });
});
