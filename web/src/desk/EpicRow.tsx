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
 *
 * ── 012 US2: the row draws the graph it now has ────────────────────────────
 *
 * Until US1 the Desk's workgraph read failed for every epic it had ever shown,
 * so the row knew no edge and had nothing to draw. It has one now, and each
 * story says what it waits for: `after us1` for the content dependency a merge
 * edge is, `once us1 passes` for the ordering-only one a pass edge is — the two
 * kinds the Showfloor's `Legend` tells apart in stroke and this row, which has
 * no wires, has to tell apart in words (FR-006).
 *
 * **`UNDECLARED` means one thing here and never the other** (FR-007, plan D4).
 * It is the reading of a story the graph *declares* and gives no edge, which is
 * an ordinary and permanent fact about a first story. It is never the reading
 * of a story no graph declared: that is a gap in what the pane was told, not a
 * fact about the work, and the row says so somewhere else — once on the row
 * when no story on it is declared (`data-no-graph`), and in the cell's own chip
 * when the graph was read and skipped this story. Repurposing `UNDECLARED` as
 * the fallback for "no graph" is how a fabricated topology gets back in, and
 * this corpus has already paid for that once.
 *
 * Nothing here is positioned and nothing here is a chip: the dependency is a
 * § Typography `micro` line, the step `.epic-state` beside it already wears,
 * flowed in the story cell like everything else on this row (plan D2). No
 * colour, face or radius § Chips does not already name is minted.
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
 *
 * **012 US2 narrows when that word is reached, and changes it nowhere else.**
 * `undeclared` is a claim about a graph — "the work graph does not declare this
 * story" — and it may only be made by a row that has one. On a row joined to no
 * graph the claim is unmakeable, and standing it in for one is the rendering
 * FR-007 forbids and plan D4 names: the word would be the pane's answer to "no
 * graph", which is how a topology nobody declared gets shown as one somebody
 * did. What the pane *was* told there is the floor's own state, so that is what
 * the chip says, and the missing graph is said once on the row instead.
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

/** One declared dependency, in the document's own two kinds. */
export interface StoryEdge {
  /** `merge` is `depends_on_merged`; `pass` is `depends_on` — `Wires`' words. */
  kind: "merge" | "pass";
  /** The node id the graph names, verbatim; the row never renames a story. */
  id: string;
}

/**
 * What this row may say about one story's dependency, and it is three things
 * and not two (012 FR-006, FR-007).
 *
 * * `declared` — the graph declares at least one edge into this story, and
 *   `edges` carries them, each keeping the kind the graph gave it.
 * * `undeclared` — the graph declares this story and gives it no edge. This is
 *   the ordinary shape of a first story and it is a fact about the work.
 * * `unread` — no graph declared this story at all, so the pane has been told
 *   nothing about what it waits for. **Never `undeclared`**: the two are one
 *   word apart on screen and a world apart in meaning, and collapsing them is
 *   how a topology the factory never declared gets rendered as one it did
 *   (plan D4).
 *
 * The distinction is the document's, not this file's guess at one:
 * `pane/floor_document.py` joins a declared node's own `depends_on` /
 * `depends_on_merged` — `[]` where the graph gave none — and leaves both
 * `null` on a card the graph did not declare.
 */
export type DependsReading = "declared" | "undeclared" | "unread";

export function dependsOn(card: NodeCard): {
  reading: DependsReading;
  edges: StoryEdge[];
} {
  if (!card.declared) return { reading: "unread", edges: [] };

  const edges: StoryEdge[] = [
    ...(card.depends_on_merged ?? []).map((id): StoryEdge => ({ kind: "merge", id })),
    ...(card.depends_on ?? []).map((id): StoryEdge => ({ kind: "pass", id })),
  ];
  return { reading: edges.length === 0 ? "undeclared" : "declared", edges };
}

/**
 * The words for one edge, which the Showfloor says in stroke and this row must
 * say in text (§ Stage: "merge edges solid 2px olive, pass edges dashed 2px
 * `--rule`"; § Named Rules: state is never carried by colour alone).
 *
 * `Stage.edgesOf` names what the two kinds *are* — a merge edge is a content
 * dependency, the predecessor's code in the dependent's base; a pass edge is an
 * ordering-only one, the predecessor having reached a verdict — and these are
 * those two sentences at the length a row can carry.
 */
