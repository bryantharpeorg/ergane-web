/// <reference types="vite/client" />
/**
 * The wires: one path per declared edge, told apart by kind (005 US3-S3,
 * FR-012).
 *
 * **Succeeds `tests/unit/layoutStage.test.ts`**, deleted in this story's diff.
 * That file asserted dagre's rank assignment and the pixel height the pane
 * computed for a React Flow canvas — the two coordinate systems whose
 * disagreement shipped 004's invisible graphs. Plan D1 deletes the library
 * rather than the assertion: there is one coordinate space now, the canvas's
 * own, and what it needs proving about is that every declared edge becomes
 * exactly one path wearing its kind.
 *
 * Geometry is not asserted here and cannot be: jsdom reports every box as zero,
 * which is precisely the blind spot 004's suite had. The measured half is
 * `tests/smoke/showfloor.spec.ts`, in a real browser, where the paths' end
 * points are checked against the cards they claim to join.
 *
 * The edges are read off recorded workgraphs (constitution V).
 */

import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Wires, { pathBetween } from "../../src/showfloor/Wires";
import Stage, { edgesOf } from "../../src/showfloor/Stage";
import { entryFromWorkgraph } from "./support/showfloor-builder";

import twoNodeRaw from "../../../fixtures/workgraphs/002-expense-notes.json?raw";
import fiveNodeRaw from "../../../fixtures/workgraphs/077-a-scanner-the-operator-chooses-runs-in-the-loop.json?raw";

const containers: HTMLElement[] = [];

function renderStage(raw: string): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  act(() => {
    createRoot(container).render(<Stage entry={entryFromWorkgraph(raw)} floor={null} />);
  });
  return container;
}

function wiresOf(container: HTMLElement) {
  return Array.from(container.querySelectorAll("[data-wire]")).map((path) => ({
    kind: path.getAttribute("data-edge-kind"),
    className: path.getAttribute("class"),
    source: path.getAttribute("data-edge-source"),
    target: path.getAttribute("data-edge-target"),
  }));
}

describe("one path per declared edge, wearing its kind (FR-012)", () => {
  it("draws the two-node graph's single merge edge", () => {
    const container = renderStage(twoNodeRaw);
    expect(wiresOf(container)).toEqual([
      { kind: "merge", className: "wire merge", source: "us1", target: "us2" },
    ]);
  });

  it("draws the five-node graph's four edges, both kinds among them", () => {
    const container = renderStage(fiveNodeRaw);
    const drawn = wiresOf(container);

    // The count is the workgraph's, edge for edge.
    expect(drawn.length).toBe(edgesOf(entryFromWorkgraph(fiveNodeRaw).stories).length);
    expect(drawn).toEqual([
      { kind: "pass", className: "wire pass", source: "us2", target: "us3" },
      { kind: "merge", className: "wire merge", source: "us2", target: "us4" },
      { kind: "pass", className: "wire pass", source: "us3", target: "us4" },
      { kind: "pass", className: "wire pass", source: "us4", target: "us5" },
    ]);

    // This recorded graph really carries both kinds; a fixture of one would
    // prove half of the pair § Stage draws.
    expect(drawn.some((wire) => wire.kind === "merge")).toBe(true);
    expect(drawn.some((wire) => wire.kind === "pass")).toBe(true);
  });

  it("sits behind the cards, and takes no pointer", () => {
    const container = renderStage(fiveNodeRaw);
    const canvas = container.querySelector("[data-stage-canvas]")!;
    const svg = container.querySelector("[data-wires]")!;

    // "behind the cards" is the DOM order inside the canvas: the SVG comes
    // first, the ranks after it (§ Stage).
    expect(svg.parentElement).toBe(canvas);
    expect(canvas.firstElementChild).toBe(svg);
    expect(canvas.querySelector("[data-ranks]")!.previousElementSibling).toBe(svg);

    // `pointer-events: none` is the stylesheet's, and the SVG is out of the
    // accessibility tree: a wire is a stroke, not a thing to read or click.
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.querySelectorAll("text").length).toBe(0);
  });

  it("draws nothing for an edge whose endpoint is not on the stage", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    act(() => {
      createRoot(container).render(
        <div>
          <Wires edges={[{ source: "us1", target: "us404", kind: "merge" }]} />
          <article data-story-id="us1" />
        </div>,
      );
    });

    // A wire to a card that is not there would be the pane asserting a
    // dependency the document did not make.
    expect(container.querySelectorAll("[data-wire]").length).toBe(0);
    expect(container.querySelector("[data-wires]")).not.toBeNull();
  });
});

describe("the cubic runs out of one box and into the next", () => {
  it("starts at the source's right edge and ends at the target's left", () => {
    const origin = new DOMRect(100, 50, 800, 400);
    const from = new DOMRect(140, 90, 180, 100); // right 320, mid-y 140
    const to = new DOMRect(420, 190, 180, 100); // left 420, mid-y 240

    // Relative to the canvas: (220, 90) → (320, 190), control points at the
    // horizontal midpoint, which is what makes the wire read rank-to-rank.
    expect(pathBetween(from, to, origin)).toBe("M220 90 C270 90 270 190 320 190");
  });
});
