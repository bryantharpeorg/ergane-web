"""Build the corpus conditions the showfloor tests assert over (008 US1).

The showfloor document joins four sources, and two of them are files an operator
edits between builds: a spec's `state:` frontmatter, and the compiled work graph
this repository archives beside its specs.  A test that *reads* those files and
asserts what it found is not asserting the document's contract — it is asserting
this morning's repository, and it goes red the moment the operator attests a
spec `landed` or archives a derived graph, with no line of source touched.  That
is exactly what happened: two operator PRs sat red against three such
assertions.  008 US1 is the subtraction.

So this module is the one place in the suite allowed to name a directory under
`specs/` or a file under the archive, and it names them only to **cut material
from** — a recorded spec body and a recorded `ergane spec derive` graph, so no
shape here is invented (constitution V).  Every *condition* a test needs is
written into a scratch tree by `build_corpus` and asserted there:

    corpus = build_corpus(
        tmp_path,
        SpecFixture("910-attested", state="landed"),
        SpecFixture("911-in-flight", state="ready", archived=False),
    )
    entry = corpus.entry("910-attested")

`copy_repository_corpus` is the other door: this repository's own corpus copied
into a scratch tree so a test may perform the operator's edits — `attest` and
`archive` — on the copy instead of asserting over the original.

`tests/test_no_test_pins_live_corpus.py` is the guard that keeps the rest of the
suite off these files (FR-001).
"""

from __future__ import annotations

import asyncio
import copy
import dataclasses
import json
import shutil
from collections.abc import Sequence
from pathlib import Path

from pane.readers import TransportFailed
from pane.showfloor import (
    ShowfloorReaders,
    assemble_showfloor,
    parse_story_headings,
)

ROOT = Path(__file__).resolve().parents[1]

#: The committed material every constructed corpus is cut from: one spec of this
#: repository's own corpus and the `ergane spec derive` output archived beside
#: it.  The builder copies their *shape* — a four-story spec body off the
#: `### User Story <n> - <title> (Priority: P<n>)` grammar, a compiled graph with
#: `requirement_keys` and both edge lists — and supplies the frontmatter itself,
#: so the source's own attested state never reaches a constructed spec and a
#: later attestation of it cannot move a single assertion.
RECORDED_SPEC = ROOT / "specs" / "001-the-desk-sees-the-floor" / "spec.md"
RECORDED_GRAPH = ROOT / "docs" / "dags" / "001-the-desk-sees-the-floor.json"

REPOSITORY_SPECS = ROOT / "specs"
REPOSITORY_ARCHIVE = ROOT / "docs" / "dags"


# --- the recorded material ------------------------------------------------


def recorded_body() -> str:
    """The recorded spec's text with its frontmatter block removed.

    The body is what carries the story headings, the titles and the intents; the
    frontmatter is the one part a constructed corpus always writes for itself.
    """
    return strip_frontmatter(RECORDED_SPEC.read_text(encoding="utf-8"))


def recorded_graph() -> dict:
    """The archived `ergane spec derive` output, verbatim."""
    return json.loads(RECORDED_GRAPH.read_text(encoding="utf-8"))


def strip_frontmatter(text: str) -> str:
    """`text` without a leading `---`-delimited block, if it has one."""
    if not text.startswith("---\n"):
        return text
    _head, separator, body = text[4:].partition("\n---\n")
    return body if separator else text


def derived_graph(spec_dir: str, story_keys: Sequence[str]) -> dict:
    """A compiled graph of the recorded shape, retargeted at `spec_dir`.

    Every key, and the node's every field, comes from the archived recording;
    what this function supplies is the identity `ergane spec derive` would have
    supplied — the spec's own directory and its own story keys, chained the way
    a spec whose stories share files chains them.
    """
    recorded = recorded_graph()
    template = recorded["nodes"][0]

    nodes = []
    for index, story_key in enumerate(story_keys):
        node = copy.deepcopy(template)
        node["id"] = story_key.lower()
        node["story_key"] = story_key
        node["spec_ref"] = f"{spec_dir}:{story_key}"
        node["requirement_keys"] = [story_key, *template["requirement_keys"][1:]]
        node["depends_on"] = []
        node["depends_on_merged"] = [story_keys[index - 1].lower()] if index else []
        nodes.append(node)

    graph = copy.deepcopy(recorded)
    graph["epic_id"] = spec_dir
    graph["feature"] = spec_dir
    graph["nodes"] = nodes
    graph["inferred_edges"] = []
    return graph


# --- the constructed corpus -----------------------------------------------


@dataclasses.dataclass(frozen=True)
class SpecFixture:
    """One spec to write into a constructed corpus.

    `state` is the frontmatter the file carries; `None` writes no frontmatter
    block at all, which is ergane's "reads `draft`" case.  `archived` says
    whether a compiled graph sits beside it — the difference between a spec the
    document reads story identity from and one it degrades to headings for.
    """

    spec_dir: str
    state: str | None = "ready"
    archived: bool = True
    body: str | None = None
    name: str | None = None


async def no_epic(spec_dir: str) -> dict | None:
    """No epic is running for this spec: undispatched, not degraded."""
    return None


