/// <reference types="vite/client" />
/**
 * Every ruling the factory can return renders as itself (spec 003 US3-S1, S2).
 *
 * The item under test is built from `fixtures/webhook/question.json` — the
 * factory's own POST body — and the rulings are driven through as *strings*,
 * which is all the renderer ever sees. That is why this file needs no ruling
 * fixture and why the one ruling nobody could record (SIGNAL_FAILED, which needs
 * an orchestrator the signal cannot reach) is proven here anyway: the renderer's
 * input is a string either way, and inventing a `fixtures/bridge/SIGNAL_FAILED`
 * document to reach it would be the invention constitution V forbids.
 *
 * The second half is the honesty control. A word the factory may say later must
 * render as itself today — the pane's truthfulness cannot depend on knowing the
 * factory's whole vocabulary — so a mapping table added to `ruling.ts` turns
 * these red rather than quietly rewording a refusal into something friendlier.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import AttentionItemView from "../../src/desk/AttentionItem";
import type {
  AttentionItem,
  AttentionSettlement,
  FloorDocument,
} from "../../src/api/floorDocument";
import globalCss from "../../src/styles/global.css?raw";

import questionRaw from "../../../fixtures/webhook/question.json?raw";

const delivered = JSON.parse(questionRaw) as { correlation_id: string; text: string };

/** The six `BridgeOutcome` strings the spec enumerates for `handle_relay`. */
const RULINGS: string[] = [
  "RESOLVED",
  "UNKNOWN",
  "ALREADY_RESOLVED",
  "EXPIRED",
  "UNAUTHORIZED",
  "SIGNAL_FAILED",
];

/** Members of `BridgeOutcome` the spec does not enumerate, and one it may add. */
const UNRECOGNIZED = ["BRIDGE_ERROR", "MALFORMED", "A_WORD_THE_FACTORY_MAY_SAY_LATER"];

const doc = { reference_instant: "2026-08-22T17:41:27Z" } as FloorDocument;

function questionRuled(ruling: string): AttentionItem {
  const settlement: AttentionSettlement = {
    // `ruled` is the state every ruling but RESOLVED produces; the rendering of
    // the word itself is the same in either, which is the point of US3-S1.
    state: ruling === "RESOLVED" ? "settled" : "ruled",
    ruling,
    signal: null,
    pressed_choice: null,
    resolution: null,
  };
  return {
    id: delivered.correlation_id,
    kind: "question",
    correlation_id: delivered.correlation_id,
    text: delivered.text,
    actions: [],
    expires_at: null,
    settlement,
    degraded: null,
  };
}

function render(item: AttentionItem): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    createRoot(container).render(<AttentionItemView item={item} doc={doc} />);
  });
  return container;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("every ruling renders verbatim, on the item, in the body column", () => {
  it.each(RULINGS)("renders %s exactly as the factory returned it", (ruling) => {
    const container = render(questionRuled(ruling));

    const word = container.querySelector(".body-col .ruling");
    expect(word, `${ruling} did not reach the body column`).not.toBeNull();
    // Verbatim: the same string, the same case, nothing appended or trimmed.
    expect(word?.textContent).toBe(ruling);

    // In the item, not somewhere else on the page.
    expect(container.querySelector("article.item .body-col .ruling")).not.toBeNull();
    // And in the clock column, where a countdown lives, it is nowhere.
    expect(container.querySelector(".clock-col .ruling")).toBeNull();
  });

  it("sets the factory's word in a mono face and the pane's prose in text", () => {
    const container = render(questionRuled("RESOLVED"));
    const word = container.querySelector(".ruling") as HTMLElement;

    // DESIGN.md § Typography › The Factory Speaks in Mono Rule. jsdom applies no
    // stylesheet, so the proof is the class the element carries plus the rule
    // the committed stylesheet declares for it.
    expect(word.className.split(/\s+/)).toContain("num");
    expect(globalCss).toMatch(/\.attention \.ruling[\s\S]{0,120}font-family: var\(--mono\)/);

    // DESIGN.md § Colors › The No-Red Rule and § Inputs / Fields › Error: none —
    // a refusal is the factory speaking, not a field error, and it lands in the
    // same place and the same ink as every other ruling.
    const refusal = render(questionRuled("UNAUTHORIZED"));
    const line = refusal.querySelector(".body-col .ruling-line") as HTMLElement;
    expect(line).not.toBeNull();
    expect(line.className).not.toMatch(/error|danger|red|alert/);
    expect(refusal.querySelector('[role="alert"]')).toBeNull();
    expect(globalCss).toMatch(/\.attention \.ruling-line \{[^}]*var\(--olive-ink\)/);
  });

  it("shows no ruling line at all before the factory has said anything", () => {
    const waiting = questionRuled("RESOLVED");
    const container = render({
      ...waiting,
      settlement: { ...waiting.settlement, state: "waiting", ruling: null },
    });

    expect(container.querySelector(".ruling-line")).toBeNull();
  });
});

describe("a ruling the pane does not recognize renders as itself", () => {
  it.each(UNRECOGNIZED)("renders %s unremapped, and does not throw", (ruling) => {
    const container = render(questionRuled(ruling));

    const word = container.querySelector(".body-col .ruling");
    expect(word?.textContent).toBe(ruling);
  });

  it("substitutes no friendlier word for any of them", () => {
    for (const ruling of UNRECOGNIZED) {
      const container = render(questionRuled(ruling));
      const line = container.querySelector(".ruling-line")?.textContent ?? "";

      expect(line).toContain(ruling);
      // None of the words a well-meant mapping table would reach for.
      expect(line.toLowerCase()).not.toMatch(
        /unrecognized|unknown ruling|something went wrong|try again|invalid|failed to/,
      );
    }
  });
});
