/// <reference types="vite/client" />
/**
 * The second world's token sweep (spec 005 US2-S1, FR-006 / FR-007).
 *
 * **Succeeds `tests/unit/tokens.test.ts`**, deleted in this story's diff. That
 * test asserted the first world's eighteen hexes (`#E3E8E0` sage, `#1F7A78`
 * teal, …) and that the stylesheets loaded nothing remote. Its subject is gone:
 * D-015 (2026-08-24) replaced `DESIGN.md`'s content, so those colours are no
 * longer the design and asserting them would pin the pane to a retired world.
 * What was right about it is kept and strengthened below — the palette is still
 * checked hex by hex, but against `DESIGN.md` itself rather than a copy of it,
 * and "loads nothing remote" now also means "loads no font file", which the old
 * test could not say because the first world vendored four faces.
 *
 * The table in § Colors is the source of truth, parsed here. A token added to
 * `DESIGN.md` and not to the stylesheet fails; a value that drifts from the
 * document fails; a theme block that forgets a token fails.
 *
 * **One case is deleted in 006 US1's diff, with its subject** (FR-003's naming
 * discipline). `keeps the first world's names alive as pointers, never as
 * colours` asserted that `src/styles/tokens.css` — the alias layer this file's
 * own comment called "the Desk's compatibility layer **until spec 006 rewrites
 * the Desk's rules**" — held no hex. 006 US1 rewrites those rules against
 * § Colors directly, so the layer is deleted and there is no file left to
 * assert about. Its guarantee is not dropped: it moves to
 * `tests/unit/deskWorld.test.ts`, and moves up, from "the alias file holds no
 * hex" to "no rule in `global.css` holds a colour outside the three § Colors
 * blocks, and no retired name is reachable to hold one". Nothing else in this
 * file changes; every other case still runs on the same subject.
 */
import { describe, expect, it } from "vitest";
import globalCss from "../../src/styles/global.css?raw";
import indexHtml from "../../index.html?raw";
import designMd from "../../../DESIGN.md?raw";

/** One row of `DESIGN.md` § Colors: `| \`--name\` | \`light\` | \`dark\` | job |`. */
interface ColourToken {
  name: string;
  light: string;
  dark: string;
}

function designColours(): ColourToken[] {
  const rows = [...designMd.matchAll(/^\| `(--[a-z-]+)` \| `(.+?)` \| `(.+?)` \| .+? \|$/gm)];
  return rows.map((row) => ({ name: row[1], light: row[2], dark: row[3] }));
}

/**
 * The body of the first rule whose selector list matches `selector`, with
 * braces balanced so an `@media` wrapper cannot cut a block in half.
 */
function ruleBody(css: string, selector: string): string | null {
  const at = css.indexOf(selector + " {");
  if (at === -1) return null;
  let depth = 0;
  for (let i = at + selector.length + 1; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(at + selector.length + 2, i);
    }
  }
  return null;
}

/** Every `--name: value` declared directly in a rule body. */
function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of body.matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)) {
    out.set(match[1], match[2].split("/*")[0].trim());
  }
  return out;
}

const same = (a: string, b: string) =>
  a.toLowerCase().replace(/\s+/g, "") === b.toLowerCase().replace(/\s+/g, "");

const colours = designColours();

/** The dark half of § Colors' three-block pattern, both of its blocks. */
const DARK_BLOCKS: Array<[string, string]> = [
  [
    'prefers-color-scheme: dark → :root:not([data-theme="light"])',
    ruleBody(
      ruleBody(globalCss, "@media (prefers-color-scheme: dark)") ?? "",
      ':root:not([data-theme="light"])',
    ) ?? "",
  ],
  ['[data-theme="dark"]', ruleBody(globalCss, ':root[data-theme="dark"]') ?? ""],
];

