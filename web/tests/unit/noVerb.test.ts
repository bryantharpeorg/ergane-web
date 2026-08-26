/**
 * The one-write sweep (spec 003 US2-S4, plan D-P13).
 *
 * 001 shipped this as a zero-write sweep: the Desk issued no non-GET request at
 * all, because Answer was 003's. Answer has landed, so the assertion becomes the
 * one this repository actually has to keep forever — that `web/src/` issues
 * **exactly one** kind of write, from **exactly one** file, to **exactly one**
 * route. Everything else stays forbidden by name.
 *
 * This is the control against the defect D-001 forbids. A change that "improves"
 * the Desk by adding a convenience write — a dismiss, a snooze, a local resolve,
 * a second verb of any kind, however small — turns this test red, and that is
 * the whole reason it is written this way rather than as "no more than a few
 * writes". A pane with two verbs has broken the constitution, not helped the
 * operator.
 *
 * **One named change, 006 US2 (FR-003's discipline).** The bare-GET half of the
 * sweep read one route by name; it now reads a closed list of two, because the
 * Desk's epic rows take their ladders from `GET /api/showfloor` — the document
 * 005 already serves, read the same way, with no init and no method (T005,
 * FR-005). The subject is untouched: every fetch outside the one writer is
 * still a bare GET of a *read* route named here, so a convenience write added
 * anywhere still turns this red, and so does a read of a route nobody declared.
 */

import { describe, expect, it } from "vitest";

/** The one file permitted to write, and the one route it may write to. */
const WRITER = "src/api/answer.ts";
const WRITE_ROUTE = "/api/attention/";

/**
 * The read routes any other file may GET, and no others.
 *
 * **A second named change, 011 US1.** The list grew by one: the review room
 * reads `GET /api/review/<spec-dir>`, and its spec directory is interpolated,
 * so the entry is spelt as the opening of the template literal rather than as a
 * quoted constant. The subject is untouched — every fetch outside the one
 * writer is still a bare GET of a *read* route named here, so a convenience
 * write added anywhere still turns this red, and so does a read of a route
 * nobody declared.
 */
const READ_ROUTES = ['"/api/floor"', '"/api/showfloor"', "`/api/review/"];

