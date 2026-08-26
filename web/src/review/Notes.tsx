/**
 * The room's third track: the notes, and the draft they compose into (011 US3).
 *
 * The output of the whole room. The what-changed track says what landed, the
 * centre track renders it and measures it, and this is where an operator turns
 * "that looks wrong" into something the factory can take.
 *
 * ── the coordinates come first, and they are frozen ───────────────────────
 *
 * `DESIGN.md` § The review room: *"A note renders its coordinates, not its
 * prose first."* Story, route, width, theme and the figures at capture, in
 * mono, then the observation. The two manual reviews were worth automating
 * because they reported `235px of graph hidden at 1280` and not "the graph
 * looks cut off", and a note that carried only the sentence would have thrown
 * away the half that made them useful (FR-012).
 *
 * They are taken **once**, by `captureNote`, and never re-read. Change the
 * width after taking a note and the note keeps the width it was taken at (plan
 * D6). What this component holds is a list of records; what the centre track
 * hands it is the live view, and the two are different types so that neither
 * can be mistaken for the other.
 *
 * ── the room writes nothing, and this is the file that would ──────────────
 *
 * FR-014 is absolute: no file, no directory, no spec mutation. This track is
 * where a save button would go if there were one, so it is worth being plain
 * about what is deliberately absent. There is no download, no `Blob`, no object
 * URL, no `localStorage` and no request of any kind — the notes live in this
 * component's state for as long as the tab is open, and the composed draft is
 * *shown*, as a document, for the operator to save or not save.
 *
 * The one control beside it copies the draft's bytes to the clipboard, which is
 * not a file and not a store: it is the same act as selecting the text and
 * pressing the key, offered because the alternative is an operator hand-copying
 * ninety lines out of a `<pre>`. When the browser will not give a clipboard, the
 * room says so rather than reporting a copy it did not make (constitution III).
 *
 * `web/tests/unit/noVerb.test.ts` is the guard on all of that, and it names this
 * file: one `<textarea>`, in one file, and no write anywhere in the room.
 */

import { useRef, useState } from "react";
import type { ReviewStory, ServedRevision } from "../api/reviewDocument";
import { captureNote, composeDraft, coordinateLine, measuredLine, lawLine } from "./notes";
import type { Note, ReviewView } from "./notes";

interface Props {
  specDir: string;
  epicName: string;
  stories: ReviewStory[];
  served: ServedRevision;
  /** What the centre track is rendering, or null before it renders anything. */
  view: ReviewView | null;
}

/** Where the composed draft would go, said as an instruction and never done. */
const SAVE_HINT = "specs/<you name it>/spec.md";

/** One recorded note: its coordinates, then its words. */
function Recorded({ note, index }: { note: Note; index: number }): JSX.Element {
  const laws = lawLine(note.at);
  return (
    <li className="rv-note" data-note={note.id} data-note-story={note.at.story}>
      <p className="rv-note-where num" data-note-where>
        <span data-note-index>{index + 1}</span> · {note.at.story} ·{" "}
        <span data-note-route>{note.at.route}</span> ·{" "}
        <span data-note-width>{note.at.width}px</span> ·{" "}
        <span data-note-theme>{note.at.theme}</span>
      </p>
      <p className="rv-note-measured micro num" data-note-measured>
        {measuredLine(note.at)}
      </p>
      {laws === null ? null : (
        <p className="rv-note-laws micro num" data-note-laws>
          {laws}
        </p>
      )}
      <p className="rv-note-said" data-note-said>
        {note.observation}
      </p>
    </li>
  );
}

