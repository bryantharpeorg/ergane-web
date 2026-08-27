---
state: ready
depends_on_landed: []
# FLIPPED `ready` 2026-08-26, 8:10 PM CT, by the operator, after reading the
# compiled graph. The flip IS the constitution VII approval for the three
# dependencies named below and nothing else: `pytest-cov`, `@vitest/coverage-v8`,
# `pip-audit`. The floor was empty when it dispatched -- 42 of 45 stories landed,
# every finished spec attested, 011 and 016 both closed out the same evening.
#
# THE OPERATOR WAS SHOWN THE GRAPH FIRST AND ASKED FOR IT DELIBERATELY. Depth 3,
# fully serial on merge edges, no parallelism available: US1 -> US2 -> US3, one
# dependency per story, and US3 is the one that edits `ergane.yaml` and
# `.github/workflows/ergane-gates.yml`. That last fact is a named risk, not a
# surprise: PRs #84 and #85 both edited the workflow file on 2026-08-26 and
# NEITHER received PR checks -- the operator had to submit both to the merge queue
# by hand. If US3's PR sits with no checks, that is the same symptom and it needs
# the operator, not a retry.
# THIS SPEC REVERSES A DECISION THIS REPOSITORY ALREADY RECORDED, DELIBERATELY AND
# ON THE OPERATOR'S INSTRUCTION. On 2026-08-25 at 6:30 PM CT the operator was asked
# whether this repository should add coverage and security gates so the pane would
# have something to render, and said no: "it's more of we need a way to visualize
# all of the CI steps, SBOM is another. this is something that you should show but
# we should provide feedback to ergane to support at the platform level." That is
# recorded as N54 in the feedback log and it is why PR-3 exists.
#
# At ~10:35 PM CT the same night the operator was asked again, with N54 quoted back
# verbatim, and chose to build it here anyway. Both facts are true and the second
# one governs.
#
# The reversal is narrower than it looks, and the spec is written to keep it that
# way. N54's argument was never "coverage is worthless"; it was that a per-repo
# artifact with a per-repo path and a per-repo format has no reader, so every
# target repo invents a different one. That argument still stands. So this spec
# makes the gates *measure*, and makes each artifact land at a declared path in a
# standard format -- so that when PR-3 ships a typed collector, this repository is
# already emitting exactly what it will collect, and nothing here has to be
# rewritten. What this spec must NOT do is invent a pane-side reader for these
# files: that is the fragmentation N54 refused, it is still refused, and it is in
# Out of scope below.
#
# NEW DEPENDENCIES REQUIRE OPERATOR APPROVAL (constitution VII). This spec names
# three: `pytest-cov`, `@vitest/coverage-v8`, and `pip-audit`. Approving this spec
# is approving those three and nothing else.
#
# TWO ENFORCEMENT QUESTIONS DECIDED BY THE OPERATOR, 2026-08-25 ~11:20 PM CT,
# recorded as D-024 and reflected in Assumptions and Out of scope:
#
#   1. `audit` lives in `ergane.yaml` (so the boundary gate runs it and no node
#      lands without it) but NOT in the `dev`/`main` rulesets. That deliberately
#      breaks half of `CLAUDE.md` § Landing discipline's rule -- "`dev` requires
#      exactly those checks" -- and CLAUDE.md is amended to say so rather than
#      quietly disagreeing with the repository.
#
#   2. No allowlist. A finding above the threshold stops the line even with no
#      fix available. The threshold is the only dial, and US3 must not grow an
#      ignore file.
---

# Feature Specification: The gates measure themselves

**Feature Branch**: `015-the-gates-measure-themselves`
**Created**: 2026-08-25 · **Status**: Refined
**Input**: operator instruction, 2026-08-25 ~10:35 PM CT, overriding N54

## Context

