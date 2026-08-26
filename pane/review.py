"""The review room's document: what an epic changed, and which screens it reaches.

The room this serves is the second HITL surface (spec 011, D-023).  An epic
lands; the operator opens `/review/<spec-dir>` and reads what it actually
changed — story by story, with the landing SHA, the pull request number and the
squash subject the merge queue wrote — and, beside each changed file, the routes
that file can be seen at.

**Everything here is a read, and every read is borrowed** (constitution II).
The landing facts and the changed-file list both ride `pane/landing.py`, which
rides `factory.workgraph.landed.landed_facts` and ergane's own `_git` helper;
this module spawns nothing, imports no `subprocess`, and writes nothing at all.

**The one thing this module owns is the manifest**, and it owns it because
nothing exports it.  A diff names files; the operator wants screens; no seam in
the ergane distribution knows how a path becomes a route, because the mapping is
a fact about *this* application and not about the factory.  So it is committed,
in `route-manifest.json` beside the code, deliberately honest and dumb (plan
D3) — and it is guarded by `tests/test_route_manifest.py` and
`web/tests/unit/routeManifest.test.ts`, which assert that every route the pane
serves appears in it (FR-005).  A manifest that can rot in silence is worth
nothing.

**A partially landed epic is refused, by name** (FR-004, plan D4).  A review of
half an epic produces notes about a surface that is about to change and leaves
the operator unable to say which half they looked at, so the room does not
render one — it says which stories have not merged and stops.  The one case that
is *not* a refusal is a landing read that failed: not knowing whether a story
merged is a degraded read, named as one in the room's notes (constitution III),
never a story reported unmerged on the strength of a read nobody made.
"""

from __future__ import annotations

import dataclasses
import json
import re
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from pane.readers import Reader

from pane.landing import (
    LandingFact,
    commit_contained,
    read_changed_files,
    read_served_revision,
)
from pane.readers import QueryRefused, TransportFailed
from pane.showfloor import StoryHeading, parse_spec_name, parse_story_headings

#: The committed manifest, beside the code it describes.  A deployment that
#: keeps it elsewhere passes a path; nothing here reads an environment variable.
DEFAULT_MANIFEST_PATH = Path(__file__).resolve().parents[1] / "route-manifest.json"

#: The read named in a note when the manifest itself could not be read.
MANIFEST_READ = "route_manifest"

#: A spec directory is one path segment of the corpus, and this is the whole of
#: what may be in it.  A request off this grammar is answered as a directory the
#: corpus does not have, never resolved against the filesystem first.
_SPEC_DIR_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


# --- the manifest ----------------------------------------------------------


@dataclasses.dataclass(frozen=True)
class ManifestRoute:
    """One route the application serves, as the manifest declares it.

    `kind` is `room` for a screen the operator can look at, `api` for a document
    route, `shell` for the guarded catch-all that serves the rooms.  US2 renders
    the rooms; every kind is listed, because FR-005's guarantee is over all of
    them.
    """

    path: str
    kind: str
    name: str


@dataclasses.dataclass(frozen=True)
class RoutePattern:
    """One source-path pattern and the routes a file matching it reaches."""

    pattern: str
    routes: tuple[str, ...]


@dataclasses.dataclass(frozen=True)
class FileRoutes:
    """One changed file, resolved.

    `matched` is not decoration.  A file no pattern names and a file a pattern
    deliberately maps to nothing both reach no known route, and the room says
    so either way — but only one of them is evidence that the manifest has
    fallen behind the tree, and a document that collapsed them could not tell
    the operator which they are looking at (FR-003).
    """

    path: str
    routes: tuple[str, ...]
    matched: bool

    def as_document(self) -> dict:
        return {"path": self.path, "routes": list(self.routes), "matched": self.matched}


