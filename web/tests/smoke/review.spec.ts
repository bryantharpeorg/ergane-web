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

/* ─────────────────────────────────────────────────────────────────────────
   011 US3. A note carries its coordinates, and the room writes nothing.
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Why the notes track needs a browser at all.
 *
 * The unit suite constructs a `LawReport` and asserts what the room does with
 * it. Only here can the assertion be the one that matters: that the numbers a
 * note freezes are the numbers *the frame actually measured* — same figures,
 * same laws, same findings — rather than a plausible set the room composed.
 * `235px of graph hidden at 1280` is worth recording because it came off a
 * layout, and a layout is what `jsdom` does not have.
 *
 * And FR-011 is the other reason. The composed draft is the largest thing this
 * room renders: ninety lines of preformatted text with lines far wider than the
 * column holding them. A sweep that only ever saw an empty notes track would be
 * reporting zero violations over the room the operator does not use. So the
 * laws are swept again with a note taken and the document on screen, at every
 * width and in both themes — the room holding the laws it measures, in the
 * state it spends its time in.
 */

/**
 * The frame, loaded and laid out — not merely addressed.
 *
 * Picking a route navigates the frame, and there is a window in that navigation
 * where `contentDocument` answers a document with no root element in it. The
 * room handles that case by not measuring (`rendered()` in `TheThingItself`);
 * this suite has to wait it out, because `measureLawsIn` is entitled to assume a
 * document it is handed has been laid out.
 *
 * Waiting on the *room's* leaf count is not enough and was the first attempt:
 * the figures on screen are still the previous route's until the new
 * measurement lands, so a poll for "more than ten leaves" passes on the stale
 * number and hands the next line a document mid-flight. What is asked here is
 * asked of the frame's own document — its address, its ready state, and that it
 * has a tree in it.
 */
async function frameSettled(page: Page, pathname: string): Promise<void> {
  await expect
    .poll(
      async () =>
        page.locator("[data-render-frame]").evaluate((element, expected) => {
          const doc = (element as HTMLIFrameElement).contentDocument;
          if (doc === null || doc.documentElement === null) return false;
          return (
            doc.location.pathname === expected &&
            doc.readyState === "complete" &&
            doc.querySelectorAll("*").length > 20
          );
        }, pathname),
      { message: "the frame never finished loading the route it was pointed at" },
    )
    .toBe(true);
}

/** Type an observation and record it, in the one text box this room has. */
async function record(page: Page, words: string): Promise<void> {
  await page.locator("[data-note-field]").fill(words);
  await page.locator("[data-record]").click();
  await page.waitForSelector("[data-note]");
}

/** What one recorded note says about where it was taken. */
async function coordinates(page: Page, index = 0) {
  const note = page.locator("[data-note]").nth(index);
  return {
    story: await note.getAttribute("data-note-story"),
    route: (await note.locator("[data-note-route]").textContent())?.trim() ?? "",
    width: (await note.locator("[data-note-width]").textContent())?.trim() ?? "",
    theme: (await note.locator("[data-note-theme]").textContent())?.trim() ?? "",
    measured: (await note.locator("[data-note-measured]").textContent())?.trim() ?? "",
    laws: (await note.locator("[data-note-laws]").textContent())?.trim() ?? "",
  };
}

// --- FR-012: the note's numbers are the frame's own -----------------------

test("a note freezes the coordinates and the measured numbers on the screen", async ({
  page,
  request,
}) => {
  const { rooms } = await openRoom(page, request);
  await page.locator("[data-width-pick='1280']").click();
  await page.locator("[data-theme-pick='dark']").click();

  // The room and the suite agree about the frame before anything is recorded,
  // so what the note carries can be checked against a real measurement rather
  // than against the room's own claim about one.
  const inside = await agreed(page);
  await record(page, "the graph is cut off on the right");

  const note = await coordinates(page);
  expect(note.route).toBe(rooms[0]);
  expect(note.width).toBe("1280px");
  expect(note.theme).toBe("dark");
  expect(note.story).toMatch(/^US\d+$/);

  // The figures, all of them, and they are the frame's — not a second
  // measurement taken a moment later by the track that records them.
  expect(note.measured).toContain(`frame ${inside.viewport}px`);
  expect(note.measured).toContain(`document ${inside.documentScrollWidth}px`);
  expect(note.measured).toContain(`${inside.leaves} text leaves`);
  expect(note.measured).toContain(`${inside.painters} painters`);
  expect(note.measured).toContain(
    `${Math.max(0, Math.round(inside.documentScrollWidth - inside.viewport))}px hidden past the edge`,
  );
  // And every law by name, with its count — including the ones that found none.
  expect(note.laws).toBe(
    [
      `outside its stage ${inside.escaped.length}`,
      `past the right edge ${inside.past.length}`,
      `overlapping text ${inside.overlapping.length}`,
      `painted over text ${inside.occluded.length}`,
    ].join(" · "),
  );
});

