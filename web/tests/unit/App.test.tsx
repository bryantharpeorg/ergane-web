import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

import App from "../../src/App";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("App masthead", () => {
  it("renders the ERGANE mark, Desk / Showfloor nav, and marks Desk active at /", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    act(() => {
      createRoot(container).render(
        <App />
      );
    });

    const mark = container.querySelector(".mast .mark");
    expect(mark?.textContent).toBe("ERGANE");

    const links = Array.from(container.querySelectorAll(".mast nav a"));
    expect(links.map((a) => a.textContent?.trim())).toEqual(["Desk", "Showfloor"]);

    const deskLink = links.find((a) => a.textContent?.trim() === "Desk");
    expect(deskLink?.getAttribute("aria-current")).toBe("page");

    container.remove();
  });
});
