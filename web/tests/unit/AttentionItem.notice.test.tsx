/**
 * A Notice renders and asks for nothing (spec 003 US1-S4), and every attention
 * body reads as the decision it is (spec 004 US3).
 *
 * The item is built from the recorded supervision payload — the factory's own
 * words — and the assertion that matters is the absence of every control: a
 * Notice has no settlement state to reach, so a button on one would be a second
 * verb with nowhere to go (constitution I, DESIGN.md § Components › Attention
 * Item).
 *
 * The second half of this file holds DESIGN.md's Body segmentation rule as four
 * committed measurements over the recorded deliveries the Fixture floor replays:
 * one block per choice the payload names, the concatenated blocks equal to the
 * payload after whitespace normalisation — emoji included — no block over 400
 * characters, and a payload naming no choices rendering as exactly one block.
 *
 * The bound asserted is **400**, never the 1,334 characters the first build
 * shipped in a single paragraph: a test written against today's fixture passes
 * forever once the fixture moves, and the point of this one is to fail on the
 * next regression rather than only on the last one.
 */

import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import AttentionItemView from "../../src/desk/AttentionItem";
import type {
  AttentionItem,
  DeliveredAction,
  FloorDocument,
} from "../../src/api/floorDocument";

import noticeRaw from "../../../fixtures/webhook/notice-supervision.json?raw";
import noticeRoadmapRaw from "../../../fixtures/webhook/notice-roadmap.json?raw";
import escalationRaw from "../../../fixtures/webhook/escalation.json?raw";
import escalationStandaloneRaw from "../../../fixtures/webhook/escalation-standalone.json?raw";
import questionRaw from "../../../fixtures/webhook/question.json?raw";
import questionExpiredRaw from "../../../fixtures/webhook/question-expired.json?raw";

/** A recorded webhook delivery, exactly as the factory POSTed it. */
interface Delivery {
  correlation_id: string;
  text: string;
  actions: DeliveredAction[];
}

const recorded = JSON.parse(noticeRaw) as Delivery;

const noticeItem: AttentionItem = {
  id: "notice:1",
  kind: "notice",
  correlation_id: recorded.correlation_id,
  text: recorded.text,
  actions: recorded.actions,
  expires_at: null,
  settlement: {
    state: "none",
    ruling: null,
    signal: null,
    pressed_choice: null,
    resolution: null,
  },
  degraded: null,
};

const doc = { reference_instant: "2026-08-22T17:41:27Z" } as FloorDocument;

function render(item: AttentionItem): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    createRoot(container).render(<AttentionItemView item={item} doc={doc} />);
  });
  return container;
}

describe("the Notice kind", () => {
  it("renders the kind word, the no-clock slot, and the delivered text verbatim", () => {
    const container = render(noticeItem);

    const article = container.querySelector("article.item");
    expect(article).not.toBeNull();
    expect(article?.getAttribute("data-kind")).toBe("notice");
    // DESIGN.md § Colors › The Attention Ranking Rule: low rank = aqua.
    expect(article?.className).toContain("low");

    expect(container.querySelector(".kind")?.textContent).toBe("Notice");
    expect(container.querySelector(".no-clock")?.textContent).toBe("no clock");
    expect(container.querySelector(".clock")).toBeNull();
    expect(container.querySelector(".no-deadline")).toBeNull();
    expect(container.querySelector(".until")).toBeNull();

    expect(container.querySelector(".prose")?.textContent).toBe(recorded.text);

    document.body.removeChild(container);
  });

  it("renders no credential and nothing token-shaped (spec 003 US4-S5)", () => {
    // FR-017: the browser holds the token, having answered the challenge once;
    // no file under `web/src/` reads, stores, or renders one, so nothing that
    // could be a credential can reach the markup an item produces.
    const container = render(noticeItem);
    const html = container.innerHTML;

    expect(html).not.toContain("Authorization");
    expect(html).not.toMatch(/Bearer\s/);
    expect(html).not.toMatch(/Basic\s/);
    // The same token shape `tests/test_credential_sweep.py` defines: a long hex
    // or base64url run is what a real credential looks like once rendered.
    expect(html).not.toMatch(/[0-9a-fA-F]{16,}/);
    expect(html).not.toMatch(/[A-Za-z0-9+/=_-]{20,}/);

    document.body.removeChild(container);
  });

  it("carries the one italic line and not a single control", () => {
    const container = render(noticeItem);

    expect(container.querySelector(".asks-nothing")?.textContent).toBe(
      "Asks for nothing; no answer exists.",
    );

    for (const tag of ["button", "input", "textarea", "select", "form"]) {
      expect(container.querySelectorAll(tag).length).toBe(0);
    }

    document.body.removeChild(container);
  });
});

/**
 * DESIGN.md § Components › Attention Item › Body segmentation rule (spec 004 US3).
 *
 * The escalations, the Question and the Notice below are the recorded webhook
 * deliveries `pane/fixture_floor.py` seeds the Fixture floor from, plus the two
 * further deliveries the same recording captured. Nothing here is invented
 * (constitution V).
 */

/** DESIGN.md's bound, and the whole reason these tests are properties. */
const BLOCK_MAX = 400;

const escalation = JSON.parse(escalationRaw) as Delivery;
const escalationStandalone = JSON.parse(escalationStandaloneRaw) as Delivery;
const question = JSON.parse(questionRaw) as Delivery;
const questionExpired = JSON.parse(questionExpiredRaw) as Delivery;
const noticeRoadmap = JSON.parse(noticeRoadmapRaw) as Delivery;

