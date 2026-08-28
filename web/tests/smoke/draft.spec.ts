/**
 * The drafting table, in a real browser, against the corpus the backend serves
 * (014 US1).
 *
 * **Nothing here names a spec directory.** The corpus moves — an operator adds,
 * renames or refines a spec between builds — and 008 US1 is the subtraction of
 * every assertion that turned red when they did. So the spec this file opens is
 * *discovered* from `/api/showfloor`'s rail, which is the room's own list of
 * what is on disk: whatever the corpus holds, the first entry is a spec, and
 * that is all this file needs to be true. The miss it asserts is a directory
 * name with no chance of existing, which is the other half of the same
 * discipline.
 *
 * What is proved here, and only here, is what a browser can prove:
 *
 * * the three documents reach the DOM in one view, in order (US1-S1, FR-001);
 * * the read stamp is on the page, naming a revision and an instant (US1-S3,
 *   FR-003);
 * * a directory that is not there renders a note carrying the path it tried,
 *   and no trio at all (US1-S4, FR-004);
 * * each exported checker's answer reaches the DOM under that checker's own
 *   name, and no composite verdict reaches it at all (014 US2, FR-006/008/009);
 * * the room answers 401 without the token, like every other route (US1-S5,
 *   FR-005) — asserted through a request that deliberately carries none;
 * * the compiled graph draws with the Showfloor's stage assets and no run state
 *   on any node, and its two edge kinds carry the two strokes DESIGN.md names
 *   (014 US3, FR-011/012), while a spec whose graph did not compile draws no
 *   stage at all (FR-013);
 * * and § Layout's four containment laws report zero violations over the whole
 *   room, in both themes and at every width the suite sweeps.
 */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { measureLaws } from "./support/laws";

/** A directory name with no chance of being in any corpus. */
const NO_SUCH_DIR = "930-no-such-draft-directory";

/** The widths the suite sweeps, and the two themes DESIGN.md renders. */
const WIDTHS = [1280, 1600, 2560];
const THEMES = ["light", "dark"] as const;

/** The half of a request context this file uses. */
interface Reader {
  get: (url: string) => Promise<{ json: () => Promise<unknown> }>;
}

/** A spec the backend is actually serving, read off the Showfloor's own rail. */
async function aSpecOnDisk(request: Reader): Promise<string> {
  const document = (await (await request.get("/api/showfloor")).json()) as {
    rail?: { spec_dir?: string }[];
  };
  const specDir = document.rail?.[0]?.spec_dir;
  expect(specDir, "the corpus the backend serves has no spec in it").toBeTruthy();
  return specDir as string;
}

/** One node of a compiled graph, in the two fields these cases read. */
interface StagedNode {
  id: string;
  depends_on: string[];
  depends_on_merged: string[];
}

/**
 * Two specs on disk, told apart by what the deriver did with them (014 US3).
 *
 * Still no directory named: which spec compiles is a fact about the corpus and
 * moves with it, so both are *discovered* by shape — the first whose graph
 * compiled to more than one node, and the first whose graph did not compile at
 * all. This corpus holds both today (most specs compile; the sketches that carry
 * no `## Work Graph` do not), and the assertions below say which one they need
 * rather than assuming it.
 *
 * The walk is memoised per worker because every case below needs it — the six
 * law sweeps included — and re-reading the whole corpus once per test would cost
 * more wall clock than the page loads it exists to set up.
 */
let discovered: Promise<{ staged: string | null; unstaged: string | null }> | null = null;

function corpus(request: Reader) {
  if (discovered !== null) return discovered;
  discovered = (async () => {
    const document = (await (await request.get("/api/showfloor")).json()) as {
      rail?: { spec_dir?: string }[];
    };
    let staged: string | null = null;
    let unstaged: string | null = null;
    for (const entry of document.rail ?? []) {
      if (entry.spec_dir === undefined) continue;
      if (staged !== null && unstaged !== null) break;
      const draft = (await (
        await request.get(`/api/draft/${encodeURIComponent(entry.spec_dir)}`)
      ).json()) as { graph?: { nodes?: StagedNode[] } | null };
      const nodes = draft.graph?.nodes;
      if (Array.isArray(nodes) && nodes.length > 1) staged ??= entry.spec_dir;
      if (draft.graph === null) unstaged ??= entry.spec_dir;
    }
    return { staged, unstaged };
  })();
  return discovered;
}

