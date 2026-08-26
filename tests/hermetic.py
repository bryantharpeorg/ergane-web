"""What the suite is allowed to touch, observed while it runs (009 US3, FR-009).

A gate is only worth its green if the green means the same thing on the
boundary as on the operator's machine.  It did not: 008 landed
`test_operational_error_becomes_transport`, which passed in the gate's bwrap
sandbox — `--clearenv`, a tmpfs `HOME`, no `ERGANE_ROOT` — and failed on the
operator's loaded shell, because there the read it expected to fail found a real
`doctor.db` and succeeded.  The test had not constructed a failure; it had
inherited one from the absence of the operator's machine.

That class of defect is invisible to a pattern guard, because nothing in the
source says "reads the host".  What says it is the read itself, so this module
watches the reads.  `install()` adds a `sys.addaudithook` hook that sees every
`open`, every `sqlite3.connect`, every directory listing and every subprocess
launch, and records the ones that land outside the places a hermetic run may
touch.  `tests/conftest.py` installs it and puts every test in the suite under
`watching()`, so the property is asserted once per test rather than
once per suite.

**What counts as inside.**  The question is not "is this path in the
repository" — an interpreter reads its own standard library, and a test writes
into the scratch tree pytest made for it.  The question is whether the path is
one that *varies between the boundary and the operator's machine*, because that
is exactly what makes a green suite mean two different things.  So four places
are inside:

- the repository's own tree, which is what the worktree carries into the gate;
- the run's own scratch space (`tempfile.gettempdir()`, which is where both
  `tmp_path` and `tempfile.mkdtemp` put what a test builds for itself);
- the interpreter's installation, which is what `uv sync` provisions;
- the read-only system directories any Python process touches on its way to a
  locale, a timezone or a certificate bundle.

Everything else is host state, and the operator's `HOME` and configured runtime
root are the two that bite.  Neither is inside; `tests/test_reads_no_host_state.py`
plants a read of each and requires this observer to report it.

**A recorded read is not a raised exception.**  The hook only observes: it never
blocks an operation and never raises into the code it is watching, because an
audit hook that raises turns a clear test failure into a confusing one somewhere
unrelated.  Anything the hook itself could not make sense of goes in `errors()`,
which the guard asserts is empty — a hook swallowing its own mistakes would be a
guard that passes for the wrong reason.
"""

from __future__ import annotations

import dataclasses
import os
import sys
import sysconfig
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import unquote, urlparse

#: The repository's own tree, and the suite inside it.
ROOT = Path(__file__).resolve().parents[1]
SUITE = Path(__file__).resolve().parent

#: The read-only system directories a Python process reaches for a locale, a
#: timezone, a certificate bundle or a shared library.  They are the machine's,
#: not the operator's: nothing a factory writes lives here, so a read of one
#: cannot make a green suite mean two things.  `/home`, `/root`, `/srv`, `/mnt`
#: and `/var` are deliberately absent — that is where an operator's runtime root
#: and checkouts live.
SYSTEM_ROOTS = (
    "/bin",
    "/dev",
    "/etc",
    "/lib",
    "/lib64",
    "/opt",
    "/proc",
    "/sbin",
    "/sys",
    "/usr",
)

#: Audit events that carry filesystem paths, and how many of their leading
#: arguments are paths.  `sqlite3.connect` is the one that matters most: a store
#: is opened in C, so the `open` event never fires for it and a hook watching
#: only `open` would have missed the very read that produced this story.
PATH_EVENTS: dict[str, int] = {
    "glob.glob": 1,
    "open": 1,
    "os.chmod": 1,
    "os.listdir": 1,
    "os.mkdir": 1,
    "os.remove": 1,
    "os.rename": 2,
    "os.rmdir": 1,
    "os.scandir": 1,
    "os.symlink": 2,
    "os.truncate": 1,
    "os.utime": 1,
    "shutil.copyfile": 2,
    "shutil.copytree": 2,
    "shutil.rmtree": 1,
    "sqlite3.connect": 1,
}

