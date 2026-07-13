import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncGeneratedAssets } from "../../sync-generated-assets.mjs";

// The generated theme/i18n JSON assets are mirrored dist → src so the
// generated json-imports (which use relative ../assets/ paths) resolve when
// Vite serves from source. The mirror must never remove or truncate a path
// that still exists in source, because a live dev server may be serving it
// (#165): a destructive rm-then-copy flashed a transient "Failed to resolve
// import" overlay during the copy window.

let root: string;
let source: string;
let target: string;

const write = (base: string, rel: string, contents: string) => {
  const abs = path.join(base, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
};

const read = (base: string, rel: string) => fs.readFileSync(path.join(base, rel), "utf8");

/** Stamp every file under `dir` with a fixed past mtime to detect later rewrites. */
const EPOCH = new Date(0);
const stampMtimes = (dir: string) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) stampMtimes(abs);
    else fs.utimesSync(abs, EPOCH, EPOCH);
  }
};

const mtimeMs = (base: string, rel: string) => fs.statSync(path.join(base, rel)).mtimeMs;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "sync-assets-"));
  source = path.join(root, "dist");
  target = path.join(root, "src");
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("syncGeneratedAssets", () => {
  it("mirrors the full source tree into an empty target", () => {
    write(source, "themes/sap_horizon/parameters-bundle.css.json", '""');
    write(source, "i18n/messagebundle_de.json", '{"a":"b"}');

    syncGeneratedAssets(source, target);

    expect(read(target, "themes/sap_horizon/parameters-bundle.css.json")).toBe('""');
    expect(read(target, "i18n/messagebundle_de.json")).toBe('{"a":"b"}');
  });

  it("leaves unchanged files untouched on a repeat sync (no missing-file window)", () => {
    write(source, "themes/sap_horizon/parameters-bundle.css.json", '""');
    write(source, "i18n/messagebundle_de.json", '{"a":"b"}');
    syncGeneratedAssets(source, target);

    // A rm-then-copy would delete and rewrite every file; prove none is rewritten.
    stampMtimes(target);
    syncGeneratedAssets(source, target);

    expect(mtimeMs(target, "themes/sap_horizon/parameters-bundle.css.json")).toBe(0);
    expect(mtimeMs(target, "i18n/messagebundle_de.json")).toBe(0);
  });

  it("rewrites only files whose bytes changed", () => {
    write(source, "themes/sap_horizon/parameters-bundle.css.json", '""');
    write(source, "i18n/messagebundle_de.json", '{"a":"b"}');
    syncGeneratedAssets(source, target);
    stampMtimes(target);

    write(source, "i18n/messagebundle_de.json", '{"a":"changed"}');
    syncGeneratedAssets(source, target);

    expect(read(target, "i18n/messagebundle_de.json")).toBe('{"a":"changed"}');
    expect(mtimeMs(target, "i18n/messagebundle_de.json")).not.toBe(0);
    // The theme file did not change, so it must not have been rewritten.
    expect(mtimeMs(target, "themes/sap_horizon/parameters-bundle.css.json")).toBe(0);
  });

  it("prunes files (and emptied directories) absent from source", () => {
    write(source, "i18n/messagebundle_de.json", '{"a":"b"}');
    write(source, "i18n/messagebundle_ja.json", '{"c":"d"}');
    write(source, "themes/sap_horizon/parameters-bundle.css.json", '""');
    syncGeneratedAssets(source, target);

    fs.rmSync(path.join(source, "i18n/messagebundle_ja.json"));
    fs.rmSync(path.join(source, "themes"), { recursive: true });
    syncGeneratedAssets(source, target);

    expect(fs.existsSync(path.join(target, "i18n/messagebundle_de.json"))).toBe(true);
    expect(fs.existsSync(path.join(target, "i18n/messagebundle_ja.json"))).toBe(false);
    expect(fs.existsSync(path.join(target, "themes"))).toBe(false);
  });

  it("throws when the source tree is missing", () => {
    expect(() => syncGeneratedAssets(source, target)).toThrow(/before syncing/);
  });
});
