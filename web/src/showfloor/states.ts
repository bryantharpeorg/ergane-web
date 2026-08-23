/**
 * State vocabulary and style map for the Showfloor.
 *
 * DESIGN.md § State Chevrons and Stations, § Colors.
 * The pane has one palette; dark entries name the same tokens until DESIGN.md
 * defines a dark palette (D-012 governance).
 */

export const NODE_STATES = [
  "PENDING",
  "KEY_ISSUED",
  "RUNNING",
  "VERIFYING",
  "PASSED",
  "PR_OPEN",
  "ENQUEUED",
  "MERGED",
  "FAILED",
  "KILLED",
  "WAITING_OPERATOR",
] as const;

export type NodeState = (typeof NODE_STATES)[number];

export const LIVE_STATES: ReadonlySet<string> = new Set([
  "KEY_ISSUED",
  "RUNNING",
  "VERIFYING",
  "PASSED",
  "PR_OPEN",
  "ENQUEUED",
  "WAITING_OPERATOR",
]);

export const LANDING_STAGES: ReadonlySet<string> = new Set([
  "PASSED",
  "PR_OPEN",
  "ENQUEUED",
  "MERGED",
]);

export type Theme = "light" | "dark";

export type Glyph =
  | "dashed"
  | "hatched"
  | "solid"
  | "half"
  | "most"
  | "crossed"
  | "bell"
  | "filled";

export interface StateStyle {
  glyph: Glyph;
  fill: string;
  stroke: string;
  ink: string;
  caption: string;
}

const PENDING_LIGHT: StateStyle = {
  glyph: "dashed",
  fill: "transparent",
  stroke: "var(--aqua-ink)",
  ink: "var(--aqua-ink)",
  caption: "pending",
};

const KEY_ISSUED_LIGHT: StateStyle = {
  glyph: "hatched",
  fill: "var(--panel)",
  stroke: "var(--aqua-ink)",
  ink: "var(--aqua-ink)",
  caption: "key issued",
};

const RUNNING_LIGHT: StateStyle = {
  glyph: "solid",
  fill: "var(--teal)",
  stroke: "var(--teal-ink)",
  ink: "var(--teal-ink)",
  caption: "running",
};

const VERIFYING_LIGHT: StateStyle = {
  glyph: "solid",
  fill: "var(--mustard)",
  stroke: "var(--mustard-ink)",
  ink: "var(--mustard-ink)",
  caption: "verifying",
};

const PASSED_LIGHT: StateStyle = {
  glyph: "dashed",
  fill: "transparent",
  stroke: "var(--olive)",
  ink: "var(--olive-ink)",
  caption: "passed",
};

const PR_OPEN_LIGHT: StateStyle = {
  glyph: "half",
  fill: "var(--olive)",
  stroke: "var(--olive)",
  ink: "var(--olive-ink)",
  caption: "pr open",
};

const ENQUEUED_LIGHT: StateStyle = {
  glyph: "most",
  fill: "var(--olive)",
  stroke: "var(--olive)",
  ink: "var(--olive-ink)",
  caption: "enqueued",
};

const MERGED_LIGHT: StateStyle = {
  glyph: "filled",
  fill: "var(--olive)",
  stroke: "var(--olive-ink)",
  ink: "var(--olive-ink)",
  caption: "merged",
};

const FAILED_LIGHT: StateStyle = {
  glyph: "crossed",
  fill: "var(--panel)",
  stroke: "var(--ink)",
  ink: "var(--ink)",
  caption: "failed",
};

const KILLED_LIGHT: StateStyle = {
  glyph: "solid",
  fill: "var(--panel-deep)",
  stroke: "var(--ink-soft)",
  ink: "var(--ink-soft)",
  caption: "killed",
};

const WAITING_OPERATOR_LIGHT: StateStyle = {
  glyph: "bell",
  fill: "var(--orange)",
  stroke: "var(--orange-ink)",
  ink: "var(--orange-ink)",
  caption: "waiting on you",
};

function sameInDark(style: StateStyle): StateStyle {
  // The pane has one palette today. When DESIGN.md names a dark palette,
  // replace this helper with per-state dark values; the shape stays.
  return style;
}

export const STATE_STYLES: Record<NodeState, Record<Theme, StateStyle>> = {
  PENDING: { light: PENDING_LIGHT, dark: sameInDark(PENDING_LIGHT) },
  KEY_ISSUED: { light: KEY_ISSUED_LIGHT, dark: sameInDark(KEY_ISSUED_LIGHT) },
  RUNNING: { light: RUNNING_LIGHT, dark: sameInDark(RUNNING_LIGHT) },
  VERIFYING: { light: VERIFYING_LIGHT, dark: sameInDark(VERIFYING_LIGHT) },
  PASSED: { light: PASSED_LIGHT, dark: sameInDark(PASSED_LIGHT) },
  PR_OPEN: { light: PR_OPEN_LIGHT, dark: sameInDark(PR_OPEN_LIGHT) },
  ENQUEUED: { light: ENQUEUED_LIGHT, dark: sameInDark(ENQUEUED_LIGHT) },
  MERGED: { light: MERGED_LIGHT, dark: sameInDark(MERGED_LIGHT) },
  FAILED: { light: FAILED_LIGHT, dark: sameInDark(FAILED_LIGHT) },
  KILLED: { light: KILLED_LIGHT, dark: sameInDark(KILLED_LIGHT) },
  WAITING_OPERATOR: {
    light: WAITING_OPERATOR_LIGHT,
    dark: sameInDark(WAITING_OPERATOR_LIGHT),
  },
};

export const UNKNOWN_STYLE: StateStyle = {
  glyph: "dashed",
  fill: "transparent",
  stroke: "var(--ink-soft)",
  ink: "var(--ink-soft)",
  caption: "unknown",
};

export function resolveStateStyle(
  state: string | null,
  theme: Theme = "light",
): { style: StateStyle; known: boolean } {
  if (state === null || !NODE_STATES.includes(state as NodeState)) {
    return { style: UNKNOWN_STYLE, known: false };
  }
  return { style: STATE_STYLES[state as NodeState][theme], known: true };
}
