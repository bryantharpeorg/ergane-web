/**
 * One story's card: id, title, chip, six-stop ladder, sub-line (005 US3-S2,
 * FR-011).
 *
 * **Succeeds `tests/unit/StationNode.test.tsx`**, deleted in this story's diff.
 * That file asserted the first world's station — a skewed 40px body wearing one
 * of eleven glyph fills, with a landing stage caption beneath it. D-015
 * replaced the glyph grammar with the six-stop ladder, so the fills it asserted
 * are not the design any more; what it was right about, and what is re-asserted
 * here, is that every one of the eleven `epic_status` states reaches the card
 * legibly and that a terminal one carries the factory's `terminal_reason`
 * verbatim rather than a sentence of the pane's own.
 *
 * The stops themselves are not asserted to be *derived* here — they are not
 * derived here. `pane/showfloor.py` decides them once (plan D2) and
 * `tests/test_showfloor_document.py` proves that derivation against all eleven
 * states. This file proves the clothing: six bars, always six, wearing the
 * status the document sent.
 */

import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import NodeCard, { subLine } from "../../src/showfloor/NodeCard";
import { ladderOf, storyOf } from "./support/showfloor-builder";
import type { ShowfloorStory } from "../../src/api/showfloorDocument";

const containers: HTMLElement[] = [];

function render(story: ShowfloorStory): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  act(() => {
    createRoot(container).render(<NodeCard story={story} />);
  });
  return container;
}

/** The card as a whole element, for the props US4 gave it. */
function renderCard(node: JSX.Element): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  act(() => {
    createRoot(container).render(node);
  });
  return container;
}

/** The six bars' statuses, left to right. */
function bars(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("[data-ladder] i")).map(
    (bar) => bar.getAttribute("data-stop-status") ?? "",
  );
}

/** The four fills § The status ladder names, as this card's class names. */
function fills(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("[data-ladder] i")).map(
    (bar) => bar.className,
  );
}

