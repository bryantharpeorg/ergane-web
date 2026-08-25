/**
 * The detail pane, over four recorded stories (005 US4-S1, FR-015).
 *
 * The four the scenario names — merged, building, waiting and ready — and the
 * two the floor also really holds: a killed story, whose ladder is frozen, and
 * a story whose graph declared it but whose epic answered nothing for it.
 *
 * **The facts are recorded, not written here** (constitution V). Every `facts`
 * object below is lifted field for field out of a committed `epic_status`
 * answer under `fixtures/epic-status/`, and every `requirement_keys` list out
 * of a committed workgraph — so the pane is proven against attempt counts,
 * verdicts, PR numbers and landing instants the factory really wrote, including
 * the ones it wrote as `null`. What is composed here is only this repository's
 * own join of them, which is `support/showfloor-builder.ts`'s whole reason to
 * exist and is where `US1`'s `tests/test_showfloor_document.py` proves the join
 * itself.
 *
 * The ladder is not asserted to be *derived* here — it is not derived here
 * (plan D2). What is asserted is the pane's half: that the six stops arrive
 * named, that the ones the factory stamped carry their instant, that an absent
 * value is an em dash and never a zero, and that a story with no selection
 * leaves the room explained rather than blank.
 */

/// <reference types="vite/client" />
import { afterEach, describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import DetailPane, {
  ABSENT,
  factsOf,
  judgeFact,
  mergedAt,
  prFact,
  stampOf,
  stepsOf,
  wallClockFact,
} from "../../src/showfloor/DetailPane";
import type { FloorDocument } from "../../src/api/floorDocument";
import type { Ladder, ShowfloorStory } from "../../src/api/showfloorDocument";
import { ladderOf, storyOf } from "./support/showfloor-builder";

import landedRaw from "../../../fixtures/epic-status/landing/13-RUNNING_us1-MERGED_us2-MERGED_us3-ENQUEUED.json?raw";
import pagedRaw from "../../../fixtures/epic-status/paged/paged-live.json?raw";
import buildingRaw from "../../../fixtures/epic-status/002-expense-notes/002-expense-notes-003-us1=MERGED-MERGED_us2=RUNNING.json?raw";
import killedRaw from "../../../fixtures/epic-status/killed/killed.json?raw";
import floorLiveRaw from "../../../fixtures/floor/floor-live.json?raw";
import workgraphRaw from "../../../fixtures/workgraphs/001-trip-expenses.json?raw";
import showfloorCss from "../../src/showfloor/showfloor.css?raw";

/* ── the recorded halves ───────────────────────────────────────────────── */

/** The live fields `pane/showfloor.py`'s `LIVE_FACTS` copies onto a story. */
const LIVE_FACTS = [
  "state",
  "attempt",
  "awaiting_operator",
  "terminal_reason",
  "landing_state",
  "pr_number",
  "verified",
  "branch",
  "persona",
  "history",
  "landing_history",
] as const;

/** One recorded `epic_status` node, as the document's `facts` object. */
function factsFrom(raw: string, nodeId: string): Record<string, unknown> {
  const document = JSON.parse(raw) as { nodes: Record<string, Record<string, unknown>> };
  const node = document.nodes[nodeId];
  expect(node, `${nodeId} is a node of this recorded answer`).toBeDefined();

  const facts: Record<string, unknown> = {};
  for (const field of LIVE_FACTS) facts[field] = field in node ? node[field] : null;
  return facts;
}

/** The requirement keys a recorded workgraph declared for one story. */
function keysFrom(raw: string, nodeId: string): string[] {
  const graph = JSON.parse(raw) as {
    nodes: Array<{ id: string; requirement_keys?: string[] }>;
  };
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  expect(node, `${nodeId} is a node of this recorded graph`).toBeDefined();
  return node!.requirement_keys ?? [];
}

/** One story of the document: recorded facts and keys, this repo's own join. */
function story(
  id: string,
  title: string,
  ladder: Ladder,
  facts: Record<string, unknown>,
  overrides: Partial<ShowfloorStory> = {},
): ShowfloorStory {
  return {
    ...storyOf(id, title, ladder),
    intent: "The pane tells one story whole.",
    requirement_keys: keysFrom(workgraphRaw, id),
    facts,
    ...overrides,
  };
}

/** MERGED, PR #486, landed at a recorded instant. */
const mergedStory = story(
  "us1",
  "The Desk sees the floor",
  ladderOf({ state: "MERGED", specState: "ready", stopKey: "merged", chip: "merged", done: true }),
  factsFrom(landedRaw, "us1"),
);

/** RUNNING on its first attempt, no landing yet. */
const buildingStory = story(
  "us2",
  "The Showfloor stages an epic",
  ladderOf({ state: "RUNNING", specState: "ready", stopKey: "building", chip: "building" }),
  factsFrom(buildingRaw, "us2"),
);

/** VERIFYING with `awaiting_operator` true, six recorded FAIL attempts. */
const waitingStory = story(
  "us1",
  "An answer reaches the factory",
  ladderOf({
    state: "WAITING_OPERATOR",
    specState: "ready",
    stopKey: "building",
    chip: "waiting on you",
    awaiting: true,
  }),
  factsFrom(pagedRaw, "us1"),
);

/** PENDING: attempt 0, no history, no landing — every fact an absence. */
const readyStory = story(
  "us2",
  "The pane fits the screen",
  ladderOf({ state: "PENDING", specState: "ready", stopKey: "ready", chip: "ready" }),
  factsFrom(pagedRaw, "us2"),
);

/** KILLED after six attempts: the ladder freezes and carries the reason. */
const killedStory = story(
  "us1",
  "A story that died",
  ladderOf({
    state: "KILLED",
    specState: "ready",
    stopKey: null,
    chip: "killed",
    frozen: true,
    terminalReason: "operator killed the epic",
  }),
  factsFrom(killedRaw, "us1"),
);

const recordedFloor = JSON.parse(floorLiveRaw) as Record<string, unknown>;

/** The floor document 001 serves, carrying the recorded floor. */
const floorDocument: FloorDocument = {
  reference_instant: null,
  floor: { seam: "factory.cli.status.collect_floor", data: recordedFloor },
  epics: [],
  attention: { seam: "open_escalations", items: [] },
  health: { seam: "list_findings", data: null },
  spend_to_date: { seam: "rollup", data: null },
  degraded: [],
};

/* ── rendering ─────────────────────────────────────────────────────────── */

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

afterEach(() => {
  for (const container of containers.splice(0)) container.remove();
});

/** Every step, as `[name, state, stamp]`. */
function steps(container: HTMLElement): Array<[string, string, string]> {
  return Array.from(container.querySelectorAll("[data-detail-steps] li")).map((li) => [
    (li.querySelector("[data-step-name]")?.textContent ?? "").trim(),
    li.getAttribute("data-step-status") ?? "",
    (li.querySelector("[data-step-when]")?.textContent ?? "").trim(),
  ]);
}

/** The facts grid, label → what the pane printed. */
function facts(container: HTMLElement): Record<string, string> {
  const grid: Record<string, string> = {};
  for (const cell of container.querySelectorAll("[data-fact]")) {
    grid[cell.getAttribute("data-fact") as string] = (cell.textContent ?? "").trim();
  }
  return grid;
}

function chips(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("[data-fr-chip]")).map(
    (chip) => (chip.textContent ?? "").trim(),
  );
}

