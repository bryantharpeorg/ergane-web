#!/usr/bin/env python3
"""Record Fixture-floor documents from ergane's real seams (spec 001 FR-007/FR-008).

Runs on the ergane tool venv's interpreter (it needs `factory` and `temporalio`):

    ~/.local/share/uv/tools/ergane-cli/bin/python scripts/record-fixtures.py <verb> [...]

Every document is written exactly as the seam returned it (`dataclasses.asdict`,
enums to their names, JSON-serialised) — never hand-edited (constitution V). Capture
provenance goes in a sidecar `<name>.envelope.json`, never inside the payload (FR-009).

Verbs:
  floor <specs_root> <out>            FloorStatus via factory.cli.status.collect_floor
  epic <epic_id> <out>                one epic_status answer via the Temporal query
  watch <epic_id> <out_dir> [secs]    poll epic_status; write every DISTINCT answer
  escalations <out>                   factory.escalation.client.open_escalations
  rollup <ledger.db> <out> [--by X]   factory.usage.ledger.rollup over open_readonly
  findings <doctor.db> <out>          factory.doctor.store.list_findings over connect_readonly
  questions <verification.db> <out>   factory.verify.store.pending_questions
  refusal <epic_id> <out>             query a CLOSED epic under NOT_OPEN → the refusal shape
  landing <repo> <out> [branch]       every spec's landings via pane.landing.read_landing_facts
  changed-files <repo> <landing.json> <out_dir>
                                      one document per landing commit via read_changed_files
  revision <repo> <landing.json> <out> [rev]
                                      the served revision and what it carries, via pane.revision
"""
from __future__ import annotations

import asyncio
import dataclasses
import enum
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _plain(value: Any) -> Any:
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return {k: _plain(v) for k, v in dataclasses.asdict(value).items()}
    if isinstance(value, enum.Enum):
        return value.name
    if isinstance(value, dict):
        return {str(k): _plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(v) for v in value]
    if isinstance(value, Path):
        return str(value)
    return value


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def write(out: Path, document: Any, *, seam: str, source: str, notes: str = "", **extra: Any) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(_plain(document), indent=2, sort_keys=False) + "\n")
    envelope = {
        "captured_at": _now(),
        "seam": seam,
        "source": source,
        "host": os.uname().nodename,
        "ergane_version": _ergane_version(),
        "notes": notes,
        **extra,
    }
    out.with_suffix(".envelope.json").write_text(json.dumps(envelope, indent=2) + "\n")
    print(f"wrote {out}")


def _ergane_version() -> str:
    try:
        from importlib.metadata import version

        return version("ergane-cli")
    except Exception:  # noqa: BLE001
        return "unknown"


async def _client():
    from temporalio.client import Client

    from factory.controlplane.resolve import resolve_temporal_target

    target = resolve_temporal_target()
    return await Client.connect(target.address, namespace=target.namespace), target


async def floor(specs_root: str, out: str) -> None:
    from factory.cli.status import collect_floor

    document = await collect_floor(Path(specs_root))
    write(Path(out), document, seam="factory.cli.status.collect_floor", source=f"specs_root={specs_root}",
          notes="the `ergane status --json` shape; degraded=True means a half the CLI could not read")


def _query_status_fn():
    from factory.workgraph.workflow import EpicWorkflow

    return EpicWorkflow.epic_status


async def epic(epic_id: str, out: str) -> None:
    from factory.cli.nouns.build import workflow_id

    client, target = await _client()
    handle = client.get_workflow_handle(workflow_id(epic_id))
    document = await handle.query(_query_status_fn())
    write(Path(out), document, seam="EpicWorkflow.epic_status (Temporal query)",
          source=f"workflow_id={workflow_id(epic_id)} @ {target.address}/{target.namespace}")


def _summary(status: Any) -> str:
    nodes = _plain(status)["nodes"]
    parts = []
    for node_id, node in nodes.items():
        tag = node["state"]
        if node.get("landing_state"):
            tag += f"/{node['landing_state']}"
        if node.get("awaiting_operator"):
            tag += "+paged"
        parts.append(f"{node_id}={tag}")
    return " ".join(parts)


