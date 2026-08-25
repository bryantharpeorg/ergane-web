/**
 * The epic rail (005 US2-S3, FR-008).
 *
 * `DESIGN.md` § Epic rail: one row per spec in directory order — mono id,
 * status chip with the story count, name in muted small beneath; selection is
 * an accent wash and a 3px accent bar; rows are real links. § Chips is the
 * whole vocabulary a chip may come from, and a chip outside it is a defect.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Rail from "../../src/showfloor/Rail";
import type { RailEntry } from "../../src/api/showfloorDocument";
import {
  buildingEntry,
  draftEntry,
  killedEntry,
  landedEntry,
  readyEntry,
  storylessEntry,
  waitingEntry,
} from "./support/showfloor-builder";

const containers: HTMLElement[] = [];

function render(entries: RailEntry[], selected: string | null = null): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  act(() => {
    createRoot(container).render(<Rail entries={entries} selected={selected} />);
  });
  return container;
}

afterEach(() => {
  while (containers.length > 0) {
    const container = containers.pop()!;
    if (container.parentNode) container.parentNode.removeChild(container);
  }
});

const FLOOR: RailEntry[] = [
  landedEntry("001-the-desk-sees-the-floor"),
  landedEntry("002-the-showfloor-stages-an-epic"),
  buildingEntry("003-an-answer-reaches-the-factory", 1, 4),
  readyEntry("004-the-pane-fits-the-screen"),
  draftEntry("005-one-epic-on-stage"),
  storylessEntry("006-a-spec-remembers-its-build"),
];

const rows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("[data-rail-row]"));

const chipOf = (row: Element) => row.querySelector("[data-chip]") as HTMLElement;

describe("the rail renders every spec, in directory order", () => {
  it("keeps the document's order and gives each row its id and name", () => {
    const container = render(FLOOR);
    const rendered = rows(container);

    expect(rendered.length).toBe(FLOOR.length);
    expect(rendered.map((row) => row.getAttribute("data-spec-dir"))).toEqual(
      FLOOR.map((entry) => entry.spec_dir),
    );

    // Mono id — the directory's number, which is what an epic is called.
    expect(
      rendered.map((row) => row.querySelector("[data-rail-id]")?.textContent),
    ).toEqual(["001", "002", "003", "004", "005", "006"]);

    // And the name beneath it, from the document and unedited.
    expect(
      rendered.map((row) => row.querySelector("[data-rail-name]")?.textContent),
    ).toEqual(FLOOR.map((entry) => entry.name));
  });

  it("renders rows as links to the spec's own path, and no control at all", () => {
    const container = render(FLOOR);

    for (const [index, row] of rows(container).entries()) {
      expect(row.tagName).toBe("A");
      expect(row.getAttribute("href")).toBe(`/showfloor/${FLOOR[index].spec_dir}`);
    }

    // Constitution I: the Showfloor never grows a button.
    expect(container.querySelectorAll("button, form, input, select, textarea").length).toBe(0);
  });

  it("renders an empty corpus as a row that says so, not as nothing", () => {
    const container = render([]);
    expect(rows(container).length).toBe(0);
    expect(container.querySelector("[data-rail-empty]")?.textContent).toContain(
      "No spec was read",
    );
  });
});

describe("the chip is § Chips' word, with the story count", () => {
  const CASES: Array<{ entry: RailEntry; text: string; tone: string }> = [
    { entry: landedEntry("001-a", 4), text: "landed 4/4", tone: "landed" },
    { entry: buildingEntry("002-b", 1, 4), text: "building 1/4", tone: "building" },
    { entry: readyEntry("003-c", 4), text: "ready 0/4", tone: "ready" },
    { entry: draftEntry("004-d", 3), text: "draft 0/3", tone: "draft" },
    { entry: waitingEntry("005-e", 4), text: "waiting on you 0/4", tone: "wait" },
    { entry: killedEntry("006-f", 4), text: "killed 0/4", tone: "dead" },
  ];

  for (const { entry, text, tone } of CASES) {
    it(`wears \`${text}\` for a ${tone} spec`, () => {
      const chip = chipOf(rows(render([entry]))[0]);
      expect(chip.textContent).toBe(text);
      expect(chip.getAttribute("data-chip-tone")).toBe(tone);
      // The tone is a class too, because that is what carries § Chips' colours.
      expect(chip.className.split(/\s+/)).toContain(tone);
    });
  }

  it("gives a spec that declares no stories a word and no count", () => {
    const row = rows(render([storylessEntry("007-a-spec-remembers-its-build")]))[0];
    expect(chipOf(row).textContent).toBe("draft");
    expect(chipOf(row).getAttribute("data-chip-tone")).toBe("draft");
    // Constitution III: the emptiness is named, not left to be read as a floor
    // that is quiet.
    expect(row.querySelector("[data-rail-note]")?.textContent).toContain(
      "no stories declared",
    );
  });

  it("says `unknown` rather than inventing a colour for a word it does not know", () => {
    const entry = readyEntry("008-g", 2);
    const row = rows(render([{ ...entry, chip: null }]))[0];
    expect(chipOf(row).textContent).toBe("unknown 0/2");
    expect(chipOf(row).getAttribute("data-chip-tone")).toBe("unknown");
  });

  it("names a degraded read on the row it failed for", () => {
    const entry = readyEntry("009-h", 4);
    const row = rows(
      render([
        {
          ...entry,
          notes: [{ read: "workgraph", mode: "transport", detail: "not recorded yet" }],
        },
      ]),
    )[0];
    expect(row.querySelector("[data-rail-degraded]")?.textContent).toContain("workgraph");
  });
});

describe("selection is one row, marked three ways", () => {
  it("washes, bars and announces exactly the selected row", () => {
    const container = render(FLOOR, "003-an-answer-reaches-the-factory");
    const rendered = rows(container);

    const selected = rendered.filter((row) => row.getAttribute("data-selected") === "true");
    expect(selected.length).toBe(1);
    expect(selected[0].getAttribute("data-spec-dir")).toBe("003-an-answer-reaches-the-factory");

    // `sel` is what § Epic rail's wash and 3px bar hang off, and `aria-current`
    // is what says the same thing to a screen reader.
    expect(selected[0].className.split(/\s+/)).toContain("sel");
    expect(selected[0].getAttribute("aria-current")).toBe("page");

    for (const row of rendered) {
      if (row === selected[0]) continue;
      expect(row.className.split(/\s+/)).not.toContain("sel");
      expect(row.getAttribute("aria-current")).toBeNull();
    }
  });

  it("marks nothing when nothing is selected", () => {
    const container = render(FLOOR, null);
    expect(container.querySelectorAll("[data-selected='true']").length).toBe(0);
  });
});
