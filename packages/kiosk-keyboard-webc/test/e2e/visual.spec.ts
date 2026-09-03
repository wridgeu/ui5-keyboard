import { test, expect } from "@playwright/test";
import {
  openPage,
  keyboardRoot,
  expectVisualMatch,
  key,
  isHoverCapable,
  isCoarsePointer,
  waitForDockedOpen,
  waitForDockedClosed,
  waitForDockedShown,
} from "./helpers.js";

// Visual regression for every layout plus interactive states. Runs on desktop
// and the device matrix; hover/pointer-specific cases gate at runtime so a
// single spec produces the right snapshot set per project.

async function activateShift(page: import("@playwright/test").Page, hostId: string): Promise<void> {
  await key(page, hostId, "{shift}").click();
  await expect(key(page, hostId, "{shift}")).toHaveAttribute("aria-pressed", "true");
}

/** From the shifted state, two more taps (shifted -> caps -> off) return to base. */
async function resetShift(page: import("@playwright/test").Page, hostId: string): Promise<void> {
  await key(page, hostId, "{shift}").click();
  await key(page, hostId, "{shift}").click();
}

test.beforeEach(async ({ page }) => {
  await openPage(page, "/test/pages/visual.html");
});

test.describe("Visual Regression", () => {
  for (const { id, tag } of [
    { id: "kb-qwerty", tag: "webc-qwerty" },
    { id: "kb-accent-variants", tag: "webc-accent-variants" },
    { id: "kb-with-input", tag: "webc-with-input" },
    { id: "kb-numpad", tag: "webc-numpad" },
    { id: "kb-numeric", tag: "webc-numeric" },
    { id: "kb-disabled", tag: "webc-disabled" },
    { id: "kb-qwertz-de", tag: "webc-qwertz-de" },
    { id: "kb-fkeys", tag: "webc-fkeys" },
    { id: "kb-nav", tag: "webc-nav" },
    { id: "kb-qwerty-nav", tag: "webc-qwerty-nav" },
    { id: "kb-qwerty-nav-compact", tag: "webc-qwerty-nav-compact" },
    { id: "kb-qwerty-fk", tag: "webc-qwerty-fk" },
    { id: "kb-qwerty-fk-compact", tag: "webc-qwerty-fk-compact" },
    { id: "kb-part-styled", tag: "webc-part-styled" },
    { id: "kb-ja-romaji", tag: "webc-ja-romaji" },
    { id: "kb-ja-kana", tag: "webc-ja-kana" },
    { id: "kb-ja-kana-compact", tag: "webc-ja-kana-compact" },
    { id: "kb-arabic", tag: "webc-arabic" },
    { id: "kb-icon-label-variations", tag: "webc-icon-label-variations" },
    { id: "kb-ko-hangul", tag: "webc-ko-hangul" },
    { id: "kb-indic-stress", tag: "webc-indic-stress" },
    { id: "kb-qwerty-es", tag: "webc-qwerty-es" },
  ]) {
    test(tag, async ({ page }) => {
      await expectVisualMatch(keyboardRoot(page, id), `${tag}.png`);
    });
  }

  for (const { id, tag } of [
    { id: "kb-ja-kana", tag: "webc-ja-kana-shifted" },
    { id: "kb-ko-hangul", tag: "webc-ko-hangul-shifted" },
    { id: "kb-qwerty-es", tag: "webc-qwerty-es-shifted" },
  ]) {
    test(tag, async ({ page }) => {
      await activateShift(page, id);
      await expectVisualMatch(keyboardRoot(page, id), `${tag}.png`);
      await resetShift(page, id);
    });
  }
});

test.describe("Interactive States", () => {
  test("webc-key-hovered", async ({ page }) => {
    test.skip(!(await isHoverCapable(page)), "no hover support on this device profile");
    await key(page, "kb-qwerty", "f").hover();
    await expectVisualMatch(keyboardRoot(page, "kb-qwerty"), "webc-key-hovered.png");
  });

  test("webc-qwerty-shifted", async ({ page }) => {
    await activateShift(page, "kb-qwerty");
    await expectVisualMatch(keyboardRoot(page, "kb-qwerty"), "webc-qwerty-shifted.png");
    await resetShift(page, "kb-qwerty");
  });

  test("webc-docked-open", async ({ page }) => {
    test.skip(await isCoarsePointer(page), "docked auto-stays-closed on coarse pointers");
    await page.evaluate(() => (document.getElementById("kb-docked") as HTMLElement & { show(): void }).show());
    const state = await waitForDockedOpen(page, "kb-docked");
    expect(state.open).toBe(true);
    expect(state.hiddenClass).toBe(false);
    await expectVisualMatch(keyboardRoot(page, "kb-docked"), "webc-docked-open.png");
    await page.evaluate(() => (document.getElementById("kb-docked") as HTMLElement & { close(): void }).close());
  });

  test("webc-docked-disabled", async ({ page }) => {
    test.skip(await isCoarsePointer(page), "docked auto-stays-closed on coarse pointers");
    await page.evaluate(() => (document.getElementById("kb-docked-disabled") as HTMLElement & { show(): void }).show());
    await waitForDockedShown(page, "kb-docked-disabled");
    await expectVisualMatch(keyboardRoot(page, "kb-docked-disabled"), "webc-docked-disabled.png");
    await page.evaluate(() =>
      (document.getElementById("kb-docked-disabled") as HTMLElement & { close(): void }).close(),
    );
  });

  test("keeps docked closed on coarse pointers", async ({ page }) => {
    test.skip(!(await isCoarsePointer(page)), "coarse-pointer behavior only");
    await page.evaluate(() => (document.getElementById("kb-docked") as HTMLElement & { show(): void }).show());
    const state = await waitForDockedClosed(page, "kb-docked");
    expect(state.open).toBe(false);
    expect(state.hiddenClass).toBe(true);
  });

  test("opens docked with mobile-keyboard Custom on coarse pointers", async ({ page }) => {
    test.skip(!(await isCoarsePointer(page)), "coarse-pointer behavior only");
    await page.evaluate(() => (document.getElementById("kb-docked-custom") as HTMLElement & { show(): void }).show());
    const state = await waitForDockedOpen(page, "kb-docked-custom");
    expect(state.open).toBe(true);
    expect(state.hiddenClass).toBe(false);
    await page.evaluate(() => (document.getElementById("kb-docked-custom") as HTMLElement & { close(): void }).close());
  });
});

// The icon-label fixture names SAP icons the component does not import for
// itself; the consumer contract is that the page imports every icon module it
// names. CI compares no pixels, so the baseline cannot catch a blank keycap.
test.describe("Icon Resolution", () => {
  test("resolves every SAP icon the icon-label fixture names", async ({ page }) => {
    const icons = keyboardRoot(page, "kb-icon-label-variations").locator("ui5-icon");
    await expect(icons).toHaveCount(6);
    for (const icon of await icons.all()) {
      await expect(icon).not.toHaveAttribute("invalid");
      const box = await icon.boundingBox();
      expect(box?.width).toBeGreaterThan(0);
      expect(box?.height).toBeGreaterThan(0);
    }
  });
});
