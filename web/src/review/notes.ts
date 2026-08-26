/**
 * A note, its frozen coordinates, and the draft they compose into (011 US3).
 *
 * This module is the room's output. Everything in it is a pure function over
 * plain data, and that is not tidiness — it is FR-014. **The pane writes no
 * file, creates no directory and mutates no spec.** A composer that could only
 * be exercised by performing a save would be a composer nobody could prove
 * harmless; this one is a `string` returned to a caller, and the caller renders
 * it for the operator to save or not save.
 *
 * ── a note is not prose (FR-012) ───────────────────────────────────────────
 *
 * The 2026-08-25 review found F2 because it recorded the exact box —
 * `362..1049 × 220..300`, 80px tall, glyphs at `241..278`. A textarea full of
 * paragraphs would not have carried that. So every note carries the five
 * coordinates that make it reproducible: the story it is about, the route it
 * was seen on, the width and the theme it was rendered at, and the measured
 * numbers at the instant of capture.
 *
 * ── and the coordinates are frozen (plan D6) ───────────────────────────────
 *
 * `captureNote` deep-copies the report and `Object.freeze`s what it built.
 * Change the width after taking a note and the note keeps the width it was
 * taken at, because a note whose coordinates follow the current view is not a
 * record of anything — it is a caption that rewrites itself, and the operator
 * would act on it believing it described what they were looking at when they
 * wrote it. The arrays are copied as well as frozen: a shallow freeze over a
 * live `escaped` array would let the next measurement rewrite a note's findings
 * out from under it.
 *
 * ── the shape of the draft (FR-013) ────────────────────────────────────────
 *
 * Exactly the one 007 and 010 have, because those two are what a captured-TBD
 * spec looks like in this corpus and a third shape would be a third convention:
 * `state: draft` frontmatter carrying the CAPTURED, NOT REFINED note, the
 * `(TBD)` title, operator intent **verbatim**, a sketch, open questions, an
 * out-of-scope list, and a `## Work Graph` section that deliberately holds no
 * graph. `ergane spec validate` refuses such a document, and that is correct
 * and expected for a sketch: `state: draft` never dispatches.
 */

import { LAWS } from "./laws";
import type { LawReport } from "./laws";
import type { Theme } from "./TheThingItself";

/**
 * What the room is looking at right now, as the centre track reports it.
 *
 * The live view. A note is a *frozen copy* of one of these plus the story and
 * the observation — the two are different types on purpose, so nothing can hand
 * a live view to a reader that is supposed to be reading a record.
 */
export interface ReviewView {
  route: string;
  width: number;
  theme: Theme;
  /** The measurement, or `null` when the frame could not be measured. */
  report: LawReport | null;
  /** Why it could not be, when it could not (constitution III). */
  unmeasured: string | null;
}

/** The five coordinates FR-012 names, taken at the instant of capture. */
export interface NoteCoordinates {
  story: string;
  storyTitle: string | null;
  route: string;
  width: number;
  theme: Theme;
  /** The measured numbers at capture — never re-read, never re-derived. */
  measured: LawReport | null;
  /** A capture taken over a frame that could not be measured says so. */
  unmeasured: string | null;
}

/** One observation, and what makes it reproducible. */
export interface Note {
  id: string;
  observation: string;
  at: NoteCoordinates;
}

/** The epic the notes were taken against, for the draft's provenance. */
export interface DraftContext {
  specDir: string;
  epicName: string;
  /** The revision the service was serving, cut, or null if it named none. */
  served: string | null;
  /** Today, as the caller reads it — `composeDraft` reads no clock. */
  created: string;
}

/**
 * One law's name, its letter and the findings it produced on a report.
 *
 * The vocabulary is `laws.ts`'s, so a law named in a note and the same law
 * named beside the frame cannot drift into two spellings of one thing.
 */
function findingsOf(report: LawReport, key: (typeof LAWS)[number]["key"]): string[] {
  return report[key];
}

/**
 * A deep, frozen copy of a report — or `null`, which is already both.
 *
 * Every array is copied before it is frozen. The measurement that produced this
 * report is about to be replaced by the next one, and a note holding a
 * reference into the old one would be a note whose findings changed when the
 * operator moved a slider.
 */
function frozenReport(report: LawReport | null): LawReport | null {
  if (report === null) return null;
  return Object.freeze({
    swept: report.swept,
    leaves: report.leaves,
    painters: report.painters,
    escaped: Object.freeze([...report.escaped]) as string[],
    past: Object.freeze([...report.past]) as string[],
    overlapping: Object.freeze([...report.overlapping]) as string[],
    occluded: Object.freeze([...report.occluded]) as string[],
    documentScrollWidth: report.documentScrollWidth,
    roomScrollsSideways: report.roomScrollsSideways,
    viewport: report.viewport,
  });
}

