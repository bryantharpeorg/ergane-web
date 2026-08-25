/**
 * The detail pane: one story, told whole (005 US4, FR-015, FR-016).
 *
 * `DESIGN.md` § Detail pane is the authority — "For the selected story: id,
 * serif title, the story's one-sentence intent, the six named steps with
 * timestamps, a facts grid (attempt `n of cap`, judge verdict with scenario
 * count, PR number, landing SHA, wall clock), and the `requirement_keys` as
 * sunken mono chips. `aria-live="polite"`. When nothing is selected it explains
 * the room in two sentences." The shape is the approved comp's
 * (`.impeccable/mocks/showfloor-redrawn.html`): `dhead` · `dtitle` · `dprose`,
 * a `steps` list of dot · mono name · timestamp, a `kv` facts grid, and an
 * `implements` row of `fr` chips.
 *
 * Nothing here derives a stop or a state. The six steps are the document's own
 * ladder (plan D2), named and expanded — the *same* six the card draws as bars
 * — so the pane and the card cannot disagree about where a story is.
 *
 * ## What the factory answers, and what it does not
 *
 * Three of the five facts DESIGN.md names have no field in the seam this room
 * reads. Checked against the installed contract rather than assumed —
 * `factory.workgraph.models.NodeStatus`, which is what the `epic_status` query
 * returns, and `factory.mergequeue.models.Landing`, which is where a landing's
 * own bookkeeping lives:
 *
 * * **the attempt cap** is dispatch input; the answer carries `attempt` and no
 *   ceiling to divide it by, so the cell is the number alone. A denominator the
 *   pane picked would be a number the factory never said.
 * * **a landing SHA** is carried nowhere: `NodeStatus` surfaces the landing's
 *   state, PR number and outcome history, and `provenance` is the attribution
 *   of *externally completed* work, not a merge commit. What the answer does
 *   record about a landing is the instant the queue observed it MERGED, so that
 *   is what the `landed` cell says. § Don'ts — "don't render an element that
 *   can never fill" — is why this is not a `—` forever with a hash's label on
 *   it.
 * * **the judge's scenario count** is not in `AttemptRecord` either; the verdict
 *   and the judge's outcome are, and they are what the `judge` cell shows,
 *   verbatim. The count the pane can stand behind is of the requirement keys it
 *   is listing, and it rides the `implements` heading — which is exactly where
 *   the comp put it.
 *
 * Every other absence renders `—`, and the wall clock comes from the floor's
 * own `pace` measurement (`collect_floor`), never from two instants the pane
 * subtracted itself.
 */

import type { FloorDocument } from "../api/floorDocument";
import type { LadderStop, ShowfloorStory } from "../api/showfloorDocument";
import { formatDuration } from "./Stage";

/** The em dash DESIGN.md's facts grid shows where the answer carried nothing. */
export const ABSENT = "—";

/* ── the six steps ─────────────────────────────────────────────────────── */

/** One named step of the ladder, as the pane reads it out. */
export interface Step {
  key: string;
  label: string;
  /** The document's own status word for this stop. */
  status: LadderStop["status"];
  /** The comp's class: `done` · `now` · `hold` · `pending` · `froze`. */
  tone: string;
  /** The instant the factory recorded for this stop, or null for none. */
  at: string | null;
}

/** § Detail pane's classes, keyed by the status the document sent. */
const STEP_TONE: Record<string, string> = {
  done: "done",
  active: "now",
  waiting: "hold",
  ahead: "pending",
  frozen: "froze",
};

/**
 * The instant as the pane says it: the factory's own UTC, never the browser's.
 *
 * The recorded string is a UTC instant (`2026-08-22T17:40:54Z`); rendering it
 * through the reader's local clock would make the same document read
 * differently in two places, and the pane has no business restating when a
 * merge happened in a timezone the factory did not write. An instant in any
 * other shape is shown verbatim rather than reformatted into a guess.
 */
export function stampOf(at: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(at);
  if (match === null) return at;
  return `${match[4]}:${match[5]} UTC`;
}

/** One landing outcome, in the shape `Landing.outcomes` records it. */
interface LandingOutcome {
  at?: unknown;
  outcome?: unknown;
}

/** The landing outcomes this story's answer carried, in the order observed. */
function landingHistory(story: ShowfloorStory): LandingOutcome[] {
  const history = story.facts.landing_history;
  if (!Array.isArray(history)) return [];
  return history.filter(
    (entry): entry is LandingOutcome => typeof entry === "object" && entry !== null,
  );
}

