"""The backend gate measures its own reach, and the floor bites (015 US1).

`ergane.yaml` declared four gates and not one of them said anything about how
much of `pane/` its tests actually execute.  This story makes the `test` gate
answer that question every time it runs: Cobertura `coverage.xml` at the
repository root, a terminal summary a human reads in the gate tail, and a
committed floor that fails the gate when a change drops below it.

**What this file may assert, and what it may not.**  Constitution IV: the judge
reads the diff, not the tree and not the gate results, so a scenario asserts what
the diff *commits* rather than what a command *would do*.  Everything up to
`test_the_floor_bites` is therefore about wiring — the gate command, the
committed floor, the declared artefact paths, the workflow job of the same name —
and each one names the file it reads, because a file absent from the changed-file
list reads to the judge as absent from the repository.

`test_the_floor_bites` is the exception, and T006 asks for it in those words: *a
green run is evidence, not proof*.  This repository's own coverage sits above its
own floor, so the gate going green here says only that today's number is above
today's number.  What has to be proved is that the mechanism has teeth — so the
test builds a throwaway project configured with **the same keys this diff commits
to `pyproject.toml`** and driven by **the same flags this diff commits to
`ergane.yaml`**, runs it twice, and requires the below-floor run to exit non-zero
naming both figures.  Rename the mechanism and this test stops exercising
anything; that is what couples it to the real configuration rather than to a
copy of it.

**And it runs with a `HOME` of its own, empty, checked empty afterwards**
(FR-004, D-013).  A gate does not inherit the attempt's `HOME`; it gets a fresh
tmpfs one.  A coverage tool that cached into `HOME` would work in the attempt and
fail at the boundary, which is the Playwright-browser class of bug that already
cost this repository a rework cycle.  The child below is given a scrubbed
environment and an empty home directory, and the home directory is required to
still be empty when it is done.
"""

from __future__ import annotations

import os
import re
import shlex
import subprocess
import sys
import tomllib
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]

#: The declared artefact paths (FR-001).  Relative, so they resolve against the
#: directory the gate runs in -- the worktree -- and nowhere else.
COVERAGE_XML = "coverage.xml"
COVERAGE_DATA = ".coverage"

#: What the child run in `test_the_floor_bites` is given: enough to find an
#: interpreter, a home directory of its own, and nothing else.  Built from
#: scratch rather than copied, so no `COV_CORE_*` variable leaks in from a
#: parent that is itself running under coverage and quietly turns the child's
#: measurement into the parent's.
def child_environment(home: Path) -> dict[str, str]:
    return {"PATH": os.environ.get("PATH", os.defpath), "HOME": str(home)}


def pyproject() -> dict:
    with open(ROOT / "pyproject.toml", "rb") as handle:
        return tomllib.load(handle)


def manifest() -> dict:
    with open(ROOT / "ergane.yaml", "rb") as handle:
        return yaml.safe_load(handle)


def workflow() -> dict:
    with open(ROOT / ".github" / "workflows" / "ergane-gates.yml", "rb") as handle:
        return yaml.safe_load(handle)


def gate_command() -> str:
    return gate_command_named("test")


def gate_command_named(gate: str) -> str:
    return manifest()["gates"][gate]


def job_scripts(job: dict) -> list[str]:
    """Every shell script a job runs, in order."""
    return [step["run"] for step in job["steps"] if "run" in step]


# --- FR-001: the gate writes the artefact and prints the summary ------------


def test_the_gate_command_asks_for_cobertura_and_a_terminal_summary():
    """US1-S1, FR-001, read off `ergane.yaml`.

    Two reports, not one.  The XML is for PR-3's collector and the terminal
    summary is for the human reading a failed gate's tail -- 013 made that tail
    visible in the Showfloor, so a number printed there is a number an operator
    sees without leaving the room.
    """
    command = gate_command()
    flags = shlex.split(command)

    assert flags[:4] == ["uv", "run", "pytest", "-q"], command
    assert "--cov=pane" in flags, f"the gate measures nothing: {command}"
    assert "--cov-report=xml" in flags, f"no Cobertura artefact: {command}"
    assert "--cov-report=term-missing" in flags, f"no terminal summary: {command}"


