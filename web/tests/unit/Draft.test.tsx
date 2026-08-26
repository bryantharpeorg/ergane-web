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
 * **014 US2** adds the view half of the checks (`tests/test_draft_checks.py` is
 * the other half, over the seams themselves):
 *
 * * **US2-S1/S3** — each check renders as one row under the name of the function
 *   that answered it, with that function's seam beside it (FR-006, FR-008).
 * * **US2-S2** — a `DerivationError` renders with its lines intact and nothing
 *   elided, and the checks that would need the graph it did not produce read
 *   *not run* (FR-007).
 * * **US2-S4** — no composite verdict appears anywhere in the view, and the
 *   sentence saying the CLI's verdict is unavailable does (FR-009, SC-003).
 * * **US2-S5** — a check that could not run says which input it wanted, and
 *   wears the third answer rather than a refusal (FR-010).
 *
 * **014 US3** adds the room's half of the stage:
 *
 * * **US3-S1** — the compiled graph's nodes are drawn, unlit, inside the room
 *   (FR-011). What the stage draws is `tests/unit/DraftStage.test.tsx`.
 * * **US3-S3** — a document whose graph did not compile draws no stage at all,
 *   and the deriver's refusal is what stands in its place (FR-013).
 *
 * **Nothing here pins the live corpus** (008 US1). The spec directory is a name
 * no repository uses and every document's text is written by the test that
 * asserts it; the one graph is a recorded artefact from another repository's
 * floor, not a directory on this one's disk (constitution V).
 */
import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Draft from "../../src/draft/Draft";
import type {
  DraftCheck,
  DraftCheckFinding,
  DraftCheckState,
  DraftDocument,
  DraftDocumentEntry,
  DraftGraph,
} from "../../src/api/draftDocument";

/** A recorded `workgraph.json`, for the stage half (014 US3, constitution V). */
import twoNodeRaw from "../../../fixtures/workgraphs/002-expense-notes.json?raw";

/** A directory name no repository uses. */
const SPEC_DIR = "920-a-constructed-draft";

function present(name: string, text: string): DraftDocumentEntry {
  return { name, present: true, empty: text === "", text };
}

function absent(name: string): DraftDocumentEntry {
  return { name, present: false, empty: false, text: null };
}

/** The sentence the backend puts where a verdict would be (FR-009). */
const UNAVAILABLE =
  "These are three checks, not a verdict. `ergane spec validate` composes five " +
  "layers into one exit code inside a private CLI handler the distribution does " +
  "not export, so the pane cannot obtain that verdict and does not compose one " +
  "of its own.";

function check(
  name: string,
  state: DraftCheckState,
  overrides: Partial<DraftCheck> = {},
): DraftCheck {
  return {
    check: name,
    seam: `factory.workgraph.${name}`,
    state,
    detail: null,
    not_run_because: null,
    findings: [],
    ...overrides,
  };
}

function finding(
  detail: string,
  overrides: Partial<DraftCheckFinding> = {},
): DraftCheckFinding {
  return {
    detail,
    informational: false,
    document: null,
    node_id: null,
    task_ids: [],
    story_key: null,
    ...overrides,
  };
}

/** The three rows a spec whose everything is in order comes back with. */
function allPassed(): DraftCheck[] {
  return [
    check("derive_workgraph", "passed", {
      detail: "the `## Work Graph` section compiles: 2 nodes, 0 inferred edges",
    }),
    check("check_prompt_assembly", "passed", {
      detail: "every node of this graph can be handed an attempt prompt",
    }),
    check("check_slice_coverage", "passed", {
      detail: "every task written for a story is inside that story's slice",
    }),
  ];
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
    checks: allPassed(),
    graph: null,
    verdict_unavailable: UNAVAILABLE,
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


// --- 014 US2: each check answers in its own name ---------------------------

/** Every row's `data-check` in the order the view drew them. */
function checkNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll("[data-check]")].map(
    (row) => row.getAttribute("data-check") ?? "",
  );
}

function answers(container: HTMLElement): Record<string, string> {
  const found: Record<string, string> = {};
  container.querySelectorAll("[data-check]").forEach((row) => {
    found[row.getAttribute("data-check") ?? ""] =
      row.querySelector("[data-check-answer]")?.textContent ?? "";
  });
  return found;
}

