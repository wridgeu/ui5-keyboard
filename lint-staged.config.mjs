export default {
  // oxfmt skips generated files via .oxfmtignore; oxlint via its ignorePatterns.
  // --no-error-on-unmatched-pattern keeps a batch of only-ignored files (a staged
  // .js, or a *.gen.d.ts) from failing the hook with "no files matched".
  "*.{ts,js,mjs,cjs,json,yaml,yml,md,html,css,less}":
    "oxfmt --ignore-path .oxfmtignore --no-error-on-unmatched-pattern",
  "*.{ts,js,mjs,cjs}": "oxlint --fix --no-error-on-unmatched-pattern",
};
