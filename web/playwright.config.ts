import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

/**
 * Spec 003 US4 (T059): the smokes now run against a closed gate.
 *
 * The three values are minted per run rather than typed, so no credential is
 * committed anywhere for `tests/test_credential_sweep.py` to find (FR-017), and
 * they are exported to both backends and read back by `use.httpCredentials` from
 * the same constants — one mint, two consumers.
 *
 * `httpCredentials` is the browser's own mechanism, not a test-only shortcut:
 * 001 serves the shell itself through the guarded catch-all, so a navigation must
 * already carry the token, and only the `WWW-Authenticate` challenge
 * `require_viewer` advertises can put it there (plan D-P11). Playwright answering
 * the challenge is exactly what an operator's browser does after being prompted
 * once — the username is ignored by the seam, which compares the password half.
 */
/**
 * Mint once per run, into the environment.
 *
 * Playwright re-evaluates this config file in every worker process, so minting
 * straight into a `const` would hand each worker a different token from the one
 * the `webServer` was started with and every request would be refused. Workers
 * inherit the runner's environment, so the first evaluation mints and the rest
 * read back the same value.
 */
function mint(name: string): string {
  if (!process.env[name]) process.env[name] = randomBytes(16).toString("hex");
  return process.env[name] as string;
}

const PANE_TOKEN = mint("PANE_TOKEN");
const PANE_INTAKE_CREDENTIAL = mint("PANE_INTAKE_CREDENTIAL");
const PANE_ANSWER_IDENTITY = mint("PANE_ANSWER_IDENTITY");

const paneEnv = {
  PANE_DEMO: "1",
  PANE_TOKEN,
  PANE_INTAKE_CREDENTIAL,
  PANE_ANSWER_IDENTITY,
};

export default defineConfig({
  testDir: "tests/smoke",
  reporter: "list",
  /**
   * One retry in CI only, and it is a stopgap with a named cause.
   *
   * Measured 2026-08-26: five `pull_request` smoke runs passed every gate while
   * FOUR OF FIVE `merge_group` runs failed, always on the same assertion --
   * the first `toBeVisible` of the `desk-degraded` project, timing out at 5s.
   * It is not a diff defect. PR #76 failed and then passed on byte-identical
   * content, and PR #77's branch runs the whole suite green locally with that
   * assertion resolving in 1.9s.
   *
   * The cause is above this file. The `smoke` job alone sets `fetch-depth: 0`
   * because, since 009, the rooms read landing facts off the landing branch; on
   * a `merge_group` event the checkout is a temporary `gh-readonly-queue/…` ref,
   * so that read is slow or unresolvable and the first paint lands after the
   * assertion has already given up. The signature matches exactly -- the FIRST
   * test in the project times out while a later test on the same page passes
   * every time.
   *
   * A retry does not fix that; it hides it, and it is here because the flake
   * was evicting every node's pull request from the merge queue, which clears
   * the auto-merge request and is indistinguishable from a lapsed arm. The real
   * fix -- not blocking first paint on a branch read, or waiting for a painted
   * signal instead of counting to five -- is filed as
   * `gates/merge-group-ref-slows-first-paint-past-assertion` and belongs in a
   * spec. Delete this line when that lands.
   *
   * Local runs keep zero retries deliberately: a flake that only CI can see is
   * a flake nobody will fix.
   */
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:8787",
    headless: true,
    httpCredentials: { username: "pane", password: PANE_TOKEN },
  },
  projects: [
    {
      name: "desk",
      testMatch: /desk\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // 006 US1: the Desk's clothing, measured — the frame it fills at three
      // widths and the tokens, chips and tables it wears in both themes. Its
      // own file so that `desk.spec.ts`, a suite FR-003 requires to pass
      // unchanged, stays untouched; the same fixture-backed backend on 8787.
      name: "desk-world",
      testMatch: /desk-world\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "desk-degraded",
      testMatch: /desk-degraded\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:8788",
      },
    },
    {
      name: "showfloor",
      testMatch: /showfloor\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // 014 US1: the drafting table. A project of its own, because a spec file
      // that matches none is collected by no gate — the defect 001 US1-S1
      // exists to prevent, and the one `shell.spec.ts` shipped with. Same
      // fixture-backed backend on 8787: this room reads the specs corpus off
      // disk and needs no live floor.
      name: "draft",
      testMatch: /draft\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // 011 US2: the review room. Its own project for the reason the drafting
      // table has one — a spec file that matches none is collected by no gate,
      // which is the defect 001 US1-S1 exists to prevent. Same fixture-backed
      // backend on 8787: the room reads the specs corpus and the recorded
      // landing floor, and needs no live factory.
      name: "review",
      testMatch: /review\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // 005 US2: `shell.spec.ts` matched no project and so was collected by no
      // gate — the defect 001 US1-S1 exists to prevent, found while replacing
      // the first world's assertions in it. Same backend as the Desk's.
      name: "shell",
      testMatch: /shell\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Its own backend on 8789: this is the one smoke that *writes*, and a
      // settled Question on the shared demo floor is a different floor from the
      // one `desk.spec.ts` asserts against. Separate ports, no interference.
      name: "answer",
      testMatch: /answer\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:8789",
      },
    },
  ],
  webServer: [
    {
      command: "uv run uvicorn pane.app:app --host 127.0.0.1 --port 8787",
      cwd: "..",
      url: "http://127.0.0.1:8787/",
      env: paneEnv,
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: "uv run uvicorn pane.app:app --host 127.0.0.1 --port 8789",
      cwd: "..",
      url: "http://127.0.0.1:8789/",
      env: paneEnv,
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: "uv run uvicorn pane.app:app --host 127.0.0.1 --port 8788",
      cwd: "..",
      url: "http://127.0.0.1:8788/",
      env: {
        ...paneEnv,
        PANE_DEMO_TRANSPORT_FAIL: "health",
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
