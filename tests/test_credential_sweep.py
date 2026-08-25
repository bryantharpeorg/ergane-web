"""No committed file may contain a credential value.

001 swept `fixtures/` and `scripts/` for provider-shaped keys. Spec 003 US4
widens it to every committed fixture and to both test trees, and gives it the
three values this run actually uses: `tests/conftest.py` mints `PANE_TOKEN`,
`PANE_INTAKE_CREDENTIAL` and `PANE_ANSWER_IDENTITY` with `secrets.token_hex(16)`
and puts them in the environment, so the sweep has real secrets to look for and
nothing committed can be holding one.

**"Token-shaped" is a definition, not a judgement** — `[0-9a-fA-F]{16,}` or
`[A-Za-z0-9+/=_-]{20,}`, and only immediately after the scheme word and a single
space. That is what lets the sweep run over its own siblings without flagging
them: `tests/test_token_gate.py` builds every header with an f-string, so what
the committed file holds after `Bearer ` is `{token}` or `{wrong}`, and a brace
is in neither character class. A placeholder like `<token>` is not matched
either. A test that hard-codes a real-looking credential still fails, which is
the whole point of the definition being this one and not a looser one.
"""

import os
import re
import secrets
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]

#: What a real credential looks like once it is sitting in a file.
TOKEN_SHAPED = r"(?:[0-9a-fA-F]{16,}|[A-Za-z0-9+/=_\-]{20,})"

PATTERNS = [
    # OpenAI-style keys are word-bounded so that ``the-desk-sees-the-floor``
    # does not match (README sweep note; the substring is ``sk-sees``).
    re.compile(r"\bsk-[A-Za-z0-9_\-]{8,}\b"),
    re.compile(r"\bghp_[A-Za-z0-9_]{8,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{8,}\b"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    # US4: a bearer or basic credential written out rather than built from a
    # value, and a webhook URL with the operator's credential still in it.
    re.compile(r"\bBearer " + TOKEN_SHAPED),
    re.compile(r"\bBasic " + TOKEN_SHAPED),
    re.compile(r"/intake/" + TOKEN_SHAPED),
]

#: Every tree a credential could be committed into: the recorded floor, and both
#: test worlds. `tests/` includes this file and its siblings on purpose.
SUBTREES = ("fixtures", "scripts", "tests", "web/tests")

#: The three the run minted, plus 001's generic rule for anything else exported.
MINTED_NAMES = ("PANE_TOKEN", "PANE_INTAKE_CREDENTIAL", "PANE_ANSWER_IDENTITY")

#: Build products, not committed files. A `.pyc` holds the string constants of
#: the module it was compiled from, so sweeping one reports the source twice.
IGNORED_PARTS = frozenset({"__pycache__", "node_modules", ".pytest_cache", "test-results"})


def _committed_files(root: Path):
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if IGNORED_PARTS & set(path.parts):
            continue
        yield path


def _sensitive_env_values() -> set[str]:
    values: set[str] = set()
    for name, value in os.environ.items():
        if len(value) < 8:
            continue
        if name in MINTED_NAMES or name.endswith(("_TOKEN", "_KEY", "_SECRET", "_PASSWORD")):
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


def test_the_run_actually_minted_something_to_sweep_for():
    """Without this, the value half of the sweep would pass over an empty set."""
    values = _sensitive_env_values()
    for name in MINTED_NAMES:
        assert os.environ.get(name), f"{name} is not set; conftest.py should have minted it"
        assert os.environ[name] in values


@pytest.mark.parametrize("subtree", SUBTREES)
def test_no_credentials_in_subtree(subtree):
    sensitive_values = _sensitive_env_values()
    hits: list[str] = []
    root = ROOT / subtree
    if not root.exists():
        pytest.skip(f"{root} does not exist")
    for path in _committed_files(root):
        hits.extend(_scan_file(path, sensitive_values))
    assert not hits, "\n".join(hits)


def test_every_recorded_envelope_is_swept_too():
    """The provenance files are files like any other, and are named here so."""
    envelopes = [p for p in _committed_files(ROOT / "fixtures") if p.name.endswith(".envelope.json")]
    assert envelopes, "no envelope was found; the fixture floor should carry them"
    sensitive_values = _sensitive_env_values()
    hits: list[str] = []
    for path in envelopes:
        hits.extend(_scan_file(path, sensitive_values))
    assert not hits, "\n".join(hits)


def test_the_sweep_would_catch_a_planted_credential(tmp_path):
    """The definition bites, and the f-string form the siblings use does not.

    A sweep nobody has watched fail is a sweep nobody knows the shape of.
    """
    # Each sample is *assembled* at run time, never typed: a committed literal
    # here would be found by this very sweep when it reaches `tests/`.
    looks_real = secrets.token_hex(16)

    planted = tmp_path / "planted.py"
    planted.write_text('headers = {"Authorization": "Bearer ' + looks_real + '"}\n')
    assert _scan_file(planted, set())

    built = tmp_path / "built.py"
    built.write_text('headers = {"Authorization": f"Bearer ' + "{token}" + '"}\n')
    assert not _scan_file(built, set())

    placeholder = tmp_path / "placeholder.md"
    placeholder.write_text("ERGANE_WEBHOOK_URL=http://host" + "/intake/" + "<CREDENTIAL>\n")
    assert not _scan_file(placeholder, set())

    leaked_url = tmp_path / "leaked.md"
    leaked_url.write_text("ERGANE_WEBHOOK_URL=http://host" + "/intake/" + looks_real + "\n")
    assert _scan_file(leaked_url, set())
