import fs from "node:fs";
import path from "node:path";
import { runNpm } from "./run-npm.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

// Rebuild (tsc + vite bundle)
runNpm(["run", "clean", "-w", "packages/kiosk-keyboard-webc"], repoRoot);
runNpm(["run", "build:kiosk-webc"], repoRoot);

// Verify the standalone bundle exists
const bundleSrc = path.join(repoRoot, "packages", "kiosk-keyboard-webc", "dist", "kiosk-keyboard.bundle.js");
if (!fs.existsSync(bundleSrc)) {
  throw new Error(`Standalone bundle not found at ${bundleSrc} after build.`);
}

// Build the demo app (validates tooling-native path)
runNpm(["run", "build", "-w", "packages/demo-app"], repoRoot);

process.stdout.write("Verified: standalone bundle exists and demo app builds successfully.\n");
