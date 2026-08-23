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
"""

import os
import secrets


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

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from pane.app import create_app  # noqa: E402
from pane.config import Settings  # noqa: E402


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
def app(credentials):
    """The app the closed gate builds, from the minted values in the environment."""
    return create_app(Settings.from_env())


@pytest.fixture
def authed_client(app, auth_headers) -> TestClient:
    """A `TestClient` whose every request already carries the token."""
    return TestClient(app, headers=auth_headers)
