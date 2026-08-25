/**
 * The stage's wires: one cubic path per declared edge, drawn from measured
 * boxes.
 *
 * `DESIGN.md` § Stage: "wires drawn rank-to-rank — **merge edges solid 2px
 * olive, pass edges dashed 2px `--rule`** — behind the cards,
 * `pointer-events: none`".
 *
 * Plan D1 is why this is sixty lines of SVG and not a graph library. The first
 * world laid its graph out with React Flow's `fitView` against a height the
 * pane computed itself, and shipped nine of nine stations outside their own
 * map. Here there is no second coordinate space to disagree with: the cards are
 * laid out by flex, the wires are measured off the boxes flex produced, and a
 * path can only be wrong if the box it was read from is.
 *
 * Two details earn their comments.
 *
 * The coordinate space is *this element's own box*. The SVG is `inset: 0` on
 * the canvas and carries no `viewBox`, so its user units are the canvas's CSS
 * pixels — the same space the cards were measured in. Measuring against a ref
 * the parent holds would not work anyway: React attaches a parent's ref after
 * its children's layout effects run, so a child reading `parent.current` on
 * mount reads `null`. Reading its own box has no such window.
 *
 * And measurement has to happen after layout, so it runs in a layout effect
 * (before paint) and again in a `requestAnimationFrame` (after the browser has
 * settled fonts and scrollbars), and once more on every `resize`. In jsdom
 * every box is zero, which is why the unit tests assert the path set — one path
 * per edge, each carrying its kind — and the smoke asserts the geometry.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** One edge of the stage graph, in the document's own vocabulary. */
export interface WireEdge {
  source: string;
  target: string;
  /** `merge` is `depends_on_merged`; `pass` is `depends_on`. */
  kind: "merge" | "pass";
}

interface WiresProps {
  edges: WireEdge[];
}

interface DrawnWire extends WireEdge {
  d: string;
}

/** A card's box, found by the story id the document gave it. */
function boxOf(canvas: Element, storyId: string): DOMRect | null {
  // Matched by attribute value rather than composed into a selector: a story id
  // is the factory's word, and quoting it into CSS is a parser this file has no
  // business owning.
  for (const card of Array.from(canvas.querySelectorAll("[data-story-id]"))) {
    if (card.getAttribute("data-story-id") === storyId) {
      return (card as HTMLElement).getBoundingClientRect();
    }
  }
  return null;
}

/** The cubic the comp draws: out of the source's right edge, into the target's left. */
export function pathBetween(from: DOMRect, to: DOMRect, origin: DOMRect): string {
  const x1 = from.right - origin.left;
  const y1 = from.top + from.height / 2 - origin.top;
  const x2 = to.left - origin.left;
  const y2 = to.top + to.height / 2 - origin.top;
  const mx = (x1 + x2) / 2;
  return `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
}

export default function Wires({ edges }: WiresProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drawn, setDrawn] = useState<DrawnWire[]>([]);
  const frame = useRef<number | null>(null);

  const measure = useCallback(() => {
    const svg = svgRef.current;
    const canvas = svg === null ? null : svg.parentElement;
    if (svg === null || canvas === null) return;
    const origin = svg.getBoundingClientRect();

    const paths: DrawnWire[] = [];
    for (const edge of edges) {
      const from = boxOf(canvas, edge.source);
      const to = boxOf(canvas, edge.target);
      // An edge naming a story the graph does not carry draws nothing rather
      // than a path from the origin: a wire to nowhere is a claim about a
      // dependency the document did not make.
      if (from === null || to === null) continue;
      paths.push({ ...edge, d: pathBetween(from, to, origin) });
    }

    setDrawn(paths);
  }, [edges]);

  useLayoutEffect(() => {
    measure();
    frame.current = requestAnimationFrame(measure);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <svg className="wires" data-wires aria-hidden="true" ref={svgRef}>
      {drawn.map((wire) => (
        <path
          key={`${wire.source}->${wire.target}:${wire.kind}`}
          className={`wire ${wire.kind}`}
          data-wire
          data-edge-kind={wire.kind}
          data-edge-source={wire.source}
          data-edge-target={wire.target}
          d={wire.d}
        />
      ))}
    </svg>
  );
}
