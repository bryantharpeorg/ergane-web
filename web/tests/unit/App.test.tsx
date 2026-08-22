import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

import App from "../../src/App";

describe("App masthead", () => {
  it("renders the mark, nav links, and marks Desk current at /", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    // jsdom default pathname is "/"
    act(() => {
      createRoot(container).render(<App />);
    });

    const mark = container.querySelector(".mast .mark");
    expect(mark?.textContent).toBe("ERGANE");

    const links = Array.from(container.querySelectorAll(".mast nav a"));
    expect(links.map((a) => (a as HTMLAnchorElement).textContent)).toContain("Desk");
    expect(links.map((a) => (a as HTMLAnchorElement).textContent)).toContain("Showfloor");

    const desk = links.find((a) => (a as HTMLAnchorElement).textContent === "Desk");
    expect(desk?.getAttribute("aria-current")).toBe("page");

    document.body.removeChild(container);
  });
});
