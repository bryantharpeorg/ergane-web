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

  // 012 US2: a graph that parsed and is about some other epic's stories. It is
  // neither a transport failure nor a refusal — nothing failed to arrive and
  // nothing refused — so it does not borrow either one's words. What the
  // operator needs is that the graph was not joined and why, because the row
  // above is showing stories with no dependency and this is the reason.
  if (entry.mode === "mismatch") {
    return (
      <div
        className="degraded"
        role="status"
        data-mode="mismatch"
        data-section={entry.section}
        data-epic-id={entry.epic_id ?? undefined}
      >
        <p className="lead">{section} was read against a graph of other stories.</p>
        <p>
          The read <span className="read num">{entry.read}</span> answered, and{" "}
          <span className="detail num">{detail}</span>. Shown without a graph, not with
          an invented one.
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
