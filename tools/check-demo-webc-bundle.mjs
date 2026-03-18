import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demoPackageJsonPath = path.join(repoRoot, "packages", "demo-app", "package.json");
const controllerPath = path.join(
  repoRoot,
  "packages",
  "demo-app",
  "webapp",
  "controller",
  "KioskWebComponent.controller.ts",
);
const demoRequire = createRequire(demoPackageJsonPath);

const controllerSource = fs.readFileSync(controllerPath, "utf8");
if (!controllerSource.includes('import "kiosk-keyboard-webc/bundle";')) {
  throw new Error(
    "Demo app no longer imports the public 'kiosk-keyboard-webc/bundle' entry point in " +
      "KioskWebComponent.controller.ts.",
  );
}

const npmExecPath = process.env.npm_execpath;
const npmCommand = npmExecPath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
function runNpm(args) {
  const spawnArgs = npmExecPath ? [npmExecPath, ...args] : args;
  const result = spawnSync(npmCommand, spawnArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
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
}

runNpm(["run", "build:dev", "-w", "packages/kiosk-keyboard-webc"]);

let resolvedBundlePath;
try {
  resolvedBundlePath = demoRequire.resolve("kiosk-keyboard-webc/bundle");
} catch (error) {
  throw new Error(
    "packages/demo-app cannot resolve the public 'kiosk-keyboard-webc/bundle' entry after rebuilding the package.",
    { cause: error },
  );
}

if (!fs.existsSync(resolvedBundlePath)) {
  throw new Error(`Resolved 'kiosk-keyboard-webc/bundle' to '${resolvedBundlePath}', but that file does not exist.`);
}

runNpm(["run", "build", "-w", "packages/demo-app"]);

process.stdout.write(`Verified demo build for the public kiosk-keyboard-webc/bundle entry (${resolvedBundlePath}).\n`);
