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
 *
 * 009 US2 adds the fourth (D-018, `DESIGN.md` § Layout): no element with a
 * non-transparent background may paint over a text leaf it does not own. It
 * runs in the same sweeps, over the same routes, widths and themes, out of the
 * shared harness in `support/laws.ts` — and its mutation control asserts the
 * other three stay green against the box it plants, which is the whole reason
 * a fourth law was needed.
 */

import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { measureLaws } from "./support/laws";
// 013 US3: the gate run's records, built through the one definition of the
// document contract this repository keeps, rather than a second one written
// here. See the block at the foot of this file for why the room has to be
// handed them at all.
import { attemptOf, evidenceOf, gateOf } from "../unit/support/showfloor-builder";
import type { AttemptRecord, StoryEvidence } from "../../src/api/showfloorDocument";

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
          italic: style.fontStyle,
          transform: style.textTransform,
        };
      }),
    );

    /** § Colors' `--muted`, which is the ink the Unknown Rule is written in. */
    const muted = hexToRgb(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--muted").trim(),
      ),
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

    // "chips are `border: 1px solid currentColor` over the wash", squared —
    // over the six tones § Chips names. `unknown` is not a seventh row of that
    // table and never wore its border: it is the Unknown Rule wearing a chip's
    // slot, muted and italic with the factory's own spelling kept, drawn
    // borderless in `showfloor.css` since 005 and told apart from the six by
    // the Desk's own sweep already (`desk-world.spec.ts` § Chips). This test
    // could not tell them apart because no `unknown` node chip had ever reached
    // the Showfloor for it to measure — until 009 gave the room a read that can
    // fail to place a story (FR-004), which is exactly what a checkout with no
    // landing branch makes it do.
    for (const chip of chips) {
      expect(chip.radius).toBe("0px");
      if (chip.tone === "unknown") {
        expect(chip.italic, "the Unknown Rule is written in italic").toBe("italic");
        expect(chip.transform, "and in the factory's own spelling").toBe("none");
        expect(chip.colour, "in muted").toBe(muted);
        expect(chip.borderColour, "with no border to make it a state").toBe("rgba(0, 0, 0, 0)");
        expect(chip.wash, "and no wash either").toBe("rgba(0, 0, 0, 0)");
      } else {
        expect(chip.borderColour).toBe(chip.colour);
      }
    }
    // Each tone's ink still differs from the next one's.
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
  /** The spec's own goal, for the band beneath the stage (009 US4, FR-010). */
  intent: string;
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
   FR-014 — the layout laws, now four.

   **Authority: `DESIGN.md` § Layout, "Containment is a design law."** It
   states all four in one paragraph — nothing carrying text crosses the
   viewport's right edge outside a scrolling ancestor, every stage element
   sits inside its stage's box, no two text leaves overlap, "**and no element
   with an opaque background may paint over a text leaf that is not its own**"
   (2026-08-25, D-018) — and it ends "These are committed test assertions, not
   aspirations." This block is where the Showfloor commits them.

   004 paid for the first three. Its suite asserted a stage's *height* and
   never asserted where anything ended up, so the gate went green over nine of
   nine stations laid out beyond their own map, a landing lane 121px past its
   container, and the Desk's colliding labels. Each of laws (a), (b) and (c) is
   one of those defects, generalised so it cannot come back in a different
   component.

   D-018 paid for the fourth (009 US2, FR-005 … FR-007). A degraded note
   rendered unreadable in both themes on 2026-08-25, its heading cut mid-word,
   and all three laws passed — correctly, because they measure glyph geometry
   through a `Range` and no glyph had moved. Law (d) reads the paint instead,
   and the mutation control below is the committed evidence that the other
   three structurally cannot: it plants an opaque box over a heading and
   asserts (a), (b) and (c) stay green while (d) goes red.

   The measurement itself lives in `support/laws.ts`, because D-018's law has
   to hold over every route the smoke suite sweeps and the Desk sweeps its own
   (`desk.spec.ts`). One harness, two rooms, four laws, one `evaluate` pass.
   ───────────────────────────────────────────────────────────────────────── */

const WIDTHS = [1280, 1600] as const;
const SCHEMES = ["light", "dark"] as const;

test.describe("the four layout laws (FR-014, 009 FR-005)", () => {
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

          // A sweep over nothing passes for the wrong reason — and law (d)
          // over a page that paints nothing is the same empty pass, so the
          // painters it considered carry a floor of their own (009 FR-005).
          expect(report.swept, `${where} rendered something`).toBeGreaterThan(20);
          expect(report.leaves, `${where} has text leaves`).toBeGreaterThan(10);
          expect(report.painters, `${where} paints backgrounds`).toBeGreaterThan(5);

          expect(report.escaped, `${where}: a stage child escaped its stage`).toEqual([]);
          expect(report.past, `${where}: text past the viewport`).toEqual([]);
          expect(report.overlapping, `${where}: two text leaves overlap`).toEqual([]);
          expect(report.occluded, `${where}: a box paints over text it does not own`).toEqual([]);

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

    // 008 US2 (FR-008): this control now runs over the *released* room — the
    // room opens on no story, so the detail track is collapsed and the stage
    // holds the width it used to lose. That is the geometry the three laws
    // have to keep catching things in, so it is asserted here rather than
    // assumed: a control that quietly measured the old shape would guarantee
    // nothing about the new one.
    expect(
      await page.getAttribute("[data-showfloor-cols]", "data-selection"),
      "the control runs with the detail track released",
    ).toBe("none");

    const clean = await measureLaws(page);
    expect(clean.escaped).toEqual([]);
    expect(clean.past).toEqual([]);
    expect(clean.overlapping).toEqual([]);
    expect(clean.occluded).toEqual([]);

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
    expect(after.occluded).toEqual([]);
  });

  /**
   * 009 US2 (FR-006, FR-007). The mutation control for law (d) — and, in the
   * same test, the committed record of the gap it closes.
   *
   * The plant is D-018's defect in its smallest honest form: an **inline
   * element carrying no text of its own, with an opaque background**, laid
   * over the heading its neighbour owns. Not one glyph moves, so the three
   * laws 004 paid for see nothing at all:
   *
   *   * law (a) sees a stage descendant sitting inside its stage's box, which
   *     is legal;
   *   * law (b) sweeps elements that *carry text* past the viewport's right
   *     edge — the plant carries none, and is inside the viewport besides;
   *   * law (c) compares text leaves to text leaves, and the plant is not a
   *     text leaf.
   *
   * All three stay green while the heading is unreadable. That is not
   * argued here, it is asserted: the `toEqual([])` on `escaped`, `past` and
   * `overlapping` below is FR-007's committed evidence for why a fourth law
   * had to exist, and it is what would go red if someone ever "simplified"
   * law (d) into one of the other three.
   */
  test("a planted occluder turns law (d) red and leaves (a), (b) and (c) green", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/showfloor");
    await page.waitForSelector("[data-stage-canvas]");

    const clean = await measureLaws(page);
    expect(clean.occluded, "the room paints over nothing before the plant").toEqual([]);
    expect(clean.painters, "the room paints backgrounds at all").toBeGreaterThan(5);

    // The target is the stage's own id: § Typography's `display` face, the
    // biggest thing on the stage, and this room's nearest thing to the
    // degraded note's heading that D-018 watched go unreadable.
    const geometry = await page.evaluate(() => {
      const stage = document.querySelector("[data-stage]") as HTMLElement;
      const target = document.querySelector("[data-stage-id]") as HTMLElement;
      const bounds = target.getBoundingClientRect();

      const planted = document.createElement("span");
      planted.className = "planted planted-occluder";
      planted.style.display = "inline-block";
      planted.style.position = "absolute";
      planted.style.left = `${bounds.left}px`;
      planted.style.top = `${bounds.top}px`;
      planted.style.width = `${Math.max(bounds.width, 40)}px`;
      planted.style.height = `${Math.max(bounds.height, 20)}px`;
      // Opaque, and a colour this theme really produces — the room's own
      // ground, so the plant is a plausible box and not a test artefact.
      planted.style.background = getComputedStyle(document.body).backgroundColor;
      stage.appendChild(planted);

      // `position: absolute` resolves against whichever ancestor happens to be
      // positioned, which this control cannot know from here. So the plant is
      // measured where it landed and corrected onto the target, rather than
      // assumed onto it — a control that missed its target would prove
      // nothing, quietly.
      const landed = planted.getBoundingClientRect();
      planted.style.left = `${bounds.left + (bounds.left - landed.left)}px`;
      planted.style.top = `${bounds.top + (bounds.top - landed.top)}px`;

      const final = planted.getBoundingClientRect();
      return {
        text: (target.textContent ?? "").trim(),
        covers:
          final.left <= bounds.left + 1 &&
          final.right >= bounds.right - 1 &&
          final.top <= bounds.top + 1 &&
          final.bottom >= bounds.bottom - 1,
        opaque: getComputedStyle(planted).backgroundColor,
        planted: (planted.textContent ?? "").trim(),
      };
    });

    // The plant is what it claims to be: opaque, textless, and actually on top
    // of the heading rather than near it.
    expect(geometry.covers, "the plant landed over the stage's id").toBe(true);
    expect(geometry.planted, "the plant carries no text of its own").toBe("");
    expect(geometry.opaque, "the plant is opaque").not.toContain("rgba(0, 0, 0, 0)");
    expect(geometry.text.length, "the stage's id is readable text").toBeGreaterThan(0);

    const planted = await measureLaws(page);

    // FR-006: the law can go red.
    expect(planted.occluded.length, "law (d) catches the planted occluder").toBeGreaterThan(0);
    expect(planted.occluded.join(" ")).toContain("planted-occluder");
    expect(
      planted.occluded.join(" "),
      "law (d) names the text the plant made unreadable",
    ).toContain(geometry.text.slice(0, 32));

    // FR-007: the other three cannot see it. This is the whole reason law (d)
    // exists, and it is asserted here so that the reason stays in the suite.
    expect(planted.escaped, "law (a) cannot see an occluder inside the stage").toEqual([]);
    expect(planted.past, "law (b) cannot see an occluder that carries no text").toEqual([]);
    expect(planted.overlapping, "law (c) cannot see an occluder that is not a text leaf").toEqual(
      [],
    );

    await page.evaluate(() => {
      for (const element of Array.from(document.querySelectorAll(".planted"))) element.remove();
    });

    // And the red was the plant, not the page.
    const after = await measureLaws(page);
    expect(after.occluded).toEqual([]);
    expect(after.escaped).toEqual([]);
    expect(after.past).toEqual([]);
    expect(after.overlapping).toEqual([]);

    // ── the same violation, unpositioned ──────────────────────────────────
    //
    // The plant above is absolutely positioned, which is the easy case for any
    // paint-order test to catch and the easy case for a law to be accidentally
    // keyed on. D-018's defect was not: a box in the ordinary flow, painted
    // after the text beside it, is how a heading gets cut mid-word. So the
    // control plants that shape too — an in-flow inline-block backed onto its
    // neighbour with a negative margin, positioned `static`, no `z-index` —
    // and law (d) has to see it as well.
    const inflow = await page.evaluate(() => {
      const target = document.querySelector("[data-stage-id]") as HTMLElement;
      const bounds = target.getBoundingClientRect();

      const planted = document.createElement("span");
      planted.className = "planted planted-inflow";
      planted.style.display = "inline-block";
      planted.style.width = `${Math.max(bounds.width, 40)}px`;
      planted.style.height = `${Math.max(bounds.height, 20)}px`;
      planted.style.marginLeft = `${-Math.max(bounds.width, 40)}px`;
      planted.style.background = getComputedStyle(document.body).backgroundColor;
      target.insertAdjacentElement("afterend", planted);

      const landed = planted.getBoundingClientRect();
      return {
        position: getComputedStyle(planted).position,
        zIndex: getComputedStyle(planted).zIndex,
        overlaps:
          Math.min(landed.right, bounds.right) - Math.max(landed.left, bounds.left) > 1 &&
          Math.min(landed.bottom, bounds.bottom) - Math.max(landed.top, bounds.top) > 1,
      };
    });

    expect(inflow.position, "the second plant is in the ordinary flow").toBe("static");
    expect(inflow.zIndex, "the second plant claims no stacking order").toBe("auto");
    expect(inflow.overlaps, "the second plant landed on the stage's id").toBe(true);

    const unpositioned = await measureLaws(page);
    expect(
      unpositioned.occluded.length,
      "law (d) catches an in-flow occluder as well as a positioned one",
    ).toBeGreaterThan(0);
    expect(unpositioned.occluded.join(" ")).toContain("planted-inflow");

    await page.evaluate(() => {
      for (const element of Array.from(document.querySelectorAll(".planted"))) element.remove();
    });
    expect((await measureLaws(page)).occluded).toEqual([]);
  });

  /**
   * 009 US2 (FR-005), and the first defect law (d) caught on its own.
   *
   * The merge queue refused this story's first branch, and it was right: the detail
   * pane's rule was written `.showfloor .detail`, and the degraded note's
   * third part is a `<span class="detail">` — the same word for a different
   * thing. The span took the pane's opaque `--surface`, its `1.4rem` padding
   * and its rule; inline padding paints and hit-tests but does not flow, so a
   * long detail that broke onto its own line drew a white box back up over
   * `landed_facts refusal` on the line above. Exactly D-018's defect, on
   * exactly the element D-018 was about.
   *
   * The sweep above only sees it where a note and a selected story appear on
   * one screen, which depends on which reads happen to fail on the machine
   * running the gate — it went red in the forge and green on the operator's
   * desk. So the leak has a guard that does not: the well is the painter, its
   * parts are not, over a spec that carries a note on any machine because no
   * DAG for it is committed.
   */
  test("the detail pane's clothes stop at the detail pane (D-018)", async ({ page, request }) => {
    const rail = (await stageRail(request)) as Array<
      StageEntry & { notes?: Array<{ read: string; mode: string; detail: string }> }
    >;
    const degraded = rail.filter((entry) => (entry.notes ?? []).length > 0);
    expect(degraded.length, "this floor really degrades a read somewhere").toBeGreaterThan(0);

    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const entry of degraded) {
        await page.goto(`/showfloor/${entry.spec_dir}`);
        await page.waitForSelector("[data-stage-note]");

        const painted = await page.locator("[data-stage-note]").evaluateAll((notes) =>
          notes.flatMap((note) =>
            Array.from(note.querySelectorAll("*"))
              .filter((part) => {
                const colour = getComputedStyle(part).backgroundColor.trim();
                return colour !== "" && colour !== "transparent" && !/,\s*0\)$/.test(colour);
              })
              .map(
                (part) =>
                  `${part.tagName.toLowerCase()}.${part.className} → ${
                    getComputedStyle(part).backgroundColor
                  }`,
              ),
          ),
        );

        expect(
          painted,
          `${entry.spec_dir} in ${scheme}: a part of the degraded note paints its own ground`,
        ).toEqual([]);
      }
    }
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
  ladder: {
    stops: Array<{ key: string; label: string; status: string; at: string | null }>;
  };
  /** The live answer's fields, and the three the landing branch supplies. */
  facts: Record<string, unknown>;
}

