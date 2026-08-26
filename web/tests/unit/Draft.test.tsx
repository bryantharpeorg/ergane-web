/**
 * The drafting table's assembly (014 US1).
 *
 * One claim per acceptance scenario, over documents this file builds:
 *
 * * **US1-S1** — three columns in `spec.md`, `plan.md`, `tasks.md` order, in
 *   one view, each carrying its own document's text (FR-001).
 * * **US1-S2** — a trio whose `plan.md` and `tasks.md` are absent renders
 *   `spec.md` and says `absent` for the other two, with no degraded note
 *   anywhere on the page (FR-002). Present-and-empty rides alongside as the
 *   third state it has to be distinguishable from.
 * * **US1-S3** — the read stamp names the revision and the instant, and says
 *   `unknown` rather than inventing one when the tree had none (FR-003).
 * * **US1-S4** — a document that carries a degraded note renders the note, with
 *   the path it tried, and draws **no** trio at all (FR-004).
 *
 * US1-S5 is the token, which is the backend's door and is asserted there:
 * `tests/test_draft_trio.py` and `tests/test_token_gate.py`.
 *
 * **Nothing here pins the live corpus** (008 US1). The spec directory is a name
 * no repository uses and every document's text is written by the test that
 * asserts it.
 */
import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Draft from "../../src/draft/Draft";
import type { DraftDocument, DraftDocumentEntry } from "../../src/api/draftDocument";

/** A directory name no repository uses. */
const SPEC_DIR = "920-a-constructed-draft";

function present(name: string, text: string): DraftDocumentEntry {
  return { name, present: true, empty: text === "", text };
}

function absent(name: string): DraftDocumentEntry {
  return { name, present: false, empty: false, text: null };
}

function buildDoc(overrides: Partial<DraftDocument> = {}): DraftDocument {
  return {
    spec_dir: SPEC_DIR,
    specs_root: "/scratch/specs",
    path: `/scratch/specs/${SPEC_DIR}`,
    revision: "a".repeat(40),
    revision_short: "aaaaaaa",
    dirty: false,
    read_at: "2026-08-26T05:00:00Z",
    documents: [
      present("spec.md", "# the spec"),
      present("plan.md", "# the plan"),
      present("tasks.md", "# the tasks"),
    ],
    degraded: [],
    ...overrides,
  };
}

async function renderDraft(doc: DraftDocument, path = `/draft/${SPEC_DIR}`) {
  window.history.replaceState({}, "", path);
  const container = document.createElement("div");
  document.body.appendChild(container);
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => doc });
  await act(async () => {
    createRoot(container).render(<Draft />);
    await Promise.resolve();
  });
  return container;
}

function columnStates(container: HTMLElement): Record<string, string> {
  const states: Record<string, string> = {};
  container.querySelectorAll("[data-document]").forEach((column) => {
    states[column.getAttribute("data-document") ?? ""] =
      column.getAttribute("data-document-state") ?? "";
  });
  return states;
}

describe("the trio reads together (US1-S1, FR-001)", () => {
  it("renders all three, in that order, in one view", async () => {
    const c = await renderDraft(buildDoc());

    const names = [...c.querySelectorAll("[data-document]")].map((column) =>
      column.getAttribute("data-document"),
    );
    expect(names).toEqual(["spec.md", "plan.md", "tasks.md"]);
    document.body.removeChild(c);
  });

  it("puts each document's own text in its own column", async () => {
    const c = await renderDraft(
      buildDoc({
        documents: [
          present("spec.md", "the spec's own words"),
          present("plan.md", "the plan's own words"),
          present("tasks.md", "the tasks' own words"),
        ],
      }),
    );

    for (const [name, words] of [
      ["spec.md", "the spec's own words"],
      ["plan.md", "the plan's own words"],
      ["tasks.md", "the tasks' own words"],
    ]) {
      const column = c.querySelector(`[data-document="${name}"]`);
      expect(column?.textContent).toContain(words);
    }
    document.body.removeChild(c);
  });

  it("asks the backend for the spec its address names, and nothing else", async () => {
    await renderDraft(buildDoc());
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(`/api/draft/${SPEC_DIR}`);
  });
});

describe("an absent document is quiet (US1-S2, FR-002)", () => {
  it("renders the spec and reads the other two as absent", async () => {
    const c = await renderDraft(
      buildDoc({
        documents: [
          present("spec.md", "# the sketch"),
          absent("plan.md"),
          absent("tasks.md"),
        ],
      }),
    );

    expect(columnStates(c)).toEqual({
      "spec.md": "present",
      "plan.md": "absent",
      "tasks.md": "absent",
    });
    expect(c.querySelector('[data-document="plan.md"]')?.textContent).toContain(
      "absent",
    );
    document.body.removeChild(c);
  });

  it("writes no degraded note for an absence", async () => {
    const c = await renderDraft(
      buildDoc({
        documents: [
          present("spec.md", "# the sketch"),
          absent("plan.md"),
          absent("tasks.md"),
        ],
      }),
    );

    expect(c.querySelector(".degraded")).toBeNull();
    document.body.removeChild(c);
  });

  it("tells present-and-empty from absent, on screen", async () => {
    const c = await renderDraft(
      buildDoc({
        documents: [
          present("spec.md", "# the sketch"),
          present("plan.md", ""),
          absent("tasks.md"),
        ],
      }),
    );

    expect(columnStates(c)).toEqual({
      "spec.md": "present",
      "plan.md": "empty",
      "tasks.md": "absent",
    });
    const empty = c.querySelector('[data-document="plan.md"]')?.textContent ?? "";
    expect(empty).toContain("empty");
    expect(empty).not.toContain("absent");
    expect(c.querySelector(".degraded")).toBeNull();
    document.body.removeChild(c);
  });
});

