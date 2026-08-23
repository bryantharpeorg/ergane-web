/**
 * TypeScript contract for GET /api/floor and the SSE `floor` event.
 *
 * Mirrors `specs/001-the-desk-sees-the-floor/contracts/floor-document.md`
 * one-to-one. Borrowed shapes are typed as `unknown` to avoid redefining
 * ergane's internal schemas; the pane only enforces the envelope and join
 * fields it adds.
 */

import type { StageDocument } from "../showfloor/types";

export type NodeState =
  | "PENDING"
  | "KEY_ISSUED"
  | "RUNNING"
  | "VERIFYING"
  | "PASSED"
  | "PR_OPEN"
  | "ENQUEUED"
  | "MERGED"
  | "FAILED"
  | "KILLED"
  | "WAITING_OPERATOR"
  | "unknown";

export interface Section<T> {
  seam: string;
  data: T;
}

export interface NodeCard {
  id: string;
  declared: boolean;
  story_key: string | null;
  persona: string | null;
  spec_ref: string | null;
  depends_on: string[] | null;
  depends_on_merged: string[] | null;
  state: NodeState;
  attempt: number | null;
  awaiting_operator: boolean;
  landing_state: string | null;
  pr_number: number | null;
  verified: boolean;
}

export interface EpicEntry {
  epic_id: string;
  workflow_id: string;
  scene: string | null;
  epic_state: string;
  nodes: NodeCard[];
  stage?: StageDocument;
  status_seam: string;
  workgraph_seam: string;
}

export interface AttentionItem {
  kind: "escalation" | "question";
  id: string | null;
  expires_at: string | null;
  resolution: string | null;
  source: "open_escalations" | "stored_questions";
  document: unknown;
}

export interface DegradedEntry {
  section: "floor" | "epics" | "attention" | "health" | "spend_to_date";
  mode: "transport" | "refusal";
  epic_id: string | null;
  read: string;
  detail: string;
}

export interface FloorDocument {
  reference_instant: string | null;
  floor: Section<unknown>;
  epics: EpicEntry[];
  attention: {
    seam: string;
    items: AttentionItem[];
  };
  health: Section<unknown>;
  spend_to_date: Section<unknown>;
  degraded: DegradedEntry[];
}

export interface FloorEvent {
  type: "floor";
  data: FloorDocument;
}

export interface UnknownEvent {
  type: string;
  data: unknown;
}
