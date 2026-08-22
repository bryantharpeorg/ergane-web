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

  const epicsEmpty = doc.epics.length === 0;
  const queueEmpty =
    floorData === null ||
    (Array.isArray(floorData?.queue) && floorData.queue.length === 0);
  const attentionEmpty = doc.attention.items.length === 0;

  if (epicsEmpty && queueEmpty && attentionEmpty) {
    return "quiet";
  }

  return "busy";
}
