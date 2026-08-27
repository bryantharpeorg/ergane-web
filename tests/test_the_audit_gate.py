"""The fifth gate inventories what this repository depends on (015 US3).

`ergane.yaml` declared four gates that prove the code runs and nothing that says
what the code is built on top of. This story adds `audit`: `pip-audit` over
`uv.lock`, `npm audit` over `web/package-lock.json`, each tool's own JSON at a
declared path, and an exit code decided by one committed severity threshold and
by one other thing — whether the advisory lookup happened at all.

**What this file may assert, and what it may not.** Constitution IV: the judge
reads the diff, not the tree and not the gate results, so a scenario asserts
what the diff *commits* rather than what a command *would do*. The wiring
sections below therefore name every file they read — `pyproject.toml`,
`ergane.yaml`, `.github/workflows/ergane-gates.yml`, `scripts/audit_gate.py` —
because a file absent from the changed-file list reads to the judge as absent
from the repository.

**And the behaviour is proved over recorded output, never over a live feed**
(T017). An advisory database changes daily. A test that asked one whether
`vitest@2` is vulnerable would pass today and fail on the morning someone
publishes, and the thing under test is not the database — it is the threshold
and the refusal. So `tests/recorded/audit/` holds what the two tools really
answered on 2026-08-27, in the four shapes that matter (clean, below the
threshold, above it, and no answer at all), and every assertion below is made
against those. `tests/recorded/audit/README.md` records where each came from.

**The gate's colour today is a fact about the lockfile, not about the dial.**
On 2026-08-27 `npm audit` reported two critical and one high advisory against
`web/package-lock.json` — the vitest UI-server read-and-execute advisory and the
vite `server.fs.deny` bypass. This story's diff bumps `vite`, `vitest` and
`@vitest/coverage-v8` to versions that carry none of them rather than setting
`fail_on` above what the repository happens to have, which would have made the
gate green by making it decorative. `npm-audit-critical.json` is the recording
of that pre-bump state, and `test_the_threshold_bites` is what it is for: it is
this story's equivalent of US1's `test_the_floor_bites`, because a green gate
over a clean lockfile says only that today's tree is clean.
"""

from __future__ import annotations

import ast
import json
import shlex
import tomllib
from pathlib import Path

import pytest
import yaml

from scripts import audit_gate
from scripts.audit_gate import (
    EXIT_ABOVE_THRESHOLD,
    EXIT_LOOKUP_INCOMPLETE,
    EXIT_OK,
    SEVERITIES,
    Policy,
    judge,
    node_audit,
    python_audit,
    read_policy,
    write_reports,
)

ROOT = Path(__file__).resolve().parents[1]
RECORDED = Path(__file__).resolve().parent / "recorded" / "audit"

#: The declared artefact paths (FR-008), read here so a rename shows up as a
#: failure in this file rather than as a collector quietly finding nothing.
PIP_REPORT = "audit/pip-audit.json"
NPM_REPORT = "audit/npm-audit.json"

#: Phrases that amount to "we looked and you are fine". FR-010 forbids every one
#: of them from the verdict, and from the section of a world whose lookup did not
#: happen. A *sibling* world that really did answer still reports its own count,
#: and must: constitution III renders each failure in-section, naming what could
#: not be learned, rather than blanking a read that succeeded.
ALL_CLEAR = ("PASS", "no known vulnerabilities", "recorded,", "nothing at or above")


def section(verdict, world: str) -> str:
    """The lines of the verdict that belong to one world's audit."""
    lines = list(verdict.lines)
    starts = [index for index, line in enumerate(lines) if line.startswith(world)]
    assert starts, f"{world} has no section:\n{verdict.text()}"
    start = starts[0]
    end = next(
        (
            index
            for index, line in enumerate(lines[start + 1 :], start=start + 1)
            if line and not line.startswith(" ")
        ),
        len(lines),
    )
    return "\n".join(lines[start:end])


