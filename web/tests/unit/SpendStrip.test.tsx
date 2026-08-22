import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import SpendStrip from "../../src/desk/SpendStrip";
import type { FloorDocument } from "../../src/api/floorDocument";

const ROLLUP = {
  by: "persona",
  filters: { epic: null, since: null },
  groups: [
    {
      key: "debugger",
      prompt_tokens: 3446831,
      completion_tokens: null,
      cache_read_tokens: null,
      requests: 63,
      spend_usd: null,
      rows: 1,
    },
  ],
  totals: {
    prompt_tokens: 8803928,
    completion_tokens: null,
    requests: 200,
    spend_usd: null,
    rows: 10,
  },
};

function doc(): FloorDocument {
  return {
    reference_instant: null,
    floor: { seam: "floor", data: null },
    epics: [],
    attention: { seam: "attention", items: [] },
    health: { seam: "health", data: null },
    spend_to_date: { seam: "spend", data: ROLLUP },
    degraded: [],
  };
}

describe("SpendStrip", () => {
  it("labels spend to date and renders null as unknown, never zero", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    act(() => {
      createRoot(container).render(<SpendStrip doc={doc()} />);
    });

    const heading = container.querySelector("h2")?.textContent ?? "";
    expect(heading).toMatch(/spend to date/i);

    const rows = container.querySelectorAll("tbody tr");
    for (const row of rows) {
      const metricCell = row.querySelector("td:nth-child(2)");
      const valueCell = row.querySelector("td:nth-child(3)");
      const metric = metricCell?.textContent?.trim() ?? "";
      const value = valueCell?.textContent?.trim() ?? "";
      if (metric === "completion_tokens" || metric === "spend_usd") {
        expect(value).toBe("unknown");
      }
    }

    expect(container.textContent).not.toMatch(/live/i);

    document.body.removeChild(container);
  });
});