async def watch(epic_id: str, out_dir: str, seconds: str = "7200") -> None:
    from factory.cli.nouns.build import workflow_id

    client, target = await _client()
    handle = client.get_workflow_handle(workflow_id(epic_id))
    deadline = asyncio.get_event_loop().time() + float(seconds)
    last = None
    seq = 0
    query = _query_status_fn()
    while asyncio.get_event_loop().time() < deadline:
        try:
            status = await handle.query(query)
        except Exception as exc:  # noqa: BLE001 - a refusal is itself worth recording
            print(f"query refused/failed: {type(exc).__name__}: {exc}")
            await asyncio.sleep(20)
            continue
        snapshot = json.dumps(_plain(status), sort_keys=True)
        if snapshot != last:
            seq += 1
            summary = _summary(status).replace(" ", "_").replace("/", "-")[:120]
            name = Path(out_dir) / f"{epic_id}-{seq:03d}-{summary}.json"
            write(name, status, seam="EpicWorkflow.epic_status (Temporal query, polled)",
                  source=f"workflow_id={workflow_id(epic_id)} @ {target.address}/{target.namespace}",
                  sequence=seq)
            last = snapshot
            if _plain(status)["epic_state"] in ("COMPLETED", "KILLED"):
                print("epic reached a terminal state; stopping")
                return
        await asyncio.sleep(float(os.environ.get("FX_POLL_S", "15")))
    print("watch deadline reached")


async def escalations(out: str) -> None:
    from factory.escalation.client import open_escalations

    client, target = await _client()
    document = await open_escalations(client)
    write(Path(out), list(document), seam="factory.escalation.client.open_escalations",
          source=f"{target.address}/{target.namespace}",
          notes="visibility index + each EscalationWorkflow's own escalation_status query; sorted by (expires_at, id)")


def rollup(ledger: str, out: str, *rest: str) -> None:
    from factory.usage.cli import open_readonly
    from factory.usage.ledger import rollup as _rollup

    by = "persona"
    if rest and rest[0] == "--by":
        by = rest[1]
    conn = open_readonly(ledger)
    try:
        document = _rollup(conn, by=by)
    finally:
        conn.close()
    write(Path(out), document, seam=f"factory.usage.ledger.rollup(by={by!r}) over factory.usage.cli.open_readonly",
          source=f"ledger={ledger}", notes="NULL metrics are unknown, never fabricated zeros")


def findings(db: str, out: str) -> None:
    from factory.doctor.store import connect_readonly, list_findings

    conn = connect_readonly(db)
    try:
        document = list_findings(conn)
    finally:
        conn.close()
    write(Path(out), document, seam="factory.doctor.store.list_findings over connect_readonly", source=f"doctor.db={db}")


def questions(db: str, out: str) -> None:
    import sqlite3

    from factory.verify.store import pending_questions

    conn = sqlite3.connect(f"file:{Path(db).resolve()}?mode=ro", uri=True)
    try:
        document = pending_questions(conn)
    finally:
        conn.close()
    write(Path(out), document, seam="factory.verify.store.pending_questions", source=f"verification.db={db}",
          notes="expires_at is factory-written (sent_at + the question timeout)")


async def refusal(epic_id: str, out: str) -> None:
    from temporalio.client import WorkflowQueryFailedError, WorkflowQueryRejectedError
    from temporalio.common import QueryRejectCondition

    from factory.cli.nouns.build import workflow_id

    client, target = await _client()
    handle = client.get_workflow_handle(workflow_id(epic_id))
    try:
        await handle.query(_query_status_fn(), reject_condition=QueryRejectCondition.NOT_OPEN)
    except (WorkflowQueryRejectedError, WorkflowQueryFailedError) as exc:
        # The shape `ergane build status --json` prints for a refused query
        # (factory/cli/nouns/build.py: QUERY_REFUSED -> "refusal" key, nodes {}).
        document = {"epic_id": epic_id, "workflow_id": workflow_id(epic_id),
                    "refusal": str(exc), "refusal_type": type(exc).__name__, "nodes": {}}
        write(Path(out), document, seam="EpicWorkflow.epic_status refused (WorkflowQueryRejectedError/FailedError)",
              source=f"workflow_id={workflow_id(epic_id)} @ {target.address}/{target.namespace}",
              notes="provoked by querying a CLOSED execution under QueryRejectCondition.NOT_OPEN; "
                    "this is the class ergane's CLI reports as `unavailable (<message>)`")
        return
    raise SystemExit("the query was answered, not refused — is the epic still open?")


def _pane_on_the_path() -> None:
    """Make this repository's own `pane` package importable by the recorder.

    The two landing verbs below are the only ones that ride a seam of *this*
    repository rather than one of ergane's, and they ride it deliberately: the
    demo floor must replay exactly what the live rooms read, so a recording made
    through anything but `pane/landing.py` could drift from the read it stands
    in for (016 FR-005).
    """
    root = str(Path(__file__).resolve().parents[1])
    if root not in sys.path:
        sys.path.insert(0, root)


