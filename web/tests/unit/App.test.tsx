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

    // Three rooms since 018 US1 (FR-008): the drafting table is offered beside
    // the Desk and the Showfloor. The review room is not, and deliberately —
    // it has no bare form, so its door is a `landed` row of the index.
    const nav = container.querySelector(".mast nav");
    const links = nav?.querySelectorAll("a");
    expect(links?.length).toBe(3);
    expect(links?.[0].textContent).toBe("Desk");
    expect(links?.[1].textContent).toBe("Showfloor");
    expect(links?.[2].textContent).toBe("Drafting table");
    expect(links?.[2].getAttribute("href")).toBe("/draft");
    expect(links?.[0].getAttribute("aria-current")).toBe("page");
    expect(links?.[2].getAttribute("aria-current")).toBeNull();

    document.body.removeChild(container);
  });
});

/**
 * The shell routes the drafting table's two forms (018 US1).
 *
 * Bare `/draft` is the corpus index and `/draft/<spec-dir>` is 014's trio, and
 * the room is *current* in the appbar under both — a nav entry that stopped
 * being current the moment the operator opened a spec would be a fourth room
 * pretending to be a third (FR-008).
 */
describe("App routes the drafting table's index", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
    vi.restoreAllMocks();
  });

  function mountAt(path: string, body: unknown): HTMLDivElement {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => body,
    })) as unknown as typeof fetch;

    const container = document.createElement("div");
    document.body.appendChild(container);
    window.history.pushState({}, "", path);
    act(() => {
      createRoot(container).render(<App />);
    });
    return container;
  }

  it("mounts the index at bare /draft, with one appbar", () => {
    const container = mountAt("/draft", { specs: [], degraded: [] });

    expect(container.querySelector("[data-draft-index-root]")).not.toBeNull();
    expect(container.querySelectorAll(".mast").length).toBe(1);
    expect(
      container.querySelector(".mast nav a[aria-current='page']")?.textContent,
    ).toBe("Drafting table");

    document.body.removeChild(container);
  });

  it("leaves /draft/<spec-dir> reaching the trio, still current in the nav", () => {
    const container = mountAt("/draft/920-a-constructed-draft", {
      documents: [],
      checks: [],
      degraded: [],
    });

    expect(container.querySelector("[data-draft-root]")).not.toBeNull();
    expect(container.querySelector("[data-draft-index-root]")).toBeNull();
    expect(
      container.querySelector(".mast nav a[aria-current='page']")?.textContent,
    ).toBe("Drafting table");

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