function itemFrom(kind: AttentionItem["kind"], delivery: Delivery): AttentionItem {
  return {
    id: delivery.correlation_id,
    kind,
    correlation_id: delivery.correlation_id,
    text: delivery.text,
    actions: delivery.actions,
    expires_at: null,
    settlement: {
      state: "waiting",
      ruling: null,
      signal: null,
      pressed_choice: null,
      resolution: null,
    },
    degraded: null,
  };
}

/** Every rendered text block of the body, in document order. */
function blocksOf(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(".body-col [data-block]")];
}

/**
 * Whitespace normalisation, and nothing else: runs of whitespace collapse to one
 * space and the ends are trimmed. Every other character — every emoji — has to
 * survive on both sides of the comparison.
 */
function normalise(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The kinds the Fixture floor replays, and the two more the recorder captured. */
const everyDelivery: [AttentionItem["kind"], Delivery][] = [
  ["escalation", escalation],
  ["escalation", escalationStandalone],
  ["question", question],
  ["question", questionExpired],
  ["notice", recorded],
  ["notice", noticeRoadmap],
];

describe("the body segmentation rule", () => {
  it("segments the escalation into one block per choice the payload names (FR-008)", () => {
    // The fixture the rule was written against: 1,107 characters of evidence
    // that the first build rendered as a single paragraph.
    expect(escalation.text.length).toBeGreaterThan(BLOCK_MAX);
    expect(escalation.actions.length).toBe(4);

    const container = render(itemFrom("escalation", escalation));
    const choiceBlocks = [...container.querySelectorAll<HTMLElement>(".body-col [data-choice]")];

    expect(choiceBlocks.length).toBe(escalation.actions.length);
    // In the payload's own order, and named by the payload's own token — the
    // pane cuts the evidence where the factory already numbered it.
    expect(choiceBlocks.map((block) => block.dataset.choice)).toEqual(
      escalation.actions.map((action) => action.payload.split(":").pop()),
    );

    // DESIGN.md § Components › Attention Item: the choice blocks stand behind a
    // micro label, and the label is the factory's own lead-in line — carried
    // out of the evidence, not composed by the pane (§ Typography › Micro
    // names it: "what each button does").
    const body = blocksOf(container);
    const label = body.find((block) => block.dataset.block === "label");
    expect(label, "the lead-in to the choice list stands as a micro label").toBeDefined();
    expect(label?.className).toContain("micro");
    expect(escalation.text).toContain(label?.textContent ?? "");
    expect(body.indexOf(label as HTMLElement)).toBeLessThan(
      body.findIndex((block) => block.dataset.choice !== undefined),
    );

    document.body.removeChild(container);
  });

  it("renders the payload back byte-for-byte, emoji included (FR-009)", () => {
    const container = render(itemFrom("escalation", escalation));
    const rendered = blocksOf(container)
      .map((block) => block.textContent ?? "")
      .join("");

    // The assertion that makes it impossible for a later change to rewrite the
    // factory's words while claiming to lay them out (constitution III).
    expect(normalise(rendered)).toBe(normalise(escalation.text));

    // Stated separately because it is the part a well-meaning "cleanup" strips
    // first: every pictograph the factory sent is still on the page, as many
    // times as it sent it.
    const glyphs = escalation.text.match(/\p{Extended_Pictographic}/gu) ?? [];
    expect(glyphs.length).toBeGreaterThan(0);
    for (const glyph of new Set(glyphs)) {
      const count = (source: string) => source.split(glyph).length - 1;
      expect(count(rendered), `${glyph} survived rendering`).toBe(count(escalation.text));
    }

    document.body.removeChild(container);
  });

  it("holds every block of every recorded delivery under 400 characters (FR-010)", () => {
    for (const [kind, delivery] of everyDelivery) {
      const container = render(itemFrom(kind, delivery));
      const blocks = blocksOf(container);
      expect(blocks.length, `${delivery.correlation_id} renders a body`).toBeGreaterThan(0);

      for (const block of blocks) {
        const text = block.textContent ?? "";
        expect(
          text.length,
          `${delivery.correlation_id} block "${text.slice(0, 40)}…" is ${text.length} characters`,
        ).toBeLessThanOrEqual(BLOCK_MAX);
      }

      document.body.removeChild(container);
    }
  });

  it("renders a payload naming no choices as exactly one block (FR-011)", () => {
    // A Question and a Notice name no choices. A segmenter keyed on choices has
    // to degrade to the un-segmented case rather than crash on a payload with
    // none — and the text is still the factory's, still under the bound.
    for (const [kind, delivery] of [
      ["question", question],
      ["question", questionExpired],
      ["notice", recorded],
      ["notice", noticeRoadmap],
    ] as [AttentionItem["kind"], Delivery][]) {
      expect(delivery.actions).toEqual([]);

      const container = render(itemFrom(kind, delivery));
      const blocks = blocksOf(container);

      expect(blocks.length, `${delivery.correlation_id} renders one block`).toBe(1);
      expect(container.querySelectorAll(".body-col [data-choice]").length).toBe(0);
      expect(blocks[0].textContent).toBe(delivery.text);
      expect((blocks[0].textContent ?? "").length).toBeLessThanOrEqual(BLOCK_MAX);

      document.body.removeChild(container);
    }
  });
});
