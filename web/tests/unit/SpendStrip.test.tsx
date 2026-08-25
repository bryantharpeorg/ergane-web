/**
 * The spend strip says something (spec 004, US4).
 *
 * The first build rendered `groups.flatMap(g => Object.entries(g).map(...))` — a
 * cross product of every source with every ledger column — which produced **32
 * rows of which 14 read "unknown"** for the very fixture these tests feed it.
 * `DESIGN.md` → Tables → *The Spend Strip's shape* now settles the question: one
 * row per persona plus a total, and exactly four columns, declared there and
 * never read from the rollup's keys.
 *
 * The rollup under test is the recorded one, `fixtures/usage/rollup-by-persona.json`
 * — the same document `pane/fixture_floor.py` serves the Desk — so these
 * assertions are taken against the shape the factory actually writes, NULLs
 * included (constitution V).
 */
import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import SpendStrip, { SPEND_METRICS } from "../../src/desk/SpendStrip";
import type { FloorDocument } from "../../src/api/floorDocument";
import rollupRaw from "../../../fixtures/usage/rollup-by-persona.json?raw";

interface Rollup {
  by: string;
  groups: { key: string; [metric: string]: unknown }[];
  totals: Record<string, unknown>;
}

const RECORDED = JSON.parse(rollupRaw) as Rollup;

/** The metric set `DESIGN.md` names, spelled out here rather than imported, so
 *  that a change to the component's constant fails this test instead of moving
 *  with it. Order is the document's order. */
const DESIGN_METRICS = ["prompt_tokens", "completion_tokens", "requests", "spend_usd"];
const DESIGN_LABELS = ["prompt tokens", "completion tokens", "requests", "spend"];

/** Named in `DESIGN.md` as the ledger's own bookkeeping, which does not belong
 *  on a Desk. Each of these is a key the recorded rollup really carries. */
const LEDGER_BOOKKEEPING = [
  "cache_read_tokens",
  "cache_write_tokens",
  "rows",
  "unconfirmed_rows",
];

function doc(rollup: unknown): FloorDocument {
  return {
    reference_instant: null,
    floor: { seam: "floor", data: null },
    epics: [],
    attention: { seam: "attention", items: [] },
    health: { seam: "health", data: null },
    spend_to_date: { seam: "spend", data: rollup },
    degraded: [],
  };
}

function render(rollup: unknown): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    createRoot(container).render(<SpendStrip doc={doc(rollup)} />);
  });
  return container;
}

function cleanup(container: HTMLDivElement): void {
  document.body.removeChild(container);
}

