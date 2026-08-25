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
