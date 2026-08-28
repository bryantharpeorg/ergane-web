import { ReactNode, useEffect, useState } from "react";
import type { DraftIndexDocument, DraftIndexEntry } from "../api/draftIndexDocument";
import Masthead from "../Masthead";
import { chipTone } from "../showfloor/ladder";
import { draftPathFor, reviewPathFor } from "../routes";

/**
 * The corpus on one page, and a door to every spec in it (018 US1).
 *
 * Bare `/draft` is the drafting table's index: every spec directory
 * `read_roadmap` returned, in the order it returned them, each carrying the
 * state it declared, and each row a link into 014's room. It is not a fifth
 * room — it is the front of the third one (D-025, DESIGN.md § The drafting
 * table), so it wears the same frame and the same appbar as the trio view.
 *
 * **A declared state wears a chip, never a glyph** (FR-004, plan D4). The
 * eleven-state glyph grammar describes *work that has run*; `draft`, `ready`,
 * `deferred` and `landed` are what an operator *intends*, and DESIGN.md § Chips
 * already gives all four a chip. Nothing on this page carries a ladder, a stop
 * or a run state, for the same reason the pre-dispatch stage is unlit.
 *
 * **It computes no readiness** (plan § Named traps). Whether a spec could
 * dispatch is `ergane spec validate`'s answer, that answer has no library form,
 * and composing one here is what D-022 forbade by name. So there is no
 * `blocked` badge, no edge resolution and no parked count on this page: it
 * shows what each spec *declares*, which is the whole of what the seam knows.
 *
 * **Only a `landed` row offers the review room** (FR-010). That room refuses an
 * epic the landing branch does not carry whole, with a 409 — so a review link
 * on a `draft` row would be an offer of a refusal, which is worse than offering
 * nothing at all.
 */
function Frame({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="draft-room" data-draft-index-root>
      <div className="draft-frame" data-draft-frame>
        <Masthead />
        {children}
      </div>
    </div>
  );
}

/**
 * What the index read, and when — the same three facts, in the same classes,
 * that `ReadStamp` states over the trio (FR-006, DESIGN.md § The drafting
 * table: micro uppercase over a hairline, at the top of the view).
 *
 * The backend reads them through the reader 014 already uses, so the two views
 * cannot disagree about a revision or about what `unknown` means. What is not
 * shared is 014's component: the trio view is landed and attested, and this
 * story adds a door to that room rather than walking inside it (plan § Named
 * traps).
 */
