/**
 * One epic, one row — content, ladder reuse, and the terminal case
 * (006 US2-S1, US2-S2, US2-S4; FR-004, FR-005, FR-007).
 *
 * **Succeeds `tests/unit/NodeChevron.test.tsx`**, deleted in this story's diff
 * along with its subject, and the milestone-bar world with it. That file
 * asserted four things about the first world's per-story glyph, and all four
 * are re-asserted here against the cell that replaced it — the last describe
 * block names them one by one. What it cannot re-assert is the glyph's *eleven
 * distinct fills*: D-015 retired the fills for § Chips' words, so eleven states
 * now reach nine words, and what is proven instead is that all eleven reach the
 * row, each keeping its own `data-state` and each carrying a word (§ Named
 * Rules: state is never colour alone).
 *
 * **The floor and the document, paired two ways.** The recorded Fixture floor
 * was captured against another repository (`fixtures/floor/floor-live.json`
 * carries `ergane-test`'s specs root), so under `PANE_DEMO=1` no rail entry
 * answers for its epics and the honest render is the one with no ladders. Both
 * pairings are asserted here: the joined one, which is what an operator's own
 * floor produces and what FR-004 describes, and the unjoined one, which is what
 * the demo shows and where FR-005's "derives nothing" has teeth — a row that
 * quietly made a ladder up would be indistinguishable from a joined row.
 *
 * Every node state, `awaiting_operator` flag and `terminal_reason` below is
 * read out of a recorded `epic_status` answer under `fixtures/`; nothing about
 * the factory is invented (constitution V). The *ladders* are built with
 * `support/showfloor-builder.ts`, which is this repository's own join of those
 * recordings and is where 005 and 008 already build them.
 */

import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import EpicRow, { entryForEpic, storyForCard, terminalReasons } from "../../src/desk/EpicRow";
import type { EpicEntry, NodeCard, NodeState } from "../../src/api/floorDocument";
import type { RailEntry, ShowfloorDocument } from "../../src/api/showfloorDocument";
import { entryOf, ladderOf, storyOf } from "./support/showfloor-builder";

import polledRaw from "../../../fixtures/epic-status/002-expense-notes/002-expense-notes-013-us1=MERGED-MERGED_us2=MERGED-MERGED.json?raw";
import landingRaw from "../../../fixtures/epic-status/landing/final.json?raw";
import pagedRaw from "../../../fixtures/epic-status/paged/paged.json?raw";
import questionRaw from "../../../fixtures/epic-status/question/waiting-operator.json?raw";
import skewRaw from "../../../fixtures/epic-status/skew/status-names-us3.json?raw";
import killedRaw from "../../../fixtures/epic-status/killed/killed.json?raw";
import scannerGraphRaw from "../../../fixtures/workgraphs/077-a-scanner-the-operator-chooses-runs-in-the-loop.json?raw";

/* ── the recorded halves ───────────────────────────────────────────────── */

interface LiveNode {
  state: string;
  awaiting_operator?: boolean;
  terminal_reason?: string | null;
}

/** The `nodes` map of one recorded `epic_status` answer. */
function recorded(raw: string): Record<string, LiveNode> {
  return (JSON.parse(raw) as { nodes?: Record<string, LiveNode> }).nodes ?? {};
}

/** One node card of the floor document, as `pane/floor_document.py` joins it. */
function cardOf(id: string, live: LiveNode | null, storyKey: string | null): NodeCard {
  return {
    id,
    declared: storyKey !== null,
    story_key: storyKey,
    persona: "implementer",
    spec_ref: null,
    depends_on: null,
    depends_on_merged: null,
    state: (live?.state ?? "unknown") as NodeState,
    attempt: 1,
    awaiting_operator: live?.awaiting_operator ?? false,
    landing_state: null,
    pr_number: null,
    verified: false,
  };
}

