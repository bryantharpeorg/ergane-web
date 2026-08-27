"""The Desk finds the graph the operator archived (012 US1).

`specs/<dir>/workgraph.json` is a path nothing in this repository writes — the
roadmap compiles its graph in-process and never writes it back — so the Desk's
workgraph read failed for every epic it has ever shown, and said so in a
red-bordered notice about a file that was never going to exist.  The graph was
on disk the whole time, under the archive `CLAUDE.md` names and
`pane/showfloor.py` has read since 002: seam first, archive second.

One claim per acceptance scenario, all made over a corpus this file builds
under its own `tmp_path`:

* **US1-S1** — with nothing at the seam and a graph in the archive, the epic
  carries the archived graph and `degraded` is empty, so the notice the
  operator was reading has nothing to render from (FR-001, FR-002).
* **US1-S2** — with neither source answering, exactly one entry, and it names
  the *seam's* failure, because the seam is where the graph belongs (FR-003).
* **US1-S3** — a seam read that succeeds is the whole read: the archive holds a
  different graph and none of it reaches the document (FR-004).
* **US1-S4** — an archive that exists and will not parse reads `unparseable`,
  which is a different fact from a file that is absent (FR-005).  Twice, for
  the two stops between bytes on disk and a graph: the decode to text and the
  parse to JSON.  Only the second raises `JSONDecodeError`, and neither raises
  the `OSError` an absent file raises, which is what keeps them apart.

**Nothing here pins the live corpus** (008 US1, and this spec's plan trap).  The
spec directory is a name no repository uses, the graphs are cut from the
recorded `ergane spec derive` output through `tests/corpus.py`, and the archive
is located by the production derivation — `archive_root_for` — rather than by a
path typed into a test, so an operator archiving a graph moves no assertion
here and the two rooms cannot drift apart on where the archive lives.

The reader is `LiveReader` itself with its unrelated reads stubbed: the
workgraph seam under test is the real one, so what is proved is the wiring and
not a stand-in for it.

**017 US2 adds the fact 012 could not say, and weakens none of the above.**  The
seam still wins (FR-007, and `test_a_successful_seam_read_does_not_consult_the
_archive` is untouched), an archive that answered still says nothing in
`degraded` (FR-005), and an archive that will not parse still reads
`unparseable`.  What is new is that the epic names the door: `workgraph_source`
is `"seam"`, `"archive"`, or `None` for a graph that was never read, taken from
which branch of the fallback ran and from no second look at the disk.  And the
seam's path is ignored by git (FR-006), because nothing in the factory writes
it and the operator's derive output was accumulating there untracked — asserted
over a scratch checkout carrying this repository's committed rules, never over
the operator's own working tree.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from corpus import SpecFixture, build_corpus, derived_graph, git
from pane.floor_document import archive_root_for, assemble_floor_document
from pane.readers import EpicRef, FloorRead, LiveReader

#: A directory name no repository uses, so nothing below can be satisfied by a
#: spec that happens to exist.
SPEC_DIR = "910-a-constructed-epic"

#: What the seam's graph declares, and what the archive's declares.  They are
#: disjoint on purpose: which of the two answered is then readable off the
#: document's node ids alone, with no spy on the read.
SEAM_STORIES = ["US1", "US2"]
ARCHIVE_STORIES = ["US7", "US8"]


class DeskReader(LiveReader):
    """`LiveReader.workgraph` over a constructed corpus; every other read stubbed.

    The seam under test is the live one — the same `specs_root / <dir> /
    workgraph.json` read, raising the same `TransportFailed` — so the fallback
    is exercised against the failure the operator actually saw.  The reads the
    Desk makes around it are stubbed to succeed, so every `degraded` entry a
    test finds is one the workgraph read produced.
    """

    reference_instant: str | None = None

    def __init__(self, specs_root: Path, spec_dir: str) -> None:
        super().__init__(specs_root)
        self.spec_dir = spec_dir

    async def read_floor(self) -> FloorRead:
        ref = EpicRef(
            epic_id=self.spec_dir,
            workflow_id=f"epic-{self.spec_dir}",
            scene=None,
            workgraph_ref=self.spec_dir,
        )
        return FloorRead(status={"epics": [{"epic_id": self.spec_dir}]}, running=[ref])

    async def epic_status(self, workflow_id: str, scene: str | None = None) -> dict:
        return {"epic_state": "RUNNING", "nodes": {}}

    async def open_escalations(self) -> list[dict]:
        return []

    def stored_items(self) -> list:
        return []

    def list_findings(self) -> list[dict]:
        return []

    def rollup(self) -> dict:
        return {"total_usd": None}

    async def aclose(self) -> None:
        return None


# --- the corpus, and the two places a graph can be --------------------------


def corpus_for(tmp_path: Path):
    """A one-spec corpus in a scratch tree, with nothing archived beside it."""
    return build_corpus(tmp_path, SpecFixture(SPEC_DIR, state="ready", archived=False))


def seam_path(specs_root: Path) -> Path:
    """Where the factory would write the graph if the roadmap wrote one."""
    return specs_root / SPEC_DIR / "workgraph.json"


def archived_path(specs_root: Path) -> Path:
    """Where the operator archives it, resolved the way the pane resolves it."""
    return archive_root_for(specs_root) / f"{SPEC_DIR}.json"


def write_graph(path: Path, story_keys: list[str]) -> dict:
    """Put a compiled graph of the recorded shape at `path`."""
    graph = derived_graph(SPEC_DIR, story_keys)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(graph, indent=2), encoding="utf-8")
    return graph


def epic_of(document: dict) -> dict:
    return next(epic for epic in document["epics"] if epic["epic_id"] == SPEC_DIR)


def workgraph_entries(document: dict) -> list[dict]:
    return [entry for entry in document["degraded"] if entry["read"] == "workgraph"]


def assemble(specs_root: Path) -> dict:
    return asyncio.run(assemble_floor_document(DeskReader(specs_root, SPEC_DIR)))


# --- US1-S1: the archive answers when the seam is silent --------------------


def test_the_archive_answers_and_says_nothing_about_it(tmp_path):
    """FR-001, FR-002: the graph is carried and `degraded` is empty."""
    corpus = corpus_for(tmp_path)
    write_graph(archived_path(corpus.specs_root), ARCHIVE_STORIES)
    assert not seam_path(corpus.specs_root).exists()

    document = assemble(corpus.specs_root)
    epic = epic_of(document)

    # The archived graph reached the room: every story it declares is a
    # declared card, carrying the dependency the graph declares.
    assert [card["story_key"] for card in epic["nodes"]] == ARCHIVE_STORIES
    assert all(card["declared"] for card in epic["nodes"])
    assert [card["depends_on_merged"] for card in epic["nodes"]] == [[], ["us7"]]

    # And it said nothing about it: a read satisfied by the archive is not a
    # degradation, so the well the operator was reading has nothing to render.
    assert document["degraded"] == []


# --- US1-S2: neither source, and the seam's failure is the one named --------


def test_neither_source_reports_the_seam_not_the_archive(tmp_path):
    """FR-003, SC-003: exactly one entry, and it is the seam's."""
    corpus = corpus_for(tmp_path)
    assert not seam_path(corpus.specs_root).exists()
    assert not archived_path(corpus.specs_root).exists()

    document = assemble(corpus.specs_root)
    entries = workgraph_entries(document)

    assert len(entries) == 1
    entry = entries[0]
    assert entry["section"] == "epics"
    assert entry["mode"] == "transport"
    assert entry["epic_id"] == SPEC_DIR
    # The seam's own path, and not a word about the archive's: the failure
    # worth naming is the one at the place the graph belongs.
    assert str(seam_path(corpus.specs_root)) in entry["detail"]
    assert str(archived_path(corpus.specs_root)) not in entry["detail"]

    # It is the only entry the document carries — one honest note, not two.
    assert document["degraded"] == entries