/** The spec whose graph the stage draws, and the graph it draws. */
async function aStagedSpec(request: Reader): Promise<{ specDir: string; nodes: StagedNode[] }> {
  const { staged } = await corpus(request);
  expect(
    staged,
    "no spec the backend serves compiles to a graph of more than one node",
  ).not.toBeNull();
  const draft = (await (
    await request.get(`/api/draft/${encodeURIComponent(staged as string)}`)
  ).json()) as { graph: { nodes: StagedNode[] } };
  return { specDir: staged as string, nodes: draft.graph.nodes };
}

/** Every card the stage drew, by the id the deriver gave its node. */
async function stagedCards(page: Page): Promise<string[]> {
  return page
    .locator("[data-draft-stage] [data-draft-node]")
    .evaluateAll((cards) =>
      cards.map((card) => card.getAttribute("data-story-id") ?? ""),
    );
}

test("the trio reads together, stamped with what was read and when", async ({
  page,
  request,
}) => {
  const specDir = await aSpecOnDisk(request);
  await page.goto(`/draft/${encodeURIComponent(specDir)}`);
  await page.waitForSelector("[data-draft-trio]");

  // FR-001: all three, in that order, in one view.
  const names = await page
    .locator("[data-document]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-document")));
  expect(names).toEqual(["spec.md", "plan.md", "tasks.md"]);

  // Every one of the three is answered for, whatever state it is in: absence is
  // a fact the room renders, never a column it omits (FR-002).
  const states = await page
    .locator("[data-document]")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-document-state")),
    );
  for (const state of states) expect(["present", "empty", "absent"]).toContain(state);
  // The spec itself is there — a rail entry is a directory with a `spec.md` in
  // it — so the room is rendering a document and not three absences.
  expect(states[0]).toBe("present");

  // FR-003: the revision read and the instant read, both on screen.
  const stamp = page.locator("[data-read-stamp]");
  await expect(stamp).toBeVisible();
  await expect(stamp.locator("[data-read-instant]")).toHaveText(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
  );
  const revision = await stamp
    .locator("[data-read-revision]")
    .getAttribute("data-read-revision");
  expect(revision, "the stamp names a revision or names it unknown").toBeTruthy();

  // FR-002 in the browser: a corpus whose specs mostly lack a `plan.md` shows
  // no degraded note for it.
  if (!states.includes("absent")) return;
  await expect(page.locator("[data-draft-note]")).toHaveCount(0);
});

/** The three checkers whose answers the room carries, in seam order (US2). */
const CHECKERS = ["derive_workgraph", "check_prompt_assembly", "check_slice_coverage"];

test("each check answers in its own name, and nothing totals them", async ({
  page,
  request,
}) => {
  const specDir = await aSpecOnDisk(request);
  await page.goto(`/draft/${encodeURIComponent(specDir)}`);
  await page.waitForSelector("[data-draft-checks]");

  // FR-006/FR-008: one row per checker, each under the name of the function
  // that answered. Which answers they carry depends on the spec the rail
  // happened to name, so nothing here asserts a verdict — only attribution.
  const named = await page
    .locator("[data-check]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-check")));
  expect(named).toEqual(CHECKERS);

  for (const checker of CHECKERS) {
    const row = page.locator(`[data-check="${checker}"]`);
    await expect(row.locator("[data-check-name]")).toHaveText(checker);
    // The seam the name belongs to, so the attribution points somewhere real.
    await expect(row.locator("[data-check-seam]")).toContainText("factory.workgraph.");
    // DESIGN.md's three answers and no fourth.
    const answer = await row
      .locator("[data-check-answer]")
      .getAttribute("data-check-answer");
    expect(["passed", "refused", "not_run"]).toContain(answer);
  }

  // FR-009: exactly one answer per check, and the sentence that stands where a
  // verdict would. A fourth chip anywhere would be the composite this room is
  // forbidden to render.
  await expect(page.locator("[data-check-answer]")).toHaveCount(CHECKERS.length);
  await expect(page.locator("[data-verdict-unavailable]")).toContainText(
    "ergane spec validate",
  );
  await expect(page.locator("[data-verdict]")).toHaveCount(0);
  await expect(page.locator("[data-checks-summary]")).toHaveCount(0);
});

