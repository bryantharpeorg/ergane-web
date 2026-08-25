/**
 * Route-map legend.
 *
 * Contracts/stage-document.md §3: verbatim glossary definitions.
 * DESIGN.md § Route Map and Landing Line.
 */

const PASS_EDGE_TEXT =
  "An ordering-only dependency: the predecessor must reach a verdict, and nothing about its code is guaranteed to be present";
const MERGE_EDGE_TEXT =
  "A content dependency: the predecessor's work must be merged before the dependent's worktree is created, so the dependent's base contains that code";

export default function Legend(): JSX.Element {
  return (
    <div data-legend className="legend">
      <div data-legend-kind="pass" className="legend-entry">
        <span className="legend-sample legend-pass" />
        <span className="legend-name">pass-edge</span>
        <span className="legend-def">{PASS_EDGE_TEXT}</span>
      </div>
      <div data-legend-kind="merge" className="legend-entry">
        <span className="legend-sample legend-merge" />
        <span className="legend-name">merge-edge</span>
        <span className="legend-def">{MERGE_EDGE_TEXT}</span>
      </div>
    </div>
  );
}
