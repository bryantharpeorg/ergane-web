"""The drafting table reads a spec's trio, and says when it read it (014 US1).

One claim per acceptance scenario, all made over spec directories this file
builds under its own `tmp_path`:

* **US1-S1** — a directory carrying all three documents answers with all three,
  in `spec.md`, `plan.md`, `tasks.md` order, each carrying its own bytes
  (FR-001).
* **US1-S2** — a directory carrying only `spec.md` — the shape eight of this
  corpus's fourteen spec directories have — answers with `spec.md` read and the
  other two marked absent, and `degraded` stays empty (FR-002).  The Edge Case
  rides alongside: a `plan.md` that exists and is empty is *present* and empty,
  which is a third thing and not either of the first two.
* **US1-S3** — every successful read carries the working-tree revision and the
  instant it was read (FR-003).  Twice: over a real git repository built here,
  where the revision is the one `git rev-parse HEAD` answers; and over a scratch
  directory that is no repository at all, where the revision is *unknown* and,
  being unknown rather than failed, degrades nothing.
* **US1-S4** — a directory that is not there degrades honestly, naming the path
  it tried, and returns no documents at all (FR-004).  A name that is not a
  single directory name is refused the same way, and the room never joins it
  onto the specs root.
* **US1-S5** — the route answers 401 with no token, like every other (FR-005).

**Nothing here pins the live corpus** (008 US1, and this spec's plan trap).  The
spec directory names are ones no repository uses and every document's text is
written by the test that asserts it, so an operator adding, renaming or
refining a spec moves no assertion in this file.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from corpus import git
from fastapi.testclient import TestClient

from pane.app import create_app
from pane.config import Settings
from pane.draft import DRAFT_READ, TRIO, read_trio

#: A directory name no repository uses, so nothing below can be satisfied by a
#: spec that happens to exist.
SPEC_DIR = "920-a-constructed-draft"

#: The instant shape every recorded factory document carries, and the one the
#: read stamp must answer in — one document never carries two shapes of instant.
INSTANT = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")

#: A full git object name, as `git rev-parse HEAD` writes it.
OBJECT_NAME = re.compile(r"^[0-9a-f]{40}$")


def build_spec(root: Path, spec_dir: str, **documents: str) -> Path:
    """A spec directory under `root` carrying exactly the documents named.

    A document whose text is not passed is not written, which is how absence is
    constructed here: the common shape in this corpus, not an error condition.
    """
    path = root / spec_dir
    path.mkdir(parents=True, exist_ok=True)
    for name, text in documents.items():
        (path / name.replace("_", ".")).write_text(text, encoding="utf-8")
    return path


def documents_by_name(document: dict) -> dict[str, dict]:
    return {entry["name"]: entry for entry in document["documents"]}


@pytest.fixture
def specs_root(tmp_path) -> Path:
    root = tmp_path / "specs"
    root.mkdir()
    return root


@pytest.fixture
def draft_client(credentials, monkeypatch, tmp_path, specs_root, auth_headers) -> TestClient:
    """The real application, its specs root pointed at the test's own tree."""
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    monkeypatch.setenv("PANE_SPECS_ROOT", str(specs_root))
    return TestClient(create_app(Settings.from_env()), headers=auth_headers)


# --- US1-S1: the trio reads together, in order ----------------------------


def test_the_trio_answers_in_order_with_its_own_bytes(specs_root, draft_client):
    """FR-001: all three, in that order, each carrying what is on disk."""
    build_spec(
        specs_root,
        SPEC_DIR,
        spec_md="# the spec\n\nwhat the room is for.\n",
        plan_md="# the plan\n\nhow it is built.\n",
        tasks_md="# the tasks\n\n- [ ] T001 do the thing\n",
    )

    response = draft_client.get(f"/api/draft/{SPEC_DIR}")
    assert response.status_code == 200
    document = response.json()

    assert [entry["name"] for entry in document["documents"]] == list(TRIO)
    entries = documents_by_name(document)
    assert entries["spec.md"]["text"] == "# the spec\n\nwhat the room is for.\n"
    assert entries["plan.md"]["text"] == "# the plan\n\nhow it is built.\n"
    assert entries["tasks.md"]["text"] == "# the tasks\n\n- [ ] T001 do the thing\n"
    assert all(entry["present"] for entry in document["documents"])
    assert document["degraded"] == []
    assert document["spec_dir"] == SPEC_DIR


