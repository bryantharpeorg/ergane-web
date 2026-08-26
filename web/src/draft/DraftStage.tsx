/**
 * The graph draws what will run: a compiled Work Graph, unlit (014 US3).
 *
 * This is the moment the room exists for. Flipping a spec `state: ready` is the
 * most expensive act in the product — the roadmap dispatches within 300 seconds,
 * spending tokens, opening pull requests and moving `dev` — and until this
 * landed nothing showed the operator what was about to run. The node set, the
 * edges and the personas are derivable in milliseconds and had never been on
 * screen before dispatch.
 *
 * **The stage is reused, not re-drawn** (plan D4, `DESIGN.md` § The drafting
 * table: "A compiled Work Graph draws with the Showfloor's stage assets and the
 * same two edge strokes, with every node in the unlit form"). `Wires` is the
 * Showfloor's own component, `edgesOf` and `ranksOf` are the Showfloor's own
 * functions — widened in 014 US3 to take the graph's three fields rather than a
 * whole `ShowfloorStory`, so there is **one** implementation of what a
 * dependency means and one of where a rank goes. The card's clothing is the
 * Showfloor's `.node` rule, shared by selector rather than copied. A second
 * DAG layout in this repository would be D-005's defect in TypeScript.
 *
 * **Unlit is the absence of state, not a state** (FR-011). The eleven-state
 * glyph grammar maps `epic_status` states onto the ladder and the chips; a graph
 * that has not dispatched has no `epic_status` answer at all, so the card wears
 * no chip and no ladder. DESIGN.md forbids the tempting alternative in as many
 * words: "Do not add a twelfth glyph for 'not yet': that is the absence of
 * state, not a state." What is left is what the *graph* really carries — the
 * story key, the persona that will run the node, the requirements it implements
 * and the timeout it was compiled with.
 *
 * **And a graph that did not compile draws nothing at all** (FR-013). Not an
 * empty canvas, not a placeholder rank: an empty stage is a claim about a graph,
 * and there is no graph. The deriver's own refusal is already on screen one
 * section above, in its own words, under its own name (US2, FR-007) — which is
 * the answer to "why is there no stage", said by the thing that knows.
 *
 * **This component derives nothing.** The graph arrives on the document,
 * compiled by `derive_workgraph` from the same bytes the room is rendering
 * (`pane/checks.py`, plan D1). Nothing here parses a `## Work Graph`, infers an
 * edge, or decides a rank the deriver did not already fix by declaration order.
 */

import { useMemo } from "react";
import type { DraftGraph, DraftGraphNode } from "../api/draftDocument";
import { formatDuration, ranksOf, edgesOf } from "../showfloor/Stage";
import { EDGE_LEGEND } from "../showfloor/Legend";
import Wires from "../showfloor/Wires";

/**
 * The card's mono sub-line: what this node implements, and how long it may run.
 *
 * `requirement_keys` carries the story's own key beside its FRs (`US3`,
 * `FR-011`, …) and the id block above already says `US3`, so the story key is
 * not repeated as a requirement of itself — the same subtraction
 * `Stage.requirementCount` makes for the same reason.
 *
 * `timeout_override_s` is the seconds the `## Work Graph` declared for this
 * story, rendered through the stage's own duration vocabulary rather than a
 * second one. A node without an override is not given a number: the timeout it
 * will actually run under comes from its persona in the operator's registry,
 * which is a file this pane does not read (constitution II), and printing a
 * default here would be the pane inventing a fact.
 *
 * Never empty and never invented: a node that declares neither still has the
 * dispatch id the deriver gave it, which is a fact the graph recorded.
 */
export function subLine(node: DraftGraphNode): string {
  const parts = node.requirement_keys.filter((key) => key !== node.story_key);
  if (node.timeout_override_s !== null) {
    parts.push(`timeout ${formatDuration(node.timeout_override_s)}`);
  }
  return parts.length === 0 ? node.id : parts.join(" · ");
}

