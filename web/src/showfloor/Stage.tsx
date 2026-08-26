/**
 * The stage: one epic, its metrics, and its work graph drawn inside its box.
 *
 * `DESIGN.md` § Stage is the authority — "Header: `display` id + `name` + the
 * live story's chip. A metrics grid (hairline 1px-gap grid on surface):
 * stories, merged, FRs, last-story wall clock, spend to date — spend obeys the
 * Unknown Rule. The graph: ranks left→right in declaration order, node cards
 * `11.5rem` wide … One legend row under the stage, rendered once per page,
 * never per epic. The stage scrolls horizontally when a graph outgrows it; an
 * epic whose stage document has no nodes renders as its degraded notice with
 * **no stage canvas at all**."
 *
 * Three things are worth saying about what is *not* here.
 *
 * The ladder is not derived. Every stop arrives on the document, decided once
 * in `pane/showfloor.py` (plan D2); the stage only lays the cards out.
 *
 * The layout is not a library's. Plan D1: ranks are flex columns and the wires
 * are measured off the boxes flex produced, so there is no second coordinate
 * space to disagree with the first — the defect 004 shipped (nine of nine
 * stations laid out beyond their own map) is unreachable by construction, not
 * by test.
 *
 * And no number here is invented. Two of the five metrics — the last story's
 * wall clock and this epic's spend — are facts the *floor* records, not the
 * showfloor document, and where the floor did not record them for this epic the
 * cell reads `unknown` in italic muted: never `0`, never a dash, and the word
 * "live" nowhere near spend (§ The Unknown Rule; constitution III).
 */

import { useMemo } from "react";
import type { FloorDocument } from "../api/floorDocument";
import type { RailEntry, ShowfloorStory } from "../api/showfloorDocument";
import { chipText, railChip, specId } from "./ladder";
import NodeCard from "./NodeCard";
import Wires, { type WireEdge } from "./Wires";

/* ── the graph ─────────────────────────────────────────────────────────── */

/**
 * The stage's edges, from the two dependency kinds the workgraph declares.
 *
 * § Stage tells them apart by stroke — merge solid olive, pass dashed rule —
 * and the document already carries them apart: `depends_on_merged` is a content
 * dependency (the predecessor's code is in the dependent's base) and
 * `depends_on` is an ordering-only one (the predecessor reached a verdict). The
 * pane re-derives neither; it reads both lists and draws them differently.
 */
export function edgesOf(stories: ShowfloorStory[]): WireEdge[] {
  const declared = new Set(
    stories.map((story) => story.id).filter((id): id is string => id !== null),
  );
  const edges: WireEdge[] = [];

  for (const story of stories) {
    if (story.id === null) continue;
    for (const source of story.depends_on_merged) {
      if (declared.has(source)) edges.push({ source, target: story.id, kind: "merge" });
    }
    for (const source of story.depends_on) {
      if (declared.has(source)) edges.push({ source, target: story.id, kind: "pass" });
    }
  }

  return edges;
}

/**
 * The ranks, left→right, in declaration order.
 *
 * A story's rank is the longest dependency path that reaches it: both edge
 * kinds order the work — a merge edge orders content, a pass edge orders a
 * verdict — and either one puts the dependent to the right of what it waits
 * for. Within a rank, stories keep the order the workgraph declared them in,
 * which is the order the deriver compiled and the order `tasks.md` phases run.
 *
 * A cycle cannot come out of a compiled workgraph, but a bounded walk is what
 * keeps a malformed one from hanging the room rather than degrading it: after
 * `stories.length` passes the ranks stop moving, and whatever they are is what
 * is drawn.
 */
export function ranksOf(stories: ShowfloorStory[]): ShowfloorStory[][] {
  const edges = edgesOf(stories);
  const rank = new Map<string, number>();
  for (const story of stories) if (story.id !== null) rank.set(story.id, 0);

  for (let pass = 0; pass < stories.length; pass++) {
    let moved = false;
    for (const edge of edges) {
      const next = (rank.get(edge.source) ?? 0) + 1;
      if (next > (rank.get(edge.target) ?? 0)) {
        rank.set(edge.target, next);
        moved = true;
      }
    }
    if (!moved) break;
  }

  const columns: ShowfloorStory[][] = [];
  for (const story of stories) {
    const depth = story.id === null ? 0 : (rank.get(story.id) ?? 0);
    while (columns.length <= depth) columns.push([]);
    columns[depth].push(story);
  }
  return columns;
}

/* ── the metrics ───────────────────────────────────────────────────────── */

/** A metric cell's value: a measured one, or the word the factory did not say. */
export type Metric = { known: true; text: string } | { known: false };

const UNKNOWN: Metric = { known: false };

/**
 * The distinct requirement keys this epic's stories implement.
 *
 * `requirement_keys` carries the story's own key beside its FRs (`US1`,
 * `FR-001`, …); § Stage's cell counts FRs, so the story keys are not counted as
 * requirements of themselves. A spec whose graph could not be read carries no
 * keys at all, and the cell says so rather than counting zero.
 */
