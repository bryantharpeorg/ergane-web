/**
 * The stale fold (006 US3: FR-008, FR-009; DESIGN.md § The Desk in this world).
 *
 * Every item below is a **recorded** delivery joined to a **recorded** expiry
 * (constitution V): the four webhook payloads the Fixture floor replays, each
 * carrying the `expires_at` the matching factory read reported for it —
 *
 *   | item             | delivery                          | expiry read              | expires_at             |
 *   |------------------|-----------------------------------|--------------------------|------------------------|
 *   | `595ae18d48cf`   | `webhook/question-expired.json`   | `questions/expired-question.json` | `2026-08-22T17:41:18Z` |
 *   | `d10263341dac`   | `webhook/escalation.json`         | `escalations/open_escalations.json` | `2026-08-22T17:56:11Z` |
 *   | `de7c63c0fbb8`   | `webhook/escalation-standalone.json` | `escalations/open_escalations-2.json` | `2026-08-22T18:01:12Z` |
 *   | `800ee6b4c7df`   | `webhook/question.json`           | `questions/pending_questions.json` | `2026-08-23T01:41:13Z` |
 *   | `notice:3`       | `webhook/notice-supervision.json` | — a Notice has no clock  | `null`                 |
 *
 * — so nothing here is invented, and the live/expired split is chosen by moving
 * the **reading instant**, never by writing a time the factory did not.
 *
 * Two reference instants do all the work, and both are facts about the corpus
 * rather than numbers picked to pass:
 *
 * - `FIXTURE_FLOOR_INSTANT` is the Fixture floor's own `reference_instant` —
 *   the `captured_at` of `fixtures/escalations/open_escalations.envelope.json`
 *   (`fixtures/README.md`). Every recorded expiry above is *after* it, so the
 *   floor `PANE_DEMO=1` serves has no expired item at all: US3-S3's all-live
 *   floor is the real one, and the fold's absence there is the assertion.
 * - `SPLIT_INSTANT` is that recording read later. Three deadlines have passed
 *   by then and two items have no expired clock, which is the split US3-S1
 *   asks for.
 */

import { describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import AttentionStrip from "../../src/desk/AttentionStrip";
import { handleEvent } from "../../src/api/events";
import type {
  AttentionItem,
  DeliveredAction,
  FloorDocument,
} from "../../src/api/floorDocument";

import escalationRaw from "../../../fixtures/webhook/escalation.json?raw";
import escalationStandaloneRaw from "../../../fixtures/webhook/escalation-standalone.json?raw";
import questionRaw from "../../../fixtures/webhook/question.json?raw";
import questionExpiredRaw from "../../../fixtures/webhook/question-expired.json?raw";
import noticeRaw from "../../../fixtures/webhook/notice-supervision.json?raw";
import openEscalationsRaw from "../../../fixtures/escalations/open_escalations.json?raw";
import openEscalations2Raw from "../../../fixtures/escalations/open_escalations-2.json?raw";
import pendingQuestionsRaw from "../../../fixtures/questions/pending_questions.json?raw";
import expiredQuestionRaw from "../../../fixtures/questions/expired-question.json?raw";
import escalationsEnvelopeRaw from "../../../fixtures/escalations/open_escalations.envelope.json?raw";

/** A recorded webhook delivery, exactly as the factory POSTed it. */
interface Delivery {
  correlation_id: string;
  text: string;
  actions: DeliveredAction[];
}

const escalationDelivery = JSON.parse(escalationRaw) as Delivery;
const standaloneDelivery = JSON.parse(escalationStandaloneRaw) as Delivery;
const questionDelivery = JSON.parse(questionRaw) as Delivery;
const expiredQuestionDelivery = JSON.parse(questionExpiredRaw) as Delivery;
const noticeDelivery = JSON.parse(noticeRaw) as Delivery;

const openEscalations = JSON.parse(openEscalationsRaw) as { escalation_id: string; expires_at: string }[];
const openEscalations2 = JSON.parse(openEscalations2Raw) as { escalation_id: string; expires_at: string }[];
const pendingQuestions = JSON.parse(pendingQuestionsRaw) as {
  pending_questions: { question_id: string; expires_at: string }[];
};
const expiredQuestion = JSON.parse(expiredQuestionRaw) as {
  outcome: { outcome: string };
  get_question: { question_id: string; expires_at: string };
};

/** The expiry each read reported, taken from that read and nowhere else. */
const ESCALATION_EXPIRES = openEscalations[0].expires_at;
const STANDALONE_EXPIRES = (
  openEscalations2.find((row) => row.escalation_id === "de7c63c0fbb8") as { expires_at: string }
).expires_at;
const QUESTION_EXPIRES = pendingQuestions.pending_questions[0].expires_at;
const EXPIRED_QUESTION_EXPIRES = expiredQuestion.get_question.expires_at;
/** The factory's own outcome word for the question that ran out: `EXPIRED`. */
const EXPIRED_OUTCOME = expiredQuestion.outcome.outcome;

/** The Fixture floor's `reference_instant`: `captured_at`, read from the envelope. */
const FIXTURE_FLOOR_INSTANT = (
  JSON.parse(escalationsEnvelopeRaw) as { captured_at: string }
).captured_at;

/** The same recording read later: three deadlines passed, two clocks unexpired. */
const SPLIT_INSTANT = "2026-08-22T18:05:00Z";

function settlementOf(overrides: Partial<AttentionItem["settlement"]> = {}): AttentionItem["settlement"] {
  return {
    state: "waiting",
    ruling: null,
    signal: null,
    pressed_choice: null,
    resolution: null,
    ...overrides,
  };
}

function itemFor(
  delivery: Delivery,
  kind: AttentionItem["kind"],
  expiresAt: string | null,
  overrides: Partial<AttentionItem> = {},
): AttentionItem {
  return {
    id: delivery.correlation_id,
    kind,
    correlation_id: delivery.correlation_id,
    text: delivery.text,
    actions: delivery.actions,
    expires_at: expiresAt,
    settlement: settlementOf(),
    degraded: null,
    ...overrides,
  };
}

const escalationItem = itemFor(escalationDelivery, "escalation", ESCALATION_EXPIRES);
const standaloneItem = itemFor(standaloneDelivery, "escalation", STANDALONE_EXPIRES);
const questionItem = itemFor(questionDelivery, "question", QUESTION_EXPIRES);
const expiredQuestionItem = itemFor(
  expiredQuestionDelivery,
  "question",
  EXPIRED_QUESTION_EXPIRES,
  // The factory ruled on this one when its clock ran out; the fold carries that
  // word as the factory wrote it (FR-009).
  { settlement: settlementOf({ state: "ruled", ruling: EXPIRED_OUTCOME }) },
);
const noticeItem = itemFor(noticeDelivery, "notice", null, {
  id: "notice:3",
  settlement: settlementOf({ state: "none" }),
});

const ALL_ITEMS = [escalationItem, standaloneItem, questionItem, expiredQuestionItem, noticeItem];

function docWith(referenceInstant: string | null, items: AttentionItem[] = ALL_ITEMS): FloorDocument {
  return {
    reference_instant: referenceInstant,
    floor: { seam: "factory.cli.status.collect_floor", data: null },
    epics: [],
    attention: { seam: "attention", items },
    health: { seam: "health", data: null },
    spend_to_date: { seam: "spend", data: null },
    degraded: [],
  };
}

function render(doc: FloorDocument): { container: HTMLElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<AttentionStrip doc={doc} />);
  });
  return { container, root };
}

function cleanup(container: HTMLElement): void {
  document.body.removeChild(container);
}

/**
 * The corpus is what the header above claims it is.
 *
 * A test whose fixtures quietly stopped splitting would pass every assertion
 * below by rendering nothing — the vacuous-gate defect 001 US1-S1 exists to
 * prevent — so the split is asserted before it is used.
 */
