/**
 * The gate run, drawn as the timeline it already was (013 US2, FR-004…FR-008).
 *
 * Four claims, one per acceptance scenario:
 *
 * * **US2-S1** — every gate carries its name, its outcome, its duration and the
 *   command that ran, and gates the store recorded as concurrent are drawn as
 *   concurrent (FR-004, FR-005). The concurrency half is asserted twice over,
 *   because "drawn from the data" and "drawn from the durations" agree on the
 *   happy case and part company on two constructed ones: the same durations
 *   with different counts must group differently, and wildly different
 *   durations with the same count must group the same (013 D5).
 * * **US2-S2** — a failing gate's tail is there and closed; a passing gate's is
 *   not there at all (FR-006).
 * * **US2-S3** — the sweep is the assembler's (`tests/test_gate_tail_sweep.py`
 *   is where it is proved). What is asserted here is the room's half of the
 *   bargain: it renders the tail the document handed it, once, as *text* — so
 *   raw process output cannot become markup on its way to a page.
 * * **US2-S4** — the section says out loud that its record is the current
 *   dispatch's and does not survive a re-dispatch (FR-008).
 *
 * And the interval is labelled **verification**, never wall clock — asserted in
 * the rendering and again as a sweep over the two source files, because
 * `AttemptTiming`'s own docstring in ergane says the store cannot support the
 * latter and the mistake is one word wide (013 plan, trap 1).
 *
 * The records are built through `support/showfloor-builder.ts`, whose keys are
 * `pane/showfloor.py`'s `_gate`/`_attempt` keys verbatim. Nothing *from the
 * factory* is invented: what a `GateResult` holds is proved against ergane's
 * own writer in `tests/test_evidence_section.py`, and what this file composes
 * is this repository's own join of it (constitution V, and the builder's own
 * standing note).
 */

/// <reference types="vite/client" />
import { afterEach, describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import GateRun, { RETENTION } from "../../src/showfloor/GateRun";
import {
  bandLabel,
  gateBands,
  formatGateDuration,
  verificationSeconds,
} from "../../src/showfloor/gateRun";
import DetailPane from "../../src/showfloor/DetailPane";
import type { GateRecord, StoryEvidence } from "../../src/api/showfloorDocument";
import { attemptOf, evidenceOf, gateOf, ladderOf, storyOf } from "./support/showfloor-builder";

import gateRunRaw from "../../src/showfloor/GateRun.tsx?raw";
import gateRunModuleRaw from "../../src/showfloor/gateRun.ts?raw";

/**
 * The source with its comments removed — `noVerb.test.ts`'s helper, verbatim
 * and for its reason: "this room's files argue with themselves in prose", and
 * a sweep that cannot tell what a file *does* from what it *says about what it
 * does* would force those explanations out of the code to stay green. Both
 * files below explain at length why the interval is a verification and why the
 * tail is not swept here; what is swept is what ships.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const gateRunSource = code(gateRunRaw);
const gateRunModuleSource = code(gateRunModuleRaw);

/* ── the records ───────────────────────────────────────────────────────── */

/** The tail a failing gate printed, with the shape of real gate output. */
const TAIL = "npm ERR! Exit status 1\n  tests/unit/Rail.test.tsx > the rail is the corpus";

/**
 * Attempt 1: two gates ran together, one of them failed, one ran alone and
 * timed out. The shape `tests/test_evidence_section.py` writes through ergane's
 * own writer, so the two suites are looking at one gate run.
 */
const FAILED = attemptOf({
  attempt: 1,
  verdict: "FAIL",
  started_at: "2026-08-25T18:00:00Z",
  finished_at: "2026-08-25T18:10:15Z",
  loop_summary: "gates(test,typecheck) → diff_check → judge · attempts 3 · debugger 1",
  gates: [
    gateOf({ name: "test", status: "PASS", exit_code: 0, duration_s: 12.5, concurrent_gates: 1 }),
    gateOf({
      name: "typecheck",
      status: "FAIL",
      exit_code: 2,
      duration_s: 3.25,
      concurrent_gates: 1,
      output_tail: TAIL,
    }),
    gateOf({
      name: "smoke",
      status: "TIMEOUT",
      exit_code: null,
      duration_s: 600,
      concurrent_gates: 0,
      output_tail: "Timeout of 600000ms exceeded.",
    }),
  ],
});

/** Attempt 2: every gate green, all three in flight together. */
const PASSED = attemptOf({
  attempt: 2,
  verdict: "PASS",
  started_at: "2026-08-25T18:30:00Z",
  finished_at: "2026-08-25T18:31:02Z",
  gates: [
    gateOf({ name: "test", duration_s: 11, concurrent_gates: 2 }),
    gateOf({ name: "typecheck", duration_s: 4, concurrent_gates: 2 }),
    gateOf({ name: "smoke", duration_s: 41.5, concurrent_gates: 2 }),
  ],
});

/* ── the harness ───────────────────────────────────────────────────────── */

const containers: HTMLElement[] = [];

function render(node: JSX.Element): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  act(() => {
    createRoot(container).render(node);
  });
  return container;
}

