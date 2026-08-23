/**
 * The Desk's attention rank, derived from the backend's settlement state and
 * from nothing local.
 *
 * Every input here was written by the factory or read from it: `settlement.state`
 * is derived server-side at read time, and the kind is what intake classified.
 * Nothing the operator does in the browser appears in this function, which is
 * the point — a press or a submit moves no item, because neither settles
 * anything (FR-009, plan D-P8). An item only changes rank when the list is
 * re-read or an `attention` event carries a new settlement for it.
 *
 * Order: waiting and ruled first, then in flight, then settled; and inside a
 * rank, Escalation before Question before Notice (DESIGN.md § Colors › The
 * Attention Ranking Rule).
 */

import type { AttentionItem } from "../api/floorDocument";

const STATE_GROUP: Record<AttentionItem["settlement"]["state"], number> = {
  waiting: 0,
  ruled: 0,
  none: 0,
  in_flight: 1,
  settled: 2,
};

const KIND_RANK: Record<AttentionItem["kind"], number> = {
  escalation: 0,
  question: 1,
  notice: 2,
};

export function rankAttention(items: AttentionItem[]): AttentionItem[] {
  // A stable sort on a copy: two items the rules cannot separate keep the order
  // the backend gave them, so a re-render with no changed settlement is a no-op.
  return [...items].sort((left, right) => {
    const group = STATE_GROUP[left.settlement.state] - STATE_GROUP[right.settlement.state];
    if (group !== 0) return group;
    return KIND_RANK[left.kind] - KIND_RANK[right.kind];
  });
}