/**
 * One node of a compiled graph, in the unlit form.
 *
 * Deliberately **not** a `<button>`. The Showfloor's card is one because a pick
 * fills its detail pane; this room has no pane, no selection and no verb, and a
 * card that wore `cursor: pointer` would advertise one (constitution I). That
 * is why the Showfloor's four control resets moved out of the shared `.node`
 * rule in this diff — the card's *design* is one declaration, its *clothing as
 * a control* is the Showfloor's alone.
 *
 * `data-story-id` is not decoration either: it is how `Wires` finds the box to
 * draw from, by the id the deriver gave the node.
 */
function UnlitNode({ node }: { node: DraftGraphNode }): JSX.Element {
  return (
    <div className="node" data-draft-node data-story-id={node.id}>
      <span className="nid" data-node-id>
        {node.story_key}
      </span>
      {/* The persona that will run it — the pre-dispatch fact this whole room
          was opened to see, and one the Showfloor's card never shows because by
          then the run has facts of its own. */}
      <span className="ntitle" data-node-persona>
        {node.persona}
      </span>
      <span className="nsub" data-node-sub>
        {subLine(node)}
      </span>
    </div>
  );
}

export default function DraftStage({ graph }: { graph: DraftGraph | null }): JSX.Element | null {
  // Hooks run before the branch below, because they must run on every render:
  // a graph that becomes null between renders must not change the hook order.
  //
  // `Array.isArray` and not `graph === null`, for the reason `Draft.tsx` names
  // both of its lists in its own shape guard: the body is JSON off the wire, and
  // a document that carried no `graph` key at all would satisfy the type and
  // then be read for a field that is not there.
  const declared = graph?.nodes;
  const nodes: DraftGraphNode[] = Array.isArray(declared) ? declared : [];
  const edges = useMemo(() => edgesOf(nodes), [nodes]);

  // FR-013, and the empty-graph case with it. A null graph is one that does not
  // exist; a compiled graph with no nodes is not something `derive_workgraph`
  // returns — it refuses a spec with no `## Work Graph` — and if one ever
  // arrived, a canvas with nothing on it would still be a claim about a node
  // set. Neither draws a stage. § Stage already settles the shape for the other
  // room: "an epic whose stage document has no nodes renders … with **no stage
  // canvas at all**."
  if (nodes.length === 0) return null;

  return (
    <section
      className="draft-stage"
      /* `data-stage` is what puts this section under § Layout's first
         containment law, which measures every descendant of a stage against its
         stage's box (FR-014, `tests/smoke/support/laws.ts`). The Showfloor's
         stage carries it for that reason and this one is a stage. */
      data-stage
      data-draft-stage
      aria-labelledby="draft-stage-name"
    >
      <h2 className="draft-stage-name num" id="draft-stage-name">
        What will run
      </h2>
      <p className="draft-stage-statement" data-draft-stage-statement>
        The node set and the edges the factory will dispatch, compiled by{" "}
        <span className="num">derive_workgraph</span> from the{" "}
        <span className="num">spec.md</span> below. Unlit: no node carries a run
        state, because none has run.
      </p>
      {/* § Stage: "The stage scrolls horizontally when a graph outgrows it",
          and this wrapper is also the scrolling ancestor the containment law
          allows a wide graph to live inside. */}
      <div className="dag-scroll" data-draft-stage-scroll>
        <div className="dag" data-draft-stage-canvas>
          {/* The wires measure their own box and walk their parent for the
              cards, so the canvas needs no ref. Nothing in this room relays the
              stage without resizing the window, so there is no `relayout` to
              pass: there is no selection here to collapse a track. */}
          <Wires edges={edges} />
          <div className="ranks" data-ranks>
            {ranksOf(nodes).map((column, depth) => (
              <div className="rank" data-rank={depth} key={depth}>
                {column.map((node) => (
                  <UnlitNode key={node.id} node={node} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* § Named Rules: state is never carried by colour alone, and a wire has
          nowhere to write its word. The sentence is the Showfloor legend's own
          — imported, not re-spelt — but the legend itself is not rendered here:
          its four ladder fills describe a run that has not happened, and "don't
          render an element that can never fill" is § Do's and Don'ts. */}
      <p className="draft-stage-legend" data-draft-stage-legend>
        {EDGE_LEGEND}
      </p>
    </section>
  );
}