afterEach(() => {
  for (const container of containers.splice(0)) container.remove();
});

function section(evidence: StoryEvidence): HTMLElement {
  return render(<GateRun evidence={evidence} />);
}

/** Every gate row as the DOM shows it: `[name, outcome, duration, command]`. */
function rows(container: HTMLElement): Array<[string, string, string, string]> {
  return Array.from(container.querySelectorAll("[data-gate]")).map((li) => [
    (li.querySelector("[data-gate-name]")?.textContent ?? "").trim(),
    (li.querySelector("[data-gate-outcome]")?.textContent ?? "").trim(),
    (li.querySelector("[data-gate-duration]")?.textContent ?? "").trim(),
    (li.querySelector("[data-gate-command]")?.textContent ?? "").trim(),
  ]);
}

/** Each band as `[kind, the names it holds]` — the drawn shape of the run. */
function bands(container: HTMLElement): Array<[string, string[]]> {
  return Array.from(container.querySelectorAll("[data-gate-band]")).map((band) => [
    band.getAttribute("data-gate-band") ?? "",
    Array.from(band.querySelectorAll("[data-gate]")).map(
      (gate) => gate.getAttribute("data-gate") ?? "",
    ),
  ]);
}

/* ── US2-S1: name, outcome, duration, command (FR-004) ─────────────────── */

describe("every gate says what it was, how it ended, how long, and what ran", () => {
  it("draws the four facts FR-004 names, per gate, in the recorded order", () => {
    const container = section(evidenceOf([FAILED]));

    expect(rows(container)).toEqual([
      ["test", "PASS", "12.5s", "uv run test -q"],
      // The exit code rides the outcome: it is the same fact, and a column of
      // its own would be a column that is empty for every gate that timed out.
      ["typecheck", "FAIL · exit 2", "3.3s", "uv run typecheck -q"],
      // A gate that hit its deadline has no exit to read, so the outcome is
      // the status alone — never `exit 0` standing in for one.
      ["smoke", "TIMEOUT", "10m", "uv run smoke -q"],
    ]);
  });

  it("says the word for every outcome, so no state is carried by colour alone", () => {
    // DESIGN.md § Named Rules. The tone is a class; the outcome is text.
    const container = section(evidenceOf([FAILED]));
    const tones = Array.from(container.querySelectorAll("[data-gate]")).map((gate) =>
      gate.getAttribute("data-gate-status"),
    );
    expect(tones).toEqual(["PASS", "FAIL", "TIMEOUT"]);
    for (const [, outcome] of rows(container)) expect(outcome).not.toBe("");
  });

  it("names an unrecorded fact rather than defaulting it to a number", () => {
    // § The Unknown Rule: never a `0`, never an empty cell.
    const bare: GateRecord = {
      name: null,
      command: null,
      status: null,
      exit_code: null,
      duration_s: null,
      concurrent_gates: null,
      output_tail: null,
    };
    const container = section(evidenceOf([attemptOf({ attempt: 1, gates: [bare] })]));
    const [row] = rows(container);

    for (const cell of row) expect(cell).toBe("unknown");
    expect(container.querySelectorAll("[data-gate] .unknown").length).toBe(4);
  });

  it("labels the interval verification, and never wall clock (plan trap 1)", () => {
    const container = section(evidenceOf([FAILED]));
    const interval = container.querySelector("[data-attempt-verification]");

    expect(interval?.textContent).toContain("verification");
    expect(interval?.textContent).toContain("10m");
    // The two instants stay available, in the factory's own UTC.
    expect(interval?.getAttribute("title")).toBe(
      "2026-08-25T18:00:00Z → 2026-08-25T18:10:15Z",
    );
    expect(container.textContent?.toLowerCase()).not.toContain("wall clock");
  });

  it("keeps the words wall clock out of the source that draws the section", () => {
    // `AttemptTiming` brackets one verification, not one story: the
    // dispatch-to-verification-start interval and the merge-queue time are not
    // in that table at all. The mistake this guards is one word wide, so it is
    // swept for rather than reviewed for.
    for (const source of [gateRunSource, gateRunModuleSource]) {
      expect(source.toLowerCase()).not.toContain("wall clock");
      expect(source.toLowerCase()).not.toContain("wallclock");
    }
  });

  it("says nothing about an interval the store did not bracket", () => {
    const container = section(evidenceOf([attemptOf({ attempt: 1, gates: [] })]));
    const interval = container.querySelector("[data-attempt-verification]");
    expect(interval?.textContent).toBe("verification unknown");
  });
});