/** The first spec on the floor whose stories carry requirement keys. */
async function keyedEntry(request: {
  get: (url: string) => Promise<{ json: () => Promise<unknown> }>;
}): Promise<{ spec_dir: string; intent: string; stories: PaneStory[] }> {
  const response = await request.get("/api/showfloor");
  const document = (await response.json()) as {
    rail: Array<{ spec_dir: string; intent: string; stories: PaneStory[] }>;
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

    // Nothing is selected until something is picked. Since D-019 the band
    // beneath the stage says what the *spec* is for rather than describing the
    // room, and the room's own explainer is not mounted while a spec is
    // selected — the two never stack (009 FR-012, FR-013).
    await expect(page.locator("[data-detail-title]")).toHaveCount(0);
    await expect(page.locator("[data-detail-empty]")).toHaveCount(0);
    await expect(page.locator("[data-spec-goal]")).toHaveCount(entry.intent === "" ? 0 : 1);

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

    // The facts DESIGN.md names, all present and in its order. `sha` is the
    // sixth since 009: DESIGN.md always named a landing SHA and the cell was
    // left out while no answer carried a merge commit.
    const facts = await page
      .locator("[data-detail-facts] [data-fact]")
      .evaluateAll((nodes) =>
        nodes.map((node) => [node.getAttribute("data-fact"), (node.textContent ?? "").trim()]),
      );
    expect(facts.map(([label]) => label)).toEqual([
      "attempt",
      "judge",
      "pr",
      "sha",
      "landed",
      "wall clock",
    ]);

    // No epic is dispatched for this spec on the Fixture floor, so every *live*
    // fact is an absence — and an absence renders as an em dash, never a zero.
    const grid = Object.fromEntries(facts) as Record<string, string>;
    expect(grid.attempt).toBe("—");
    expect(grid.judge).toBe("—");
    expect(grid["wall clock"]).toBe("—");

    // The three the landing branch holds are read out of the document rather
    // than assumed either way (009 FR-002a): a story the branch carries says
    // its SHA, its PR and when it merged, and one it does not still says `—`.
    // Asserting "everything is a dash" would go red the day this spec lands,
    // and asserting "everything is filled" would go red the day it does not.
    const sha = story.facts.landing_sha;
    const landed = story.ladder.stops.find((stop) => stop.key === "merged")?.at ?? null;
    const pr = story.facts.pr_number;
    expect(grid.sha).toBe(typeof sha === "string" && sha !== "" ? sha.slice(0, 7) : "—");
    // `#<n>` alone, or `#<n> · <landing state>` where an answer carried one.
    if (typeof pr === "number") expect(grid.pr.startsWith(`#${pr}`)).toBe(true);
    else expect(grid.pr).toBe("—");
    expect(grid.landed).toBe(landed === null ? "—" : `${landed.slice(11, 16)} UTC`);

    for (const [label, value] of facts) {
      expect(value, `${label} is a reading or an em dash, never a zero`).not.toBe("0");
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

test.describe("the laws hold with the pane full (FR-014, FR-015, 009 FR-005)", () => {
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
          expect(report.painters, `${where} paints backgrounds`).toBeGreaterThan(5);
          expect(report.escaped, `${where}: a stage child escaped its stage`).toEqual([]);
          expect(report.past, `${where}: text past the viewport`).toEqual([]);
          expect(report.overlapping, `${where}: two text leaves overlap`).toEqual([]);
          // 009 US2 (FR-005): the filled pane is where the room stacks the
          // most paint over the most prose, so law (d) is measured here too.
          expect(report.occluded, `${where}: a box paints over text it does not own`).toEqual([]);
          expect(report.roomScrollsSideways, `${where}: the room scrolls sideways`).toBe(false);
        }
      }
    }
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   008 US2 — the stage takes the room the pane is not using (FR-004 … FR-008).

   D-016 read the room on a 3008px monitor instead of a test viewport. The app
   frame caps at 96rem; of what was left, a fixed `26rem` detail track held
   403px to show two sentences of room explanation while nothing was selected,
   the stage got 770px, and the graph needed 797. It scrolled — by 235px at
   1280 and by 27px at 1600 and above, on every spec on the floor. The width
   was already on the screen: the pane was holding it.

   Nothing in this repository could see that. FR-014's law (a) sanctions a
   scrolling ancestor inside the stage *by design*, because § Stage says a
   graph too wide for its stage scrolls — so a stage that clips passes all
   three laws. The measurement below is the assertion that was missing, and it
   is the one number this story exists to move: 235 / 27 / 27 → 0 / 0 / 0.

   Three cases, and each is one clause of D-016:

   * **the sweep** (FR-007, FR-008) — every spec on the rail × {1280, 1600,
     2560} × {light, dark}, nothing selected: the stage scroller's
     `scrollWidth` equals its `clientWidth`, and FR-014's three laws are
     re-measured in the same pass against 005's own element and text-leaf
     floors, so the width the stage gained did not buy an escape.
   * **the round trip** (FR-004, FR-006) — the collapsed track computes to `0`,
     the stage is wider by exactly what the pane released, and picking a story
     restores `26rem`, fills the pane and takes the explanation out from under
     the stage. It also measures the wires, which is the defect this story was
     most likely to ship: `Wires.tsx` measures on mount and on `resize`, and a
     grid track that collapses fires neither.
   * **the words** (FR-005) — `[data-detail-empty]` still carries its two
     sentences, verbatim and visible, beneath the graph and above the legend
     row. Plan D1: relocated, never hidden. A `display: none` would satisfy
     005's `toHaveCount(1)` and would be a lie the constitution's third
     principle forbids, so visibility and the box are asserted, not presence.

   2560 stands in for D-016's 3008 (spec § Assumptions): the frame caps at
   96rem, so every width above it renders the identical room.
   ───────────────────────────────────────────────────────────────────────── */

const US2_WIDTHS = [1280, 1600, 2560] as const;

/** The authored two sentences, verbatim, as `DetailPane.tsx` writes them. */
const ROOM_EXPLAINED =
  "The rail picks a spec and the stage draws its work graph, one epic at a time. " +
  "Choose a story on the stage and this pane tells it whole — the six steps it " +
  "moves through, the facts the factory recorded, and the requirements it implements.";

interface RoomMetrics {
  /** The grid's own state hook: `none` while no story is selected. */
  selection: string | null;
  /** The three grid tracks as they resolved, in px. */
  tracks: number[];
  /** The detail pane's painted width — `0` while its track is collapsed. */
  detailWidth: number | null;
  /** The stage scroller's measurement, or null where there is no canvas. */
  scroll: { clientWidth: number; scrollWidth: number } | null;
  /** The room's root font size, so `26rem` is read and never assumed. */
  root: number;
}

/** The room's two tracks and the stage scroller's measurement, in one layout. */
async function roomMetrics(page: Page): Promise<RoomMetrics> {
  return page.evaluate(() => {
    const cols = document.querySelector("[data-showfloor-cols]") as HTMLElement | null;
    const detail = document.querySelector("[data-detail]") as HTMLElement | null;
    const scroller = document.querySelector("[data-stage-scroll]") as HTMLElement | null;
    return {
      selection: cols === null ? null : cols.getAttribute("data-selection"),
      tracks:
        cols === null
          ? []
          : getComputedStyle(cols)
              .gridTemplateColumns.split(/\s+/)
              .map((track) => parseFloat(track)),
      detailWidth: detail === null ? null : detail.getBoundingClientRect().width,
      scroll:
        scroller === null
          ? null
          : { clientWidth: scroller.clientWidth, scrollWidth: scroller.scrollWidth },
      root: parseFloat(getComputedStyle(document.documentElement).fontSize),
    };
  });
}

/** One band under the stage, measured as the browser lays it out. */
interface BandMetrics {
  text: string;
  display: string;
  visibility: string;
  opacity: string;
  textOverflow: string;
  width: number;
  height: number;
  top: number;
  bottom: number;
  /** The bottom of the graph scroller, or the legend's top where none exists. */
  graphBottom: number;
  legendTop: number;
  insideStage: boolean;
  insidePane: boolean;
  clippedWide: boolean;
  clippedTall: boolean;
  /** The grid's selection hook at the instant of the measurement. */
  selection: string | null;
}

/**
 * The band beneath the stage, whichever paragraph is occupying it (009 US4).
 *
 * 008 measured `[data-detail-empty]` here and this is that measurement, taken
 * by selector so the two occupants D-019 defines — the spec's own goal, and the
 * room's explainer in the no-spec case — are held to one standard rather than
 * two. `null` when the selector matches nothing, which is an *answer* for
 * FR-011 and not a failure to measure.
 */
async function bandMetrics(page: Page, selector: string): Promise<BandMetrics | null> {
  return page.evaluate((which) => {
    const band = document.querySelector(which) as HTMLElement | null;
    if (band === null) return null;
    const style = getComputedStyle(band);
    const box = band.getBoundingClientRect();
    const scroller = document.querySelector("[data-stage-scroll]");
    const legend = document.querySelector("[data-legend]")!;
    const stage = document.querySelector("[data-stage]")!;
    const pane = document.querySelector("[data-detail]");
    const cols = document.querySelector("[data-showfloor-cols]");
    const legendTop = legend.getBoundingClientRect().top;
    return {
      text: (band.textContent ?? "").replace(/\s+/g, " ").trim(),
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      textOverflow: style.textOverflow,
      width: box.width,
      height: box.height,
      top: box.top,
      bottom: box.bottom,
      graphBottom:
        scroller === null ? legendTop : scroller.getBoundingClientRect().bottom,
      legendTop,
      insideStage: stage.contains(band),
      insidePane: pane !== null && pane.contains(band),
      clippedWide: band.scrollWidth > band.clientWidth + 0.5,
      clippedTall: band.scrollHeight > band.clientHeight + 0.5,
      selection: cols === null ? null : cols.getAttribute("data-selection"),
    };
  }, selector);
}

/** Every wire's committed path, beside the card boxes it claims to join. */
async function wireGeometry(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector("[data-wires]") as SVGElement | null;
    if (svg === null) return [];
    const origin = svg.getBoundingClientRect();
    const box = (id: string) => {
      const card = document.querySelector(`[data-story-id="${id}"]`) as HTMLElement | null;
      if (card === null) return null;
      const rect = card.getBoundingClientRect();
      return {
        left: rect.left - origin.left,
        right: rect.right - origin.left,
        middle: rect.top + rect.height / 2 - origin.top,
      };
    };
    return Array.from(document.querySelectorAll("[data-wire]")).map((path) => ({
      edge: `${path.getAttribute("data-edge-kind")}:${path.getAttribute("data-edge-source")}->${path.getAttribute("data-edge-target")}`,
      d: path.getAttribute("d") ?? "",
      source: box(path.getAttribute("data-edge-source") ?? ""),
      target: box(path.getAttribute("data-edge-target") ?? ""),
    }));
  });
}

