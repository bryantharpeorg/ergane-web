#!/usr/bin/env python3
"""Lines of code by language and by module, over git-tracked files only.

Bootstraps cloc if it is not on PATH. sudo does not work in this environment,
so the standalone Perl script is fetched instead - from raw master, NOT from
the releases URL, which 404s and whose HTML body then gets executed as Perl
("Can't locate object method \"Not\" via package \"Found\"" is a failed
download wearing a Perl error's clothes).

usage: loc.py [repo_path]
"""
import collections
import csv
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request

CLOC_URL = "https://raw.githubusercontent.com/AlDanial/cloc/master/cloc"


def cloc_cmd():
    found = shutil.which("cloc")
    if found:
        return [found]
    if not shutil.which("perl"):
        sys.exit("neither cloc nor perl is available; cannot count")
    cache = os.path.join(tempfile.gettempdir(), "cloc-bootstrap.pl")
    if not os.path.exists(cache) or os.path.getsize(cache) < 100_000:
        sys.stderr.write("bootstrapping cloc ...\n")
        with urllib.request.urlopen(CLOC_URL, timeout=120) as r:
            body = r.read()
        if b"Count Lines of Code" not in body[:4000]:
            sys.exit("downloaded file is not cloc - check the URL")
        with open(cache, "wb") as fh:
            fh.write(body)
    return ["perl", cache]


def module(p):
    """Logical grouping. Returns (module, submodule)."""
    parts = p.split("/")
    sub = parts[1] if len(parts) > 2 else "(top-level)"
    if p.startswith("factory/"):
        return "production: factory/", sub
    if p.startswith("tests/fixtures/"):
        return "tests/", "fixtures (mostly machine-generated)"
    if p.startswith("tests/"):
        return "tests/", "(flat)" if len(parts) == 2 else parts[1]
    if p.startswith("specs/"):
        base = parts[-1]
        known = ("spec.md", "plan.md", "tasks.md", "workgraph.json")
        return "specs/", base if base in known else "other"
    if p.startswith(".agents/"):
        return "agent prompts: .agents/", sub
    if p.startswith(".claude/"):
        return "operator tooling: .claude/", sub
    if p.startswith(".specify/"):
        return "speckit: .specify/", sub
    if p.startswith("docs/"):
        return "docs/", parts[-1]
    if p.startswith("scripts/") or p.startswith("ralph/"):
        return "scripts/ + ralph/", parts[0]
    if p.startswith(".github/"):
        return "CI: .github/", parts[-1]
    return "repo root", p


def main(repo):
    os.chdir(repo)
    out = os.path.join(tempfile.gettempdir(), "cloc-byfile.csv")
    if os.path.exists(out):
        os.remove(out)
    subprocess.run(
        cloc_cmd() + ["--vcs=git", "--by-file", "--csv", "--quiet", f"--out={out}"],
        check=True, capture_output=True,
    )

    rows = []
    with open(out) as fh:
        for r in csv.DictReader(fh):
            if not r.get("filename"):
                continue
            p = r["filename"]
            rows.append((p[2:] if p.startswith("./") else p, r["language"],
                         int(r["blank"]), int(r["comment"]), int(r["code"])))

    by_lang = collections.defaultdict(lambda: [0, 0, 0, 0])
    by_mod = collections.defaultdict(lambda: [0, 0, 0, 0])
    by_sub = collections.defaultdict(lambda: [0, 0, 0, 0])
    mix = collections.defaultdict(collections.Counter)
    for p, lang, b, c, code in rows:
        m, s = module(p)
        for tgt in (by_lang[lang], by_mod[m], by_sub[(m, s)]):
            tgt[0] += 1
            tgt[1] += b
            tgt[2] += c
            tgt[3] += code
        mix[m][lang] += code
    total = sum(v[3] for v in by_mod.values())

    print("=== BY LANGUAGE (git-tracked files) ===")
    print(f"  {'language':<16}{'files':>7}{'code':>10}{'blank':>9}{'comment':>10}")
    for k, v in sorted(by_lang.items(), key=lambda kv: -kv[1][3]):
        print(f"  {k:<16}{v[0]:>7}{v[3]:>10,}{v[1]:>9,}{v[2]:>10,}")
    print(f"  {'TOTAL':<16}{sum(v[0] for v in by_lang.values()):>7}{total:>10,}")

    gen = by_sub.get(("tests/", "fixtures (mostly machine-generated)"), [0, 0, 0, 0])[3]
    if gen:
        print(f"\n  NOTE: {gen:,} of those lines are recorded fixtures under tests/fixtures/,")
        print(f"  not authored code. Authored total is roughly {total - gen:,}.")

    print("\n=== BY MODULE ===")
    print(f"  {'module':<30}{'files':>7}{'code':>10}{'%':>7}  languages")
    for m, v in sorted(by_mod.items(), key=lambda kv: -kv[1][3]):
        langs = ", ".join(f"{l} {c:,}" for l, c in mix[m].most_common(3))
        print(f"  {m:<30}{v[0]:>7}{v[3]:>10,}{100 * v[3] / total:>6.1f}%  {langs}")

    print("\n=== SUBMODULES ===")
    cur = None
    for (m, s), v in sorted(by_sub.items(), key=lambda kv: (-by_mod[kv[0][0]][3], -kv[1][3])):
        if m != cur:
            cur = m
            print(f"\n  {m}  ({by_mod[m][3]:,} code)")
        print(f"    {s:<34}{v[0]:>5} files{v[3]:>9,} code{v[2]:>8,} comment")

    prod = mix["production: factory/"]["Python"]
    test = mix["tests/"]["Python"]
    if prod:
        print(f"\n=== RATIOS ===")
        print(f"  test:production Python   {test:,} : {prod:,}  = {test / prod:.2f} : 1")
        pv = by_mod["production: factory/"]
        print(f"  comment density in factory/  {100 * pv[2] / pv[3]:.0f}%")
        md = by_lang.get("Markdown", [0, 0, 0, 0])[3]
        py = by_lang.get("Python", [0, 0, 0, 0])[3]
        print(f"  prose:code               {md:,} Markdown : {py:,} Python = {md / py:.2f} : 1")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
