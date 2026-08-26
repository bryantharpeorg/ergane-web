import { afterEach, describe, expect, it, vi } from "vitest";
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

/**
 * The shell routes the third room (011 US1).
 *
 * `/review/<spec-dir>` is served by the same guarded catch-all as `/showfloor`,
 * so the only thing that decides which room the operator gets is `App.tsx` — and
 * a room wired into the manifest, the backend and its own tests but not into
 * the shell would be a route that answers 200 and shows nothing.
 */
describe("App routes the review room", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
    vi.restoreAllMocks();
  });

  it("mounts the review room at /review/<spec-dir>, with one appbar", () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const container = document.createElement("div");
    document.body.appendChild(container);
    window.history.pushState({}, "", "/review/009-a-landed-epic-reads-landed");

    act(() => {
      createRoot(container).render(<App />);
    });

    expect(container.querySelector("[data-review-root]")).not.toBeNull();
    // The room carries its own appbar inside its own frame; the shell must not
    // render a second one over it, which is what the first world did.
    expect(container.querySelectorAll(".mast").length).toBe(1);

    document.body.removeChild(container);
  });
});
