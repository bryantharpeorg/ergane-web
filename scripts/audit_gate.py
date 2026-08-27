#!/usr/bin/env python3
"""The `audit` gate: what this repository depends on, and what is known about it.

`ergane.yaml` declares this as the fifth gate and runs it as
`uv run python scripts/audit_gate.py`.  It audits both lockfiles -- `uv.lock`
through `pip-audit`, `web/package-lock.json` through `npm audit` -- writes each
tool's own JSON at the path `pyproject.toml`'s `[tool.audit-gate.reports]`
declares, and exits non-zero only on the severity that table declares (FR-008,
FR-009).

Four decisions are worth reading before changing anything here.

**Each tool's native JSON, verbatim** (plan D3).  This file writes what
`pip-audit -f json` and `npm audit --json` produced and does not wrap, merge or
re-shape it.  The gate's *judgement* is printed to the terminal; the artefacts
stay in the two formats a collector already understands, so when the platform
ships the typed collector PR-3 describes, this repository is already emitting
what it will collect.  Nothing in `pane/` or `web/src` reads these files, and
that is the point (spec § Out of scope, N54).

**A severity the service did not record is not a low severity.**  `npm audit`
reports a severity per advisory; `pip-audit`'s JSON carries none at all -- its
`VulnerabilityResult` has an id, a description, fix versions and aliases, and no
rating, whichever vulnerability service answered.  So every Python finding is
ranked `unknown`, and `unknown` sorts ABOVE `critical` in `SEVERITIES` below.
That is deliberate and it is constitution III applied to security: a value the
service did not record is shown as unknown, never as zero.  Ranking it below the
threshold instead would make the Python half of this gate decorative, because
every finding it can ever produce would be filed as harmless.

**A lookup that did not happen is not an all-clear** (FR-010, plan D5).  An
audit that could not reach the advisory database fails, names the network, and
prints no count and no verdict about vulnerabilities -- and its report file is
not written, so a stale green artefact cannot survive a red run.  The same rule
covers the quieter case: `pip-audit` will happily print "No known
vulnerabilities found" over a report whose only dependency carries a
`skip_reason`, and a skipped dependency is a dependency nobody looked up.

**There is no allowlist and there must not be one** (D-024).  The threshold in
`pyproject.toml` is the only dial.  If this gate is red and no change to this
repository can make it green, that is the gate working: report it and stop.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

ROOT = Path(__file__).resolve().parents[1]

#: Severity, least to most serious.  The first five are `npm audit`'s own
#: vocabulary; `unknown` is this gate's, and it sits at the top on purpose --
#: see the module docstring.  Ordering is what the threshold compares against,
#: so a name absent here is a name this gate refuses to rank.
SEVERITIES = ("info", "low", "moderate", "high", "critical", "unknown")

UNKNOWN = "unknown"

#: What a failed lookup looks like in either tool's output.  `pip-audit` raises a
#: `requests` exception and prints a traceback; `npm audit` answers JSON with a
#: `message` or an `error` instead of a report.  Matched case-insensitively
#: against whatever the tool said, so the gate can tell "the database says you
#: are clean" apart from "nobody answered".
NETWORK_MARKERS = (
    "connectionerror",
    "proxyerror",
    "newconnectionerror",
    "max retries exceeded",
    "temporary failure in name resolution",
    "name or service not known",
    "network is unreachable",
    "getaddrinfo",
    "read timed out",
    "readtimeout",
    "connecttimeout",
    "sslerror",
    "econnrefused",
    "econnreset",
    "enotfound",
    "etimedout",
    "eai_again",
    "socket_timeout",
    "request to ",
)

EXIT_OK = 0
EXIT_ABOVE_THRESHOLD = 1
EXIT_LOOKUP_INCOMPLETE = 2


# --- policy -----------------------------------------------------------------


@dataclass(frozen=True)
class Policy:
    """`pyproject.toml`'s `[tool.audit-gate]`, read rather than restated."""

    fail_on: str
    reports: dict[str, str]

    @property
    def threshold(self) -> int:
        return SEVERITIES.index(self.fail_on)

    def is_fatal(self, severity: str) -> bool:
        return rank(severity) >= self.threshold


