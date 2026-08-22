#!/usr/bin/env python3
"""Story rework rate and its trend, read from the live factory stores.

Two definitions are reported because they differ by ~13 points and only one of
them is the honest "had to be redone" number:

  verification rework - the story's first *verified* attempt came back FAIL.
  dispatch rework     - the story was dispatched more than once, for any reason
                        (adds agent_error, timeout, killed, question, which the
                        verification store never sees because nothing was judged).

Both stores are opened read-only. This is production data.

usage: rework.py [repo_path]
"""
import collections
import datetime
import os
import re
import sqlite3
import subprocess
import sys

WINDOW = 20  # rolling window, in stories


def monday(day):
    d = datetime.date.fromisoformat(day)
    return (d - datetime.timedelta(days=d.weekday())).isoformat()


def ro(path):
    if not os.path.exists(path):
        sys.exit(f"missing store: {path} (run from the repo root, or pass its path)")
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True)


def rule(title):
    print(f"\n=== {title} ===")


def main(repo):
    os.chdir(repo)
    ver = ro(os.environ["ERGANE_ROOT"] + "/verification.db")
    led = ro(os.environ["ERGANE_ROOT"] + "/ledger.db")

    # ---- verification level -------------------------------------------------
    rows = ver.execute(
        "select epic_id, node_id, attempt, verdict, finished_at, form "
        "from verification_results order by finished_at"
    ).fetchall()
    if not rows:
        sys.exit("verification_results is empty")

    forms = {r[5] for r in rows}
    attempts = collections.defaultdict(dict)
    for epic, node, att, verdict, fin, _form in rows:
        # keep the worst verdict if a story somehow has both forms at one attempt
        prev = attempts[(epic, node)].get(att)
        if prev is None or (prev["v"] == "PASS" and verdict == "FAIL"):
            attempts[(epic, node)][att] = {"v": verdict, "f": fin}

    stories = []
    for key, att in attempts.items():
        lo = min(att)  # not hardcoded to 1: restored stores can lose attempt 1
        passed_at = min((a for a, x in att.items() if x["v"] == "PASS"), default=None)
        stories.append(
            {
                "key": key,
                "day": att[lo]["f"][:10],
                "ts": att[lo]["f"],
                "reworked": att[lo]["v"] == "FAIL",
                "passed_at": passed_at,
                "n": len(att),
            }
        )
    stories.sort(key=lambda s: s["ts"])
    n = len(stories)
    rw = sum(s["reworked"] for s in stories)

    print(f"window: {rows[0][4][:10]} -> {rows[-1][4][:10]}   forms present: {sorted(forms)}")
    rule("VERIFICATION-LEVEL REWORK (first verified attempt came back FAIL)")
    print(f"  stories verified   {n}")
    print(f"  passed first try   {n - rw}  ({100 * (n - rw) / n:.1f}%)")
    print(f"  REWORKED           {rw}  ({100 * rw / n:.1f}%)")

    depth = collections.Counter(
        s["passed_at"] if s["passed_at"] is not None else "never" for s in stories
    )
    print("\n  landed on:")
    for k in sorted(depth, key=lambda x: (x == "never", x)):
        label = "never passed" if k == "never" else f"attempt {k}"
        print(f"    {label:<14}{depth[k]:>4}  ({100 * depth[k] / n:>5.1f}%)")

    # ---- dispatch level -----------------------------------------------------
    urows = led.execute(
        "select epic_id, node_id, attempt, termination, issued_at from usage_records"
    ).fetchall()
    disp = collections.defaultdict(set)
    firstseen = {}
    term = collections.Counter()
    for epic, node, att, t, iss in urows:
        k = (epic, node)
        disp[k].add(att)
        term[t] += 1
        if k not in firstseen or iss < firstseen[k]:
            firstseen[k] = iss
    dn = len(disp)
    drw = sum(1 for v in disp.values() if len(v) > 1)

    rule("DISPATCH-LEVEL REWORK (dispatched more than once, for any reason)")
    print(f"  stories dispatched {dn}")
    print(f"  REWORKED           {drw}  ({100 * drw / dn:.1f}%)   <- lead with this one")
    print(f"  mean attempts/story {sum(len(v) for v in disp.values()) / dn:.2f}")
    print("\n  attempts dispatched per story:")
    for k, c in sorted(collections.Counter(len(v) for v in disp.values()).items()):
        print(f"    {k} attempt(s)  {c:>4}  ({100 * c / dn:>5.1f}%)")
    print("\n  terminations (rows, ~2 per attempt - one per persona):")
    for k, c in term.most_common():
        print(f"    {k:<14}{c:>5}  ({100 * c / len(urows):>5.1f}%)")

    # ---- trend --------------------------------------------------------------
    rule("TREND BY WEEK (stories dated by their first attempt)")
    byweek = collections.defaultdict(lambda: [0, 0, 0, 0])  # vN, vRework, dN, dRework
    for s in stories:
        b = byweek[monday(s["day"])]
        b[0] += 1
        b[1] += s["reworked"]
    for k, v in disp.items():
        b = byweek[monday(firstseen[k][:10])]
        b[2] += 1
        b[3] += len(v) > 1
    print(f"  {'week of':<13}{'stories':>8}{'verif rework':>15}{'dispatch rework':>18}")
    for w in sorted(byweek):
        vn, vr, dnw, dr = byweek[w]
        vs = f"{vr}/{vn} ({100 * vr / vn:.1f}%)" if vn else "-"
        ds = f"{dr}/{dnw} ({100 * dr / dnw:.1f}%)" if dnw else "-"
        print(f"  {w:<13}{vn:>8}{vs:>15}{ds:>18}")

    rule(f"ROLLING {WINDOW}-STORY WINDOW (chronological; fixed denominator)")
    if n >= WINDOW:
        for i in range(0, n - WINDOW + 1, 5):
            win = stories[i : i + WINDOW]
            r = sum(s["reworked"] for s in win)
            bar = "#" * round(r / WINDOW * 40)
            print(
                f"  {i + 1:>3}-{i + WINDOW:<4}{win[0]['day']} -> {win[-1]['day']}"
                f"  {100 * r / WINDOW:>5.1f}% {bar}"
            )
        win = stories[-WINDOW:]
        r = sum(s["reworked"] for s in win)
        print(f"  LAST {WINDOW}   {win[0]['day']} -> {win[-1]['day']}  {100 * r / WINDOW:>5.1f}%")
    else:
        print(f"  only {n} stories; need {WINDOW}")

    # ---- coverage -----------------------------------------------------------
    rule("COVERAGE (state this in the report - the stores are not a census)")
    subj = subprocess.run(
        ["git", "log", "--no-merges", "--format=%s"], capture_output=True, text=True
    ).stdout.splitlines()
    node_re = re.compile(r"^(\d{3}-[a-z0-9-]+)/(us\d+)")
    landed = {f"{m.group(1)}/{m.group(2)}" for s in subj if (m := node_re.match(s))}
    have = {f"{e}/{nd}" for e, nd in disp}
    missing = sorted(landed - have)
    never = sorted(have - landed)
    print(f"  story landings in git   {len(landed)}")
    print(f"  stories in the ledger   {len(have)}")
    cov = 100 * len(landed & have) / len(landed) if landed else 0
    print(f"  landed AND measured     {len(landed & have)}  ({cov:.0f}% coverage)")
    print(f"\n  landed but NOT in the ledger ({len(missing)}) - lost store data:")
    for s in missing[:12]:
        print(f"    {s}")
    if len(missing) > 12:
        print(f"    ... and {len(missing) - 12} more")
    print(f"\n  in the ledger but never landed ({len(never)}) - killed or in flight:")
    for s in never[:12]:
        print(f"    {s}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