/** The instant the queue observed this story merged, or null for none. */
export function mergedAt(story: ShowfloorStory): string | null {
  const merged = landingHistory(story).filter((entry) => entry.outcome === "MERGED");
  const last = merged[merged.length - 1];
  if (last === undefined || typeof last.at !== "string" || last.at === "") return null;
  return last.at;
}

/**
 * The six stops as named steps, each carrying the instant the factory recorded.
 *
 * Only one stop has a recorded instant on this contract — `merged`, from the
 * queue's own outcome history — so the rest carry none and say so with `—`
 * rather than with a time the pane worked out. A step still ahead of the work
 * carries nothing at all: nothing has happened to stamp, and § Don'ts is
 * against drawing an element that can never fill.
 */
export function stepsOf(story: ShowfloorStory): Step[] {
  const merged = mergedAt(story);
  return story.ladder.stops.map((stop) => ({
    key: stop.key,
    label: stop.label,
    status: stop.status,
    tone: STEP_TONE[stop.status] ?? "pending",
    at: stop.key === "merged" && stop.status === "done" ? merged : null,
  }));
}

/* ── the facts ─────────────────────────────────────────────────────────── */

/** One row of the facts grid: its label, and what the answer said. */
export interface Fact {
  label: string;
  /** The value, or `null` where the factory recorded none — rendered `—`. */
  value: string | null;
}

/** One attempt record, in the shape `AttemptRecord` carries it. */
interface AttemptRecord {
  verdict?: unknown;
  judge_outcome?: unknown;
}

/** The verdict of the last attempt the factory recorded, with its outcome. */
export function judgeFact(story: ShowfloorStory): string | null {
  const history = story.facts.history;
  if (!Array.isArray(history) || history.length === 0) return null;

  const last = history[history.length - 1] as AttemptRecord;
  if (typeof last !== "object" || last === null) return null;
  if (typeof last.verdict !== "string" || last.verdict === "") return null;

  // The judge's own two words, in the factory's spelling. `judge_outcome` is
  // null while a verdict is still a verdict and has produced no ruling yet.
  return typeof last.judge_outcome === "string" && last.judge_outcome !== ""
    ? `${last.verdict} · ${last.judge_outcome}`
    : last.verdict;
}

/** The PR the landing opened, with the state the landing is in. */
export function prFact(story: ShowfloorStory): string | null {
  const pr = story.facts.pr_number;
  if (typeof pr !== "number") return null;

  const landing = story.facts.landing_state;
  return typeof landing === "string" && landing !== ""
    ? `#${pr} · ${landing.toLowerCase().replace(/_/g, " ")}`
    : `#${pr}`;
}

/** One epic's pace entry, as `collect_floor` records it. */
interface PaceAttempt {
  node_id: string;
  seconds: number;
}

/**
 * This story's wall clock: the seconds the floor measured, summed over its
 * attempts.
 *
 * The same measurement § Stage's "last story" cell reads, narrowed to one node.
 * A story that has spent four attempts spent all four, and a story the floor
 * recorded no pace for has no wall clock — not a zero (§ The Unknown Rule).
 */
export function wallClockFact(
  floor: FloorDocument | null,
  epicId: string | null,
  nodeId: string | null,
): string | null {
  if (floor === null || epicId === null || nodeId === null) return null;

  const data = floor.floor.data as { pace?: unknown } | null;
  const pace = data === null ? undefined : data.pace;
  if (!Array.isArray(pace)) return null;

  const entry = pace.find(
    (candidate): candidate is { epic_id: string; attempts?: unknown } =>
      typeof candidate === "object" &&
      candidate !== null &&
      (candidate as { epic_id?: unknown }).epic_id === epicId,
  );
  if (entry === undefined || !Array.isArray(entry.attempts)) return null;

  const mine = entry.attempts.filter(
    (attempt): attempt is PaceAttempt =>
      typeof attempt === "object" &&
      attempt !== null &&
      (attempt as PaceAttempt).node_id === nodeId &&
      typeof (attempt as PaceAttempt).seconds === "number",
  );
  if (mine.length === 0) return null;

  return formatDuration(mine.reduce((total, attempt) => total + attempt.seconds, 0));
}