test("a directory that is not there degrades honestly and draws no trio", async ({
  page,
}) => {
  await page.goto(`/draft/${NO_SUCH_DIR}`);
  const note = page.locator("[data-draft-note]");
  await expect(note).toBeVisible();

  // FR-004: the path it tried, spelled out, on the element that carries it.
  const path = await note.locator("[data-note-path]").getAttribute("data-note-path");
  expect(path).toContain(NO_SUCH_DIR);
  await expect(note.locator("[data-note-path]")).toContainText(NO_SUCH_DIR);

  // Not an empty trio: three empty columns is what a sketch looks like.
  await expect(page.locator("[data-draft-trio]")).toHaveCount(0);
  await expect(page.locator("[data-document]")).toHaveCount(0);

  // And no stage, for the same reason one requirement later (014 US3, FR-013):
  // there is no spec here, so there is certainly no graph, and an empty stage
  // is a claim about one.
  await expect(page.locator("[data-draft-stage]")).toHaveCount(0);
  await expect(page.locator("[data-wires]")).toHaveCount(0);

  // Stale is stale whichever way the read went, so the stamp is here too.
  await expect(page.locator("[data-read-stamp]")).toBeVisible();
});

test("the room answers 401 without the token, like every other route", async ({
  baseURL,
}) => {
  // Node's own `fetch`, deliberately, and not Playwright's request context:
  // `playwright.config.ts` puts `httpCredentials` on `use`, and every context
  // built from the test fixtures inherits them and answers the challenge —
  // which is exactly what an assertion about *having no credential* must not
  // do. This carries nothing, so a 200 here would be a route serving open.
  for (const path of [`/draft/${NO_SUCH_DIR}`, `/api/draft/${NO_SUCH_DIR}`]) {
    const response = await fetch(`${baseURL}${path}`);
    expect(response.status, `${path} served without a token`).toBe(401);
    // The one refusal shape every route shares (003 US4): it advertises both
    // schemes and echoes nothing of what it was guarding.
    expect(response.headers.get("www-authenticate")).toContain("Bearer");
    const body = await response.text();
    expect(body).not.toContain("spec.md");
    expect(body).not.toContain(NO_SUCH_DIR);
  }
});

/**
 * The navigation this spec exists to create (018 US1, SC-005).
 *
 * **No URL is typed here** past the pane's own front door. That is the whole
 * assertion: before this story the drafting table could only be reached by an
 * operator who already knew a spec directory and typed it into the address bar,
 * and a room reachable only that way is a room the pane does not offer. So the
 * walk is the operator's — open the pane, click the room in the appbar, click a
 * row — and every hop after the first is a click on something the pane rendered.
 *
 * **And nothing here names a spec directory.** The corpus moves; the row this
 * test opens is whichever one the index listed first, and what is asserted is
 * that the trio which opens is the one that row named (008 US1's discipline,
 * kept).
 */
