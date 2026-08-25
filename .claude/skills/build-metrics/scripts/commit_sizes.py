#!/usr/bin/env python3
"""Commit-size distribution, outlier-trimmed, plus the growth-adjusted delete ratio.

Two things this exists to stop you from reporting:

  1. The raw mean. Three commits carry ~48% of this repo's churn, so the raw
     mean describes those three commits and nothing else. Trimmed is the number.
  2. The repo-wide insertion:deletion ratio. It measures how young the tree is,
     not whether anyone deletes code - you cannot delete from a file nobody
     revisited. The by-revisit-count table is the honest version.

usage: commit_sizes.py [repo_path]
"""
import collections
import datetime
import os
import re
import statistics
import subprocess
import sys

SEP = "\x01C\x01"
NODE = re.compile(r"^\d{3}-[a-z0-9-]+/us\d+")


def commits():
    out = subprocess.run(
        [
            "git", "log", "--no-merges", "--numstat",
            "--format=" + SEP + "%H%x02%ad%x02%s", "--date=short",
        ],
        capture_output=True, text=True,
    ).stdout
    got, cur = [], None
    for line in out.splitlines():
        if line.startswith(SEP):
            if cur:
                got.append(cur)
            h, ad, subj = line[len(SEP):].split("\x02")
            cur = {"h": h[:8], "day": ad, "subj": subj, "ins": 0, "del": 0, "files": 0, "paths": []}
            continue
        p = line.split("\t")
        if cur is None or len(p) != 3 or p[0] == "-":
            continue  # blank line or binary file
        cur["ins"] += int(p[0])
        cur["del"] += int(p[1])
        cur["files"] += 1
        cur["paths"].append((p[2], int(p[0]), int(p[1])))
    if cur:
        got.append(cur)
    for c in got:
        c["churn"] = c["ins"] + c["del"]
    return got


def klass(path):
    if path.startswith("factory/"):
        return "production"
    if path.startswith("tests/fixtures/"):
        return "fixtures"
    if path.startswith("tests/"):
        return "tests"
    if path.startswith("specs/"):
        return "specs"
    if path.startswith("docs/") or path.endswith(".md"):
        return "docs"
    return "other"


def stats(label, cs):
    if not cs:
        return
    ch = sorted(c["churn"] for c in cs)
    f = [c["files"] for c in cs]
    i, d = sum(c["ins"] for c in cs), sum(c["del"] for c in cs)
    print(
        f"  {label:<34}n={len(ch):>4}  mean {statistics.mean(ch):>6.0f}  "
        f"median {statistics.median(ch):>5.0f}  sd {statistics.pstdev(ch):>6.0f}  "
        f"files med {statistics.median(f):>3.0f}  {i / max(d, 1):>5.1f}:1"
    )


def main(repo):
    os.chdir(repo)
    C = commits()
    ch = sorted(c["churn"] for c in C)
    n = len(ch)
    qs = statistics.quantiles(ch, n=4, method="inclusive")
    q1, q3 = qs[0], qs[2]
    iqr = q3 - q1
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr

    print(f"non-merge commits: {n}   min {ch[0]}  Q1 {q1:.0f}  median {statistics.median(ch):.0f}"
          f"  Q3 {q3:.0f}  max {ch[-1]}")
    print(f"Tukey fences [{lo:.0f}, {hi:.0f}]  -- note the lower fence is normally negative here,")
    print("so nothing trims from the low end and 'outliers on either side' does not apply.")

    print("\n=== COMMIT SIZE (churn = insertions + deletions) ===")
    stats("raw (all)", C)
    inf = [c for c in C if lo <= c["churn"] <= hi]
    stats("Tukey 1.5*IQR  <- report this", inf)
    for pct in (5, 10):
        k = int(n * pct / 100)
        stats(f"{pct}% trimmed both tails", sorted(C, key=lambda c: c["churn"])[k : n - k])
    print(f"  dropped by Tukey: {sum(1 for c in C if c['churn'] > hi)} high, "
          f"{sum(1 for c in C if c['churn'] < lo)} low")

    print("\n=== FACTORY NODE LANDINGS vs OPERATOR COMMITS (trimmed per-group) ===")
    for label, sub in (
        ("node landings", [c for c in C if NODE.match(c["subj"])]),
        ("operator", [c for c in C if not NODE.match(c["subj"])]),
    ):
        s = sorted(c["churn"] for c in sub)
        sq = statistics.quantiles(s, n=4, method="inclusive")
        f_lo, f_hi = sq[0] - 1.5 * (sq[2] - sq[0]), sq[2] + 1.5 * (sq[2] - sq[0])
        stats(label + " (trimmed)", [c for c in sub if f_lo <= c["churn"] <= f_hi])

    print("\n=== LARGEST COMMITS (the ones that eat the raw mean) ===")
    for c in sorted(C, key=lambda c: -c["churn"])[:8]:
        print(f"  {c['day']}  {c['h']}  {c['churn']:>7} churn  {c['files']:>4}f  {c['subj'][:58]}")

    print("\n=== CHURN BY PATH CLASS ===")
    tot = collections.Counter()
    for c in C:
        for p, a, d in c["paths"]:
            tot[klass(p)] += a + d
    s = sum(tot.values())
    for k, v in tot.most_common():
        print(f"  {k:<12}{v:>10,}  {100 * v / s:>5.1f}%")

    print("\n=== DELETE RATIO BY REVISIT COUNT (the growth-adjusted version) ===")
    print("Repo-wide ins:del measures youth. This measures discipline. Quote the last row.")
    live = set(subprocess.run(["git", "ls-files"], capture_output=True, text=True).stdout.split())
    touch, ins, dele = collections.Counter(), collections.Counter(), collections.Counter()
    for c in C:
        for p, a, d in c["paths"]:
            if "=>" in p:
                continue  # rename entry; path is unparseable
            touch[p] += 1
            ins[p] += a
            dele[p] += d

    def bucket(t):
        return ("1 (never revisited)" if t == 1 else "2-3" if t <= 3
                else "4-6" if t <= 6 else "7-12" if t <= 12 else "13+")

    b = collections.defaultdict(lambda: [0, 0, 0])
    for p, t in touch.items():
        if p not in live or not p.endswith(".py"):
            continue
        if not (p.startswith("factory/") or p.startswith("tests/")):
            continue
        k = bucket(t)
        b[k][0] += 1
        b[k][1] += ins[p]
        b[k][2] += dele[p]
    print(f"  {'touches':<22}{'files':>7}{'ins':>10}{'del':>9}{'ins:del':>10}")
    for k in ["1 (never revisited)", "2-3", "4-6", "7-12", "13+"]:
        if k not in b:
            continue
        f, i, d = b[k]
        print(f"  {k:<22}{f:>7}{i:>10,}{d:>9,}{i / max(d, 1):>9.1f}:1")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
