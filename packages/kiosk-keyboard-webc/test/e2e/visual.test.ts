import { $, browser, expect } from "@wdio/globals";
import {
  openVisualPage,
  getKeyboardRoot,
  forceHoverState,
  clearForcedHoverState,
  matchElementSnapshotSafely,
} from "./test-helpers.js";

const HEIGHT_SNAPSHOT_OPTIONS = { ignoreAntialiasing: true } as const;

describe("KioskKeyboard Web Component - Visual Regression", () => {
  before(async () => {
    await openVisualPage();
  });

  it("should match QWERTY layout", async () => {
    const kb = await getKeyboardRoot("kb-qwerty");
    await matchElementSnapshotSafely(kb, "webc-qwerty");
  });

  it("should match keyboard with input target", async () => {
    const kb = await getKeyboardRoot("kb-with-input");
    await matchElementSnapshotSafely(kb, "webc-with-input");
  });

  it("should match Numpad layout", async () => {
    const kb = await getKeyboardRoot("kb-numpad");
    await matchElementSnapshotSafely(kb, "webc-numpad");
  });

  it("should match Numeric layout", async () => {
    const kb = await getKeyboardRoot("kb-numeric");
    await matchElementSnapshotSafely(kb, "webc-numeric");
  });

  it("should match disabled state", async () => {
    const kb = await getKeyboardRoot("kb-disabled");
    await matchElementSnapshotSafely(kb, "webc-disabled");
  });

  it("should match QWERTZ-DE layout", async () => {
    const kb = await getKeyboardRoot("kb-qwertz-de");
    await matchElementSnapshotSafely(kb, "webc-qwertz-de");
  });

  it("should match narrow container (320px)", async () => {
    const kb = await getKeyboardRoot("kb-narrow");
    await matchElementSnapshotSafely(kb, "webc-narrow");
  });

  it("should match F-Keys layout", async () => {
    const kb = await getKeyboardRoot("kb-fkeys");
    await matchElementSnapshotSafely(kb, "webc-fkeys");
  });

  it("should match Nav layout", async () => {
    const kb = await getKeyboardRoot("kb-nav");
    await matchElementSnapshotSafely(kb, "webc-nav");
  });

  it("should match QWERTY with F-Key row", async () => {
    const kb = await getKeyboardRoot("kb-qwerty-fk");
    await matchElementSnapshotSafely(kb, "webc-qwerty-fk");
  });

  it("should match QWERTZ-DE with F-Key row", async () => {
    const kb = await getKeyboardRoot("kb-qwertz-de-fk");
    await matchElementSnapshotSafely(kb, "webc-qwertz-de-fk");
  });

  it("should match QWERTY with Nav row", async () => {
    const kb = await getKeyboardRoot("kb-qwerty-nav");
    await matchElementSnapshotSafely(kb, "webc-qwerty-nav");
  });

  it("should match QWERTZ-DE with Nav row", async () => {
    const kb = await getKeyboardRoot("kb-qwertz-de-nav");
    await matchElementSnapshotSafely(kb, "webc-qwertz-de-nav");
  });

  it("should match glyph stress layout in a narrow container", async () => {
    const kb = await getKeyboardRoot("kb-glyph-stress");
    await matchElementSnapshotSafely(kb, "webc-glyph-stress");
  });

  it("should match height-constrained container (250px)", async () => {
    const kb = await getKeyboardRoot("kb-height-constrained");
    await matchElementSnapshotSafely(kb, "webc-height-constrained", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match severely height-constrained container (180px)", async () => {
    const kb = await getKeyboardRoot("kb-height-tiny");
    await matchElementSnapshotSafely(kb, "webc-height-tiny", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match ancestor-constrained container (flex parent 250px)", async () => {
    const wrap = await $("#kb-ancestor-constrained-wrap");
    await matchElementSnapshotSafely(wrap, "webc-ancestor-constrained", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match ancestor-constrained severely (flex parent 180px)", async () => {
    const wrap = await $("#kb-ancestor-tiny-wrap");
    await matchElementSnapshotSafely(wrap, "webc-ancestor-tiny", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match height-constrained host with padding and border", async () => {
    const kb = await getKeyboardRoot("kb-height-padded-host");
    await matchElementSnapshotSafely(kb, "webc-height-padded-host", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match narrow + height-constrained container (320px x 250px)", async () => {
    const kb = await getKeyboardRoot("kb-narrow-short");
    await matchElementSnapshotSafely(kb, "webc-narrow-short", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match consumer part styling via ::part()", async () => {
    const kb = await getKeyboardRoot("kb-part-styled");
    await matchElementSnapshotSafely(kb, "webc-part-styled");
  });

  it("should match custom threshold override (cq-short at 18rem)", async () => {
    const kb = await getKeyboardRoot("kb-custom-threshold");
    await matchElementSnapshotSafely(kb, "webc-custom-threshold", HEIGHT_SNAPSHOT_OPTIONS);
  });
});

describe("KioskKeyboard Web Component - Interactive States", () => {
  before(async () => {
    await openVisualPage();
  });

  it("should match key hover state", async () => {
    const kb = await getKeyboardRoot("kb-qwerty");
    await forceHoverState("kb-qwerty", '[data-key="f"]');
    try {
      await matchElementSnapshotSafely(kb, "webc-key-hovered");
    } finally {
      await clearForcedHoverState("kb-qwerty", '[data-key="f"]');
    }
  });

  it("should match Shift active state", async () => {
    // Click shift on the QWERTY keyboard
    const shiftKey = await browser.execute(() => {
      const kb = document.getElementById("kb-qwerty");
      const shift = kb?.shadowRoot?.querySelector('[data-key="\\{shift\\}"]') as HTMLElement | null;
      shift?.click();
      return !!shift;
    });
    expect(shiftKey).toBe(true);

    // Wait for the shift key to reflect active state (aria-pressed="true")
    await browser.waitUntil(
      async () =>
        browser.execute(() => {
          const kb = document.getElementById("kb-qwerty");
          const shift = kb?.shadowRoot?.querySelector('[data-key="\\{shift\\}"]');
          return shift?.getAttribute("aria-pressed") === "true";
        }),
      { timeout: 3_000, timeoutMsg: "Shift key did not become active" },
    );

    const kb = await getKeyboardRoot("kb-qwerty");
    try {
      await matchElementSnapshotSafely(kb, "webc-qwerty-shifted");
    } finally {
      // Reset shift - click twice to cycle through caps lock back to off
      await browser.execute(() => {
        const kb = document.getElementById("kb-qwerty");
        const shift = kb?.shadowRoot?.querySelector('[data-key="\\{shift\\}"]') as HTMLElement | null;
        shift?.click();
        shift?.click();
      });
    }
  });

  it("should match docked mode open", async function () {
    // Docked keyboards defer to native input on touch devices (pointer: coarse),
    // so .show() intentionally does not open the on-screen keyboard.
    const isCoarse = await browser.execute(() => window.matchMedia("(pointer: coarse)").matches);
    if (isCoarse) {
      this.skip();
      return;
    }

    // Open the docked keyboard
    await browser.execute(() => {
      const kb = document.getElementById("kb-docked") as HTMLElement & { show(): void };
      kb.show();
    });

    const kb = await getKeyboardRoot("kb-docked");
    await kb.waitForDisplayed({ timeout: 5_000 });
    try {
      await matchElementSnapshotSafely(kb, "webc-docked-open");
    } finally {
      await browser.execute(() => {
        const kb = document.getElementById("kb-docked") as HTMLElement & { close(): void };
        kb.close();
      });
    }
  });

  it("should keep docked mode closed on coarse pointers", async function () {
    const isCoarse = await browser.execute(() => window.matchMedia("(pointer: coarse)").matches);
    if (!isCoarse) {
      this.skip();
      return;
    }

    await browser.execute(() => {
      const kb = document.getElementById("kb-docked") as HTMLElement & { show(): void };
      kb.show();
    });

    const classes = await browser.execute(() => {
      const root = document.getElementById("kb-docked")?.shadowRoot?.querySelector(".kiosk-keyboard");
      return root?.className ?? "";
    });

    expect(classes).toContain("kiosk-keyboard--hidden");
  });

  it("should open docked keyboard with mobile-keyboard='Custom' on coarse pointers", async function () {
    const isCoarse = await browser.execute(() => window.matchMedia("(pointer: coarse)").matches);
    if (!isCoarse) {
      this.skip();
      return;
    }

    await browser.execute(() => {
      const kb = document.getElementById("kb-docked-custom") as HTMLElement & { show(): void };
      kb.show();
    });

    const kb = await getKeyboardRoot("kb-docked-custom");
    await kb.waitForDisplayed({ timeout: 5_000 });

    // Clean up
    await browser.execute(() => {
      const kb = document.getElementById("kb-docked-custom") as HTMLElement & { close(): void };
      kb.close();
    });
  });
});
