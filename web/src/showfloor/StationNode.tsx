/**
 * A Showfloor station card.
 *
 * DESIGN.md § State Chevrons and Stations.
 */

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { resolveStateStyle } from "./states";

export interface StationNodeData {
  node: {
    id: string;
    story_key: string | null;
    persona: string | null;
    state: string | null;
    attempt: number | null;
    awaiting_operator: boolean | null;
    landing_state: string | null;
    waiting_on_operator: boolean;
    unknown: string[];
  };
}

interface StationNodeProps {
  data: StationNodeData;
  [key: string]: unknown;
}

function StationNode({ data }: StationNodeProps): JSX.Element {
  const staged = data.node;
  const rawState = staged.state ?? null;
  const { style, known } = resolveStateStyle(rawState, "light");

  const pips: number | null = staged.attempt ?? null;
  const attemptElements: JSX.Element[] = [];
  if (pips !== null) {
    for (let i = 0; i < pips; i++) {
      attemptElements.push(
        <span key={i} data-attempt-pip className="attempt-pip" />,
      );
    }
  }

  return (
    <div
      className={`station st-${style.glyph}`}
      data-station
      data-node-id={staged.id}
      data-state={rawState ?? "unknown"}
      data-state-style={known ? rawState! : "unknown"}
      data-waiting={staged.waiting_on_operator ? "true" : undefined}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="station-handle station-handle-target"
      />
      <div className="station-body" style={{ color: style.ink }}>
        {style.glyph === "dashed" && rawState === null && (
          <span className="unknown-glyph" />
        )}
      </div>
      <div className="station-meta">
        <span className="node-id" data-persona={staged.persona ?? "unknown"}>
          {staged.id}
        </span>
        {attemptElements.length > 0 && (
          <span className="attempt-line">
            attempt{" "}
            {attemptElements}
          </span>
        )}
      </div>
      <div className="station-caption" style={{ color: style.ink }}>
        {rawState ?? "unknown"}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="station-handle station-handle-source"
      />
    </div>
  );
}

export default memo(StationNode);
