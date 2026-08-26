/**
 * The Desk's own smoke: 001's floor, 003's verb, 004's spend strip — and, from
 * 006 US2, the no-overlap law that governs the whole page (FR-006).
 *
 * **Two changes to landed assertions in this file, both named here rather than
 * made quietly** (006 FR-003's discipline, applied to the story that forced
 * them):
 *
 * 1. The paged story's cell is read as `[data-story][data-paged]` instead of
 *    `.chev[data-paged]`. `NodeChevron` is deleted in this story's diff — the
 *    first world's chevron glyph is one of the three pictures FR-004 removes
 *    from the DOM — so the *selector* moved onto the element that replaced it.
 *    The subject did not move an inch: the paged story is still asserted to be
 *    the undeclared one, still `VERIFYING`, still marked paged, and still on
 *    the `paged-while-verifying` epic's row.
 * 2. Nothing else. Every other assertion in this file is 001's, 003's and
 *    004's, unedited.
 *
 * The law added at the foot is new work, not a moved assertion: it is the
 * committed answer to the collision class the 2026-08-24 review measured on
 * every epic row (`"COMPLETED · epic-002" × "dispatch"`), and it runs over the
 * whole Desk rather than over the row that happened to show it.
 *
 * 009 US2 touches that foot and nothing above it: the law's *measurement* now
 * comes from `support/laws.ts` instead of a transcription of
 * `showfloor.spec.ts`'s, and D-018's fourth law rides in with it. Both changes
 * are named where they are made, in the block comment above that section.
 */
import { expect, test } from "@playwright/test";

import { measureLaws } from "./support/laws";

function timeLeftText(expiresAt: string, reference: string): string {
  const diffMs = new Date(expiresAt).getTime() - new Date(reference).getTime();
  if (diffMs <= 0) return "expired";
  const totalSeconds = Math.floor(diffMs / 1000);
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `−${hh}:${mm}:${ss}`;
}