class Corpus:
    """A specs root and an archive beside it, both under a test's own tmp tree."""

    def __init__(self, specs_root: Path, archive_root: Path) -> None:
        self.specs_root = specs_root
        self.archive_root = archive_root

    # --- what the corpus holds

    @property
    def dirs(self) -> list[str]:
        """Every spec directory, in the sorted order `read_roadmap` walks."""
        return sorted(
            path.name
            for path in self.specs_root.iterdir()
            if (path / "spec.md").is_file()
        )

    def is_archived(self, spec_dir: str) -> bool:
        return (self.archive_root / f"{spec_dir}.json").is_file()

    def spec_text(self, spec_dir: str) -> str:
        return (self.specs_root / spec_dir / "spec.md").read_text(encoding="utf-8")

    def headings(self, spec_dir: str) -> dict:
        """The spec's own story headings, parsed as the assembly parses them."""
        return parse_story_headings(self.spec_text(spec_dir))

    def graph(self, spec_dir: str) -> dict:
        return json.loads(
            (self.archive_root / f"{spec_dir}.json").read_text(encoding="utf-8")
        )

    def declared_story_keys(self, spec_dir: str) -> list[str]:
        """What this corpus declares for a spec, read the way the assembly reads
        it: the archived graph when there is one, else the spec's own headings.
        """
        if self.is_archived(spec_dir):
            return sorted(node["story_key"] for node in self.graph(spec_dir)["nodes"])
        return sorted(self.headings(spec_dir))

    # --- the operator's two edits, performed on the copy

    def attest(self, spec_dir: str, state: str) -> None:
        """Rewrite a spec's `state:` frontmatter and nothing else — the edit an
        operator makes when a spec lands (PR #37's whole diff, per spec)."""
        path = self.specs_root / spec_dir / "spec.md"
        text = path.read_text(encoding="utf-8")
        if not text.startswith("---\n"):
            path.write_text(f"---\nstate: {state}\n---\n{text}", encoding="utf-8")
            return
        head, separator, body = text[4:].partition("\n---\n")
        lines = [
            f"state: {state}" if line.startswith("state:") else line
            for line in head.splitlines()
        ]
        if not any(line.startswith("state:") for line in lines):
            lines.insert(0, f"state: {state}")
        path.write_text(
            "---\n" + "\n".join(lines) + separator + body, encoding="utf-8"
        )

    def archive(self, spec_dir: str, graph: dict | None = None) -> dict:
        """Archive a compiled graph beside a spec — the edit PR #40 makes.

        With no `graph` given, one is derived from the recorded shape over the
        spec's own story headings, which is what `ergane spec derive` writes.
        """
        if graph is None:
            graph = derived_graph(spec_dir, sorted(self.headings(spec_dir)))
        self.archive_root.mkdir(parents=True, exist_ok=True)
        (self.archive_root / f"{spec_dir}.json").write_text(
            json.dumps(graph, indent=2), encoding="utf-8"
        )
        return graph

    def unarchive(self, spec_dir: str) -> None:
        """Take a spec's compiled graph out of the archive."""
        (self.archive_root / f"{spec_dir}.json").unlink(missing_ok=True)

    # --- the reads, bound to this corpus

    def workgraph(self, spec_dir: str) -> dict:
        """The archive read, performed as `_BoundReads.workgraph` performs it: a
        spec with nothing archived is a transport failure, never an empty graph.
        """
        path = self.archive_root / f"{spec_dir}.json"
        if not path.is_file():
            raise TransportFailed("workgraph", f"{path}: no compiled graph")
        return json.loads(path.read_text(encoding="utf-8"))

    def readers(self, **overrides) -> ShowfloorReaders:
        fields = {"workgraph": self.workgraph, "epic_status": no_epic}
        fields.update(overrides)
        return ShowfloorReaders(**fields)

    # --- the document

    def assemble(self, **overrides) -> dict:
        return asyncio.run(
            assemble_showfloor(self.specs_root, self.readers(**overrides))
        )

    def entry(self, spec_dir: str, **overrides) -> dict:
        return entry_for(self.assemble(**overrides), spec_dir)


def entry_for(document: dict, spec_dir: str) -> dict:
    return next(entry for entry in document["rail"] if entry["spec_dir"] == spec_dir)


def build_corpus(tmp_path: Path, *fixtures: SpecFixture) -> Corpus:
    """Write `fixtures` into a scratch corpus under `tmp_path` and return it."""
    corpus = Corpus(tmp_path / "specs", tmp_path / "dags")
    corpus.specs_root.mkdir(parents=True, exist_ok=True)
    corpus.archive_root.mkdir(parents=True, exist_ok=True)

    body = recorded_body()
    for fixture in fixtures:
        directory = corpus.specs_root / fixture.spec_dir
        directory.mkdir(parents=True, exist_ok=True)
        text = body if fixture.body is None else fixture.body
        if fixture.name is not None:
            text = _renamed(text, fixture.name)
        if fixture.state is not None:
            text = f"---\nstate: {fixture.state}\n---\n{text}"
        (directory / "spec.md").write_text(text, encoding="utf-8")
        if fixture.archived:
            corpus.archive(fixture.spec_dir)

    return corpus


def copy_repository_corpus(tmp_path: Path) -> Corpus:
    """This repository's own corpus and archive, copied into a scratch tree.

    The copy is what makes the operator's edits testable without asserting over
    the originals: a test calls `attest` and `archive` on the copy, so the
    condition it proves is one it constructed even though the material is the
    real corpus.
    """
    corpus = Corpus(tmp_path / "specs", tmp_path / "dags")
    shutil.copytree(REPOSITORY_SPECS, corpus.specs_root)
    corpus.archive_root.mkdir(parents=True, exist_ok=True)
    for path in REPOSITORY_ARCHIVE.glob("*.json"):
        shutil.copy(path, corpus.archive_root / path.name)
    return corpus


def _renamed(text: str, name: str) -> str:
    """Retarget the body's `# Feature Specification: <name>` line."""
    lines = text.splitlines(keepends=True)
    for index, line in enumerate(lines):
        if line.startswith("# Feature Specification: "):
            lines[index] = f"# Feature Specification: {name}\n"
            break
    return "".join(lines)
