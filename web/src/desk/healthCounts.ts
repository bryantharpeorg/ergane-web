export interface Finding {
  severity: string;
  status: string;
}

export interface HealthCounts {
  critical: number;
  warning: number;
  info: number;
}

export function healthCounts(findings: Finding[] | null): HealthCounts {
  const counts: HealthCounts = { critical: 0, warning: 0, info: 0 };
  if (findings === null) {
    return counts;
  }

  for (const finding of findings) {
    const status = finding.status.toLowerCase();
    if (status !== "open" && status !== "regressed") {
      continue;
    }

    const severity = finding.severity.toLowerCase();
    if (severity === "critical") {
      counts.critical += 1;
    } else if (severity === "warning") {
      counts.warning += 1;
    } else if (severity === "info") {
      counts.info += 1;
    }
  }

  return counts;
}
