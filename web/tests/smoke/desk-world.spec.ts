/**
 * The Desk in the second world: the frame it fills, the tokens it wears, the
 * chips it speaks in, the tables it sets (006 US1: FR-001, FR-002 — US1-S1,
 * US1-S2).
 *
 * **A new file rather than an edit of `desk.spec.ts`.** That suite is one of the
 * carried-over guarantees FR-003 requires to pass *unchanged*, so nothing here
 * is added to it: what 001 and 003 decided the Desk shows is asserted there and
 * goes on being asserted there, and what D-015's world decides it *looks like*
 * is asserted here. Its own project (`desk-world`) is registered in
 * `playwright.config.ts` against the same fixture-backed backend on 8787 — the
 * "a gate that matches nothing does not exist" lesson `shell.spec.ts` paid for
 * (001 US1-S1).
 *
 * **US1-S1's measured pair is corrected to 1280 → 1600 (D-017).** The scenario
 * as drafted asks that the content region's "width at 2560 exceeds its width at
 * 1600". No implementation can satisfy that clause, and the reason is the
 * operator's own standing decision rather than this file's opinion:
 *
 *   * `DESIGN.md` § Typography fixes the root at `15.5px` and § Layout caps the
 *     app frame at `96rem` — so the cap is 1488px and it already binds at 1600.
 *   * D-016 ("What this does not decide", 2026-08-25) reaffirms it in as many
 *     words: "The 96rem frame cap stays as `DESIGN.md` § Layout and 004's FR-007
 *     have it."
 *   * `DESIGN.md` § The Desk in this world asks for "**Fluid width** — the Desk
 *     fills the frame **like the Showfloor**", and the landed Showfloor measures
 *     exactly this pair: `showfloor.spec.ts` "the frame is fluid to 96rem
 *     (FR-007)" asserts growth on 1280 → 1600, then the cap binding at 2560.
 *
 * Measured on this diff, at root 15.5px: 1280 → content 1278px, 1600 → 1486px,
 * 2560 → 1486px. The growth is real below the cap (+208px) and is exactly zero
 * above it, because above it the frame is centred rather than stretched.
 *
 * So FR-001's pair reads as 005/FR-007's clause carried over with the viewports
 * mis-transcribed, and D-017 reconciles the spec to the authority that outranks
 * it (constitution VIII: "where a spec's scenario and DESIGN.md disagree on an
 * *appearance*, DESIGN.md wins"). What the requirement exists to retire — the
 * first world's 1216px cap — is retired at every width, which this file proves.
 *
 * Nothing here is hedged to fit: the 1600/2560 pair is asserted as **exact
 * equality**, which is a stronger and more falsifiable claim than the growth the
 * scenario asked for. If a future diff makes the Desk grow past the cap, this
 * test fails and says so.
 *
 * **One named change, 012 US2 (FR-007).** The § Chips vocabulary sweep computed
 * a story's expected word from `declared` alone, so a story on a row joined to
 * *no work graph* was expected to read `undeclared` — which was the pane's
 * answer to "no graph" and is the rendering FR-007 forbids. The sweep now reads
 * the same fact the component reads, off the served document: whether the
 * story's epic was joined to a graph at all. Nothing about the vocabulary, the
 * tokens, the shape or the two themes moved, and one assertion was added rather
 * than relaxed — that `undeclared` is still on the floor, on the `skew` scene's
 * row, where a graph *was* read and does not carry the story.
 */

import { expect, test } from "@playwright/test";

/** `#RRGGBB` as a browser reports a computed colour back. */
function hexToRgb(hex: string): string {
  const value = hex.trim().replace("#", "");
  const channels = [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16));
  return `rgb(${channels.join(", ")})`;
}

/** The three viewports US1-S1 names. */
const WIDTHS = [1280, 1600, 2560] as const;

/** The content cap the first world shipped, and the defect FR-001 retires. */
const FIRST_WORLD_CAP = 1280;