def summary(verdict) -> str:
    """The one line that is the gate's answer."""
    return verdict.lines[-1]


def code_strings(tree: ast.Module) -> list[str]:
    """Every string literal in a module except its docstrings.

    Prose about a flag is not the flag. `findings_from_npm_audit`'s docstring
    explains why this gate's threshold means what `--audit-level` means, and a
    sweep that could not tell that apart from passing it would be a sweep every
    author works around by deleting the sentence.
    """
    docstrings = {
        node.body[0].value
        for node in ast.walk(tree)
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef))
        and node.body
        and isinstance(node.body[0], ast.Expr)
        and isinstance(node.body[0].value, ast.Constant)
        and isinstance(node.body[0].value.value, str)
    }
    return [
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str) and node not in docstrings
    ]


def pyproject() -> dict:
    with open(ROOT / "pyproject.toml", "rb") as handle:
        return tomllib.load(handle)


def manifest() -> dict:
    with open(ROOT / "ergane.yaml", "rb") as handle:
        return yaml.safe_load(handle)


def workflow() -> dict:
    with open(ROOT / ".github" / "workflows" / "ergane-gates.yml", "rb") as handle:
        return yaml.safe_load(handle)


def recorded(name: str) -> str:
    return (RECORDED / name).read_text()


def policy() -> Policy:
    return read_policy(ROOT)


def pip_audit_of(name: str, exit_code: int = 1):
    """A `pip-audit` run that completed, over recorded output."""
    return python_audit(policy(), exit_code, recorded(name), "")


def npm_audit_of(name: str, exit_code: int = 1):
    """An `npm audit` run, over recorded output."""
    return node_audit(policy(), exit_code, recorded(name), "")


# --- FR-008: two lockfiles, two JSON documents, two declared paths ----------


def test_pip_audit_is_a_backend_dev_dependency():
    """T012, FR-008, constitution VII.

    Spec 015's frontmatter approved exactly three dependencies and this is the
    third. Read off `pyproject.toml`, which this diff changes.
    """
    dev = pyproject()["dependency-groups"]["dev"]
    assert any(entry.split(">=")[0].split("==")[0].strip() == "pip-audit" for entry in dev), dev


def test_the_gate_is_declared_and_runs_the_committed_script():
    """US3-S1, T013, read off `ergane.yaml` and `scripts/audit_gate.py`.

    The command carries no threshold and no paths — those are committed in
    `pyproject.toml`, for the same reason US1's coverage floor is (plan D1). So
    what the manifest may say is which script decides, and that script is in
    this diff.
    """
    command = manifest()["gates"]["audit"]

    assert shlex.split(command) == ["uv", "run", "python", "scripts/audit_gate.py"], command
    assert (ROOT / "scripts" / "audit_gate.py").is_file()


def test_both_lockfiles_are_audited_by_their_own_world_s_tool():
    """FR-008: the `uv` lockfile and the `npm` lockfile, not one of them.

    Asserted over the commands the gate builds rather than by running them,
    because running them is a live advisory lookup and T017 forbids one here.
    """
    export, audit = audit_gate.python_commands(ROOT, policy())
    node = audit_gate.node_command(ROOT)

    assert export[:2] == ["uv", "export"], export
    assert "--frozen" in export, "an export that re-resolves audits something other than uv.lock"
    assert "--all-groups" in export, "the dev group is a thing this repository depends on"
    assert audit[1:3] == ["-m", "pip_audit"], audit

    assert node[:2] == ["npm", "--prefix"], node
    assert node[2] == str(ROOT / "web")
    assert "audit" in node and "--json" in node, node


def test_the_report_paths_are_declared_in_pyproject_and_stay_in_the_worktree():
    """FR-008 and FR-004 together: a stable declared path, inside the worktree.

    PR-3's collector reads a standard format from a stable location; a path this
    file invented would earn a rewrite instead of collection for free. Relative,
    because the same gate runs in a sandbox, on a runner and on an operator's
    machine, and an absolute path names a directory that exists on one of them.
    """
    reports = pyproject()["tool"]["audit-gate"]["reports"]

    assert reports == {"python": PIP_REPORT, "node": NPM_REPORT}
    for world, path in reports.items():
        assert not Path(path).is_absolute(), (world, path)
        assert not path.startswith(".."), (world, path)


