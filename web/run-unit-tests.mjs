import { startVitest } from "vitest/node";

const vitest = await startVitest("run", [], {
  root: process.cwd(),
  reporter: "default",
  fileParallelism: false,
  poolOptions: {
    forks: {
      singleFork: true,
    },
  },
  watch: false,
});

const files = vitest.state.getFiles();
let exitCode = 0;
for (const file of files) {
  if (file.result?.state === "fail") {
    exitCode = 1;
  }
}

await vitest.close();
process.exit(exitCode);
