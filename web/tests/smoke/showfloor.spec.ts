/**
 * The Showfloor, in a real browser (005 US2: FR-006 … FR-009; 005 US3:
 * FR-011, FR-012, FR-014).
 *
 * **This file replaces 002's and 004's Showfloor smoke wholesale.** Every
 * assertion it dropped had its *subject* deleted by D-015 and by 005, and each
 * is named here with what succeeds it (plan D4):
 *
 * | dropped | why | succeeded by |
 * |---|---|---|
 * | "the Showfloor stages the fixture floor read-only" — one `[data-epic-stage]` per running epic, its stations and edges | the room is a master–detail now: one epic on stage, chosen from a rail. There is no per-epic stage to enumerate. | "the rail is the corpus" + "the stage draws the selected epic's graph", below |
 * | "pure glass sweep" — no control, one badge, badge is an anchor | subject survives entirely | "the room has no verb" below, against the rebuilt DOM |
 * | "full-bleed is measured" | subject survives | "the frame is centred at 96rem" below, which measures the root *and* the frame |
 * | "the stage is the size of its graph" (empty vs populated stage heights) | there is one stage, not six, so there is no stack of empty ones to measure | "a stage with no graph has no canvas", below: the canvas is absent from the DOM rather than short |
 * | "the landing line lies within its wrapper's scrollable extent" and "a map wider than its wrapper makes the wrapper scroll" | the landing line and the React Flow map are deleted from the room; DESIGN.md draws neither | "the three layout laws" below — law (a) measures every stage descendant against the stage's own box, which is the general form of both |
 * | "no text is laid out past the viewport outside a scrollable wrapper" | subject survives, and it is the defect class 004 exists to prevent | law (b) below, which is that assertion carried from one width to two and from one theme to both |
 * | US2's own "nothing is laid out into nowhere" | strictly succeeded: same sweep, now run at both widths *and* both `colorScheme` emulations, over every spec on the floor rather than the default selection | law (b) below |
 *
 * 005 US4 adds the last two blocks: the detail pane read in a real browser
 * (FR-015, FR-016) and constitution I re-proven against the finished room
 * (FR-017). The zero-non-GET sweep US2 ran inside one test is now a `beforeEach`
 * and an `afterEach` over **every** test in this file, so it covers the whole
 * smoke run and not one navigation of it — which is what US4-S3 asks for, and
 * what the node card becoming a `<button>` makes worth asking for.
 *
 * 004 is why the last block of this file exists. Its scenarios asserted stage
 * *height* and never asserted containment, so a green gate shipped nine of nine
 * stations laid out beyond their own map, an escaped landing lane 121px past
 * its container, and a Desk whose labels collided. FR-014 turns the three
 * things nobody asserted into the three things that cannot regress: every
 * stage descendant inside its stage's box, no text past the viewport outside a
 * scrolling ancestor, and no two text leaves overlapping — at 1280 and 1600, in
 * both themes, over the whole fixture floor.
 */

import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

interface RailEntry {
  spec_dir: string;
  name: string;
  chip: string | null;
  stories_landed: number;
  stories_total: number;
}

async function railOf(request: { get: (url: string) => Promise<{ json: () => Promise<unknown> }> }) {
  const response = await request.get("/api/showfloor");
  const document = (await response.json()) as { rail: RailEntry[] };
  return document.rail;
}

/**
 * Constitution I, over the whole run (005 US4-S3, FR-017).
 *
 * Every request the browser issues in every test of this file is recorded, and
 * a test that ends having issued anything but a GET fails — whatever it was
 * doing, and whichever route it reached. The room has one control now (the node
 * card's selection button), so "there are no buttons" is no longer the proof
 * that nothing here writes; this is. `tests/unit/noVerb.test.ts` is its other
 * half: no write path exists in `web/src/showfloor/` to begin with.
 */
const nonGetRequests: string[] = [];

test.beforeEach(({ page }) => {
  nonGetRequests.length = 0;
  page.on("request", (request) => {
    if (request.method() !== "GET") {
      nonGetRequests.push(`${request.method()} ${request.url()}`);
    }
  });
});

test.afterEach(() => {
  expect(nonGetRequests, "the Showfloor issued a request that was not a GET").toEqual([]);
});

/** The chip a row must read, composed the way `ladder.ts` composes it. */
function chipText(entry: RailEntry): string {
  const word = entry.chip ?? "unknown";
  return entry.stories_total > 0
    ? `${word} ${entry.stories_landed}/${entry.stories_total}`
    : word;
}

test.describe("the second world is on the screen (FR-006)", () => {
  test("the two themes render two different grounds", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/showfloor");
    await page.waitForSelector("[data-rail-row]");

    const groundOf = () =>
      page.evaluate(() => {
        const style = getComputedStyle(document.body);
        return {
          ground: style.backgroundColor,
          ink: style.color,
          token: getComputedStyle(document.documentElement)
            .getPropertyValue("--ground")
            .trim(),
        };
      });

    const light = await groundOf();

    await page.emulateMedia({ colorScheme: "dark" });
    const dark = await groundOf();

    // Both are real colours, and they are not the same colour.
    for (const measured of [light, dark]) {
      expect(measured.ground).toMatch(/^rgba?\(/);
      expect(measured.ground).not.toBe("rgba(0, 0, 0, 0)");
    }
    expect(dark.ground).not.toBe(light.ground);
    expect(dark.ink).not.toBe(light.ink);

    // And the ground is the token's value in each — `body` is grounded in
    // `var(--ground)`, not in a colour of its own (§ Colors).
    expect(light.token.toUpperCase()).toBe("#EDF0F2");
    expect(dark.token.toUpperCase()).toBe("#0D1418");

    // § Colors: an explicit choice beats the OS in both directions. Under a
    // dark OS, `data-theme="light"` returns the light ground; under a light OS,
    // `data-theme="dark"` takes the dark one.
    const stamped = async (theme: string) => {
      await page.evaluate((value) => {
        document.documentElement.setAttribute("data-theme", value);
      }, theme);
      return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    };

    expect(await stamped("light")).toBe(light.ground);
    await page.emulateMedia({ colorScheme: "light" });
    expect(await stamped("dark")).toBe(dark.ground);
  });

  test("the rail's chips wear DESIGN.md's vocabulary in both themes", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/showfloor");
      await page.waitForSelector("[data-chip]");

      const tones = await page
        .locator("[data-chip]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-chip-tone")));

      expect(tones.length).toBeGreaterThan(0);
      // § Chips is the whole vocabulary; `unknown` is the Unknown Rule, not a
      // seventh colour. A tone outside this set is a defect.
      for (const tone of tones) {
        expect(["landed", "building", "ready", "draft", "wait", "dead", "unknown"]).toContain(tone);
      }

      // Every chip carries its word — state is never colour alone.
      const words = await page
        .locator("[data-chip]")
        .evaluateAll((nodes) => nodes.map((node) => (node.textContent ?? "").trim()));
      for (const word of words) expect(word.length).toBeGreaterThan(0);
    }
  });

  test("the draft chip is dashed and every other chip is not", async ({ page }) => {
    await page.goto("/showfloor");
    await page.waitForSelector("[data-chip]");

    const chips = await page.locator("[data-chip]").evaluateAll((nodes) =>
      nodes.map((node) => {
        const style = getComputedStyle(node);
        return {
          tone: node.getAttribute("data-chip-tone"),
          borderStyle: style.borderTopStyle,
          colour: style.color,
          wash: style.backgroundColor,
          borderColour: style.borderTopColor,
          radius: style.borderTopLeftRadius,
        };
      }),
    );

    // This floor really carries both kinds; an assertion over one would prove
    // half of the pair.
    const drafts = chips.filter((chip) => chip.tone === "draft");
    const others = chips.filter((chip) => chip.tone !== "draft");
    expect(drafts.length).toBeGreaterThan(0);
    expect(others.length).toBeGreaterThan(0);

    // § Chips: `draft` is "faint, transparent, **dashed border**".
    for (const chip of drafts) {
      expect(chip.borderStyle).toBe("dashed");
      expect(chip.wash).toBe("rgba(0, 0, 0, 0)");
    }
    for (const chip of others) {
      expect(chip.borderStyle).toBe("solid");
    }

    // "chips are `border: 1px solid currentColor` over the wash", squared, and
    // each tone's ink differs from the next one's.
    for (const chip of chips) {
      expect(chip.borderColour).toBe(chip.colour);
      expect(chip.radius).toBe("0px");
    }
    const inks = new Set(chips.map((chip) => `${chip.tone}:${chip.colour}`));
    const tones = new Set(chips.map((chip) => chip.tone));
    expect(inks.size).toBe(tones.size);
  });

  test("the selected rail row wears the wash and the 3px accent bar", async ({ page }) => {
    await page.goto("/showfloor");
    await page.waitForSelector("[data-rail-row][data-selected='true']");

    const measured = await page.locator("[data-rail-row]").evaluateAll((nodes) =>
      nodes.map((node) => {
        const style = getComputedStyle(node);
        return {
          selected: node.getAttribute("data-selected"),
          wash: style.backgroundColor,
          bar: style.borderLeftWidth,
          barColour: style.borderLeftColor,
        };
      }),
    );

    const selected = measured.filter((row) => row.selected === "true");
    const rest = measured.filter((row) => row.selected !== "true");
    expect(selected.length).toBe(1);
    expect(rest.length).toBeGreaterThan(0);

    // § Epic rail: "accent-w wash + 3px accent bar"; § Shapes says the 3px.
    const accent = await page.evaluate(() => ({
      bar: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
      wash: getComputedStyle(document.documentElement).getPropertyValue("--accent-w").trim(),
    }));
    expect(selected[0].bar).toBe("3px");
    expect(selected[0].barColour).toBe(hexToRgb(accent.bar));
    expect(selected[0].wash).toBe(hexToRgb(accent.wash));

    // And an unselected row wears neither — the bar is there, and transparent.
    for (const row of rest) {
      expect(row.wash).toBe("rgba(0, 0, 0, 0)");
      expect(row.barColour).not.toBe(hexToRgb(accent.bar));
    }
  });
});