def test_the_gate_writes_each_tool_s_own_json_verbatim(tmp_path):
    """FR-008, and plan D3's "no bespoke wrapper", observed.

    What lands at the declared path is the bytes `npm audit --json` and
    `pip-audit -f json` produced — not a merged document, not a summary, not a
    shape this repository invented. A collector that already understands those
    two formats needs nothing from us.
    """
    audits = [pip_audit_of("pip-audit-findings.json"), npm_audit_of("npm-audit-critical.json")]

    write_reports(tmp_path, audits)

    assert (tmp_path / PIP_REPORT).read_text() == recorded("pip-audit-findings.json")
    assert (tmp_path / NPM_REPORT).read_text() == recorded("npm-audit-critical.json")
    # Still JSON on the way out, which is the half of FR-008 a byte comparison
    # would pass even if the recording were not.
    assert "dependencies" in json.loads((tmp_path / PIP_REPORT).read_text())
    assert "vulnerabilities" in json.loads((tmp_path / NPM_REPORT).read_text())


def test_both_tools_cache_inside_the_worktree(tmp_path):
    """FR-004, D-013 — the trap that already cost this repository a rework cycle.

    A gate is handed a fresh tmpfs `HOME`; only the worktree survives into it.
    `pip-audit` caches into pip's HTTP cache under `HOME` by default and `npm`
    into `~/.npm`, so both are pointed somewhere else here. This is the same
    shape as the Playwright browser path, and asserting it on the commands is
    the only way to assert it without a live lookup.
    """
    export, audit = audit_gate.python_commands(tmp_path, policy())
    node = audit_gate.node_command(tmp_path)

    for command in (export, audit, node):
        rendered = " ".join(command)
        assert "$HOME" not in rendered and "~" not in rendered, rendered
        for argument in command:
            if argument.startswith("/"):
                assert Path(argument).is_relative_to(tmp_path) or argument == audit[0], argument

    assert str(tmp_path / "audit" / "cache" / "pip-audit") in audit
    assert str(tmp_path / "audit" / "cache" / "npm") in node


# --- FR-009: recorded, not fatal -------------------------------------------


def test_the_threshold_is_committed_in_pyproject_and_is_a_severity_the_gate_ranks():
    """US3-S2, FR-009, plan D1 and D4.

    One number, in a committed file, where a reader sees it without running
    anything and where changing it shows up in a diff as a change to a security
    policy. `high` is the line: an advisory below it is something to schedule,
    one at or above it is something to stop for.
    """
    table = pyproject()["tool"]["audit-gate"]

    assert table["fail_on"] in SEVERITIES, table["fail_on"]
    assert table["fail_on"] == "high"
    assert policy().threshold == SEVERITIES.index("high")


def test_the_threshold_is_passed_on_no_command_line():
    """FR-009, the other half: committed *rather than* passed (plan D1).

    A `--audit-level=high` inside `ergane.yaml`'s gate string would hide this
    repository's security policy inside a quoted command, where moving it reads
    as an edit to a manifest rather than as what it is.
    """
    manifest_text = (ROOT / "ergane.yaml").read_text()
    workflow_text = (ROOT / ".github" / "workflows" / "ergane-gates.yml").read_text()

    for name, text in (("ergane.yaml", manifest_text), ("the gates workflow", workflow_text)):
        assert "--audit-level" not in text, f"{name} passes the threshold on a command line"
        assert "fail_on" not in text.replace("[tool.audit-gate] fail_on", ""), name


