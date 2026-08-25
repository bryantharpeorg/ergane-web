/**
 * The factory's word on the last Answer, on the item that carried it.
 *
 * DESIGN.md § Components › Attention Item › Body column: the ruling lands here
 * as Small olive-ink 500 text — "Your last answer on 8d1e… was RESOLVED — …" —
 * and every refusal (UNKNOWN, ALREADY_RESOLVED, EXPIRED, UNAUTHORIZED,
 * SIGNAL_FAILED) renders the same way in the same place. Not in red (§ Colors ›
 * The No-Red Rule), and not as a field error (§ Inputs / Fields › Error: none):
 * a refusal is the factory speaking, not the operator mistyping.
 *
 * The ruling word itself is set in the mono stack, uppercase as the factory wrote
 * it, because it is text the factory wrote verbatim (§ Typography › The Factory
 * Speaks in Mono Rule). Nothing on this line rewords it; `describeRuling` hands
 * over the string it was given (FR-010).
 */

import type { AttentionItem } from "../api/floorDocument";
import { describeRuling } from "./ruling";

interface RulingLineProps {
  item: AttentionItem;
}

export default function RulingLine({ item }: RulingLineProps) {
  const { word, sentence } = describeRuling(item.kind, item.settlement);

  // Nothing carried and nothing reported: there is no ruling line to draw.
  if (word === null && sentence === "") return null;

  // DESIGN.md's own example abbreviates the id ("on 8d1e…"); the full id is
  // already in the "where" line above, so this is a pointer, not a second copy.
  const shortId = `${item.correlation_id.slice(0, 4)}…`;

  return (
    <p className="ruling-line">
      {word === null ? (
        sentence
      ) : (
        <>
          Your last answer on <span className="ruling-id num">{shortId}</span> was{" "}
          <span className="ruling num">{word}</span>
          {sentence === "" ? null : <> — {sentence}</>}
        </>
      )}
    </p>
  );
}
