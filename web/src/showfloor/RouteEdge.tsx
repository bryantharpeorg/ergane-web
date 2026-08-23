/**
 * A Showfloor route edge.
 *
 * DESIGN.md § Route Map and Landing Line.
 */

import { getSmoothStepPath } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";
import type { EdgeKind } from "./types";

export default function RouteEdge(edge: EdgeProps): JSX.Element {
  const kind = ((edge.data as { kind?: EdgeKind } | undefined)?.kind) ?? "pass";
  const className = kind === "merge" ? "edge-merge" : "edge-pass";

  const [path] = getSmoothStepPath({
    sourceX: edge.sourceX,
    sourceY: edge.sourceY,
    sourcePosition: edge.sourcePosition,
    targetX: edge.targetX,
    targetY: edge.targetY,
    targetPosition: edge.targetPosition,
    borderRadius: 8,
  });

  return (
    <g className={className} data-edge-kind={kind}>
      <path d={path} fill="none" className="react-flow__edge-path" />
    </g>
  );
}
