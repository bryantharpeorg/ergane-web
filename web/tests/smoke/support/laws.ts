/**
 * The layout laws, run through Playwright against a whole page.
 *
 * **The measurement itself is not here any more.** It moved to
 * `web/src/review/laws.ts` when 011 US2 gave it a second caller: the review
 * room measures a rendered route inside a same-origin frame and shows the
 * numbers beside it (FR-008), and plan D2 is explicit that a second
 * implementation of the four laws is a second answer to the same question. The
 * numbers an operator reads in that room have to be the numbers this suite
 * asserts against — the ones that found F1, F2 and F3 on 2026-08-25 — or the
 * room is reporting something no gate has ever checked.
 *
 * What is left here is the one thing only a test can do: reach into the page.
 * `page.evaluate` serialises the function it is given with
 * `Function.prototype.toString` and evaluates the text inside the browser, so
 * `measureLawsIn` is handed over whole and runs there. It is called with no
 * argument, and its `doc` parameter defaults to the *page's* own `document` —
 * nothing crosses the wire but the report.
 *
 * That is also why `measureLawsIn` declares every one of its helpers inside its
 * own body. A reference to anything at module scope would compile here and
 * throw `ReferenceError` in the browser, which is a failure mode with no
 * type-checker behind it; the file it lives in says so at length.
 */

import type { Page } from "@playwright/test";

import { measureLawsIn } from "../../../src/review/laws";
import type { LawReport } from "../../../src/review/laws";

export type { LawReport };

/**
 * All four laws, measured in one pass over the page as it is rendered.
 *
 * The explicit `undefined` is the argument, not an omission: `evaluate`'s
 * no-argument overload types the function as taking `void`, and `measureLawsIn`
 * takes an optional `Document`. Passing `undefined` through the two-argument
 * overload says what is actually happening — the page's function is called with
 * nothing, and its default resolves to the page's own `document`.
 */
export async function measureLaws(page: Page): Promise<LawReport> {
  return page.evaluate(measureLawsIn, undefined);
}
