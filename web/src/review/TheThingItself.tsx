/**
 * The room's centre track: the thing itself, beside its measured numbers.
 *
 * Spec 011 US2, FR-007 and FR-008. A route from the what-changed track renders
 * in a **same-origin frame** at a width and a theme the operator picks, and the
 * four layout laws are measured *inside that frame* from this document, with the
 * figures rendered beside it.
 *
 * ── the mechanism, and why it is not Playwright (D-023, plan D1) ───────────
 *
 * The operator asked for a browser session driving the changed routes. The
 * substitution is that **the operator's own browser is the browser**. Nothing
 * here spawns a process, opens a window, drives a page or reaches a URL of its
 * own: it renders this pane's own routes, in a frame, in the tab the operator is
 * already looking at — which is already rendering this origin and already
 * trusted with everything the pane shows. There is no new credential surface and
 * nothing for a leaked token to spawn.
 *
 * Two rules follow and neither is negotiable. **The frame is same-origin or the
 * sweep cannot read it**, so the route set is the manifest's own and no URL is
 * ever accepted from anywhere else. And **a frame that will not load is a
 * finding about the route, not an obstacle**: the room shows what the service
 * does, including a 404, and never relaxes a policy to make something render.
 *
 * ── the measurement is the point, not the picture (plan D2) ────────────────
 *
 * The two manual reviews earned this room by reporting `235px of graph hidden at
 * 1280`, `US4 fully invisible`, `scrollbar height 0px` — not by reporting that
 * the graph looked cut off. So the numbers are shown, all of them, and the
 * measurement is the *same code the gate runs*: `measureLawsIn` from
 * `./laws`, handed the frame's own document. A second implementation would be a
 * second answer to the same question, and the two would disagree.
 *
 * ── what a failed measurement is ───────────────────────────────────────────
 *
 * A read this room could not make, named as one (constitution III). A frame
 * whose document cannot be reached, or a browser that cannot answer one of the
 * laws' questions, is reported in place — never a report of zero violations,
 * which is what a swallowed error would look like and would be the most
 * expensive lie this room could tell.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReviewRoute } from "../api/reviewDocument";
import { measureLawsIn } from "./laws";
import type { LawReport } from "./laws";

/**
 * The widths the operator may pick, and the first is the default.
 *
 * 1280 leads because it is the width both manual reviews were taken at and the
 * width every defect they found was found at. The other three are the ones
 * `showfloor.spec.ts` and `desk.spec.ts` already sweep, so a number the room
 * reports and a number the gate reports are about the same layout.
 */
export const WIDTHS = [1280, 1600, 2560, 960] as const;

