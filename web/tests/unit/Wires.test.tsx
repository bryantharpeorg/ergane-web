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

/**
 * The wires re-measure when the room relays the stage (008 US2, FR-004).
 *
 * `Wires` measures on mount, in a `requestAnimationFrame`, and on `resize`.
 * D-016's collapsing detail track fires none of those: the grid swaps one
 * value, the browser relays the stage, and nothing tells the paths. A stale
 * wire is the defect this story was most likely to ship and the one no law
 * FR-014 committed can see — it is inside its stage, inside the viewport, and
 * overlaps no text.
 *
 * It cannot be proven in a browser either, and measuring it there is how that
 * was found: the wires' coordinate space is the canvas's own (plan D1), the
 * cards are fixed-width and left-aligned inside it, and collapsing the track
 * translates the whole canvas — at 1280 the metrics grid gains a row and the
 * SVG origin drops 4.95px while every card keeps its offset from it to the
 * fraction. Relative geometry survives a translation, so the smoke's
 * `expectWiresFollowCards` passes either way.
 *
 * Here the boxes are the test's, so they can move the way a real relayout one
 * day will, and the two cases are the pair: the path follows a card that moved
 * when the selection changed, and it does *not* when nothing did — which is the
 * room `Wires` would have shipped measuring on mount and `resize` alone.
 */
describe("the wires re-measure when the room relays the stage (008 US2, FR-004)", () => {
  /** One edge, one array, reused: identity must not be what drives a measure. */
  const EDGES = [{ source: "us1", target: "us2", kind: "merge" as const }];

  /** The canvas's own origin, and the card boxes as this test lays them out. */
  const ORIGIN = new DOMRect(0, 0, 800, 400);
  const RELEASED = {
    us1: new DOMRect(0, 0, 180, 100),
    us2: new DOMRect(300, 0, 180, 100),
  };
  /** The same graph after the pane came back: narrower, and one row lower. */
  const SELECTED = {
    us1: new DOMRect(0, 40, 180, 100),
    us2: new DOMRect(220, 40, 180, 100),
  };

  let boxes: Record<string, DOMRect> = RELEASED;

  /**
   * jsdom reports every box as zero, so the boxes are stubbed — and so is the
   * animation frame. `Wires` re-measures once in a `requestAnimationFrame`
   * after mount; a frame firing between the two renders below would re-measure
   * for a reason that has nothing to do with the selection, which is the one
   * thing these two cases exist to tell apart.
   */
  function withStubbedLayout(run: () => void): void {
    const realRect = Element.prototype.getBoundingClientRect;
    const realFrame = globalThis.requestAnimationFrame;
    const realCancel = globalThis.cancelAnimationFrame;

    Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
      const id = this.getAttribute("data-story-id");
      if (id !== null && id in boxes) return boxes[id];
      if (this.hasAttribute("data-wires")) return ORIGIN;
      return realRect.call(this);
    };
    globalThis.requestAnimationFrame = ((): number => 0) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((): void => undefined) as typeof cancelAnimationFrame;

    try {
      run();
    } finally {
      Element.prototype.getBoundingClientRect = realRect;
      globalThis.requestAnimationFrame = realFrame;
      globalThis.cancelAnimationFrame = realCancel;
    }
  }

  /** A canvas of two cards and the wire between them, redrawn on demand. */
  function canvas(): (relayout: string) => string | null {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const root = createRoot(container);

    return (relayout: string) => {
      act(() => {
        root.render(
          <div>
            <Wires edges={EDGES} relayout={relayout} />
            <article data-story-id="us1" />
            <article data-story-id="us2" />
          </div>,
        );
      });
      return container.querySelector("[data-wire]")!.getAttribute("d");
    };
  }

  it("follows a card that moved, when the selection is what moved it", () => {
    boxes = RELEASED;
    const draw = canvas();

    withStubbedLayout(() => {
      expect(draw("none")).toBe("M180 50 C240 50 240 50 300 50");

      // The pick. `edges` is the same array — `Stage.tsx` memoises the edge
      // list precisely so this cannot pass on an incidental identity change —
      // so the selection is the only thing that is different.
      boxes = SELECTED;
      expect(draw("us1")).toBe("M180 90 C200 90 200 90 220 90");
    });
  });

  it("keeps the old geometry when nothing tells it the layout moved", () => {
    boxes = RELEASED;
    const draw = canvas();

    withStubbedLayout(() => {
      expect(draw("none")).toBe("M180 50 C240 50 240 50 300 50");

      // The control. Same cards, moved the same way, and the same render —
      // but the selection did not change, so nothing re-measures and the path
      // is the old layout's. This is the room measuring on mount and `resize`
      // alone, which is what `relayout` exists to stop being enough.
      boxes = SELECTED;
      expect(draw("none")).toBe("M180 50 C240 50 240 50 300 50");
    });
  });
});
