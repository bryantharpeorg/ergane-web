import { describe, expect, it } from "vitest";

describe("Desk has no write-issuing control", () => {
  it("finds no form, button, input, select, textarea, submit handler, click handler, POST request, or remote resource in the Desk source", () => {
    const deskFiles = import.meta.glob("../../src/desk/**/*.tsx", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const appFile = import.meta.glob("../../src/App.tsx", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const apiFiles = import.meta.glob("../../src/api/*.ts", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;

    const allSources = [
      ...Object.values(deskFiles),
      ...Object.values(appFile),
      ...Object.values(apiFiles),
    ].join("\n");

    const forbiddenPatterns = [
      "<form",
      "<button",
      "<input",
      "<select",
      "<textarea",
      "onSubmit",
      "onClick",
      "method:",
      "XMLHttpRequest",
      "navigator.sendBeacon",
    ];

    for (const pattern of forbiddenPatterns) {
      expect(allSources).not.toContain(pattern);
    }

    // Every fetch call must be fetch("/api/floor") with no second argument.
    const fetchCalls = [...allSources.matchAll(/fetch\s*\(/g)];
    expect(fetchCalls.length).toBeGreaterThan(0);
    const fetchContext = allSources.split("fetch").slice(1);
    for (const ctx of fetchContext) {
      const call = ctx.split(")")[0];
      expect(call).toContain('"/api/floor"');
      expect(call).not.toContain(",");
    }

    expect(allSources).not.toContain("https://");

    const interfaceWords = ["dashboard", "console", "board", "mutation", "live floor"];
    for (const word of interfaceWords) {
      expect(allSources.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });
});
