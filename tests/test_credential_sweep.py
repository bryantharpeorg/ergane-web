"""No fixture or script may contain a credential value.

The sweep reads environment variables at test time and scans every file under
`fixtures/` and `scripts/`.  Values that are exactly 8 characters or longer are
treated as sensitive literals; shorter values are too common to be reliable
indicators.
"""

import os
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]

PATTERNS = [
    # OpenAI-style keys are word-bounded so that ``the-desk-sees-the-floor``
    # does not match (README sweep note; the substring is ``sk-sees``).
    re.compile(r"\bsk-[A-Za-z0-9_\-]{8,}\b"),
    re.compile(r"\bBearer [A-Za-z0-9._\-]{8,}\b"),
    re.compile(r"\bghp_[A-Za-z0-9_]{8,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{8,}\b"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
]


def _sensitive_env_values() -> set[str]:
    values: set[str] = set()
    for name, value in os.environ.items():
        if name.endswith(("_TOKEN", "_KEY", "_SECRET", "_PASSWORD")) and len(value) >= 8:
            values.add(value)
    return values


def _scan_file(path: Path, sensitive_values: set[str]) -> list[str]:
    text = path.read_text(errors="replace")
    hits: list[str] = []
    for pattern in PATTERNS:
        for match in pattern.finditer(text):
            hits.append(f"{path}: matched {pattern.pattern!r} at {match.start()}")
    for value in sensitive_values:
        start = 0
        while True:
            idx = text.find(value, start)
            if idx == -1:
                break
            hits.append(f"{path}: contains env value of {value[:3]}... at {idx}")
            start = idx + 1
    return hits


@pytest.mark.parametrize("subtree", ["fixtures", "scripts"])
def test_no_credentials_in_subtree(subtree):
    sensitive_values = _sensitive_env_values()
    hits: list[str] = []
    root = ROOT / subtree
    if not root.exists():
        pytest.skip(f"{root} does not exist")
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        hits.extend(_scan_file(path, sensitive_values))
    assert not hits, "\n".join(hits)
