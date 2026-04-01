import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runNpm } from "./run-npm.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The manual bridge control loads the standalone bundle outside ui5-tooling-modules
// to avoid middleware interception (see demo-app README "Web Component Consumption").
// Verify the control file still references the standalone bundle.
const controlPath = path.join(repoRoot, "packages", "demo-app", "webapp", "control", "KioskKeyboardWebc.ts");
const controlSource = fs.readFileSync(controlPath, "utf8");
if (!controlSource.includes("kiosk-keyboard.bundle.js")) {
  throw new Error(
    "Demo app bridge control no longer references the standalone bundle " +
      "(kiosk-keyboard.bundle.js) in KioskKeyboardWebc.ts. The manual bridge " +
      "requires loading the bundle outside ui5-tooling-modules.",
  );
}

// Rebuild (tsc + vite bundle) and verify the standalone bundle exists
runNpm(["run", "clean", "-w", "packages/kiosk-keyboard-webc"], repoRoot);
runNpm(["run", "build:kiosk-webc"], repoRoot);

const bundleSrc = path.join(repoRoot, "packages", "kiosk-keyboard-webc", "dist", "kiosk-keyboard.bundle.js");
if (!fs.existsSync(bundleSrc)) {
  throw new Error(
    `Standalone bundle not found at ${bundleSrc} after build. ` +
      "The manual bridge demo and native consumption paths depend on this file.",
  );
}

// Verify the copy script works (prestart hook)
runNpm(["run", "prestart", "-w", "packages/demo-app"], repoRoot);
const copiedBundle = path.join(repoRoot, "packages", "demo-app", "webapp", "lib", "kiosk-keyboard.bundle.js");
if (!fs.existsSync(copiedBundle)) {
  throw new Error(
    `Standalone bundle was not copied to ${copiedBundle}. ` +
      "The prestart script (tools/copy-webc-bundle.mjs) must copy the bundle for the manual bridge demo.",
  );
}

// Build the demo app (validates both tooling-native and manual bridge paths)
runNpm(["run", "build", "-w", "packages/demo-app"], repoRoot);

process.stdout.write("Verified demo build: standalone bundle exists, copy script works, demo builds successfully.\n");
