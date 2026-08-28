/**
 * The corpus index, and the doors on it (018 US1).
 *
 * One claim per acceptance scenario, over documents this file builds — no
 * directory of this repository's own corpus is named anywhere below, so an
 * operator adding, renaming or attesting a spec moves no assertion here
 * (008 US1).
 *
 * * **US1-S1** — every spec the document carries is listed, in the order the
 *   document carried them, each with the state it declared (FR-001, FR-003).
 *   The order asserted is deliberately *not* alphabetical: the room takes the
 *   seam's order and does not sort.
 * * **US1-S2** — every row's href is `draftPathFor(spec_dir)`, computed from the
 *   helper rather than compared against a string this file spells out, and the
 *   link is the row itself rather than a separate control (FR-002).
 * * **US1-S2a** — a `landed` row also offers `reviewPathFor(spec_dir)`, and no
 *   other declared state does (FR-010).
 * * **US1-S3** — each declared state renders as its chip from DESIGN.md's
 *   vocabulary, and no row carries a glyph from the eleven-state grammar
 *   (FR-004).
 * * **US1-S4** — a corpus that could not be read renders its note and no list;
 *   an empty corpus says so in words and renders no note (FR-005).
 * * **US1-S5** — the read stamp names the revision and the instant, and says
 *   `unknown` rather than inventing one when the tree had none (FR-006).
 *
 * US1-S6 is the token, which is the backend's door and is asserted there
 * (`tests/test_the_corpus_opens.py`, `tests/test_token_gate.py`); US1-S7 is the
 * Masthead's, asserted in `App.test.tsx` and in the smoke.
 */
import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import DraftIndex from "../../src/draft/DraftIndex";
import type { DraftIndexDocument, DraftIndexEntry } from "../../src/api/draftIndexDocument";
import { draftPathFor, reviewPathFor } from "../../src/routes";

/** Directory names no repository uses, in an order sorting would not produce. */
const CORPUS: DraftIndexEntry[] = [
  { spec_dir: "941-declared-ready", state: "ready" },
  { spec_dir: "940-declared-landed", state: "landed" },
  { spec_dir: "943-declared-deferred", state: "deferred" },
  { spec_dir: "942-declared-draft", state: "draft" },
];

function buildDoc(overrides: Partial<DraftIndexDocument> = {}): DraftIndexDocument {
  return {
    specs_root: "/scratch/specs",
    revision: "b".repeat(40),
    revision_short: "bbbbbbb",
    dirty: false,
    read_at: "2026-08-28T05:00:00Z",
    specs: CORPUS,
    degraded: [],
    ...overrides,
  };
}

async function renderIndex(doc: DraftIndexDocument | null, status = 200) {
  window.history.replaceState({}, "", "/draft");
  const container = document.createElement("div");
  document.body.appendChild(container);
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status === 200,
    status,
    json: async () => doc ?? {},
  });
  await act(async () => {
    createRoot(container).render(<DraftIndex />);
    await Promise.resolve();
  });
  return container;
}

function rows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("[data-index-row]")];
}

describe("the corpus opens on one page (US1-S1, FR-001/FR-003)", () => {
  it("lists every spec the document carried, in the order it carried them", async () => {
    const c = await renderIndex(buildDoc());

    const listed = [...c.querySelectorAll("[data-index-link]")].map((link) =>
      link.getAttribute("data-spec-dir"),
    );
    expect(listed).toEqual(CORPUS.map((entry) => entry.spec_dir));
    // And that order is not the one sorting would have produced, so a room that
    // sorted the corpus itself fails here rather than passing by coincidence.
    expect(listed).not.toEqual([...listed].sort());
  });

  it("carries each spec's declared state as the document declared it", async () => {
    const c = await renderIndex(buildDoc());

    const declared = rows(c).map((row) => [
      row.querySelector("[data-index-link]")?.getAttribute("data-spec-dir"),
      row.querySelector("[data-declared-state]")?.textContent,
    ]);
    expect(declared).toEqual(CORPUS.map((entry) => [entry.spec_dir, entry.state]));
  });
});

