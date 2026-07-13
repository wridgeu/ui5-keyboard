import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_SOURCE = "dist/generated/assets";
const DEFAULT_TARGET = "src/generated/assets";

/** Paths of every file under `dir`, relative to `base` (posix or win32 as given). */
const listFiles = (dir, base = dir) => {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(abs, base));
    else out.push(path.relative(base, abs));
  }
  return out;
};

/** Remove now-empty subdirectories of `root`, bottom-up; `root` itself is kept. */
const pruneEmptyDirs = (root) => {
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const child = path.join(dir, entry.name);
      walk(child);
      if (fs.readdirSync(child).length === 0) fs.rmdirSync(child);
    }
  };
  if (fs.existsSync(root)) walk(root);
};

/**
 * Mirror `source` → `target`, keeping every path present in `source`
 * continuously available in `target`, because a dev server (Vite) may be
 * serving `target/**` during a regenerate. A file is rewritten only when its
 * bytes differ, atomically via a per-process temp file + rename, so a reader
 * never observes a missing or half-written asset; paths absent from `source`
 * are pruned. Reverting to a destructive rm-then-copy reopens #165 (a transient
 * "Failed to resolve import" overlay flashed while the copy is in flight).
 */
export const syncGeneratedAssets = (source = DEFAULT_SOURCE, target = DEFAULT_TARGET) => {
  if (!fs.existsSync(source)) {
    throw new Error(`Expected generated assets in ${source} before syncing source assets.`);
  }

  const sourceFiles = listFiles(source);

  for (const rel of sourceFiles) {
    const to = path.join(target, rel);
    const next = fs.readFileSync(path.join(source, rel));
    if (fs.existsSync(to) && fs.readFileSync(to).equals(next)) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    const tmp = `${to}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, next);
    fs.renameSync(tmp, to);
  }

  const wanted = new Set(sourceFiles);
  for (const rel of listFiles(target)) {
    if (!wanted.has(rel)) fs.rmSync(path.join(target, rel));
  }
  pruneEmptyDirs(target);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncGeneratedAssets();
}
