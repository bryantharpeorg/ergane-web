"""The goal band says the whole sentence, as prose (019 US1, FR-001…FR-005).

The band under the stage had a wrong answer on it, not a missing one.
`_intent_after` ended a paragraph at any line beginning with `**`, which is
what a Spec Kit template label looks like — and also what the *second line* of
any paragraph looks like when its wrap happens to land on a bold word.  A spec
whose `## Context` wraps that way had its goal rendered as far as `… — and`,
and the room asserted that the goal ended there.  The same reader serves story
intents, so both readings carried it.

Three rules and one absence, all of them the one reader's (FR-004):

* a paragraph runs to its end, `**` continuation lines included (FR-001);
* a `**Label**:` line still ends it, blank line before it or not (FR-002);
* the marks come off and the words stay, in order (FR-003) — D-019's "treated
  as prose" honoured, since `**` is what the file carries and not what a reader
  reads;
* a spec that states no goal still answers `""`, and the room draws no band
  (FR-005).

**The two paragraphs asserted over are recorded, not written** (constitution
V): they are the bodies that exposed the defect, cut through `tests/corpus.py`,
which is the one place in the suite allowed to name the corpus
(`tests/test_no_test_pins_live_corpus.py`).  Nothing here asserts a spec's
state or its graph — only the shape of prose a spec happens to carry, and the
guards below fail loudly rather than silently if a rewording ever takes that
shape away.
"""

from __future__ import annotations

from corpus import (
    SpecFixture,
    build_corpus,
    paragraph_lines,
    recorded_marked_body,
    recorded_wrapped_bold_body,
)
from pane.showfloor import parse_spec_intent, parse_story_headings

WRAPPED = recorded_wrapped_bold_body()
MARKED = recorded_marked_body()


def marks_off(lines: list[str]) -> str:
    """The recorded paragraph's own answer, arrived at independently.

    Deliberately *not* the parser's stripper: an expectation computed by the
    code under test asserts nothing at all.  Both recorded paragraphs carry
    balanced `**` and `` ` `` pairs and no other mark — which
    `test_the_blunt_expectation_is_a_fair_one` holds them to — so deleting
    every one of those characters is the same answer reached another way.
    """
    return " ".join(lines).replace("**", "").replace("`", "")


def test_the_blunt_expectation_is_a_fair_one():
    """The guard on `marks_off`, and on the material both cases rest on.

    A recording can be reworded; if either paragraph ever grows a mark this
    blunt removal would get wrong, the case that rests on it must say so here
    rather than quietly assert the parser against itself.
    """
    for lines in (paragraph_lines(WRAPPED), paragraph_lines(MARKED)):
        joined = " ".join(lines)
        assert joined.count("`") % 2 == 0
        assert joined.count("*") % 2 == 0
        # No single-asterisk emphasis and no underscore emphasis: every `*` in
        # this material belongs to a `**` pair, and every `_` is a word's own
        # character (`awaiting_operator`), which the blunt removal must leave
        # standing.
        assert "***" not in joined
        assert joined.replace("**", "").count("*") == 0


# --- FR-001: the paragraph runs to its end --------------------------------


def test_the_recorded_paragraph_still_wraps_onto_a_bold_line():
    """The case this story exists for, held in place.

    US1-S1 is only a test while the recorded material actually carries the
    shape — a continuation line beginning `**`.  If a rewording takes it away,
    this fails by name instead of leaving the assertion below vacuous.
    """
    lines = paragraph_lines(WRAPPED)

    assert len(lines) > 1
    assert any(line.startswith("**") for line in lines[1:])


def test_a_wrapped_bold_paragraph_is_read_through_its_end():
    """US1-S1 (FR-001): the whole paragraph, through its final sentence.

    The old guard answered this spec's goal as far as its first line and cut
    the sentence at `— and`.
    """
    lines = paragraph_lines(WRAPPED)

    intent = parse_spec_intent(WRAPPED)

    assert intent == marks_off(lines)
    # Said the other way round, so the failure names the defect rather than a
    # diff of two long strings: the words *after* the wrap are there, and the
    # sentence the old guard stopped inside is whole.
    assert intent.endswith(marks_off(lines[-1:]))
    assert not intent.endswith("and")
    assert marks_off([lines[1]]) in intent


# --- FR-002: a template label still ends it -------------------------------


def test_a_template_label_ends_the_paragraph_with_no_blank_line_before_it():
    """US1-S2: the guard's real job, kept — the label is not part of the goal."""
    body = (
        "## Context\n\nThe spec exists to say this.\n"
        "**Why this priority**: it is a wrong answer on screen.\n"
    )

    assert parse_spec_intent(body) == "The spec exists to say this."


def test_a_template_label_ends_the_paragraph_at_any_position():
    """FR-002 "at any position": first line under the heading, or fifth."""
    first = "## Context\n\n**Feature Branch**: 019-a-branch\n\nThe goal.\n"
    fifth = (
        "## Context\n\nOne. Two.\nThree. Four.\nFive.\n"
        "**Status**: Draft\nSix.\n"
    )

    assert parse_spec_intent(first) == ""
    assert parse_spec_intent(fifth) == "One. Two. Three. Four. Five."


def test_bold_prose_is_not_a_label_and_does_not_end_the_paragraph():
    """The shape, not the prefix (plan D3): a label is `**…**` then a colon.

    A line opening with a bold phrase that ends in a full stop is prose, and so
    is one carrying two bold phrases with a colon somewhere after them — the
    old guard ended the paragraph at both.
    """
    body = (
        "## Context\n\nThe first line ends on a bold\n"
        "**phrase that wrapped**. And the sentence goes on.\n"
        "**Two** words in **bold**: still prose, still one paragraph.\n"
    )

    assert parse_spec_intent(body) == (
        "The first line ends on a bold phrase that wrapped. And the sentence "
        "goes on. Two words in bold: still prose, still one paragraph."
    )


