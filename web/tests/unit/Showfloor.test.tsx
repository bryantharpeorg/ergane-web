/**
 * The Showfloor's frame and its selection (005 US2-S4, FR-009).
 *
 * **Succeeds this file's 002-era cases**, replaced in this story's diff:
 * "renders quiet floor and no epic-stage when zero epics run" and "renders one
 * epic-stage per running epic and no quiet floor" asserted the first world's
 * room — one full stage per running epic, stacked — which D-015 replaced with a
 * master–detail whose unit is the selection. Their subject is gone, and what
 * replaces them is below: which spec a path selects, and what the room says
 * when it is asked for one that is not there. The badge case is *not*
 * replaced — 003's guarantee that the count follows a typed event without a
 * navigation or a reload survives the room change, and is re-asserted here
 * against the rebuilt frame (with the second read the room now makes).
 */

import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Showfloor, {
  defaultSelection,
  isBuilding,
  selectFromPath,
} from "../../src/showfloor/Showfloor";
import type { AttentionItem, FloorDocument } from "../../src/api/floorDocument";
import type { RailEntry, ShowfloorDocument } from "../../src/api/showfloorDocument";

import escalationsRaw from "../../../fixtures/escalations/open_escalations.json?raw";
import questionRaw from "../../../fixtures/webhook/question.json?raw";
import {
  buildingEntry,
  draftEntry,
  killedEntry,
  landedEntry,
  ladderOf,
  readyEntry,
} from "./support/showfloor-builder";
import {
  installEventSourceDouble,
  openedSources,
} from "./support/event-source-double";

const recordedEscalation = (
  JSON.parse(escalationsRaw) as Array<Record<string, unknown>>
)[0];
const recordedQuestion = JSON.parse(questionRaw) as Record<string, unknown>;

const baseFloor: FloorDocument = {
  reference_instant: null,
  floor: { seam: "floor", data: { epics: [], queue: [], drafts: [] } },
  epics: [],
  attention: { seam: "attention", items: [] },
  health: { seam: "health", data: null },
  spend_to_date: { seam: "spend", data: null },
  degraded: [],
};

/** A floor of the shape this repository's own corpus has today. */
const CORPUS: RailEntry[] = [
  landedEntry("001-the-desk-sees-the-floor"),
  landedEntry("002-the-showfloor-stages-an-epic"),
  landedEntry("003-an-answer-reaches-the-factory"),
  landedEntry("004-the-pane-fits-the-screen"),
  readyEntry("005-one-epic-on-stage"),
  draftEntry("006-the-desk-matches-the-stage"),
];

/**
 * The spec's own goal, as `parse_spec_intent` lifts it (009 US4).
 *
 * One paragraph, whitespace-collapsed — the shape the assembler emits, not a
 * sentence written to be convenient. `GOAL_LESS` is the other answer the same
 * field carries: a spec whose body states no goal, which is the case the band
 * must not render at all (FR-011).
 */
const GOAL =
  "The Showfloor becomes a master–detail: a rail of every spec with its status, " +
  "and one epic staged at a time.";

/** The same floor, every entry carrying a goal for the band to hold. */
const WITH_GOALS: RailEntry[] = CORPUS.map((entry) => ({
  ...entry,
  intent: `${GOAL} (${entry.spec_dir})`,
}));

/** One spec, and it states no goal — the band is not rendered for it. */
const GOAL_LESS: RailEntry[] = [CORPUS[1]];

function documentOf(rail: RailEntry[]): ShowfloorDocument {
  return { reference_instant: null, specs_root: "specs", rail, degraded: [] };
}

/** Answer both of the room's reads by route, as the server does. */
function stubFetch(room: ShowfloorDocument | number, floor: FloorDocument) {
  const stub = vi.fn(async (url: string) => {
    if (url === "/api/showfloor") {
      return typeof room === "number"
        ? { ok: false, status: room, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => room };
    }
    return { ok: true, status: 200, json: async () => floor };
  });
  globalThis.fetch = stub as unknown as typeof fetch;
  return stub;
}