test.describe("the corpus opens on one page, and every spec has a door (018 US1)", () => {
  test("walks appbar → index → a spec's drafting table, with no typed URL", async ({
    page,
  }) => {
    // The pane's front door, and the only address in this test.
    await page.goto("/");

    // US1-S7 (FR-008): the room is offered in the appbar, beside the other two.
    const roomLink = page.locator(".mast nav a", { hasText: "Drafting table" });
    await expect(roomLink).toHaveCount(1);
    await roomLink.click();

    // US1-S1 (FR-001): the corpus, one row per spec, and the room is current.
    await page.waitForSelector("[data-index-list]");
    await expect(page.locator(".mast nav a[aria-current='page']")).toHaveText(
      "Drafting table",
    );
    const rows = page.locator("[data-index-row]");
    // Non-vacuous: a corpus with no rows would let every claim below pass over
    // nothing (001 US1-S1, in its smoke shape).
    expect(await rows.count()).toBeGreaterThan(1);

    // US1-S5 (FR-006): what it read, and when, on the page it read it for.
    await expect(page.locator("[data-index-stamp]")).toBeVisible();

    // US1-S2 (FR-002): the row is the link, and clicking it opens that spec.
    const firstRow = rows.first();
    const specDir = await firstRow
      .locator("[data-index-link]")
      .getAttribute("data-spec-dir");
    expect(specDir, "the first row named no spec directory").toBeTruthy();
    await firstRow.locator("[data-index-link]").click();

    // 014's room, opened on the spec the row named — and still the same room in
    // the appbar, with or without a spec in the address (FR-008).
    await page.waitForSelector("[data-draft-content]");
    await expect(page.locator("[data-draft-content]")).toHaveAttribute(
      "data-spec-dir",
      specDir as string,
    );
    await expect(page.locator("[data-draft-trio]")).toBeVisible();
    await expect(page.locator(".mast nav a[aria-current='page']")).toHaveText(
      "Drafting table",
    );
  });

  test("dresses every declared state in a chip and no row in a glyph", async ({
    page,
  }) => {
    // US1-S3 (FR-004): intent is declared, progress is observed, and only the
    // second has glyphs. Whatever this corpus declares today, every row wears a
    // worded chip and nothing on the page wears a ladder.
    await page.goto("/");
    await page.locator(".mast nav a", { hasText: "Drafting table" }).click();
    await page.waitForSelector("[data-index-list]");

    const rows = page.locator("[data-index-row]");
    const count = await rows.count();
    expect(count).toBeGreaterThan(1);
    for (let index = 0; index < count; index += 1) {
      const row = rows.nth(index);
      const chip = row.locator("[data-declared-state]");
      await expect(chip).toHaveCount(1);
      // State is never colour alone: the word is on the element.
      expect((await chip.textContent())?.trim()).toBe(await row.getAttribute("data-state"));
    }
    await expect(page.locator("[data-index-list] [data-ladder]")).toHaveCount(0);
    await expect(page.locator("[data-index-list] [data-stop]")).toHaveCount(0);
  });

  test("offers the review room on landed rows and on no others", async ({ page }) => {
    // US1-S2a (FR-010). Which specs are `landed` is a fact about the corpus and
    // moves with it, so the claim is the *relation* — a review link appears on
    // a row if and only if that row declares `landed` — and it is asserted over
    // whatever the corpus declares today.
    await page.goto("/");
    await page.locator(".mast nav a", { hasText: "Drafting table" }).click();
    await page.waitForSelector("[data-index-list]");

    const rows = page.locator("[data-index-row]");
    const count = await rows.count();
    expect(count).toBeGreaterThan(1);
    for (let index = 0; index < count; index += 1) {
      const row = rows.nth(index);
      const declared = await row.getAttribute("data-state");
      const offered = await row.locator("[data-review-link]").count();
      expect(offered, `a ${declared} row offering ${offered} review links`).toBe(
        declared === "landed" ? 1 : 0,
      );
    }
  });

  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      test(`the index reports zero law violations at ${width} in ${theme}`, async ({
        page,
      }) => {
        // § Layout's four laws over the new view. The index is where the row is
        // itself a link — an anchor covering its own row with an inset overlay
        // — so "an opaque box painted over text" is the law it could plausibly
        // break, and it is the reason this sweep is here rather than assumed
        // from the trio's.
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme });
        await page.goto("/");
        await page.locator(".mast nav a", { hasText: "Drafting table" }).click();
        await page.waitForSelector("[data-index-list]");

        const report = await measureLaws(page);

        expect(report.leaves, "the sweep found no text at all").toBeGreaterThan(10);
        expect(report.painters, "the sweep found nothing painted").toBeGreaterThan(0);
        expect(report.escaped, "text outside a scrolling ancestor").toEqual([]);
        expect(report.past, "an element past its container").toEqual([]);
        expect(report.overlapping, "two text leaves overlapping").toEqual([]);
        expect(report.occluded, "an opaque box painted over text").toEqual([]);
        expect(report.roomScrollsSideways, "the room scrolls sideways").toBe(false);
        expect(report.documentScrollWidth, "the document is wider than the viewport")
          .toBeLessThanOrEqual(report.viewport + 1);
      });
    }
  }

  test("the index answers 401 without the token, like every other route", async ({
    baseURL,
  }) => {
    // Node's own `fetch`, for the reason 014's case gives: Playwright's request
    // context answers the challenge from `use.httpCredentials`, which is what an
    // assertion about having no credential must not do (US1-S6, FR-007).
    for (const path of ["/draft", "/api/draft"]) {
      const response = await fetch(`${baseURL}${path}`);
      expect(response.status, `${path} served without a token`).toBe(401);
      expect(response.headers.get("www-authenticate")).toContain("Bearer");
      expect(await response.text()).not.toContain("spec_dir");
    }
  });
});

