/**
 * What the `unit` gate measures about itself (015 US2).
 *
 * `ergane.yaml` declares four gates and, until 015, not one of them said how
 * much of the code its tests actually execute. US1 answered that for `pane/`;
 * this file answers it for `web/src` on the same terms — a machine-readable
 * report and a terminal summary at a declared path under `web/`, and a floor
 * that is committed here rather than passed on a command line (FR-005…FR-007,
 * plan D1 and D3).
 *
 * It exists as a file of its own, rather than as a `test` block inside
 * `vite.config.ts`, because that is the file US2's third scenario names:
 * `web/vitest.config.*`. Vitest prefers it over `vite.config.ts` when both are
 * present, so the build config is imported and merged rather than duplicated —
 * one `test` block in the repository, and the plugins the unit suite needs
 * (`@vitejs/plugin-react`, and the `?raw` loader the style tests read CSS
 * through) come from the one place that already declares them.
 *
 * Like `vite.config.ts` and `playwright.config.ts` it is transpiled by its own
 * runner and stays outside `tsconfig.json`'s `include` (001 plan R-009).
 */
import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: [
        "tests/unit/**/*.test.{ts,tsx}",
        // The gate's proof of itself (015 US2, T011). It reads this file, the
        // `unit` gate command and the workflow job, and drives a throwaway
        // project with the mechanism committed below to watch the floor bite.
        // It lives outside `tests/unit/` because it is Node-side harness code —
        // it spawns a child runner and reads files off disk, and `@types/node`
        // is not on the approved roster (constitution VII), so like the two
        // config files it stays out of `tsconfig.json`'s `include`.
        "tests/gates/**/*.test.ts",
      ],
      coverage: {
        // V8's own counters, remapped through the source maps Vite already
        // emits. The alternative provider instruments the source, which would
        // change what the unit suite runs while it measures it.
        provider: "v8",
        // WHAT IS MEASURED: `web/src`, the shipped frontend, and nothing else.
        // Every file here counts whether or not a test ever imports it —
        // `coverage.all` defaults to true, and a room nobody tests reads as
        // zero rather than as absent, which is the number worth knowing.
        include: ["src/**/*.{ts,tsx}"],
        // Type-only declarations carry no statements to execute.
        exclude: ["src/**/*.d.ts"],
        // THE TWO REPORTS FR-005 ASKS FOR. `text` is the terminal summary a
        // human reads in the gate's tail (013 made that tail visible in the
        // Showfloor). `json-summary` is the machine-readable one — vitest's
        // standard totals document, chosen because it is what a collector
        // already understands (plan D3), the frontend counterpart of the
        // backend's Cobertura `coverage.xml`.
        reporter: ["text", "json-summary"],
        // THE DECLARED PATH, relative, so it resolves against `web/` — the
        // directory the gate runs the runner in — and nowhere else. The
        // summary lands at `web/coverage/coverage-summary.json`. Stable and
        // standard is the whole point: PR-3's collector takes it unchanged, and
        // nothing in this repository reads it (spec 015 § Out of scope).
        reportsDirectory: "coverage",
        // THE FLOOR (FR-006, FR-007). Committed here, never passed on a command
        // line, so a reader sees the number without running anything (plan D1).
        //
        // Measured on this diff, whole unit suite, `vitest run --coverage`,
        // over `src/**/*.{ts,tsx}` with every file counted:
        //
        //     node 20.19.4   3252 / 3587 lines   90.66%
        //     node 22.11.0   3252 / 3587 lines   90.66%
        //
        // Two runtimes, because US1 found the backend figure moving by 0.11 of
        // a point between interpreters and set its floor from the lowest of
        // three. The gates workflow pins node 22 and the sandbox this was
        // measured in offers 20, so both had to answer; V8 attributed all 3587
        // lines the same way on each.
        //
        // The baseline, truncated down to a tenth (plan D2) — not a round
        // number chosen in advance. It leaves about two lines of slack, which
        // is the point: this floor stops a regression, it does not fund one.
        // Raising it over time is the operator's policy and explicitly out of
        // this spec's scope.
        //
        // `lines` alone, as the backend's `fail_under` is a line floor. The
        // branch and function figures are printed by the terminal summary and
        // recorded in the JSON; making three numbers fail the gate is three
        // policies, and the operator set one.
        thresholds: {
          lines: 90.6,
        },
      },
    },
  }),
);
