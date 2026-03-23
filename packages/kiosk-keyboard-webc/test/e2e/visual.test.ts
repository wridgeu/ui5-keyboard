import { browser, expect } from "@wdio/globals";
import {
  openVisualPage,
  getKeyboardRoot,
  forceHoverState,
  clearForcedHoverState,
  matchElementSnapshotInSection,
  waitForDockedKeyboardOpen,
  waitForDockedKeyboardClosed,
} from "./test-helpers.js";

describe("KioskKeyboard Web Component - Visual Regression", () => {
  before(async () => {
    await openVisualPage();
  });

  it("should match QWERTY layout", async () => {
    const kb = await getKeyboardRoot("kb-qwerty");
    await matchElementSnapshotInSection(kb, "webc-qwerty");
  });

  it("should match keyboard with input target", async () => {
    const kb = await getKeyboardRoot("kb-with-input");
    await matchElementSnapshotInSection(kb, "webc-with-input");
  });

  it("should match Numpad layout", async () => {
    const kb = await getKeyboardRoot("kb-numpad");
    await matchElementSnapshotInSection(kb, "webc-numpad");
  });

  it("should match Numeric layout", async () => {
    const kb = await getKeyboardRoot("kb-numeric");
    await matchElementSnapshotInSection(kb, "webc-numeric");
  });

  it("should match disabled state", async () => {
    const kb = await getKeyboardRoot("kb-disabled");
    await matchElementSnapshotInSection(kb, "webc-disabled");
  });

  it("should match QWERTZ-DE layout", async () => {
    const kb = await getKeyboardRoot("kb-qwertz-de");
    await matchElementSnapshotInSection(kb, "webc-qwertz-de");
  });

  it("should match F-Keys layout", async () => {
    const kb = await getKeyboardRoot("kb-fkeys");
    await matchElementSnapshotInSection(kb, "webc-fkeys");
  });

  it("should match Nav layout", async () => {
    const kb = await getKeyboardRoot("kb-nav");
    await matchElementSnapshotInSection(kb, "webc-nav");
  });

  it("should match QWERTY with F-Key row", async () => {
    const kb = await getKeyboardRoot("kb-qwerty-fk");
    await matchElementSnapshotInSection(kb, "webc-qwerty-fk");
  });

  it("should match QWERTZ-DE with F-Key row", async () => {
    const kb = await getKeyboardRoot("kb-qwertz-de-fk");
    await matchElementSnapshotInSection(kb, "webc-qwertz-de-fk");
  });

  it("should match QWERTY with Nav row", async () => {
    const kb = await getKeyboardRoot("kb-qwerty-nav");
    await matchElementSnapshotInSection(kb, "webc-qwerty-nav");
  });

  it("should match QWERTZ-DE with Nav row", async () => {
    const kb = await getKeyboardRoot("kb-qwertz-de-nav");
    await matchElementSnapshotInSection(kb, "webc-qwertz-de-nav");
  });

  it("should match consumer part styling via ::part()", async () => {
    const kb = await getKeyboardRoot("kb-part-styled");
    await matchElementSnapshotInSection(kb, "webc-part-styled");
  });
});

describe("KioskKeyboard Web Component - Interactive States", () => {
  before(async () => {
    await openVisualPage();
  });

  it("should match key hover state", async function () {
    const supportsHover = await browser.execute(() => window.matchMedia("(hover: hover)").matches);
    if (!supportsHover) return this.skip();

    const kb = await getKeyboardRoot("kb-qwerty");
    await forceHoverState("kb-qwerty", '[data-key="f"]');
    try {
      await matchElementSnapshotInSection(kb, "webc-key-hovered");
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
      await matchElementSnapshotInSection(kb, "webc-qwerty-shifted");
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

    const dockedState = await waitForDockedKeyboardOpen("kb-docked");
    expect(dockedState.open).toBe(true);
    expect(dockedState.hiddenClass).toBe(false);

    const kb = await getKeyboardRoot("kb-docked");
    try {
      await matchElementSnapshotInSection(kb, "webc-docked-open");
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

    const dockedState = await waitForDockedKeyboardClosed("kb-docked");
    expect(dockedState.open).toBe(false);
    expect(dockedState.hiddenClass).toBe(true);
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

    try {
      const dockedState = await waitForDockedKeyboardOpen("kb-docked-custom");
      expect(dockedState.open).toBe(true);
      expect(dockedState.hiddenClass).toBe(false);
    } finally {
      await browser.execute(() => {
        const kb = document.getElementById("kb-docked-custom") as HTMLElement & { close(): void };
        kb.close();
      });
    }
  });
});
