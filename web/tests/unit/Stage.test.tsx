/// <reference types="vite/client" />
/**
 * The stage: header, metrics, ranks, and the empty case (005 US3-S1, S2, S4 —
 * FR-010, FR-011, FR-013).
 *
 * **Succeeds `tests/unit/EpicStage.test.tsx`**, deleted in this story's diff.
 * That file asserted the first world's stage — a React Flow surface per running
 * epic, sized from `stageHeight()`, with a landing line beside it. Its subject
 * is deleted by D-015 and by T016, and the two guarantees inside it that
 * outlive the room are re-asserted here against the rebuilt component: an epic
 * with no nodes renders no canvas at all (004's FR-001, below as "no canvas at
 * all"), and the graph is drawn from the declared work graph rather than from a
 * shape the pane chose (below as the rank cases, over recorded workgraphs).
 *
 * The graphs are recorded: `fixtures/workgraphs/` holds the two-node epic with
 * one merge edge and the five-node one carrying both edge kinds, read through
 * Vite's `?raw` import and never edited (constitution V). The rollup and the
 * floor's pace section are the Fixture floor's own recordings too, which is
 * what makes the spend cell's `$0.00` and its `unknown` both facts rather than
 * fixtures written to suit the assertion.
 */

import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Stage, {
  edgesOf,
  epicSpend,
  formatDuration,
  lastStoryWallClock,
  ranksOf,
  requirementCount,
} from "../../src/showfloor/Stage";
import type { FloorDocument } from "../../src/api/floorDocument";

import twoNodeRaw from "../../../fixtures/workgraphs/002-expense-notes.json?raw";
import fiveNodeRaw from "../../../fixtures/workgraphs/077-a-scanner-the-operator-chooses-runs-in-the-loop.json?raw";
import floorLiveRaw from "../../../fixtures/floor/floor-live.json?raw";
import rollupByNodeRaw from "../../../fixtures/usage/rollup-by-node.json?raw";
import rollupByPersonaRaw from "../../../fixtures/usage/rollup-by-persona.json?raw";
import {
  entryFromWorkgraph,
  entryOf,
  ladderOf,
  storylessEntry,
} from "./support/showfloor-builder";

const recordedFloor = JSON.parse(floorLiveRaw) as Record<string, unknown>;
const rollupByNode = JSON.parse(rollupByNodeRaw) as Record<string, unknown>;
const rollupByPersona = JSON.parse(rollupByPersonaRaw) as Record<string, unknown>;

/** The floor document 001 serves, carrying the recorded floor and rollup. */
function floorDocument(rollup: unknown = rollupByNode): FloorDocument {
  return {
    reference_instant: null,
    floor: { seam: "factory.cli.status.collect_floor", data: recordedFloor },
    epics: [],
    attention: { seam: "open_escalations", items: [] },
    health: { seam: "list_findings", data: null },
    spend_to_date: { seam: "rollup", data: rollup },
    degraded: [],
  };
}

const containers: HTMLElement[] = [];

function render(node: JSX.Element): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  act(() => {
    createRoot(container).render(node);
  });
  return container;
}

function text(container: HTMLElement, selector: string): string {
  const element = container.querySelector(selector);
  expect(element, `${selector} is on the stage`).not.toBeNull();
  return (element!.textContent ?? "").trim();
}

function metric(container: HTMLElement, label: string): string {
  return text(container, `[data-metric="${label}"] [data-metric-value]`);
}

