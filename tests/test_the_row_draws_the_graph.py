"""The graph the Desk found is the one the row draws from (012 US2).

US1 gave the Desk the archive, so an epic's row finally has a graph behind it.
This file asserts the half that decides what the row may draw from it — the
backend half, where the join happens:

* the dependency a story's graph declares reaches its card, both edge kinds
  apart, so the row has something to draw that it did not derive (FR-006);
* a story the graph declares with **no** edge carries the empty lists that mean
  exactly that, which is what `UNDECLARED` is rendered from — and a story whose
  graph could not be read carries `None`, which is a different fact and is
  never rendered as `UNDECLARED` (FR-007);
* a graph that is about some other epic's stories is named in `degraded` and
  joined nowhere, so no topology is invented out of the half that was
  recognised (spec Edge Cases).

The corpus is built under the test's own `tmp_path` from `tests/corpus.py`'s
recorded material, and the archive is located through the production derivation
`archive_root_for` rather than a path typed here: nothing below pins this
repository's live corpus (008 US1, and this spec's plan trap).
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
SPEC_DIR = "911-a-constructed-epic"


class RowReader(LiveReader):
    """`LiveReader.workgraph` over a constructed corpus, with a floor of one epic.

    The workgraph seam is the live one — the same `specs_root / <dir> /
    workgraph.json` read raising the same `TransportFailed` — so the archive
    fallback US1 landed is exercised as itself.  `epic_status` answers with the
    node map the test hands it, because *what the floor names* is the other
    half of every question this file asks.
    """

    reference_instant: str | None = None

    def __init__(self, specs_root: Path, spec_dir: str, nodes: dict) -> None:
        super().__init__(specs_root)
        self.spec_dir = spec_dir
        self.nodes = nodes

    async def read_floor(self) -> FloorRead:
        ref = EpicRef(
            epic_id=self.spec_dir,
            workflow_id=f"epic-{self.spec_dir}",
            scene=None,
            workgraph_ref=self.spec_dir,
        )
        return FloorRead(status={"epics": [{"epic_id": self.spec_dir}]}, running=[ref])

    async def epic_status(self, workflow_id: str, scene: str | None = None) -> dict:
        return {"epic_state": "RUNNING", "nodes": self.nodes}

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


# --- the corpus, and the graph the operator archived beside it --------------


def archive_graph(specs_root: Path, story_keys: list[str]) -> dict:
    """Archive a compiled graph of the recorded shape for `SPEC_DIR`.

    `derived_graph` chains the stories the way a spec whose stories share files
    chains them: every story after the first carries a `depends_on_merged` edge
    to the one before it.  That chain is the topology the row is asked to draw.
    """
    graph = derived_graph(SPEC_DIR, story_keys)
    archived = archive_root_for(specs_root) / f"{SPEC_DIR}.json"
    archived.parent.mkdir(parents=True, exist_ok=True)
    archived.write_text(json.dumps(graph, indent=2), encoding="utf-8")
    return graph


def running(*node_ids: str) -> dict:
    """An `epic_status` node map naming the stories the floor has started."""
    return {node_id: {"state": "RUNNING"} for node_id in node_ids}


def assemble(specs_root: Path, nodes: dict) -> dict:
    return asyncio.run(
        assemble_floor_document(RowReader(specs_root, SPEC_DIR, nodes))
    )


def epic_of(document: dict) -> dict:
    return next(epic for epic in document["epics"] if epic["epic_id"] == SPEC_DIR)


def cards_by_id(document: dict) -> dict[str, dict]:
    return {card["id"]: card for card in epic_of(document)["nodes"]}


def corpus_for(tmp_path: Path):
    """A one-spec corpus in a scratch tree, with nothing archived beside it yet."""
    return build_corpus(tmp_path, SpecFixture(SPEC_DIR, state="ready", archived=False))


# --- US2-S1: the declared dependency reaches the row ------------------------


def test_the_declared_merge_edges_reach_the_cards(tmp_path):
    """FR-006: each story's card carries the dependency its graph declares."""
    corpus = corpus_for(tmp_path)
    graph = archive_graph(corpus.specs_root, ["US1", "US2", "US3"])
    # The premise, measured rather than assumed: this graph really does declare
    # a chain, so a row that drew nothing would be drawing less than it was given.
    assert [node["depends_on_merged"] for node in graph["nodes"]] == [[], ["us1"], ["us2"]]

    cards = cards_by_id(assemble(corpus.specs_root, running("us1", "us2", "us3")))

    assert cards["us1"]["depends_on_merged"] == []
    assert cards["us2"]["depends_on_merged"] == ["us1"]
    assert cards["us3"]["depends_on_merged"] == ["us2"]
    # Both edge kinds are carried apart, because the row draws them apart: a
    # merge edge is a content dependency and a pass edge is an ordering-only
    # one, and collapsing them would lose the difference the Legend names.
    assert all(card["depends_on"] == [] for card in cards.values())
    assert all(card["declared"] for card in cards.values())