def test_a_finding_below_the_threshold_is_recorded_and_not_fatal(tmp_path):
    """US3-S2, FR-009, plan D4 — the spec's own edge case, end to end.

    A moderate advisory in a transitive dev dependency with no fix available is
    exactly what `npm-audit-moderate.json` holds. The gate exits zero, the
    finding is named in the output as recorded, and the JSON at the declared
    path still contains it. A gate that went red for this is a gate that gets
    deleted within a week; a gate that dropped it from the report is a tripwire,
    not an audit.
    """
    audits = [pip_audit_of("pip-audit-clean.json", exit_code=0), npm_audit_of("npm-audit-moderate.json")]
    written = write_reports(tmp_path, audits) or (tmp_path / NPM_REPORT).read_text()

    verdict = judge(audits, policy())

    assert verdict.exit_code == EXIT_OK, verdict.text()
    assert "moderate" in verdict.text()
    assert "esbuild" in verdict.text()
    assert "[recorded]" in verdict.text()
    # Recorded, not merely mentioned: it is in the JSON a collector will read.
    assert "esbuild" in json.loads(written)["vulnerabilities"]


def test_the_threshold_bites(tmp_path):
    """US3-S2's other half, over the state this repository was really in.

    `npm-audit-critical.json` is `web/package-lock.json` as it stood on the
    morning of 2026-08-27, before this story's lockfile bump: two critical
    advisories and one high. The gate must exit non-zero and must name what it
    is stopping for. Without this, `test_a_finding_below_the_threshold...`
    proves only that the gate is capable of exiting zero.
    """
    audits = [pip_audit_of("pip-audit-clean.json", exit_code=0), npm_audit_of("npm-audit-critical.json")]

    verdict = judge(audits, policy())

    assert verdict.exit_code == EXIT_ABOVE_THRESHOLD, verdict.text()
    assert "critical" in verdict.text()
    assert "vitest" in verdict.text()
    assert "AT OR ABOVE THE THRESHOLD" in verdict.text()
    # And the moderates in the same report are still there, below the line.
    assert "[recorded]" in verdict.text()


def test_the_recorded_severities_are_the_ones_npm_reported():
    """FR-009 rests on the severity being npm's, not one this gate assigned.

    Six vulnerable packages and five distinct advisories in the recording; the
    counts here are npm's own `metadata.vulnerabilities` tally, so a change to
    how `findings_from_npm_audit` reads a report cannot quietly re-rank one.
    """
    report = json.loads(recorded("npm-audit-critical.json"))
    findings = audit_gate.findings_from_npm_audit(report)

    assert {finding.severity for finding in findings} <= set(SEVERITIES)
    assert any(finding.severity == "critical" for finding in findings)
    assert any(finding.severity == "moderate" for finding in findings)
    assert report["metadata"]["vulnerabilities"]["critical"] == 2
    assert report["metadata"]["vulnerabilities"]["moderate"] == 3


def test_a_python_finding_ranks_unknown_because_pip_audit_records_no_severity():
    """Plan D5's principle applied to a severity rather than to a lookup.

    `pip-audit`'s JSON carries an id, fix versions, aliases and a description,
    and no rating whatsoever — the recording is the proof, and it is why this
    gate cannot simply compare a number. An unrecorded severity is not a low
    one (constitution III), so it ranks above `critical` and fails at any
    threshold. Ranking it below would file every Python advisory this gate can
    ever produce as harmless.
    """
    report = json.loads(recorded("pip-audit-findings.json"))
    vulnerabilities = [
        vulnerability
        for dependency in report["dependencies"]
        for vulnerability in dependency.get("vulns", [])
    ]

    assert vulnerabilities, "the recording holds no findings to rank"
    for vulnerability in vulnerabilities:
        assert "severity" not in vulnerability, vulnerability

    findings, skipped, packages = audit_gate.findings_from_pip_audit(report)
    assert packages == 2 and not skipped
    assert {finding.severity for finding in findings} == {"unknown"}
    assert SEVERITIES.index("unknown") > SEVERITIES.index("critical")
    assert policy().is_fatal("unknown")

    verdict = judge([python_audit(policy(), 1, recorded("pip-audit-findings.json"), "")], policy())
    assert verdict.exit_code == EXIT_ABOVE_THRESHOLD, verdict.text()
    assert "jinja2" in verdict.text()


