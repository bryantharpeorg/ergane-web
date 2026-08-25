/**
 * One story's state on an epic row — a chip now, not a glyph (006 US1, FR-002).
 *
 * The first world drew eleven skewed chevrons and told the states apart by
 * filling them: a repeating-gradient for `KEY_ISSUED`, a half-gradient for
 * `PR_OPEN`, a rounded cap for `WAITING_OPERATOR`. D-015 retired all three
 * devices at once — "Don't use gradients, glass, glow"; § Chips is squared, mono
 * and worded; § The status ladder maps the same eleven states onto chips and
 * says in as many words that "the state model is unchanged, only its clothing".
 * So the glyph is gone and the word it captioned is now the chip itself.
 *
 * **Nothing about what this component reports has moved.** The state stays on
 * the element verbatim in `data-state` and in the `st-<STATE>` class, the paged
 * and waiting markers stay exactly where 001 put them, and `.cap` is still the
 * element carrying the word — it is now also the chip, which is why the class
 * list reads `cap chip <tone>`. `tests/unit/NodeChevron.test.tsx` and the
 * `.chev[data-paged]` assertions in `desk.spec.ts` and `Desk.test.tsx` are
 * unedited (FR-003).
 *
 * The tone is the Showfloor's own: `chipTone` in `showfloor/ladder.ts` is the
 * one place § Chips' six rows live in the browser, and the Desk borrows it
 * rather than copying it, so a word cannot read one way on the stage and
 * another at the Desk. US2 replaces this cell with the showfloor document's
 * ladder object, at which point the last of the derivation below goes too.
 */

import type { NodeCard } from "../api/floorDocument";
import { chipTone } from "../showfloor/ladder";

/**
 * § The status ladder › "Eleven node states map onto the ladder and chips",
 * read straight down its right-hand column. A chip whose word is outside
 * § Chips' table is a defect, so these are the words and there are no others;
 * an undeclared node's `undeclared` is deliberately not one of them, and falls
 * to the Unknown Rule's italic muted the way any word the vocabulary does not
 * name does.
 */
const CHIP_WORDS: Record<string, string> = {
  PENDING: "ready",
  KEY_ISSUED: "building",
  RUNNING: "building",
  VERIFYING: "verifying",
  PASSED: "pr open",
  PR_OPEN: "pr open",
  ENQUEUED: "queue",
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
  const isPaged = card.awaiting_operator && state === "VERIFYING";
  const isWaiting = card.awaiting_operator && state !== "VERIFYING";
  // "WAITING_OPERATOR (or `awaiting_operator` true in any state)" wears the gold
  // chip — the table's own parenthesis, which is why the flag is read here and
  // not only the state.
  const word = card.declared
    ? card.awaiting_operator
      ? "waiting on you"
      : (CHIP_WORDS[state] ?? "unknown")
    : "undeclared";

  const classNames = ["chev", `st-${state}`];
  if (isPaged) classNames.push("paged");
  if (isWaiting) classNames.push("waiting");
  if (!card.declared) classNames.push("st-undeclared");

  const tone = chipTone(word);

  return (
    <span
      className={classNames.join(" ")}
      data-state={state}
      data-paged={isPaged || undefined}
      data-undeclared={!card.declared || undefined}
    >
      <span className={`cap chip ${tone}`} data-chip-tone={tone}>
        {word}
      </span>
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
