/**
 * One epic timeline row on the Desk.
 *
 * Left: epic name + metadata + personas.
 * Middle: milestone bar.
 * Right: three readouts.
 * Beneath: node chevrons in document order.
 */

import type { EpicEntry } from "../api/floorDocument";
import MilestoneBar from "./MilestoneBar";
import NodeChevron from "./NodeChevron";
import { trackedStory } from "./milestones";

interface EpicRowProps {
  epic: EpicEntry;
}

export default function EpicRow({ epic }: EpicRowProps) {
  const cards = epic.nodes;
  const tracked = trackedStory(cards);
  const storiesLeft = cards.filter((c) => c.state !== "MERGED").length;

  const personas = Array.from(
    new Set(cards.map((c) => c.persona).filter((p): p is string => Boolean(p))),
  );

  return (
    <article
      className="epic"
      data-epic-id={epic.epic_id}
      data-scene={epic.scene ?? undefined}
    >
      <div className="epic-left">
        <span className="epic-name">{epic.epic_id}</span>
        <span className="epic-meta num">
          {epic.epic_state} · {epic.workflow_id}
        </span>
        {personas.length > 0 && (
          <span className="epic-personas">{personas.join(", ")}</span>
        )}
      </div>
      <div className="epic-bar">
        <MilestoneBar cards={cards} />
      </div>
      <div className="epic-readouts">
        <div className="ro">
          <span className="v num">{storiesLeft}</span>
          <span className="k micro">stories left</span>
        </div>
        <div className="ro">
          <span className="v num">
            {tracked?.attempt ?? <span className="unknown">unknown</span>}
          </span>
          <span className="k micro">
            attempts on {tracked?.story_key ?? tracked?.id ?? "—"}
          </span>
        </div>
        <div className="ro">
          <span className="v num">
            <span className="unknown">unknown</span>
          </span>
          <span className="k micro">spend to date</span>
        </div>
      </div>
      <div className="nodes">
        {cards.map((card) => (
          <span key={card.id} className="node-cell">
            <NodeChevron card={card} />
            <span className="node-id num">{card.id}</span>
          </span>
        ))}
      </div>
    </article>
  );
}
