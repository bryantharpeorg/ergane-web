import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import NodeChevron from "../../src/desk/NodeChevron";
import type { NodeCard, NodeState } from "../../src/api/floorDocument";

const STATES: NodeState[] = [
  "PENDING", "KEY_ISSUED", "RUNNING", "VERIFYING", "PASSED",
  "PR_OPEN", "ENQUEUED", "MERGED", "FAILED", "KILLED", "WAITING_OPERATOR",
];

function card(state: NodeState, overrides: Partial<NodeCard> = {}): NodeCard {
  return {
    id: "us1",
    declared: true,
    story_key: "us1",
    persona: "implementer",
    spec_ref: null,
    depends_on: null,
    depends_on_merged: null,
    state,
    attempt: 1,
    awaiting_operator: false,
    landing_state: null,
    pr_number: null,
    verified: false,
    ...overrides,
  };
}

describe("NodeChevron", () => {
  it("renders all eleven states distinctly", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const pairs = new Set<string>();
    for (const state of STATES) {
      act(() => createRoot(container).render(<NodeChevron card={card(state)} />));
      const chev = container.querySelector(".chev");
      const cls = chev?.className ?? "";
      const cap = chev?.querySelector(".cap")?.textContent ?? "";
      expect(cap).not.toBe("");
      pairs.add(`${cls} | ${cap}`);
      container.innerHTML = "";
    }
    expect(pairs.size).toBe(11);
    document.body.removeChild(container);
  });

  it("marks paged VERIFYING node as paged, never WAITING_OPERATOR", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    act(() => createRoot(container).render(<NodeChevron card={card("VERIFYING", { awaiting_operator: true })} />));
    const chev = container.querySelector(".chev");
    expect(chev?.getAttribute("data-state")).toBe("VERIFYING");
    expect(chev?.hasAttribute("data-paged")).toBe(true);
    expect(chev?.textContent).toContain("paged");
    document.body.removeChild(container);
  });

  it("renders declared=false as undeclared", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    act(() => createRoot(container).render(<NodeChevron card={card("VERIFYING", { declared: false })} />));
    const chev = container.querySelector(".chev");
    expect(chev?.hasAttribute("data-undeclared")).toBe(true);
    expect(chev?.querySelector(".cap")?.textContent).toBe("undeclared");
    document.body.removeChild(container);
  });

  it("keeps paged marker when also undeclared", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    act(() =>
      createRoot(container).render(
        <NodeChevron card={card("VERIFYING", { declared: false, awaiting_operator: true })} />,
      ),
    );
    const chev = container.querySelector(".chev");
    expect(chev?.hasAttribute("data-undeclared")).toBe(true);
    expect(chev?.hasAttribute("data-paged")).toBe(true);
    expect(chev?.getAttribute("data-state")).toBe("VERIFYING");
    expect(chev?.textContent).toContain("paged");
    document.body.removeChild(container);
  });
});