test.describe("the Desk fills the frame (FR-001)", () => {
  test("fluid to the frame's 96rem at 1280, 1600 and 2560", async ({ page }) => {
    const measured: Record<
      number,
      {
        root: number;
        frame: number;
        frameLeft: number;
        frameCapRem: number;
        content: number;
        contentLeft: number;
        contentMaxWidth: string;
        interior: number;
        rem: number;
      }
    > = {};

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/desk");
      await page.waitForSelector("section.attention article.item");

      measured[width] = await page.evaluate(() => {
        const root = document.querySelector("[data-desk-root]") as HTMLElement;
        const frame = document.querySelector("[data-desk-frame]") as HTMLElement;
        const content = document.querySelector("[data-desk-content]") as HTMLElement;
        const frameStyle = getComputedStyle(frame);
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const borders =
          parseFloat(frameStyle.borderLeftWidth) + parseFloat(frameStyle.borderRightWidth);
        return {
          root: root.getBoundingClientRect().width,
          frame: frame.getBoundingClientRect().width,
          frameLeft: frame.getBoundingClientRect().left,
          frameCapRem: parseFloat(frameStyle.maxWidth) / rem,
          content: content.getBoundingClientRect().width,
          contentLeft: content.getBoundingClientRect().left,
          contentMaxWidth: getComputedStyle(content).maxWidth,
          interior: frame.getBoundingClientRect().width - borders,
          rem,
        };
      });
    }

    for (const width of WIDTHS) {
      const at = measured[width];
      // § Layout's app frame, the same one the Showfloor wears: capped at 96rem
      // and at nothing else. "max 96rem comes from the frame, not the Desk."
      expect(at.frameCapRem, `frame cap at ${width}`).toBeCloseTo(96, 1);
      // The content region *fills* that frame: it is the interior, to the pixel,
      // and it starts where the interior starts.
      expect(at.content, `content fills the interior at ${width}`).toBeCloseTo(
        at.interior,
        0,
      );
      expect(at.contentLeft, `content starts at the interior's edge at ${width}`)
        .toBeGreaterThanOrEqual(at.frameLeft);
      // "no hard cap below the frame's 96rem": the Desk itself declares none at
      // all. This is the assertion that fails the moment a `max-width: 1280px`
      // comes back to `.desk`.
      expect(at.contentMaxWidth, `content cap at ${width}`).toBe("none");
    }

    // Below the cap the frame is the window and the interior grows with it.
    expect(measured[1600].frame).toBeGreaterThan(measured[1280].frame);
    expect(measured[1600].content).toBeGreaterThan(measured[1280].content);

    // Above the cap the frame is centred rather than stretched.
    expect(measured[2560].frame).toBeLessThan(2560);
    expect(measured[2560].frameLeft).toBeCloseTo(
      (measured[2560].root - measured[2560].frame) / 2,
      0,
    );

    // The cap really is where the growth stops: at 1600 and at 2560 the frame
    // is the full 96rem and not a pixel more, so the content is the same width
    // at both. This is US1-S1's 1600 → 2560 pair as D-017 reconciles it — an
    // exact equality, not the `>=` an earlier attempt hedged with. It fails if
    // the Desk ever grows past the cap *or* gives width back above it.
    const capPx = 96 * measured[2560].rem;
    expect(measured[1600].frame, "the cap binds at 1600").toBeCloseTo(capPx, 0);
    expect(measured[2560].frame, "the cap binds at 2560").toBeCloseTo(capPx, 0);
    expect(
      measured[2560].content,
      "content is identical at 1600 and 2560 — both sit at the 96rem cap",
    ).toBeCloseTo(measured[1600].content, 0);

    // And the defect this requirement exists to retire: at every width above
    // it, the Desk is wider than the 1216px content the first world's
    // `max-width: 1280px` allowed.
    expect(measured[1600].content).toBeGreaterThan(FIRST_WORLD_CAP);
    expect(measured[2560].content).toBeGreaterThan(FIRST_WORLD_CAP);
  });
});

