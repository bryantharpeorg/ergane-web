/// <reference types="vite/client" />
/**
 * The drafting table's unlit stage (014 US3).
 *
 * One claim per acceptance scenario:
 *
 * * **US3-S1** — a graph that compiles to more than one node draws with the
 *   Showfloor's stage assets, and **no node carries a run state**: no chip, no
 *   ladder, no stop, no selection, and none of the eleven states' vocabulary
 *   anywhere in the rendered text (FR-011).
 * * **US3-S2** — `depends_on_merged` draws with the merge stroke and
 *   `depends_on` with the pass one, told apart by the class and the kind each
 *   path carries (FR-012). The *pair* is proven over the recorded five-node
 *   workgraph, which is the only artefact in this repository declaring both.
 * * **US3-S3** — a graph that did not compile draws **no stage at all**: not an
 *   empty canvas, not a rank with nothing in it (FR-013).
 *
 * US3-S4 is the four layout laws, which need real boxes and are measured in a
 * real browser: `tests/smoke/draft.spec.ts`. Geometry is not asserted here and
 * cannot be — jsdom reports every box as zero, which is precisely the blind spot
 * 004's suite had — so what is asserted is the path *set*, one per declared
 * edge, each wearing its kind.
 *
 * **The graphs are recorded, never invented** (constitution V). They are the
 * `workgraph.json` artefacts under `fixtures/workgraphs/`, which is the same
 * shape `derive_workgraph` hands the pane through `pane/checks.py` — the value
 * serialized, not a description of it. Nothing here pins the live corpus: these
 * are recorded documents from another repository's floor, not directories on
 * this one's disk (008 US1).
 */

import { afterEach, describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import DraftStage, { subLine } from "../../src/draft/DraftStage";
import type { DraftGraph } from "../../src/api/draftDocument";

import twoNodeRaw from "../../../fixtures/workgraphs/002-expense-notes.json?raw";
import fiveMergeRaw from "../../../fixtures/workgraphs/001-trip-expenses.json?raw";
import bothKindsRaw from "../../../fixtures/workgraphs/077-a-scanner-the-operator-chooses-runs-in-the-loop.json?raw";

const twoNode = JSON.parse(twoNodeRaw) as DraftGraph;
const fiveMerge = JSON.parse(fiveMergeRaw) as DraftGraph;
const bothKinds = JSON.parse(bothKindsRaw) as DraftGraph;

const containers: HTMLElement[] = [];

function render(graph: DraftGraph | null): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  act(() => {
    createRoot(container).render(<DraftStage graph={graph} />);
  });
  return container;
}

afterEach(() => {
  while (containers.length > 0) {
    const container = containers.pop() as HTMLElement;
    if (container.parentNode !== null) container.parentNode.removeChild(container);
  }
});

/** Every card on the stage, in the order the ranks lay them out. */
function cards(container: HTMLElement) {
  return Array.from(container.querySelectorAll("[data-draft-node]")).map((card) => ({
    id: card.getAttribute("data-story-id"),
    key: card.querySelector("[data-node-id]")?.textContent ?? null,
    persona: card.querySelector("[data-node-persona]")?.textContent ?? null,
    sub: card.querySelector("[data-node-sub]")?.textContent ?? null,
  }));
}

/** The ids in each rank, left→right. */
function ranks(container: HTMLElement): string[][] {
  return Array.from(container.querySelectorAll("[data-rank]")).map((rank) =>
    Array.from(rank.querySelectorAll("[data-draft-node]")).map(
      (card) => card.getAttribute("data-story-id") ?? "",
    ),
  );
}

function wires(container: HTMLElement) {
  return Array.from(container.querySelectorAll("[data-wire]")).map((path) => ({
    kind: path.getAttribute("data-edge-kind"),
    className: path.getAttribute("class"),
    source: path.getAttribute("data-edge-source"),
    target: path.getAttribute("data-edge-target"),
  }));
}

