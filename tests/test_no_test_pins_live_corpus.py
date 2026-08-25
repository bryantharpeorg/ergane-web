"""No test may pin this morning's corpus (008 US1, FR-001).

Two shapes turn the suite red with no line of source touched, and both were in
it: an assertion on a *named* spec's `state:` frontmatter value, and a read of
this repository's archive of derived work graphs.  Attesting a spec `landed`
and archiving the graphs are ordinary operator edits — two PRs were open making
exactly those two edits, and both were red against three assertions in
`tests/test_showfloor_document.py`.  An edit that changes no source must not be
able to fail a gate.

So this file greps the suite for the two shapes and fails on a match.  It is a
pattern guard and says so: it reads statements rather than semantics, and its
job is to stop the convention decaying, which it had already done once.

`tests/corpus.py` is exempt, and it is the whole point of the exemption: it is
the fixture-construction helper the convention points *at*, the one place
allowed to name the corpus, and it names it only to cut recorded material from.
This file is exempt from itself for the same reason — it has to spell the
patterns out to look for them.

`test_the_guard_catches_a_planted_violation` is what keeps this from being a
grep that matches nothing: it plants each shape, in the exact form the suite
carried it, and requires the scanner to report it.  `test_the_guard_lets_a
_constructed_corpus_through` is the other side — a guard that flagged every
mention of the word `landed` would just be deleted.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SPECS = ROOT / "specs"

#: The two suites, and the file kinds in them worth reading.
SUITES = (ROOT / "tests", ROOT / "web" / "tests")
SUFFIXES = frozenset({".py", ".ts", ".tsx"})

#: The fixture-construction helper, and this guard.  Nothing else.
EXEMPT = frozenset({ROOT / "tests" / "corpus.py", Path(__file__).resolve()})

#: The words a spec's frontmatter can carry (ergane's roadmap grammar).
_STATE_LITERAL = re.compile(r"""['"](?:landed|ready|draft|deferred)['"]""")

#: What makes a statement an assertion rather than a construction — pytest's
#: keyword and Playwright/vitest's matchers.
_ASSERTION = re.compile(r"""\bassert\b|\bexpect\s*\(|\.toBe\w*\s*\(|\.toEqual\s*\(""")

#: Any reference to the repository's archive of derived work graphs, however it
#: is spelt: `"docs/dags"`, `ROOT / "docs" / "dags"`, `docs/dags/<name>.json`.
_ARCHIVE = re.compile(r"""docs['"\s/,)(]*dags""")


def scanned_files() -> Iterator[Path]:
    """Every test file of the two suites, the two exemptions aside."""
    for suite in SUITES:
        for path in sorted(suite.rglob("*")):
            if path.suffix in SUFFIXES and path.is_file() and path.resolve() not in EXEMPT:
                yield path


def live_spec_dirs() -> frozenset[str]:
    """The spec directories that exist right now — the names a test must not
    hang a state assertion on, read from the corpus so the guard never needs
    updating when a spec is added or renamed."""
    return frozenset(
        path.name for path in SPECS.iterdir() if (path / "spec.md").is_file()
    )


#: How many lines a statement may span before the scanner gives up joining it.
#: An `assert` wrapped over a dict literal runs to four or five, so it must
#: survive the join; a block that never closes must not swallow the file.  A
#: TypeScript arrow-block header (`it("…", () => {`) is closed explicitly
#: below — its brace opens a body, not an expression — and the width is the
#: backstop for every other opener.
STATEMENT_LINES = 6