`ergane.yaml` declares four gates — `test`, `typecheck`, `unit`, `smoke` — and
**not one of them emits an attestation artifact**. Grepped 2026-08-25 across the
manifest, `.github/workflows/ergane-gates.yml`, `pyproject.toml` and
`web/package.json`: zero hits for `--cov`, `pip-audit`, `npm audit`, coverage or
SBOM. The four gates prove that the code runs; nothing proves how much of it the
tests reach, and nothing inventories what it depends on.

That is a real gap in a repository whose whole subject is showing what a build
can prove about itself. Spec 007's own body names it: *"a page cannot show a
number nothing measures."*

**What the platform will eventually do, and what this spec must not duplicate.**
PR-3 asks ergane for a declared artifact set beside `gates:` in the manifest, each
entry naming a path and a **type** the platform understands, collected at the gate
boundary and exposed through an exported reader. When that lands, a repository
whose gates already write `coverage.xml` at a stable path gets collection for free.
A repository that invented its own format gets a rewrite. So this spec's job is to
**emit the standard thing at a stable path** and stop there.

## User Scenarios & Testing

### User Story 1 - The backend gate measures its own reach (Priority: P1)

As an operator, the backend gate reports how much of `pane/` its tests execute,
and refuses a change that drops it.

**Why this priority**: it is the largest untested surface claim in the repository
and the one artifact PR-3 is most certain to collect.

**Acceptance Scenarios**:

1. **Given** the backend gate command, **When** it runs, **Then** it writes a
   Cobertura-format `coverage.xml` at the repository root and prints a terminal
   summary (FR-001).
2. **Given** a run whose line coverage over `pane/` is below the declared floor,
   **When** the gate runs, **Then** it exits non-zero and names the measured
   figure and the floor (FR-002).
3. **Given** the floor is set from the measured baseline at the time this story
   lands, **When** the story lands, **Then** the floor is committed in
   `pyproject.toml` rather than passed on a command line, so a reader can see it
   without running anything (FR-003).
4. **Given** the gate runs inside the factory's sandbox with a fresh tmpfs `HOME`
   (D-013), **When** it runs, **Then** it needs nothing from `HOME` and writes
   only inside the worktree (FR-004).

---

### User Story 2 - The frontend gate measures its own reach (Priority: P2)

As an operator, the unit gate reports how much of `web/src` its tests execute, on
the same terms as the backend.

**Why this priority**: symmetry matters more than it sounds — an attestation that
covers half a two-language repository invites the reader to assume it covers both.

**Acceptance Scenarios**:

1. **Given** the unit gate command, **When** it runs, **Then** it writes both a
   machine-readable coverage report and a terminal summary, at a declared path
   under `web/` (FR-005).
2. **Given** coverage over `web/src` below the declared floor, **When** the gate
   runs, **Then** it exits non-zero naming the figure and the floor (FR-006).
3. **Given** the floor, **When** the story lands, **Then** it is committed in
   `web/vitest.config.*` rather than passed on a command line (FR-007).

---

### User Story 3 - A fifth gate inventories what this repository depends on (Priority: P3)

As an operator, a gate named `audit` reports known vulnerabilities in both
dependency worlds, and fails only on the severities worth failing on.

**Why this priority**: it is the half of "attestation" that is not coverage, it is
the one PR-3 calls `scan`, and it is the one that will page someone at 3 AM if it
is tuned wrong.

**Acceptance Scenarios**:

1. **Given** the new gate, **When** it runs, **Then** it audits the `uv` lockfile
   and the `npm` lockfile and writes each result as JSON at a declared path
   (FR-008).
2. **Given** a finding below the declared severity threshold, **When** the gate
   runs, **Then** it exits zero and the finding is still in the JSON — recorded,
   not fatal (FR-009).
3. **Given** the audit cannot reach the network, **When** the gate runs, **Then**
   it fails with a message naming the network as the cause, and never reports
   "no vulnerabilities" from a lookup that did not happen (FR-010).
4. **Given** the gate is added to `ergane.yaml`, **When** the story lands, **Then**
   a job of the same name exists in `.github/workflows/ergane-gates.yml`
   (FR-011).

---

### Edge Cases

- A coverage floor that the story's own diff would fail: the floor is set from the
  measured baseline, so this cannot happen at landing. A later drop is the point.
