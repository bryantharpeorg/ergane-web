/**
 * A note's frozen coordinates, and the draft they compose into (011 US3).
 *
 * Two claims are proved here and they are the two the story is about.
 *
 * **T018/T021 — the coordinates are frozen at capture.** The room's whole value
 * is that a note can be reproduced: `235px of graph hidden at 1280` is only
 * worth recording if the `1280` still says 1280 after the operator moves the
 * control. A note whose coordinates followed the current view would be a
 * caption that rewrites itself, and an operator would act on it believing it
 * described what they were looking at when they wrote it (plan D6). So the
 * cases below take a note, then change everything the view has — the width, the
 * theme, the route, the measurement, and the arrays inside the measurement —
 * and require the note to be exactly what it was.
 *
 * **T022 — the draft has the shape 007 and 010 have.** Those two are what a
 * captured-TBD spec looks like in this corpus, and a third shape would be a
 * third convention. The sections named below are theirs, read off the two
 * committed sketches and written here as a constant rather than read from
 * `specs/` at run time: a unit test that opened this morning's corpus would be
 * asserting this morning's repository, which is the defect
 * `tests/test_no_test_pins_live_corpus.py` exists to stop coming back.
 *
 * Every case is over a **constructed** note set. Nothing here renders, measures
 * or reads a file — `composeDraft` returns a string, and that is the whole of
 * FR-014's implementation: there is no save to test because there is no save.
 */

import { describe, expect, it } from "vitest";
import {
  captureNote,
  composeDraft,
  coordinateLine,
  lawLine,
  measuredLine,
} from "../../src/review/notes";
import type { Note, ReviewView } from "../../src/review/notes";
import type { LawReport } from "../../src/review/laws";

/**
 * The five top-level sections a captured-TBD spec carries.
 *
 * Read off `specs/007-a-spec-remembers-its-build/spec.md` and
 * `specs/010-an-idea-becomes-a-spec/spec.md`, which are the corpus's two
 * captured sketches. 007 titles its questions section
 * `## Open questions — with the operator's answers (2026-08-25)`; what both
 * share, and what this asserts, is the opening of the heading.
 */
const CAPTURED_TBD_SECTIONS = [
  "## Operator intent (as captured)",
  "## Sketch",
  "## Open questions",
  "## Out of scope (already known)",
  "## Work Graph",
];

/** A measurement in the shape `measureLawsIn` returns, with one violation. */
function report(overrides: Partial<LawReport> = {}): LawReport {
  return {
    swept: 214,
    leaves: 214,
    painters: 61,
    escaped: [],
    past: ["div.stage > article.node-card at 1499px"],
    overlapping: [],
    occluded: [],
    documentScrollWidth: 1499,
    roomScrollsSideways: false,
    viewport: 1264,
    ...overrides,
  };
}

function view(overrides: Partial<ReviewView> = {}): ReviewView {
  return {
    route: "/showfloor",
    width: 1280,
    theme: "dark",
    report: report(),
    unmeasured: null,
    ...overrides,
  };
}

const STORY = { story_key: "US2", title: "The Showfloor stages an epic" };

function context() {
  return {
    specDir: "011-the-work-comes-back-for-review",
    epicName: "The work comes back for review",
    served: "14020d9ab3c1",
    created: "2026-08-26",
  };
}

