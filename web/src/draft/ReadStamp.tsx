import type { DraftDocument } from "../api/draftDocument";

/**
 * What the room read, and when (014 FR-003; DESIGN.md § The drafting table).
 *
 * "Every render names the working-tree revision and the instant it was read, in
 * micro uppercase over a hairline, at the top of the view." It is not a
 * footnote and it is not conditional: the roadmap runs `git reset --hard` on
 * the operator's working checkout on a 300-second timer (N50), so the tree
 * under this room can change while it is being read. A document with no read
 * instant is a claim that has quietly expired.
 *
 * Three facts, and each is shown as what it is:
 *
 * * **The revision.** Short form in mono, because that is the form the operator
 *   types back into git; the whole object name is on the element's `title` so
 *   nothing is lost. A tree with no revision to give reads `unknown` — never a
 *   dash, never a blank, never the word `HEAD` standing in for a commit
 *   (constitution III's Unknown Rule).
 * * **Whether the tree is still that commit.** A revision alone is a half-truth
 *   about a checkout an operator edits in place: the commit could be `15a9c66`
 *   while the `spec.md` just rendered is not the one `15a9c66` holds. So a
 *   dirty tree says `+ uncommitted`, and a clean one says nothing, because
 *   clean is what the revision already claims.
 * * **The instant.** As the backend stamped it, in the shape every recorded
 *   factory document uses. The browser does not re-format it into a local
 *   clock: the operator reads the factory's instants in the factory's zone
 *   everywhere else in this pane, and a second shape here would be a second
 *   thing to reconcile.
 */
export default function ReadStamp({ document }: { document: DraftDocument }): JSX.Element {
  const revision = document.revision_short;
  const dirty = document.dirty === true;

  return (
    <p className="draft-stamp" data-read-stamp>
      <span className="draft-stamp-label">Read at</span>{" "}
      <span className="num" data-read-instant>
        {document.read_at}
      </span>
      <span className="draft-stamp-sep" aria-hidden="true">
        ·
      </span>
      <span className="draft-stamp-label">Revision</span>{" "}
      {revision === null ? (
        <span className="num draft-unknown" data-read-revision="unknown">
          unknown
        </span>
      ) : (
        <span
          className="num"
          data-read-revision={revision}
          title={document.revision ?? undefined}
        >
          {revision}
        </span>
      )}
      {dirty ? (
        <>
          {" "}
          <span className="num draft-dirty" data-tree-dirty>
            + uncommitted
          </span>
        </>
      ) : null}
    </p>
  );
}