test.describe("the graph draws what will run (014 US3)", () => {
  test("draws the compiled graph with the stage's assets, unlit", async ({
    page,
    request,
  }) => {
    const { specDir, nodes } = await aStagedSpec(request);
    await page.goto(`/draft/${encodeURIComponent(specDir)}`);
    // The canvas, not a card: a rank is laid out before the wires measure, and
    // waiting on the section is what proves the stage exists at all.
    await page.waitForSelector("[data-draft-stage-canvas]");

    // FR-011: one card per node of the graph the backend compiled, under the
    // dispatch id the deriver gave it. Not a count — the ids, so a stage
    // drawing the right number of the wrong nodes fails.
    expect((await stagedCards(page)).sort()).toEqual(nodes.map((node) => node.id).sort());

    // The Showfloor's own assets, and the proof is that they are the same
    // classes: the card, the ranks and the canvas are one declaration in
    // `showfloor.css` worn by two rooms (`tests/unit/stageRules.test.ts`).
    const classes = await page
      .locator("[data-draft-stage] [data-draft-node]")
      .first()
      .getAttribute("class");
    expect(classes).toBe("node");
    await expect(page.locator("[data-draft-stage] [data-ranks]")).toHaveCount(1);

    // And **no run state on any node** — the whole of "unlit". The eleven-state
    // glyph grammar dresses an `epic_status` answer, and there is no answer
    // because nothing has run.
    for (const clothing of ["[data-chip]", "[data-ladder]", "[data-stop]", "button"]) {
      await expect(
        page.locator(`[data-draft-stage] ${clothing}`),
        `${clothing} is a run's clothing and no node here has run`,
      ).toHaveCount(0);
    }

    // § Named Rules: the absence is in words on the page, not only in what is
    // missing from it.
    await expect(page.locator("[data-draft-stage-statement]")).toContainText("none has run");
    await expect(page.locator("[data-draft-stage-legend]")).toContainText("merge edge");
  });

  test("wires join the boxes they name, told apart by stroke", async ({ page, request }) => {
    const { specDir, nodes } = await aStagedSpec(request);
    await page.goto(`/draft/${encodeURIComponent(specDir)}`);
    await page.waitForSelector("[data-draft-stage-canvas]");

    // Every edge the graph declares, and no edge it does not: the pane reads
    // both lists and re-derives neither.
    const declared = nodes.flatMap((node) => [
      ...node.depends_on_merged.map((source) => `merge:${source}->${node.id}`),
      ...node.depends_on.map((source) => `pass:${source}->${node.id}`),
    ]);
    expect(declared.length, "the spec found declares no dependency at all").toBeGreaterThan(0);
    await expect(page.locator("[data-draft-stage] [data-wire]")).toHaveCount(declared.length);

    const measured = await page.evaluate(() => {
      const canvas = document.querySelector("[data-draft-stage-canvas]") as HTMLElement;
      const svg = canvas.querySelector("[data-wires]") as SVGElement;
      const origin = svg.getBoundingClientRect();
      const box = (id: string) => {
        const card = canvas.querySelector(`[data-story-id="${id}"]`) as HTMLElement | null;
        if (card === null) return null;
        const rect = card.getBoundingClientRect();
        return {
          left: rect.left - origin.left,
          right: rect.right - origin.left,
          middle: rect.top + rect.height / 2 - origin.top,
        };
      };

      /**
       * A token as the engine resolves it, through a probe wearing it.
       *
       * Reading the custom property gives its authored text; what a stroke has
       * to equal is the colour, so the comparison is made in the space the
       * browser answers `getComputedStyle().stroke` in.
       */
      const resolved = (token: string) => {
        const probe = document.createElement("span");
        probe.style.color = `var(${token})`;
        document.body.appendChild(probe);
        const colour = getComputedStyle(probe).color;
        probe.remove();
        return colour;
      };

      /** Each stroke as authored, measured on a probe path in this canvas. */
      const stroke = (kind: string) => {
        const probe = document.createElementNS("http://www.w3.org/2000/svg", "path");
        probe.setAttribute("class", `wire ${kind}`);
        probe.setAttribute("d", "M0 0 L10 0");
        svg.appendChild(probe);
        const style = getComputedStyle(probe);
        const read = {
          colour: style.stroke,
          width: style.strokeWidth,
          dash: style.strokeDasharray,
        };
        probe.remove();
        return read;
      };

      return {
        // "behind the cards, `pointer-events: none`" (§ Stage).
        pointer: getComputedStyle(svg).pointerEvents,
        first: canvas.firstElementChild === svg,
        wires: Array.from(canvas.querySelectorAll("[data-wire]")).map((path) => {
          const style = getComputedStyle(path);
          return {
            kind: path.getAttribute("data-edge-kind"),
            sourceId: path.getAttribute("data-edge-source"),
            targetId: path.getAttribute("data-edge-target"),
            d: path.getAttribute("d") ?? "",
            colour: style.stroke,
            width: style.strokeWidth,
            dash: style.strokeDasharray,
            source: box(path.getAttribute("data-edge-source") ?? ""),
            target: box(path.getAttribute("data-edge-target") ?? ""),
          };
        }),
        olive: resolved("--olive"),
        rule: resolved("--rule"),
        merge: stroke("merge"),
        pass: stroke("pass"),
      };
    });

    expect(measured.pointer).toBe("none");
    expect(measured.first).toBe(true);
    expect(
      measured.wires.map((wire) => `${wire.kind}:${wire.sourceId}->${wire.targetId}`).sort(),
    ).toEqual(declared.sort());

    for (const wire of measured.wires) {
      // § Stage: "merge edges solid 2px olive, pass edges dashed 2px `--rule`".
      expect(wire.width).toBe("2px");
      if (wire.kind === "merge") {
        expect(wire.colour).toBe(measured.olive);
        expect(wire.dash === "none" || wire.dash === "").toBe(true);
      } else {
        expect(wire.colour).toBe(measured.rule);
        expect(wire.dash).not.toBe("none");
      }

      // And the path really starts on the source's right edge and ends on the
      // target's left, at each card's vertical middle — the assertion 004's
      // suite never made, and the one that would have caught nine stations laid
      // out beyond their own map.
      const start = wire.d.match(/^M(-?[\d.]+) (-?[\d.]+)/);
      const end = wire.d.match(/(-?[\d.]+) (-?[\d.]+)$/);
      expect(start, `${wire.d} starts with a move`).not.toBeNull();
      expect(end, `${wire.d} ends at a point`).not.toBeNull();
      expect(Number(start![1])).toBeCloseTo(wire.source!.right, 0);
      expect(Number(start![2])).toBeCloseTo(wire.source!.middle, 0);
      expect(Number(end![1])).toBeCloseTo(wire.target!.left, 0);
      expect(Number(end![2])).toBeCloseTo(wire.target!.middle, 0);
    }

    // FR-012 is a claim about *both* strokes, and this repository's own corpus
    // declares merge edges and no pass edge — its stories share files, so
    // `depends_on_merged` is the honest dependency every time. So the pair is
    // proven over the recorded five-node workgraph in
    // `tests/unit/DraftStage.test.tsx`, which carries both kinds, and what a
    // real browser adds is that the two are actually different *here*: a probe
    // path of each class, measured in this room's live canvas and removed.
    expect(measured.merge.width).toBe("2px");
    expect(measured.pass.width).toBe("2px");
    expect(measured.merge.colour).toBe(measured.olive);
    expect(measured.pass.colour).toBe(measured.rule);
    expect(measured.merge.colour).not.toBe(measured.pass.colour);
    // Solid against dashed: the one distinction a colour-blind reader has.
    expect(measured.merge.dash === "none" || measured.merge.dash === "").toBe(true);
    expect(measured.pass.dash).not.toBe("none");
    expect(measured.pass.dash.length).toBeGreaterThan(0);
  });

  test("draws no stage for a spec whose graph did not compile", async ({ page, request }) => {
    const { unstaged } = await corpus(request);
    // Named rather than silently skipped: whether the corpus holds a spec with
    // no compiled graph is a fact about the corpus, and this case says which
    // fact it needed. `tests/unit/DraftStage.test.tsx` proves FR-013 over
    // constructed graphs and does not depend on one being on disk.
    test.skip(
      unstaged === null,
      "every spec the backend serves compiles a graph, so there is no refusal to render",
    );

    await page.goto(`/draft/${encodeURIComponent(unstaged as string)}`);
    await page.waitForSelector("[data-draft-checks]");

    // FR-013: no stage at all — not an empty canvas, not a rank with nothing in
    // it. An empty stage is a claim about a graph, and there is no graph.
    await expect(page.locator("[data-draft-stage]")).toHaveCount(0);
    await expect(page.locator("[data-draft-stage-canvas]")).toHaveCount(0);
    await expect(page.locator("[data-wires]")).toHaveCount(0);
    await expect(page.locator("[data-draft-node]")).toHaveCount(0);

    // And the deriver's own refusal is what stands in its place, under the name
    // of the function that gave it (014 US2, FR-007) — the answer to "why is
    // there no stage", said by the thing that knows.
    const derivation = page.locator('[data-check="derive_workgraph"]');
    await expect(derivation.locator("[data-check-answer]")).toHaveAttribute(
      "data-check-answer",
      "refused",
    );
    await expect(derivation.locator("[data-check-detail]")).not.toHaveText("");

    // The trio is still read: a spec that will not compile is still a document.
    await expect(page.locator("[data-draft-trio]")).toHaveCount(1);
  });

  test("a graph wider than its column travels inside the stage, not the room", async ({
    page,
    request,
  }) => {
    // The three widths FR-014 sweeps are all wide enough to hold this corpus's
    // widest graph, so the one horizontal scroll § Stage sanctions is never
    // reached there — and an exception nothing exercises is an exception nobody
    // knows is broken. This narrows the viewport until the graph must overflow,
    // which is the case law (a) excuses and law (b) must still refuse to excuse
    // for the room itself.
    const { specDir } = await aStagedSpec(request);
    await page.setViewportSize({ width: 720, height: 900 });
    await page.goto(`/draft/${encodeURIComponent(specDir)}`);
    await page.waitForSelector("[data-draft-stage-canvas]");

    const measured = await page.evaluate(() => {
      const scroll = document.querySelector("[data-draft-stage-scroll]") as HTMLElement;
      const style = getComputedStyle(scroll);
      return {
        overflows: scroll.scrollWidth > scroll.clientWidth,
        axis: { x: style.overflowX, y: style.overflowY },
        right: scroll.getBoundingClientRect().right,
        viewport: document.documentElement.clientWidth,
      };
    });

    // Non-vacuous: if the graph fits, this case proves nothing about scrolling.
    expect(measured.overflows, "the graph fits at 720px, so nothing scrolls").toBe(true);
    // § Stage: one axis, the one DESIGN.md names.
    expect(measured.axis.x).toBe("auto");
    expect(measured.axis.y).toBe("hidden");
    // And the scroller itself is on screen — a scrolling ancestor that is
    // already past the viewport excuses nothing.
    expect(measured.right).toBeLessThanOrEqual(measured.viewport + 0.5);

    // The four laws still report zero: the graph is outside the stage's box and
    // inside the scroller the stage contains, which is exactly what law (a)
    // sanctions and nothing more.
    const report = await measureLaws(page);
    expect(report.leaves, "the sweep found no text at all").toBeGreaterThan(10);
    expect(report.escaped, "text outside a scrolling ancestor").toEqual([]);
    expect(report.past, "an element past its container").toEqual([]);
    expect(report.overlapping, "two text leaves overlapping").toEqual([]);
    expect(report.occluded, "an opaque box painted over text").toEqual([]);
    expect(report.roomScrollsSideways, "the room scrolls sideways").toBe(false);
    // The one that bites in *this* room. `roomScrollsSideways` is measured off
    // `[data-showfloor-root]`, which the drafting table does not carry — its
    // room has no scroller of its own and the document is what scrolls — so the
    // sentence "§ Stage sanctions one horizontal scroll and it is the stage's"
    // is held here by the document's own width, exactly as `desk.spec.ts` holds
    // it. Without this line the graph could travel and take the page with it.
    expect(report.documentScrollWidth, "the document is wider than the viewport")
      .toBeLessThanOrEqual(report.viewport + 1);
  });
});

