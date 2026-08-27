# Recorded audit output

Constitution V, applied outside the fixture floor: these are the real answers
`pip-audit` and `npm audit` gave, kept so that `tests/test_the_audit_gate.py`
can prove the `audit` gate's threshold and its unreachable-network behaviour
**without depending on a live advisory feed** (015 T017). An advisory database
changes daily; a test that queried one would pass or fail on the news.

Nothing here is invented. Every file is a tool's own stdout or output file,
copied unedited, with the one exception noted below.

| File | Recorded from | What it holds |
|---|---|---|
| `npm-audit-clean.json` | `npm audit --json` in `web/`, 2026-08-27, after this story's lockfile bump | 281 packages, 0 vulnerabilities |
| `npm-audit-moderate.json` | `npm audit --json` over a lockfile pinning `esbuild@0.24.0` | one moderate advisory, `fixAvailable` false — the spec's own edge case |
| `npm-audit-critical.json` | `npm audit --json` in `web/`, 2026-08-27, **before** this story's lockfile bump | 6 vulnerable packages: 2 critical, 1 high, 3 moderate |
| `npm-audit-unreachable.json` | the same command with `npm_config_registry` pointed at a closed port | `{"message": "... connect ECONNREFUSED ..."}` — what npm answers instead of a report |
| `pip-audit-clean.json` | `pip-audit -r <uv export of this repo's lockfile> --no-deps --disable-pip -f json` | 56 packages, no vulnerabilities |
| `pip-audit-findings.json` | the same command over `jinja2==2.11.3` and `requests==2.19.0` | 10 advisories across 2 packages — and **not one severity field**, which is why the gate ranks every Python finding `unknown` |
| `pip-audit-skipped.json` | the same command over a requirements file whose only entry is an editable | one dependency, one `skip_reason`, zero vulns — the all-clear FR-010 forbids |
| `pip-audit-unreachable.stderr.txt` | the same command behind a closed proxy | the tail of the traceback, ending in `requests.exceptions.ProxyError` |

**The one edit.** `pip-audit-unreachable.stderr.txt` is the last four lines of a
much longer traceback, and the interpreter's `site-packages` path in them is
replaced by `<site-packages>`. The full traceback names an attempt's own
worktree, which differs on every machine that ever produces it and is noise in a
committed file. The lines kept are the ones the gate actually reads: the raised
exception and what it says about the connection.