/**
 * Every wire starts on its source's right edge and ends on its target's left,
 * at each card's vertical middle — measured *now*, against the boxes as they
 * are laid out at this instant.
 *
 * This is the assertion that makes T011 load-bearing. A wire measured before
 * the track collapsed and never re-measured keeps the geometry of a layout
 * that no longer exists, and no law FR-014 committed can see it: a stale path
 * is inside the stage, inside the viewport, and overlaps no text.
 */
function expectWiresFollowCards(
  wires: Awaited<ReturnType<typeof wireGeometry>>,
  where: string,
): void {
  for (const wire of wires) {
    const start = wire.d.match(/^M(-?[\d.]+) (-?[\d.]+)/);
    const end = wire.d.match(/(-?[\d.]+) (-?[\d.]+)$/);
    expect(start, `${where}: ${wire.edge} starts with a move`).not.toBeNull();
    expect(end, `${where}: ${wire.edge} ends at a point`).not.toBeNull();
    expect(wire.source, `${where}: ${wire.edge} has a source card`).not.toBeNull();
    expect(wire.target, `${where}: ${wire.edge} has a target card`).not.toBeNull();
    expect(Number(start![1]), `${where}: ${wire.edge} leaves its source`).toBeCloseTo(
      wire.source!.right,
      0,
    );
    expect(Number(start![2]), `${where}: ${wire.edge} leaves at the middle`).toBeCloseTo(
      wire.source!.middle,
      0,
    );
    expect(Number(end![1]), `${where}: ${wire.edge} reaches its target`).toBeCloseTo(
      wire.target!.left,
      0,
    );
    expect(Number(end![2]), `${where}: ${wire.edge} arrives at the middle`).toBeCloseTo(
      wire.target!.middle,
      0,
    );
  }
}