export default function Notes({
  specDir,
  epicName,
  stories,
  served,
  view,
}: Props): JSX.Element {
  const [notes, setNotes] = useState<Note[]>([]);
  const [said, setSaid] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const [copied, setCopied] = useState<"done" | "unavailable" | null>(null);
  // The note's number, and nothing else. A counter rather than a clock or a
  // random value, so `captureNote` stays a pure function of what it is given.
  const sequence = useRef(0);

  /**
   * The story a note is about, defaulting to one that actually reaches the
   * route on screen.
   *
   * A route can be reached by more than one story of an epic, so the operator
   * picks; but a default of "the first story of the epic" would anchor a note
   * about `/showfloor` to a story that never touched it. The default is the
   * first story whose own change reaches the route being rendered, and the
   * epic's first only when none does.
   */
  const reaching = stories.filter(
    (story) => view !== null && story.routes.includes(view.route),
  );
  const fallback = reaching.length > 0 ? reaching[0] : stories[0];
  const story = stories.find((entry) => entry.story_key === picked) ?? fallback;

  const record = () => {
    if (view === null || story === undefined || said.trim() === "") return;
    sequence.current += 1;
    setNotes((taken) => [...taken, captureNote(sequence.current, said, view, story)]);
    setSaid("");
  };

  const draft =
    notes.length === 0
      ? null
      : composeDraft(notes, {
          specDir,
          epicName,
          served: served.short_revision,
          created: new Date().toISOString().slice(0, 10),
        });

  const copy = () => {
    // Typed as present by the DOM lib and absent in plenty of real contexts —
    // an insecure origin, an old browser, a test's document. Narrowed rather
    // than assumed, because a copy the room claims and did not make is exactly
    // the kind of quiet lie constitution III exists to forbid.
    const clipboard = navigator.clipboard as Clipboard | undefined;
    if (draft === null) return;
    if (clipboard === undefined || typeof clipboard.writeText !== "function") {
      setCopied("unavailable");
      return;
    }
    void clipboard.writeText(draft).then(
      () => setCopied("done"),
      () => setCopied("unavailable"),
    );
  };

  return (
    <section className="track rv-notes" data-track="the-notes">
      <h2 className="rv-track-head">The notes</h2>

      <div className="rv-capture" data-capture>
        {view === null ? (
          <p className="quiet" data-no-view>
            A note is anchored to a render. Nothing is in the frame yet, so there
            are no coordinates to take one at.
          </p>
        ) : (
          <p className="rv-capture-where micro num" data-capture-where>
            {story === undefined ? "no story" : story.story_key} · {view.route} ·{" "}
            {view.width}px · {view.theme}
          </p>
        )}

        <div className="rv-control" data-control="story">
          <span className="micro rv-control-label">story</span>
          {stories.map((candidate) => (
            <button
              type="button"
              key={candidate.story_key}
              className="rv-pick num"
              data-story-pick={candidate.story_key}
              aria-pressed={story !== undefined && candidate.story_key === story.story_key}
              onClick={() => setPicked(candidate.story_key)}
            >
              {candidate.story_key}
            </button>
          ))}
        </div>

        <textarea
          className="rv-said"
          data-note-field
          rows={4}
          value={said}
          placeholder="What you see, and where. The coordinates above are recorded with it."
          aria-label="the observation to record"
          onChange={(event) => setSaid(event.target.value)}
        />

        <button
          type="button"
          className="rv-record"
          data-record
          disabled={view === null || story === undefined || said.trim() === ""}
          onClick={record}
        >
          Record this note
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="quiet" data-no-notes>
          No notes yet. Each one you record keeps the story, route, width, theme
          and measured numbers it was taken at, so it can be reproduced.
        </p>
      ) : (
        <>
          <p className="rv-note-count micro" data-note-count={notes.length}>
            {notes.length} {notes.length === 1 ? "note" : "notes"}
          </p>
          <ol className="rv-note-list">
            {notes.map((note, index) => (
              <Recorded note={note} index={index} key={note.id} />
            ))}
          </ol>
        </>
      )}

      {draft === null ? null : (
        <div className="rv-draft-block" data-draft-block>
          <button
            type="button"
            className="rv-compose"
            data-compose
            aria-pressed={showing}
            onClick={() => setShowing((open) => !open)}
          >
            {showing ? "Hide the draft" : "Compose the draft"}
          </button>

          {!showing ? null : (
            <div className="rv-draft" data-draft-shown>
              {/* § The review room: "The composed draft is shown as a document,
                  never as a saved thing." The sentence below is the control's
                  own, in those terms, because a room that cannot save must not
                  render anything that reads like a save button. */}
              <p className="rv-draft-hint" data-save-hint>
                This room saved nothing. It is a captured-TBD spec in the shape of
                007 and 010, and it exists only here — save it yourself at{" "}
                <span className="num">{SAVE_HINT}</span>, or do not.
              </p>
              <button type="button" className="rv-copy" data-copy onClick={copy}>
                Copy it — you save it
              </button>
              {copied === null ? null : (
                <p className="rv-copied micro" data-copied={copied} role="status">
                  {copied === "done"
                    ? "Copied. Nothing was written to disk."
                    : "This browser gave no clipboard, so nothing was copied. The document is below; select it."}
                </p>
              )}
              <pre className="rv-draft-body num" data-draft>
                {draft}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