/** § Chips, read left column to right: the ink and the wash each tone wears. */
const CHIP_TOKENS: Record<string, { ink: string; wash: string | null }> = {
  landed: { ink: "--olive", wash: "--olive-w" },
  building: { ink: "--accent", wash: "--accent-w" },
  ready: { ink: "--muted", wash: "--sunken" },
  draft: { ink: "--faint", wash: null },
  wait: { ink: "--gold", wash: "--gold-w" },
  dead: { ink: "--alarm", wash: "--alarm-w" },
  // Not a seventh row of the table: the Unknown Rule's italic muted, which is
  // what the shared mapping says when the factory said a word § Chips does not
  // name.
  unknown: { ink: "--muted", wash: null },
};

test.describe("the Desk wears the second world's tokens (FR-002)", () => {
  test("both themes ground every surface in § Colors, and differ", async ({ page }) => {
    const readSurfaces = () =>
      page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const frame = document.querySelector("[data-desk-frame]") as HTMLElement;
        const well = document.querySelector(".desk .degraded") as HTMLElement | null;
        return {
          ground: getComputedStyle(document.body).backgroundColor,
          ink: getComputedStyle(document.body).color,
          frame: getComputedStyle(frame).backgroundColor,
          frameBorder: getComputedStyle(frame).borderTopColor,
          well: well === null ? null : getComputedStyle(well).backgroundColor,
          tokens: {
            ground: root.getPropertyValue("--ground").trim(),
            surface: root.getPropertyValue("--surface").trim(),
            sunken: root.getPropertyValue("--sunken").trim(),
            ink: root.getPropertyValue("--ink").trim(),
            rule: root.getPropertyValue("--rule").trim(),
          },
        };
      });

    const seen: Record<string, Awaited<ReturnType<typeof readSurfaces>>> = {};
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto("/desk");
      await page.waitForSelector("section.attention article.item");

      const measured = await readSurfaces();
      seen[scheme] = measured;

      // Every surface is its token's value, not a colour of its own: the page
      // ground `--ground`, the frame `--surface`, its border `--rule`, and the
      // Desk's wells `--sunken` (§ Colors, § Elevation & Depth).
      expect(measured.ground, `${scheme} ground`).toBe(hexToRgb(measured.tokens.ground));
      expect(measured.ink, `${scheme} ink`).toBe(hexToRgb(measured.tokens.ink));
      expect(measured.frame, `${scheme} frame`).toBe(hexToRgb(measured.tokens.surface));
      expect(measured.frameBorder, `${scheme} frame border`).toBe(
        hexToRgb(measured.tokens.rule),
      );
    }

    // "Render both themes with equal care" — and the grounds are two grounds.
    expect(seen.dark.ground).not.toBe(seen.light.ground);
    expect(seen.dark.ink).not.toBe(seen.light.ink);
    expect(seen.dark.frame).not.toBe(seen.light.frame);
  });

  test("every chip reads from the § Chips vocabulary, in both themes", async ({
    page,
    request,
  }) => {
    // The served document decides what each chip must say; the vocabulary
    // decides how it may look. Both halves are asserted here, over every story
    // the fixture floor carries, in both themes.
    const floorResponse = await request.get("/api/floor");
    const floorDoc = (await floorResponse.json()) as {
      epics: {
        nodes: { state: string; declared: boolean; awaiting_operator: boolean }[];
      }[];
    };
    // 012 US2 named change: each served story carries whether *its epic* was
    // joined to a work graph at all, because that is what decides whether
    // `undeclared` is a word this row may say (FR-007). It is read off the
    // served document — a row with no declared story was joined to no graph —
    // and not off the component, so a component that started saying
    // `undeclared` for a graph it never read turns this red.
    const served = floorDoc.epics.flatMap((epic) => {
      const graphRead = epic.nodes.some((node) => node.declared);
      return epic.nodes.map((node) => ({ ...node, graphRead }));
    });
    expect(served.length).toBeGreaterThan(0);
    // The recording exercises both sides, stated rather than assumed: some
    // stories sit on a row with a graph and some on a row without one.
    expect(served.some((node) => node.graphRead)).toBe(true);
    expect(served.some((node) => !node.graphRead)).toBe(true);

    // § The status ladder › "Eleven node states map onto the ladder and chips",
    // restated here from `DESIGN.md` rather than imported from the component, so
    // a component that started spelling a state its own way turns this red.
    const ELEVEN: Record<string, string> = {
      PENDING: "ready",
      KEY_ISSUED: "building",
      RUNNING: "building",
      VERIFYING: "verifying",
      PASSED: "pr open",
      PR_OPEN: "pr open",
      ENQUEUED: "queue",
      MERGED: "merged",
      FAILED: "failed",
      KILLED: "killed",
      WAITING_OPERATOR: "waiting on you",
      unknown: "unknown",
    };
    const TONES: Record<string, string> = {
      merged: "landed",
      landed: "landed",
      building: "building",
      verifying: "building",
      queue: "building",
      "pr open": "building",
      ready: "ready",
      draft: "draft",
      "waiting on you": "wait",
      killed: "dead",
      failed: "dead",
    };

    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto("/desk");
      await page.waitForSelector("section.floor .chip[data-chip-tone]");

      // 006 US2 named change: the sweep reads the *story* chips. The epic row
      // grew a chip of its own — § Epic rail's word with its story count, from
      // the showfloor document (FR-004) — so `.desk [data-chip-tone]` is no
      // longer one element per story. The subject is untouched: one chip per
      // served story, in the document's order, each word from the eleven-state
      // table below. The epic chips are swept for the same vocabulary
      // immediately after, so nothing on the Desk goes unchecked.
      const chips = await page.locator(".desk [data-story] [data-chip-tone]").evaluateAll((nodes) =>
        nodes.map((node) => {
          const style = getComputedStyle(node);
          return {
            tone: node.getAttribute("data-chip-tone") ?? "",
            word: (node.textContent ?? "").trim(),
            color: style.color,
            background: style.backgroundColor,
            borderColor: style.borderTopColor,
            borderWidth: style.borderTopWidth,
            radius: style.borderTopLeftRadius,
            transform: style.textTransform,
            style: style.fontStyle,
            family: style.fontFamily,
            size: style.fontSize,
          };
        }),
      );

      const tokens = await page.evaluate((names) => {
        const root = getComputedStyle(document.documentElement);
        const out: Record<string, string> = {};
        for (const name of names) out[name] = root.getPropertyValue(name).trim();
        return out;
      }, Object.values(CHIP_TOKENS).flatMap((t) => (t.wash === null ? [t.ink] : [t.ink, t.wash])));

      // One chip per story the document carries, in the document's order — a
      // sweep over nothing, or over half the floor, passes nothing.
      expect(chips.length, `${scheme}: a chip per served story`).toBe(served.length);

      const tones = new Set<string>();
      for (const [index, chip] of chips.entries()) {
        const node = served[index];
        // "an undeclared node is undeclared": 001's word for a card the
        // workgraph does not declare, unchanged by the change of clothes, and
        // not one of § Chips' six — so it falls to the Unknown Rule.
        //
        // **012 US2 narrows it to a row that read a graph** (FR-007, plan D4).
        // The word is a claim about a graph, and a row joined to none cannot
        // make it: there `undeclared` would be the pane's answer to "no graph",
        // which is how a topology nobody declared gets shown as one somebody
        // did. The floor's own state is what the pane was told, so that is the
        // word, and the missing graph is named once on the row instead.
        const expectedWord =
          !node.declared && node.graphRead
            ? "undeclared"
            : node.awaiting_operator
              ? "waiting on you"
              : (ELEVEN[node.state] ?? "unknown");
        const expectedTone = TONES[expectedWord] ?? "unknown";

        expect(chip.word, `${scheme}: story ${index} (${node.state})`).toBe(expectedWord);
        expect(chip.tone, `${scheme}: story ${index} tone`).toBe(expectedTone);

        const vocabulary = CHIP_TOKENS[chip.tone];
        // "a chip outside this table is a defect."
        expect(vocabulary, `${scheme}: ${chip.tone} is a § Chips tone`).toBeDefined();
        tones.add(chip.tone);

        expect(chip.color, `${scheme}: ${chip.tone} ink`).toBe(
          hexToRgb(tokens[vocabulary.ink]),
        );
        if (vocabulary.wash === null) {
          expect(chip.background, `${scheme}: ${chip.tone} has no wash`).toBe(
            "rgba(0, 0, 0, 0)",
          );
        } else {
          expect(chip.background, `${scheme}: ${chip.tone} wash`).toBe(
            hexToRgb(tokens[vocabulary.wash]),
          );
        }

        // § Chips' shape: mono `.62rem` uppercase, `1px solid currentColor`,
        // squared (§ Shapes: "0 on chips").
        expect(chip.family.toLowerCase(), `${scheme}: ${chip.tone} face`).toContain("mono");
        expect(parseFloat(chip.size), `${scheme}: ${chip.tone} size`).toBeCloseTo(
          0.62 * 15.5,
          1,
        );
        expect(chip.radius, `${scheme}: ${chip.tone} radius`).toBe("0px");
        expect(chip.borderWidth, `${scheme}: ${chip.tone} border`).toBe("1px");
        if (chip.tone === "unknown") {
          // The Unknown Rule: italic muted, and the factory's own spelling kept.
          expect(chip.style, `${scheme}: the unknown chip is italic`).toBe("italic");
        } else {
          // `border: 1px solid currentColor` — the border is the ink.
          expect(chip.borderColor, `${scheme}: ${chip.tone} border colour`).toBe(chip.color);
          expect(chip.transform, `${scheme}: ${chip.tone} case`).toBe("uppercase");
        }
        expect(chip.word.length, `${scheme}: ${chip.tone} carries its word`).toBeGreaterThan(0);
      }

      // What the *recorded* floor exercises, stated rather than assumed: its
      // declared stories have all merged, and the scanner's, whose status read
      // was refused, have no state at all and fall to the Unknown Rule.
      // Constitution V forbids inventing a floor that would show more of the
      // table; what the capture holds is what is asserted, and the vocabulary
      // above is what guards the rest.
      //
      // 012 US2 moved which stories supply the second of these: the three live
      // epics were captured before their workgraphs were read, and they now
      // wear the floor's own words rather than `undeclared`. The scanner's
      // refused read is what carries `unknown` here, and the assertion is
      // unchanged.
      expect(tones, `${scheme}: the floor's merged stories`).toContain("landed");
      expect(tones, `${scheme}: the floor's stateless stories`).toContain("unknown");
      // And the word this story exists to keep meaningful is still on the
      // floor: the `skew` scene's row read a graph and its third story is not
      // in it, which is the one place `undeclared` may be said (FR-007).
      const undeclared = await page
        .locator('.desk [data-story][data-undeclared] [data-chip]')
        .evaluateAll((nodes) => nodes.map((node) => (node.textContent ?? "").trim()));
      expect(undeclared, `${scheme}: undeclared is still said where it is true`).toContain(
        "undeclared",
      );

      // And the epic chips, which are the showfloor document's own word and
      // story count (006 FR-004). The recorded Fixture floor is another
      // repository's floor, so no rail entry answers for its epics and every
      // one of these is the Unknown Rule's `unknown` — which is the assertion:
      // a row with no document behind it says so in the vocabulary's own terms
      // rather than borrowing a word it was never given.
      const epicChips = await page.locator(".desk [data-epic-chip]").evaluateAll((nodes) =>
        nodes.map((node) => {
          const style = getComputedStyle(node);
          return {
            tone: node.getAttribute("data-chip-tone") ?? "",
            word: (node.textContent ?? "").trim(),
            color: style.color,
            style: style.fontStyle,
            family: style.fontFamily,
          };
        }),
      );
      expect(epicChips.length, `${scheme}: a chip per epic row`).toBe(floorDoc.epics.length);
      for (const chip of epicChips) {
        expect(CHIP_TOKENS[chip.tone], `${scheme}: ${chip.tone} is a § Chips tone`).toBeDefined();
        expect(chip.word.length, `${scheme}: the epic chip carries its word`).toBeGreaterThan(0);
        expect(chip.color, `${scheme}: epic chip ink`).toBe(
          hexToRgb(tokens[CHIP_TOKENS[chip.tone].ink]),
        );
        expect(chip.family.toLowerCase(), `${scheme}: epic chip face`).toContain("mono");
        if (chip.tone === "unknown") {
          expect(chip.style, `${scheme}: the unknown chip is italic`).toBe("italic");
        }
      }
    }
  });

  test("the tables wear the § Tables treatment, in both themes", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto("/desk");
      await page.waitForSelector("section.spend table");

      const measured = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const header = document.querySelector("section.spend thead th") as HTMLElement;
        const cell = document.querySelector("section.spend tbody td") as HTMLElement;
        const numeral = document.querySelector("section.spend tbody td.num") as HTMLElement;
        const headerStyle = getComputedStyle(header);
        const cellStyle = getComputedStyle(cell);
        const numeralStyle = getComputedStyle(numeral);
        return {
          header: {
            transform: headerStyle.textTransform,
            family: headerStyle.fontFamily,
            size: headerStyle.fontSize,
            borderBottomWidth: headerStyle.borderBottomWidth,
            borderBottomColor: headerStyle.borderBottomColor,
          },
          cell: {
            paddingTop: cellStyle.paddingTop,
            paddingRight: cellStyle.paddingRight,
            paddingBottom: cellStyle.paddingBottom,
            paddingLeft: cellStyle.paddingLeft,
          },
          numeral: {
            align: numeralStyle.textAlign,
            family: numeralStyle.fontFamily,
            variant: numeralStyle.fontVariantNumeric,
          },
          hairline: root.getPropertyValue("--hairline").trim(),
        };
      });

      // "micro uppercase headers over a hairline, cells `.5rem .8rem`, numerals
      // right-aligned tabular mono" (§ The Desk in this world › Tables).
      expect(measured.header.transform, `${scheme}: header case`).toBe("uppercase");
      expect(measured.header.family.toLowerCase(), `${scheme}: header face`).toContain("mono");
      expect(parseFloat(measured.header.size), `${scheme}: header size`).toBeCloseTo(
        0.66 * 15.5,
        1,
      );
      expect(measured.header.borderBottomWidth, `${scheme}: the hairline`).toBe("1px");
      expect(measured.header.borderBottomColor, `${scheme}: hairline colour`).toBe(
        hexToRgb(measured.hairline),
      );

      expect(parseFloat(measured.cell.paddingTop), `${scheme}: cell padding`).toBeCloseTo(
        0.5 * 15.5,
        1,
      );
      expect(parseFloat(measured.cell.paddingBottom), `${scheme}: cell padding`).toBeCloseTo(
        0.5 * 15.5,
        1,
      );
      expect(parseFloat(measured.cell.paddingRight), `${scheme}: cell padding`).toBeCloseTo(
        0.8 * 15.5,
        1,
      );
      expect(parseFloat(measured.cell.paddingLeft), `${scheme}: cell padding`).toBeCloseTo(
        0.8 * 15.5,
        1,
      );

      expect(measured.numeral.align, `${scheme}: numerals`).toBe("right");
      expect(measured.numeral.family.toLowerCase(), `${scheme}: numeral face`).toContain(
        "mono",
      );
      expect(measured.numeral.variant, `${scheme}: numeral variant`).toContain("tabular-nums");
    }
  });

  test("the Desk authors no motion at all (§ Motion)", async ({ page }) => {
    // § Motion: "Exactly one authored motion: the active ladder stop's 1.6s
    // opacity pulse." The Desk has no ladder until US2 puts the document's own
    // on its rows, so until then it moves not at all — the first world's
    // breathing dot and its hovering button left with the world that drew them.
    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      await page.emulateMedia({ reducedMotion });
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto("/desk");
      await page.waitForSelector("section.attention article.item");

      const moving = await page.evaluate(() => {
        const out: string[] = [];
        for (const node of document.querySelectorAll("[data-desk-root] *")) {
          for (const pseudo of [null, "::before", "::after"]) {
            const style = getComputedStyle(node, pseudo ?? undefined);
            const animated = style.animationName !== "none";
            const transitioned = parseFloat(style.transitionDuration) > 0;
            if (animated || transitioned) {
              out.push(`${node.className}${pseudo ?? ""}: ${style.animationName}`);
            }
          }
        }
        return out;
      });

      expect(moving, `nothing moves under ${reducedMotion}`).toEqual([]);
    }
  });
});
