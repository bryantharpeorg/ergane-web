/**
 * The style map is total over theme × state, with no catch-all (US3-S6,
 * FR-015). The pane has one palette today, so the dark entries name the same
 * DESIGN.md tokens as the light ones; this test asserts the map's *shape*, so
 * it survives the decision that gives DESIGN.md a dark palette.
 */

import { describe, expect, it } from "vitest";
import {
  NODE_STATES,
  STATE_STYLES,
  UNKNOWN_STYLE,
  resolveStateStyle,
} from "../../src/showfloor/states";
import type { Theme } from "../../src/showfloor/states";

const THEMES: Theme[] = ["light", "dark"];

const ELEVEN = [
  "PENDING",
  "KEY_ISSUED",
  "RUNNING",
  "VERIFYING",
  "PASSED",
  "PR_OPEN",
  "ENQUEUED",
  "MERGED",
  "FAILED",
  "KILLED",
  "WAITING_OPERATOR",
];

describe("the state style map", () => {
  it("has exactly the eleven node states as keys", () => {
    expect(Object.keys(STATE_STYLES).sort()).toEqual([...ELEVEN].sort());
    expect([...NODE_STATES].sort()).toEqual([...ELEVEN].sort());
  });

  it("defines every state in both themes, and none of them falls through to unknown", () => {
    for (const state of NODE_STATES) {
      for (const theme of THEMES) {
        const entry = STATE_STYLES[state][theme];
        expect(entry, `${state} / ${theme}`).toBeDefined();

        const resolved = resolveStateStyle(state, theme);
        expect(resolved.known, `${state} / ${theme}`).toBe(true);
        expect(resolved.style, `${state} / ${theme}`).not.toBe(UNKNOWN_STYLE);
        expect(resolved.style).toBe(entry);

        expect(typeof resolved.style.glyph).toBe("string");
        expect(resolved.style.glyph.length).toBeGreaterThan(0);
        expect(resolved.style.fill.length).toBeGreaterThan(0);
        expect(resolved.style.stroke.length).toBeGreaterThan(0);
        expect(resolved.style.ink.length).toBeGreaterThan(0);
        expect(resolved.style.caption.length).toBeGreaterThan(0);
      }
    }
  });

  it("takes the unknown style only for a state outside the eleven", () => {
    const invented = resolveStateStyle("HIBERNATING", "light");
    expect(invented.known).toBe(false);
    expect(invented.style).toBe(UNKNOWN_STYLE);

    const absent = resolveStateStyle(null, "dark");
    expect(absent.known).toBe(false);
    expect(absent.style).toBe(UNKNOWN_STYLE);
  });
});