describe("the card carries id, title, chip, ladder and sub-line (FR-011)", () => {
  it("renders all five parts of a live story", () => {
    const story = {
      ...storyOf("us3", "The stage: one graph, drawn inside its box", ladderOf({
        state: "RUNNING",
        stopKey: "building",
        chip: "building",
      })),
      facts: { attempt: 2, pr_number: null, landing_state: null },
    };
    const container = render(story);

    expect(container.querySelector("[data-node-id]")!.textContent).toBe("US3");
    expect(container.querySelector("[data-node-title]")!.textContent).toBe(
      "The stage: one graph, drawn inside its box",
    );
    expect(container.querySelector("[data-chip]")!.textContent).toBe("building");
    expect(container.querySelectorAll("[data-ladder] i").length).toBe(6);
    expect(container.querySelector("[data-node-sub]")!.textContent).toBe("P1 · att 2");
  });

  /**
   * **Succeeds US3's "is not a control: the Showfloor never grows a button"**,
   * which asserted `ARTICLE` and zero buttons. Its subject changed in this
   * story's diff, and it said so itself: "selection and its keyboard path are
   * US4's". They are here. What that assertion was protecting — that a card
   * touches no seam and the room grows no *write* — is what is re-asserted
   * below and, whole-room, in `noVerb.test.ts` and the smoke's zero-non-GET
   * sweep (plan D4, FR-016, FR-017).
   */
  it("is a selection button and nothing else: no form, no input, no write", () => {
    const picked: string[] = [];
    const container = renderCard(
      <NodeCard
        story={storyOf("us1", "a story", ladderOf())}
        onSelect={(story) => picked.push(story.id ?? "")}
      />,
    );

    const card = container.querySelector("[data-node-card]") as HTMLButtonElement;
    expect(card.tagName).toBe("BUTTON");
    // `type="button"` is what keeps it out of any submit path — there is no
    // form in this room, and a card that grew one would still not submit.
    expect(card.getAttribute("type")).toBe("button");
    expect(container.querySelectorAll("form, input, select, textarea").length).toBe(0);
    expect(container.querySelectorAll("a").length).toBe(0);

    // It moves the room's own selection, and reports which card is being told.
    expect(card.getAttribute("aria-pressed")).toBe("false");
    act(() => {
      card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(picked).toEqual(["us1"]);
  });

  it("wears the selection § Shapes gives it, and says so to a screen reader", () => {
    const container = renderCard(
      <NodeCard story={storyOf("us1", "a story", ladderOf())} selected />,
    );
    const card = container.querySelector("[data-node-card]")!;

    expect(card.className).toBe("node sel");
    expect(card.getAttribute("aria-pressed")).toBe("true");
    expect(card.getAttribute("data-selected")).toBe("true");
  });
});

describe("the six stops wear the four fills (FR-011, DESIGN.md § The status ladder)", () => {
  it("a merged story is six done stops", () => {
    const container = render(
      storyOf("us1", "landed", ladderOf({ state: "MERGED", stopKey: "merged", chip: "merged", done: true })),
    );
    expect(bars(container)).toEqual(Array(6).fill("done"));
    expect(fills(container)).toEqual(Array(6).fill("done"));
    expect(container.querySelector("[data-chip]")!.textContent).toBe("merged");
  });

  it("a building story is done behind, accent at the stop, sunken ahead", () => {
    const container = render(
      storyOf("us2", "building", ladderOf({ state: "RUNNING", stopKey: "verifying", chip: "verifying" })),
    );
    expect(bars(container)).toEqual(["done", "done", "active", "ahead", "ahead", "ahead"]);
    // "the active stop accent" — the class the 1.6s pulse is authored against.
    expect(fills(container)).toEqual(["done", "done", "now", "", "", ""]);
  });

  it("a story waiting on the operator turns its active stop gold", () => {
    const container = render(
      storyOf(
        "us2",
        "parked",
        ladderOf({
          state: "WAITING_OPERATOR",
          stopKey: "building",
          chip: "waiting on you",
          awaiting: true,
        }),
      ),
    );
    expect(bars(container)).toEqual(["done", "waiting", "ahead", "ahead", "ahead", "ahead"]);
    expect(fills(container)[1]).toBe("hold");
    // The word rides the element: gold alone would be state as colour.
    expect(container.querySelector("[data-chip]")!.textContent).toBe("waiting on you");
    expect(container.querySelector("[data-chip]")!.getAttribute("data-chip-tone")).toBe("wait");
  });

  it("a terminal story freezes the ladder and quotes terminal_reason verbatim", () => {
    // The reason is the factory's sentence. The pane does not paraphrase why an
    // epic died (constitution III), so the sub-line is a byte-for-byte quote.
    const reason = "operator answered KILL_EPIC after the ladder was exhausted";
    const story = storyOf(
      "us1",
      "killed",
      ladderOf({
        state: "KILLED",
        stopKey: null,
        chip: "killed",
        frozen: true,
        terminalReason: reason,
      }),
    );
    const container = render(story);

    expect(bars(container)).toEqual(Array(6).fill("frozen"));
    // Frozen occupies no stop: no bar is done, active or gold.
    expect(fills(container)).toEqual(Array(6).fill("froze"));
    expect(container.querySelector("[data-node-sub]")!.textContent).toBe(reason);
    expect(subLine(story)).toBe(reason);
    expect(container.querySelector("[data-chip]")!.getAttribute("data-chip-tone")).toBe("dead");
    expect(container.querySelector("[data-node-card]")!.getAttribute("data-ladder-tone")).toBe(
      "terminal",
    );
  });

  it("a word outside the vocabulary falls to unknown rather than a seventh colour", () => {
    const container = render(
      storyOf("us1", "odd", ladderOf({ state: "SOMETHING_NEW", stopKey: "ready", chip: "nonsense" })),
    );
    const chip = container.querySelector("[data-chip]")!;
    expect(chip.getAttribute("data-chip-tone")).toBe("unknown");
    // Kept verbatim: the pane shows the factory's word, it does not swallow it.
    expect(chip.textContent).toBe("nonsense");
  });
});

describe("the mono sub-line says only what the document recorded", () => {
  it("adds each live fact the answer carried, in order", () => {
    const base = storyOf("us1", "a story", ladderOf({ stopKey: "queue", chip: "queue" }));
    expect(
      subLine({ ...base, facts: { attempt: 3, pr_number: 21, landing_state: "ENQUEUED" } }),
    ).toBe("P1 · att 3 · pr #21 · enqueued");
  });

  it("never renders an absence as a number", () => {
    const base = storyOf("us1", "a story", ladderOf());
    // An undispatched story's facts are null, not zero: no `att 0`, no `pr #0`.
    const undispatched = subLine({
      ...base,
      facts: { attempt: null, pr_number: null, landing_state: null },
    });
    expect(undispatched).toBe("P1");
    expect(undispatched).not.toContain("0");

    // A story with no priority either still says something true about itself.
    expect(subLine({ ...base, priority: null, facts: {} })).toBe("US1");
  });
});