def test_the_artifact_paths_are_declared_in_pyproject_and_are_relative():
    """US1-S1 and US1-S4: a stable declared path, inside the worktree.

    `coverage.xml` at the repository root is the whole point of FR-001 -- PR-3
    collects a standard format from a stable location, and a repository that
    invented its own gets a rewrite instead of collection for free.  Relative,
    because the same file is read from a runner, a sandbox and an operator's
    checkout, and an absolute path names a directory that exists on one of them.
    """
    coverage = pyproject()["tool"]["coverage"]

    assert coverage["xml"]["output"] == COVERAGE_XML
    assert coverage["run"]["data_file"] == COVERAGE_DATA
    assert coverage["run"]["relative_files"] is True

    for path in (coverage["xml"]["output"], coverage["run"]["data_file"]):
        assert not Path(path).is_absolute(), path
        assert not path.startswith(".."), path


def test_coverage_is_measured_over_pane():
    """FR-001: "how much of `pane/` its tests execute" -- named in both places.

    The flag turns coverage on; this table is what a bare `coverage` run and any
    collector reading `pyproject.toml` see, and the two must agree or the
    committed floor is a floor over a different thing than the gate measures.
    """
    assert pyproject()["tool"]["coverage"]["run"]["source"] == ["pane"]
    assert "--cov=pane" in shlex.split(gate_command())


# --- FR-003: the floor is committed, not passed -----------------------------


def test_the_floor_is_committed_in_pyproject():
    """US1-S3, FR-003 (plan D1): a reader sees the number without running anything."""
    report = pyproject()["tool"]["coverage"]["report"]

    floor = report["fail_under"]
    assert isinstance(floor, (int, float)) and not isinstance(floor, bool)
    assert 0 < floor <= 100, floor

    # `fail_under` is compared against the total *rounded to this precision*, so
    # a floor quoted to one decimal under the default precision of 0 is a floor
    # half a point lower than the one written down.
    assert report["precision"] >= 1, report


def test_the_floor_is_passed_on_no_command_line():
    """FR-003, the other half: it is committed *rather than* passed.

    `--cov-fail-under` on the gate command would hide the number inside a
    manifest string, where a change to the repository's coverage policy shows up
    in a diff as a change to a quoted command rather than as what it is.
    """
    manifest_text = (ROOT / "ergane.yaml").read_text()
    workflow_text = (ROOT / ".github" / "workflows" / "ergane-gates.yml").read_text()

    for name, text in (("ergane.yaml", manifest_text), ("the gates workflow", workflow_text)):
        for command in re.findall(r"^\s*(?:test|run):.*$", text, flags=re.MULTILINE):
            assert "--cov-fail-under" not in command, (
                f"{name} passes the floor on a command line: {command.strip()}"
            )


# --- FR-004: nothing from HOME ----------------------------------------------


def test_no_gate_command_reaches_for_home():
    """US1-S4, FR-004, D-013.

    A gate gets a fresh tmpfs `HOME` and only the worktree survives into it, so
    a command that spells `~` or `$HOME` is a command that reads something the
    boundary does not have.  Asserted over every gate, not just this story's,
    because FR-004 is written over every gate.
    """
    for name, command in manifest()["gates"].items():
        assert "~" not in command, f"gate {name} reaches for a home directory: {command}"
        assert "$HOME" not in command, f"gate {name} reads HOME: {command}"
        assert "${HOME" not in command, f"gate {name} reads HOME: {command}"


def test_coverage_is_not_configured_into_addopts():
    """The artefacts belong to the gate's working directory, not to any run's.

    Putting `--cov` in `[tool.pytest.ini_options] addopts` would look tidier and
    would be wrong twice over.  It writes `coverage.xml` and `.coverage` into
    *whatever directory pytest was invoked from* -- and this suite invokes itself
    from a scratch directory it then requires to be empty
    (`tests/test_reads_no_host_state.py`, 009 FR-009), because a suite that grows
    files beside itself is a suite whose green means one thing in the gate and
    another on the operator's machine.  Coverage is switched on by the gate
    command, which runs at the repository root, and by nothing else.
    """
    addopts = pyproject()["tool"]["pytest"]["ini_options"].get("addopts", "")
    assert "--cov" not in addopts, addopts


# --- FR-011: a gate the forge does not run does not exist -------------------


