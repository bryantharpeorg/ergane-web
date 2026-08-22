import type { FloorDocument } from "../api/floorDocument";

interface SpendStripProps {
  doc: FloorDocument;
}

function renderValue(value: unknown): React.ReactNode {
  if (value === null) return <span className="unknown">unknown</span>;
  if (typeof value === "number" || typeof value === "string") return String(value);
  return null;
}

export default function SpendStrip({ doc }: SpendStripProps) {
  const rollup = (doc.spend_to_date.data ?? { groups: [], totals: {} }) as {
    groups?: { key: string; [metric: string]: unknown }[];
    totals?: Record<string, unknown>;
  };
  const groups = rollup.groups ?? [];
  const totals = rollup.totals ?? {};
  const hasUnknown =
    groups.some((g) => Object.entries(g).some(([k, v]) => k !== "key" && v === null)) ||
    Object.values(totals).some((v) => v === null);

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
          {groups.flatMap((g) =>
            Object.entries(g)
              .filter(([k]) => k !== "key")
              .map(([metric, value]) => (
                <tr key={`${g.key}-${metric}`}>
                  <td className="num">{g.key}</td>
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
      {hasUnknown && <p className="note micro">A total is unknown when any row in scope is unknown.</p>}
    </section>
  );
}
