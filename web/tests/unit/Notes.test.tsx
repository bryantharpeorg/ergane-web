/**
 * The room's third track, rendered (011 US3: FR-012, FR-013, FR-014).
 *
 * What is proved here is the room's half of the story: that recording an
 * observation takes the coordinates *that are on the screen at that instant*,
 * that the recorded note does not move when the operator moves the controls
 * afterwards, and that asking for the draft produces a document and nothing
 * else.
 *
 * `tests/unit/notes.test.ts` owns the composition itself, over a constructed
 * note set. This file owns the wiring: which view a note is taken in, which
 * story it is anchored to, and what the room does with the result.
 *
 * **The absence is the subject.** FR-014 says the pane writes no file, creates
 * no directory and mutates no spec, so the cases below assert what is *not*
 * there — no download, no object URL, no store — beside `noVerb.test.ts`'s
 * source sweep, which asserts the same thing about every file in the room.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Notes from "../../src/review/Notes";
import type { ReviewView } from "../../src/review/notes";
import type { LawReport } from "../../src/review/laws";
import type { ReviewStory, ServedRevision } from "../../src/api/reviewDocument";

const containers: HTMLElement[] = [];
const roots: { render: (node: JSX.Element) => void }[] = [];

function mount(node: JSX.Element): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(node);
  });
  return container;
}

/** Re-render the last mounted tree, the way the room re-renders on a settle. */
function rerender(node: JSX.Element): void {
  const root = roots[roots.length - 1];
  act(() => {
    root.render(node);
  });
}

afterEach(() => {
  for (const container of containers.splice(0)) container.remove();
  roots.splice(0);
  vi.unstubAllGlobals();
});

function report(overrides: Partial<LawReport> = {}): LawReport {
  return {
    swept: 402,
    leaves: 181,
    painters: 46,
    escaped: [],
    past: ["div.stage > article.node-card at 1515px"],
    overlapping: [],
    occluded: [],
    documentScrollWidth: 1515,
    roomScrollsSideways: false,
    viewport: 1280,
    ...overrides,
  };
}

function view(overrides: Partial<ReviewView> = {}): ReviewView {
  return {
    route: "/showfloor",
    width: 1280,
    theme: "light",
    report: report(),
    unmeasured: null,
    ...overrides,
  };
}

/** Two stories reaching different routes, so the default has something to pick. */
function stories(): ReviewStory[] {
  return [
    {
      story_key: "US1",
      title: "The Desk sees the floor",
      priority: "P1",
      commit: "a".repeat(40),
      short_commit: "a".repeat(12),
      pr_number: 41,
      subject: "001/us1: US1 (#41)",
      merged_at: "2026-08-22T17:40:54Z",
      kind: "observed",
      files: [],
      routes: ["/", "/desk"],
      unknown: [],
      notes: [],
    },
    {
      story_key: "US2",
      title: "The Showfloor stages an epic",
      priority: "P2",
      commit: "b".repeat(40),
      short_commit: "b".repeat(12),
      pr_number: 42,
      subject: "002/us2: US2 (#42)",
      merged_at: "2026-08-23T09:12:00Z",
      kind: "observed",
      files: [],
      routes: ["/showfloor"],
      unknown: [],
      notes: [],
    },
  ];
}

function served(): ServedRevision {
  return {
    revision: "1".repeat(40),
    short_revision: "111111111111",
    branch: "dev",
    committed_at: "2026-08-26T04:00:00Z",
    subject: "011/us2: US2 (#90)",
    contains_epic: true,
    missing: [],
    unknown: [],
    notes: [],
  };
}

function track(overrides: { view?: ReviewView | null } = {}): JSX.Element {
  return (
    <Notes
      specDir="011-the-work-comes-back-for-review"
      epicName="The work comes back for review"
      stories={stories()}
      served={served()}
      view={overrides.view === undefined ? view() : overrides.view}
    />
  );
}