/** `#RRGGBB` as a browser reports it back from a computed style. */
function hexToRgb(hex: string): string {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16));
  return `rgb(${channels.join(", ")})`;
}

test.describe("the frame is fluid to 96rem (FR-007)", () => {
  const WIDTHS = [1280, 1600, 2560] as const;

  test("centred at the cap, fluid below it, and the stage column grows", async ({ page }) => {
    const measured: Record<number, { frame: number; left: number; stage: number; cap: number; root: number }> = {};

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/showfloor");
      await page.waitForSelector("[data-stage]");

      measured[width] = await page.evaluate(() => {
        const frame = document.querySelector("[data-showfloor-frame]") as HTMLElement;
        const stage = document.querySelector("[data-stage]") as HTMLElement;
        const root = document.querySelector("[data-showfloor-root]") as HTMLElement;
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        return {
          frame: frame.getBoundingClientRect().width,
          left: frame.getBoundingClientRect().left,
          stage: stage.getBoundingClientRect().width,
          cap: parseFloat(getComputedStyle(frame).maxWidth) / rem,
          root: root.getBoundingClientRect().width,
        };
      });
    }

    // § Layout: "full-bleed surface card, `max-width: 96rem`, centred".
    for (const width of WIDTHS) {
      expect(measured[width].cap).toBeCloseTo(96, 1);
      // The room behind the frame is the whole viewport at every width.
      expect(measured[width].root).toBeCloseTo(width, 0);
    }

    // Below the cap the frame is the window; the interior has no cap of its
    // own, so the stage column grows with it. This is the assertion FR-007
    // names: 1280 → 1600 must move it.
    expect(measured[1600].frame).toBeGreaterThan(measured[1280].frame);
    expect(measured[1600].stage).toBeGreaterThan(measured[1280].stage);

    // At 2560 the cap binds and the frame is centred rather than stretched.
    expect(measured[2560].frame).toBeLessThan(2560);
    expect(measured[2560].left).toBeCloseTo((2560 - measured[2560].frame) / 2, 0);
  });

  test("no font file and no remote asset is requested", async ({ page }) => {
    const urls: string[] = [];
    page.on("request", (request) => urls.push(request.url()));

    await page.goto("/showfloor");
    await page.waitForSelector("[data-rail-row]");

    // The load really happened, so an empty log would not be why this passes.
    expect(urls.length).toBeGreaterThan(2);

    for (const url of urls) {
      expect(url, `${url} is not this pane`).toMatch(/^http:\/\/127\.0\.0\.1:/);
      expect(url, `${url} is a font file`).not.toMatch(/\.(woff2?|ttf|otf|eot)(\?|$)/i);
      expect(url, `${url} reaches the retired font directory`).not.toContain("/fonts/");
    }
  });
});

test.describe("the rail is the corpus (FR-008)", () => {
  test("one row per spec, in the document's order, with its chip and count", async ({
    page,
    request,
  }) => {
    const rail = await railOf(request);
    // The corpus of this repository is what the demo floor serves; an empty
    // one would satisfy every assertion below for nothing.
    expect(rail.length).toBeGreaterThan(3);

    await page.goto("/showfloor");
    await page.waitForSelector("[data-rail-row]");

    const rows = page.locator("[data-rail-row]");
    await expect(rows).toHaveCount(rail.length);

    const rendered = await rows.evaluateAll((nodes) =>
      nodes.map((node) => ({
        dir: node.getAttribute("data-spec-dir"),
        href: node.getAttribute("href"),
        id: node.querySelector("[data-rail-id]")?.textContent ?? "",
        chip: (node.querySelector("[data-chip]")?.textContent ?? "").trim(),
        name: node.querySelector("[data-rail-name]")?.textContent ?? "",
      })),
    );

    expect(rendered.map((row) => row.dir)).toEqual(rail.map((entry) => entry.spec_dir));
    for (const [index, entry] of rail.entries()) {
      expect(rendered[index].chip).toBe(chipText(entry));
      expect(rendered[index].name).toBe(entry.name);
      expect(rendered[index].href).toBe(`/showfloor/${entry.spec_dir}`);
      expect(rendered[index].id).toBe(entry.spec_dir.split("-")[0]);
    }

    // This corpus really does carry more than one kind of chip — a floor of
    // one word would not prove the vocabulary is being read.
    const tones = new Set(
      await page
        .locator("[data-chip]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-chip-tone"))),
    );
    expect(tones.size).toBeGreaterThan(1);
  });
});

