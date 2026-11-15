// The chai instance `@open-wc/testing` re-exports, imported without that package: this module
// runs before mocha defines `afterEach`, and `@open-wc/testing` registers its fixture cleanup
// only when that global already exists at first import.
import { AssertionError, util } from "@esm-bundle/chai";

/**
 * Loaded ahead of the test framework by `testRunnerHtml` in
 * `web-test-runner.config.mjs`. The browser reports each failure's `actual`
 * and `expected` to the runner through `structuredClone`
 * (`@web/dev-server-core` webSocketsPlugin `stable()`), which throws a
 * `DataCloneError` on a DOM node or a function. That throw rejects the
 * `wtr-session-finished` message, so the whole file never reports and the run
 * waits out `testsFinishTimeout`. A value the browser cannot clone is stored
 * as chai's own rendering of it instead, the same text the failure message
 * already shows.
 */
for (const key of ["actual", "expected"] as const) {
  const slot = Symbol(key);
  Object.defineProperty(AssertionError.prototype, key, {
    configurable: true,
    get(this: Record<symbol, unknown>) {
      return this[slot];
    },
    set(this: Record<symbol, unknown>, value: unknown) {
      try {
        structuredClone(value);
        this[slot] = value;
      } catch {
        this[slot] = util.inspect(value);
      }
    },
  });
}