/* ── US2-S1: concurrency is data, not layout taste (FR-005, D5) ────────── */

describe("gates recorded as concurrent are drawn as concurrent", () => {
  it("bands the two that ran together and leaves the one that ran alone", () => {
    expect(bands(section(evidenceOf([FAILED])))).toEqual([
      ["concurrent", ["test", "typecheck"]],
      ["serial", ["smoke"]],
    ]);
  });

  it("draws a whole attempt that ran in parallel as one band", () => {
    expect(bands(section(evidenceOf([PASSED])))).toEqual([
      ["concurrent", ["test", "typecheck", "smoke"]],
    ]);
  });

  it("labels a band in words, so the shape is never only a shape", () => {
    const container = section(evidenceOf([FAILED]));
    const head = container.querySelector('[data-gate-band="concurrent"] [data-band-head]');
    expect(head?.textContent).toBe("2 gates ran together");
    // The one that had the host to itself claims nothing.
    expect(
      container.querySelector('[data-gate-band="serial"] [data-band-head]'),
    ).toBeNull();
  });

  it("reads the count and not the clock — same durations, different counts", () => {
    // The control D5 exists for. Two gates of identical duration group or do
    // not group purely on what the store recorded about contention.
    const together = gateBands([
      gateOf({ name: "a", duration_s: 10, concurrent_gates: 1 }),
      gateOf({ name: "b", duration_s: 10, concurrent_gates: 1 }),
    ]);
    const apart = gateBands([
      gateOf({ name: "a", duration_s: 10, concurrent_gates: 0 }),
      gateOf({ name: "b", duration_s: 10, concurrent_gates: 0 }),
    ]);

    expect(together.map((band) => band.gates.length)).toEqual([2]);
    expect(apart.map((band) => band.gates.length)).toEqual([1, 1]);
  });

  it("reads the count and not the clock — same counts, different durations", () => {
    const wildlyApart = gateBands([
      gateOf({ name: "a", duration_s: 0.4, concurrent_gates: 1 }),
      gateOf({ name: "b", duration_s: 900, concurrent_gates: 1 }),
    ]);
    expect(wildlyApart.map((band) => band.gates.length)).toEqual([2]);
    expect(wildlyApart[0].concurrent).toBe(true);
  });

  it("closes a band at the width the count claims, never wider", () => {
    // Two pairs that ran one after the other each record `1`. Grouping on the
    // count alone would draw one band of four and overstate the parallelism the
    // host actually had.
    const pairs = gateBands(
      ["a", "b", "c", "d"].map((name) => gateOf({ name, concurrent_gates: 1 })),
    );
    expect(pairs.map((band) => band.gates.map((gate) => gate.name))).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("says so in words when the store recorded peers this attempt does not hold", () => {
    // One row claiming three neighbours is the store's word, not this room's to
    // correct: the band says what was recorded rather than what it can draw.
    const [band] = gateBands([gateOf({ name: "test", concurrent_gates: 3 })]);
    expect(band.concurrent).toBe(true);
    expect(bandLabel(band)).toBe("ran beside 3 other gates");
  });

  it("treats an unrecorded count as no claim at all", () => {
    const [band] = gateBands([gateOf({ name: "test", concurrent_gates: null })]);
    expect(band.concurrent).toBe(false);
    expect(bandLabel(band)).toBeNull();
  });
});

/* ── US2-S2: the tail is failure-only and collapsed (FR-006) ───────────── */

describe("a failing gate's output tail", () => {
  it("is there, and it is closed", () => {
    const container = section(evidenceOf([FAILED]));
    const fold = container.querySelector<HTMLDetailsElement>('[data-gate="typecheck"] details');

    expect(fold).not.toBeNull();
    expect(fold?.open).toBe(false);
    expect(fold?.querySelector("summary")?.textContent).toBe("output tail");
    expect(fold?.querySelector("[data-gate-tail]")?.textContent).toBe(TAIL);
  });

  it("is not rendered at all for a gate that passed", () => {
    const container = section(evidenceOf([PASSED]));

    expect(container.querySelectorAll("[data-gate]").length).toBe(3);
    expect(container.querySelectorAll("details").length).toBe(0);
    expect(container.querySelectorAll("[data-gate-tail]").length).toBe(0);
  });

  it("draws one fold per failing gate and none for the passing one beside it", () => {
    const container = section(evidenceOf([FAILED]));
    const withTail = Array.from(container.querySelectorAll("[data-gate]"))
      .filter((gate) => gate.querySelector("details") !== null)
      .map((gate) => gate.getAttribute("data-gate"));

    expect(withTail).toEqual(["typecheck", "smoke"]);
  });

  it("renders no fold for a failing gate the store recorded no output for", () => {
    // § Don'ts: never render an element that can never fill. The assembler
    // already answers `null` for a silent command; the room must not draw a
    // disclosure over it.
    const silent = evidenceOf([
      attemptOf({
        attempt: 1,
        gates: [gateOf({ name: "test", status: "FAIL", output_tail: null })],
      }),
    ]);
    expect(section(silent).querySelectorAll("details").length).toBe(0);
  });
});

/* ── US2-S3: the room renders the tail, it does not re-interpret it ────── */

describe("a rendered tail is text and nothing else", () => {
  it("puts raw process output on the page as text, never as markup", () => {
    // The sweep is the assembler's (`tests/test_gate_tail_sweep.py`). This is
    // the room's half: a tail is output nobody here wrote, so it reaches the
    // page as the content of one element and cannot become one.
    const hostile = "<script>alert(1)</script>\n<img src=x onerror=1>";
    const container = section(
      evidenceOf([
        attemptOf({
          attempt: 1,
          gates: [gateOf({ name: "test", status: "FAIL", output_tail: hostile })],
        }),
      ]),
    );
    const tail = container.querySelector("[data-gate-tail]");

    expect(tail?.textContent).toBe(hostile);
    expect(container.querySelectorAll("script, img").length).toBe(0);
  });

  it("renders it once, in the fold, and nowhere else on the page", () => {
    const container = section(evidenceOf([FAILED]));
    const occurrences = (container.innerHTML.match(/npm ERR!/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it("never sweeps, redacts or truncates in the browser", () => {
    // The tail arrives swept (013 D4). A second, weaker definition here would
    // be a surface deciding for itself what a credential looks like — and the
    // one in `pane/sweep.py` is the one every other surface passes.
    for (const word of ["redact", "sweep", "slice(0,", "substring("]) {
      expect(gateRunSource.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });
});

/* ── US2-S4: the section names its own limit (FR-008) ──────────────────── */

describe("the section says what its record is worth", () => {
  it("names that this is the current dispatch's record", () => {
    const container = section(evidenceOf([FAILED]));
    const said = container.querySelector("[data-gate-run-retention]")?.textContent ?? "";

    expect(said).toBe(RETENTION);
    expect(said.toLowerCase()).toContain("current");
    expect(said.toLowerCase()).toContain("re-dispatch");
  });

  it("says it once, above the attempts, however many there are", () => {
    const container = section(evidenceOf([FAILED, PASSED]));
    expect(container.querySelectorAll("[data-gate-run-retention]").length).toBe(1);
    expect(container.querySelectorAll("[data-gate-attempt]").length).toBe(2);
  });

  it("does not call itself CI, because the forge ran its own checks", () => {
    // The store holds the boundary gate ergane ran in its own sandbox; the
    // forge's checks are a different record and the two can disagree — that
    // divergence rejected a landing in this very epic (013 plan, trap 2).
    const container = section(evidenceOf([FAILED]));
    expect(container.querySelector("[data-gate-run-head]")?.textContent).toBe("gate run");
    expect(container.textContent).not.toMatch(/\bCI\b/);
  });
});

/* ── the section's own presence, and its own degradation ───────────────── */

describe("the section is there when there is something to say", () => {
  it("renders nothing at all for a story with no recorded attempt", () => {
    expect(section(evidenceOf([])).querySelector("[data-gate-run]")).toBeNull();
  });

  it("renders the read that failed, in the section, in the room's own triple", () => {
    const container = section(
      evidenceOf([], {
        read: "node_history",
        mode: "transport",
        detail: "/nowhere/verification.db: unable to open database file",
      }),
    );
    const well = container.querySelector("[data-gate-run-note]");

    expect(well?.getAttribute("data-mode")).toBe("transport");
    expect(well?.textContent).toContain("node_history");
    expect(well?.textContent).toContain("unable to open database file");
    // A store the pane cannot open costs the operator the gate run and nothing
    // else: there is no attempt to draw, so none is drawn.
    expect(container.querySelectorAll("[data-gate-attempt]").length).toBe(0);
  });

  it("tells a refusal apart from a transport failure (constitution III)", () => {
    const container = section(
      evidenceOf([], {
        read: "node_history",
        mode: "refusal",
        detail: "no such column: concurrent_gates",
      }),
    );
    expect(container.querySelector("[data-gate-run-note]")?.getAttribute("data-mode")).toBe(
      "refusal",
    );
  });
});

/* ── where it mounts ───────────────────────────────────────────────────── */

describe("the detail pane carries it", () => {
  it("mounts the section inside the pane, for the selected story", () => {
    const story = storyOf("us1", "The evidence reaches the pane", ladderOf({ done: true }));
    const container = render(
      <DetailPane story={{ ...story, evidence: evidenceOf([FAILED]) }} />,
    );

    expect(container.querySelector("[data-detail] [data-gate-run]")).not.toBeNull();
    expect(container.querySelectorAll("[data-gate]").length).toBe(3);
  });

  it("leaves the pane exactly as it was for a story with no gate run", () => {
    const story = storyOf("us1", "The evidence reaches the pane", ladderOf({ done: true }));
    const container = render(<DetailPane story={story} />);

    expect(container.querySelector("[data-gate-run]")).toBeNull();
    // The pane's own furniture is untouched by a section that did not render.
    expect(container.querySelector("[data-detail-title]")).not.toBeNull();
    expect(container.querySelector("[data-detail-facts]")).not.toBeNull();
  });
});

/* ── the two pure readings ─────────────────────────────────────────────── */

describe("the durations and the interval", () => {
  it("keeps a gate's recorded precision under a minute, and the room's above", () => {
    // A gate that ran for four tenths of a second really did run: rounding it
    // to `0s` would report an absence the store did not record. Above a minute
    // the stage's own `formatDuration` is the room's word for a duration.
    expect(formatGateDuration(0.4)).toBe("0.4s");
    expect(formatGateDuration(12.5)).toBe("12.5s");
    expect(formatGateDuration(59.94)).toBe("59.9s");
    expect(formatGateDuration(600)).toBe("10m");
    expect(formatGateDuration(4830)).toBe("1h 21m");
    expect(formatGateDuration(null)).toBeNull();
  });

  it("brackets a verification only when the store bracketed one", () => {
    expect(verificationSeconds("2026-08-25T18:00:00Z", "2026-08-25T18:10:15Z")).toBe(615);
    expect(verificationSeconds(null, "2026-08-25T18:10:15Z")).toBeNull();
    expect(verificationSeconds("2026-08-25T18:00:00Z", null)).toBeNull();
    expect(verificationSeconds("not an instant", "2026-08-25T18:10:15Z")).toBeNull();
    // A finish before its start is not an interval; the pane says nothing
    // rather than a negative duration or an absolute one.
    expect(verificationSeconds("2026-08-25T18:10:15Z", "2026-08-25T18:00:00Z")).toBeNull();
  });
});