test.describe("selection deep-links (FR-009)", () => {
  const selectionOf = async (page: Page) => ({
    rail: await page
      .locator("[data-rail-row][data-selected='true']")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-spec-dir"))),
    stage: await page.locator("[data-stage]").getAttribute("data-spec-dir"),
    stageId: await page.locator("[data-stage-id]").textContent(),
    miss: await page.locator("[data-selection-miss]").count(),
  });

  test("a spec's own path selects that spec, in the rail and on the stage", async ({
    page,
    request,
  }) => {
    const rail = await railOf(request);
    const target = rail[1];

    await page.goto(`/showfloor/${target.spec_dir}`);
    await page.waitForSelector("[data-stage]");

    const selection = await selectionOf(page);
    expect(selection.rail).toEqual([target.spec_dir]);
    expect(selection.stage).toBe(target.spec_dir);
    expect(selection.stageId).toBe(target.spec_dir.split("-")[0]);
    expect(selection.miss).toBe(0);

    // One appbar, inside the frame, and its nav knows which room it is in.
    // The first world rendered two here: the app shell's and the room's.
    await expect(page.locator(".mast")).toHaveCount(1);
    await expect(page.locator("[data-showfloor-frame] .mast")).toHaveCount(1);
    await expect(page.locator(".mast nav a[aria-current='page']")).toHaveText("Showfloor");
  });

  test("an unknown directory falls back to the default and names the miss", async ({
    page,
    request,
  }) => {
    const rail = await railOf(request);

    await page.goto("/showfloor");
    await page.waitForSelector("[data-stage]");
    const fallback = await selectionOf(page);

    await page.goto("/showfloor/042-a-spec-that-was-never-written");
    await page.waitForSelector("[data-stage]");
    const missed = await selectionOf(page);

    // Same selection as the bare path — and the miss is on the page, in words,
    // naming what was asked for and what is shown instead.
    expect(missed.rail).toEqual(fallback.rail);
    expect(missed.miss).toBe(1);
    const words = await page.locator("[data-selection-miss]").textContent();
    expect(words).toContain("042-a-spec-that-was-never-written");
    expect(words).toContain(missed.stage as string);
    expect(rail.map((entry) => entry.spec_dir)).toContain(missed.stage as string);
  });

  test("a bare path selects the building epic, else the newest landed", async ({
    page,
    request,
  }) => {
    const rail = await railOf(request);

    await page.goto("/showfloor");
    await page.waitForSelector("[data-stage]");
    const selection = await selectionOf(page);

    const entry = rail.find((row) => row.spec_dir === selection.stage);
    expect(entry, "the default selection is a row of the rail").toBeDefined();

    // Nothing is dispatched against this repository's own corpus on the demo
    // floor, so the rule that applies is the second one: the newest landed.
    const landed = rail.filter((row) => row.chip === "landed");
    if (landed.length > 0) {
      expect(selection.stage).toBe(landed[landed.length - 1].spec_dir);
    }
    expect(selection.miss).toBe(0);
  });
});