def test_a_clean_pair_passes_and_says_so():
    """The control. Without it, every failure above proves only that something failed."""
    audits = [
        pip_audit_of("pip-audit-clean.json", exit_code=0),
        npm_audit_of("npm-audit-clean.json", exit_code=0),
    ]

    verdict = judge(audits, policy())

    assert verdict.exit_code == EXIT_OK, verdict.text()
    assert "audit: PASS" in verdict.text()
    assert "56 packages audited" in verdict.text()
    assert "281 packages audited" in verdict.text()


# --- FR-010: a lookup that did not happen is not an all-clear ---------------


def test_an_unreachable_npm_registry_fails_naming_the_network(tmp_path):
    """US3-S3, FR-010, plan D5.

    `npm audit` answers `{"message": "... ECONNREFUSED ..."}` instead of a
    report when it cannot reach the registry, and it exits non-zero — which it
    also does when it finds something, so the exit code decides nothing. The
    gate must say the network, must not print a count, and must leave no report
    behind for a collector to read as a clean bill of health.
    """
    audits = [pip_audit_of("pip-audit-clean.json", exit_code=0), npm_audit_of("npm-audit-unreachable.json")]
    write_reports(tmp_path, audits)

    verdict = judge(audits, policy())
    text = verdict.text()

    assert verdict.exit_code == EXIT_LOOKUP_INCOMPLETE, text
    assert "network" in text.lower()
    assert "ECONNREFUSED" in text
    assert "LOOKUP DID NOT COMPLETE" in text
    for phrase in ALL_CLEAR:
        assert phrase not in summary(verdict), f"the verdict reported {phrase!r}:\n{text}"
        assert phrase not in section(verdict, "node"), f"the unanswered world reported {phrase!r}"
    assert not (tmp_path / NPM_REPORT).exists(), "an unanswered lookup left a report behind"


def test_an_unreachable_advisory_service_fails_pip_audit_the_same_way(tmp_path):
    """US3-S3 for the other world.

    `pip-audit` does the opposite of npm: it raises, writes no report at all,
    and exits 1 — the same 1 it exits with when it finds vulnerabilities. So
    what decides here is whether a report exists, and the recorded traceback is
    what supplies the words the failure quotes.
    """
    audit = python_audit(policy(), 1, None, recorded("pip-audit-unreachable.stderr.txt"))
    audits = [audit, npm_audit_of("npm-audit-clean.json", exit_code=0)]
    write_reports(tmp_path, audits)

    verdict = judge(audits, policy())
    text = verdict.text()

    assert verdict.exit_code == EXIT_LOOKUP_INCOMPLETE, text
    assert "network" in text.lower()
    assert "ProxyError" in text
    for phrase in ALL_CLEAR:
        assert phrase not in summary(verdict), f"the verdict reported {phrase!r}:\n{text}"
        assert phrase not in section(verdict, "python"), f"the unanswered world reported {phrase!r}"
    assert not (tmp_path / PIP_REPORT).exists()


def test_a_stale_report_does_not_survive_a_failed_lookup(tmp_path):
    """FR-010, the quiet way it would be broken.

    Yesterday's green artefact left beside today's unanswered run is an
    all-clear from a lookup that did not happen — just one with a date on it.
    The gate empties the declared path rather than leaving it.
    """
    stale = tmp_path / NPM_REPORT
    stale.parent.mkdir(parents=True)
    stale.write_text(recorded("npm-audit-clean.json"))

    write_reports(tmp_path, [npm_audit_of("npm-audit-unreachable.json")])

    assert not stale.exists(), "a failed lookup left yesterday's clean report in place"