#: `subprocess.Popen` carries `(executable, args, cwd, env)` rather than a path
#: first, and both the program and the directory it runs in are worth reading.
SUBPROCESS_EVENT = "subprocess.Popen"


@dataclasses.dataclass(frozen=True)
class OutsideRead:
    """One touch of a path that is not inside the run."""

    event: str
    path: str
    where: str

    def __str__(self) -> str:
        return f"{self.where}: {self.event} {self.path}"


_installed = False
_recording: list[OutsideRead] | None = None
_errors: list[str] = []
_inside_the_tree = 0


# --- what is inside -------------------------------------------------------


def _roots() -> tuple[str, ...]:
    """Every directory a hermetic run may touch, as prefix strings.

    Both the literal and the symlink-resolved spelling of each root is kept, so
    a path observed either way is recognised without the hook having to resolve
    (and therefore `stat`) every path it sees.
    """
    # `ROOT` twice over: once as this file spells it and once resolved.  A
    # worktree reached through a symlink is two strings for one directory, and a
    # run whose working directory used the other spelling would look, path by
    # path, like a run reading somewhere else entirely.
    candidates = [ROOT, Path(__file__).parents[1], Path(tempfile.gettempdir())]
    candidates += [
        Path(prefix)
        for prefix in (
            sys.prefix,
            sys.base_prefix,
            sys.exec_prefix,
            sys.base_exec_prefix,
        )
    ]
    candidates += [
        Path(path)
        for path in sysconfig.get_paths().values()
        if os.path.isabs(path)
    ]
    candidates += [Path(root) for root in SYSTEM_ROOTS]

    spellings: set[str] = set()
    for candidate in candidates:
        spellings.add(str(candidate))
        try:
            spellings.add(str(candidate.resolve()))
        except OSError:  # pragma: no cover - a root that cannot be resolved
            pass
    return tuple(sorted(spellings))


#: Computed once: the roots do not move while a suite runs, and the hook is on
#: the path of every `open` in the process.
INSIDE_THE_RUN: tuple[str, ...] = _roots()

#: Both spellings again, for the "did the hook see the repository" counter.
_ROOT_PREFIXES = tuple({str(ROOT), str(Path(__file__).parents[1])})


def _under(path: str, root: str) -> bool:
    return path == root or path.startswith(root + os.sep)


def is_inside_the_run(path: str | Path) -> bool:
    """Whether `path` is one of the four places a hermetic run may touch."""
    return any(_under(str(path), root) for root in INSIDE_THE_RUN)


def _as_path(value: object) -> str | None:
    """The absolute path an audit argument names, or None if it names none.

    Three spellings arrive here.  A file descriptor is an `int` and names no
    path.  `sqlite3.connect` is handed a `file:` URI by ergane's read-only
    openers, so the scheme and the `?mode=ro` query are stripped back to the
    path they wrap.  Everything else is a string, bytes or `PathLike`, and a
    relative one is resolved against the working directory the caller had — the
    same directory the operation itself will use.
    """
    if isinstance(value, int):
        return None
    if isinstance(value, bytes):
        value = value.decode("utf-8", "surrogateescape")
    elif isinstance(value, os.PathLike):
        value = os.fspath(value)
    if not isinstance(value, str):
        return None
    if value.startswith("file:"):
        value = unquote(urlparse(value).path)
    if not value:
        return None
    if not os.path.isabs(value):
        value = os.path.join(os.getcwd(), value)
    return os.path.normpath(value)


# --- who touched it -------------------------------------------------------


