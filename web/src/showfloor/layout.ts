/**
 * DAG layout for one epic's stage.
 *
 * Uses @dagrejs/dagre for left-to-right rank assignment, then applies a
 * deterministic declaration-order tie-break for nodes that share the same
 * computed x (same-rank columns).
 */

import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { StageDocument, StagedEdge, StagedNode } from "./types";

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

/**
 * DESIGN.md § Layout (Showfloor): "stations sit 160px apart on a row, 140px
 * between rows". A left-to-right rank assignment draws each rank as a column,
 * so the rank separation is the along-a-row figure and the node separation is
 * the between-rows one. `ROW_SPACING` is exported because the stage's height is
 * measured in it (FR-002) and a test asserts the figure is that one and no
 * other.
 */
const RANK_SEP = 160;
export const ROW_SPACING = 140;
const NODE_SEP = ROW_SPACING;

/**
 * DESIGN.md § Layout (Showfloor): "A stage with padding `1.5rem 2rem 3rem`" —
 * 24px above the graph and 48px below it at the 16px root.
 */
export const STAGE_PAD_TOP = 24;
export const STAGE_PAD_BOTTOM = 48;

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

/**
 * How many stations stack in the deepest rank.
 *
 * The layout is left-to-right, so a rank is a column and the stations sharing
 * one are the stage's rows. The deepest rank is the one that sets the height:
 * a five-node chain is one row tall, a five-node graph that forks into three
 * concurrent stories is three.
 *
 * Ranks are read back off the laid-out graph rather than recomputed, so the
 * figure is the drawn one and cannot drift from it.
 */
export function rankDepth(nodes: StagedNode[], edges: StagedEdge[]): number {
  if (nodes.length === 0) return 0;

  const laidOut = layoutStage({
    epic_id: "",
    nodes,
    edges,
    notes: [],
    degraded: false,
  });

  const perRank = new Map<number, number>();
  for (const node of laidOut.nodes) {
    perRank.set(node.position.x, (perRank.get(node.position.x) ?? 0) + 1);
  }

  return Math.max(...perRank.values());
}

/**
 * The height one epic's stage needs, in pixels.
 *
 * FR-002: a function of the graph's rank depth and the 140px row spacing
 * DESIGN.md names, plus the station a row is drawn with and the stage padding
 * above and below it. It reads the stage document and nothing else — no
 * `window`, no viewport, no unit that resolves against one — so the same graph
 * measures the same on any screen.
 *
 * Zero nodes is not a short stage, it is no stage: the caller renders no canvas
 * at all (FR-001), and 0 is what that costs.
 */
export function stageHeight(nodes: StagedNode[], edges: StagedEdge[]): number {
  const depth = rankDepth(nodes, edges);
  if (depth === 0) return 0;
  return depth * ROW_SPACING + NODE_HEIGHT + STAGE_PAD_TOP + STAGE_PAD_BOTTOM;
}
