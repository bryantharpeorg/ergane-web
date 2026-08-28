/**
 * TypeScript contract for `GET /api/draft` — the corpus, not one spec (018 US1).
 *
 * Mirrors what `pane/draft_index.py`'s `read_corpus` returns, field for field.
 * It is a second document rather than a widening of `DraftDocument`
 * (018 plan D1): the trio answers *what does `specs/<dir>/` hold* and this
 * answers *what does the corpus hold*, and one shape with two meanings is how a
 * room comes to render a spec's absence as an empty corpus.
 *
 * The degraded note is deliberately the trio's own `DraftNote` and not a second
 * spelling of the same four fields — one room, one vocabulary for a read that
 * could not be made (constitution III).
 */

import type { DraftNote } from "./draftDocument";

export type { DraftNote };

/**
 * One spec of the corpus: its directory, and the state it declared.
 *
 * `state` is a bare string on purpose. `factory.roadmap.models.read_roadmap`
 * owns that grammar — it is the seam that defaults an undeclared spec to
 * `draft` and rejects a word its `SpecState` does not name — so a union typed
 * here would be this repository holding a second opinion about the vocabulary,
 * and it would be the stale one on the day ergane adds a state. What the room
 * does with a word § Chips does not name is show it under the Unknown Rule,
 * which is a rendering decision and lives in the view.
 */
export interface DraftIndexEntry {
  spec_dir: string;
  state: string;
}

/** The corpus as one read found it, with the stamp of that read. */
export interface DraftIndexDocument {
  specs_root: string;
  /**
   * The working-tree revision read, and whether the tree is still that commit.
   *
   * Both null together means *unknown* — the tree is not a repository — which
   * is 014's ruling, inherited rather than re-taken (018 plan D3), and it is a
   * different fact from a read that failed: it produces no `degraded` entry.
   */
  revision: string | null;
  revision_short: string | null;
  dirty: boolean | null;
  /** The instant of the read, in the shape every recorded document uses. */
  read_at: string;
  /**
   * Every spec directory, in `read_roadmap`'s order — or empty.
   *
   * Empty means one of two things and the second fact is what tells them apart:
   * with no `degraded` note it is a corpus that genuinely holds no specs, and
   * with one it is a corpus that could not be read. The view must never render
   * either as the other (FR-005).
   */
  specs: DraftIndexEntry[];
  degraded: DraftNote[];
}