describe("each check answers in its own name (US2-S1, US2-S3, FR-006/FR-008)", () => {
  it("renders one row per check, under the checker's own name", async () => {
    const c = await renderDraft(buildDoc());

    expect(checkNames(c)).toEqual([
      "derive_workgraph",
      "check_prompt_assembly",
      "check_slice_coverage",
    ]);
    document.body.removeChild(c);
  });

  it("names the seam each answer came from, beside the answer", async () => {
    const c = await renderDraft(
      buildDoc({
        checks: [
          check("derive_workgraph", "passed", {
            seam: "factory.workgraph.derive.derive_workgraph",
            detail: "the `## Work Graph` section compiles: 2 nodes, 0 inferred edges",
          }),
        ],
      }),
    );

    const row = c.querySelector('[data-check="derive_workgraph"]');
    expect(row?.querySelector("[data-check-name]")?.textContent).toBe(
      "derive_workgraph",
    );
    expect(row?.querySelector("[data-check-seam]")?.textContent).toBe(
      "factory.workgraph.derive.derive_workgraph",
    );
    document.body.removeChild(c);
  });

  it("gives each check its own answer, and never one answer for all three", async () => {
    const c = await renderDraft(
      buildDoc({
        checks: [
          check("derive_workgraph", "passed", { detail: "it compiles" }),
          check("check_prompt_assembly", "refused", {
            findings: [
              finding(
                "node 'us1': tasks.md declares no phase naming user story US1, so this node has no task slice to work (FR-006)",
                { node_id: "us1", document: "tasks.md" },
              ),
            ],
          }),
          check("check_slice_coverage", "not_run", {
            not_run_because: "there is no `tasks.md` to locate a task slice in",
          }),
        ],
      }),
    );

    expect(answers(c)).toEqual({
      derive_workgraph: "passed",
      check_prompt_assembly: "refused",
      check_slice_coverage: "not run",
    });
    document.body.removeChild(c);
  });

  it("renders a finding's coordinates and the seam's own sentence", async () => {
    const sentence =
      "task T002 names story US2, but it sits inside the task slice cut for US1 — the node building US2 is never shown it, and the node building US1 is shown it instead";
    const c = await renderDraft(
      buildDoc({
        checks: [
          check("check_slice_coverage", "refused", {
            findings: [finding(sentence, { task_ids: ["T002"], story_key: "US2" })],
          }),
        ],
      }),
    );

    const found = c.querySelector("[data-finding]");
    expect(found?.textContent).toContain(sentence);
    expect(found?.querySelector(".draft-finding-where")?.textContent).toContain("T002");
    expect(found?.getAttribute("data-finding-informational")).toBe("false");
    document.body.removeChild(c);
  });

  it("states a finding the seam did not count, and marks it as stated", async () => {
    const c = await renderDraft(
      buildDoc({
        checks: [
          check("check_slice_coverage", "passed", {
            findings: [
              finding(
                "task ids inside no story's slice and naming no story, so they reach no node: T003",
                { informational: true, task_ids: ["T003"] },
              ),
            ],
          }),
        ],
      }),
    );

    const found = c.querySelector("[data-finding]");
    expect(found?.getAttribute("data-finding-informational")).toBe("true");
    expect(found?.querySelector('[data-finding-kind="informational"]')).not.toBeNull();
    // And the row it sits in still reads passed: the seam marked it stated, and
    // the room does not promote it into a refusal.
    expect(answers(c)["check_slice_coverage"]).toBe("passed");
    document.body.removeChild(c);
  });
});