def test_a_skipped_dependency_is_not_an_all_clear():
    """FR-010's other half, and the reason it is written about lookups.

    `pip-audit` prints "No known vulnerabilities found" over the recording in
    `pip-audit-skipped.json`, whose only dependency it could not resolve. Zero
    findings out of zero lookups is not zero vulnerabilities, and the gate has
    to say so — this is the case that would pass silently forever if the exit
    code were trusted.
    """
    audit = pip_audit_of("pip-audit-skipped.json", exit_code=0)

    assert audit.incomplete is not None
    assert "could not look up" in audit.incomplete

    verdict = judge([audit], policy())
    assert verdict.exit_code == EXIT_LOOKUP_INCOMPLETE, verdict.text()
    for phrase in ALL_CLEAR:
        assert phrase not in verdict.text(), phrase
    assert "0" not in section(verdict, "python").split("LOOKUP DID NOT COMPLETE")[0]


def test_a_failed_lookup_beats_a_clean_one_in_the_same_run():
    """Two worlds, one exit code: the unanswered one decides.

    A run that reported PASS because the half that answered was clean would be
    the all-clear FR-010 forbids, assembled out of one true half.
    """
    audits = [
        python_audit(policy(), 1, None, recorded("pip-audit-unreachable.stderr.txt")),
        npm_audit_of("npm-audit-clean.json", exit_code=0),
    ]

    verdict = judge(audits, policy())

    assert verdict.exit_code == EXIT_LOOKUP_INCOMPLETE, verdict.text()
    assert "audit: PASS" not in verdict.text()


# --- FR-011: a gate the forge does not run does not exist -------------------


def test_the_audit_job_exists_and_runs_the_declared_gate_command():
    """US3-S4, FR-011, read off `ergane.yaml` and the gates workflow.

    Both files are in this diff; neither is assumed. GitHub names each check run
    after the job's `name`, so a gate without a job of that name is a gate the
    forge never runs. `tests/test_the_gates_measure_themselves.py` asserts the
    rule over every gate; this asserts it for the one this story adds.
    """
    jobs = workflow()["jobs"]

    assert "audit" in jobs, sorted(jobs)
    assert jobs["audit"]["name"] == "audit"

    scripts = [step["run"] for step in jobs["audit"]["steps"] if "run" in step]
    assert manifest()["gates"]["audit"] in scripts, scripts


def test_the_audit_job_installs_what_the_gate_needs_and_nothing_it_does_not():
    """D-013 in the forge, and the reason the job is three steps shorter than smoke.

    `uv sync` is what puts `pip-audit` in `.venv` inside the checkout. There is
    deliberately no `npm ci`: `npm audit` builds its tree from the lockfile, so
    installing 280 packages first would audit the same file more slowly.
    """
    steps = workflow()["jobs"]["audit"]["steps"]
    uses = [step.get("uses", "") for step in steps]
    scripts = [step["run"] for step in steps if "run" in step]

    assert any(use.startswith("astral-sh/setup-uv") for use in uses), uses
    assert any(use.startswith("actions/setup-node") for use in uses), uses
    assert "uv sync" in scripts, scripts
    assert not any("npm ci" in script for script in scripts), scripts


# --- D-024: no allowlist, and no reader ------------------------------------


def test_the_gate_grows_no_suppression_mechanism():
    """D-024 and the spec's Out of scope, asserted over the script this diff adds.

    The threshold is the only dial. `pip-audit --ignore-vuln`, an `--audit-level`
    handed to npm, or a committed list of advisory ids would each turn this gate
    into decoration, because the cheapest response to a red gate at three in the
    morning is to add one line to a list — and that line is indistinguishable in
    a diff from a considered decision.
    """
    tree = ast.parse((ROOT / "scripts" / "audit_gate.py").read_text())
    forbidden = ("--ignore-vuln", "--audit-level", "ignore-vuln", "ignore_vulns")

    for literal in code_strings(tree):
        for flag in forbidden:
            assert flag not in literal, f"the gate spells {flag!r} in its code: {literal!r}"

    export, audit = audit_gate.python_commands(ROOT, policy())
    node = audit_gate.node_command(ROOT)
    for command in (export, audit, node):
        assert "--ignore-vuln" not in command, command
        assert not any(argument.startswith("--audit-level") for argument in command), command

    assert set(pyproject()["tool"]["audit-gate"]) == {"fail_on", "reports"}