def test_every_gate_has_a_job_of_the_same_name():
    """FR-011, read off `ergane.yaml` and `.github/workflows/ergane-gates.yml`.

    Both files are in this diff; neither is assumed.  GitHub names each check run
    after the job's `name`, and the merge queue requires a check named after each
    declared gate, so a gate without a job of the same name is a gate nothing
    ever runs.
    """
    gates = manifest()["gates"]
    jobs = workflow()["jobs"]

    for gate in gates:
        assert gate in jobs, f"gate {gate} has no job in the gates workflow"
        assert jobs[gate]["name"] == gate, jobs[gate]["name"]


def test_the_test_job_runs_the_declared_gate_command():
    """FR-011 and US1-S1 together: the two files changed in one diff.

    The manifest is what the factory's boundary runs and the workflow is what the
    forge runs. They are two files, and the failure mode this asserts against is
    editing one of them -- a gate that measures coverage at the boundary and not
    in CI is a gate that reports two different numbers depending on who asked.
    """
    command = gate_command()
    scripts = job_scripts(workflow()["jobs"]["test"])

    assert command in scripts, (
        f"the workflow's test job does not run the declared gate command.\n"
        f"  ergane.yaml: {command}\n  workflow:    {scripts}"
    )


def test_the_unit_job_runs_the_declared_gate_command():
    """015 US2, FR-011: the frontend gate's two files, changed in one diff.

    The same claim as the test above, for the gate US2 taught to measure itself.
    It matters more here than it reads: the `unit` gate command is unchanged by
    that story -- what changed is `web/package.json`'s `test:unit` script and the
    floor in `web/vitest.config.ts` -- so the thing worth asserting is that the
    manifest and the workflow still name the one command that reaches them.
    `web/tests/gates/theUnitGateMeasuresItself.test.ts` asserts the rest of that
    chain from the frontend side, where the vitest configuration can be read as
    an object rather than as text.
    """
    command = gate_command_named("unit")
    scripts = job_scripts(workflow()["jobs"]["unit"])

    assert command in scripts, (
        f"the workflow's unit job does not run the declared gate command.\n"
        f"  ergane.yaml: {command}\n  workflow:    {scripts}"
    )


# --- US1-S2: the floor bites ------------------------------------------------

#: The synthetic project's floor: above what the below-floor run measures (75%)
#: and below what the control run measures (100%), and fractional, so the run
#: also exercises the `precision` this diff commits.
CONTROL_FLOOR = 87.5

#: What the below-floor run measures, exactly: three of the four statements in
#: `widget/__init__.py` (both `def` lines execute at import; only the body of the
#: function no test calls does not).
CONTROL_DROPPED_TOTAL = 75.0

WIDGET = '''\
def reached():
    return "reached"


def dropped():
    return "dropped"
'''

BOTH_TESTS = '''\
import widget


def test_reached():
    assert widget.reached() == "reached"


def test_dropped():
    assert widget.dropped() == "dropped"
'''

ONE_TEST = '''\
import widget


def test_reached():
    assert widget.reached() == "reached"
'''


def control_project(directory: Path, tests: str) -> Path:
    """A throwaway project wired the way this diff wires the real one.

    The `[tool.coverage.*]` tables are **read out of this repository's own
    `pyproject.toml`** and re-pointed at the synthetic package, so what runs
    below is the committed mechanism rather than a lookalike of it: delete
    `fail_under`, rename `precision`, drop the `xml` table, and this stops
    proving anything, which is the coupling that keeps the proof honest.
    """
    coverage = pyproject()["tool"]["coverage"]
    report = dict(coverage["report"], fail_under=CONTROL_FLOOR)
    run = dict(coverage["run"], source=["widget"])

    directory.mkdir(parents=True)
    (directory / "widget").mkdir()
    (directory / "widget" / "__init__.py").write_text(WIDGET)
    (directory / "tests").mkdir()
    (directory / "tests" / "test_widget.py").write_text(tests)
    (directory / "pyproject.toml").write_text(
        "[tool.pytest.ini_options]\n"
        'testpaths = ["tests"]\n'
        'pythonpath = ["."]\n'
        "\n"
        "[tool.coverage.run]\n"
        f"source = {run['source']!r}\n"
        f"data_file = \"{run['data_file']}\"\n"
        f"relative_files = {str(run['relative_files']).lower()}\n"
        "\n"
        "[tool.coverage.report]\n"
        f"show_missing = {str(report['show_missing']).lower()}\n"
        f"precision = {report['precision']}\n"
        f"fail_under = {report['fail_under']}\n"
        "\n"
        "[tool.coverage.xml]\n"
        f"output = \"{coverage['xml']['output']}\"\n"
    )
    return directory


