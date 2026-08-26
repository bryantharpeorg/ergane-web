import { ReactNode, useEffect, useState } from "react";
import type { DraftDocument } from "../api/draftDocument";
import Masthead from "../Masthead";
import DocumentColumn from "./DocumentColumn";
import DraftNote from "./DraftNote";
import ReadStamp from "./ReadStamp";
import { specDirFromDraftPath } from "../routes";

/**
 * The drafting table: a spec's trio, read together (014 US1).
 *
 * The third room, and the only one that renders **documents** rather than state
 * (D-022, DESIGN.md § The drafting table). It wears the same app frame the
 * other two wear — full-bleed surface card, `max-width: 96rem`, centred, with
 * the appbar as its first row — because a third frame would be a third design.
 *
 * One document, one bare GET, and no stream. The Desk and the Showfloor watch a
 * floor that moves under them; a spec's trio does not move except when someone
 * edits it, and an operator reading a document does not want it replaced
 * mid-paragraph. What the room owes instead is the read stamp: what it read,
 * and when (FR-003). The roadmap hard-resets the operator's checkout every tick
 * (N50), so a reader who has been on this page for ten minutes may be reading a
 * revision the tree no longer has — and the stamp is what lets them notice.
 *
 * **The room derives nothing.** It renders three documents as text and shows
 * what the backend said about the read. It does not parse a `## Work Graph` out
 * of `spec.md` and does not decide whether the spec is valid: `derive_workgraph`
 * is the only thing that knows what a Work Graph means, and a second parser in
 * this repository is D-005 by construction (plan D1). US2 and US3 add the
 * checks and the stage; this story adds the page they land on.
 */
function Frame({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="draft-room" data-draft-root>
      <div className="draft-frame" data-draft-frame>
        <Masthead />
        {children}
      </div>
    </div>
  );
}

export default function Draft(): JSX.Element {
  const specDir = specDirFromDraftPath(window.location.pathname);
  const [doc, setDoc] = useState<DraftDocument | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(specDir !== null);

  useEffect(() => {
    if (specDir === null) return;
    let cancelled = false;
    fetch(`/api/draft/${encodeURIComponent(specDir)}`)
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) setErrorStatus(response.status);
          return;
        }
        const initial = (await response.json()) as DraftDocument;
        // A body that is not a draft document is not a trio of one: it is a
        // read that answered something else, and the room says it could not
        // read rather than rendering whatever arrived.
        if (!cancelled && Array.isArray(initial?.documents)) setDoc(initial);
        else if (!cancelled) setErrorStatus(0);
      })
      .catch(() => {
        if (!cancelled) setErrorStatus(0);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [specDir]);

  // `/draft` with nothing after it is not a room with no selection the way a
  // bare `/showfloor` is: a table with no spec on it has nothing to draw, and
  // the address is what names the spec (routes.ts).
  if (specDir === null) {
    return (
      <Frame>
        <main id="room" className="draft" data-draft-content>
          <p className="loading" data-draft-empty>
            No spec named. The drafting table reads one spec at{" "}
            <span className="num">/draft/&lt;spec-dir&gt;</span>.
          </p>
        </main>
      </Frame>
    );
  }

  if (isLoading) {
    return (
      <Frame>
        <main id="room" className="draft" data-draft-content>
          <p className="loading">Reading the trio…</p>
        </main>
      </Frame>
    );
  }

  if (errorStatus !== null || doc === null) {
    return (
      <Frame>
        <main id="room" className="draft" data-draft-content>
          <div className="degraded" role="status" data-mode="transport">
            <p className="lead">The drafting table could not be read.</p>
            <p>
              The read <span className="read num">draft_trio</span> failed before the
              pane answered: <span className="detail num">{errorStatus || "—"}</span>.
              Shown as unavailable, not hidden.
            </p>
          </div>
        </main>
      </Frame>
    );
  }

  return (
    <Frame>
      <main id="room" className="draft" data-draft-content data-spec-dir={doc.spec_dir}>
        <ReadStamp document={doc} />
        <h1 className="draft-title num">{doc.spec_dir}</h1>
        {doc.degraded.map((note, index) => (
          <DraftNote key={`${note.read}-${index}`} note={note} />
        ))}
        {/* FR-004: no trio at all when the directory could not be read. Three
            empty columns is what a sketch looks like, and this is not a sketch
            — it is a spec that is not there. */}
        {doc.documents.length > 0 ? (
          <div className="draft-trio" data-draft-trio>
            {doc.documents.map((entry) => (
              <DocumentColumn key={entry.name} entry={entry} />
            ))}
          </div>
        ) : null}
      </main>
    </Frame>
  );
}
