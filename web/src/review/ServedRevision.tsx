/**
 * What this pane is actually serving, said twice (011 US2: FR-009, FR-010).
 *
 * The review room reviews the **running service**. It builds no branch, drives
 * no browser and renders no screenshot of one (D-023) — the frame shows what
 * this process is serving right now. Which makes one fact load-bearing for
 * every number on the screen: *is this process standing on a revision that
 * carries the epic under review?* If it is not, the operator is measuring a
 * different surface from the one they think they are looking at, and every note
 * they take is about something else.
 *
 * `DESIGN.md` § The review room decides how it is said, and it says it twice on
 * purpose:
 *
 * > **The served revision is a header, not a footnote.** Micro uppercase over a
 * > hairline at the top of the view, always present. When the served revision
 * > does not contain the epic under review, the statement takes a full-width
 * > band above the frame in the room's warning face — not a chip, not a
 * > tooltip. Every note taken under a mismatch is about something else, and the
 * > reviewer must not be able to miss it.
 *
 * So `ServedStamp` is the header and renders on every document; `RevisionBand`
 * is the band and renders only when the revision measurably does not carry the
 * epic. Gold, not alarm: § Colors gives gold to "waiting on the operator",
 * which is exactly what this is — nothing has failed, and the operator has a
 * decision to make before the notes are worth taking.
 *
 * **Three states, and the third is not the second.** Carried, measurably not
 * carried, and not settled by the reads. An unknown is rendered as the word
 * unknown (constitution III's Unknown Rule) and never as a mismatch: a room
 * that raised this alarm without measuring it would be the one lie that costs
 * the alarm its meaning.
 */

import type { ServedRevision } from "../api/reviewDocument";

/** The three words the header ends on, one per value of `contains_epic`. */
function verdict(served: ServedRevision): string {
  if (served.revision === null) return "revision unknown";
  if (served.contains_epic === true) return "carries this epic";
  if (served.contains_epic === false) return "does not carry this epic";
  return "whether it carries this epic is unknown";
}

/**
 * The header: micro uppercase over a hairline, at the top of the view, always.
 *
 * "Always" includes the case where the revision would not read. A header that
 * disappeared when the read failed would leave the operator with no way to tell
 * a service standing in the right place from one the pane could not ask.
 */
export function ServedStamp({ served }: { served: ServedRevision }): JSX.Element {
  return (
    <p
      className="rv-served micro"
      data-served
      data-contains={
        served.revision === null ? "unknown" : String(served.contains_epic ?? "unknown")
      }
    >
      <span className="rv-served-label">Serving</span>{" "}
      {served.revision === null ? (
        <span className="unknown" data-unknown="served revision">
          revision unknown
        </span>
      ) : (
        <span className="num" data-revision={served.revision}>
          {served.short_revision}
        </span>
      )}
      {served.branch === null ? null : (
        <>
          {" · "}
          <span className="num" data-branch={served.branch}>
            {served.branch}
          </span>
        </>
      )}
      {" · "}
      <span className="rv-served-verdict">{verdict(served)}</span>
    </p>
  );
}

/**
 * The band: full width, above the frame, in the room's warning face (FR-010).
 *
 * It renders for one condition only — a revision the room **measured** as not
 * carrying at least one of the epic's landings. The stories are named, not
 * counted: which ones are missing is precisely what decides whether a note the
 * operator is about to take means anything.
 */
export function RevisionBand({ served }: { served: ServedRevision }): JSX.Element | null {
  if (served.contains_epic !== false) return null;

  const missing = served.missing;
  return (
    <div className="rv-mismatch" data-mismatch role="status">
      <p className="lead">
        This pane is not serving the epic you are reviewing.
      </p>
      <p>
        The revision it is standing on —{" "}
        <span className="num" data-revision={served.revision}>
          {served.short_revision}
        </span>
        {served.branch === null ? null : (
          <>
            {" on "}
            <span className="num">{served.branch}</span>
          </>
        )}{" "}
        — does not carry{" "}
        {missing.map((storyKey, index) => (
          <span key={storyKey}>
            {index === 0 ? "" : index === missing.length - 1 ? " and " : ", "}
            <span className="num" data-missing={storyKey}>
              {storyKey}
            </span>
          </span>
        ))}
        . What renders in the frame below is a different surface from the one
        that work built, so a note taken here is about something else.
      </p>
      {served.unplaced.length === 0 ? null : (
        <p>
          And{" "}
          {served.unplaced.map((storyKey, index) => (
            <span key={storyKey}>
              {index === 0 ? "" : ", "}
              <span className="num" data-unplaced={storyKey}>
                {storyKey}
              </span>
            </span>
          ))}{" "}
          could not be placed on this revision at all.
        </p>
      )}
    </div>
  );
}
