"""Every spec has a door: the corpus opens on one page (018 US1).

One claim per acceptance scenario, all made over corpora this file builds under
its own `tmp_path` — no assertion here can be moved by an operator adding,
renaming or attesting a spec of this repository's own corpus (008 US1).

* **US1-S1** — the index lists every directory `read_roadmap` returns, in the
  order it returned them, each carrying the state it declared (FR-001, FR-003).
  Asserted twice: against the seam's real answer over a constructed corpus, and
  against a *stubbed* seam whose order and states deliberately contradict what
  is on disk — the second is what proves this repository takes the seam's answer
  rather than parsing frontmatter of its own.
* **US1-S4** — a corpus that cannot be read degrades honestly, naming the seam
  and what could not be learned, and an empty corpus is an empty corpus.  Never
  one as the other (FR-005).
* **US1-S5** — the index carries the working-tree revision it read and the
  instant it read it, on 014's terms, including its ruling that a directory
  which is not a repository yields `unknown` rather than a note (FR-006).
* **US1-S6** — `/api/draft` answers 401 without the bearer token (FR-007).
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from corpus import git
from fastapi.testclient import TestClient

from pane.app import create_app
from pane.config import Settings
from pane.draft_index import ROADMAP_READ, SPECS_ROOT_READ, read_corpus

#: Directory names no repository uses, so nothing below can be satisfied by a
#: spec that happens to exist.  Deliberately not in the order they are written.
DECLARED = (
    ("941-a-ready-spec", "ready"),
    ("940-a-landed-spec", "landed"),
    ("943-a-deferred-spec", "deferred"),
    ("942-a-draft-spec", "draft"),
)

#: The instant shape every recorded factory document carries.
INSTANT = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")

#: A full git object name, as `git rev-parse HEAD` writes it.
OBJECT_NAME = re.compile(r"^[0-9a-f]{40}$")


def build_spec(root: Path, spec_dir: str, *, state: str | None = None) -> Path:
    """A spec directory whose `spec.md` declares `state`, or declares nothing.

    `state=None` writes a body with no frontmatter at all, which is the shape
    `read_roadmap` reads as `draft` — a default this repository must take from
    the seam rather than apply itself (FR-003).
    """
    path = root / spec_dir
    path.mkdir(parents=True, exist_ok=True)
    frontmatter = "" if state is None else f"---\nstate: {state}\n---\n\n"
    (path / "spec.md").write_text(f"{frontmatter}# {spec_dir}\n", encoding="utf-8")
    return path


def build_corpus(root: Path) -> None:
    """The four declared states, written in an order that is not the answer's."""
    for spec_dir, state in DECLARED:
        build_spec(root, spec_dir, state=state)


@pytest.fixture
def specs_root(tmp_path) -> Path:
    root = tmp_path / "specs"
    root.mkdir()
    return root


@pytest.fixture
def index_client(credentials, monkeypatch, tmp_path, specs_root, auth_headers) -> TestClient:
    """The real application, its specs root pointed at the test's own corpus."""
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    monkeypatch.setenv("PANE_SPECS_ROOT", str(specs_root))
    return TestClient(create_app(Settings.from_env()), headers=auth_headers)


# --- US1-S1: the seam's order, the seam's states ---------------------------


def test_the_index_is_exactly_what_read_roadmap_returned(specs_root):
    """FR-001/FR-003: one row per entry, in the seam's order, with its state."""
    from factory.roadmap.models import read_roadmap

    build_corpus(specs_root)
    document = read_corpus(specs_root)

    expected = [
        {"spec_dir": entry.spec_dir, "state": str(entry.state)}
        for entry in read_roadmap(specs_root).entries
    ]
    # Non-vacuous, and specifically so: a sweep over nothing would pass.
    assert len(expected) == len(DECLARED)
    assert document["specs"] == expected
    assert document["degraded"] == []


def test_every_declared_state_reaches_the_index_as_the_word_declared(specs_root):
    """All four of the grammar's words, in the document, spelled as declared."""
    build_corpus(specs_root)
    states = {entry["spec_dir"]: entry["state"] for entry in read_corpus(specs_root)["specs"]}
    assert states == dict(DECLARED)