- `npm audit` reporting a vulnerability in a transitive dev dependency with no
  fix available: recorded in the JSON, below threshold, not fatal. A gate that
  cannot be made green by any action is a gate that will be disabled.
- A coverage tool that writes into `HOME`: it must not. D-013 is why.

## Requirements

### Functional Requirements

- **FR-001**: The backend gate MUST write Cobertura `coverage.xml` at the
  repository root and print a terminal summary.
- **FR-002**: Backend line coverage below the declared floor MUST fail the gate,
  naming the measured figure and the floor.
- **FR-003**: The backend floor MUST be committed in `pyproject.toml`.
- **FR-004**: No gate may require anything from `HOME`, and all artifacts MUST be
  written inside the worktree.
- **FR-005**: The unit gate MUST write a machine-readable coverage report at a
  declared path under `web/` and print a terminal summary.
- **FR-006**: Frontend coverage below the declared floor MUST fail the gate,
  naming the figure and the floor.
- **FR-007**: The frontend floor MUST be committed in the vitest config.
- **FR-008**: An `audit` gate MUST audit both lockfiles and write each result as
  JSON at a declared path.
- **FR-009**: A finding below the declared severity threshold MUST be recorded and
  MUST NOT fail the gate.
- **FR-010**: An audit that cannot reach the network MUST fail naming the network,
  and MUST NOT report an all-clear.
- **FR-011**: Every gate in `ergane.yaml` MUST have a job of the same name in
  `.github/workflows/ergane-gates.yml`.

### Key Entities

- **The artifacts** — `coverage.xml` (Cobertura), the frontend coverage report,
  and the two audit JSON documents. Standard formats at stable paths, so PR-3's
  collector can take them unchanged.
- **The floors** — two numbers, committed, set from the measured baseline.

## Success Criteria

- **SC-001**: Every gate run produces the four artifacts, in the sandbox, with no
  `HOME` dependency.
- **SC-002**: A change that drops coverage below the floor fails before it lands.
- **SC-003**: Nothing in this repository reads these artifacts. They are emitted
  and left for the platform collector PR-3 describes.

## Assumptions

- The boundary has network egress (`CLAUDE.md` § Two package worlds), so an audit
  that fetches an advisory database can run at the gate.
- **The `audit` gate is enforced at the boundary and NOT at the merge queue**
  (D-024, decided 2026-08-25 ~11:20 PM CT). It is in `ergane.yaml`, so every node
  must pass it to land; it is deliberately absent from the `dev` and `main`
  rulesets, so a human can still land a fix by hand when the line is stopped.
  Nothing about this is a node's to change.

## Out of scope

- **Any reader for these artifacts, anywhere in the pane.** This is N54's
  argument and it still stands: a per-repo reader for a per-repo file is the
  fragmentation the platform request exists to prevent. The pane renders these
  when PR-3 gives it a typed collector, and not before.
- **SBOM generation.** PR-3 names `sbom` as a type; producing one is a separate
  decision with its own format question.
- **Raising the floors over time.** The floors land at the measured baseline. A
  ratchet is a policy, and policies belong to the operator.
- **An allowlist, ignore file, or advisory-suppression mechanism.** Decided
  against explicitly (D-024): a finding above the threshold stops the line even
  when no fix is available, and a human decides what happens next. The threshold
  is the only dial. **Do not add one** — an ignore file is the thing that makes an
  audit gate decorative, because the cheapest response to a red gate at 3 AM is to
  add a line to it.

## Work Graph

```yaml
US1:
  depends_on: []
  depends_on_merged: []
  implements: [FR-001, FR-002, FR-003, FR-004]
  timeout: 3600
US2:
  depends_on: []
  depends_on_merged: [US1]
  implements: [FR-005, FR-006, FR-007]
  timeout: 3600
US3:
  depends_on: []
  depends_on_merged: [US2]
  implements: [FR-008, FR-009, FR-010, FR-011]
  timeout: 3600
```