describe("the stage header and its metrics (FR-010)", () => {
  it("shows the mono id, the serif name and the live story's chip", () => {
    // The epic's word is the backend's — `_rail_chip` already ranked the
    // operator's priorities — and the head wears the same object the rail row
    // does rather than ranking it a second time (plan D2).
    const entry = entryFromWorkgraph(
      fiveNodeRaw,
      {
        us1: ladderOf({ state: "MERGED", stopKey: "merged", chip: "merged", done: true }),
        us2: ladderOf({ state: "RUNNING", stopKey: "building", chip: "building" }),
      },
      { chip: "building" },
    );
    const container = render(<Stage entry={entry} floor={floorDocument()} />);

    // § Stage: "`display` id + `name` + the live story's chip".
    expect(text(container, "[data-stage-id]")).toBe("077");
    expect(text(container, "[data-stage-name]")).toBe(entry.name);

    const chip = container.querySelector("[data-stage-chip]");
    expect(chip).not.toBeNull();
    expect((chip!.textContent ?? "").trim()).toBe("building 1/5");
    // The word is on the element: state is never colour alone (§ Named Rules).
    expect(chip!.getAttribute("data-chip-tone")).toBe("building");
  });

  it("counts stories, merged and FRs from the document alone", () => {
    const entry = entryFromWorkgraph(fiveNodeRaw, {
      us1: ladderOf({ state: "MERGED", stopKey: "merged", chip: "merged", done: true }),
      us2: ladderOf({ state: "MERGED", stopKey: "merged", chip: "merged", done: true }),
    });
    const container = render(<Stage entry={entry} floor={floorDocument()} />);

    expect(metric(container, "stories")).toBe("5");
    expect(metric(container, "merged")).toBe("2");

    // The recorded graph's five stories carry FR-001 … FR-025, and each node's
    // own `US<n>` key is not one of its requirements.
    expect(metric(container, "FRs")).toBe("25");
    expect(requirementCount(entry.stories)).toEqual({ known: true, text: "25" });
  });

  it("reads the last story's wall clock off the floor's own pace, or says unknown", () => {
    // The recorded live floor paced `002-expense-notes`: one attempt on `us1`,
    // four seconds. Nothing else on that floor was paced.
    const paced = entryFromWorkgraph(twoNodeRaw);
    expect(paced.epic_id).toBe("002-expense-notes");
    const container = render(<Stage entry={paced} floor={floorDocument()} />);
    expect(metric(container, "last story")).toBe("4s");
    expect(lastStoryWallClock(floorDocument(), "002-expense-notes")).toEqual({
      known: true,
      text: "4s",
    });

    // An epic the floor never paced has no wall clock to show, and the cell
    // says so rather than showing a zero the factory never measured.
    expect(lastStoryWallClock(floorDocument(), "077-a-scanner")).toEqual({ known: false });
    const unpaced = render(
      <Stage entry={entryFromWorkgraph(fiveNodeRaw)} floor={floorDocument()} />,
    );
    expect(metric(unpaced, "last story")).toBe("unknown");
    expect(unpaced.querySelector('[data-metric="last story"] .unknown')).not.toBeNull();
  });

  it("obeys the Unknown Rule on spend: unknown, never 0, and 'live' nowhere", () => {
    // The node rollup carries this epic's two rows, both a real recorded
    // `spend_usd: 0.0` — no persona in this build routes to a metered provider
    // (D-011) — so the cell reads the sum, not the word.
    const entry = entryFromWorkgraph(twoNodeRaw);
    const known = render(<Stage entry={entry} floor={floorDocument(rollupByNode)} />);
    expect(metric(known, "spend to date")).toBe("$0.00");
    expect(known.querySelector('[data-metric="spend to date"] .unknown')).toBeNull();

    // The persona rollup 001 serves carries no row for any epic, so this epic's
    // spend is not in it. The floor's whole total is not this epic's spend, and
    // the cell says unknown rather than borrowing it.
    const borrowed = render(<Stage entry={entry} floor={floorDocument(rollupByPersona)} />);
    expect(metric(borrowed, "spend to date")).toBe("unknown");

    // A read that failed leaves `spend_to_date.data` null; so does having no
    // floor document at all. Both are unknown, and neither is `0`.
    expect(epicSpend(null, "002-expense-notes")).toEqual({ known: false });
    const unread = render(<Stage entry={entry} floor={floorDocument(null)} />);
    expect(metric(unread, "spend to date")).toBe("unknown");
    const noFloor = render(<Stage entry={entry} floor={null} />);
    expect(metric(noFloor, "spend to date")).toBe("unknown");

    // A NULL among this epic's own rows makes the total unknown: "a total is
    // unknown when any row in scope is" (§ The Unknown Rule).
    expect(
      epicSpend(
        {
          groups: [
            { key: "002-expense-notes:us1", spend_usd: 1.5 },
            { key: "002-expense-notes:us2", spend_usd: null },
          ],
        },
        "002-expense-notes",
      ),
    ).toEqual({ known: false });

    // And the word "live" appears nowhere near spend, in any of these renders.
    for (const container of [known, borrowed, unread, noFloor]) {
      const cell = container.querySelector('[data-metric="spend to date"]')!;
      expect((cell.textContent ?? "").toLowerCase()).not.toContain("live");
      expect((cell.textContent ?? "").trim()).not.toBe("0");
    }
  });

  it("says unknown rather than zero when the corpus declared no stories", () => {
    const container = render(<Stage entry={storylessEntry("007-a-spec")} floor={null} />);
    expect(metric(container, "stories")).toBe("unknown");
    expect(metric(container, "merged")).toBe("unknown");
    expect(metric(container, "FRs")).toBe("unknown");
  });

  it("formats a duration the way the stage says it", () => {
    expect(formatDuration(4)).toBe("4s");
    expect(formatDuration(59)).toBe("59s");
    expect(formatDuration(1140)).toBe("19m");
    expect(formatDuration(4800)).toBe("1h 20m");
  });
});