describe("the row is the link (US1-S2, FR-002)", () => {
  it("gives every row the href `draftPathFor` computes", async () => {
    const c = await renderIndex(buildDoc());

    for (const row of rows(c)) {
      const link = row.querySelector("[data-index-link]");
      const specDir = link?.getAttribute("data-spec-dir") ?? "";
      expect(link?.getAttribute("href")).toBe(draftPathFor(specDir));
    }
    expect(rows(c)).toHaveLength(CORPUS.length);
  });

  it("spells the path through the helper, escapes and all", async () => {
    // A directory name that needs escaping is the case a second, hand-built
    // spelling of `/draft/<dir>` would get wrong — and the browser must never
    // decide what is inside the specs root (014 plan D5).
    const c = await renderIndex(
      buildDoc({ specs: [{ spec_dir: "950 a name with spaces", state: "draft" }] }),
    );
    expect(c.querySelector("[data-index-link]")?.getAttribute("href")).toBe(
      draftPathFor("950 a name with spaces"),
    );
  });

  it("adds no separate control beside the row", async () => {
    const c = await renderIndex(buildDoc());
    // Every anchor on a row is one of the two doors this story names; a row
    // with a third control is the "open" button plan D5 refuses.
    for (const row of rows(c)) {
      const anchors = [...row.querySelectorAll("a")];
      const specDir = row.querySelector("[data-index-link]")?.getAttribute("data-spec-dir") ?? "";
      const allowed = new Set([draftPathFor(specDir), reviewPathFor(specDir)]);
      for (const anchor of anchors) {
        expect(allowed.has(anchor.getAttribute("href") ?? "")).toBe(true);
      }
      expect(row.querySelector("button")).toBeNull();
    }
  });
});

describe("a landed row, and only a landed row, offers the review room (US1-S2a, FR-010)", () => {
  it("links the landed spec to `reviewPathFor` and no other spec at all", async () => {
    const c = await renderIndex(buildDoc());

    const offered = rows(c)
      .filter((row) => row.querySelector("[data-review-link]") !== null)
      .map((row) => row.getAttribute("data-state"));
    expect(offered).toEqual(["landed"]);

    const landed = rows(c).find((row) => row.getAttribute("data-state") === "landed");
    expect(landed?.querySelector("[data-review-link]")?.getAttribute("href")).toBe(
      reviewPathFor("940-declared-landed"),
    );
  });

  it("offers it to none of draft, ready or deferred", async () => {
    const c = await renderIndex(
      buildDoc({ specs: CORPUS.filter((entry) => entry.state !== "landed") }),
    );
    expect(c.querySelectorAll("[data-review-link]")).toHaveLength(0);
  });

  it("labels the second door rather than drawing it", async () => {
    const c = await renderIndex(buildDoc());
    expect(c.querySelector("[data-review-link]")?.textContent).toBe("review");
  });
});

describe("a declared state wears a chip, never a glyph (US1-S3, FR-004)", () => {
  it("dresses all four declared states in DESIGN.md's own chips", async () => {
    const c = await renderIndex(buildDoc());

    const tones: Record<string, string | null> = {};
    rows(c).forEach((row) => {
      const chip = row.querySelector("[data-chip]");
      tones[row.getAttribute("data-state") ?? ""] = chip?.getAttribute("data-chip-tone") ?? null;
    });
    expect(tones).toEqual({
      landed: "landed",
      ready: "ready",
      draft: "draft",
      deferred: "deferred",
    });
  });

  it("puts the word on the chip, so state is never colour alone", async () => {
    const c = await renderIndex(buildDoc());
    const words = rows(c).map((row) => row.querySelector("[data-chip]")?.textContent);
    expect(words).toEqual(CORPUS.map((entry) => entry.state));
  });

  it("carries no ladder, stop or run state anywhere on the page", async () => {
    const c = await renderIndex(buildDoc());
    // The eleven-state grammar describes work that has run. Nothing on this
    // page has run: intent is declared, progress is observed.
    expect(c.querySelector("[data-ladder]")).toBeNull();
    expect(c.querySelector("[data-stop]")).toBeNull();
    expect(c.querySelector("[data-glyph]")).toBeNull();
  });

  it("shows a word the vocabulary does not name under the Unknown Rule", async () => {
    const c = await renderIndex(
      buildDoc({ specs: [{ spec_dir: "951-a-newer-grammar", state: "amended" }] }),
    );
    const chip = c.querySelector("[data-chip]");
    expect(chip?.getAttribute("data-chip-tone")).toBe("unknown");
    // And the seam's word is kept verbatim rather than replaced by a guess.
    expect(chip?.textContent).toBe("amended");
  });
});

