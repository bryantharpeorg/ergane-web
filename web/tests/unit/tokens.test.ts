import { describe, it, expect } from "vitest";
import tokensRaw from "../../src/styles/tokens.css?raw";
import globalRaw from "../../src/styles/global.css?raw";

const DESIGN_COLORS = [
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
] as const;

describe("tokens.css carries DESIGN.md colours", () => {
  it("raw imports loaded string content", () => {
    expect(typeof tokensRaw).toBe("string");
    expect(tokensRaw.length).toBeGreaterThan(0);
    expect(typeof globalRaw).toBe("string");
    expect(globalRaw.length).toBeGreaterThan(0);
  });

  it.each(DESIGN_COLORS)("contains %s", (hex) => {
    expect(tokensRaw.toLowerCase()).toContain(hex.toLowerCase());
  });

  it("contains all token names from DESIGN.md", () => {
    const names = [
      "--ground",
      "--panel",
      "--panel-deep",
      "--ink",
      "--ink-soft",
      "--rule",
      "--walnut",
      "--teal",
      "--teal-ink",
      "--mustard",
      "--mustard-ink",
      "--olive",
      "--olive-ink",
      "--orange",
      "--orange-ink",
      "--aqua",
      "--aqua-ink",
      "--white",
    ];
    for (const name of names) {
      expect(tokensRaw).toContain(name);
    }
  });

  it("contains the spacing, radius and shadow tokens", () => {
    for (const name of ["--radius", "--chip", "--shadow", "--ease-out"]) {
      expect(tokensRaw).toContain(name);
    }
    for (const face of ["--display", "--text", "--mono"]) {
      expect(tokensRaw).toContain(face);
    }
    for (let i = 1; i <= 7; i++) {
      expect(tokensRaw).toContain(`--s${i}`);
    }
    for (const step of ["clock", "display", "headline", "body", "small", "micro"]) {
      expect(tokensRaw).toContain(`--fs-${step}`);
    }
  });
});

describe("stylesheets are self-hosted", () => {
  it("tokens.css has no @import or remote URL", () => {
    expect(tokensRaw).not.toContain("@import");
    expect(tokensRaw).not.toContain("url(http");
    expect(tokensRaw).not.toContain("https://");
  });

  it("global.css has no remote URL and honours reduced motion", () => {
    expect(globalRaw).not.toContain("@import");
    expect(globalRaw).not.toContain("url(http");
    expect(globalRaw).not.toContain("https://");
    expect(globalRaw).toContain("prefers-reduced-motion");
  });
});