/* ── the tests ─────────────────────────────────────────────────────────── */

describe("the pane tells the selected story whole (FR-015)", () => {
  it("a merged story: id, serif title, intent, six done steps, its landing instant", () => {
    const container = render(<DetailPane story={mergedStory} />);

    expect(container.querySelector("[data-detail-id]")!.textContent).toBe("US1");
    expect(container.querySelector("[data-detail-title]")!.textContent).toBe(
      "The Desk sees the floor",
    );
    expect(container.querySelector("[data-detail-intent]")!.textContent).toBe(
      "The pane tells one story whole.",
    );

    // The six stops, named and in order — never five, never seven.
    expect(steps(container).map(([name]) => name)).toEqual([
      "ready",
      "building",
      "verifying",
      "pr open",
      "queue",
      "merged",
    ]);
    expect(steps(container).map(([, status]) => status)).toEqual(Array(6).fill("done"));

    // The one instant the factory recorded for this story, at the stop it
    // recorded it for. `17:40:54Z` is in the committed answer, byte for byte.
    expect(steps(container)[5][2]).toBe("17:40 UTC");
    // Every other done stop was never stamped, and says so rather than
    // borrowing the merge's clock.
    expect(steps(container).slice(0, 5).map(([, , when]) => when)).toEqual(Array(5).fill(ABSENT));
  });

  it("a merged story's facts are the recorded answer's own", () => {
    const grid = facts(render(<DetailPane story={mergedStory} />));

    expect(grid.attempt).toBe("1");
    expect(grid.judge).toBe("PASS");
    expect(grid.pr).toBe("#486 · merged");
    expect(grid.landed).toBe("17:40 UTC");
    // No pace was recorded for this epic on the floor: unknown, not zero.
    expect(grid["wall clock"]).toBe(ABSENT);
  });

  it("a building story marks the active step and leaves the rest pending", () => {
    const container = render(<DetailPane story={buildingStory} />);

    expect(steps(container).map(([, status]) => status)).toEqual([
      "done",
      "active",
      "ahead",
      "ahead",
      "ahead",
      "ahead",
    ]);
    // "pending steps in `--faint`" — the class the token is authored against.
    const classes = Array.from(container.querySelectorAll("[data-detail-steps] li")).map(
      (li) => li.className,
    );
    expect(classes).toEqual(["done", "now", "pending", "pending", "pending", "pending"]);

    // Nothing ahead of the work is stamped: there is nothing to stamp.
    expect(steps(container).slice(2).map(([, , when]) => when)).toEqual(Array(4).fill(""));

    const grid = facts(container);
    expect(grid.attempt).toBe("1");
    expect(grid.pr).toBe(ABSENT);
    expect(grid.landed).toBe(ABSENT);
  });

  it("a waiting story turns its stop gold and keeps the judge's own words", () => {
    const container = render(<DetailPane story={waitingStory} />);

    expect(steps(container)[1][1]).toBe("waiting");
    expect(
      container.querySelector('[data-detail-steps] li[data-step-status="waiting"]')!.className,
    ).toBe("hold");

    const grid = facts(container);
    // Six recorded attempts, and the last one's verdict and ruling verbatim.
    expect(grid.attempt).toBe("6");
    expect(grid.judge).toBe("FAIL · RETRY");
    expect(grid.pr).toBe(ABSENT);
  });

  it("a ready story's every fact is an em dash, and never a zero", () => {
    const container = render(<DetailPane story={readyStory} />);
    const grid = facts(container);

    // `attempt: 0` is the factory saying "not attempted" — an absence.
    expect(readyStory.facts.attempt).toBe(0);
    expect(Object.values(grid)).toEqual(Array(5).fill(ABSENT));
    expect(Object.values(grid)).not.toContain("0");

    expect(steps(container).map(([, status]) => status)).toEqual([
      "active",
      "ahead",
      "ahead",
      "ahead",
      "ahead",
      "ahead",
    ]);
  });

  it("a frozen ladder carries the factory's terminal reason verbatim", () => {
    const container = render(<DetailPane story={killedStory} />);

    expect(container.querySelector("[data-detail-terminal]")!.textContent).toBe(
      "operator killed the epic",
    );
    expect(steps(container).map(([, status]) => status)).toEqual(Array(6).fill("frozen"));
    // It reached no stop, so no stop is stamped — and the six still read.
    expect(steps(container).map(([name]) => name)).toContain("merged");
  });

  it("lists the requirement keys as chips, one per key, counted in the heading", () => {
    const container = render(<DetailPane story={mergedStory} />);

    // The recorded graph's own list for us1, in its own order.
    expect(chips(container)).toEqual(["US1", "FR-001", "FR-003", "FR-005", "FR-020", "FR-021"]);
    expect(container.querySelector("[data-detail-implements-head]")!.textContent).toBe(
      "implements · 6 keys",
    );
  });

  it("says so when the graph declared no keys, rather than showing an empty row", () => {
    const container = render(
      <DetailPane story={{ ...mergedStory, requirement_keys: [] }} />,
    );

    expect(chips(container)).toEqual([]);
    expect(container.querySelector("[data-detail-no-keys]")).not.toBeNull();
    expect(container.querySelector("[data-detail-implements-head]")!.textContent).toBe(
      "implements · 0 keys",
    );
  });

  it("says so when the spec recorded no intent for a story", () => {
    const container = render(<DetailPane story={{ ...mergedStory, intent: "" }} />);
    const intent = container.querySelector("[data-detail-intent]")!;

    expect(intent.textContent).toBe("the spec records no intent for this story");
    expect(intent.querySelector(".unknown")).not.toBeNull();
  });

  it("reads the wall clock off the floor's own pace measurement", () => {
    // `floor-live.json` records one attempt of `002-expense-notes/us1`, 4s.
    const paced = story(
      "us1",
      "a paced story",
      ladderOf({ state: "ENQUEUED", stopKey: "queue", chip: "queue" }),
      factsFrom(buildingRaw, "us1"),
    );
    const container = render(
      <DetailPane story={paced} epicId="002-expense-notes" floor={floorDocument} />,
    );

    expect(facts(container)["wall clock"]).toBe("4s");
    // And a story the pace never named keeps its absence.
    expect(wallClockFact(floorDocument, "002-expense-notes", "us2")).toBeNull();
    expect(wallClockFact(null, "002-expense-notes", "us1")).toBeNull();
  });
});