/**
 * § Layout's four laws over the drafting table, with the stage on the page
 * (FR-014, and FR-001's half before it).
 *
 * **014 US3 makes this sweep measure the stage rather than happening to.** The
 * sweep already ran at three widths in both themes, over whichever spec the rail
 * named first — which on this corpus does compile, so a stage was on the page by
 * luck. Two things change and neither relaxes anything. The spec is now the one
 * *discovered* to compile to more than one node, so the graph is always there;
 * and the section carries `data-stage`, which is what puts every one of its
 * descendants under law (a) — measured against its stage's box, with only the
 * one horizontal scroller § Stage sanctions excused. Nothing about the room's
 * other three laws moved.
 *
 * The stage is where the four are most worth running: it is the only part of
 * this room whose width is a function of its *content* rather than of the frame,
 * so a graph wider than the column is the case that escapes a container, and the
 * lower widths are where it does it.
 */
test.describe("§ Layout's four laws over the drafting table (FR-014, containment)", () => {
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      test(`reports zero violations at ${width} in ${theme}`, async ({
        page,
        request,
      }) => {
        const { specDir, nodes } = await aStagedSpec(request);
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(`/draft/${encodeURIComponent(specDir)}`);
        await page.waitForSelector("[data-draft-trio]");
        await page.waitForSelector("[data-draft-stage-canvas]");

        const report = await measureLaws(page);

        // Non-vacuous first: a sweep that found no text cannot pass for having
        // laid it out correctly (001 US1-S1, in its smoke shape).
        expect(report.leaves, "the sweep found no text at all").toBeGreaterThan(10);
        expect(report.painters, "the sweep found nothing painted").toBeGreaterThan(0);
        // And law (a) sweeps a stage that is really there, with the whole graph
        // on it: a stage the sweep never found is a law that passed over
        // nothing.
        expect(
          await page.locator("[data-stage]").count(),
          "law (a) found no stage on the page",
        ).toBe(1);
        expect(await stagedCards(page)).toHaveLength(nodes.length);

        expect(report.escaped, "text outside a scrolling ancestor").toEqual([]);
        expect(report.past, "an element past its container").toEqual([]);
        expect(report.overlapping, "two text leaves overlapping").toEqual([]);
        expect(report.occluded, "an opaque box painted over text").toEqual([]);
        expect(report.roomScrollsSideways, "the room scrolls sideways").toBe(false);
        // And the room does not take the page sideways with it: the drafting
        // table carries no `[data-showfloor-root]`, so the document's width is
        // where "one horizontal scroll, and it is the stage's" is really held
        // (the same pair `desk.spec.ts` asserts, for the same reason).
        expect(report.documentScrollWidth, "the document is wider than the viewport")
          .toBeLessThanOrEqual(report.viewport + 1);
      });
    }
  }
});
