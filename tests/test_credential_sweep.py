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

**The definition moved to `pane/sweep.py`; nothing about it changed** (013 US2,
FR-007). A failing gate's `output_tail` is now rendered, and it is raw process
output — so it goes through a sweep on its way into the showfloor document, and
US2-S3 asks that it be *the same* sweep this file runs over every committed
file. One definition is the only way that sentence can be true, so the patterns,
the token shape and the environment rule live in the module both callers import
and this file keeps the trees, the traversal and the assertions that are its
own. `tests/test_gate_tail_sweep.py` asserts the two are the same object.
"""

import os
import secrets
from pathlib import Path

import pytest

from pane.sweep import MINTED_NAMES, PATTERNS, TOKEN_SHAPED, credential_hits  # noqa: F401
from pane.sweep import SECRET_SUFFIXES, MIN_SECRET

ROOT = Path(__file__).resolve().parents[1]

#: Every tree a credential could be committed into: the recorded floor, and both
#: test worlds. `tests/` includes this file and its siblings on purpose.
SUBTREES = ("fixtures", "scripts", "tests", "web/tests")

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
    """The run's own credentials, by the shared rule (`pane.sweep`'s)."""
    values: set[str] = set()
    for name, value in os.environ.items():
        if len(value) < MIN_SECRET:
            continue
        if name in MINTED_NAMES or name.endswith(SECRET_SUFFIXES):
            values.add(value)
    return values


def _scan_file(path: Path, sensitive_values: set[str]) -> list[str]:
    """One file, through the shared scanner, with the path put back on."""
    text = path.read_text(errors="replace")
    return [f"{path}: {hit}" for hit in credential_hits(text, sensitive_values)]


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
