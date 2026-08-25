/**
 * One epic, one row: id, chip, its stories as inline mini-ladders, spend
 * (006 US2, FR-004).
 *
 * **Succeeds the first world's three state pictures**, deleted in this story's
 * diff: `MilestoneBar.tsx` and its `milestones.ts` track, and `NodeChevron.tsx`.
 * Those drew the Desk's own answer to "where is this epic" — a five-diamond
 * track with absolutely-positioned captions, and one glyph per story — and they
 * were wrong twice over. They *derived* a picture the Showfloor derives once,
 * server-side, so the two rooms could disagree about a stop; and they placed
 * labels in a track that had no room for them, which is the collision class the
 * 2026-08-24 review measured on every epic row of the fixture floor
 * (`"COMPLETED · epic-002" × "dispatch"`, `"implementer" × "us1 · paged"`).
 *
 * Both defects die here, and each dies in the way that keeps it dead:
 *
 * - **Nothing on this row is derived.** The six stops come from the showfloor
 *   document's `ladder.stops`, rendered in the order and with the status the
 *   backend sent (`pane/showfloor.py`, 005 plan D2). This file contains no
 *   state→stop table, and `EpicRow.test.tsx` feeds it a document whose ladder
 *   deliberately contradicts a naive reading of `state` to prove the document
 *   wins (FR-005).
 * - **Nothing on this row is positioned.** The row is a grid of three flowed
 *   cells and the stories are a wrapping flex row, so two labels sharing track
 *   space is not a bug this layout can have (plan D2). The law that keeps it
 *   that way is Desk-wide and lives in `tests/smoke/desk.spec.ts` (FR-006).
 *
 * **Where the document has nothing to say, this row says so — once.** The
 * recorded Fixture floor is another repository's floor
 * (`fixtures/floor/floor-live.json` was captured against `ergane-test`) while
 * the showfloor document is assembled from *this* corpus, so under
 * `PANE_DEMO=1` no rail entry answers for these epics at all. That is a fact
 * about the epic, not about each of its stories, and the row states it in one
 * line rather than printing `unknown` beside every story — six identical words
 * on one row is noise, and noise is how a real unknown gets missed. Where the
 * document *does* answer for the epic but carries no ladder for one story — the
 * skew case, an answer naming a story the graph does not declare — the marker
 * is on that story, because that is where the gap is.
 *
 * Either way no ladder is invented, and the story's chip falls back to the state
 * the *floor* document reported, dressed in § The status ladder's own words.
 * That fallback is the one place a word here is not the showfloor document's; it
 * is marked `data-chip-source` on the element so a test can tell the two apart,
 * and it never invents a stop.
 *
 * § Motion is deliberately absent: the pane's one authored motion is the stage's
 * active stop pulsing, and forty inline rails breathing at once is not "calm at
 * rest" (§ Overview). `desk-world.spec.ts`'s motion sweep holds unchanged.
 */

import type { EpicEntry, NodeCard } from "../api/floorDocument";
import type {
  Ladder,
  RailEntry,
  ShowfloorDocument,
  ShowfloorStory,
} from "../api/showfloorDocument";
import {
  chipText,
  chipTone,
  railChip,
  stopClass,
  storyChip,
  type Chip,
} from "../showfloor/ladder";

/**
 * § The status ladder › "Eleven node states map onto the ladder and chips",
 * read down its right-hand column.
 *
 * This is *not* a ladder derivation and cannot become one: it maps the floor's
 * own reported state to one of § Chips' words, and it is read only for a story
 * the showfloor document does not carry — where the alternative is a story
 * whose state the Desk has been told and refuses to say. An undeclared node's
 * `undeclared` is deliberately not one of the six words and falls to the
 * Unknown Rule, exactly as 001 had it.
 */
