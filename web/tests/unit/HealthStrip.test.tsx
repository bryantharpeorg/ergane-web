import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import HealthStrip from "../../src/desk/HealthStrip";
import type { FloorDocument } from "../../src/api/floorDocument";

function doc(findings: { severity: string; status: string; summary: string; refs?: string[] }[]): FloorDocument {
  return {
    reference_instant: null,
    floor: { seam: "floor", data: null },
    epics: [],
    attention: { seam: "attention", items: [] },
    health: { seam: "health", data: findings },
    spend_to_date: { seam: "spend", data: null },
    degraded: [],
  };
}

describe("HealthStrip", () => {
  it("counts only open and regressed findings by severity", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    act(() => {
      createRoot(container).render(
        <HealthStrip
          doc={doc([
            { severity: "critical", status: "OPEN", summary: "open crit", refs: ["a:1"] },
            { severity: "warning", status: "REGRESSED", summary: "regressed warn" },
            { severity: "critical", status: "PROMOTED", summary: "promoted crit" },
            { severity: "info", status: "RESOLVED", summary: "resolved info" },
          ])}
        />,
      );
    });

    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("critical");
    expect(rows[0].querySelector(".num")?.textContent).toBe("1");
    expect(rows[1].textContent).toContain("warning");
    expect(rows[1].querySelector(".num")?.textContent).toBe("1");
    expect(rows[2].textContent).toContain("info");
    expect(rows[2].querySelector(".num")?.textContent).toBe("0");

    document.body.removeChild(container);
  });
});
