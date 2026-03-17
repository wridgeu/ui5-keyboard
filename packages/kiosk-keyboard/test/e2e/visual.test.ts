import { $, browser } from "@wdio/globals";
import {
  openVisualPage,
  getKeyboard,
  getViewportWidth,
  isolateSection,
  restoreSections,
  scrollElementIntoView,
  matchElementSnapshotInSection,
  forceHoverState,
  clearForcedHoverState,
} from "./test-helpers.js";

const HEIGHT_SNAPSHOT_OPTIONS = { ignoreAntialiasing: true } as const;

const NARROW_CONTAINER_VIEWPORT_MIN = 340;
const FIXED_400_VIEWPORT_MIN = 420;
const FIXED_600_VIEWPORT_MIN = 620;

describe("KioskKeyboard Visual Regression", () => {
  before(async () => {
    await openVisualPage();
  });

  it("should match QWERTY layout", async () => {
    const kb = await getKeyboard("kb-qwerty");
    await matchElementSnapshotInSection(kb, "kb-qwerty");
  });

  it("should match keyboard with input target", async () => {
    const kb = await getKeyboard("kb-with-input");
    await matchElementSnapshotInSection(kb, "kb-with-input");
  });

  it("should match Numpad layout", async () => {
    const kb = await getKeyboard("kb-numpad");
    await matchElementSnapshotInSection(kb, "kb-numpad");
  });

  it("should match Numeric layout", async () => {
    const kb = await getKeyboard("kb-numeric");
    await matchElementSnapshotInSection(kb, "kb-numeric");
  });

  it("should match disabled state", async () => {
    const kb = await getKeyboard("kb-disabled");
    await matchElementSnapshotInSection(kb, "kb-disabled");
  });

  it("should match full width (600px) layout", async function () {
    if ((await getViewportWidth()) < FIXED_600_VIEWPORT_MIN) this.skip();
    const kb = await getKeyboard("kb-wide");
    await matchElementSnapshotInSection(kb, "kb-wide");
  });

  it("should match narrow (320px) layout", async function () {
    if ((await getViewportWidth()) < NARROW_CONTAINER_VIEWPORT_MIN) this.skip();
    const kb = await getKeyboard("kb-narrow");
    await matchElementSnapshotInSection(kb, "kb-narrow");
  });

  it("should match compact density", async () => {
    const kb = await getKeyboard("kb-compact");
    await matchElementSnapshotInSection(kb, "kb-compact");
  });

  it("should match special characters layout", async () => {
    const kb = await getKeyboard("kb-special");
    await matchElementSnapshotInSection(kb, "kb-special");
  });

  it("should match keyboard in fixed container (400x350)", async function () {
    if ((await getViewportWidth()) < FIXED_400_VIEWPORT_MIN) this.skip();
    const container = await $("#kb-container-fixed");
    await matchElementSnapshotInSection(container, "kb-container-fixed");
  });

  it("should match keyboard with stableHeight", async function () {
    if ((await getViewportWidth()) < FIXED_400_VIEWPORT_MIN) this.skip();
    const kb = await getKeyboard("kb-stable-height");
    await matchElementSnapshotInSection(kb, "kb-stable-height");
  });

  it("should match F-Keys layout", async () => {
    const kb = await getKeyboard("kb-fkeys");
    await matchElementSnapshotInSection(kb, "kb-fkeys");
  });

  it("should match Nav layout", async () => {
    const kb = await getKeyboard("kb-nav");
    await matchElementSnapshotInSection(kb, "kb-nav");
  });

  it("should match QWERTY with F-Key row", async () => {
    const kb = await getKeyboard("kb-qwerty-fk");
    await matchElementSnapshotInSection(kb, "kb-qwerty-fk");
  });

  it("should match QWERTZ-DE with F-Key row", async () => {
    const kb = await getKeyboard("kb-qwertz-de-fk");
    await matchElementSnapshotInSection(kb, "kb-qwertz-de-fk");
  });

  it("should match QWERTY with Nav row", async () => {
    const kb = await getKeyboard("kb-qwerty-nav");
    await matchElementSnapshotInSection(kb, "kb-qwerty-nav");
  });

  it("should match QWERTZ-DE with Nav row", async () => {
    const kb = await getKeyboard("kb-qwertz-de-nav");
    await matchElementSnapshotInSection(kb, "kb-qwertz-de-nav");
  });

  it("should match glyph stress layout in a narrow container", async function () {
    if ((await getViewportWidth()) < NARROW_CONTAINER_VIEWPORT_MIN) this.skip();
    const kb = await getKeyboard("kb-glyph-stress");
    await matchElementSnapshotInSection(kb, "kb-glyph-stress");
  });

  it("should match height-constrained container (400x250)", async function () {
    if ((await getViewportWidth()) < FIXED_400_VIEWPORT_MIN) this.skip();
    const container = await $("#kb-height-constrained");
    await matchElementSnapshotInSection(container, "kb-height-constrained", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match severely height-constrained container (400x180)", async function () {
    if ((await getViewportWidth()) < FIXED_400_VIEWPORT_MIN) this.skip();
    const container = await $("#kb-height-tiny");
    await matchElementSnapshotInSection(container, "kb-height-tiny", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match ancestor-constrained container (flex parent 400x250)", async function () {
    if ((await getViewportWidth()) < FIXED_400_VIEWPORT_MIN) this.skip();
    const wrap = await $("#kb-ancestor-constrained-wrap");
    await matchElementSnapshotInSection(wrap, "kb-ancestor-constrained", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match ancestor-constrained severely (flex parent 400x180)", async function () {
    if ((await getViewportWidth()) < FIXED_400_VIEWPORT_MIN) this.skip();
    const wrap = await $("#kb-ancestor-tiny-wrap");
    await matchElementSnapshotInSection(wrap, "kb-ancestor-tiny", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match narrow + height-constrained container (320px x 250px)", async function () {
    if ((await getViewportWidth()) < NARROW_CONTAINER_VIEWPORT_MIN) this.skip();
    const container = await $("#kb-narrow-short");
    await matchElementSnapshotInSection(container, "kb-narrow-short", HEIGHT_SNAPSHOT_OPTIONS);
  });
});

describe("KioskKeyboard Interactive States", () => {
  before(async () => {
    await openVisualPage();
  });

  it("should match key hover state", async () => {
    const kb = await getKeyboard("kb-qwerty");
    await isolateSection(kb);
    try {
      await scrollElementIntoView(kb);
      await forceHoverState('#kb-qwerty [data-key="f"]');
      await matchElementSnapshotInSection(kb, "kb-key-hovered");
    } finally {
      await clearForcedHoverState('#kb-qwerty [data-key="f"]');
      await restoreSections();
    }
  });

  it("should match Shift active state", async () => {
    const kb = await getKeyboard("kb-shift");
    const shiftKey = await kb.$('[data-key="\\{shift\\}"]');
    await shiftKey.click();
    await shiftKey.waitUntil(async () => (await shiftKey.getAttribute("aria-pressed")) === "true", {
      timeout: 3_000,
      timeoutMsg: "Shift key did not become active",
    });
    await $("body").moveTo({ xOffset: 0, yOffset: 0 });

    try {
      await matchElementSnapshotInSection(kb, "kb-shift-active");
    } finally {
      await shiftKey.click();
      await shiftKey.click();
    }
  });

  it("should match docked mode", async () => {
    const isCoarse = await browser.execute(() => window.matchMedia("(pointer: coarse)").matches);
    if (isCoarse) {
      return;
    }

    const toggleBtn = await $("#toggle-docked");
    await isolateSection(toggleBtn);
    try {
      await scrollElementIntoView(toggleBtn);
      await browser.execute(() => {
        (document.getElementById("toggle-docked") as HTMLButtonElement | null)?.click();
      });
      const dockedKb = await $("#kb-docked .ui5KioskKeyboard");
      await dockedKb.waitForDisplayed({ timeout: 5_000 });
      await browser.waitUntil(
        async () => !(await dockedKb.getAttribute("class"))?.includes("ui5KioskKeyboard--closed"),
        { timeout: 3_000, timeoutMsg: "Docked keyboard did not open" },
      );
      await browser.execute(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      });
      await matchElementSnapshotInSection(dockedKb, "kb-docked");
    } finally {
      await restoreSections();
    }
  });
});
