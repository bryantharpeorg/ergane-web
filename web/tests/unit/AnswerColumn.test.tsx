/**
 * The answer column offers exactly what the factory delivered (spec 003 US2).
 *
 * The Escalation under test is built from `fixtures/webhook/escalation.json` —
 * the factory's own POST body — so every label and every payload asserted here
 * is a recording rather than a value a test author chose (constitution V). A
 * pane that reworded a button, dropped one, reordered them, or added one of its
 * own turns these red without anyone having to notice by eye (FR-007).
 *
 * The second half is the control against the defect D-001 forbids: the *only*
 * interactive elements on an item are the factory's delivered choices, or a
 * Question's reply field and its one Answer button, or — for a Notice — nothing
 * at all. A convenience write added here has broken the constitution, not helped
 * the operator (US2-S4).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import AnswerColumn from "../../src/desk/AnswerColumn";
import type { AttentionItem, AttentionSettlement } from "../../src/api/floorDocument";

import escalationRaw from "../../../fixtures/webhook/escalation.json?raw";
import questionRaw from "../../../fixtures/webhook/question.json?raw";
import noticeRaw from "../../../fixtures/webhook/notice-supervision.json?raw";

interface Delivery {
  correlation_id: string;
  text: string;
  actions: { label: string; payload: string }[];
}

const escalationDelivery = JSON.parse(escalationRaw) as Delivery;
const questionDelivery = JSON.parse(questionRaw) as Delivery;
const noticeDelivery = JSON.parse(noticeRaw) as Delivery;

const waiting: AttentionSettlement = {
  state: "waiting",
  ruling: null,
  signal: null,
  pressed_choice: null,
  resolution: null,
};

function itemFrom(
  delivery: Delivery,
  kind: AttentionItem["kind"],
  settlement: AttentionSettlement = waiting,
): AttentionItem {
  return {
    id: kind === "notice" ? "notice:1" : delivery.correlation_id,
    kind,
    correlation_id: delivery.correlation_id,
    text: delivery.text,
    actions: delivery.actions,
    expires_at: null,
    settlement,
    degraded: null,
  };
}

const escalation = itemFrom(escalationDelivery, "escalation");
const question = itemFrom(questionDelivery, "question");
const notice = itemFrom(noticeDelivery, "notice");

function render(item: AttentionItem): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    createRoot(container).render(<AnswerColumn item={item} />);
  });
  return container;
}

function interactive(container: HTMLElement): Element[] {
  return [...container.querySelectorAll("button, input, select, textarea, a, form, [onclick]")];
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

// --- US2-S2: exactly the factory's choices, verbatim, in delivery order -------

describe("an Escalation offers exactly the delivered choices", () => {
  it("renders one control per delivered choice and no other", () => {
    const container = render(escalation);
    const buttons = [...container.querySelectorAll("button")];

    expect(escalationDelivery.actions.length).toBeGreaterThan(1);
    expect(buttons).toHaveLength(escalationDelivery.actions.length);
    // Nothing else is interactive: no extra control rode along beside them.
    expect(interactive(container)).toHaveLength(escalationDelivery.actions.length);
  });

  it("renders each label verbatim, in delivery order, with none reworded", () => {
    const container = render(escalation);
    const faces = [...container.querySelectorAll("button .face")].map((n) => n.textContent);

    expect(faces).toEqual(escalationDelivery.actions.map((a) => a.label));
  });

  it("renders each payload verbatim beneath its label", () => {
    const container = render(escalation);
    const payloads = [...container.querySelectorAll("button .payload")].map((n) => n.textContent);

    expect(payloads).toEqual(escalationDelivery.actions.map((a) => a.payload));
    // Under the label, inside the same control — the payload belongs to the
    // choice it settles (DESIGN.md § Components › Buttons).
    for (const button of container.querySelectorAll("button")) {
      const face = button.querySelector(".face");
      const payload = button.querySelector(".payload");
      expect(face).not.toBeNull();
      expect(payload).not.toBeNull();
      expect(face?.compareDocumentPosition(payload as Node)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
  });

  it("sends the payload it rendered, and nothing composed", async () => {
    const container = render(escalation);
    const first = container.querySelector("button") as HTMLButtonElement;

    await act(async () => {
      first.click();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/attention/${escalationDelivery.correlation_id}/answer`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      payload: escalationDelivery.actions[0].payload,
    });
  });
});

// --- US2-S4: no second verb, on any kind -------------------------------------

describe("the only controls are the factory's choices and a Question's reply", () => {
  it("gives a Question a reply field and exactly one Answer button", () => {
    const container = render(question);

    expect(container.querySelectorAll("textarea")).toHaveLength(1);
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(interactive(container)).toHaveLength(2);
    expect(container.querySelector("button")?.textContent).toBe("Answer");
  });

  it("gives a Notice no control at all", () => {
    const container = render(notice);

    expect(interactive(container)).toHaveLength(0);
    expect(container.querySelector(".asks-nothing")?.textContent).toBe(
      "Asks for nothing; no answer exists.",
    );
  });

  it("offers no local resolve, dismiss, snooze, or second verb on any kind", () => {
    // A word from this list may appear only inside a control the factory
    // delivered — the recorded Escalation's own faces say Kill and Pause. It may
    // never appear in copy the pane wrote, because copy the pane wrote is where
    // a convenience write would announce itself.
    const forbidden = /dismiss|snooze|resolve|pause|kill|ready/i;

    for (const item of [escalation, question, notice]) {
      const container = render(item);
      const delivered = new Set(item.actions.map((a) => a.payload));

      // Text nodes, not elements: an ancestor's textContent is the
      // concatenation of its children, and what is being asserted is that no
      // *rendered string* outside a delivered choice carries one of these words.
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      const placeholder = container.querySelector("textarea")?.placeholder ?? "";
      expect(forbidden.test(placeholder)).toBe(false);

      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const text = node.textContent ?? "";
        if (!forbidden.test(text)) continue;

        // Whatever matched must sit inside a button carrying a delivered
        // payload — i.e. it is the factory's word, not the pane's.
        const owner = (node.parentElement as Element).closest("button[data-payload]");
        expect(
          owner !== null && delivered.has(owner.getAttribute("data-payload") as string),
          `${item.kind}: "${text.slice(0, 60)}" is not a delivered choice`,
        ).toBe(true);
      }
    }
  });
});

// --- US2-S5 and US2-S7: the two local guards, which only ever withhold --------

describe("the local guards", () => {
  it("issues one request when the same choice is pressed twice", async () => {
    const container = render(escalation);
    const first = container.querySelector("button") as HTMLButtonElement;

    await act(async () => {
      first.click();
    });
    await act(async () => {
      first.click();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("disables every control while the backend reports the item in flight", () => {
    const inFlight = itemFrom(escalationDelivery, "escalation", {
      ...waiting,
      state: "in_flight",
    });
    const container = render(inFlight);

    const buttons = [...container.querySelectorAll("button")];
    expect(buttons).toHaveLength(escalationDelivery.actions.length);
    for (const button of buttons) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }

    const pendingQuestion = itemFrom(questionDelivery, "question", {
      ...waiting,
      state: "in_flight",
    });
    const questionContainer = render(pendingQuestion);
    expect((questionContainer.querySelector("textarea") as HTMLTextAreaElement).disabled).toBe(
      true,
    );
    expect((questionContainer.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("presses nothing on an item the backend reports in flight", async () => {
    const inFlight = itemFrom(escalationDelivery, "escalation", {
      ...waiting,
      state: "in_flight",
    });
    const container = render(inFlight);

    await act(async () => {
      (container.querySelector("button") as HTMLButtonElement).click();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("issues no request for an empty or whitespace-only reply, and keeps the text", async () => {
    for (const typed of ["", "   ", "\n\t"]) {
      const container = render(question);
      const field = container.querySelector("textarea") as HTMLTextAreaElement;
      const answer = container.querySelector("button") as HTMLButtonElement;

      await act(async () => {
        // React's controlled input: set through the native setter so onChange fires.
        const setter = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value",
        )?.set;
        setter?.call(field, typed);
        field.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => {
        answer.click();
      });

      expect(fetchMock, `"${typed}" must reach no seam`).not.toHaveBeenCalled();
      // The item is unchanged and so is what the operator typed: the refusal
      // does not clear the field out from under them.
      expect(field.value).toBe(typed);
    }
  });

  it("submits a reply that has content", async () => {
    const container = render(question);
    const field = container.querySelector("textarea") as HTMLTextAreaElement;
    const answer = container.querySelector("button") as HTMLButtonElement;

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setter?.call(field, "Go with Option A.");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      answer.click();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/attention/${questionDelivery.correlation_id}/answer`);
    // Verbatim: the pane carries what was typed and trims nothing.
    expect(JSON.parse(init.body as string)).toEqual({ text: "Go with Option A." });
  });
});