describe("a compiled graph draws, unlit (US3-S1, FR-011)", () => {
  it("draws one card per node of a multi-node graph", () => {
    const container = render(twoNode);

    expect(container.querySelector("[data-draft-stage]")).not.toBeNull();
    expect(cards(container).map((card) => card.id)).toEqual(["us1", "us2"]);
  });

  it("ranks the nodes left→right by the dependencies the graph declares", () => {
    // 001-trip-expenses: us1 → us2 → us3, and us4/us5 wait on more than one, so
    // each node's rank is the longest path that reaches it.
    expect(ranks(render(fiveMerge))).toEqual([["us1"], ["us2"], ["us3"], ["us4"], ["us5"]]);

    // 077 puts two nodes in the first rank and mixes both edge kinds into the
    // third, which is the case a rank walk that stopped at the first edge would
    // get wrong.
    expect(ranks(render(bothKinds))).toEqual([["us1", "us2"], ["us3"], ["us4"], ["us5"]]);
  });

  it("carries no run state on any node: no chip, no ladder, no stop", () => {
    const container = render(bothKinds);

    // The eleven-state glyph grammar dresses an `epic_status` answer. There is
    // no answer: nothing has run. DESIGN.md forbids the alternative in as many
    // words — "Do not add a twelfth glyph for 'not yet': that is the absence of
    // state, not a state."
    for (const clothing of [
      "[data-chip]",
      ".chip",
      "[data-ladder]",
      "[data-stop]",
      "[data-ladder-tone]",
      "[data-selected]",
      "[data-metrics]",
    ]) {
      expect(
        container.querySelectorAll(clothing).length,
        `${clothing} is a run's clothing and no node here has run`,
      ).toBe(0);
    }
  });

  it("says no word of the status vocabulary anywhere on the stage", () => {
    // The classes above are one half; the words are the other. A card that
    // wrote "ready" or "building" in text would be making the same claim
    // without the class that would have been caught.
    const text = (render(bothKinds).textContent ?? "").toLowerCase();
    for (const word of [
      "landed",
      "merged",
      "building",
      "verifying",
      "queue",
      "pr open",
      "ready",
      "waiting on you",
      "killed",
      "failed",
    ]) {
      expect(text, `the unlit stage said "${word}"`).not.toContain(word);
    }
  });

  it("is not a control: no button, and nothing to pick", () => {
    // The Showfloor's card is a `<button>` because a pick fills its detail
    // pane. This room has no pane, no selection and no verb (constitution I).
    const container = render(bothKinds);
    expect(container.querySelectorAll("button").length).toBe(0);
    expect(container.querySelectorAll("[aria-pressed]").length).toBe(0);
    expect(container.querySelectorAll("a").length).toBe(0);
  });

  it("shows the facts the graph really carries, and no others", () => {
    const container = render(twoNode);
    const [first, second] = cards(container);

    // The story key in the id block, the persona that will run the node, and
    // the requirements it implements with the timeout it was compiled with.
    expect(first.key).toBe("US1");
    expect(first.persona).toBe("implementer");
    expect(first.sub).toBe("FR-001 · FR-002 · FR-003 · FR-004 · FR-005 · timeout 1h 30m");
    expect(second.key).toBe("US2");
    expect(second.sub).toBe("FR-006 · FR-007 · FR-008 · timeout 1h 30m");

    // The story key is not repeated as a requirement of itself, though
    // `requirement_keys` carries it — the same subtraction the Showfloor's
    // stage makes when it counts FRs.
    expect(first.sub).not.toContain("US1");
  });

  it("invents no timeout for a node that declared none", () => {
    // `001-trip-expenses` declares no `timeout` on any story, so the seconds a
    // node will really run under come from its persona in the operator's
    // registry — a file this pane does not read (constitution II).
    const [first] = cards(render(fiveMerge));
    expect(first.sub).toBe("FR-001 · FR-003 · FR-005 · FR-020 · FR-021");
    expect(first.sub).not.toContain("timeout");
  });

  it("names the graph as unrun on screen, not only in its clothing", () => {
    // § Named Rules: every state into words on the element that carries it. The
    // absence of one is a thing to say, and this is where it is said.
    const statement =
      render(twoNode).querySelector("[data-draft-stage-statement]")?.textContent ?? "";
    expect(statement).toContain("Unlit");
    expect(statement).toContain("none has run");
    expect(statement).toContain("derive_workgraph");
  });
});

