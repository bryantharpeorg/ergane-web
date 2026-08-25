import { describe, expect, it, vi } from "vitest";
import { referenceInstant, timeLeft } from "../../src/desk/timeLeft";

describe("timeLeft", () => {
  it("returns none when no expiry is supplied", () => {
    expect(timeLeft(null, new Date())).toEqual({ kind: "none" });
  });

  it("returns expired when expires_at precedes the reference instant", () => {
    const expiresAt = "2026-08-22T16:00:00Z";
    const reference = new Date("2026-08-22T17:00:00Z");

    const result = timeLeft(expiresAt, reference);
    expect(result).toEqual({ kind: "expired" });
  });

  it("renders 90 seconds before expiry as −00:01:30", () => {
    const expiresAt = "2026-08-22T17:01:30Z";
    const reference = new Date("2026-08-22T17:00:00Z");

    const result = timeLeft(expiresAt, reference);
    expect(result.kind).toBe("remaining");
    if (result.kind === "remaining") {
      expect(result.seconds).toBe(90);
      expect(result.text).toBe("−00:01:30");
    }
  });

  it("uses the document's reference instant when present", () => {
    const doc = { reference_instant: "2026-08-22T17:00:00Z" };
    expect(referenceInstant(doc).toISOString()).toBe("2026-08-22T17:00:00.000Z");
  });

  it("falls back to the wall clock when no document instant exists", () => {
    const now = new Date("2026-08-22T17:00:00Z");
    vi.setSystemTime(now);
    expect(referenceInstant({ reference_instant: null }).toISOString()).toBe(
      now.toISOString(),
    );
    vi.useRealTimers();
  });

  it("never produces a negative-looking clock for expired items", () => {
    const expiresAt = "2026-08-22T16:00:00Z";
    const reference = new Date("2026-08-22T17:00:00Z");

    const result = timeLeft(expiresAt, reference);
    expect(result.kind).toBe("expired");
    if (result.kind === "remaining") {
      expect(result.text).not.toMatch(/^−-/);
      expect(result.text).not.toMatch(/-\d/);
    }
  });
});

// --- spec 003 US3: the clock counts down to a time the factory wrote ---------

/**
 * DESIGN.md § Components › Attention Item › Countdown anchor rule, and FR-012:
 * the clock targets the factory-written `expires_at` and nothing else. The two
 * fixture items are chosen because their factory-reported deadlines *disagree*
 * with what intake-time arithmetic would have produced — the Escalation's is its
 * `sent_at` plus 900 s where a pane inventing one would have reached for 3600,
 * and the Question's is its `sent_at` plus 28800 s, which is not the pane's
 * receipt instant plus 28800 s. A pane anchoring on its own clock therefore
 * renders a *different* string here, not a subtly wrong one, and these turn red.
 *
 * Every instant below is read out of a recorded document. Nothing is retyped, so
 * a re-recording moves the expectations with the fixtures (constitution V).
 */

import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import AttentionItemView from "../../src/desk/AttentionItem";
import type { AttentionItem, FloorDocument } from "../../src/api/floorDocument";

import openEscalationsRaw from "../../../fixtures/escalations/open_escalations.json?raw";
import escalationEnvelopeRaw from "../../../fixtures/escalations/open_escalations.envelope.json?raw";
import escalationStoreRowsRaw from "../../../fixtures/escalations/store-rows.json?raw";
import pendingQuestionsRaw from "../../../fixtures/questions/pending_questions.json?raw";
import webhookEscalationRaw from "../../../fixtures/webhook/escalation.json?raw";
import webhookEscalationEnvelopeRaw from "../../../fixtures/webhook/escalation.envelope.json?raw";
import webhookQuestionRaw from "../../../fixtures/webhook/question.json?raw";
import webhookQuestionEnvelopeRaw from "../../../fixtures/webhook/question.envelope.json?raw";

