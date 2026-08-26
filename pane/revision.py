"""The revision this service is serving, and whether it carries an epic.

The review room reviews the **running service** (spec 011, question 6).  Nothing
here builds a branch, checks one out, or renders anything but the routes this
process is already answering — so the one thing the operator cannot otherwise
know is whether the screens in front of them were built from the epic they think
they are reviewing.  FR-009 makes the room say so on every render, and FR-010
makes a mismatch unmissable, because a review taken against the wrong revision
produces notes about a surface nobody changed.

**Two reads, both over ergane's own git helper** (constitution II, 011 plan's
Named traps).  `factory.workgraph.worktree._git` — the same scrubbed
environment, the same timeout and the same `WorktreeError` vocabulary
`pane/landing.py` already borrows.  This module imports no `subprocess`, spawns
nothing of its own and writes nothing; ergane exports no served-revision
surface, and a gap in its exported surface is worth a finding, not a licence to
write git plumbing here.

**This read is live in demo mode too, and that is the point.**  016 moved the
two *landing* reads onto the recorded floor because they are facts about the
factory's work, and a room that answered them out of the host's git history
answered differently in a shallow checkout than in a full one.  The served
revision is not that kind of fact.  It is a fact about **this process** — which
bytes it is serving — and a demo floor that replayed a recorded answer for it
would be telling the operator that the running service is something it is not,
which is the single lie FR-009 exists to prevent.  So it reaches real git,
always, and degrades honestly when it cannot (constitution III).

**The containment question is asked so that "no" and "could not tell" are
different answers.**  `git rev-list --count <revision>..<commit>` is zero when
the revision already carries the commit and positive when it does not, and both
are exits of zero — a commit the repository has never heard of is git's own
failure and comes back as a refusal.  `merge-base --is-ancestor` would have
answered the same question by exiting 1, which is indistinguishable at this seam
from the checkout being shallow, and a room that reported "this revision does
not contain the epic" on the strength of a read nobody completed would be
raising exactly the false alarm FR-010 is built to be believed about.
"""

from __future__ import annotations

import dataclasses
from pathlib import Path

from pane.landing import _translated, commit_details
from pane.readers import QueryRefused

#: The name the served-revision read carries into a degraded note, so the room
#: says which read it lost in the same vocabulary as `landed_facts` and
#: `changed_files`.
SERVED_REVISION_READ = "served_revision"

#: The containment read's own name.  Its own word rather than the one above,
#: because the two fail independently: a service can know perfectly well which
#: revision it is serving and still be unable to place a landing commit in a
#: checkout that was cloned shallow.
CONTAINS_READ = "revision_contains"

#: The revision a service is serving, spelt the way git spells it.  It doubles
#: as git's word for a detached head, which is an answer about a branch and not
#: a branch name: reported as an unknown branch rather than as a branch called
#: `HEAD` — the Unknown Rule, never a value invented to fill a field.
_HEAD = "HEAD"


@dataclasses.dataclass(frozen=True)
class ServedRevision:
    """The commit this process is serving, as the checkout holds it.

    `branch`, `committed_at` and `subject` are `None` when the checkout could
    not supply them — a detached head has no branch, and a commit whose metadata
    will not read has still been resolved.  Only `revision` is required: a
    revision that would not resolve is a failed read and raises rather than
    arriving here half-filled.
    """

    revision: str
    branch: str | None = None
    committed_at: str | None = None
    subject: str | None = None

    @property
    def short_revision(self) -> str:
        """The spelling the operator reads a revision by, cut once here.

        Twelve characters, the length `pane/review.py` cuts a landing SHA to.
        Two renderings of one revision that disagreed about length would read as
        two revisions.
        """
        return self.revision[:12]


def read_served_revision(repo: Path | str, revision: str = _HEAD) -> ServedRevision:
    """The revision the checkout at `repo` is on, with what git says about it.

    `revision` defaults to `HEAD` and the pane never passes anything else: what
    the service is serving is what it has checked out, and a room that let a
    caller name a revision would be answering a question the operator did not
    ask.  The parameter exists for `scripts/record-fixtures.py`, which records
    the demo floor's header off the landing branch the rest of that floor was
    captured from rather than off whichever branch the recorder happened to be
    standing on.

    Raises 001's two words, told apart by `pane/landing.py`'s `_translated`: a
    repository that is not there is transport, a git that ran and declined is a
    refusal.  Neither is ever a revision invented to keep the header full.
    """
    from factory.workgraph.worktree import WorktreeError, _git

    path = Path(repo)
    with _translated(path, read=SERVED_REVISION_READ):
        resolved = _git(path, "rev-parse", revision).strip()

    if not resolved:
        raise QueryRefused(
            SERVED_REVISION_READ, f"{path}: git resolved {revision} to nothing"
        )

    committed_at, subject = commit_details(path, resolved)
    return ServedRevision(
        revision=resolved,
        branch=_branch_of(path, revision),
        committed_at=committed_at,
        subject=subject,
    )


def _branch_of(repo: Path, revision: str) -> str | None:
    """The branch name git can put to `revision`, or None when it can put none.

    A courtesy, not the answer: a detached head is an ordinary state for a
    checkout the factory built, and a read that failed over it would lose the
    revision it actually wanted.  So every failure here is an unknown branch and
    never an unknown revision.
    """
    from factory.workgraph.worktree import WorktreeError, _git

    try:
        if revision == _HEAD:
            name = _git(repo, "rev-parse", "--abbrev-ref", _HEAD).strip()
            return None if name in {"", _HEAD} else name
        # A named revision is a branch only if git has a branch by that name;
        # a tag or a raw SHA is a revision with no branch to report.
        _git(repo, "rev-parse", "--verify", "--quiet", f"refs/heads/{revision}")
    except (WorktreeError, OSError):
        return None
    return revision


def revision_contains(repo: Path | str, revision: str, commit: str) -> bool:
    """Whether `revision` already carries `commit` — it, or a descendant of it.

    A commit either side of this question is a fact the checkout holds; a commit
    the checkout has never seen is not a `False`, it is a read that could not be
    made, and it comes back as one.
    """
    path = Path(repo)
    with _translated(path, read=CONTAINS_READ):
        from factory.workgraph.worktree import _git

        output = _git(path, "rev-list", "--count", f"{revision}..{commit}", "--")

    try:
        return int(output.strip()) == 0
    except ValueError as exc:  # pragma: no cover - git counts or it fails
        raise QueryRefused(
            CONTAINS_READ, f"{path}: git counted {output.strip()!r}, not a number"
        ) from exc