function IndexStamp({ document }: { document: DraftIndexDocument }): JSX.Element {
  const revision = document.revision_short;

  return (
    <p className="draft-stamp" data-index-stamp>
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
        <span className="num" data-read-revision={revision} title={document.revision ?? undefined}>
          {revision}
        </span>
      )}
      {document.dirty === true ? (
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

/**
 * One read of the corpus that could not be made, in words, naming the seam
 * (FR-005; constitution III).
 *
 * It is not `DraftNote`'s sentence: that one says *that spec directory could
 * not be read*, and this failure is one level up — the corpus itself. Both
 * failure modes keep their existing spelling, `transport` for a read that could
 * not be made and `unparseable` for a corpus the seam walked and refused, so
 * the operator reads which of the two happened and to whom.
 */
function CorpusNote({ note }: { note: { read: string; mode: string; detail: string; path: string | null } }): JSX.Element {
  const unparseable = note.mode === "unparseable";

  return (
    <div className="degraded" role="status" data-mode={note.mode} data-corpus-note>
      <p className="lead">
        {unparseable ? "The corpus does not parse." : "The corpus could not be read."}
      </p>
      <p>
        The read <span className="read num">{note.read}</span>{" "}
        {unparseable
          ? "walked the corpus and refused it whole; no partial list is shown, because a list missing one spec is a claim about a corpus nobody has:"
          : "failed before anything was listed:"}{" "}
        <span className="detail num">{note.detail}</span>. Shown as unavailable, not hidden.
      </p>
      <p className="draft-note-path">
        <span className="draft-stamp-label">Path tried</span>{" "}
        {note.path === null ? (
          <span className="num draft-unknown" data-note-path="none">
            none — no path was formed
          </span>
        ) : (
          <span className="num" data-note-path={note.path}>
            {note.path}
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * One spec: its directory, its declared state, and its doors.
 *
 * **The row is the link** (FR-002, plan D5) — there is no "open" button and no
 * chevron. The anchor covers the row through `.draft-index-open::after`, which
 * is why the review link is a sibling rather than a child: an anchor inside an
 * anchor is not a document, and a `landed` row owes the operator two
 * destinations. Both paths come from the helpers `web/src/routes.ts` already
 * exports, never from a second spelling — a room that hand-built `/draft/…`
 * would be the place the two grammars start to disagree about an escaped
 * directory name.
 */
function IndexRow({ entry }: { entry: DraftIndexEntry }): JSX.Element {
  const tone = chipTone(entry.state);
  const landed = entry.state === "landed";

  return (
    <li className="draft-index-row" data-index-row data-state={entry.state}>
      <a
        className="draft-index-open"
        href={draftPathFor(entry.spec_dir)}
        data-index-link
        data-spec-dir={entry.spec_dir}
      >
        <span className="draft-index-dir num">{entry.spec_dir}</span>
        <span className={`chip ${tone}`} data-chip data-chip-tone={tone} data-declared-state>
          {entry.state}
        </span>
      </a>
      {/* FR-010: the fourth room's only door that is not a typed URL — and it
          is offered on `landed` rows alone, explicitly labelled, because a
          labelled second destination is the one thing that may sit on a row
          whose body is already a link. */}
      {landed ? (
        <a className="draft-index-review" href={reviewPathFor(entry.spec_dir)} data-review-link>
          review
        </a>
      ) : null}
    </li>
  );
}

export default function DraftIndex(): JSX.Element {
  const [doc, setDoc] = useState<DraftIndexDocument | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/draft")
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) setErrorStatus(response.status);
          return;
        }
        const initial = (await response.json()) as DraftIndexDocument;
        // A body that is not an index document is a read that answered
        // something else, and the room says it could not read rather than
        // rendering whatever arrived. `specs` is named because an index with no
        // list is not an empty corpus — it is a body that made no claim.
        if (!cancelled && Array.isArray(initial?.specs) && Array.isArray(initial?.degraded))
          setDoc(initial);
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
  }, []);

  if (isLoading) {
    return (
      <Frame>
        <main id="room" className="draft draft-index" data-draft-index>
          <p className="loading">Reading the corpus…</p>
        </main>
      </Frame>
    );
  }

  if (errorStatus !== null || doc === null) {
    return (
      <Frame>
        <main id="room" className="draft draft-index" data-draft-index>
          <div className="degraded" role="status" data-mode="transport" data-corpus-note>
            <p className="lead">The corpus could not be read.</p>
            <p>
              {/* The room's own read, named for the request it made: this
                  failure happened before the backend answered, so no seam of
                  the backend's — `specs_root`, `read_roadmap` — could be named
                  for it without saying something the pane does not know. */}
              The read <span className="read num">draft_index</span> failed before the pane
              answered: <span className="detail num">{errorStatus || "—"}</span>. Shown as
              unavailable, not hidden.
            </p>
          </div>
        </main>
      </Frame>
    );
  }

  // Two different facts, and neither may be told as the other (FR-005): a
  // corpus that holds nothing says so in words, and one that could not be read
  // has already said so in its note above — so no list, and no sentence
  // claiming the corpus is empty.
  const unread = doc.degraded.length > 0;

  return (
    <Frame>
      <main id="room" className="draft draft-index" data-draft-index>
        <IndexStamp document={doc} />
        <h1 className="draft-title">The corpus</h1>
        {doc.degraded.map((note, index) => (
          <CorpusNote key={`${note.read}-${index}`} note={note} />
        ))}
        {doc.specs.length > 0 ? (
          <>
            {/* The header's two labels ride one cell so they land on the
                same grid track the row's own cell does — "declared" over the
                chips, not over the review column (DESIGN.md § The Desk in this
                world: micro uppercase headers over a hairline). */}
            <p className="draft-index-head micro" data-index-head aria-hidden="true">
              <span className="draft-index-head-cells">
                <span>spec</span>
                <span>declared</span>
              </span>
            </p>
            <ul className="draft-index-list" data-index-list>
              {doc.specs.map((entry) => (
                <IndexRow key={entry.spec_dir} entry={entry} />
              ))}
            </ul>
          </>
        ) : unread ? null : (
          <p className="draft-index-empty" data-index-empty>
            This corpus holds no specs. The read succeeded and found none —
            nothing is hidden here.
          </p>
        )}
      </main>
    </Frame>
  );
}
