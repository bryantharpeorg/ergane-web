/**
 * The thing itself: a changed screen, rendered, beside its measured numbers.
 *
 * 011 US2 (FR-007, FR-008, plan D1 and D2). The middle track of `DESIGN.md`
 * § The review room, and the half a headless gate cannot do.
 *
 * **The operator's own browser is the browser** (D-023). The spec's § Questions
 * argues this at length and the short version is that a web server which spawns
 * Chromium behind a bearer token is a different product with a different threat
 * model. So the room renders a changed route in a **same-origin frame**, at a
 * width and in a theme the operator picks, and measures inside it from this
 * document. Nothing is spawned, nothing is written, no URL of the room's own is
 * ever reached, and there is nothing here for a leaked token to start.
 *
 * That argument is only as good as what enforces it, so:
 *
 * * the frame's `src` is a **path off the room's own document** — one of the
 *   routes `GET /api/review/<spec-dir>` said this epic reaches, never a string
 *   an operator typed and never an origin;
 * * `web/tests/unit/noVerb.test.ts` sweeps this room for a second frame, for a
 *   URL literal, and for any write at all.
 *
 * **The measurement is the point, not the screenshot.** The four laws below are
 * `web/src/layoutLaws.ts`'s — the same function the smoke gates evaluate in the
 * page — called against `frame.contentDocument`. Plan D2 refuses a second copy
 * in as many words: *"a second implementation of the four laws is a second
 * answer to the same question, and the two will disagree."* The whole value of
 * this room is that its numbers are the gate's numbers.
 *
 * **The room does not render itself in its own frame.** A review room framing a
 * review room frames a review room: the nesting is bounded only by the
 * browser's own recursion guard, twenty full page loads down, and what the
 * operator would be measuring by then is the furniture and not the epic's
 * screen. The route is listed with the reason instead of being dropped —
 * nothing this room knows about is hidden from the operator (FR-003's
 * discipline, kept).
 *
 * **The theme is forced, not hoped for.** `global.css` § Colors resolves dark
 * from `prefers-color-scheme` *unless* `:root` carries `data-theme`, and honours
 * `data-theme` in both directions. Same origin means this document can set that
 * attribute on the frame's, so "in a theme I choose" is a fact about the render
 * and not about the operator's operating system.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReviewRoute } from "../api/reviewDocument";
import { measureLawsIn } from "../layoutLaws";
import { isReviewPath } from "../routes";
import LawReadout from "./LawReadout";
import type { Measurement } from "./LawReadout";

/**
 * The widths the operator may choose, and they are the suite's own.
 *
 * `desk-world.spec.ts`, `desk.spec.ts` and `showfloor.spec.ts` all sweep
 * 1280/1600/2560, and FR-011 requires this room to hold the four laws at every
 * width the suite sweeps. Offering the operator a different set would mean the
 * room measures screens at widths nothing else in this repository ever checks.
 */
export const WIDTHS = [1280, 1600, 2560] as const;

