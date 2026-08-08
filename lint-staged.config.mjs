export default {
  // Both formatters skip generated files via their own config's ignorePatterns.
  // --no-error-on-unmatched-pattern keeps a batch of only-ignored files (a staged
  // *.gen.d.ts) from failing the hook with "no files matched".
  "*.{ts,js,mjs,cjs,json,yaml,yml,md,html,css,less}": "oxfmt --no-error-on-unmatched-pattern",
  "*.{ts,js,mjs,cjs}": "oxlint --fix --no-error-on-unmatched-pattern",
};
