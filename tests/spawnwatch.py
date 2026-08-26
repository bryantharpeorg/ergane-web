"""Watch the spawn point itself (016 FR-002, plan D4).

FR-002 asks for a committed test that a landing read in demo mode spawns no git
subprocess, and it asks for it *at the spawn point*: a test that merely liked
the answer would pass on any machine where git happens to work, which is exactly
the false green this spec exists to remove — the review room's landing read was
right on the operator's checkout every day it was wrong on a runner's.

So this module watches the same audit event `tests/hermetic.py` watches for its
own question, and asks a different one of it: not *where* a subprocess ran, but
whether one ran at all.  `subprocess.Popen` is the event every spawn passes
through, whatever library composed the command line — `subprocess.run`, ergane's
`_git` helper and anything either of them grows later — so a read cannot slip
past this by changing which function it calls.

The hook only observes.  It never blocks a spawn and never raises into the code
it is watching, for the reason `hermetic.py` gives: an audit hook that raises
turns one clear failure into a baffling one somewhere unrelated.  Anything the
hook could not make sense of goes in `errors()`, which the tests assert is
empty — a watcher that swallowed its own mistakes would pass for the wrong
reason.
"""

from __future__ import annotations

import dataclasses
import os
import sys
from collections.abc import Iterator
from contextlib import contextmanager

#: The audit event every subprocess launch passes through.
SPAWN_EVENT = "subprocess.Popen"


@dataclasses.dataclass(frozen=True)
class Spawn:
    """One process launch, as the audit hook saw it."""

    program: str
    argv: tuple[str, ...]
    cwd: str | None

    @property
    def is_git(self) -> bool:
        """Whether this launch was git, however the caller spelt the program."""
        names = [os.path.basename(self.program)]
        if self.argv:
            names.append(os.path.basename(self.argv[0]))
        return any(name == "git" or name.startswith("git.") for name in names)

    def __str__(self) -> str:
        return " ".join(self.argv) or self.program


_installed = False
_recording: list[Spawn] | None = None
_errors: list[str] = []


def _text(value: object) -> str:
    """An audit argument as a string, whichever of the three spellings it is."""
    if isinstance(value, bytes):
        return value.decode("utf-8", "surrogateescape")
    if isinstance(value, os.PathLike):
        return os.fspath(value)
    return value if isinstance(value, str) else repr(value)


def _hook(event: str, args: tuple) -> None:
    try:
        if event != SPAWN_EVENT or _recording is None:
            return
        executable, argv, cwd, _env = args
        _recording.append(
            Spawn(
                program=_text(executable),
                argv=tuple(_text(item) for item in (argv or ())),
                cwd=None if cwd is None else _text(cwd),
            )
        )
    except Exception as exc:  # pragma: no cover - defended, then asserted on
        _errors.append(f"{event}: {exc!r}")


def install() -> None:
    """Add the hook, once.  An audit hook cannot be removed, so this is final."""
    global _installed
    if _installed:
        return
    _installed = True
    sys.addaudithook(_hook)


@contextmanager
def watching() -> Iterator[list[Spawn]]:
    """Record every spawn made inside the block, in the order they happened."""
    global _recording
    install()
    previous = _recording
    recorded: list[Spawn] = []
    _recording = recorded
    try:
        yield recorded
    finally:
        _recording = previous


def errors() -> list[str]:
    """Whatever the hook itself could not make sense of.  Asserted empty."""
    return list(_errors)
