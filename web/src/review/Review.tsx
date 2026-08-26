/**
 * The review room (011 US1, D-023, `DESIGN.md` § The review room).
 *
 * The second HITL surface: an epic lands, and the operator opens
 * `/review/<spec-dir>` to read what it changed and which screens those changes
 * reach. US1 built the first of the room's three tracks — what changed — and
 * **US2 adds the second, the thing itself**: one of those screens rendered in a
 * same-origin frame at a width and in a theme the operator picks, with the four
 * layout laws measured inside that frame and their numbers beside it. The third
 * track, the notes, is US3's, and nothing is drawn here for it: an element that
 * can never fill is the one thing § Do's and Don'ts names first.
 *
 * **The room reaches nothing but this pane's own document.** One bare GET of
 * `/api/review/<spec-dir>`, behind the same bearer token as every other route
 * (FR-006) — no subprocess, no browser it drives, no URL of its own, and no
 * write of any kind. That is D-023's whole safety argument and it starts here.
 * The frame is the same argument continued: it renders this pane's own routes,
 * from this origin, in the browser the operator already has open.
 *
 * **And the room says which tree it is showing** (FR-009, FR-010). It reviews
 * the *running service*, which may not be serving the revision the epic landed
 * in — so the served revision is a header on every render, and a revision that
 * does not carry the epic takes a band above the frame. Every note taken under
 * a mismatch is about something else.
 *
 * **Four answers, four renders.** A document is an epic the branch carries
 * whole. A refusal is an epic it does not, and the room says which stories have
 * not merged and stops — a review of half an epic is a review of nothing
 * (FR-004). A miss is a directory this corpus does not have. A read that did not
 * complete is named as one. None of the four is ever rendered as another.
 */

import { useEffect, useState } from "react";
import Masthead from "../Masthead";
import { readReview } from "../api/reviewDocument";
import type { ReviewAnswer } from "../api/reviewDocument";
import { specDirFromReviewPath } from "../routes";
import { Mismatch, Stamp } from "./ServedRevision";
import TheThingItself from "./TheThingItself";
import WhatChanged from "./WhatChanged";

interface FrameProps {
  children: JSX.Element | JSX.Element[];
}

/** § Layout's app frame: the appbar, then the room, inside one capped card. */
function Frame({ children }: FrameProps): JSX.Element {
  return (
    <div data-review-root className="review">
      <div className="rv-frame" data-review-frame>
        <Masthead />
        {children}
      </div>
    </div>
  );
}

export default function Review(): JSX.Element {
  const specDir = specDirFromReviewPath(window.location.pathname);
  const [answer, setAnswer] = useState<ReviewAnswer | null>(null);

  useEffect(() => {
    if (specDir === null) return;
    let cancelled = false;
    void readReview(specDir).then((next) => {
      if (!cancelled) setAnswer(next);
    });
    return () => {
      cancelled = true;
    };
  }, [specDir]);

  // A bare `/review` names no epic. The room is scoped to one landed epic by
  // construction (FR-004), so there is no default to fall back to and none is
  // invented: the room says what it is for and what it needs.
  if (specDir === null) {
    return (
      <Frame>
        <main id="room" className="rv-cols" data-review-empty>
          <p className="quiet">
            The review room reads one landed epic at a time. Name it in the
            path — <span className="num">/review/&lt;spec-dir&gt;</span>.
          </p>
        </main>
      </Frame>
    );
  }

  if (answer === null) {
    return (
      <Frame>
        <main id="room" className="rv-cols">
          <p className="quiet">Reading the branch…</p>
        </main>
      </Frame>
    );
  }

  if (answer.kind === "refusal") {
    const named = answer.refusal.unmerged;
    return (
      <Frame>
        <main id="room" className="rv-cols">
          <div className="rv-refusal" data-refusal role="status">
            <p className="lead">
              <span className="num">{answer.refusal.spec_dir}</span> has not landed
              whole, so there is nothing here to review.
            </p>
            <ul className="rv-unmerged">
              {named.map((story) => (
                <li key={story.story_key} data-unmerged={story.story_key}>
                  <span className="num">{story.story_key}</span> {story.title}
                </li>
              ))}
            </ul>
            <p>
              {named.length === 1 ? "That story is" : "Those stories are"} not on{" "}
              <span className="num">
                {answer.refusal.landing_branch ?? "the landing branch"}
              </span>
              . A review of half an epic is a review of a surface that is about to
              change, and the notes it produced could not say which half they were
              about.
            </p>
          </div>
        </main>
      </Frame>
    );
  }

  if (answer.kind === "miss") {
    return (
      <Frame>
        <main id="room" className="rv-cols">
          <p className="quiet" data-miss={answer.specDir}>
            No spec directory <span className="num">{answer.specDir}</span> is in
            this corpus.
          </p>
        </main>
      </Frame>
    );
  }

  if (answer.kind === "unread") {
    return (
      <Frame>
        <main id="room" className="rv-cols">
          <div className="degraded" data-mode="transport" role="status">
            <p className="lead">The review could not be read.</p>
            <p>
              The read{" "}
              <span className="read num">GET /api/review/{specDir}</span> answered{" "}
              <span className="num">{answer.status === 0 ? "nothing" : answer.status}</span>
              . Shown as unavailable, not hidden.
            </p>
          </div>
        </main>
      </Frame>
    );
  }

  return (
    <Frame>
      <main id="room" className="rv-cols" data-spec-dir={answer.document.spec_dir}>
        {/* § The review room: "The served revision is a header, not a footnote…
            at the top of the view, always present" (FR-009), and the mismatch
            band above the frame, where the operator cannot miss it (FR-010). */}
        <Stamp served={answer.document.served} specDir={answer.document.spec_dir} />
        <header className="rv-head">
          <h1 className="rv-name">{answer.document.name}</h1>
          <p className="rv-dir micro">{answer.document.spec_dir}</p>
        </header>
        <Mismatch served={answer.document.served} review={answer.document} />
        <div className="rv-tracks">
          <WhatChanged review={answer.document} />
          <TheThingItself review={answer.document} />
        </div>
      </main>
    </Frame>
  );
}
