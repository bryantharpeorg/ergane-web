/**
 * Milestone bar derivations (DESIGN.md § Epic Timeline Row).
 *
 * The milestone bar tracks the furthest-behind open story — the not-yet-merged
 * node with the lowest milestone index. It can only read "done" when every
 * story is MERGED.
 */

import type { NodeCard, NodeState } from "../api/floorDocument";

export const MILESTONES = [
  { key: "dispatch", label: "dispatch" },
  { key: "PASSED", label: "PASSED" },
  { key: "PR_OPEN", label: "PR_OPEN" },
  { key: "ENQUEUED", label: "ENQUEUED" },
  { key: "MERGED", label: "MERGED" },
] as const;

export const MILESTONE_POSITIONS = [0, 34, 56, 78, 100] as const;

export function milestoneIndex(card: NodeCard): number {
  switch (card.state) {
    case "PENDING":
    case "KEY_ISSUED":
    case "RUNNING":
    case "VERIFYING":
    case "FAILED":
    case "KILLED":
    case "WAITING_OPERATOR":
    case "unknown":
      return 0;
    case "PASSED":
      return 1;
    case "PR_OPEN":
      return 2;
    case "ENQUEUED":
      return 3;
    case "MERGED":
      return 4;
    default:
      return 0;
  }
}

export function trackedStory(cards: NodeCard[]): NodeCard | null {
  let best: NodeCard | null = null;
  for (const card of cards) {
    if (card.state === "MERGED") {
      continue;
    }
    if (
      best === null ||
      milestoneIndex(card) < milestoneIndex(best) ||
      (milestoneIndex(card) === milestoneIndex(best) &&
        cards.indexOf(card) < cards.indexOf(best))
    ) {
      best = card;
    }
  }
  return best;
}

export function stateMilestone(state: NodeState): number {
  return milestoneIndex({ state } as NodeCard);
}
