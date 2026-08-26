/**
 * The Desk's assembly: what it renders for a floor, a failed read, a refused
 * token, and the section order 001 fixed (001, 003).
 *
 * **One named change, 006 US2 (FR-003's discipline).** "renders an undeclared
 * node card" reads the story's cell as `[data-story][data-undeclared]` instead
 * of `.chev[data-undeclared]`: `NodeChevron` is deleted in that story's diff —
 * the first world's chevron glyph is one of the three pictures FR-004 removes
 * from the DOM — so the selector moved onto the element that replaced it. The
 * subject is untouched: the same undeclared, paged, VERIFYING story, asserted
 * to say all three of those things on the element that carries it.
 */
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
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => doc });
  await act(async () => {
    createRoot(container).render(<Desk />);
    await Promise.resolve();
  });
  return container;
}

describe("Desk", () => {
  it("renders quiet floor and no degraded well when empty", async () => {
    const c = await renderDesk(buildDoc());
    expect(c.querySelector(".quiet")?.textContent).toContain("Quiet floor");
    expect(c.querySelector(".degraded")).toBeNull();
    document.body.removeChild(c);
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
    document.body.removeChild(c);
  });

  it("renders refusal and transport wells differently", async () => {
    const c = await renderDesk(
      buildDoc({
        degraded: [
          { section: "epics", mode: "refusal", epic_id: "fx-landing-f0a0d6", read: "epic_status", detail: "Query rejected" },
          { section: "health", mode: "transport", epic_id: null, read: "list_findings", detail: "could not connect" },
        ],
        health: { seam: "health", data: null },
      }),
    );
    const wells = c.querySelectorAll(".degraded");
    const refusal = Array.from(wells).find((w) => w.getAttribute("data-mode") === "refusal");
    const transport = Array.from(wells).find((w) => w.getAttribute("data-mode") === "transport");
    expect(refusal?.textContent).toContain("refused its query");
    expect(transport?.textContent).toContain("could not be reached");
    expect(refusal?.textContent).not.toBe(transport?.textContent);
    expect(c.querySelector(".attention")).not.toBeNull();
    expect(c.querySelector(".spend")).not.toBeNull();
    expect(c.querySelector("section.floor")).not.toBeNull();
    document.body.removeChild(c);
  });

  it("renders a refused token as its own well, not as an unreachable floor", async () => {
    // Spec 003 US4 (T058): the words are the well's, and they name the token
    // rather than the read. No hue, no red, and nothing of the floor.
    const c = document.createElement("div");
    document.body.appendChild(c);
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    await act(async () => {
      createRoot(c).render(<Desk />);
      await Promise.resolve();
    });

    const well = c.querySelector(".degraded[data-mode='unauthorized']");
    expect(well).not.toBeNull();
    expect(well?.querySelector(".lead")?.textContent).toBe("The pane's token was refused.");
    expect(well?.textContent).toContain("Nothing can be read until one is presented.");
    // Distinct from the transport well a 503 renders (the two failures are two
    // different facts, constitution III).
    expect(c.querySelector(".degraded[data-mode='transport']")).toBeNull();
    expect(well?.textContent).not.toContain("could not be reached");
    // And nothing token-shaped is on the page: the browser holds the credential,
    // the Desk never does (FR-017).
    expect(c.innerHTML).not.toMatch(/Bearer |Basic |Authorization/);
    document.body.removeChild(c);
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
              { id: "us1", declared: false, story_key: null, persona: "implementer", spec_ref: null, depends_on: null, depends_on_merged: null, state: "VERIFYING", attempt: 2, awaiting_operator: true, landing_state: null, pr_number: null, verified: false },
            ],
            status_seam: "EpicWorkflow.epic_status",
            workgraph_seam: "workgraph",
          },
        ],
      }),
    );
    const undeclared = c.querySelector("[data-story][data-undeclared]");
    expect(undeclared).not.toBeNull();
    expect(undeclared?.getAttribute("data-state")).toBe("VERIFYING");
    expect(undeclared?.hasAttribute("data-paged")).toBe(true);
    expect(undeclared?.textContent).toContain("paged");
    document.body.removeChild(c);
  });

  it("renders no unreachable notice for an epic whose graph was read", async () => {
    // 012 US1-S1 (FR-002): a workgraph read the archive satisfied is not a
    // degradation, so the document carries no `epics` entry and the well the
    // operator was reading on every epic has nothing to render from. The row
    // is there instead, carrying the stories the graph declared.
    const c = await renderDesk(
      buildDoc({
        epics: [
          {
            epic_id: "910-a-constructed-epic",
            workflow_id: "epic-910-a-constructed-epic",
            scene: null,
            epic_state: "RUNNING",
            nodes: [
              { id: "us1", declared: true, story_key: "US1", persona: "implementer", spec_ref: "910-a-constructed-epic:US1", depends_on: [], depends_on_merged: [], state: "RUNNING", attempt: 1, awaiting_operator: false, landing_state: null, pr_number: null, verified: false },
              { id: "us2", declared: true, story_key: "US2", persona: "implementer", spec_ref: "910-a-constructed-epic:US2", depends_on: [], depends_on_merged: ["us1"], state: "PENDING", attempt: null, awaiting_operator: false, landing_state: null, pr_number: null, verified: false },
            ],
            status_seam: "EpicWorkflow.epic_status",
            workgraph_seam: "workgraph",
          },
        ],
        degraded: [],
      }),
    );

    expect(c.querySelector(".degraded")).toBeNull();
    expect(c.innerHTML).not.toContain("could not be reached");
    expect(c.querySelectorAll("[data-story]").length).toBe(2);
    document.body.removeChild(c);
  });

  it("renders attention before the floor section", async () => {
    const c = await renderDesk(
      buildDoc({
        attention: {
          seam: "attention",
          items: [
            {
              id: "800ee6b4c7df",
              kind: "question",
              correlation_id: "800ee6b4c7df",
              text: "what is next?",
              actions: [],
              expires_at: null,
              settlement: { state: "waiting", ruling: null, signal: null, pressed_choice: null, resolution: null },
              degraded: null,
            },
          ],
        },
        floor: { seam: "floor", data: { epics: [{}], queue: [], drafts: [] } },
      }),
    );
    const html = c.innerHTML;
    expect(html.indexOf('section class="floor"')).toBeGreaterThan(html.lastIndexOf("article item"));
    document.body.removeChild(c);
  });

  it("quiet and unreachable floors render differently", async () => {
    const quiet = await renderDesk(buildDoc());
    const unreachable = await renderDesk(
      buildDoc({
        floor: { seam: "floor", data: null },
        degraded: [{ section: "floor", mode: "transport", epic_id: null, read: "collect_floor", detail: "unreachable" }],
      }),
    );
    expect(quiet.innerHTML).toContain("Quiet floor");
    expect(quiet.innerHTML).not.toContain("could not be reached");
    expect(unreachable.innerHTML).toContain("could not be reached");
    expect(unreachable.innerHTML).not.toContain("Quiet floor");
    expect(quiet.innerHTML).not.toBe(unreachable.innerHTML);
    document.body.removeChild(quiet);
    document.body.removeChild(unreachable);
  });
});