def test_the_document_order_is_the_trio_order_whatever_the_disk_order(
    specs_root, draft_client
):
    """The order is the spec's, not the filesystem's.

    `tasks.md` is written first here, so a read that walked the directory in
    creation order would answer in the wrong one and this would catch it.
    """
    path = specs_root / SPEC_DIR
    path.mkdir()
    for name in ("tasks.md", "plan.md", "spec.md"):
        (path / name).write_text(f"# {name}\n", encoding="utf-8")

    document = draft_client.get(f"/api/draft/{SPEC_DIR}").json()
    assert [entry["name"] for entry in document["documents"]] == list(TRIO)


# --- US1-S2: absent is absent, and quiet ----------------------------------


def test_only_a_spec_reads_and_degrades_nothing(specs_root, draft_client):
    """FR-002: the shape most of this corpus has is not a degraded read."""
    build_spec(specs_root, SPEC_DIR, spec_md="# the sketch\n")

    document = draft_client.get(f"/api/draft/{SPEC_DIR}").json()

    entries = documents_by_name(document)
    assert entries["spec.md"]["present"] is True
    assert entries["spec.md"]["text"] == "# the sketch\n"
    for name in ("plan.md", "tasks.md"):
        assert entries[name]["present"] is False
        assert entries[name]["text"] is None
    assert document["degraded"] == []


def test_an_absent_document_is_named_rather_than_dropped(specs_root, draft_client):
    """All three are always answered for; absence is a fact, not a shorter list."""
    build_spec(specs_root, SPEC_DIR, spec_md="# the sketch\n")

    document = draft_client.get(f"/api/draft/{SPEC_DIR}").json()
    assert len(document["documents"]) == 3


def test_present_and_empty_is_neither_absent_nor_degraded(specs_root, draft_client):
    """The Edge Case: a `plan.md` that exists and is empty is a third thing."""
    build_spec(specs_root, SPEC_DIR, spec_md="# the sketch\n", plan_md="")

    document = draft_client.get(f"/api/draft/{SPEC_DIR}").json()
    entries = documents_by_name(document)

    assert entries["plan.md"]["present"] is True
    assert entries["plan.md"]["empty"] is True
    assert entries["plan.md"]["text"] == ""
    assert entries["tasks.md"]["present"] is False
    assert entries["tasks.md"]["empty"] is False
    assert document["degraded"] == []


# --- US1-S3: the read stamp -----------------------------------------------


def test_the_read_names_the_working_tree_revision_it_read(tmp_path, draft_client):
    """FR-003: over a real repository, the revision is the one git answers.

    The roadmap hard-resets the operator's checkout on a 300-second timer (N50),
    so a render that does not say which revision it read is a claim that has
    quietly expired.  The repository is built here rather than borrowed, so
    this asserts the read and never this morning's checkout.
    """
    repo = tmp_path / "repo"
    repo.mkdir()
    git(repo, "init", "--quiet")
    root = repo / "specs"
    build_spec(root, SPEC_DIR, spec_md="# the spec\n")
    git(repo, "add", "--all")
    git(repo, "commit", "--quiet", "-m", "the constructed corpus")

    document = read_trio(root, SPEC_DIR)

    assert document["revision"] == git(repo, "rev-parse", "HEAD").strip()
    assert OBJECT_NAME.match(document["revision"])
    assert document["revision_short"] == document["revision"][:7]
    assert document["dirty"] is False
    assert INSTANT.match(document["read_at"])
    assert document["degraded"] == []


