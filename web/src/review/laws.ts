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
 * ── why this file is in `src/` and not in the suite (011 US2, plan D2) ──────
 *
 * It used to live in `web/tests/smoke/support/laws.ts`, because until 011 the
 * only thing that measured a rendered page was Playwright. The review room is
 * the second: it renders a changed route in a same-origin frame and measures
 * the four laws **inside that frame**, from the parent document, so the
 * operator reads the numbers beside the thing itself (FR-008).
 *
 * The plan's D2 says why it moved rather than being written twice: *"a second
 * implementation of the four laws is a second answer to the same question, and
 * the two will disagree."* The numbers that earned this room — `235px of graph
 * hidden at 1280`, `US4 fully invisible`, `scrollbar height 0px` — came out of
 * this code, and a room that reported different ones would be reviewing a
 * different page from the one the gate measures.
 *
 * So there is one measurement and two callers. The room imports it and hands it
 * `frame.contentDocument`; `web/tests/smoke/support/laws.ts` hands the page's
 * own `document` through `page.evaluate`. **Not one assertion of the smoke
 * suite changed**, and that is the check on the move: the harness's
 * `measureLaws(page)` keeps its signature and its answer.
 *
 * ── the parameter, and it is the only edit to the measurement ──────────────
 *
 * Every reference that read the ambient `document` now reads the `doc` it is
 * given, and `getComputedStyle` / `DOMRect` come off that document's own view.
 * A measurement that reached the ambient globals would silently measure the
 * *room* while claiming to measure the frame, which is the one lie this file
 * must not be able to tell.
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
 * ── one measurement, two rooms ─────────────────────────────────────────────
 *
 * 005 landed the measurement inside `showfloor.spec.ts` and 006 copied law (c)
 * of it into `desk.spec.ts`. D-018's law has to hold over every route the
 * smoke suite sweeps, in both rooms, so the measurement moved to one file and
 * every caller imports it rather than carrying a third copy. `describe()`
 * carries both the Showfloor's `data-story-id` / `data-metric` and the Desk's
 * text snippet, and law (c) tells one leaf's line fragments from another
 * leaf's by the leaf's index rather than by that label, which is what the
 * label was standing in for.
 */

/** What one pass of the four laws over one document reports. */
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
 * One traversal rather than four: the boxes have to come from a single layout,
 * or a law could pass against a layout a later law never saw.
 *
 * **Self-contained on purpose.** It reaches nothing in module scope — every
 * constant and every helper is declared inside it — because
 * `web/tests/smoke/support/laws.ts` ships its source into the browser through
 * `page.evaluate`, where module scope does not exist. A closure over an import
 * added here would fail there and nowhere else.
 */
export function measureLawsIn(doc: Document): LawReport {
  const view = doc.defaultView ?? window;
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
        box = new view.DOMRect(left, top, right - left, bottom - top);
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