export function requirementCount(stories: ShowfloorStory[]): Metric {
  const keys = new Set<string>();
  for (const story of stories) {
    for (const key of story.requirement_keys) {
      if (key.startsWith("FR-")) keys.add(key);
    }
  }
  return keys.size === 0 ? UNKNOWN : { known: true, text: String(keys.size) };
}

/** One epic's pace entry from the floor's own `collect_floor` answer. */
interface PaceAttempt {
  node_id: string;
  seconds: number;
}

/**
 * The wall clock of the last story the floor worked on this epic, in seconds.
 *
 * `collect_floor`'s `pace` section is where the factory records how long an
 * attempt took; nothing in the showfloor document carries a duration, and
 * `epic_status`'s per-node `history` carries no timestamps at all. So the cell
 * reads the floor's own measurement or it reads `unknown` — it does not
 * subtract two instants the pane picked itself.
 *
 * "Last story" is the last node the pace entry names, and its figure is the sum
 * of its attempts: a story that took four attempts to pass spent all four.
 */
export function lastStoryWallClock(floor: FloorDocument | null, epicId: string | null): Metric {
  if (floor === null || epicId === null) return UNKNOWN;

  const data = floor.floor.data as { pace?: unknown } | null;
  const pace = data === null ? undefined : data.pace;
  if (!Array.isArray(pace)) return UNKNOWN;

  const entry = pace.find(
    (candidate): candidate is { epic_id: string; attempts?: unknown } =>
      typeof candidate === "object" &&
      candidate !== null &&
      (candidate as { epic_id?: unknown }).epic_id === epicId,
  );
  if (entry === undefined || !Array.isArray(entry.attempts)) return UNKNOWN;

  const attempts = entry.attempts.filter(
    (attempt): attempt is PaceAttempt =>
      typeof attempt === "object" &&
      attempt !== null &&
      typeof (attempt as PaceAttempt).node_id === "string" &&
      typeof (attempt as PaceAttempt).seconds === "number",
  );
  if (attempts.length === 0) return UNKNOWN;

  const last = attempts[attempts.length - 1].node_id;
  const seconds = attempts
    .filter((attempt) => attempt.node_id === last)
    .reduce((total, attempt) => total + attempt.seconds, 0);

  return { known: true, text: formatDuration(seconds) };
}

/** A duration as the stage says it: `4s`, `19m`, `1h 20m`. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** One row of the usage rollup, in the shape `factory.usage.ledger.rollup` emits. */
interface RollupGroup {
  key: string;
  spend_usd?: unknown;
}

/**
 * This epic's spend to date, from the rollup the floor document serves.
 *
 * The ledger's node rollup keys a row `<epic-id>:<node-id>`, so an epic's spend
 * is the sum of its own rows. A rollup grouped some other way — the persona
 * rollup 001 serves today — carries no row for this epic, and that is
 * `unknown`: the pane will not present the floor's whole spend as one epic's,
 * and it will not present a zero it did not read.
 *
 * "A total is unknown when any row in scope is unknown" (§ The Unknown Rule),
 * so one NULL among this epic's rows makes the cell unknown rather than a
 * partial sum dressed as a total. And `0.0` is not NULL: this build routes no
 * persona to a metered provider (D-011), so a real, recorded zero renders
 * `$0.00`.
 */
export function epicSpend(rollup: unknown, epicId: string | null): Metric {
  if (epicId === null || typeof rollup !== "object" || rollup === null) return UNKNOWN;

  const groups = (rollup as { groups?: unknown }).groups;
  if (!Array.isArray(groups)) return UNKNOWN;

  const mine = groups.filter(
    (group): group is RollupGroup =>
      typeof group === "object" &&
      group !== null &&
      typeof (group as RollupGroup).key === "string" &&
      (group as RollupGroup).key.startsWith(`${epicId}:`),
  );
  if (mine.length === 0) return UNKNOWN;

  let total = 0;
  for (const group of mine) {
    if (typeof group.spend_usd !== "number") return UNKNOWN;
    total += group.spend_usd;
  }
  return { known: true, text: `$${total.toFixed(2)}` };
}

/** A count the corpus really declared, or `unknown` when it declared nothing. */
function declaredCount(value: number, declared: boolean): Metric {
  return declared ? { known: true, text: String(value) } : UNKNOWN;
}

function MetricCell({ label, value }: { label: string; value: Metric }): JSX.Element {
  return (
    <div className="metric" data-metric={label}>
      <b data-metric-value>
        {value.known ? value.text : <span className="unknown">unknown</span>}
      </b>
      <span data-metric-label>{label}</span>
    </div>
  );
}

/* ── the stage ─────────────────────────────────────────────────────────── */

interface StageProps {
  entry: RailEntry;
  /** The floor document, for the two facts only `collect_floor` records. */
  floor: FloorDocument | null;
  /** The story the detail pane is telling, by node id (005 US4). */
  selectedStory?: string | null;
  /** What a card does when it is picked; absent where nothing listens. */
  onSelectStory?: (story: ShowfloorStory) => void;
}

