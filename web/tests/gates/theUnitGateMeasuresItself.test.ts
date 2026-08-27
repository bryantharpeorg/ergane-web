// @vitest-environment node
/**
 * The `unit` gate measures its own reach, and the frontend floor bites (015 US2).
 *
 * US1 made the backend gate say how much of `pane/` its tests execute. This is
 * the other half of the same promise: an attestation that covers one language
 * of a two-language repository invites the reader to assume it covers both.
 *
 * **What this file may assert, and what it may not.** Constitution IV: the
 * judge reads the diff, not the tree and not the gate results, so a scenario
 * asserts what the diff *commits* rather than what a command *would do*.
 * Everything above `describe("the floor bites")` is therefore about wiring --
 * the gate command, the npm script it reaches through, the declared report
 * path, the committed floor -- and each assertion names the file it reads,
 * because a file absent from the changed-file list reads to the judge as absent
 * from the repository.
 *
 * `describe("the floor bites")` is the exception, and T011 asks for it by name:
 * a green run is evidence, not proof. This repository's own frontend coverage
 * sits above its own floor, so the gate going green here says only that today's
 * number is above today's number. What has to be proved is that the mechanism
 * has teeth -- so the tests below build a throwaway project **out of the
 * coverage block this diff commits to `web/vitest.config.ts`**, run the real
 * runner over it twice, and require the below-floor run to exit non-zero naming
 * both figures. Delete `thresholds`, rename `reportsDirectory`, drop
 * `json-summary`, and these stop proving anything -- which is the coupling that
 * keeps the proof honest rather than a lookalike of the mechanism.
 *
 * **And it runs with a `HOME` of its own, empty, checked empty afterwards**
 * (D-013). A gate does not inherit the attempt's `HOME`; it gets a fresh tmpfs
 * one. A coverage provider that cached into `HOME` would work in the attempt
 * and fail at the boundary, which is the Playwright-browser class of bug that
 * already cost this repository a rework cycle. `@vitest/coverage-v8` is an
 * ordinary dev dependency, so it lands in `web/node_modules` -- inside the
 * worktree -- and the child below is given a scrubbed environment to prove it
 * needs nothing else.
 *
 * **Why this file is not under `tests/unit/`.** It is Node-side harness code:
 * it reads files off disk and spawns a child runner, and `@types/node` is not
 * on the approved roster (constitution VII). Like `vite.config.ts` and
 * `playwright.config.ts` it stays outside `tsconfig.json`'s `include` (001 plan
 * R-009) and is transpiled by its own runner. `vitest.config.ts` adds
 * `tests/gates/**` to the unit run, so the gate still executes it.
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, isAbsolute } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import committedConfig from "../../vitest.config";

const run = promisify(execFile);

const WEB = fileURLToPath(new URL("../..", import.meta.url));
const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

/** The coverage block this diff commits, read rather than copied. */
const coverage = (committedConfig as any).test.coverage;

async function read(path: string): Promise<string> {
  return readFile(join(ROOT, path), "utf-8");
}

/** The `unit` gate, off `ergane.yaml`. Regex, because no YAML parser is on the
 * approved Node roster and one gate line does not justify asking for one. */
async function unitGateCommand(): Promise<string> {
  const manifest = await read("ergane.yaml");
  const declared = /^ {2}unit: *"(.+)"$/m.exec(manifest);
  expect(declared, `ergane.yaml declares no unit gate:\n${manifest}`).not.toBeNull();
  return declared![1];
}

async function npmScripts(): Promise<Record<string, string>> {
  return JSON.parse(await read("web/package.json")).scripts;
}

// --- FR-005: the gate writes the report and prints the summary --------------

describe("the unit gate measures web/src", () => {
  it("reaches the unit suite through the npm script, and that script asks for coverage", async () => {
    // US2-S1, read off `ergane.yaml` and `web/package.json`, both in this diff.
    //
    // The flag lives in the script rather than on the gate command, and that is
    // the decision worth stating: `npm --prefix web run test:unit` is what the
    // manifest declares, what the workflow runs, and what `README.md` tells an
    // operator to type. Passing `--coverage` in the manifest instead would have
    // made the gate measure something the documented local command does not,
    // and this repository has already paid for one sandbox/runner divergence.
    expect(await unitGateCommand()).toBe("npm --prefix web run test:unit");

    const script = (await npmScripts())["test:unit"];
    expect(script.startsWith("vitest run"), script).toBe(true);
    expect(script, `the unit gate measures nothing: ${script}`).toContain("--coverage");
  });

  it("measures over web/src, every file, whether or not a test imports it", async () => {
    // FR-005: "how much of `web/src` its tests execute". `coverage.all` defaults
    // to true, so a room nobody tests reads as zero rather than as absent --
    // which is the number worth knowing and the one a floor can hold.
    expect(coverage.provider).toBe("v8");
    expect(coverage.include).toContain("src/**/*.{ts,tsx}");
    expect(coverage.all).not.toBe(false);
  });

  it("declares both reports FR-005 asks for", async () => {
    // The machine-readable one for the collector PR-3 describes, and the
    // terminal one for the human reading a failed gate's tail. Two reports, not
    // one: 013 made that tail visible in the Showfloor, so a number printed
    // there is a number an operator sees without leaving the room.
    expect(coverage.reporter, "no machine-readable report").toContain("json-summary");
    expect(coverage.reporter, "no terminal summary").toContain("text");
  });

  it("declares a stable path under web/, relative to the directory the gate runs in", async () => {
    // The same file is read from a runner, a sandbox and an operator's
    // checkout; an absolute path names a directory that exists on exactly one
    // of them. Relative, so it resolves against `web/` and nowhere else -- and
    // inside the worktree, which is all that survives into the gate (D-013).
    expect(isAbsolute(coverage.reportsDirectory), coverage.reportsDirectory).toBe(false);
    expect(coverage.reportsDirectory.startsWith(".."), coverage.reportsDirectory).toBe(false);
    expect(coverage.reportsDirectory).toBe("coverage");

    // And it is a build product, not a committed fact: a committed report would
    // be whatever the last person to run the suite happened to have.
    expect(await read(".gitignore")).toContain(`web/${coverage.reportsDirectory}/`);
  });
});

