/**
 * One epic's stage on the Showfloor.
 *
 * DESIGN.md § Layout, § Route Map and Landing Line, § Elevation & Depth.
 *
 * The stage is the size of its graph (FR-002): its height arrives from
 * `stageHeight()`, a function of rank depth and the 140px row spacing
 * DESIGN.md names, and never from the viewport. An epic with nothing staged
 * is not a short stage but no stage at all (FR-001) — its name and the notice
 * that says what could not be read, and no canvas.
 *
 * The route is DESIGN.md's two-column grid, `220px 1fr`. Column two is a
 * horizontally scrolling wrapper and the map lives inside it, so everything the
 * map's coordinate space places — the landing line at x=930 included — is
 * reachable by scrolling rather than laid out past the container (FR-004,
 * FR-005).
 */

import { ReactFlow } from "@xyflow/react";
import type { NodeTypes, EdgeTypes } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { StageDocument } from "./types";
import { layoutStage, stageHeight } from "./layout";
import { LIVE_STATES } from "./states";
import { useReducedMotion } from "./motion";
import { useTransitionMarkers } from "./transitions";
import StationNode from "./StationNode";
import RouteEdge from "./RouteEdge";
import Legend from "./Legend";
import LandingLine from "./LandingLine";

interface EpicStageProps {
  stage: StageDocument;
}

const nodeTypes = { station: StationNode } as unknown as NodeTypes;
const edgeTypes = { route: RouteEdge } as unknown as EdgeTypes;

/**
 * The stage is already the size of its graph, so the fit has nothing left to
 * do but centre it. Pinning both ends of the zoom range at 1 keeps the
 * stations at the 160px/140px separation `layoutStage` places them at
 * (DESIGN.md § Layout) — a fit that scaled content into a computed height
 * would satisfy FR-002 and lose the spacing the same document fixes.
 */
const FIT_VIEW_OPTIONS = { minZoom: 1, maxZoom: 1 };

export default function EpicStage({ stage }: EpicStageProps): JSX.Element {
  const laidOut = layoutStage(stage);
  const edges = laidOut.edges;

  const reducedMotion = useReducedMotion();
  const marked = useTransitionMarkers(stage, reducedMotion);

  // FR-012: the marker rides the node's data, so StationNode renders
  // data-transition="true" while marked and no attribute otherwise.
  const nodes = laidOut.nodes.map((node) => ({
    ...node,
    data: { ...node.data, transition: marked.has(node.id) },
  }));

  // FR-014: an epic with no node in the live set is idle. A null state is not
  // live — unknown is not zero, and it is not motion either.
  const idle = !stage.nodes.some(
    (node) => node.state !== null && LIVE_STATES.has(node.state),
  );

  const staged = stage.nodes.length > 0;

  const header = (
    <div className="epic-stage-header">
      <h2 className="epic-stage-name">{stage.epic_id}</h2>
      {stage.degraded && (
        <p className="epic-stage-meta">
          {stage.nodes.length} nodes · degraded read
        </p>
      )}
    </div>
  );

  const notes = stage.notes.length > 0 && (
    <div className="stage-notes">
      {stage.notes.map((note, index) => (
        <div
          key={index}
          className="degraded stage-note"
          data-stage-note
          data-read={note.read}
          data-mode={note.mode}
          role="status"
        >
          <p className="lead">
            {note.read} {note.mode}
          </p>
          <p className="detail num">{note.detail}</p>
        </div>
      ))}
    </div>
  );

  // FR-001 / constitution III: nothing is staged, so no canvas is constructed
  // — no `.epic-stage-map`, no `<ReactFlow>`, no landing line and no legend for
  // a graph that is not there. The notice survives: an epic whose workgraph
  // could not be read says so, in a named row.
  if (!staged) {
    return (
      <section
        className="epic-stage"
        data-epic-stage
        data-epic-id={stage.epic_id}
        data-staged="false"
        data-idle={idle ? "true" : "false"}
      >
        {header}
        {notes}
      </section>
    );
  }

  return (
    <section
      className="epic-stage"
      data-epic-stage
      data-epic-id={stage.epic_id}
      data-staged="true"
      data-idle={idle ? "true" : "false"}
    >
      {header}
      {/* FR-004 / FR-005 / DESIGN.md § Layout: the map is an SVG of min-width
          1040px *inside a horizontally scrolling wrapper*. The wrapper is the
          grid's second column and holds one cell; the map and the landing line
          share it, origin-aligned, so DESIGN.md's x=930 is measured in the
          map's own coordinate space and the lane scrolls with the graph it
          belongs to. The lane was a sibling of this wrapper, in a third stage
          column laid out past the edge of a page that reported no overflow. */}
      <div className="epic-stage-scroll">
        <div
          className="epic-stage-map"
          style={
            {
              "--stage-height": `${stageHeight(stage.nodes, stage.edges)}px`,
            } as CSSProperties
          }
        >
          {/* FR-016: pure glass. The D-006 stack turns dragging, connecting,
              selecting and focusing on by default over plain divs no element
              sweep can see, so each one is turned off here and asserted from
              the props the flow is mounted with; pan and zoom stay on because
              they are gestures with no on-screen control chrome; and the
              library's attribution anchor is hidden through its documented
              option so the badge stays the room's one link.
              DESIGN.md § Route Map and Landing Line (No controls),
              § Components (Buttons: Desk only; the Showfloor has none). */}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={FIT_VIEW_OPTIONS}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            panOnDrag
            zoomOnScroll
            zoomOnPinch
            proOptions={{ hideAttribution: true }}
          />
        </div>
        <LandingLine nodes={stage.nodes} />
      </div>
      {notes}
      <Legend />
    </section>
  );
}
