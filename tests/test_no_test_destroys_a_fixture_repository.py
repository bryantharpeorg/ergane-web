"""No test may delete a fixture repository's `.git` (017 US1, FR-003).

The suite builds real git repositories under its own `tmp_path`, and a test
that wants a checkout the live read cannot walk has an obvious way to make one:
remove `.git`.  It is the wrong way, and it cost an attempt.  016 US1 went red
on CI at `2026-08-26T20:15:28Z` with

    FileNotFoundError: [Errno 2] No such file or directory: 'bitmap-ref-tips_5AH8V1'
    /usr/lib/python3.12/shutil.py:715

— git's own pack-bitmap temporary, written by a maintenance child into the
directory `shutil.rmtree` was walking.  The next attempt passed **without
touching that test**, which is the whole reason this file exists: the race is
invisible when it does not fire, it fires nondeterministically on any runner,
and each firing costs a recovery rung on work that was already correct.

Renaming the directory aside is the fix and it is one line
(`make_unwalkable` in `tests/test_the_demo_floor_owns_its_landings.py`).  What
this guard protects is the *convention*, because the deleted-`.git` shape is
the kind that looks perfectly reasonable in review — it reads as "take the
history away", and nothing on the line says "and race a background process
while you do it".

**It reads the source, never the filesystem.**  A guard that tried to catch a
destructive test at runtime would have to run it first, which is exactly the
race it is meant to prevent.  So it scans `tests/` for the call shape and
requires it to appear nowhere: cheap, deterministic, and red the moment the
pattern comes back (plan D2).

This file is exempt from itself, for the same reason
`tests/test_no_test_pins_live_corpus.py` is: it has to spell the shape out in
order to look for it.  `test_the_guard_catches_a_planted_violation` is what
keeps it from being a grep that matches nothing — it plants the shape in the
exact form the suite carried it and requires the scanner to report it — and
`test_the_guard_lets_the_rename_through` is the other side, because a guard
that flagged the fix as well as the defect is a guard the next author deletes.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]

#: The Python suite.  Every fixture repository this repository builds is built
#: here, by `tests/corpus.py`, so this is the whole surface the rule covers.
SUITE = ROOT / "tests"

#: This guard, and nothing else.
EXEMPT = frozenset({Path(__file__).resolve()})

#: Every way the suite has to spell "take this path away".  `rmtree` is the one
#: that raised, but a `.git` unlinked file by file or `os.rmdir`-ed empty is the
#: same bargain with the same background process, so all of them are named.
_REMOVAL = re.compile(
    r"""\b(?:shutil\.)?rmtree\s*\(|\bos\.remove(?:dirs)?\s*\(|\bos\.rmdir\s*\("""
    r"""|\.unlink\s*\(|\bos\.unlink\s*\("""
)

#: A `.git` directory, however the statement composes it: `repo / ".git"`,
#: `"…/.git"`, `f"{repo}/.git"`.  The lookahead is what keeps `.gitignore`,
#: `.github` and the renamed-aside `.git-renamed-aside` out of it — the rule is
#: about the directory git is live in, not about every name beginning `.git`.
_GIT_DIR = re.compile(r"""\.git(?=['"/\s),]|$)""")

#: How many lines a statement may span before the scanner gives up joining it.
#: A removal wrapped over its argument runs to three or four; a block that never
#: closes must not swallow the file and read every `.git` in it as a neighbour
#: of every `rmtree` in it.
STATEMENT_LINES = 6


def scanned_files() -> Iterator[Path]:
    """Every Python file of the suite, this guard aside."""
    for path in sorted(SUITE.rglob("*.py")):
        if path.is_file() and path.resolve() not in EXEMPT:
            yield path


def statements(text: str) -> Iterator[tuple[int, str]]:
    """`(line number, statement)` for each statement, lines joined while a
    bracket is open and the join is still short.

    A removal wrapped over several lines is one subject, not several, so the
    shape cannot slip through the guard by going through `black`.
    """
    depth = 0
    start = 1
    buffer: list[str] = []
    for number, line in enumerate(text.splitlines(), 1):
        if not buffer:
            start = number
        buffer.append(line.strip())
        depth += sum(line.count(char) for char in "([{")
        depth -= sum(line.count(char) for char in ")]}")
        if depth <= 0 or len(buffer) >= STATEMENT_LINES:
            yield start, " ".join(buffer)
            buffer = []
            depth = 0
    if buffer:
        yield start, " ".join(buffer)


def offences(text: str) -> list[tuple[int, str]]:
    """Every statement in `text` that removes a `.git`, as `(line, what)`."""
    return [
        (number, statement)
        for number, statement in statements(text)
        if _REMOVAL.search(statement) and _GIT_DIR.search(statement)
    ]


# --- the guard ------------------------------------------------------------


def test_no_test_removes_a_fixture_repository_s_git_directory():
    """FR-003, over the whole Python suite."""
    reported = [
        f"{path.relative_to(ROOT)}:{number}: {statement}"
        for path in scanned_files()
        for number, statement in offences(path.read_text(encoding="utf-8"))
    ]

    assert reported == [], (
        "a test removes a `.git` directory a git maintenance child may still be "
        "writing into, which is the race that reddened the `test` gate at random "
        "and cost 016 US1 an attempt. Rename the directory aside instead — see "
        "`make_unwalkable` in tests/test_the_demo_floor_owns_its_landings.py:\n  "
        + "\n  ".join(reported)
    )


def test_the_guard_reads_a_suite_worth_reading():
    """A scanner pointed at nothing passes for the wrong reason."""
    files = list(scanned_files())

    assert len(files) >= 20
    assert ROOT / "tests" / "test_the_demo_floor_owns_its_landings.py" in files
    assert ROOT / "tests" / "corpus.py" in files


def planted_violations() -> dict[str, str]:
    """The shapes, the first of them in the exact form the suite carried it."""
    return {
        "the form the suite carried": (
            "def test_x(landed):\n"
            '    shutil.rmtree(landed.repo / ".git")\n'
        ),
        "the same call wrapped over its argument": (
            "def test_x(landed):\n"
            "    shutil.rmtree(\n"
            '        landed.repo / ".git",\n'
            "    )\n"
        ),
        "`rmtree` imported bare": (
            'def test_x(repo):\n    rmtree(repo / ".git")\n'
        ),
        "the path spelt as one string": (
            'def test_x(repo):\n    shutil.rmtree(f"{repo}/.git")\n'
        ),
        "unlinked rather than removed": (
            'def test_x(repo):\n    (repo / ".git").unlink()\n'
        ),
        "`os.rmdir` on an emptied directory": (
            'def test_x(repo):\n    os.rmdir(repo / ".git")\n'
        ),
    }


@pytest.mark.parametrize("shape", sorted(planted_violations()))
def test_the_guard_catches_a_planted_violation(shape):
    """A guard that matches nothing cannot pass."""
    planted = planted_violations()[shape]

    assert offences(planted), f"the guard did not catch {shape}"


def test_the_guard_lets_the_rename_through():
    """The fix must not trip the guard that asks for it.

    Both halves of what the suite legitimately does are here: renaming a live
    `.git` aside, and removing a scratch tree that is nobody's checkout.  A
    guard that flagged either would be deleted by the next author, and the rule
    would go with it.
    """
    fixed = (
        "def make_unwalkable(repo):\n"
        '    moved = repo / ".git-renamed-aside"\n'
        '    (repo / ".git").rename(moved)\n'
        "    return moved\n"
        "\n"
        "def test_x(tmp_path, landed):\n"
        "    make_unwalkable(landed.repo)\n"
        "    shutil.rmtree(tmp_path / 'fixtures')\n"
        '    (root / "landing" / "landing-facts.json").unlink()\n'
    )

    assert offences(fixed) == []
