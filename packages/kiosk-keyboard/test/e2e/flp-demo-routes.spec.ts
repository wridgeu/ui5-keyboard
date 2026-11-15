import { test, expect, type Page } from "@playwright/test";

// Demo-app route checks that need a real layout or real key events. They run
// under playwright.flp.config.ts, the harness that serves the demo app, and
// reach each route by its hash inside the FLP sandbox.

const appRoute = (route: string) => `/test/flp.html#DemoApp-display&/${route}`;

// The shell owns the id prefix up to "---"; the router target id and the view-local id are the app's.
const byAppId = (page: Page, viewId: string, localId: string) => page.locator(`[id$="---${viewId}--${localId}"]`);

test.describe("docked routes at phone size", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  for (const [route, viewId, inputId] of [
    ["kiosk/web-component-tooling", "kioskWebComponentTooling", "toolingEmailInput"],
    ["kiosk/form-workflow", "kioskFormWorkflow", "notesInput"],
  ]) {
    test(`${route}: the last input scrolls clear of the open keyboard`, async ({ page }) => {
      await page.goto(appRoute(route));
      const input = byAppId(page, viewId!, `${inputId}-inner`);
      await input.click({ timeout: 30_000 });

      const rects = await input.evaluate(async (el) => {
        const keyboards = [
          ...document.querySelectorAll(".ui5KioskKeyboard--docked:not(.ui5KioskKeyboard--hidden)"),
          ...[...document.querySelectorAll("kiosk-keyboard")].map((k) =>
            k.shadowRoot?.querySelector(".kiosk-keyboard--docked:not(.kiosk-keyboard--hidden)"),
          ),
        ].filter((k): k is Element => !!k);
        // Wait out the slide-in so the keyboard sits at its final position.
        await Promise.all(keyboards.flatMap((k) => k.getAnimations().map((a) => a.finished)));
        const section = el.closest("section")!;
        const keyboardTop = Math.min(...keyboards.map((k) => k.getBoundingClientRect().top));
        section.scrollTop += el.getBoundingClientRect().bottom - keyboardTop;
        const box = el.getBoundingClientRect();
        return { keyboardTop, sectionTop: section.getBoundingClientRect().top, top: box.top, bottom: box.bottom };
      });

      expect(rects.keyboardTop).toBeLessThan(667);
      expect(rects.bottom).toBeLessThanOrEqual(rects.keyboardTop + 0.5);
      expect(rects.top).toBeGreaterThanOrEqual(rects.sectionTop);
    });
  }
});
