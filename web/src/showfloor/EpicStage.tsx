/**
 * One epic's stage on the Showfloor.
 *
 * DESIGN.md § Layout, § Route Map and Landing Line, § Elevation & Depth.
 */

import { ReactFlow } from "@xyflow/react";
import type { NodeTypes, EdgeTypes } from "@xyflow/react";
import type { StageDocument } from "./types";
import { layoutStage } from "./layout";
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

  return (
    <section
      className="epic-stage"
      data-epic-stage
      data-epic-id={stage.epic_id}
      data-idle={idle ? "true" : "false"}
    >
      <div className="epic-stage-header">
        <h2 className="epic-stage-name">{stage.epic_id}</h2>
        {stage.degraded && (
          <p className="epic-stage-meta">
            {stage.nodes.length} nodes · degraded read
          </p>
        )}
      </div>
      <div className="epic-stage-map" style={{ height: 300 }}>
        {/* FR-016: pure glass. The D-006 stack turns dragging, connecting,
            selecting and focusing on by default over plain divs no element
            sweep can see, so each one is turned off here and asserted from the
            props the flow is mounted with; pan and zoom stay on because they
            are gestures with no on-screen control chrome; and the library's
            attribution anchor is hidden through its documented option so the
            badge stays the room's one link.
            DESIGN.md § Route Map and Landing Line (No controls),
            § Components (Buttons: Desk only; the Showfloor has none). */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
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
      {stage.notes.length > 0 && (
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
      )}
      <Legend />
    </section>
  );
}
