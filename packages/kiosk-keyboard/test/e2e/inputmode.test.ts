import { browser, $, expect } from "@wdio/globals";

const PAGE = "/test-resources/ui5/kiosk/e2e/inputmode/index.html";

/** Navigate to the inputmode test page and wait for UI5 to finish rendering. */
async function openPage(): Promise<void> {
  await browser.url(PAGE);
  // Wait for the last keyboard to be rendered
  await $("#kb-auto .ui5KioskKeyboard").waitForExist({ timeout: 15_000 });
}

/** Get the inner <input> DOM element of a sap.m.Input container. */
function getInput(containerId: string) {
  return $(`#${containerId} input`);
}

/** Get the KioskKeyboard element inside a container. */
function getKeyboard(containerId: string) {
  return $(`#${containerId} .ui5KioskKeyboard`);
}

/** Check whether a docked keyboard is visually open (not closed). */
async function isKeyboardOpen(containerId: string): Promise<boolean> {
  const kb = await getKeyboard(containerId);
  const classes = await kb.getAttribute("class");
  return !(classes?.includes("ui5KioskKeyboard--closed") ?? false);
}

describe("inputmode suppression", () => {
  before(async () => {
    await openPage();
  });

  describe("Custom mode", () => {
    it("should set inputmode='none' and open keyboard when input is focused", async () => {
      const input = await getInput("input-custom");
      await input.click();

      // Wait for keyboard to open
      await browser.waitUntil(() => isKeyboardOpen("kb-custom"), {
        timeout: 5_000,
        timeoutMsg: "Custom keyboard did not open",
      });

      const inputmode = await input.getAttribute("inputmode");
      expect(inputmode).toBe("none");
    });
  });

  describe("Native mode", () => {
    it("should NOT set inputmode='none' and NOT open keyboard when input is focused", async () => {
      // Click blur target first to reset focus state
      await $("#blur-target").click();
      await browser.waitUntil(async () => !(await isKeyboardOpen("kb-custom")), {
        timeout: 3_000,
        timeoutMsg: "Previous keyboard did not close after blur",
      });

      const input = await getInput("input-native");
      await input.click();

      // Verify keyboard does NOT open — wait briefly then assert
      try {
        await browser.waitUntil(() => isKeyboardOpen("kb-native"), { timeout: 500 });
        expect(false).toBe(true); // Should not reach here
      } catch {
        // Expected: keyboard never opened
      }

      const inputmode = await input.getAttribute("inputmode");
      expect(inputmode).not.toBe("none");

      const open = await isKeyboardOpen("kb-native");
      expect(open).toBe(false);
    });
  });

  describe("Auto mode (desktop)", () => {
    it("should set inputmode='none' and open keyboard on desktop", async () => {
      // Click blur target first to reset focus state
      await $("#blur-target").click();
      await browser.waitUntil(async () => !(await isKeyboardOpen("kb-auto")), {
        timeout: 3_000,
        timeoutMsg: "Auto keyboard did not close after blur",
      });

      const input = await getInput("input-auto");
      await input.click();

      // Wait for keyboard to open
      await browser.waitUntil(() => isKeyboardOpen("kb-auto"), {
        timeout: 5_000,
        timeoutMsg: "Auto keyboard did not open on desktop",
      });

      const inputmode = await input.getAttribute("inputmode");
      expect(inputmode).toBe("none");
    });
  });

  describe("Restore on close", () => {
    it("should restore original inputmode when keyboard closes", async () => {
      // First, focus the Custom input to open the keyboard
      const input = await getInput("input-custom");
      await input.click();

      await browser.waitUntil(() => isKeyboardOpen("kb-custom"), {
        timeout: 5_000,
        timeoutMsg: "Custom keyboard did not open before restore test",
      });

      // Verify inputmode is suppressed
      let inputmode = await input.getAttribute("inputmode");
      expect(inputmode).toBe("none");

      // Click the blur target to close the keyboard
      await $("#blur-target").click();

      // Wait for keyboard to close
      await browser.waitUntil(async () => !(await isKeyboardOpen("kb-custom")), {
        timeout: 5_000,
        timeoutMsg: "Custom keyboard did not close",
      });

      // inputmode should be restored (sap.m.Input does not set inputmode, so it should be removed)
      inputmode = await input.getAttribute("inputmode");
      expect(inputmode).not.toBe("none");
    });
  });
});
