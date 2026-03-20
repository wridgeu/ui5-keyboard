import micromatch from "micromatch";

/** Files that should never be formatted or linted by lint-staged. */
const IGNORE = ["**/*.gen.d.ts", "**/src/generated/**"];

/**
 * Filter out auto-generated files that tools should not rewrite.
 * micromatch negation globs cannot reliably exclude compound extensions
 * like `.gen.d.ts` in JSON config, so we use the function syntax instead.
 */
function exclude(files) {
  return micromatch.not(files, IGNORE);
}

export default {
  "*.{ts,js,mjs,cjs,json,yaml,yml,md,html,css,less}": (files) => {
    const filtered = exclude(files);
    if (!filtered.length) return [];
    return `oxfmt --ignore-path .oxfmtignore --no-error-on-unmatched-pattern ${filtered.join(" ")}`;
  },
  "*.{ts,js,mjs,cjs}": (files) => {
    const filtered = exclude(files);
    if (!filtered.length) return [];
    return `oxlint --fix ${filtered.join(" ")}`;
  },
};