def rank(severity: str) -> int:
    """Where a severity sits in the order, with anything unrecognised at the top.

    An unrecognised name is not a low one, for the same reason an unrecorded
    severity is not: this gate would rather stop the line over a word it does
    not know than file it as harmless.
    """
    try:
        return SEVERITIES.index(severity)
    except ValueError:
        return SEVERITIES.index(UNKNOWN)


def read_policy(root: Path = ROOT) -> Policy:
    with open(root / "pyproject.toml", "rb") as handle:
        table = tomllib.load(handle)["tool"]["audit-gate"]

    fail_on = table["fail_on"]
    if fail_on not in SEVERITIES:
        raise SystemExit(
            f"[tool.audit-gate] fail_on = {fail_on!r} is not a severity this gate ranks; "
            f"choose one of {', '.join(SEVERITIES)}"
        )
    reports = dict(table["reports"])
    for world, path in reports.items():
        if Path(path).is_absolute() or path.startswith(".."):
            raise SystemExit(
                f"[tool.audit-gate.reports] {world} = {path!r} leaves the worktree; "
                "a gate writes only inside the directory it runs in (D-013)"
            )
    return Policy(fail_on=fail_on, reports=reports)


# --- what an audit found ----------------------------------------------------


@dataclass(frozen=True)
class Finding:
    """One advisory against one package, as one of the two tools reported it."""

    world: str
    package: str
    affected: str
    advisory: str
    title: str
    severity: str
    fix: str

    def line(self, policy: Policy) -> str:
        verdict = "AT OR ABOVE THE THRESHOLD" if policy.is_fatal(self.severity) else "recorded"
        parts = [f"    {self.severity:<9} {self.package} {self.affected}".rstrip()]
        if self.advisory:
            parts.append(self.advisory)
        if self.title:
            parts.append(self.title)
        parts.append(f"fix: {self.fix}" if self.fix else "no fix available")
        parts.append(f"[{verdict}]")
        return "  ".join(parts)


@dataclass(frozen=True)
class Audit:
    """One world's audit: what it found, and whether it finished finding it."""

    world: str
    tool: str
    lockfile: str
    path: str
    findings: tuple[Finding, ...] = ()
    packages: int = 0
    #: Why this audit's answer cannot be read as complete, or None.  Set, and the
    #: gate fails and prints no count -- FR-010's "never an all-clear from a
    #: lookup that did not happen".
    incomplete: str | None = None
    #: The tool's own JSON, to be written verbatim at `path`; None when there is
    #: nothing worth writing, which is exactly when the lookup did not complete.
    report_text: str | None = None


# --- reading each tool's output ---------------------------------------------


def network_reason(*outputs: str) -> str | None:
    """The line that says the advisory database was not reached, if one said so."""
    for output in outputs:
        for line in reversed(output.splitlines()):
            lowered = line.lower()
            if any(marker in lowered for marker in NETWORK_MARKERS):
                return line.strip()
    return None


def _did_not_complete(what: str, *outputs: str) -> str:
    reason = network_reason(*outputs)
    if reason:
        return f"the network could not be reached, so {what}: {reason}"
    tail = next(
        (line.strip() for output in outputs for line in reversed(output.splitlines()) if line.strip()),
        "no output",
    )
    return f"{what}: {tail}"


def findings_from_pip_audit(report: dict) -> tuple[tuple[Finding, ...], tuple[str, ...], int]:
    """`pip-audit -f json`: its findings, its skipped dependencies, its package count.

    Severity is `unknown` for every one of them because the document carries
    none -- see the module docstring.  Skipped dependencies come back separately
    because a skipped dependency is the quiet half of FR-010.
    """
    findings: list[Finding] = []
    skipped: list[str] = []
    dependencies = report.get("dependencies", [])

    for dependency in dependencies:
        name = dependency.get("name", "?")
        if "skip_reason" in dependency:
            skipped.append(f"{name} ({dependency['skip_reason']})")
            continue
        for vulnerability in dependency.get("vulns", []):
            aliases = ", ".join(sorted(vulnerability.get("aliases", [])))
            findings.append(
                Finding(
                    world="python",
                    package=name,
                    affected=dependency.get("version", ""),
                    advisory=vulnerability.get("id", ""),
                    title=aliases,
                    severity=UNKNOWN,
                    fix=", ".join(vulnerability.get("fix_versions", [])),
                )
            )
    return tuple(findings), tuple(skipped), len(dependencies)


