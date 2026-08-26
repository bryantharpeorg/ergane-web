/**
 * The review room's what-changed track, rendered (011 US1).
 *
 * The document shapes below are the ones `pane/review.py`'s `assemble_review`
 * emits — field for field, and asserted against the assembler itself by
 * `tests/test_review_room.py` over a git repository that suite builds. What is
 * proved here is the other half: that the room renders every fact the document
 * carries and invents none it does not.
 *
 * Four of the room's answers are distinct renders and none may be another: the
 * document, the refusal of a partly landed epic (FR-004), the spec directory
 * this corpus does not have, and the read that did not complete. A room that
 * showed a blank track for any of them would be the pane saying it looked when
 * it did not.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Review from "../../src/review/Review";
import type {
  ReviewDocument,
  ReviewStory,
  ServedRevision,
} from "../../src/api/reviewDocument";

const containers: HTMLElement[] = [];

function mount(node: JSX.Element): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  act(() => {
    createRoot(container).render(node);
  });
  return container;
}

/** One story of the epic, in the assembler's own shape. */
function story(overrides: Partial<ReviewStory> = {}): ReviewStory {
  return {
    story_key: "US1",
    title: "The Desk sees the floor",
    priority: "P1",
    commit: "0f2c9a1b8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a",
    short_commit: "0f2c9a1b8d7e",
    pr_number: 47,
    subject: "001-the-desk/us1: US1 (#47)",
    merged_at: "2026-08-22T17:40:54Z",
    kind: "observed",
    files: [
      { path: "pane/floor_document.py", routes: ["/", "/desk"], matched: true },
      { path: "docs/decisions.md", routes: [], matched: true },
      { path: "pane/a_module_no_pattern_names.py", routes: [], matched: false },
    ],
    routes: ["/", "/desk"],
    unknown: [],
    notes: [],
    ...overrides,
  };
}

/**
 * The served-revision header the backend puts on every answer (011 US2).
 *
 * Its default is the ordinary case — the service is serving a revision that
 * carries the epic — so a test about the what-changed track is not also a test
 * about a mismatch. The mismatch has its own file, `ServedRevision.test.tsx`.
 */
function served(overrides: Partial<ServedRevision> = {}): ServedRevision {
  return {
    revision: "9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d",
    short_revision: "9c1d2e3f4a5b",
    branch: "dev",
    committed_at: "2026-08-22T18:02:11Z",
    subject: "001-the-desk-sees-the-floor/us4: US4 (#5)",
    contains_epic: true,
    missing: [],
    unknown: [],
    notes: [],
    ...overrides,
  };
}

function review(overrides: Partial<ReviewDocument> = {}): ReviewDocument {
  return {
    spec_dir: "001-the-desk-sees-the-floor",
    name: "The Desk sees the floor",
    landing_branch: "dev",
    story_source: "workgraph",
    served: served(),
    stories: [story()],
    routes: [
      { path: "/", kind: "room", name: "The Desk", stories: ["US1"] },
      { path: "/desk", kind: "room", name: "The Desk", stories: ["US1"] },
    ],
    notes: [],
    ...overrides,
  };
}

/** The room at `/review/<spec-dir>`, answered by a stubbed read. */
function open(pathname: string, status: number, body: unknown): HTMLElement {
  window.history.pushState({}, "", pathname);
  globalThis.fetch = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
  const container = mount(<Review />);
  // The read resolves on a microtask; flush it before asserting.
  act(() => {});
  return container;
}

afterEach(() => {
  for (const container of containers.splice(0)) container.remove();
  window.history.pushState({}, "", "/");
  vi.restoreAllMocks();
});

describe("the review room reads one landed epic from its path", () => {
  it("asks the backend for the spec directory in the URL", async () => {
    const stub = vi.fn(async (url: string) => ({
      url,
      ok: true,
      status: 200,
      json: async () => review(),
    }));
    globalThis.fetch = stub as unknown as typeof fetch;
    window.history.pushState({}, "", "/review/001-the-desk-sees-the-floor");
    mount(<Review />);
    await act(async () => {});

    expect(stub).toHaveBeenCalledTimes(1);
    expect(stub.mock.calls[0][0]).toBe("/api/review/001-the-desk-sees-the-floor");
  });

  it("names what it needs when the path names no epic", () => {
    window.history.pushState({}, "", "/review");
    const container = mount(<Review />);
    expect(container.querySelector("[data-review-empty]")).not.toBeNull();
    expect(container.textContent).toContain("/review/<spec-dir>");
  });
});

