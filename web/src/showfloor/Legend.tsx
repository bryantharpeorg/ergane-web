/**
 * The one legend row, under the stage.
 *
 * `DESIGN.md` § Stage: "One legend row under the stage, rendered once per page,
 * never per epic", and § Do's and Don'ts: "**Don't** repeat a legend, rail, or
 * explainer per item on a page."
 *
 * **This replaces the first world's route-map legend**, whose two verbatim
 * glossary definitions dressed a map that D-015 deleted — and which
 * `EpicStage.tsx` rendered *inside itself*, so the 004 run drew three copies of
 * it down one page. The defect was the mounting point, so the fix is the
 * mounting point: this component is rendered by `Showfloor.tsx`, which the room
 * has exactly one of, and never by anything the room can have more than one of.
 *
 * It reads the two things the stage says only in stroke — the ladder's four
 * fills and the two edge kinds — because § Named Rules forbids state carried by
 * colour alone, and a wire has nowhere to write its word.
 */

/** § The status ladder's four fills, in the order the ladder runs. */
const FILLS = [
  { key: "done", word: "done" },
  { key: "now", word: "now" },
  { key: "hold", word: "waiting on you" },
  { key: "ahead", word: "ahead" },
] as const;

export default function Legend(): JSX.Element {
  return (
    <p className="legend" data-legend>
      {FILLS.map((fill) => (
        <span key={fill.key} data-legend-fill={fill.key}>
          <span className={`swatch ${fill.key}`} aria-hidden="true" />
          <b>{fill.word}</b>
        </span>
      ))}
      <span className="legend-edges" data-legend-edges>
        solid wire = merge edge · dashed = pass edge
      </span>
    </p>
  );
}