def test_a_spec_with_no_frontmatter_takes_the_seams_default(specs_root):
    """FR-003: this repository does not decide what an undeclared spec declares."""
    build_spec(specs_root, "944-declares-nothing", state=None)
    assert read_corpus(specs_root)["specs"] == [
        {"spec_dir": "944-declares-nothing", "state": "draft"}
    ]


def test_the_index_relays_the_seam_and_parses_no_frontmatter(specs_root, monkeypatch):
    """The order and the states are the seam's, even when the disk disagrees.

    The corpus on disk declares four states in sorted directory order; the seam
    is stubbed to answer two entries, in an order sorting would not produce,
    with states the files do not carry.  A repository that read frontmatter of
    its own — or sorted the corpus itself — answers what is on disk here, and
    only a repository that relays the seam answers what the stub returned.
    """
    import factory.roadmap.models as models

    build_corpus(specs_root)
    stubbed = [
        models.SpecEntry(spec_dir="zzz-last-by-name", state=models.SpecState.LANDED, depends_on_landed=[]),
        models.SpecEntry(spec_dir="aaa-first-by-name", state=models.SpecState.DEFERRED, depends_on_landed=[]),
    ]
    monkeypatch.setattr(
        models,
        "read_roadmap",
        lambda root: models.Roadmap(specs_root=str(root), entries=stubbed),
    )

    assert read_corpus(specs_root)["specs"] == [
        {"spec_dir": "zzz-last-by-name", "state": "landed"},
        {"spec_dir": "aaa-first-by-name", "state": "deferred"},
    ]


def test_the_route_answers_the_index_document(specs_root, index_client):
    """US1-S1 through the route the room actually calls."""
    build_corpus(specs_root)

    response = index_client.get("/api/draft")
    assert response.status_code == 200
    document = response.json()

    assert [entry["spec_dir"] for entry in document["specs"]] == sorted(
        spec_dir for spec_dir, _ in DECLARED
    )
    assert document["specs_root"] == str(specs_root)
    assert document["degraded"] == []


def test_the_index_route_does_not_shadow_the_trio(specs_root, index_client):
    """The bare path is the index; the path with a name is still 014's trio."""
    build_corpus(specs_root)

    trio = index_client.get(f"/api/draft/{DECLARED[0][0]}")
    assert trio.status_code == 200
    assert [entry["name"] for entry in trio.json()["documents"]][0] == "spec.md"
    assert "specs" not in trio.json()


# --- US1-S4: a failed read and an empty corpus are two different facts ------


def test_an_empty_corpus_is_an_empty_corpus(specs_root):
    """No specs and no note: a root with nothing in it is a true answer."""
    document = read_corpus(specs_root)
    assert document["specs"] == []
    assert document["degraded"] == []


def test_a_corpus_root_that_is_not_there_degrades_and_is_not_empty(tmp_path):
    """FR-005: absence is a failed read, never an empty index."""
    missing = tmp_path / "no-such-specs-root"
    document = read_corpus(missing)

    assert document["specs"] == []
    assert len(document["degraded"]) == 1
    note = document["degraded"][0]
    assert note["read"] == SPECS_ROOT_READ
    assert note["mode"] == "transport"
    assert str(missing) in note["detail"]
    assert note["path"] == str(missing)


def test_a_corpus_root_that_is_a_file_degrades_the_same_way(tmp_path):
    """A file where the corpus should be is a read that could not be made."""
    not_a_root = tmp_path / "specs"
    not_a_root.write_text("this is not a corpus\n", encoding="utf-8")

    document = read_corpus(not_a_root)
    assert document["specs"] == []
    assert [note["read"] for note in document["degraded"]] == [SPECS_ROOT_READ]
    assert document["degraded"][0]["mode"] == "transport"


