#!/usr/bin/env node

/**
 * Validates that every visual snapshot tag referenced in test files has
 * a corresponding baseline image for desktop and every device profile.
 *
 * Prevents regressions where a test is added/committed but one or more
 * device-profile baselines are missing, causing silent failures in CI
 * that only surface when the device tests run.
 *
 * Usage:
 *   node tools/check-visual-baselines.mjs [--fix]
 *
 *   --fix   Lists the commands to run to generate missing baselines.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, basename, relative, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const FIX_MODE = process.argv.includes("--fix");

// ── Package definitions ──
// Each entry maps a package to its test dir, baseline dir, and the
// per-profile spec-file filter (matching the wdio-device.conf.ts logic).
const PACKAGES = [
  {
    name: "kiosk-keyboard",
    testDir: "packages/kiosk-keyboard/test/e2e",
    baselineDir: "packages/kiosk-keyboard/test/e2e/__baselines__",
    profiles: ["phone-sm", "phone-md", "phone-lg", "tablet"],
    // visual-container.test.ts is excluded on profiles < 400px wide.
    // visual-container-responsive.test.ts runs on ALL profiles.
    profileExclusions: {
      "phone-sm": ["visual-container.test.ts"], // 320px
      "phone-md": ["visual-container.test.ts"], // 390px
    },
  },
  {
    name: "kiosk-keyboard-webc",
    testDir: "packages/kiosk-keyboard-webc/test/e2e",
    baselineDir: "packages/kiosk-keyboard-webc/test/e2e/__baselines__",
    profiles: ["phone-sm", "phone-md", "phone-lg", "tablet"],
    profileExclusions: {},
  },
];

// ── Extract snapshot tags from test files ──
// Matches string-literal tags in:
//   toMatchElementSnapshot("tag-name"  (wdio visual expect)
//   matchElementSnapshotInSection(..., "tag-name"  (project helper)
// Skips template-literal tags (`tag-${var}`) -- these use dynamic values
// resolved at runtime (e.g. theme names in a loop) and generate multiple
// baselines that are validated when the tests actually run.
const TAG_PATTERNS = [
  /toMatchElementSnapshot\(\s*"([^"]+)"/g,
  /toMatchElementSnapshot\(\s*'([^']+)'/g,
  /matchElementSnapshotInSection\([^,]+,\s*"([^"]+)"/g,
  /matchElementSnapshotInSection\([^,]+,\s*'([^']+)'/g,
];

// Tags that are legitimately skipped on touch-emulated device profiles
// (e.g. docked mode tests that early-return on pointer:coarse).
const TOUCH_PROFILE_SKIP_TAGS = new Set(["kb-docked", "webc-docked-open"]);
const TOUCH_PROFILES = new Set(["phone-sm", "phone-md", "phone-lg", "tablet"]);

function extractTags(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const tags = new Set();
  for (const pattern of TAG_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      tags.add(match[1]);
    }
  }
  return tags;
}

function isVisualTestFile(name) {
  return (
    name.endsWith(".test.ts") && (name.startsWith("visual") || name.includes("rtl") || name.includes("accessibility"))
  );
}

// ── Main ──
let totalMissing = 0;
const fixCommands = new Map();

for (const pkg of PACKAGES) {
  const testDir = resolve(ROOT, pkg.testDir);
  const baselineDir = resolve(ROOT, pkg.baselineDir);

  if (!existsSync(testDir)) continue;

  // Collect all visual test files and their tags
  const testFiles = readdirSync(testDir).filter(isVisualTestFile);
  const fileTagMap = new Map();

  for (const file of testFiles) {
    const tags = extractTags(join(testDir, file));
    if (tags.size > 0) {
      fileTagMap.set(file, tags);
    }
  }

  // Check desktop baselines
  for (const [file, tags] of fileTagMap) {
    for (const tag of tags) {
      const baselinePath = join(baselineDir, `${tag}.png`);
      if (!existsSync(baselinePath)) {
        const rel = relative(ROOT, baselinePath);
        console.error(`MISSING  ${rel}  (from ${file})`);
        totalMissing++;
        const key = `${pkg.name}:desktop`;
        if (!fixCommands.has(key)) fixCommands.set(key, pkg.name);
      }
    }
  }

  // Check device profile baselines
  for (const profile of pkg.profiles) {
    const exclusions = pkg.profileExclusions[profile] || [];
    const isTouch = TOUCH_PROFILES.has(profile);
    for (const [file, tags] of fileTagMap) {
      if (exclusions.includes(file)) continue;
      for (const tag of tags) {
        // Skip tags that are known to be runtime-skipped on touch profiles
        if (isTouch && TOUCH_PROFILE_SKIP_TAGS.has(tag)) continue;

        const baselinePath = join(baselineDir, profile, `${tag}.png`);
        if (!existsSync(baselinePath)) {
          const rel = relative(ROOT, baselinePath);
          console.error(`MISSING  ${rel}  (from ${file})`);
          totalMissing++;
          const key = `${pkg.name}:${profile}`;
          if (!fixCommands.has(key)) fixCommands.set(key, pkg.name);
        }
      }
    }
  }
}

if (totalMissing > 0) {
  console.error(`\n${totalMissing} missing baseline(s) found.`);

  if (FIX_MODE) {
    console.error("\nRun these commands to generate the missing baselines:\n");
    for (const [key, pkgName] of fixCommands) {
      const [, profile] = key.split(":");
      if (profile === "desktop") {
        console.error(`  npm run test:e2e:update -w packages/${pkgName}`);
      } else {
        console.error(`  npm run test:e2e:${profile}:update -w packages/${pkgName}`);
      }
    }
  } else {
    console.error("Run with --fix to see commands for generating missing baselines.");
  }

  process.exit(1);
} else {
  console.log("All visual baselines present.");
}