# --- US1-S3: a seam read that succeeds is the whole read --------------------


def test_a_successful_seam_read_does_not_consult_the_archive(tmp_path):
    """FR-004: seam first, and the archive's stories are nowhere in the room."""
    corpus = corpus_for(tmp_path)
    write_graph(seam_path(corpus.specs_root), SEAM_STORIES)
    write_graph(archived_path(corpus.specs_root), ARCHIVE_STORIES)

    document = assemble(corpus.specs_root)
    epic = epic_of(document)

    story_keys = [card["story_key"] for card in epic["nodes"]]
    assert story_keys == SEAM_STORIES
    assert not set(story_keys) & set(ARCHIVE_STORIES)
    assert document["degraded"] == []


# --- US1-S4: an archive that will not parse is its own failure --------------


def test_an_unparseable_archive_reads_unparseable(tmp_path):
    """FR-005: a file that exists and will not parse is not a file that is absent."""
    corpus = corpus_for(tmp_path)
    archived = archived_path(corpus.specs_root)
    archived.parent.mkdir(parents=True, exist_ok=True)
    archived.write_text("{ this is not a compiled graph", encoding="utf-8")
    # The seam is silent, so the archive is the read that fails: there is no
    # other source that could be the one being classified below.
    assert not seam_path(corpus.specs_root).exists()

    document = assemble(corpus.specs_root)
    entries = workgraph_entries(document)

    assert len(entries) == 1
    entry = entries[0]
    assert entry["mode"] == "unparseable"
    assert entry["section"] == "epics"
    assert entry["epic_id"] == SPEC_DIR
    # The two failures are told apart, which is the whole of FR-005: the mode
    # an *absent* archive produces is `transport` (the test above), and this
    # one -- same absent seam, but a graph that is on disk -- must not be it.
    assert entry["mode"] != "transport"

    # And it does not crash the assembly on the way: every other section of the
    # document is still there, with the epic present and carrying no graph.
    assert epic_of(document)["nodes"] == []
    assert document["health"]["data"] == []


