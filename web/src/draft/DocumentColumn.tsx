import type { DraftDocumentEntry } from "../api/draftDocument";
import Markdown from "./Markdown";

/**
 * One document of the trio, in its own column (014 FR-001, FR-002).
 *
 * DESIGN.md § The drafting table fixes the three renderings, and the whole
 * point of the section is that they are three and not two:
 *
 * * **Present, with text** — rendered as markdown, in running text at the
 *   ramp's body size. "A document is read, not scanned — this is the one place
 *   in the pane where prose sets the layout rather than a table."
 * * **Absent** — "the word `absent` in italic muted, in its own column, with no
 *   border and no colour". Eight of this corpus's fourteen spec directories
 *   lack a `plan.md`, a `tasks.md`, or both; that is the corpus's ordinary
 *   shape, not a fault in it, and the room is quiet about it. **Absent is not
 *   degraded**, and nothing here writes a note.
 * * **Present and empty** — neither of the first two. A `plan.md` that was
 *   commissioned and not yet written is a different situation from one that
 *   never existed, and an operator who cannot tell them apart will go looking
 *   for the wrong thing. So it says `empty` rather than `absent`, and it says
 *   the file is there.
 *
 * The column always names the document, in every state. A heading only over the
 * ones that happen to be present would make the missing ones invisible rather
 * than absent, which is the same defect one layer up.
 */
export default function DocumentColumn({
  entry,
}: {
  entry: DraftDocumentEntry;
}): JSX.Element {
  const state = !entry.present ? "absent" : entry.empty ? "empty" : "present";

  return (
    <article
      className="draft-column"
      data-document={entry.name}
      data-document-state={state}
      aria-label={entry.name}
    >
      <h2 className="draft-column-name num">{entry.name}</h2>
      {state === "present" ? (
        <div className="draft-prose" data-document-body>
          <Markdown text={entry.text ?? ""} />
        </div>
      ) : (
        <p className="draft-column-nothing" data-document-body>
          {state === "absent" ? (
            <em>absent</em>
          ) : (
            <em>empty — the file is there and has no text</em>
          )}
        </p>
      )}
    </article>
  );
}