// --- FR-007: the floor is committed, not passed -----------------------------

describe("the frontend floor", () => {
  it("is committed in web/vitest.config.ts", async () => {
    // US2-S3, FR-007 (plan D1): a reader sees the number without running
    // anything, and a change to this repository's coverage policy shows up in a
    // diff as what it is rather than as a change to a quoted command.
    const floor = coverage.thresholds.lines;
    expect(typeof floor).toBe("number");
    expect(floor).toBeGreaterThan(0);
    expect(floor).toBeLessThanOrEqual(100);

    // Read out of the committed source too, so the number is legible in the
    // file and not only in the object the runner builds from it.
    expect(await read("web/vitest.config.ts")).toContain(`lines: ${floor}`);
  });

  it("is passed on no command line", async () => {
    // FR-007, the other half: committed *rather than* passed. Vitest will take
    // this floor from the CLI (`--coverage.thresholds.lines=NN`), which would
    // hide the number inside a manifest string or an npm script.
    const manifest = await read("ergane.yaml");
    const workflow = await read(".github/workflows/ergane-gates.yml");
    const scripts = Object.values(await npmScripts()).join("\n");

    for (const [name, text] of [
      ["ergane.yaml", manifest],
      ["the gates workflow", workflow],
      ["web/package.json's scripts", scripts],
    ] as const) {
      expect(text, `${name} passes the floor on a command line`).not.toContain(
        "coverage.thresholds",
      );
      expect(text, `${name} passes the floor on a command line`).not.toContain(
        "--coverage.lines",
      );
    }
  });
});

// --- FR-011: a gate the forge does not run does not exist -------------------

describe("the unit gate and its workflow job", () => {
  it("run the same command, and changed in the same diff", async () => {
    // The manifest is what the factory's boundary runs and the workflow is what
    // the forge runs. They are two files, and the failure this asserts against
    // is editing one of them: a gate that measures coverage at the boundary and
    // not in CI is a gate that reports two different numbers depending on who
    // asked. `tests/test_the_gates_measure_themselves.py` makes the structural
    // half of this claim over every declared gate.
    const workflow = await read(".github/workflows/ergane-gates.yml");
    expect(workflow).toContain(`run: "${await unitGateCommand()}"`);
  });
});

// --- US2-S2: the floor bites ------------------------------------------------

/**
 * The synthetic project's floor: above what the below-floor run measures and
 * below what the control run measures, and fractional, so the run also
 * exercises a floor quoted past the integer -- as the committed one is.
 */
const CONTROL_FLOOR = 87.5;

/** What the below-floor run measures, exactly: five of the eight executable
 * lines in `src/widget.ts` -- both signatures and the body of the one function
 * a test calls. */
const CONTROL_DROPPED_LINES = 62.5;

const WIDGET = `export function reached(): string {
  const value = "reached";
  return value;
}

export function dropped(): string {
  const value = "dropped";
  return value;
}
`;

const BOTH_TESTS = `import { expect, it } from "vitest";
import { dropped, reached } from "../src/widget";

it("reaches", () => {
  expect(reached()).toBe("reached");
});

it("drops", () => {
  expect(dropped()).toBe("dropped");
});
`;

const ONE_TEST = `import { expect, it } from "vitest";
import { reached } from "../src/widget";

it("reaches", () => {
  expect(reached()).toBe("reached");
});
`;

let scratch = "";

/**
 * A throwaway project wired the way this diff wires the real one.
 *
 * The coverage block is **the object `web/vitest.config.ts` exports**, with the
 * floor moved to one this small project can sit either side of. Everything else
 * -- the provider, what is included, both reporters, the declared directory --
 * is the committed mechanism rather than a copy of it.
 *
 * It lives under the system temporary directory with `web/node_modules`
 * symlinked in, so the runner and its coverage provider resolve exactly as they
 * do for the real gate while nothing is written inside the repository.
 */
