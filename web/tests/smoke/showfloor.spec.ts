/**
 * The Showfloor, in a real browser (005 US2: FR-006 … FR-009).
 *
 * **This file replaces 002's and 004's Showfloor smoke wholesale.** Every
 * assertion it dropped had its *subject* deleted by D-015 and by this story,
 * and each is named here with what succeeds it (plan D4):
 *
 * | dropped | why | succeeded by |
 * |---|---|---|
 * | "the Showfloor stages the fixture floor read-only" — one `[data-epic-stage]` per running epic, its stations and edges | the room is a master–detail now: one epic on stage, chosen from a rail. There is no per-epic stage to enumerate. | "the rail is the corpus" + US3's T024, which asserts the one stage's graph |
 * | "pure glass sweep" — no control, one badge, badge is an anchor | subject survives entirely | "the room has no verb" below, against the rebuilt DOM |
 * | "full-bleed is measured" | subject survives | "the frame is centred at 96rem" below, which measures the root *and* the frame |
 * | "the stage is the size of its graph" (empty vs populated stage heights) | there is one stage, not six, so there is no stack of empty ones to measure | US3's T022/T024: a stage document with no nodes renders its notice and no canvas |
 * | "the landing line lies within its wrapper's scrollable extent" and "a map wider than its wrapper makes the wrapper scroll" | the landing line and the React Flow map are deleted from the room; DESIGN.md draws neither | US3's T024, on the rebuilt stage |
 * | "no text is laid out past the viewport outside a scrollable wrapper" | subject survives, and it is the defect class 004 exists to prevent | "nothing is laid out into nowhere" below, kept at two widths, and US3's T024 which extends it to the stage's own box |
 *
 * What this file adds is US2's own: the two themes really rendering, the frame
 * really centred and fluid, the request log really empty of fonts, and the
 * three routing cases really selecting.
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

  test("nothing is laid out into nowhere", async ({ page }) => {
    // 004's FR-006 sweep, kept: no element carrying text may cross the
    // viewport's right edge except inside an ancestor that really scrolls.
    for (const width of [1280, 1600] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/showfloor");
      await page.waitForSelector("[data-stage]");

      const sweep = await page.evaluate(() => {
        const viewport = document.documentElement.clientWidth;
        const EPSILON = 0.5;
        let swept = 0;
        const offenders: string[] = [];

        const describe = (element: Element): string => {
          const classes =
            typeof element.className === "string" && element.className.trim()
              ? `.${element.className.trim().split(/\s+/).join(".")}`
              : "";
          return `${element.tagName.toLowerCase()}${classes}`;
        };

        for (const element of Array.from(document.querySelectorAll("*"))) {
          const tag = element.tagName.toLowerCase();
          if (["script", "style", "head", "title"].includes(tag)) continue;
          if (!(element.textContent ?? "").trim()) continue;
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          swept++;
          if (rect.right <= viewport + EPSILON) continue;

          let parent = element.parentElement;
          let reachable = false;
          while (parent && parent !== document.documentElement) {
            const overflowX = getComputedStyle(parent).overflowX;
            if (
              (overflowX === "auto" || overflowX === "scroll") &&
              parent.scrollWidth > parent.clientWidth &&
              parent.getBoundingClientRect().right <= viewport + EPSILON
            ) {
              reachable = true;
              break;
            }
            parent = parent.parentElement;
          }
          if (!reachable) offenders.push(`${describe(element)} at ${rect.right.toFixed(0)}px`);
        }

        return { swept, offenders, scrollWidth: document.documentElement.scrollWidth, viewport };
      });

      // A sweep over nothing passes for the wrong reason.
      expect(sweep.swept).toBeGreaterThan(20);
      expect(sweep.offenders).toEqual([]);
      // And the page itself does not scroll sideways to hide the difference.
      expect(sweep.scrollWidth).toBeLessThanOrEqual(sweep.viewport + 0.5);
    }
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

test.describe("the room has no verb (constitution I)", () => {
  test("no control, one badge, and every request a GET", async ({ page }) => {
    const requests: { method: string }[] = [];
    page.on("request", (request) => requests.push({ method: request.method() }));

    await page.goto("/showfloor");
    await page.waitForSelector("[data-rail-row]");

    // The room is really rendered before the sweep, so a clean sweep is a fact
    // about the Showfloor and not about an empty page.
    expect(await page.locator("[data-rail-row]").count()).toBeGreaterThan(0);

    await expect(page.locator("button, form, input, select, textarea")).toHaveCount(0);

    // The Fixture floor carries open Attention items, so the one badge is
    // there — and it is an anchor, the Showfloor's only link out.
    const badges = page.locator("[data-attention-badge]");
    await expect(badges).toHaveCount(1);
    const tagName = await badges.first().evaluate((element) => element.tagName.toLowerCase());
    expect(tagName).toBe("a");
    expect(await badges.first().textContent()).toMatch(/^\d/);
    expect(await badges.first().getAttribute("href")).toBe("/");

    // Following the rail's own links stays a read, too.
    await page.locator("[data-rail-row]").nth(2).click();
    await page.waitForSelector("[data-stage]");

    expect(requests.filter((request) => request.method !== "GET")).toHaveLength(0);
  });
});
