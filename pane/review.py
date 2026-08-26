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

**The room says which revision the service is serving** (011 US2, FR-009 and
FR-010).  Everything above is a fact about the *branch*; the room the operator is
looking at is served by *this process*, and the two can differ.  So every
answer — the document and the refusal alike — carries a `served` block naming
the revision this service is on and whether that revision already contains the
epic's landings, with the stories it does not carry named.  `pane/revision.py`
holds the reads and the reasoning; what matters here is that `contains_epic` has
three values and the third is `None`, because "this revision does not contain
the epic" and "I could not tell" are different sentences and only one of them is
an alarm.

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

from pane.landing import LandingFact, read_changed_files
from pane.readers import QueryRefused, TransportFailed
from pane.revision import ServedRevision, read_served_revision, revision_contains
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
        self,
        spec_dir: str,
        unmerged: list[dict],
        landing_branch: str | None,
        served: dict | None = None,
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
        #: The served-revision header, which FR-009 says is on *every* render.
        #: A refusal is a render: the operator is looking at this room, and the
        #: revision the service is serving is as true of the refusal screen as
        #: of the document behind it.
        self.served = served

    def as_document(self) -> dict:
        return {
            "error": "the epic is not fully landed",
            "spec_dir": self.spec_dir,
            "landing_branch": self.landing_branch,
            "unmerged": list(self.unmerged),
            "served": self.served,
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
    #: The revision this service is serving (FR-009).  `None` is a build that
    #: has no way to ask — the header then reads unknown rather than inventing a
    #: revision, and it is never confused with a read that was made and failed.
    served_revision: Callable[[], ServedRevision] | None = None
    #: Whether a revision carries a landing commit (FR-010), asked once per
    #: story.  Paired with the read above: a room that knew which revision it was
    #: serving and could not place a commit in it has lost half the answer, and
    #: says which half.
    revision_contains: Callable[[str, str], bool] | None = None

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

        **Unless the reader has the two reads recorded** (016 FR-001, FR-003).
        This room is the one that could not tolerate a blind landing read: it
        refuses a partially landed epic by name, so a read that saw nothing did
        not degrade — it produced a confident refusal of every epic on the floor.
        A demo floor therefore answers both git reads from `fixtures/`, and both
        take the recording's own rule for a document it does not hold: a named
        degraded read, never an empty answer (plan D3).  A live reader has no
        recording, gets both git-backed reads, and is untouched (FR-004).

        The graph read is `ShowfloorReaders`' own binding, borrowed rather than
        rebuilt: where a compiled graph lives (the seam first, this repository's
        archive second) is one fact with one answer, and a second binding here
        would be a second answer waiting to disagree with it.

        **The two revision reads take the same swap** (011 US2, FR-009).  They
        were the one place it was tempting not to: the revision a service is
        serving is a fact about *this process* rather than about the factory's
        work, so the instinct is that it must reach real git or say nothing.  It
        must not.  016 FR-002 and FR-003 are unconditional — under `PANE_DEMO=1`
        no room spawns a subprocess and every room answers the same in a checkout
        with no history — and a demo floor is a recording of a floor, header
        included.  So a recorded reader answers from `fixtures/revision/`, and a
        live reader, which has a real checkout under it, reads real git.
        """
        from pane.config import DEFAULT_LANDING_BRANCH
        from pane.landing import reader_for
        from pane.readers import recorded_git_reads
        from pane.showfloor import ShowfloorReaders

        root = Path(specs_root)
        repo = root.parent
        branch = landing_branch or DEFAULT_LANDING_BRANCH
        showfloor = ShowfloorReaders.from_reader(reader, root, landing_branch=branch)
        recorded = recorded_git_reads(reader)
        return cls(
            landing_facts=(
                recorded.landing_facts
                if recorded is not None
                else reader_for(repo, branch).facts
            ),
            changed_files=(
                recorded.changed_files
                if recorded is not None
                else lambda commit: read_changed_files(repo, commit)
            ),
            workgraph=showfloor.workgraph,
            landing_branch=branch,
            manifest=manifest,
            served_revision=(
                recorded.served_revision
                if recorded is not None
                else lambda: read_served_revision(repo)
            ),
            revision_contains=(
                recorded.revision_contains
                if recorded is not None
                else lambda revision, commit: revision_contains(repo, revision, commit)
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

    served = _served_revision(story_keys, headings, facts, landing_read, readers)

    if landing_read:
        unmerged = [
            {"story_key": key, "title": _title(key, headings)}
            for key in story_keys
            if not (key in facts and facts[key].on_branch)
        ]
        if unmerged:
            raise EpicNotLanded(spec_dir, unmerged, readers.landing_branch, served)

    stories = [
        _assemble_story(key, headings, facts.get(key), manifest, readers)
        for key in story_keys
    ]

    return {
        "spec_dir": spec_dir,
        "name": name,
        "landing_branch": readers.landing_branch,
        "story_source": story_source,
        "served": served,
        "stories": stories,
        "routes": _reached_routes(stories, manifest),
        "notes": notes,
    }


def _served_revision(
    story_keys: list[str],
    headings: dict[str, StoryHeading],
    facts: dict[str, LandingFact],
    landing_read: bool,
    readers: ReviewReaders,
) -> dict:
    """The revision this service is serving, and whether it carries this epic.

    FR-009 and FR-010, and the whole of what the room can honestly say about the
    question the operator cannot otherwise ask: *is what I am looking at built
    from the work I came to review?*  The room renders the running service.  If
    the service is not serving the epic under review, every note taken in it is
    about a different surface, and the operator has no way to notice from the
    screen itself.

    **Three answers, and none of them is another** (constitution III).
    `contains_epic` is `True` when every one of the epic's landings is already in
    the served revision, `False` when at least one is not — and `missing` names
    which, because a mismatch stated without its particulars is a warning the
    operator cannot act on — and **`None` when the question could not be
    asked**.  A checkout cloned shallow cannot place a commit it does not have,
    and a room that reported `False` on the strength of a read nobody completed
    would spend FR-010's alarm on a fact it had not established.  The alarm has
    to be believed the one time it is real.
    """
    notes: list[dict] = []

    if readers.served_revision is None:
        # A build with no way to ask.  Not a failure, and so not a note: it is
        # the Unknown Rule on every field, which is what `unknown` carries.
        return {
            "revision": None,
            "short_revision": None,
            "branch": None,
            "committed_at": None,
            "subject": None,
            "contains_epic": None,
            "missing": [],
            "unknown": ["revision", "branch", "committed_at", "subject"],
            "notes": notes,
        }

    try:
        served: ServedRevision | None = readers.served_revision()
    except (TransportFailed, QueryRefused) as exc:
        notes.append({"read": exc.read, "mode": _mode(exc), "detail": exc.detail})
        served = None

    contains, missing = _contains_epic(
        served, story_keys, headings, facts, landing_read, readers, notes
    )

    return {
        "revision": None if served is None else served.revision,
        "short_revision": None if served is None else served.short_revision,
        "branch": None if served is None else served.branch,
        "committed_at": None if served is None else served.committed_at,
        "subject": None if served is None else served.subject,
        "contains_epic": contains,
        "missing": missing,
        "unknown": [
            field
            for field, value in (
                ("revision", None if served is None else served.revision),
                ("branch", None if served is None else served.branch),
                ("committed_at", None if served is None else served.committed_at),
                ("subject", None if served is None else served.subject),
            )
            if value is None
        ],
        "notes": notes,
    }


def _contains_epic(
    served: ServedRevision | None,
    story_keys: list[str],
    headings: dict[str, StoryHeading],
    facts: dict[str, LandingFact],
    landing_read: bool,
    readers: ReviewReaders,
    notes: list[dict],
) -> tuple[bool | None, list[dict]]:
    """Whether the served revision carries every story, and which it does not.

    A story the branch carries nothing for is missing from the served revision by
    construction — there is no commit for it to contain — and it is reported that
    way rather than skipped, because this function also answers for the refusal
    screen, where *not landed* is exactly the condition.
    """
    if served is None or not landing_read or readers.revision_contains is None:
        return None, []

    missing: list[dict] = []
    for story_key in story_keys:
        fact = facts.get(story_key)
        if fact is None or not fact.on_branch:
            missing.append(
                {"story_key": story_key, "title": _title(story_key, headings)}
            )
            continue
        try:
            carried = readers.revision_contains(served.revision, fact.commit)
        except (TransportFailed, QueryRefused) as exc:
            notes.append({"read": exc.read, "mode": _mode(exc), "detail": exc.detail})
            return None, []
        if not carried:
            missing.append(
                {"story_key": story_key, "title": _title(story_key, headings)}
            )

    return not missing, missing


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
