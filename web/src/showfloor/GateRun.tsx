/**
 * The gate run, as the timeline it already was (013 US2, FR-004…FR-008).
 *
 * Four gates ran for every attempt this factory has ever made, each with the
 * command that ran, whether it passed, what it exited with, how long it took
 * and whether it ran beside another. Nothing has ever drawn them. This is that
 * drawing, and it is a *reading* of `factory.verify.store`'s own record: US1
 * put the whole bundle on the story as `evidence`, and this section renders it
 * without asking the factory a second question.
 *
 * ## What it is called, and what it is not
 *
 * **The gate run.** Not the pipeline, and above all not CI: these are the gates
 * ergane ran inside its own sandbox at the verification boundary. The forge ran
 * its own checks on the merge ref, they are a different record, and the two can
 * disagree — that divergence rejected a landing in this very epic. A heading
 * that said CI would be this pane claiming a record it has never read (013
 * plan, trap 2; PR-4 is the ask that would let it be more).
 *
 * **And it is the current record, said out loud** (FR-008, 013 D3). Every row
 * here is overwritten when the story is re-dispatched — ergane keeps one row
 * per `(epic, node, attempt, form)` — so two attempts shown today may be one
 * attempt tomorrow. Constitution III is about degrading honestly on a read that
 * failed; `RETENTION` is the same doctrine turned on the pane's own retention,
 * which is the one thing a section like this is tempted to imply and cannot
 * keep. When ergane's durable store (N47/PR-1) lands, this becomes a history
 * with no redesign and that sentence is what changes.
 *
 * ## The vocabulary is the detail pane's
 *
 * No new chip, no new colour, no new radius (constitution VIII): the section is
 * the pane's `dsec` kicker, its named-step treatment for the gates, its `unknown`
 * italic for what the store did not record, and the room's degraded well for a
 * read that failed. The one element that is new in kind is the disclosure a
 * failing gate's output hides behind — a fold, which is the Desk's own idiom for
 * "expired is a fact, not an emergency", pointed at the same job here.
 *
 * ## The tail
 *
 * A failing gate's output arrives already guarded: the assembler drops a
 * passing gate's entirely and puts what is left through `pane/sweep.py` before
 * the document is built (013 D4, FR-006/FR-007). So this file has one job with
 * it and only one — keep it collapsed, and render it as *text*. It is output
 * nobody in this repository wrote and nobody here has read; it reaches the page
 * as the content of one element and never as markup, and this room does not get
 * to form a second, weaker opinion about what a credential looks like.
 */

import type { AttemptRecord, GateRecord, RailNote, StoryEvidence } from "../api/showfloorDocument";
import { formatDuration } from "./Stage";
import {
  bandLabel,
  formatGateDuration,
  gateBands,
  gateOutcome,
  verificationSeconds,
  type GateBand,
} from "./gateRun";

/**
 * What the section says about its own record (FR-008).
 *
 * Exported so the assertion and the page cannot drift apart: a test that
 * matched a paraphrase would pass over a sentence that had quietly stopped
 * saying it.
 */
export const RETENTION =
  "The current dispatch's record. A re-dispatch overwrites these rows, so nothing here survives one.";

/** The word for a fact the factory did not record (§ The Unknown Rule). */
function Unknown(): JSX.Element {
  return <span className="unknown">unknown</span>;
}

interface GateRunProps {
  /** The story's whole evidence section, exactly as the document carries it. */
  evidence: StoryEvidence;
}

/**
 * The section, or nothing at all.
 *
 * An empty `attempts` with no note is the document's word for a story the
 * evidence store has never recorded a verification of — an answer, not a
 * failure — and § Don'ts is against rendering an element that can never fill.
 * A note with no attempts is the other case: the read did not happen, and
 * saying so is the section's whole job for that story (FR-002).
 */
export default function GateRun({ evidence }: GateRunProps): JSX.Element | null {
  const attempts = evidence.attempts;
  if (attempts.length === 0 && evidence.note === null) return null;

  return (
    <section className="gaterun" data-gate-run>
      <p className="dsec" data-gate-run-head>
        gate run
      </p>
      <p className="grsaid" data-gate-run-retention>
        {RETENTION}
      </p>
      {evidence.note === null ? null : <ReadFailed note={evidence.note} />}
      {attempts.map((attempt, index) => (
        <Attempt key={attempt.attempt ?? index} attempt={attempt} />
      ))}
    </section>
  );
}

/**
 * The read that could not be made, in the room's own triple and in its own well.
 *
 * Transport and refusal are two different failure modes and are told apart in
 * the attribute as well as in the prose (constitution III, ergane's 052): a
 * store the pane could not open is a deployment fact, and a store that answered
 * with a refusal is a schema fact. Neither costs the operator anything but this
 * section — the ladder, the facts and every other spec on the rail are
 * untouched, because the assembler caught the failure at the one story it
 * belongs to.
 */
function ReadFailed({ note }: { note: RailNote }): JSX.Element {
  const refused = note.mode === "refusal";
  return (
    <div className="degraded" role="status" data-gate-run-note data-mode={note.mode}>
      <p className="lead">
        {refused ? "The gate run refused its query." : "The gate run could not be read."}
      </p>
      <p>
        The read <span className="read num">{note.read}</span>{" "}
        {refused ? "answered with a refusal" : "failed before the store answered"}:{" "}
        <span className="detail num">{note.detail}</span>. Shown as unavailable, not hidden.
      </p>
    </div>
  );
}