function epicOf(
  epicId: string,
  scene: string,
  epicState: string,
  cards: NodeCard[],
): EpicEntry {
  return {
    epic_id: epicId,
    workflow_id: `epic-${epicId}`,
    scene,
    epic_state: epicState,
    nodes: cards,
    status_seam: "EpicWorkflow.epic_status",
    workgraph_seam: "workgraph",
  };
}

/** Every node id the recorded scanner workgraph declares, in its own order. */
const SCANNER_STORIES = (
  JSON.parse(scannerGraphRaw) as { nodes: { id: string; story_key?: string | null }[] }
).nodes.map((node) => ({ id: node.id, key: node.story_key ?? node.id.toUpperCase() }));

/**
 * The six epics the Fixture floor serves, in the order it serves them
 * (`pane/fixture_floor.py`'s `SCENES`): the polled epic whose two stories
 * merged, the landing epic whose three did, the paged one, the one waiting on
 * an answer, the scanner whose status read was refused so every story's state
 * is `unknown`, and the skew scene where the answer names a story the graph
 * does not.
 */
const FIXTURE_EPICS: EpicEntry[] = [
  epicOf("002-expense-notes", "polled", "COMPLETED", [
    cardOf("us1", recorded(polledRaw).us1, "US1"),
    cardOf("us2", recorded(polledRaw).us2, "US2"),
  ]),
  epicOf("fx-landing-f0a0d6", "landing", "COMPLETED", [
    cardOf("us1", recorded(landingRaw).us1, null),
    cardOf("us2", recorded(landingRaw).us2, null),
    cardOf("us3", recorded(landingRaw).us3, null),
  ]),
  epicOf("fx-paged-5e2e8a", "paged-while-verifying", "RUNNING", [
    cardOf("us1", recorded(pagedRaw).us1, null),
  ]),
  epicOf("fx-question-e8c371", "question", "PAUSED", [
    cardOf("us1", recorded(questionRaw).us1, null),
  ]),
  epicOf(
    "077-a-scanner-the-operator-chooses-runs-in-the-loop",
    "refusal",
    "unknown",
    SCANNER_STORIES.map((story) => cardOf(story.id, null, story.key)),
  ),
  epicOf("fx-landing-f0a0d6", "skew", "COMPLETED", [
    cardOf("us1", recorded(skewRaw).us1, "US1"),
    cardOf("us2", recorded(skewRaw).us2, "US2"),
    cardOf("us3", recorded(skewRaw).us3, null),
  ]),
];

/* ── the document that answers for them ────────────────────────────────── */

/** A landed story: all six stops done, `merged` in the chip. */
const merged = (id: string) =>
  storyOf(id, `story ${id}`, ladderOf({ state: "MERGED", stopKey: "merged", chip: "merged", done: true }));

/**
 * One rail entry per epic id, as `assemble_showfloor` builds it for a corpus
 * and a floor of the same repository — the pairing FR-004 describes and the
 * one an operator's own Desk has.
 */
const RAIL: RailEntry[] = [
  entryOf({
    spec_dir: "002-expense-notes",
    epic_id: "002-expense-notes",
    state: "ready",
    chip: "landed",
    stories_landed: 2,
    stories_total: 2,
    stories: [merged("us1"), merged("us2")],
  }),
  entryOf({
    spec_dir: "fx-landing-f0a0d6",
    epic_id: "fx-landing-f0a0d6",
    state: "ready",
    chip: "landed",
    stories_landed: 3,
    stories_total: 3,
    stories: [merged("us1"), merged("us2"), merged("us3")],
  }),
  entryOf({
    spec_dir: "fx-paged-5e2e8a",
    epic_id: "fx-paged-5e2e8a",
    state: "ready",
    chip: "waiting on you",
    stories_landed: 0,
    stories_total: 1,
    stories: [
      storyOf(
        "us1",
        "the paged story",
        ladderOf({
          state: "VERIFYING",
          stopKey: "verifying",
          chip: "waiting on you",
          awaiting: true,
        }),
      ),
    ],
  }),
  entryOf({
    spec_dir: "fx-question-e8c371",
    epic_id: "fx-question-e8c371",
    state: "ready",
    chip: "waiting on you",
    stories_landed: 0,
    stories_total: 1,
    stories: [
      storyOf(
        "us1",
        "the story that asked",
        ladderOf({
          state: "WAITING_OPERATOR",
          stopKey: "building",
          chip: "waiting on you",
          awaiting: true,
        }),
      ),
    ],
  }),
  entryOf({
    spec_dir: "077-a-scanner-the-operator-chooses-runs-in-the-loop",
    epic_id: "077-a-scanner-the-operator-chooses-runs-in-the-loop",
    state: "ready",
    // The status read was refused, so the document has no state to report and
    // says so in the chip's absence rather than in a word of its own.
    chip: null,
    stories_landed: 0,
    stories_total: SCANNER_STORIES.length,
    stories: SCANNER_STORIES.map((story) =>
      storyOf(story.id, `story ${story.id}`, ladderOf({ state: null, stopKey: null, chip: null })),
    ),
  }),
];