def landing(repo: str, out: str, branch: str = "dev") -> None:
    """Every spec directory's landings, off the landing branch, as the pane reads them."""
    _pane_on_the_path()
    from pane.landing import read_landing_facts

    checkout = Path(repo).resolve()
    specs_root = checkout / "specs"
    document = {
        path.name: read_landing_facts(checkout, path.name, branch=branch)
        for path in sorted(specs_root.iterdir())
        if (path / "spec.md").is_file()
    }
    write(
        Path(out),
        document,
        seam="pane.landing.read_landing_facts over factory.workgraph.landed.landed_facts",
        source=f"{checkout} on {branch} at {_head(checkout, branch)}, read with fetch=False",
        notes="One entry per spec directory, each mapping story key to the landing the "
              "branch carries: commit, kind, merged_at, pr_number, subject. A spec the "
              "branch carries nothing for is recorded as an empty mapping, which is an "
              "answer; a spec absent from this document is a read nobody made, and the "
              "demo floor reports it as a degraded read naming this file (016 FR-006). "
              "A snapshot of a real branch: it ages exactly as the recorded floor does.",
    )


def changed_files(repo: str, landing_facts: str, out_dir: str) -> None:
    """One changed-file list per landing commit named in a landing recording."""
    _pane_on_the_path()
    from pane.landing import read_changed_files

    checkout = Path(repo).resolve()
    recorded = json.loads(Path(landing_facts).read_text())
    commits = sorted(
        {fact["commit"] for facts in recorded.values() for fact in facts.values()}
    )
    for commit in commits:
        write(
            Path(out_dir) / f"{commit}.json",
            read_changed_files(checkout, commit),
            seam="pane.landing.read_changed_files over factory.workgraph.worktree._git",
            source=f"{checkout}, commit {commit}",
            notes=f"The paths {commit} changed, sorted and unique, as the review room "
                  "reads them. Recorded from the same branch as the landing document "
                  "beside it; a commit no recording names is a read nobody made.",
        )


def revision(repo: str, landing_facts: str, out: str, rev: str = "dev") -> None:
    """The revision the checkout is on, and which landings it already carries.

    The review room's header (011 FR-009, FR-010).  Two facts, both git's: what
    `HEAD` resolves to with the metadata git holds about it, and — for every
    landing commit the recording beside this one names — whether that revision
    already carries it.

    `rev` defaults to the landing branch and not to `HEAD`: the recorder runs
    from whatever branch the operator is standing on, and a demo floor whose
    header named a node's working branch would be a recording of the recorder
    rather than of the floor.  The rest of `fixtures/` is captured off the
    landing branch, and this document has to be captured off the same one or the
    two are a header and a body from different days.

    **Both answers are recorded by name.**  `carries` and `omits` are separate
    lists rather than one list and an absence, because the demo floor must be
    able to tell "this revision does not carry that landing" from "nobody asked
    about that landing": the first is FR-010's alarm and the second is a read
    that was never made, and a recording that collapsed them would spend the
    alarm on a fact nobody established.
    """
    _pane_on_the_path()
    from pane.revision import read_served_revision, revision_contains

    checkout = Path(repo).resolve()
    served = read_served_revision(checkout, rev)
    recorded = json.loads(Path(landing_facts).read_text())
    commits = sorted(
        {fact["commit"] for facts in recorded.values() for fact in facts.values()}
    )

    carries: list[str] = []
    omits: list[str] = []
    for commit in commits:
        target = carries if revision_contains(checkout, served.revision, commit) else omits
        target.append(commit)

    write(
        Path(out),
        {
            "revision": served.revision,
            "branch": served.branch,
            "committed_at": served.committed_at,
            "subject": served.subject,
            "carries": carries,
            "omits": omits,
        },
        seam="pane.revision.read_served_revision and revision_contains over "
             "factory.workgraph.worktree._git",
        source=f"{checkout} on {rev} at {served.revision}, read with no network",
        notes="The revision this checkout was serving when the recording was taken, and "
              "which of the landing commits beside it that revision already carries. "
              "Recorded from the same checkout as the landing document, so the two stay "
              "in step; re-record both together after a promotion. A commit in neither "
              "list is a read nobody made and the demo floor reports it as one, never as "
              "a revision that omits it.",
    )


def _head(repo: Path, branch: str) -> str:
    """The head the recording was taken at, for the envelope's `source` line."""
    from factory.workgraph.landed import _resolve_default_head

    return _resolve_default_head(repo, branch, fetch=False)


VERBS = {"floor": floor, "epic": epic, "watch": watch, "escalations": escalations,
         "rollup": rollup, "findings": findings, "questions": questions, "refusal": refusal,
         "landing": landing, "changed-files": changed_files, "revision": revision}


def main(argv: list[str]) -> int:
    if not argv or argv[0] not in VERBS:
        print(__doc__)
        return 2
    fn = VERBS[argv[0]]
    result = fn(*argv[1:])
    if asyncio.iscoroutine(result):
        asyncio.run(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