def test_an_archive_that_is_not_utf8_also_reads_unparseable(tmp_path):
    """FR-005 again, by the other way a found file refuses to parse.

    `json.loads` is not the only stop between bytes on disk and a graph: the
    decode to text comes first, and a `UnicodeDecodeError` is a `ValueError`
    and not an `OSError`, so it does not travel the absent-file path.  It is
    the same fact -- the archive was found and will not parse -- and it is owed
    the same word.
    """
    corpus = corpus_for(tmp_path)
    archived = archived_path(corpus.specs_root)
    archived.parent.mkdir(parents=True, exist_ok=True)
    archived.write_bytes(b"\xff\xfe\x00 not text at all")
    assert not seam_path(corpus.specs_root).exists()

    document = assemble(corpus.specs_root)
    entries = workgraph_entries(document)

    assert len(entries) == 1
    assert entries[0]["mode"] == "unparseable"
    assert entries[0]["epic_id"] == SPEC_DIR


# --- the derivation itself --------------------------------------------------


def test_the_archive_root_is_derived_beside_the_corpus(tmp_path):
    """The archive lives where `ShowfloorReaders.from_reader` puts it (plan D2).

    Spelt as a comparison against the Showfloor's own binding rather than as a
    path typed here, so the two rooms cannot drift on where the archive is: if
    one derivation moves and the other does not, this fails.
    """
    from pane.showfloor import ShowfloorReaders

    corpus = corpus_for(tmp_path)
    reader = DeskReader(corpus.specs_root, SPEC_DIR)
    bound = ShowfloorReaders.from_reader(reader, corpus.specs_root)

    assert archive_root_for(corpus.specs_root) == bound_archive_root(bound)


def bound_archive_root(bound) -> Path:
    """The archive root a `ShowfloorReaders` binding resolved, off its binding."""
    return bound.workgraph.__self__._archive_root


