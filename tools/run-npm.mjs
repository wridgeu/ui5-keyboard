import { spawnSync } from "node:child_process";

const npmExecPath = process.env.npm_execpath;
const npmCommand = npmExecPath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";

/**
 * Run an npm command synchronously, forwarding stdout/stderr and exiting
 * on failure. Returns the captured stdout string.
 *
 * @param {string[]} args  npm arguments, e.g. `["run", "build"]`
 * @param {string}   cwd   working directory for the child process
 * @returns {string} captured stdout
 */
export function runNpm(args, cwd) {
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
