/// <reference types="vite/client" />
/**
 * The stage's own rules (005 US3, FR-011 / FR-012 / FR-014).
 *
 * **This file replaces its own 002-era cases**, deleted in this story's diff:
 * "sweeps rules that are really there", "sizes the map from the computed stage
 * height and nothing else", and the two around them, which read
 * `.epic-stage`/`.epic-stage-map` — the React Flow surface and the 1040px map
 * D-015 replaced and T016 deleted. `height: var(--stage-height)` and
 * `min-width: 1040px` are not the design any more, so asserting them would pin
 * the pane to a retired world.
 *
 * What that file was *right* about is kept and widened. Its rule — a stage is
 * the size of its graph, and a height that resolves against the window is how
 * you lose that silently — is now swept over the whole rebuilt stage rather
 * than the map alone, and the figures DESIGN.md names for the new components
 * are checked against the document beside it.
 *
 * This is a stylesheet sweep, not a render: it proves the rules the diff
 * commits. What they *do* to real boxes is FR-014's three laws, in a browser,
 * in `tests/smoke/showfloor.spec.ts`.
 */
import { describe, expect, it } from "vitest";
import showfloorCss from "../../src/showfloor/showfloor.css?raw";

/**
 * A box whose height resolves against the window rather than its content.
 * `100%` is included for the same reason it was in 002: it makes a box a
 * function of its ancestor chain, which ends at the viewport.
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

const all = rules(showfloorCss);

/** The selectors one rule is written for, a comma list split back apart. */
function selectorsOf(rule: Rule): string[] {
  return rule.selector.split(",").map((one) => one.trim());
}

/**
 * Everything the sheet declares for one selector, wherever it declares it.
 *
 * **014 US3 widened this and did not weaken it.** Every assertion below is the
 * one it always was — the figures are still DESIGN.md's and are still read off
 * the selector DESIGN.md's rule is written for. What changed underneath is that
 * a stage rule is now written for *two* rooms (`.showfloor .node, .draft .node`),
 * because the drafting table stages a compiled Work Graph with the same assets
 * and a copied rule would be a second declaration of one design. An exact-string
 * lookup could not see a selector inside a list, and splitting the list is what
 * lets it.
 *
 * Joining every matching rule rather than taking the first is the other half:
 * the Showfloor's four control resets moved into a rule of their own in that
 * diff (its card is a `<button>`; the drafting table's is not), so what
 * `.showfloor .node` declares is now spread over two rules and this reads both.
 * The lookup still fails loudly when nothing declares the selector at all.
 */
const find = (selector: string): Rule => {
  const matching = all.filter((candidate) => selectorsOf(candidate).includes(selector));
  expect(matching.length, `${selector} is declared`).toBeGreaterThan(0);
  return { selector, declarations: matching.map((rule) => rule.declarations).join("\n") };
};

/** The stage, its canvas, and everything the canvas holds. */
const stageRules = all.filter((rule) =>
  /\.stage\b|\.dag\b|\.dag-scroll|\.ranks|\.rank\b|\.node\b|\.ladder|\.wire|\.metric/.test(
    rule.selector,
  ),
);

describe("the stage is the size of its graph", () => {
  it("sweeps rules that are really there", () => {
    // A sweep over nothing passes for the wrong reason.
    expect(stageRules.length).toBeGreaterThan(10);
    expect(stageRules.some((rule) => rule.selector.includes(".dag"))).toBe(true);
    expect(stageRules.some((rule) => rule.selector.includes(".node"))).toBe(true);
  });

  it("derives no height from the viewport, anywhere on the stage", () => {
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
    const planted = rules(".showfloor .dag { height: 100vh; }");
    expect(planted.length).toBe(1);
    expect(FORBIDDEN.some((forbidden) => forbidden.test(planted[0].declarations))).toBe(true);
    expect(/\.dag\b/.test(planted[0].selector)).toBe(true);
  });

  it("sizes the canvas from its content and imposes no width on it", () => {
    // "Compute layout from content — a stage is the size of its graph"
    // (§ Do's and Don'ts). No 1040px floor, no viewport unit, no fixed height.
    const dag = find(".showfloor .dag");
    expect(dag.declarations).toContain("width: max-content");
    expect(dag.declarations).toContain("position: relative");
    expect(/height\s*:/.test(dag.declarations)).toBe(false);
    expect(/\d+px/.test(dag.declarations.replace(/padding[^;]*;/g, ""))).toBe(false);
  });

  it("scrolls the graph horizontally rather than letting it escape", () => {
    // § Stage: "The stage scrolls horizontally when a graph outgrows it." This
    // wrapper is also the "scrolling ancestor" FR-014's containment law allows
    // a wide graph to live inside, so the axis has to be the declared one.
    const scroll = find(".showfloor .dag-scroll");
    expect(scroll.declarations).toContain("overflow-x: auto");
    expect(scroll.declarations).toContain("overflow-y: hidden");
    expect(scroll.declarations).toContain("min-width: 0");

    // And the track it sits in can shrink below its content, or the column
    // would push the detail pane off the frame instead.
    expect(find(".showfloor .stage").declarations).toContain("min-width: 0");
  });
});

