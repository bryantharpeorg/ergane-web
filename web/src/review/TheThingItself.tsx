/**
 * The thing itself: a changed route, rendered and measured (011 US2).
 *
 * **The operator's own browser is the browser** (D-023, plan D1). The room
 * renders one of the routes US1 resolved in a **same-origin frame**, at a width
 * and in a theme the operator picks, and runs the four layout laws inside that
 * frame from this document. The pane spawns no process, drives no browser,
 * reaches no URL of its own and writes no file — all four of the questions a
 * Playwright session in the pane's process would have opened are answered by not
 * being asked. A node that adds a headless browser here to satisfy a scenario
 * has reintroduced every one of them, which is why the plan makes it a stop and
 * ask rather than a judgement call.
 *
 * **Same-origin is not a detail, it is the mechanism.** The sweep reads the
 * frame's `contentDocument` directly; a cross-origin document would answer
 * `null` and there would be nothing to measure. So the frame's `src` is always
 * one of this pane's own room paths, taken from the document the backend
 * assembled — never a URL the operator typed, and never anything derived in the
 * browser. There is no input in this room for one to be typed into, and
 * `tests/unit/noVerb.test.ts` is what keeps it that way.
 *
 * **The measurement is `measureLawsIn`, not a second copy of it** (plan D2).
 * The numbers this panel shows are the numbers that reported "235px of graph
 * hidden at 1280, US4 fully invisible, scrollbar height 0px" on 2026-08-25 and
 * that the smoke suite asserts against on every gate run. A second
 * implementation of the four laws is a second answer to the same question, and
 * the two will disagree on the day it matters.
 *
 * **The controls select; they do not act.** Three groups of buttons — route,
 * width, theme — and every one of them changes what this browser is looking at
 * and nothing else. No request leaves the page when one is pressed; the room's
 * one read is US1's document, made once. That is the same shape the Showfloor's
 * node card has carried since 005 US4, and it is why constitution I's one verb
 * is still the Desk's.
 */

import { useEffect, useRef, useState } from "react";

import type { ReviewDocument, ReviewRoute } from "../api/reviewDocument";
import Measured from "./Measured";
import { FRAME_THEMES, FRAME_WIDTHS, measureLawsIn } from "./laws";
import type { Measurement, Theme } from "./laws";

/** The frame's height, fixed: the width is the operator's variable, not this. */
const FRAME_HEIGHT = 900;

/** Only a room can be looked at; an `api` or `shell` route has nothing to see. */
function rooms(review: ReviewDocument): ReviewRoute[] {
  return review.routes.filter((route) => route.kind === "room");
}