test.describe("the room has no verb (constitution I, FR-017)", () => {
  /**
   * **Succeeds US2's "no control, one badge, and every request a GET"**, whose
   * `button` count of zero was true only while nothing on the stage could be
   * picked. US4 gives the node card a selection button, so the assertion
   * becomes the one this room has to keep forever: **every button in it is a
   * node card, there is no form and no input at all, and the run issues no
   * request that is not a GET** — including the requests a selection makes,
   * which is none.
   */
  test("every control is a node card, and every request is a GET", async ({ page }) => {
    await page.goto("/showfloor");
    await page.waitForSelector("[data-rail-row]");

    // The room is really rendered before the sweep, so a clean sweep is a fact
    // about the Showfloor and not about an empty page.
    expect(await page.locator("[data-rail-row]").count()).toBeGreaterThan(0);
    expect(await page.locator("[data-node-card]").count()).toBeGreaterThan(0);

    await expect(page.locator("form, input, select, textarea")).toHaveCount(0);
    // Every button on the page is a node card — counted, not spot-checked.
    const buttons = await page.locator("button").count();
    const cards = await page.locator("button[data-node-card]").count();
    expect(buttons).toBe(cards);

    // The Fixture floor carries open Attention items, so the one badge is
    // there — and it is an anchor carrying a count, the Showfloor's only link
    // out (§ Attention badge).
    const badges = page.locator("[data-attention-badge]");
    await expect(badges).toHaveCount(1);
    const tagName = await badges.first().evaluate((element) => element.tagName.toLowerCase());
    expect(tagName).toBe("a");
    expect(await badges.first().textContent()).toMatch(/^\d/);
    expect(await badges.first().getAttribute("href")).toBe("/");
    expect(await badges.locator("button, form, input").count()).toBe(0);

    // Following the rail's own links stays a read, and so does picking a story:
    // the `afterEach` sweep is what holds both to account.
    await page.locator("[data-rail-row]").nth(2).click();
    await page.waitForSelector("[data-stage]");
    await page.locator("[data-node-card]").first().click();
    await expect(page.locator("[data-detail-title]")).toHaveCount(1);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   005 US3. The stage, its graph, and the three laws.
   ───────────────────────────────────────────────────────────────────────── */

/** One epic's stories and edges, straight off the document the room renders. */
interface StageEntry {
  spec_dir: string;
  epic_id: string | null;
  stories_total: number;
  stories_landed: number;
  stories: Array<{
    id: string | null;
    story_key: string | null;
    title: string;
    requirement_keys: string[];
    depends_on: string[];
    depends_on_merged: string[];
    ladder: { stops: Array<{ key: string; status: string }>; chip: string | null };
  }>;
  unknown: string[];
}

async function stageRail(request: {
  get: (url: string) => Promise<{ json: () => Promise<unknown> }>;
}): Promise<StageEntry[]> {
  const response = await request.get("/api/showfloor");
  const document = (await response.json()) as { rail: StageEntry[] };
  return document.rail;
}

test.describe("the stage draws the selected epic's graph (FR-011, FR-012)", () => {
  test("one card per story, in ranks, with six ladder stops each", async ({ page, request }) => {
    const rail = await stageRail(request);
    const staged = rail.filter((entry) => entry.stories.length > 0);
    // This corpus really carries staged specs; a sweep over none would pass
    // for the wrong reason.
    expect(staged.length).toBeGreaterThan(2);

    for (const entry of staged) {
      await page.goto(`/showfloor/${entry.spec_dir}`);
      await page.waitForSelector("[data-stage-canvas]");

      const cards = page.locator("[data-node-card]");
      await expect(cards).toHaveCount(entry.stories.length);

      const rendered = await cards.evaluateAll((nodes) =>
        nodes.map((node) => ({
          id: node.getAttribute("data-story-id"),
          title: node.querySelector("[data-node-title]")?.textContent ?? "",
          chip: (node.querySelector("[data-chip]")?.textContent ?? "").trim(),
          stops: Array.from(node.querySelectorAll("[data-ladder] i")).map((bar) =>
            bar.getAttribute("data-stop-status"),
          ),
          sub: (node.querySelector("[data-node-sub]")?.textContent ?? "").trim(),
        })),
      );

      for (const [index, story] of entry.stories.entries()) {
        const card = rendered.find((candidate) => candidate.id === story.id);
        expect(card, `${entry.spec_dir} stages ${story.id}`).toBeDefined();
        expect(card!.title).toBe(story.title);
        // § The status ladder: six stops, always six, and each wears the
        // status the *document* derived (plan D2) — never one the browser did.
        expect(card!.stops).toEqual(story.ladder.stops.map((stop) => stop.status));
        expect(card!.chip).toBe(story.ladder.chip ?? "unknown");
        // Every card says something true about itself on its sub-line.
        expect(card!.sub.length, `${story.id} has a sub-line`).toBeGreaterThan(0);
        expect(index).toBeGreaterThanOrEqual(0);
      }

      // Ranks run left to right in the DOM, and their boxes really do too.
      const ranks = await page.locator("[data-rank]").evaluateAll((nodes) =>
        nodes.map((node) => ({
          depth: Number(node.getAttribute("data-rank")),
          left: node.getBoundingClientRect().left,
        })),
      );
      expect(ranks.length).toBeGreaterThan(0);
      for (let index = 1; index < ranks.length; index++) {
        expect(ranks[index].depth).toBe(ranks[index - 1].depth + 1);
        expect(ranks[index].left).toBeGreaterThan(ranks[index - 1].left);
      }
    }
  });

  test("wires join the boxes they name, told apart by stroke", async ({ page, request }) => {
    const rail = await stageRail(request);

    // The spec with the most declared edges is the one worth measuring; this
    // corpus has one with both kinds.
    const edgesOf = (entry: StageEntry) =>
      entry.stories.flatMap((story) => [
        ...story.depends_on_merged.map((source) => ({ source, target: story.id, kind: "merge" })),
        ...story.depends_on.map((source) => ({ source, target: story.id, kind: "pass" })),
      ]);
    const wired = rail
      .filter((entry) => edgesOf(entry).length > 0)
      .sort((a, b) => edgesOf(b).length - edgesOf(a).length)[0];
    expect(wired, "some spec on this floor declares dependencies").toBeDefined();

    await page.goto(`/showfloor/${wired.spec_dir}`);
    // The canvas, not the paths: a horizontal wire has a zero-height box, and
    // Playwright's visibility check would wait on it forever.
    await page.waitForSelector("[data-stage-canvas]");

    const declared = edgesOf(wired);
    await expect(page.locator("[data-wire]")).toHaveCount(declared.length);

    const measured = await page.evaluate(() => {
      const canvas = document.querySelector("[data-stage-canvas]") as HTMLElement;
      const svg = document.querySelector("[data-wires]") as SVGElement;
      const origin = svg.getBoundingClientRect();
      const box = (id: string) => {
        const card = document.querySelector(`[data-story-id="${id}"]`) as HTMLElement | null;
        if (card === null) return null;
        const rect = card.getBoundingClientRect();
        return {
          right: rect.right - origin.left,
          left: rect.left - origin.left,
          middle: rect.top + rect.height / 2 - origin.top,
        };
      };

      return {
        pointer: getComputedStyle(svg).pointerEvents,
        // "behind the cards": the SVG is the canvas's first child, the ranks
        // come after it, so a card is painted over the wire that reaches it.
        first: canvas.firstElementChild === svg,
        wires: Array.from(document.querySelectorAll("[data-wire]")).map((path) => {
          const style = getComputedStyle(path);
          return {
            kind: path.getAttribute("data-edge-kind"),
            sourceId: path.getAttribute("data-edge-source"),
            targetId: path.getAttribute("data-edge-target"),
            d: path.getAttribute("d") ?? "",
            stroke: style.stroke,
            width: style.strokeWidth,
            dash: style.strokeDasharray,
            source: box(path.getAttribute("data-edge-source") ?? ""),
            target: box(path.getAttribute("data-edge-target") ?? ""),
          };
        }),
        olive: getComputedStyle(document.documentElement).getPropertyValue("--olive").trim(),
        rule: getComputedStyle(document.documentElement).getPropertyValue("--rule").trim(),
      };
    });

    expect(measured.pointer).toBe("none");
    expect(measured.first).toBe(true);

    // Every wire on the page is an edge the document declared, kind for kind.
    expect(
      measured.wires.map((wire) => `${wire.kind}:${wire.sourceId}->${wire.targetId}`).sort(),
    ).toEqual(declared.map((edge) => `${edge.kind}:${edge.source}->${edge.target}`).sort());

    for (const wire of measured.wires) {
      // § Stage: merge solid 2px olive, pass dashed 2px `--rule`.
      expect(wire.width).toBe("2px");
      if (wire.kind === "merge") {
        expect(wire.stroke).toBe(hexToRgb(measured.olive));
        expect(wire.dash === "none" || wire.dash === "").toBe(true);
      } else {
        expect(wire.stroke).toBe(hexToRgb(measured.rule));
        expect(wire.dash).not.toBe("none");
        expect(wire.dash.length).toBeGreaterThan(0);
      }

      // And the path really starts on the source's right edge and ends on the
      // target's left, at each card's vertical middle — the assertion 004's
      // suite never made, and the one that would have caught nine stations
      // laid out beyond their own map.
      const start = wire.d.match(/^M(-?[\d.]+) (-?[\d.]+)/);
      const end = wire.d.match(/(-?[\d.]+) (-?[\d.]+)$/);
      expect(start, `${wire.d} starts with a move`).not.toBeNull();
      expect(end, `${wire.d} ends at a point`).not.toBeNull();
      expect(wire.source).not.toBeNull();
      expect(wire.target).not.toBeNull();
      expect(Number(start![1])).toBeCloseTo(wire.source!.right, 0);
      expect(Number(start![2])).toBeCloseTo(wire.source!.middle, 0);
      expect(Number(end![1])).toBeCloseTo(wire.target!.left, 0);
      expect(Number(end![2])).toBeCloseTo(wire.target!.middle, 0);
    }

    // This repository's own corpus declares merge edges and no pass edge — its
    // stories share files, so `depends_on_merged` is the honest dependency
    // every time — so the *pair* is proven over the recorded five-node
    // workgraph in `tests/unit/Wires.test.tsx`, which carries both kinds. What
    // a real browser adds is that the two strokes are actually different here:
    // a probe path of each class, measured in the live canvas and removed.
    const strokes = await page.evaluate(() => {
      const svg = document.querySelector("[data-wires]") as SVGElement;
      const read = (kind: string) => {
        const probe = document.createElementNS("http://www.w3.org/2000/svg", "path");
        probe.setAttribute("class", `wire ${kind}`);
        probe.setAttribute("d", "M0 0 L10 0");
        svg.appendChild(probe);
        const style = getComputedStyle(probe);
        const measured = {
          stroke: style.stroke,
          width: style.strokeWidth,
          dash: style.strokeDasharray,
        };
        probe.remove();
        return measured;
      };
      return { merge: read("merge"), pass: read("pass") };
    });

    expect(strokes.merge.width).toBe("2px");
    expect(strokes.pass.width).toBe("2px");
    expect(strokes.merge.stroke).toBe(hexToRgb(measured.olive));
    expect(strokes.pass.stroke).toBe(hexToRgb(measured.rule));
    expect(strokes.merge.stroke).not.toBe(strokes.pass.stroke);
    // Solid against dashed: the one distinction a colour-blind reader has.
    expect(strokes.merge.dash === "none" || strokes.merge.dash === "").toBe(true);
    expect(strokes.pass.dash).not.toBe("none");
    expect(strokes.pass.dash.length).toBeGreaterThan(0);
  });

  test("the legend renders exactly once, however many specs the floor has", async ({
    page,
    request,
  }) => {
    const rail = await stageRail(request);
    expect(rail.length).toBeGreaterThan(3);

    await page.goto("/showfloor");
    await page.waitForSelector("[data-legend]");

    // The first world drew one legend per epic on stage; this floor would have
    // shown as many as it has specs. § Stage: "rendered once per page".
    await expect(page.locator("[data-legend]")).toHaveCount(1);
    await expect(page.locator("[data-legend-edges]")).toHaveCount(1);
    await expect(page.locator("[data-legend-fill]")).toHaveCount(4);

    const words = await page.locator("[data-legend]").textContent();
    expect(words).toContain("merge edge");
    expect(words).toContain("pass edge");
  });

  test("a stage with no graph has no canvas element (FR-013)", async ({ page, request }) => {
    const rail = await stageRail(request);
    const empty = rail.find((entry) => entry.stories.length === 0);
    expect(empty, "this corpus carries a spec that declares no work graph").toBeDefined();

    await page.goto(`/showfloor/${empty!.spec_dir}`);
    await page.waitForSelector("[data-stage-empty]");

    // Absent from the DOM, not present and empty, and not hidden: 004's FR-001
    // restated on the rebuilt stage.
    await expect(page.locator("[data-stage-canvas]")).toHaveCount(0);
    await expect(page.locator("[data-wires]")).toHaveCount(0);
    await expect(page.locator("[data-node-card]")).toHaveCount(0);

    // And the head still names what is on stage, with its metrics grid.
    await expect(page.locator("[data-stage-id]")).toHaveCount(1);
    await expect(page.locator("[data-metrics]")).toHaveCount(1);
  });

  test("the metrics grid obeys the Unknown Rule (FR-010)", async ({ page, request }) => {
    const rail = await stageRail(request);

    for (const entry of rail) {
      await page.goto(`/showfloor/${entry.spec_dir}`);
      await page.waitForSelector("[data-metrics]");

      const cells = await page.locator("[data-metric]").evaluateAll((nodes) =>
        nodes.map((node) => ({
          label: node.getAttribute("data-metric"),
          value: (node.querySelector("[data-metric-value]")?.textContent ?? "").trim(),
          unknown: node.querySelector(".unknown") !== null,
          style: node.querySelector(".unknown")
            ? getComputedStyle(node.querySelector(".unknown")!).fontStyle
            : null,
        })),
      );

      expect(cells.map((cell) => cell.label)).toEqual([
        "stories",
        "merged",
        "FRs",
        "last story",
        "spend to date",
      ]);

      for (const cell of cells) {
        // § The Unknown Rule: the word, in italic muted — never `0`, a dash, or
        // an empty cell.
        if (cell.unknown) {
          expect(cell.value).toBe("unknown");
          expect(cell.style).toBe("italic");
        } else {
          expect(cell.value.length).toBeGreaterThan(0);
          expect(cell.value).not.toBe("—");
          expect(cell.value).not.toBe("-");
        }
      }

      // The counts the corpus really declared are on the page as numerals.
      if (entry.stories.length > 0) {
        expect(cells[0].value).toBe(String(entry.stories_total));
        expect(cells[1].value).toBe(String(entry.stories_landed));
      }

      // "the word 'live' appears nowhere near spend".
      const spend = await page.locator('[data-metric="spend to date"]').textContent();
      expect((spend ?? "").toLowerCase()).not.toContain("live");
    }
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   FR-014 — the three layout laws.

   004 paid for these. Its suite asserted a stage's *height* and never asserted
   where anything ended up, so the gate went green over nine of nine stations
   laid out beyond their own map, a landing lane 121px past its container, and
   the Desk's colliding labels. Each law below is one of those defects,
   generalised so it cannot come back in a different component.
   ───────────────────────────────────────────────────────────────────────── */

const WIDTHS = [1280, 1600] as const;
const SCHEMES = ["light", "dark"] as const;

interface LawReport {
  swept: number;
  leaves: number;
  escaped: string[];
  past: string[];
  overlapping: string[];
  documentScrollWidth: number;
  roomScrollsSideways: boolean;
  viewport: number;
}

/**
 * All three laws, measured in one pass over the rendered page.
 *
 * One `evaluate` rather than three: the boxes have to come from a single
 * layout, or a law could pass against a layout a later law never saw.
 */
async function measureLaws(page: Page): Promise<LawReport> {
  return page.evaluate(() => {
    const EPSILON = 0.5;
    /** § Layout's "no two text leaves overlap", with the 4px slack T024 names. */
    const OVERLAP = 4;

    const describe = (element: Element): string => {
      const classes =
        typeof element.className === "string" && element.className.trim()
          ? `.${element.className.trim().split(/\s+/).join(".")}`
          : "";
      const id = element.getAttribute("data-story-id") ?? element.getAttribute("data-metric");
      return `${element.tagName.toLowerCase()}${classes}${id ? `[${id}]` : ""}`;
    };

    const SKIP = ["script", "style", "head", "title", "meta", "link"];
    const hasText = (element: Element) =>
      !SKIP.includes(element.tagName.toLowerCase()) && (element.textContent ?? "").trim() !== "";

    const painted = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    };

    /**
     * An ancestor that really scrolls sideways, and is itself on the screen.
     *
     * The walk stops *below* the room's own scroll root. That root fills the
     * viewport and carries `overflow: auto`, so it would excuse every escape on
     * the page by the letter of the law — and a room that scrolls sideways is
     * the defect, not the exemption. § Stage sanctions one horizontal scroll:
     * the stage's, when a graph outgrows it. `rootScrollsSideways` below is the
     * other half of that pair, asserted separately.
     */
    const scrollingAncestor = (element: Element, limit: Element | null, viewport: number) => {
      const room = document.querySelector("[data-showfloor-root]");
      let parent = element.parentElement;
      while (parent !== null && parent !== document.documentElement && parent !== document.body) {
        if (parent === room) return null;
        const style = getComputedStyle(parent);
        if (
          (style.overflowX === "auto" || style.overflowX === "scroll") &&
          parent.scrollWidth > parent.clientWidth &&
          parent.getBoundingClientRect().right <= viewport + EPSILON
        ) {
          return parent;
        }
        if (parent === limit) return null;
        parent = parent.parentElement;
      }
      return null;
    };

    const viewport = document.documentElement.clientWidth;
    const escaped: string[] = [];
    const past: string[] = [];
    const overlapping: string[] = [];
    let swept = 0;

    // ── law (a): every stage descendant inside its stage's box, or inside a
    // scrolling ancestor within it.
    for (const stage of Array.from(document.querySelectorAll("[data-stage]"))) {
      const bounds = stage.getBoundingClientRect();
      for (const child of Array.from(stage.querySelectorAll("*"))) {
        if (SKIP.includes(child.tagName.toLowerCase())) continue;
        if (!painted(child)) continue;
        const rect = child.getBoundingClientRect();
        const inside =
          rect.left >= bounds.left - EPSILON &&
          rect.right <= bounds.right + EPSILON &&
          rect.top >= bounds.top - EPSILON &&
          rect.bottom <= bounds.bottom + EPSILON;
        if (inside) continue;
        // A wide graph is allowed to overflow the stage *inside a scroller the
        // stage contains* — that is § Stage's horizontal scroll, not an escape.
        const scroller = scrollingAncestor(child, stage, viewport);
        if (scroller !== null && stage.contains(scroller)) continue;
        escaped.push(
          `${describe(child)} at [${rect.left.toFixed(0)}, ${rect.right.toFixed(0)}] outside stage [${bounds.left.toFixed(0)}, ${bounds.right.toFixed(0)}]`,
        );
      }
    }

    // ── law (b): no text-carrying element past the viewport's right edge,
    // except inside an ancestor whose computed `overflow-x` scrolls.
    const texts: Element[] = [];
    for (const element of Array.from(document.querySelectorAll("*"))) {
      if (!hasText(element) || !painted(element)) continue;
      texts.push(element);
      swept++;
      const rect = element.getBoundingClientRect();
      if (rect.right <= viewport + EPSILON) continue;
      if (scrollingAncestor(element, null, viewport) !== null) continue;
      past.push(`${describe(element)} at ${rect.right.toFixed(0)}px`);
    }

    // ── law (c): no two text-carrying *leaves* overlap in both axes, as they
    // are actually painted.
    // A leaf is an element with text and no element child that has text — the
    // ancestors of a text run necessarily contain it, and containment is not
    // collision.
    //
    // The boxes are the *text's*, measured through a `Range` over each leaf's
    // contents — one rect per line fragment — and not the element's own
    // `getClientRects()`. An inline element that wraps reports fragment rects
    // carrying the whole inline box's height in Chromium, so a wrapped span
    // "overlaps" every sibling on the lines it crosses: a collision that is an
    // artefact of the measurement and is not on the screen. A range measures
    // the glyphs, which is what a reader sees two of.
    const leaves = texts.filter(
      (element) => !Array.from(element.children).some((child) => hasText(child)),
    );
    //
    // And the box is what survives its clipping ancestors (005 US4). A stage
    // wide enough to scroll puts its right-hand cards *under* the detail
    // column in coordinates while the scroller clips them away on the screen:
    // two runs of text that cannot both be seen have not collided, and calling
    // that a collision would make the law report the defect it was written to
    // catch in a room that does not have it. The clip is applied, not excused —
    // an overlap that survives it is still an overlap, which is what keeps the
    // planted collision below going red.
    const clipped = (element: Element, rect: DOMRect): DOMRect | null => {
      let box = rect;
      let parent = element.parentElement;
      while (parent !== null && parent !== document.documentElement) {
        const style = getComputedStyle(parent);
        const clips =
          style.overflowX !== "visible" ||
          style.overflowY !== "visible" ||
          style.overflow !== "visible";
        if (clips) {
          const bounds = parent.getBoundingClientRect();
          const left = Math.max(box.left, bounds.left);
          const right = Math.min(box.right, bounds.right);
          const top = Math.max(box.top, bounds.top);
          const bottom = Math.min(box.bottom, bounds.bottom);
          if (right - left <= 0 || bottom - top <= 0) return null;
          box = new DOMRect(left, top, right - left, bottom - top);
        }
        parent = parent.parentElement;
      }
      return box;
    };

    const boxes = leaves.flatMap((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return Array.from(range.getClientRects())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({ label: describe(element), rect: clipped(element, rect) }))
        .filter((box): box is { label: string; rect: DOMRect } => box.rect !== null);
    });
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (boxes[i].label === boxes[j].label) continue;
        const a = boxes[i].rect;
        const b = boxes[j].rect;
        const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (x > OVERLAP && y > OVERLAP) {
          overlapping.push(`${boxes[i].label} × ${boxes[j].label}`);
        }
      }
    }

    const room = document.querySelector("[data-showfloor-root]");

    return {
      swept,
      leaves: leaves.length,
      escaped,
      past,
      overlapping,
      documentScrollWidth: document.documentElement.scrollWidth,
      roomScrollsSideways: room !== null && room.scrollWidth > room.clientWidth + EPSILON,
      viewport,
    };
  });
}

test.describe("the three layout laws (FR-014)", () => {
  test("hold at 1280 and 1600, in both themes, over the whole fixture floor", async ({
    page,
    request,
  }) => {
    const rail = await stageRail(request);
    // Every spec on the floor, staged and unstaged alike: the empty stage is a
    // layout too, and 004 shipped three screens of it.
    expect(rail.length).toBeGreaterThan(3);

    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 1000 });
        for (const entry of rail) {
          await page.goto(`/showfloor/${entry.spec_dir}`);
          await page.waitForSelector("[data-metrics]");
          const where = `${entry.spec_dir} at ${width} in ${scheme}`;
          const report = await measureLaws(page);

          // A sweep over nothing passes for the wrong reason.
          expect(report.swept, `${where} rendered something`).toBeGreaterThan(20);
          expect(report.leaves, `${where} has text leaves`).toBeGreaterThan(10);

          expect(report.escaped, `${where}: a stage child escaped its stage`).toEqual([]);
          expect(report.past, `${where}: text past the viewport`).toEqual([]);
          expect(report.overlapping, `${where}: two text leaves overlap`).toEqual([]);

          // And neither the page nor the room scrolls sideways to hide any of
          // it — the room's scroll root is the one exemption law (b) refuses.
          expect(report.documentScrollWidth, where).toBeLessThanOrEqual(report.viewport + 0.5);
          expect(report.roomScrollsSideways, `${where}: the room scrolls sideways`).toBe(false);
        }
      }
    }
  });

  test("would catch an escape, a runaway and a collision if one were planted", async ({ page }) => {
    // Three green laws are only worth their green if each goes red on the thing
    // it forbids. Each is planted into the live room and then removed.
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/showfloor");
    await page.waitForSelector("[data-stage-canvas]");

    const clean = await measureLaws(page);
    expect(clean.escaped).toEqual([]);
    expect(clean.past).toEqual([]);
    expect(clean.overlapping).toEqual([]);

    const plant = (kind: string) =>
      page.evaluate((which) => {
        const stage = document.querySelector("[data-stage]") as HTMLElement;
        const planted = document.createElement("p");
        planted.className = "planted";
        planted.textContent = "planted";
        planted.style.position = "absolute";
        if (which === "escape") {
          // Outside the stage's box, in nothing that scrolls.
          const bounds = stage.getBoundingClientRect();
          planted.style.left = `${bounds.left - 200}px`;
          planted.style.top = `${bounds.top + 10}px`;
        } else if (which === "past") {
          planted.style.left = `${document.documentElement.clientWidth + 40}px`;
          planted.style.top = "40px";
        } else {
          // Straight on top of the stage's own id.
          const target = document.querySelector("[data-stage-id]")!.getBoundingClientRect();
          planted.style.left = `${target.left}px`;
          planted.style.top = `${target.top}px`;
          planted.style.width = `${Math.max(target.width, 40)}px`;
          planted.style.height = `${Math.max(target.height, 40)}px`;
        }
        stage.appendChild(planted);
      }, kind);

    const uproot = () =>
      page.evaluate(() => {
        for (const planted of Array.from(document.querySelectorAll(".planted"))) {
          planted.remove();
        }
      });

    await plant("escape");
    expect((await measureLaws(page)).escaped.length).toBeGreaterThan(0);
    await uproot();

    await plant("past");
    expect((await measureLaws(page)).past.length).toBeGreaterThan(0);
    await uproot();

    await plant("overlap");
    expect((await measureLaws(page)).overlapping.length).toBeGreaterThan(0);
    await uproot();

    // And the room is clean again once the plants are pulled — so the three
    // reds above were the plants and not the page.
    const after = await measureLaws(page);
    expect(after.escaped).toEqual([]);
    expect(after.past).toEqual([]);
    expect(after.overlapping).toEqual([]);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   005 US4. The pane reads, the keyboard works, and the motion obeys.
   ───────────────────────────────────────────────────────────────────────── */

/** One story of the document, as the pane must read it back. */
interface PaneStory {
  id: string | null;
  story_key: string | null;
  title: string;
  intent: string;
  requirement_keys: string[];
  ladder: { stops: Array<{ key: string; label: string; status: string }> };
}

/** The first spec on the floor whose stories carry requirement keys. */
async function keyedEntry(request: {
  get: (url: string) => Promise<{ json: () => Promise<unknown> }>;
}): Promise<{ spec_dir: string; stories: PaneStory[] }> {
  const response = await request.get("/api/showfloor");
  const document = (await response.json()) as {
    rail: Array<{ spec_dir: string; stories: PaneStory[] }>;
  };
  const entry = document.rail.find((candidate) =>
    candidate.stories.some((story) => story.requirement_keys.length > 0),
  );
  expect(entry, "a spec on this floor declares requirement keys").toBeDefined();
  return entry!;
}

test.describe("the detail pane tells the selected story (FR-015)", () => {
  test("a picked card fills the pane with the document's own words", async ({
    page,
    request,
  }) => {
    const entry = await keyedEntry(request);
    const story = entry.stories.find((candidate) => candidate.requirement_keys.length > 0)!;

    await page.goto(`/showfloor/${entry.spec_dir}`);
    await page.waitForSelector("[data-node-card]");

    // Nothing is selected until something is picked, and the pane says what
    // the room is for rather than sitting blank (§ Detail pane).
    await expect(page.locator("[data-detail-empty]")).toHaveCount(1);
    await expect(page.locator("[data-detail-title]")).toHaveCount(0);

    await page.locator(`[data-node-card][data-story-id="${story.id}"]`).click();

    await expect(page.locator("[data-detail-id]")).toHaveText(
      (story.story_key ?? story.id ?? "").toUpperCase(),
    );
    await expect(page.locator("[data-detail-title]")).toHaveText(story.title);
    await expect(page.locator("[data-detail-intent]")).toHaveText(story.intent);

    // The six named steps, in the document's own order and status — the same
    // six the card draws as bars, which is the point of deriving them once
    // (plan D2).
    const steps = await page
      .locator("[data-detail-steps] li")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          key: node.getAttribute("data-step"),
          status: node.getAttribute("data-step-status"),
          name: (node.querySelector("[data-step-name]")?.textContent ?? "").trim(),
        })),
      );
    expect(steps).toEqual(
      story.ladder.stops.map((stop) => ({
        key: stop.key,
        status: stop.status,
        name: stop.label,
      })),
    );

    // The five facts DESIGN.md names, all present. No epic has been dispatched
    // for this spec on the Fixture floor, so every one of them is an absence —
    // and an absence renders as an em dash, never as a zero.
    const facts = await page
      .locator("[data-detail-facts] [data-fact]")
      .evaluateAll((nodes) =>
        nodes.map((node) => [node.getAttribute("data-fact"), (node.textContent ?? "").trim()]),
      );
    expect(facts.map(([label]) => label)).toEqual([
      "attempt",
      "judge",
      "pr",
      "landed",
      "wall clock",
    ]);
    for (const [label, value] of facts) {
      expect(value, `${label} is either a reading or an em dash`).not.toBe("0");
      expect(value).toBe("—");
    }

    // One sunken mono chip per requirement key, in the graph's own order.
    await expect(page.locator("[data-fr-chip]")).toHaveText(story.requirement_keys);
    const chip = page.locator("[data-fr-chip]").first();
    expect(await chip.evaluate((element) => getComputedStyle(element).fontFamily)).toMatch(
      /mono|Mono/,
    );
  });

  test("picking a second story replaces the first, and the pane stays one region", async ({
    page,
    request,
  }) => {
    const entry = await keyedEntry(request);
    const [first, second] = entry.stories;
    expect(second, "this spec declares more than one story").toBeDefined();

    await page.goto(`/showfloor/${entry.spec_dir}`);
    await page.locator(`[data-node-card][data-story-id="${first.id}"]`).click();
    await expect(page.locator("[data-detail-title]")).toHaveText(first.title);
    await expect(
      page.locator(`[data-node-card][data-story-id="${first.id}"]`),
    ).toHaveAttribute("aria-pressed", "true");

    await page.locator(`[data-node-card][data-story-id="${second.id}"]`).click();
    await expect(page.locator("[data-detail-title]")).toHaveText(second.title);

    // Exactly one card is pressed, and exactly one pane is telling a story.
    expect(await page.locator('[data-node-card][aria-pressed="true"]').count()).toBe(1);
    expect(await page.locator("[data-detail-title]").count()).toBe(1);
    expect(await page.locator("[data-detail]").count()).toBe(1);
  });
});