async function controlProject(name: string, tests: string): Promise<string> {
  const project = join(scratch, name);
  await mkdir(join(project, "src"), { recursive: true });
  await mkdir(join(project, "tests"), { recursive: true });
  await symlink(join(WEB, "node_modules"), join(project, "node_modules"), "dir");
  await writeFile(join(project, "src", "widget.ts"), WIDGET);
  await writeFile(join(project, "tests", "widget.test.ts"), tests);
  await writeFile(
    join(project, "vitest.config.ts"),
    "import { defineConfig } from \"vitest/config\";\n\n" +
      "export default defineConfig({\n" +
      "  test: {\n" +
      '    environment: "node",\n' +
      '    include: ["tests/**/*.test.ts"],\n' +
      `    coverage: ${JSON.stringify(
        { ...coverage, thresholds: { ...coverage.thresholds, lines: CONTROL_FLOOR } },
        null,
        2,
      )},\n` +
      "  },\n" +
      "});\n",
  );
  return project;
}

/** The committed gate, pointed at the synthetic project: the same runner, the
 * same `--coverage` the `test:unit` script carries, a scrubbed environment and
 * a `HOME` of its own. */
async function runTheGate(project: string, home: string) {
  const script = (await npmScripts())["test:unit"];
  expect(script.startsWith("vitest run"), script).toBe(true);
  const argv = script.split(" ").slice(1);

  try {
    const { stdout, stderr } = await run(
      process.execPath,
      [join(project, "node_modules", "vitest", "vitest.mjs"), ...argv],
      {
        cwd: project,
        env: { PATH: process.env.PATH ?? "", HOME: home },
        maxBuffer: 32 * 1024 * 1024,
      },
    );
    return { code: 0, output: `${stdout}\n${stderr}` };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failure.code ?? 1, output: `${failure.stdout ?? ""}\n${failure.stderr ?? ""}` };
  }
}

/** The two numbers FR-006 requires the failure to name: measured, and floor. */
function namedFigures(output: string): { measured: number; floor: number } {
  const named = /Coverage for lines \(([\d.]+)%\) does not meet global threshold \(([\d.]+)%\)/.exec(
    output,
  );
  expect(named, `the failure named no figures:\n${output}`).not.toBeNull();
  return { measured: Number(named![1]), floor: Number(named![2]) };
}

describe("the floor bites", () => {
  beforeAll(async () => {
    scratch = await mkdtemp(join(tmpdir(), "ergane-unit-gate-"));
    await mkdir(join(scratch, "home"));
  });

  afterAll(async () => {
    if (scratch) await rm(scratch, { recursive: true, force: true });
  });

  it(
    "passes the control run and writes both reports at the declared path",
    async () => {
      // The control half of US2-S2, and US2-S1 observed rather than read.
      // Without it the failing run below proves only that *something* went
      // wrong. With it, the one difference between a green gate and a red one
      // is the line coverage of the source -- and the green run is where the
      // machine-readable report and the terminal summary are seen to arrive, at
      // the declared relative path, inside the directory the gate ran in.
      const home = join(scratch, "home");
      const project = await controlProject("control", BOTH_TESTS);

      const { code, output } = await runTheGate(project, home);
      expect(code, output).toBe(0);

      // FR-005, both halves. The machine-readable report, at the declared path.
      const summary = JSON.parse(
        await readFile(join(project, coverage.reportsDirectory, "coverage-summary.json"), "utf-8"),
      );
      expect(summary.total.lines.pct).toBe(100);
      // And the summary, on the terminal, where a failed gate's tail shows it.
      expect(output).toContain("% Coverage report from v8");
      expect(output).toContain("% Lines");

      // D-013: nothing from `HOME`, nothing into it.
      expect(await readdir(home)).toEqual([]);
    },
    300_000,
  );

  it(
    "exits non-zero below the floor, naming the figure and the floor",
    async () => {
      // US2-S2, FR-006 (T011). The same project as the control, the same
      // command, the same committed mechanism -- one test removed. A gate that
      // reported the drop and exited zero would record coverage rather than
      // refuse a change that drops it, and those are not the same promise.
      const home = join(scratch, "home");
      const project = await controlProject("dropped", ONE_TEST);

      const { code, output } = await runTheGate(project, home);
      expect(
        code,
        `coverage fell to ${CONTROL_DROPPED_LINES}% under a floor of ${CONTROL_FLOOR}% and the gate passed:\n${output}`,
      ).not.toBe(0);

      const { measured, floor } = namedFigures(output);
      expect(floor).toBe(CONTROL_FLOOR);
      expect(measured).toBe(CONTROL_DROPPED_LINES);
      expect(measured).toBeLessThan(floor);

      // The unit run itself passed; it is the floor that failed the gate, which
      // is what makes the message worth reading.
      expect(output).toContain("1 passed");

      // Still nothing from `HOME` on the failing path either (D-013).
      expect(await readdir(home)).toEqual([]);
    },
    300_000,
  );
});
