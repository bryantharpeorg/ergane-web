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
