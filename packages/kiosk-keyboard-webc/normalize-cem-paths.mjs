/**
 * Normalize the Custom Elements Manifest after generation.
 *
 * The @ui5/webcomponents-tools CEM analyzer uses path.join() for type
 * reference module paths, which produces backslashes on Windows
 * (e.g., "dist\\types.js"). The CEM spec does not mandate a separator
 * format, but ui5-tooling-modules and the broader ecosystem expect
 * forward slashes. This script runs after CEM generation + validation.
 */
import { readFileSync, writeFileSync } from "node:fs";

const cemPath = "dist/custom-elements.json";
const content = readFileSync(cemPath, "utf8");
const normalized = content.replaceAll("\\\\", "/");

if (content !== normalized) {
  writeFileSync(cemPath, normalized);
}