describe("a failed read and an empty corpus are two different facts (US1-S4, FR-005)", () => {
  it("renders the note and no list when the corpus could not be read", async () => {
    const c = await renderIndex(
      buildDoc({
        specs: [],
        degraded: [
          {
            read: "specs_root",
            mode: "transport",
            detail: "no such specs root: /scratch/specs",
            path: "/scratch/specs",
          },
        ],
      }),
    );

    const note = c.querySelector("[data-corpus-note]");
    expect(note).not.toBeNull();
    expect(note?.getAttribute("data-mode")).toBe("transport");
    expect(note?.textContent).toContain("specs_root");
    expect(note?.textContent).toContain("no such specs root: /scratch/specs");
    expect(c.querySelector("[data-note-path]")?.getAttribute("data-note-path")).toBe(
      "/scratch/specs",
    );
    // Never an empty corpus in place of a failed read.
    expect(c.querySelector("[data-index-list]")).toBeNull();
    expect(c.querySelector("[data-index-empty]")).toBeNull();
  });

  it("names the seam when the corpus was walked and would not parse", async () => {
    const c = await renderIndex(
      buildDoc({
        specs: [],
        degraded: [
          {
            read: "read_roadmap",
            mode: "unparseable",
            detail: "the roadmap corpus does not parse (1 spec rejected):\n  - unknown_state",
            path: "/scratch/specs",
          },
        ],
      }),
    );

    const note = c.querySelector("[data-corpus-note]");
    expect(note?.getAttribute("data-mode")).toBe("unparseable");
    expect(note?.textContent).toContain("read_roadmap");
    expect(note?.textContent).toContain("unknown_state");
  });

  it("says an empty corpus is empty, in words, with no note", async () => {
    const c = await renderIndex(buildDoc({ specs: [], degraded: [] }));

    expect(c.querySelector("[data-corpus-note]")).toBeNull();
    expect(c.querySelector("[data-index-list]")).toBeNull();
    expect(c.querySelector("[data-index-empty]")?.textContent).toContain(
      "This corpus holds no specs",
    );
  });

  it("says the read failed when the pane itself did not answer", async () => {
    const c = await renderIndex(null, 503);
    expect(c.querySelector("[data-corpus-note]")?.textContent).toContain("503");
    expect(c.querySelector("[data-index-list]")).toBeNull();
  });
});

describe("the index names what it read and when (US1-S5, FR-006)", () => {
  it("carries the revision, the instant and the uncommitted mark", async () => {
    const c = await renderIndex(buildDoc({ dirty: true }));

    const stamp = c.querySelector("[data-index-stamp]");
    expect(stamp?.querySelector("[data-read-instant]")?.textContent).toBe(
      "2026-08-28T05:00:00Z",
    );
    expect(stamp?.querySelector("[data-read-revision]")?.getAttribute("data-read-revision")).toBe(
      "bbbbbbb",
    );
    expect(stamp?.querySelector("[data-read-revision]")?.getAttribute("title")).toBe("b".repeat(40));
    expect(stamp?.querySelector("[data-tree-dirty]")?.textContent).toContain("uncommitted");
  });

  it("says unknown rather than inventing a revision the tree had none of", async () => {
    const c = await renderIndex(buildDoc({ revision: null, revision_short: null, dirty: null }));

    const stamp = c.querySelector("[data-index-stamp]");
    expect(stamp?.querySelector("[data-read-revision]")?.textContent).toBe("unknown");
    expect(stamp?.querySelector("[data-tree-dirty]")).toBeNull();
    // Unknown is not degraded: a directory that is no repository is not a
    // failed read (014's ruling, inherited — 018 plan D3).
    expect(c.querySelector("[data-corpus-note]")).toBeNull();
    expect(rows(c)).toHaveLength(CORPUS.length);
  });
});
