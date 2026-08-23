/**
 * One epic's stage on the Showfloor.
 *
 * DESIGN.md § Layout, § Route Map and Landing Line, § Elevation & Depth.
 */

import { ReactFlow } from "@xyflow/react";
import type { NodeTypes, EdgeTypes } from "@xyflow/react";
import type { StageDocument } from "./types";
import { layoutStage } from "./layout";
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
  const { nodes, edges } = layoutStage(stage);

  return (
    <section
      className="epic-stage"
      data-epic-stage
      data-epic-id={stage.epic_id}
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