# --- 017 US2: the graph says which door it came through ---------------------
#
# 012 kept the seam first and was right to (FR-007, and the test above that
# holds it).  What 012 could not say is *which* of the two answered — and the
# seam is a path nothing in the factory writes, so the file that appears there
# is an operator's hand-derive and can be a day stale while the read succeeds
# and reports nothing.  A successful read and a current read were the same
# document.  These four make them different: the epic carries `workgraph_source`,
# it is one of two words, and it is `None` for a graph that was never read.
#
# Every one of them reads the provenance off a *constructed* condition — which
# file is on disk in this test's own scratch tree — so nothing here asks the
# filesystem or git a second question, which is the read this spec forbids.


def test_a_seam_satisfied_read_names_the_seam_as_its_source(tmp_path):
    """FR-004, FR-007: the provenance says `seam`, and the archive stays shut.

    The archive here is *poisoned* rather than merely different, and that is
    what makes this a claim about the read and not only about the room.  Bytes
    that will not decode raise the moment the file is opened, and the raise
    would land in `degraded` as `unparseable` — which is a different fact from
    the one the disjoint-stories check makes above, where a well-formed archive
    proves only that its content did not arrive.  Here an empty `degraded`
    means the archive was never opened at all.
    """
    corpus = corpus_for(tmp_path)
    write_graph(seam_path(corpus.specs_root), SEAM_STORIES)
    archived = archived_path(corpus.specs_root)
    archived.parent.mkdir(parents=True, exist_ok=True)
    archived.write_bytes(b"\xff\xfe\x00 not text at all")

    document = assemble(corpus.specs_root)
    epic = epic_of(document)

    assert epic["workgraph_source"] == "seam"
    # The graph that reached the room is the seam's, and the archive's refusal
    # to parse is nowhere in the document, because it was never asked.
    assert [card["story_key"] for card in epic["nodes"]] == SEAM_STORIES
    assert document["degraded"] == []


def test_an_archive_satisfied_read_names_the_archive_and_degrades_nothing(tmp_path):
    """FR-005: the provenance says `archive`, and it produces no entry.

    Both halves matter and they pull in opposite directions.  012 FR-002
    decided a fallback that worked says nothing in `degraded`, and this spec
    does not reopen that — so the honest place for "it came from the other
    door" is a fact on the epic, beside the graph it explains, and `degraded`
    stays what it is: the list of reads that *failed*.
    """
    corpus = corpus_for(tmp_path)
    write_graph(archived_path(corpus.specs_root), ARCHIVE_STORIES)
    assert not seam_path(corpus.specs_root).exists()

    document = assemble(corpus.specs_root)
    epic = epic_of(document)

    assert epic["workgraph_source"] == "archive"
    # The archived graph is the one in the room, so the word names the door the
    # graph actually came through and not a door that merely exists.
    assert [card["story_key"] for card in epic["nodes"]] == ARCHIVE_STORIES
    assert document["degraded"] == []


def test_the_two_sources_are_the_only_two_words(tmp_path):
    """One vocabulary, and the seam-first ordering still decides between them.

    The pair asserted together rather than apart: a provenance that answered
    the same word to both conditions would pass each test above on its own
    while telling the operator nothing.
    """
    seam_corpus = corpus_for(tmp_path / "seam")
    write_graph(seam_path(seam_corpus.specs_root), SEAM_STORIES)
    archive_corpus = corpus_for(tmp_path / "archive")
    write_graph(archived_path(archive_corpus.specs_root), ARCHIVE_STORIES)

    from_seam = epic_of(assemble(seam_corpus.specs_root))["workgraph_source"]
    from_archive = epic_of(assemble(archive_corpus.specs_root))["workgraph_source"]

    assert {from_seam, from_archive} == {"seam", "archive"}
    assert from_seam != from_archive