/** The body of the draft under one heading, up to the next one. */
function section(draft: string, heading: string): string {
  const start = draft.indexOf(heading);
  expect(start, `the draft has no ${heading}`).toBeGreaterThan(-1);
  const rest = draft.slice(start + heading.length);
  const next = rest.search(/\n## /);
  return next === -1 ? rest : rest.slice(0, next);
}

// --- T017, FR-012: the five coordinates, at the instant of capture ---------

describe("a note carries its coordinates (FR-012)", () => {
  it("records the story, the route, the width, the theme and the numbers", () => {
    const note = captureNote(1, "the graph is cut off on the right", view(), STORY);

    expect(note.at.story).toBe("US2");
    expect(note.at.storyTitle).toBe("The Showfloor stages an epic");
    expect(note.at.route).toBe("/showfloor");
    expect(note.at.width).toBe(1280);
    expect(note.at.theme).toBe("dark");
    // The numbers, not a verdict: all of them, as the measurement produced them.
    expect(note.at.measured).toEqual(report());
    expect(note.observation).toBe("the graph is cut off on the right");
  });

  it("renders the coordinates and the figures in the shape the reviews used", () => {
    const note = captureNote(1, "cut off", view(), STORY);

    expect(coordinateLine(note.at)).toBe("US2 · `/showfloor` · 1280px · dark");
    // `235px of graph hidden at 1280` is the sentence that earned this room.
    expect(measuredLine(note.at)).toContain("235px hidden past the edge");
    expect(measuredLine(note.at)).toContain("frame 1264px");
    expect(measuredLine(note.at)).toContain("document 1499px");
    expect(measuredLine(note.at)).toContain("214 text leaves");
    expect(measuredLine(note.at)).toContain("61 painters");
    // Every law, named, with its figure — including the three that found none.
    expect(lawLine(note.at)).toBe(
      "outside its stage 0 · past the right edge 1 · overlapping text 0 · painted over text 0",
    );
  });

  it("says a frame could not be measured rather than reporting zeros", () => {
    // Constitution III: a read nobody made is never a report of four laws
    // passing, which is the most expensive lie this room could tell.
    const note = captureNote(
      1,
      "something is wrong here",
      view({ report: null, unmeasured: "the frame's document could not be reached" }),
      STORY,
    );

    expect(note.at.measured).toBeNull();
    expect(measuredLine(note.at)).toBe(
      "Not measured at capture: the frame's document could not be reached.",
    );
    expect(lawLine(note.at)).toBeNull();

    const draft = composeDraft([note], context());
    expect(draft).toContain("Not measured at capture");
    expect(draft).not.toContain("past the right edge 0");
  });
});

// --- T018, T021: the coordinates are frozen (plan D6, spec Edge Cases) -----

describe("a note's coordinates survive a view change (plan D6)", () => {
  it("keeps the width, theme and route it was taken at", () => {
    const first = view();
    const note = captureNote(1, "cut off at 1280", first, STORY);

    // The operator moves every control the room has, and takes a second note.
    const second = view({ route: "/desk", width: 2560, theme: "light" });
    const later = captureNote(2, "fine at 2560", second, {
      story_key: "US1",
      title: "The Desk sees the floor",
    });

    expect(note.at.width).toBe(1280);
    expect(note.at.theme).toBe("dark");
    expect(note.at.route).toBe("/showfloor");
    expect(note.at.story).toBe("US2");
    expect(later.at.width).toBe(2560);
    expect(later.at.theme).toBe("light");
    expect(later.at.route).toBe("/desk");
  });

  it("keeps the numbers it was taken at when the view is measured again", () => {
    const live = view();
    const note = captureNote(1, "cut off", live, STORY);

    // The next measurement replaces the live view's own report wholesale, which
    // is exactly what the room does on every settle.
    live.report = report({ documentScrollWidth: 1264, past: [], leaves: 9 });
    live.width = 2560;

    expect(note.at.measured?.documentScrollWidth).toBe(1499);
    expect(note.at.measured?.past).toEqual(["div.stage > article.node-card at 1499px"]);
    expect(note.at.measured?.leaves).toBe(214);
    expect(note.at.width).toBe(1280);
    expect(measuredLine(note.at)).toContain("235px hidden past the edge");
  });

  it("copies the arrays rather than pointing into the live measurement", () => {
    // A shallow freeze would let the next measurement rewrite a note's findings
    // out from under it: the object would be frozen and its arrays would not.
    const live = view();
    const source = live.report as LawReport;
    const note = captureNote(1, "cut off", live, STORY);

    source.past.push("a finding taken after the note was");
    source.escaped.push("and another");

    expect(note.at.measured?.past).toEqual(["div.stage > article.node-card at 1499px"]);
    expect(note.at.measured?.escaped).toEqual([]);
  });

  it("is frozen, so nothing downstream can rewrite it in place", () => {
    const note = captureNote(1, "cut off", view(), STORY);

    expect(Object.isFrozen(note)).toBe(true);
    expect(Object.isFrozen(note.at)).toBe(true);
    expect(Object.isFrozen(note.at.measured)).toBe(true);
    expect(Object.isFrozen(note.at.measured?.past)).toBe(true);
  });

  it("composes the same draft after the view has moved on", () => {
    const live = view();
    const note = captureNote(1, "the graph is cut off on the right", live, STORY);
    const before = composeDraft([note], context());

    live.width = 960;
    live.theme = "light";
    live.route = "/desk";
    live.report = report({ past: [], documentScrollWidth: 900 });

    expect(composeDraft([note], context())).toBe(before);
    expect(before).toContain("1280px");
  });
});

// --- T019, T022, FR-013: the shape 007 and 010 have -----------------------

describe("the composed draft is a captured-TBD spec (FR-013)", () => {
  function notes(): Note[] {
    return [
      captureNote(1, "the graph is cut off on the right", view(), STORY),
      captureNote(
        2,
        "the rank label wraps onto two lines\nand the second line is clipped",
        view({ route: "/desk", width: 1600, theme: "light", report: report({ past: [] }) }),
        { story_key: "US1", title: "The Desk sees the floor" },
      ),
    ];
  }

  it("opens with `state: draft` frontmatter that says it is captured, not refined", () => {
    const draft = composeDraft(notes(), context());

    expect(draft.startsWith("---\n")).toBe(true);
    const frontmatter = draft.slice(4, draft.indexOf("\n---\n", 4));
    expect(frontmatter).toContain("state: draft");
    expect(frontmatter).toContain("TBD — CAPTURED, NOT REFINED");
    expect(frontmatter).toContain("NO Work Graph on purpose");
    // 007 and 010 both say this in as many words, because a sketch that a
    // validator refuses is correct and a node reading it must not "fix" it.
    expect(frontmatter).toContain("`ergane spec validate` will refuse it today");
    expect(frontmatter).toContain(
      "depends_on_landed: [011-the-work-comes-back-for-review]",
    );
  });

  it("says in the frontmatter that the room saved nothing (FR-014)", () => {
    const draft = composeDraft(notes(), context());
    expect(draft).toContain("THE ROOM WROTE NOTHING");
    expect(draft).toContain("No file was written, no directory was made");
  });

  it("carries the title, branch, status and input lines 007 and 010 carry", () => {
    const draft = composeDraft(notes(), context());

    expect(draft).toContain("# Feature Specification:");
    expect(draft).toContain("(TBD)");
    expect(draft).toContain("**Feature Branch**: `NNN-name-this-when-you-save-it`");
    expect(draft).toContain("**Created**: 2026-08-26 · **Status**: Draft — unrefined sketch");
    expect(draft).toContain("**Input**: operator observations recorded in the review room");
  });

  it("carries every section a captured-TBD spec carries, in order", () => {
    const draft = composeDraft(notes(), context());

    let cursor = -1;
    for (const heading of CAPTURED_TBD_SECTIONS) {
      const at = draft.indexOf(`\n${heading}`);
      expect(at, `the draft has no ${heading}`).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it("quotes every observation verbatim, line for line", () => {
    const taken = notes();
    const draft = composeDraft(taken, context());

    for (const note of taken) {
      for (const line of note.observation.split("\n")) {
        expect(draft, `the draft drops "${line}"`).toContain(line);
      }
    }
    // And as the corpus quotes the operator, so intent is never mistaken for
    // the room's own prose.
    expect(draft).toContain("> the graph is cut off on the right");
    expect(draft).toContain("> and the second line is clipped");
  });

  it("anchors every observation to the coordinates it was taken at", () => {
    const draft = composeDraft(notes(), context());

    expect(draft).toContain("### 1 — US2 · `/showfloor` · 1280px · dark");
    expect(draft).toContain("### 2 — US1 · `/desk` · 1600px · light");
    expect(draft).toContain("Measured at capture: frame 1264px");
    expect(draft).toContain("235px hidden past the edge");
    expect(draft).toContain("Laws at capture: outside its stage 0 · past the right edge 1");
    // The finding itself, not only its count: it is what makes the note
    // reproducible without re-running the room.
    expect(draft).toContain("`div.stage > article.node-card at 1499px`");
  });

  it("names the epic reviewed and the revision it was served from", () => {
    const draft = composeDraft(notes(), context());
    expect(draft).toContain("`011-the-work-comes-back-for-review`");
    expect(draft).toContain("`14020d9ab3c1`");
  });

  it("says so honestly when the service named no revision", () => {
    const draft = composeDraft(notes(), { ...context(), served: null });
    expect(draft).toContain("a revision it did not name");
  });

  it("has no Work Graph, which is the point of the section (FR-013)", () => {
    const draft = composeDraft(notes(), context());
    const graph = section(draft, "## Work Graph");

    expect(graph).toContain("Deliberately absent");
    // No fenced block of any kind: a compiled graph here is what makes a spec
    // dispatchable, and a room that emitted one would be a room that started a
    // factory by composing a document.
    expect(graph).not.toContain("```");
    expect(graph).not.toContain("depends_on:");
    expect(graph).not.toContain("implements:");
    expect(draft.match(/```/g)).toBeNull();
  });

  it("summarises the note set in the sketch, and asks what it does not know", () => {
    const draft = composeDraft(notes(), context());
    const sketch = section(draft, "## Sketch");

    expect(sketch).toContain("2 observations over 2 routes");
    expect(sketch).toContain("| # | story | route | width | theme | laws at capture |");
    expect(sketch).toContain("| 1 | US2 | `/showfloor` | 1280px | dark |");
    expect(sketch).toContain("past the right edge 1");
    expect(sketch).toContain("| 2 | US1 | `/desk` | 1600px | light | no violation |");

    const questions = section(draft, "## Open questions");
    expect(questions).toContain("Which of these are defects and which are preferences?");
    // Constitution IV reaches the draft, because a sketch refined into scenarios
    // an eye must score is a defect in this document and not in the node.
    expect(questions).toContain("decidable by the judge from the diff alone");
  });

  it("puts saving out of scope in the document itself", () => {
    const scope = section(composeDraft(notes(), context()), "## Out of scope (already known)");
    expect(scope).toContain("The review room writes nothing");
    expect(scope).toContain("not a file, not a directory, not");
  });

  it("reads one observation as one and does not say `1 observations`", () => {
    const draft = composeDraft([captureNote(1, "one thing", view(), STORY)], context());
    expect(draft).toContain("1 observation of");
    expect(draft).not.toContain("1 observations");
    expect(draft).toContain("1 observation over 1 route");
  });

  it("returns the document and does nothing with it (FR-014)", () => {
    // The whole of FR-014's implementation on this side: a `string`, handed
    // back. There is no save to assert the absence of because there is no path
    // by which this function could reach one.
    const draft = composeDraft(notes(), context());
    expect(typeof draft).toBe("string");
    expect(composeDraft(notes(), context())).toBe(draft);
  });
});