/** The two themes `DESIGN.md` renders, and the room renders both with equal care. */
export const THEMES = ["light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

/**
 * The frame's height, fixed and not offered as a control.
 *
 * 900px, the height the smoke suite sweeps at. Height is not one of a note's
 * coordinates (US3 records story, route, width, theme and the figures), so a
 * control for it would be a knob whose setting nothing records — and the four
 * laws are about the horizontal axis, which is the one that has bitten.
 */
const FRAME_HEIGHT = 900;

/**
 * How long the frame's document must stand still before it is measured.
 *
 * Long enough that a room rendering itself — a read returning, a list
 * filling, a graph laying out — is measured once when it is done rather than
 * a dozen times on the way; short enough that the numbers follow the width
 * the operator just picked while their hand is still on the control.
 */
const SETTLE_MS = 120;

/** What the room could not do, when it could not measure. */
interface Unmeasured {
  reason: string;
}

/**
 * The four laws over one frame, plus the two figures a reader wants first.
 *
 * `hidden` is the number the 2026-08-25 review led with: how much of the
 * document is past the right edge of the frame at this width. It is derived
 * here, once, rather than left to the reader to subtract.
 */
export function hiddenPast(report: LawReport): number {
  return Math.max(0, Math.round(report.documentScrollWidth - report.viewport));
}

/**
 * The frame's document, once there is one to read.
 *
 * A frame that has not been given a document yet answers `contentDocument` with
 * something that has no root element in it — which is not a failure and must not
 * be reported as one. There is simply nothing to dress and nothing to measure
 * until the browser has put a document there.
 */
function rendered(element: HTMLIFrameElement): Document | null {
  const doc = element.contentDocument;
  if (doc === null || doc.documentElement === null) return null;
  return doc;
}


/** One law, its name, and the figure standing behind it. */
function Law({
  name,
  law,
  findings,
}: {
  name: string;
  law: string;
  findings: string[];
}): JSX.Element {
  return (
    <div className="rv-law" data-law={law} data-violations={findings.length}>
      <span className="rv-law-name">{name}</span>
      <span className="rv-law-figure num">{findings.length}</span>
      {findings.length === 0 ? null : (
        <ul className="rv-law-findings">
          {findings.map((finding) => (
            <li className="num" key={finding}>
              {finding}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One measured figure with its unit, in the ramp's micro step. */
function Figure({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}): JSX.Element {
  return (
    <div className="rv-figure" data-figure={label}>
      <span className="micro rv-figure-label">{label}</span>
      <span className="rv-figure-value num">
        {value}
        {unit}
      </span>
    </div>
  );
}

/**
 * The measured numbers, beside the frame (FR-008).
 *
 * Exported so a unit test can render it over a constructed report: the numbers a
 * browser produces are the smoke suite's to assert, and what this file owes is
 * that every one of them reaches the screen rather than being collapsed into a
 * tick. § The review room: *"a measured number is shown, never only a verdict."*
 */
export function Measured({
  report,
  width,
  theme,
}: {
  report: LawReport;
  width: number;
  theme: Theme;
}): JSX.Element {
  return (
    <section className="rv-measured" data-measured data-width={width} data-theme={theme}>
      <h3 className="rv-measured-head">Measured in the frame</h3>

      <div className="rv-figures">
        <Figure label="frame" value={report.viewport} unit="px" />
        <Figure label="document" value={report.documentScrollWidth} unit="px" />
        <Figure label="hidden past the edge" value={hiddenPast(report)} unit="px" />
        <Figure label="text leaves" value={report.leaves} unit="" />
        <Figure label="painters" value={report.painters} unit="" />
      </div>

      <div className="rv-laws">
        <Law name="outside its stage" law="a" findings={report.escaped} />
        <Law name="past the right edge" law="b" findings={report.past} />
        <Law name="overlapping text" law="c" findings={report.overlapping} />
        <Law name="painted over text" law="d" findings={report.occluded} />
      </div>

      <p className="rv-measured-foot micro" data-room-scrolls={report.roomScrollsSideways}>
        room scrolls sideways: {report.roomScrollsSideways ? "yes" : "no"}
      </p>
    </section>
  );
}

interface Props {
  routes: ReviewRoute[];
  specDir: string;
}

/**
 * The centre track: pick a route, a width and a theme; look at it; read the
 * numbers.
 *
 * Only a `room` route is offered. An `api` route is a document and a `shell`
 * route is the catch-all that serves the rooms — neither is a screen an operator
 * reviews, and offering one would be the room inviting a reader to review JSON.
 */
export default function TheThingItself({ routes, specDir }: Props): JSX.Element {
  const rooms = routes.filter((route) => route.kind === "room");
  const [selected, setSelected] = useState<string | null>(null);
  const [width, setWidth] = useState<number>(WIDTHS[0]);
  const [theme, setTheme] = useState<Theme>(THEMES[0]);
  const [report, setReport] = useState<LawReport | null>(null);
  const [unmeasured, setUnmeasured] = useState<Unmeasured | null>(null);
  // Bumped by the frame's `load`, which is the only moment its document is
  // replaced by another one: every observer below is bound to *that* document
  // and has to be rebound when it goes.
  const [generation, setGeneration] = useState(0);
  const frame = useRef<HTMLIFrameElement | null>(null);

  const route = selected ?? (rooms.length > 0 ? rooms[0].path : null);

  /**
   * Read the frame's document. Nothing else — this function must not touch it.
   *
   * The separation is load-bearing and was paid for. The measurement re-runs
   * whenever the frame's document changes, and a measurement that also *wrote*
   * to that document (the theme attribute, say) would be its own trigger: it
   * would schedule itself forever, at whatever interval the debounce below
   * happened to be. Dressing the frame is `dress`, once per theme; reading it is
   * this, as often as the document moves.
   */
  const measure = useCallback(() => {
    const element = frame.current;
    if (element === null) return;
    try {
      const doc = rendered(element);
      if (doc === null) {
        setReport(null);
        setUnmeasured({ reason: "the frame's document could not be reached" });
        return;
      }
      setReport(measureLawsIn(doc));
      setUnmeasured(null);
    } catch (failure) {
      setReport(null);
      setUnmeasured({ reason: String(failure) });
    }
  }, []);

  /**
   * Dress the frame in the chosen theme.
   *
   * An attribute on the frame document's own root, because that is how
   * `global.css` lets an explicit choice beat `prefers-color-scheme` —
   * `:root[data-theme="dark"]`. Setting it here rather than passing it in the
   * URL keeps the frame's address exactly the route the operator picked, which
   * is the address a note will record (US3).
   *
   * Same-origin, so this is an ordinary DOM write to a document this browser
   * already has. Nothing on disk moves: FR-014 is about the pane writing files,
   * and the pane writes none.
   */
  useEffect(() => {
    const doc = frame.current === null ? null : rendered(frame.current);
    if (doc === null) return;
    doc.documentElement.setAttribute("data-theme", theme);
    doc.documentElement.style.colorScheme = theme;
  }, [theme, generation]);

  /**
   * Measure the frame whenever the frame settles, and not a moment before.
   *
   * **Two defects paid for this, and both were the same mistake.** Measuring on
   * the frame's `load` reported `1` text leaf: `load` fires when the document
   * has loaded, and the room inside it renders after its own read returns, so
   * the numbers were of an empty shell. Measuring on the parent's
   * `ResizeObserver` reported the previous width under the new width's label:
   * the frame's box had changed but the document inside it had not yet been laid
   * out again.
   *
   * Both are answered by asking the *frame's own document* when it moved, which
   * it can be asked because it is same-origin — and by taking that answer after
   * a short settle rather than on the first sign of it. `resize` on the frame's
   * own window fires once its layout is the new one; a `MutationObserver` over
   * its tree fires when the room inside finishes rendering, and again whenever a
   * live update changes it. Both are debounced into one measurement, so a page
   * with a clock in it is measured once per settle rather than once per tick.
   */
  useEffect(() => {
    const doc = frame.current === null ? null : rendered(frame.current);
    const view = doc?.defaultView ?? null;
    if (doc === null || view === null) return;

    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, SETTLE_MS);
    };

    measure();
    view.addEventListener("resize", schedule);
    const mutations = new MutationObserver(schedule);
    mutations.observe(doc.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });

    return () => {
      window.clearTimeout(timer);
      view.removeEventListener("resize", schedule);
      mutations.disconnect();
    };
  }, [measure, generation]);

  if (route === null) {
    return (
      <section className="track rv-thing" data-track="the-thing-itself">
        <h2 className="rv-track-head">The thing itself</h2>
        <p className="quiet" data-no-route>
          Nothing this epic changed reaches a screen this pane serves, so there is
          nothing to render. The what-changed track says which files those were.
        </p>
      </section>
    );
  }

  return (
    <section className="track rv-thing" data-track="the-thing-itself">
      <h2 className="rv-track-head">The thing itself</h2>

      <div className="rv-controls" data-controls>
        <div className="rv-control" data-control="route">
          <span className="micro rv-control-label">route</span>
          {rooms.map((room) => (
            <button
              type="button"
              key={room.path}
              className="rv-pick num"
              data-route-pick={room.path}
              aria-pressed={room.path === route}
              onClick={() => setSelected(room.path)}
            >
              {room.path}
            </button>
          ))}
        </div>

        <div className="rv-control" data-control="width">
          <span className="micro rv-control-label">width</span>
          {WIDTHS.map((candidate) => (
            <button
              type="button"
              key={candidate}
              className="rv-pick num"
              data-width-pick={candidate}
              aria-pressed={candidate === width}
              onClick={() => setWidth(candidate)}
            >
              {candidate}px
            </button>
          ))}
        </div>

        <div className="rv-control" data-control="theme">
          <span className="micro rv-control-label">theme</span>
          {THEMES.map((candidate) => (
            <button
              type="button"
              key={candidate}
              className="rv-pick"
              data-theme-pick={candidate}
              aria-pressed={candidate === theme}
              onClick={() => setTheme(candidate)}
            >
              {candidate}
            </button>
          ))}
        </div>
      </div>

      <div className="rv-thing-body">
        {/* § The review room: "the frame is furniture, and it is the widest
            thing on screen"; the scroller is what keeps a 2560px frame from
            taking the room sideways with it, which is law (b) on this room. */}
        <div className="rv-frame-scroll" data-frame-scroll>
          <iframe
            ref={frame}
            className="rv-render"
            data-render-frame
            data-render-route={route}
            data-render-width={width}
            data-render-theme={theme}
            title={`${route} at ${width}px in ${theme}, for ${specDir}`}
            src={route}
            width={width}
            height={FRAME_HEIGHT}
            onLoad={() => setGeneration((n) => n + 1)}
          />
        </div>

        {report === null ? (
          <section className="rv-measured" data-measured="none">
            <h3 className="rv-measured-head">Measured in the frame</h3>
            {unmeasured === null ? (
              <p className="quiet">Rendering…</p>
            ) : (
              <div className="degraded" data-mode="transport" role="status">
                <p className="lead">The frame could not be measured.</p>
                <p>
                  <span className="detail">{unmeasured.reason}</span>. Shown as
                  unavailable, not as zero violations.
                </p>
              </div>
            )}
          </section>
        ) : (
          <Measured report={report} width={width} theme={theme} />
        )}
      </div>
    </section>
  );
}
