/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import showfloorCss from "../../src/showfloor/showfloor.css?raw";

/**
 * FR-003 (spec US1-S4): the stage's own rules carry no viewport-derived height.
 *
 * A stage is the size of its graph, and a height that resolves against the
 * window is the one way to lose that silently — `100vh` and `height: 100%` both
 * make the box a function of the screen instead of the document. The sweep
 * reads `web/src/showfloor/showfloor.css` and only that file:
 * `web/src/styles/global.css` is not this story's diff and is not swept here.
 */

const FORBIDDEN = [
  /height\s*:\s*100vh/i,
  /min-height\s*:\s*100vh/i,
  /max-height\s*:\s*100vh/i,
  /height\s*:\s*100%/i,
];

interface Rule {
  selector: string;
  declarations: string;
}

/**
 * Every leaf rule in a stylesheet, comments stripped.
 *
 * `[^{}]` cannot cross a brace, so a nested block — an `@media` wrapper — never
 * matches as a rule of its own and its children match individually.
 */
function rules(css: string): Rule[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: Rule[] = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(withoutComments)) !== null) {
    found.push({ selector: match[1].trim(), declarations: match[2] });
  }
  return found;
}

describe("the Showfloor's stage rules", () => {
  // `.epic-stage`, `.epic-stage-map`, and every rule whose selector reaches a
  // descendant of either.
  const stageRules = rules(showfloorCss).filter((rule) =>
    rule.selector.includes("epic-stage"),
  );

  it("sweeps rules that are really there", () => {
    // A sweep over nothing passes for the wrong reason. The stylesheet declares
    // the stage, its map, and the row an unstaged epic collapses to.
    expect(stageRules.length).toBeGreaterThan(3);
    expect(stageRules.some((rule) => rule.selector.includes(".epic-stage-map"))).toBe(true);
  });

  it("derives no height from the viewport", () => {
    for (const rule of stageRules) {
      for (const forbidden of FORBIDDEN) {
        expect(
          forbidden.test(rule.declarations),
          `${rule.selector} declares ${forbidden}`,
        ).toBe(false);
      }
    }
  });

  it("would catch a viewport-derived height if one were declared", () => {
    // The sweep is only worth its green if it goes red on the thing it forbids.
    const planted = rules(".epic-stage-map { height: 100vh; }");
    expect(planted.length).toBe(1);
    expect(FORBIDDEN.some((forbidden) => forbidden.test(planted[0].declarations))).toBe(true);
    expect(planted[0].selector.includes("epic-stage")).toBe(true);
  });

  it("sizes the map from the computed stage height and nothing else", () => {
    const map = stageRules.find((rule) => rule.selector === ".epic-stage-map");
    expect(map).toBeDefined();
    expect(map!.declarations).toContain("height: var(--stage-height)");
    // The 200px floor is gone: the computed height is the only source (FR-002).
    expect(/min-height/.test(map!.declarations)).toBe(false);
    // DESIGN.md § Layout's stated map width stays.
    expect(map!.declarations).toContain("min-width: 1040px");
  });
});