export default function TheThingItself({
  review,
}: {
  review: ReviewDocument;
}): JSX.Element {
  const reachable = rooms(review);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const [route, setRoute] = useState<string | null>(
    reachable.length > 0 ? reachable[0].path : null,
  );
  const [width, setWidth] = useState<number>(FRAME_WIDTHS[0]);
  const [theme, setTheme] = useState<Theme>("light");
  /** The path the frame has actually finished loading, read from the frame. */
  const [loaded, setLoaded] = useState<string | null>(null);
  /** Bumped on every load, so a re-render of the same path measures again. */
  const [loads, setLoads] = useState(0);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);

  useEffect(() => {
    if (route === null) return;
    // Measuring before the frame holds the route that is selected would label
    // the previous screen's numbers with this screen's coordinates, which is
    // the one way this panel could lie without anything looking wrong.
    if (loaded !== route) {
      setMeasurement(null);
      return;
    }
    const frameDocument = frameRef.current?.contentDocument ?? null;
    if (frameDocument === null) {
      setMeasurement(null);
      return;
    }

    // The theme is the operator's, applied to the frame's own root: `data-theme`
    // is the mechanism `styles/global.css` § Colors already declares, and an
    // explicit choice beats the operating system's in both directions.
    frameDocument.documentElement.setAttribute("data-theme", theme);

    // Two frames before reading a box. The width lands on the iframe element in
    // this document, and the frame's own layout follows it one paint later; a
    // measurement taken in between reports the previous width's geometry under
    // the new width's label.
    let cancelled = false;
    let handle = 0;
    const settle = (remaining: number) => {
      if (cancelled) return;
      if (remaining > 0) {
        handle = requestAnimationFrame(() => settle(remaining - 1));
        return;
      }
      const settled = frameRef.current?.contentDocument ?? null;
      if (settled === null) return;
      setMeasurement({ route, width, theme, report: measureLawsIn(settled) });
    };
    handle = requestAnimationFrame(() => settle(1));
    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
    };
  }, [route, width, theme, loaded, loads]);

  function frameLoaded(): void {
    const frame = frameRef.current;
    // Same-origin, so the frame can be asked what it is showing rather than
    // told: `src` is what was requested and this is what answered.
    const path = frame?.contentWindow?.location.pathname ?? null;
    setLoaded(path);
    setLoads((previous) => previous + 1);
  }

  if (route === null) {
    // § Don't: "don't render an element that can never fill". An epic whose
    // changed files reach no room has nothing to look at, and a frame held open
    // over that is furniture pretending to be evidence.
    return (
      <section className="track rv-thing" data-track="the-thing-itself">
        <h2 className="rv-track-head">The thing itself</h2>
        <p className="quiet" data-no-room>
          Nothing this epic changed reaches a screen. Its {review.routes.length}{" "}
          {review.routes.length === 1 ? "route is" : "routes are"} documents and
          the guarded shell, which have no render to look at.
        </p>
      </section>
    );
  }

  return (
    <section className="track rv-thing" data-track="the-thing-itself">
      <h2 className="rv-track-head">The thing itself</h2>

      <div className="rv-picks">
        <div className="rv-pick" data-pick="route">
          <span className="rv-pick-label micro">Route</span>
          <span className="rv-pick-options">
            {reachable.map((option) => (
              <button
                type="button"
                key={option.path}
                className="rv-chip num"
                data-route-choice={option.path}
                aria-pressed={option.path === route}
                onClick={() => setRoute(option.path)}
              >
                {option.path}
              </button>
            ))}
          </span>
        </div>

        <div className="rv-pick" data-pick="width">
          <span className="rv-pick-label micro">Width</span>
          <span className="rv-pick-options">
            {FRAME_WIDTHS.map((option) => (
              <button
                type="button"
                key={option}
                className="rv-chip num"
                data-width-choice={option}
                aria-pressed={option === width}
                onClick={() => setWidth(option)}
              >
                {option} px
              </button>
            ))}
          </span>
        </div>

        <div className="rv-pick" data-pick="theme">
          <span className="rv-pick-label micro">Theme</span>
          <span className="rv-pick-options">
            {FRAME_THEMES.map((option) => (
              <button
                type="button"
                key={option}
                className="rv-chip num"
                data-theme-choice={option}
                aria-pressed={option === theme}
                onClick={() => setTheme(option)}
              >
                {option}
              </button>
            ))}
          </span>
        </div>
      </div>

      {/* The frame is the widest thing in the room and nothing overlays it
          (§ The review room). A width past the room's own measure scrolls this
          wrapper rather than the page: § Layout sanctions a scroller that is
          itself on screen, and a room that took the document sideways would be
          breaking the law it is here to measure. */}
      <div className="rv-frame-scroll" data-frame-scroll>
        <iframe
          ref={frameRef}
          className="rv-render"
          title={`${route}, rendered at ${width} px in the ${theme} theme`}
          src={route}
          style={{ width: `${width}px`, height: `${FRAME_HEIGHT}px` }}
          data-rendered-route={route}
          data-rendered-width={width}
          data-rendered-theme={theme}
          data-loaded-route={loaded ?? ""}
          onLoad={frameLoaded}
        />
      </div>

      <Measured
        measurement={measurement}
        pending={
          loaded === route
            ? "Laying the frame out at this width…"
            : `Loading ${route} in the frame…`
        }
      />
    </section>
  );
}
