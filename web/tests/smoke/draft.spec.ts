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
 * * and § Layout's four containment laws report zero violations over the whole
 *   room, in both themes and at every width the suite sweeps.
 */
import { expect, test } from "@playwright/test";

import { measureLaws } from "./support/laws";

/** A directory name with no chance of being in any corpus. */
const NO_SUCH_DIR = "930-no-such-draft-directory";

/** The widths the suite sweeps, and the two themes DESIGN.md renders. */
const WIDTHS = [1280, 1600, 2560];
const THEMES = ["light", "dark"] as const;

/** A spec the backend is actually serving, read off the Showfloor's own rail. */
async function aSpecOnDisk(request: {
  get: (url: string) => Promise<{ json: () => Promise<unknown> }>;
}): Promise<string> {
  const document = (await (await request.get("/api/showfloor")).json()) as {
    rail?: { spec_dir?: string }[];
  };
  const specDir = document.rail?.[0]?.spec_dir;
  expect(specDir, "the corpus the backend serves has no spec in it").toBeTruthy();
  return specDir as string;
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

test.describe("§ Layout's four laws over the drafting table (FR-001, containment)", () => {
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      test(`reports zero violations at ${width} in ${theme}`, async ({
        page,
        request,
      }) => {
        const specDir = await aSpecOnDisk(request);
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(`/draft/${encodeURIComponent(specDir)}`);
        await page.waitForSelector("[data-draft-trio]");

        const report = await measureLaws(page);

        // Non-vacuous first: a sweep that found no text cannot pass for having
        // laid it out correctly (001 US1-S1, in its smoke shape).
        expect(report.leaves, "the sweep found no text at all").toBeGreaterThan(10);
        expect(report.painters, "the sweep found nothing painted").toBeGreaterThan(0);

        expect(report.escaped, "text outside a scrolling ancestor").toEqual([]);
        expect(report.past, "an element past its container").toEqual([]);
        expect(report.overlapping, "two text leaves overlapping").toEqual([]);
        expect(report.occluded, "an opaque box painted over text").toEqual([]);
        expect(report.roomScrollsSideways, "the room scrolls sideways").toBe(false);
      });
    }
  }
});
