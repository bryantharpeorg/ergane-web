# Implementation Plan: A draft shows what will run

**Spec**: `specs/014-a-draft-shows-what-will-run/spec.md` · **Landing branch**: `dev`
**Authority**: constitution II (seam list amended by D-022), III, VI and VIII;
`DESIGN.md` § The drafting table in this world (added by D-022).

## The shape

Three stories, strictly serial. US2 needs a page to write onto; US3 needs US2's
compiled graph. All three reach the same new route module, so `depends_on_merged`
is the right edge — two nodes extending one file is N38's failure mode, and it
presents in the merge queue rather than in the pull request.

## Decisions

- **D1 — the room reads documents; the seam derives the graph.** Never parse a
  Work Graph out of the markdown the room is rendering. `derive_workgraph` is the
  only thing that knows what a Work Graph means, and a second parser in this
  repository is D-005 by construction. The room renders `spec.md` as prose and
  calls the deriver on the same text, separately.

- **D2 — each check keeps its own name and its own answer.** The view is a list of
  attributed results, not a verdict. This is not a stylistic choice: the CLI's
  composition — which checks run, in what order, which failures are fatal, what
  counts as a refusal versus a warning — lives in `_validate_command`
  (`factory/cli/nouns/spec.py:231`) and is not exported. Reproducing it here
  produces a number that will drift from the CLI's the first time ergane changes
  a severity, and the operator will believe the pane.

- **D3 — the absent document is the common case.** Eight of fourteen spec
  directories in this corpus lack a `plan.md`, a `tasks.md`, or both. Treating
  absence as degradation would paint a red border on most of the corpus, which is
  constitution III inverted — exactly the defect 012 was written to fix on the
  Desk. Absent renders as absent, quietly.

- **D4 — the stage is reused unlit, not re-drawn.** The Showfloor's stage already
  knows how to lay out a DAG and how to stroke the two edge kinds
  (`DESIGN.md` § Stage). A pre-dispatch graph has no run state, so every node
  renders in the unlit form. Do not invent an eleventh glyph for "not yet run";
  the glyph grammar has eleven states and none of them is this, because this is
  the absence of state, not a state.

- **D5 — the route takes a name, not a path.** `/draft/<spec-dir>` resolves
  `<spec-dir>` as a single directory name against the configured specs root.
  Never join an operator-supplied path onto a root; a route that accepts `..`
  reads the operator's filesystem behind one bearer token.

## Named traps

- **`ergane spec validate` has no library form, and the tempting fix is the wrong
  one.** Its five checks are individually exported — `derive_workgraph`,
  `check_slice_coverage`, `check_prompt_assembly`, `parse_spec`, `load_personas` —
  and composing them here would look like riding seams while actually re-deriving
  the policy. Filed as PR-8. Until it lands, the room shows the parts and says the
  whole is unavailable. **Do not add a "looks good" summary chip.**

- **Never shell the CLI.** Constitution II names this explicitly. `subprocess`
  against `ergane` anywhere in this diff is a refusal, not a shortcut, and
  `ergane doctor` in particular writes.

- **The roadmap hard-resets the operator's checkout (N50).**
  `factory/activities/roadmap_activities.py:118` runs `git reset --hard` on the
  working checkout every tick. This room only *reads* the tree, so it cannot lose
  work — but the revision it names in FR-003 can change under a reader within 300
  seconds, and a stale render that does not say when it was read is dishonest.
  That is why FR-003 exists; it is not decoration.

- **Do not pin the live corpus.** `tests/corpus.py` and
  `tests/test_no_test_pins_live_corpus.py` landed in 008/US1. Build spec
  directories under `tmp_path`; never assert that `012-the-desk-finds-the-graph`
  is on disk, because the corpus moves.

- **The markdown renderer is a dependency decision.** Constitution VII: no new
  package without explicit operator approval. If the frontend has no markdown
  renderer already vendored, **stop and ask** — do not add one and do not
  hand-roll a parser that will meet a fenced block containing `---`.

## Gates

The four in `ergane.yaml`, unchanged: `uv run pytest -q`,
`npm --prefix web run typecheck`, `test:unit`, `test:smoke`.
