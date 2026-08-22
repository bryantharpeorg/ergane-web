import { defineConfig, devices } from "@playwright/test";

// Browsers installed by the postinstall script live inside node_modules so that
// a fresh HOME (the factory gate sandbox) still finds them.
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "0";

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
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "uv run uvicorn pane.app:app --host 127.0.0.1 --port 8787",
      cwd: "..",
      url: "http://127.0.0.1:8787/",
      env: { PANE_DEMO: "1" },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