/** One recorded verification: what it was, what it ran under, what ran. */
function Attempt({ attempt }: { attempt: AttemptRecord }): JSX.Element {
  const bands = gateBands(attempt.gates);

  return (
    <article className="attempt" data-gate-attempt={attempt.attempt ?? ""}>
      <p className="ahead">
        <span className="anum" data-attempt-number>
          {attempt.attempt === null ? <Unknown /> : `attempt ${attempt.attempt}`}
        </span>
        <span className="averdict" data-attempt-verdict data-verdict={attempt.verdict ?? ""}>
          {attempt.verdict === null ? <Unknown /> : attempt.verdict}
        </span>
        <Verification attempt={attempt} />
      </p>

      {/* The ladder the attempt ran under, one line, as ergane composed it —
          "attempt 2 of 3 with the debugger rung at 1" is the context that makes
          a failing gate legible. The factory's sentence, never abridged. */}
      {attempt.loop_summary === null ? null : (
        <p className="aloop" data-attempt-loop>
          {attempt.loop_summary}
        </p>
      )}

      {attempt.gates.length === 0 ? (
        <p className="aloop">
          <span className="unknown">this attempt recorded no gate</span>
        </p>
      ) : (
        <ol className="bands">
          {bands.map((band, index) => (
            <Band key={index} band={band} />
          ))}
        </ol>
      )}
    </article>
  );
}

/**
 * How long the **verification** took — and never a word wider than that.
 *
 * The interval `started_at`/`finished_at` brackets is one verification, not one
 * story: ergane's own `AttemptTiming` docstring says the
 * dispatch-to-verification-start interval and the merge-queue time are not in
 * that table at all. The label is what keeps the number honest, so the label is
 * part of the element rather than a heading somewhere above it. The two
 * instants stay on the `title` in the factory's own UTC — nothing is withheld,
 * and nothing is restated through the reader's clock.
 */
function Verification({ attempt }: { attempt: AttemptRecord }): JSX.Element {
  const seconds = verificationSeconds(attempt.started_at, attempt.finished_at);
  const bracket =
    attempt.started_at !== null && attempt.finished_at !== null
      ? `${attempt.started_at} → ${attempt.finished_at}`
      : undefined;

  return (
    <span className="averify" data-attempt-verification title={bracket}>
      {"verification "}
      {seconds === null ? <Unknown /> : formatDuration(seconds)}
    </span>
  );
}

/**
 * One stretch of the run the store recorded as having run together.
 *
 * The band is drawn *and* named: a bracket is a shape, and DESIGN.md § Named
 * Rules says state is never carried by a shape or a colour alone. A gate that
 * had the host to itself is a band of one that claims nothing — no head, no
 * bracket, just the gate.
 */
function Band({ band }: { band: GateBand }): JSX.Element {
  const label = bandLabel(band);

  return (
    <li className="band" data-gate-band={band.concurrent ? "concurrent" : "serial"}>
      {label === null ? null : (
        <p className="bandhead" data-band-head>
          {label}
        </p>
      )}
      <ul className="gates">
        {band.gates.map((gate, index) => (
          <Gate key={`${gate.name ?? "gate"}-${index}`} gate={gate} />
        ))}
      </ul>
    </li>
  );
}

/** One gate command: the four facts FR-004 names, and its output on failure. */
function Gate({ gate }: { gate: GateRecord }): JSX.Element {
  const outcome = gateOutcome(gate);
  const duration = formatGateDuration(gate.duration_s);

  return (
    <li
      className="gate"
      data-gate={gate.name ?? ""}
      data-gate-status={gate.status ?? ""}
      data-concurrent-gates={gate.concurrent_gates ?? ""}
    >
      <span className={`gdot ${toneOf(gate.status)}`} aria-hidden="true" />
      <span className="gname" data-gate-name>
        {gate.name === null ? <Unknown /> : gate.name}
      </span>
      <span className={`gout ${toneOf(gate.status)}`} data-gate-outcome>
        {outcome === null ? <Unknown /> : outcome}
      </span>
      <span className="gdur" data-gate-duration>
        {duration === null ? <Unknown /> : duration}
      </span>
      <code className="gcmd" data-gate-command>
        {gate.command === null ? <Unknown /> : gate.command}
      </code>
      {gate.output_tail === null ? null : <Tail tail={gate.output_tail} />}
    </li>
  );
}

/**
 * The gate's tone: § Chips' semantic hues, used as ink and not as a chip.
 *
 * `PASS` is olive because a green gate is a done thing; every other recorded
 * status is alarm, because every other status failed the verification. A status
 * the store did not record takes neither — an absence is not a failure. The
 * word is always beside it, so the hue is never the state.
 */
function toneOf(status: string | null): string {
  if (status === null || status === "") return "";
  return status === "PASS" ? "ok" : "bad";
}

/**
 * The output, folded shut.
 *
 * Closed by default and never opened by the room: this is evidence for a
 * failure, not something the pane pushes at an operator who came to read a
 * ladder. `<details>` is a disclosure and not a control — the Showfloor's one
 * `<button>` is the node card's, and the constitution's one verb is the Desk's
 * (constitution I).
 *
 * `<pre>` because process output is already laid out: a tail reflowed as prose
 * loses the column a stack trace or a diff is written in.
 */
function Tail({ tail }: { tail: string }): JSX.Element {
  return (
    <details className="tail">
      <summary>output tail</summary>
      <pre className="tailtext" data-gate-tail>
        {tail}
      </pre>
    </details>
  );
}