def _test_frame() -> str | None:
    """The nearest frame belonging to a file in `tests/`, named for a report.

    The claim being checked is about what a *test module* reads, and a test
    reads through the code it calls: when `pane/readers.py` opens the operator's
    findings store because a test asked it to, the test is what caused the read.
    So the whole stack is walked and the first test-suite frame on it is the
    answer.  A read with no test frame under it — an import, a plugin, the
    interpreter starting up — is nobody's test and is not reported.
    """
    frame = sys._getframe(1)
    while frame is not None:
        filename = frame.f_code.co_filename
        if filename.startswith(str(SUITE) + os.sep) and filename != __file__:
            return (
                f"{os.path.relpath(filename, ROOT)}:{frame.f_lineno}"
                f" in {frame.f_code.co_name}"
            )
        frame = frame.f_back
    return None


# --- the hook -------------------------------------------------------------


def _note(event: str, path: str) -> None:
    global _inside_the_tree

    if any(_under(path, prefix) for prefix in _ROOT_PREFIXES):
        _inside_the_tree += 1
        return
    if is_inside_the_run(path):
        return
    if _recording is None:
        return
    where = _test_frame()
    if where is None:
        return
    _recording.append(OutsideRead(event=event, path=path, where=where))


def _hook(event: str, args: tuple) -> None:
    try:
        if event == SUBPROCESS_EVENT:
            executable, _argv, cwd, _env = args
            # A program named without a directory is found on `PATH` by the
            # kernel; which file that turns out to be is the machine's
            # business.  A program a test spelt out absolutely is this hook's.
            if os.path.isabs(_bare(executable)):
                _note(event, _as_path(executable) or "")
            directory = _as_path(cwd)
            if directory is not None:
                _note(event, directory)
            return

        count = PATH_EVENTS.get(event)
        if count is None:
            return
        for value in args[:count]:
            path = _as_path(value)
            if path is not None:
                _note(event, path)
    except Exception as exc:  # pragma: no cover - defended, then asserted on
        # An audit hook that raises does so inside whatever code it was
        # watching, which turns one clear failure into a baffling one somewhere
        # else.  So nothing escapes — but nothing is swallowed either:
        # `test_the_observer_made_no_mistakes_of_its_own` asserts this is empty.
        _errors.append(f"{event}: {exc!r}")


def _bare(value: object) -> str:
    """`value` as a string, for the "was it spelt absolutely" question."""
    if isinstance(value, bytes):
        return value.decode("utf-8", "surrogateescape")
    if isinstance(value, os.PathLike):
        return os.fspath(value)
    return value if isinstance(value, str) else ""


def install() -> None:
    """Add the hook, once.  An audit hook cannot be removed, so this is final."""
    global _installed
    if _installed:
        return
    _installed = True
    sys.addaudithook(_hook)


def is_installed() -> bool:
    return _installed


def reads_inside_the_tree() -> int:
    """How many paths under the repository the hook has seen.

    An observer that has seen nothing proves nothing, so the guard asserts this
    has moved: a hook that was never called would report an empty violation list
    for the same reason a hook that works does.
    """
    return _inside_the_tree


def errors() -> list[str]:
    return list(_errors)


@contextmanager
def watching() -> Iterator[list[OutsideRead]]:
    """Collect the out-of-run touches made in this block, and only this block.

    Nesting shadows: a block inside another collects its own reads and the outer
    one never sees them.  That is what lets `test_reads_no_host_state.py` plant
    a read of the operator's `HOME` without the autouse fixture failing the test
    that planted it.
    """
    global _recording
    previous = _recording
    collected: list[OutsideRead] = []
    _recording = collected
    try:
        yield collected
    finally:
        _recording = previous


def report(observed: list[OutsideRead], subject: str) -> str:
    """The sentence a failing test is given, naming each read and its line."""
    lines = "\n  ".join(str(read) for read in observed)
    return (
        f"{subject} read {len(observed)} path(s) outside the repository, the "
        f"run's own scratch tree and the interpreter's installation. A suite "
        f"that reads host state is green or red for reasons the diff does not "
        f"carry: construct the condition instead (009 FR-008/FR-009).\n  "
        f"{lines}"
    )
