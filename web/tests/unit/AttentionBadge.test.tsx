/**
 * The Showfloor's attention badge (FR-017).
 *
 * The items are the Fixture floor's own recording, read through Vite's ?raw
 * import and mapped into 001's `AttentionItem` shape here — the recording is
 * never edited, and the empty case is constructed at the document level
 * (constitution V).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Showfloor from "../../src/showfloor/Showfloor";
import type { AttentionItem, FloorDocument } from "../../src/api/floorDocument";

import escalationsRaw from "../../../fixtures/escalations/open_escalations.json?raw";
import questionRaw from "../../../fixtures/webhook/question.json?raw";

vi.mock("@xyflow/react", () => import("./support/xyflow-double"));

/** The Showfloor opens no second EventSource; in jsdom it opens none at all. */
class InertEventSource {
  addEventListener(): void {}
  removeEventListener(): void {}
  close(): void {}
}

const recordedEscalations = JSON.parse(escalationsRaw) as Array<Record<string, unknown>>;
const recordedQuestions = [JSON.parse(questionRaw) as Record<string, unknown>];

const RECORDED_ITEMS: AttentionItem[] = [
  ...recordedEscalations.map((document) => ({
    kind: "escalation" as const,
    id: (document.escalation_id as string | undefined) ?? null,
    expires_at: (document.expires_at as string | undefined) ?? null,
    resolution: (document.resolution as string | null | undefined) ?? null,
    source: "open_escalations" as const,
    document,
  })),
  ...recordedQuestions.map((document) => ({
    kind: "question" as const,
    id: (document.correlation_id as string | undefined) ?? null,
    expires_at: null,
    resolution: null,
    source: "stored_questions" as const,
    document,
  })),
];

const N = RECORDED_ITEMS.length;

const baseDoc: FloorDocument = {
  reference_instant: null,
  floor: { seam: "collect_floor", data: { epics: [], queue: [], drafts: [] } },
  epics: [],
  attention: { seam: "open_escalations + stored Question documents", items: [] },
  health: { seam: "list_findings", data: null },
  spend_to_date: { seam: "rollup", data: null },
  degraded: [],
};

const containers: HTMLElement[] = [];

async function renderShowfloor(doc: FloorDocument): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  (globalThis as unknown as { EventSource: unknown }).EventSource = InertEventSource;
  globalThis.fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => doc }) as unknown as typeof fetch;

  await act(async () => {
    createRoot(container).render(<Showfloor />);
    await Promise.resolve();
  });

  return container;
}

afterEach(() => {
  while (containers.length > 0) {
    const container = containers.pop()!;
    if (container.parentNode) container.parentNode.removeChild(container);
  }
});

describe("AttentionBadge", () => {
  it("count and target", async () => {
    // The recording carries open attention, so this is the N > 0 case.
    expect(N).toBeGreaterThan(0);

    const container = await renderShowfloor({
      ...baseDoc,
      attention: { ...baseDoc.attention, items: RECORDED_ITEMS },
    });

    const badges = container.querySelectorAll("[data-attention-badge]");
    expect(badges.length).toBe(1);

    const badge = badges[0] as HTMLAnchorElement;
    expect(badge.tagName).toBe("A");
    expect(badge.textContent ?? "").toMatch(new RegExp(`^${N}\\b`));
    expect(badge.getAttribute("href")).toBe("/desk");
    expect((badge.textContent ?? "").toLowerCase()).toContain("waiting on you");

    // The control: the same document with the list emptied at the document
    // level — the recording itself is never emptied (constitution V).
    const empty = await renderShowfloor({
      ...baseDoc,
      attention: { ...baseDoc.attention, items: [] },
    });

    expect(empty.querySelector("[data-attention-badge]")).toBeNull();
    expect(empty.querySelector("[data-attention-degraded]")).toBeNull();
  });
});

describe("AttentionBadge degraded reads", () => {
  const MODES: Array<{ mode: "transport" | "refusal"; detail: string }> = [
    { mode: "transport", detail: "attention: connection refused" },
    { mode: "refusal", detail: "attention: query rejected" },
  ];

  for (const { mode, detail } of MODES) {
    it(`renders a ${mode} note in the badge's place, and no count`, async () => {
      // The items are present too: a count taken from a read that failed is a
      // number the pane cannot stand behind, so the degraded entry wins.
      const container = await renderShowfloor({
        ...baseDoc,
        attention: { ...baseDoc.attention, items: RECORDED_ITEMS },
        degraded: [
          {
            section: "attention",
            mode,
            epic_id: null,
            read: "open_escalations",
            detail,
          },
        ],
      });

      const note = container.querySelector(
        `[data-attention-degraded][data-mode="${mode}"]`,
      );
      expect(note).not.toBeNull();
      expect((note!.textContent ?? "").toLowerCase()).toContain("attention");
      expect((note!.textContent ?? "").toLowerCase()).toContain(mode);

      expect(container.querySelector("[data-attention-badge]")).toBeNull();

      // Unknown is not zero: nothing in the masthead reads as the numeral 0.
      const masthead = container.querySelector("header.mast");
      expect(masthead).not.toBeNull();
      const mastheadElements = [masthead!, ...Array.from(masthead!.querySelectorAll("*"))];
      for (const element of mastheadElements) {
        expect((element.textContent ?? "").trim()).not.toBe("0");
      }
      expect((masthead!.textContent ?? "")).not.toContain(String(N));
    });
  }
});
