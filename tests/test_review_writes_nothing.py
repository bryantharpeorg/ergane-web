"""The review path writes nothing (011 US3: FR-014, SC-003, US3-S3).

FR-014 is absolute and it is the reason two of this spec's seven questions could
be closed at all: *the pane writes no file, creates no directory and mutates no
spec.*  The room composes a captured-TBD spec and hands the operator the bytes;
the operator saves it, or does not.  That is a claim about what happens when the
room runs, so it is asserted by running the room and watching.

**Three watchers, because one of them cannot see everything.**

* An audit hook over every write-intent operation this process makes — `open`
  in a mode that can write, `os.mkdir`, a rename, a removal, a store opened for
  writing.  Anything landing outside the test's own `tmp_path` is recorded and
  fails the case.  The hook is `tests/hermetic.py`'s idea applied to a different
  question: that module asks whether a read came from *host state*, this one
  asks whether a write happened *at all*.
* The repository's own corpus, hashed before and after.  `specs/` is what
  FR-014 names, so it is compared file by file — every path, every byte — and
  the root's own entries are compared too, because "creates no directory" is a
  claim about paths that did not exist before.
* The subprocess log.  The changed-file read rides ergane's git wrapper
  (`pane/landing.py`), and git is another process, so the audit hook above is
  blind to what it does.  What the hook *can* see is that a process was
  launched; what the corpus hash proves is that nothing it did reached this
  repository.  Naming that here is the honest version of the claim, and it is
  why the second watcher exists rather than being redundant with the first.

Every condition is constructed under `tmp_path` — a git repository this test
builds, with one commit per landing — for the reason `tests/corpus.py` gives at
length: a suite that asserted over this morning's corpus would go red the day an
epic lands with no line of source touched (008 US1).
"""

from __future__ import annotations

import dataclasses
import hashlib
import json
import os
import sys
from pathlib import Path

import pytest
from corpus import SpecFixture, build_landed_repository
from fastapi.testclient import TestClient
from hermetic import _as_path

from pane.app import create_app
from pane.config import Settings
from pane.review import assemble_review

ROOT = Path(__file__).resolve().parents[1]

#: A directory number no corpus of this repository uses, so nothing here reads
#: as an assertion about a spec the factory is actually building.
SPEC = "913-a-room-that-writes-nothing"

#: The four the recorded spec body carries — `tests/corpus.py` cuts its shape
#: from a real four-story spec, so an epic with three stories in it is one the
#: branch will always report a fourth missing from.
STORIES = ["US1", "US2", "US3", "US4"]

TOUCHED = {
    f"{SPEC}:US1": ["pane/showfloor.py", "web/src/showfloor/Stage.tsx"],
    f"{SPEC}:US2": ["web/src/review/Notes.tsx", "web/src/review/notes.ts"],
    f"{SPEC}:US3": ["docs/decisions.md"],
    f"{SPEC}:US4": ["pane/review.py"],
}

#: Audit events that are a write by construction — every one of them changes
#: something on a filesystem, and none of them has a read-only spelling.
WRITE_EVENTS: dict[str, int] = {
    "os.mkdir": 1,
    "os.remove": 1,
    "os.rename": 2,
    "os.rmdir": 1,
    "os.truncate": 1,
    "os.symlink": 2,
    "os.link": 2,
    "os.chmod": 1,
    "os.chown": 1,
    "os.utime": 1,
    "shutil.copyfile": 2,
    "shutil.copymode": 2,
    "shutil.copystat": 2,
    "shutil.copytree": 2,
    "shutil.move": 2,
    "shutil.rmtree": 1,
}

#: The modes and flags that make an `open` a write.  `open` is the one watched
#: event with a read-only spelling, so it is the one that needs a question asked
#: of its arguments rather than of its name.
WRITE_MODES = "wxa+"


@dataclasses.dataclass(frozen=True)
class Wrote:
    """One write-intent operation, and where it was aimed."""

    event: str
    path: str

    def __str__(self) -> str:
        return f"{self.event} {self.path}"


_writes: list[Wrote] | None = None
_spawned: list[str] = []
_installed = False


def _record(event: str, args: tuple) -> None:
    if _writes is None:
        return
    if event == "subprocess.Popen":
        program = _as_path(args[0]) if args else None
        _spawned.append(program or "<unnamed>")
        return
    if event == "open":
        mode = args[1] if len(args) > 1 else None
        flags = args[2] if len(args) > 2 else None
        if isinstance(mode, str):
            if not any(character in mode for character in WRITE_MODES):
                return
        elif isinstance(flags, int):
            if not flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_APPEND):
                return
        else:
            return
        path = _as_path(args[0]) if args else None
    elif event == "sqlite3.connect":
        path = _as_path(args[0]) if args else None
        # ergane's readers open their stores through a `mode=ro` URI; anything
        # else is a connection that could write, and the review path opens none.
        if isinstance(args[0], str) and "mode=ro" in args[0]:
            return
    elif event in WRITE_EVENTS:
        path = _as_path(args[0]) if args else None
    else:
        return
    if path is not None:
        _writes.append(Wrote(event, path))