test.describe("the stage takes the room the pane is not using (FR-004, FR-007, FR-008)", () => {
  test("every spec, three widths, both themes: no stage clips its graph", async ({
    page,
    request,
  }) => {
    const rail = await stageRail(request);
    // FR-007 asks for the sweep over a real floor. A rail of one spec would
    // pass this test for the wrong reason, so the floor's size is asserted
    // before anything is measured on it.
    expect(rail.length, "the fixture floor carries at least five specs").toBeGreaterThanOrEqual(5);

    let visited = 0;
    let staged = 0;

    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const width of US2_WIDTHS) {
        await page.setViewportSize({ width, height: 1000 });
        for (const entry of rail) {
          await page.goto(`/showfloor/${entry.spec_dir}`);
          await page.waitForSelector("[data-metrics]");
          const where = `${entry.spec_dir} at ${width} in ${scheme}`;
          visited++;

          const metrics = await roomMetrics(page);

          // The room opens on no story and this sweep never picks one, so
          // every measurement below is of the released state (FR-004).
          expect(metrics.selection, `${where}: nothing is selected`).toBe("none");
          expect(metrics.tracks, `${where}: the room resolved three tracks`).toHaveLength(3);
          expect(metrics.tracks[2], `${where}: the detail track computed to 0`).toBe(0);
          expect(metrics.detailWidth, `${where}: the released pane paints nothing`).toBe(0);

          if (metrics.scroll === null) {
            // "an epic whose stage document has no nodes renders as its
            // degraded notice with **no stage canvas at all**" (005 FR-013).
            // There is no scroller, because there is no graph to clip.
            expect(entry.stories.length, `${where} declares no story to stage`).toBe(0);
          } else {
            staged++;
            // SC-003, the whole point: 235px at 1280 and 27px at 1600 and
            // 2560 before this story, on every spec on the floor. Now none.
            expect(
              metrics.scroll.scrollWidth - metrics.scroll.clientWidth,
              `${where}: the stage clips its graph`,
            ).toBe(0);
          }

          // FR-008: the same laws, the same floors 005 committed. The width
          // the stage gained does not buy an escape, a runaway, a collision —
          // or, since 009 US2, a box painted over text it does not own.
          const report = await measureLaws(page);
          expect(report.swept, `${where} rendered something`).toBeGreaterThan(20);
          expect(report.leaves, `${where} has text leaves`).toBeGreaterThan(10);
          expect(report.painters, `${where} paints backgrounds`).toBeGreaterThan(5);
          expect(report.escaped, `${where}: a stage child escaped its stage`).toEqual([]);
          expect(report.past, `${where}: text past the viewport`).toEqual([]);
          expect(report.overlapping, `${where}: two text leaves overlap`).toEqual([]);
          expect(report.occluded, `${where}: a box paints over text it does not own`).toEqual([]);
          expect(report.documentScrollWidth, where).toBeLessThanOrEqual(report.viewport + 0.5);
          expect(report.roomScrollsSideways, `${where}: the room scrolls sideways`).toBe(false);
        }
      }
    }

    // A sweep that silently visited nothing passes for the wrong reason, so
    // what it covered is asserted too: every spec, every width, both themes,
    // and a real majority of them carrying a graph.
    expect(visited).toBe(rail.length * US2_WIDTHS.length * SCHEMES.length);
    expect(staged, "specs with a graph were measured").toBeGreaterThanOrEqual(
      5 * US2_WIDTHS.length * SCHEMES.length,
    );
  });

  test("picking a story restores the 26rem track, and the wires follow the cards", async ({
    page,
    request,
  }) => {
    const rail = await stageRail(request);
    const edgeCount = (entry: StageEntry) =>
      entry.stories.reduce(
        (total, story) => total + story.depends_on.length + story.depends_on_merged.length,
        0,
      );
    const wired = rail
      .filter((entry) => edgeCount(entry) > 0)
      .sort((a, b) => edgeCount(b) - edgeCount(a))[0];
    expect(wired, "some spec on this floor declares dependencies").toBeDefined();
    const story = wired.stories.find((candidate) => candidate.id !== null)!;

    for (const width of US2_WIDTHS) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/showfloor/${wired.spec_dir}`);
      await page.waitForSelector("[data-stage-canvas]");
      const where = `${wired.spec_dir} at ${width}`;

      const before = await roomMetrics(page);
      expect(before.selection, `${where}: opens on no story`).toBe("none");
      expect(before.tracks[2], `${where}: the track is collapsed`).toBe(0);
      // The band beneath the stage carries this spec's goal (009 FR-012), and
      // the room's own explainer is not mounted beside it.
      await expect(
        page.locator("[data-spec-goal]"),
        `${where}: the spec's goal is beneath the stage`,
      ).toHaveCount(wired.intent === "" ? 0 : 1);
      await expect(page.locator("[data-detail-empty]")).toHaveCount(0);
      await expect(page.locator("[data-detail-title]")).toHaveCount(0);

      const wiresBefore = await wireGeometry(page);
      expect(wiresBefore.length, `${where}: the graph is wired`).toBeGreaterThan(0);
      expectWiresFollowCards(wiresBefore, `${where}, released`);

      // The pick. Nothing remounts: the grid element is the same element
      // before and after, and only its state hook changed (FR-004).
      const identity = await page.evaluate(() => {
        const cols = document.querySelector("[data-showfloor-cols]")!;
        (cols as HTMLElement & { __mark?: number }).__mark = 1;
        const detail = document.querySelector("[data-detail]")!;
        (detail as HTMLElement & { __mark?: number }).__mark = 1;
        return true;
      });
      expect(identity).toBe(true);

      await page.locator(`[data-node-card][data-story-id="${story.id}"]`).click();
      await page.waitForSelector("[data-detail-title]");

      const survived = await page.evaluate(() => {
        const cols = document.querySelector("[data-showfloor-cols]") as HTMLElement & {
          __mark?: number;
        };
        const detail = document.querySelector("[data-detail]") as HTMLElement & {
          __mark?: number;
        };
        return { cols: cols.__mark === 1, detail: detail.__mark === 1 };
      });
      expect(survived.cols, `${where}: the grid was not remounted`).toBe(true);
      expect(survived.detail, `${where}: the live region was not remounted`).toBe(true);

      const after = await roomMetrics(page);

      // FR-006: the track returns at `26rem`, read through the room's own root
      // font size rather than assumed to be 416px.
      expect(after.selection, `${where}: the grid says a story is selected`).toBe("story");
      expect(after.tracks[2], `${where}: the track returned at 26rem`).toBeCloseTo(
        26 * after.root,
        1,
      );
      expect(after.detailWidth, `${where}: the pane paints its track`).toBeCloseTo(
        26 * after.root,
        1,
      );

      // FR-004, the other half: the stage track is wider by exactly what the
      // pane released, at this width and at every other.
      expect(
        before.tracks[1] - after.tracks[1],
        `${where}: the stage took the width the pane released`,
      ).toBeCloseTo(26 * after.root, 1);
      expect(
        before.scroll!.clientWidth - after.scroll!.clientWidth,
        `${where}: the scroller gained the released width`,
      ).toBeCloseTo(26 * after.root, 0);

      // The pane is telling the story — and the band beneath the stage did not
      // empty behind it, which is the layout jump D-019 closes. 008's
      // assertion here was that the room's explainer left; since D-019 it was
      // never there, and what must *not* leave is the goal (009 FR-012).
      await expect(page.locator("[data-detail-empty]")).toHaveCount(0);
      await expect(
        page.locator("[data-spec-goal]"),
        `${where}: the band survived the pick`,
      ).toHaveCount(wired.intent === "" ? 0 : 1);
      await expect(page.locator("[data-detail-title]")).toHaveText(story.title);

      // And the wires still join the cards they name, measured against the
      // boxes as the restored pane leaves them.
      //
      // What this does *not* assert is that the path data changed, because on
      // this room it does not, and measuring it here is what showed why: the
      // wires' coordinate space is the canvas's own (plan D1), the cards are
      // fixed-width and left-aligned inside it, and restoring the track moves
      // the whole canvas — measured at 1280, the metrics grid gains a row and
      // the SVG origin drops 4.95px while every card keeps its offset from it
      // to the fraction. A translation leaves relative geometry alone. So this
      // is the standing guard for a *future* relayout that does move a card,
      // and the case that can actually go red on a missing re-measure is
      // `tests/unit/Wires.test.tsx` — a canvas whose boxes really move between
      // two renders, which jsdom will let a test say and a browser will not.
      const wiresAfter = await wireGeometry(page);
      expect(wiresAfter.map((wire) => wire.edge)).toEqual(wiresBefore.map((wire) => wire.edge));
      expectWiresFollowCards(wiresAfter, `${where}, selected`);
    }
  });

  /**
   * **Superseded by D-019, in the same band.** 008 US2 asserted here that the
   * room's two sentences sat beneath the stage for every staged spec at every
   * width. D-019 gave that band to the spec's own goal — the goal is true of
   * the graph whether or not a story is picked, where a generic description of
   * the room stops being interesting after the first visit — and retired the
   * explainer to the case where no spec is selected at all.
   *
   * So the *measurement* below is 008's, unchanged and in full: visible rather
   * than merely present, a non-zero box, never truncated, beneath the graph,
   * above the legend, inside the stage column and out of the track it gave up.
   * What changed is which element it is pointed at, and that the sweep now
   * asserts the empty case too — a spec whose document carries no goal must
   * render no band, not an empty one (009 FR-011).
   */
  test("the spec's own goal sits beneath the stage, verbatim and visible (009 FR-010 … FR-012)", async ({
    page,
    request,
  }) => {
    const rail = await stageRail(request);
    const staged = rail.filter((entry) => entry.stories.length > 0);
    expect(staged.length).toBeGreaterThanOrEqual(5);
    // SC-005's second half — "no spec's goal is missing from the room" — is
    // only a claim if some spec on this floor has one to miss.
    expect(
      staged.filter((entry) => entry.intent !== "").length,
      "some staged spec on this floor states a goal",
    ).toBeGreaterThan(0);

    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const width of US2_WIDTHS) {
        await page.setViewportSize({ width, height: 1000 });
        for (const entry of staged) {
          await page.goto(`/showfloor/${entry.spec_dir}`);
          await page.waitForSelector("[data-stage-canvas]");
          const where = `${entry.spec_dir} at ${width} in ${scheme}`;

          const read = await bandMetrics(page, "[data-spec-goal]");

          // FR-011: a spec that states no goal renders no band at all. Not an
          // empty bordered strip, and not the room's explainer standing in for
          // one — furniture in the place of an answer is the same defect as a
          // ladder defaulting to its first stop.
          if (entry.intent === "") {
            expect(read, `${where}: no goal stated, so no band`).toBeNull();
            await expect(page.locator("[data-detail-empty]")).toHaveCount(0);
            continue;
          }

          expect(read, `${where}: the spec's goal is in the room`).not.toBeNull();

          // The document's own paragraph, verbatim — not a paraphrase, not a
          // truncation, and not a second read of the spec file by the browser.
          expect(read!.text, `${where}: the document's own words`).toBe(entry.intent);

          // Visible, not merely present. A `display: none` would satisfy a
          // `toHaveCount(1)` and would be the pane withholding what it read
          // (constitution III).
          expect(read!.display, `${where}: not display:none`).not.toBe("none");
          expect(read!.visibility, `${where}: computed visible`).toBe("visible");
          expect(Number(read!.opacity), `${where}: opaque`).toBeGreaterThan(0);
          expect(read!.width, `${where}: a non-zero box`).toBeGreaterThan(0);
          expect(read!.height, `${where}: a non-zero box`).toBeGreaterThan(0);

          // And never truncated: no clipped overflow, no ellipsis.
          expect(read!.clippedWide, `${where}: not clipped sideways`).toBe(false);
          expect(read!.clippedTall, `${where}: not clipped vertically`).toBe(false);
          expect(read!.textOverflow, `${where}: no ellipsis`).toBe("clip");

          // Beneath the stage, above the legend row — and inside the stage
          // column rather than in the track the pane gave up (FR-012).
          expect(read!.top, `${where}: beneath the graph`).toBeGreaterThanOrEqual(
            read!.graphBottom - 0.5,
          );
          expect(read!.bottom, `${where}: above the legend row`).toBeLessThanOrEqual(
            read!.legendTop + 0.5,
          );
          expect(read!.insideStage, `${where}: inside the stage column`).toBe(true);
          expect(read!.insidePane, `${where}: not in the collapsed track`).toBe(false);

          // The two explanations never stack (plan D7).
          await expect(
            page.locator("[data-detail-empty]"),
            `${where}: the room's explainer is not mounted beside the goal`,
          ).toHaveCount(0);
        }
      }
    }
  });

  /**
   * FR-012's own scenario, and SC-005's first half: the band reads the *same*
   * before and after a story is picked.
   *
   * This is the committed evidence for why D-019 changed the band's occupant at
   * all. Under D-016 this test could not have been written — the band emptied
   * on the click, and "identical text across both selection states" had no
   * second state to compare. Both themes, because the assertion is about the
   * words and a theme that dropped them would be the same defect wearing
   * different clothes.
   */
  test("the band reads identically with and without a story selected (009 FR-012, SC-005)", async ({
    page,
    request,
  }) => {
    const rail = await stageRail(request);
    const speaking = rail.filter((entry) => entry.intent !== "" && entry.stories.length > 0);
    expect(speaking.length, "a staged spec on this floor states a goal").toBeGreaterThan(0);

    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const entry of speaking) {
        const story = entry.stories.find((candidate) => candidate.id !== null);
        if (story === undefined) continue;
        const where = `${entry.spec_dir} in ${scheme}`;

        await page.goto(`/showfloor/${entry.spec_dir}`);
        await page.waitForSelector("[data-stage-canvas]");

        const unselected = await bandMetrics(page, "[data-spec-goal]");
        expect(unselected, `${where}: a band with nothing selected`).not.toBeNull();
        expect(unselected!.text, `${where}: the document's own words`).toBe(entry.intent);
        expect(unselected!.selection, `${where}: nothing is selected yet`).toBe("none");

        await page.locator(`[data-node-card][data-story-id="${story.id}"]`).click();
        await page.waitForSelector("[data-detail-title]");

        const selected = await bandMetrics(page, "[data-spec-goal]");
        expect(selected, `${where}: the band survived the pick`).not.toBeNull();
        expect(selected!.selection, `${where}: a story is selected now`).toBe("story");

        // Identical text, in both selection states — the whole of FR-012.
        expect(selected!.text, `${where}: identical text`).toBe(unselected!.text);

        // Still a visible box, still beneath the graph and above the legend,
        // in the layout the restored `26rem` track leaves behind.
        expect(selected!.visibility, `${where}: still visible`).toBe("visible");
        expect(selected!.height, `${where}: still a box`).toBeGreaterThan(0);
        expect(selected!.clippedTall, `${where}: still not clipped`).toBe(false);
        expect(selected!.top, `${where}: still beneath the graph`).toBeGreaterThanOrEqual(
          selected!.graphBottom - 0.5,
        );
        expect(selected!.bottom, `${where}: still above the legend`).toBeLessThanOrEqual(
          selected!.legendTop + 0.5,
        );
        expect(selected!.insideStage, `${where}: still in the stage column`).toBe(true);
      }
    }
  });

  /**
   * FR-013, and FR-011 against a document this floor does not happen to serve.
   *
   * Both cases are *made* rather than waited for: the room is handed a document
   * with an empty rail, and one whose single entry states no goal. The floor's
   * own corpus cannot be relied on to carry either — a spec gaining a
   * `## Context` heading is an ordinary edit, and a test that went red for it
   * would be pinning this morning's corpus (008 US1). The route double serves
   * the *document contract*, which is what these two clauses are about.
   */
  test("the band belongs to the room's explainer when no spec is selected (009 FR-013)", async ({
    page,
  }) => {
    await page.route("**/api/showfloor", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          reference_instant: null,
          specs_root: "specs",
          rail: [],
          degraded: [],
        }),
      }),
    );

    await page.goto("/showfloor");
    await page.waitForSelector("[data-empty-floor]");

    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });

      // The room's own two sentences, verbatim, in the band — this is the one
      // place they are still said, and they are said in full.
      const read = await bandMetrics(page, "[data-detail-empty]");
      expect(read, `${scheme}: the room explains itself`).not.toBeNull();
      expect(read!.text, `${scheme}: the two sentences, verbatim`).toBe(ROOM_EXPLAINED);
      expect(read!.text.split(". "), `${scheme}: two sentences`).toHaveLength(2);
      expect(read!.display, `${scheme}: not display:none`).not.toBe("none");
      expect(read!.visibility, `${scheme}: computed visible`).toBe("visible");
      expect(read!.height, `${scheme}: a non-zero box`).toBeGreaterThan(0);
      expect(read!.clippedTall, `${scheme}: not clipped`).toBe(false);
      expect(read!.insideStage, `${scheme}: inside the stage column`).toBe(true);
      expect(read!.insidePane, `${scheme}: not in the collapsed track`).toBe(false);
      expect(read!.bottom, `${scheme}: above the legend row`).toBeLessThanOrEqual(
        read!.legendTop + 0.5,
      );

      // And no spec's goal beside it, because there is no spec.
      await expect(page.locator("[data-spec-goal]")).toHaveCount(0);
    }
  });

  test("a spec that states no goal renders no band, not an empty one (009 FR-011)", async ({
    page,
    request,
  }) => {
    const rail = await stageRail(request);
    const staged = rail.find((entry) => entry.stories.length > 0)!;
    expect(staged, "this floor stages a spec").toBeDefined();

    await page.route("**/api/showfloor", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          reference_instant: null,
          specs_root: "specs",
          rail: [{ ...staged, intent: "" }],
          degraded: [],
        }),
      }),
    );

    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`/showfloor/${staged.spec_dir}`);
      await page.waitForSelector("[data-stage-canvas]");

      // Nothing at all between the graph and the legend: no band with the
      // spec's goal, no band with the room's explainer standing in for it, and
      // no empty bordered strip left behind by either.
      await expect(page.locator("[data-spec-goal]")).toHaveCount(0);
      await expect(page.locator("[data-detail-empty]")).toHaveCount(0);

      // The room around it is untouched — the graph is drawn and the legend is
      // under it — so what is absent is the band and not the stage.
      await expect(page.locator("[data-stage-canvas]")).toHaveCount(1);
      await expect(page.locator("[data-legend]")).toHaveCount(1);

      // And the legend really does follow the graph directly, with no gap left
      // holding the place of a paragraph that was not rendered.
      const gap = await page.evaluate(() => {
        const scroller = document.querySelector("[data-stage-scroll]");
        const legend = document.querySelector("[data-legend]")!;
        const graphBottom =
          scroller === null
            ? legend.getBoundingClientRect().top
            : scroller.getBoundingClientRect().bottom;
        return legend.getBoundingClientRect().top - graphBottom;
      });
      expect(gap, `${scheme}: no band-sized hole under the graph`).toBeLessThan(40);
    }
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   008 US3 — the scroll wears the room's clothes (FR-009 … FR-011).

   US2 made the stage wide enough that no fixture graph clips at 1280, 1600 or
   2560 with nothing picked. A scroller still exists, and that is exactly why
   this story is not moot: picking a story hands `26rem` back to the pane, and
   a graph 797px wide inside a 562px stage scrolls again. So both cases below
   are *made* to scroll and then asserted to be scrolling, rather than hoped
   to be.

   Two halves, because the browser has two mechanisms and D-016 clause (c)
   binds both:

   * **the computed half** (FR-009) — `scrollbar-width` and `scrollbar-color`
     as Chromium resolves them, in both themes, with `--rule` read out of the
     live theme and never compared against a colour typed into this file. That
     last part is what makes the assertion a *token* assertion: the same two
     lines of CSS have to produce two different measured colours.
   * **the authored half** (FR-010) — the `::-webkit-scrollbar` rules read as
     text out of the stylesheet the page actually loaded. They are asserted as
     text and not by measuring a rendered scrollbar because headless Chromium
     paints an overlay scrollbar of zero layout height where the operator's
     browser paints a classic widget (plan § Risks); a gate that measured the
     box would disagree with the machine the operator is looking at, and would
     agree with a stylesheet that said nothing at all.

   FR-011 is the third test: the room that does *not* scroll must be
   unchanged, and a `scrollbar-gutter` reservation — the obvious shortcut for
   "keep the layout from jumping" — must fail it.
   ───────────────────────────────────────────────────────────────────────── */

