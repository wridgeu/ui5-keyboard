// Copies the monorepo's root LICENSE into the current working directory
// (a package being published) so npm publish includes it in the tarball.
// Called from each publishable package's `prepublishOnly` script.

import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "..", "LICENSE");
const target = resolve(process.cwd(), "LICENSE");

copyFileSync(source, target);
