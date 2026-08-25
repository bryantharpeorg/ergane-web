/**
 * The first world's milestone bar, wearing the second world's tokens until US2
 * deletes it (006 US1, FR-002).
 *
 * This picture is on its way out: FR-004 replaces the bar with one six-stop
 * mini-ladder per story, taken from the showfloor document, and the label
 * collisions this component's absolutely-positioned track measured on
 * 2026-08-24 are exactly why. US1 does not rewrite it — it only stops it
 * wearing the retired palette, and takes the one label that called itself a
 * `chip` out of the § Chips vocabulary it never belonged to: `us1 · verifying`
 * is a story and a state, not one of the table's six words.
 */
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

function tokenLabel(card: NodeCard): string {
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
          <span className="token-tag micro">{tokenLabel(tracked)}</span>
        </div>
      )}
    </div>
  );
}
