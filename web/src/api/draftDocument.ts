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
  /**
   * What each of ergane's three exported checkers said, in seam order.
   *
   * A list and never a verdict (FR-009). There is deliberately no field here
   * that totals them: `ergane spec validate` composes five layers into one exit
   * code inside a private CLI handler the distribution does not export, so the
   * pane cannot obtain that verdict and must not compose one of its own.
   */
  checks: DraftCheck[];
  /** The compiled graph, or null when there is none (US3 draws it). */
  graph: DraftGraph | null;
  /** The sentence that stands where a verdict would, required on screen by FR-009. */
  verdict_unavailable: string;
}

/**
 * One thing a checker said, in its own words (014 US2).
 *
 * `detail` is the seam's own `__str__` and is never a paraphrase: an operator
 * handed a summary of a refusal has been handed a description of the defect
 * instead of the defect. The structured fields ride beside it so the view can
 * render the coordinates without parsing them back out of the sentence.
 *
 * `informational` is the **seam's** field, not the pane's. `check_slice_coverage`
 * marks a task that reaches no node and names no story as "expected in a setup or
 * verification phase the operator works by hand, a defect anywhere else"; the
 * room states those and never counts them, exactly as the seam asks.
 */
export interface DraftCheckFinding {
  detail: string;
  informational: boolean;
  /** The trio document at fault, when the checker named one. */
  document: string | null;
  /** The node whose prompt would not assemble, when the finding belongs to one. */
  node_id: string | null;
  task_ids: string[];
  story_key: string | null;
}

/**
 * The three answers a check may carry (DESIGN.md § The drafting table).
 *
 * `not_run` is the one this room needed and the eleven-state glyph grammar does
 * not have, because that grammar describes *work* and this describes a check.
 * It means an input was missing — never a failure the spec earned (FR-010).
 */
export type DraftCheckState = "passed" | "refused" | "not_run";

/**
 * One exported checker's answer, under the name of the function that gave it.
 *
 * `check` is the function's own name and `seam` its import path, which is what
 * FR-006 and FR-008 mean by attribution: an answer under a label this repository
 * invented would be the pane's answer wearing a seam's clothes.
 *
 * Exactly one of `detail` and `not_run_because` carries the row's sentence,
 * and which one it is follows from `state`. They are two fields rather than one
 * because they are two different kinds of claim — what a checker said, and why
 * no checker was asked.
 */
export interface DraftCheck {
  check: string;
  seam: string;
  state: DraftCheckState;
  detail: string | null;
  not_run_because: string | null;
  findings: DraftCheckFinding[];
}

/** One node of a compiled graph, as `workgraph.json` holds it. */
export interface DraftGraphNode {
  id: string;
  story_key: string;
  persona: string;
  spec_ref: string;
  requirement_keys: string[];
  depends_on: string[];
  depends_on_merged: string[];
  timeout_override_s: number | null;
}

/** An ordering edge the deriver added that nobody wrote (069-US2). */
export interface DraftGraphInferredEdge {
  node_id: string;
  depends_on_merged: string;
  shared_files: string[];
  reason: string;
}

/**
 * The compiled Work Graph — the deriver's result, carried rather than described.
 *
 * The same shape `ergane spec derive` writes to `workgraph.json`, because it is
 * that value serialized. `null` on the document means the graph does not exist,
 * and FR-013 draws no stage for one: an empty stage is a claim about a graph.
 */
export interface DraftGraph {
  epic_id: string;
  feature: string;
  specs_root: string;
  target_repo: string;
  nodes: DraftGraphNode[];
  inferred_edges: DraftGraphInferredEdge[];
}
