import path from "node:path";
import { runNpm } from "./run-npm.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

const packages = [
  {
    name: "ui5-lib-hotkeys",
    dir: path.join(repoRoot, "packages", "hotkeys"),
    buildArgs: ["run", "build:hotkeys"],
    requiredFiles: ["README.md", "dist/.ui5/build-manifest.json", "dist/resources/ui5/hotkeys/library.js"],
  },
  {
    name: "ui5-lib-kiosk-keyboard",
    dir: path.join(repoRoot, "packages", "kiosk-keyboard"),
    buildArgs: ["run", "build:kiosk"],
    requiredFiles: ["README.md", "dist/.ui5/build-manifest.json", "dist/resources/ui5/kiosk/library.js"],
  },
  {
    name: "kiosk-keyboard-webc",
    dir: path.join(repoRoot, "packages", "kiosk-keyboard-webc"),
    buildArgs: ["run", "build:kiosk-webc"],
    requiredFiles: [
      "README.md",
      "dist/Assets.js",
      "dist/KioskKeyboard.js",
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

for (const pkg of packages) {
  runNpm(["run", "clean"], pkg.dir);
  runNpm(pkg.buildArgs, repoRoot);

  const packOutput = runNpm(["pack", "--dry-run", "--json"], pkg.dir);
  const [packMetadata] = JSON.parse(packOutput);
  if (!packMetadata || !Array.isArray(packMetadata.files)) {
    throw new Error(`Unexpected npm pack output for ${pkg.name}.`);
  }

  assertFilesPresent(pkg.name, packMetadata.files, pkg.requiredFiles);
  process.stdout.write(`Verified dry-run package contents for ${pkg.name}.\n`);
}

// The demo app consumes the freshly built web component via the
// ui5-tooling-modules <kiosk-keyboard> path; building it here exercises that
// consumption path at build time (runtime is covered by the e2e suites). The
// webc bundle was just rebuilt and packed in the loop above, so the demo
// builds against current output.
runNpm(["run", "build", "-w", "packages/demo-app"], repoRoot);
process.stdout.write("Verified: demo app builds against the web component bundle.\n");
