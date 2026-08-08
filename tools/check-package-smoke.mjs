import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

// npm sets npm_execpath for every script it runs; re-invoking that CLI with the
// current Node binary is the only spawn path that works with shell:false, because
// spawning `npm.cmd` directly throws EINVAL on Windows (Node's CVE-2024-27980
// hardening).
const npmExecPath = process.env.npm_execpath;
if (!npmExecPath) {
  console.error("npm_execpath is not set: run this through `npm run test:packages:smoke`, not with `node` directly.");
  process.exit(1);
}

const packages = [
  {
    name: "ui5-lib-hotkeys",
    workspace: "packages/hotkeys",
    requiredFiles: ["LICENSE", "README.md", "dist/.ui5/build-manifest.json", "dist/resources/ui5/hotkeys/library.js"],
  },
  {
    name: "ui5-lib-kiosk-keyboard",
    workspace: "packages/kiosk-keyboard",
    requiredFiles: [
      "LICENSE",
      "README.md",
      "src/KioskKeyboard.gen.d.ts",
      "src/CustomLayout.gen.d.ts",
      "dist/.ui5/build-manifest.json",
      "dist/resources/ui5/kiosk/library.js",
    ],
  },
  {
    name: "kiosk-keyboard-webc",
    workspace: "packages/kiosk-keyboard-webc",
    requiredFiles: [
      "LICENSE",
      "README.md",
      "dist/Assets.js",
      "dist/KioskKeyboard.js",
      "dist/CustomLayout.js",
      "dist/bundle.esm.js",
      "dist/custom-elements.json",
      "dist/kiosk-keyboard.bundle.js",
    ],
  },
];

function assertFilesPresent(packageName, files, requiredFiles) {
  const packedFiles = new Set(files.map((file) => file.path));
  for (const requiredFile of requiredFiles) {
    if (!packedFiles.has(requiredFile)) {
      throw new Error(`${packageName} dry-run pack is missing required file '${requiredFile}'.`);
    }
  }
}

// npm only packs files inside the package directory, so each published package
// carries its own committed copy of the repo's LICENSE. Presence is not enough:
// a copy that fell behind the root file ships the wrong licence text, and
// nothing else in the tree compares them.
const rootLicense = readFileSync(path.join(repoRoot, "LICENSE"), "utf8");

function assertLicenseMatchesRoot(packageName, workspace) {
  const packaged = readFileSync(path.join(repoRoot, workspace, "LICENSE"), "utf8");
  if (packaged !== rootLicense) {
    throw new Error(`${packageName} ships a LICENSE that differs from the repo root LICENSE. Re-copy the root file.`);
  }
}

// One invocation for all three workspaces: npm accepts repeated `-w` and emits a
// single JSON array. Entries are matched by package name rather than by position,
// so the result does not depend on npm preserving the flag order.
const packOutput = execFileSync(
  process.execPath,
  [npmExecPath, "pack", "--dry-run", "--json", ...packages.flatMap((pkg) => ["-w", pkg.workspace])],
  { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);
const packMetadata = JSON.parse(packOutput);

for (const pkg of packages) {
  const metadata = packMetadata.find((entry) => entry.name === pkg.name);
  if (!metadata || !Array.isArray(metadata.files)) {
    throw new Error(`Unexpected npm pack output for ${pkg.name}.`);
  }

  assertFilesPresent(pkg.name, metadata.files, pkg.requiredFiles);
  assertLicenseMatchesRoot(pkg.name, pkg.workspace);
  process.stdout.write(`Verified dry-run package contents for ${pkg.name}.\n`);
}