def findings_from_npm_audit(report: dict) -> tuple[Finding, ...]:
    """`npm audit --json`: one finding per advisory, per package it lands on.

    `vulnerabilities[name].via` holds advisory objects for a package named
    directly by an advisory and plain package names for one that is only
    reachable through another.  Both are recorded: the second kind carries the
    rollup severity npm computed for it, which is the same number
    `--audit-level` would have compared against, so this gate's threshold means
    what npm's own means.
    """
    findings: list[Finding] = []

    for name, entry in sorted(report.get("vulnerabilities", {}).items()):
        severity = entry.get("severity", UNKNOWN)
        fix = _npm_fix(entry.get("fixAvailable"))
        advisories = [via for via in entry.get("via", []) if isinstance(via, dict)]
        if advisories:
            for via in advisories:
                findings.append(
                    Finding(
                        world="node",
                        package=name,
                        affected=via.get("range", entry.get("range", "")),
                        advisory=via.get("url", str(via.get("source", ""))),
                        title=via.get("title", ""),
                        severity=via.get("severity", severity),
                        fix=fix,
                    )
                )
        else:
            through = ", ".join(str(via) for via in entry.get("via", []))
            findings.append(
                Finding(
                    world="node",
                    package=name,
                    affected=entry.get("range", ""),
                    advisory="",
                    title=f"vulnerable through {through}" if through else "",
                    severity=severity,
                    fix=fix,
                )
            )
    return tuple(findings)


def _npm_fix(fix_available) -> str:
    if isinstance(fix_available, dict):
        return f"{fix_available.get('name', '?')}@{fix_available.get('version', '?')}"
    return "available" if fix_available is True else ""


def python_audit(policy: Policy, exit_code: int, report_text: str | None, stderr: str) -> Audit:
    """`pip-audit`'s run, read.  Findings, or the reason there is no answer.

    `pip-audit` exits non-zero both when it finds vulnerabilities and when it
    cannot reach the service, so the exit code alone cannot tell those apart.
    The report can: a completed lookup writes one and a failed lookup writes
    nothing.  That, and not the exit code, is what decides here.
    """
    audit = Audit(
        world="python",
        tool="pip-audit",
        lockfile="uv.lock",
        path=policy.reports["python"],
    )

    if report_text is None:
        return _replace(audit, incomplete=_did_not_complete("pip-audit wrote no report", stderr))
    try:
        report = json.loads(report_text)
    except json.JSONDecodeError as error:
        return _replace(
            audit,
            incomplete=_did_not_complete(f"pip-audit's report is not JSON ({error})", stderr),
        )

    findings, skipped, packages = findings_from_pip_audit(report)
    incomplete = None
    if skipped:
        incomplete = (
            f"pip-audit could not look up {len(skipped)} of {packages} dependencies, "
            f"so this run knows nothing about them: {'; '.join(skipped)}"
        )
    elif exit_code not in (0, 1):
        incomplete = _did_not_complete(f"pip-audit exited {exit_code}", stderr)

    return _replace(
        audit,
        findings=findings,
        packages=packages,
        incomplete=incomplete,
        report_text=report_text,
    )