/** The five facts § Detail pane names, in its order, from what was answered. */
export function factsOf(
  story: ShowfloorStory,
  floor: FloorDocument | null,
  epicId: string | null,
): Fact[] {
  const attempt = story.facts.attempt;
  const merged = mergedAt(story);

  return [
    {
      label: "attempt",
      // `0` is the factory saying this story has not been attempted, which is
      // an absence and not a count of nothing.
      value: typeof attempt === "number" && attempt > 0 ? String(attempt) : null,
    },
    { label: "judge", value: judgeFact(story) },
    { label: "pr", value: prFact(story) },
    { label: "landed", value: merged === null ? null : stampOf(merged) },
    { label: "wall clock", value: wallClockFact(floor, epicId, story.id) },
  ];
}

/* ── the pane ──────────────────────────────────────────────────────────── */

interface DetailPaneProps {
  /** The selected story, or null while the room has no selection. */
  story: ShowfloorStory | null;
  /** The epic the selection belongs to, for the floor's pace measurement. */
  epicId?: string | null;
  floor?: FloorDocument | null;
}

/**
 * The pane is `aria-live="polite"` on the element that persists across
 * selections (§ Detail pane): a live region announces what changes *inside*
 * it, so a region that is unmounted and remounted per story announces nothing.
 */
export default function DetailPane({
  story,
  epicId = null,
  floor = null,
}: DetailPaneProps): JSX.Element {
  return (
    <aside className="detail" data-detail aria-live="polite">
      {story === null ? <EmptyPane /> : <StoryDetail story={story} epicId={epicId} floor={floor} />}
    </aside>
  );
}

/**
 * "When nothing is selected it explains the room in two sentences" — two, and
 * they explain the room rather than apologising for the pane.
 */
function EmptyPane(): JSX.Element {
  return (
    <p className="detail-empty" data-detail-empty>
      The rail picks a spec and the stage draws its work graph, one epic at a
      time. Choose a story on the stage and this pane tells it whole — the six
      steps it moves through, the facts the factory recorded, and the
      requirements it implements.
    </p>
  );
}

interface StoryDetailProps {
  story: ShowfloorStory;
  epicId: string | null;
  floor: FloorDocument | null;
}

function StoryDetail({ story, epicId, floor }: StoryDetailProps): JSX.Element {
  const id = (story.story_key ?? story.id ?? "unknown").toUpperCase();
  const steps = stepsOf(story);
  const facts = factsOf(story, floor, epicId);
  const keys = story.requirement_keys;

  return (
    <>
      <div className="dhead" data-detail-head>
        <span className="nid" data-detail-id>
          {id}
        </span>
        {story.priority === null ? null : (
          <span className="dpriority" data-detail-priority>
            {story.priority}
          </span>
        )}
      </div>

      <p className="dtitle" data-detail-title>
        {story.title}
      </p>

      {/* The spec's own sentence, or the absence of one said plainly: a story
          whose heading carried no paragraph is not given words by the pane. */}
      <p className="dprose" data-detail-intent>
        {story.intent === "" ? (
          <span className="unknown">the spec records no intent for this story</span>
        ) : (
          story.intent
        )}
      </p>

      {/* A frozen ladder's reason, verbatim — the same sentence the card
          carries, because there is one factory sentence and not two. */}
      {story.ladder.frozen && story.ladder.terminal_reason !== null ? (
        <p className="dterminal" data-detail-terminal>
          {story.ladder.terminal_reason}
        </p>
      ) : null}

      <p className="dsec">status</p>
      <ul className="steps" data-detail-steps>
        {steps.map((step) => (
          <li key={step.key} className={step.tone} data-step={step.key} data-step-status={step.status}>
            <span className="dot" aria-hidden="true" />
            <span className="sname" data-step-name>
              {step.label}
            </span>
            <span className="swhen" data-step-when>
              {step.at === null
                ? step.status === "ahead"
                  ? ""
                  : ABSENT
                : stampOf(step.at)}
            </span>
          </li>
        ))}
      </ul>

      <p className="dsec">facts</p>
      <dl className="kv" data-detail-facts>
        {facts.map((fact) => (
          <div className="kvrow" key={fact.label}>
            <dt data-fact-label={fact.label}>{fact.label}</dt>
            <dd data-fact={fact.label}>{fact.value ?? ABSENT}</dd>
          </div>
        ))}
      </dl>

      <p className="dsec" data-detail-implements-head>
        {`implements · ${keys.length} ${keys.length === 1 ? "key" : "keys"}`}
      </p>
      <div className="frlist" data-detail-implements>
        {keys.length === 0 ? (
          <span className="unknown" data-detail-no-keys>
            the work graph declares no requirement keys for this story
          </span>
        ) : (
          keys.map((key) => (
            <span className="fr" data-fr-chip key={key}>
              {key}
            </span>
          ))
        )}
      </div>
    </>
  );
}
