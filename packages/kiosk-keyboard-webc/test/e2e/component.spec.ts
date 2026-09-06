import { test, expect } from "@playwright/test";
import { openPage, waitForKeys } from "./helpers.js";

// Behavioral e2e for the <kiosk-keyboard> custom element. Desktop-only (the
// device matrix runs the visual specs). Each test navigates fresh for isolation.

test.beforeEach(async ({ page }) => {
  await openPage(page, "/test/pages/index.html");
});

test.describe("nav layout", () => {
  // Regression for #157: on the wide standalone nav layout the fkey icon was
  // sized clamp(1em, 15cqi, 3em); the 3em cap plus the 1.25em icon box made the
  // icon taller than the 3rem key, so the stacked label was clipped by the
  // dual key's overflow:hidden. The demo grid is single-column (nav keyboard
  // wide, ~297px keys) around a 1000px viewport; at the 1440 desktop default it
  // is multi-column and narrow, so the width is forced here.
  test("nav fkey icon+label stack fits within the key at wide widths", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 900 });
    await waitForKeys(page, "kb-nav");
    const keys = await page.evaluate(() => {
      const root = document.getElementById("kb-nav")?.shadowRoot;
      return Array.from(root?.querySelectorAll("[data-fkey]") ?? []).map((k) => {
        const kr = k.getBoundingClientRect();
        const icon = k.querySelector(".kiosk-key__icon")!.getBoundingClientRect();
        const label = k.querySelector(".kiosk-key__label")!.getBoundingClientRect();
        return {
          label: k.querySelector(".kiosk-key__label")?.textContent ?? "",
          keyW: Math.round(kr.width),
          iconTopClip: +(kr.top - icon.top).toFixed(2),
          labelBottomClip: +(label.bottom - kr.bottom).toFixed(2),
        };
      });
    });
    expect(keys.length).toBe(8);
    // Guard against a vacuous pass: the bug only manifests once keys are wide
    // enough to drive the icon to its cap (and the label is not sr-only hidden,
    // which happens below 7rem key width).
    expect(Math.max(...keys.map((k) => k.keyW))).toBeGreaterThan(250);
    for (const k of keys) {
      expect(k.iconTopClip, `icon overflows top of "${k.label}"`).toBeLessThanOrEqual(0.5);
      expect(k.labelBottomClip, `label clipped at bottom of "${k.label}"`).toBeLessThanOrEqual(0.5);
    }
  });
});