describe("the graph lays ranks left to right (FR-011)", () => {
  it("ranks the recorded graphs by declared dependency, in declaration order", () => {
    // The two-node graph is a chain: `us2` waits on `us1` merging.
    const two = ranksOf(entryFromWorkgraph(twoNodeRaw).stories);
    expect(two.map((rank) => rank.map((story) => story.id))).toEqual([["us1"], ["us2"]]);

    // The five-node one forks: `us1` and `us2` share the first rank, then the
    // chain us3 → us4 → us5 runs out to the right. `us4` waits on `us3` by pass
    // and on `us2` by merge, and the deeper of the two is what places it.
    const five = ranksOf(entryFromWorkgraph(fiveNodeRaw).stories);
    expect(five.map((rank) => rank.map((story) => story.id))).toEqual([
      ["us1", "us2"],
      ["us3"],
      ["us4"],
      ["us5"],
    ]);
  });

  it("draws a rank column per rank, and the two fixtures differ as declared", () => {
    const two = render(<Stage entry={entryFromWorkgraph(twoNodeRaw)} floor={null} />);
    const five = render(<Stage entry={entryFromWorkgraph(fiveNodeRaw)} floor={null} />);

    expect(two.querySelectorAll("[data-node-card]").length).toBe(2);
    expect(five.querySelectorAll("[data-node-card]").length).toBe(5);

    // The rank count is the workgraph's, not the node count's: five nodes in
    // four ranks because two of them are declared concurrent.
    expect(two.querySelectorAll("[data-rank]").length).toBe(2);
    expect(five.querySelectorAll("[data-rank]").length).toBe(4);

    // Left to right in declaration order: the DOM order of the ranks is the
    // rank order, and within a rank the workgraph's own order survives.
    const ranks = Array.from(five.querySelectorAll("[data-rank]"));
    expect(ranks.map((rank) => rank.getAttribute("data-rank"))).toEqual(["0", "1", "2", "3"]);
    expect(
      Array.from(ranks[0].querySelectorAll("[data-node-card]")).map((card) =>
        card.getAttribute("data-story-id"),
      ),
    ).toEqual(["us1", "us2"]);
  });

  it("tells the two edge kinds apart, and draws none to a story it does not have", () => {
    const five = edgesOf(entryFromWorkgraph(fiveNodeRaw).stories);
    expect(five).toEqual([
      { source: "us2", target: "us3", kind: "pass" },
      { source: "us2", target: "us4", kind: "merge" },
      { source: "us3", target: "us4", kind: "pass" },
      { source: "us4", target: "us5", kind: "pass" },
    ]);

    // The recorded two-node graph declares one merge edge and no pass edge.
    expect(edgesOf(entryFromWorkgraph(twoNodeRaw).stories)).toEqual([
      { source: "us1", target: "us2", kind: "merge" },
    ]);

    // A dependency on a story this graph does not carry — a graph read that
    // came back short — draws nothing rather than a wire from nowhere.
    const dangling = entryOf({
      spec_dir: "009-short-read",
      stories: [
        {
          ...entryFromWorkgraph(twoNodeRaw).stories[1],
          depends_on_merged: ["us1"],
        },
      ],
    });
    expect(edgesOf(dangling.stories)).toEqual([]);
  });
});

describe("a stage with no nodes has no canvas (FR-013)", () => {
  it("renders the epic's notice and no stage canvas element at all", () => {
    const container = render(<Stage entry={storylessEntry("007-a-spec")} floor={null} />);

    // The assertion 004's FR-001 made, restated on the rebuilt component: the
    // canvas is *absent from the DOM*, not present and empty, and not hidden.
    expect(container.querySelector("[data-stage-canvas]")).toBeNull();
    expect(container.querySelector("[data-wires]")).toBeNull();
    expect(container.querySelector("[data-ranks]")).toBeNull();
    expect(container.querySelectorAll("[data-node-card]").length).toBe(0);

    const notice = container.querySelector("[data-stage-empty]");
    expect(notice).not.toBeNull();
    expect(notice!.textContent).toContain("declares no work graph");

    // The head still names what is on stage: an epic with nothing staged is a
    // line of text, not a blank column (§ Stage).
    expect(text(container, "[data-stage-id]")).toBe("007");
  });

  it("names the reads that failed, and does not blame the corpus for them", () => {
    const entry = entryOf({
      spec_dir: "008-unread",
      notes: [{ read: "workgraph", mode: "transport", detail: "connection refused" }],
      unknown: ["stories"],
    });
    const container = render(<Stage entry={entry} floor={null} />);

    expect(container.querySelector("[data-stage-canvas]")).toBeNull();
    const note = container.querySelector('[data-stage-note][data-mode="transport"]');
    expect(note).not.toBeNull();
    // The factory's own words, kept: transport told apart from refusal.
    expect(note!.textContent).toContain("connection refused");
    expect(text(container, "[data-stage-empty]")).toContain("No story could be read");
  });

  it("keeps the canvas when there is a graph to draw", () => {
    const container = render(<Stage entry={entryFromWorkgraph(twoNodeRaw)} floor={null} />);
    expect(container.querySelector("[data-stage-canvas]")).not.toBeNull();
    expect(container.querySelector("[data-stage-empty]")).toBeNull();
  });
});
