import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Legend from "../../src/showfloor/Legend";

const PASS_EDGE_TEXT =
  "An ordering-only dependency: the predecessor must reach a verdict, and nothing about its code is guaranteed to be present";
const MERGE_EDGE_TEXT =
  "A content dependency: the predecessor's work must be merged before the dependent's worktree is created, so the dependent's base contains that code";

describe("Legend", () => {
  it("quotes the verbatim pass-edge definition", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    act(() => createRoot(container).render(<Legend />));

    const pass = container.querySelector("[data-legend-kind='pass']");
    expect(pass?.textContent).toContain("pass-edge");
    expect(pass?.textContent).toContain(PASS_EDGE_TEXT);

    document.body.removeChild(container);
  });

  it("quotes the verbatim merge-edge definition", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    act(() => createRoot(container).render(<Legend />));

    const merge = container.querySelector("[data-legend-kind='merge']");
    expect(merge?.textContent).toContain("merge-edge");
    expect(merge?.textContent).toContain(MERGE_EDGE_TEXT);

    document.body.removeChild(container);
  });
});