const showfloor: ShowfloorDocument = {
  reference_instant: "2026-08-22T17:20:00",
  specs_root: "specs",
  rail: RAIL,
  degraded: [],
};

/** What the demo really serves: a document whose rail answers for no epic. */
const unjoined: ShowfloorDocument = {
  ...showfloor,
  rail: RAIL.map((entry) => entryOf({ ...entry, epic_id: null })),
};

/* ── rendering ─────────────────────────────────────────────────────────── */

const containers: HTMLElement[] = [];

function render(epic: EpicEntry, document_: ShowfloorDocument | null = showfloor): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  act(() => {
    createRoot(container).render(<EpicRow epic={epic} showfloor={document_} />);
  });
  return container;
}

const stories = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("[data-story]"));
const stops = (element: Element) =>
  Array.from(element.querySelectorAll("[data-ladder] i")).map(
    (bar) => bar.getAttribute("data-stop-status") ?? "",
  );
const chipOf = (element: Element) =>
  (element.querySelector("[data-chip]")?.textContent ?? "").trim();

/* ── the row (FR-004) ──────────────────────────────────────────────────── */

describe("the fixture floor's six epics (US2-S1, FR-004)", () => {
  it("renders each epic as one row carrying id, chip, a ladder per story, and spend", () => {
    for (const epic of FIXTURE_EPICS) {
      const container = render(epic);
      const rows = container.querySelectorAll("article.epic");
      expect(rows.length, `${epic.scene}: one row`).toBe(1);

      const row = rows[0];
      expect(row.getAttribute("data-epic-id")).toBe(epic.epic_id);
      // § Typography: "mono for identity and data … spec ids".
      const name = row.querySelector("[data-epic-name]")!;
      expect(name.textContent).toBe(epic.epic_id);
      expect(name.className).toContain("num");

      // The epic's chip, from the document, with the story count § Epic rail
      // pairs it with.
      const chip = row.querySelector("[data-epic-chip]")!;
      expect(chip.textContent, `${epic.scene}: the epic's chip`).not.toBe("");

      // One mini-ladder per story, and exactly six stops in each.
      expect(stories(container).length, `${epic.scene}: one cell per story`).toBe(
        epic.nodes.length,
      );
      for (const cell of stories(container)) {
        expect(stops(cell).length, `${epic.scene}: six stops`).toBe(6);
      }

      // Spend to date, under the Unknown Rule: the word, in italic muted, never
      // a `0` and never an empty cell.
      const spend = row.querySelector("[data-epic-spend]")!;
      expect(spend.querySelector(".unknown")?.textContent).toBe("unknown");
      expect(spend.textContent).toContain("spend to date");
    }
  });

  it("labels every mini-ladder by its story_key, or by the node's own id where the factory named none", () => {
    const polled = render(FIXTURE_EPICS[0]);
    expect(stories(polled).map((cell) => cell.getAttribute("data-story-key"))).toEqual([
      "US1",
      "US2",
    ]);
    expect(
      stories(polled).map((cell) => cell.querySelector("[data-story-label]")?.textContent),
    ).toEqual(["US1", "US2"]);

    // The landing scene's answer names three stories no workgraph declares, so
    // the factory gave no key: the cell wears the node's own id rather than a
    // blank, and says the key is absent in `data-story-key`.
    const landing = render(FIXTURE_EPICS[1]);
    expect(stories(landing).map((cell) => cell.hasAttribute("data-story-key"))).toEqual([
      false,
      false,
      false,
    ]);
    expect(
      stories(landing).map((cell) => cell.querySelector("[data-story-label]")?.textContent),
    ).toEqual(["us1", "us2", "us3"]);
  });

  it("pairs the epic's chip with the document's own story count", () => {
    expect(chipOf(render(FIXTURE_EPICS[0]).querySelector(".epic-id")!)).toBe("landed 2/2");
    expect(chipOf(render(FIXTURE_EPICS[2]).querySelector(".epic-id")!)).toBe(
      "waiting on you 0/1",
    );
    // A spec the document has no word for is `unknown` — never a word of the
    // Desk's own choosing (the Unknown Rule).
    expect(chipOf(render(FIXTURE_EPICS[4]).querySelector(".epic-id")!)).toBe("unknown 0/5");
  });

  it("carries no milestone bar, no dispatch diamond and no chevron glyph in the DOM", () => {
    // FR-004's negative half, over every epic of the floor: the first world's
    // three state pictures are gone from the markup, not merely restyled.
    for (const epic of FIXTURE_EPICS) {
      const container = render(epic);
      for (const gone of [
        ".bar",
        ".track",
        ".fill",
        ".diamonds",
        ".diamond",
        ".ms",
        ".token",
        ".token-tag",
        ".chev",
        ".node-cell",
      ]) {
        expect(container.querySelectorAll(gone).length, `${epic.scene}: ${gone}`).toBe(0);
      }
      // And the milestone track's five captions with them.
      for (const caption of ["dispatch", "PASSED", "PR_OPEN", "ENQUEUED", "MERGED"]) {
        expect(container.textContent, `${epic.scene}: the ${caption} caption`).not.toContain(
          caption,
        );
      }
    }
  });
});

