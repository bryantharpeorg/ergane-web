/**
 * The one legend row (005 US3-S3, FR-012).
 *
 * **This file replaces its own 002-era cases**, "quotes the verbatim pass-edge
 * definition" and "quotes the verbatim merge-edge definition". They asserted
 * the route-map glossary — two paragraphs defining a pass edge and a merge edge
 * for a map D-015 deleted. Their subject is gone; what succeeds them is below,
 * and it is the stronger half of what that legend was for: the two strokes are
 * still told apart in words, and the repetition defect the first world shipped
 * is now the thing under test.
 *
 * That defect is worth naming. `EpicStage.tsx` rendered `<Legend />` inside
 * itself, and the Showfloor mounted one `EpicStage` per running epic — so the
 * 004 run drew the legend three times down one page (`docs/
 * pane-review-2026-08-24.md`). No test caught it, because every test rendered
 * one epic. The case below renders the room over a whole fixture floor and
 * counts.
 */

import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Legend from "../../src/showfloor/Legend";
import Showfloor from "../../src/showfloor/Showfloor";
import {
  buildingEntry,
  draftEntry,
  killedEntry,
  landedEntry,
  readyEntry,
  waitingEntry,
} from "./support/showfloor-builder";

const containers: HTMLElement[] = [];

function mount(node: JSX.Element): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  act(() => {
    createRoot(container).render(node);
  });
  return container;
}

describe("the legend reads the two things stroke alone would not say", () => {
  it("names the four ladder fills and both edge kinds", () => {
    const container = mount(<Legend />);
    const legend = container.querySelector("[data-legend]")!;

    // § Named Rules: "State is never colour alone." A ladder bar and a wire
    // have nowhere to write their own word, so the legend writes it for them.
    const fills = Array.from(container.querySelectorAll("[data-legend-fill]")).map((fill) => ({
      key: fill.getAttribute("data-legend-fill"),
      word: (fill.textContent ?? "").trim(),
    }));
    expect(fills).toEqual([
      { key: "done", word: "done" },
      { key: "now", word: "now" },
      { key: "hold", word: "waiting on you" },
      { key: "ahead", word: "ahead" },
    ]);

    // § Stage: merge edges solid, pass edges dashed — said in words here.
    const edges = (container.querySelector("[data-legend-edges]")!.textContent ?? "").trim();
    expect(edges).toBe("solid wire = merge edge · dashed = pass edge");
    expect(legend.textContent).toContain("merge edge");
    expect(legend.textContent).toContain("pass edge");
  });
});

describe("the legend renders exactly once per page (FR-012)", () => {
  it("stays at one however many epics the rail carries", async () => {
    // Six specs, five of them with live stories: the first world would have
    // drawn one legend per epic on stage. The rail can hold any number; the
    // legend is mounted from the room, which there is one of.
    const rail = [
      landedEntry("001-the-desk-sees-the-floor"),
      buildingEntry("002-the-showfloor-stages-an-epic"),
      readyEntry("003-an-answer-reaches-the-factory"),
      draftEntry("004-the-pane-fits-the-screen"),
      waitingEntry("005-one-epic-on-stage"),
      killedEntry("006-the-desk-matches-the-stage"),
    ];

    (globalThis as unknown as { EventSource: unknown }).EventSource = undefined;
    globalThis.fetch = vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url === "/api/showfloor"
          ? { reference_instant: null, specs_root: "specs", rail, degraded: [] }
          : {
              reference_instant: null,
              floor: { seam: "collect_floor", data: {} },
              epics: [],
              attention: { seam: "open_escalations", items: [] },
              health: { seam: "list_findings", data: null },
              spend_to_date: { seam: "rollup", data: null },
              degraded: [],
            },
    })) as unknown as typeof fetch;

    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    await act(async () => {
      createRoot(container).render(<Showfloor />);
      await Promise.resolve();
    });

    // The room really rendered all six rows, so a count of one is a fact about
    // the legend and not about an empty page.
    expect(container.querySelectorAll("[data-rail-row]").length).toBe(6);
    expect(container.querySelectorAll("[data-legend]").length).toBe(1);
    expect(container.querySelectorAll("[data-legend-edges]").length).toBe(1);

    // And it is under the stage, not inside anything that repeats.
    const legend = container.querySelector("[data-legend]")!;
    expect(legend.closest("[data-stage]")).not.toBeNull();
    expect(legend.closest("[data-node-card]")).toBeNull();
    expect(legend.closest("[data-rail-row]")).toBeNull();
  });
});