def test_a_pass_edge_is_carried_as_a_pass_edge(tmp_path):
    """FR-006: `depends_on` and `depends_on_merged` do not become one list."""
    corpus = corpus_for(tmp_path)
    graph = derived_graph(SPEC_DIR, ["US1", "US2"])
    # The one edit to the recorded shape, and it is the deriver's own move: a
    # story whose predecessor need only reach a verdict carries the ordering
    # edge instead of the content one (`ergane spec derive`'s `depends_on`).
    graph["nodes"][1]["depends_on"] = ["us1"]
    graph["nodes"][1]["depends_on_merged"] = []
    archived = archive_root_for(corpus.specs_root) / f"{SPEC_DIR}.json"
    archived.parent.mkdir(parents=True, exist_ok=True)
    archived.write_text(json.dumps(graph, indent=2), encoding="utf-8")

    cards = cards_by_id(assemble(corpus.specs_root, running("us1", "us2")))

    assert cards["us2"]["depends_on"] == ["us1"]
    assert cards["us2"]["depends_on_merged"] == []


# --- US2-S2: UNDECLARED keeps its meaning -----------------------------------


def test_an_edgeless_story_carries_empty_lists_not_absent_ones(tmp_path):
    """FR-007: a graph that declares no edge for a story says so, and says it
    differently from a graph that could not be read.

    This is the distinction the row's `UNDECLARED` is rendered from, and the
    reason it cannot become the rendering for "no graph" (plan D4): a story the
    graph declares with no edge carries `[]`, and a story no graph declared
    carries `None`.  Two facts, two shapes, one of them never `UNDECLARED`.
    """
    corpus = corpus_for(tmp_path)
    archive_graph(corpus.specs_root, ["US1"])

    cards = cards_by_id(assemble(corpus.specs_root, running("us1")))

    assert cards["us1"]["declared"] is True
    assert cards["us1"]["depends_on"] == []
    assert cards["us1"]["depends_on_merged"] == []


def test_a_story_whose_graph_could_not_be_read_declares_nothing_at_all(tmp_path):
    """FR-007: no graph, no `[]` — the absence is `None`, and it is degraded.

    Neither source answers, so the epic's row has no graph behind it.  Every
    card is undeclared and both edge lists are absent rather than empty, which
    is what stops the row reading `UNDECLARED` for a read that never happened.
    """
    corpus = corpus_for(tmp_path)
    assert not (corpus.specs_root / SPEC_DIR / "workgraph.json").exists()
    assert not (archive_root_for(corpus.specs_root) / f"{SPEC_DIR}.json").exists()

    document = assemble(corpus.specs_root, running("us1", "us2"))
    cards = cards_by_id(document)

    assert [card["declared"] for card in cards.values()] == [False, False]
    assert all(card["depends_on"] is None for card in cards.values())
    assert all(card["depends_on_merged"] is None for card in cards.values())
    # And the operator is told why, once, under the read that failed.
    assert [entry["read"] for entry in document["degraded"]] == ["workgraph"]


