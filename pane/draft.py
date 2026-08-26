"""The drafting table's read: one spec's trio, and when it was read.

The third room renders **documents** rather than state, and this module is the
whole of its backend for 014 US1.  It answers one question — what does
`specs/<dir>/` hold right now — and it answers it in the pane's existing
vocabulary: a document per name, a `degraded` list in the same triple the
Showfloor's rail notes use, and nothing invented for either.

**Three outcomes, and they are three different facts** (constitution III, and
this spec's plan D3).

* A document that is **there** carries its bytes.  If those bytes are zero it is
  *present and empty*, which is not absence: an operator who commissioned a
  `plan.md` and has not written it yet is looking at a different situation from
  one who never commissioned it, and the distinction is on screen.
* A document that is **absent** is named as absent and degrades nothing.  Eight
  of this corpus's fourteen spec directories lack a `plan.md`, a `tasks.md`, or
  both; a room that painted a red border on most of the corpus would be
  constitution III inverted, which is the exact defect 012 was written to fix on
  the Desk (FR-002, DESIGN.md § The drafting table: *absent is quiet*).
* A **read that could not be made** — no such directory, a file where a
  directory should be, bytes that will not decode — is degraded, in words,
  naming the path it tried, and the trio is not rendered at all (FR-004).  An
  empty trio is a claim about a spec; there is no spec.

**The route takes a name, not a path** (plan D5).  `resolve` accepts a single
directory name and joins it onto the configured specs root.  Anything else — a
separator in either slant, `.`, `..`, an absolute path, a name that is only
whitespace — is refused before a path is formed, and the refusal says so rather
than reporting a path that was never tried.  A room that joined an
operator-supplied path onto a root would read the operator's whole filesystem
from behind one bearer token.

**The read stamp is not decoration** (FR-003).  The roadmap runs `git reset
--hard` on the operator's working checkout every tick (N50,
`factory/activities/roadmap_activities.py:118`), so the tree this room reads can
change under a reader inside 300 seconds.  A render that does not say which
revision it read, and when, is a claim that has quietly expired.  The revision
is read through `factory.workgraph.worktree._git` — ergane's own git helper,
with its scrubbed environment, its timeout and its `WorktreeError` vocabulary —
for the same reason `pane/landing.py` reads through it: this repository spawns
no subprocess of its own and imports no `subprocess` (constitution II).

A revision that will not read is **unknown**, not degraded.  A scratch directory
is not a repository and never was one; the trio read succeeded there, and
constitution III's Unknown Rule is what covers a fact the tree could not supply.
Reporting it as a failed read would put a note on every spec of a corpus checked
out without git — and, more to the point, on every one of this suite's own
constructed corpora, which is how a rule this loose gets discovered late.

**This module derives nothing.**  It reads three documents as text and hands
them on.  It does not parse a `## Work Graph` out of `spec.md`, does not read
frontmatter, and does not decide whether a spec is valid: `derive_workgraph` is
the only thing that knows what a Work Graph means, and a second parser in this
repository is D-005 by construction (plan D1).
"""

from __future__ import annotations

from pathlib import Path

from pane.intake import utc_now
from pane.sweep import sweep

#: The read's own name, carried by every degraded note this module writes, so
#: the room says which read it was in the same vocabulary as `epic_status`,
#: `workgraph` and `landed_facts`.
DRAFT_READ = "draft_trio"

#: The three documents, in the order FR-001 fixes.  The order is the spec's and
#: never the filesystem's: a directory walk answers in creation order, which is
#: whatever the operator's editor happened to do first.
TRIO = ("spec.md", "plan.md", "tasks.md")

#: What disqualifies a string from being a spec directory *name*.  `os.sep` is
#: not consulted: a name carrying a backslash is refused on every platform,
#: because the room resolves the same name whatever the host separator is.
_SEPARATORS = ("/", "\\")

#: The two names every directory holds, and neither of them is a spec.
_RELATIVE = (".", "..")


class NotADirectoryName(ValueError):
    """`spec_dir` is not a single directory name; nothing was joined onto the root."""


def resolve(specs_root: Path | str, spec_dir: str) -> Path:
    """The directory `spec_dir` names under `specs_root`, or refuse to form one.

    The refusal is the security property, not a tidiness one: this is the only
    place an operator-supplied string meets the filesystem, so it is the only
    place that can stop it naming somewhere else (plan D5).
    """
    if not isinstance(spec_dir, str) or not spec_dir.strip():
        raise NotADirectoryName("a spec directory name is required")
    if spec_dir.strip() != spec_dir:
        raise NotADirectoryName(f"{spec_dir!r} is not a spec directory name")
    if spec_dir in _RELATIVE:
        raise NotADirectoryName(f"{spec_dir!r} is not a spec directory name")
    if any(separator in spec_dir for separator in _SEPARATORS):
        raise NotADirectoryName(
            f"{spec_dir!r} is a path, not a spec directory name; the room "
            "resolves one name against the configured specs root"
        )
    if spec_dir.startswith("."):
        # `.hidden` is not a spec, and refusing the whole shape keeps `..` from
        # being the only relative name this has to think about.
        raise NotADirectoryName(f"{spec_dir!r} is not a spec directory name")
    return Path(specs_root) / spec_dir