/* ── the ladders are the document's (FR-005) ───────────────────────────── */

describe("the ladders are the document's own (US2-S2, FR-005)", () => {
  it("renders the document's stops even where they contradict a naive reading of state", () => {
    // The floor says MERGED; the document says the story is building, and its
    // ladder is one stop in. A Desk deriving its own picture from `state` would
    // draw six done bars and a `merged` chip. The document wins, in both.
    const floorSaysMerged = epicOf("d-1", "contradiction", "RUNNING", [
      cardOf("us1", { state: "MERGED" }, "US1"),
    ]);
    const documentSaysBuilding: ShowfloorDocument = {
      ...showfloor,
      rail: [
        entryOf({
          spec_dir: "d-1",
          epic_id: "d-1",
          chip: "building",
          stories_landed: 0,
          stories_total: 1,
          stories: [
            storyOf(
              "us1",
              "still building",
              ladderOf({ state: "RUNNING", stopKey: "building", chip: "building" }),
            ),
          ],
        }),
      ],
    };

    const container = render(floorSaysMerged, documentSaysBuilding);
    expect(stops(container.querySelector("[data-story]")!)).toEqual([
      "done",
      "active",
      "ahead",
      "ahead",
      "ahead",
      "ahead",
    ]);
    expect(chipOf(container.querySelector("[data-story]")!)).toBe("building");
    expect(
      container.querySelector("[data-story] [data-chip]")?.getAttribute("data-chip-source"),
    ).toBe("document");
    // The floor's own word is still reported, verbatim, on the element — the
    // row hides neither document.
    expect(container.querySelector("[data-story]")?.getAttribute("data-state")).toBe("MERGED");
  });

  it("renders the document's stops the other way round too", () => {
    // The mirror case, so the first cannot pass by drawing "building" always:
    // the floor says RUNNING and the document says every stop is done.
    const floorSaysRunning = epicOf("d-2", "contradiction", "RUNNING", [
      cardOf("us1", { state: "RUNNING" }, "US1"),
    ]);
    const documentSaysDone: ShowfloorDocument = {
      ...showfloor,
      rail: [
        entryOf({
          spec_dir: "d-2",
          epic_id: "d-2",
          chip: "landed",
          stories_landed: 1,
          stories_total: 1,
          stories: [merged("us1")],
        }),
      ],
    };

    const container = render(floorSaysRunning, documentSaysDone);
    expect(stops(container.querySelector("[data-story]")!)).toEqual(Array(6).fill("done"));
    expect(chipOf(container.querySelector("[data-story]")!)).toBe("merged");
  });

  it("draws no ladder at all for a story the document does not carry", () => {
    // The demo's own pairing. Nothing is derived to fill the gap: the ladder's
    // slot says `unknown` in the Unknown Rule's words, the cell says where the
    // absence is (`data-ladder-source`), and the chip falls back to the state
    // the floor itself reported rather than to silence.
    const container = render(FIXTURE_EPICS[0], unjoined);
    const cell = container.querySelector("[data-story]")!;

    expect(container.querySelectorAll("[data-ladder]").length).toBe(0);
    expect(cell.getAttribute("data-ladder-source")).toBe("absent");
    expect(cell.querySelector("[data-chip]")?.getAttribute("data-chip-source")).toBe(
      "floor-state",
    );
    // MERGED in the recorded answer, `merged` in § Chips' words — the floor's
    // own state, said rather than swallowed, and no stop drawn for it.
    expect(chipOf(cell)).toBe("merged");
    expect(container.querySelector("article")?.getAttribute("data-ladders")).toBe("absent");

    // Said once for the epic, not once per story: the document answers for the
    // epic or it does not, and six copies of one word is how a real unknown
    // gets missed.
    const notes = container.querySelectorAll("[data-no-ladders]");
    expect(notes.length).toBe(1);
    expect(notes[0].textContent).toBe(
      "no ladder: the showfloor document carries no entry for this epic",
    );
    expect(container.querySelectorAll("[data-ladder-unread]").length).toBe(0);

    // And the epic's own chip has no word either: the document that would have
    // given it one does not answer for this epic.
    expect(chipOf(container.querySelector(".epic-id")!)).toBe("unknown");
  });

  it("marks the one story a present document has no ladder for", () => {
    // The skew case: the answer names `us3`, the graph declares two stories, so
    // the document carries ladders for `us1` and `us2` and none for the third.
    // The gap is that story's, so the marker is that story's — and the row's
    // "no entry for this epic" line is absent, because there is one.
    const skewed: ShowfloorDocument = {
      ...showfloor,
      rail: [
        entryOf({
          spec_dir: "fx-landing-f0a0d6",
          epic_id: "fx-landing-f0a0d6",
          chip: "landed",
          stories_landed: 2,
          stories_total: 2,
          stories: [merged("us1"), merged("us2")],
        }),
      ],
    };

    const container = render(FIXTURE_EPICS[5], skewed);
    const cells = stories(container);
    expect(cells.map((cell) => cell.getAttribute("data-ladder-source"))).toEqual([
      "document",
      "document",
      "none",
    ]);
    expect(cells[2].querySelector("[data-ladder-unread]")?.textContent).toBe("unknown");
    expect(cells[2].getAttribute("title")).toBe(
      "the showfloor document carries no ladder for this story",
    );
    expect(container.querySelectorAll("[data-no-ladders]").length).toBe(0);
  });

  it("keeps the awaited story's own words when the document carries no ladder", () => {
    // The paged scene: undeclared, VERIFYING, awaited. `undeclared` is 001's
    // word and it outranks the state's, so the fact the chip cannot carry — that
    // the factory is waiting on an answer — stays on the marker beside it.
    const cell = render(FIXTURE_EPICS[2], unjoined).querySelector("[data-story]")!;
    expect(chipOf(cell)).toBe("undeclared");
    expect(cell.hasAttribute("data-paged")).toBe(true);
    expect(cell.getAttribute("data-state")).toBe("VERIFYING");
  });

  it("matches a floor node to the document's story by id and by folded story key", () => {
    const entry = entryForEpic(showfloor, "002-expense-notes");
    expect(entry?.spec_dir).toBe("002-expense-notes");
    // The two seams spell the same story two ways: `us1` on the floor, `US1` in
    // the compiled graph.
    expect(storyForCard(entry, cardOf("us1", null, "US1"))?.id).toBe("us1");
    expect(storyForCard(entry, cardOf("us2", null, null))?.id).toBe("us2");
    expect(storyForCard(entry, cardOf("us9", null, "US9"))).toBeNull();
    // And an epic no entry answers for gets null, never a near match.
    expect(entryForEpic(showfloor, "fx-nothing")).toBeNull();
    expect(entryForEpic(null, "002-expense-notes")).toBeNull();
  });
});

