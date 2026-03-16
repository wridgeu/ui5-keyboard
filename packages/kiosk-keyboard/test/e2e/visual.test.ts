import { $, browser, expect } from "@wdio/globals";
import type { ChainablePromiseElement } from "webdriverio";
import { openVisualPage, getKeyboard, forceHoverState, clearForcedHoverState } from "./test-helpers.js";

const HEIGHT_SNAPSHOT_OPTIONS = { ignoreAntialiasing: true } as const;
type SnapshotElement = WebdriverIO.Element | ChainablePromiseElement;

async function isolateSection(element: SnapshotElement): Promise<void> {
  const target = await element;
  await browser.execute((el: HTMLElement) => {
    const activeSection = el.closest(".section");
    if (!activeSection) return;

    document.querySelectorAll<HTMLElement>(".section").forEach((section) => {
      if (section === activeSection) return;
      if (!("snapshotPrevDisplay" in section.dataset)) {
        section.dataset.snapshotPrevDisplay = section.style.display;
      }
      section.style.display = "none";
    });
  }, target);
}

async function restoreSections(): Promise<void> {
  await browser.execute(() => {
    document.querySelectorAll<HTMLElement>(".section").forEach((section) => {
      if (!("snapshotPrevDisplay" in section.dataset)) return;
      const previousDisplay = section.dataset.snapshotPrevDisplay ?? "";
      if (previousDisplay) {
        section.style.display = previousDisplay;
      } else {
        section.style.removeProperty("display");
      }
      delete section.dataset.snapshotPrevDisplay;
    });
  });
}

async function scrollElementIntoView(element: SnapshotElement): Promise<void> {
  const target = await element;
  await browser.execute((el: HTMLElement) => {
    el.scrollIntoView({ block: "center", inline: "center" });
  }, target);
}

async function matchSnapshot(
  element: SnapshotElement,
  name: string,
  options?: { ignoreAntialiasing?: boolean },
): Promise<void> {
  const target = await element;
  await isolateSection(target);
  try {
    await scrollElementIntoView(target);
    await browser.executeAsync((done) => requestAnimationFrame(() => done()));
    await expect(target).toMatchElementSnapshot(name, options);
  } finally {
    await restoreSections();
  }
}

describe("KioskKeyboard Visual Regression", () => {
  before(async () => {
    await openVisualPage();
  });

  it("should match QWERTY layout", async () => {
    const kb = await getKeyboard("kb-qwerty");
    await matchSnapshot(kb, "kb-qwerty");
  });

  it("should match keyboard with input target", async () => {
    const kb = await getKeyboard("kb-with-input");
    await matchSnapshot(kb, "kb-with-input");
  });

  it("should match Numpad layout", async () => {
    const kb = await getKeyboard("kb-numpad");
    await matchSnapshot(kb, "kb-numpad");
  });

  it("should match Numeric layout", async () => {
    const kb = await getKeyboard("kb-numeric");
    await matchSnapshot(kb, "kb-numeric");
  });

  it("should match disabled state", async () => {
    const kb = await getKeyboard("kb-disabled");
    await matchSnapshot(kb, "kb-disabled");
  });

  it("should match full width (600px) layout", async () => {
    const kb = await getKeyboard("kb-wide");
    await matchSnapshot(kb, "kb-wide");
  });

  it("should match narrow (320px) layout", async () => {
    const kb = await getKeyboard("kb-narrow");
    await matchSnapshot(kb, "kb-narrow");
  });

  it("should match compact density", async () => {
    const kb = await getKeyboard("kb-compact");
    await matchSnapshot(kb, "kb-compact");
  });

  it("should match special characters layout", async () => {
    const kb = await getKeyboard("kb-special");
    await matchSnapshot(kb, "kb-special");
  });

  it("should match keyboard in fixed container (400x350)", async () => {
    const container = await $("#kb-container-fixed");
    await matchSnapshot(container, "kb-container-fixed");
  });

  it("should match keyboard with stableHeight", async () => {
    const kb = await getKeyboard("kb-stable-height");
    await matchSnapshot(kb, "kb-stable-height");
  });

  it("should match F-Keys layout", async () => {
    const kb = await getKeyboard("kb-fkeys");
    await matchSnapshot(kb, "kb-fkeys");
  });

  it("should match Nav layout", async () => {
    const kb = await getKeyboard("kb-nav");
    await matchSnapshot(kb, "kb-nav");
  });

  it("should match QWERTY with F-Key row", async () => {
    const kb = await getKeyboard("kb-qwerty-fk");
    await matchSnapshot(kb, "kb-qwerty-fk");
  });

  it("should match QWERTZ-DE with F-Key row", async () => {
    const kb = await getKeyboard("kb-qwertz-de-fk");
    await matchSnapshot(kb, "kb-qwertz-de-fk");
  });

  it("should match QWERTY with Nav row", async () => {
    const kb = await getKeyboard("kb-qwerty-nav");
    await matchSnapshot(kb, "kb-qwerty-nav");
  });

  it("should match QWERTZ-DE with Nav row", async () => {
    const kb = await getKeyboard("kb-qwertz-de-nav");
    await matchSnapshot(kb, "kb-qwertz-de-nav");
  });

  it("should match glyph stress layout in a narrow container", async () => {
    const kb = await getKeyboard("kb-glyph-stress");
    await matchSnapshot(kb, "kb-glyph-stress");
  });

  it("should match height-constrained container (400x250)", async () => {
    const container = await $("#kb-height-constrained");
    await matchSnapshot(container, "kb-height-constrained", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match severely height-constrained container (400x180)", async () => {
    const container = await $("#kb-height-tiny");
    await matchSnapshot(container, "kb-height-tiny", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match ancestor-constrained container (flex parent 400x250)", async () => {
    const wrap = await $("#kb-ancestor-constrained-wrap");
    await matchSnapshot(wrap, "kb-ancestor-constrained", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match ancestor-constrained severely (flex parent 400x180)", async () => {
    const wrap = await $("#kb-ancestor-tiny-wrap");
    await matchSnapshot(wrap, "kb-ancestor-tiny", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match narrow + height-constrained container (320px x 250px)", async () => {
    const container = await $("#kb-narrow-short");
    await matchSnapshot(container, "kb-narrow-short", HEIGHT_SNAPSHOT_OPTIONS);
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
      await matchSnapshot(kb, "kb-key-hovered");
    } finally {
      await clearForcedHoverState('#kb-qwerty [data-key="f"]');
      await restoreSections();
    }
  });

  it("should match Shift active state", async () => {
    const kb = await getKeyboard("kb-shift");
    await matchSnapshot(kb, "kb-shift-active");
  });

  it("should match docked mode", async () => {
    const toggleBtn = await $("#toggle-docked");
    await isolateSection(toggleBtn);
    try {
      await scrollElementIntoView(toggleBtn);
      await toggleBtn.click();
      const dockedKb = await $("#kb-docked .ui5KioskKeyboard");
      await dockedKb.waitForDisplayed({ timeout: 5_000 });
      await browser.execute(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      });
      await matchSnapshot(dockedKb, "kb-docked");
    } finally {
      await restoreSections();
    }
  });
});
