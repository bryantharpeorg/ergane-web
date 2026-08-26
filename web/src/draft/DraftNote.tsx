import type { DraftNote as Note } from "../api/draftDocument";

/**
 * One read this room could not make, in words, naming the path it tried
 * (014 FR-004; constitution III).
 *
 * Two failure modes and they are rendered differently, in the vocabulary the
 * Desk's `DegradedWell` already uses — transport is *the read could not be
 * made*, refusal is *the room would not make it*. The second is this room's own
 * and is not a factory refusal: the pane resolves a directory **name** against
 * the configured specs root and will not join a path onto it (plan D5), so the
 * refusal is the pane declining to read somewhere it has no business reading.
 * Saying "the factory declined" there would be a lie about who decided.
 *
 * The path is on its own line, in mono, because it is the fact the operator
 * acts on — a typo'd directory name is the common cause and it is only visible
 * spelled out. It is `null` exactly when nothing was joined, and then the room
 * says so rather than printing a path it never tried.
 */
export default function DraftNote({ note }: { note: Note }): JSX.Element {
  const refused = note.mode === "refusal";

  return (
    <div className="degraded" role="status" data-mode={note.mode} data-draft-note>
      <p className="lead">
        {refused
          ? "The room refused that name."
          : "That spec directory could not be read."}
      </p>
      <p>
        The read <span className="read num">{note.read}</span>{" "}
        {refused
          ? "was not made: the room resolves one directory name against the configured specs root, never a path."
          : "failed before anything was read:"}{" "}
        <span className="detail num">{note.detail}</span>. Shown as unavailable, not
        hidden.
      </p>
      <p className="draft-note-path">
        {note.path === null ? (
          <>
            <span className="draft-stamp-label">Path tried</span>{" "}
            <span className="num draft-unknown" data-note-path="none">
              none — no path was formed
            </span>
          </>
        ) : (
          <>
            <span className="draft-stamp-label">Path tried</span>{" "}
            <span className="num" data-note-path={note.path}>
              {note.path}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