class RouteManifest:
    """The committed path-pattern → route mapping, loaded and asked.

    Patterns are glob-ish and their semantics are stated in the manifest's own
    `about`: `*` matches inside one path segment and `**` matches across
    separators.  *Every* matching pattern contributes, so the order of the file
    does not decide the answer — a mapping whose meaning depended on which line
    came first would be a mapping nobody could edit safely.
    """

    def __init__(self, routes: list[ManifestRoute], patterns: list[RoutePattern]) -> None:
        self.routes = tuple(routes)
        self.patterns = tuple(patterns)
        self._order = {route.path: index for index, route in enumerate(self.routes)}
        self._compiled = tuple((_compiled(item.pattern), item) for item in self.patterns)

        for item in self.patterns:
            for route in item.routes:
                if route not in self._order:
                    raise ValueError(
                        f"route-manifest: pattern {item.pattern!r} names {route!r}, "
                        "which the manifest does not declare as a route"
                    )

    @classmethod
    def load(cls, path: Path | str | None = None) -> "RouteManifest":
        """The manifest at `path`, or the committed one beside the code.

        `OSError` for a manifest that is not there and `ValueError` for one that
        does not parse: the two are told apart here for the same reason every
        read in this pane tells them apart (constitution III).
        """
        source = Path(path) if path is not None else DEFAULT_MANIFEST_PATH
        try:
            raw = json.loads(source.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"{source}: the route manifest does not parse: {exc}") from exc

        routes = [
            ManifestRoute(
                path=str(entry["path"]),
                kind=str(entry.get("kind", "room")),
                name=str(entry.get("name", entry["path"])),
            )
            for entry in raw.get("routes", [])
        ]
        patterns = [
            RoutePattern(
                pattern=str(entry["pattern"]),
                routes=tuple(str(route) for route in entry.get("routes", [])),
            )
            for entry in raw.get("patterns", [])
        ]
        return cls(routes, patterns)

    def route_paths(self) -> tuple[str, ...]:
        return tuple(route.path for route in self.routes)

    def route(self, path: str) -> ManifestRoute | None:
        for route in self.routes:
            if route.path == path:
                return route
        return None

    def resolve(self, file_path: str) -> FileRoutes:
        """The routes one changed path reaches, in the manifest's own order."""
        normalised = _normalised(file_path)
        found: set[str] = set()
        matched = False
        for expression, pattern in self._compiled:
            if expression.match(normalised) is None:
                continue
            matched = True
            found.update(pattern.routes)
        ordered = tuple(sorted(found, key=lambda route: self._order[route]))
        return FileRoutes(path=file_path, routes=ordered, matched=matched)


def _normalised(file_path: str) -> str:
    """A repository-relative path in the one spelling patterns are written in."""
    text = file_path.replace("\\", "/").strip()
    while text.startswith("./"):
        text = text[2:]
    return text.lstrip("/")


def _compiled(pattern: str) -> re.Pattern[str]:
    """One glob-ish pattern as an anchored expression.

    Written out rather than handed to `fnmatch` because `fnmatch`'s `*` crosses
    a path separator: under it `web/src/*.tsx` would match
    `web/src/desk/Desk.tsx`, and a manifest whose patterns quietly reach further
    than they read is exactly the kind of dishonesty this file is guarding.
    """
    out: list[str] = []
    index = 0
    while index < len(pattern):
        character = pattern[index]
        if character == "*":
            if pattern[index : index + 2] == "**":
                out.append(".*")
                index += 2
                continue
            out.append("[^/]*")
        elif character == "?":
            out.append("[^/]")
        else:
            out.append(re.escape(character))
        index += 1
    return re.compile("^" + "".join(out) + "$")


# --- the two refusals ------------------------------------------------------


class SpecNotFound(Exception):
    """No spec of that directory is in the corpus this pane is serving.

    Raised for a directory off the corpus and for a directory off the *grammar*
    alike: a request whose spelling could not name a spec is answered as a miss
    and never resolved against the filesystem first.
    """

    def __init__(self, spec_dir: str) -> None:
        super().__init__(f"no spec directory {spec_dir!r} is in this corpus")
        self.spec_dir = spec_dir

    def as_document(self) -> dict:
        return {"error": "no such spec directory", "spec_dir": self.spec_dir}