async function renderAt(
  pathname: string,
  rail: RailEntry[] | number,
  floor: FloorDocument = baseFloor,
): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  window.history.pushState({}, "", pathname);
  stubFetch(typeof rail === "number" ? rail : documentOf(rail), floor);

  await act(async () => {
    createRoot(container).render(<Showfloor />);
    await Promise.resolve();
  });

  return container;
}

const selectedDir = (container: HTMLElement) =>
  container.querySelector("[data-rail-row][data-selected='true']")?.getAttribute("data-spec-dir") ??
  null;

describe("selection follows the URL (FR-009)", () => {
  it("selects the spec the path names, in the rail and on the stage", async () => {
    const container = await renderAt("/showfloor/002-the-showfloor-stages-an-epic", CORPUS);

    expect(selectedDir(container)).toBe("002-the-showfloor-stages-an-epic");
    expect(container.querySelector("[data-stage]")?.getAttribute("data-spec-dir")).toBe(
      "002-the-showfloor-stages-an-epic",
    );
    expect(container.querySelector("[data-stage-id]")?.textContent).toBe("002");
    expect(container.querySelector("[data-stage-name]")?.textContent).toBe(
      "the showfloor stages an epic",
    );
    // Nothing was missed, so nothing is named as missed.
    expect(container.querySelector("[data-selection-miss]")).toBeNull();

    document.body.removeChild(container);
  });

  it("falls back to the default and names the miss when the dir is unknown", async () => {
    const container = await renderAt("/showfloor/042-a-spec-that-is-not-here", CORPUS);

    // Nothing is building in this corpus, so the default is the newest landed.
    expect(selectedDir(container)).toBe("004-the-pane-fits-the-screen");

    const miss = container.querySelector("[data-selection-miss]");
    expect(miss).not.toBeNull();
    expect(miss?.textContent).toContain("042-a-spec-that-is-not-here");
    expect(miss?.textContent).toContain("004-the-pane-fits-the-screen");

    document.body.removeChild(container);
  });

  it("selects the building epic from a bare path", async () => {
    const rail = [...CORPUS.slice(0, 4), buildingEntry("005-one-epic-on-stage", 1, 4)];
    const container = await renderAt("/showfloor", rail);

    expect(selectedDir(container)).toBe("005-one-epic-on-stage");
    expect(container.querySelector("[data-stage-chip]")?.textContent).toBe("building 1/4");

    document.body.removeChild(container);
  });

  it("selects the newest landed from a bare path when nothing is building", async () => {
    const container = await renderAt("/showfloor", CORPUS);

    expect(selectedDir(container)).toBe("004-the-pane-fits-the-screen");
    expect(container.querySelector("[data-stage-chip]")?.textContent).toBe("landed 4/4");

    document.body.removeChild(container);
  });

  it("renders an empty floor as a stage that says so", async () => {
    const container = await renderAt("/showfloor", []);

    expect(selectedDir(container)).toBeNull();
    expect(container.querySelector("[data-empty-floor]")?.textContent).toContain(
      "nothing to stage",
    );

    document.body.removeChild(container);
  });

  it("names the read when the room's own document cannot be read", async () => {
    const container = await renderAt("/showfloor", 503);

    const degraded = container.querySelector(".degraded");
    expect(degraded?.textContent).toContain("GET /api/showfloor");
    expect(degraded?.textContent).toContain("not hidden");

    document.body.removeChild(container);
  });

  it("names the reads that degraded for the selected spec", async () => {
    const entry = {
      ...readyEntry("005-one-epic-on-stage"),
      notes: [
        { read: "workgraph", mode: "transport", detail: "not recorded yet" },
        { read: "epic_status", mode: "refusal", detail: "the factory declined" },
      ],
    };
    const container = await renderAt("/showfloor/005-one-epic-on-stage", [entry]);

    const notes = Array.from(container.querySelectorAll("[data-stage-note]"));
    expect(notes.length).toBe(2);
    // Transport and refusal are told apart in the mode, never only in prose.
    expect(notes.map((note) => note.getAttribute("data-mode"))).toEqual([
      "transport",
      "refusal",
    ]);
    expect(notes[1].textContent).toContain("the factory declined");

    document.body.removeChild(container);
  });
});

