import { test, expect, type Page } from "@playwright/test";

// Shared Target Ref-Count card on the multi-keyboard demo page: two docked
// keyboards target one input, and the input's inputmode follows the number of
// open keyboards. Driven through DOM selectors and the ushell window.hasher,
// the same way flp-lifecycle.spec.ts enters the app.

const FLP_PAGE = "/test/flp.html";
type HasherWindow = Window & typeof globalThis & { hasher: { setHash(hash: string): void } };

async function openAppViaTile(page: Page): Promise<void> {
  await page.goto(FLP_PAGE);
  await page.locator("#shell-header").waitFor({ timeout: 30_000 });
  await page.locator(".sapMGT").first().click();
  await page.waitForFunction(() => window.location.hash.includes("DemoApp-display"), null, { timeout: 30_000 });
  await page.waitForFunction(() => document.querySelectorAll(".sapMPage").length > 0, null, { timeout: 30_000 });
}

async function navigateToMultiKeyboardPage(page: Page): Promise<void> {
  await page.evaluate((h) => (window as HasherWindow).hasher.setHash(h), "DemoApp-display&/kiosk/multi-keyboard");
  await page.locator('input[id$="--sharedInput-inner"]').waitFor({ timeout: 15_000 });
}

test("shared-target card: inputmode follows the ref-count across two keyboards", async ({ page }) => {
  await openAppViaTile(page);
  await navigateToMultiKeyboardPage(page);

  const input = page.locator('input[id$="--sharedInput-inner"]');
  const button = (name: string) => page.getByRole("button", { name, exact: true });

  await expect(input).toHaveAttribute("inputmode", "email");

  await button("Open A").click();
  await expect(input).toHaveAttribute("inputmode", "none");

  await button("Open B").click();
  await button("Close A").click();
  await expect(input).toHaveAttribute("inputmode", "none");

  await button("Close B").click();
  await expect(input).toHaveAttribute("inputmode", "email");
});
