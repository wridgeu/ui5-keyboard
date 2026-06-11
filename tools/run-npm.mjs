import { spawnSync } from "node:child_process";

// npm sets npm_execpath for every script it runs; reusing it (via the current
// Node binary) is the only spawn path that works portably with shell:false.
// The old fallback of spawning `npm.cmd` directly throws EINVAL on Windows
// since Node 18.20 (CVE-2024-27980 hardening), so fail fast instead.
const npmExecPath = process.env.npm_execpath ?? "";
if (!npmExecPath) {
  console.error(
    "npm_execpath is not set: this script must be run via an npm script (e.g. `npm run test:packages:smoke`), not invoked with `node` directly.",
  );
  process.exit(1);
}

/**
 * Run an npm command synchronously, forwarding stdout/stderr and exiting
 * on failure. Returns the captured stdout string.
 *
 * @param {string[]} args  npm arguments, e.g. `["run", "build"]`
 * @param {string}   cwd   working directory for the child process
 * @returns {string} captured stdout
 */
export function runNpm(args, cwd) {
  const result = spawnSync(process.execPath, [npmExecPath, ...args], {
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
