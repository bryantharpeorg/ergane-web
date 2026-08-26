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
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from corpus import SpecFixture, build_corpus, derived_graph
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
