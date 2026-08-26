/**
 * TypeScript contract for `GET /api/review/<spec-dir>` (011 US1).
 *
 * Mirrors what `pane/review.py`'s `assemble_review` returns, field for field.
 * The room renders this one document — the what-changed track reads nothing
 * else — so the browser joins nothing the backend already joined, and no route
 * is resolved twice with two answers.
 *
 * **Three answers, and they are different things.** A document is an epic the
 * landing branch carries whole. A *refusal* is an epic it does not (FR-004):
 * the backend answers 409 and names the unmerged stories, and the room renders
 * that sentence rather than half a review. A *miss* is a spec directory this
 * corpus does not have. Collapsing any of the three into "no data" would be the
 * pane telling the operator it looked when it did not (constitution III).
 */

/** One read the backend could not make, in 001's two words. */
export interface ReviewNote {
  read: string;
  mode: string;
  detail: string;
}

/**
 * One file a landing commit changed, with the routes it reaches.
 *
 * `matched` is the difference between a file the manifest maps to nothing and a
 * file the manifest does not know about. Both reach no known route; only the
 * second is evidence the manifest has fallen behind the tree, and the room says
 * which it is looking at (FR-003).
 */
export interface ReviewFile {
  path: string;
  routes: string[];
  matched: boolean;
}

/** One story of the epic, as the landing branch holds it. */
export interface ReviewStory {
  story_key: string;
  title: string;
  priority: string | null;
  /** The landing SHA, whole; `short_commit` is the same SHA cut once, server-side. */
  commit: string | null;
  short_commit: string | null;
  pr_number: number | null;
  subject: string | null;
  merged_at: string | null;
  /** `observed` or `historical` — the branch's own word for how it was placed. */
  kind: string | null;
  files: ReviewFile[];
  /** Every route this story's whole change reaches, in the manifest's order. */
  routes: string[];
  /** The facts the branch did not supply, named rather than defaulted to a dash. */
  unknown: string[];
  notes: ReviewNote[];
}

/** One route the epic reaches, and the stories that reach it. */
export interface ReviewRoute {
  path: string;
  /** `room` is a screen an operator can look at; `api` and `shell` are not. */
  kind: string | null;
  name: string | null;
  stories: string[];
}

export interface ReviewDocument {
  spec_dir: string;
  name: string;
  landing_branch: string | null;
  /** `workgraph` or `spec.md` — where the story identity was read. */
  story_source: string;
  stories: ReviewStory[];
  routes: ReviewRoute[];
  notes: ReviewNote[];
}

/** One story the branch does not carry, as the refusal names it. */
export interface UnmergedStory {
  story_key: string;
  title: string;
}

/** The 409: an epic that has not landed whole, refused by name (FR-004). */
export interface ReviewRefusal {
  error: string;
  spec_dir: string;
  landing_branch: string | null;
  unmerged: UnmergedStory[];
  detail: string;
}

export type ReviewAnswer =
  | { kind: "document"; document: ReviewDocument }
  | { kind: "refusal"; refusal: ReviewRefusal }
  | { kind: "miss"; specDir: string }
  | { kind: "unread"; status: number };

/**
 * Read one epic's review document.
 *
 * A bare GET of the one route this room reads, with no init and no request
 * method spelt anywhere — the review room takes no verb (constitution I), and
 * `tests/unit/noVerb.test.ts` is what holds it to that.
 */
export async function readReview(specDir: string): Promise<ReviewAnswer> {
  let response: Response;
  try {
    response = await fetch(`/api/review/${encodeURIComponent(specDir)}`);
  } catch {
    return { kind: "unread", status: 0 };
  }

  if (response.status === 404) return { kind: "miss", specDir };
  if (response.status === 409) {
    return { kind: "refusal", refusal: (await response.json()) as ReviewRefusal };
  }
  if (!response.ok) return { kind: "unread", status: response.status };
  return { kind: "document", document: (await response.json()) as ReviewDocument };
}
