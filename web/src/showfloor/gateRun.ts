/**
 * How a recorded gate run is read — the four pure readings behind the section.
 *
 * `GateRun.tsx` draws; this file decides what there is to draw. Nothing here
 * derives a fact the factory did not record: every function below is a
 * *reading* of `factory.verify.store`'s own columns, in the sense the room
 * already uses for the ladder — the backend has joined, and the browser dresses
 * (plan D2).
 *
 * ## Concurrency is data, not layout taste (013 D5, FR-005)
 *
 * `concurrent_gates` is the store's contention marker: how many **other** gate
 * executions were in flight when this one ran. Zero means the gate had the
 * host's gate budget to itself; a non-zero count means it ran alongside peers,
 * which is what makes a slow verdict auditable rather than a mystery.
 *
 * `gateBands` groups on that count and on nothing else. The alternative —
 * inferring parallelism from overlapping durations — is the thing D5 forbids,
 * and it is wrong in both directions: two gates that each took ten seconds may
 * have run one after the other, and a four-tenths-of-a-second gate may have run
 * beside a ten-minute one. The unit tests hold both of those cases against this
 * function precisely because a duration-reading implementation would agree with
 * it on every ordinary run and disagree on those two.
 *
 * A band closes at `count + 1` members. Two pairs that ran one after the other
 * each record `1`, and a grouping that only asked "same count?" would draw one
 * band of four — overstating the parallelism the host actually had, which is
 * the same class of mistake as inventing it from durations.
 */

import type { GateRecord } from "../api/showfloorDocument";
import { formatDuration } from "./Stage";

/** One stretch of the run: gates the store recorded as having run together. */
export interface GateBand {
  /** True when the store recorded contention for these gates. */
  concurrent: boolean;
  /** The count it recorded, verbatim — null when it recorded none. */
  recorded: number | null;
  gates: GateRecord[];
}

/** The recorded contention count, or null where the store carried none. */
function recordedCount(gate: GateRecord): number | null {
  return typeof gate.concurrent_gates === "number" ? gate.concurrent_gates : null;
}

/** The run, split into the bands the store says it ran in. See the header. */
export function gateBands(gates: GateRecord[]): GateBand[] {
  const bands: GateBand[] = [];

  for (const gate of gates) {
    const count = recordedCount(gate);
    const open = bands[bands.length - 1];
    const joins =
      open !== undefined &&
      count !== null &&
      count > 0 &&
      open.recorded === count &&
      open.gates.length < count + 1;

    if (joins) {
      open.gates.push(gate);
      continue;
    }
    bands.push({ concurrent: count !== null && count > 0, recorded: count, gates: [gate] });
  }

  return bands;
}

/**
 * What a band says about itself, or null when it claims nothing.
 *
 * DESIGN.md § Named Rules: "state is never colour alone". A bracket drawn round
 * two gates is a shape, and a shape is not a word — so a band that means
 * anything says it. A band of one whose gate still recorded peers says what was
 * recorded rather than what can be drawn: the count is the store's word and
 * this room does not correct it.
 */
export function bandLabel(band: GateBand): string | null {
  if (!band.concurrent) return null;
  if (band.gates.length > 1) return `${band.gates.length} gates ran together`;
  const others = band.recorded ?? 0;
  return `ran beside ${others} other ${others === 1 ? "gate" : "gates"}`;
}

/**
 * One gate's duration, as the room says it.
 *
 * Above a minute this is § Stage's own `formatDuration`, because a duration is
 * a duration and the room should have one word for one thing. Below a minute it
 * keeps the tenth the store recorded: `formatDuration` rounds to whole seconds,
 * and a gate that ran for four tenths of a second would report `0s` — an
 * absence the factory did not record (§ The Unknown Rule's neighbour, § Don'ts).
 */
export function formatGateDuration(seconds: number | null): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return formatDuration(seconds);
}

/**
 * The seconds one **verification** took, or null when the store bracketed none.
 *
 * The name is the whole point. `AttemptTiming`'s own docstring in ergane says
 * that `started_at`/`finished_at` bracket one verification and that the
 * dispatch-to-verification-start interval and the merge-queue time "are not in
 * this table at all" — so a caller reporting this interval as anything wider is
 * reporting something the store cannot support. `ergane status` gets this right
 * ("verified in 1m02s") and the section matches it.
 *
 * A finish before its start is not an interval: the pane says nothing rather
 * than a negative number or the absolute value of one.
 */
export function verificationSeconds(
  started: string | null,
  finished: string | null,
): number | null {
  if (started === null || finished === null) return null;
  const from = Date.parse(started);
  const to = Date.parse(finished);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null;
  return (to - from) / 1000;
}

/**
 * A gate's outcome in one phrase: the store's status word, and its exit code.
 *
 * The exit code rides the outcome rather than taking a column of its own, which
 * would stand empty for every gate that hit its deadline or never ran. It is
 * shown wherever it says something the status does not: a `PASS` exited `0` by
 * construction, so the number is silent there and present everywhere else —
 * including on the contradictory row the store could hold, a `PASS` with a
 * non-zero exit, which is the factory's record and not this room's to tidy.
 *
 * Null when the store recorded no status: an exit code is not an outcome, and
 * the room says `unknown` rather than promoting one into the other.
 */
export function gateOutcome(gate: GateRecord): string | null {
  if (gate.status === null || gate.status === "") return null;
  const code = gate.exit_code;
  if (typeof code !== "number") return gate.status;
  if (gate.status === "PASS" && code === 0) return gate.status;
  return `${gate.status} · exit ${code}`;
}
