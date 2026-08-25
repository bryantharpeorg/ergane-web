/**
 * One story, as a card on the stage.
 *
 * `DESIGN.md` § Stage fixes the anatomy — "node cards `11.5rem` wide (id block,
 * title small, chip, ladder, mono sub-line)" — and § The status ladder fixes
 * the ladder inside it: "six `4px`-tall bars with `3px` gaps: done stops olive,
 * the active stop accent with a 1.6s opacity pulse, waiting-on-you gold, ahead
 * `--sunken`".
 *
 * Nothing here decides a stop. The six come from the document, derived once in
 * `pane/showfloor.py` (plan D2), so the card, the rail row and the detail pane
 * cannot dress the same story three ways. What the card owns is the clothing
 * and the words — and it says every state in words as well as colour (§ Named
 * Rules): the chip carries the stop's own label, and a frozen ladder carries
 * the factory's `terminal_reason` verbatim on the sub-line rather than a
 * sentence of the pane's own (constitution III).
 *
 * It is not a control. § Do's and Don'ts: "Don't add a button, form, or input
 * to the Showfloor" — selection and its keyboard path are US4's, and until
 * there is something to select this is an `<article>` that reads.
 */

import type { ShowfloorStory } from "../api/showfloorDocument";
import { chipText, storyChip } from "./ladder";

/**
 * § The status ladder's four fills, as class names. `frozen` is the fifth
 * status the document can carry and it is not a fill: a terminal ladder is
 * neither done nor ahead, so its bars rest at `--sunken` and the card says
 * `killed`/`failed` in the chip and the reason on the sub-line.
 */
const STOP_CLASS: Record<string, string> = {
  done: "done",
  active: "now",
  waiting: "hold",
  ahead: "",
  frozen: "froze",
};

/** The card's mono sub-line: the live facts this story really has, in order. */
export function subLine(story: ShowfloorStory): string {
  // A frozen ladder's sub-line is the factory's own sentence, byte for byte.
  // Paraphrasing the reason an epic died is the pane inventing a fact.
  if (story.ladder.frozen && story.ladder.terminal_reason !== null) {
    return story.ladder.terminal_reason;
  }

  const parts: string[] = [];
  if (story.priority !== null) parts.push(story.priority);

  const attempt = story.facts.attempt;
  if (typeof attempt === "number" && attempt > 0) parts.push(`att ${attempt}`);

  const pr = story.facts.pr_number;
  if (typeof pr === "number") parts.push(`pr #${pr}`);

  const landing = story.facts.landing_state;
  if (typeof landing === "string" && landing !== "") {
    parts.push(landing.toLowerCase().replace(/_/g, " "));
  }

  // Never empty and never invented: a story no epic has answered for still has
  // its own key, which is a fact the corpus recorded.
  if (parts.length === 0) return story.story_key ?? story.id ?? "unknown";
  return parts.join(" · ");
}

interface NodeCardProps {
  story: ShowfloorStory;
}

export default function NodeCard({ story }: NodeCardProps): JSX.Element {
  const chip = storyChip(story.ladder);
  const id = (story.story_key ?? story.id ?? "unknown").toUpperCase();

  return (
    <article
      className="node"
      data-node-card
      data-story-id={story.id ?? undefined}
      data-ladder-tone={story.ladder.tone}
    >
      <span className="nid" data-node-id>
        {id}
      </span>
      <span className="ntitle" data-node-title>
        {story.title}
      </span>
      <span className="nstat">
        <span className={`chip ${chip.tone}`} data-chip data-chip-tone={chip.tone}>
          {chipText(chip)}
        </span>
      </span>
      {/* The six bars carry no word of their own by design — the chip beside
          them already says the stop, which is what § Named Rules asks for, and
          a screen reader reading six unlabelled bars would hear noise. */}
      <span className="ladder" data-ladder aria-hidden="true">
        {story.ladder.stops.map((stop) => (
          <i
            key={stop.key}
            className={STOP_CLASS[stop.status] ?? ""}
            data-stop={stop.key}
            data-stop-status={stop.status}
          />
        ))}
      </span>
      <span className="nsub" data-node-sub>
        {subLine(story)}
      </span>
    </article>
  );
}