describe("subLine reads the node and nothing else", () => {
  it("falls back to the dispatch id rather than rendering nothing", () => {
    // A node that declares neither still has the id the deriver gave it, which
    // is a fact the graph recorded. An empty sub-line would be furniture.
    expect(
      subLine({
        id: "us9",
        story_key: "US9",
        persona: "implementer",
        spec_ref: "spec:US9",
        requirement_keys: ["US9"],
        depends_on: [],
        depends_on_merged: [],
        timeout_override_s: null,
      }),
    ).toBe("us9");
  });
});

describe("the two strokes, told apart (US3-S2, FR-012)", () => {
  it("draws the merge stroke for depends_on_merged", () => {
    expect(wires(render(twoNode))).toEqual([
      { kind: "merge", className: "wire merge", source: "us1", target: "us2" },
    ]);
  });

  it("draws both kinds from the one graph that declares both", () => {
    // 077 is the only recorded artefact carrying a `depends_on` edge beside a
    // `depends_on_merged` one, which is why the pair is proven here: this
    // repository's own corpus declares merge edges and nothing else, because
    // its stories share files.
    const drawn = wires(render(bothKinds));

    expect(drawn.filter((wire) => wire.kind === "merge")).toEqual([
      { kind: "merge", className: "wire merge", source: "us2", target: "us4" },
    ]);
    expect(drawn.filter((wire) => wire.kind === "pass").map((wire) => wire.className)).toEqual([
      "wire pass",
      "wire pass",
      "wire pass",
    ]);
    expect(
      drawn.map((wire) => `${wire.kind}:${wire.source}->${wire.target}`).sort(),
    ).toEqual([
      "merge:us2->us4",
      "pass:us2->us3",
      "pass:us3->us4",
      "pass:us4->us5",
    ]);
  });

  it("draws exactly one path per declared edge and not one more", () => {
    // Both lists are read, neither is re-derived: a wire the graph did not
    // declare is a dependency the pane invented.
    const declared = bothKinds.nodes.reduce(
      (total, node) => total + node.depends_on.length + node.depends_on_merged.length,
      0,
    );
    expect(wires(render(bothKinds))).toHaveLength(declared);
  });
});

describe("a graph that did not compile draws no stage (US3-S3, FR-013)", () => {
  it("draws nothing at all for a null graph", () => {
    const container = render(null);

    // Not an empty canvas and not a placeholder: "an empty stage is a claim
    // about a graph, and there is no graph."
    expect(container.textContent).toBe("");
    for (const part of [
      "[data-draft-stage]",
      "[data-draft-stage-canvas]",
      "[data-draft-stage-scroll]",
      "[data-wires]",
      "[data-rank]",
      "[data-draft-node]",
    ]) {
      expect(container.querySelectorAll(part).length, `${part} was drawn`).toBe(0);
    }
  });

  it("draws nothing for a graph carrying no nodes", () => {
    // `derive_workgraph` refuses a spec with no `## Work Graph` rather than
    // compiling an empty one, so this is a shape that should never arrive — and
    // a canvas with nothing on it would still be a claim about a node set.
    const container = render({ ...twoNode, nodes: [] });
    expect(container.textContent).toBe("");
    expect(container.querySelectorAll("[data-draft-stage]").length).toBe(0);
  });

  it("draws nothing for a body that carried no graph key at all", () => {
    // The document is JSON off the wire. A body that satisfied the type and
    // omitted the field would otherwise be read for a node list that is not
    // there — the reason `Draft.tsx` names both of its lists in its own guard.
    const container = render(undefined as unknown as DraftGraph | null);
    expect(container.textContent).toBe("");
  });
});
