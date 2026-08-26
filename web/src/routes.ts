/**
 * Route constants for the pane's rooms.
 *
 * 001 R-010 reserved /desk and /showfloor. 005 US2 (FR-009) gives the Showfloor
 * a selection in its URL — `/showfloor/<spec-dir>` — so a chosen epic can be
 * linked, reloaded and shared. The backend needs no route for it: 001's guarded
 * SPA catch-all already answers any path with the shell, behind the same token.
 *
 * 011 US1 adds the review room at `/review/<spec-dir>`, on the same terms: one
 * landed epic per URL, served by the same catch-all and behind the same token
 * (FR-006). **Every path exported here is listed in `route-manifest.json`**, and
 * `tests/unit/routeManifest.test.ts` asserts it — that pair is what FR-005 buys,
 * a manifest that cannot fall behind the rooms in silence.
 */

/** The Desk answers at both; `/` is the one the pane links to. */
export const DESK_ROOT_PATH = "/";
export const DESK_PATH = "/desk";
export const SHOWFLOOR_PATH = "/showfloor";
export const REVIEW_PATH = "/review";

/**
 * The drafting table (014 US1). It is the one room with no bare form: a
 * Showfloor with no selection is still a room, but a drafting table with no
 * spec is a table with nothing on it, so `/draft` alone names no room and the
 * spec directory is part of the address.
 */
export const DRAFT_PATH = "/draft";

/** The deep link for one spec's stage. */
export function showfloorPathFor(specDir: string): string {
  return `${SHOWFLOOR_PATH}/${encodeURIComponent(specDir)}`;
}

/** The deep link for one landed epic's review. */
export function reviewPathFor(specDir: string): string {
  return `${REVIEW_PATH}/${encodeURIComponent(specDir)}`;
}

/** Whether a path is the Showfloor, with or without a selection. */
export function isShowfloorPath(pathname: string): boolean {
  return isUnder(pathname, SHOWFLOOR_PATH);
}

/** Whether a path is the review room, with or without an epic. */
export function isReviewPath(pathname: string): boolean {
  return isUnder(pathname, REVIEW_PATH);
}

/**
 * The spec directory a Showfloor path asks for, or null when it asks for none.
 *
 * A bare `/showfloor` (with or without its trailing slash) is a request for the
 * default selection, not for a spec named by the empty string. Anything after
 * the room's segment is returned whole — a path with further slashes in it is a
 * directory this floor does not have, and FR-009 says a miss is named rather
 * than silently trimmed into a hit.
 */
export function specDirFromPath(pathname: string): string | null {
  return isShowfloorPath(pathname) ? segmentAfter(pathname, SHOWFLOOR_PATH) : null;
}

/**
 * The spec directory a review path asks for, or null when it names none.
 *
 * Read the same way the Showfloor's is, from the same helper: two rooms that
 * parsed one grammar twice would eventually disagree about what `/review/a%2Fb`
 * asks for, and a review room that quietly reviewed a different epic from the
 * one in the URL is the worst thing this room could do.
 */
export function specDirFromReviewPath(pathname: string): string | null {
  return isReviewPath(pathname) ? segmentAfter(pathname, REVIEW_PATH) : null;
}

function isUnder(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

function segmentAfter(pathname: string, root: string): string | null {
  const rest = pathname.slice(root.length).replace(/^\//, "").replace(/\/$/, "");
  if (rest === "") return null;
  try {
    return decodeURIComponent(rest);
  } catch {
    // A malformed escape is not a directory either; it is a miss with its own
    // spelling, and it is shown as the operator typed it.
    return rest;
  }
}

/** The deep link for one spec's drafting table. */
export function draftPathFor(specDir: string): string {
  return `${DRAFT_PATH}/${encodeURIComponent(specDir)}`;
}

/** Whether a path is the drafting table, with or without a spec named. */
export function isDraftPath(pathname: string): boolean {
  return pathname === DRAFT_PATH || pathname.startsWith(`${DRAFT_PATH}/`);
}

/**
 * The spec directory a drafting-table path asks for, or null when it names none.
 *
 * Read the same way `specDirFromPath` reads the Showfloor's, and deliberately so
 * — one grammar for a spec in a URL, not two. What it is *not* is a resolver: a
 * segment with further slashes in it is returned whole, and the backend refuses
 * it as a name that is not a directory name (014 plan D5). The browser never
 * decides what is inside the specs root.
 */
export function specDirFromDraftPath(pathname: string): string | null {
  if (!isDraftPath(pathname)) return null;
  const rest = pathname.slice(DRAFT_PATH.length).replace(/^\//, "").replace(/\/$/, "");
  if (rest === "") return null;
  try {
    return decodeURIComponent(rest);
  } catch {
    // A malformed escape is not a directory either; it is a miss with its own
    // spelling, and it is shown as the operator typed it.
    return rest;
  }
}