describe("the default selection, as a rule (FR-009)", () => {
  it("prefers a building epic to every landed one", () => {
    const rail = [...CORPUS, buildingEntry("007-x", 2, 5)];
    expect(defaultSelection(rail)?.spec_dir).toBe("007-x");
  });

  it("prefers the newest building epic when two are on the floor", () => {
    const rail = [buildingEntry("002-a", 1, 3), ...CORPUS, buildingEntry("008-b", 1, 3)];
    expect(defaultSelection(rail)?.spec_dir).toBe("008-b");
  });

  it("does not call an epic that is over a building one", () => {
    // Every story terminal: the epic is finished, not working, so the default
    // goes back to the newest landed. The rail still shows it, in alarm.
    const over = killedEntry("009-c");
    const frozen = {
      ...over,
      stories: over.stories.map((story) => ({
        ...story,
        ladder: ladderOf({
          state: "KILLED",
          specState: "ready",
          stopKey: null,
          chip: "killed",
          frozen: true,
          terminalReason: "operator killed the epic",
        }),
      })),
    };

    expect(isBuilding(frozen)).toBe(false);
    expect(defaultSelection([...CORPUS, frozen])?.spec_dir).toBe(
      "004-the-pane-fits-the-screen",
    );
  });

  it("still calls an epic with one killed story and one running one building", () => {
    // The kill is the thing the operator most needs on the stage, so an epic
    // that lost a node and kept going is still the floor's current work.
    const killed = killedEntry("009-c");
    expect(isBuilding(killed)).toBe(true);
    expect(defaultSelection([...CORPUS, killed])?.spec_dir).toBe("009-c");
  });

  it("calls an epic the branch landed before the frontmatter caught up", () => {
    // 009's doctrine, one layer up from the ladder: an attestation is a claim
    // and a landing is a fact. The assembler layers the branch over the claim,
    // so the rail already draws `landed 4/4` for this entry while its
    // frontmatter still reads `ready` — and a default selection reading the
    // frontmatter stepped straight over the newest thing that landed.
    const unattested = { ...landedEntry("009-c"), state: "ready" };
    expect(unattested.chip).toBe("landed");
    expect(defaultSelection([...CORPUS, unattested])?.spec_dir).toBe("009-c");
  });

  it("does not call an undispatched spec building, however it is declared", () => {
    // `ready` says the operator flipped it; only an epic answering says the
    // factory took it.
    expect(isBuilding(readyEntry("010-f"))).toBe(false);
  });

  it("falls to the first row when nothing is building and nothing has landed", () => {
    const rail = [draftEntry("006-d"), draftEntry("007-e")];
    expect(defaultSelection(rail)?.spec_dir).toBe("006-d");
  });

  it("selects nothing from an empty floor rather than throwing", () => {
    expect(defaultSelection([])).toBeNull();
    expect(selectFromPath([], "/showfloor/001-a")).toEqual({
      entry: null,
      miss: "001-a",
    });
  });

  it("reads a percent-encoded directory back the way it was written", () => {
    const entry = readyEntry("010-a spec with a space");
    const selection = selectFromPath([entry], "/showfloor/010-a%20spec%20with%20a%20space");
    expect(selection.entry?.spec_dir).toBe("010-a spec with a space");
    expect(selection.miss).toBeNull();
  });
});