/* ── the terminal case (FR-007) ────────────────────────────────────────── */

describe("a story whose ladder froze (US2-S4, FR-007)", () => {
  /** The recorded killed answer: one story, KILLED on its sixth attempt. */
  const killedNode = recorded(killedRaw).us1;
  const killedEpic = epicOf("001-the-desk-sees-the-floor", "killed", "KILLED", [
    cardOf("us1", killedNode, "US1"),
  ]);

  function documentWith(reason: string | null): ShowfloorDocument {
    return {
      ...showfloor,
      rail: [
        entryOf({
          spec_dir: "001-the-desk-sees-the-floor",
          epic_id: "001-the-desk-sees-the-floor",
          chip: "killed",
          stories_landed: 0,
          stories_total: 1,
          stories: [
            storyOf(
              "us1",
              "The Desk sees the floor",
              ladderOf({
                state: "KILLED",
                stopKey: null,
                chip: "killed",
                frozen: true,
                terminalReason: reason,
              }),
            ),
          ],
        }),
      ],
    };
  }

  it("shows the frozen ladder, the killed chip, and the reason on the row's title", () => {
    const reason = "operator killed the epic";
    const container = render(killedEpic, documentWith(reason));
    const cell = container.querySelector("[data-story]")!;

    // Frozen is neither done nor ahead: all six stops carry the document's own
    // `frozen`, and the ladder says so on the element as well as in its fills.
    expect(stops(cell)).toEqual(Array(6).fill("frozen"));
    expect(cell.querySelector("[data-ladder]")?.getAttribute("data-ladder-frozen")).toBe("true");

    // Never colour alone: the word is on the chip, in § Chips' alarm row.
    expect(chipOf(cell)).toBe("killed");
    expect(cell.querySelector("[data-chip]")?.getAttribute("data-chip-tone")).toBe("dead");

    // And the reason is reachable from the row itself, verbatim.
    const row = container.querySelector("article.epic")!;
    expect(row.getAttribute("title")).toBe(`US1: ${reason}`);
    expect(cell.getAttribute("title")).toBe(`US1: ${reason}`);
    expect(row.getAttribute("data-epic-chip")).toBeNull();
    expect(chipOf(container.querySelector(".epic-id")!)).toBe("killed 0/1");
  });

  it("says unknown where the factory froze a story and gave no reason", () => {
    // The recorded `killed.json` is exactly that case: KILLED, six attempts,
    // `terminal_reason: null`. The pane knows the story is dead and does not
    // know why, and the Unknown Rule is what it says so with.
    expect(killedNode.terminal_reason ?? null).toBeNull();

    const container = render(killedEpic, documentWith(null));
    expect(container.querySelector("article.epic")?.getAttribute("title")).toBe("US1: unknown");
  });

  it("collects every frozen story of the epic, and nothing from a live one", () => {
    const entry = entryOf({
      spec_dir: "e",
      epic_id: "e",
      stories: [
        storyOf("us1", "one", ladderOf({ state: "FAILED", stopKey: null, chip: "failed", frozen: true, terminalReason: "gates failed three times" })),
        storyOf("us2", "two", ladderOf({ state: "RUNNING", stopKey: "building", chip: "building" })),
        storyOf("us3", "three", ladderOf({ state: "KILLED", stopKey: null, chip: "killed", frozen: true, terminalReason: null })),
      ],
    });

    expect(terminalReasons(entry)).toBe("US1: gates failed three times · US3: unknown");
    expect(terminalReasons(entryOf({ spec_dir: "e", stories: [merged("us1")] }))).toBeNull();
    expect(terminalReasons(null)).toBeNull();
  });
});

