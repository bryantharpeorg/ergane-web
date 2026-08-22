import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { App } from "../../src/App";

describe("App masthead", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("renders ERGANE mark, Desk and Showfloor links, and a floor line", () => {
    window.history.pushState({}, "", "/");
    act(() => {
      createRoot(container).render(<App />);
    });

    const mark = container.querySelector(".mast .mark");
    expect(mark?.textContent).toBe("ERGANE");

    const links = Array.from(container.querySelectorAll(".mast nav a"));
    const texts = links.map((a) => a.textContent?.trim());
    expect(texts).toContain("Desk");
    expect(texts).toContain("Showfloor");

    const desk = links.find((a) => a.textContent?.trim() === "Desk");
    expect(desk?.getAttribute("aria-current")).toBe("page");

    const floorline = container.querySelector(".mast .floorline");
    expect(floorline).not.toBeNull();
  });
});
