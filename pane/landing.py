"""Landing facts, read from the landing branch through ergane's own reader.

The defect this module exists for: an epic finishes, its Temporal workflow ages
out, and until a human edits one frontmatter line the room reports every story
of that spec at the *first* stop of the ladder — "not started", about work that
merged.  `epic_status` is the authority for anything in flight and knows nothing
once the workflow is gone; the branch knows, and it never forgets.

**The seam.**  `factory.workgraph.landed.landed_facts` is what
`ergane spec landed` calls (plan D2, constitution II): one `git log` pass over
the landing branch, anchored on the epic id, returning each story's current
landing commit with its provenance.  Three provenances come back and the
difference is the whole of this repository's Edge Case — `observed` and
`historical` are commits *on the branch*, while `attested` is the spec's own
frontmatter answering for itself.  An attestation is a claim; a landing is a
fact, so `LandingFact.on_branch` tells them apart and the assembly believes only
the branch.

**What the seam does not export.**  `landed_facts` returns a commit hash and
nothing about that commit.  FR-002a wants three facts the branch already holds —
when it merged, its SHA, and the PR number in the squash subject — and ergane
publishes no commit-metadata surface to read the first two through.  So the one
extra read here rides `factory.workgraph.worktree._git`, ergane's own git
helper: the same scrubbed environment, the same timeout and the same
`WorktreeError` vocabulary `landed_facts` itself is built on.  The pane spawns
no subprocess of its own and imports no `subprocess` (constitution II); the gap
in ergane's exported surface is worth a finding, not a licence to write git
plumbing here.

**Two failure modes, kept apart** (constitution III).  A repository that is not
there, or a git that cannot be run, is `TransportFailed` — the read could not be
made.  A git that ran and declined — an unresolvable branch, an unknown
revision — is `QueryRefused`.  Neither is ever a silent "nothing landed": that
is the lie this module was written to stop telling.
"""

from __future__ import annotations

import dataclasses
import re
from pathlib import Path

from pane.readers import QueryRefused, TransportFailed

#: The name every degraded note from this module carries, so the room says which
#: read it was in the same vocabulary as `epic_status` and `workgraph`.
LANDING_READ = "landed_facts"

#: The changed-file read's own name (011 FR-002).  Its own word rather than
#: `landed_facts`', because they fail independently: a commit whose file list
#: will not read has still landed, and a room that named both failures the same
#: could not say which of the two the operator lost.
CHANGED_FILES_READ = "changed_files"

#: The PR number GitHub appends to a squash subject: `… : US1 (#47)`.  The
#: number is read out of the subject the queue wrote, never invented — a subject
#: without one leaves `pr_number` unknown.
_PR_RE = re.compile(r"\(#(\d+)\)\s*$")

#: `git log` writes the instant and the subject on two lines, in this order.
_COMMIT_FORMAT = "--format=%cd%n%s"

#: UTC, spelt the way the recorded factory answers spell it
#: (`2026-08-22T17:40:54Z`), so one document never carries two shapes of instant.
_DATE_FORMAT = "--date=format-local:%Y-%m-%dT%H:%M:%SZ"

#: What a `WorktreeError` says when the read could not be *made* at all, as
#: against being made and refused.  Matched case-insensitively against the
#: error's text, which carries git's own stderr.
_TRANSPORT_MARKERS = (
    "not a git repository",
    "no such file or directory",
    "does not exist",
    "permission denied",
    "not found",
)


@dataclasses.dataclass(frozen=True)
class LandingFact:
    """One story's landing, as the branch holds it.

    `kind` is `factory.workgraph.landed.LandedKind`'s own word.  `merged_at`,
    `subject` and `pr_number` are `None` when the branch could not supply them —
    the Unknown Rule, never a zero and never a dash invented here.
    """

    story_key: str
    commit: str
    kind: str
    merged_at: str | None = None
    subject: str | None = None
    pr_number: int | None = None

    @property
    def on_branch(self) -> bool:
        """Whether a commit on the landing branch carries this story.

        `attested` is the spec's frontmatter answering for itself, which is the
        claim the branch is being read to check.  Only `observed` (the merge
        queue's attribution subject) and `historical` (git's own pre-queue merge
        subject) are landings.
        """
        return self.kind in {"observed", "historical"}