class EpicNotLanded(Exception):
    """The epic has a story the landing branch does not carry (FR-004, plan D4).

    A review of half an epic produces notes about a surface that is about to
    change and leaves the operator unable to say which half they looked at, so
    the room does not render one.  It names the stories instead — with their
    titles, so the refusal reads as a sentence about the work rather than a list
    of keys — and the operator comes back when the epic has landed.
    """

    def __init__(
        self, spec_dir: str, unmerged: list[dict], landing_branch: str | None
    ) -> None:
        named = ", ".join(story["story_key"] for story in unmerged)
        super().__init__(
            f"{spec_dir} is not fully landed: {named} "
            f"{'has' if len(unmerged) == 1 else 'have'} not merged"
            + (f" to {landing_branch}" if landing_branch else "")
        )
        self.spec_dir = spec_dir
        self.unmerged = unmerged
        self.landing_branch = landing_branch

    def as_document(self) -> dict:
        return {
            "error": "the epic is not fully landed",
            "spec_dir": self.spec_dir,
            "landing_branch": self.landing_branch,
            "unmerged": list(self.unmerged),
            "detail": str(self),
        }


# --- the reads -------------------------------------------------------------


@dataclasses.dataclass(frozen=True)
class ReviewReaders:
    """The reads one review document needs, injected rather than imported.

    Callables, for the reason `ShowfloorReaders` gives: every failure shape is
    then drivable from a committed test with no live floor and no factory.

    `workgraph` is optional and its absence is not a failure — story identity
    falls back to the spec's own `### User Story <n>` headings, and the document
    says which of the two it used in `story_source`, so a room can never imply a
    compiled graph it did not read.
    """

    landing_facts: Callable[[str], dict[str, LandingFact]]
    changed_files: Callable[[str], list[str]]
    workgraph: Callable[[str], dict] | None = None
    #: The branch the landing read read.  A setting, never a literal spelt into
    #: a reader (009 plan D3); `None` is a build that did not say.
    landing_branch: str | None = None
    #: The manifest, loaded once by a caller that serves many requests.  `None`
    #: loads the committed one per assembly.
    manifest: RouteManifest | None = None
    #: `() -> (revision, dirty)` for the checkout the service runs from (011
    #: FR-009).  `None` is a build with no such read bound at all, which is a
    #: different thing from a read that answered `unknown` — and both render as
    #: a revision nobody can name, because neither is a claim about the tree.
    served_revision: Callable[[], tuple[str | None, bool | None]] | None = None
    #: `(revision, commit) -> bool`: does the served revision hold that landing
    #: (011 FR-010)?  Injected for the reason every other read here is — every
    #: failure shape is then drivable from a committed test with no repository.
    contains: Callable[[str, str], bool] | None = None

    @classmethod
    def from_reader(
        cls,
        reader: "Reader",
        specs_root: Path | str,
        *,
        landing_branch: str | None = None,
        manifest: RouteManifest | None = None,
    ) -> "ReviewReaders":
        """Bind the reads to 001's reader seam and to the checkout it serves.

        The repository is `specs/`'s parent, exactly as the showfloor's landing
        read resolves it: the corpus is a directory *of* the target repository,
        so its parent is the checkout whose landing branch carries the landings.
        The landing reader is the process's memoised one (`pane.landing.
        reader_for`) — the branch scan is expensive and pure, and a review is
        one more caller of the same read the showfloor already pays for.

        The graph read is `ShowfloorReaders`' own binding, borrowed rather than
        rebuilt: where a compiled graph lives (the seam first, this repository's
        archive second) is one fact with one answer, and a second binding here
        would be a second answer waiting to disagree with it.
        """
        from pane.config import DEFAULT_LANDING_BRANCH
        from pane.landing import reader_for
        from pane.showfloor import ShowfloorReaders

        root = Path(specs_root)
        repo = root.parent
        branch = landing_branch or DEFAULT_LANDING_BRANCH
        showfloor = ShowfloorReaders.from_reader(reader, root, landing_branch=branch)
        return cls(
            landing_facts=reader_for(repo, branch).facts,
            changed_files=lambda commit: read_changed_files(repo, commit),
            workgraph=showfloor.workgraph,
            landing_branch=branch,
            manifest=manifest,
            # The served revision is the *checkout's*, not the branch's, and the
            # difference is the whole of FR-010: the branch is where the epic
            # landed and the checkout is what this process is serving, and a
            # deployment started from a pinned SHA has them disagree.  Read
            # fresh on every assembly rather than memoised the way the landing
            # scan is — the roadmap hard-resets the operator's checkout every
            # tick (N50), so a cached revision is the exact lie FR-009 exists to
            # prevent, and it is two git commands rather than a history walk.
            served_revision=lambda: read_served_revision(repo),
            contains=lambda revision, commit: commit_contained(
                repo, revision, commit
            ),
        )