/** The widest graph on the fixture floor needs 797px; 1000 gives it ~716. */
const US3_NARROW = 1000;

/**
 * Resolve a token the way the browser resolves it *in the theme now emulated*.
 *
 * A probe element takes `color: var(--token)` and hands back the computed
 * `rgb(…)`, which is the same serialisation `scrollbar-color` computes to. No
 * colour is typed into this file, so a token swap in `global.css` moves the
 * assertion with it instead of breaking it (FR-009, plan D4).
 */
async function resolvedColour(page: Page, value: string): Promise<string> {
  return page.evaluate((declared) => {
    const probe = document.createElement("span");
    probe.style.color = declared;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, value);
}

interface ScrollerStyle {
  scrollbarWidth: string;
  scrollbarColor: string;
  scrollbarGutter: string;
  clientWidth: number;
  scrollWidth: number;
  offsetWidth: number;
  borders: number;
  canvasWidth: number;
  stageTrack: number;
  stagePadding: number;
  gutters: string[];
}

/** The stage scroller, measured and read, in one layout pass. */
async function scrollerStyle(page: Page): Promise<ScrollerStyle> {
  return page.evaluate(() => {
    const scroller = document.querySelector("[data-stage-scroll]") as HTMLElement;
    const canvas = document.querySelector("[data-stage-canvas]") as HTMLElement;
    const stage = document.querySelector("[data-stage]") as HTMLElement;
    const cols = document.querySelector("[data-showfloor-cols]") as HTMLElement;
    const style = getComputedStyle(scroller);
    const stageStyle = getComputedStyle(stage);
    return {
      scrollbarWidth: style.scrollbarWidth,
      scrollbarColor: style.scrollbarColor,
      scrollbarGutter: style.scrollbarGutter,
      clientWidth: scroller.clientWidth,
      scrollWidth: scroller.scrollWidth,
      offsetWidth: scroller.offsetWidth,
      borders: parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth),
      canvasWidth: canvas.getBoundingClientRect().width,
      stageTrack: parseFloat(getComputedStyle(cols).gridTemplateColumns.split(/\s+/)[1]),
      stagePadding: parseFloat(stageStyle.paddingLeft) + parseFloat(stageStyle.paddingRight),
      // Every box between the grid track and the graph, so a gutter reserved
      // anywhere on that chain is caught and not only one reserved on the
      // scroller itself (FR-011).
      gutters: [cols, stage, scroller, canvas].map((el) => getComputedStyle(el).scrollbarGutter),
    };
  });
}

/** The built stylesheet the page actually loaded, as text. */
async function builtStylesheet(page: Page): Promise<string> {
  const hrefs = await page.evaluate(() =>
    Array.from(document.styleSheets)
      .map((sheet) => sheet.href)
      .filter((href): href is string => href !== null),
  );
  expect(hrefs.length, "the page loads at least one stylesheet of its own").toBeGreaterThan(0);
  let text = "";
  for (const href of hrefs) {
    const response = await page.request.get(href);
    expect(response.ok(), `${href} is served`).toBe(true);
    text += `${await response.text()}\n`;
  }
  return text;
}

/**
 * A colour literal, in every spelling CSS offers.
 *
 * The named-colour arm is deliberately generous rather than the full 148-name
 * table: it carries the greys and the primaries a scrollbar is actually
 * mis-styled with. It is the *whitelist* below that carries the proof — every
 * value in the block must be a token, a length or `none` — and this is the
 * second lock on the same door.
 */
const COLOUR_LITERAL =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\b(?:white|black|gray|grey|silver|lightgray|lightgrey|darkgray|darkgrey|gainsboro|whitesmoke|red|green|blue|yellow|orange|purple|brown|pink|teal|navy|olive|maroon|aqua|fuchsia|lime|currentcolor)\b/i;

/** What a declaration in the scrollbar block is allowed to be worth. */
const TOKEN_OR_METRIC = /^(?:var\(--[a-z0-9-]+\)|none|0|-?[\d.]+(?:px|rem|em|%)?)$/;

