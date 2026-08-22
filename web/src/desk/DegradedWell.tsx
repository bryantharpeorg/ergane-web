/**
 * Degraded read notice.
 *
 * Renders in-section, naming what could not be learned and which failure mode.
 * Transport failures and query refusals have visually distinct wording.
 */

import type { DegradedEntry } from "../api/floorDocument";

interface DegradedWellProps {
  entry: DegradedEntry;
}

function sectionName(entry: DegradedEntry): string {
  switch (entry.section) {
    case "floor":
      return "The floor";
    case "epics":
      return `Epic ${entry.epic_id ?? ""}`;
    case "attention":
      return "Waiting on you";
    case "health":
      return "Health";
    case "spend_to_date":
      return "Spend to date";
    default:
      return entry.section;
  }
}

export default function DegradedWell({ entry }: DegradedWellProps) {
  const section = sectionName(entry);
  const detail = entry.detail || "";

  if (entry.mode === "refusal") {
    return (
      <div
        className="degraded"
        role="status"
        data-mode="refusal"
        data-section={entry.section}
        data-epic-id={entry.epic_id ?? undefined}
      >
        <p className="lead">{section} refused its query.</p>
        <p>
          The read <span className="read num">{entry.read}</span> answered with a refusal:{" "}
          <span className="detail num">{detail}</span>. Shown as unavailable, not hidden.
        </p>
      </div>
    );
  }

  return (
    <div
      className="degraded"
      role="status"
      data-mode="transport"
      data-section={entry.section}
      data-epic-id={entry.epic_id ?? undefined}
    >
      <p className="lead">{section} could not be reached.</p>
      <p>
        The read <span className="read num">{entry.read}</span> failed before the factory
        answered: <span className="detail num">{detail}</span>. Shown as unavailable, not
        hidden.
      </p>
    </div>
  );
}