/**
 * The band under the stage: what the epic on it is *for* (009 US4, D-019).
 *
 * `DESIGN.md` § Stage, amended 2026-08-25: "Under the stage, above the legend,
 * the spec's own goal — one paragraph lifted from the spec's `## Context` — or
 * `## Sketch` for a spec still unrefined — saying what this epic is *for*. It
 * does not depend on selection, because it is true of the graph either way, and
 * a spec carrying neither heading renders no band at all rather than an empty
 * one."
 *
 * Two things this is not. It is not a Markdown render — the paragraph arrives
 * whitespace-collapsed on the document and is written as prose, because the
 * reading room for a spec's full body is 007 and it is still a sketch. And it
 * is not conditional on a story being picked: the band emptying itself on a
 * click is the layout jump D-019 exists to close.
 *
 * `null` for a spec that states no goal, which is the whole of FR-011: an empty
 * bordered strip under the graph is furniture standing in for an answer, the
 * same defect in a different costume as a ladder defaulting to its first stop.
 */
export function SpecGoal({ intent }: { intent: string }): JSX.Element | null {
  if (intent === "") return null;
  return (
    <p className="spec-goal" data-spec-goal>
      {intent}
    </p>
  );
}

export default function Stage({
  entry,
  floor,
  selectedStory = null,
  onSelectStory,
}: StageProps): JSX.Element {
  const stories = entry.stories;
  const chip = railChip(entry);

  // Memoised so that a selection change does not hand `Wires` a fresh array it
  // would re-measure against by accident. The wires *must* re-measure when the
  // detail track collapses or returns, and that has to be a thing this file
  // says out loud (`relayout` below) rather than a side effect of an identity
  // that could be memoised away by the next person reading for a re-render
  // (008 US2, plan Risks).
  const edges = useMemo(() => edgesOf(stories), [stories]);

  // "an epic whose stage document has no nodes renders as its degraded notice
  // with **no stage canvas at all**" (§ Stage; FR-013). The branch is taken
  // before the canvas exists, not by hiding one — 004's FR-001, restated so the
  // rebuilt component keeps the guarantee it was written for.
  const staged = stories.length > 0;
  const declared = !entry.unknown.includes("stories") && entry.stories_total > 0;

  return (
    <>
      <header className="stage-head" data-stage-head>
        <span className="spec-id" data-stage-id>
          {specId(entry.spec_dir)}
        </span>
        <span className="spec-name" data-stage-name>
          {entry.name}
        </span>
        {/* § Stage: "the live story's chip" — the same object the rail row
            wears, ranked once in the backend (plan D2). */}
        <span className={`chip ${chip.tone}`} data-stage-chip data-chip-tone={chip.tone}>
          {chipText(chip)}
        </span>
      </header>

      <div className="metrics" data-metrics>
        <MetricCell label="stories" value={declaredCount(entry.stories_total, declared)} />
        <MetricCell label="merged" value={declaredCount(entry.stories_landed, declared)} />
        <MetricCell label="FRs" value={requirementCount(stories)} />
        <MetricCell label="last story" value={lastStoryWallClock(floor, entry.epic_id)} />
        <MetricCell
          label="spend to date"
          value={epicSpend(floor === null ? null : floor.spend_to_date.data, entry.epic_id)}
        />
      </div>

      {/* Every read that failed for this spec, named in place, transport told
          apart from refusal (constitution III). They sit above the graph
          because a graph drawn from a partial read is the thing being
          qualified. */}
      {entry.notes.map((note, index) => (
        <div
          className="degraded"
          data-stage-note
          data-mode={note.mode}
          key={`${note.read}-${index}`}
          role="status"
        >
          <p className="lead">A read for this spec degraded.</p>
          <p>
            <span className="read num">{note.read}</span>{" "}
            <span className="mode">{note.mode}</span>{" "}
            <span className="detail">{note.detail}</span>
          </p>
        </div>
      ))}

      {staged ? (
        <div className="dag-scroll" data-stage-scroll>
          <div className="dag" data-stage-canvas>
            {/* The wires measure their own box and walk their parent for the
                cards, so the canvas needs no ref: a parent's ref is not
                attached yet when a child's layout effect runs. */}
            <Wires edges={edges} relayout={selectedStory} />
            <div className="ranks" data-ranks>
              {ranksOf(stories).map((column, depth) => (
                <div className="rank" data-rank={depth} key={depth}>
                  {column.map((story) => (
                    <NodeCard
                      key={story.id ?? story.story_key ?? depth}
                      story={story}
                      selected={(story.id ?? story.story_key) === selectedStory}
                      onSelect={onSelectStory}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="stage-empty" data-stage-empty role="status">
          {entry.notes.length > 0
            ? "No story could be read for this spec, so there is nothing to stage. The reads that failed are named above."
            : "This spec declares no work graph, so there is nothing to stage."}
        </p>
      )}
    </>
  );
}
