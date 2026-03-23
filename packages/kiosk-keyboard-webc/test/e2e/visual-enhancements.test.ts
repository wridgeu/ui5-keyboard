import {
  openVisualPage,
  getKeyboardRoot,
  forceHoverState,
  clearForcedHoverState,
  injectShadowStyleOverride,
  removeShadowStyleOverride,
  DISABLE_COLOR_MIX,
  DISABLE_TEXT_BOX_TRIM,
  DISABLE_CONTAINER_QUERIES,
  matchElementSnapshotInSection,
} from "./test-helpers.js";

const HEIGHT_SNAPSHOT_OPTIONS = { ignoreAntialiasing: true } as const;

/**
 * Progressive enhancement visual regression tests.
 *
 * The default baselines (in visual.test.ts) capture rendering with ALL
 * CSS enhancements active (Chrome 145 supports both container queries
 * and text-box-trim).  These tests inject CSS overrides to disable
 * individual enhancements, capturing the fallback rendering that
 * non-supporting browsers would show.
 *
 * Enhancement layers tested:
 *   1. text-box-trim  -- ~83 % browser support (Chrome 133+, Edge 133+,
 *      Safari 18.2+, Firefox 133+).  Removes invisible half-leading.
 *   2. Container queries -- ~92 % browser support. Native @container
 *      breakpoints for width-responsive font scaling. The fallback
 *      snapshots explicitly disable native CQ styling and inject the
 *      class-based fallback rules so they match older browsers.
 *   3. color-mix() shadow tokens -- guarded with @supports. The fallback
 *      snapshot re-applies the static rgba() shadow tokens that older
 *      browsers keep when the guarded override block is skipped.
 */

describe("KioskKeyboard WebC - Fallback: without text-box-trim", () => {
  before(async () => {
    await openVisualPage();
    await injectShadowStyleOverride(DISABLE_TEXT_BOX_TRIM, "disable-text-box-trim");
  });

  after(async () => {
    await removeShadowStyleOverride("disable-text-box-trim");
  });

  it("should match QWERTY layout without text-box-trim", async () => {
    const kb = await getKeyboardRoot("kb-qwerty");
    await matchElementSnapshotInSection(kb, "webc-qwerty-no-text-trim");
  });

  it("should match narrow container without text-box-trim", async () => {
    const kb = await getKeyboardRoot("kb-narrow");
    await matchElementSnapshotInSection(kb, "webc-narrow-no-text-trim");
  });

  it("should match height-constrained container without text-box-trim", async () => {
    const kb = await getKeyboardRoot("kb-height-constrained");
    await matchElementSnapshotInSection(kb, "webc-height-constrained-no-text-trim", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match glyph stress layout without text-box-trim", async () => {
    const kb = await getKeyboardRoot("kb-glyph-stress");
    await matchElementSnapshotInSection(kb, "webc-glyph-stress-no-text-trim");
  });
});

describe("KioskKeyboard WebC - Fallback: without container queries", () => {
  before(async () => {
    await openVisualPage();
    await injectShadowStyleOverride(DISABLE_CONTAINER_QUERIES, "disable-cq");
  });

  after(async () => {
    await removeShadowStyleOverride("disable-cq");
  });

  it("should match narrow container without container queries", async () => {
    const kb = await getKeyboardRoot("kb-narrow");
    await matchElementSnapshotInSection(kb, "webc-narrow-no-cq");
  });

  it("should match glyph stress layout without container queries", async () => {
    const kb = await getKeyboardRoot("kb-glyph-stress");
    await matchElementSnapshotInSection(kb, "webc-glyph-stress-no-cq");
  });
});

describe("KioskKeyboard WebC - Fallback: without all enhancements", () => {
  const DISABLE_ALL = DISABLE_TEXT_BOX_TRIM + DISABLE_CONTAINER_QUERIES + DISABLE_COLOR_MIX;

  before(async () => {
    await openVisualPage();
    await injectShadowStyleOverride(DISABLE_ALL, "disable-all-enhancements");
  });

  after(async () => {
    await removeShadowStyleOverride("disable-all-enhancements");
  });

  it("should match QWERTY layout without any enhancements", async () => {
    const kb = await getKeyboardRoot("kb-qwerty");
    await matchElementSnapshotInSection(kb, "webc-qwerty-no-enhancements");
  });

  it("should match narrow container without any enhancements", async () => {
    const kb = await getKeyboardRoot("kb-narrow");
    await matchElementSnapshotInSection(kb, "webc-narrow-no-enhancements");
  });

  it("should match height-constrained container without any enhancements", async () => {
    const kb = await getKeyboardRoot("kb-height-constrained");
    await matchElementSnapshotInSection(kb, "webc-height-constrained-no-enhancements", HEIGHT_SNAPSHOT_OPTIONS);
  });
});

describe("KioskKeyboard WebC - Fallback: without color-mix()", () => {
  before(async () => {
    await openVisualPage();
    await injectShadowStyleOverride(DISABLE_COLOR_MIX, "disable-color-mix");
  });

  after(async () => {
    await removeShadowStyleOverride("disable-color-mix");
  });

  it("should match hovered key shadows without color-mix()", async function () {
    const supportsHover = await browser.execute(() => window.matchMedia("(hover: hover)").matches);
    if (!supportsHover) return this.skip();

    const kb = await getKeyboardRoot("kb-qwerty");
    await forceHoverState("kb-qwerty", '[data-key="f"]');
    try {
      await matchElementSnapshotInSection(kb, "webc-key-hovered-no-color-mix");
    } finally {
      await clearForcedHoverState("kb-qwerty", '[data-key="f"]');
    }
  });
});