describe("a derivation error renders unsoftened (US2-S2, FR-007)", () => {
  const REFUSAL =
    "the `## Work Graph` section does not compile (2 declarations rejected):\n" +
    "  - US7: [story_id] declares a graph node for a story this spec does not declare\n" +
    "  - US2: [coverage] the spec declares this story and the `## Work Graph` section does not";

  function refusedDoc() {
    return buildDoc({
      checks: [
        check("derive_workgraph", "refused", { detail: REFUSAL }),
        check("check_prompt_assembly", "not_run", {
          not_run_because:
            "the work graph did not compile, so there are no nodes to check against — read the deriver's own refusal above",
        }),
        check("check_slice_coverage", "not_run", {
          not_run_because:
            "the work graph did not compile, so there are no nodes to check against — read the deriver's own refusal above",
        }),
      ],
    });
  }

  it("puts the whole message on screen, every rejection and every line", async () => {
    const c = await renderDraft(refusedDoc());

    const detail = c.querySelector(
      '[data-check="derive_workgraph"] [data-check-detail]',
    );
    expect(detail?.textContent).toBe(REFUSAL);
    // Every rejection, not the first: an author fixing one per render is the
    // failure mode the deriver collects them to avoid.
    expect(detail?.textContent).toContain("US7");
    expect(detail?.textContent).toContain("US2");
    // And its line breaks survive, so the list reads as a list.
    expect(detail?.textContent?.split("\n").length).toBe(3);
    document.body.removeChild(c);
  });

  it("claims no result for a check that would need the graph", async () => {
    const c = await renderDraft(refusedDoc());

    for (const name of ["check_prompt_assembly", "check_slice_coverage"]) {
      const row = c.querySelector(`[data-check="${name}"]`);
      expect(row?.getAttribute("data-check-state")).toBe("not_run");
      expect(row?.querySelector("[data-check-not-run]")?.textContent).toContain(
        "did not compile",
      );
      // Not run is not a refusal: nothing in the row wears the refused answer.
      expect(row?.querySelector('[data-check-answer="refused"]')).toBeNull();
      expect(row?.querySelector("[data-finding]")).toBeNull();
    }
    document.body.removeChild(c);
  });
});

describe("a check that could not run says so (US2-S5, FR-010)", () => {
  it("names the input it wanted rather than reporting a failure", async () => {
    const c = await renderDraft(
      buildDoc({
        documents: [
          present("spec.md", "# the sketch"),
          absent("plan.md"),
          absent("tasks.md"),
        ],
        checks: [
          check("derive_workgraph", "passed", { detail: "it compiles" }),
          check("check_prompt_assembly", "not_run", {
            not_run_because:
              "a node's attempt prompt is assembled from all three documents, and this spec has no plan.md and no tasks.md",
          }),
          check("check_slice_coverage", "not_run", {
            not_run_because:
              "there is no `tasks.md` to locate a task slice in, so the lint has no opinion about this spec",
          }),
        ],
      }),
    );

    expect(c.querySelector("[data-check-answer='not_run']")?.textContent).toBe(
      "not run",
    );
    expect(
      c.querySelector('[data-check="check_slice_coverage"] [data-check-not-run]')
        ?.textContent,
    ).toContain("tasks.md");
    // The commonest shape in this corpus earns no degraded note and no refusal.
    expect(c.querySelector(".degraded")).toBeNull();
    expect(c.querySelector('[data-check-answer="refused"]')).toBeNull();
    document.body.removeChild(c);
  });
});

describe("no composite verdict anywhere in the view (US2-S4, FR-009, SC-003)", () => {
  /** A document with all three answers at once — the shape a summariser would
   *  most want to reduce, and the one this suite refuses to let it. */
  function mixedDoc() {
    return buildDoc({
      checks: [
        check("derive_workgraph", "passed", { detail: "it compiles" }),
        check("check_prompt_assembly", "refused", {
          findings: [finding("node 'us1' has no task slice", { node_id: "us1" })],
        }),
        check("check_slice_coverage", "not_run", {
          not_run_because: "there is no `tasks.md` to locate a task slice in",
        }),
      ],
    });
  }

  it("wears exactly one answer per check and not one more", async () => {
    const c = await renderDraft(mixedDoc());

    const worn = c.querySelectorAll("[data-check-answer]");
    expect(worn.length).toBe(3);
    // And every one of them is inside a row that names the checker it belongs
    // to — an answer outside a row would be an answer about the whole spec.
    worn.forEach((answer) => {
      expect(answer.closest("[data-check]")).not.toBeNull();
    });
    document.body.removeChild(c);
  });

  it("shows no verdict, pass/fail pill or tally over the three", async () => {
    const c = await renderDraft(mixedDoc());
    const text = c.textContent ?? "";

    for (const composite of [
      "PASS",
      "FAIL",
      "VALID",
      "INVALID",
      "2 of 3",
      "1 failed",
      "2 passed",
      "looks good",
      "all checks",
    ]) {
      expect(text, `the view claims ${composite}`).not.toContain(composite);
    }
    // Nor by another name: nothing in the room is marked as a verdict.
    expect(c.querySelector("[data-verdict]")).toBeNull();
    expect(c.querySelector("[data-check-verdict]")).toBeNull();
    expect(c.querySelector("[data-checks-summary]")).toBeNull();
    document.body.removeChild(c);
  });

  it("says the CLI's verdict is not available to the pane", async () => {
    const c = await renderDraft(mixedDoc());

    const statement = c.querySelector("[data-verdict-unavailable]");
    expect(statement).not.toBeNull();
    expect(statement?.textContent).toContain("ergane spec validate");
    expect(statement?.textContent).toBe(UNAVAILABLE);
    document.body.removeChild(c);
  });
});

