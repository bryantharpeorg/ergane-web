"""The three configured values every pane test now runs against, minted per run.

Closing the auth seam rewrites the landed pytest suite, and that rewrite is
US4's declared work (FR-014): before this file, `create_app()` served every route
open and every test called one with no credential.  After it, `create_app()`
refuses to build without a token, so *every* test in the suite needs one — which
is exactly the property being proved.

**Nothing here is a literal.**  `PANE_TOKEN`, `PANE_INTAKE_CREDENTIAL` and
`PANE_ANSWER_IDENTITY` are minted with `secrets.token_hex(16)` at run time and
put in the environment, so `tests/test_credential_sweep.py` has a real value to
sweep for and nothing committed to find it in (T066).

They are minted *above the `pane` imports*, and that ordering is load-bearing
rather than untidy: `pane/app.py` builds a module-level `app = create_app()`, so
importing it with no `PANE_TOKEN` set raises the startup refusal T054 added.  The
`credentials` fixture below is the seam tests read the values through; the
module-level call is only what makes them early enough — conftest is imported
before any test module, so the whole suite inherits them.

**And the same file installs the hermetic observer** (009 US3, FR-009).  For the
same reason: conftest is imported before any test module, so installing
`tests/hermetic.py`'s audit hook here is what puts the *whole* suite under it,
and the `reads_no_host_state` fixture below is what makes every test assert the
property rather than one test asserting it for everybody.
"""

import os
import secrets
import tempfile
from pathlib import Path

import hermetic

#: Installed above the `pane` imports for the same reason the credentials are
#: minted above them: an audit hook sees only what happens after it is added.
hermetic.install()


def _mint_into_environment() -> dict[str, str]:
    """Mint the three values once per run and set them for the whole process."""
    minted = {
        "PANE_TOKEN": secrets.token_hex(16),
        "PANE_INTAKE_CREDENTIAL": secrets.token_hex(16),
        "PANE_ANSWER_IDENTITY": secrets.token_hex(16),
    }
    for name, value in minted.items():
        os.environ[name] = value
    return minted


#: Set before `pane.app` is imported, below.  See the module docstring.
MINTED = _mint_into_environment()


def _scratch_store_for_the_import() -> str:
    """Where the module-level `app = create_app()` puts its store (009 US3).

    Importing `pane.app` builds an application, and building one opens the
    delivery store.  Unset, `PANE_ATTENTION_DB` resolves to `.pane/attention.db`
    *relative to the working directory* — so merely importing the module under
    test wrote a store into the repository and left it there.  The file is
    gitignored, which is the whole problem: the worktree does not carry it into
    the gate, so the boundary always read a store that had just been created and
    the operator read whatever the last run left behind.

    The variable is set for the import and unset again immediately, because
    `Settings.from_env()` is a per-test read: in demo mode it mints a fresh
    scratch store per call, and a session-wide value would make every demo app
    in the suite share one store and see the seeded deliveries pile up.
    """
    return str(Path(tempfile.mkdtemp(prefix="pane-suite-")) / "attention.db")


os.environ["PANE_ATTENTION_DB"] = _scratch_store_for_the_import()

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from pane.app import create_app  # noqa: E402
from pane.config import Settings  # noqa: E402

#: Unset again the moment the import is done.  See `_scratch_store_for_the_import`.
del os.environ["PANE_ATTENTION_DB"]


@pytest.fixture(autouse=True)
def reads_no_host_state(request):
    """Fail any test that touches a path outside the run (009 FR-008/FR-009).

    Autouse and unconditional, so the claim "the suite reads no host state" is
    made by every test in it and cannot rot back in one file at a time.  What
    counts as inside the run — the repository, the scratch tree the run built
    for itself, the interpreter's installation, the machine's read-only system
    directories — is `tests/hermetic.py`'s to define, and
    `tests/test_reads_no_host_state.py` is what proves this catches a read that
    is outside.
    """
    with hermetic.watching() as observed:
        yield
    if observed:
        pytest.fail(hermetic.report(observed, request.node.nodeid), pytrace=False)


def bearer(token: str) -> dict[str, str]:
    """The header curl and the tests send, built from a value, never typed."""
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def credentials() -> dict[str, str]:
    """The three minted values, re-asserted into the environment for the run."""
    for name, value in MINTED.items():
        os.environ[name] = value
    return dict(MINTED)


@pytest.fixture
def token(credentials) -> str:
    return credentials["PANE_TOKEN"]


@pytest.fixture
def intake_credential(credentials) -> str:
    return credentials["PANE_INTAKE_CREDENTIAL"]


@pytest.fixture
def answer_identity(credentials) -> str:
    return credentials["PANE_ANSWER_IDENTITY"]


@pytest.fixture
def auth_headers(token) -> dict[str, str]:
    """What a test that builds its own `TestClient` threads into it."""
    return bearer(token)


@pytest.fixture
def app(credentials, monkeypatch, tmp_path):
    """The app the closed gate builds, from the minted values in the environment.

    Its delivery store goes to the test's own scratch tree, for the reason
    `_scratch_store_for_the_import` gives: left unset the setting resolves to
    `.pane/attention.db` beside the working directory, and a store in the
    repository is one the worktree does not carry into the gate (009 US3).
    """
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    return create_app(Settings.from_env())


@pytest.fixture
def authed_client(app, auth_headers) -> TestClient:
    """A `TestClient` whose every request already carries the token."""
    return TestClient(app, headers=auth_headers)