test.describe("the room is keyboard-operable (FR-016)", () => {
  test("the walk goes rail → card → card, in rank order, and Enter fills the pane", async ({
    page,
    request,
  }) => {
    const entry = await keyedEntry(request);

    await page.goto(`/showfloor/${entry.spec_dir}`);
    await page.waitForSelector("[data-node-card]");

    // Start on the rail: its rows are links, and they come first in the room.
    await page.locator(`[data-rail-row][data-spec-dir="${entry.spec_dir}"]`).focus();
    expect(
      await page.evaluate(() => document.activeElement?.getAttribute("data-spec-dir")),
    ).toBe(entry.spec_dir);

    // Tab forward until the cards are reached, and record the order they are
    // reached in. Nothing but rail rows may stand between the rail and the
    // stage: a room that hides its graph behind a tab-trap is not operable.
    const reached: string[] = [];
    for (let press = 0; press < 60 && reached.length < entry.stories.length; press++) {
      await page.keyboard.press("Tab");
      const card = await page.evaluate(() => {
        const active = document.activeElement;
        return active === null || !active.hasAttribute("data-node-card")
          ? null
          : active.getAttribute("data-story-id");
      });
      if (card !== null) reached.push(card);
    }

    // Rank order is DOM order, left to right: the order the stage lays the
    // ranks out and the order the graph declares the work in.
    const laidOut = await page
      .locator("[data-node-card]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-story-id")));
    expect(reached).toEqual(laidOut);

    // The keyboard picks with Enter, exactly as the pointer picks with a click.
    await page.evaluate((id) => {
      (document.querySelector(`[data-node-card][data-story-id="${id}"]`) as HTMLElement).focus();
    }, laidOut[0]);
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-detail-title]")).toHaveText(entry.stories[0].title);

    // And Space, which is the other thing a button answers to.
    await page.evaluate((id) => {
      (document.querySelector(`[data-node-card][data-story-id="${id}"]`) as HTMLElement).focus();
    }, laidOut[1]);
    await page.keyboard.press("Space");
    await expect(page.locator("[data-detail-title]")).toHaveText(entry.stories[1].title);
  });

  test("a keyboard focus is visible, and the selection outline is its own mark", async ({
    page,
    request,
  }) => {
    const entry = await keyedEntry(request);
    await page.goto(`/showfloor/${entry.spec_dir}`);
    await page.waitForSelector("[data-node-card]");

    const rail = page.locator("[data-rail-row]").first();
    // A card other than the one the tab walk lands on, so "no outline before
    // selection" is measured on a card that is neither focused nor selected.
    const card = page.locator("[data-node-card]").last();

    // § Shapes: the ring is drawn for `:focus-visible`, which is what a
    // keyboard focus matches and a mouse press does not. Measured on a *card*,
    // reached the way a keyboard reaches it — from the rail, by Tab.
    await rail.focus();
    let focused: {
      onCard: boolean;
      visible: boolean;
      width: string;
      style: string;
      colour: string;
    } | null = null;
    for (let press = 0; press < 60; press++) {
      await page.keyboard.press("Tab");
      focused = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        if (active === null) return null;
        const style = getComputedStyle(active);
        return {
          onCard: active.hasAttribute("data-node-card"),
          visible: active.matches(":focus-visible"),
          width: style.outlineWidth,
          style: style.outlineStyle,
          colour: style.outlineColor,
        };
      });
      if (focused !== null && focused.onCard) break;
    }
    expect(focused).not.toBeNull();
    expect(focused!.onCard, "the tab order reaches a node card").toBe(true);
    expect(focused!.visible).toBe(true);
    expect(focused!.style).toBe("solid");
    expect(parseFloat(focused!.width)).toBeGreaterThanOrEqual(2);
    expect(focused!.colour).not.toBe("rgba(0, 0, 0, 0)");

    // The selection outline is a different thing from the focus ring: § Shapes
    // gives the *selected* card a 2px accent outline, whether it was reached by
    // keyboard or by pointer, and an unselected card has none.
    expect(await card.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("none");
    await card.click();
    await expect(card).toHaveClass(/\bsel\b/);
    const selection = await card.evaluate((element) => {
      const style = getComputedStyle(element);
      return { width: style.outlineWidth, style: style.outlineStyle, border: style.borderTopColor };
    });
    expect(selection.style).toBe("solid");
    expect(parseFloat(selection.width)).toBeGreaterThanOrEqual(2);
    expect(selection.border).toBe(focused!.colour);
  });

  test("the pane is a polite live region", async ({ page, request }) => {
    const entry = await keyedEntry(request);
    await page.goto(`/showfloor/${entry.spec_dir}`);

    const pane = page.locator("[data-detail]");
    await expect(pane).toHaveAttribute("aria-live", "polite");

    // The region persists across the selection it announces: a live region
    // that is torn down and rebuilt per story announces nothing at all.
    await page.evaluate(() => {
      (document.querySelector("[data-detail]") as HTMLElement).setAttribute("data-marked", "1");
    });
    await page.locator("[data-node-card]").first().click();
    await expect(page.locator("[data-detail-title]")).toHaveCount(1);
    await expect(pane).toHaveAttribute("data-marked", "1");
    await expect(pane).toHaveAttribute("aria-live", "polite");
  });
});

