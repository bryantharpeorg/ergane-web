import { describe, expect, it } from "vitest";

import tokensRaw from "../../src/styles/tokens.css?raw";
import globalRaw from "../../src/styles/global.css?raw";

const COMBINED = `${tokensRaw}\n${globalRaw}`;

const DESIGN_HEXES = [
  "#E3E8E0",
  "#F4F6F1",
  "#D2D9CE",
  "#23292A",
  "#5C6962",
  "#BDC7BA",
  "#3E4A3C",
  "#1F7A78",
  "#0E4F4D",
  "#D9A521",
  "#7A5A06",
  "#6E7F3E",
  "#415022",
  "#B9774F",
  "#7A4A2B",
  "#8FB8C9",
  "#3E6C80",
  "#FFFFFF",
];

describe("design tokens", () => {
  it("contains every colour from DESIGN.md", () => {
    for (const hex of DESIGN_HEXES) {
      expect(COMBINED).toContain(hex);
    }
  });

  it("does not load remote resources", () => {
    for (const src of [tokensRaw, globalRaw]) {
      expect(src).not.toContain("@import");
      expect(src).not.toContain("url(http");
      expect(src).not.toContain("https://");
    }
  });

  it("honours reduced motion", () => {
    expect(globalRaw).toContain("prefers-reduced-motion");
  });
});
