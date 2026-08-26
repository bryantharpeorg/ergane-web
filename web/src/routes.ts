/**
 * Route constants for the pane's two rooms.
 *
 * 001 R-010 reserved /desk and /showfloor. 005 US2 (FR-009) gives the Showfloor
 * a selection in its URL — `/showfloor/<spec-dir>` — so a chosen epic can be
 * linked, reloaded and shared. The backend needs no route for it: 001's guarded
 * SPA catch-all already answers any path with the shell, behind the same token.
 */

/** The Desk answers at both; `/` is the one the pane links to. */
export const DESK_ROOT_PATH = "/";
export const DESK_PATH = "/desk";
export const SHOWFLOOR_PATH = "/showfloor";

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

/** Whether a path is the Showfloor, with or without a selection. */
export function isShowfloorPath(pathname: string): boolean {
  return pathname === SHOWFLOOR_PATH || pathname.startsWith(`${SHOWFLOOR_PATH}/`);
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
  if (!isShowfloorPath(pathname)) return null;
  const rest = pathname.slice(SHOWFLOOR_PATH.length).replace(/^\//, "").replace(/\/$/, "");
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
