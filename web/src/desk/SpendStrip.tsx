/**
 * Spend-to-date strip.
 *
 * Labels the section "spend to date", renders every NULL metric as the italic
 * word "unknown", and never labels anything "live" (FR-022).
 */

import type { FloorDocument } from "../api/floorDocument";

interface SpendStripProps {
  doc: FloorDocument;
}

function renderValue(value: unknown): React.ReactNode {
  if (value === null) {
    return <span className="unknown">unknown</span>;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  return null;
}

export default function SpendStrip({ doc }: SpendStripProps) {
  const rollup = (doc.spend_to_date.data ?? {
    groups: [],
    totals: {},
  }) as {
    groups?: { key: string; [metric: string]: unknown }[];
    totals?: Record<string, unknown>;
  };

  const groups = rollup.groups ?? [];
  const totals = rollup.totals ?? {};
  const hasUnknownGroup = groups.some((group) =>
    Object.entries(group).some(
      ([key, value]) => key !== "key" && value === null,
    ),
  );
  const hasUnknownTotal = Object.values(totals).some((v) => v === null);

  return (
    <section className="spend" aria-labelledby="sp">
      <h2 id="sp">Spend to date</h2>
      <table>
        <thead>
          <tr>
            <th className="micro">source</th>
            <th className="micro right">metric</th>
            <th className="micro right">value</th>
          </tr>
        </thead>
        <tbody>
          {groups.flatMap((group) =>
            Object.entries(group)
              .filter(([key]) => key !== "key")
              .map(([metric, value]) => (
                <tr key={`${group.key}-${metric}`}>
                  <td className="num">{group.key}</td>
                  <td className="micro right">{metric}</td>
                  <td className="num right">{renderValue(value)}</td>
                </tr>
              )),
          )}
          {Object.entries(totals).map(([metric, value]) => (
            <tr key={`total-${metric}`} className="total">
              <td className="micro">total</td>
              <td className="micro right">{metric}</td>
              <td className="num right">{renderValue(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(hasUnknownGroup || hasUnknownTotal) && (
        <p className="note micro">
          A total is unknown when any row in scope is unknown.
        </p>
      )}
    </section>
  );
}