def test_a_working_tree_with_uncommitted_work_says_so(tmp_path):
    """The revision alone is not the tree; an edited tree is not that commit."""
    repo = tmp_path / "repo"
    repo.mkdir()
    git(repo, "init", "--quiet")
    root = repo / "specs"
    build_spec(root, SPEC_DIR, spec_md="# the spec\n")
    git(repo, "add", "--all")
    git(repo, "commit", "--quiet", "-m", "the constructed corpus")
    (root / SPEC_DIR / "spec.md").write_text("# the spec, edited\n", encoding="utf-8")

    document = read_trio(root, SPEC_DIR)
    assert document["dirty"] is True


def test_an_unversioned_tree_reads_the_revision_as_unknown(specs_root, draft_client):
    """A revision that cannot be read is unknown, never a zero and never a lie.

    And unknown is not degraded: the trio read succeeded, and constitution III's
    Unknown Rule is what covers the fact the tree could not supply.
    """
    build_spec(specs_root, SPEC_DIR, spec_md="# the sketch\n")

    document = draft_client.get(f"/api/draft/{SPEC_DIR}").json()

    assert document["revision"] is None
    assert document["revision_short"] is None
    assert document["dirty"] is None
    assert INSTANT.match(document["read_at"])
    assert document["degraded"] == []


def test_every_answer_carries_a_read_instant(specs_root, draft_client):
    """Including the ones that degraded — a stale refusal is stale too."""
    build_spec(specs_root, SPEC_DIR, spec_md="# the sketch\n")

    for path in (f"/api/draft/{SPEC_DIR}", "/api/draft/930-not-there"):
        document = draft_client.get(path).json()
        assert INSTANT.match(document["read_at"])


# --- US1-S4: the honest degrade -------------------------------------------


def test_a_missing_directory_degrades_honestly_and_renders_no_trio(
    specs_root, draft_client
):
    """FR-004: the path it tried is in the note, and there is no empty trio."""
    missing = "930-no-such-draft"

    response = draft_client.get(f"/api/draft/{missing}")
    assert response.status_code == 200
    document = response.json()

    assert document["documents"] == []
    assert len(document["degraded"]) == 1
    note = document["degraded"][0]
    assert note["read"] == DRAFT_READ
    assert note["mode"] == "transport"
    assert str(specs_root / missing) in note["detail"]
    assert note["path"] == str(specs_root / missing)
    assert document["path"] == str(specs_root / missing)


def test_a_file_where_a_spec_directory_should_be_degrades(specs_root, draft_client):
    """Present but not a directory is its own failure, not a silent empty trio."""
    (specs_root / "931-a-file").write_text("not a directory\n", encoding="utf-8")

    document = draft_client.get("/api/draft/931-a-file").json()

    assert document["documents"] == []
    assert len(document["degraded"]) == 1
    assert str(specs_root / "931-a-file") in document["degraded"][0]["detail"]


@pytest.mark.parametrize(
    "name",
    [
        "..",
        ".",
        "../etc",
        "nested/spec",
        "/etc/passwd",
        "\\windows\\path",
        "",
        "   ",
    ],
)
def test_a_name_that_is_not_a_directory_name_is_refused(specs_root, name):
    """Plan D5: a route that accepts a path reads the operator's filesystem.

    Asserted at the function rather than over HTTP, because several of these
    never reach a handler at all — which is itself a refusal, and the two other
    tests below are what prove the HTTP door agrees with this one.
    """
    document = read_trio(specs_root, name)

    assert document["documents"] == []
    assert len(document["degraded"]) == 1
    note = document["degraded"][0]
    assert note["read"] == DRAFT_READ
    assert note["mode"] == "refusal"
    # Nothing was joined onto the root, so there is no path to have tried.
    assert note["path"] is None
    assert document["path"] is None