function edgeText(edge: StoryEdge): string {
  return edge.kind === "merge" ? `after ${edge.id}` : `once ${edge.id} passes`;
}

/** The chip a story cell wears, and where its word came from. */
function cellChip(
  card: NodeCard,
  story: ShowfloorStory | null,
  graphRead: boolean,
): Chip & { source: string } {
  if (story !== null) return { ...storyChip(story.ladder), source: "document" };

  // 001's word for a node the workgraph does not declare, unchanged by the
  // change of clothes and not one of § Chips' six — and reached only by a row
  // that read a graph, because only such a row can know a story is missing
  // from one (012 FR-007). Where no graph was joined the floor's own state is
  // what the pane has been told, and refusing to say it would trade a fact for
  // a claim the pane cannot make.
  const word =
    !card.declared && graphRead
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
  /** Whether a work graph was joined to this story's epic at all (012 FR-007). */
  graphRead: boolean;
}

/** One story of the epic: its key, its ladder, its chip — in that order. */
function StoryCell({ card, story, answered, graphRead }: StoryCellProps) {
  const ladder = story?.ladder ?? null;
  const chip = cellChip(card, story, graphRead);
  // "WAITING_OPERATOR (or `awaiting_operator` true in any state)" wears the gold
  // chip; a VERIFYING node that is also awaited is *paged*, which is a fact the
  // chip's word does not carry, so it keeps the marker 001 gave it.
  const paged = card.awaiting_operator && card.state === "VERIFYING";
  // "labelled by `story_key`" (FR-004). The floor's key when the workgraph
  // declared one; failing that the document's, which read the same graph from
  // the other side; failing both the node's own id, which is a fact too — never
  // a blank, and never a key of the pane's own making.
  const key = card.story_key ?? story?.story_key ?? null;
  const title =
    ladder !== null && ladder.frozen
      ? `${card.story_key ?? card.id}: ${ladder.terminal_reason ?? "unknown"}`
      : ladder === null && answered
        ? "the showfloor document carries no ladder for this story"
        : undefined;

  // 012 FR-006: what this story waits for, from the graph and from nowhere
  // else. A story no graph declared gets no marker here at all — the row says
  // that once, above, and `UNDECLARED` is not the pane's word for it (FR-007).
  const depends = dependsOn(card);

  return (
    <span
      className="story"
      data-story
      data-story-key={key ?? undefined}
      data-state={card.state}
      data-paged={paged || undefined}
      data-undeclared={!card.declared || undefined}
      data-depends={depends.reading}
      data-ladder-source={ladder !== null ? "document" : answered ? "none" : "absent"}
      title={title}
    >
      <span className="skey num" data-story-label>
        {key ?? card.id}
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
      {depends.reading === "declared" && (
        <span className="deps micro" data-depends-edges>
          {depends.edges.map((edge) => (
            <span
              key={`${edge.kind}:${edge.id}`}
              data-dep
              data-dep-kind={edge.kind}
              data-dep-id={edge.id}
            >
              {edgeText(edge)}
            </span>
          ))}
        </span>
      )}
      {depends.reading === "undeclared" && (
        <span className="deps micro" data-depends-edges>
          <span data-dep-none>undeclared</span>
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
  // 012 FR-007: whether *this epic* has a graph behind it at all. A row where
  // no card is declared was joined to no graph — the read failed, or what it
  // found was about other stories (`pane/floor_document.py`'s mismatch) — and
  // the honest sentence is that one, said once on the row. Saying `UNDECLARED`
  // beside each story instead would dress a gap in the pane's knowledge as a
  // fact about the work, which is the defect this spec exists to remove.
  const graphRead = cards.some((card) => card.declared);

  return (
    <article
      className="epic"
      data-epic-id={epic.epic_id}
      data-scene={epic.scene ?? undefined}
      data-ladders={entry === null ? "absent" : "document"}
      data-graph={graphRead ? "read" : "unread"}
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
            graphRead={graphRead}
          />
        ))}
        {entry === null && (
          <span className="epic-note" data-no-ladders>
            no ladder: the showfloor document carries no entry for this epic
          </span>
        )}
        {!graphRead && (
          <span className="epic-note" data-no-graph>
            no graph: no work graph was joined for this epic, so no dependency is
            known
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