describe("the figures are DESIGN.md's", () => {
  it("draws node cards at the stated width, radius and shadow", () => {
    // § Stage: "node cards `11.5rem` wide"; § Shapes: "2px radius on cards";
    // § Elevation & Depth: "one lift: `--shadow` on stage node cards".
    const node = find(".showfloor .node");
    expect(node.declarations).toContain("width: 11.5rem");
    expect(node.declarations).toContain("border-radius: 2px");
    expect(node.declarations).toContain("box-shadow: var(--shadow)");
    // No second shadow, no glass, no gradient (§ Don't).
    expect(/gradient|backdrop-filter/.test(showfloorCss)).toBe(false);
  });

  it("gaps the ranks at the stated rhythm", () => {
    // § Layout: "stage rank gap `1.6rem`".
    expect(find(".showfloor .ranks").declarations).toContain("gap: 1.6rem");
  });

  it("builds the ladder from 4px bars with 3px gaps", () => {
    // § The status ladder: "six `4px`-tall bars with `3px` gaps".
    expect(find(".showfloor .ladder").declarations).toContain("gap: 3px");
    expect(find(".showfloor .ladder i").declarations).toContain("height: 4px");

    // The four fills, each its own token — and `ahead` is the `--sunken` the
    // bare bar already carries, which is why there is no fifth class.
    expect(find(".showfloor .ladder i").declarations).toContain("background: var(--sunken)");
    expect(find(".showfloor .ladder i.done").declarations).toContain("var(--olive)");
    expect(find(".showfloor .ladder i.now").declarations).toContain("var(--accent)");
    expect(find(".showfloor .ladder i.hold").declarations).toContain("var(--gold)");
  });

  it("strokes merge edges solid olive and pass edges dashed rule", () => {
    // § Stage: "merge edges solid 2px olive, pass edges dashed 2px `--rule`".
    const wire = find(".showfloor .dag .wire");
    expect(wire.declarations).toContain("stroke-width: 2");
    expect(wire.declarations).toContain("fill: none");
    expect(/stroke-dasharray/.test(wire.declarations)).toBe(false);

    const merge = find(".showfloor .dag .wire.merge");
    expect(merge.declarations).toContain("stroke: var(--olive)");
    expect(/stroke-dasharray/.test(merge.declarations)).toBe(false);

    const pass = find(".showfloor .dag .wire.pass");
    expect(pass.declarations).toContain("stroke: var(--rule)");
    expect(pass.declarations).toContain("stroke-dasharray");
  });

  it("keeps the wires behind the cards and out of the pointer's way", () => {
    const wires = find(".showfloor .dag .wires");
    expect(wires.declarations).toContain("pointer-events: none");
    expect(wires.declarations).toContain("position: absolute");
    expect(wires.declarations).toContain("inset: 0");
  });

  it("authors the one animation, inside the reduced-motion gate", () => {
    // § Motion: "Exactly one authored motion: the active ladder stop's 1.6s
    // opacity pulse", suppressed under `prefers-reduced-motion`. Authoring it
    // inside the no-preference gate is what makes the suppression unforgettable.
    const animated = all.filter((rule) => /animation\s*:/.test(rule.declarations));
    expect(animated.length).toBe(1);
    expect(animated[0].selector).toContain(".ladder i.now");
    expect(animated[0].declarations).toContain("1.6s");

    const gate = showfloorCss.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(gate).toBeGreaterThan(-1);
    expect(showfloorCss.indexOf("animation:")).toBeGreaterThan(gate);
  });
});