/** Type an observation into the one text box this room has. */
function say(container: HTMLElement, words: string): void {
  const field = container.querySelector("[data-note-field]") as HTMLTextAreaElement;
  act(() => {
    // React listens through its own value tracker, so the native setter is what
    // makes a programmatic change look like a keystroke to it.
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set as (value: string) => void;
    setter.call(field, words);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function press(container: HTMLElement, selector: string): void {
  act(() => {
    (container.querySelector(selector) as HTMLElement).click();
  });
}

// --- T017, FR-012: the note takes the coordinates on the screen -----------

describe("a note carries the coordinates it was taken at (FR-012)", () => {
  it("shows what a note would record before one is taken", () => {
    const container = mount(track());
    const where = container.querySelector("[data-capture-where]") as HTMLElement;
    expect(where.textContent).toContain("US2");
    expect(where.textContent).toContain("/showfloor");
    expect(where.textContent).toContain("1280px");
    expect(where.textContent).toContain("light");
  });

  it("records the story, route, width, theme and figures on the screen", () => {
    const container = mount(track());
    say(container, "the graph is cut off on the right");
    press(container, "[data-record]");

    const note = container.querySelector("[data-note]") as HTMLElement;
    expect(note).not.toBeNull();
    expect(note.getAttribute("data-note-story")).toBe("US2");
    expect(note.querySelector("[data-note-route]")?.textContent).toBe("/showfloor");
    expect(note.querySelector("[data-note-width]")?.textContent).toBe("1280px");
    expect(note.querySelector("[data-note-theme]")?.textContent).toBe("light");
    expect(note.querySelector("[data-note-said]")?.textContent).toBe(
      "the graph is cut off on the right",
    );

    // § The review room: the figures, not a verdict, and 235px is the shape the
    // two manual reviews reported in.
    const measured = note.querySelector("[data-note-measured]") as HTMLElement;
    expect(measured.textContent).toContain("235px hidden past the edge");
    expect(measured.textContent).toContain("frame 1280px");
    expect(measured.textContent).toContain("181 text leaves");
    expect(note.querySelector("[data-note-laws]")?.textContent).toContain(
      "past the right edge 1",
    );
  });

  it("renders the coordinates before the prose, and neither behind a disclosure", () => {
    const container = mount(track());
    say(container, "an observation");
    press(container, "[data-record]");

    const note = container.querySelector("[data-note]") as HTMLElement;
    const where = note.querySelector("[data-note-where]") as HTMLElement;
    const said = note.querySelector("[data-note-said]") as HTMLElement;
    expect(
      where.compareDocumentPosition(said) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Not a `<details>`: "a note whose coordinates are collapsed behind a
    // disclosure is a note nobody will reproduce."
    expect(note.querySelector("details")).toBeNull();
  });

  it("anchors to a story that reaches the route, and lets the operator pick another", () => {
    const container = mount(track());
    // `/showfloor` is US2's; the epic's first story is US1, and a default of
    // "the first story" would anchor the note to a story that never touched it.
    say(container, "about the showfloor");
    press(container, "[data-record]");
    expect(
      (container.querySelector("[data-note]") as HTMLElement).getAttribute(
        "data-note-story",
      ),
    ).toBe("US2");

    press(container, "[data-story-pick='US1']");
    say(container, "about the desk after all");
    press(container, "[data-record]");
    const taken = container.querySelectorAll("[data-note]");
    expect(taken).toHaveLength(2);
    expect(taken[1].getAttribute("data-note-story")).toBe("US1");
  });

  it("cannot be recorded with no render to anchor to, and says why", () => {
    const container = mount(track({ view: null }));
    expect(container.querySelector("[data-no-view]")?.textContent).toContain(
      "A note is anchored to a render",
    );
    expect((container.querySelector("[data-record]") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("cannot be recorded with nothing said", () => {
    const container = mount(track());
    expect((container.querySelector("[data-record]") as HTMLButtonElement).disabled).toBe(
      true,
    );
    say(container, "   ");
    expect((container.querySelector("[data-record]") as HTMLButtonElement).disabled).toBe(
      true,
    );
    say(container, "something");
    expect((container.querySelector("[data-record]") as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("says a frame that could not be measured was not measured", () => {
    const container = mount(
      track({
        view: view({ report: null, unmeasured: "the frame's document could not be reached" }),
      }),
    );
    say(container, "something is wrong and I cannot say what");
    press(container, "[data-record]");

    const note = container.querySelector("[data-note]") as HTMLElement;
    expect(note.querySelector("[data-note-measured]")?.textContent).toContain(
      "Not measured at capture: the frame's document could not be reached",
    );
    // Never four laws reported as passing over a measurement nobody made.
    expect(note.querySelector("[data-note-laws]")).toBeNull();
  });
});

// --- T018, T021: the coordinates do not follow the view -------------------

describe("a recorded note does not move when the view does (plan D6)", () => {
  it("keeps its width, theme, route and figures after the operator changes them", () => {
    const container = mount(track());
    say(container, "cut off at 1280");
    press(container, "[data-record]");

    // The centre track re-measures at a new width, theme and route, exactly as
    // it does when the operator presses a control.
    rerender(
      track({
        view: view({
          route: "/desk",
          width: 2560,
          theme: "dark",
          report: report({ past: [], documentScrollWidth: 2560, viewport: 2560, leaves: 12 }),
        }),
      }),
    );

    const note = container.querySelector("[data-note]") as HTMLElement;
    expect(note.querySelector("[data-note-route]")?.textContent).toBe("/showfloor");
    expect(note.querySelector("[data-note-width]")?.textContent).toBe("1280px");
    expect(note.querySelector("[data-note-theme]")?.textContent).toBe("light");
    expect(note.getAttribute("data-note-story")).toBe("US2");
    expect(note.querySelector("[data-note-measured]")?.textContent).toContain(
      "235px hidden past the edge",
    );
    expect(note.querySelector("[data-note-laws]")?.textContent).toContain(
      "past the right edge 1",
    );

    // And the *live* line follows the view, which is what makes the frozen one
    // a record rather than a coincidence.
    expect(container.querySelector("[data-capture-where]")?.textContent).toContain("2560px");
    expect(container.querySelector("[data-capture-where]")?.textContent).toContain("/desk");
  });

  it("keeps a note's coordinates in the draft after the view has moved on", () => {
    const container = mount(track());
    say(container, "cut off at 1280");
    press(container, "[data-record]");
    rerender(track({ view: view({ route: "/desk", width: 960, theme: "dark", report: null }) }));
    press(container, "[data-compose]");

    const draft = (container.querySelector("[data-draft]") as HTMLElement).textContent ?? "";
    expect(draft).toContain("US2 · `/showfloor` · 1280px · light");
    expect(draft).toContain("235px hidden past the edge");
    expect(draft).not.toContain("960px");
  });
});

// --- T019, T020, FR-013 and FR-014: the draft is shown, never saved --------

describe("the draft is presented for the operator to save (FR-013, FR-014)", () => {
  it("offers nothing to compose until there is a note to compose", () => {
    // § Don't: "Don't render an element that can never fill."
    const container = mount(track());
    expect(container.querySelector("[data-draft-block]")).toBeNull();
    expect(container.querySelector("[data-no-notes]")?.textContent).toContain(
      "No notes yet",
    );
  });

  it("shows the composed document when the operator asks for it", () => {
    const container = mount(track());
    say(container, "the graph is cut off on the right");
    press(container, "[data-record]");

    expect(container.querySelector("[data-draft]")).toBeNull();
    press(container, "[data-compose]");

    const draft = (container.querySelector("[data-draft]") as HTMLElement).textContent ?? "";
    expect(draft.startsWith("---\nstate: draft\n")).toBe(true);
    expect(draft).toContain("TBD — CAPTURED, NOT REFINED");
    expect(draft).toContain("## Operator intent (as captured)");
    expect(draft).toContain("> the graph is cut off on the right");
    expect(draft).toContain("## Work Graph");
    expect(draft).toContain("Deliberately absent");
    expect(draft).not.toContain("```");
  });

  it("says the room saved nothing and that saving it is the operator's (SC-003)", () => {
    const container = mount(track());
    say(container, "an observation");
    press(container, "[data-record]");
    press(container, "[data-compose]");

    const hint = container.querySelector("[data-save-hint]") as HTMLElement;
    // § The review room: "a control that reads like a save button in a room
    // that cannot save is the one lie this room could tell that the operator
    // would not catch."
    expect(hint.textContent).toContain("This room saved nothing");
    expect(hint.textContent).toContain("save it yourself at");
    expect(hint.textContent).toContain("specs/<you name it>/spec.md");
  });

  it("renders no control that saves, downloads or persists anything", () => {
    const container = mount(track());
    say(container, "an observation");
    press(container, "[data-record]");
    press(container, "[data-compose]");

    expect(container.querySelector("[download]")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    // One text box in the whole track, and it is the observation field.
    expect(container.querySelectorAll("textarea")).toHaveLength(1);
    for (const button of Array.from(container.querySelectorAll("button"))) {
      expect(button.getAttribute("type")).toBe("button");
      expect((button.textContent ?? "").toLowerCase()).not.toContain("save this");
    }
  });

  it("copies the bytes on the screen when the browser gives a clipboard", async () => {
    const written: string[] = [];
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: (text: string) => {
          written.push(text);
          return Promise.resolve();
        },
      },
    });

    const container = mount(track());
    say(container, "an observation");
    press(container, "[data-record]");
    press(container, "[data-compose]");
    press(container, "[data-copy]");
    await act(async () => {});

    const draft = (container.querySelector("[data-draft]") as HTMLElement).textContent ?? "";
    expect(written).toHaveLength(1);
    expect(written[0]).toBe(draft);
    expect(container.querySelector("[data-copied]")?.getAttribute("data-copied")).toBe(
      "done",
    );
    // The clipboard is not a file and not a store, and the room says which it
    // did: FR-014 is about disk, and nothing here touched it.
    expect(container.querySelector("[data-copied]")?.textContent).toContain(
      "Nothing was written to disk",
    );
  });

  it("says so rather than claiming a copy when the browser gives no clipboard", async () => {
    vi.stubGlobal("navigator", {});
    const container = mount(track());
    say(container, "an observation");
    press(container, "[data-record]");
    press(container, "[data-compose]");
    press(container, "[data-copy]");
    await act(async () => {});

    expect(container.querySelector("[data-copied]")?.getAttribute("data-copied")).toBe(
      "unavailable",
    );
    expect(container.querySelector("[data-copied]")?.textContent).toContain(
      "nothing was copied",
    );
    // And the document is still on the screen to be selected by hand.
    expect(container.querySelector("[data-draft]")).not.toBeNull();
  });

  it("composes every note taken, in the order they were taken", () => {
    const container = mount(track());
    say(container, "the first thing");
    press(container, "[data-record]");
    rerender(track({ view: view({ route: "/desk", width: 1600, theme: "dark" }) }));
    say(container, "the second thing");
    press(container, "[data-record]");
    press(container, "[data-compose]");

    const draft = (container.querySelector("[data-draft]") as HTMLElement).textContent ?? "";
    expect(container.querySelector("[data-note-count]")?.getAttribute("data-note-count")).toBe(
      "2",
    );
    expect(draft.indexOf("the first thing")).toBeLessThan(draft.indexOf("the second thing"));
    expect(draft).toContain("2 observations over 2 routes");
  });

  it("hides the document again without discarding a note", () => {
    const container = mount(track());
    say(container, "an observation");
    press(container, "[data-record]");
    press(container, "[data-compose]");
    press(container, "[data-compose]");

    expect(container.querySelector("[data-draft]")).toBeNull();
    expect(container.querySelectorAll("[data-note]")).toHaveLength(1);
  });
});
