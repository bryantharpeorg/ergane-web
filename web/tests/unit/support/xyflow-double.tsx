/**
 * Vitest double for @xyflow/react.
 *
 * React Flow renders nodes only after measuring them with ResizeObserver,
 * which jsdom does not provide. This double renders every node through the
 * supplied nodeTypes and every edge through edgeTypes inside plain elements,
 * and records the props ReactFlow was mounted with.
 */

import * as React from "react";
import type { ReactNode } from "react";

export const Position = {
  Top: "top",
  Right: "right",
  Bottom: "bottom",
  Left: "left",
} as const;

export function Handle(): JSX.Element {
  return <div data-handle />;
}

export function BaseEdge({ path }: { path?: string }): JSX.Element {
  return <path data-base-edge d={path} />;
}

export function getSmoothStepPath(): string {
  return "";
}

export interface MountedProps {
  nodes: Array<{ id: string; type?: string | null; data?: unknown; position?: { x: number; y: number } }>;
  edges: Array<{ id: string; type?: string | null; data?: unknown; className?: string }>;
  nodeTypes?: Record<string, React.ComponentType<{ data: unknown }>>;
  edgeTypes?: Record<string, React.ComponentType<{ data: unknown }>>;
  nodesDraggable?: boolean;
  nodesConnectable?: boolean;
  elementsSelectable?: boolean;
  nodesFocusable?: boolean;
  edgesFocusable?: boolean;
  panOnDrag?: boolean;
  zoomOnScroll?: boolean;
  zoomOnPinch?: boolean;
  fitView?: boolean;
}

export const mountedProps: MountedProps[] = [];

interface ReactFlowProps {
  nodes: Array<{ id: string; type?: string | null; data?: unknown; position?: { x: number; y: number } }>;
  edges: Array<{ id: string; type?: string | null; data?: unknown; className?: string }>;
  nodeTypes?: Record<string, React.ComponentType<{ data: unknown }>>;
  edgeTypes?: Record<string, React.ComponentType<{ data: unknown }>>;
  nodesDraggable?: boolean;
  nodesConnectable?: boolean;
  elementsSelectable?: boolean;
  nodesFocusable?: boolean;
  edgesFocusable?: boolean;
  panOnDrag?: boolean;
  zoomOnScroll?: boolean;
  zoomOnPinch?: boolean;
  fitView?: boolean;
  children?: ReactNode;
}

export function ReactFlow(props: ReactFlowProps): JSX.Element {
  mountedProps.push(props);
  const NodeComponent = props.nodeTypes?.station;
  const EdgeComponent = props.edgeTypes?.route;

  return (
    <div data-react-flow="true">
      {props.nodes.map((node) => (
        <div key={node.id} data-rf-node data-node-id={node.id}>
          {NodeComponent ? <NodeComponent data={node.data} /> : null}
        </div>
      ))}
      <svg>
        {props.edges.map((edge) => (
          <g
            key={edge.id}
            className={edge.className}
            data-rf-edge
            data-edge-id={edge.id}
          >
            {EdgeComponent ? <EdgeComponent data={edge.data} /> : null}
          </g>
        ))}
      </svg>
      {props.children}
    </div>
  );
}

export function ReactFlowProvider({ children }: { children: ReactNode }): JSX.Element {
  return <>{children}</>;
}
