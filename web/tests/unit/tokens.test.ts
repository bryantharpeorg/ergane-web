/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import tokensCss from "../../src/styles/tokens.css?raw";
import globalCss from "../../src/styles/global.css?raw";

describe("design tokens", () => {
  it("carries every DESIGN.md colour and loads no remote resource", () => {
    const colours = [
      "#E3E8E0", // ground
      "#F4F6F1", // panel
      "#D2D9CE", // panel-deep
      "#23292A", // ink
      "#5C6962", // ink-soft
      "#BDC7BA", // rule
      "#3E4A3C", // walnut
      "#1F7A78", // teal
      "#0E4F4D", // teal-ink
      "#D9A521", // mustard
      "#7A5A06", // mustard-ink
      "#6E7F3E", // olive
      "#415022", // olive-ink
      "#B9774F", // orange/clay
      "#7A4A2B", // orange-ink/clay-ink
      "#8FB8C9", // aqua
      "#3E6C80", // aqua-ink
      "#FFFFFF", // white
    ];

    for (const hex of colours) {
      expect((tokensCss + globalCss).toLowerCase()).toContain(hex.toLowerCase());
    }

    for (const source of [tokensCss, globalCss]) {
      expect(source).not.toContain("@import");
      expect(source).not.toContain("url(http");
      expect(source).not.toContain("https://");
    }

    expect(globalCss).toContain("prefers-reduced-motion");
  });
});