const FLOOR_WORDS: Record<string, string> = {
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

/**
 * The showfloor document's entry for one floor epic, or null.
 *
 * `pane/showfloor.py` sets a rail entry's `epic_id` to its own `spec_dir` when
 * the floor reported an epic for that spec, which is the join and the whole of
 * it. A floor epic no entry answers for gets null rather than a near-match: an
 * epic row wearing another spec's ladders would be worse than one wearing none.
 */
export function entryForEpic(
  showfloor: ShowfloorDocument | null,
  epicId: string,
): RailEntry | null {
  if (showfloor === null || !Array.isArray(showfloor.rail)) return null;
  return showfloor.rail.find((entry) => entry.epic_id === epicId) ?? null;
}

/**
 * The document's story for one floor node, matched on the identity both
 * documents carry: the node id (`us1`), else the story key, case-folded because
 * the two seams spell it two ways (`us1` on the floor, `US1` in the graph).
 */
export function storyForCard(
  entry: RailEntry | null,
  card: NodeCard,
): ShowfloorStory | null {
  if (entry === null || !Array.isArray(entry.stories)) return null;
  const key = (card.story_key ?? card.id).toLowerCase();
  return (
    entry.stories.find(
      (story) =>
        story.id === card.id ||
        (story.story_key ?? story.id ?? "").toLowerCase() === key,
    ) ?? null
  );
}

/**
 * The reason a frozen ladder gives, verbatim, for every terminal story of the
 * epic — or null where nothing froze (FR-007).
 *
 * `terminal_reason` is the factory's own sentence and is never paraphrased; a
 * ladder that froze without one says `unknown`, because the pane knows the
 * story is dead and does not know why (the Unknown Rule).
 */
export function terminalReasons(entry: RailEntry | null): string | null {
  if (entry === null || !Array.isArray(entry.stories)) return null;
  const frozen = entry.stories.filter((story) => story.ladder.frozen);
  if (frozen.length === 0) return null;
  return frozen
    .map(
      (story) =>
        `${story.story_key ?? story.id ?? "unknown"}: ${
          story.ladder.terminal_reason ?? "unknown"
        }`,
    )
    .join(" · ");
}

/** The chip a story cell wears, and where its word came from. */
function cellChip(card: NodeCard, story: ShowfloorStory | null): Chip & { source: string } {
  if (story !== null) return { ...storyChip(story.ladder), source: "document" };

  // 001's word for a node the workgraph does not declare, unchanged by the
  // change of clothes and not one of § Chips' six.
  const word = !card.declared
    ? "undeclared"
    : card.awaiting_operator
      ? "waiting on you"
      : (FLOOR_WORDS[card.state] ?? "unknown");
  return { word, tone: chipTone(word), count: null, source: "floor-state" };
}

/**
 * The six stops, as § The status ladder draws them small: "six `4px`-tall bars
 * with `3px` gaps", done olive, active accent, waiting gold, ahead `--sunken`.
 *
 * The bars carry no word of their own — the chip beside them already says the
 * stop, which is what § Named Rules asks for, and a screen reader reading six
 * unlabelled bars would hear noise.
 */
function MiniLadder({ ladder }: { ladder: Ladder }) {
  return (
    <span
      className="mini"
      data-ladder
      data-ladder-frozen={ladder.frozen ? "true" : undefined}
      data-stop-key={ladder.stop_key ?? undefined}
      aria-hidden="true"
    >
      {ladder.stops.map((stop) => (
        <i
          key={stop.key}
          className={stopClass(stop.status)}
          data-stop={stop.key}
          data-stop-status={stop.status}
        />
      ))}
    </span>
  );
}

interface StoryCellProps {
  card: NodeCard;
  story: ShowfloorStory | null;
  /** Whether the document answered for this story's epic at all. */
  answered: boolean;
}

/** One story of the epic: its key, its ladder, its chip — in that order. */
function StoryCell({ card, story, answered }: StoryCellProps) {
  const ladder = story?.ladder ?? null;
  const chip = cellChip(card, story);
  // "WAITING_OPERATOR (or `awaiting_operator` true in any state)" wears the gold
  // chip; a VERIFYING node that is also awaited is *paged*, which is a fact the
  // chip's word does not carry, so it keeps the marker 001 gave it.
  const paged = card.awaiting_operator && card.state === "VERIFYING";
  const title =
    ladder !== null && ladder.frozen
      ? `${card.story_key ?? card.id}: ${ladder.terminal_reason ?? "unknown"}`
      : ladder === null && answered
        ? "the showfloor document carries no ladder for this story"
        : undefined;

  return (
    <span
      className="story"
      data-story
      data-story-key={card.story_key ?? undefined}
      data-state={card.state}
      data-paged={paged || undefined}
      data-undeclared={!card.declared || undefined}
      data-ladder-source={ladder !== null ? "document" : answered ? "none" : "absent"}
      title={title}
    >
      <span className="skey num" data-story-label>
        {card.story_key ?? card.id}
      </span>
      {ladder !== null ? (
        <MiniLadder ladder={ladder} />
      ) : answered ? (
        <span className="unknown" data-ladder-unread>
          unknown
        </span>
      ) : null}
      <span
        className={`chip ${chip.tone}`}
        data-chip
        data-chip-tone={chip.tone}
        data-chip-source={chip.source}
      >
        {chipText(chip)}
      </span>
      {paged && (
        <span className="paged-label micro" aria-label="paged">
          paged
        </span>
      )}
    </span>
  );
}

interface EpicRowProps {
  epic: EpicEntry;
  /** The room's ladders, or null until the read that carries them lands. */
  showfloor?: ShowfloorDocument | null;
}

export default function EpicRow({ epic, showfloor = null }: EpicRowProps) {
  const cards = epic.nodes;
  const entry = entryForEpic(showfloor, epic.epic_id);
  // § Epic rail: "status chip with the story count (`landed 4/4`)". The word and
  // the count are both the document's — `_rail_chip` already ranked the
  // operator's priorities, and ranking them again here is the re-derivation
  // plan D2 exists to prevent. An epic no entry answers for has neither.
  const chip: Chip =
    entry === null ? { word: "unknown", tone: "unknown", count: null } : railChip(entry);
  const terminal = terminalReasons(entry);

  return (
    <article
      className="epic"
      data-epic-id={epic.epic_id}
      data-scene={epic.scene ?? undefined}
      data-ladders={entry === null ? "absent" : "document"}
      // FR-007: a terminal story's reason is reachable on the row itself, not
      // only inside the cell that froze.
      title={terminal ?? undefined}
    >
      <div className="epic-id">
        <span className="epic-name num" data-epic-name>
          {epic.epic_id}
        </span>
        <span
          className={`chip ${chip.tone} estat`}
          data-chip
          data-chip-tone={chip.tone}
          data-epic-chip
        >
          {chipText(chip)}
        </span>
        {/* The epic's own state, in the factory's spelling: the chip is the
            document's reading of the spec, this is what the workflow says it is
            doing, and where the two disagree that is information. */}
        <span className="epic-state micro" data-epic-state>
          {epic.epic_state}
        </span>
      </div>
      <div className="stories" data-stories>
        {cards.map((card) => (
          <StoryCell
            key={card.id}
            card={card}
            story={storyForCard(entry, card)}
            answered={entry !== null}
          />
        ))}
        {entry === null && (
          <span className="epic-note" data-no-ladders>
            no ladder: the showfloor document carries no entry for this epic
          </span>
        )}
      </div>
      <div className="epic-spend" data-epic-spend>
        {/* The Unknown Rule, unchanged and binding: the usage rollup groups by
            persona and carries no epic dimension, so this epic's spend is a
            number the factory has not given — italic `unknown`, never `0`, a
            dash, or an empty cell. */}
        <span className="v num">
          <span className="unknown">unknown</span>
        </span>
        <span className="k micro">spend to date</span>
      </div>
    </article>
  );
}