def _install() -> None:
    """Add the hook once.  An audit hook cannot be removed, so it must be idle
    unless a case has switched recording on."""
    global _installed
    if _installed:
        return
    sys.addaudithook(_record)
    _installed = True


class Watching:
    """Everything written while the block ran, and everything launched."""

    def __init__(self) -> None:
        self.writes: list[Wrote] = []
        self.spawned: list[str] = []

    def outside(self, allowed: Path) -> list[Wrote]:
        root = str(allowed.resolve())
        return [
            write
            for write in self.writes
            if not (write.path == root or write.path.startswith(root + os.sep))
        ]


def watch() -> "_Watcher":
    return _Watcher()


class _Watcher:
    def __enter__(self) -> Watching:
        global _writes
        _install()
        self.observed = Watching()
        _spawned.clear()
        _writes = []
        return self.observed

    def __exit__(self, *_exc) -> None:
        global _writes
        self.observed.writes = list(_writes or [])
        self.observed.spawned = list(_spawned)
        _writes = None


# --- what the repository looked like, byte for byte ------------------------


def fingerprint(tree: Path) -> dict[str, str]:
    """Every file under `tree`, by path, by content hash.

    A new file appears as a new key, a deleted one as a missing key and an edit
    as a changed value — the three things FR-014 forbids, told apart rather than
    collapsed into "something changed".
    """
    prints: dict[str, str] = {}
    for path in sorted(tree.rglob("*")):
        relative = str(path.relative_to(tree))
        if path.is_dir():
            prints[relative + "/"] = "<directory>"
        elif path.is_file():
            prints[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    return prints


@pytest.fixture
def landed(tmp_path):
    """A repository under `tmp_path` whose branch carries every story."""
    return build_landed_repository(
        tmp_path,
        SpecFixture(SPEC, state="ready"),
        landings={SPEC: STORIES},
        files_by_story=TOUCHED,
    )


@pytest.fixture
def review_app(landed, credentials, tmp_path, monkeypatch):
    """The application, built *before* the watch so its own store is not the
    subject: what is being asserted is what the review path does, not what
    building an application does."""
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    settings = dataclasses.replace(
        Settings.from_env(), specs_root=landed.specs_root, landing_branch="dev"
    )
    (landed.specs_root / SPEC / "workgraph.json").write_text(
        json.dumps(landed.graph(SPEC)), encoding="utf-8"
    )
    return create_app(settings)


# --- the hook is real, and it catches a write ------------------------------


def test_the_watcher_sees_a_write_that_is_really_there(tmp_path):
    """Non-vacuous first: a watcher that saw nothing would pass over anything.

    The 001 US1-S1 defect in its own shape — a gate matching nothing is green
    for the wrong reason, and a sweep that cannot fail proves nothing about the
    room below it.
    """
    outside = Path(tmp_path).parent / f"{tmp_path.name}-outside"
    outside.mkdir()
    with watch() as observed:
        (outside / "a-file-the-room-must-never-write").write_text("x", encoding="utf-8")
        (outside / "a-directory-the-room-must-never-make").mkdir()

    assert [write.event for write in observed.outside(tmp_path)] == ["open", "os.mkdir"]
    assert any(
        write.path.endswith("a-file-the-room-must-never-write")
        for write in observed.outside(tmp_path)
    )
    # And a read of the same file is not a write, or the sweep would be an alarm
    # that goes off on every case and would stop being believed.
    with watch() as reading:
        (outside / "a-file-the-room-must-never-write").read_text(encoding="utf-8")
    assert reading.outside(tmp_path) == []


# --- FR-014: assembling the document writes nothing ------------------------


def test_assembling_the_review_document_writes_nothing(landed, tmp_path):
    with watch() as observed:
        document = assemble_review(landed.specs_root, SPEC, landed.review_readers())

    # Non-vacuous: the document is really the epic, so the reads under it really
    # ran.  A refusal or an empty document would write nothing either.
    assert [story["story_key"] for story in document["stories"]] == STORIES
    assert document["stories"][0]["commit"] is not None
    assert observed.outside(tmp_path) == []


def test_the_route_and_the_room_write_nothing(review_app, auth_headers, tmp_path):
    client = TestClient(review_app, headers=auth_headers)

    with watch() as observed:
        api = client.get(f"/api/review/{SPEC}")
        room = client.get(f"/review/{SPEC}")

    assert api.status_code == 200
    assert api.json()["spec_dir"] == SPEC
    # The room itself is the guarded SPA shell, and the shell is a build the
    # smoke gate makes and this suite does not — so it answers 200 where the
    # bundle is on disk and 503 where it is not.  Both are watched, because
    # "writes nothing" must hold on the answer the operator gets *and* on the
    # degraded one; what must never happen is the pane building something to
    # serve.
    assert room.status_code in {200, 503}
    assert observed.outside(tmp_path) == [], "\n".join(
        str(write) for write in observed.outside(tmp_path)
    )


def test_a_refusal_and_a_miss_write_nothing_either(
    half_landed_app, auth_headers, tmp_path
):
    """The two answers that are not a document, on the same terms.

    A refusal composes a body naming the unmerged stories and a miss composes
    nothing at all; neither is a path that could reach a save, and both are
    asserted rather than assumed because "the happy path writes nothing" is a
    weaker claim than the one FR-014 makes.
    """
    client = TestClient(half_landed_app, headers=auth_headers)

    with watch() as observed:
        refusal = client.get(f"/api/review/{SPEC}")
        miss = client.get("/api/review/999-no-such-spec")

    assert refusal.status_code == 409
    assert [story["story_key"] for story in refusal.json()["unmerged"]] == ["US3", "US4"]
    assert miss.status_code == 404
    assert observed.outside(tmp_path) == []


@pytest.fixture
def half_landed_app(tmp_path, credentials, monkeypatch):
    corpus = build_landed_repository(
        tmp_path,
        SpecFixture(SPEC, state="ready"),
        landings={SPEC: ["US1", "US2"]},
        files_by_story=TOUCHED,
    )
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    settings = dataclasses.replace(
        Settings.from_env(), specs_root=corpus.specs_root, landing_branch="dev"
    )
    return create_app(settings)


# --- FR-014, said the way the requirement says it --------------------------


def test_the_corpus_is_byte_identical_after_the_room_has_run(review_app, auth_headers):
    """No file, no directory, no spec — over this repository's own `specs/`.

    The audit hook above cannot see through the git subprocess the changed-file
    read rides, and this is the watcher that can: every path under `specs/`, and
    every entry at the repository root, hashed before and compared after.
    """
    client = TestClient(review_app, headers=auth_headers)
    before = fingerprint(ROOT / "specs")
    root_before = sorted(entry.name for entry in ROOT.iterdir())

    # Non-vacuous: a fingerprint of nothing is equal to a fingerprint of nothing,
    # and this comparison would then be green over a room that emptied `specs/`.
    assert len(before) > 10, "the corpus fingerprint read nothing"
    assert any(path.endswith("/spec.md") for path in before)

    assert client.get(f"/api/review/{SPEC}").status_code == 200
    assert client.get(f"/review/{SPEC}").status_code in {200, 503}

    after = fingerprint(ROOT / "specs")
    assert sorted(set(after) - set(before)) == [], "the room created a spec file"
    assert sorted(set(before) - set(after)) == [], "the room removed a spec file"
    assert after == before, "the room mutated a spec"
    assert sorted(entry.name for entry in ROOT.iterdir()) == root_before, (
        "the room created something at the repository root"
    )


def test_the_only_process_the_room_launches_is_ergane_git_read(review_app, auth_headers):
    """What the hook can see about the one thing it cannot see into.

    `pane/landing.py` reaches `factory.workgraph.worktree._git` rather than
    writing git itself (plan, Named traps), so a process *is* launched — and it
    is git, reading.  A second program, or a program that is not git, would be
    this room having grown a mechanism D-023 closed: no browser it drives, no
    subprocess of its own, nothing for a leaked token to spawn.
    """
    client = TestClient(review_app, headers=auth_headers)

    with watch() as observed:
        assert client.get(f"/api/review/{SPEC}").status_code == 200

    # Non-vacuous: the landing read really ran, so there is really a launch to
    # be strict about.
    assert observed.spawned, "the landing read launched nothing, so it did not run"
    for program in observed.spawned:
        assert Path(program).name in {"git", "git.exe"}, f"the room launched {program}"


# --- and the source of the review path holds no write at all ---------------


def test_no_module_on_the_review_path_carries_a_write(landed):
    """The static half, over the three modules the review path is made of.

    A run proves what happened; this proves there is no branch where something
    else could.  `open(..., "w")` anywhere in this diff outside a test's
    `tmp_path` is a refusal, and so is a `mkdir`, a `write_text` or an `unlink`
    — the room composes a document and hands it over, and there is no code path
    by which it could do anything else.
    """
    import ast

    forbidden_calls = {
        "mkdir",
        "makedirs",
        "write_text",
        "write_bytes",
        "writelines",
        "touch",
        "unlink",
        "rmtree",
        "rmdir",
        "rename",
        "symlink_to",
    }

    for name in ("review.py", "landing.py", "revision.py"):
        path = ROOT / "pane" / name
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            func = node.func
            if isinstance(func, ast.Attribute):
                assert func.attr not in forbidden_calls, f"{path}: calls .{func.attr}()"
            if isinstance(func, ast.Name) and func.id == "open":
                modes = [
                    argument.value
                    for argument in node.args[1:]
                    if isinstance(argument, ast.Constant)
                    and isinstance(argument.value, str)
                ]
                for mode in modes:
                    assert not any(character in mode for character in WRITE_MODES), (
                        f"{path}: opens with mode {mode!r}"
                    )
            if isinstance(func, ast.Name) and func.id in {"makedirs", "mkdir"}:
                raise AssertionError(f"{path}: calls {func.id}()")
