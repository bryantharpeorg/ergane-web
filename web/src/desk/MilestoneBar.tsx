import type { NodeCard } from "../api/floorDocument";
import { MILESTONE_POSITIONS, MILESTONES, milestoneIndex, trackedStory } from "./milestones";

interface MilestoneBarProps {
  cards: NodeCard[];
}

function tokenClass(card: NodeCard): string {
  return card.awaiting_operator
    ? card.state === "VERIFYING"
      ? "verifying"
      : "waiting"
    : "in-flight";
}

function chipText(card: NodeCard): string {
  const story = card.story_key?.toLowerCase() ?? card.id.toLowerCase();
  if (card.awaiting_operator && card.state === "VERIFYING") return `${story} · paged`;
  if (card.awaiting_operator) return `${story} · waiting`;
  return `${story} · ${card.state.toLowerCase()}`;
}

export default function MilestoneBar({ cards }: MilestoneBarProps) {
  const tracked = trackedStory(cards);
  const done = tracked === null;
  const trackedIndex = done ? MILESTONES.length - 1 : milestoneIndex(tracked);
  const fillPercent = MILESTONE_POSITIONS[trackedIndex];
  const label = done
    ? "All stories merged"
    : `Tracked story ${tracked?.story_key ?? tracked?.id} at ${MILESTONES[trackedIndex].label}`;

  return (
    <div className={`bar ${done ? "done" : ""}`} role="img" aria-label={label}>
      <div className="track" />
      <div className="fill" style={{ width: `${fillPercent}%` }} />
      <div className="diamonds">
        {MILESTONES.map((ms, index) => {
          const atOrBehind = done || index <= trackedIndex;
          return (
            <div key={ms.key} className="ms" style={{ left: `${MILESTONE_POSITIONS[index]}%` }}>
              <span className={`diamond ${atOrBehind ? "done" : ""}`} />
              <span className="label micro">{ms.label}</span>
            </div>
          );
        })}
      </div>
      {!done && tracked && (
        <div className={`token ${tokenClass(tracked)}`} style={{ left: `${fillPercent}%` }}>
          <span className="chip micro">{chipText(tracked)}</span>
        </div>
      )}
    </div>
  );
}