test.describe("the one motion obeys the reader (FR-016, § Motion)", () => {
  /**
   * Every animation this room *authors*, read out of the stylesheets the page
   * loaded, with the media condition each one is gated behind.
   *
   * 008 US1 replaced a `waitForSelector("[data-ladder] i.now")` here. That
   * selector exists only while some story's ladder has an **active** stop,
   * which is a fact about the floor and not about the room: attest the specs on
   * it `landed` and every stop is `done`, the selector never appears, and a
   * case about a CSS declaration hangs waiting on a corpus edit. What § Motion
   * authors is a rule, and a rule is in the stylesheet whether or not anything
   * is wearing it this morning — so that is what this reads, on an idle floor.
   */
  async function authoredMotion(page: Page) {
    return page.evaluate(() => {
      const rules: Array<{
        condition: string | null;
        selector: string;
        name: string;
        duration: string;
        iteration: string;
      }> = [];
      const keyframes: string[] = [];

      const walk = (list: CSSRuleList, condition: string | null) => {
        for (const rule of Array.from(list)) {
          if (rule instanceof CSSMediaRule) {
            walk(rule.cssRules, rule.conditionText);
          } else if (rule instanceof CSSKeyframesRule) {
            keyframes.push(rule.name);
          } else if (rule instanceof CSSStyleRule && rule.style.animationName) {
            rules.push({
              condition,
              selector: rule.selectorText,
              name: rule.style.animationName,
              duration: rule.style.animationDuration,
              iteration: rule.style.animationIterationCount,
            });
          }
        }
      };

      for (const sheet of Array.from(document.styleSheets)) {
        // Every face and every rule is vendored (constitution VIII), so a
        // sheet the document may not read is not one this repository shipped.
        try {
          walk((sheet as CSSStyleSheet).cssRules, null);
        } catch {
          continue;
        }
      }
      return { rules, keyframes };
    });
  }

  /**
   * What the engine resolves for an element wearing the authored classes.
   *
   * A probe, deliberately: the point of the case is the rule, and the rule must
   * be measurable when no story on the floor is mid-build. Nothing is faked —
   * the cascade, the stylesheet and the media emulation are all the real ones.
   */
  async function resolvedPulse(page: Page) {
    return page.evaluate(() => {
      const probe = document.createElement("div");
      probe.className = "showfloor";
      probe.innerHTML = '<span class="ladder" data-ladder><i class="now"></i></span>';
      document.body.appendChild(probe);
      const style = getComputedStyle(probe.querySelector("i") as HTMLElement);
      const read = { name: style.animationName, duration: style.animationDuration };
      probe.remove();
      return read;
    });
  }

  test("the pulse is authored at 1.6s, and reduced motion suppresses it", async ({ page }) => {
    // An idle floor is the case: nothing is dispatched against this
    // repository's corpus on the demo floor, and every spec on it may be
    // attested `landed` tomorrow. Neither changes what § Motion authors.
    await page.goto("/showfloor");
    await page.waitForSelector("[data-rail-row]");

    const { rules, keyframes } = await authoredMotion(page);
    const room = rules.filter((rule) => rule.selector.includes(".showfloor"));

    // § Motion: "Exactly one authored motion" — one rule in this room declares
    // an animation at all, and it is the active ladder stop's 1.6s pulse.
    expect(room).toHaveLength(1);
    expect(room[0].selector).toContain(".ladder i.now");
    expect(room[0].name).toBe("ladder-pulse");
    expect(room[0].duration).toBe("1.6s");
    expect(room[0].iteration).toBe("infinite");
    expect(keyframes).toContain("ladder-pulse");

    // "`prefers-reduced-motion` suppresses it": the rule is authored *inside*
    // the no-preference gate, so the suppression is the gate not matching and
    // not an override someone can forget to write.
    expect(room[0].condition).toContain("prefers-reduced-motion");
    expect(room[0].condition).toContain("no-preference");

    // And the engine agrees, under both settings.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const moving = await resolvedPulse(page);
    expect(moving.name).toBe("ladder-pulse");
    expect(moving.duration).toBe("1.6s");

    await page.emulateMedia({ reducedMotion: "reduce" });
    const still = await resolvedPulse(page);
    expect(still.name).toBe("none");
  });

  test("nothing else in the room animates or transitions, under either setting", async ({
    page,
    request,
  }) => {
    // The spec is read off the rail rather than named: which directory carries
    // a drawable graph is a fact about the corpus, and this case is not.
    const entry = await keyedEntry(request);

    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      await page.emulateMedia({ reducedMotion });
      await page.goto(`/showfloor/${entry.spec_dir}`);
      await page.waitForSelector("[data-node-card]");
      await page.locator("[data-node-card]").first().click();
      await page.waitForSelector("[data-detail-title]");

      // "Exactly one authored motion" — so every animated element in the room
      // is an active ladder stop, and nothing transitions at all.
      const moving = await page.evaluate(() =>
        Array.from(document.querySelectorAll("[data-showfloor-root] *"))
          .map((element) => {
            const style = getComputedStyle(element);
            return {
              animation: style.animationName,
              transition: style.transitionProperty,
              stop: element.matches("[data-ladder] i.now"),
            };
          })
          .filter((entry) => entry.animation !== "none" || entry.transition !== "all"),
      );

      for (const entry of moving) {
        if (entry.animation !== "none") {
          expect(entry.stop, "only an active ladder stop may animate").toBe(true);
          expect(entry.animation).toBe("ladder-pulse");
        }
        expect(["none", "all"], "nothing in this room transitions").toContain(entry.transition);
      }
    }
  });
});

