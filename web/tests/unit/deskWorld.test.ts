/// <reference types="vite/client" />
/**
 * The Desk's rules speak § Colors directly (006 US1, FR-002).
 *
 * **Succeeds `tokens2.test.ts`'s "keeps the first world's names alive as
 * pointers" case**, which is deleted in this story's diff along with its
 * subject. That case guarded `styles/tokens.css`, the alias layer 005 left
 * behind so the Desk could wear the new world's colours before anyone restyled
 * it — and it said in as many words what would end it: "`tokens.css` is the
 * Desk's compatibility layer **until spec 006 rewrites the Desk's rules**". US1
 * rewrites them, so the layer is gone and the guarantee it carried moves here,
 * strengthened: instead of "the alias file holds no hex", the sweep below is
 * **no rule anywhere in `global.css` holds a colour at all outside the three
 * § Colors blocks**, and no retired first-world name is reachable to hold one.
 *
 * Everything `tokens2.test.ts` asserts about the token blocks themselves — the
 * palette parsed out of `DESIGN.md` hex by hex, the three-block pattern, the
 * ramp, the font sweep — is untouched and still runs.
 */
import { describe, expect, it } from "vitest";
import globalCss from "../../src/styles/global.css?raw";

/**
 * The stylesheet with its three § Colors blocks removed.
 *
 * Those blocks are the one place a literal belongs: they are the tokens. What
 * is left is every rule that *uses* colour, and none of it may name one. The
 * walk is brace-balanced rather than a pattern, so the dark block's `@media`
 * wrapper cannot leave half a block behind for the sweep to pass over.
 */
function rulesOnly(css: string): string {
  let out = "";
  let prelude = "";
  let body = "";
  let depth = 0;
  for (const character of css) {
    if (depth === 0) {
      if (character === "{") {
        depth = 1;
        body = "{";
      } else {
        prelude += character;
      }
      continue;
    }
    body += character;
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        // Every § Colors block names `:root`, in its prelude or inside its
        // theme wrapper; nothing else in the file does.
        if (!(prelude + body).includes(":root")) out += prelude + body;
        prelude = "";
        body = "";
      }
    }
  }
  return out + prelude;
}

/** Every declaration's value, comments stripped — what actually ships. */
function values(css: string): string[] {
  return [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/:\s*([^;{}]+);/g)].map((m) =>
    m[1].trim(),
  );
}

describe("no colour literal outside the token set (FR-002)", () => {
  it("sweeps a stylesheet that is really there", () => {
    // A sweep whose parse ate the file passes vacuously — the defect 001 US1-S1
    // exists to prevent, in its unit-test shape.
    const rules = rulesOnly(globalCss);
    expect(rules).toContain(".desk-frame");
    expect(rules).toContain(".attention .item");
    expect(rules).toContain(".desk .chip.landed");
    // And the token blocks really did come out of it.
    expect(rules).not.toContain("--ground: #");
    expect(values(rules).length).toBeGreaterThan(100);
  });

  it("names no hex, rgb or hsl in any rule of the Desk's own", () => {
    for (const value of values(rulesOnly(globalCss))) {
      expect(value, `${value} is a colour literal`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(value, `${value} is a colour literal`).not.toMatch(/\brgba?\(/);
      expect(value, `${value} is a colour literal`).not.toMatch(/\bhsla?\(/);
    }
  });

  it("reaches for no retired first-world token", () => {
    // The alias layer is deleted; a rule still asking for one of its names would
    // resolve to nothing and render an unstyled surface rather than fail loudly.
    // Declarations only: the file's own comments name the retired tokens on
    // purpose, so that what left is legible to whoever reads it next.
    const declared = values(rulesOnly(globalCss)).join("\n");
    for (const retired of [
      "--panel",
      "--panel-deep",
      "--ink-soft",
      "--walnut",
      "--white",
      "--teal",
      "--mustard",
      "--aqua",
      "--orange",
      "--olive-ink",
      "--display",
      "--text)",
      "--fs-",
      "var(--radius)",
      "--ease-out",
      "var(--s1)",
      "var(--s4)",
      "var(--chip)",
    ]) {
      expect(declared, `global.css still reaches for ${retired}`).not.toContain(retired);
    }
  });

  it("draws with none of the devices D-015 forbids", () => {
    // § Do's and Don'ts: "Don't use gradients, glass, glow, or a second shadow."
    // The first world's eleven chevron glyphs used two gradients and its token
    // dot a second shadow; § Elevation leaves exactly one, on the frame.
    const rules = rulesOnly(globalCss);
    expect(rules).not.toContain("gradient(");
    expect(rules).not.toContain("backdrop-filter");
    // One shadow in the whole file, and it is the token's, on the app frame.
    const shadows = [...rules.matchAll(/box-shadow:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(shadows).toEqual(["var(--shadow)"]);
  });

  it("declares the § Chips vocabulary and no seventh word", () => {
    // § Chips' six rows, each over its own wash, plus the Unknown Rule's italic
    // muted for a word the vocabulary does not name.
    const expected: Record<string, string> = {
      landed: "--olive",
      building: "--accent",
      ready: "--muted",
      draft: "--faint",
      wait: "--gold",
      dead: "--alarm",
    };
    for (const [tone, ink] of Object.entries(expected)) {
      const rule = new RegExp(`\\.desk \\.chip\\.${tone}\\s*\\{[^}]*color:\\s*var\\(${ink}\\)`);
      expect(globalCss, `the ${tone} chip`).toMatch(rule);
    }
    const tones = [...globalCss.matchAll(/\.desk \.chip\.([a-z]+)/g)].map((m) => m[1]);
    expect(new Set(tones)).toEqual(
      new Set(["landed", "building", "ready", "draft", "wait", "dead", "unknown"]),
    );
  });
});