test("the Desk renders the fixture floor and issues one verb and no other", async ({
  page,
  request,
}) => {
  const requests: { method: string; url: string }[] = [];
  page.on("request", (req) => requests.push({ method: req.method(), url: req.url() }));

  await page.goto("/desk");
  await page.waitForSelector("section.attention article.item");

  const floorResponse = await request.get("/api/floor");
  const floorDoc = (await floorResponse.json()) as {
    reference_instant: string | null;
    attention: {
      items: {
        kind: string;
        expires_at: string | null;
        actions: { label: string; payload: string }[];
      }[];
    };
    spend_to_date: { data: { groups: { key: string }[] } | null };
  };
  const referenceInstant = floorDoc.reference_instant ?? new Date().toISOString();

  const body = await page.evaluate(() => document.body.innerHTML);
  const lastItemIndex = body.lastIndexOf('article class="item');
  const firstFloorIndex = body.indexOf('section class="floor"');
  expect(lastItemIndex).toBeGreaterThan(-1);
  expect(firstFloorIndex).toBeGreaterThan(-1);
  expect(lastItemIndex).toBeLessThan(firstFloorIndex);

  const items = page.locator("section.attention article.item");
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const kind = await item.getAttribute("data-kind");
    // Spec 003 US1 seeds the demo floor from all three recorded deliveries, so
    // the Notice the same notify adapter carries renders here too.
    expect(kind).toMatch(/escalation|question|notice/);
    if (kind !== "notice") {
      // Spec 003 US3 (T042/T050): every answerable item counts down to the
      // `expires_at` the factory wrote — the Escalation's through
      // `open_escalations`, the Question's through the questions store — and to
      // nothing the pane computed. An item the factory has supplied no deadline
      // for says exactly that, and says it in the answerable item's words rather
      // than in the Notice slot's (FR-012).
      const expiresAt = await item.getAttribute("data-expires-at");
      if (expiresAt === null) {
        await expect(item.locator(".no-deadline")).toHaveText(
          "no deadline from the factory",
        );
      } else {
        await expect(item.locator(".clock")).toHaveText(
          timeLeftText(expiresAt, referenceInstant),
        );
        await expect(item.locator(".no-deadline")).toHaveCount(0);
      }
    }
  }

  // **Declared in-scope amendment of a landed 001 assertion** (spec 003 T050).
  // 001 asserted that the seeded demo Question shows no `.clock` and reads "no
  // deadline", which was true only while the recorded Question payload carried
  // no expiry. US3's questions-store join supplies one — the value the factory
  // wrote at send time — so the Question now carries a live clock, computed
  // here against the demo reference instant exactly as the Escalation's is.
  const question = page.locator('article.item[data-kind="question"]');
  await expect(question).toBeVisible();
  const questionExpiry = await question.getAttribute("data-expires-at");
  expect(questionExpiry).not.toBeNull();
  await expect(question.locator(".clock")).toHaveText(
    timeLeftText(questionExpiry as string, referenceInstant),
  );
  await expect(question.locator(".no-deadline")).toHaveCount(0);

  // A Notice reads, and asks for nothing: no clock, and no control at all
  // (DESIGN.md § Components › Attention Item).
  const notice = page.locator('article.item[data-kind="notice"]');
  await expect(notice).toBeVisible();
  await expect(notice.locator(".kind")).toHaveText("Notice");
  await expect(notice.locator(".no-clock")).toHaveText("no clock");
  await expect(notice.locator(".asks-nothing")).toHaveText(
    "Asks for nothing; no answer exists.",
  );
  for (const control of ["button", "input", "textarea", "select", "form"]) {
    expect(await notice.locator(control).count()).toBe(0);
  }

  const spend = page.locator("section.spend");
  await expect(spend.locator("h2")).toHaveText(/spend to date/i);
  await expect(spend.locator(".unknown").first()).toHaveText("unknown");
  await expect(spend).not.toContainText(/live/i);

  // Spec 004 US4 (T035, FR-012): the strip's shape checked against the *served*
  // document rather than only against a unit fixture — one row per persona the
  // rollup carries, plus the total, and never the persona-and-metric cross
  // product the first build rendered (32 rows for this same floor). The columns
  // are the closed set `DESIGN.md` names, in its order (US4-S1, US4-S2).
  const servedPersonas = floorDoc.spend_to_date.data?.groups ?? [];
  expect(servedPersonas.length).toBeGreaterThan(0);
  await expect(spend.locator("tbody tr")).toHaveCount(servedPersonas.length + 1);
  for (const [i, group] of servedPersonas.entries()) {
    await expect(spend.locator("tbody tr").nth(i).locator("th")).toHaveText(group.key);
  }
  await expect(spend.locator("tbody tr").last()).toHaveClass(/total/);
  await expect(spend.locator("thead th")).toHaveText([
    "persona",
    "prompt tokens",
    "completion tokens",
    "requests",
    "spend",
  ]);

  const pagedRow = page.locator('article.epic[data-scene="paged-while-verifying"]');
  await expect(pagedRow).toBeVisible();
  // The selector moved with the markup and the subject did not (see the header):
  // the paged story is still the undeclared one, still VERIFYING, still marked.
  const pagedStory = pagedRow.locator("[data-story][data-paged]");
  await expect(pagedStory).toBeVisible();
  await expect(pagedStory).toHaveAttribute("data-undeclared", "true");
  await expect(pagedStory).toHaveAttribute("data-state", "VERIFYING");

  // Spec 003 US2 gives the Desk its one verb, so 001's zero-write sweep becomes
  // the one-write sweep the pane keeps forever (plan D-P13): the full run may
  // issue non-GET requests to the answer route and to nothing else. This is the
  // control against the defect D-001 forbids — a convenience write added
  // anywhere on the Desk shows up here as a request this filter does not
  // permit, however small and however well meant (US2-S4).
  const writes = requests.filter((r) => r.method !== "GET");
  for (const write of writes) {
    expect(write.method).toBe("POST");
    expect(new URL(write.url).pathname).toMatch(/^\/api\/attention\/[^/]+\/answer$/);
  }

  // And the delivered Escalation offers exactly the choices the factory sent —
  // one control per delivered choice, its face and its payload verbatim
  // (US2-S2, FR-007).
  const escalation = page.locator('article.item[data-kind="escalation"]').first();
  const delivered = (
    floorDoc.attention.items.find((item) => item.kind === "escalation") as {
      actions: { label: string; payload: string }[];
    }
  ).actions;
  const choices = escalation.locator(".answer-col button");
  await expect(choices).toHaveCount(delivered.length);
  for (let i = 0; i < delivered.length; i++) {
    await expect(choices.nth(i).locator(".face")).toHaveText(delivered[i].label);
    await expect(choices.nth(i).locator(".payload")).toHaveText(delivered[i].payload);
  }

  // A Question offers the reply field and one Answer button, and nothing else.
  await expect(question.locator("textarea.reply")).toBeVisible();
  await expect(question.locator(".answer-col button")).toHaveCount(1);
});