test("a note keeps its coordinates when the operator moves the controls", async ({
  page,
  request,
}) => {
  await openRoom(page, request);
  await page.locator("[data-width-pick='1280']").click();
  await page.locator("[data-theme-pick='light']").click();
  await agreed(page);
  await record(page, "cut off at 1280");

  const taken = await coordinates(page);

  // Everything the room has, moved — and the frame really re-measured, so this
  // is not a note surviving a change that never happened.
  await page.locator("[data-width-pick='2560']").click();
  await page.locator("[data-theme-pick='dark']").click();
  await expect(page.locator("[data-measured]")).toHaveAttribute("data-width", "2560");
  await expect
    .poll(async () => page.locator("[data-render-frame]").evaluate((e) => e.clientWidth))
    .toBe(2560);
  const moved = await agreed(page);
  expect(moved.viewport).toBeGreaterThan(1280);

  expect(await coordinates(page)).toEqual(taken);
  // The live line follows the view; the record does not. That difference is the
  // whole of plan D6.
  expect(await page.locator("[data-capture-where]").textContent()).toContain("2560px");
});

// --- FR-013: the draft has the shape 007 and 010 have ---------------------

test("the composed draft is a captured-TBD spec, and the room offers no save", async ({
  page,
  request,
}) => {
  const { specDir } = await openRoom(page, request);
  await agreed(page);
  await record(page, "the graph is cut off on the right");

  await expect(page.locator("[data-draft]")).toHaveCount(0);
  await page.locator("[data-compose]").click();
  const draft = (await page.locator("[data-draft]").textContent()) ?? "";

  expect(draft.startsWith("---\nstate: draft\n")).toBe(true);
  expect(draft).toContain("TBD — CAPTURED, NOT REFINED");
  expect(draft).toContain(`depends_on_landed: [${specDir}]`);
  expect(draft).toContain("## Operator intent (as captured)");
  expect(draft).toContain("> the graph is cut off on the right");
  expect(draft).toContain("## Sketch");
  expect(draft).toContain("## Open questions");
  expect(draft).toContain("## Out of scope (already known)");
  expect(draft).toContain("## Work Graph");
  expect(draft).toContain("Deliberately absent");
  // No fenced block anywhere: a compiled graph is what makes a spec
  // dispatchable, and this room must never emit one.
  expect(draft).not.toContain("```");

  // FR-014, as the operator meets it: the control says save this yourself, in
  // those terms, and there is nothing on the page that could save it.
  expect(await page.locator("[data-save-hint]").textContent()).toContain(
    "This room saved nothing",
  );
  await expect(page.locator("a[download], [download]")).toHaveCount(0);
  await expect(page.locator("form, input, select")).toHaveCount(0);
  await expect(page.locator("textarea")).toHaveCount(1);
});

/**
 * The runtime half of "the room writes nothing" (FR-014, SC-003).
 *
 * `tests/unit/noVerb.test.ts` shows there is no write path in the source and
 * `tests/test_review_writes_nothing.py` shows the backend writes nothing while
 * the room runs. This is the third: a whole session of the room being *used* —
 * routes picked, widths and themes changed, notes taken, the draft composed —
 * issuing not one request that is not a GET. The Showfloor's own sweep is the
 * precedent and the shape is deliberately the same.
 */
test("a whole session of note-taking issues no request that is not a GET", async ({
  page,
  request,
}) => {
  const nonGet: string[] = [];
  page.on("request", (issued) => {
    if (issued.method() !== "GET") nonGet.push(`${issued.method()} ${issued.url()}`);
  });

  const { rooms } = await openRoom(page, request);
  await agreed(page);
  await record(page, "the first thing");
  await page.locator("[data-width-pick='1600']").click();
  await page.locator("[data-theme-pick='dark']").click();
  if (rooms.length > 1) {
    await page.locator(`[data-route-pick='${rooms[1]}']`).click();
    await frameSettled(page, rooms[1]);
  }
  await agreed(page);
  await record(page, "the second thing");
  await page.locator("[data-compose]").click();
  await expect(page.locator("[data-draft]")).toHaveCount(1);

  // Non-vacuous: the session really happened, so a clean log is a fact about
  // the room and not about a page nobody touched.
  await expect(page.locator("[data-note]")).toHaveCount(2);
  expect(nonGet, "the review room issued a request that was not a GET").toEqual([]);
});

// --- FR-011: the laws hold over the room in the state it is used in -------

test.describe("§ Layout's four laws over the room with its draft open (FR-011)", () => {
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      test(`reports zero violations at ${width} in ${theme}`, async ({ page, request }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme });
        await openRoom(page, request);
        await agreed(page);

        // A note with a long line in it and the composed document on screen:
        // ninety lines of preformatted text whose longest run is far wider than
        // the column holding it, which is the case that would take the room
        // sideways if the well's own scroller were not doing its job.
        await record(
          page,
          "the rank label wraps onto two lines and the second is clipped by the card's own box, which is the defect the 2026-08-25 review recorded as F1",
        );
        await page.locator("[data-compose]").click();
        await expect(page.locator("[data-draft]")).toHaveCount(1);

        const report = await measureLaws(page);

        expect(report.leaves, "the sweep found no text at all").toBeGreaterThan(10);
        expect(report.painters, "the sweep found nothing painted").toBeGreaterThan(0);
        await expect(page.locator("[data-track='the-notes']")).toBeVisible();
        await expect(page.locator("[data-draft]")).toBeVisible();

        expect(report.escaped, "text outside a scrolling ancestor").toEqual([]);
        expect(report.past, "an element past its container").toEqual([]);
        expect(report.overlapping, "two text leaves overlapping").toEqual([]);
        expect(report.occluded, "an opaque box painted over text").toEqual([]);

        expect(report.roomScrollsSideways, "the room scrolls sideways").toBe(false);
        expect(
          report.documentScrollWidth,
          "the document is wider than the viewport",
        ).toBeLessThanOrEqual(report.viewport + 1);
      });
    }
  }
});