# --- the document ----------------------------------------------------------


def assemble_review(
    specs_root: Path | str, spec_dir: str, readers: ReviewReaders
) -> dict:
    """Everything the what-changed track renders for one landed epic.

    Raises `SpecNotFound` for a directory this corpus does not have and
    `EpicNotLanded` for an epic with a story the branch does not carry.  Every
    *other* failure is a note (constitution III): the room renders, and says in
    place which read it could not make.
    """
    root = Path(specs_root)
    if _SPEC_DIR_RE.match(spec_dir) is None:
        raise SpecNotFound(spec_dir)

    try:
        text = (root / spec_dir / "spec.md").read_text(encoding="utf-8")
    except OSError as exc:
        raise SpecNotFound(spec_dir) from exc

    notes: list[dict] = []
    headings = parse_story_headings(text)
    name = parse_spec_name(text) or spec_dir

    story_keys, story_source = _story_identity(spec_dir, headings, readers, notes)
    manifest = _manifest(readers, notes)
    facts, landing_read = _landing_facts(spec_dir, readers, notes)

    if landing_read:
        unmerged = [
            {"story_key": key, "title": _title(key, headings)}
            for key in story_keys
            if not (key in facts and facts[key].on_branch)
        ]
        if unmerged:
            raise EpicNotLanded(spec_dir, unmerged, readers.landing_branch)

    stories = [
        _assemble_story(key, headings, facts.get(key), manifest, readers)
        for key in story_keys
    ]

    return {
        "spec_dir": spec_dir,
        "name": name,
        "landing_branch": readers.landing_branch,
        "story_source": story_source,
        "stories": stories,
        "routes": _reached_routes(stories, manifest),
        "served": _served(stories, readers),
        "notes": notes,
    }