describe("the empty pane explains the room (FR-015, FR-016)", () => {
  it("is two sentences, and the region is polite", () => {
    const container = render(<DetailPane story={null} />);

    const pane = container.querySelector("[data-detail]")!;
    expect(pane.getAttribute("aria-live")).toBe("polite");

    const empty = container.querySelector("[data-detail-empty]")!;
    const words = (empty.textContent ?? "").replace(/\s+/g, " ").trim();
    // Two sentences: two full stops, and neither of them ends a fragment.
    expect(words.split(". ").length).toBe(2);
    expect(words.endsWith(".")).toBe(true);
    expect(words).toContain("rail");
    expect(words).toContain("stage");

    // Nothing of a story is rendered where there is no story.
    expect(container.querySelector("[data-detail-steps]")).toBeNull();
    expect(container.querySelector("[data-detail-facts]")).toBeNull();
  });

  it("keeps the live region mounted across a selection, so a change is announced", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const root = createRoot(container);

    act(() => root.render(<DetailPane story={null} />));
    const before = container.querySelector("[data-detail]");

    act(() => root.render(<DetailPane story={mergedStory} />));
    const after = container.querySelector("[data-detail]");

    // The same element, not a replacement: a live region that is unmounted and
    // remounted per story announces nothing at all.
    expect(after).toBe(before);
    expect(after!.getAttribute("aria-live")).toBe("polite");
    expect(container.querySelector("[data-detail-title]")!.textContent).toBe(
      "The Desk sees the floor",
    );
  });
});

