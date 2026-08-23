import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Showfloor from "../../src/showfloor/Showfloor";
import type { AttentionItem, FloorDocument } from "../../src/api/floorDocument";

import workgraph077 from "../../../fixtures/workgraphs/077-a-scanner-the-operator-chooses-runs-in-the-loop.json?raw";
import escalationsRaw from "../../../fixtures/escalations/open_escalations.json?raw";
import questionRaw from "../../../fixtures/webhook/question.json?raw";
import { stageFromWorkgraph } from "./support/stage-builder";
import {
  installEventSourceDouble,
  openedSources,
} from "./support/event-source-double";

const recordedEscalation = (
  JSON.parse(escalationsRaw) as Array<Record<string, unknown>>
)[0];
const recordedQuestion = JSON.parse(questionRaw) as Record<string, unknown>;

vi.mock("@xyflow/react", () => import("./support/xyflow-double"));

const baseDoc: FloorDocument = {
  reference_instant: null,
  floor: { seam: "floor", data: { epics: [], queue: [], drafts: [] } },
  epics: [],
  attention: { seam: "attention", items: [] },
  health: { seam: "health", data: null },
  spend_to_date: { seam: "spend", data: null },
  degraded: [],
};

describe("Showfloor", () => {
  it("renders quiet floor and no epic-stage when zero epics run", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => baseDoc });

    await act(async () => {
      createRoot(container).render(<Showfloor />);
      await Promise.resolve();
    });

    expect(container.querySelector("[data-quiet-floor]")).not.toBeNull();
    expect(container.querySelector("[data-quiet-floor]")?.textContent?.toLowerCase()).toContain("quiet");
    expect(container.querySelector("[data-epic-stage]")).toBeNull();

    document.body.removeChild(container);
  });

  it("renders one epic-stage per running epic and no quiet floor", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const stage = stageFromWorkgraph(workgraph077, {
      us1: { state: "PENDING", attempt: 1, awaiting_operator: false, landing_state: null },
      us2: { state: "PENDING", attempt: 1, awaiting_operator: false, landing_state: null },
      us3: { state: "RUNNING", attempt: 1, awaiting_operator: false, landing_state: null },
      us4: { state: "VERIFYING", attempt: 1, awaiting_operator: false, landing_state: null },
      us5: { state: "PASSED", attempt: 1, awaiting_operator: false, landing_state: null },
    });

    const doc: FloorDocument = {
      ...baseDoc,
      epics: [
        {
          epic_id: "077-a-scanner-the-operator-chooses-runs-in-the-loop",
          workflow_id: "epic-077-a-scanner-the-operator-chooses-runs-in-the-loop",
          scene: null,
          epic_state: "RUNNING",
          nodes: [],
          stage,
          status_seam: "epic_status",
          workgraph_seam: "workgraph",
        },
        {
          epic_id: "002-expense-notes",
          workflow_id: "epic-002-expense-notes",
          scene: null,
          epic_state: "RUNNING",
          nodes: [],
          stage: { ...stage, epic_id: "002-expense-notes" },
          status_seam: "epic_status",
          workgraph_seam: "workgraph",
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => doc });

    await act(async () => {
      createRoot(container).render(<Showfloor />);
      await Promise.resolve();
    });

    expect(container.querySelectorAll("[data-epic-stage]").length).toBe(2);
    expect(container.querySelector("[data-quiet-floor]")).toBeNull();

    document.body.removeChild(container);
  });
});

describe("Showfloor badge follows floor events", () => {
  // The items are the recording's own open Attention documents; a longer list
  // repeats a recorded document rather than inventing a new shape.
  const escalationItem: AttentionItem = {
    kind: "escalation",
    id: (recordedEscalation.escalation_id as string | undefined) ?? null,
    expires_at: (recordedEscalation.expires_at as string | undefined) ?? null,
    resolution: null,
    source: "open_escalations",
    document: recordedEscalation,
  };
  const questionItem: AttentionItem = {
    kind: "question",
    id: (recordedQuestion.correlation_id as string | undefined) ?? null,
    expires_at: null,
    resolution: null,
    source: "stored_questions",
    document: recordedQuestion,
  };

  const ITEMS: AttentionItem[] = [escalationItem, questionItem];
  const MORE_ITEMS: AttentionItem[] = [...ITEMS, escalationItem];
  const N = ITEMS.length;

  function docWith(items: AttentionItem[]): FloorDocument {
    return { ...baseDoc, attention: { ...baseDoc.attention, items } };
  }

  it("updates the count from typed floor events, without navigation or reload", async () => {
    const restore = installEventSourceDouble();
    const container = document.createElement("div");
    document.body.appendChild(container);

    const pathnameBefore = window.location.pathname;
    const fetchStub = vi.fn().mockResolvedValue({ ok: true, json: async () => baseDoc });
    globalThis.fetch = fetchStub as unknown as typeof fetch;

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
      source.emit("floor", docWith(ITEMS));
    });
    expect(badgeText()).toMatch(new RegExp(`^${N}\\b`));

    await act(async () => {
      source.emit("floor", docWith(MORE_ITEMS));
    });
    expect(badgeText()).toMatch(new RegExp(`^${N + 1}\\b`));

    // An event of an unknown type changes nothing, on either channel.
    await act(async () => {
      source.emit("attention", docWith(ITEMS));
      source.emitOnMessageChannel("sparkle", docWith(ITEMS));
    });
    expect(badgeText()).toMatch(new RegExp(`^${N + 1}\\b`));

    // No navigation and no reload: the room was never re-mounted, the floor was
    // fetched exactly once, and the path did not move.
    expect(container.firstElementChild).toBe(rootNode);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe(pathnameBefore);
    expect(source.closed).toBe(false);
    expect(openedSources.length).toBe(1);

    document.body.removeChild(container);
    restore();
  });
});
