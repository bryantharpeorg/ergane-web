/**
 * TypeScript contract for `GET /api/draft/<spec-dir>` (014 US1).
 *
 * Mirrors what `pane/draft.py`'s `read_trio` returns, field for field. The room
 * renders this one document — the read stamp, the three columns and the
 * degraded well all read it — so the browser joins nothing the backend has not
 * already joined, and no two parts of the view can disagree about what was on
 * disk.
 *
 * Every fact the tree could not supply is `null` on purpose, and null is never
 * defaulted into a number, a dash or a stand-in. That is constitution III's
 * Unknown Rule in a type.
 */

/**
 * One degraded read, in the triple every room in this pane uses, plus the path.
 *
 * `path` is what FR-004 asks the room to name, carried as its own field so the
 * view renders it without parsing it back out of `detail`. It is `null` exactly
 * when no path was formed — a name that is not a single directory name is
 * refused *before* the join, so there is nothing to report having tried.
 */
export interface DraftNote {
  read: string;
  mode: string;
  detail: string;
  path: string | null;
}

/**
 * One document of the trio, as the read found it.
 *
 * Three states, and they are three different facts (FR-002, DESIGN.md § The
 * drafting table):
 *
 * * `present: true, empty: false` — it is there and it has text.
 * * `present: true, empty: true` — it is there and it is empty. A commissioned
 *   `plan.md` nobody has written yet is not the same situation as one that was
 *   never commissioned, and the view says which.
 * * `present: false` — it is not there, `text` is null, and this is **quiet**:
 *   most of this corpus has no `plan.md`, and painting that red would be
 *   constitution III inverted.
 *
 * All three names are always answered for, so absence is a fact the view
 * renders rather than a shorter list it has to infer one from.
 */
export interface DraftDocumentEntry {
  name: string;
  present: boolean;
  empty: boolean;
  text: string | null;
}

/** One spec directory's trio, with the stamp of the read that found it. */
export interface DraftDocument {
  spec_dir: string;
  specs_root: string;
  /** The directory the read tried, or null when the name was refused. */
  path: string | null;
  /**
   * The working-tree revision read, and whether the tree is still that commit.
   *
   * Both null together means *unknown*: the tree had no revision to give — it
   * is not a repository — which is a different fact from a read that failed,
   * and it produces no `degraded` entry. The roadmap hard-resets the operator's
   * checkout every tick (N50), which is why FR-003 exists at all: a render that
   * does not say what it read, and when, is a claim that has quietly expired.
   */
  revision: string | null;
  revision_short: string | null;
  dirty: boolean | null;
  /** The instant of the read, in the shape every recorded document uses. */
  read_at: string;
  /**
   * The trio, in `spec.md`, `plan.md`, `tasks.md` order — or empty.
   *
   * Empty is FR-004: the directory could not be read, so there is no trio. It
   * is never rendered as three absences, because three absences is what a
   * sketch looks like and this is not a sketch.
   */
  documents: DraftDocumentEntry[];
  degraded: DraftNote[];
}