/* ── succeeding NodeChevron.test.tsx ───────────────────────────────────── */

describe("the story cell, succeeding the chevron it replaced", () => {
  const ELEVEN: NodeState[] = [
    "PENDING",
    "KEY_ISSUED",
    "RUNNING",
    "VERIFYING",
    "PASSED",
    "PR_OPEN",
    "ENQUEUED",
    "MERGED",
    "FAILED",
    "KILLED",
    "WAITING_OPERATOR",
  ];

  const withCard = (card: NodeCard) =>
    render(epicOf("fx-one", "one", "RUNNING", [card]), unjoined);

  it("carries all eleven states, each keeping its own word and its own state", () => {
    // Succeeds "renders all eleven states distinctly". The eleven no longer wear
    // eleven *pictures* — D-015 retired the glyph fills — so what is asserted is
    // that all eleven arrive, each on an element that reports the factory's own
    // spelling, and each carrying a word rather than a colour (§ Named Rules).
    const seen = new Set<string>();
    for (const state of ELEVEN) {
      const cell = withCard(cardOf("us1", { state }, "US1")).querySelector("[data-story]")!;
      expect(cell.getAttribute("data-state"), state).toBe(state);
      const word = chipOf(cell);
      expect(word, `${state} carries a word`).not.toBe("");
      seen.add(`${state} | ${word}`);
    }
    expect(seen.size).toBe(11);
  });

  it("marks a paged VERIFYING story as paged, never as WAITING_OPERATOR", () => {
    // Succeeds "marks paged VERIFYING node as paged, never WAITING_OPERATOR".
    const cell = withCard(
      cardOf("us1", { state: "VERIFYING", awaiting_operator: true }, "US1"),
    ).querySelector("[data-story]")!;

    expect(cell.getAttribute("data-state")).toBe("VERIFYING");
    expect(cell.hasAttribute("data-paged")).toBe(true);
    expect(cell.textContent).toContain("paged");
  });

  it("renders declared=false as undeclared", () => {
    // Succeeds "renders declared=false as undeclared". `undeclared` is not one
    // of § Chips' six words, so it falls to the Unknown Rule's italic muted.
    const cell = withCard(
      cardOf("us1", { state: "VERIFYING" }, null),
    ).querySelector("[data-story]")!;

    expect(cell.hasAttribute("data-undeclared")).toBe(true);
    expect(chipOf(cell)).toBe("undeclared");
    expect(cell.querySelector("[data-chip]")?.getAttribute("data-chip-tone")).toBe("unknown");
  });

  it("keeps the paged marker when the story is also undeclared", () => {
    // Succeeds "keeps paged marker when also undeclared".
    const cell = withCard(
      cardOf("us1", { state: "VERIFYING", awaiting_operator: true }, null),
    ).querySelector("[data-story]")!;

    expect(cell.hasAttribute("data-undeclared")).toBe(true);
    expect(cell.hasAttribute("data-paged")).toBe(true);
    expect(cell.getAttribute("data-state")).toBe("VERIFYING");
    expect(cell.textContent).toContain("paged");
  });
});
