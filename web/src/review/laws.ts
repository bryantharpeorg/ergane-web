/**
 * The layout laws, measured in one pass over a rendered document.
 *
 * **Authority: `DESIGN.md` § Layout, "Containment is a design law."** Read it
 * before changing anything here; it is what these four assertions are the
 * committed form of, and it names all four in the order they are measured:
 *
 * > **Containment is a design law.** No element carrying text may cross the
 * > viewport's right edge except inside an ancestor whose `overflow-x`
 * > scrolls, and every stage element sits inside its stage's box. No two text
 * > leaves may overlap. **And no element with an opaque background may paint
 * > over a text leaf that is not its own** (2026-08-25, D-018) — the first
 * > three laws measure glyph geometry through a `Range` over each leaf, which
 * > is correct and is exactly why they cannot see a box painted on top of
 * > readable text. A degraded note once rendered with its heading cut
 * > mid-word, in both themes, while all three passed. These are committed test
 * > assertions, not aspirations.
 *
 * ── where the four came from ───────────────────────────────────────────────
 *
 * 004 paid for the first three. Its suite asserted a stage's *height* and
 * never asserted where anything ended up, so the gate went green over nine of
 * nine stations laid out beyond their own map, a landing lane 121px past its
 * container, and the Desk's colliding labels. Laws (a), (b) and (c) are those
 * three defects, generalised so they cannot come back in a different
 * component.
 *
 * D-018 paid for the fourth. On 2026-08-25 a degraded note rendered
 * unreadable in both themes, its heading cut mid-word, and **all three laws
 * passed** — correctly, because they measure glyphs and no glyph had moved.
 * The instance was fixed incidentally when 006 rewrote `global.css`; law (d)
 * is what stops the class coming back, and `showfloor.spec.ts`'s mutation
 * control is the committed proof that the other three structurally cannot see
 * it.
 *
 * ── what 013 corrected, and what it did not ────────────────────────────────
 *
 * 013 US3 pointed the four at the gate run — the pane's last section, and the
 * first thing in this repository to hold a `<details>` and a leaf that scrolls
 * itself. Neither law changed. What changed is that the measurement stopped
 * reporting text a reader cannot see, which is the doctrine `clipped()` has
 * encoded since 005 US4 and had two blind spots in:
 *
 *   * a leaf's **own** `overflow` now clips its own text, because the output
 *     tail is a `<pre>` capped at `16rem` that scrolls thirty lines behind a
 *     248px window (`clipped`'s `from` argument);
 *   * `painted()` now asks `checkVisibility()`, because Chromium skips a closed
 *     disclosure through a shadow `::details-content` that no light-DOM
 *     ancestor carries, and the skipped element still answers
 *     `getBoundingClientRect()` with the box it would have had.
 *
 * Both are paid for the way 005's and 009's laws were: `showfloor.spec.ts`
 * plants a collision over the visible part of an open tail and over a shut
 * fold's summary, and requires law (c) red for each.
 *
 * ── why this file is here, in `src/` (011 US2) ─────────────────────────────
 *
 * 005 landed the measurement inside `showfloor.spec.ts`; 006 copied law (c) of
 * it into `desk.spec.ts`; D-018's law had to hold over every route the suite
 * sweeps, so the measurement moved to `tests/smoke/support/laws.ts` and both
 * rooms imported it rather than carrying a third copy.
 *
 * **011 US2 gives it a second kind of caller and moves it one directory
 * further, and the reason is plan D2 in one sentence: a second implementation
 * of the four laws is a second answer to the same question, and the two will
 * disagree.** The review room measures a *rendered route in a same-origin
 * frame* from the parent document (D-023) and renders the numbers beside it
 * (FR-008); the smoke suite measures a page through Playwright. Those are two
 * callers of one measurement, not two measurements — and the numbers the
 * review room shows an operator have to be the numbers that found F1, F2 and
 * F3 on 2026-08-25, or the room is reporting something nobody has ever checked
 * a gate against.
 *
 * So the pass takes the document it measures as an argument, and everything it
 * touches is reached through that document rather than through the ambient
 * global. Two consequences bind every edit here:
 *
 *   * **`doc`, never `document`.** A `document.querySelector` left in this file
 *     would measure the *room* while claiming to measure the frame, which is
 *     the one failure mode that would make FR-008's numbers lies. There is a
 *     committed test for it (`tests/unit/laws.test.ts`).
 *   * **the function stays self-contained.** `measureLaws` below hands this
 *     very function to `page.evaluate`, which serialises it with
 *     `Function.prototype.toString` and evaluates it inside the page — so a
 *     reference to anything at module scope (an import, a constant, a helper)
 *     is a `ReferenceError` in the browser and not a compile error here. Every
 *     helper is declared inside the body on purpose. It is not accidental
 *     nesting.
 *
 * The code is 005's, 006's and 013's, unedited except for that parameter.
 */

