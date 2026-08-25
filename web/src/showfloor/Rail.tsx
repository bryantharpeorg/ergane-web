/**
 * The epic rail: every spec on the floor, in directory order, one row each.
 *
 * `DESIGN.md` § Epic rail is the authority — "One row per spec in directory
 * order: mono id in accent, status chip with the story count (`landed 4/4`,
 * `building 1/4`), name in muted small beneath. Selection: accent-w wash + 3px
 * accent bar. Rows are real links — `/showfloor/<spec-dir>`".
 *
 * Real links, not buttons: the Showfloor never grows a control (constitution I,
 * § Do's and Don'ts). The approved comp drew these rows as `<button>`s because a
 * static mock had no URL to point at; where the comp and the document disagree,
 * the document wins (§ Governance), and here the document is also the
 * constitution's side.
 *
 * The rail renders every entry the document carries and filters none: a spec
 * that failed to read, or one that declares no stories at all, is a row that
 * says so rather than a row that is missing (constitution III).
 */

import type { RailEntry } from "../api/showfloorDocument";
import { chipText, railChip, specId } from "./ladder";
import { showfloorPathFor } from "../routes";

interface RailProps {
  entries: RailEntry[];
  /** The selected spec's directory, or null when the floor carried none. */
  selected: string | null;
}

export default function Rail({ entries, selected }: RailProps): JSX.Element {
  return (
    <nav className="rail" data-rail aria-label="Specs">
      <h2 className="rail-head">specs</h2>
      {entries.length === 0 ? (
        <p className="rail-empty" data-rail-empty>
          No spec was read from the corpus.
        </p>
      ) : null}
      {entries.map((entry) => {
        const chip = railChip(entry);
        const current = entry.spec_dir === selected;
        return (
          <a
            key={entry.spec_dir}
            className={current ? "epic-row sel" : "epic-row"}
            href={showfloorPathFor(entry.spec_dir)}
            data-rail-row
            data-spec-dir={entry.spec_dir}
            data-selected={current ? "true" : "false"}
            aria-current={current ? "page" : undefined}
          >
            <span className="eid" data-rail-id>
              {specId(entry.spec_dir)}
            </span>{" "}
            <span
              className={`chip ${chip.tone} estat`}
              data-chip
              data-chip-tone={chip.tone}
            >
              {chipText(chip)}
            </span>
            <span className="ename" data-rail-name>
              {entry.name}
            </span>
            {/* A spec that declares no work graph is empty because the corpus
                is, not because a read failed — US1 puts `stories` in its
                `unknown` for exactly this row to be able to say so. */}
            {entry.unknown.includes("stories") ? (
              <span className="rail-note" data-rail-note>
                no stories declared
              </span>
            ) : null}
            {/* And a read that failed is named on the row it failed for, so a
                count of 0/0 is never mistaken for a floor that is quiet. */}
            {entry.notes.length > 0 ? (
              <span className="rail-note" data-rail-degraded>
                {entry.notes.length === 1
                  ? `1 read degraded: ${entry.notes[0].read}`
                  : `${entry.notes.length} reads degraded`}
              </span>
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}