def read_trio(specs_root: Path | str, spec_dir: str) -> dict:
    """One spec directory's three documents, with the stamp of the read.

    Always answers; never raises.  A read that could not be made comes back as a
    `degraded` note with an empty `documents`, because the room's job when it
    cannot read is to say so rather than to render a trio of absences that would
    look exactly like a sketch (FR-004).
    """
    root = Path(specs_root)
    read_at = utc_now()

    try:
        path = resolve(root, spec_dir)
    except NotADirectoryName as exc:
        return _document(
            spec_dir=spec_dir,
            specs_root=root,
            path=None,
            read_at=read_at,
            documents=[],
            degraded=[_note("refusal", str(exc), None)],
        )

    revision, dirty = read_revision(root)

    if not path.is_dir():
        detail = (
            f"no such spec directory: {path}"
            if not path.exists()
            else f"not a spec directory: {path}"
        )
        return _document(
            spec_dir=spec_dir,
            specs_root=root,
            path=path,
            read_at=read_at,
            documents=[],
            degraded=[_note("transport", detail, path)],
            revision=revision,
            dirty=dirty,
        )

    documents: list[dict] = []
    degraded: list[dict] = []
    for name in TRIO:
        entry, note = _read_document(path / name, name)
        documents.append(entry)
        if note is not None:
            degraded.append(note)

    return _document(
        spec_dir=spec_dir,
        specs_root=root,
        path=path,
        read_at=read_at,
        documents=documents,
        degraded=degraded,
        revision=revision,
        dirty=dirty,
    )


def read_revision(tree: Path | str) -> tuple[str | None, bool | None]:
    """`(revision, dirty)` for the working tree at `tree`, or `(None, None)`.

    Two facts, because one of them alone would be a half-truth: the commit the
    tree is on, and whether the tree is still that commit.  The operator's
    checkout is where specs are edited, so a room that named only the revision
    would name a commit whose `spec.md` is not the one it just rendered.

    `(None, None)` is *unknown* and never a failure: a directory that is not in
    a repository has no revision to withhold.  See the module docstring.
    """
    from factory.workgraph.worktree import WorktreeError, _git

    path = Path(tree)
    try:
        revision = _git(path, "rev-parse", "HEAD").strip()
        status = _git(path, "status", "--porcelain")
    except (WorktreeError, OSError):
        return None, None

    if not revision:
        return None, None
    return revision, bool(status.strip())


def _read_document(path: Path, name: str) -> tuple[dict, dict | None]:
    """One document's entry, and the degraded note reading it produced, if any.

    `FileNotFoundError` is the one failure that is not a failure: it is absence,
    it is the common case in this corpus, and it is quiet (FR-002).
    """
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return _absent(name), None
    except (OSError, UnicodeDecodeError) as exc:
        # A document that is *there* and will not read is a read that could not
        # be made — a different fact from a document that is not there, and the
        # only one of the two the operator needs told about.
        return _absent(name), _note("transport", f"{name} at {path}: {exc}", path)

    return (
        {"name": name, "present": True, "empty": text == "", "text": text},
        None,
    )


def _absent(name: str) -> dict:
    """The entry for a document that is not there.

    Every name in the trio is always answered for, so absence is a fact the room
    can render rather than a shorter list it has to infer something from.
    """
    return {"name": name, "present": False, "empty": False, "text": None}


def _note(mode: str, detail: str, path: Path | None) -> dict:
    """One degraded read, in the triple the Showfloor's rail notes already use.

    `path` rides alongside so the room can name what it tried without parsing it
    back out of the sentence, and is `None` exactly when no path was formed —
    a refused name is refused *before* the join, so there is nothing to report
    having tried.
    """
    return {
        "read": DRAFT_READ,
        "mode": mode,
        "detail": sweep(detail),
        "path": None if path is None else str(path),
    }


def _document(
    *,
    spec_dir: str,
    specs_root: Path,
    path: Path | None,
    read_at: str,
    documents: list[dict],
    degraded: list[dict],
    revision: str | None = None,
    dirty: bool | None = None,
) -> dict:
    """The one shape `GET /api/draft/<spec-dir>` answers in, however it went."""
    return {
        "spec_dir": spec_dir,
        "specs_root": str(specs_root),
        "path": None if path is None else str(path),
        "revision": revision,
        "revision_short": None if revision is None else revision[:7],
        "dirty": dirty,
        "read_at": read_at,
        "documents": documents,
        "degraded": degraded,
    }
