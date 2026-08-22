import { describe, expect, it } from "vitest";
import tokens from "../../src/styles/tokens.css?raw";
import globalCss from "../../src/styles/global.css?raw";

const designColors = [
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

describe("tokens.css", () => {
  it("contains all DESIGN.md hex colours", () => {
    const lower = tokens.toLowerCase();
    for (const hex of designColors) {
      expect(lower).toContain(hex.toLowerCase());
    }
  });

  it("never loads a remote stylesheet", () => {
    expect(tokens).not.toContain("@import");
    expect(tokens).not.toContain("url(http");
    expect(tokens).not.toContain("https://");
    expect(globalCss).not.toContain("@import url");
    expect(globalCss).not.toContain("https://");
  });

  it("carries the reduced-motion rule", () => {
    expect(globalCss).toContain("prefers-reduced-motion");
  });
});
