import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runNpm } from "./run-npm.mjs";

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

runNpm(["run", "clean", "-w", "packages/kiosk-keyboard-webc"], repoRoot);
runNpm(["run", "build:dev", "-w", "packages/kiosk-keyboard-webc"], repoRoot);

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

runNpm(["run", "build", "-w", "packages/demo-app"], repoRoot);

process.stdout.write(`Verified demo build for the public kiosk-keyboard-webc/bundle entry (${resolvedBundlePath}).\n`);
