import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Desk from "../../src/desk/Desk";
import type { FloorDocument } from "../../src/api/floorDocument";

const baseDoc: FloorDocument = {
  reference_instant: null,
  floor: { seam: "floor", data: { epics: [], queue: [], drafts: [] } },
  epics: [],
  attention: { seam: "attention", items: [] },
  health: { seam: "health", data: null },
  spend_to_date: { seam: "spend", data: null },
  degraded: [],
};

function buildDoc(overrides: Partial<FloorDocument> = {}): FloorDocument {
  return { ...baseDoc, ...overrides };
}

describe("Desk", () => {
  it("renders the quiet floor and no degraded well when floor is empty", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => buildDoc(),
    });

    await act(async () => {
      createRoot(container).render(<Desk />);
      await Promise.resolve();
    });

    expect(container.querySelector(".quiet")?.textContent).toContain(
      "Quiet floor",
    );
    expect(container.querySelector(".degraded")).toBeNull();

    document.body.removeChild(container);
  });

  it("renders a transport well and no quiet line when floor read failed", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    await act(async () => {
      createRoot(container).render(<Desk />);
      await Promise.resolve();
    });

    expect(container.querySelector(".degraded[data-mode='transport']")).not.toBeNull();
    expect(container.querySelector(".quiet")).toBeNull();

    document.body.removeChild(container);
  });

  it("renders refusal and transport wells differently while healthy sections stay present", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        buildDoc({
          degraded: [
            {
              section: "epics",
              mode: "refusal",
              epic_id: "fx-landing-f0a0d6",
              read: "epic_status",
              detail: "Query rejected",
            },
            {
              section: "health",
              mode: "transport",
              epic_id: null,
              read: "list_findings",
              detail: "could not connect",
            },
          ],
          health: { seam: "health", data: null },
        }),
    });

    await act(async () => {
      createRoot(container).render(<Desk />);
      await Promise.resolve();
    });

    const wells = container.querySelectorAll(".degraded");
    const refusal = Array.from(wells).find(
      (w) => w.getAttribute("data-mode") === "refusal",
    );
    const transport = Array.from(wells).find(
      (w) => w.getAttribute("data-mode") === "transport",
    );

    expect(refusal?.textContent).toContain("refused its query");
    expect(transport?.textContent).toContain("could not be reached");
    expect(refusal?.textContent).not.toBe(transport?.textContent);

    expect(container.querySelector(".attention")).not.toBeNull();
    expect(container.querySelector(".spend")).not.toBeNull();
    expect(container.querySelector("section.floor")).not.toBeNull();

    document.body.removeChild(container);
  });

  it("renders an undeclared node card", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        buildDoc({
          epics: [
            {
              epic_id: "fx-paged-5e2e8a",
              workflow_id: "epic-fx-paged-5e2e8a",
              scene: "paged-while-verifying",
              epic_state: "RUNNING",
              nodes: [
                {
                  id: "us1",
                  declared: false,
                  story_key: null,
                  persona: "implementer",
                  spec_ref: null,
                  depends_on: null,
                  depends_on_merged: null,
                  state: "VERIFYING",
                  attempt: 2,
                  awaiting_operator: true,
                  landing_state: null,
                  pr_number: null,
                  verified: false,
                },
              ],
              status_seam: "EpicWorkflow.epic_status",
              workgraph_seam: "workgraph",
            },
          ],
        }),
    });

    await act(async () => {
      createRoot(container).render(<Desk />);
      await Promise.resolve();
    });

    const undeclared = container.querySelector(".chev[data-undeclared]");
    expect(undeclared).not.toBeNull();
    if (undeclared) {
      expect(undeclared.getAttribute("data-state")).toBe("VERIFYING");
      expect(undeclared.hasAttribute("data-paged")).toBe(true);
      expect(undeclared.textContent).toContain("paged");
    }

    document.body.removeChild(container);
  });

  it("renders the attention strip before the floor section", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        buildDoc({
          attention: {
            seam: "attention",
            items: [
              {
                kind: "question",
                id: "q1",
                expires_at: null,
                resolution: null,
                source: "stored_questions",
                document: { text: "what is next?" },
              },
            ],
          },
          floor: {
            seam: "floor",
            data: { epics: [{}], queue: [], drafts: [] },
          },
        }),
    });

    await act(async () => {
      createRoot(container).render(<Desk />);
      await Promise.resolve();
    });

    const html = container.innerHTML;
    const lastItem = html.lastIndexOf("article item");
    const firstFloor = html.indexOf('section class="floor"');
    expect(lastItem).toBeLessThan(firstFloor);

    document.body.removeChild(container);
  });

  it("quiet and unreachable floors render differently", async () => {
    const quietContainer = document.createElement("div");
    const unreachableContainer = document.createElement("div");
    document.body.appendChild(quietContainer);
    document.body.appendChild(unreachableContainer);

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => buildDoc(),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          buildDoc({
            floor: { seam: "floor", data: null },
            degraded: [
              {
                section: "floor",
                mode: "transport",
                epic_id: null,
                read: "collect_floor",
                detail: "unreachable",
              },
            ],
          }),
      });

    await act(async () => {
      createRoot(quietContainer).render(<Desk />);
    });
    await act(async () => {
      createRoot(unreachableContainer).render(<Desk />);
    });

    expect(quietContainer.innerHTML).toContain("Quiet floor");
    expect(quietContainer.innerHTML).not.toContain("could not be reached");
    expect(unreachableContainer.innerHTML).toContain("could not be reached");
    expect(unreachableContainer.innerHTML).not.toContain("Quiet floor");
    expect(quietContainer.innerHTML).not.toBe(unreachableContainer.innerHTML);

    document.body.removeChild(quietContainer);
    document.body.removeChild(unreachableContainer);
  });
});
