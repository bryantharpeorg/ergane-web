/**
 * The factory's word about an Answer, described without being interpreted.
 *
 * There is deliberately no mapping table in this file. `word` is whatever
 * string arrived — a Question's `BridgeOutcome` ruling, an Escalation press's
 * derived `SIGNAL_FAILED`, or the `resolution` a factory read reported — and it
 * is returned as itself, uppercase as the factory wrote it, including for a
 * string this build has never seen (FR-010, US3-S2). The factory's vocabulary
 * may grow; the pane's honesty must not depend on knowing it, and a table here
 * would be exactly that dependency, quietly turning a word the pane does not
 * know into a friendlier one it made up.
 *
 * `retriable` is the whole of FR-011 and it is one comparison: SIGNAL_FAILED
 * alone, because SIGNAL_FAILED alone means *nothing was recorded*. Every other
 * ruling is the factory having ruled on something, and re-answering a settled
 * item with a stale press is the defect that rule exists to prevent (US3-S4).
 *
 * Pure: no DOM, no fetch, no clock. `web/tests/unit/ruling.test.ts` proves the
 * verbatim rule over arbitrary strings without rendering anything.
 */

import type { AttentionItem, AttentionSettlement } from "../api/floorDocument";

export interface RulingDescription {
  /** The ruling string exactly as received, or null when there is none yet. */
  word: string | null;
  /** True for SIGNAL_FAILED and for nothing else. */
  retriable: boolean;
  /** What the pane can honestly say about that word; may be empty. */
  sentence: string;
}

/** The one ruling the pane may derive, because it is the one it can observe. */
export const SIGNAL_FAILED = "SIGNAL_FAILED";

/** The sentence that makes SIGNAL_FAILED retriable, in as many words. */
export const NOTHING_RECORDED = "nothing was recorded; resending is safe";

/** A press the signal accepted: a question asked of the factory, not an answer. */
export const IN_FLIGHT = "in flight — waiting for the factory's read";

/** Any other ruling: the pane carries it and declines to gloss it. */
export const CARRIED_UNCHANGED = "the factory's word, carried here unchanged";

export function describeRuling(
  kind: AttentionItem["kind"],
  settlement: AttentionSettlement,
): RulingDescription {
  if (kind === "notice") {
    // A Notice asks for nothing, so there is no answer to have ruled on.
    return { word: null, retriable: false, sentence: "" };
  }

  // A press yields no ruling — a signal returns nothing — so an Escalation has
  // only the two words the pane can observe: the SIGNAL_FAILED it derived from
  // the RPC raising, and the resolution a factory read reported (FR-010).
  const pressFailed = kind === "escalation" && settlement.signal === SIGNAL_FAILED;
  const carried = pressFailed ? SIGNAL_FAILED : settlement.ruling;
  const word = carried ?? settlement.resolution ?? null;
  const fromFactoryRead = carried === null && settlement.resolution !== null;

  const retriable = word === SIGNAL_FAILED;

  let sentence = "";
  if (settlement.state === "in_flight") {
    sentence = IN_FLIGHT;
  } else if (retriable) {
    sentence = NOTHING_RECORDED;
  } else if (fromFactoryRead) {
    sentence = `the factory reports ${settlement.resolution}`;
  } else if (word !== null) {
    sentence = CARRIED_UNCHANGED;
  }

  return { word, retriable, sentence };
}