describe("the what-changed track renders the branch's own facts", () => {
  it("renders each story with its landing SHA, pull request and squash subject", async () => {
    const container = open("/review/001-the-desk-sees-the-floor", 200, review());
    await act(async () => {});

    const entry = container.querySelector("[data-story='US1']")!;
    expect(entry).not.toBeNull();
    expect(entry.querySelector("[data-sha]")!.getAttribute("data-sha")).toBe(
      "0f2c9a1b8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a",
    );
    // The SHA is shown, not a tick standing in for it (§ The review room).
    expect(entry.querySelector(".rv-sha")!.textContent).toBe("0f2c9a1b8d7e");
    expect(entry.querySelector("[data-pr]")!.textContent).toBe("#47");
    expect(entry.querySelector("[data-subject]")!.textContent).toBe(
      "001-the-desk/us1: US1 (#47)",
    );
    expect(entry.textContent).toContain("2026-08-22T17:40:54Z");
  });

  it("carries the file list the landing commit changed", async () => {
    const container = open("/review/001-the-desk-sees-the-floor", 200, review());
    await act(async () => {});

    const files = Array.from(container.querySelectorAll(".rv-file")).map((file) =>
      file.getAttribute("data-file"),
    );
    expect(files).toEqual([
      "pane/floor_document.py",
      "docs/decisions.md",
      "pane/a_module_no_pattern_names.py",
    ]);
  });

  it("names the routes each changed file reaches", async () => {
    const container = open("/review/001-the-desk-sees-the-floor", 200, review());
    await act(async () => {});

    const reached = Array.from(
      container
        .querySelector("[data-file='pane/floor_document.py']")!
        .querySelectorAll("[data-route]"),
    ).map((route) => route.getAttribute("data-route"));
    expect(reached).toEqual(["/", "/desk"]);
  });

  it("keeps a file that reaches no known route, and says which kind of nothing", async () => {
    const container = open("/review/001-the-desk-sees-the-floor", 200, review());
    await act(async () => {});

    const mapped = container.querySelector("[data-file='docs/decisions.md']")!;
    expect(mapped.querySelector("[data-no-route]")!.getAttribute("data-no-route")).toBe(
      "mapped",
    );
    expect(mapped.textContent).toContain("reaches no known route");

    const unmatched = container.querySelector(
      "[data-file='pane/a_module_no_pattern_names.py']",
    )!;
    expect(unmatched.querySelector("[data-no-route]")!.getAttribute("data-no-route")).toBe(
      "unmatched",
    );
  });

  it("names a fact the branch did not supply rather than defaulting it", async () => {
    const container = open(
      "/review/001-the-desk-sees-the-floor",
      200,
      review({
        stories: [story({ pr_number: null, subject: null, unknown: ["pr_number", "subject"] })],
      }),
    );
    await act(async () => {});

    const entry = container.querySelector("[data-story='US1']")!;
    expect(entry.querySelector("[data-unknown='pull request']")).not.toBeNull();
    expect(entry.querySelector("[data-pr]")).toBeNull();
    // Never a zero and never a dash standing in for a number nobody recorded.
    expect(entry.textContent).not.toContain("#0");
  });

  it("names a read that failed instead of showing a story with no files", async () => {
    const container = open(
      "/review/001-the-desk-sees-the-floor",
      200,
      review({
        stories: [
          story({
            files: [],
            routes: [],
            notes: [{ read: "changed_files", mode: "transport", detail: "git could not be run" }],
          }),
        ],
      }),
    );
    await act(async () => {});

    const degraded = container.querySelector(".rv-story .degraded")!;
    expect(degraded.getAttribute("data-mode")).toBe("transport");
    expect(degraded.textContent).toContain("changed_files");
    expect(degraded.textContent).toContain("git could not be run");
  });
});

describe("the room refuses half an epic and names the stories (FR-004)", () => {
  it("renders the refusal and every unmerged story", async () => {
    const container = open("/review/011-the-work-comes-back-for-review", 409, {
      error: "the epic is not fully landed",
      spec_dir: "011-the-work-comes-back-for-review",
      landing_branch: "dev",
      unmerged: [
        { story_key: "US2", title: "The thing itself renders beside its numbers" },
        { story_key: "US3", title: "A note carries its coordinates" },
      ],
      served: served({ contains_epic: false, missing: [{ story_key: "US2", title: "" }] }),
      detail: "US2, US3 have not merged to dev",
    });
    await act(async () => {});

    const refusal = container.querySelector("[data-refusal]")!;
    expect(refusal).not.toBeNull();
    expect(refusal.querySelector("[data-unmerged='US2']")).not.toBeNull();
    expect(refusal.querySelector("[data-unmerged='US3']")).not.toBeNull();
    expect(refusal.textContent).toContain("The thing itself renders beside its numbers");
    // And nothing of the track: half an epic is not reviewed at all.
    expect(container.querySelector("[data-track='what-changed']")).toBeNull();
    // But the header is: a refusal is a render, and it is served by some
    // revision (011 FR-009's "any render").
    expect(container.querySelector("[data-served]")).not.toBeNull();
  });

  it("names a spec directory this corpus does not have", async () => {
    const container = open("/review/999-no-such-spec", 404, {
      error: "no such spec directory",
      spec_dir: "999-no-such-spec",
    });
    await act(async () => {});

    expect(container.querySelector("[data-miss='999-no-such-spec']")).not.toBeNull();
    expect(container.querySelector("[data-track='what-changed']")).toBeNull();
  });

  it("says the read did not complete rather than rendering an empty room", async () => {
    const container = open("/review/001-the-desk-sees-the-floor", 503, {});
    await act(async () => {});

    const degraded = container.querySelector(".degraded")!;
    expect(degraded.getAttribute("data-mode")).toBe("transport");
    expect(degraded.textContent).toContain("GET /api/review/001-the-desk-sees-the-floor");
    expect(degraded.textContent).toContain("503");
  });
});
