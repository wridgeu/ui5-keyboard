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

test("hotkeys/sequences: the hint names every continuation and clears with the sequence timeout", async ({ page }) => {
  await page.goto(appRoute("hotkeys/sequences"));
  await page.getByText("Press G then I to fire the first sequence.").waitFor({ timeout: 30_000 });
  // Paused fake timers from here on, so the hint's timer and the sequence timeout
  // advance only through runFor and the boundary is exact.
  await page.clock.install();
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);

  const hint = page.getByText(/^Waiting for next key/);
  await page.keyboard.press("g");
  // UI5 re-renders on a timer of its own, so each check first advances 50ms past its instant.
  await page.clock.runFor(50);
  await expect(hint).toHaveText("Waiting for next key (1/2) - press I or S");

  await page.clock.runFor(949);
  await expect(hint).toBeVisible();
  await page.clock.runFor(50);
  await expect(hint).toBeHidden();
});

test("hotkeys/target-bubbling: Escape fires the innermost target around focus", async ({ page }) => {
  await page.goto(appRoute("hotkeys/target-bubbling"));
  const log = byAppId(page, "hotkeysTargetBubble", "bubbleLogList");
  const latest = log.locator("li.sapMLIB").first();

  await byAppId(page, "hotkeysTargetBubble", "outerTargetButton").focus({ timeout: 30_000 });
  await page.keyboard.press("Escape");
  await expect(latest).toContainText("outer target fired");

  await byAppId(page, "hotkeysTargetBubble", "bubbleInput-inner").focus();
  await page.keyboard.press("Escape");
  await expect(latest).toContainText("inner target fired");
});