/**
 * The stage assets are worn by two rooms, from one declaration (014 US3).
 *
 * `DESIGN.md` § The drafting table: "A compiled Work Graph draws with the
 * Showfloor's stage assets and the same two edge strokes, with every node in the
 * unlit form." The drafting table therefore wears these rules — and the way it
 * must *not* wear them is by copying them, which is how two rooms come to draw
 * two different cards after one of them is corrected.
 *
 * The second half is the one worth a test of its own. **The run's clothing is
 * not shared.** The chip, the ladder and its fills, the selection outline, the
 * focus ring and the control resets all describe work that has happened; a graph
 * that has not dispatched has none of it, and DESIGN.md forbids inventing a
 * glyph for the absence: "Do not add a twelfth glyph for 'not yet': that is the
 * absence of state, not a state." A rule that quietly grew a `.draft` selector
 * would put a run's clothing on a node that has never run.
 */
describe("the drafting table shares the stage's assets, not the run's clothing", () => {
  /** Every rule in this sheet the drafting table is also written for. */
  const shared = all.filter((rule) =>
    selectorsOf(rule).some((one) => one.startsWith(".draft ")),
  );

  it("shares the canvas, the ranks, the two strokes and the card", () => {
    const draftSelectors = shared.flatMap(selectorsOf).filter((one) => one.startsWith(".draft "));
    for (const asset of [
      ".draft .dag-scroll",
      ".draft .dag",
      ".draft .dag .wires",
      ".draft .dag .wire",
      ".draft .dag .wire.merge",
      ".draft .dag .wire.pass",
      ".draft .ranks",
      ".draft .rank",
      ".draft .node",
      ".draft .node .nid",
      ".draft .node .ntitle",
      ".draft .node .nsub",
    ]) {
      expect(draftSelectors, `${asset} draws with the Showfloor's own rule`).toContain(asset);
    }
  });

  it("declares each of them once, for both rooms, rather than twice", () => {
    // The whole point: every rule the drafting table wears also names the
    // Showfloor, so there is one declaration of one design and one place to
    // change it. A `.draft` rule standing alone would be the copy.
    for (const rule of shared) {
      expect(
        selectorsOf(rule).some((one) => one.startsWith(".showfloor ")),
        `${rule.selector} is the drafting table's own copy of a stage rule`,
      ).toBe(true);
    }
    expect(shared.length).toBeGreaterThan(10);
  });

  it("dresses no node of an undispatched graph in a run's clothing", () => {
    // Each of these describes work that has happened. None may reach a room
    // whose graph has not run.
    for (const run of [".chip", ".ladder", ".node.sel", ".node:focus-visible", ".metric"]) {
      const leaked = shared.filter((rule) =>
        selectorsOf(rule).some((one) => one.startsWith(".draft ") && one.includes(run)),
      );
      expect(
        leaked.map((rule) => rule.selector),
        `${run} is a run's clothing and the unlit stage must not wear it`,
      ).toEqual([]);
    }

    // And the control resets are the Showfloor's alone: its card is a
    // `<button>` because a pick fills its detail pane, and a `cursor: pointer`
    // in a room with no selection advertises a verb it does not have.
    for (const rule of shared) {
      expect(
        /cursor\s*:\s*pointer/.test(rule.declarations),
        `${rule.selector} makes an unlit card look like a control`,
      ).toBe(false);
    }
  });
});

describe("the first world's room is gone from this stylesheet", () => {
  it("declares no rule for a component this story deleted", () => {
    // Selectors only: the comment at the head of the block names what was
    // deleted on purpose, and a sweep that could not tell a comment from a rule
    // would forbid saying so.
    const selectors = all.map((rule) => rule.selector).join(" ");

    // T016 deletes seven modules; a stylesheet still dressing their DOM would
    // be a second copy of a retired world, and the next reader's trap.
    for (const gone of [
      "epic-stage",
      "landing-line",
      "landing-station",
      "landed-shelf",
      "station-body",
      "react-flow",
      "edge-pass",
      "edge-merge",
      "legend-entry",
    ]) {
      expect(selectors, `${gone} outlived its component`).not.toContain(gone);
    }
  });
});
