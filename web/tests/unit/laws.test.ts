/**
 * The one measurement, and the two properties that keep it usable (011 US2).
 *
 * Plan D2: "measure with the harness that already found the defects … A second
 * implementation of the four laws is a second answer to the same question, and
 * the two will disagree." `measureLawsIn` is that harness, moved out of the
 * smoke suite's support directory so the review room can run it inside a frame
 * (FR-008) while `page.evaluate` keeps running it against a whole page.
 *
 * Two callers, two properties, and neither has a type-checker behind it:
 *
 * 1. **It measures the document it is handed.** A `document.` left anywhere in
 *    the body would compile, would pass every existing smoke test — where the
 *    ambient document *is* the one being measured — and would silently make the
 *    review room report the room's own geometry as the frame's. Every figure
 *    FR-008 puts on the screen would then be a number about the wrong screen.
 *
 * 2. **It is self-contained.** `page.evaluate` serialises the function with
 *    `Function.prototype.toString` and evaluates the text in the browser, where
 *    this module's scope does not exist. A helper hoisted out of the body to
 *    tidy the file would throw `ReferenceError` in Chromium and nowhere else —
 *    at gate time, in a suite that had passed locally.
 *
 * The second is asserted the way the browser would find out: the function is
 * round-tripped through its own source text, which strips its closure, and then
 * run. Nothing else in this repository proves that.
 */

import { describe, expect, it } from "vitest";

import { FRAME_THEMES, FRAME_WIDTHS, lawResults, measureLawsIn } from "../../src/review/laws";
import type { LawReport } from "../../src/review/laws";

const source = import.meta.glob("../../src/review/laws.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** The file with its comments removed: what ships, not what it says about it. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** The body of `measureLawsIn`, as the browser would receive it. */
function body(): string {
  const text = measureLawsIn.toString();
  expect(text, "the function was not serialisable at all").toContain("measureLawsIn");
  return text;
}

describe("the measurement reads the document it is handed (FR-008)", () => {
  it("names no ambient document anywhere in its source", () => {
    const file = Object.values(source)[0];
    expect(file, "web/src/review/laws.ts was not read").toBeDefined();

    // The default parameter `doc: Document = document` is the one permitted
    // mention, and it is a bare identifier rather than a property access — so
    // the sweep is for reaching *into* the ambient document, which is the thing
    // that would make the room measure itself.
    const reaches = [...code(file).matchAll(/(?<![.\w$])document\s*\./g)];
    expect(
      reaches,
      "laws.ts reaches into the ambient document; the frame's numbers would be the room's",
    ).toHaveLength(0);
  });

  it("still takes the ambient document when it is called with nothing", () => {
    // Which is what `page.evaluate` does. The smoke suite depends on it.
    const report = measureLawsIn();
    expect(report.viewport).toBe(document.documentElement.clientWidth);
  });

  it("reports a document with nothing in it as nothing measured, not as clean", () => {
    const frame = document.createElement("iframe");
    document.body.appendChild(frame);
    const inner = frame.contentDocument!;
    try {
      const report = measureLawsIn(inner);
      // A separate document really was walked: the report is about `inner`,
      // which holds no text, and not about the page this suite runs in.
      expect(report.leaves).toBe(0);
      expect(report.swept).toBe(0);
    } finally {
      frame.remove();
    }
  });
});

describe("the measurement survives being sent to a browser", () => {
  it("references nothing at module scope, so page.evaluate can run it", () => {
    // The round trip is the point: `new Function` builds a function whose scope
    // is the global one, exactly as evaluating the serialised text in a page
    // does. A reference to an import, a constant or a helper outside the body
    // throws here for the same reason it would throw in Chromium.
    const rebuilt = new Function(`return (${body()})`)() as typeof measureLawsIn;
    expect(() => rebuilt(document)).not.toThrow();
  });

  it("declares its helpers inside its own body", () => {
    const text = body();
    for (const helper of ["const describe =", "const painted =", "const clipped ="]) {
      expect(text, `${helper} was hoisted out of the serialised body`).toContain(helper);
    }
  });
});

describe("the four laws are reported as counts, never as a verdict", () => {
  const report: LawReport = {
    swept: 40,
    leaves: 18,
    painters: 6,
    escaped: ["div.card at [12, 940] outside stage [12, 700]"],
    past: [],
    overlapping: ["span.a × span.b"],
    occluded: [],
    documentScrollWidth: 1280,
    roomScrollsSideways: false,
    viewport: 1280,
  };

  it("names all four, in the order they are measured", () => {
    expect(lawResults(report).map((law) => law.key)).toEqual([
      "escaped",
      "past",
      "overlapping",
      "occluded",
    ]);
  });

  it("carries the count and the descriptions, not a boolean", () => {
    const [escaped, past] = lawResults(report);
    expect(escaped.violations).toBe(1);
    expect(escaped.detail).toEqual(report.escaped);
    // Zero is a number the operator can read; there is no `passed` field for a
    // room to render a tick from (§ The review room).
    expect(past.violations).toBe(0);
    expect(Object.keys(past)).toEqual(["key", "law", "violations", "detail"]);
  });
});

describe("the room offers exactly the widths and themes the suite sweeps", () => {
  it("declares the three widths in one place", () => {
    // `showfloor.spec.ts`, `desk-world.spec.ts` and `draft.spec.ts` all sweep
    // these three. A room that offered a fourth would let an operator find a
    // defect no gate can be made to reproduce.
    expect([...FRAME_WIDTHS]).toEqual([1280, 1600, 2560]);
  });

  it("declares both themes DESIGN.md renders", () => {
    expect([...FRAME_THEMES]).toEqual(["light", "dark"]);
  });
});