def _served(stories: list[dict], readers: ReviewReaders) -> dict:
    """The revision the service is serving, and whether it holds this epic.

    FR-009 and FR-010, and the reason both are requirements rather than niceties
    is that this room reviews the *running service*.  It builds no branch: what
    the operator sees in the frame is whatever this process is serving, so if
    that is not the tree the epic landed in, the screens are about something
    else and so is every note taken beside them.

    **Three answers, and none of the three may be rendered as another.**
    `contains_epic` is `True` when every landing is reachable from the served
    revision, `False` when at least one is not — `missing` names those, with
    their SHAs, because "the revision is wrong" is not actionable without "wrong
    by what" — and `None` when the question could not be asked at all.  A `None`
    read as a mismatch sends the operator after a deployment that is fine; a
    mismatch read as unknown lets them review the wrong thing in silence
    (constitution III).

    **A partial answer that already contains a "no" is a no.**  Two things can
    leave the walk incomplete: a story the branch could not place (`unplaced`,
    which has no commit to ask about) and a containment read that failed
    (`notes`).  Either one costs the document its `True` — the revision cannot
    be cleared on a question nobody finished asking.  Neither costs it a `False`
    that was already established: a landing this walk has *seen* the revision
    lack is a mismatch whatever happened afterwards, and discarding it would be
    the one direction of this rule that lets the operator review the wrong thing
    in silence.
    """
    revision, dirty = (
        (None, None) if readers.served_revision is None else readers.served_revision()
    )
    served: dict[str, Any] = {
        "revision": revision,
        # Cut once, server-side, for the reason a landing SHA is: two renderings
        # of one revision can disagree about length, and the operator compares
        # these two spellings by eye.
        "short_revision": None if revision is None else revision[:12],
        "dirty": dirty,
        "contains_epic": None,
        "missing": [],
        "unplaced": [],
        "notes": [],
    }

    served["unplaced"] = [
        story["story_key"] for story in stories if story["commit"] is None
    ]
    placed = [
        (story["story_key"], story["commit"])
        for story in stories
        if story["commit"] is not None
    ]
    if revision is None or readers.contains is None or not placed:
        return served

    missing: list[dict] = []
    unread = False
    for story_key, commit in placed:
        try:
            held = readers.contains(revision, commit)
        except (TransportFailed, QueryRefused) as exc:
            served["notes"].append(
                {"read": exc.read, "mode": _mode(exc), "detail": exc.detail}
            )
            # The walk stops at the first read that could not be made: git is
            # either answering this question or it is not, and asking again once
            # per story would spend a subprocess apiece to say so four times.
            # What the walk found before that stands.
            unread = True
            break
        if not held:
            missing.append(
                {
                    "story_key": story_key,
                    "commit": commit,
                    "short_commit": commit[:12],
                }
            )

    served["missing"] = missing
    if missing:
        served["contains_epic"] = False
    elif not unread and not served["unplaced"]:
        served["contains_epic"] = True
    return served


def _assemble_story(
    story_key: str,
    headings: dict[str, StoryHeading],
    fact: LandingFact | None,
    manifest: RouteManifest | None,
    readers: ReviewReaders,
) -> dict:
    """One story's landing, its changed files, and the routes they reach."""
    notes: list[dict] = []
    files: list[FileRoutes] = []

    if fact is not None:
        try:
            changed = readers.changed_files(fact.commit)
        except (TransportFailed, QueryRefused) as exc:
            notes.append({"read": exc.read, "mode": _mode(exc), "detail": exc.detail})
        else:
            files = [
                manifest.resolve(path)
                if manifest is not None
                else FileRoutes(path=path, routes=(), matched=False)
                for path in changed
            ]

    unknown = [
        field
        for field, value in (
            ("commit", None if fact is None else fact.commit),
            ("pr_number", None if fact is None else fact.pr_number),
            ("subject", None if fact is None else fact.subject),
            ("merged_at", None if fact is None else fact.merged_at),
        )
        if value is None
    ]

    return {
        "story_key": story_key,
        "title": _title(story_key, headings),
        "priority": None if story_key not in headings else headings[story_key].priority,
        "commit": None if fact is None else fact.commit,
        # The spelling the operator reads a landing by, cut once here rather
        # than in the room: two renderings of one SHA can disagree about length.
        "short_commit": None if fact is None else fact.commit[:12],
        "pr_number": None if fact is None else fact.pr_number,
        "subject": None if fact is None else fact.subject,
        "merged_at": None if fact is None else fact.merged_at,
        "kind": None if fact is None else fact.kind,
        "files": [entry.as_document() for entry in files],
        "routes": _ordered(
            {route for entry in files for route in entry.routes}, manifest
        ),
        "unknown": unknown,
        "notes": notes,
    }


