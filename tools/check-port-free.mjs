#!/usr/bin/env node

/**
 * Free-port guard for the QUnit suites.
 *
 * `test:qunit` in `packages/kiosk-keyboard` and `packages/hotkeys` runs
 * `start-server-and-test "ui5 serve --port <PORT>" <url> "<ui5-test-runner ...>"`.
 * With a pre-existing listener on that port, `start-server-and-test` still spawns
 * its own `ui5 serve`, polls the url, gets 200 from the FOREIGN server, declares
 * ready and runs the whole suite against it; its own child dies with EADDRINUSE
 * and that is never treated as fatal. A server left running from another branch
 * or another clone therefore produces a fully green run against the wrong code.
 * This guard is joined onto those scripts with `&&` so the run dies before
 * `start-server-and-test` gets the chance.
 *
 * The probe CONNECTS rather than binds. "Can I bind this port?" is a different
 * question: a bind reports busy for a socket in TIME_WAIT and reports free
 * against a listener holding SO_REUSEADDR/SO_REUSEPORT, while a connect answers
 * exactly what matters here, whether an HTTP poll would reach someone.
 *
 * Both loopback hosts are probed. `@ui5/server` binds 127.0.0.1 only, but the
 * hijack is decided by whatever `start-server-and-test` reaches when it polls
 * `http://localhost:<port>/...`, and Node resolves `localhost` in verbatim DNS
 * order, so `::1` can win: a foreign listener bound to `::1` alone is hijackable
 * while 127.0.0.1 is genuinely free, and a dual-stack (`::`) listener answers on
 * 127.0.0.1. Both hosts are covered by `check-port-free.test.mjs`.
 */

import net from "node:net";

const LOOPBACK_HOSTS = ["127.0.0.1", "::1"];

// A loopback connect either completes or is refused immediately; the timeout only
// covers a host that silently drops SYNs (a local firewall rule) so the guard
// cannot hang the pipeline.
const CONNECT_TIMEOUT_MS = 1000;

/**
 * Probes one loopback host for a listener.
 *
 * @param {number | string} port port to probe
 * @param {string} host loopback address to probe it on
 * @returns {Promise<boolean>} true when the connection is accepted
 */
function isListening(port, host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port: Number(port), host });

    /** @param {boolean} listening */
    const settle = (listening) => {
      socket.destroy();
      resolve(listening);
    };

    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.on("connect", () => settle(true));
    socket.on("timeout", () => settle(false));
    socket.on("error", () => settle(false));
  });
}

const port = process.argv[2];
if (!port || !/^\d+$/.test(port)) {
  console.error("Usage: node tools/check-port-free.mjs <port>");
  process.exit(1);
}

const occupied = [];
for (const host of LOOPBACK_HOSTS) {
  if (await isListening(port, host)) occupied.push(host);
}

if (occupied.length > 0) {
  console.error(
    `Port ${port} is already in use on ${occupied.join(", ")}. The QUnit suite would silently run against that server instead of this working copy. Stop it (a stray \`ui5 serve\` from another branch or clone, or a \`npm run start:*\` you left open) and re-run.`,
  );
  process.exit(1);
}