def test_nothing_in_the_pane_reads_the_audit_artifacts():
    """SC-003, and N54's argument, which this spec did not reverse.

    A per-repo reader for a per-repo file is the fragmentation the platform
    request exists to prevent. These artefacts are emitted at a stable path in a
    standard format and left for the collector PR-3 describes; the pane renders
    them when it is given a typed one, and not before.
    """
    trees = [ROOT / "pane", ROOT / "web" / "src"]
    for tree in trees:
        for path in sorted(tree.rglob("*")):
            if not path.is_file() or path.suffix not in {".py", ".ts", ".tsx"}:
                continue
            text = path.read_text()
            for artefact in (PIP_REPORT, NPM_REPORT, "pip-audit", "npm audit"):
                assert artefact not in text, f"{path} reads the audit gate's artefacts"


def test_the_gate_script_shells_only_the_two_audit_tools():
    """Constitution II's spirit for a build script rather than for a seam.

    The gate runs exactly three commands and every one of them is named in the
    functions this test reads. A `subprocess` call assembled anywhere else in
    the file is a gate doing something the manifest's one-line command does not
    describe.
    """
    tree = ast.parse((ROOT / "scripts" / "audit_gate.py").read_text())
    callers = {
        node.name
        for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef)
        and any(
            isinstance(inner, ast.Attribute) and inner.attr == "run"
            for inner in ast.walk(node)
            if isinstance(inner, ast.Attribute)
        )
    }

    assert callers == {"run"}, callers


# --- the policy refuses what it cannot rank ---------------------------------


@pytest.mark.parametrize("bad", ["urgent", "HIGH", "", "medium"])
def test_a_threshold_the_gate_cannot_rank_is_refused_rather_than_guessed(tmp_path, bad):
    """A dial set to a word this gate does not know is a gate with no threshold.

    Guessing would be the same class of mistake as filing an unrecorded severity
    as low: it would produce a number to compare against out of nothing.
    """
    (tmp_path / "pyproject.toml").write_text(
        "[tool.audit-gate]\n"
        f'fail_on = "{bad}"\n'
        "\n[tool.audit-gate.reports]\n"
        f'python = "{PIP_REPORT}"\n'
        f'node = "{NPM_REPORT}"\n'
    )

    with pytest.raises(SystemExit) as refusal:
        read_policy(tmp_path)

    assert bad in str(refusal.value) or "fail_on" in str(refusal.value)


def test_a_report_path_that_leaves_the_worktree_is_refused(tmp_path):
    """FR-004 again, as a rule the gate enforces rather than a comment asking for it."""
    (tmp_path / "pyproject.toml").write_text(
        "[tool.audit-gate]\n"
        'fail_on = "high"\n'
        "\n[tool.audit-gate.reports]\n"
        'python = "/tmp/pip-audit.json"\n'
        f'node = "{NPM_REPORT}"\n'
    )

    with pytest.raises(SystemExit) as refusal:
        read_policy(tmp_path)

    assert "worktree" in str(refusal.value)


def test_an_unrecognised_severity_is_ranked_at_the_top_not_at_the_bottom():
    """The rule behind `unknown`, stated once and asserted once.

    A severity vocabulary this gate has never seen — a future npm level, a
    service that says "severe" — must not sort below the threshold by accident.
    """
    assert audit_gate.rank("severe") == SEVERITIES.index("unknown")
    assert policy().is_fatal("severe")
    assert not policy().is_fatal("moderate")
    assert policy().is_fatal("high") and policy().is_fatal("critical")
