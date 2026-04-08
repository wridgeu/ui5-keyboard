/**
 * Filter out auto-generated files that tools should not rewrite.
 * Matches the same patterns as the former micromatch globs:
 *   **\/*.gen.d.ts   and   **\/src/generated/**
 */
function exclude(files) {
  return files.filter((f) => !f.endsWith(".gen.d.ts") && !f.replace(/\\/g, "/").includes("/src/generated/"));
}

export default {
  "*.{ts,js,mjs,cjs,json,yaml,yml,md,html,css,less}": (files) => {
    const filtered = exclude(files);
    if (!filtered.length) return [];
    const quoted = filtered.map((f) => `"${f}"`).join(" ");
    return `oxfmt --ignore-path .oxfmtignore --no-error-on-unmatched-pattern ${quoted}`;
  },
  "*.{ts,js,mjs,cjs}": (files) => {
    const filtered = exclude(files);
    if (!filtered.length) return [];
    const quoted = filtered.map((f) => `"${f}"`).join(" ");
    return `oxlint --fix ${quoted}`;
  },
};
