import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmExecPath = process.env.npm_execpath;
const npmCommand = npmExecPath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";

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

function runNpm(args, cwd) {
  const spawnArgs = npmExecPath ? [npmExecPath, ...args] : args;
  const result = spawnSync(npmCommand, spawnArgs, {
    cwd,
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

  return result.stdout;
}

function assertFilesPresent(packageName, files, requiredFiles) {
  const packedFiles = new Set(files.map((file) => file.path));
  for (const requiredFile of requiredFiles) {
    if (!packedFiles.has(requiredFile)) {
      throw new Error(`${packageName} dry-run pack is missing required file '${requiredFile}'.`);
    }
  }
}

for (const pkg of packages) {
  runNpm(pkg.buildArgs, repoRoot);

  const packOutput = runNpm(["pack", "--dry-run", "--json"], pkg.dir);
  const [packMetadata] = JSON.parse(packOutput);
  if (!packMetadata || !Array.isArray(packMetadata.files)) {
    throw new Error(`Unexpected npm pack output for ${pkg.name}.`);
  }

  assertFilesPresent(pkg.name, packMetadata.files, pkg.requiredFiles);
  process.stdout.write(`Verified dry-run package contents for ${pkg.name}.\n`);
}
