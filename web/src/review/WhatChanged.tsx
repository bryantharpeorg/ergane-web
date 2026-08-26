/**
 * The what-changed track (011 US1: FR-001, FR-002, FR-003).
 *
 * The left track of `DESIGN.md` § The review room: one entry per story of the
 * epic, each carrying the landing the branch holds — SHA, pull request, squash
 * subject — and under it every file that commit changed with the routes that
 * file reaches.
 *
 * Two rules from § The review room are doing the work here. **A measured number
 * is shown, never only a verdict**: the SHA, the PR number and the file count
 * are numerals in tabular mono, present in full, never a tick standing in for
 * them. And **nothing is dropped**: a file the manifest cannot place still
 * renders, saying it reaches no known route, because a review that silently
 * omitted a changed file would be worse than no review at all (FR-003).
 *
 * The Unknown Rule (constitution III) is the other half. A fact the branch did
 * not supply — a squash subject with no PR number in it, a commit whose date
 * would not read — is rendered as unknown *in words*, never as a zero, a dash,
 * or another story's value.
 */

import type { ReviewDocument, ReviewFile, ReviewStory } from "../api/reviewDocument";

/** A value the branch did not supply, named rather than defaulted. */
function Unknown({ what }: { what: string }): JSX.Element {
  return (
    <span className="unknown" data-unknown={what}>
      {what} unknown
    </span>
  );
}

/** One changed file and the routes it reaches (FR-003). */
function ChangedFile({ file }: { file: ReviewFile }): JSX.Element {
  return (
    <li className="rv-file" data-file={file.path} data-matched={file.matched}>
      <span className="rv-path num">{file.path}</span>
      {file.routes.length > 0 ? (
        <span className="rv-routes">
          {file.routes.map((route) => (
            <span className="rv-route num" key={route} data-route={route}>
              {route}
            </span>
          ))}
        </span>
      ) : (
        // The two ways a file reaches nothing, told apart. One is the manifest
        // answering; the other is the manifest not knowing, which is a fact
        // about the manifest and is where FR-005's test starts looking.
        <span className="rv-routes" data-no-route={file.matched ? "mapped" : "unmatched"}>
          <span className="unknown">
            {file.matched
              ? "reaches no known route"
              : "no pattern names where this can be seen"}
          </span>
        </span>
      )}
    </li>
  );
}

/** One story's landing and its whole change. */
function StoryEntry({ story }: { story: ReviewStory }): JSX.Element {
  const unknown = new Set(story.unknown);

  return (
    <article className="rv-story" data-story={story.story_key}>
      <header className="rv-story-head">
        <span className="rv-key num">{story.story_key}</span>
        <h3 className="rv-title">{story.title}</h3>
        {story.priority === null ? null : (
          <span className="rv-priority micro">{story.priority}</span>
        )}
      </header>

      <p className="rv-landing">
        {unknown.has("commit") ? (
          <Unknown what="landing commit" />
        ) : (
          <span className="rv-sha num" data-sha={story.commit}>
            {story.short_commit}
          </span>
        )}
        {unknown.has("pr_number") ? (
          <Unknown what="pull request" />
        ) : (
          <span className="rv-pr num" data-pr={story.pr_number}>
            #{story.pr_number}
          </span>
        )}
        {unknown.has("merged_at") ? null : (
          <span className="rv-when num">{story.merged_at}</span>
        )}
      </p>

      {unknown.has("subject") ? (
        <p className="rv-subject">
          <Unknown what="squash subject" />
        </p>
      ) : (
        <p className="rv-subject" data-subject>
          {story.subject}
        </p>
      )}

      {story.notes.map((note) => (
        <div className="degraded" data-mode={note.mode} role="status" key={note.read}>
          <p className="lead">The change this story made could not be read.</p>
          <p>
            <span className="read num">{note.read}</span>{" "}
            {note.mode === "transport" ? "did not complete" : "was refused"}:{" "}
            <span className="detail">{note.detail}</span>. The landing above stands;
            its file list does not.
          </p>
        </div>
      ))}

      <p className="rv-count micro" data-file-count={story.files.length}>
        {story.files.length} {story.files.length === 1 ? "file" : "files"} ·{" "}
        {story.routes.length} {story.routes.length === 1 ? "route" : "routes"}
      </p>

      <ul className="rv-files">
        {story.files.map((file) => (
          <ChangedFile file={file} key={file.path} />
        ))}
      </ul>
    </article>
  );
}

export default function WhatChanged({ review }: { review: ReviewDocument }): JSX.Element {
  return (
    <section className="track rv-changed" data-track="what-changed">
      <h2 className="rv-track-head">What changed</h2>
      <p className="rv-provenance micro" data-provenance>
        {review.stories.length} stories · landed on{" "}
        <span className="num">{review.landing_branch ?? "an unnamed branch"}</span> ·
        stories read from <span className="num">{review.story_source}</span>
      </p>

      {review.notes.map((note) => (
        <div className="degraded" data-mode={note.mode} role="status" key={note.read}>
          <p className="lead">A read this room needed did not answer.</p>
          <p>
            <span className="read num">{note.read}</span>{" "}
            {note.mode === "transport" ? "did not complete" : "was refused"}:{" "}
            <span className="detail">{note.detail}</span>. Shown as unavailable, not
            hidden.
          </p>
        </div>
      ))}

      {review.stories.map((story) => (
        <StoryEntry story={story} key={story.story_key} />
      ))}
    </section>
  );
}
