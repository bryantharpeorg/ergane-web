# Implementation Plan: A landed epic reads landed

**Spec**: `specs/009-a-landed-epic-reads-landed/spec.md` · **Authority**: D-018,
`DESIGN.md` § Layout (fourth law) · **Landing branch**: `dev`

## The shape

Three stories, serial on `depends_on_merged`, because US2 and US3 both edit the
smoke and pytest suites US1 extends. Serial costs wall clock and buys no
conflicts; 008 ran this exact shape in 64 minutes.

## Decisions

- **D1 — the two sources are layered, not swapped.** `epic_status` stays the
  authority for anything in flight: it is the only thing that knows attempt
  number, persona, and the four stops between `ready` and `merged`. The corpus
  read supplies `merged` for stories the live answer does not carry, and never
  overwrites a live stop. Concretely, in `assemble_showfloor`: resolve the live
  answer first, then fill.
- **D2 — landing facts ride an ergane seam.** Constitution II. `ergane spec
  landed` is a CLI verb and the pane may not shell it (that ban is explicit).
  The library surface underneath it is what to import; find it and import it,
  and if there is no exported surface, that is a finding to report, not a
  licence to write git plumbing here.
- **D3 — the landing branch comes from configuration.** D-011 makes it `dev`
  today. A hard-coded `"dev"` is a defect; it is a setting.
- **D4 — the fourth law lives beside the other three**, in the same sweep, over
  the same routes, widths and themes. It is not a new suite. It reads computed
  `backgroundColor`, skips fully transparent values, and compares against text
  leaves measured with a `Range` — the same measurement the other laws use.
- **D5 — the mutation control asserts both directions.** It plants the
  violation, asserts law four goes red, **and** asserts laws one through three
  stay green. The second half is the point: it is the committed evidence for
  why a fourth law exists at all.

## Named traps

- **The ladder's first stop is not a null value.** The whole defect is that
  `ready` was used as a default. Do not introduce a second default anywhere in
  the fill path — a story that cannot be placed takes the Unknown Rule, and the
  read goes in the entry's degraded notes. Rendering `ready` for "I do not
  know" is the bug being fixed, and it would be easy to reintroduce one layer
  down.
- **An attestation is a claim; a landing is a fact.** Where frontmatter says
  `landed` and the branch does not carry the stories, the branch wins and the
  disagreement is named. Do not let the frontmatter short-circuit the read —
  that would reproduce the same class of defect in the opposite direction.
- **The corpus tests must not pin the live corpus.** 008/US1 landed
  `tests/test_no_test_pins_live_corpus.py` precisely because two operator
  changes went red against tests asserting a named spec's transient state. Any
  new test here constructs its own corpus through the reader seams
  (`tests/corpus.py` is the helper, and it is exempt from the guard). A test
  that asserts `states["006-..."] == "landed"` will pass today and go red the
  moment someone edits that spec.
- **`test_operational_error_becomes_transport` fails only with a real runtime
  root.** It passes in the gate's bwrap sandbox — `--clearenv`, tmpfs `HOME`,
  no `ERGANE_ROOT` — and fails on the operator's loaded shell, because
  `LiveReader.list_findings()` then opens a real `doctor.db` and succeeds where
  the test expects `TransportFailed`. Fixing it means constructing the failure
  (an unwritable path, a corrupt file, a monkeypatched connect), not asserting
  the absence of the operator's machine. This is the same sandbox/runner
  divergence class that has produced escalation loops before: the gate is green
  and the operator is red, and retrying changes neither.
- **`PLAYWRIGHT_BROWSERS_PATH=0` is read from the environment on every
  invocation** (D-013, CLAUDE.md). It is already set on both the install and
  the test run; do not remove it from either half.

## Gates

`uv run pytest -q` · `npm --prefix web run typecheck` · `test:unit` ·
`test:smoke`. All four must pass, and SC-003 additionally requires pytest to
agree with `ERGANE_ROOT` set and unset.