describe("the second world's token layer (FR-006)", () => {
  it("reads a real § Colors table out of DESIGN.md", () => {
    // The sweep below is worthless if the parse found nothing; the table is
    // seventeen rows and every one of them is a token.
    expect(colours.length).toBeGreaterThanOrEqual(17);
    expect(colours.map((token) => token.name)).toContain("--ground");
    expect(colours.map((token) => token.name)).toContain("--shadow");
  });

  it("defines the full set on bare :root, at DESIGN.md's light values", () => {
    const root = declarations(ruleBody(globalCss, ":root") ?? "");
    expect(root.size).toBeGreaterThan(0);

    for (const token of colours) {
      const value = root.get(token.name);
      expect(value, `${token.name} is not defined on bare :root`).toBeDefined();
      expect(
        same(value as string, token.light),
        `${token.name} is ${value} on :root, DESIGN.md says ${token.light}`,
      ).toBe(true);
    }
  });

  for (const [label, body] of DARK_BLOCKS) {
    it(`redefines the full set under ${label}, at DESIGN.md's dark values`, () => {
      const declared = declarations(body);
      expect(declared.size, `${label} is missing or empty`).toBeGreaterThan(0);

      for (const token of colours) {
        const value = declared.get(token.name);
        expect(value, `${token.name} is not redefined under ${label}`).toBeDefined();
        expect(
          same(value as string, token.dark),
          `${token.name} is ${value} under ${label}, DESIGN.md says ${token.dark}`,
        ).toBe(true);
      }
    });
  }

  it("defines no colour only inside a theme block", () => {
    const root = declarations(ruleBody(globalCss, ":root") ?? "");
    for (const [label, body] of DARK_BLOCKS) {
      for (const name of declarations(body).keys()) {
        expect(
          root.has(name),
          `${name} is defined under ${label} and nowhere outside a theme block`,
        ).toBe(true);
      }
    }
  });

  it("grounds the body in the token rather than in a colour of its own", () => {
    const body = ruleBody(globalCss, "body") ?? "";
    expect(body).toContain("background: var(--ground)");
    expect(body).toContain("color: var(--ink)");
  });

  it("carries § Typography's system stacks and its ramp", () => {
    const root = ruleBody(globalCss, ":root") ?? "";
    for (const stack of ["--serif:", "--sans:", "--mono:"]) {
      expect(root).toContain(stack);
    }
    // § Typography › The ramp: "Base 15.5px", and the seven steps off it.
    expect(root).toContain("font-size: 15.5px");
    for (const step of [
      "--t-micro: 0.66rem",
      "--t-chip: 0.62rem",
      "--t-tag: 0.74rem",
      "--t-small: 0.82rem",
      "--t-body: 0.9rem",
      "--t-title: 1.15rem",
      "--t-name: 1.2rem",
      "--t-display: 1.6rem",
    ]) {
      expect(root).toContain(step);
    }
  });
});

/** Every source file the browser could reach, for the font sweep below. */
const sourceFiles = import.meta.glob("../../src/**/*.{ts,tsx,css}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("nothing downloads (FR-007)", () => {
  const files = Object.entries(sourceFiles);

  it("sweeps a real source tree", () => {
    expect(files.length).toBeGreaterThan(20);
    // The stylesheets are the files this sweep exists for; a glob that missed
    // them would pass over the only place a face can be declared.
    expect(files.map(([path]) => path)).toContain("../../src/styles/global.css");
  });

  it("declares no @font-face and names no font file anywhere in web/src", () => {
    for (const [path, source] of files) {
      expect(source, `${path} declares an @font-face`).not.toContain("@font-face");
      expect(source, `${path} names a font file`).not.toContain("fonts/");
      // A face named in a `font-family` is always quoted; the prose above and
      // in `tokens.css` names the retired ones as history, which is the point.
      expect(source, `${path} names a vendored face`).not.toContain('"Red Hat');
    }
  });

  it("links no font stylesheet and nothing remote from the page itself", () => {
    expect(indexHtml).not.toContain('href="/fonts/');
    expect(indexHtml).not.toContain("rel=\"preload\"");
    expect(indexHtml).not.toContain("https://");
  });

  it("imports nothing and fetches no remote resource from the stylesheet", () => {
    expect(globalCss).not.toContain("@import");
    expect(globalCss).not.toContain("url(");
    expect(globalCss).not.toContain("https://");
  });

  it("keeps the one authored motion suppressible", () => {
    // § Motion: the ladder pulse is the pane's only animation and stops under
    // reduced motion. The stylesheets must keep saying so.
    expect(globalCss).toContain("prefers-reduced-motion");
  });
});