test.describe("the scroll wears the room's clothes (FR-009, FR-010, FR-011)", () => {
  test("a scrolling stage computes thin, on --rule over a transparent trough, in both themes", async ({
    page,
    request,
  }) => {
    const rail = await stageRail(request);
    const staged = rail.filter((entry) => entry.stories.length > 0);
    expect(staged.length, "the fixture floor stages a graph").toBeGreaterThanOrEqual(5);

    // Every measured `--rule`, so the two themes can be proven to differ. If
    // both resolved to the same colour this test would pass on a hard-coded
    // literal, which is the failure D-016 clause (c) and plan D4 forbid.
    const rulePerScheme: Record<string, string> = {};
    let scrolled = 0;

    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });

      // Case one: a viewport narrower than the graph — the story's own
      // independent test. Case two: the full-width room with a story picked,
      // which is the case US2 left behind and this story's priority names.
      const cases = [
        { width: US3_NARROW, pick: false },
        { width: 1280, pick: true },
      ] as const;

      for (const shape of cases) {
        await page.setViewportSize({ width: shape.width, height: 1000 });

        for (const entry of staged) {
          await page.goto(`/showfloor/${entry.spec_dir}`);
          await page.waitForSelector("[data-stage-canvas]");
          const where = `${entry.spec_dir} at ${shape.width} in ${scheme}${shape.pick ? ", picked" : ""}`;

          if (shape.pick) {
            const story = entry.stories.find((candidate) => candidate.id !== null);
            if (story === undefined) continue;
            await page.locator(`[data-node-card][data-story-id="${story.id}"]`).click();
            await page.waitForSelector("[data-detail-title]");
          }

          const read = await scrollerStyle(page);

          // Only a stage that is really scrolling is evidence for FR-009, so
          // the ones that fit are skipped here and are FR-011's subject
          // instead. This is the Given of US3-S1, asserted rather than assumed.
          if (read.scrollWidth <= read.clientWidth) continue;
          scrolled++;

          const rule = await resolvedColour(page, "var(--rule)");
          const clear = await resolvedColour(page, "transparent");
          rulePerScheme[scheme] = rule;

          expect(read.scrollbarWidth, `${where}: the scroller is thin`).toBe("thin");
          expect(read.scrollbarColor, `${where}: thumb on --rule, trough transparent`).toBe(
            `${rule} ${clear}`,
          );
          // And the trough really is nothing, not a very pale colour.
          expect(clear, `${where}: the trough is transparent`).toBe("rgba(0, 0, 0, 0)");
        }
      }
    }

    // The sweep visited scrolling stages in both themes, not one of them.
    expect(scrolled, "scrolling stages were measured").toBeGreaterThanOrEqual(
      2 * SCHEMES.length,
    );
    expect(Object.keys(rulePerScheme).sort()).toEqual(["dark", "light"]);
    expect(
      rulePerScheme.dark,
      "the two themes resolve --rule to two different colours",
    ).not.toBe(rulePerScheme.light);
  });

  test("the ::-webkit-scrollbar rules are stepper-free, hover-brightened, and all token (FR-010)", async ({
    page,
  }) => {
    await page.goto("/showfloor");
    await page.waitForSelector("[data-stage-canvas]");

    const css = await builtStylesheet(page);

    // Every rule the stage scroller declares against a WebKit scrollbar part,
    // read out of the shipped bytes.
    const rules = Array.from(
      css.matchAll(/([^{}]*::-webkit-scrollbar[^{}]*)\{([^{}]*)\}/g),
    ).map((match) => ({ selector: match[1].trim(), body: match[2].trim() }));

    expect(rules.length, "the scroller declares WebKit scrollbar rules").toBeGreaterThanOrEqual(4);
    for (const rule of rules) {
      expect(rule.selector, "every scrollbar rule is scoped to the stage scroller").toContain(
        ".dag-scroll",
      );
    }

    // One set of rules, not two. A second theme block would repeat a
    // selector — the failure mode DESIGN.md's three-block theme pattern and
    // plan D4 both exist to prevent, and the reason every colour below is a
    // token in the first place.
    const selectors = rules.map((rule) => rule.selector);
    expect(new Set(selectors).size, "no scrollbar selector is declared twice").toBe(
      selectors.length,
    );
    expect(css.match(/@media[^{]*\{[^{]*::-webkit-scrollbar/), "no themed second block").toBeNull();

    // No stepper buttons.
    const button = rules.find((rule) => /::-webkit-scrollbar-button/.test(rule.selector));
    expect(button, "the stepper buttons are declared away").toBeDefined();
    expect(button!.body.replace(/\s+/g, ""), "the buttons are display:none").toContain(
      "display:none",
    );
    expect(button!.body.replace(/\s+/g, ""), "and occupy no width").toMatch(/width:0(?:px)?[;}]?/);

    // A thumb on `--rule` that brightens on hover — a different token, not the
    // same one, and not a literal.
    const thumb = rules.find((rule) => /::-webkit-scrollbar-thumb$/.test(rule.selector));
    const hover = rules.find((rule) => /::-webkit-scrollbar-thumb:hover$/.test(rule.selector));
    expect(thumb, "the thumb is styled").toBeDefined();
    expect(hover, "the thumb has a hover state").toBeDefined();
    expect(thumb!.body.replace(/\s+/g, ""), "the thumb is --rule").toContain(
      "background:var(--rule)",
    );
    expect(hover!.body, "hover reaches for a token").toMatch(/background:\s*var\(--[a-z-]+\)/);
    expect(hover!.body, "hover is not the resting colour").not.toContain("var(--rule)");

    // A transparent trough: the bar and its track paint nothing of their own.
    for (const part of ["::-webkit-scrollbar", "::-webkit-scrollbar-track"]) {
      const rule = rules.find((candidate) => candidate.selector.endsWith(part));
      expect(rule, `${part} is declared`).toBeDefined();
      expect(rule!.body.replace(/\s+/g, ""), `${part} paints nothing`).toContain(
        "background:none",
      );
    }

    // And the whole point: not one colour in any of these rules is a literal.
    // Both locks — nothing that looks like a colour, and every value a token,
    // a length or `none`.
    for (const rule of rules) {
      expect(rule.body, `${rule.selector} spells a colour literal`).not.toMatch(COLOUR_LITERAL);
      for (const declaration of rule.body.split(";").filter((part) => part.trim() !== "")) {
        const value = declaration.slice(declaration.indexOf(":") + 1).trim();
        expect(value, `${rule.selector}: "${declaration.trim()}" is not a token or a metric`).toMatch(
          TOKEN_OR_METRIC,
        );
      }
    }
  });

  test("a graph that fits gains no horizontal chrome (FR-011)", async ({ page, request }) => {
    const rail = await stageRail(request);
    const staged = rail.filter((entry) => entry.stories.length > 0);
    expect(staged.length).toBeGreaterThanOrEqual(5);

    // A gutter reservation is invisible to a measurement in headless
    // Chromium, whose scrollbars are overlays: `scrollbar-gutter: stable`
    // reserves nothing where the scrollbar takes no layout. The stylesheet is
    // therefore asserted too, and it is the arm that would actually go red on
    // the shortcut, on every machine.
    await page.goto("/showfloor");
    await page.waitForSelector("[data-stage-canvas]");
    const css = await builtStylesheet(page);
    expect(css, "no scrollbar gutter is reserved anywhere in the pane").not.toContain(
      "scrollbar-gutter",
    );

    let fitted = 0;

    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const width of US2_WIDTHS) {
        await page.setViewportSize({ width, height: 1000 });
        for (const entry of staged) {
          await page.goto(`/showfloor/${entry.spec_dir}`);
          await page.waitForSelector("[data-stage-canvas]");
          const where = `${entry.spec_dir} at ${width} in ${scheme}`;

          const read = await scrollerStyle(page);

          // US2's own measurement, re-run: at these three widths, with nothing
          // picked, no stage clips its graph. This story may not move it.
          expect(read.scrollWidth, `${where}: the stage still fits its graph`).toBe(
            read.clientWidth,
          );
          fitted++;

          // The box: the content box is the border box less the borders and
          // nothing else. Chrome between them is exactly what FR-011 refuses.
          expect(read.offsetWidth - read.borders, `${where}: no chrome inside the border`).toBe(
            read.clientWidth,
          );

          // And the graph's box is unchanged from US2's: the scroller takes
          // the whole stage track less the stage's own padding, and the canvas
          // fills the scroller. A reserved gutter shortens the first of these.
          expect(
            read.clientWidth,
            `${where}: the scroller is the stage track less its padding`,
          ).toBeCloseTo(read.stageTrack - read.stagePadding, 0);
          expect(read.canvasWidth, `${where}: the graph fills its scroller`).toBeCloseTo(
            read.clientWidth,
            0,
          );

          // Nothing on the chain from the grid track to the graph reserves one.
          expect(read.gutters, `${where}: a gutter was reserved`).toEqual(
            read.gutters.map(() => "auto"),
          );
        }
      }
    }

    expect(fitted, "fitting stages were measured at every width, in both themes").toBe(
      staged.length * US2_WIDTHS.length * SCHEMES.length,
    );
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   013 US3 — the gate run is honest at every width (FR-009, FR-010).

   US2 drew the section; this is where it is measured. Two things had to be
   settled before a single law could be applied to it, and both are recorded
   here because either one, got wrong, is a sweep that passes over nothing.

   ── 1. the section has to be in the viewport to be measured at all ───────

   `[data-showfloor-root]` is `position: fixed; inset: 0; overflow: auto`, so it
   is a clipping ancestor of everything in the room — and `support/laws.ts`
   applies every clipping ancestor before it compares a box (005 US4: "two runs
   of text that cannot both be seen have not collided"). A leaf below the fold
   clips away to nothing and is dropped from all four laws. Law (d) is stricter
   still: it asks the browser for its own hit stack through `elementsFromPoint`,
   which answers nothing at all for a point outside the viewport.

   The gate run is the last section of the pane before the `implements` row,
   beneath a title, six ladder stops and a facts grid. At the `height: 1000`
   this file sweeps at, it is off the bottom of the screen — so the two sweeps
   above ("the four layout laws", "the laws hold with the pane full") have never
   measured it. Not because they are wrong: it was not on the screen when they
   looked.

   **And the way to fix that is not to scroll.** Scrolling the room and
   re-measuring turns law (d) red on `header.mast`, which is `position: sticky;
   top: 0` over an opaque `--surface` — a sticky bar painting over what scrolls
   beneath it is what sticky *is*, and it is not D-018's defect of a box
   standing on readable text at rest. The only way to sweep a scrolled room
   would be to exempt that painter, and a law with an exemption written into it
   to make a new test pass is worth less than the test is worth. So the room is
   given the height its content needs instead, the widths and themes stay
   exactly the ones the suite sweeps, and every pass asserts the section is
   **wholly inside the viewport** — which is the assertion that the laws really
   did see all of it rather than a clipped top edge of it.

   ── 2. the fixture floor cannot fill the section ─────────────────────────

   `FixtureReader.node_history` looks for `verification/<epic_id>/<node_id>.json`
   and no such document is recorded (`fixtures/README.md`: the evidence store is
   written on the operator's host by a real build, and constitution V forbids
   inventing one). So on this floor the section renders in its degraded form for
   every story. That is a real rendering, it carries the longest unbroken run of
   text the pane ever has to wrap — an absolute store path with no space in it —
   and it is swept first, with the section's presence asserted so the pass
   cannot be a vacuous one.

   The *timeline* form — bands, gate rows, a long command, a fold and the `<pre>`
   behind it — reaches no width unless it is handed to the room. It is handed to
   the room the way 009 FR-011 hands it a spec that states no goal: a route
   double over `/api/showfloor` serving the **document contract**, grafted onto
   this floor's own rail entry so everything around it is still the real room.
   The records are built through `tests/unit/support/showfloor-builder.ts`, so
   there is one definition of that contract in this repository and not a second
   one written here. Nothing *from the factory* is invented: what a `GateResult`
   holds is proved against ergane's own writer in `tests/test_evidence_section.py`,
   and the commands below are this repository's own four gates out of `ergane.yaml`.

   The values are deliberately the hardest shapes the contract allows — the
   longest command declared here, an unbroken absolute path inside a tail, a gate
   whose every column the store left null. A layout law is about geometry, and
   the geometry it has to survive is the extreme and not the typical.
   ───────────────────────────────────────────────────────────────────────── */


/**
 * Every width the suite sweeps, which is the union of its two sets.
 *
 * `WIDTHS` is 1280/1600 and `US2_WIDTHS` adds 2560 (D-016's 3008, capped by the
 * 96rem frame). US3-S1 says "every width … the suite already sweeps", so this
 * takes the union rather than either half: the wide end is where the pane's
 * track is roomiest, and the narrow end is where a fold and an unbroken command
 * are dangerous.
 */
const GATE_WIDTHS = US2_WIDTHS;

/**
 * A viewport tall enough to lay the whole pane out at once.
 *
 * Not a scroll and not a shortcut — see the block header. Height is not one of
 * the things US3-S1 sweeps, and giving the room more of it changes no
 * horizontal layout at all; what it changes is how much of the room the four
 * laws are able to see, which is the whole point. Every pass asserts the
 * section fits inside it, so a section that outgrew this number would fail
 * loudly rather than quietly go back to being half-measured.
 */
const TALL = 2400;

/** What the section is, where it sits, and how much of it is on the screen. */
interface SectionBox {
  present: boolean;
  visible: boolean;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  paneLeft: number;
  paneRight: number;
  viewportHeight: number;
  attempts: number;
  gates: number;
  bands: number;
  folds: number;
  openFolds: number;
}

async function sectionBox(page: Page): Promise<SectionBox> {
  return page.evaluate(() => {
    const section = document.querySelector("[data-gate-run]");
    const pane = document.querySelector("aside.detail");
    const folds = Array.from(document.querySelectorAll("[data-gate-tail]"))
      .map((pre) => pre.closest("details"))
      .filter((fold): fold is HTMLDetailsElement => fold !== null);
    const counts = {
      attempts: document.querySelectorAll("[data-gate-attempt]").length,
      gates: document.querySelectorAll("[data-gate]").length,
      bands: document.querySelectorAll("[data-gate-band]").length,
      folds: folds.length,
      openFolds: folds.filter((fold) => fold.open).length,
      viewportHeight: document.documentElement.clientHeight,
    };
    if (section === null || pane === null) {
      return {
        present: false,
        visible: false,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        paneLeft: 0,
        paneRight: 0,
        ...counts,
      };
    }

    const box = section.getBoundingClientRect();
    const paneBox = pane.getBoundingClientRect();
    return {
      present: true,
      visible: getComputedStyle(section).visibility === "visible",
      height: box.height,
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      paneLeft: paneBox.left,
      paneRight: paneBox.right,
      ...counts,
    };
  });
}

/**
 * The section is drawn, inside its pane, and wholly on the screen.
 *
 * The last clause is what makes the law report that follows it mean anything:
 * `support/laws.ts` drops whatever its clipping ancestors hide, so a section
 * hanging below the fold would be swept as if it were not there.
 */
async function sectionIsWhollyOnScreen(page: Page, where: string): Promise<SectionBox> {
  const box = await sectionBox(page);
  expect(box.present, `${where}: the section is on the page`).toBe(true);
  expect(box.visible, `${where}: the section is visible`).toBe(true);
  expect(box.height, `${where}: the section is a box`).toBeGreaterThan(0);
  expect(box.top, `${where}: the section's top is on the screen`).toBeGreaterThanOrEqual(-0.5);
  expect(box.bottom, `${where}: the section's foot is on the screen`).toBeLessThanOrEqual(
    box.viewportHeight + 0.5,
  );
  // Containment, applied to the section itself and not only to its leaves.
  expect(box.left, `${where}: the section starts inside the pane`).toBeGreaterThanOrEqual(
    box.paneLeft - 0.5,
  );
  expect(box.right, `${where}: the section ends inside the pane`).toBeLessThanOrEqual(
    box.paneRight + 0.5,
  );
  return box;
}

/** Open every fold in the section — the state a tail exists to be read in. */
async function openEveryFold(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const pre of Array.from(document.querySelectorAll("[data-gate-tail]"))) {
      const fold = pre.closest("details");
      if (fold !== null) fold.open = true;
    }
  });
}

