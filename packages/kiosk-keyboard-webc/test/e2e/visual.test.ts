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

  it("should match Japanese Romaji layout", async () => {
    const kb = await getKeyboardRoot("kb-ja-romaji");
    await matchElementSnapshotInSection(kb, "webc-ja-romaji");
  });

  it("should match Japanese Kana layout", async () => {
    const kb = await getKeyboardRoot("kb-ja-kana");
    await matchElementSnapshotInSection(kb, "webc-ja-kana");
  });

  it("should match Japanese Kana shifted layout", async () => {
    const shifted = await browser.execute(() => {
      const kb = document.getElementById("kb-ja-kana");
      const shift = kb?.shadowRoot?.querySelector('[data-key="\\{shift\\}"]') as HTMLElement | null;
      shift?.click();
      return !!shift;
    });
    expect(shifted).toBe(true);
    await browser.waitUntil(
      async () =>
        browser.execute(() => {
          const kb = document.getElementById("kb-ja-kana");
          return kb?.shadowRoot?.querySelector('[data-key="\\{shift\\}"]')?.getAttribute("aria-pressed") === "true";
        }),
      { timeout: 3_000, timeoutMsg: "Shift key did not become active" },
    );
    const kb = await getKeyboardRoot("kb-ja-kana");
    try {
      await matchElementSnapshotInSection(kb, "webc-ja-kana-shifted");
    } finally {
      await browser.execute(() => {
        const kb = document.getElementById("kb-ja-kana");
        const shift = kb?.shadowRoot?.querySelector('[data-key="\\{shift\\}"]') as HTMLElement | null;
        shift?.click();
        shift?.click();
      });
    }
  });

  it("should match Arabic layout", async () => {
    const kb = await getKeyboardRoot("kb-arabic");
    await matchElementSnapshotInSection(kb, "webc-arabic");
  });

  it("should match icon + label variations", async () => {
    const kb = await getKeyboardRoot("kb-icon-label-variations");
    await matchElementSnapshotInSection(kb, "webc-icon-label-variations");
  });

  it("should match Korean Hangul layout", async () => {
    const kb = await getKeyboardRoot("kb-ko-hangul");
    await matchElementSnapshotInSection(kb, "webc-ko-hangul");
  });

  it("should match Korean Hangul shifted layout", async () => {
    const shifted = await browser.execute(() => {
      const kb = document.getElementById("kb-ko-hangul");
      const shift = kb?.shadowRoot?.querySelector('[data-key="\\{shift\\}"]') as HTMLElement | null;
      shift?.click();
      return !!shift;
    });
    expect(shifted).toBe(true);
    await browser.waitUntil(
      async () =>
        browser.execute(() => {
          const kb = document.getElementById("kb-ko-hangul");
          return kb?.shadowRoot?.querySelector('[data-key="\\{shift\\}"]')?.getAttribute("aria-pressed") === "true";
        }),
      { timeout: 3_000, timeoutMsg: "Shift key did not become active on ko-hangul" },
    );
    const kb = await getKeyboardRoot("kb-ko-hangul");
    try {
      await matchElementSnapshotInSection(kb, "webc-ko-hangul-shifted");
    } finally {
      await browser.execute(() => {
        const kb = document.getElementById("kb-ko-hangul");
        const shift = kb?.shadowRoot?.querySelector('[data-key="\\{shift\\}"]') as HTMLElement | null;
        shift?.click();
        shift?.click();
      });
    }
  });

  it("should match Indic glyph stress layout", async () => {
    const kb = await getKeyboardRoot("kb-indic-stress");
    await matchElementSnapshotInSection(kb, "webc-indic-stress");
  });

  it("should match Spanish QWERTY-ES layout", async () => {
    const kb = await getKeyboardRoot("kb-qwerty-es");
    await matchElementSnapshotInSection(kb, "webc-qwerty-es");
  });

  it("should match Spanish QWERTY-ES shifted layout", async () => {
    const shifted = await browser.execute(() => {
      const kb = document.getElementById("kb-qwerty-es");
      const shift = kb?.shadowRoot?.querySelector('[data-key="\\{shift\\}"]') as HTMLElement | null;
      shift?.click();
      return !!shift;
    });
    expect(shifted).toBe(true);
    await browser.waitUntil(
      async () =>
        browser.execute(() => {
          const kb = document.getElementById("kb-qwerty-es");
          return kb?.shadowRoot?.querySelector('[data-key="\\{shift\\}"]')?.getAttribute("aria-pressed") === "true";
        }),
      { timeout: 3_000, timeoutMsg: "Shift key did not become active on qwerty-es" },
    );
    const kb = await getKeyboardRoot("kb-qwerty-es");
    try {
      await matchElementSnapshotInSection(kb, "webc-qwerty-es-shifted");
    } finally {
      await browser.execute(() => {
        const kb = document.getElementById("kb-qwerty-es");
        const shift = kb?.shadowRoot?.querySelector('[data-key="\\{shift\\}"]') as HTMLElement | null;
        shift?.click();
        shift?.click();
      });
    }
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

  it("should match docked + disabled mode", async function () {
    const isCoarse = await browser.execute(() => window.matchMedia("(pointer: coarse)").matches);
    if (isCoarse) {
      this.skip();
      return;
    }

    await browser.execute(() => {
      const kb = document.getElementById("kb-docked-disabled") as HTMLElement & { show(): void };
      kb.show();
    });

    // Cannot use waitForDockedKeyboardOpen because it checks pointer-events !== "none",
    // but disabled keyboards intentionally set pointer-events: none. Wait for the
    // hidden class to be removed instead (the keyboard slides in but stays disabled).
    await browser.waitUntil(
      async () =>
        browser.execute((id: string) => {
          const host = document.getElementById(id) as (HTMLElement & { open: boolean }) | null;
          const root = host?.shadowRoot?.querySelector(".kiosk-keyboard");
          return !!host?.open && !root?.classList.contains("kiosk-keyboard--hidden");
        }, "kb-docked-disabled"),
      { timeout: 5_000, timeoutMsg: "Docked disabled keyboard did not open" },
    );

    const kb = await getKeyboardRoot("kb-docked-disabled");
    try {
      await matchElementSnapshotInSection(kb, "webc-docked-disabled");
    } finally {
      await browser.execute(() => {
        const kb = document.getElementById("kb-docked-disabled") as HTMLElement & { close(): void };
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
