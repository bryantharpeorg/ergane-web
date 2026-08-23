#!/usr/bin/env python3
"""Render the running floor pivoted on persona, not on node.

The node-per-row table repeats `persona`, `model` and `route` identically on
every row of an epic — four nodes of one epic is the same three values four
times, and the columns that carry the cost story are the ones being repeated.

Pivoting inverts that: each persona is named once with the five or six fields
that are *common* to every node it runs, and the nodes themselves collapse to a
single line. A floor where one epic is on the house implementer and another is
on a subscription-routed Opus then reads as two blocks rather than as eight rows
you have to diff by eye.

Run from the target repo with the ergane environment loaded:

    eval "$(~/.config/ergane/ergane-env.sh)"
    python3 .claude/skills/floor-status/scripts/running-by-persona.py

`ergane status` is the source for node state and persona: it prints both, which
`build status --json` does not, and it does not need the Temporal CLI (absent
under managed mode). The registry supplies everything else.
"""

from __future__ import annotations

import re
import subprocess
import sys

# `ergane status` node line:
#   us3  RUNNING  attempt 1  factory/<epic>/us3  persona implementer  model <alias>
NODE = re.compile(
    r"^\s+(?P<node>us\d+)\s+(?P<state>[A-Z_]+)\s+attempt\s+(?P<att>\d+)"
    r"(?:\s+\S+)?"
    r"(?:\s+persona\s+(?P<persona>\S+))?"
    r"(?:\s+model\s+(?P<model>\S+))?"
)
EPIC = re.compile(r"^\s+epic\s+(?P<epic>\S+)\s+(?P<state>[A-Z_]+)")

UNASSIGNED = "not yet dispatched"


def floor() -> list[dict]:
    out = subprocess.run(
        ["ergane", "status"], capture_output=True, text=True
    ).stdout.splitlines()
    rows, epic = [], "?"
    for line in out:
        if (m := EPIC.match(line)) is not None:
            epic = m.group("epic")
            continue
        if (m := NODE.match(line)) is not None:
            d = m.groupdict()
            d["epic"] = epic
            rows.append(d)
    return rows


def registry() -> dict:
    """The persona registry, however this script happens to be invoked.

    `factory` lives in the ergane tool venv, not on the system path, so a plain
    `import factory.config` fails under `python3` and every field silently reads
    as unknown. Find the venv's site-packages before giving up — the operator
    should not have to remember which interpreter to run this with.
    """
    import glob
    import os

    for candidate in glob.glob(
        os.path.expanduser(
            "~/.local/share/uv/tools/ergane-cli/lib/python*/site-packages"
        )
    ):
        if candidate not in sys.path:
            sys.path.append(candidate)
    try:
        from factory.config import load_personas  # noqa: PLC0415

        return load_personas()
    except Exception as exc:  # noqa: BLE001
        print(f"  (registry unreadable: {exc})", file=sys.stderr)
        return {}


def render(rows: list[dict], reg: dict) -> None:
    if not rows:
        print("  no dispatched nodes — the floor is empty")
        return

    groups: dict[str, list[dict]] = {}
    for r in rows:
        groups.setdefault(r.get("persona") or UNASSIGNED, []).append(r)

    # A persona actually running work is reported before one that is only pending.
    def live(items: list[dict]) -> int:
        return sum(1 for i in items if i["state"] in ("RUNNING", "VERIFYING"))

    for persona, items in sorted(
        groups.items(), key=lambda kv: (-live(kv[1]), kv[0] == UNASSIGNED, kv[0])
    ):
        entry = reg.get(persona)
        print(f"\n  {persona}")
        if entry is not None:
            agent = getattr(entry, "agent", "?")
            route = "subscription — unmetered" if agent == "subscription" else "gateway — billed per token"
            ctx = getattr(entry, "context_window", None)
            # `timeout_s`, not `timeout` — the dataclass field carries its unit.
            secs = getattr(entry, "timeout_s", None)
            fields = [
                ("model", getattr(entry, "model", "?") or "—"),
                ("route", route),
                ("fallback", getattr(entry, "fallback", None) or "none"),
                ("write", getattr(getattr(entry, "write_scope", None), "value", None)
                          or str(getattr(entry, "write_scope", "?"))),
                ("timeout", f"{secs}s ({secs // 3600}h)" if isinstance(secs, int) else "—"),
                ("context", f"{ctx:,}" if isinstance(ctx, int) else "—"),
            ]
            for k, v in fields:
                print(f"    {k:<10} {v}")
        elif persona != UNASSIGNED:
            print(f"    {'model':<10} ? — persona is not in the registry")

        # The nodes collapse to one line: the repetition lived here.
        nodes = "  ".join(
            f"{i['epic'].split('-')[0]}/{i['node']} {i['state']}·{i['att']}" for i in items
        )
        print(f"    {'nodes':<10} {nodes}")

        models = {i.get("model") for i in items if i.get("model")}
        declared = getattr(entry, "model", None) if entry else None
        # The DEBUGGER rung relabels the persona but never re-resolves the alias,
        # so an escalated attempt can run a model the registry no longer names.
        if declared and models and models != {declared}:
            print(f"    {'AT RUN':<10} {', '.join(sorted(models))}  ← differs from the registry")


if __name__ == "__main__":
    render(floor(), registry())
