/**
 * The revision the service is serving (011 US2: FR-009, FR-010).
 *
 * `DESIGN.md` § The review room: "**The served revision is a header, not a
 * footnote.** Micro uppercase over a hairline at the top of the view, always
 * present. When the served revision does not contain the epic under review, the
 * statement takes a full-width band above the frame in the room's warning face —
 * not a chip, not a tooltip. Every note taken under a mismatch is about
 * something else, and the reviewer must not be able to miss it."
 *
 * Two components, because they are two different claims and only one of them is
 * conditional. `Stamp` is the header and renders on every answer, including the
 * one where nothing could be read — a room that fell silent about the revision
 * when it could not name one would be at its least honest exactly when it
 * mattered most. `Mismatch` renders only for `contains_epic === false`, which is
 * the one case where everything else on the screen is about something else.
 *
 * **The three values of `contains_epic` are three sentences, never two.** The
 * room says the revision holds the epic, or that it does not and by what, or
 * that it could not tell. Collapsing the third into either of the others is the
 * defect constitution III exists to prevent, in the one place in this pane where
 * it would silently invalidate everything beside it.
 */

import type { ReviewDocument, ServedRevision } from "../api/reviewDocument";

/** The word this pane uses for a fact the tree did not supply. */
function Unknown({ what }: { what: string }): JSX.Element {
  return (
    <span className="unknown" data-unknown={what}>
      {what} unknown
    </span>
  );
}

/** `true` · `false` · `null` as the attribute the tests and the CSS read. */
function holding(served: ServedRevision): string {
  if (served.contains_epic === null) return "unknown";
  return served.contains_epic ? "yes" : "no";
}

/**
 * The header: which revision is being served, and whether it holds this epic.
 *
 * Always present, and it names the revision in full through `data-revision`
 * while showing the twelve characters an operator compares by eye — the same
 * pair, for the same reason, that a landing SHA is rendered by.
 */
export function Stamp({
  served,
  specDir,
}: {
  served: ServedRevision;
  specDir: string;
}): JSX.Element {
  return (
    <p
      className="rv-served micro"
      data-served
      data-contains={holding(served)}
      data-revision={served.revision ?? ""}
    >
      <span className="rv-served-label">Serving</span>{" "}
      {served.revision === null ? (
        <Unknown what="revision" />
      ) : (
        <span className="rv-served-rev num">{served.short_revision}</span>
      )}
      {served.dirty === true ? (
        <span className="rv-served-dirty" data-dirty>
          with uncommitted changes in the checkout
        </span>
      ) : null}
      <span className="rv-served-sep" aria-hidden="true">
        ·
      </span>
      {served.contains_epic === true ? (
        <span className="rv-served-state" data-state="holds">
          this revision contains <span className="num">{specDir}</span>
        </span>
      ) : served.contains_epic === false ? (
        <span className="rv-served-state" data-state="lacks">
          this revision does <strong>not</strong> contain{" "}
          <span className="num">{specDir}</span>
        </span>
      ) : (
        // The third answer, in its own words. Not "contains" and not "does not
        // contain": nobody asked the question successfully, and saying either
        // would be the pane reporting a read it never made.
        <span className="rv-served-state" data-state="unknown">
          whether it contains <span className="num">{specDir}</span> could not be
          established
        </span>
      )}
    </p>
  );
}

/**
 * The mismatch band (FR-010), rendered only when the revision lacks the epic.
 *
 * Full width, above the frame, in the room's warning face — the gold § Colors
 * gives to "waiting on the operator", which is what this is. Not the alarm face:
 * nothing has failed, and a service one landing behind its branch is an ordinary
 * thing that happens to be fatal to a review nobody was told about.
 *
 * It names the landings the revision lacks, by story and by SHA. "The revision
 * is wrong" is not actionable; "the revision is wrong, and here is the commit it
 * is missing" is a thing the operator can go and fix in one command.
 */
export function Mismatch({ served, review }: { served: ServedRevision; review: ReviewDocument }):
  | JSX.Element
  | null {
  if (served.contains_epic !== false) return null;

  return (
    <div className="rv-mismatch" data-mismatch role="alert">
      <p className="lead">
        You are not looking at <span className="num">{review.spec_dir}</span>.
      </p>
      <p>
        The service is serving{" "}
        <span className="num">{served.short_revision}</span>, and that revision
        does not contain{" "}
        {served.missing.length === 1 ? "this landing" : "these landings"}:
      </p>
      <ul className="rv-missing">
        {served.missing.map((entry) => (
          <li key={entry.story_key} data-missing={entry.story_key}>
            <span className="num">{entry.story_key}</span>
            <span className="num">{entry.short_commit}</span>
          </li>
        ))}
      </ul>
      <p>
        Every screen in the frame below, every number measured beside it and every
        note taken against them is about the tree this process is running — not
        about the epic named above. Restart the service on a revision that carries{" "}
        {served.missing.length === 1 ? "that landing" : "those landings"}, or read
        what follows as a review of something else.
      </p>
    </div>
  );
}