def test_a_root_the_seam_cannot_walk_degrades_as_transport(specs_root, monkeypatch):
    """The root is there and would not be walked — a permission, a broken link.

    Stubbed rather than staged: a directory this process cannot read is a
    condition a test running as root cannot construct, and the fact under
    assertion is what the room does with the seam's `OSError`, not what a
    filesystem does with a mode bit.
    """
    import factory.roadmap.models as models

    build_corpus(specs_root)

    def refuse(root):
        raise PermissionError(13, "Permission denied", str(root))

    monkeypatch.setattr(models, "read_roadmap", refuse)

    document = read_corpus(specs_root)
    assert document["specs"] == []
    assert [note["read"] for note in document["degraded"]] == [SPECS_ROOT_READ]
    assert document["degraded"][0]["mode"] == "transport"
    assert "Permission denied" in document["degraded"][0]["detail"]


def test_a_corpus_that_will_not_parse_names_the_seam(specs_root):
    """FR-005: the seam is named, its refusal is carried, and nothing is listed.

    `read_roadmap` emits no partial roadmap for a corpus with any fault, and the
    index does not soften that into "the specs that did parse": a list missing
    one spec is a claim about a corpus nobody has.
    """
    build_corpus(specs_root)
    build_spec(specs_root, "945-will-not-parse", state="halfway")

    document = read_corpus(specs_root)
    assert document["specs"] == []
    assert len(document["degraded"]) == 1
    note = document["degraded"][0]
    assert note["read"] == ROADMAP_READ
    assert note["mode"] == "unparseable"
    assert "945-will-not-parse" in note["detail"]


def test_a_corpus_that_could_not_be_read_is_never_rendered_as_empty(tmp_path):
    """The two answers, side by side: same empty list, different second fact."""
    empty = tmp_path / "empty-specs"
    empty.mkdir()
    absent = tmp_path / "absent-specs"

    assert read_corpus(empty)["specs"] == read_corpus(absent)["specs"] == []
    assert read_corpus(empty)["degraded"] == []
    assert read_corpus(absent)["degraded"] != []


# --- US1-S5: the read stamp is 014's ---------------------------------------


def test_the_index_names_the_revision_it_read_and_when(tmp_path):
    """FR-006: over a real repository, the revision is the one git answers."""
    repo = tmp_path / "repo"
    (repo / "specs").mkdir(parents=True)
    git(repo, "init", "-q", "-b", "dev")
    build_corpus(repo / "specs")
    git(repo, "add", "-A")
    git(repo, "commit", "-qm", "a corpus")

    document = read_corpus(repo / "specs")
    head = git(repo, "rev-parse", "HEAD").strip()

    assert document["revision"] == head
    assert OBJECT_NAME.match(document["revision"])
    assert document["revision_short"] == head[:7]
    assert document["dirty"] is False
    assert INSTANT.match(document["read_at"])


def test_an_uncommitted_spec_makes_the_tree_dirty(tmp_path):
    """The second half of the stamp: is the tree still the commit it named."""
    repo = tmp_path / "repo"
    (repo / "specs").mkdir(parents=True)
    git(repo, "init", "-q", "-b", "dev")
    build_corpus(repo / "specs")
    git(repo, "add", "-A")
    git(repo, "commit", "-qm", "a corpus")
    build_spec(repo / "specs", "946-written-not-committed", state="draft")

    assert read_corpus(repo / "specs")["dirty"] is True


def test_a_corpus_outside_a_repository_reads_unknown_and_degrades_nothing(specs_root):
    """014's Unknown Rule ruling, inherited rather than re-taken (plan D3)."""
    build_corpus(specs_root)
    document = read_corpus(specs_root)

    assert document["revision"] is None
    assert document["revision_short"] is None
    assert document["dirty"] is None
    assert document["degraded"] == []
    assert len(document["specs"]) == len(DECLARED)


# --- US1-S6: the token guards it, like every other route -------------------


def test_the_index_answers_401_without_the_token(specs_root, credentials, monkeypatch, tmp_path):
    """FR-007: the guarded router covers it by construction."""
    monkeypatch.setenv("PANE_ATTENTION_DB", str(tmp_path / "attention.db"))
    monkeypatch.setenv("PANE_SPECS_ROOT", str(specs_root))
    build_corpus(specs_root)

    unauthenticated = TestClient(create_app(Settings.from_env()))
    response = unauthenticated.get("/api/draft")

    assert response.status_code == 401
    assert "specs" not in response.text
