/**
 * One story, as a card on the stage — and the room's one way to pick it.
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
 * 005 US4 gives it the selection US3 left it without. The card is now a real
 * `<button>`, which is the honest element for "clicking a story fills the pane"
 * (FR-015) and the only one that is in the tab order, answers Enter and Space,
 * and can say `aria-pressed` — § Shapes' `:focus-visible` outline needs a
 * focusable thing to sit on. That is not a second verb: § Do's and Don'ts bans
 * a control that *writes*, and this one moves the room's own selection and
 * touches no seam. The zero-non-GET sweep in `tests/smoke/showfloor.spec.ts` is
 * what holds that claim to account, and `tests/unit/noVerb.test.ts` is what
 * keeps every other control out of `web/src/showfloor/` (FR-017).
 */

import type { ShowfloorStory } from "../api/showfloorDocument";
import { chipText, stopClass, storyChip } from "./ladder";

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
  /** Whether the detail pane is currently telling this story. */
  selected?: boolean;
  /** What the room does with a pick; absent where nothing is listening. */
  onSelect?: (story: ShowfloorStory) => void;
}

export default function NodeCard({
  story,
  selected = false,
  onSelect,
}: NodeCardProps): JSX.Element {
  const chip = storyChip(story.ladder);
  const id = (story.story_key ?? story.id ?? "unknown").toUpperCase();

  return (
    <button
      type="button"
      className={selected ? "node sel" : "node"}
      data-node-card
      data-story-id={story.id ?? undefined}
      data-ladder-tone={story.ladder.tone}
      data-selected={selected ? "true" : "false"}
      // The pane is what changes, and it says so itself with `aria-live`; the
      // card only reports whether it is the one being told.
      aria-pressed={selected}
      onClick={onSelect === undefined ? undefined : () => onSelect(story)}
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
            className={stopClass(stop.status)}
            data-stop={stop.key}
            data-stop-status={stop.status}
          />
        ))}
      </span>
      <span className="nsub" data-node-sub>
        {subLine(story)}
      </span>
    </button>
  );
}
