/**
 * The review room (011 US1, D-023, `DESIGN.md` § The review room).
 *
 * The second HITL surface: an epic lands, and the operator opens
 * `/review/<spec-dir>` to read what it changed and which screens those changes
 * reach. US1 built the first of the room's three tracks — what changed — and
 * US2 adds the second: the thing itself, rendered in a same-origin frame at a
 * width and theme the operator picks, beside the four layout laws measured
 * inside it. US3 adds the third and last, the notes — and with it the room's
 * output, a captured-TBD spec composed in the browser and handed over. The room
 * still writes nothing: not a file, not a directory, not a spec (FR-014).
 *
 * **The live view crosses here and only here.** A note's coordinates are four
 * parts the centre track holds — route, width, theme, the measured numbers —
 * and one the notes track holds, the story. So the centre track reports what it
 * is looking at, this component keeps it, and the notes track freezes a copy at
 * capture. A notes track that measured the frame for itself would be a second
 * answer to the question the centre track already answered, and the two would
 * disagree (plan D2).
 *
 * **The served revision is a header on every render** (FR-009). The room
 * reviews the running service, so the one thing an operator cannot otherwise
 * know is whether the screens in front of them were built from the epic they
 * came to review. It is above the tracks on the document, on the refusal and on
 * nothing else the room can answer — because those are the two answers an
 * operator is actually looking at a served screen in.
 *
 * **The room reaches nothing but this pane's own document.** One bare GET of
 * `/api/review/<spec-dir>`, behind the same bearer token as every other route
 * (FR-006) — no subprocess, no browser it drives, no URL of its own, and no
 * write of any kind. That is D-023's whole safety argument and it starts here.
 *
 * **Four answers, four renders.** A document is an epic the branch carries
 * whole. A refusal is an epic it does not, and the room says which stories have
 * not merged and stops — a review of half an epic is a review of nothing
 * (FR-004). A miss is a directory this corpus does not have. A read that did not
 * complete is named as one. None of the four is ever rendered as another.
 */

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Masthead from "../Masthead";
import { readReview } from "../api/reviewDocument";
import type { ReviewAnswer } from "../api/reviewDocument";
import { specDirFromReviewPath } from "../routes";
import Notes from "./Notes";
import type { ReviewView } from "./notes";
import { RevisionMismatch, ServedHeader } from "./ServedRevision";
import TheThingItself from "./TheThingItself";
import WhatChanged from "./WhatChanged";

interface FrameProps {
  // `ReactNode` since 011 US2: the header is conditional on the refusal render,
  // and a room that could not hold a `null` child would have to draw an empty
  // element instead — the first thing § Don't names.
  children: ReactNode;
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
  // The live view, as the centre track reports it. `setView` is React's own
  // setter and therefore stable, which is what keeps the report from being its
  // own trigger: a fresh callback each render would re-fire the effect that
  // calls it, forever.
  const [view, setView] = useState<ReviewView | null>(null);

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
        {answer.refusal.served === null ? null : (
          <ServedHeader served={answer.refusal.served} />
        )}
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
      <ServedHeader served={answer.document.served} />
      <main id="room" className="rv-cols" data-spec-dir={answer.document.spec_dir}>
        <header className="rv-head">
          <h1 className="rv-name">{answer.document.name}</h1>
          <p className="rv-dir micro">{answer.document.spec_dir}</p>
        </header>
        {/* FR-010: above the frame, full width, and before anything the
            operator might otherwise start reading as if it were the epic. */}
        <RevisionMismatch
          served={answer.document.served}
          specName={answer.document.name}
        />
        <div className="rv-tracks" data-tracks>
          <WhatChanged review={answer.document} />
          <TheThingItself
            routes={answer.document.routes}
            specDir={answer.document.spec_dir}
            onView={setView}
          />
          <Notes
            specDir={answer.document.spec_dir}
            epicName={answer.document.name}
            stories={answer.document.stories}
            served={answer.document.served}
            view={view}
          />
        </div>
      </main>
    </Frame>
  );
}