/**
 * Record one observation against the view it was made in (FR-012).
 *
 * `sequence` is the caller's counter rather than a clock or a random value:
 * this function is pure, so the same inputs compose the same draft twice, which
 * is what lets a test assert the document rather than a fingerprint of the
 * moment it ran.
 */
export function captureNote(
  sequence: number,
  observation: string,
  view: ReviewView,
  story: { story_key: string; title: string | null },
): Note {
  return Object.freeze({
    id: `n${sequence}`,
    observation,
    at: Object.freeze({
      story: story.story_key,
      storyTitle: story.title,
      route: view.route,
      width: view.width,
      theme: view.theme,
      measured: frozenReport(view.report),
      unmeasured: view.unmeasured,
    }),
  });
}

/** `US2 · /showfloor · 1280px · dark`, the coordinates in one line. */
export function coordinateLine(at: NoteCoordinates): string {
  return `${at.story} · \`${at.route}\` · ${at.width}px · ${at.theme}`;
}

/**
 * The measured numbers at capture, in the shape the two manual reviews used.
 *
 * `235px of graph hidden at 1280` is the sentence that earned this room, so the
 * figure is derived here rather than left for a reader to subtract — the same
 * derivation `TheThingItself`'s `hiddenPast` renders beside the frame.
 */
export function measuredLine(at: NoteCoordinates): string {
  if (at.measured === null) {
    return at.unmeasured === null
      ? "Not measured at capture."
      : `Not measured at capture: ${at.unmeasured}.`;
  }
  const report = at.measured;
  const hidden = Math.max(0, Math.round(report.documentScrollWidth - report.viewport));
  return [
    `frame ${report.viewport}px`,
    `document ${report.documentScrollWidth}px`,
    `${hidden}px hidden past the edge`,
    `${report.leaves} text leaves`,
    `${report.painters} painters`,
    `room scrolls sideways: ${report.roomScrollsSideways ? "yes" : "no"}`,
  ].join(" · ");
}

/** `outside its stage 0 · past the right edge 1 · …`, every law, always. */
export function lawLine(at: NoteCoordinates): string | null {
  if (at.measured === null) return null;
  const report = at.measured;
  return LAWS.map((law) => `${law.name} ${findingsOf(report, law.key).length}`).join(" · ");
}

/** Every law that found something, with what it found. */
export function violationsOf(at: NoteCoordinates): { name: string; findings: string[] }[] {
  if (at.measured === null) return [];
  const report = at.measured;
  return LAWS.map((law) => ({ name: law.name, findings: findingsOf(report, law.key) })).filter(
    (law) => law.findings.length > 0,
  );
}

/** The operator's words, unaltered, in the corpus's blockquote. */
function verbatim(observation: string): string {
  return observation
    .split("\n")
    .map((line) => (line.trim() === "" ? ">" : `> ${line}`))
    .join("\n");
}

/** One note as the draft carries it: coordinates first, then the words. */
function observationSection(note: Note, index: number): string {
  const parts = [
    `### ${index + 1} — ${coordinateLine(note.at)}`,
    "",
    verbatim(note.observation),
    "",
    `Measured at capture: ${measuredLine(note.at)}`,
  ];
  const laws = lawLine(note.at);
  if (laws !== null) parts.push("", `Laws at capture: ${laws}`);
  for (const violation of violationsOf(note.at)) {
    parts.push("", `${violation.name}:`);
    for (const finding of violation.findings) parts.push(`- \`${finding}\``);
  }
  return parts.join("\n");
}