def run_the_gate(directory: Path, home: Path) -> subprocess.CompletedProcess:
    """The committed gate command, minus `uv run`, pointed at the synthetic package.

    `uv run` is dropped because this interpreter is already the one `uv run`
    would resolve to; every flag after it is taken from `ergane.yaml` verbatim,
    with `--cov=pane` re-pointed at the package that exists here.
    """
    flags = shlex.split(gate_command())
    assert flags[:3] == ["uv", "run", "pytest"], flags
    argv = [
        "--cov=widget" if flag == "--cov=pane" else flag
        for flag in flags[3:]
    ]
    return subprocess.run(
        [sys.executable, "-m", "pytest", *argv],
        cwd=directory,
        env=child_environment(home),
        capture_output=True,
        text=True,
        timeout=300,
    )


def named_figures(output: str) -> tuple[float, float]:
    """The two numbers FR-002 requires the failure to name: measured, and floor."""
    floor = re.search(r"Required test coverage of ([\d.]+)%", output)
    measured = re.search(r"Total coverage: ([\d.]+)%", output)
    assert floor, f"the failure did not name the floor:\n{output}"
    assert measured, f"the failure did not name the measured figure:\n{output}"
    return float(measured.group(1)), float(floor.group(1))


@pytest.fixture
def scratch_home(tmp_path) -> Path:
    home = tmp_path / "home"
    home.mkdir()
    return home


def test_the_control_run_passes_and_writes_the_artifacts(tmp_path, scratch_home):
    """The control half of US1-S2, and US1-S1 and US1-S4 observed rather than read.

    Without it the failing run below proves only that *something* went wrong.
    With it, the one difference between a green gate and a red one is the line
    coverage of the package -- and the green run is where the Cobertura file and
    the terminal summary are seen to arrive, at the declared relative path,
    inside the directory the gate ran in.
    """
    project = control_project(tmp_path / "control", BOTH_TESTS)

    completed = run_the_gate(project, scratch_home)

    assert completed.returncode == 0, f"{completed.stdout}\n{completed.stderr}"

    # FR-001, both halves.  The artefact, at the declared path, relative to the
    # directory the gate ran in.
    artifact = project / COVERAGE_XML
    assert artifact.is_file(), sorted(path.name for path in project.iterdir())
    assert "<coverage " in artifact.read_text(), "not a Cobertura document"
    assert 'line-rate="1"' in artifact.read_text()
    # And the summary, on the terminal, where a failed gate's tail shows it.
    assert "TOTAL" in completed.stdout and "Cover" in completed.stdout

    # FR-004: nothing from `HOME`, nothing into it.
    assert sorted(scratch_home.iterdir()) == [], (
        f"the run wrote into HOME: {sorted(p.name for p in scratch_home.iterdir())}"
    )
    assert (project / COVERAGE_DATA).is_file(), "the data file left the worktree"


def test_the_floor_bites(tmp_path, scratch_home):
    """US1-S2, FR-002 (T006): below the floor, non-zero, naming both numbers.

    The same project as the control, the same command, the same committed floor
    mechanism -- one test removed.  A gate that reported the drop and exited zero
    would be a gate that records coverage rather than one that refuses a change
    that drops it, and the two are not the same promise.
    """
    project = control_project(tmp_path / "dropped", ONE_TEST)

    completed = run_the_gate(project, scratch_home)

    assert completed.returncode != 0, (
        f"coverage fell to {CONTROL_DROPPED_TOTAL}% under a floor of "
        f"{CONTROL_FLOOR}% and the gate passed:\n{completed.stdout}"
    )

    measured, floor = named_figures(completed.stdout)
    assert floor == CONTROL_FLOOR
    assert measured == CONTROL_DROPPED_TOTAL
    assert measured < floor

    # The pytest run itself passed; it is the floor that failed the gate, which
    # is what makes the message worth reading.
    assert "1 passed" in completed.stdout, completed.stdout

    # Still nothing from `HOME` on the failing path either (FR-004).
    assert sorted(scratch_home.iterdir()) == []