const deskFiles = import.meta.glob("../../src/desk/**/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const appFile = import.meta.glob("../../src/App.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const apiFiles = import.meta.glob("../../src/api/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const allFiles = { ...deskFiles, ...appFile, ...apiFiles };

/** Every file except the one permitted writer. */
function othersOnly(): [string, string][] {
  return Object.entries(allFiles).filter(([path]) => !path.endsWith(WRITER));
}

describe("the Desk has exactly one verb", () => {
  it("issues its one write from web/src/api/answer.ts and from nowhere else", () => {
    const writer = Object.entries(allFiles).find(([path]) => path.endsWith(WRITER));
    expect(writer, `${WRITER} is the file that must carry the one write`).toBeDefined();

    const source = (writer as [string, string])[1];
    expect(source).toContain('method: "POST"');
    expect(source).toContain(WRITE_ROUTE);
    expect(source).toContain("/answer");

    // One POST, and no other method anywhere in it.
    const methods = [...source.matchAll(/method:\s*"([A-Z]+)"/g)].map((m) => m[1]);
    expect(methods).toEqual(["POST"]);

    // And exactly one fetch call, so the file cannot grow a second route.
    expect([...source.matchAll(/fetch\s*\(/g)]).toHaveLength(1);
  });

  it("finds no second write path anywhere else under web/src/", () => {
    for (const [path, source] of othersOnly()) {
      for (const pattern of [
        "<form",
        "onSubmit",
        "method:",
        "XMLHttpRequest",
        "navigator.sendBeacon",
      ]) {
        expect(source, `${path} must not contain ${pattern}`).not.toContain(pattern);
      }

      // Every fetch outside the writer is a bare GET of one of the two read
      // documents — no init, no method, no route that is not named above.
      for (const context of source.split("fetch").slice(1)) {
        const call = context.split(")")[0];
        expect(
          READ_ROUTES.some((route) => call.includes(route)),
          `${path} fetches ${call.trim()}, which is not one of the read routes`,
        ).toBe(true);
        expect(call, `${path} passes a fetch init`).not.toContain(",");
      }
    }
  });

  it("puts every control in the one component that mounts the verb", () => {
    // Buttons and the reply field exist now, and they exist in exactly one
    // place: a control anywhere else in the Desk would have no seam to reach.
    for (const [path, source] of Object.entries(deskFiles)) {
      if (path.endsWith("AnswerColumn.tsx")) continue;
      for (const control of ["<form", "<button", "<input", "<select", "<textarea", "onClick"]) {
        expect(source, `${path} must not carry ${control}`).not.toContain(control);
      }
    }

    const column = deskFiles[
      Object.keys(deskFiles).find((p) => p.endsWith("AnswerColumn.tsx")) as string
    ];
    expect(column).toBeDefined();
    // The only controls it may render, and no others.
    expect(column).toContain("<button");
    expect(column).toContain("<textarea");
    for (const control of ["<form", "<input", "<select"]) {
      expect(column, `AnswerColumn must not render ${control}`).not.toContain(control);
    }
  });

  it("keeps 001's copy rules and loads nothing remote", () => {
    const allSources = Object.values(allFiles).join("\n");
    expect(allSources).not.toContain("https://");

    const interfaceWords = ["dashboard", "console", "board", "mutation", "live floor"];
    for (const word of interfaceWords) {
      expect(allSources.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });
});

/**
 * The Showfloor's own sweep (005 US4-S3, FR-017).
 *
 * 001's sweep above covers the Desk, `App.tsx` and the API layer. The
 * Showfloor was outside it because in the first world the room rendered no
 * control at all and the smoke's `button, form, input` count of zero was the
 * whole assertion. 005 US4 gives the node card a selection `<button>`, so
 * "there are no buttons" stops being the guarantee and this is what replaces
 * it: **exactly one file in `web/src/showfloor/` may render a control, it must
 * be a button, and no file in the room may reach a write of any kind.**
 *
 * The card is a control that *selects*. The constitution's one verb is about
 * what reaches the factory (D-001), and the proof that nothing here does is
 * two-part: this sweep, which shows there is no write in the source, and the
 * smoke's zero-non-GET request log, which shows there is none at runtime.
 */
const showfloorFiles = import.meta.glob("../../src/showfloor/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** The one file in the room permitted to render a control, and its one kind. */
const SELECTOR = "showfloor/NodeCard.tsx";

/**
 * The source with its comments removed.
 *
 * This room's files argue with themselves in prose — `Rail.tsx` explains at
 * length why its rows are anchors and *not* the `<button>`s the comp drew — and
 * a sweep that cannot tell a rendered control from a sentence about one would
 * force those explanations out of the code to stay green. What is swept is what
 * ships.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("the Showfloor has no verb at all (constitution I, FR-017)", () => {
  it("sweeps a room that is really there", () => {
    // A sweep over nothing passes vacuously — the gate-matching-nothing defect
    // 001 US1-S1 exists to prevent.
    expect(Object.keys(showfloorFiles).length).toBeGreaterThan(5);
    expect(
      Object.keys(showfloorFiles).some((path) => path.endsWith(SELECTOR)),
      `${SELECTOR} is in the sweep`,
    ).toBe(true);
  });

  it("renders no form and no input anywhere in the room", () => {
    for (const [path, source] of Object.entries(showfloorFiles)) {
      for (const control of ["<form", "<input", "<select", "<textarea", "onSubmit"]) {
        expect(code(source), `${path} must not render ${control}`).not.toContain(control);
      }
    }
  });

  it("renders a button in exactly one file, and it is the node card's", () => {
    for (const [path, source] of Object.entries(showfloorFiles)) {
      if (path.endsWith(SELECTOR)) continue;
      expect(code(source), `${path} must not render a control`).not.toContain("<button");
      expect(code(source), `${path} must not carry a click handler`).not.toContain("onClick");
    }

    const card = code(
      showfloorFiles[
        Object.keys(showfloorFiles).find((path) => path.endsWith(SELECTOR)) as string
      ],
    );
    expect(card).toContain("<button");
    expect(card).toContain('type="button"');
    // One control, not a pair: a card with a second button would be a second
    // thing to prove harmless.
    expect([...card.matchAll(/<button/g)]).toHaveLength(1);
  });

  it("reaches no write from anywhere in the room", () => {
    /** The two documents the room reads, and the only two it may name. */
    const READS = ['"/api/showfloor"', '"/api/floor"', '"/api/events"'];

    for (const [path, raw] of Object.entries(showfloorFiles)) {
      const source = code(raw);
      for (const pattern of ["method:", "XMLHttpRequest", "navigator.sendBeacon", "https://"]) {
        expect(source, `${path} must not contain ${pattern}`).not.toContain(pattern);
      }

      // Every fetch in the room is a bare GET of a document it renders: the
      // route is one of three, and there is no init object to carry a method.
      for (const context of source.split("fetch(").slice(1)) {
        const call = context.split(")")[0];
        expect(
          READS.some((route) => call.includes(route)),
          `${path} fetches ${call.trim()}, which is not a document this room reads`,
        ).toBe(true);
        expect(call, `${path} passes a fetch init`).not.toContain(",");
      }
    }
  });

  it("points its one link at the Desk and carries a count, not a verb", () => {
    const badge = showfloorFiles[
      Object.keys(showfloorFiles).find((path) => path.endsWith("AttentionBadge.tsx")) as string
    ];
    expect(badge).toBeDefined();
    // An anchor to the Desk's own root, and the count as the element's text —
    // never a control that resolves anything from this room (§ Attention badge).
    expect(badge).toContain("<a className=\"attention-badge\"");
    expect(badge).toContain("href={DESK_ROOT_PATH}");
    expect(badge).toContain("{count}");
    expect(badge).not.toContain("<button");
  });
});

/**
 * The review room's own sweep (011 US1, constitution I).
 *
 * The room is new and it is the one that most looks like it wants a verb: it
 * exists so an operator can record what they think of the work. US3 will give
 * it note-taking, and FR-014 says in as many words that the room writes
 * nothing — not a file, not a directory, not a spec — so the notes stay in the
 * browser and the composed draft is handed to the operator to save.
 *
 * This is the control on that. **No file in `web/src/review/` may reach a write
 * of any kind, and the one read it makes is the room's own document.** A node
 * that "helpfully" adds a save button, a POST, or a second route to this room
 * turns it red, which is the point: D-023's safety argument is that this room
 * spawns nothing and writes nothing, and an argument nothing enforces is a
 * sentence in a decision log.
 */
const reviewFiles = import.meta.glob("../../src/review/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("the review room writes nothing (011 FR-014, constitution I)", () => {
  it("sweeps a room that is really there", () => {
    expect(Object.keys(reviewFiles).length).toBeGreaterThan(1);
    expect(
      Object.keys(reviewFiles).some((path) => path.endsWith("review/Review.tsx")),
      "Review.tsx is in the sweep",
    ).toBe(true);
  });

  it("renders no form and no input anywhere in the room", () => {
    for (const [path, source] of Object.entries(reviewFiles)) {
      for (const control of ["<form", "<input", "<select", "<textarea", "onSubmit"]) {
        expect(code(source), `${path} must not render ${control}`).not.toContain(control);
      }
    }
  });

  it("reaches no write and no route but its own document", () => {
    for (const [path, raw] of Object.entries(reviewFiles)) {
      const source = code(raw);
      for (const pattern of ["method:", "XMLHttpRequest", "navigator.sendBeacon", "https://"]) {
        expect(source, `${path} must not contain ${pattern}`).not.toContain(pattern);
      }
      for (const context of source.split("fetch(").slice(1)) {
        const call = context.split(")")[0];
        expect(
          call.includes("`/api/review/"),
          `${path} fetches ${call.trim()}, which is not this room's document`,
        ).toBe(true);
      }
    }
  });

  /**
   * 011 US2 gives this room its first controls, and this is what bounds them.
   *
   * The frame needs a route, a width and a theme chosen, and every one of those
   * choices changes what *this browser* is looking at and reaches nothing. That
   * is the Showfloor node card's shape, for the Showfloor node card's reason —
   * so it is held to the Showfloor node card's rule: **one file may render a
   * control, it must be a button, and there is no other kind of control in the
   * room.** The `<form`, `<input`, `<select` and `<textarea` sweep above is what
   * keeps a URL bar out of a room whose whole safety argument is that its URL
   * set is closed (D-023).
   */
  const SELECTOR = "review/TheThingItself.tsx";

  it("renders a control in exactly one file, and every one is a button", () => {
    for (const [path, raw] of Object.entries(reviewFiles)) {
      if (path.endsWith(SELECTOR)) continue;
      expect(code(raw), `${path} must not render a control`).not.toContain("<button");
      expect(code(raw), `${path} must not carry a click handler`).not.toContain("onClick");
    }

    const track = code(
      reviewFiles[
        Object.keys(reviewFiles).find((path) => path.endsWith(SELECTOR)) as string
      ],
    );
    expect(track).toBeDefined();
    expect(track).toContain("<button");
    // Three groups of them — route, width, theme — and every one declares its
    // type, so none of them can be a submit for a form this room does not have.
    const buttons = [...track.matchAll(/<button/g)];
    const typed = [...track.matchAll(/type="button"/g)];
    expect(buttons.length).toBeGreaterThan(0);
    expect(typed).toHaveLength(buttons.length);
  });

  it("frames a route the backend resolved, never one the browser composed", () => {
    // The closed, derived URL set is the whole of why a frame was admissible
    // where a driven browser was not. A route that could be typed, guessed or
    // assembled here would be the thing D-023 refused, wearing an iframe.
    const track = code(
      reviewFiles[
        Object.keys(reviewFiles).find((path) => path.endsWith(SELECTOR)) as string
      ],
    );
    expect(track).toContain("src={route}");
    const chosen = [...track.matchAll(/setRoute\(([^)]*)\)/g)].map((match) =>
      match[1].trim(),
    );
    expect(chosen).toEqual(["option.path"]);
    for (const pattern of ["http:", "location.href", "new URL("]) {
      expect(track, `${SELECTOR} must not compose ${pattern}`).not.toContain(pattern);
    }
  });

  it("spawns nothing: no browser, no worker, no window it drives (D-023)", () => {
    // The substitution D-023 made is the whole safety argument of this room:
    // the operator's own browser is the browser. A room that opened a window,
    // started a worker or reached an origin of its own has reintroduced every
    // question that decision closed.
    for (const [path, raw] of Object.entries(reviewFiles)) {
      const source = code(raw);
      for (const pattern of ["window.open", "new Worker", "postMessage", "document.domain"]) {
        expect(source, `${path} must not contain ${pattern}`).not.toContain(pattern);
      }
    }
  });
});
