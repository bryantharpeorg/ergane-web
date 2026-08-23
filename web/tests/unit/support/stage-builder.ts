/**
 * Build stage documents for component tests from recorded workgraphs.
 *
 * Reads fixtures through Vite's ?raw import (no fs, no @types/node).
 */

import type { StageDocument, StagedNode } from "../../../src/showfloor/types";

export interface LiveOverrides {
  state?: string | null;
  attempt?: number | null;
  awaiting_operator?: boolean | null;
  landing_state?: string | null;
}

const RAW_LIVE_FIELDS: (keyof StagedNode)[] = [
  "state",
  "attempt",
  "awaiting_operator",
  "landing_state",
];

export function stageFromWorkgraph(
  workgraphRaw: string,
  live: Record<string, LiveOverrides> = {},
): StageDocument {
  const workgraph = JSON.parse(workgraphRaw) as {
    epic_id?: string;
    nodes?: Array<{
      id: string;
      story_key?: string | null;
      persona?: string | null;
      depends_on?: string[];
      depends_on_merged?: string[];
    }>;
  };

  const declaredNodes = workgraph.nodes ?? [];
  const nodes: StagedNode[] = declaredNodes.map((node) => {
    const overrides = live[node.id] ?? {};
    const unknown: string[] = [];
    const values: Partial<StagedNode> = {};

    for (const field of RAW_LIVE_FIELDS) {
      if (field in overrides) {
        (values as Record<string, unknown>)[field] = overrides[field as keyof LiveOverrides];
      } else {
        unknown.push(field);
        (values as Record<string, unknown>)[field] = null;
      }
    }

    const awaiting = values.awaiting_operator ?? null;

    return {
      id: node.id,
      story_key: node.story_key ?? null,
      persona: node.persona ?? null,
      state: values.state ?? null,
      attempt: values.attempt ?? null,
      awaiting_operator: awaiting,
      landing_state: values.landing_state ?? null,
      waiting_on_operator: awaiting === true,
      unknown,
    };
  });

  const edges = declaredNodes.flatMap((node) => {
    const pass = (node.depends_on ?? []).map((source) => ({
      source,
      target: node.id,
      kind: "pass" as const,
    }));
    const merge = (node.depends_on_merged ?? []).map((source) => ({
      source,
      target: node.id,
      kind: "merge" as const,
    }));
    return [...pass, ...merge];
  });

  return {
    epic_id: workgraph.epic_id ?? "test-epic",
    nodes,
    edges,
    notes: [],
    degraded: false,
  };
}
