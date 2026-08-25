/**
 * The room's shared status vocabulary: the six stops, and the chip a word wears.
 *
 * `DESIGN.md` § The status ladder and § Chips are the authority. The *stop* is
 * decided server-side (`pane/showfloor.py`, plan D2) and arrives on the
 * document; nothing here re-derives it. What lives here is the half the browser
 * owns — which of DESIGN.md's six chip rows a word belongs to — so the rail, the
 * stage header and the detail pane cannot dress the same word three ways.
 *
 * A chip outside § Chips' table is a defect, so an unrecognised word is not
 * quietly tinted: it falls to `unknown`, which renders in the Unknown Rule's
 * italic muted with the factory's word kept verbatim.
 */

import type { Ladder, RailEntry } from "../api/showfloorDocument";

/** § The status ladder: six stops, always six, in order. There is no seventh. */
export const LADDER_STOPS = [
  "ready",
  "building",
  "verifying",
  "pr open",
  "queue",
  "merged",
] as const;

/**
 * The six rows of § Chips, as class-safe names.
 *
 * `landed` is olive, `building` accent, `ready` muted-on-sunken, `draft` dashed
 * and faint, `wait` gold, `dead` alarm. `unknown` is not a row of the table — it
 * is what the pane says when the factory said nothing.
 */
export type ChipTone =
  | "landed"
  | "building"
  | "ready"
  | "draft"
  | "wait"
  | "dead"
  | "unknown";

/** § Chips, read left column to right: every word the vocabulary allows. */
const CHIP_TONES: Record<string, ChipTone> = {
  landed: "landed",
  merged: "landed",
  building: "building",
  verifying: "building",
  queue: "building",
  "pr open": "building",
  ready: "ready",
  draft: "draft",
  "waiting on you": "wait",
  killed: "dead",
  failed: "dead",
};

/**
 * § The status ladder's four fills, as class names, plus the fifth status a
 * document can carry.
 *
 * `frozen` is not a fill: a terminal ladder is neither done nor ahead, so its
 * bars rest at `--sunken` and the card — or the Desk's epic row — says
 * `killed`/`failed` in the chip and the reason in words beside it.
 *
 * It lives here with `chipTone` because it is the same half of the vocabulary:
 * the *stop* is the backend's (plan D2) and nothing in the browser derives one,
 * but what a stop's status *wears* is the browser's, and two rooms drawing the
 * same six stops must not dress them two ways (006 US2, FR-005).
 */
const STOP_CLASS: Record<string, string> = {
  done: "done",
  active: "now",
  waiting: "hold",
  ahead: "",
  frozen: "froze",
};

/** The class one stop's status wears, or none for a stop still ahead. */
export function stopClass(status: string): string {
  return STOP_CLASS[status] ?? "";
}

export interface Chip {
  /** The word the element carries — state is never colour alone. */
  word: string;
  tone: ChipTone;
  /** `4/4` on a rail chip; null where there is no count to give. */
  count: string | null;
}

/** The tone § Chips gives a word, or `unknown` for a word it does not name. */
export function chipTone(word: string | null): ChipTone {
  if (word === null) return "unknown";
  return CHIP_TONES[word] ?? "unknown";
}

/**
 * The chip a rail row wears: the epic's word, paired with its story count.
 *
 * § Epic rail spells the pairing out — `landed 4/4`, `building 1/4` — so the
 * count rides the chip rather than sitting beside it. A spec that declares no
 * stories has no count to pair (007 is that spec today), and the word stands
 * alone rather than reading `0/0`.
 *
 * The word itself is the backend's: `_rail_chip` already ranked the operator's
 * priorities (someone waited on, something dead, what is live, all landed, the
 * declaration). Ranking it again here would be the re-derivation plan D2 exists
 * to prevent.
 */
export function railChip(entry: RailEntry): Chip {
  const word = entry.chip;
  return {
    word: word ?? "unknown",
    tone: chipTone(word),
    count:
      entry.stories_total > 0
        ? `${entry.stories_landed}/${entry.stories_total}`
        : null,
  };
}

/** The chip one story wears: its ladder's own word, with no count. */
export function storyChip(ladder: Ladder): Chip {
  return { word: ladder.chip ?? "unknown", tone: chipTone(ladder.chip), count: null };
}

/** The chip as one string, the way it reads on the screen. */
export function chipText(chip: Chip): string {
  return chip.count === null ? chip.word : `${chip.word} ${chip.count}`;
}

/**
 * The spec's id as the rail and the stage head show it: the directory's
 * numeric prefix (`005`), which is what the operator and the factory both call
 * an epic. A directory without one wears its whole name rather than a guess.
 */
export function specId(specDir: string): string {
  const prefix = specDir.split("-", 1)[0];
  return /^\d+$/.test(prefix) ? prefix : specDir;
}
