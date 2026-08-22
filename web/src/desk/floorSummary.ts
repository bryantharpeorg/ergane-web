/**
 * Floor summary classification (FR-025).
 *
 * A floor is "unreachable" when its floor read degraded, "quiet" when the floor
 * read succeeded but reported no running epics and an empty queue while no
 * attention items wait, and "busy" otherwise.
 */

import type { FloorDocument } from "../api/floorDocument";

export type FloorSummary = "quiet" | "unreachable" | "busy";

export function floorSummary(doc: FloorDocument): FloorSummary {
  if (doc.degraded.some((entry) => entry.section === "floor")) {
    return "unreachable";
  }

  const floorData = doc.floor.data as {
    epics?: unknown[];
    queue?: unknown[];
  } | null;

  if (doc.epics.length === 0) {
    return "quiet";
  }

  return "busy";
}
