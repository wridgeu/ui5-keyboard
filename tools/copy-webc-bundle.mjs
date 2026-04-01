#!/usr/bin/env node

// Copies the kiosk-keyboard-webc standalone bundle into the demo-app's
// webapp/lib/ directory so the manual bridge demo can load it as a static
// file (bypassing ui5-tooling-modules). Used as the demo-app prestart hook.

import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const src = resolve(__dirname, "../packages/kiosk-keyboard-webc/dist/kiosk-keyboard.bundle.js");
const destDir = resolve(__dirname, "../packages/demo-app/webapp/lib");
const dest = resolve(destDir, "kiosk-keyboard.bundle.js");

if (!existsSync(src)) {
  console.error(
    "Error: kiosk-keyboard-webc not built -- dist/kiosk-keyboard.bundle.js not found.\n" +
      "Run `npm run build` from the repo root first.",
  );
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
