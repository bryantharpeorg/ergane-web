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
