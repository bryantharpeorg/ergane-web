"""The suite reads no path outside its own tree, observed (009 US3, FR-009).

`tests/hermetic.py` watches every file the suite opens and every store it
connects to, and `tests/conftest.py` puts each test under that watch, so the
claim in this file's title is made once per test rather than once per run.  What is
left for this module is the two things an observer cannot assert about itself:
that it is running, and that it has teeth.

- **Running.**  A hook that was never installed reports an empty violation list
  for the same reason a hook that works does.  `test_the_observer_is_installed
  _and_watching` requires it to have seen the repository's own files go by.
- **Teeth.**  Four plants — an `open`, a store connection, a directory listing
  and a subprocess — reach for a path outside the run and require the observer
  to name it.  A fifth plants the shape that produced this story: a pane read
  whose store path resolves onto the host, caught even though the read itself
  raises exactly what it is supposed to raise.
- And the other side, without which the guard is one an author deletes: what
  the run builds for itself — `tmp_path`, a `tempfile` scratch dir, the
  repository's own files — is not a violation.

`test_the_whole_suite_agrees_with_itself_whatever_runtime_root_it_inherits` is
the scenario end to end (US3-S2, SC-003).  It runs the whole suite twice in a
child process from a working directory of its own — once with `ERGANE_ROOT`
pointing at a populated runtime root it built, once with no runtime root
configured at all, which is the boundary's condition — and requires both to
pass and to leave that working directory empty.  That last clause is what keeps
the fix from rotting: a suite that starts writing `.ergane/` or `.pane/` beside
itself again is a suite carrying state the worktree does not carry into the
gate, and this test goes red the run it happens.
"""

from __future__ import annotations

import os
import re
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

import hermetic
from factory.doctor import cli as doctor_cli
from factory.doctor import store as doctor_store
from factory.usage import cli as usage_cli
from factory.usage import ledger as usage_ledger
from factory.workgraph import worktree
from pane.config import Settings
from pane.readers import LiveReader, TransportFailed

ROOT = hermetic.ROOT

#: A directory no machine has and no run creates: outside the repository,
#: outside the run's scratch tree, outside the interpreter's installation.  Each
#: plant below fails when it reaches this, and that is fine — an audit event
#: fires on the *attempt*, so what the observer catches does not depend on the
#: machine happening to have the file.  Which is the property being proved.
OUTSIDE = Path(os.sep + "ergane-web-no-such-place") / "runtime-root"

#: Set in the child run, so the child does not spawn a suite of its own.
CHILD = "PANE_HERMETIC_CHILD"

#: How this file is named in a violation report, which is where the plants
#: below must be attributed.
HERE = str(Path(__file__).resolve().relative_to(ROOT)) + ":"


# --- the observer is running ----------------------------------------------


def test_the_observer_is_installed_and_watching():
    """An observer that has seen nothing proves nothing (FR-009)."""
    assert hermetic.is_installed(), "tests/conftest.py did not install the hook"
    assert hermetic.reads_inside_the_tree() > 0, (
        "the hook has not seen a single read under the repository, so its empty "
        "violation list says nothing about the suite"
    )


def test_the_observer_made_no_mistakes_of_its_own():
    """The hook never raises into the code it watches, so it records instead.

    Swallowing its own errors is how such a hook goes quietly vacuous; this is
    the assertion that stops it.
    """
    assert hermetic.errors() == []


# --- the observer has teeth -----------------------------------------------


def _open_a_file_outside_the_run() -> None:
    open(OUTSIDE / "spec.md", "rb")


def _connect_to_a_store_outside_the_run() -> None:
    # ergane's own read-only ledger opener, which is how the pane reaches a
    # store: `sqlite3.connect` opens the file in C, so the `open` event never
    # fires for it and only an observer watching `sqlite3.connect` sees it.
    usage_cli.open_readonly(OUTSIDE / Path(usage_cli.DEFAULT_LEDGER_PATH).name)


def _list_a_directory_outside_the_run() -> None:
    os.listdir(OUTSIDE)


def _run_a_program_outside_the_run() -> None:
    subprocess.run([str(OUTSIDE / "bin" / "ergane"), "status"], capture_output=True)


PLANTS = {
    "an open": _open_a_file_outside_the_run,
    "a store connection": _connect_to_a_store_outside_the_run,
    "a directory listing": _list_a_directory_outside_the_run,
    "a subprocess": _run_a_program_outside_the_run,
}


@pytest.mark.parametrize("shape", sorted(PLANTS))
def test_a_touch_outside_the_run_is_reported(shape):
    """Each way out of the tree, planted and required to be caught."""
    with hermetic.watching() as observed:
        # Every plant fails, and the two ways it can: a missing file is an
        # `OSError`, and SQLite refuses a store it may not create with an error
        # of its own.  Which one is beside the point — the audit event fired
        # before either, which is what the observer is asked about.
        with pytest.raises((OSError, sqlite3.Error)):
            PLANTS[shape]()

    assert observed, f"the observer did not catch {shape}"
    assert all(str(OUTSIDE) in read.path for read in observed)
    assert all(read.where.startswith(HERE) for read in observed), (
        f"a violation must be reported against the suite frame that caused it: "
        f"{[read.where for read in observed]}"
    )


