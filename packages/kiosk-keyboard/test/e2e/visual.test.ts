import { $, expect } from "@wdio/globals";
import { openVisualPage, getKeyboard, forceHoverState, clearForcedHoverState } from "./test-helpers.js";

const HEIGHT_SNAPSHOT_OPTIONS = { ignoreAntialiasing: true } as const;

describe("KioskKeyboard Visual Regression", () => {
  before(async () => {
    await openVisualPage();
  });

  it("should match QWERTY layout", async () => {
    const kb = await getKeyboard("kb-qwerty");
    await expect(kb).toMatchElementSnapshot("kb-qwerty");
  });

  it("should match keyboard with input target", async () => {
    const kb = await getKeyboard("kb-with-input");
    await expect(kb).toMatchElementSnapshot("kb-with-input");
  });

  it("should match Numpad layout", async () => {
    const kb = await getKeyboard("kb-numpad");
    await expect(kb).toMatchElementSnapshot("kb-numpad");
  });

  it("should match Numeric layout", async () => {
    const kb = await getKeyboard("kb-numeric");
    await expect(kb).toMatchElementSnapshot("kb-numeric");
  });

  it("should match disabled state", async () => {
    const kb = await getKeyboard("kb-disabled");
    await expect(kb).toMatchElementSnapshot("kb-disabled");
  });

  it("should match full width (600px) layout", async () => {
    const kb = await getKeyboard("kb-wide");
    await expect(kb).toMatchElementSnapshot("kb-wide");
  });

  it("should match narrow (320px) layout", async () => {
    const kb = await getKeyboard("kb-narrow");
    await expect(kb).toMatchElementSnapshot("kb-narrow");
  });

  it("should match compact density", async () => {
    const kb = await getKeyboard("kb-compact");
    await expect(kb).toMatchElementSnapshot("kb-compact");
  });

  it("should match special characters layout", async () => {
    const kb = await getKeyboard("kb-special");
    await expect(kb).toMatchElementSnapshot("kb-special");
  });

  it("should match keyboard in fixed container (400x350)", async () => {
    const container = await $("#kb-container-fixed");
    await expect(container).toMatchElementSnapshot("kb-container-fixed");
  });

  it("should match keyboard with stableHeight", async () => {
    const kb = await getKeyboard("kb-stable-height");
    await expect(kb).toMatchElementSnapshot("kb-stable-height");
  });

  it("should match F-Keys layout", async () => {
    const kb = await getKeyboard("kb-fkeys");
    await expect(kb).toMatchElementSnapshot("kb-fkeys");
  });

  it("should match Nav layout", async () => {
    const kb = await getKeyboard("kb-nav");
    await expect(kb).toMatchElementSnapshot("kb-nav");
  });

  it("should match QWERTY with F-Key row", async () => {
    const kb = await getKeyboard("kb-qwerty-fk");
    await expect(kb).toMatchElementSnapshot("kb-qwerty-fk");
  });

  it("should match QWERTZ-DE with F-Key row", async () => {
    const kb = await getKeyboard("kb-qwertz-de-fk");
    await expect(kb).toMatchElementSnapshot("kb-qwertz-de-fk");
  });

  it("should match QWERTY with Nav row", async () => {
    const kb = await getKeyboard("kb-qwerty-nav");
    await expect(kb).toMatchElementSnapshot("kb-qwerty-nav");
  });

  it("should match QWERTZ-DE with Nav row", async () => {
    const kb = await getKeyboard("kb-qwertz-de-nav");
    await expect(kb).toMatchElementSnapshot("kb-qwertz-de-nav");
  });

  it("should match glyph stress layout in a narrow container", async () => {
    const kb = await getKeyboard("kb-glyph-stress");
    await expect(kb).toMatchElementSnapshot("kb-glyph-stress");
  });

  it("should match height-constrained container (400x250)", async () => {
    const container = await $("#kb-height-constrained");
    await expect(container).toMatchElementSnapshot("kb-height-constrained", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match severely height-constrained container (400x180)", async () => {
    const container = await $("#kb-height-tiny");
    await expect(container).toMatchElementSnapshot("kb-height-tiny", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match ancestor-constrained container (flex parent 400x250)", async () => {
    const wrap = await $("#kb-ancestor-constrained-wrap");
    await expect(wrap).toMatchElementSnapshot("kb-ancestor-constrained", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match ancestor-constrained severely (flex parent 400x180)", async () => {
    const wrap = await $("#kb-ancestor-tiny-wrap");
    await expect(wrap).toMatchElementSnapshot("kb-ancestor-tiny", HEIGHT_SNAPSHOT_OPTIONS);
  });
});

describe("KioskKeyboard Interactive States", () => {
  before(async () => {
    await openVisualPage();
  });

  it("should match key hover state", async () => {
    const kb = await getKeyboard("kb-qwerty");
    await forceHoverState('#kb-qwerty [data-key="f"]');
    try {
      await expect(kb).toMatchElementSnapshot("kb-key-hovered");
    } finally {
      await clearForcedHoverState('#kb-qwerty [data-key="f"]');
    }
  });

  it("should match Shift active state", async () => {
    const kb = await getKeyboard("kb-shift");
    const shiftKey = await kb.$('[data-key="\\{shift\\}"]');
    await shiftKey.click();
    // Wait for the shift key to reflect active state (aria-pressed="true")
    await shiftKey.waitUntil(async () => (await shiftKey.getAttribute("aria-pressed")) === "true", {
      timeout: 3_000,
      timeoutMsg: "Shift key did not become active",
    });
    // Move the pointer off the shift key so the snapshot is deterministic
    // (WebDriver click leaves the cursor on the key, causing :hover)
    await $("body").moveTo({ xOffset: 0, yOffset: 0 });
    await expect(kb).toMatchElementSnapshot("kb-shift-active");
  });

  it("should match docked mode", async () => {
    const toggleBtn = await $("#toggle-docked");
    await toggleBtn.click();
    const dockedKb = await $("#kb-docked .ui5KioskKeyboard");
    await dockedKb.waitForDisplayed({ timeout: 5_000 });
    await expect(dockedKb).toMatchElementSnapshot("kb-docked");
  });
});