/** What one pass over a document found. */
export interface LawReport {
  swept: number;
  leaves: number;
  /** Painters law (d) considered: a floor, so a page with no paint cannot pass it. */
  painters: number;
  escaped: string[];
  past: string[];
  overlapping: string[];
  occluded: string[];
  documentScrollWidth: number;
  roomScrollsSideways: boolean;
  viewport: number;
}

/**
 * All four laws, measured in one pass over `doc`.
 *
 * One walk rather than four: the boxes have to come from a single layout, or a
 * law could pass against a layout a later law never saw.
 *
 * `doc` defaults to the ambient document so that `page.evaluate` can call this
 * with no argument at all — Playwright invokes the serialised function with
 * `undefined`, and the default then resolves to the *page's* `document` rather
 * than to anything on this side of the wire. Every caller in the pane passes
 * the frame's document explicitly.
 */
export function measureLawsIn(doc: Document = document): LawReport {
  const view = doc.defaultView;
  if (view === null) {
    throw new Error("the document to measure has no window; nothing is laid out in it");
  }
  const EPSILON = 0.5;
  /** § Layout's "no two text leaves overlap", with the 4px slack T024 names. */
  const OVERLAP = 4;
  /**
   * Law (d)'s slack, in both axes. Tighter than law (c)'s 4px on purpose: a
   * chip's background box and its neighbour's glyphs sit shoulder to
   * shoulder, so a pixel of subpixel rounding must not read as paint, but
   * two pixels of a box standing on a letter must.
   */
  const OCCLUSION = 1;

  const describe = (element: Element): string => {
    const classes =
      typeof element.className === "string" && element.className.trim()
        ? `.${element.className.trim().split(/\s+/).join(".")}`
        : "";
    const id = element.getAttribute("data-story-id") ?? element.getAttribute("data-metric");
    const text = (element.textContent ?? "").trim().slice(0, 32);
    return `${element.tagName.toLowerCase()}${classes}${id ? `[${id}]` : ""}${
      text ? `["${text}"]` : ""
    }`;
  };

  const SKIP = ["script", "style", "head", "title", "meta", "link"];
  const hasText = (element: Element) =>
    !SKIP.includes(element.tagName.toLowerCase()) && (element.textContent ?? "").trim() !== "";

  /**
   * Is this element actually rendered?
   *
   * A box, and the browser's own answer to the question (013 US3). The box
   * alone was enough until the gate run brought this repository its first
   * `<details>`: Chromium skips a closed disclosure's contents through
   * `::details-content { content-visibility: hidden }`, which is a **shadow**
   * pseudo-element — no ancestor in the light DOM carries the property, and
   * the skipped `<pre>` still answers `getBoundingClientRect()` with the box
   * it would have had. So a fold shut over thirty lines of process output
   * reported a 248px column of text sitting on every row beneath it, and the
   * collision law was measuring something no reader can see.
   *
   * `checkVisibility()` is the browser's own reply and not a guess of this
   * harness's: false for `display: none`, false for a subtree it is skipping.
   * Nothing is excused by it — an **open** fold's tail is rendered, is
   * measured, and is swept at every width `showfloor.spec.ts` sweeps.
   */
  const painted = (element: Element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) return false;
    return element.checkVisibility();
  };

  /**
   * An ancestor that really scrolls sideways, and is itself on the screen.
   *
   * The walk stops *below* the room's own scroll root. That root fills the
   * viewport and carries `overflow: auto`, so it would excuse every escape on
   * the page by the letter of the law — and a room that scrolls sideways is
   * the defect, not the exemption. § Stage sanctions one horizontal scroll:
   * the stage's, when a graph outgrows it. `rootScrollsSideways` below is the
   * other half of that pair, asserted separately.
   */
  const scrollingAncestor = (element: Element, limit: Element | null, viewport: number) => {
    const room = doc.querySelector("[data-showfloor-root]");
    let parent = element.parentElement;
    while (parent !== null && parent !== doc.documentElement && parent !== doc.body) {
      if (parent === room) return null;
      const style = view.getComputedStyle(parent);
      if (
        (style.overflowX === "auto" || style.overflowX === "scroll") &&
        parent.scrollWidth > parent.clientWidth &&
        parent.getBoundingClientRect().right <= viewport + EPSILON
      ) {
        return parent;
      }
      if (parent === limit) return null;
      parent = parent.parentElement;
    }
    return null;
  };

  const viewport = doc.documentElement.clientWidth;
  const escaped: string[] = [];
  const past: string[] = [];
  const overlapping: string[] = [];
  const occluded: string[] = [];
  let swept = 0;

  // ── law (a): every stage descendant inside its stage's box, or inside a
  // scrolling ancestor within it.
  for (const stage of Array.from(doc.querySelectorAll("[data-stage]"))) {
    const bounds = stage.getBoundingClientRect();
    for (const child of Array.from(stage.querySelectorAll("*"))) {
      if (SKIP.includes(child.tagName.toLowerCase())) continue;
      if (!painted(child)) continue;
      const rect = child.getBoundingClientRect();
      const inside =
        rect.left >= bounds.left - EPSILON &&
        rect.right <= bounds.right + EPSILON &&
        rect.top >= bounds.top - EPSILON &&
        rect.bottom <= bounds.bottom + EPSILON;
      if (inside) continue;
      // A wide graph is allowed to overflow the stage *inside a scroller the
      // stage contains* — that is § Stage's horizontal scroll, not an escape.
      const scroller = scrollingAncestor(child, stage, viewport);
      if (scroller !== null && stage.contains(scroller)) continue;
      escaped.push(
        `${describe(child)} at [${rect.left.toFixed(0)}, ${rect.right.toFixed(0)}] outside stage [${bounds.left.toFixed(0)}, ${bounds.right.toFixed(0)}]`,
      );
    }
  }

  // ── law (b): no text-carrying element past the viewport's right edge,
  // except inside an ancestor whose computed `overflow-x` scrolls.
  const texts: Element[] = [];
  for (const element of Array.from(doc.querySelectorAll("*"))) {
    if (!hasText(element) || !painted(element)) continue;
    texts.push(element);
    swept++;
    const rect = element.getBoundingClientRect();
    if (rect.right <= viewport + EPSILON) continue;
    if (scrollingAncestor(element, null, viewport) !== null) continue;
    past.push(`${describe(element)} at ${rect.right.toFixed(0)}px`);
  }

  // ── law (c): no two text-carrying *leaves* overlap in both axes, as they
  // are actually painted.
  // A leaf is an element with text and no element child that has text — the
  // ancestors of a text run necessarily contain it, and containment is not
  // collision.
  //
  // The boxes are the *text's*, measured through a `Range` over each leaf's
  // contents — one rect per line fragment — and not the element's own
  // `getClientRects()`. An inline element that wraps reports fragment rects
  // carrying the whole inline box's height in Chromium, so a wrapped span
  // "overlaps" every sibling on the lines it crosses: a collision that is an
  // artefact of the measurement and is not on the screen. A range measures
  // the glyphs, which is what a reader sees two of.
  const leaves = texts.filter(
    (element) => !Array.from(element.children).some((child) => hasText(child)),
  );
  //
  // And the box is what survives its clipping ancestors (005 US4). A stage
  // wide enough to scroll puts its right-hand cards *under* the detail
  // column in coordinates while the scroller clips them away on the screen:
  // two runs of text that cannot both be seen have not collided, and calling
  // that a collision would make the law report the defect it was written to
  // catch in a room that does not have it. The clip is applied, not excused —
  // an overlap that survives it is still an overlap, which is what keeps the
  // planted collision below going red.
  //
  // `from` is which element the walk starts at, and it is the difference
  // between the two things this function is asked for (013 US3):
  //
  //   * **a leaf's text** is clipped by the leaf's own `overflow` as well as
  //     by its ancestors'. The gate run's output tail is the first leaf in
  //     this repository that scrolls itself — a `<pre>` capped at `16rem`
  //     with `overflow: auto`, holding a failure that runs to thirty lines —
  //     and a `Range` over it reports every one of those lines at its
  //     unclipped height. Measured from the parent, that column of text
  //     "collides" with every row beneath the fold: an artefact of exactly
  //     the kind the paragraph above describes, and not one letter of it is
  //     on the screen.
  //   * **a painter's own box** is not. An element's `overflow` clips what is
  //     inside it and never the background it paints itself, so law (d)
  //     starts its walk one level up, where it always did.
  //
  // Nothing is excused either way: the clip is the *screen's*, so an overlap
  // inside the part of a scroller a reader can actually see survives it, and
  // `showfloor.spec.ts` plants one there to prove it.
  const clipped = (element: Element, rect: DOMRect, from: Element | null): DOMRect | null => {
    let box = rect;
    let parent = from;
    while (parent !== null && parent !== doc.documentElement) {
      const style = view.getComputedStyle(parent);
      const clips =
        style.overflowX !== "visible" ||
        style.overflowY !== "visible" ||
        style.overflow !== "visible";
      if (clips) {
        const bounds = parent.getBoundingClientRect();
        const left = Math.max(box.left, bounds.left);
        const right = Math.min(box.right, bounds.right);
        const top = Math.max(box.top, bounds.top);
        const bottom = Math.min(box.bottom, bounds.bottom);
        if (right - left <= 0 || bottom - top <= 0) return null;
        box = new DOMRect(left, top, right - left, bottom - top);
      }
      parent = parent.parentElement;
    }
    return box;
  };

  const boxes = leaves.flatMap((element, index) => {
    const range = doc.createRange();
    range.selectNodeContents(element);
    return Array.from(range.getClientRects())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({
        element,
        index,
        label: describe(element),
        rect: clipped(element, rect, element),
      }))
      .filter(
        (box): box is { element: Element; index: number; label: string; rect: DOMRect } =>
          box.rect !== null,
      );
  });
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      // Two line fragments of one leaf are one run of text, not two.
      if (boxes[i].index === boxes[j].index) continue;
      const a = boxes[i].rect;
      const b = boxes[j].rect;
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (x > OVERLAP && y > OVERLAP) {
        overlapping.push(`${boxes[i].label} × ${boxes[j].label}`);
      }
    }
  }

  // ── law (d) (D-018): no element with a non-transparent computed
  // background may paint over a text leaf that is not its own descendant.
  //
  // The three laws above read glyphs, deliberately, and that is precisely
  // their blind spot: an opaque box standing on a word intersects no other
  // word, escapes no container and crosses no viewport edge. Nothing about
  // the *text* is wrong. It simply cannot be read.
  //
  // A painter is any element whose computed `backgroundColor` has a non-zero
  // alpha and which is itself visible. Its box is clipped by its own
  // clipping ancestors, exactly as a leaf's is — a card a scroller hides
  // paints nothing where it is hidden.
  const backgroundAlpha = (colour: string): number => {
    const value = colour.trim();
    if (value === "" || value === "transparent") return 0;
    const match = /^rgba?\(([^)]*)\)$/.exec(value);
    // A colour this parse does not know is treated as paint. The law would
    // rather report a box it cannot read than excuse one.
    if (match === null) return 1;
    const parts = match[1]
      .split(/[,/\s]+/)
      .filter((part) => part !== "")
      .map(Number);
    return parts.length > 3 ? parts[3] : 1;
  };

  const painters: Array<{ element: Element; label: string; rect: DOMRect }> = [];
  for (const element of Array.from(doc.querySelectorAll("*"))) {
    if (SKIP.includes(element.tagName.toLowerCase())) continue;
    if (!painted(element)) continue;
    const style = view.getComputedStyle(element);
    if (style.visibility === "hidden" || Number(style.opacity) === 0) continue;
    if (backgroundAlpha(style.backgroundColor) === 0) continue;
    const box = clipped(element, element.getBoundingClientRect(), element.parentElement);
    if (box === null) continue;
    painters.push({ element, label: describe(element), rect: box });
  }

  /**
   * Does `painter` paint above `leaf` where their boxes meet?
   *
   * Not guessed from document order: stacking contexts, `z-index` and
   * positioning make that a guess, and a wrong guess in either direction is
   * a law that lies. `elementsFromPoint` is the browser's own hit stack at a
   * point, topmost first — the same order the pixels were painted in. If the
   * painter comes before the leaf there, a reader looking at that pixel sees
   * the painter and not the letter under it.
   */
  const paintsAbove = (painter: Element, leaf: Element, a: DOMRect, b: DOMRect): boolean => {
    const x = (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2;
    const y = (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2;
    const stack = doc.elementsFromPoint(x, y);
    const above = stack.indexOf(painter);
    const under = stack.indexOf(leaf);
    if (above === -1) return false;
    if (under === -1) return false;
    return above < under;
  };

  const seen = new Set<string>();
  for (const painter of painters) {
    for (const box of boxes) {
      // A container painting behind its own text is the whole point of a
      // background. § Layout forbids painting over text a box does *not*
      // own.
      if (painter.element.contains(box.element)) continue;
      const x =
        Math.min(painter.rect.right, box.rect.right) - Math.max(painter.rect.left, box.rect.left);
      const y =
        Math.min(painter.rect.bottom, box.rect.bottom) - Math.max(painter.rect.top, box.rect.top);
      if (x <= OCCLUSION || y <= OCCLUSION) continue;
      if (!paintsAbove(painter.element, box.element, painter.rect, box.rect)) continue;
      const hit = `${painter.label} over ${box.label}`;
      if (seen.has(hit)) continue;
      seen.add(hit);
      occluded.push(hit);
    }
  }

  const room = doc.querySelector("[data-showfloor-root]");

  return {
    swept,
    leaves: leaves.length,
    painters: painters.length,
    escaped,
    past,
    overlapping,
    occluded,
    documentScrollWidth: doc.documentElement.scrollWidth,
    roomScrollsSideways: room !== null && room.scrollWidth > room.clientWidth + EPSILON,
    viewport,
  };
}

/**
 * The four laws, each with the count the room shows beside the frame.
 *
 * § The review room: "**A measured number is shown, never only a verdict.**
 * Numerals right-aligned tabular mono, the unit always present, the law named
 * beside the figure." So a law is a name, a figure, and — when the figure is
 * not zero — the descriptions the pass produced, which are what a note gets
 * anchored to. `violations` is a count and never a boolean: `0` is a number the
 * operator can read, `passed` is a claim they have to take on trust.
 */
export interface LawResult {
  key: "escaped" | "past" | "overlapping" | "occluded";
  /** The law's own sentence from § Layout, short enough to sit beside a figure. */
  law: string;
  violations: number;
  detail: string[];
}

/** The two themes `DESIGN.md` renders, and the only two `data-theme` takes. */
export type Theme = "light" | "dark";

/**
 * The widths the review room offers for the frame.
 *
 * **The same three the smoke suite sweeps**, and declared once here so they
 * cannot drift apart: a room that offered a width no gate measures would let an
 * operator find a defect the suite could never be made to reproduce, and one
 * that omitted a width the suite sweeps would hide the widths where containment
 * actually breaks. `showfloor.spec.ts`, `desk-world.spec.ts` and `draft.spec.ts`
 * all sweep exactly these.
 */
export const FRAME_WIDTHS = [1280, 1600, 2560] as const;

/** Both, in the order the room offers them. */
export const FRAME_THEMES: readonly Theme[] = ["light", "dark"];

/**
 * One measurement, with the coordinates that make it reproducible.
 *
 * The report is never held apart from the route, width and theme it was taken
 * at. A figure on the screen that does not say what it is a figure *of* is the
 * thing the two manual reviews were useful for avoiding — and US3 anchors a note
 * to exactly these four, so they are one value from the moment they are taken
 * (plan D6).
 */
export interface Measurement {
  route: string;
  width: number;
  theme: Theme;
  report: LawReport;
}

/** The four, in the order `measureLawsIn` measures them. */
export function lawResults(report: LawReport): LawResult[] {
  return [
    {
      key: "escaped",
      law: "every stage element sits inside its stage's box",
      violations: report.escaped.length,
      detail: report.escaped,
    },
    {
      key: "past",
      law: "no text crosses the right edge outside a scrolling ancestor",
      violations: report.past.length,
      detail: report.past,
    },
    {
      key: "overlapping",
      law: "no two text leaves overlap",
      violations: report.overlapping.length,
      detail: report.overlapping,
    },
    {
      key: "occluded",
      law: "no opaque box paints over text it does not own",
      violations: report.occluded.length,
      detail: report.occluded,
    },
  ];
}
