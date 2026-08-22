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

async function renderDesk(doc: FloorDocument) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => doc,
  });
  await act(async () => {
    createRoot(container).render(<Desk />);
    await Promise.resolve();
  });
  return container;
}

function cleanup(container: HTMLDivElement) {
  document.body.removeChild(container);
}

describe("Desk", () => {
  it("renders quiet floor and no degraded well when empty", async () => {
    const c = await renderDesk(buildDoc());
    expect(c.querySelector(".quiet")?.textContent).toContain("Quiet floor");
    expect(c.querySelector(".degraded")).toBeNull();
    cleanup(c);
  });

  it("renders transport well and no quiet line when floor read failed", async () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await act(async () => {
      createRoot(c).render(<Desk />);
      await Promise.resolve();
    });
    expect(c.querySelector(".degraded[data-mode='transport']")).not.toBeNull();
    expect(c.querySelector(".quiet")).toBeNull();
    cleanup(c);
  });

  it("renders refusal and transport wells differently while healthy sections survive", async () => {
    const c = await renderDesk(
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
    );
    const wells = c.querySelectorAll(".degraded");
    const refusal = Array.from(wells).find(
      (w) => w.getAttribute("data-mode") === "refusal",
    );
    const transport = Array.from(wells).find(
      (w) => w.getAttribute("data-mode") === "transport",
    );
    expect(refusal?.textContent).toContain("refused its query");
    expect(transport?.textContent).toContain("could not be reached");
    expect(refusal?.textContent).not.toBe(transport?.textContent);
    expect(c.querySelector(".attention")).not.toBeNull();
    expect(c.querySelector(".spend")).not.toBeNull();
    expect(c.querySelector("section.floor")).not.toBeNull();
    cleanup(c);
  });

  it("renders an undeclared node card", async () => {
    const c = await renderDesk(
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
    );
    const undeclared = c.querySelector(".chev[data-undeclared]");
    expect(undeclared).not.toBeNull();
    expect(undeclared?.getAttribute("data-state")).toBe("VERIFYING");
    expect(undeclared?.hasAttribute("data-paged")).toBe(true);
    expect(undeclared?.textContent).toContain("paged");
    cleanup(c);
  });

  it("renders attention before the floor section", async () => {
    const c = await renderDesk(
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
        floor: { seam: "floor", data: { epics: [{}], queue: [], drafts: [] } },
      }),
    );
    const html = c.innerHTML;
    expect(html.indexOf('section class="floor"')).toBeGreaterThan(
      html.lastIndexOf("article item"),
    );
    cleanup(c);
  });

  it("quiet and unreachable floors render differently", async () => {
    const quiet = await renderDesk(buildDoc());
    const unreachable = await renderDesk(
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
    );
    expect(quiet.innerHTML).toContain("Quiet floor");
    expect(quiet.innerHTML).not.toContain("could not be reached");
    expect(unreachable.innerHTML).toContain("could not be reached");
    expect(unreachable.innerHTML).not.toContain("Quiet floor");
    expect(quiet.innerHTML).not.toBe(unreachable.innerHTML);
    cleanup(quiet);
    cleanup(unreachable);
  });
});
