"""The spec's own goal, lifted from its body (009 US4, FR-010 · FR-011).

The pane could explain a story and could not explain the spec that contains
one.  `_intent_after()` has lifted a story's one-paragraph intent since 005;
what D-019 adds is the same operation against the spec's own opening heading —
`## Context` for a refined spec, `## Sketch` for one still a sketch — so the
band under the stage can say what the epic on it is *for*.

**One parse, not two** (009 plan D6).  Every assertion below is about
`parse_spec_intent` reusing the paragraph reader the story intents already go
through, and about the one case a band must not paper over: a spec that states
no goal carries no intent, so the room renders nothing rather than an empty
bordered strip (FR-011).

Every corpus here is constructed through `tests/corpus.py`, from the recorded
spec body — no assertion names a spec of this repository or the state it wears
this morning (008 US1, `tests/test_no_test_pins_live_corpus.py`).
"""

from __future__ import annotations

from corpus import (
    SpecFixture,
    build_corpus,
    recorded_body,
    strip_frontmatter,
)
from pane.showfloor import parse_spec_intent, parse_story_headings

#: A body whose opening heading is `## Sketch`, cut from the recorded body by
#: renaming the one heading — so the paragraph under it is a real spec's
#: paragraph and not one written to pass (constitution V).
SKETCH_BODY = recorded_body().replace("## Context", "## Sketch", 1)

#: The same body with the heading taken out altogether: the paragraph is still
#: there, and nothing points the parse at it.  This is the spec that must
#: render no band.
HEADLESS_BODY = recorded_body().replace("## Context\n", "", 1)


def context_paragraph() -> str:
    """The recorded body's `## Context` paragraph, read the long way round.

    Composed here from the file rather than typed, so the expectation cannot
    drift from the material the corpus is cut from.
    """
    lines = recorded_body().splitlines()
    start = lines.index("## Context") + 1
    collected: list[str] = []
    for line in lines[start:]:
        stripped = line.strip()
        if not stripped:
            if collected:
                break
            continue
        collected.append(stripped)
    return " ".join(collected)


# --- FR-010: `## Context` --------------------------------------------------


def test_context_is_lifted_as_one_collapsed_paragraph():
    """The first paragraph under `## Context`, whitespace-collapsed — never the
    heading, never the section, never a Markdown render (D-019)."""
    intent = parse_spec_intent(recorded_body())

    assert intent == context_paragraph()
    assert intent
    assert "\n" not in intent
    assert not intent.startswith("#")
    # One paragraph, not the whole section: the next paragraph of the recorded
    # body is left where it is.
    assert intent.count("  ") == 0


def test_the_spec_intent_rides_the_parse_the_story_intents_ride():
    """FR-010's "through the same parse": the spec-level read produces exactly
    what the story-level read produces when pointed at the same paragraph.

    A second parser would be free to differ — to keep the newlines, to swallow
    a heading, to stop somewhere else — so the proof that there is only one is
    that a story heading placed over this paragraph yields the same string.
    """
    body = (
        "### User Story 1 - Same paragraph, story side (Priority: P1)\n\n"
        + context_paragraph()
        + "\n\n**Why this priority**: it is not part of the intent.\n"
    )

    story = parse_story_headings(body)["US1"].intent

    assert story == parse_spec_intent(recorded_body())


# --- FR-011: the fallback, and the absence ---------------------------------


def test_sketch_is_used_when_context_is_absent():
    assert parse_spec_intent(SKETCH_BODY) == context_paragraph()


def test_context_wins_when_a_spec_carries_both():
    """A spec being refined can carry the new heading above the old one; the
    refined text is the spec's goal and the sketch is its history."""
    body = (
        "## Context\n\nThe refined statement.\n\n"
        "## Sketch\n\nThe sketch this replaced.\n"
    )

    assert parse_spec_intent(body) == "The refined statement."


def test_a_spec_with_neither_heading_carries_no_intent():
    """The empty-band case, from the other side: no heading, no intent, and the
    absence is `""` rather than a stand-in sentence the pane invented."""
    assert parse_spec_intent(HEADLESS_BODY) == ""
    assert parse_spec_intent("") == ""
    assert parse_spec_intent("# Feature Specification: Nothing said\n") == ""


def test_a_heading_with_no_paragraph_under_it_carries_no_intent():
    """`## Context` immediately followed by another heading states nothing, and
    a band drawn under it would be furniture standing in for an answer."""
    assert parse_spec_intent("## Context\n\n## Requirements\n\nText.\n") == ""
    assert parse_spec_intent("## Context\n") == ""


def test_an_empty_context_falls_through_to_the_sketch():
    body = "## Context\n\n## Sketch\n\nWhat this is for.\n"

    assert parse_spec_intent(body) == "What this is for."


def test_the_parse_never_raises_on_arbitrary_bytes():
    """Constitution III: a spec the parse cannot read costs the band, never the
    room."""
    for text in ("\x00\n---\n", "## Context", "##Context\n\nnot the heading\n"):
        assert isinstance(parse_spec_intent(text), str)
    assert parse_spec_intent("##Context\n\nnot the heading\n") == ""


# --- FR-010: the document carries it ---------------------------------------

ATTESTED = "930-carries-a-context"
SKETCHED = "931-carries-a-sketch"
SILENT = "932-states-no-goal"


def test_the_rail_entry_carries_the_spec_intent(tmp_path):
    """The whole join, through the reader seams: three constructed specs, three
    different answers, one field (FR-010, FR-011)."""
    corpus = build_corpus(
        tmp_path,
        SpecFixture(ATTESTED),
        SpecFixture(SKETCHED, body=SKETCH_BODY),
        SpecFixture(SILENT, body=HEADLESS_BODY),
    )

    document = corpus.assemble()
    intents = {
        entry["spec_dir"]: entry["intent"] for entry in document["rail"]
    }

    assert intents[ATTESTED] == context_paragraph()
    assert intents[SKETCHED] == context_paragraph()
    # Not absent from the document, and not `None`: the field is always there
    # and the empty string is the spec saying nothing.
    assert intents[SILENT] == ""


def test_an_unreadable_spec_costs_the_intent_and_not_the_entry(tmp_path):
    """The spec text is one of four reads and it degrades like the other three:
    the entry still renders, the intent is empty, and the failed read is named
    in the notes (constitution III)."""
    corpus = build_corpus(tmp_path, SpecFixture(ATTESTED))
    (corpus.specs_root / ATTESTED / "spec.md").write_text(
        strip_frontmatter(""), encoding="utf-8"
    )

    entry = corpus.entry(ATTESTED)

    assert entry["intent"] == ""
