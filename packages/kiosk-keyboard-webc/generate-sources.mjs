import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const PACKAGE_ROOT = import.meta.dirname;
const require = createRequire(import.meta.url);
const UI5NPS = path.join(path.dirname(require.resolve("@ui5/webcomponents-tools/package.json")), "bin", "ui5nps.js");

/**
 * Runs `ui5nps generate` (the `generate` npm script) so a test runner reads a
 * fresh `src/generated/` however it was started, including single-file runs via
 * `npx`. Vitest takes it as `globalSetup` (default export, run once before any
 * test file); web-test-runner calls it from a plugin's `serverStart`. Playwright
 * generates in its webServer command instead (see playwright.config.ts).
 *
 * Spawns the bin with the current Node binary rather than `npm run generate`:
 * `npm.cmd` cannot be spawned without a shell on Windows (EINVAL), and a runner
 * started through `npx` has no `npm_execpath` to re-invoke npm with.
 */
export default function generateSources() {
  const { status, error } = spawnSync(process.execPath, [UI5NPS, "generate"], {
    cwd: PACKAGE_ROOT,
    stdio: "inherit",
  });
  if (error) throw error;
  if (status !== 0) throw new Error(`ui5nps generate exited with status ${status}`);
}
