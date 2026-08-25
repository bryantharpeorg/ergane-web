import type { FloorDocument } from "../api/floorDocument";

/**
 * The metric set the Desk shows, closed and declared.
 *
 * `DESIGN.md` → Tables → **The Spend Strip's shape** names exactly these four
 * columns, in this order, and names `cache_read_tokens`, `cache_write_tokens`,
 * `rows` and `unconfirmed_rows` as the ledger's own bookkeeping that does not
 * belong on a Desk. The strip reads its columns from this constant and never
 * from the rollup's keys, so a new ledger column cannot reach the Desk without
 * an amendment to that document and a diff that shows it (constitution VIII).
 */
export const SPEND_METRICS = [
  { key: "prompt_tokens", label: "prompt tokens" },
  { key: "completion_tokens", label: "completion tokens" },
  { key: "requests", label: "requests" },
  { key: "spend_usd", label: "spend" },
] as const;

interface SpendStripProps {
  doc: FloorDocument;
}

function renderValue(value: unknown): React.ReactNode {
  if (value === null) return <span className="unknown">unknown</span>;
  if (typeof value === "number" || typeof value === "string") return String(value);
  return null;
}

/** One cell per declared metric. A metric the rollup does not carry is as
 *  unmeasured as one it carries as NULL, and reads the same way — never a zero
 *  (DESIGN.md, The Unknown Rule; constitution III). */
function metricCells(source: Record<string, unknown>, rowKey: string) {
  return SPEND_METRICS.map((metric) => (
    <td key={`${rowKey}-${metric.key}`} className="num right">
      {renderValue(metric.key in source ? source[metric.key] : null)}
    </td>
  ));
}

export default function SpendStrip({ doc }: SpendStripProps) {
  const rollup = (doc.spend_to_date.data ?? { groups: [], totals: {} }) as {
    groups?: { key: string; [metric: string]: unknown }[];
    totals?: Record<string, unknown>;
  };
  const groups = rollup.groups ?? [];
  const totals = rollup.totals ?? {};
  const isUnknown = (source: Record<string, unknown>) =>
    SPEND_METRICS.some((metric) => (metric.key in source ? source[metric.key] : null) === null);
  const hasUnknown = groups.some(isUnknown) || isUnknown(totals);

  return (
    <section className="spend" aria-labelledby="sp">
      <h2 id="sp">Spend to date</h2>
      <table>
        <thead>
          <tr>
            <th className="micro">persona</th>
            {SPEND_METRICS.map((metric) => (
              <th key={metric.key} className="micro right" data-metric={metric.key}>
                {metric.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* One row per persona — never one per persona-and-metric. A persona
              whose every value is unknown still renders: what it spent is
              unmeasured, and dropping the row would make the strip lie by
              omission (DESIGN.md; FR-012, FR-015). */}
          {groups.map((group) => (
            <tr key={group.key}>
              <th scope="row" className="num">
                {group.key}
              </th>
              {metricCells(group, group.key)}
            </tr>
          ))}
          <tr className="total">
            <th scope="row" className="micro">
              total
            </th>
            {metricCells(totals, "total")}
          </tr>
        </tbody>
      </table>
      {hasUnknown && <p className="note micro">A total is unknown when any row in scope is unknown.</p>}
    </section>
  );
}
