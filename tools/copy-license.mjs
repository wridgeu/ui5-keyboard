// Copies the monorepo's root LICENSE into the current working directory
// (a package being published) so npm publish includes it in the tarball.
// Called from each publishable package's `prepublishOnly` script.

import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

const source = resolve(import.meta.dirname, "..", "LICENSE");
const target = resolve(process.cwd(), "LICENSE");

copyFileSync(source, target);