def test_a_graph_that_was_never_read_carries_no_source(tmp_path):
    """Spec Edge Cases: no source is invented for a read that failed.

    Both failing paths, and each keeps the meaning 012 gave it — the absent
    pair still reads `transport` and names the seam, the found-and-broken
    archive still reads `unparseable`.  Provenance is a fact about a read that
    returned; there is no third word for one that did not, and the alternative
    — naming the door the read was *reaching for* — would tell the operator a
    graph came from somewhere it did not come from.
    """
    absent = corpus_for(tmp_path / "absent")
    assert not seam_path(absent.specs_root).exists()
    assert not archived_path(absent.specs_root).exists()

    broken = corpus_for(tmp_path / "broken")
    unreadable = archived_path(broken.specs_root)
    unreadable.parent.mkdir(parents=True, exist_ok=True)
    unreadable.write_text("{ this is not a compiled graph", encoding="utf-8")
    assert not seam_path(broken.specs_root).exists()

    conditions = ((absent.specs_root, "transport"), (broken.specs_root, "unparseable"))
    for specs_root, expected_mode in conditions:
        document = assemble(specs_root)
        epic = epic_of(document)

        assert epic["workgraph_source"] is None, expected_mode
        assert epic["nodes"] == []
        # 012's own meanings, unmoved by this spec.
        assert [entry["mode"] for entry in workgraph_entries(document)] == [expected_mode]


# --- 017 US2-S3: the seam's path cannot accumulate untracked ----------------


#: This repository's committed ignore rules, read rather than transcribed: the
#: claim below is about the file the repository actually carries, so a copy of
#: the rule typed into a test would pass while the rule itself was deleted.
IGNORE_RULES = Path(__file__).resolve().parents[1] / ".gitignore"


def status(repo: Path, *flags: str) -> str:
    """`git status --porcelain` in `repo` — SC-003's command, verbatim."""
    return git(repo, "status", "--porcelain", *flags)


def test_a_derive_at_the_seams_path_leaves_git_silent(tmp_path):
    """FR-006, SC-003: `git status --porcelain` says nothing about a hand-derive.

    Measured on a scratch checkout carrying this repository's own ignore rules,
    not on this repository — a test that ran `git status` here would be
    asserting the operator's working tree, which is exactly the shape 008 US1
    subtracted from the suite.  What is copied in is the committed file, so the
    rule is the subject and the repository is the source of truth for it.

    The control is the other half of the claim: an ordinary file in the same
    spec directory must still be reported.  A rule that silenced git about
    everything under `specs/` would pass the first assertion and lose the
    operator their corpus.
    """
    repo = tmp_path / "checkout"
    (repo / "specs" / SPEC_DIR).mkdir(parents=True)
    git(repo, "init", "--quiet")
    (repo / ".gitignore").write_text(IGNORE_RULES.read_text(encoding="utf-8"), encoding="utf-8")
    git(repo, "add", ".gitignore")
    git(repo, "commit", "--quiet", "-m", "the ignore rules, as this repository commits them")
    assert status(repo) == "", "the scratch checkout starts clean"

    # The operator's `ergane spec derive specs/<dir> -o specs/<dir>/workgraph.json`,
    # in the only part of it this repository can decide: the file it leaves behind.
    derived = seam_path(repo / "specs")
    write_graph(derived, SEAM_STORIES)
    assert derived.is_file(), "the derive output is on disk"

    # SC-003's own command, and then the same question with the collapsing
    # turned off.  Bare `--porcelain` reports a wholly-untracked directory as
    # one `?? specs/` line, so a silence it returns could be a silence about
    # the directory rather than about the file; `--untracked-files=all` names
    # every file and cannot answer the easier question by accident.
    assert status(repo) == "", (
        "a derived graph at the seam's path is untracked content git reports, so "
        "it accumulates unnoticed — three of them did"
    )
    assert status(repo, "--untracked-files=all") == "", "and not by a collapsed line"

    # The control: the rule reaches the derive output and nothing beside it.  A
    # rule that silenced git about everything under `specs/` would pass both
    # assertions above and lose the operator their corpus.
    (repo / "specs" / SPEC_DIR / "spec.md").write_text("# a spec\n", encoding="utf-8")
    assert "spec.md" in status(repo, "--untracked-files=all"), (
        "the rule must not silence git about the corpus itself"
    )