def _reached_routes(stories: list[dict], manifest: RouteManifest | None) -> list[dict]:
    """Every route this epic reaches, each naming the stories that reach it.

    The union, in the manifest's own order, so US2 has one list to offer the
    operator and can tell a screen it may render in a frame (`kind: room`) from
    a document route it may not.
    """
    reached: dict[str, list[str]] = {}
    for story in stories:
        for route in story["routes"]:
            reached.setdefault(route, []).append(story["story_key"])

    out = []
    for path in _ordered(set(reached), manifest):
        declared = None if manifest is None else manifest.route(path)
        out.append(
            {
                "path": path,
                "kind": None if declared is None else declared.kind,
                "name": None if declared is None else declared.name,
                "stories": reached[path],
            }
        )
    return out


def _story_identity(
    spec_dir: str,
    headings: dict[str, StoryHeading],
    readers: ReviewReaders,
    notes: list[dict],
) -> tuple[list[str], str]:
    """The stories this epic declares, and where the declaration was read.

    The compiled graph first, the spec's own headings second — the showfloor's
    order, for the showfloor's reason: the graph is what dispatched, and a graph
    that will not read is a note rather than a room with no stories in it.
    """
    if readers.workgraph is not None:
        try:
            graph = readers.workgraph(spec_dir)
        except (TransportFailed, QueryRefused) as exc:
            notes.append({"read": exc.read, "mode": _mode(exc), "detail": exc.detail})
        except json.JSONDecodeError as exc:
            notes.append(
                {"read": "workgraph", "mode": "unparseable", "detail": str(exc)}
            )
        else:
            keys = [
                str(node["story_key"])
                for node in graph.get("nodes", [])
                if node.get("story_key")
            ]
            if keys:
                return sorted(set(keys), key=_story_order), "workgraph"

    return sorted(headings, key=_story_order), "spec.md"


def _landing_facts(
    spec_dir: str, readers: ReviewReaders, notes: list[dict]
) -> tuple[dict[str, LandingFact], bool]:
    """The branch's answer for this spec, and whether the read was made at all.

    The boolean is load-bearing and is the whole of constitution III here: a
    landing read that failed must never become an epic reported unmerged.  Not
    knowing whether a story merged is a degraded read, named in the room; it is
    not evidence that nothing landed.
    """
    try:
        return dict(readers.landing_facts(spec_dir)), True
    except (TransportFailed, QueryRefused) as exc:
        notes.append({"read": exc.read, "mode": _mode(exc), "detail": exc.detail})
        return {}, False


def _manifest(readers: ReviewReaders, notes: list[dict]) -> RouteManifest | None:
    """The manifest the caller passed, or the committed one; a failure is a note.

    A manifest that will not load costs the operator the route column and
    nothing else — every changed file still renders, reaching no known route,
    which is the answer FR-003 requires for a file the manifest cannot place.
    """
    if readers.manifest is not None:
        return readers.manifest
    try:
        return RouteManifest.load()
    except OSError as exc:
        notes.append({"read": MANIFEST_READ, "mode": "transport", "detail": str(exc)})
    except ValueError as exc:
        notes.append({"read": MANIFEST_READ, "mode": "unparseable", "detail": str(exc)})
    return None


def _ordered(routes: set[str], manifest: RouteManifest | None) -> list[str]:
    """Route paths in the manifest's own order; alphabetical without one."""
    if manifest is None:
        return sorted(routes)
    order = {route.path: index for index, route in enumerate(manifest.routes)}
    return sorted(routes, key=lambda route: (order.get(route, len(order)), route))


def _title(story_key: str, headings: dict[str, StoryHeading]) -> str:
    """The story's title, or its key when the spec's heading did not parse."""
    heading = headings.get(story_key)
    return story_key if heading is None else heading.title


def _story_order(story_key: str) -> tuple[str, int, str]:
    """`US10` after `US9`, not between `US1` and `US2`."""
    match = re.match(r"^([A-Za-z]*)(\d+)$", story_key)
    if match is None:
        return (story_key, 0, story_key)
    return (match.group(1), int(match.group(2)), story_key)


def _mode(exc: TransportFailed | QueryRefused) -> str:
    """001's two words, told apart in the note and never only in prose."""
    return "transport" if isinstance(exc, TransportFailed) else "refused"