describe("the badge follows floor events (003's guarantee, on the new frame)", () => {
  const waiting: AttentionItem["settlement"] = {
    state: "waiting",
    ruling: null,
    signal: null,
    pressed_choice: null,
    resolution: null,
  };
  const escalationItem: AttentionItem = {
    id: recordedEscalation.escalation_id as string,
    kind: "escalation",
    correlation_id: recordedEscalation.escalation_id as string,
    text: (recordedEscalation.question as string | undefined) ?? "",
    actions: [],
    expires_at: (recordedEscalation.expires_at as string | undefined) ?? null,
    settlement: waiting,
    degraded: null,
  };
  const questionItem: AttentionItem = {
    id: recordedQuestion.correlation_id as string,
    kind: "question",
    correlation_id: recordedQuestion.correlation_id as string,
    text: recordedQuestion.text as string,
    actions: [],
    expires_at: null,
    settlement: waiting,
    degraded: null,
  };

  const ITEMS: AttentionItem[] = [escalationItem, questionItem];
  const MORE_ITEMS: AttentionItem[] = [...ITEMS, escalationItem];
  const N = ITEMS.length;

  function floorWith(items: AttentionItem[]): FloorDocument {
    return { ...baseFloor, attention: { ...baseFloor.attention, items } };
  }

  it("updates the count from typed floor events, without navigation or reload", async () => {
    const restore = installEventSourceDouble();
    const container = document.createElement("div");
    document.body.appendChild(container);
    window.history.pushState({}, "", "/showfloor");

    const pathnameBefore = window.location.pathname;
    const fetchStub = stubFetch(documentOf(CORPUS), baseFloor);

    await act(async () => {
      createRoot(container).render(<Showfloor />);
      await Promise.resolve();
    });

    // One room is mounted at a time, so there is exactly one EventSource.
    expect(openedSources.length).toBe(1);
    const source = openedSources[0];
    const rootNode = container.firstElementChild;

    const badgeText = () =>
      container.querySelector("[data-attention-badge]")?.textContent ?? null;

    expect(badgeText()).toBeNull();

    await act(async () => {
      source.emit("floor", floorWith(ITEMS));
    });
    expect(badgeText()).toMatch(new RegExp(`^${N}\\b`));

    await act(async () => {
      source.emit("floor", floorWith(MORE_ITEMS));
    });
    expect(badgeText()).toMatch(new RegExp(`^${N + 1}\\b`));

    // An event of an unknown type changes nothing, on either channel — and
    // `showfloor` (005 US1's typed event) is one of those types today.
    await act(async () => {
      source.emit("attention", floorWith(ITEMS));
      source.emitOnMessageChannel("sparkle", floorWith(ITEMS));
    });
    expect(badgeText()).toMatch(new RegExp(`^${N + 1}\\b`));

    // No navigation and no reload: the room was never re-mounted, each of the
    // two documents was read exactly once, and the path did not move.
    expect(container.firstElementChild).toBe(rootNode);
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expect(fetchStub.mock.calls.map((call) => call[0]).sort()).toEqual([
      "/api/floor",
      "/api/showfloor",
    ]);
    expect(window.location.pathname).toBe(pathnameBefore);
    expect(source.closed).toBe(false);
    expect(openedSources.length).toBe(1);

    document.body.removeChild(container);
    restore();
  });

  it("says the count is unread when the floor document did not arrive", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    window.history.pushState({}, "", "/showfloor");

    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === "/api/showfloor") {
        return { ok: true, status: 200, json: async () => documentOf(CORPUS) };
      }
      throw new Error("connection refused");
    }) as unknown as typeof fetch;

    await act(async () => {
      createRoot(container).render(<Showfloor />);
      await Promise.resolve();
    });

    const note = container.querySelector("[data-attention-degraded]");
    expect(note?.getAttribute("data-mode")).toBe("transport");
    expect(note?.textContent).toContain("GET /api/floor");
    // Never the numeral zero in the place a count would have been.
    expect(container.querySelector("[data-attention-badge]")).toBeNull();
    // And the room itself is unaffected: the rail read did arrive.
    expect(selectedDir(container)).toBe("004-the-pane-fits-the-screen");

    document.body.removeChild(container);
  });
});

