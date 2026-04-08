import { $ } from "@wdio/globals";
import {
  openVisualPage,
  getKeyboard,
  getViewportWidth,
  injectStyleOverride,
  removeStyleOverride,
  DISABLE_TEXT_BOX_TRIM,
  matchElementSnapshotInSection,
} from "./test-helpers.js";

const HEIGHT_SNAPSHOT_OPTIONS = { ignoreAntialiasing: true };

/**
 * Progressive enhancement visual regression tests.
 *
 * The default baselines (in visual.test.ts) capture rendering with ALL
 * CSS enhancements active (Chrome 145 supports text-box-trim).  These
 * tests inject CSS overrides to disable text-box-trim, capturing the
 * fallback rendering that non-supporting browsers would show.
 *
 * Both the UI5 control and the WebC package use native CSS @container
 * queries for width-responsive sizing. Only height remains JS-driven.
 */

describe("KioskKeyboard UI5 - Fallback: without text-box-trim", () => {
  before(async () => {
    await openVisualPage();
    await injectStyleOverride(DISABLE_TEXT_BOX_TRIM, "disable-text-box-trim");
  });

  after(async () => {
    await removeStyleOverride("disable-text-box-trim");
  });

  it("should match QWERTY layout without text-box-trim", async () => {
    const kb = await getKeyboard("kb-qwerty");
    await matchElementSnapshotInSection(kb, "kb-qwerty-no-text-trim");
  });

  it("should match narrow layout without text-box-trim", async () => {
    const kb = await getKeyboard("kb-narrow");
    await matchElementSnapshotInSection(kb, "kb-narrow-no-text-trim");
  });

  it("should match height-constrained container without text-box-trim", async function () {
    const vw = await getViewportWidth();
    if (vw < 420) return this.skip();
    const container = await $("#kb-height-constrained");
    await matchElementSnapshotInSection(container, "kb-height-constrained-no-text-trim", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match glyph stress layout without text-box-trim", async () => {
    const kb = await getKeyboard("kb-glyph-stress");
    await matchElementSnapshotInSection(kb, "kb-glyph-stress-no-text-trim");
  });
});