describe("the recorded corpus really splits at the two reading instants", () => {
  it("has every recorded expiry ahead of the Fixture floor's own reference instant", () => {
    expect(FIXTURE_FLOOR_INSTANT).toBe("2026-08-22T17:41:12Z");
    for (const expiry of [
      ESCALATION_EXPIRES,
      STANDALONE_EXPIRES,
      QUESTION_EXPIRES,
      EXPIRED_QUESTION_EXPIRES,
    ]) {
      expect(new Date(expiry).getTime()).toBeGreaterThan(new Date(FIXTURE_FLOOR_INSTANT).getTime());
    }
  });

  it("puts three of the four deadlines behind the later reading instant, and one ahead", () => {
    const split = new Date(SPLIT_INSTANT).getTime();
    for (const expiry of [ESCALATION_EXPIRES, STANDALONE_EXPIRES, EXPIRED_QUESTION_EXPIRES]) {
      expect(new Date(expiry).getTime()).toBeLessThan(split);
    }
    expect(new Date(QUESTION_EXPIRES).getTime()).toBeGreaterThan(split);
  });
});

describe("expired attention collapses under a stale fold (US3-S1, FR-008)", () => {
  it("folds every expired item, states the count, and starts collapsed", () => {
    const { container } = render(docWith(SPLIT_INSTANT));

    const fold = container.querySelector("details.stale") as HTMLDetailsElement;
    expect(fold).not.toBeNull();
    // "opens on demand": collapsed is where it starts, and `open` is the only
    // thing that changes when the operator asks for it.
    expect(fold.open).toBe(false);

    const folded = fold.querySelectorAll("[data-stale]");
    expect(folded).toHaveLength(3);
    expect([...folded].map((el) => el.getAttribute("data-id")).sort()).toEqual(
      ["595ae18d48cf", "d10263341dac", "de7c63c0fbb8"].sort(),
    );

    // The summary names the count, as a number and not an empty shell.
    const summary = fold.querySelector("summary.stale-summary") as HTMLElement;
    expect(summary.querySelector(".stale-count")?.textContent).toBe("3");
    expect(summary.textContent).toContain("3");
    expect(summary.textContent).toContain("stale");
    expect(fold.getAttribute("data-stale-count")).toBe("3");

    cleanup(container);
  });

  it("renders each folded item as one line: kind, id, expired <duration> ago", () => {
    const { container } = render(docWith(SPLIT_INSTANT));

    const line = container.querySelector(
      '[data-id="d10263341dac"] > summary.stale-line',
    ) as HTMLElement;
    expect(line).not.toBeNull();
    expect(line.querySelector(".kind")?.textContent).toBe("Escalation");
    expect(line.querySelector(".where")?.textContent).toBe("d10263341dac");
    // 17:56:11Z read at 18:05:00Z — 8 minutes and 49 seconds, stated in the
    // coarse unit the fold uses.
    expect(line.querySelector(".ago")?.textContent).toBe("expired 8m ago");

    // One line means the three things DESIGN.md names, and no fourth: the whole
    // collapsed entry is those three slots concatenated and nothing besides
    // (they are separated by the row's gap, not by text).
    expect(line.children).toHaveLength(3);
    expect(line.textContent).toBe("Escalationd10263341dacexpired 8m ago");

    const standalone = container.querySelector(
      '[data-id="de7c63c0fbb8"] > summary.stale-line .ago',
    );
    // 18:01:12Z read at 18:05:00Z.
    expect(standalone?.textContent).toBe("expired 3m ago");

    cleanup(container);
  });

  it("leaves every live card untouched, and above the fold", () => {
    const { container } = render(docWith(SPLIT_INSTANT));

    const live = container.querySelectorAll("section.attention .items article.item");
    expect(live).toHaveLength(2);
    expect([...live].map((el) => el.getAttribute("data-id"))).toEqual([
      "800ee6b4c7df",
      "notice:3",
    ]);

    // The Question's full card, exactly as 001/003/004 render it: the clock
    // counting to the factory's `expires_at`, the expiry beneath it, the
    // delivered text, and the controls.
    const question = container.querySelector('article.item[data-kind="question"]') as HTMLElement;
    expect(question.querySelector(".clock")?.textContent).toBe("−07:36:13");
    expect(question.querySelector(".until")?.textContent).toBe(`until ${QUESTION_EXPIRES}`);
    expect(question.textContent).toContain("Option A: a 12-hex id like escalations.");
    expect(question.querySelectorAll("textarea")).toHaveLength(1);
    // Nothing live is a fold, and nothing live sits inside one.
    expect(question.closest("details.stale")).toBeNull();

    // DOM order: what can still be answered leads (US3's whole point).
    const html = container.innerHTML;
    expect(html.indexOf('class="items"')).toBeLessThan(html.indexOf("stale"));
    expect(html.lastIndexOf("article class=\"item")).toBeLessThan(html.indexOf("<details class=\"stale\""));

    cleanup(container);
  });

  it("counts every open item in the head, folded or not — the fold edits no total", () => {
    const { container } = render(docWith(SPLIT_INSTANT));
    expect(container.querySelector(".attention-head .count")?.textContent).toBe("5");
    cleanup(container);
  });
});

