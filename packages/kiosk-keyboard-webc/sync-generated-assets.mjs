import fs from "node:fs";

const source = "dist/generated/assets";
const target = "src/generated/assets";

if (!fs.existsSync(source)) {
  throw new Error(`Expected generated assets in ${source} before syncing source assets.`);
}

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
