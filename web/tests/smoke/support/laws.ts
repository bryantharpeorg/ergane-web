/**
 * The four layout laws, run against a Playwright page.
 *
 * **The measurement itself is no longer here.** It moved to
 * `web/src/layoutLaws.ts` in 011 US2, and that file's own header carries the
 * whole history of the four — DESIGN.md § Layout's authority, the 004 defects
 * that bought (a), (b) and (c), D-018's (d), and 013 US3's two corrections to
 * `clipped()` and `painted()`. Read it there; nothing about the laws changed
 * in the move.
 *
 * What changed is who else runs them. The review room measures a same-origin
 * frame in the operator's own browser at runtime (D-023, 011 FR-008), and
 * production code cannot import from `web/tests/`. So the measurement lives
 * under `src/` and this file is what it looked like to a Playwright suite: one
 * `evaluate`, against the page's own `document`.
 *
 * **`toString()`, deliberately.** `page.evaluate` runs its argument inside the
 * browser, where this module's imports do not exist — so the function is
 * serialised and applied to `document` there. That is also why
 * `measureLawsIn` closes over nothing: a helper at its module scope would be
 * `undefined` in the page.
 *
 * The alternative was a second copy of the four laws, one for the suite and one
 * for the room. Plan D2 refuses it in as many words: *"a second implementation
 * of the four laws is a second answer to the same question, and the two will
 * disagree."* The room's whole value is that its numbers are the gate's
 * numbers.
 */

import type { Page } from "@playwright/test";
import { measureLawsIn } from "../../../src/layoutLaws";
import type { LawReport } from "../../../src/layoutLaws";

export type { LawReport };

/**
 * All four laws, measured in one pass over the rendered page.
 *
 * One `evaluate` rather than four: the boxes have to come from a single
 * layout, or a law could pass against a layout a later law never saw.
 */
export async function measureLaws(page: Page): Promise<LawReport> {
  return page.evaluate<LawReport>(`(${measureLawsIn.toString()})(document)`);
}