def test_a_traversing_name_reads_nothing_outside_the_specs_root(
    tmp_path, specs_root
):
    """The refusal is load-bearing: the file it reaches for exists."""
    outside = tmp_path / "outside"
    build_spec(outside, SPEC_DIR, spec_md="# not the operator's to serve\n")

    document = read_trio(specs_root, f"../outside/{SPEC_DIR}")

    assert document["documents"] == []
    assert document["degraded"][0]["mode"] == "refusal"


@pytest.mark.parametrize(
    "spelling",
    [
        "..%2F..%2Foutside%2F{name}",
        "%2E%2E%2Foutside%2F{name}",
        "..%252F..%252Foutside%252F{name}",
        ".%2E%2Foutside%2F{name}",
    ],
)
def test_no_spelling_of_a_traversing_name_serves_a_document(
    tmp_path, specs_root, draft_client, spelling
):
    """Over HTTP, with the token: never the bytes of a file outside the root.

    Four encodings of the same reach, because the property that matters is not
    "the handler refuses" — Starlette decodes before it matches, so most of
    these never reach the handler at all — but that *nothing* answers with a
    document, whichever door they arrive at.  The file they reach for exists
    and its text is unique, so a leak by any route would show here.
    """
    secret = "the-operators-own-file-not-the-rooms-to-serve"
    outside = tmp_path / "outside"
    build_spec(outside, SPEC_DIR, spec_md=f"# {secret}\n")

    response = draft_client.get(f"/api/draft/{spelling.format(name=SPEC_DIR)}")

    assert secret.encode() not in response.content
    if response.status_code == 200 and response.headers.get(
        "content-type", ""
    ).startswith("application/json"):
        document = response.json()
        assert document["documents"] == []
        assert document["degraded"][0]["mode"] in ("refusal", "transport")


# --- US1-S5: the token, like every other route ----------------------------


def test_the_route_answers_401_without_the_token(specs_root, monkeypatch, tmp_path):
    """FR-005: the drafting table is behind the one gate, like every room."""
    build_spec(specs_root, SPEC_DIR, spec_md="# the sketch\n")
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    monkeypatch.setenv("PANE_SPECS_ROOT", str(specs_root))
    client = TestClient(create_app(Settings.from_env()))

    for path in (f"/api/draft/{SPEC_DIR}", f"/draft/{SPEC_DIR}"):
        response = client.get(path)
        assert response.status_code == 401
        assert b"the sketch" not in response.content


def test_a_wrong_token_reads_no_document(specs_root, monkeypatch, tmp_path, token):
    """A wrong credential is refused exactly as a missing one is."""
    import secrets

    wrong = secrets.token_hex(16)
    assert wrong != token
    build_spec(specs_root, SPEC_DIR, spec_md="# the sketch\n")
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    monkeypatch.setenv("PANE_SPECS_ROOT", str(specs_root))
    client = TestClient(create_app(Settings.from_env()))

    response = client.get(
        f"/api/draft/{SPEC_DIR}", headers={"Authorization": f"Bearer {wrong}"}
    )
    assert response.status_code == 401


# --- the route is mounted behind the one dependency, structurally ----------


def test_the_draft_route_is_behind_require_viewer(draft_client):
    """Not a second auth path: the same dependency every other route carries."""
    from support import routes_with_enclosing_dependencies

    from pane.auth import require_viewer

    found = [
        dependencies
        for route, dependencies in routes_with_enclosing_dependencies(draft_client.app)
        if route.path == "/api/draft/{spec_dir}"
    ]
    assert found, "the draft route is not registered"
    for dependencies in found:
        assert require_viewer in dependencies


def test_the_draft_route_is_registered_before_the_spa_catchall(draft_client):
    """A route mounted after `/{path:path}` is a route nothing ever reaches."""
    from support import registered_api_routes

    paths = [route.path for route in registered_api_routes(draft_client.app)]
    assert "/api/draft/{spec_dir}" in paths
    assert paths.index("/api/draft/{spec_dir}") < paths.index("/{path:path}")
