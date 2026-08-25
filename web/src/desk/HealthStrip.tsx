import type { FloorDocument } from "../api/floorDocument";
import { healthCounts } from "./healthCounts";

interface HealthStripProps {
  doc: FloorDocument;
}

export default function HealthStrip({ doc }: HealthStripProps) {
  const findings = (doc.health.data ?? []) as {
    severity: string;
    status: string;
    summary: string;
    refs: string[];
  }[];
  const counts = healthCounts(findings.map((f) => ({ severity: f.severity, status: f.status })));
  const active = findings.filter((f) => {
    const status = f.status.toLowerCase();
    return status === "open" || status === "regressed";
  });

  return (
    <section className="health" aria-labelledby="hl">
      <h2 id="hl">Health</h2>
      <table>
        <thead>
          <tr>
            <th className="micro">severity</th>
            <th className="micro right">count</th>
          </tr>
        </thead>
        <tbody>
          <tr className="critical"><td className="sev micro">critical</td><td className="num">{counts.critical}</td></tr>
          <tr className="warning"><td className="sev micro">warning</td><td className="num">{counts.warning}</td></tr>
          <tr className="info"><td className="sev micro">info</td><td className="num">{counts.info}</td></tr>
        </tbody>
      </table>
      {active.length > 0 && (
        <div className="finding-list">
          {active.map((f, i) => (
            <div key={i} className="finding">
              <span className={`sev-tag micro ${f.severity.toLowerCase()}`}>{f.severity.toLowerCase()}</span>
              <span className="summary">{f.summary}</span>
              {f.refs?.length > 0 && <span className="refs num">{f.refs.join(" · ")}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