test.describe("the three laws hold with the pane full (FR-014, FR-015)", () => {
  /**
   * US3 measured the laws over a room whose detail column was a placeholder.
   * US4 fills it with the longest text the document carries — a story's intent
   * runs to several lines — in a `26rem` track that folds twice. That is
   * exactly the shape 004's defects took, so the laws are re-measured here
   * against a *selected* story rather than assumed to survive the new content.
   */
  test("a selected story stays inside its box at both widths, in both themes", async ({
    page,
    request,
  }) => {
    const entry = await keyedEntry(request);

    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`/showfloor/${entry.spec_dir}`);
        await page.waitForSelector("[data-node-card]");

        for (const story of entry.stories) {
          await page.locator(`[data-node-card][data-story-id="${story.id}"]`).click();
          await page.waitForSelector("[data-detail-title]");

          const where = `${entry.spec_dir}/${story.id} at ${width} in ${scheme}`;
          const report = await measureLaws(page);

          expect(report.swept, `${where} rendered something`).toBeGreaterThan(20);
          expect(report.escaped, `${where}: a stage child escaped its stage`).toEqual([]);
          expect(report.past, `${where}: text past the viewport`).toEqual([]);
          expect(report.overlapping, `${where}: two text leaves overlap`).toEqual([]);
          expect(report.roomScrollsSideways, `${where}: the room scrolls sideways`).toBe(false);
        }
      }
    }
  });
});