def statements(text: str) -> Iterator[tuple[int, str]]:
    """`(line number, statement)` for each statement, lines joined while a
    bracket is open and the join is still short.

    A multi-line `assert states == { … }` is one subject, not several, so a pin
    cannot slip through by wrapping.  Two things end a join early: an arrow
    block's header, whose brace opens a body rather than an expression, and
    `STATEMENT_LINES`, so a block that never closes cannot swallow the file and
    read every string in it as a neighbour of every matcher in it.
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
        joined = " ".join(buffer)
        if depth <= 0 or joined.endswith("=> {") or len(buffer) >= STATEMENT_LINES:
            yield start, joined
            buffer = []
            depth = 0
    if buffer:
        yield start, " ".join(buffer)


def offences(text: str, spec_dirs: frozenset[str] | None = None) -> list[tuple[int, str]]:
    """Every pinned-corpus statement in `text`, as `(line number, what)`."""
    dirs = live_spec_dirs() if spec_dirs is None else spec_dirs
    found: list[tuple[int, str]] = []

    for number, statement in statements(text):
        if _ARCHIVE.search(statement):
            found.append(
                (number, "reads the repository's archive of derived work graphs")
            )
            continue
        if not _ASSERTION.search(statement) or not _STATE_LITERAL.search(statement):
            continue
        named = sorted(
            spec_dir
            for spec_dir in dirs
            if f'"{spec_dir}"' in statement or f"'{spec_dir}'" in statement
        )
        if named:
            found.append(
                (number, f"asserts a frontmatter state beside the live spec {named[0]}")
            )

    return found


# --- the guard ------------------------------------------------------------


def test_no_test_asserts_a_named_spec_s_state_or_reads_the_archive():
    """FR-001, over both suites."""
    reported = [
        f"{path.relative_to(ROOT)}:{number}: {what}"
        for path in scanned_files()
        for number, what in offences(path.read_text(encoding="utf-8"))
    ]

    assert reported == [], (
        "a test is pinned to this morning's corpus, so an operator attesting a "
        "spec or archiving a work graph would turn the gate red without "
        "touching a line of source. Construct the condition through "
        "`tests/corpus.py` instead:\n  " + "\n  ".join(reported)
    )


def test_the_guard_reads_a_suite_worth_reading():
    """A scanner pointed at nothing passes for the wrong reason."""
    files = list(scanned_files())

    assert len(files) >= 20
    assert any(path.suffix == ".py" for path in files)
    assert any(path.suffix in {".ts", ".tsx"} for path in files)
    assert ROOT / "tests" / "test_showfloor_document.py" in files
    # The state pattern can never match without names to match against.
    assert len(live_spec_dirs()) >= 5


def planted_violations() -> dict[str, str]:
    """The three shapes, each in the form the suite actually carried it.

    The spec directory is read out of the corpus rather than typed, so the
    planted violation cannot go stale the way the assertions it stands for did.
    """
    spec_dir = sorted(live_spec_dirs())[0]
    return {
        "a state assertion on one line": (
            f'def test_x():\n    assert states["{spec_dir}"] == "landed"\n'
        ),
        "a state assertion wrapped over several": (
            "def test_x():\n"
            "    assert states == {\n"
            f'        "{spec_dir}": "ready",\n'
            "    }\n"
        ),
        "a matcher in the web suite": (
            f'test("x", () => {{\n  expect(chipOf("{spec_dir}")).toBe("draft");\n}});\n'
        ),
        "an archive path": ('DAGS = ROOT / "docs" / "dags"\n'),
        "an archive path spelt as one string": (
            'assert Path("docs/dags/some-spec.json").is_file()\n'
        ),
    }


@pytest.mark.parametrize("shape", sorted(planted_violations()))
def test_the_guard_catches_a_planted_violation(shape):
    """A guard that matches nothing cannot pass."""
    planted = planted_violations()[shape]

    assert offences(planted), f"the guard did not catch {shape}"


def test_the_guard_lets_a_constructed_corpus_through():
    """The other side: constructing a state is the fix, so it must not trip.

    A test that writes `state: landed` into a scratch tree, names a directory it
    invented, and asserts the chip that came back is exactly what FR-001 asks
    for — a guard that flagged it would be a guard the next author deletes.
    """
    constructed = (
        "def test_x(tmp_path):\n"
        '    corpus = build_corpus(tmp_path, SpecFixture("910-attested", state="landed"))\n'
        '    assert corpus.entry("910-attested")["chip"] == "landed"\n'
        '    assert corpus.entry("910-attested")["state"] == "landed"\n'
    )

    assert offences(constructed) == []


def test_the_guard_needs_all_three_of_assertion_name_and_state():
    """The state pattern is a conjunction, and each conjunct is load-bearing."""
    spec_dir = sorted(live_spec_dirs())[0]

    # Naming a live spec is fine — the suite does it to *select* one.
    assert offences(f'    await page.goto("/showfloor/{spec_dir}")\n') == []
    # So is asserting a state, over a corpus the test built.
    assert offences('    assert entry["chip"] == "landed"\n') == []
    # The two together, under an assertion, are the pin.
    assert offences(f'    assert chip_of("{spec_dir}") == "landed"\n')