def node_audit(policy: Policy, exit_code: int, stdout: str, stderr: str) -> Audit:
    """`npm audit --json`'s run, read.

    `npm audit` exits non-zero whenever it found anything at all, so again the
    exit code decides nothing.  A completed lookup answers a document carrying
    `auditReportVersion`; a failed one answers `{"message": ...}` or
    `{"error": {...}}`, which is a report about npm and not about this
    repository's dependencies.
    """
    audit = Audit(
        world="node",
        tool="npm audit",
        lockfile="web/package-lock.json",
        path=policy.reports["node"],
    )

    try:
        report = json.loads(stdout)
    except json.JSONDecodeError as error:
        return _replace(
            audit,
            incomplete=_did_not_complete(f"npm audit answered no JSON ({error})", stdout, stderr),
        )

    if "auditReportVersion" not in report:
        said = report.get("error") or report.get("message") or report
        if isinstance(said, dict):
            said = said.get("summary") or said.get("detail") or json.dumps(said)
        return _replace(
            audit,
            incomplete=_did_not_complete("npm audit returned no report", str(said), stderr),
        )

    packages = report.get("metadata", {}).get("dependencies", {}).get("total", 0)
    return _replace(
        audit,
        findings=findings_from_npm_audit(report),
        packages=packages,
        report_text=stdout,
    )


def _replace(audit: Audit, **changes) -> Audit:
    return Audit(
        world=audit.world,
        tool=audit.tool,
        lockfile=audit.lockfile,
        path=audit.path,
        findings=changes.get("findings", audit.findings),
        packages=changes.get("packages", audit.packages),
        incomplete=changes.get("incomplete", audit.incomplete),
        report_text=changes.get("report_text", audit.report_text),
    )


# --- the verdict ------------------------------------------------------------


@dataclass(frozen=True)
class Verdict:
    exit_code: int
    lines: tuple[str, ...]

    def text(self) -> str:
        return "\n".join(self.lines)


def judge(audits: Sequence[Audit], policy: Policy) -> Verdict:
    """What the gate prints and what it exits with.

    Three outcomes and they are kept apart on purpose.  An incomplete lookup is
    reported as an incomplete lookup and never as a count, because a count
    printed beside "the network could not be reached" is the all-clear FR-010
    forbids.  A complete lookup prints everything it found -- below the
    threshold as well as above it, which is FR-009's "recorded, not fatal" --
    and fails only on what the committed threshold names.
    """
    lines = [
        f"audit gate — fail on {policy.fail_on} and above "
        f"(pyproject.toml [tool.audit-gate] fail_on = {policy.fail_on!r})",
        "",
    ]

    incomplete = [audit for audit in audits if audit.incomplete]
    fatal: list[Finding] = []

    for audit in audits:
        lines.append(f"{audit.world:<7} {audit.tool} over {audit.lockfile} → {audit.path}")
        if audit.incomplete:
            lines.append(f"  LOOKUP DID NOT COMPLETE: {audit.incomplete}")
            lines.append("  no report written; this run makes no claim about this world.")
            continue
        above = [finding for finding in audit.findings if policy.is_fatal(finding.severity)]
        fatal.extend(above)
        lines.append(
            f"  {audit.packages} packages audited, {len(audit.findings)} recorded, "
            f"{len(above)} at or above {policy.fail_on}"
        )
        for finding in audit.findings:
            lines.append(finding.line(policy))

    lines.append("")

    if incomplete:
        lines.append(
            "audit: FAIL — the advisory lookup did not complete, so this run cannot say "
            "whether this repository is exposed. A lookup that did not happen is not an "
            "all-clear (FR-010)."
        )
        return Verdict(EXIT_LOOKUP_INCOMPLETE, tuple(lines))

    if fatal:
        lines.append(
            f"audit: FAIL — {len(fatal)} finding(s) at or above {policy.fail_on}. "
            "There is no allowlist and there must not be one (D-024): bump the lockfile, "
            "remove the dependency, or have the operator move the committed threshold."
        )
        return Verdict(EXIT_ABOVE_THRESHOLD, tuple(lines))

    lines.append(f"audit: PASS — nothing at or above {policy.fail_on}.")
    return Verdict(EXIT_OK, tuple(lines))


# --- running the two tools --------------------------------------------------


