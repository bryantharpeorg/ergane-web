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

/** One choice the factory delivered, verbatim. The pane mints none of its own. */
export interface DeliveredAction {
  label: string;
  payload: string;
}

/**
 * Derived at read time by the backend and nowhere else. `settled` is the
 * factory's word alone: a press or a submit moves nothing.
 */
export interface AttentionSettlement {
  state: "waiting" | "in_flight" | "ruled" | "settled" | "none";
  ruling: string | null;
  signal: "accepted" | "SIGNAL_FAILED" | null;
  pressed_choice: string | null;
  resolution: string | null;
}

export interface AttentionItem {
  /** correlation id for an answerable item; `notice:<seq>` for a Notice. */
  id: string;
  kind: "escalation" | "question" | "notice";
  correlation_id: string;
  text: string;
  actions: DeliveredAction[];
  /** The factory's clock, or null: the pane never writes an expiry of its own. */
  expires_at: string | null;
  settlement: AttentionSettlement;
  degraded: { mode: "transport" | "refusal"; what: string } | null;
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

export interface AttentionEvent {
  type: "attention";
  data: AttentionItem;
}

export interface UnknownEvent {
  type: string;
  data: unknown;
}
