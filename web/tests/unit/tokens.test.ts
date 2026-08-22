import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const tokensRaw = readFileSync(resolve("src/styles/tokens.css"), "utf-8");
const globalRaw = readFileSync(resolve("src/styles/global.css"), "utf-8");

describe("tokens and global styles", () => {
  it("contains every DESIGN.md colour literal", () => {
    const expected = [
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
    for (const hex of expected) {
      expect(tokensRaw.toLowerCase()).toContain(hex.toLowerCase());
    }
  });

  it("never imports or loads a remote stylesheet", () => {
    expect(tokensRaw).not.toContain("@import");
    expect(globalRaw).not.toContain("@import url");
    expect(globalRaw).not.toContain("url(http");
    expect(globalRaw).not.toContain("https://");
  });

  it("honours prefers-reduced-motion", () => {
    expect(globalRaw).toContain("prefers-reduced-motion");
  });
});
