/**
 * TypeScript contract for `GET /api/showfloor` and the SSE `showfloor` event.
 *
 * Mirrors what `pane/showfloor.py`'s `assemble_showfloor` returns, field for
 * field (005 US1). The room renders this one document — rail, stage and detail
 * pane all read it — so the browser never joins anything the backend already
 * joined, and card, rail and pane cannot disagree about a stop (plan D2).
 *
 * Every live fact is nullable on purpose: an undispatched spec has no answer to
 * read, and a read that failed is named in `notes` rather than defaulted to a
 * number. Nothing here invents a shape the assembler does not emit.
 */

/** One of the six stops, with the status the backend derived for it. */
export interface LadderStop {
  key: string;
  label: string;
  status: "done" | "active" | "waiting" | "ahead" | "frozen";
  /**
   * The instant the factory recorded for this stop, or null for none.
   *
   * 009 FR-002a: the landing branch holds a commit date for `merged` and
   * nothing holds one for the five stops before it, so this is filled there and
   * null elsewhere. Null is the absence, never a zero and never a stand-in
   * time — the pane says `—` for it rather than borrowing another stop's clock.
   */
  at: string | null;
}

/** One story's whole ladder, derived server-side from DESIGN.md's table. */
export interface Ladder {
  state: string | null;
  spec_state: string | null;
  stops: LadderStop[];
  stop: string | null;
  stop_key: string | null;
  tone: "normal" | "waiting" | "done" | "terminal" | "unknown";
  /** The chip's word — the same object the rail and the card both read. */
  chip: string | null;
  frozen: boolean;
  terminal_reason: string | null;
  awaiting_operator: boolean;
}

/**
 * One gate command's outcome, as `factory.verify.store` recorded it (013 FR-001).
 *
 * `exit_code` is null exactly when there was no exit to read — the command hit
 * its deadline or never ran — which is the store's own meaning and not a zero
 * standing in for it. `concurrent_gates` is how many *other* gate executions
 * were in flight beside this one; a timeline draws concurrency from this count
 * and never from the durations (013 D5, FR-005).
 *
 * `output_tail` is the last of the command's combined output, and it arrives
 * under two rules the assembler has already applied (013 D4, FR-006/FR-007):
 * it is **non-null only for a gate that did not pass** — a passing gate's tail
 * never leaves the backend, so the room cannot render one by accident — and
 * what is here has been through `pane/sweep.py`, the same credential sweep
 * every committed file in this repository passes. The room's job is to keep it
 * collapsed; it is not the room's job to decide whether it may be shown.
 */
export interface GateRecord {
  name: string | null;
  command: string | null;
  status: string | null;
  exit_code: number | null;
  duration_s: number | null;
  concurrent_gates: number | null;
  output_tail: string | null;
}

/** The judge's call on one dispatched scenario, with its reasoning. */
export interface JudgeFinding {
  scenario: string | null;
  passed: boolean | null;
  reasoning: string | null;
}

/** One bounded judge invocation, as the attempt's row recorded it. */
export interface JudgeRecord {
  outcome: string | null;
  feedback: string | null;
  judge_attempt: number | null;
  truncated_input: boolean | null;
  /**
   * The *judge's* persona-registry alias, recorded by the run that used it.
   * Never the attempt's model, which nothing records — the two are different
   * facts and the key says which one this is (013 FR-003).
   */
  model_alias: string | null;
  findings: JudgeFinding[];
}

/** The anti-rubber-stamp check: did the node actually produce something? */
export interface OutputCheckRecord {
  write_scope: string | null;
  has_diff: boolean | null;
  expected_artifacts: string[];
  artifacts_present: boolean | null;
  passed: boolean | null;
  hygiene_violations: Array<Record<string, unknown>>;
  size_refusal: Record<string, unknown> | null;
}

/**
 * One recorded verification of one story — one attempt's whole evidence bundle.
 *
 * `started_at`/`finished_at` bracket **one verification**, not one story:
 * `AttemptTiming`'s docstring in ergane says the dispatch-to-verification-start
 * interval and the merge-queue time are not in that table at all. Anything
 * rendering the interval labels it *verification*, never wall clock.
 *
 * `model` and `persona` are always null and always named in `unknown`. The
 * store carries neither, and the persona registry is not asked: the DEBUGGER
 * rung relabels the persona without re-resolving `model_alias`, so the registry
 * disagrees with reality on precisely the escalated attempt an operator is
 * reading (013 D2, FR-003).
 */
export interface AttemptRecord {
  attempt: number | null;
  form: string | null;
  verdict: string | null;
  started_at: string | null;
  finished_at: string | null;
  provenance: string | null;
  /** The ladder the attempt ran under, one line, as ergane wrote it. */
  loop_summary: string | null;
  loop_digest: string | null;
  judge_unavailable: boolean;
  criteria_drift: boolean;
  spec_ref: string | null;
  gates: GateRecord[];
  output_check: OutputCheckRecord;
  /** Null when the judge never ran — a different fact from a judge that failed. */
  judge: JudgeRecord | null;
  model: null;
  persona: null;
  /** What the store does not carry, named rather than left blank. */
  unknown: string[];
}

/**
 * One story's gate run, and its own degradation (013 FR-001, FR-002).
 *
 * An empty `attempts` with a null `note` is an answer, not an absence of one:
 * this story has no recorded verification, and the room renders no section at
 * all for it rather than an empty frame (FR-010). A `note` is the read that
 * could not be made, in the room's own triple — and it stays *in* this section:
 * nothing about a store the pane cannot open changes the ladder, the facts, or
 * any other spec on the rail.
 */
export interface StoryEvidence {
  attempts: AttemptRecord[];
  note: RailNote | null;
}

export interface ShowfloorStory {
  id: string | null;
  story_key: string | null;
  title: string;
  priority: string | null;
  intent: string;
  requirement_keys: string[];
  depends_on: string[];
  depends_on_merged: string[];
  ladder: Ladder;
  /** The live fields of the `epic_status` answer, absences kept as null. */
  facts: Record<string, unknown>;
  /** The live fields the answer did not carry, named rather than defaulted. */
  unknown: string[];
  /** What the factory recorded about this story's attempts (013 US1). */
  evidence: StoryEvidence;
}

/** One read that failed, in 001's words: transport and refusal told apart. */
export interface RailNote {
  read: string;
  mode: string;
  detail: string;
}

export interface RailEntry {
  spec_dir: string;
  name: string;
  /**
   * The spec's own goal — one paragraph, for the band under the stage (009
   * US4, FR-010).
   *
   * `pane/showfloor.py` lifts it from the body's `## Context` heading, or
   * `## Sketch` for a spec still unrefined. Always a string, never null: `""`
   * is the spec stating no goal, and the room renders no band for it at all
   * rather than an empty one (FR-011, D-019).
   */
  intent: string;
  state: string | null;
  /** The epic's word, from DESIGN.md's chip vocabulary; null when unstated. */
  chip: string | null;
  stories_landed: number;
  stories_total: number;
  epic_id: string | null;
  epic_state: string | null;
  stories: ShowfloorStory[];
  story_source: string;
  notes: RailNote[];
  unknown: string[];
}

export interface ShowfloorDocument {
  reference_instant: string | null;
  specs_root: string;
  rail: RailEntry[];
  degraded: Array<RailNote & { spec_dir: string | null }>;
}