def workspace(root: Path) -> Path:
    """Where everything this gate produces lands: inside the worktree, always.

    D-013 is the whole reason this function exists.  A gate is handed a fresh
    tmpfs `HOME` and only the worktree survives into it, so both tools are
    pointed at caches under here rather than at `~/.cache/pip` and `~/.npm`,
    and the requirements export `pip-audit` reads is written here rather than
    into a temporary directory the boundary cannot see.
    """
    return root / "audit"


def python_commands(root: Path, policy: Policy) -> tuple[list[str], list[str]]:
    """`uv export`, then `pip-audit` over what it exported.

    `pip-audit` has no reader for `uv.lock` -- its `--locked` flag takes PEP 751
    `pylock.toml` and nothing else -- so the lockfile is exported to a pinned
    requirements file first.  `--all-groups` because the dev group is a thing
    this repository depends on; `--frozen` because an export that re-resolves is
    an audit of something other than the committed lockfile.

    `--no-deps` because the export is already the complete resolved closure, and
    `--disable-pip` because resolving it again would build a throwaway
    environment.  `--cache-dir` inside the worktree, because the default is
    pip's HTTP cache under `HOME`.
    """
    work = workspace(root)
    requirements = work / "uv-export.requirements.txt"
    export = [
        "uv",
        "export",
        "--frozen",
        "--no-emit-project",
        "--all-groups",
        "--format",
        "requirements-txt",
        "-o",
        str(requirements),
    ]
    audit = [
        sys.executable,
        "-m",
        "pip_audit",
        "--requirement",
        str(requirements),
        "--no-deps",
        "--disable-pip",
        "--format",
        "json",
        "--progress-spinner",
        "off",
        "--cache-dir",
        str(work / "cache" / "pip-audit"),
        "--output",
        str(root / policy.reports["python"]),
    ]
    return export, audit


def node_command(root: Path) -> list[str]:
    """`npm audit` over `web/package-lock.json`, cached inside the worktree.

    No `npm ci` first: `npm audit` builds its tree from the lockfile, so the
    gate needs no `node_modules` and the workflow job that runs it installs
    nothing.  `--cache` for the same reason `--cache-dir` is passed above.
    """
    return [
        "npm",
        "--prefix",
        str(root / "web"),
        "audit",
        "--json",
        "--cache",
        str(workspace(root) / "cache" / "npm"),
    ]


def run(command: Sequence[str], cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        list(command),
        cwd=str(cwd),
        capture_output=True,
        text=True,
        timeout=900,
    )


def collect(root: Path, policy: Policy) -> list[Audit]:
    work = workspace(root)
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True)

    export, audit_command = python_commands(root, policy)
    report_path = root / policy.reports["python"]
    report_path.parent.mkdir(parents=True, exist_ok=True)

    exported = run(export, root)
    if exported.returncode != 0:
        python = _replace(
            python_audit(policy, exported.returncode, None, exported.stderr),
            incomplete=_did_not_complete(
                "the uv lockfile could not be exported for auditing", exported.stderr
            ),
        )
    else:
        completed = run(audit_command, root)
        text = report_path.read_text() if report_path.is_file() else None
        python = python_audit(policy, completed.returncode, text, completed.stderr)

    node_completed = run(node_command(root), root)
    node = node_audit(policy, node_completed.returncode, node_completed.stdout, node_completed.stderr)

    return [python, node]


def write_reports(root: Path, audits: Sequence[Audit]) -> None:
    """Each tool's JSON at its declared path -- and nothing where there is no answer.

    An audit whose lookup did not complete has its report path emptied rather
    than filled.  Yesterday's green artefact left in place beside today's red
    run is precisely the all-clear from a lookup that did not happen.
    """
    for audit in audits:
        path = root / audit.path
        path.parent.mkdir(parents=True, exist_ok=True)
        if audit.report_text is None:
            path.unlink(missing_ok=True)
            continue
        path.write_text(audit.report_text)


def main(root: Path = ROOT) -> int:
    policy = read_policy(root)
    audits = collect(root, policy)
    write_reports(root, audits)
    verdict = judge(audits, policy)
    print(verdict.text())
    return verdict.exit_code


if __name__ == "__main__":
    raise SystemExit(main())
