/**
 * TypeScript mirror of the stage document contract.
 *
 * `specs/002-the-showfloor-stages-an-epic/contracts/stage-document.md` §1
 */

export interface StagedNode {
  id: string;
  story_key: string | null;
  persona: string | null;
  state: string | null;
  attempt: number | null;
  awaiting_operator: boolean | null;
  landing_state: string | null;
  waiting_on_operator: boolean;
  unknown: string[];
}

export type EdgeKind = "pass" | "merge";

export interface StagedEdge {
  source: string;
  target: string;
  kind: EdgeKind;
}

export interface StageNote {
  read: string;
  mode: string;
  detail: string;
}

export interface StageDocument {
  epic_id: string;
  nodes: StagedNode[];
  edges: StagedEdge[];
  notes: StageNote[];
  degraded: boolean;
}