describe("SpendStrip", () => {
  // US4-S1 / FR-012.
  it("renders one row per persona plus a total, not one per persona-and-metric", () => {
    const container = render(RECORDED);
    const personas = RECORDED.groups.length;
    expect(personas).toBeGreaterThan(0);

    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(personas + 1);

    // The defect this story repairs, stated as the number it produced: the cross
    // product would be personas × ledger columns, which for this fixture is 32.
    const crossProduct =
      RECORDED.groups.reduce(
        (n, g) => n + Object.keys(g).filter((k) => k !== "key").length,
        0,
      ) + Object.keys(RECORDED.totals).length;
    expect(crossProduct).toBe(32);
    expect(rows.length).toBeLessThan(crossProduct);

    // Each persona names itself once, in its own row, in the fixture's order.
    const personaCells = [...rows]
      .slice(0, personas)
      .map((row) => row.querySelector("th, td")?.textContent?.trim() ?? "");
    expect(personaCells).toEqual(RECORDED.groups.map((g) => g.key));

    // ...and the last row is the total.
    expect(rows[personas].className).toContain("total");

    cleanup(container);
  });

  // US4-S2 / FR-013.
  it("renders exactly the metric set DESIGN.md names — neither a superset nor a subset", () => {
    const container = render(RECORDED);

    const metricHeaders = [...container.querySelectorAll("thead th[data-metric]")];
    const renderedMetrics = metricHeaders.map((th) => th.getAttribute("data-metric"));

    // Exact equality, in order: a dropped metric and a new ledger column both
    // fail here.
    expect(renderedMetrics).toEqual(DESIGN_METRICS);
    expect(new Set(renderedMetrics)).toEqual(new Set(DESIGN_METRICS));
    expect(metricHeaders.map((th) => th.textContent?.trim())).toEqual(DESIGN_LABELS);

    // The component's own declared constant is the source of those columns, and
    // it is the set the document names.
    expect(SPEND_METRICS.map((m) => m.key)).toEqual(DESIGN_METRICS);

    // No column beyond the persona label and the four exists at all.
    const allHeaders = [...container.querySelectorAll("thead th")].map((th) =>
      th.textContent?.trim(),
    );
    expect(allHeaders).toEqual(["persona", ...DESIGN_LABELS]);

    // Every row is that wide and no wider.
    for (const row of container.querySelectorAll("tbody tr")) {
      expect(row.querySelectorAll("th, td").length).toBe(DESIGN_METRICS.length + 1);
    }

    // And the ledger's bookkeeping — which the recorded rollup really carries —
    // reaches the Desk nowhere, as a column or as a value.
    const text = container.textContent ?? "";
    for (const key of LEDGER_BOOKKEEPING) {
      expect(RECORDED.groups[0]).toHaveProperty(key);
      expect(text).not.toContain(key);
    }

    cleanup(container);
  });

  // US4-S3 / FR-014 — 001's guarantee, restated against this component's new
  // shape so that a layout change cannot quietly drop it (constitution III).
  it("renders the fixture's NULL as unknown, labels spend to date, and never says live", () => {
    const container = render(RECORDED);

    const heading = container.querySelector("h2")?.textContent ?? "";
    expect(heading).toMatch(/spend to date/i);

    // The recorded rollup carries NULLs in the metric set: every one of them is
    // the word "unknown", and none of them is a zero.
    let nullCells = 0;
    const rows = [...container.querySelectorAll("tbody tr")];
    RECORDED.groups.forEach((group, r) => {
      DESIGN_METRICS.forEach((metric, c) => {
        const cell = rows[r].querySelectorAll("td")[c];
        const value = cell.textContent?.trim() ?? "";
        if (group[metric] === null) {
          nullCells += 1;
          expect(value).toBe("unknown");
          expect(cell.querySelector(".unknown")).not.toBeNull();
          expect(value).not.toBe("0");
          expect(value).not.toMatch(/^\$?0([.,]0+)?$/);
        }
      });
    });
    expect(nullCells).toBeGreaterThan(0);

    // The total row obeys the same rule.
    const totalCells = rows[rows.length - 1].querySelectorAll("td");
    DESIGN_METRICS.forEach((metric, c) => {
      if (RECORDED.totals[metric] === null) {
        expect(totalCells[c].textContent?.trim()).toBe("unknown");
      }
    });

    expect(container.textContent ?? "").not.toMatch(/live/i);
    expect(container.innerHTML).not.toMatch(/live/i);

    cleanup(container);
  });

  // US4-S4 / FR-015.
  it("still renders a persona whose every value is unknown", () => {
    // Derived from the recorded rollup by unmeasuring one recorded persona —
    // the shape is the factory's, only the values are NULL.
    const silent = RECORDED.groups[RECORDED.groups.length - 1].key;
    const rollup = {
      ...RECORDED,
      groups: RECORDED.groups.map((g) =>
        g.key === silent
          ? { ...g, ...Object.fromEntries(Object.keys(g).filter((k) => k !== "key").map((k) => [k, null])) }
          : g,
      ),
    };

    const container = render(rollup);
    const rows = [...container.querySelectorAll("tbody tr")];

    // Not suppressed: the row count is unchanged, and the persona names itself.
    expect(rows.length).toBe(RECORDED.groups.length + 1);
    const row = rows.find((r) => r.querySelector("th, td")?.textContent?.trim() === silent);
    expect(row).toBeDefined();

    // Every one of its four cells reads unknown.
    const cells = [...(row as HTMLTableRowElement).querySelectorAll("td")];
    expect(cells.length).toBe(DESIGN_METRICS.length);
    for (const cell of cells) {
      expect(cell.textContent?.trim()).toBe("unknown");
      expect(cell.querySelector(".unknown")).not.toBeNull();
    }

    cleanup(container);
  });
});