# --- the edge case: a graph about some other epic's stories -----------------


def test_a_graph_naming_no_story_of_this_epic_is_named_and_joined_nowhere(tmp_path):
    """Spec Edge Cases: the mismatch is named, and no topology is invented.

    The archive is under the right name and holds a real compiled graph — it is
    simply about stories this epic does not have, which is what a graph
    compiled before its spec's stories were renamed looks like.  Drawing the
    chain it declares would put `us8`'s dependency on a row whose stories are
    `us1` and `us2`.
    """
    corpus = corpus_for(tmp_path)
    archive_graph(corpus.specs_root, ["US7", "US8"])

    document = assemble(corpus.specs_root, running("us1", "us2"))
    epic = epic_of(document)

    # The row shows the floor's own stories and nothing the graph declared.
    assert [card["id"] for card in epic["nodes"]] == ["us1", "us2"]
    assert all(not card["declared"] for card in epic["nodes"])
    # Not one edge from the recognised-looking half: the chain the graph
    # declares (`us8` after `us7`) reaches no card at all.
    assert all(card["depends_on_merged"] is None for card in epic["nodes"])

    entries = [entry for entry in document["degraded"] if entry["read"] == "workgraph"]
    assert len(entries) == 1
    assert entries[0]["mode"] == "mismatch"
    assert entries[0]["section"] == "epics"
    assert entries[0]["epic_id"] == SPEC_DIR
    # It names both sides, because "the graph disagrees" is not a fact an
    # operator can act on and "it declares us7 and us8 while the floor is
    # running us1 and us2" is.
    for name in ("us7", "us8", "us1", "us2"):
        assert name in entries[0]["detail"]


def test_a_partial_difference_is_the_skew_case_and_not_a_mismatch(tmp_path):
    """Spec Edge Cases, the other side: skew is ordinary and stays ordinary.

    A floor naming a story the graph does not declare is what the Fixture
    floor's `skew` scene records and what `declared: false` has meant since
    001.  Turning it into a mismatch would throw away a graph that is right
    about every story it does declare.
    """
    corpus = corpus_for(tmp_path)
    archive_graph(corpus.specs_root, ["US1", "US2"])

    document = assemble(corpus.specs_root, running("us1", "us2", "us3"))
    cards = cards_by_id(document)

    assert cards["us2"]["depends_on_merged"] == ["us1"]
    assert cards["us3"]["declared"] is False
    assert cards["us3"]["depends_on_merged"] is None
    assert [entry for entry in document["degraded"] if entry["read"] == "workgraph"] == []


def test_a_refused_status_is_not_a_mismatch(tmp_path):
    """A floor that named no stories has not disagreed with the graph.

    The Fixture floor's scanner scene is this: `epic_status` is refused, so the
    node map is empty and the graph is the only source the row has.  Calling
    that a mismatch would delete the one topology the Desk could show, and
    report a second failure for a read that only failed once.
    """
    corpus = corpus_for(tmp_path)
    archive_graph(corpus.specs_root, ["US1", "US2"])

    document = assemble(corpus.specs_root, {})
    cards = cards_by_id(document)

    assert cards["us2"]["depends_on_merged"] == ["us1"]
    assert [entry for entry in document["degraded"] if entry["read"] == "workgraph"] == []


def test_the_two_spellings_of_one_story_are_not_a_mismatch(tmp_path):
    """`us1` on the floor and `US1` in the graph are one story, not two.

    The seams spell it two ways and the pane folds them together on the render
    side already (`EpicRow.storyForCard`).  A comparison that folded only one
    side would report every epic on the floor as a mismatch.
    """
    corpus = corpus_for(tmp_path)
    archive_graph(corpus.specs_root, ["US1", "US2"])

    document = assemble(corpus.specs_root, running("US1", "US2"))

    assert [entry for entry in document["degraded"] if entry["read"] == "workgraph"] == []