class LandingReader:
    """The landing-facts read for one repository and one branch.

    **Memoised on the branch head, and that is not an optimisation the room can
    do without.**  `landed_facts` walks the landing branch's whole history once
    per spec, in a subprocess, synchronously — eleven specs is most of a second,
    and the assembly runs on every `GET /api/showfloor` *and* every SSE poll, in
    the event loop's own thread.  Unmemoised, the room spends more time reading
    git than serving; measured, it cost the smoke suite its 30-second budget.

    The memo is exactly sound because the read is pure: landing facts at a given
    (repository, head, spec) cannot change, since every one of `landed_facts`'s
    reads is `git show <rev>:…` against a commit.  A branch that moves resolves
    to a different head and the memo drops.  Nothing here is time-based, so
    nothing here can serve a stale answer for a branch that has stood still.
    """

    def __init__(self, repo: Path | str, branch: str) -> None:
        self.repo = Path(repo)
        self.branch = branch
        self._head: str | None = None
        self._facts: dict[str, dict[str, LandingFact]] = {}

    def head(self) -> str:
        """The landing branch's head, through ergane's own precedence."""
        from factory.workgraph.landed import _resolve_default_head

        with _translated(self.repo):
            return _resolve_default_head(self.repo, self.branch, fetch=False)

    def facts(self, spec_dir: str, head: str | None = None) -> dict[str, LandingFact]:
        """`{story_key: LandingFact}` for one spec, newest landing per story.

        `head` is a head the caller has already resolved, passed so a caller
        reading many specs pays for the resolution once.  It is the memo's key
        and its staleness check, not a revision the scan is pinned to: ergane's
        seam takes a branch name and reads that branch's head itself, and this
        module does not reach past it to say otherwise.
        """
        resolved = self.head() if head is None else head
        if resolved != self._head:
            self._head = resolved
            self._facts = {}
        if spec_dir not in self._facts:
            self._facts[spec_dir] = read_landing_facts(
                self.repo, spec_dir, branch=self.branch
            )
        return self._facts[spec_dir]


#: One reader per (repository, branch), for the lifetime of the process.
#:
#: The memo above is worth nothing if the reader is rebuilt per request, and
#: `ShowfloorReaders.from_reader` binds a fresh set of reads for every assembly.
#: Keyed by the resolved path so two spellings of one checkout share a memo, and
#: never by anything derived from a clock.
_READERS: dict[tuple[str, str], LandingReader] = {}


def reader_for(repo: Path | str, branch: str) -> LandingReader:
    """The process's reader for one repository and branch, built once."""
    key = (str(Path(repo).resolve()), branch)
    reader = _READERS.get(key)
    if reader is None:
        reader = LandingReader(repo, branch)
        _READERS[key] = reader
    return reader


class AssemblyLanding:
    """One assembly's landing read: the head resolved once, facts per spec.

    The per-request half of the memo.  Resolving the head is two git commands;
    doing it once per document rather than once per spec is what keeps a whole
    assembly down to that pair when the branch has not moved.
    """

    def __init__(self, reader: LandingReader) -> None:
        self._reader = reader
        self._head: str | None = None

    def facts(self, spec_dir: str) -> dict[str, LandingFact]:
        if self._head is None:
            self._head = self._reader.head()
        return self._reader.facts(spec_dir, self._head)


