import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const controllerPath = path.join(
  repoRoot,
  "packages",
  "demo-app",
  "webapp",
  "controller",
  "KioskWebComponent.controller.ts",
);
const packageJsonPath = path.join(repoRoot, "packages", "kiosk-keyboard-webc", "package.json");

const controllerSource = fs.readFileSync(controllerPath, "utf8");
if (!controllerSource.includes('import "kiosk-keyboard-webc/bundle";')) {
  throw new Error(
    "Demo app no longer imports the public 'kiosk-keyboard-webc/bundle' entry point in " +
      "KioskWebComponent.controller.ts.",
  );
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const bundleExport = packageJson?.exports?.["./bundle"]?.default;
if (typeof bundleExport !== "string" || bundleExport.length === 0) {
  throw new Error("kiosk-keyboard-webc/package.json is missing the public './bundle' export.");
}

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCmd, ["run", "build", "-w", "packages/demo-app"], {
  cwd: repoRoot,
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

process.stdout.write("Verified demo build for the public kiosk-keyboard-webc/bundle entry.\n");