describe("the fold preserves what the factory wrote (US3-S2, FR-009)", () => {
  it("shows the expired Escalation's own expires_at and its text verbatim when opened", () => {
    const { container } = render(docWith(SPLIT_INSTANT));

    const entry = container.querySelector('[data-id="d10263341dac"]') as HTMLDetailsElement;
    // Collapsing is layout: the factory's timestamp is on the element itself
    // whether or not anyone has opened it.
    expect(entry.getAttribute("data-expires-at")).toBe(ESCALATION_EXPIRES);

    act(() => {
      entry.open = true;
    });

    // The factory's string, not a friendlier local reading of the same moment.
    expect(entry.querySelector(".until")?.textContent).toBe(`until ${ESCALATION_EXPIRES}`);
    expect(entry.querySelector(".until .num")?.textContent).toBe(ESCALATION_EXPIRES);

    // Byte for byte: equal to the delivery, not merely containing part of it.
    expect(entry.querySelector(".stale-text")?.textContent).toBe(escalationDelivery.text);

    cleanup(container);
  });

  it("carries the factory's outcome word for a question that ran out, unreworded", () => {
    const { container } = render(docWith(SPLIT_INSTANT));

    const entry = container.querySelector('[data-id="595ae18d48cf"]') as HTMLDetailsElement;
    act(() => {
      entry.open = true;
    });

    // `EXPIRED` is the outcome `fixtures/questions/expired-question.json`
    // recorded, uppercase as the factory wrote it (FR-010's rule, restated
    // against the fold).
    expect(entry.querySelector(".ruling")?.textContent).toBe(EXPIRED_OUTCOME);
    expect(entry.querySelector(".stale-text")?.textContent).toBe(expiredQuestionDelivery.text);
    expect(entry.querySelector(".until")?.textContent).toBe(`until ${EXPIRED_QUESTION_EXPIRES}`);

    cleanup(container);
  });

  it("re-derives no countdown from the pane's clock", () => {
    // The countdown anchor rule, restated against the fold: the reading depends
    // on the document's reference instant and the factory's `expires_at`, and
    // on nothing else. Moving the machine's clock by a day must not move a
    // character of it.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-22T18:05:00Z"));
      const first = render(docWith(SPLIT_INSTANT));
      const early = first.container.querySelector('[data-id="d10263341dac"] .ago')?.textContent;
      cleanup(first.container);

      vi.setSystemTime(new Date("2026-08-23T18:05:00Z"));
      const second = render(docWith(SPLIT_INSTANT));
      const late = second.container.querySelector('[data-id="d10263341dac"] .ago')?.textContent;
      cleanup(second.container);

      expect(early).toBe("expired 8m ago");
      expect(late).toBe(early);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("a fold with nothing in it never renders (US3-S3, FR-008)", () => {
  it("renders no fold for the Fixture floor's own all-live reading", () => {
    const { container } = render(docWith(FIXTURE_FLOOR_INSTANT));

    expect(container.querySelector("details.stale")).toBeNull();
    expect(container.querySelectorAll("[data-stale]")).toHaveLength(0);
    expect(container.innerHTML).not.toContain("stale");

    // And every item is still on the page, in a full card.
    expect(container.querySelectorAll("section.attention .items article.item")).toHaveLength(5);

    cleanup(container);
  });

  it("renders no fold when the floor is quiet", () => {
    const { container } = render(docWith(SPLIT_INSTANT, []));
    expect(container.querySelector("details.stale")).toBeNull();
    expect(container.querySelector(".empty")?.textContent).toBe("Nothing is waiting on you.");
    cleanup(container);
  });
});

describe("an item with no clock is never stale (Edge Cases)", () => {
  it("keeps a Notice and a deadline-less Question in full cards at any reading instant", () => {
    // A Question the factory supplied no `expires_at` for is 001's case: there
    // is a deadline to have and the pane has not been told it. It is not
    // expired — it has no clock to expire — so no reading instant can fold it.
    const clockless = itemFor(questionDelivery, "question", null);
    const { container } = render(docWith("2027-01-01T00:00:00Z", [clockless, noticeItem]));

    expect(container.querySelector("details.stale")).toBeNull();
    expect(container.querySelectorAll("section.attention .items article.item")).toHaveLength(2);
    expect(container.querySelector(".no-deadline")?.textContent).toBe(
      "no deadline from the factory",
    );
    expect(container.querySelector(".no-clock")?.textContent).toBe("no clock");

    cleanup(container);
  });
});

describe("items move on an SSE-driven render and on no timer at all (T013, Edge Cases)", () => {
  it("moves an item into the fold when a floor event carries a later reference instant", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(FIXTURE_FLOOR_INSTANT));

      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);

      // The Fixture floor's own reading: nothing has expired, so no fold.
      act(() => {
        root.render(<AttentionStrip doc={docWith(FIXTURE_FLOOR_INSTANT)} />);
      });
      expect(container.querySelector("details.stale")).toBeNull();

      // Nothing was scheduled to change that. The strip started no interval and
      // no timeout, so an item cannot cross its deadline on the pane's say-so.
      expect(vi.getTimerCount()).toBe(0);

      // Time passes on the machine — and by itself, changes nothing at all.
      vi.setSystemTime(new Date("2026-08-23T00:00:00Z"));
      vi.advanceTimersByTime(60 * 60 * 1000);
      act(() => {});
      expect(container.querySelector("details.stale")).toBeNull();

      // The factory speaks: a `floor` frame arrives on the SSE channel, read
      // through the consumer the Desk really uses, and the deadline that passed
      // in the meantime is now a fact the document states.
      let next: FloorDocument | null = null;
      handleEvent(
        JSON.stringify({ type: "floor", data: docWith(SPLIT_INSTANT) }),
        (doc) => {
          next = doc;
        },
        () => undefined,
      );
      expect(next).not.toBeNull();

      act(() => {
        root.render(<AttentionStrip doc={next as unknown as FloorDocument} />);
      });

      const fold = container.querySelector("details.stale") as HTMLDetailsElement;
      expect(fold).not.toBeNull();
      expect(fold.querySelectorAll("[data-stale]")).toHaveLength(3);
      expect(container.querySelectorAll("section.attention .items article.item")).toHaveLength(2);
      expect(vi.getTimerCount()).toBe(0);

      cleanup(container);
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts no clock of its own anywhere in the Desk's source", () => {
    // The structural half of the same rule: a timer added to any Desk file
    // later would turn this red, which is why it is a sweep and not a comment.
    //
    // Comments are stripped first, for the reason `noVerb.test.ts` strips them:
    // this room argues with itself in prose — the rule these files keep is
    // *written down* in them, `Date.now()` named as the thing never called — and
    // a sweep that could not tell a call from a sentence about one would force
    // the explanations out of the code to stay green. What is swept is what ships.
    const deskFiles = import.meta.glob("../../src/desk/**/*.{ts,tsx}", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;

    const code = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    expect(Object.keys(deskFiles).length).toBeGreaterThan(5);
    // The sweep runs over a room that is really there, and over the file this
    // story wrote: a glob that matched nothing would pass vacuously.
    expect(
      Object.keys(deskFiles).some((path) => path.endsWith("AttentionStrip.tsx")),
      "the strip is in the sweep",
    ).toBe(true);

    for (const [path, source] of Object.entries(deskFiles)) {
      for (const timer of ["setInterval", "setTimeout", "requestAnimationFrame", "Date.now("]) {
        expect(code(source), `${path} must not start a clock of its own`).not.toContain(timer);
      }
    }
  });
});