/**
 * 008 US2 — the room's shape while nothing is selected (FR-004 … FR-006).
 *
 * The measured half is `tests/smoke/showfloor.spec.ts`: jsdom computes no
 * cascade, so what `data-selection="none"` *resolves to* is a Playwright
 * assertion. What is provable here is the half a stylesheet cannot fix — that
 * the grid carries the state at all, that the band beneath the stage is mounted
 * there and above the legend rather than inside the track that is about to
 * collapse, and that a pick changes an attribute instead of rebuilding the room
 * (D-016 clauses a and b; plan D2).
 *
 * **009 US4 changed who occupies that band, not where it is.** D-019 gave it to
 * the spec's own goal, which does not depend on the selection, and retired the
 * room's two sentences to the case where no spec is selected at all. So the
 * mounting-point case below now measures `[data-spec-goal]`, and every
 * assertion about the room explainer moved to the describe that follows.
 */
describe("the released detail track (008 US2, FR-004 … FR-006)", () => {
  const cols = (container: HTMLElement) =>
    container.querySelector("[data-showfloor-cols]") as HTMLElement;

  it("hooks the grid with the selection, and opens on none", async () => {
    const container = await renderAt("/showfloor/002-the-showfloor-stages-an-epic", CORPUS);

    expect(cols(container).getAttribute("data-selection")).toBe("none");

    document.body.removeChild(container);
  });

  it("mounts the band beneath the stage, above the legend", async () => {
    const container = await renderAt("/showfloor/002-the-showfloor-stages-an-epic", WITH_GOALS);

    const band = container.querySelector("[data-spec-goal]")!;
    const stage = container.querySelector("[data-stage]")!;
    const legend = container.querySelector("[data-legend]")!;
    const pane = container.querySelector("[data-detail]")!;

    expect(band).not.toBeNull();
    // Inside the stage column — so FR-014's law (a) measures it — and out of
    // the track it used to hold open.
    expect(stage.contains(band)).toBe(true);
    expect(pane.contains(band)).toBe(false);
    expect((pane.textContent ?? "").trim()).toBe("");

    // Above the legend row, in document order: `DOCUMENT_POSITION_FOLLOWING`
    // is the DOM's own word for "comes after me".
    expect(band.compareDocumentPosition(legend) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    document.body.removeChild(container);
  });

  it("flips the hook on a pick, takes the words back, and remounts nothing", async () => {
    const container = await renderAt("/showfloor/002-the-showfloor-stages-an-epic", CORPUS);

    const grid = cols(container);
    const pane = container.querySelector("[data-detail]")!;
    const card = container.querySelector("[data-node-card]") as HTMLButtonElement;
    expect(card).not.toBeNull();

    await act(async () => {
      card.click();
      await Promise.resolve();
    });

    expect(grid.getAttribute("data-selection")).toBe("story");
    // 009 FR-012: the band does *not* empty on a pick — that was the layout
    // jump D-019 names. The room's own explainer was never here to leave.
    expect(container.querySelector("[data-detail-empty]")).toBeNull();
    expect(container.querySelector("[data-detail-title]")).not.toBeNull();

    // FR-004: "with no remount". The grid and the live region are the same two
    // elements they were — a region that is unmounted and remounted per story
    // announces nothing at all, and a grid that remounts throws away every box
    // the wires were measured against.
    expect(cols(container)).toBe(grid);
    expect(container.querySelector("[data-detail]")).toBe(pane);

    document.body.removeChild(container);
  });
});

/**
 * 009 US4 — the band under the stage says what the spec is for (FR-010 … FR-013).
 *
 * D-019 in one paragraph: the band D-016 gave to the room's own explainer now
 * holds the *spec's* goal, because the goal is true of the graph whether or not
 * a story is picked, and the explainer emptying itself on a click read as a
 * glitch. The two do not stack — two explanations under one graph is noise —
 * and the explainer retires to the case where there is no spec to explain.
 *
 * jsdom's half is which element is mounted where and what it says; the measured
 * half (a visible box, beneath the graph, above the legend, in both themes)
 * is `tests/smoke/showfloor.spec.ts`.
 */
describe("the spec's goal takes the band (009 US4, FR-010 … FR-013)", () => {
  const goal = (container: HTMLElement) =>
    container.querySelector("[data-spec-goal]") as HTMLElement | null;

  it("renders the entry's own intent, verbatim, with no story selected", async () => {
    const container = await renderAt("/showfloor/002-the-showfloor-stages-an-epic", WITH_GOALS);

    expect(container.querySelector("[data-showfloor-cols]")!.getAttribute("data-selection")).toBe(
      "none",
    );
    expect(goal(container)!.textContent).toBe(`${GOAL} (002-the-showfloor-stages-an-epic)`);

    document.body.removeChild(container);
  });

  it("reads identically once a story is picked (FR-012)", async () => {
    const container = await renderAt("/showfloor/002-the-showfloor-stages-an-epic", WITH_GOALS);

    const before = goal(container)!.textContent;
    const card = container.querySelector("[data-node-card]") as HTMLButtonElement;

    await act(async () => {
      card.click();
      await Promise.resolve();
    });

    // The pick landed…
    expect(container.querySelector("[data-showfloor-cols]")!.getAttribute("data-selection")).toBe(
      "story",
    );
    expect(container.querySelector("[data-detail-title]")).not.toBeNull();

    // …and the band did not empty, which is the layout jump D-019 names.
    expect(goal(container)).not.toBeNull();
    expect(goal(container)!.textContent).toBe(before);

    document.body.removeChild(container);
  });

  it("follows the rail: each spec's band is that spec's goal", async () => {
    const container = await renderAt("/showfloor/004-the-pane-fits-the-screen", WITH_GOALS);

    expect(goal(container)!.textContent).toBe(`${GOAL} (004-the-pane-fits-the-screen)`);

    document.body.removeChild(container);
  });

  it("renders no band at all for a spec that states no goal (FR-011)", async () => {
    const container = await renderAt("/showfloor/002-the-showfloor-stages-an-epic", GOAL_LESS);

    // Not an empty bordered strip and not the explainer standing in for it:
    // nothing. An empty band is furniture standing in for an answer.
    expect(goal(container)).toBeNull();
    expect(container.querySelector("[data-detail-empty]")).toBeNull();

    // The stage and the legend are still there, so what is absent is the band
    // and not the room around it.
    expect(container.querySelector("[data-stage]")).not.toBeNull();
    expect(container.querySelector("[data-legend]")).not.toBeNull();

    document.body.removeChild(container);
  });

  it("gives the band to the room's own explainer when no spec is selected (FR-013)", async () => {
    const container = await renderAt("/showfloor", []);

    const empty = container.querySelector("[data-detail-empty]")!;
    const stage = container.querySelector("[data-stage]")!;
    const legend = container.querySelector("[data-legend]")!;

    expect(empty).not.toBeNull();
    expect(stage.contains(empty)).toBe(true);
    expect(empty.compareDocumentPosition(legend) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Two sentences, still — the words did not change, only when they are said.
    const words = (empty.textContent ?? "").replace(/\s+/g, " ").trim();
    expect(words.split(". ").length).toBe(2);

    // And it never stacks with a goal, because there is no spec to have one.
    expect(goal(container)).toBeNull();

    document.body.removeChild(container);
  });

  it("never stacks the two explanations (D-019)", async () => {
    const container = await renderAt("/showfloor/002-the-showfloor-stages-an-epic", WITH_GOALS);

    expect(goal(container)).not.toBeNull();
    expect(container.querySelector("[data-detail-empty]")).toBeNull();

    document.body.removeChild(container);
  });
});