/**
 * The room's half of US3: whether there is a stage on the page at all.
 *
 * What the stage *draws* is `tests/unit/DraftStage.test.tsx`, over recorded
 * workgraphs. What is asserted here is the wiring — that the room hands the
 * document's own graph to the stage and draws none when the document carries
 * none — because FR-013 is a claim about the whole view and not about a
 * component nobody mounted.
 */
describe("the graph draws what will run (US3-S1, US3-S3)", () => {
  /** The recorded two-node artefact, in the shape the document carries it. */
  const graph = JSON.parse(twoNodeRaw) as DraftGraph;

  it("draws the compiled graph's nodes, unlit, in the room", async () => {
    const c = await renderDraft(buildDoc({ graph }));

    expect(c.querySelector("[data-draft-stage]")).not.toBeNull();
    expect(
      [...c.querySelectorAll("[data-draft-node]")].map((card) =>
        card.getAttribute("data-story-id"),
      ),
    ).toEqual(["us1", "us2"]);
    // Unlit in the room as well as in the component: the Showfloor's clothing
    // reaches no node here, because none of them has run (FR-011).
    expect(c.querySelectorAll("[data-ladder]").length).toBe(0);
    expect(c.querySelectorAll("[data-draft-node] [data-chip]").length).toBe(0);
    document.body.removeChild(c);
  });

  it("draws no stage when the graph did not compile (FR-013)", async () => {
    // The document a refused derivation produces: the deriver's own message is
    // on the page under its own name, and `graph` is null.
    const c = await renderDraft(
      buildDoc({
        graph: null,
        checks: [
          check("derive_workgraph", "refused", {
            detail: "US2 declares `depends_on: [US9]`, which no story declares",
          }),
          check("check_prompt_assembly", "not_run", {
            not_run_because: "the work graph did not compile",
          }),
          check("check_slice_coverage", "not_run", {
            not_run_because: "the work graph did not compile",
          }),
        ],
      }),
    );

    // No stage, and no part of one: an empty stage is a claim about a graph.
    for (const part of ["[data-draft-stage]", "[data-draft-stage-canvas]", "[data-wires]"]) {
      expect(c.querySelectorAll(part).length, `${part} was drawn`).toBe(0);
    }
    // And the reason is on screen, in the deriver's own words — which is the
    // answer to "why is there no stage", said by the thing that knows.
    expect(c.querySelector('[data-check="derive_workgraph"]')?.textContent).toContain(
      "which no story declares",
    );
    document.body.removeChild(c);
  });

  it("draws no stage for the trio the corpus mostly has — a sketch", async () => {
    // Most of this corpus is a `spec.md` with no Work Graph in it, so `graph`
    // is null on most renders. That is the common case, not the error case, and
    // it produces no stage and no note (FR-002, FR-013 together).
    const c = await renderDraft(
      buildDoc({
        graph: null,
        documents: [present("spec.md", "# a sketch"), absent("plan.md"), absent("tasks.md")],
      }),
    );

    expect(c.querySelector("[data-draft-stage]")).toBeNull();
    expect(c.querySelector(".degraded")).toBeNull();
    document.body.removeChild(c);
  });
});
