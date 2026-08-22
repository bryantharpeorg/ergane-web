import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import App from "../../src/App";

describe("App masthead", () => {
  it("renders the mark, nav, and current desk link", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    window.history.pushState({}, "", "/");

    act(() => {
      createRoot(container).render(<App />);
    });

    const mark = container.querySelector(".mast .mark");
    expect(mark?.textContent).toBe("ERGANE");

    const nav = container.querySelector(".mast nav");
    const links = nav?.querySelectorAll("a");
    expect(links?.length).toBe(2);
    expect(links?.[0].textContent).toBe("Desk");
    expect(links?.[1].textContent).toBe("Showfloor");
    expect(links?.[0].getAttribute("aria-current")).toBe("page");

    document.body.removeChild(container);
  });
});