def read_landing_facts(
    repo: Path | str, spec_dir: str, *, branch: str
) -> dict[str, LandingFact]:
    """Every story of `spec_dir` the landing branch can place, with its commit.

    `fetch=False` is not an optimisation.  ergane's own doctrine on that flag is
    that a *reporting* caller must not touch the network or write a
    remote-tracking ref to answer a question — the pane is nothing but a
    reporting caller, and a render that fetched would make watching the floor an
    act that changes it.
    """
    from factory.workgraph.landed import landed_facts

    path = Path(repo)
    with _translated(path):
        found = landed_facts(path, spec_dir, default_branch=branch, fetch=False)

    facts: dict[str, LandingFact] = {}
    for story_key, fact in found.items():
        merged_at, subject = _commit_details(path, fact.commit)
        facts[story_key] = LandingFact(
            story_key=story_key,
            commit=fact.commit,
            kind=str(fact.kind),
            merged_at=merged_at,
            subject=subject,
            pr_number=pr_number_of(subject),
        )
    return facts


def read_changed_files(repo: Path | str, commit: str) -> list[str]:
    """Every repository-relative path one commit changed, sorted and unique.

    **The same seam and the same doctrine as `_commit_details` above** (011
    plan, Named traps): `factory.workgraph.worktree._git`, ergane's own git
    helper, with its scrubbed environment, its timeout and its `WorktreeError`
    vocabulary.  ergane exports no commit-diff surface, and a gap in its
    exported surface is worth a finding, not a licence to write git plumbing
    here — so this module imports no `subprocess` and spawns nothing of its own
    (constitution II).

    `--root` is what makes the read total: a landing is a squash commit with one
    parent, but a corpus whose first commit *is* the landing would otherwise
    read as a commit that changed nothing, which is the silent-empty answer this
    repository has already been bitten by once.

    Failure is 001's two words, told apart by `_translated`: a repository that
    is not there is transport, a git that ran and declined an unknown revision
    is refusal.  Neither is ever an empty list.
    """
    from factory.workgraph.worktree import _git

    path = Path(repo)
    with _translated(path, read=CHANGED_FILES_READ):
        output = _git(
            path,
            "diff-tree",
            "--no-commit-id",
            "--name-only",
            "-r",
            "--root",
            commit,
            "--",
        )
    return sorted({line.strip() for line in output.splitlines() if line.strip()})


def pr_number_of(subject: str | None) -> int | None:
    """The PR number in a squash subject, or None when it names none."""
    if not subject:
        return None
    match = _PR_RE.search(subject)
    return int(match.group(1)) if match is not None else None


def _commit_details(repo: Path, commit: str) -> tuple[str | None, str | None]:
    """One commit's instant and subject, or `(None, None)` if it cannot be read.

    A commit whose metadata will not read is not a failed *landing* read — the
    landing itself was established by the seam above — so this degrades to the
    Unknown Rule on those two facts rather than taking the whole spec's entry
    down with it.
    """
    from factory.workgraph.worktree import WorktreeError, _git

    try:
        output = _git(
            repo,
            "log",
            "-1",
            _DATE_FORMAT,
            _COMMIT_FORMAT,
            commit,
            "--",
            env_extra={"TZ": "UTC"},
        )
    except (WorktreeError, OSError):
        return None, None

    lines = output.splitlines()
    instant = lines[0].strip() if lines else ""
    subject = lines[1].strip() if len(lines) > 1 else ""
    return instant or None, subject or None


class _translated:
    """Turn ergane's `WorktreeError` into 001's two words, and nothing else.

    `read` is the name the two words carry out.  It defaults to the landing
    read, which is what every caller before 011 was doing; a caller reading
    something else over the same git seam names its own read, so a note in the
    room says which read was lost rather than which module lost it.
    """

    def __init__(self, repo: Path, read: str = LANDING_READ) -> None:
        self._repo = repo
        self._read = read

    def __enter__(self) -> "_translated":
        return self

    def __exit__(self, kind, value, traceback) -> bool:
        from factory.workgraph.worktree import WorktreeError

        if value is None:
            return False
        if isinstance(value, OSError):
            raise TransportFailed(self._read, str(value)) from value
        if isinstance(value, WorktreeError):
            detail = str(value)
            lowered = detail.lower()
            if not self._repo.is_dir() or any(
                marker in lowered for marker in _TRANSPORT_MARKERS
            ):
                raise TransportFailed(self._read, detail) from value
            raise QueryRefused(self._read, detail) from value
        return False
