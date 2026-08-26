/**
 * The four layout laws, measured inside the frame and rendered beside it.
 *
 * 011 US2, FR-008 (T011, T012). The measurement is `web/src/layoutLaws.ts`'s —
 * the one the gates run, imported and not re-derived (plan D2) — pointed at the
 * frame's own document. This file is only what the numbers look like.
 *
 * **A measured number is shown, never only a verdict.** `DESIGN.md` § The
 * review room opens on it:
 *
 * > The two manual reviews earned this room by reporting `235px of graph hidden
 * > at 1280`, `US4 fully invisible`, `scrollbar height 0px`. A green tick over
 * > that measurement throws away the thing that made the ritual worth
 * > automating. Numerals right-aligned tabular mono, the unit always present,
 * > the law named beside the figure.
 *
 * So every law carries its count *and* what it found, spelt out — a law that
 * reported `4 ✗` and made the operator open a terminal to learn which four
 * would have rebuilt the screenshot. The figures that are not violations are
 * shown too, for the reason the 08-25 review's best line was one of them: `235px
 * of graph hidden` is not a law at all, it is the difference between the
 * document's width and the frame's, and it is what told the operator what to
 * look at.
 *
 * **A sweep over nothing is not a pass.** `swept`, `leaves` and `painters` are
 * on the page beside the four counts because zero violations over a frame that
 * rendered nothing is the empty pass every law in this repository is written
 * against — the same floors `desk.spec.ts` asserts, put where the operator can
 * see them rather than left to the suite.
 *
 * They are also what makes the room's one soft edge legible. A room fetches its
 * own document *after* it loads — measured 2026-08-26, a framed `/` answers 65
 * characters of "Reading the floor…" for about a second and then 5,409 of Desk,
 * and the sweep goes from 14 text elements to 306 across that line. So the sweep
 * that runs at the frame's `load` is a sweep of a room still arriving. The room
 * does not guess at a settling delay and does not poll: it says which frame the
 * figures are of, shows the floors that make a thin one obvious, and offers the
 * operator the control to ask again.
 */

import type { LawReport } from "../layoutLaws";

/** The coordinates a measurement was taken at — US3 will pin a note to these. */
export interface Coordinates {
  route: string;
  width: number;
  theme: string;
}

export interface Measurement {
  at: Coordinates;
  report: LawReport | null;
  /** The frame's own box, as the room set it and as the browser gave it back. */
  frameWidth: number;
  frameHeight: number;
  /** Why the frame could not be measured, in words; `null` when it was. */
  unmeasured: string | null;
}

/** One law: its name, what it found, and the unit its figure is counted in. */
interface Law {
  key: string;
  name: string;
  unit: string;
  found: string[];
}

function laws(report: LawReport): Law[] {
  return [
    {
      key: "a",
      name: "stage children outside their stage",
      unit: "elements",
      found: report.escaped,
    },
    {
      key: "b",
      name: "text past the frame's right edge",
      unit: "elements",
      found: report.past,
    },
    { key: "c", name: "text leaves overlapping", unit: "pairs", found: report.overlapping },
    {
      key: "d",
      name: "boxes painting over text they do not own",
      unit: "boxes",
      found: report.occluded,
    },
  ];
}

/** One figure that is not a violation, and the unit it is counted in. */
interface Figure {
  key: string;
  name: string;
  value: number | string;
  unit: string;
}

/**
 * The figures beside the laws.
 *
 * `past the right edge` is the one the 2026-08-25 review was written around:
 * the document inside the frame is this much wider than the frame is, which is
 * what `235px of graph hidden at 1280` measured. It is a fact and not a verdict
 * — a stage is allowed to scroll (§ Stage) — so it is a figure and not a law.
 */
function figures(measurement: Measurement, report: LawReport): Figure[] {
  const hidden = report.documentScrollWidth - report.viewport;
  return [
    { key: "chosen", name: "frame width, as chosen", value: measurement.frameWidth, unit: "px" },
    { key: "height", name: "frame height", value: measurement.frameHeight, unit: "px" },
    { key: "viewport", name: "viewport measured inside", value: report.viewport, unit: "px" },
    { key: "document", name: "document width inside", value: report.documentScrollWidth, unit: "px" },
    { key: "hidden", name: "past the right edge", value: hidden, unit: "px" },
    { key: "swept", name: "text elements swept", value: report.swept, unit: "elements" },
    { key: "leaves", name: "text leaves measured", value: report.leaves, unit: "leaves" },
    { key: "painters", name: "painters considered", value: report.painters, unit: "boxes" },
    {
      key: "sideways",
      name: "room scrolls sideways",
      value: report.roomScrollsSideways ? "yes" : "no",
      unit: "",
    },
  ];
}

export default function LawReadout({
  measurement,
}: {
  measurement: Measurement | null;
}): JSX.Element {
  if (measurement === null) {
    return (
      <section className="rv-laws" data-laws="unmeasured">
        <h3 className="rv-laws-head">The four layout laws</h3>
        <p className="quiet">
          Nothing has been measured yet. The sweep runs on what is in the frame,
          so it runs once the frame has something in it.
        </p>
      </section>
    );
  }

  const { at, report } = measurement;

  return (
    <section
      className="rv-laws"
      data-laws={report === null ? "unmeasured" : "measured"}
      // The coordinates the figures below belong to, on the element that
      // carries them. A number whose width and theme are somewhere else on the
      // page is a number nobody can reproduce (FR-012 is US3's, and this is
      // what it will read).
      data-at-route={at.route}
      data-at-width={at.width}
      data-at-theme={at.theme}
    >
      <h3 className="rv-laws-head">The four layout laws</h3>
      <p className="rv-laws-at micro">
        measured on <span className="num">{at.route}</span> at{" "}
        <span className="num">{at.width}px</span> in{" "}
        <span className="num">{at.theme}</span> — as the frame stood when the
        sweep ran
      </p>

      {report === null ? (
        <div className="degraded" data-mode="transport" role="status">
          <p className="lead">The frame could not be measured.</p>
          <p>
            <span className="detail">{measurement.unmeasured}</span>. Shown as
            unmeasured, not as zero violations — a sweep that did not run is not
            a sweep that found nothing.
          </p>
        </div>
      ) : (
        <>
          <table className="rv-figures" data-figures>
            <thead>
              <tr>
                <th scope="col">law</th>
                <th scope="col">found</th>
                <th scope="col">unit</th>
              </tr>
            </thead>
            <tbody>
              {laws(report).map((law) => (
                <tr key={law.key} data-law={law.key} data-found={law.found.length}>
                  <th scope="row">
                    <span className="rv-law-key num">({law.key})</span> {law.name}
                  </th>
                  <td className="num">{law.found.length}</td>
                  <td className="rv-unit micro">{law.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {laws(report)
            .filter((law) => law.found.length > 0)
            .map((law) => (
              <div className="rv-violations" key={law.key} data-violations={law.key}>
                <p className="rv-violation-head micro">
                  ({law.key}) {law.name}
                </p>
                <ul>
                  {law.found.map((what) => (
                    <li className="rv-violation num" key={what}>
                      {what}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

          <table className="rv-figures" data-measures>
            <thead>
              <tr>
                <th scope="col">measure</th>
                <th scope="col">figure</th>
                <th scope="col">unit</th>
              </tr>
            </thead>
            <tbody>
              {figures(measurement, report).map((figure) => (
                <tr key={figure.key} data-measure={figure.key}>
                  <th scope="row">{figure.name}</th>
                  <td className="num">{figure.value}</td>
                  <td className="rv-unit micro">{figure.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
