#!/usr/bin/env node

/**
 * Pins compose.yaml's Playwright image to the installed `@playwright/test`.
 *
 * Playwright only launches the browser build it was released with, so the image
 * tag has to carry the same version as the lockfile - and nothing here updates
 * either automatically. A drifted tag fails for whoever next runs the container,
 * with an "Executable doesn't exist" from deep inside Playwright; this names the
 * mismatch instead. It also requires a digest on the reference: a tag is mutable,
 * so a tag alone is not a pin.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const installed = require("@playwright/test/package.json").version;

const compose = readFileSync(new URL("../compose.yaml", import.meta.url), "utf8");
const match = compose.match(/image:\s*mcr\.microsoft\.com\/playwright:v([\d.]+)-noble@sha256:[0-9a-f]{64}\s*$/m);

if (!match) {
  console.error(
    "compose.yaml has no `image: mcr.microsoft.com/playwright:v<version>-noble@sha256:<digest>` line. The digest is required; get it with `docker inspect --format '{{index .RepoDigests 0}}' mcr.microsoft.com/playwright:v<version>-noble` after pulling.",
  );
  process.exit(1);
}

if (match[1] !== installed) {
  console.error(
    `compose.yaml pins Playwright ${match[1]}, but @playwright/test is ${installed}. Bump the tag to v${installed}-noble and replace the digest with the one \`docker inspect --format '{{index .RepoDigests 0}}'\` reports for it.`,
  );
  process.exit(1);
}

console.log(`compose.yaml image matches @playwright/test ${installed}.`);
