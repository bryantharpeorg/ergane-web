/**
 * The served-revision header, and the band a mismatch takes (011 US2).
 *
 * `DESIGN.md` § The review room writes both, and the difference between them is
 * the whole requirement:
 *
 * > **The served revision is a header, not a footnote.** Micro uppercase over a
 * > hairline at the top of the view, always present. When the served revision
 * > does not contain the epic under review, the statement takes a full-width
 * > band above the frame in the room's warning face — not a chip, not a tooltip.
 * > Every note taken under a mismatch is about something else, and the reviewer
 * > must not be able to miss it.
 *
 * **Three answers, three renders, and the third is not the second.**
 * `contains_epic` is `true`, `false` or `null`. A `false` is FR-010's band: the
 * revision on the screen does not carry this epic, and the stories it is missing
 * are named, because a mismatch stated without its particulars is a warning the
 * operator cannot act on. A `null` is a question the backend could not ask — a
 * checkout with no history cannot place a commit — and it renders as the room's
 * ordinary degraded note, not as an alarm. Spending FR-010's band on a read
 * nobody made is how it stops being believed the once it is real.
 *
 * The header is on **every** render, the refusal included: an operator looking
 * at "this epic has not landed whole" is still looking at a screen served by
 * some revision, and the sentence is as true there as anywhere.
 */

import type { ServedRevision as Served } from "../api/reviewDocument";

/** A value the checkout did not supply, named rather than defaulted. */
function Unknown({ what }: { what: string }): JSX.Element {
  return (
    <span className="unknown" data-unknown={what}>
      {what} unknown
    </span>
  );
}

/**
 * The always-present line: which revision this service is serving.
 *
 * Micro uppercase over a hairline, with the revision, the branch and the squash
 * subject as the numerals and identity § Typography gives to mono. Nothing here
 * is a verdict standing in for a fact: the SHA is shown, not a tick.
 */
export function ServedHeader({ served }: { served: Served }): JSX.Element {
  const unknown = new Set(served.unknown);

  return (
    <header className="rv-served" data-served role="status">
      <span className="micro rv-served-label">serving</span>
      {unknown.has("revision") ? (
        <Unknown what="revision" />
      ) : (
        <span className="rv-served-sha num" data-served-revision={served.revision}>
          {served.short_revision}
        </span>
      )}
      {unknown.has("branch") ? null : (
        <span className="rv-served-branch num" data-served-branch={served.branch}>
          {served.branch}
        </span>
      )}
      {unknown.has("subject") ? null : (
        <span className="rv-served-subject">{served.subject}</span>
      )}
      {unknown.has("committed_at") ? null : (
        <span className="rv-served-when num">{served.committed_at}</span>
      )}
      <Containment served={served} />
      {served.notes.map((note) => (
        <span className="rv-served-note" data-mode={note.mode} key={note.read}>
          <span className="read num">{note.read}</span>{" "}
          {note.mode === "transport" ? "did not complete" : "was refused"}
        </span>
      ))}
    </header>
  );
}

/** The header's own verdict, in words, with the count that stands behind it. */
function Containment({ served }: { served: Served }): JSX.Element {
  if (served.contains_epic === null) {
    return (
      <span className="rv-contains" data-contains="unknown">
        <span className="unknown">whether it contains this epic is unknown</span>
      </span>
    );
  }
  if (served.contains_epic) {
    return (
      <span className="rv-contains" data-contains="yes">
        contains this epic
      </span>
    );
  }
  return (
    <span className="rv-contains" data-contains="no">
      does <strong>not</strong> contain{" "}
      <span className="num">{served.missing.length}</span> of this epic&apos;s
      stories
    </span>
  );
}

/**
 * FR-010's band: full width, above the frame, in the room's warning face.
 *
 * Gold and not the alarm face — § Colors gives gold to "waiting on the
 * operator", and that is exactly what this is: nothing has failed, and the
 * operator has to do something (redeploy, or review a different epic) before the
 * screen below is worth reading.
 *
 * Rendered for `false` and for nothing else. `null` is a note in the header
 * above, where an unknown belongs.
 */
export function RevisionMismatch({
  served,
  specName,
}: {
  served: Served;
  specName: string;
}): JSX.Element | null {
  if (served.contains_epic !== false) return null;

  return (
    <div className="rv-mismatch" data-mismatch role="alert">
      <p className="lead">
        You are not looking at this epic. The revision this service is serving —{" "}
        <span className="num">{served.short_revision ?? "unknown"}</span> — does
        not contain{" "}
        <span className="num">{served.missing.length}</span>{" "}
        {served.missing.length === 1 ? "story" : "stories"} of {specName}.
      </p>
      <ul className="rv-missing">
        {served.missing.map((story) => (
          <li key={story.story_key} data-missing={story.story_key}>
            <span className="num">{story.story_key}</span> {story.title}
          </li>
        ))}
      </ul>
      <p>
        Every screen below is rendered from{" "}
        <span className="num">{served.short_revision ?? "an unknown revision"}</span>
        {served.branch === null ? null : (
          <>
            {" "}
            on <span className="num">{served.branch}</span>
          </>
        )}
        , so a note taken here is a note about work this epic did not do. Serve a
        revision that carries it, or review the epic this one carries.
      </p>
    </div>
  );
}