interface OpenEscalation {
  escalation_id: string;
  expires_at: string;
  resolution: string | null;
}
interface QuestionRecord {
  question_id: string;
  sent_at: string;
  expires_at: string;
}
interface Delivery {
  correlation_id: string;
  text: string;
  actions: { label: string; payload: string }[];
}

const reportedEscalation = (JSON.parse(openEscalationsRaw) as OpenEscalation[])[0];
const storedQuestion = (
  JSON.parse(pendingQuestionsRaw) as { pending_questions: QuestionRecord[] }
).pending_questions[0];
const escalationDelivery = JSON.parse(webhookEscalationRaw) as Delivery;
const questionDelivery = JSON.parse(webhookQuestionRaw) as Delivery;

/** 001's demo reference instant: the escalation recording's own capture time. */
const REFERENCE = (JSON.parse(escalationEnvelopeRaw) as { captured_at: string }).captured_at;
/** When the pane received each delivery — provenance, never an anchor. */
const escalationReceipt = (
  JSON.parse(webhookEscalationEnvelopeRaw) as { captured_at: string }
).captured_at;
const questionReceipt = (
  JSON.parse(webhookQuestionEnvelopeRaw) as { captured_at: string }
).captured_at;

const doc = { reference_instant: REFERENCE } as FloorDocument;

function plus(instant: string, seconds: number): string {
  return new Date(new Date(instant).getTime() + seconds * 1000).toISOString();
}

function itemFor(
  delivery: Delivery,
  kind: AttentionItem["kind"],
  expiresAt: string | null,
): AttentionItem {
  return {
    id: kind === "notice" ? "notice:1" : delivery.correlation_id,
    kind,
    correlation_id: delivery.correlation_id,
    text: delivery.text,
    actions: delivery.actions,
    expires_at: expiresAt,
    settlement: {
      state: kind === "notice" ? "none" : "waiting",
      ruling: null,
      signal: null,
      pressed_choice: null,
      resolution: null,
    },
    degraded: null,
  };
}

function renderItem(item: AttentionItem, document_: FloorDocument = doc): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    createRoot(container).render(createElement(AttentionItemView, { item, doc: document_ }));
  });
  return container;
}

describe("an Escalation's clock targets the expires_at open_escalations reported (US3-S5)", () => {
  it("is the reported value, and not receipt plus 3600 s", () => {
    const invented = plus(escalationReceipt, 3600);
    expect(reportedEscalation.expires_at).not.toBe(invented);

    const reported = timeLeft(reportedEscalation.expires_at, new Date(REFERENCE));
    const wrong = timeLeft(invented, new Date(REFERENCE));
    expect(reported.kind).toBe("remaining");
    expect(wrong.kind).toBe("remaining");
    if (reported.kind === "remaining" && wrong.kind === "remaining") {
      expect(reported.text).not.toBe(wrong.text);
    }
  });

  it("is its own sent_at plus 900 s, which is why 3600 would be an invention", () => {
    const sentAt = (
      JSON.parse(escalationStoreRowsRaw) as { get_escalation: { sent_at: string } }
    ).get_escalation.sent_at;

    expect(reportedEscalation.expires_at).toBe(plus(sentAt, 900).replace(".000Z", "Z"));
    expect(reportedEscalation.expires_at).not.toBe(plus(sentAt, 3600).replace(".000Z", "Z"));
  });

  it("renders that clock on the item", () => {
    expect(reportedEscalation.escalation_id).toBe(escalationDelivery.correlation_id);

    const container = renderItem(
      itemFor(escalationDelivery, "escalation", reportedEscalation.expires_at),
    );
    const expected = timeLeft(reportedEscalation.expires_at, new Date(REFERENCE));

    expect(expected.kind).toBe("remaining");
    if (expected.kind === "remaining") {
      expect(container.querySelector(".clock")?.textContent).toBe(expected.text);
    }
    // The absolute expiry beneath it is the factory's timestamp, once.
    expect(container.querySelector(".until")?.textContent).toBe(
      `until ${reportedEscalation.expires_at}`,
    );
    document.body.innerHTML = "";
  });
});