def test_the_read_that_produced_this_story_is_the_one_it_catches(monkeypatch, tmp_path):
    """A pane read whose store resolves onto the host, caught (FR-008/FR-009).

    This is the shape, not an analogy for it: `LiveReader.rollup()` resolves its
    ledger through ergane's environment chain and opens whatever that names.
    Point the chain outside the run and the read still raises `TransportFailed`,
    exactly as `tests/test_readonly_sweep.py` requires — a test asserting only
    that would pass while reading the operator's machine, which is precisely how
    `test_operational_error_becomes_transport` came to mean two different things
    in two places.  The observer reports it anyway.
    """
    monkeypatch.setenv(
        usage_cli.ERGANE_LEDGER_PATH_ENV,
        str(OUTSIDE / Path(usage_cli.DEFAULT_LEDGER_PATH).name),
    )
    monkeypatch.delenv(usage_cli.FACTORY_LEDGER_PATH_ENV, raising=False)
    reader = LiveReader(tmp_path / "specs")

    with hermetic.watching() as observed:
        with pytest.raises(TransportFailed):
            reader.rollup()

    assert [read for read in observed if read.event == "sqlite3.connect"], (
        "a store opened outside the run went unreported"
    )


# --- and the other side ---------------------------------------------------


def test_what_the_run_makes_for_itself_is_not_reported(tmp_path):
    """A guard that flagged `tmp_path` would be a guard the next author deletes.

    The three places a test legitimately reaches — the scratch tree pytest hands
    it, one it made with `tempfile`, and the repository's own committed files —
    are each exercised here and must pass in silence.
    """
    with hermetic.watching() as observed:
        (tmp_path / "scratch.txt").write_text("built here", encoding="utf-8")
        (tmp_path / "scratch.txt").read_text(encoding="utf-8")

        elsewhere = Path(tempfile.mkdtemp(prefix="pane-guard-"))
        doctor_store.connect(elsewhere / "doctor.db").close()

        (ROOT / "pyproject.toml").read_text(encoding="utf-8")

    assert observed == []


def test_the_operator_s_home_is_not_a_place_the_suite_may_read():
    """`HOME` is host state, and the observer must not count it as inside.

    The gate runs with a fresh tmpfs `HOME` (D-013) which may itself sit inside
    the run's scratch tree; there the question this test asks does not arise,
    and it says so rather than asserting something it cannot.
    """
    home = Path(os.path.expanduser("~"))
    if hermetic.is_inside_the_run(home):
        pytest.skip(f"this run's HOME ({home}) is inside its own scratch tree")

    assert not hermetic.is_inside_the_run(home)
    assert not hermetic.is_inside_the_run(home / worktree.DEFAULT_RUNTIME_ROOT)
    assert not hermetic.is_inside_the_run(home / usage_cli.DEFAULT_LEDGER_PATH)


# --- the whole suite, from somewhere else ---------------------------------


def populated_runtime_root(root: Path) -> Path:
    """A runtime root with both stores in it, written by ergane's own writers."""
    root.mkdir(parents=True, exist_ok=True)
    doctor_store.connect(doctor_cli._resolve_store_path_for_root(root)).close()
    usage_ledger.connect(root / Path(usage_cli.DEFAULT_LEDGER_PATH).name).close()
    return root


def child_environment(tmp_path: Path, runtime_root: Path | None) -> dict[str, str]:
    """The whole environment the child suite runs in, spelt out.

    Inherited wholesale it would carry the operator's shell into the very run
    that is meant to prove the operator's shell does not matter.  `PATH` is
    passed because a program has to be findable; everything else is this test's.
    """
    home = tmp_path / "home"
    home.mkdir(exist_ok=True)
    environment = {
        "PATH": os.environ.get("PATH", os.defpath),
        "HOME": str(home),
        CHILD: "1",
    }
    if runtime_root is not None:
        environment[worktree.ERGANE_ROOT_ENV] = str(runtime_root)
        environment[usage_cli.ERGANE_LEDGER_PATH_ENV] = str(
            runtime_root / Path(usage_cli.DEFAULT_LEDGER_PATH).name
        )
    return environment


#: The two runtime roots a run can inherit, and the third thing the suite must
#: never grow beside itself: the pane's own delivery store.
UNCARRIED = (
    worktree.DEFAULT_RUNTIME_ROOT,
    worktree.LEGACY_FACTORY_ROOT,
    Settings.from_env(environ={}).attention_db.parent,
)


@pytest.mark.skipif(
    os.environ.get(CHILD) == "1",
    reason="this is the child run; it does not spawn one of its own",
)
@pytest.mark.parametrize("configured", [True, False], ids=["runtime-root", "none"])
def test_the_whole_suite_agrees_with_itself_whatever_runtime_root_it_inherits(
    tmp_path, configured
):
    """Both ways round, and the two must agree (US3-S2, SC-003).

    With `ERGANE_ROOT` on a populated runtime root, and with no runtime root
    configured at all — the operator's condition and the boundary's — the suite
    must pass in full.  It is run from a working directory of its own, empty
    before and required to be empty after: every path either resolver falls back
    to is *relative to the working directory*, so a suite that grows `.ergane/`
    or `.pane/` beside itself shows up here as a file in a directory that should
    have none.
    """
    runtime_root = (
        populated_runtime_root(tmp_path / "runtime-root") if configured else None
    )
    working_directory = tmp_path / "cwd"
    working_directory.mkdir()

    completed = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", str(ROOT / "tests")],
        cwd=working_directory,
        env=child_environment(tmp_path, runtime_root),
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 0, (
        f"the suite does not pass with runtime root {runtime_root}:\n"
        f"{completed.stdout[-6000:]}\n{completed.stderr[-2000:]}"
    )

    passed = re.search(r"(\d+) passed", completed.stdout)
    assert passed and int(passed.group(1)) > 100, (
        f"the child run collected too little to prove anything:\n{completed.stdout[-2000:]}"
    )

    grew = sorted(path.name for path in working_directory.iterdir())
    assert grew == [], (
        f"the suite wrote {grew} into the directory it ran from. The worktree "
        f"does not carry those into the gate, so what they hold is whatever the "
        f"last run left behind (009 FR-009)."
    )
    for uncarried in UNCARRIED:
        assert not (working_directory / uncarried).exists()