/** The four laws over the room as it stands, with this file's own floors. */
async function lawsHold(page: Page, where: string): Promise<void> {
  const report = await measureLaws(page);

  expect(report.swept, `${where} rendered something`).toBeGreaterThan(20);
  expect(report.leaves, `${where} has text leaves`).toBeGreaterThan(10);
  expect(report.painters, `${where} paints backgrounds`).toBeGreaterThan(5);

  expect(report.escaped, `${where}: a stage child escaped its stage`).toEqual([]);
  expect(report.past, `${where}: text past the viewport`).toEqual([]);
  expect(report.overlapping, `${where}: two text leaves overlap`).toEqual([]);
  expect(report.occluded, `${where}: a box paints over text it does not own`).toEqual([]);
  expect(report.documentScrollWidth, where).toBeLessThanOrEqual(report.viewport + 0.5);
  expect(report.roomScrollsSideways, `${where}: the room scrolls sideways`).toBe(false);
}

test.describe("the gate run holds the four layout laws (013 FR-009)", () => {
  test("in the degraded form this floor really serves, every width, both themes", async ({
    page,
    request,
  }) => {
    const entry = await keyedEntry(request);
    let measured = 0;

    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const width of GATE_WIDTHS) {
        await page.setViewportSize({ width, height: TALL });
        await page.goto(`/showfloor/${entry.spec_dir}`);
        await page.waitForSelector("[data-node-card]");

        for (const story of entry.stories) {
          await page.locator(`[data-node-card][data-story-id="${story.id}"]`).click();
          await page.waitForSelector("[data-detail-title]");
          const where = `${entry.spec_dir}/${story.id} at ${width} in ${scheme}`;

          const box = await sectionIsWhollyOnScreen(page, where);
          // This floor's section is the degraded one, and the well's `detail`
          // is an absolute store path with no space in it — the longest
          // unbroken run of text the pane is ever handed. Asserted rather than
          // assumed, so a floor that started answering the read would make this
          // sweep say so instead of quietly measuring something else.
          expect(
            await page.locator("[data-gate-run-note]").count(),
            `${where}: the section degraded, as this floor's fixture set makes it`,
          ).toBe(1);
          expect(box.attempts, `${where}: a failed read draws no attempt`).toBe(0);

          await lawsHold(page, where);
          measured++;
        }
      }
    }

    expect(measured, "every story, every width, both themes").toBe(
      entry.stories.length * GATE_WIDTHS.length * SCHEMES.length,
    );
  });
});

/**
 * The four gates this repository declares, verbatim from `ergane.yaml`.
 *
 * The gate run is a drawing of commands, so the commands it is measured over
 * are the real ones rather than shapes chosen to be convenient. `ergane.yaml`
 * is the only place a gate is declared here (D-006), and these are its four.
 */
const DECLARED_GATES = [
  { name: "test", command: "uv run pytest -q" },
  { name: "typecheck", command: "npm --prefix web run typecheck" },
  { name: "unit", command: "npm --prefix web run test:unit" },
  { name: "smoke", command: "npm --prefix web run test:smoke" },
] as const;

/**
 * A failing smoke gate's tail, in the shape Playwright's list reporter writes.
 *
 * Its point is the absolute path on the last line: 120-odd characters with no
 * space in them, inside a `26rem` track. That is the run of text a `<pre>` is
 * most likely to push past the pane, and `overflow-wrap: anywhere` plus the
 * well's own `overflow: auto` are what stop it — which is a claim about
 * geometry, and therefore a claim only law (b) can settle.
 */
const FAILING_TAIL = [
  "  1) [showfloor] › tests/smoke/showfloor.spec.ts:1652:3 › the laws hold with the pane full",
  "",
  "    Error: expect(received).toEqual(expected) // deep equality",
  "",
  "    - Expected  - 0",
  "    + Received  + 1",
  "",
  "      Array [",
  '    +   "aside.detail over p.grsaid",',
  "      ]",
  "",
  "        at /home/ergane/state/runtime/worktrees/013-the-gates-show-their-work/us3/web/tests/smoke/showfloor.spec.ts:1673:74",
  "",
  "  1 failed",
].join("\n");

/**
 * Two recorded verifications of one story: a run that failed and the run after
 * it that passed.
 *
 * Every shape the section can draw is in here, because a law sweep is only
 * worth the geometry it is pointed at: a band of two the store recorded as
 * concurrent, two gates that had the host to themselves, one failing gate with
 * a fold, an interval to bracket, and the factory's own ladder sentence.
 */