/** The two the suite sweeps, and the two `global.css` § Colors declares. */
export const THEMES = ["light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

/** The frame's height. One value, so two renders cannot differ by it. */
const FRAME_HEIGHT = 720;

/**
 * The routes an operator may put in the frame.
 *
 * A room the epic reaches, and not this room. Everything else the document
 * named is still shown — see `unframeable` below — because a route silently
 * dropped is a screen the operator does not know they have not looked at.
 */
export function framedRoutes(routes: ReviewRoute[]): ReviewRoute[] {
  return routes.filter((route) => route.kind === "room" && !isReviewPath(route.path));
}

/** The routes the frame will not take, each with the reason it will not. */
export function unframeableRoutes(routes: ReviewRoute[]): Array<[ReviewRoute, string]> {
  return routes
    .filter((route) => !(route.kind === "room" && !isReviewPath(route.path)))
    .map((route) => [
      route,
      isReviewPath(route.path)
        ? "this room; framing it inside itself measures the furniture"
        : `a ${route.kind ?? "document"} route, not a screen`,
    ]);
}

export default function TheThingItself({ routes }: { routes: ReviewRoute[] }): JSX.Element {
  const framed = framedRoutes(routes);
  const unframeable = unframeableRoutes(routes);

  const [route, setRoute] = useState<string | null>(framed.length > 0 ? framed[0].path : null);
  const [width, setWidth] = useState<number>(WIDTHS[0]);
  const [theme, setTheme] = useState<Theme>(THEMES[0]);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);

  const frameRef = useRef<HTMLIFrameElement>(null);

  /**
   * Dress the frame in the chosen theme and run the four laws inside it.
   *
   * The two happen together and in that order deliberately: a report taken
   * before the attribute lands is a report about the other theme, and the whole
   * claim of FR-008 is that the numbers are of the screen in front of the
   * operator.
   *
   * Every failure is named rather than swallowed (constitution III). A frame
   * with no document, a document with no view, a measurement that threw — each
   * comes back as `unmeasured` with its own sentence, because zero violations
   * over a sweep that did not run is the emptiest pass this repository has.
   */
  const measure = useCallback(() => {
    const frame = frameRef.current;
    if (route === null || frame === null) return;

    const at = { route, width, theme };
    // The frame's content box, which *is* the framed document's viewport — and
    // read through `clientWidth` rather than a rect on purpose: the four laws
    // are measured in one place (plan D2), and a component that reached for
    // measurement primitives of its own is the shape a second copy starts as.
    const taken: Omit<Measurement, "report" | "unmeasured"> = {
      at,
      frameWidth: frame.clientWidth,
      frameHeight: frame.clientHeight,
    };

    let framedDocument: Document | null = null;
    try {
      framedDocument = frame.contentDocument;
    } catch (reason) {
      setMeasurement({ ...taken, report: null, unmeasured: String(reason) });
      return;
    }
    // Two different nothings, and neither is zero violations: a frame this page
    // is not allowed to read, and a frame that has not produced a document tree
    // yet. Both are named; neither is measured.
    const root = framedDocument === null ? null : framedDocument.documentElement;
    if (framedDocument === null || root === null) {
      setMeasurement({
        ...taken,
        report: null,
        unmeasured: "the frame has not produced a document this page can read",
      });
      return;
    }

    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;

    try {
      setMeasurement({ ...taken, report: measureLawsIn(framedDocument), unmeasured: null });
    } catch (reason) {
      setMeasurement({ ...taken, report: null, unmeasured: String(reason) });
    }
  }, [route, width, theme]);

  /**
   * Re-measure whenever a coordinate moves, after the browser has laid out.
   *
   * A width change does not reload the frame — it resizes its viewport, and the
   * document inside reflows — so the load event will not fire and the numbers
   * on the screen would otherwise belong to the previous width. The frame is
   * asked in the next animation frame, once that reflow has happened.
   */
  useEffect(() => {
    if (route === null) return;
    const handle = requestAnimationFrame(() => measure());
    return () => cancelAnimationFrame(handle);
  }, [measure, route]);

  if (route === null) {
    return (
      <section className="track rv-thing" data-track="the-thing-itself">
        <h2 className="rv-track-head">The thing itself</h2>
        <p className="quiet" data-no-frameable>
          Nothing this epic changed is a screen this room can put in a frame.
        </p>
        <Unframeable entries={unframeable} />
      </section>
    );
  }

  return (
    <section className="track rv-thing" data-track="the-thing-itself">
      <h2 className="rv-track-head">The thing itself</h2>

      <div className="rv-picks">
        <Pick
          legend="route"
          name="route"
          options={framed.map((entry) => [entry.path, entry.path])}
          chosen={route}
          onPick={setRoute}
        />
        <Pick
          legend="width"
          name="width"
          options={WIDTHS.map((option) => [String(option), `${option}px`])}
          chosen={String(width)}
          onPick={(picked) => setWidth(Number(picked))}
        />
        <Pick
          legend="theme"
          name="theme"
          options={THEMES.map((option) => [option, option])}
          chosen={theme}
          onPick={(picked) => setTheme(picked as Theme)}
        />
        <button
          type="button"
          className="rv-remeasure"
          data-remeasure
          onClick={measure}
          // A room fetches its own document after it loads, so the sweep that
          // runs at load measures a room that is still arriving. The control
          // says what it does and does nothing else: it reaches no route, and
          // it changes nothing but this page's numbers.
        >
          Measure again
        </button>
      </div>

      {/* The frame is the widest thing on screen (§ The review room), so when
          the chosen width is wider than the room the holder scrolls rather than
          the page: § Stage sanctions a scroller around something that is
          genuinely too big, and a room that scrolled sideways would be breaking
          the very law measured inside it (FR-011). */}
      <div className="rv-screen" data-screen>
        <iframe
          ref={frameRef}
          className="rv-render"
          data-render
          data-render-route={route}
          data-render-width={width}
          data-render-theme={theme}
          title={`${route} at ${width}px in ${theme}`}
          src={route}
          style={{ width: `${width}px`, height: `${FRAME_HEIGHT}px` }}
          onLoad={measure}
        />
      </div>

      <LawReadout measurement={measurement} />
      <Unframeable entries={unframeable} />
    </section>
  );
}

/**
 * One closed set of choices, as buttons.
 *
 * Buttons and not a `<select>`: `DESIGN.md` has no dropdown in its vocabulary,
 * and the Showfloor set this room's precedent when 005 US4 gave the node card a
 * selecting `<button>` — a control that *selects* is not the verb constitution
 * I is about, which is what reaches the factory. Nothing here reaches anything.
 */
function Pick({
  legend,
  name,
  options,
  chosen,
  onPick,
}: {
  legend: string;
  name: string;
  options: Array<[string, string]>;
  chosen: string;
  onPick: (picked: string) => void;
}): JSX.Element {
  return (
    <div className="rv-pick" data-pick={name}>
      <span className="rv-pick-legend micro">{legend}</span>
      {options.map(([value, label]) => (
        <button
          type="button"
          key={value}
          className="rv-option"
          data-option={value}
          data-chosen={value === chosen}
          aria-pressed={value === chosen}
          onClick={() => onPick(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** The routes the frame will not take, listed with the reason (FR-003's rule). */
function Unframeable({ entries }: { entries: Array<[ReviewRoute, string]> }): JSX.Element | null {
  if (entries.length === 0) return null;
  return (
    <div className="rv-unframeable" data-unframeable>
      <p className="rv-unframeable-head micro">not rendered in the frame</p>
      <ul>
        {entries.map(([route, why]) => (
          <li key={route.path} data-unframeable-route={route.path}>
            <span className="num">{route.path}</span>{" "}
            <span className="unknown">{why}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