def test_a_heading_and_a_rule_still_end_the_paragraph():
    """The other two stops, unchanged by this story."""
    assert parse_spec_intent("## Context\n\nThe goal.\n## Requirements\n") == "The goal."
    assert parse_spec_intent("## Context\n\nThe goal.\n---\nAfter.\n") == "The goal."


# --- FR-003: the marks come off, the words stay ---------------------------


def test_the_recorded_paragraph_still_carries_inline_marks():
    """The same guard, for US1-S3's material."""
    joined = " ".join(paragraph_lines(MARKED))

    assert "`" in joined
    assert "**" in joined


def test_inline_marks_are_gone_and_their_words_remain_in_order():
    """US1-S3 (FR-003): prose is what a reader reads; `**` is what a file
    carries.  No Markdown render and no new dependency (plan D4)."""
    lines = paragraph_lines(MARKED)

    intent = parse_spec_intent(MARKED)

    assert intent == marks_off(lines)
    assert "**" not in intent
    assert "`" not in intent
    # The words the marks wrapped are still there, and still in the order the
    # spec put them in — stripping a mark must never drop or reorder a word.
    wrapped = [word.strip("`*.,;:") for word in " ".join(lines).split() if "`" in word]
    assert wrapped
    positions = [intent.find(word) for word in wrapped]
    assert all(position >= 0 for position in positions)
    assert positions == sorted(positions)


def test_an_unpaired_mark_is_a_character_the_spec_meant():
    """Pairs only (plan D4).  A lone `*` or backtick is prose, not half a mark,
    and a word's own underscore is never emphasis."""
    body = (
        "## Context\n\n"
        "A 5 * 3 grid, a lone ` tick, and parse_spec_intent by name.\n"
    )

    assert parse_spec_intent(body) == (
        "A 5 * 3 grid, a lone ` tick, and parse_spec_intent by name."
    )


def test_emphasis_inside_and_around_a_code_span_comes_off_together():
    """Bold that spans a code span, and a code span holding an underscore: the
    span is lifted out before emphasis is touched and put back after."""
    body = "## Context\n\n**The `--cov` flag** matters, and _so_ does `a_b_c`.\n"

    assert parse_spec_intent(body) == (
        "The --cov flag matters, and so does a_b_c."
    )


# --- FR-004: one reader, two headings -------------------------------------


def test_a_story_intent_obeys_all_three_rules_identically():
    """US1-S4 (FR-004): the story side is the same function, so it cannot end a
    paragraph anywhere else or leave a mark the spec side stripped.

    The recorded wrapped-bold paragraph is placed under a story heading and
    followed, with no blank line, by the label that guard exists for.
    """
    paragraph = "\n".join(paragraph_lines(WRAPPED))
    body = (
        "### User Story 1 - The same paragraph, story side (Priority: P1)\n\n"
        f"{paragraph}\n"
        "**Why this priority**: it is not part of the intent.\n"
    )

    intent = parse_story_headings(body)["US1"].intent

    assert intent == marks_off(paragraph_lines(WRAPPED))
    assert intent == parse_spec_intent(WRAPPED)
    assert "Why this priority" not in intent


def test_the_two_readings_agree_on_the_marked_paragraph_too():
    """FR-004 again, over US1-S3's material: one reader, one answer."""
    paragraph = "\n".join(paragraph_lines(MARKED))
    body = (
        "### User Story 2 - The marked paragraph, story side (Priority: P2)\n\n"
        f"{paragraph}\n"
    )

    assert parse_story_headings(body)["US2"].intent == parse_spec_intent(MARKED)


# --- FR-005: the absence, unchanged ---------------------------------------


def test_a_spec_that_states_no_goal_still_carries_none():
    """US1-S5: nothing about this story fills a silence.  `""` is the answer,
    and `SpecGoal` renders no band at all rather than an empty strip."""
    assert parse_spec_intent("") == ""
    assert parse_spec_intent("## Context\n") == ""
    assert parse_spec_intent("## Context\n\n## Requirements\n\nText.\n") == ""
    assert parse_spec_intent("## Context\n\n**Status**: Draft\n") == ""
    assert parse_spec_intent(WRAPPED.replace("## Context\n", "", 1)) == ""


# --- the document carries the whole sentence ------------------------------

WRAPS = "940-wraps-onto-a-bold-line"
MARKS = "941-carries-inline-marks"
SILENT = "942-states-no-goal"


def test_the_rail_entry_carries_the_whole_sentence_as_prose(tmp_path):
    """The join, end to end: what the room is handed is what the band renders,
    so `SpecGoal` goes on rendering `{intent}` and this story stays out of
    `web/` (plan D1)."""
    corpus = build_corpus(
        tmp_path,
        SpecFixture(WRAPS, body=WRAPPED),
        SpecFixture(MARKS, body=MARKED),
        SpecFixture(SILENT, body=WRAPPED.replace("## Context\n", "", 1)),
    )

    document = corpus.assemble()
    intents = {entry["spec_dir"]: entry["intent"] for entry in document["rail"]}

    assert intents[WRAPS] == marks_off(paragraph_lines(WRAPPED))
    assert intents[MARKS] == marks_off(paragraph_lines(MARKED))
    assert intents[SILENT] == ""
    for spec_dir in (WRAPS, MARKS):
        assert "**" not in intents[spec_dir]
        assert "`" not in intents[spec_dir]