function twoAttempts(): StoryEvidence {
  const failed = attemptOf({
    attempt: 1,
    verdict: "FAIL",
    started_at: "2026-08-26T01:04:11Z",
    finished_at: "2026-08-26T01:05:13Z",
    loop_summary: "attempt 1 of 3 · implementer · gates: test, typecheck, unit, smoke",
    gates: [
      // `concurrent_gates` is how many *other* executions were in flight, so a
      // pair that ran together each record 1 — and `gateBands` closes the band
      // at `count + 1`, which is what keeps this a band of two (013 D5).
      gateOf({ ...DECLARED_GATES[0], duration_s: 8.5, concurrent_gates: 1 }),
      gateOf({ ...DECLARED_GATES[1], duration_s: 3.2, concurrent_gates: 1 }),
      gateOf({ ...DECLARED_GATES[2], duration_s: 1.9, concurrent_gates: 0 }),
      gateOf({
        ...DECLARED_GATES[3],
        status: "GATE_FAILED",
        exit_code: 1,
        duration_s: 41.3,
        concurrent_gates: 0,
        output_tail: FAILING_TAIL,
      }),
    ],
  });

  const passed = attemptOf({
    attempt: 2,
    verdict: "PASS",
    started_at: "2026-08-26T01:29:02Z",
    finished_at: "2026-08-26T01:30:07Z",
    loop_summary: "attempt 2 of 3 with the debugger rung at 1",
    gates: DECLARED_GATES.map((gate) => gateOf({ ...gate, duration_s: 6.4 })),
  });

  return evidenceOf([failed, passed]);
}

/**
 * One attempt the store recorded almost nothing about.
 *
 * Every column the section can be handed as null, handed to it as null — so the
 * `unknown` italic is swept at every width too. `gateOf` cannot express this on
 * its own (it coalesces a missing status to `PASS`, because that is what the
 * assembler's own record looks like), so the nulls are written out on top of a
 * builder record rather than beside one: the keys stay the assembler's, and
 * what differs from a recorded gate is exactly what is listed here.
 */
function unrecordedAttempt(): StoryEvidence {
  const blank = {
    ...gateOf({ name: "placeholder" }),
    name: null,
    command: null,
    status: null,
    exit_code: null,
    duration_s: null,
    concurrent_gates: null,
    output_tail: null,
  };
  const attempt: AttemptRecord = {
    ...attemptOf({ attempt: 1 }),
    verdict: null,
    started_at: null,
    finished_at: null,
    loop_summary: null,
    gates: [blank],
  };
  return evidenceOf([attempt]);
}

/**
 * Serve this floor's own document with a gate run grafted onto one spec.
 *
 * 009 FR-011's route double, pointed at a different clause: the room is handed
 * the **document contract** for a case the fixture floor cannot serve, and
 * everything else on the page — the rail, the graph, the ladders, the facts —
 * is still the real floor's. Returns the entry that was dressed.
 */
async function serveGateRun(
  page: Page,
  request: { get: (url: string) => Promise<{ json: () => Promise<unknown> }> },
  evidenceFor: (index: number) => StoryEvidence,
): Promise<{ spec_dir: string; stories: Array<{ id: string | null }> }> {
  const response = await request.get("/api/showfloor");
  const document = (await response.json()) as {
    rail: Array<{ spec_dir: string; stories: Array<{ id: string | null }> }>;
  };
  const target = document.rail.find(
    (entry) => entry.stories.length > 1 && entry.stories.every((story) => story.id !== null),
  );
  expect(target, "this floor stages a spec whose stories the graph places").toBeDefined();

  const dressed = {
    ...document,
    rail: document.rail.map((entry) =>
      entry.spec_dir !== target!.spec_dir
        ? entry
        : {
            ...entry,
            stories: entry.stories.map((story, index) => ({
              ...story,
              evidence: evidenceFor(index),
            })),
          },
    ),
  };

  await page.route("**/api/showfloor", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(dressed) }),
  );
  return target!;
}

test.describe("the gate run holds the four layout laws, filled (013 FR-009)", () => {
  test("a drawn timeline stays in its box at every width, in both themes, folded and open", async ({
    page,
    request,
  }) => {
    // Alternating, so both shapes are swept at every width and in both themes
    // rather than one of them being measured once and taken on trust.
    const entry = await serveGateRun(page, request, (index) =>
      index % 2 === 0 ? twoAttempts() : unrecordedAttempt(),
    );

    let measured = 0;
    let foldsOpened = 0;

    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const width of GATE_WIDTHS) {
        await page.setViewportSize({ width, height: TALL });
        await page.goto(`/showfloor/${entry.spec_dir}`);
        await page.waitForSelector("[data-node-card]");

        for (const [index, story] of entry.stories.entries()) {
          await page.locator(`[data-node-card][data-story-id="${story.id}"]`).click();
          await page.waitForSelector("[data-detail-title]");
          const where = `${entry.spec_dir}/${story.id} at ${width} in ${scheme}`;
          const drawn = index % 2 === 0;

          // The timeline really is drawn — a law sweep over a section that
          // silently failed to render would pass for the wrong reason, and this
          // is the one document on the floor that carries attempts at all.
          const closed = await sectionIsWhollyOnScreen(page, where);
          expect(closed.attempts, `${where}: the attempts are drawn`).toBe(drawn ? 2 : 1);
          expect(closed.gates, `${where}: every gate is drawn`).toBe(drawn ? 8 : 1);
          expect(closed.bands, `${where}: the recorded bands are drawn`).toBe(drawn ? 7 : 1);
          expect(closed.folds, `${where}: one fold, for the one failing gate`).toBe(drawn ? 1 : 0);
          expect(closed.openFolds, `${where}: the fold is shut at rest`).toBe(0);
          expect(
            await page.locator("[data-gate-run-note]").count(),
            `${where}: a read that was made leaves no degraded well`,
          ).toBe(0);

          await lawsHold(page, `${where}, folded`);
          measured++;

          // And again with the tail open, which is the state it exists for: a
          // `<pre>` of raw process output, in a 26rem track, carrying a line
          // with no space in it. Closed, none of that is in the layout at all.
          if (!drawn) continue;
          await openEveryFold(page);
          const open = await sectionIsWhollyOnScreen(page, `${where}, open`);
          expect(open.openFolds, `${where}: the fold opened`).toBe(1);
          expect(
            open.height,
            `${where}: an opened fold puts the tail in the layout`,
          ).toBeGreaterThan(closed.height);
          expect(
            await page.locator("[data-gate-tail]").first().isVisible(),
            `${where}: the tail is readable once the fold is open`,
          ).toBe(true);

          await lawsHold(page, `${where}, open`);
          foldsOpened++;
        }
      }
    }

    const sweeps = GATE_WIDTHS.length * SCHEMES.length;
    const drawn = entry.stories.filter((_story, index) => index % 2 === 0).length;
    expect(measured, "every story, every width, both themes").toBe(
      entry.stories.length * sweeps,
    );
    expect(foldsOpened, "and every drawn timeline measured again with its tail open").toBe(
      drawn * sweeps,
    );
  });
});


/**
 * The mutation control for the two corrections 013 US3 made to `support/laws.ts`.
 *
 * Both are the harness declining to measure text a reader cannot see — a closed
 * fold's contents, and the part of the tail its own `16rem` well scrolls away —
 * and "declines to measure" is one bad edit away from "cannot see at all". 005
 * and 009 each paid for their law with a planted defect; these two corrections
 * pay for themselves the same way.
 *
 * Three plants, each on the exact ground a correction stands on:
 *
 *   * over the **visible** part of an open tail — law (c) must go red, so
 *     `clipped()` starting at the leaf did not turn the well into a blind spot;
 *   * over the fold's **summary** while it is shut — law (c) must go red, so
 *     `checkVisibility()` skips the fold's *contents* and not the fold;
 *   * and the leaf count itself, which must rise when the fold opens: the tail's
 *     lines enter the measurement exactly when they enter the screen.
 */
test.describe("the laws still see the gate run's fold (013 FR-009)", () => {
  test("a plant over the open tail and over the shut summary both turn law (c) red", async ({
    page,
    request,
  }) => {
    const entry = await serveGateRun(page, request, () => twoAttempts());
    await page.setViewportSize({ width: 1280, height: TALL });
    await page.goto(`/showfloor/${entry.spec_dir}`);
    await page.waitForSelector("[data-node-card]");
    await page.locator(`[data-node-card][data-story-id="${entry.stories[0].id}"]`).click();
    await page.waitForSelector("[data-gate-run]");

    /** A text leaf laid exactly over the box of `selector`, in the room. */
    const plant = (selector: string) =>
      page.evaluate((sel) => {
        const target = document.querySelector(sel)!;
        const box = target.getBoundingClientRect();
        const planted = document.createElement("p");
        planted.className = "planted";
        planted.textContent = "planted";
        planted.style.position = "fixed";
        planted.style.margin = "0";
        planted.style.left = `${box.left}px`;
        // The *visible* top of the box, which for the open tail is its own
        // border box and not the top of the text it scrolls away. Flush with
        // it, not below it: a fold's summary is one 10px line, and a plant
        // dropped even eight pixels would clear it by more than law (c)'s own
        // 4px of slack and prove nothing.
        planted.style.top = `${box.top}px`;
        planted.style.width = `${Math.max(box.width, 40)}px`;
        planted.style.height = `${Math.max(Math.min(box.height, 40), 24)}px`;
        document.querySelector("[data-showfloor-root]")!.appendChild(planted);
      }, selector);

    const uproot = () =>
      page.evaluate(() => {
        for (const planted of Array.from(document.querySelectorAll(".planted"))) {
          planted.remove();
        }
      });

    // ── the fold shut: green, and the summary is not a blind spot.
    const shut = await measureLaws(page);
    expect(shut.overlapping, "the room is clean with the fold shut").toEqual([]);

    await plant("[data-gate-run] summary");
    expect(
      (await measureLaws(page)).overlapping.length,
      "a plant on the fold's own summary is still a collision",
    ).toBeGreaterThan(0);
    await uproot();
    expect((await measureLaws(page)).overlapping, "and the room is clean again").toEqual([]);

    // ── the fold open: the tail joins the measurement, and is not a blind spot.
    await openEveryFold(page);
    const open = await measureLaws(page);
    expect(open.overlapping, "the room is clean with the fold open").toEqual([]);
    expect(
      open.leaves,
      "an opened fold puts its tail into the measurement",
    ).toBeGreaterThan(shut.leaves);

    await plant("[data-gate-tail]");
    expect(
      (await measureLaws(page)).overlapping.length,
      "a plant over the visible tail is still a collision",
    ).toBeGreaterThan(0);
    await uproot();
    expect((await measureLaws(page)).overlapping, "and the room is clean again").toEqual([]);
  });
});
