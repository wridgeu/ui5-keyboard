import { $, expect } from "@wdio/globals";
import {
  openVisualPage,
  getKeyboard,
  injectStyleOverride,
  removeStyleOverride,
  DISABLE_TEXT_BOX_TRIM,
} from "./test-helpers.js";

const HEIGHT_SNAPSHOT_OPTIONS = { ignoreAntialiasing: true } as const;

/**
 * Progressive enhancement visual regression tests.
 *
 * The default baselines (in visual.test.ts) capture rendering with ALL
 * CSS enhancements active (Chrome 145 supports text-box-trim).  These
 * tests inject CSS overrides to disable text-box-trim, capturing the
 * fallback rendering that non-supporting browsers would show.
 *
 * The UI5 control uses JS-driven classes for width-responsive sizing
 * (not native @container queries), so container query fallback testing
 * is handled in the WebC package only.
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
    await expect(kb).toMatchElementSnapshot("kb-qwerty-no-text-trim");
  });

  it("should match narrow layout without text-box-trim", async () => {
    const kb = await getKeyboard("kb-narrow");
    await expect(kb).toMatchElementSnapshot("kb-narrow-no-text-trim");
  });

  it("should match height-constrained container without text-box-trim", async () => {
    const container = await $("#kb-height-constrained");
    await expect(container).toMatchElementSnapshot("kb-height-constrained-no-text-trim", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match glyph stress layout without text-box-trim", async () => {
    const kb = await getKeyboard("kb-glyph-stress");
    await expect(kb).toMatchElementSnapshot("kb-glyph-stress-no-text-trim");
  });
});
