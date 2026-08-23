/**
 * `describeRuling` returns the factory's word and never its own (spec 003 US3).
 *
 * Two properties, and everything else in this file serves them. First: for any
 * string whatsoever, `word` comes back identical to what went in — asserted over
 * the enumerated rulings, over the `BridgeOutcome` members the spec does not
 * enumerate, and over strings no factory has ever said, because the guarantee is
 * about the *absence* of a mapping table rather than about a list (US3-S2).
 * Second: `retriable` is true for SIGNAL_FAILED and false for everything else,
 * which is the control against a stale press re-answering a settled item
 * (US3-S4, FR-011).
 */

import { describe, expect, it } from "vitest";
import {
  CARRIED_UNCHANGED,
  IN_FLIGHT,
  NOTHING_RECORDED,
  SIGNAL_FAILED,
  describeRuling,
} from "../../src/desk/ruling";
import type { AttentionSettlement } from "../../src/api/floorDocument";

const ENUMERATED = [
  "RESOLVED",
  "UNKNOWN",
  "ALREADY_RESOLVED",
  "EXPIRED",
  "UNAUTHORIZED",
  "SIGNAL_FAILED",
];

/** Members of `BridgeOutcome` the spec does not enumerate, plus invented ones. */
const UNENUMERATED = [
  "MALFORMED",
  "INVALID_CHOICE",
  "BRIDGE_ERROR",
  "A_WORD_THE_FACTORY_MAY_SAY_LATER",
  "lowercase_word",
  "with spaces and punctuation!",
  "",
];

function settlement(patch: Partial<AttentionSettlement> = {}): AttentionSettlement {
  return {
    state: "ruled",
    ruling: null,
    signal: null,
    pressed_choice: null,
    resolution: null,
    ...patch,
  };
}

describe("the word is the input, whatever the input was", () => {
  it.each([...ENUMERATED, ...UNENUMERATED])("returns %j unchanged", (ruling) => {
    const described = describeRuling("question", settlement({ ruling }));

    expect(described.word).toBe(ruling);
  });

  it("returns null when the factory has said nothing yet", () => {
    expect(describeRuling("question", settlement({ state: "waiting" })).word).toBeNull();
    expect(describeRuling("escalation", settlement({ state: "waiting" })).word).toBeNull();
    expect(describeRuling("notice", settlement({ state: "none" })).word).toBeNull();
  });

  it("carries a factory read's resolution through verbatim too", () => {
    for (const resolution of ["ANSWERED", "EXPIRED", "KILL", "A_LATER_WORD"]) {
      expect(describeRuling("question", settlement({ resolution })).word).toBe(resolution);
      expect(describeRuling("escalation", settlement({ resolution })).word).toBe(resolution);
    }
  });
});

describe("SIGNAL_FAILED is retriable and nothing else is", () => {
  it("is retriable when a Question's ruling was SIGNAL_FAILED", () => {
    const described = describeRuling("question", settlement({ ruling: SIGNAL_FAILED }));

    expect(described.retriable).toBe(true);
    expect(described.sentence).toBe(NOTHING_RECORDED);
    expect(described.sentence).toContain("nothing was recorded");
    expect(described.sentence).toContain("resending is safe");
  });

  it("is retriable when a press's signal RPC raised", () => {
    const described = describeRuling(
      "escalation",
      settlement({ signal: SIGNAL_FAILED, pressed_choice: "RETRY" }),
    );

    expect(described.word).toBe(SIGNAL_FAILED);
    expect(described.retriable).toBe(true);
    expect(described.sentence).toBe(NOTHING_RECORDED);
  });

  it.each([...ENUMERATED.filter((r) => r !== SIGNAL_FAILED), ...UNENUMERATED])(
    "is not retriable for %j",
    (ruling) => {
      expect(describeRuling("question", settlement({ ruling })).retriable).toBe(false);
    },
  );

  it("is not retriable for a resolution the factory read reported", () => {
    for (const resolution of ["ANSWERED", "EXPIRED", "KILL"]) {
      expect(describeRuling("escalation", settlement({ resolution })).retriable).toBe(false);
    }
  });
});

describe("the sentence says only what the pane can observe", () => {
  it("says a press is in flight while the factory has not yet read it back", () => {
    const described = describeRuling(
      "escalation",
      settlement({ state: "in_flight", signal: "accepted", pressed_choice: "RETRY" }),
    );

    expect(described.sentence).toBe(IN_FLIGHT);
    // A signal returns nothing, so an accepted press has produced no ruling —
    // and the pane mints none for it (FR-010).
    expect(described.word).toBeNull();
    expect(described.retriable).toBe(false);
  });

  it("attributes a resolution to the factory rather than stating it as its own", () => {
    const described = describeRuling("escalation", settlement({ resolution: "KILL" }));

    expect(described.sentence).toBe("the factory reports KILL");
  });

  it("declines to gloss any other ruling", () => {
    for (const ruling of ["RESOLVED", "UNAUTHORIZED", "A_WORD_THE_FACTORY_MAY_SAY_LATER"]) {
      expect(describeRuling("question", settlement({ ruling })).sentence).toBe(
        CARRIED_UNCHANGED,
      );
    }
  });

  it("says nothing at all about a Notice, which asks for nothing", () => {
    const described = describeRuling("notice", settlement({ state: "none" }));

    expect(described).toEqual({ word: null, retriable: false, sentence: "" });
  });
});
