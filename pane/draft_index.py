"""The drafting table's index: what the corpus holds, and when it was read.

`pane/draft.py` answers *what does `specs/<dir>/` hold*.  This module answers the
other question the third room needs — *what does the corpus hold* — and they
share a room and nothing else (018 plan D1).  Two reads, two documents: widening
`read_draft` to answer both would give one shape two meanings, and the trio's
signature is landed and attested.

**`read_roadmap` owns the grammar and this repository parses nothing** (FR-003,
plan D2).  `factory.roadmap.models.read_roadmap` walks `specs/<dir>/spec.md`,
reads each leading frontmatter block, defaults a spec that carries none to
`draft`, and returns its entries in its own sorted order.  Every one of those is
a decision this repository takes from the seam: the order below is the seam's
order, the state is the seam's state, and no `spec.md` is opened here.  A second
frontmatter reader in this repository is D-005 by construction, and it would
disagree with the roadmap that dispatches the specs on the first spec that
carried an unknown key.

**An empty corpus and a corpus that could not be read are two different facts,
and neither is rendered as the other** (FR-005, plan § Named traps).

* An **empty** corpus answers with no specs and **no degraded note**.  A `specs/`
  root holding nothing is a true and unremarkable answer; degrading it would put
  a warning on a fresh checkout that has yet to be written in.
* A corpus that **could not be read** — a root that is not there, a root that is
  not a directory, a root the process may not walk, or a spec whose frontmatter
  will not parse — answers with **no specs and a named note**, in the same
  `degraded` triple the Showfloor's rail notes and the trio's own notes use.  The
  note names the seam it came from, so an operator reads *which* read failed
  rather than *that something* did.

The absent root is the one place this module does not simply relay the seam.
`read_roadmap` treats a missing root as an empty corpus by its own FR-005, which
is right for a roadmap that must keep ticking and wrong for a room: "the corpus
holds no specs" and "there is no corpus" are the two claims constitution III
exists to keep apart, and the room that showed the first when the second was
true would be describing a `PANE_SPECS_ROOT` typo as an empty morning's work.
So the root is checked for being a readable directory *before* the seam is asked,
and the check is a `stat`, never a walk — the walking is the seam's.

**The read stamp is 014's, not a second one** (FR-006, plan D3).  The revision
and the read instant come from `pane.draft.read_revision`, the same reader the
trio uses, including its ruling that a directory which is not a repository
yields `unknown` rather than a degraded note.  Two stamps that disagreed about
what a non-repository means would disagree on the first constructed corpus, and
this suite is full of them.
"""

from __future__ import annotations

from pathlib import Path

from pane.draft import read_revision
from pane.intake import utc_now
from pane.sweep import sweep

#: The read's name when the failure is the root itself — it was never walked, so
#: no seam is named for it.  The same word `pane/showfloor.py` writes for the
#: same fact, because one room reading two documents must not spell one failure
#: two ways.
SPECS_ROOT_READ = "specs_root"

#: The read's name when the corpus was walked and would not parse.  It is the
#: seam's own function name: FR-005 asks the note to name what could not be
#: learned *and* who could not learn it, and a note under a label this
#: repository invented would be the pane's answer wearing a seam's clothes.
ROADMAP_READ = "read_roadmap"


def read_corpus(specs_root: Path | str) -> dict:
    """Every spec the corpus holds, in `read_roadmap`'s order, with its state.

    Always answers; never raises.  The one shape `GET /api/draft` replies in,
    however the read went — a room whose failure path returned a different
    document would be a room with two contracts (`pane/draft.py`'s `read_trio`
    is the precedent this follows).
    """
    root = Path(specs_root)
    read_at = utc_now()
    revision, dirty = read_revision(root)

    specs, degraded = _walk(root)

    return {
        "specs_root": str(root),
        "revision": revision,
        "revision_short": None if revision is None else revision[:7],
        "dirty": dirty,
        "read_at": read_at,
        "specs": specs,
        "degraded": degraded,
    }


def _walk(root: Path) -> tuple[list[dict], list[dict]]:
    """The corpus through the seam, or the one note saying why there is none.

    Returns `([], [note])` for a read that could not be made and `([], [])` for a
    corpus that is genuinely empty — the two answers FR-005 keeps apart.
    """
    if not root.exists():
        return [], [_note(SPECS_ROOT_READ, "transport", f"no such specs root: {root}", root)]
    if not root.is_dir():
        return [], [_note(SPECS_ROOT_READ, "transport", f"not a specs root: {root}", root)]

    from factory.roadmap.models import RoadmapError, read_roadmap

    try:
        roadmap = read_roadmap(root)
    except OSError as exc:
        # The root is there and would not be walked: a permission, a broken
        # link, a filesystem that answered no.  Transport, in the pane's
        # vocabulary — the read could not be made.
        return [], [_note(SPECS_ROOT_READ, "transport", str(exc), root)]
    except RoadmapError as exc:
        # The corpus was walked and does not parse.  The seam raises with every
        # fault it found and emits no partial roadmap by design; that discipline
        # is kept rather than second-guessed, because half a corpus rendered as
        # the whole one is the failure this room would be blamed for.
        return [], [_note(ROADMAP_READ, "unparseable", str(exc), root)]

    # The seam's order, the seam's states.  `str()` on the `StrEnum` so the
    # document carries the declared word — `draft`, `ready`, `deferred`,
    # `landed` — and never a member name no operator typed.
    return [
        {"spec_dir": entry.spec_dir, "state": str(entry.state)} for entry in roadmap.entries
    ], []


def _note(read: str, mode: str, detail: str, path: Path | None) -> dict:
    """One degraded read, in the quadruple `pane/draft.py`'s notes already use.

    Same four fields as the trio's, so the room renders both kinds of note
    through one shape and neither has to be parsed back out of a sentence.
    """
    return {
        "read": read,
        "mode": mode,
        "detail": sweep(detail),
        "path": None if path is None else str(path),
    }