describe("the pane carries no verb (FR-017)", () => {
  it("renders no control of any kind, selected or empty", () => {
    for (const selection of [null, mergedStory, waitingStory]) {
      const container = render(<DetailPane story={selection} />);
      expect(container.querySelectorAll("button, form, input, select, textarea").length).toBe(0);
      expect(container.querySelectorAll("a").length).toBe(0);
    }
  });
});

describe("the readings themselves", () => {
  it("stamps the factory's UTC and never the reader's clock", () => {
    expect(stampOf("2026-08-22T17:40:54Z")).toBe("17:40 UTC");
    expect(stampOf("2026-08-22T17:41:05+00:00")).toBe("17:41 UTC");
    // An instant in a shape the pane does not know is shown verbatim, not
    // reformatted into a guess.
    expect(stampOf("some time on Tuesday")).toBe("some time on Tuesday");
  });

  it("finds the merge instant in the recorded landing history, and nowhere else", () => {
    expect(mergedAt(mergedStory)).toBe("2026-08-22T17:40:54Z");
    expect(mergedAt(buildingStory)).toBeNull();
    expect(mergedAt({ ...mergedStory, facts: { landing_history: "not a list" } })).toBeNull();
    expect(mergedAt({ ...mergedStory, facts: {} })).toBeNull();
  });

  it("reads the judge from the last recorded attempt, or reads nothing", () => {
    expect(judgeFact(waitingStory)).toBe("FAIL · RETRY");
    expect(judgeFact(mergedStory)).toBe("PASS");
    expect(judgeFact(readyStory)).toBeNull();
    expect(judgeFact({ ...mergedStory, facts: { history: [{}] } })).toBeNull();
  });

  it("pairs the PR with its landing state, and keeps the absence of one", () => {
    expect(prFact(mergedStory)).toBe("#486 · merged");
    expect(prFact({ ...mergedStory, facts: { pr_number: 20, landing_state: null } })).toBe("#20");
    expect(prFact(readyStory)).toBeNull();
  });

  it("names five facts, in DESIGN.md's order, whatever the answer carried", () => {
    for (const subject of [mergedStory, buildingStory, waitingStory, readyStory, killedStory]) {
      expect(factsOf(subject, null, null).map((fact) => fact.label)).toEqual([
        "attempt",
        "judge",
        "pr",
        "landed",
        "wall clock",
      ]);
    }
  });

  it("expands the document's own six stops and derives none of them", () => {
    // The pane's steps are the document's stops, key for key and status for
    // status: a pane that re-derived a stop could disagree with the card.
    for (const subject of [mergedStory, buildingStory, waitingStory, readyStory, killedStory]) {
      expect(stepsOf(subject).map((step) => step.key)).toEqual(
        subject.ladder.stops.map((stop) => stop.key),
      );
      expect(stepsOf(subject).map((step) => step.status)).toEqual(
        subject.ladder.stops.map((stop) => stop.status),
      );
    }
  });
});