/* ── The layout laws over the Desk (006 US2, FR-006; 009 US2, FR-005) ───────
 *
 * DESIGN.md § Layout: "No two text leaves may overlap. **And no element with
 * an opaque background may paint over a text leaf that is not its own.**
 * These are committed test assertions, not aspirations." 005 landed the first
 * of those over the Showfloor (`showfloor.spec.ts`, law (c)); this is the same
 * law, over the Desk, where the 2026-08-24 review actually measured the
 * collisions — the milestone bar's absolutely-positioned track labels crossing
 * the row's own text on every epic ("COMPLETED · epic-002" × "dispatch",
 * "implementer" × "us1 · paged").
 *
 * 006 US2 makes those collisions impossible by construction: the row is a grid
 * of flowed cells and nothing on it is absolutely positioned (plan D2). The
 * law is here anyway, and it is what stops the class coming back — a layout
 * can be rewritten again, a law has to be deleted on purpose.
 *
 * **Two changes here, both 009 US2's and both named rather than made quietly:**
 *
 * 1. The measurement is no longer a copy. It was `showfloor.spec.ts`'s,
 *    transcribed; it is now `support/laws.ts`'s, imported. Law (c) is
 *    unchanged in substance — the *text's* boxes through a `Range` (an inline
 *    element that wraps reports fragment rects carrying the whole inline box's
 *    height, which reads as a collision that is not on the screen), each box
 *    clipped by every ancestor that clips it (text a scroller hides has not
 *    collided with what is drawn over it), and a 4px slack in both axes, which
 *    is the number FR-006 states. Only its home moved.
 * 2. Law (d) comes with it, and is asserted over this room at both widths and
 *    in both themes (009 FR-005). D-018 wrote it because a degraded note
 *    rendered unreadable while law (c) and its two siblings passed: they
 *    measure glyphs, and an opaque box painted on top of a word moves no
 *    glyph. The Desk is a route this suite already sweeps, so the law holds
 *    here or it does not hold.
 *
 * **012 US2 widens this test and weakens nothing in it** (FR-008, and the
 * naming discipline 006 FR-003 set). The row grew a line — each story now says
 * the dependency its graph declares — and that line is text added to the most
 * crowded cell on the page, which is precisely what these laws exist to watch.
 * So the sweep grows with it, in two ways and both of them additive:
 *
 * 1. **All four laws, not two.** The paragraph this replaces excused (a) and
 *    (b) as "not the Desk's": (a) because the room has no `[data-stage]`, (b)
 *    because it read as the Showfloor's. Neither excuse survives a row that
 *    got wider — (b) is exactly the law that catches a story cell pushed past
 *    the viewport's right edge, and (a) costs nothing to assert in a room with
 *    no stage and is what FR-008's "the four layout laws" asks for. Both are
 *    asserted here now, alongside the room's own horizontal-scroll check.
 * 2. **Every width the Desk suite sweeps**, which is `desk-world.spec.ts`'s
 *    1280, 1600 and 2560 rather than this file's former two. A row is a
 *    wrapping flex, so the width at which it wraps is the width at which a new
 *    collision would appear, and 2560 is the width the fluid frame was built
 *    for (006 FR-001).
 *
 * The premise is measured, not assumed: the dependency line has to be on the
 * screen at each width and in each theme, or the sweep would be passing over a
 * page that does not carry the subject.
 */