describe("the read stamp (US1-S3, FR-003)", () => {
  it("names the revision it read and the instant it read it", async () => {
    const c = await renderDraft(
      buildDoc({ revision: "b".repeat(40), revision_short: "bbbbbbb" }),
    );

    const stamp = c.querySelector("[data-read-stamp]");
    expect(stamp).not.toBeNull();
    expect(stamp?.textContent).toContain("2026-08-26T05:00:00Z");
    expect(stamp?.querySelector("[data-read-revision]")?.textContent).toBe("bbbbbbb");
    expect(stamp?.querySelector("[data-read-revision]")?.getAttribute("title")).toBe(
      "b".repeat(40),
    );
    document.body.removeChild(c);
  });

  it("says unknown rather than inventing a revision the tree did not give", async () => {
    const c = await renderDraft(
      buildDoc({ revision: null, revision_short: null, dirty: null }),
    );

    const stamp = c.querySelector("[data-read-stamp]");
    expect(stamp?.querySelector('[data-read-revision="unknown"]')?.textContent).toBe(
      "unknown",
    );
    // Unknown is not degraded, and it is never a dash standing in for a value.
    expect(c.querySelector(".degraded")).toBeNull();
    expect(stamp?.textContent).not.toContain("—");
    document.body.removeChild(c);
  });

  it("says so when the tree is not the commit it names", async () => {
    const c = await renderDraft(buildDoc({ dirty: true }));
    expect(c.querySelector("[data-tree-dirty]")?.textContent).toContain("uncommitted");
    document.body.removeChild(c);
  });

  it("says nothing about uncommitted work when there is none", async () => {
    const c = await renderDraft(buildDoc({ dirty: false }));
    expect(c.querySelector("[data-tree-dirty]")).toBeNull();
    document.body.removeChild(c);
  });

  it("stamps a degraded read too — a stale refusal is stale as well", async () => {
    const c = await renderDraft(
      buildDoc({
        documents: [],
        degraded: [
          {
            read: "draft_trio",
            mode: "transport",
            detail: "no such spec directory: /scratch/specs/930-gone",
            path: "/scratch/specs/930-gone",
          },
        ],
      }),
    );

    expect(c.querySelector("[data-read-instant]")?.textContent).toBe(
      "2026-08-26T05:00:00Z",
    );
    document.body.removeChild(c);
  });
});

describe("an unreadable directory degrades honestly (US1-S4, FR-004)", () => {
  it("names the path it tried and draws no trio", async () => {
    const c = await renderDraft(
      buildDoc({
        documents: [],
        degraded: [
          {
            read: "draft_trio",
            mode: "transport",
            detail: "no such spec directory: /scratch/specs/930-gone",
            path: "/scratch/specs/930-gone",
          },
        ],
      }),
    );

    const note = c.querySelector("[data-draft-note]");
    expect(note).not.toBeNull();
    expect(note?.getAttribute("data-mode")).toBe("transport");
    expect(note?.querySelector("[data-note-path]")?.textContent).toContain(
      "/scratch/specs/930-gone",
    );
    // FR-004: not an empty trio. Three empty columns is what a sketch looks
    // like, and this is a spec that is not there.
    expect(c.querySelector("[data-draft-trio]")).toBeNull();
    expect(c.querySelectorAll("[data-document]").length).toBe(0);
    document.body.removeChild(c);
  });

  it("says the room refused a name rather than blaming the factory", async () => {
    const c = await renderDraft(
      buildDoc({
        path: null,
        documents: [],
        degraded: [
          {
            read: "draft_trio",
            mode: "refusal",
            detail: "'../etc' is a path, not a spec directory name",
            path: null,
          },
        ],
      }),
    );

    const note = c.querySelector("[data-draft-note]");
    expect(note?.getAttribute("data-mode")).toBe("refusal");
    expect(note?.textContent).toContain("refused");
    // No path was formed, so none is reported as having been tried.
    expect(note?.querySelector('[data-note-path="none"]')).not.toBeNull();
    document.body.removeChild(c);
  });

  it("says the read failed when the pane itself could not be reached", async () => {
    window.history.replaceState({}, "", `/draft/${SPEC_DIR}`);
    const container = document.createElement("div");
    document.body.appendChild(container);
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await act(async () => {
      createRoot(container).render(<Draft />);
      await Promise.resolve();
    });

    expect(container.querySelector(".degraded")).not.toBeNull();
    expect(container.querySelector("[data-draft-trio]")).toBeNull();
    document.body.removeChild(container);
  });
});

describe("the address names the spec", () => {
  it("reads nothing and says so when no spec is named", async () => {
    window.history.replaceState({}, "", "/draft");
    const container = document.createElement("div");
    document.body.appendChild(container);
    globalThis.fetch = vi.fn();
    await act(async () => {
      createRoot(container).render(<Draft />);
      await Promise.resolve();
    });

    expect(container.querySelector("[data-draft-empty]")).not.toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    document.body.removeChild(container);
  });
});
