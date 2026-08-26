/**
 * The four layout laws, measured over a Playwright page.
 *
 * **The measurement itself is not here any more.** 011 US2 moved it to
 * `web/src/review/laws.ts`, because the review room measures the same four laws
 * inside the same-origin frame it renders a changed route in — and the plan's D2
 * is blunt about why there may only be one copy: *"a second implementation of
 * the four laws is a second answer to the same question, and the two will
 * disagree."* Read that file for the laws, for where each of them came from, and
 * for the two corrections 013 made to what a reader can actually see.
 *
 * What is left here is the adapter, and it is deliberately three lines. The
 * suite's callers are unchanged — `measureLaws(page)` takes a page and answers a
 * `LawReport`, exactly as it did when the body lived in this file — so the move
 * is checkable by the fact that not one assertion of the smoke suite moved with
 * it.
 *
 * **Why the source is shipped as text rather than imported into the page.**
 * `page.evaluate` serialises the function it is given and evaluates it inside
 * the browser, where this repository's module graph does not exist: an imported
 * helper would be `undefined` at the far end. `measureLawsIn` is written to be
 * self-contained for exactly that reason — it closes over nothing but its
 * argument and the browser's own globals — so its own source is a complete
 * program, and this is the whole of what makes the room and the gate measure
 * with one instrument.
 */

import type { Page } from "@playwright/test";
import { measureLawsIn } from "../../../src/review/laws";
import type { LawReport } from "../../../src/review/laws";

export type { LawReport };

/**
 * All four laws over the page's own document, in one pass.
 *
 * The page's `document` and not a frame's: the suite measures the room it
 * navigated to. The review room hands the same function a frame's
 * `contentDocument` instead, which is the only difference between the two
 * callers.
 */
export async function measureLaws(page: Page): Promise<LawReport> {
  return page.evaluate(`(${measureLawsIn.toString()})(document)`) as Promise<LawReport>;
}