test.describe("the layout laws over the Desk (FR-006, 009 FR-005, 012 FR-008)", () => {
  test("all four hold over the whole Desk at every width, in both themes", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const width of [1280, 1600, 2560]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/desk");
        // The whole page, not the part that loads first: the floor's rows and
        // the attention strip's cards are where the review measured the class.
        await page.waitForSelector("section.floor article.epic");
        await page.waitForSelector("section.attention article.item");
        await page.waitForSelector("section.spend table");

        const where = `${width} in ${scheme}`;

        // 012 US2's subject, on the screen before anything is measured: the
        // Fixture floor's polled epic declares a merge edge and its second
        // story draws it, so this is the row's new text and not a selector
        // that would match an empty page.
        const declared = page.locator('[data-story][data-depends="declared"] [data-dep]');
        expect(await declared.count(), `${where}: the row draws a declared edge`)
          .toBeGreaterThan(0);
        expect(await page.locator('[data-story][data-depends="undeclared"]').count(),
          `${where}: and an edgeless story reads UNDECLARED`).toBeGreaterThan(0);

        const report = await measureLaws(page);

        // A sweep over nothing passes for the wrong reason — and law (d) over
        // a page that paints nothing is that same empty pass, so the painters
        // it considered carry a floor too (009 FR-005).
        expect(report.swept, `${where}: the Desk rendered text`).toBeGreaterThan(40);
        expect(report.leaves, `${where}: the Desk has text leaves`).toBeGreaterThan(20);
        expect(report.painters, `${where}: the Desk paints backgrounds`).toBeGreaterThan(5);
        // (a) every stage descendant inside its stage's box — vacuous in a room
        // with no stage, and asserted so that it stops being vacuous the day
        // one arrives.
        expect(report.escaped, `${where}: a stage child escaped its stage`).toEqual([]);
        // (b) no text past the viewport's right edge outside a scroller — the
        // law a wider story cell would break first.
        expect(report.past, `${where}: text past the viewport`).toEqual([]);
        // (c) no two text leaves overlap.
        expect(report.overlapping, `${where}: two text leaves overlap`).toEqual([]);
        // (d) no opaque box paints over text it does not own.
        expect(report.occluded, `${where}: a box paints over text it does not own`).toEqual([]);
        // § Stage sanctions one horizontal scroll and it is the stage's; this
        // room has none, so the Desk may not scroll sideways at any width.
        expect(report.roomScrollsSideways, `${where}: the Desk scrolls sideways`).toBe(false);
        expect(report.documentScrollWidth, `${where}: the document is no wider than the frame`)
          .toBeLessThanOrEqual(report.viewport + 1);
      }
    }
  });

  test("would catch the measured collision class if it were planted again", async ({ page }) => {
    // A green law is worth its green only if it goes red on the thing it
    // forbids. This plants the shape the milestone bar had — a label placed
    // absolutely over the row's own text, which is exactly how
    // `"COMPLETED · epic-002" × "dispatch"` was measured — and then removes it.
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/desk");
    await page.waitForSelector("section.floor article.epic");

    expect((await measureLaws(page)).overlapping).toEqual([]);

    await page.evaluate(() => {
      const row = document.querySelector("section.floor article.epic") as HTMLElement;
      const target = row.querySelector("[data-epic-id-text], .epic-name") as HTMLElement;
      const bounds = target.getBoundingClientRect();
      const planted = document.createElement("span");
      planted.className = "planted";
      planted.textContent = "dispatch";
      planted.style.position = "fixed";
      planted.style.left = `${bounds.left}px`;
      planted.style.top = `${bounds.top}px`;
      planted.style.width = `${Math.max(bounds.width, 40)}px`;
      planted.style.height = `${Math.max(bounds.height, 20)}px`;
      document.body.appendChild(planted);
    });

    const planted = await measureLaws(page);
    expect(planted.overlapping.length, "the law catches a planted collision").toBeGreaterThan(0);
    expect(planted.overlapping.join(" ")).toContain("dispatch");

    await page.evaluate(() => {
      for (const element of Array.from(document.querySelectorAll(".planted"))) element.remove();
    });
    expect((await measureLaws(page)).overlapping).toEqual([]);
  });
});

/**
 * The stale fold, in a real browser, over the floor `PANE_DEMO=1` really serves
 * (006 US3-S3, FR-008).
 *
 * A note on SC-003, which reads "live attention above **one collapsed stale
 * fold**": the recorded Fixture floor has no expired item to put in one. Its
 * `reference_instant` is the `captured_at` of
 * `fixtures/escalations/open_escalations.envelope.json` — `2026-08-22T17:41:12Z`
 * — and every expiry the recording carries (`17:41:18Z`, `17:56:11Z`,
 * `18:01:12Z`, `2026-08-23T01:41:13Z`) is *after* it. Manufacturing a fold here
 * would mean writing a factory time nobody recorded, which constitution V
 * forbids and FR-009 forbids twice over. So what this gate proves headlessly is
 * the half of FR-008 the real corpus can prove — **an empty fold is an element
 * that can never fill, and none renders** — and the fold's own contents are
 * proven in `tests/unit/AttentionStrip.test.tsx`, over the same recorded
 * deliveries read at a later instant.
 */
