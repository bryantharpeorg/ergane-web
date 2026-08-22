import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/smoke",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8787",
    headless: true,
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
  ],
  webServer: [
    {
      command: "uv run uvicorn pane.app:app --host 127.0.0.1 --port 8787",
      cwd: "..",
      url: "http://127.0.0.1:8787/",
      env: {
        PANE_DEMO: "1",
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: "uv run uvicorn pane.app:app --host 127.0.0.1 --port 8788",
      cwd: "..",
      url: "http://127.0.0.1:8788/",
      env: {
        PANE_DEMO: "1",
        PANE_DEMO_TRANSPORT_FAIL: "health",
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
