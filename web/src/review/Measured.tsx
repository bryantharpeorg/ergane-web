/**
 * The measured numbers, beside the frame (011 US2: FR-008).
 *
 * `DESIGN.md` § The review room, its load-bearing rule: "**A measured number is
 * shown, never only a verdict.** The two manual reviews earned this room by
 * reporting `235px of graph hidden at 1280`, `US4 fully invisible`, `scrollbar
 * height 0px`. A green tick over that measurement throws away the thing that
 * made the ritual worth automating. Numerals right-aligned tabular mono, the
 * unit always present, the law named beside the figure."
 *
 * So there is no pass chip anywhere in this file and there is not going to be
 * one. A law renders its **count of violations** — `0` is a number an operator
 * can read and act on, `passed` is a claim they have to take on trust — beside
 * the figures the pass produced: the frame's own viewport width, the width its
 * document actually laid out to, how many text leaves were swept and how many
 * painted boxes were considered. Those last two are what tell a zero apart from
 * a sweep that found nothing to measure, which is the way a visual gate goes
 * green over a blank screen.
 *
 * Every figure carries its coordinates. A measurement is `{route, width, theme,
 * report}` from the moment it is taken (`laws.ts`), so nothing on this panel can
 * describe a frame other than the one it was measured in — change the width and
 * the panel says it is measuring again rather than relabelling last time's
 * numbers.
 */

import { lawResults } from "./laws";
import type { Measurement } from "./laws";

/** One figure with its unit, in the tabular mono § The review room asks for. */
function Figure({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}): JSX.Element {
  return (
    <div className="rv-figure" data-figure={label}>
      <span className="rv-figure-label micro">{label}</span>
      <span className="rv-figure-value num">
        {value}
        <span className="rv-figure-unit"> {unit}</span>
      </span>
    </div>
  );
}

export default function Measured({
  measurement,
  pending,
}: {
  measurement: Measurement | null;
  pending: string;
}): JSX.Element {
  if (measurement === null) {
    // Not a zero. A measurement that has not been taken is not a measurement of
    // zero violations, and rendering it as one would be this panel telling the
    // operator the screen is clean before anything looked at it.
    return (
      <section className="rv-measured" data-measured="pending">
        <h3 className="rv-measured-head">Measured in the frame</h3>
        <p className="quiet">{pending}</p>
      </section>
    );
  }

  const { report } = measurement;
  const laws = lawResults(report);
  const violations = laws.reduce((total, law) => total + law.violations, 0);

  return (
    <section
      className="rv-measured"
      data-measured="taken"
      data-measured-route={measurement.route}
      data-measured-width={measurement.width}
      data-measured-theme={measurement.theme}
      data-violations={violations}
    >
      <h3 className="rv-measured-head">Measured in the frame</h3>
      <p className="rv-measured-at micro" data-coordinates>
        <span className="num">{measurement.route}</span> ·{" "}
        <span className="num">{measurement.width} px</span> ·{" "}
        <span className="num">{measurement.theme}</span>
      </p>

      <div className="rv-figures">
        <Figure label="viewport" value={report.viewport} unit="px" />
        <Figure label="document" value={report.documentScrollWidth} unit="px" />
        <Figure label="text swept" value={report.leaves} unit="leaves" />
        <Figure label="paint swept" value={report.painters} unit="boxes" />
      </div>

      <ul className="rv-laws">
        {laws.map((law) => (
          <li
            className="rv-law"
            key={law.key}
            data-law={law.key}
            data-violations={law.violations}
          >
            <span className="rv-law-name">{law.law}</span>
            <span className="rv-law-count num">
              {law.violations}
              <span className="rv-figure-unit">
                {" "}
                {law.violations === 1 ? "violation" : "violations"}
              </span>
            </span>
            {law.detail.length === 0 ? null : (
              // The descriptions the pass produced, verbatim. This is the half
              // that made "235px of graph hidden at 1280" possible: a count says
              // there is something wrong, and only the description says what.
              <ul className="rv-law-detail">
                {law.detail.map((line) => (
                  <li key={line} className="num">
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <p className="rv-measured-foot micro">
        Measured inside the frame's own document, by the same pass the smoke
        suite runs against this pane.
      </p>
    </section>
  );
}