test.describe("the stale fold renders only when it has contents (FR-008, US3-S3)", () => {
  test("shows no fold on the Fixture floor, whose every clock is still live", async ({
    page,
    request,
  }) => {
    await page.goto("/desk");
    await page.waitForSelector("section.attention article.item");

    const floorDoc = (await (await request.get("/api/floor")).json()) as {
      reference_instant: string | null;
      attention: { items: { id: string; expires_at: string | null }[] };
    };
    const reference = new Date(floorDoc.reference_instant as string).getTime();

    // The premise, measured rather than assumed: this floor has items, and not
    // one of them is past its deadline at the instant the document was read.
    expect(floorDoc.attention.items.length).toBeGreaterThan(0);
    for (const item of floorDoc.attention.items) {
      if (item.expires_at === null) continue;
      expect(
        new Date(item.expires_at).getTime(),
        `${item.id} is still live at the document's reference instant`,
      ).toBeGreaterThan(reference);
    }

    // Therefore: no fold, no folded line, and every item in a full card.
    expect(await page.locator("details.stale").count()).toBe(0);
    expect(await page.locator("[data-stale]").count()).toBe(0);
    expect(await page.locator("section.attention .items article.item").count()).toBe(
      floorDoc.attention.items.length,
    );
  });

  test("would fold, and collapse to one line, if an item's clock had passed", async ({
    page,
    request,
  }) => {
    // The same discipline the no-overlap law above keeps: an assertion that
    // something is absent is worth its green only if the thing can be made to
    // appear. The partition is a pure function of the document, so this serves
    // the room the **same recorded document** with its reference instant moved
    // a day on — the one input that decides live from stale. Every `expires_at`
    // on the page is still the one the recording carries; nothing the factory
    // wrote is edited, which is the only way this could be staged at all
    // (constitution V, FR-009).
    const recorded = (await (await request.get("/api/floor")).json()) as {
      reference_instant: string;
      attention: { items: { expires_at: string | null }[] };
    };
    const withClocks = recorded.attention.items.filter((item) => item.expires_at !== null).length;
    const withoutClocks = recorded.attention.items.length - withClocks;
    // A day is past every deadline the recording carries, and there is at least
    // one item that has none and therefore cannot fold.
    expect(withClocks).toBeGreaterThan(0);
    expect(withoutClocks).toBeGreaterThan(0);

    const later = new Date(
      new Date(recorded.reference_instant).getTime() + 24 * 60 * 60 * 1000,
    ).toISOString();
    const shifted = JSON.stringify({ ...recorded, reference_instant: later });

    await page.route("**/api/floor", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: shifted }),
    );
    // The room's own document arrives on the SSE channel too; it carries the
    // same later reading, so a reconnect cannot quietly undo the split.
    await page.route("**/api/events", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `event: floor\ndata: ${JSON.stringify({ type: "floor", data: JSON.parse(shifted) })}\n\n`,
      }),
    );

    await page.goto("/desk");
    await page.waitForSelector("section.attention");

    // One fold, collapsed, naming the count.
    const fold = page.locator("details.stale");
    await expect(fold).toHaveCount(1);
    expect(await fold.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
    await expect(fold.locator("> summary.stale-summary .stale-count")).toHaveText(
      String(withClocks),
    );

    // One line each, and the item's own `expires_at` still on it.
    const folded = fold.locator("[data-stale]");
    await expect(folded).toHaveCount(withClocks);
    for (const item of recorded.attention.items) {
      if (item.expires_at === null) continue;
      await expect(fold.locator(`[data-expires-at="${item.expires_at}"]`)).toHaveCount(1);
    }

    // The clockless item never folds: it keeps its full card, above.
    await expect(page.locator("section.attention .items article.item")).toHaveCount(withoutClocks);

    // And it opens on demand, showing the factory's time and text.
    await fold.locator("> summary.stale-summary").click();
    expect(await fold.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(true);
    const first = folded.first();
    await first.locator("summary.stale-line").click();
    await expect(first.locator(".until")).toBeVisible();
    await expect(first.locator(".stale-text")).toBeVisible();
  });
});