/** The sketch's table: one row per note, so the set can be read at a glance. */
function sketchTable(notes: Note[]): string {
  const rows = notes.map((note, index) => {
    const violations = violationsOf(note.at);
    const measured =
      note.at.measured === null
        ? "not measured"
        : violations.length === 0
          ? "no violation"
          : violations.map((law) => `${law.name} ${law.findings.length}`).join(", ");
    return `| ${index + 1} | ${note.at.story} | \`${note.at.route}\` | ${note.at.width}px | ${note.at.theme} | ${measured} |`;
  });
  return [
    "| # | story | route | width | theme | laws at capture |",
    "|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Compose the notes into a captured-TBD spec (FR-013).
 *
 * Returns the document's bytes. It does not save them, offer to save them, or
 * know where they would go — the room renders the string and the operator saves
 * it or does not (FR-014, SC-003).
 */
export function composeDraft(notes: Note[], context: DraftContext): string {
  const routes = unique(notes.map((note) => note.at.route));
  const stories = unique(notes.map((note) => note.at.story));
  const widths = unique(notes.map((note) => `${note.at.width}px`));
  const themes = unique(notes.map((note) => note.at.theme));
  const withViolations = notes.filter((note) => violationsOf(note.at).length > 0);
  const unmeasured = notes.filter((note) => note.at.measured === null);

  const frontmatter = [
    "---",
    "state: draft",
    `depends_on_landed: [${context.specDir}]`,
    `# TBD — CAPTURED, NOT REFINED. Recorded ${context.created} in the review room from`,
    `# ${notes.length} ${plural(notes.length, "observation", "observations")} of ${context.specDir}, so the ideas survive the session`,
    "# that had them. This spec has NO Work Graph on purpose: `state: draft` never",
    "# dispatches, and it must not be flipped `ready` until the open questions below",
    "# are answered and the body is refined to the corpus's standard (scenarios",
    "# provable from the diff, a compiled graph, plan.md and tasks.md).",
    "# `ergane spec validate` will refuse it today; that is correct and expected for",
    "# a sketch.",
    "#",
    "# THE ROOM WROTE NOTHING. This document was composed in the operator's own",
    "# browser and handed over. No file was written, no directory was made and no",
    "# spec was touched (spec 011 FR-014). It exists where the operator puts it and",
    "# nowhere else — including its directory name, which the room does not know",
    "# and does not look for.",
    "#",
    "# The `depends_on_landed` edge is provisional: the epic reviewed is the honest",
    "# floor, because every observation below is about a surface it landed. The real",
    "# edge set is decided at refinement.",
    "---",
  ].join("\n");

  const body = [
    `# Feature Specification: What the review of ${context.epicName} found (TBD)`,
    "",
    "**Feature Branch**: `NNN-name-this-when-you-save-it`",
    `**Created**: ${context.created} · **Status**: Draft — unrefined sketch`,
    "**Input**: operator observations recorded in the review room, verbatim below",
    "",
    "## Operator intent (as captured)",
    "",
    `Recorded against \`${context.specDir}\` (${context.epicName}) while the service was`,
    `serving ${context.served === null ? "a revision it did not name" : `\`${context.served}\``}. Each observation carries the coordinates it was`,
    "taken at, frozen at that instant, so it can be reproduced before it is acted",
    "on (spec 011 FR-012).",
    "",
    notes.map(observationSection).join("\n\n"),
    "",
    "## Sketch",
    "",
    `${notes.length} ${plural(notes.length, "observation", "observations")} over ${routes.length} ${plural(routes.length, "route", "routes")} — ${routes.map((route) => `\`${route}\``).join(", ")} — reaching`,
    `${stories.length} ${plural(stories.length, "story", "stories")} of \`${context.specDir}\`, at ${widths.join(", ")} in ${themes.join(" and ")}.`,
    "",
    sketchTable(notes),
    "",
    `${withViolations.length} of the ${notes.length} were taken over a render that violated at least one`,
    "of the four layout laws, which is the half a headless gate cannot see. What",
    "the refined spec does about each of them is not decided here — this is the",
    "capture, and the shape of the work is the open question below.",
    "",
    "## Open questions",
    "",
    "1. **Which of these are defects and which are preferences?** A measured law",
    "   violation is a defect by construction; an observation with no violation",
    `   beside it is a judgement, and ${notes.length - withViolations.length} of the ${notes.length} ${plural(notes.length - withViolations.length, "is", "are")} in that class.`,
    "2. **What is one spec and what is several?** The corpus's rule is one epic per",
    "   coherent change; observations across unrelated rooms are usually two specs",
    "   and not one, and splitting them here is cheaper than splitting them later.",
    "3. **Which of them is `DESIGN.md`'s and which is a spec's?** Where a scenario",
    "   and `DESIGN.md` disagree on an *appearance* `DESIGN.md` wins, so an",
    "   observation about a colour, a face or a radius may be a decision-log entry",
    "   rather than a story (constitution VIII).",
    "4. **What is the acceptance test for each?** Constitution IV: every criterion",
    "   must be decidable by the judge from the diff alone, and every gate must run",
    "   headless. An observation that only an eye can score is a defect in this",
    "   draft, not in the agent that fails it.",
    unmeasured.length === 0
      ? "5. **What edge set does this actually need?** The frontmatter's is provisional."
      : `5. **What were the ${unmeasured.length} unmeasured ${plural(unmeasured.length, "observation", "observations")} actually about?** The frame could not be\n   measured at capture, so ${plural(unmeasured.length, "that note carries", "those notes carry")} words and no numbers.`,
    "",
    "## Out of scope (already known)",
    "",
    "- Dispatching this spec. It comes out `draft`, like 007 and 010, and a human",
    "  takes it from there.",
    "- Saving it. The review room writes nothing — not a file, not a directory, not",
    "  a spec (spec 011 FR-014). This document reached the operator and stopped.",
    "- Re-measuring. Every number above is the one taken at capture and none of",
    "  them is re-read; a coordinate that followed the current view would not be a",
    "  record of anything (spec 011 plan D6).",
    "",
    "## Work Graph",
    "",
    "Deliberately absent — see the frontmatter note. Refine with `/speckit-plan`",
    "and `/speckit-tasks` once the open questions above are answered.",
    "",
  ].join("\n");

  return `${frontmatter}\n\n${body}`;
}