/**
 * The clothing, from the stylesheet the room ships (constitution VIII).
 *
 * The DOM tests above prove which class each step wears; jsdom computes no
 * cascade, so what a class *means* is asserted here against the committed CSS.
 * A rule that stopped naming its token — a step tinted by a hex, or a chip that
 * lost its well — fails, which is what makes "done olive, active accent,
 * waiting gold, pending faint" a fact about the diff and not about a screenshot.
 */
describe("the pane wears DESIGN.md's own tokens (§ The status ladder, § Detail pane)", () => {
  /** The declarations of the first rule whose selector list matches. */
  function rule(selector: string): string {
    const at = showfloorCss.indexOf(selector + " {");
    expect(at, `${selector} is a rule in showfloor.css`).toBeGreaterThan(-1);
    return showfloorCss.slice(at, showfloorCss.indexOf("}", at));
  }

  it("stamps each step's dot with the token its status names", () => {
    expect(rule(".showfloor .detail .steps li.done .dot")).toContain("var(--olive)");
    expect(rule(".showfloor .detail .steps li.now .dot")).toContain("var(--accent)");
    // "a `waiting` step in gold" — and gold is only ever waiting-on-you.
    expect(rule(".showfloor .detail .steps li.hold .dot")).toContain("var(--gold)");
    // An unreached stop rests in the sunken the ladder's own bars rest in.
    expect(rule(".showfloor .detail .steps .dot")).toContain("var(--sunken)");
  });

  it("keeps pending steps faint, and a frozen ladder's with them", () => {
    const faint = rule(".showfloor .detail .steps li.pending,\n.showfloor .detail .steps li.froze");
    expect(faint).toContain("var(--faint)");
  });

  it("sets the requirement keys as sunken mono chips", () => {
    const chip = rule(".showfloor .detail .fr");
    expect(chip).toContain("var(--mono)");
    expect(chip).toContain("var(--sunken)");
    expect(chip).toContain("var(--hairline)");
    // § Shapes: chips are squared. A radius here would be a chip that is not
    // one — and there is none in this rule.
    expect(chip).not.toContain("border-radius");
  });

  it("gives the step name its mono face and the title its serif", () => {
    expect(rule(".showfloor .detail .steps .sname")).toContain("var(--mono)");
    expect(rule(".showfloor .detail .steps .swhen")).toContain("var(--mono)");
    expect(rule(".showfloor .detail .dtitle")).toContain("var(--serif)");
    expect(rule(".showfloor .detail .kv dd")).toContain("var(--mono)");
  });

  it("marks the selected card the way § Shapes marks it, and shows the keyboard", () => {
    const selected = rule(".showfloor .node.sel");
    expect(selected).toContain("var(--accent)");
    expect(selected).toContain("outline: 2px solid");

    const focus = rule(".showfloor .node:focus-visible");
    expect(focus).toContain("outline: 2px solid");
    expect(focus).toContain("var(--accent)");
  });

  it("authors the one motion inside the reduced-motion gate and nowhere else", () => {
    // § Motion: the pulse is the pane's only animation, and it is written
    // *inside* `prefers-reduced-motion: no-preference` so there is no override
    // to forget. Two facts, both from the stylesheet: one `animation:` in the
    // room, and it is inside the gate.
    const animations = [...showfloorCss.matchAll(/\n\s*animation:/g)];
    expect(animations).toHaveLength(1);

    const gate = showfloorCss.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(gate).toBeGreaterThan(-1);
    expect(animations[0].index).toBeGreaterThan(gate);
  });
});
