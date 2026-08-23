/**
 * The one-write sweep (spec 003 US2-S4, plan D-P13).
 *
 * 001 shipped this as a zero-write sweep: the Desk issued no non-GET request at
 * all, because Answer was 003's. Answer has landed, so the assertion becomes the
 * one this repository actually has to keep forever — that `web/src/` issues
 * **exactly one** kind of write, from **exactly one** file, to **exactly one**
 * route. Everything else stays forbidden by name.
 *
 * This is the control against the defect D-001 forbids. A change that "improves"
 * the Desk by adding a convenience write — a dismiss, a snooze, a local resolve,
 * a second verb of any kind, however small — turns this test red, and that is
 * the whole reason it is written this way rather than as "no more than a few
 * writes". A pane with two verbs has broken the constitution, not helped the
 * operator.
 */

import { describe, expect, it } from "vitest";

const WRITER = "../../src/api/answer.ts";
const WRITE_ROUTE = "/api/attention/";

function sources(pattern: Record<string, string>): Record<string, string> {
  return pattern;
}

const deskFiles = sources(
  import.meta.glob("../../src/desk/**/*.tsx", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>,
);
const appFile = sources(
  import.meta.glob("../../src/App.tsx", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>,
);
const apiFiles = sources(
  import.meta.glob("../../src/api/*.ts", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>,
);

const allFiles = { ...deskFiles, ...appFile, ...apiFiles };

/** Every file except the one permitted writer. */
function othersOnly(): [string, string][] {
  return Object.entries(allFiles).filter(([path]) => !path.endsWith("api/answer.ts"));
}

describe("the Desk has exactly one verb", () => {
  it("issues its one write from web/src/api/answer.ts and from nowhere else", () => {
    const writer = Object.entries(allFiles).find(([path]) => path.endsWith("api/answer.ts"));
    expect(writer, `${WRITER} is the file that must carry the one write`).toBeDefined();

    const source = (writer as [string, string])[1];
    expect(source).toContain('method: "POST"');
    expect(source).toContain(WRITE_ROUTE);
    expect(source).toContain("/answer");

    // One POST, and no other method anywhere in it.
    const methods = [...source.matchAll(/method:\s*"([A-Z]+)"/g)].map((m) => m[1]);
    expect(methods).toEqual(["POST"]);

    // And exactly one fetch call, so the file cannot grow a second route.
    expect([...source.matchAll(/fetch\s*\(/g)]).toHaveLength(1);
  });

  it("finds no second write path anywhere else under web/src/", () => {
    for (const [path, source] of othersOnly()) {
      for (const pattern of [
        "<form",
        "onSubmit",
        "method:",
        "XMLHttpRequest",
        "navigator.sendBeacon",
      ]) {
        expect(source, `${path} must not contain ${pattern}`).not.toContain(pattern);
      }

      // Every fetch outside the writer is a bare GET of the floor document.
      for (const context of source.split("fetch").slice(1)) {
        const call = context.split(")")[0];
        expect(call, `${path} fetches something other than the floor`).toContain('"/api/floor"');
        expect(call, `${path} passes a fetch init`).not.toContain(",");
      }
    }
  });

  it("puts every control in the one component that mounts the verb", () => {
    // Buttons and the reply field exist now, and they exist in exactly one
    // place: a control anywhere else in the Desk would have no seam to reach.
    for (const [path, source] of Object.entries(deskFiles)) {
      if (path.endsWith("AnswerColumn.tsx")) continue;
      for (const control of ["<form", "<button", "<input", "<select", "<textarea", "onClick"]) {
        expect(source, `${path} must not carry ${control}`).not.toContain(control);
      }
    }

    const column = deskFiles[
      Object.keys(deskFiles).find((p) => p.endsWith("AnswerColumn.tsx")) as string
    ];
    expect(column).toBeDefined();
    // The only controls it may render, and no others.
    expect(column).toContain("<button");
    expect(column).toContain("<textarea");
    for (const control of ["<form", "<input", "<select"]) {
      expect(column, `AnswerColumn must not render ${control}`).not.toContain(control);
    }
  });

  it("keeps 001's copy rules and loads nothing remote", () => {
    const allSources = Object.values(allFiles).join("\n");
    expect(allSources).not.toContain("https://");

    const interfaceWords = ["dashboard", "console", "board", "mutation", "live floor"];
    for (const word of interfaceWords) {
      expect(allSources.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });
});
