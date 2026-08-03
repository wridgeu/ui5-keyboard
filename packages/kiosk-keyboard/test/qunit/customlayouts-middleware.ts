import type { CompositionMiddleware } from "ui5/kiosk/types";

/**
 * A middleware factory reachable as its own module, so `customLayouts-xml.qunit.ts`
 * can resolve it the way a consumer would: through `core:require` in the view,
 * rather than through an import the test could have made itself.
 */
const Mw = {
  created: 0,
  create(): CompositionMiddleware {
    Mw.created += 1;
    return { handleKey: () => false, commit: () => null, reset: () => {} };
  },
};

export default Mw;
