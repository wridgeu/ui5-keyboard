import { test, expect } from "@playwright/test";
import { openPage, keyboardRoot, key, CLOSED_CLASS } from "./helpers.js";

// Layout + interactive visual regression (desktop + device matrix). Hover is
// gated at runtime; shift/docked are activated through the public API.

const CLOSED = new RegExp(CLOSED_CLASS);
// Interactive/shifted states render with minor sub-pixel variance under device
// emulation. A small pixel tolerance lets them stabilize while staying tight
// enough to still catch a real one-key change.
const SOFT = { maxDiffPixelRatio: 0.003 };

test.beforeEach(async ({ page }) => {
  await openPage(page);
});

const LAYOUTS = [
  "kb-qwerty",
  "kb-with-input",
  "kb-numpad",
  "kb-numeric",
  "kb-disabled",
  "kb-compact",
  "kb-special",
  "kb-fkeys",
  "kb-nav",
  "kb-qwerty-nav",
  "kb-glyph-stress",
  "kb-ja-romaji",
  "kb-ja-kana",
  "kb-arabic",
  "kb-ko-hangul",
  "kb-indic-stress",
  "kb-qwerty-es",
];

for (const id of LAYOUTS) {
  test(id, async ({ page }) => {
    await expect(keyboardRoot(page, id)).toHaveScreenshot(`${id}.png`);
  });
}

// Phone emulation renders the docked-open and Spanish-shifted states
// non-deterministically (sub-pixel jitter beyond a sane diff tolerance). Those
// two tags are covered on desktop + tablet instead.
const PHONES = ["phone-sm", "phone-md", "phone-lg"];

// Shifted layouts: activate shift via the key, then snapshot.
for (const id of ["kb-ja-kana", "kb-ko-hangul", "kb-qwerty-es"]) {
  test(`${id}-shifted`, async ({ page }, testInfo) => {
    test.skip(id === "kb-qwerty-es" && PHONES.includes(testInfo.project.name), "unstable under phone emulation");
    await key(page, id, "{shift}").click();
    await expect(key(page, id, "{shift}")).toHaveAttribute("aria-pressed", "true");
    await expect(keyboardRoot(page, id)).toHaveScreenshot(`${id}-shifted.png`, SOFT);
  });
}

test.describe("Interactive States", () => {
  test("kb-key-hovered", async ({ page }) => {
    test.skip(!(await page.evaluate(() => matchMedia("(hover: hover)").matches)), "no hover on this device profile");
    await page.locator('#kb-qwerty [data-key="f"]').hover();
    await expect(keyboardRoot(page, "kb-qwerty")).toHaveScreenshot("kb-key-hovered.png");
  });

  test("kb-shift-active", async ({ page }) => {
    await key(page, "kb-shift", "{shift}").click();
    await expect(key(page, "kb-shift", "{shift}")).toHaveAttribute("aria-pressed", "true");
    // Park the cursor away so it does not introduce a hover artifact.
    await page.mouse.move(0, 0);
    await expect(keyboardRoot(page, "kb-shift")).toHaveScreenshot("kb-shift-active.png", SOFT);
  });

  test("kb-docked", async ({ page }, testInfo) => {
    test.skip(PHONES.includes(testInfo.project.name), "docked render unstable under phone emulation");
    // Open via the UI5 element API: a DOM click on the toggle hangs under
    // Chrome mobile emulation (pointer: coarse).
    await page.evaluate(() => {
      const dom = document.querySelector("#kb-docked .ui5KioskKeyboard");
      if (!dom) return;
      const sapGlobal = (window as unknown as { sap?: { ui?: { require(dep: string): unknown } } }).sap;
      const Elem = sapGlobal?.ui?.require("sap/ui/core/Element") as
        | { getElementById?(id: string): { show?(): void } | undefined }
        | undefined;
      Elem?.getElementById?.(dom.id)?.show?.();
    });
    await expect(keyboardRoot(page, "kb-docked")).not.toHaveClass(CLOSED);
    // Wait for the docked keys to finish rendering before snapshotting.
    await page.locator('#kb-docked [role="button"]').first().waitFor();
    await expect(keyboardRoot(page, "kb-docked")).toHaveScreenshot("kb-docked.png", SOFT);
  });
});
