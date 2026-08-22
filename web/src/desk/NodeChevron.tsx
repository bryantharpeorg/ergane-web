import type { NodeCard } from "../api/floorDocument";

const CAPTIONS: Record<string, string> = {
  PENDING: "pending",
  KEY_ISSUED: "key issued",
  RUNNING: "running",
  VERIFYING: "verifying",
  PASSED: "passed",
  PR_OPEN: "pr open",
  ENQUEUED: "enqueued",
  MERGED: "merged",
  FAILED: "failed",
  KILLED: "killed",
  WAITING_OPERATOR: "waiting on you",
  unknown: "unknown",
};

export interface NodeChevronProps {
  card: NodeCard;
}

export default function NodeChevron({ card }: NodeChevronProps) {
  const state = card.state;
  const caption = card.declared ? CAPTIONS[state] ?? "unknown" : "undeclared";
  const isPaged = card.awaiting_operator && state === "VERIFYING";
  const isWaiting = card.awaiting_operator && state !== "VERIFYING";

  const classNames = ["chev", `st-${state}`];
  if (isPaged) classNames.push("paged");
  if (isWaiting) classNames.push("waiting");
  if (!card.declared) classNames.push("st-undeclared");

  return (
    <span
      className={classNames.join(" ")}
      data-state={state}
      data-paged={isPaged || undefined}
      data-undeclared={!card.declared || undefined}
    >
      <i aria-hidden="true" />
      <span className="cap">{caption}</span>
      {isPaged && (
        <span className="paged-label" aria-label="paged">
          paged
        </span>
      )}
      {isWaiting && (
        <span className="waiting-label" aria-label="waiting on you">
          waiting on you
        </span>
      )}
    </span>
  );
}
