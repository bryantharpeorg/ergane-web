/**
 * DAG layout for one epic's stage.
 *
 * Uses @dagrejs/dagre for left-to-right rank assignment, then applies a
 * deterministic declaration-order tie-break for nodes that share the same
 * computed x (same-rank columns).
 */

import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { StageDocument, StagedNode } from "./types";

export interface LaidOutNode extends Node {
  type: "station";
  data: { node: StagedNode };
  position: { x: number; y: number };
}

export interface LaidOutEdge extends Edge {
  type: "route";
  className: string;
  data: { kind: string };
}

export interface LaidOutStage {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
}

const NODE_WIDTH = 40;
const NODE_HEIGHT = 40;
const RANK_SEP = 160;
const NODE_SEP = 140;

export function layoutStage(stage: StageDocument): LaidOutStage {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", ranksep: RANK_SEP, nodesep: NODE_SEP });
  g.setDefaultEdgeLabel(() => ({}));

  const idToIndex = new Map<string, number>();
  stage.nodes.forEach((node, index) => {
    idToIndex.set(node.id, index);
    g.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      label: node.id,
      node: node,
    });
  });

  stage.edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const byX = new Map<number, { node: LaidOutNode; index: number }[]>();
  g.nodes().forEach((id) => {
    const dagreNode = g.node(id) as { x: number; y: number; node: StagedNode };
    const index = idToIndex.get(id) ?? 0;
    const rfNode: LaidOutNode = {
      id,
      type: "station",
      position: { x: dagreNode.x, y: dagreNode.y },
      data: { node: dagreNode.node },
    };
    const bucket = byX.get(dagreNode.x) ?? [];
    bucket.push({ node: rfNode, index });
    byX.set(dagreNode.x, bucket);
  });

  const nodes: LaidOutNode[] = [];
  for (const bucket of byX.values()) {
    bucket.sort((a, b) => a.index - b.index);
    const ys = bucket.map((b) => b.node.position.y).sort((a, b) => a - b);
    bucket.forEach((item, i) => {
      item.node.position.y = ys[i];
      nodes.push(item.node);
    });
  }

  nodes.sort((a, b) => idToIndex.get(a.id)! - idToIndex.get(b.id)!);

  const edges: LaidOutEdge[] = stage.edges.map((edge, index) => ({
    id: `e-${edge.source}-${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    type: "route",
    className: edge.kind === "merge" ? "edge-merge" : "edge-pass",
    data: { kind: edge.kind },
  }));

  return { nodes, edges };
}