describe("a Question's clock targets the expires_at the factory stored (US3-S6)", () => {
  it("is the stored value, and not receipt plus 28800 s", () => {
    const invented = plus(questionReceipt, 28800);
    expect(storedQuestion.expires_at).not.toBe(invented);

    const stored = timeLeft(storedQuestion.expires_at, new Date(REFERENCE));
    const wrong = timeLeft(invented, new Date(REFERENCE));
    if (stored.kind === "remaining" && wrong.kind === "remaining") {
      expect(stored.text).not.toBe(wrong.text);
    } else {
      throw new Error("both anchors must still be in the future at the reference instant");
    }
  });

  it("renders that clock on the item", () => {
    expect(storedQuestion.question_id).toBe(questionDelivery.correlation_id);

    const container = renderItem(
      itemFor(questionDelivery, "question", storedQuestion.expires_at),
    );
    const expected = timeLeft(storedQuestion.expires_at, new Date(REFERENCE));

    if (expected.kind === "remaining") {
      expect(container.querySelector(".clock")?.textContent).toBe(expected.text);
    }
    document.body.innerHTML = "";
  });

  it("says 'no deadline from the factory' — not 'no clock' — when none was supplied", () => {
    const container = renderItem(itemFor(questionDelivery, "question", null));

    // Two null cases, two different words, and they must not be merged: an
    // answerable item the factory has not given a deadline yet, versus a Notice
    // that has no deadline to have (DESIGN.md § Typography › Hierarchy › Clock).
    expect(container.querySelector(".no-deadline")?.textContent).toBe(
      "no deadline from the factory",
    );
    expect(container.querySelector(".no-clock")).toBeNull();
    expect(container.querySelector(".clock")).toBeNull();
    expect(container.querySelector(".until")).toBeNull();
    document.body.innerHTML = "";
  });
});

describe("an item past its expires_at stays, reads expired, and keeps its controls (US3-S7)", () => {
  const past = { reference_instant: plus(reportedEscalation.expires_at, 60) } as FloorDocument;

  it("renders the word expired in the clock slot with the expiry beneath", () => {
    const container = renderItem(
      itemFor(escalationDelivery, "escalation", reportedEscalation.expires_at),
      past,
    );

    expect(container.querySelector(".clock")?.textContent).toBe("expired");
    expect(container.querySelector(".clock")?.className).toContain("expired");
    expect(container.querySelector(".until")?.textContent).toBe(
      `until ${reportedEscalation.expires_at}`,
    );
    document.body.innerHTML = "";
  });

  it("is still rendered, in its rank, with every delivered control live", () => {
    const container = renderItem(
      itemFor(escalationDelivery, "escalation", reportedEscalation.expires_at),
      past,
    );

    const article = container.querySelector("article.item");
    expect(article).not.toBeNull();
    // Expiry is the factory's ruling to make; the countdown is only a forecast
    // of it, so a late Answer still goes to the factory (FR-013).
    expect(article?.className).toContain("high");
    expect(article?.textContent).toContain(escalationDelivery.text.slice(0, 40));

    const buttons = [...container.querySelectorAll("button")] as HTMLButtonElement[];
    expect(buttons).toHaveLength(escalationDelivery.actions.length);
    for (const button of buttons) {
      expect(button.disabled).toBe(false);
    }
    document.body.innerHTML = "";
  });

  it("keeps a Question past its deadline answerable too", () => {
    const questionPast = {
      reference_instant: plus(storedQuestion.expires_at, 1),
    } as FloorDocument;
    const container = renderItem(
      itemFor(questionDelivery, "question", storedQuestion.expires_at),
      questionPast,
    );

    expect(container.querySelector(".clock")?.textContent).toBe("expired");
    expect((container.querySelector("textarea") as HTMLTextAreaElement).disabled).toBe(false);
    expect((container.querySelector("button") as HTMLButtonElement).disabled).toBe(false);
    document.body.innerHTML = "";
  });
});
