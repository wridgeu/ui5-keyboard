import { browser, $, expect } from "@wdio/globals";

const PAGE = "/test-resources/ui5/kiosk/e2e/i18n/index.html";

async function openPage(): Promise<void> {
  await browser.url(PAGE);
  // Wait for the last keyboard section to be rendered
  await $("#kb-hook .ui5KioskKeyboard").waitForExist({ timeout: 15_000 });
}

function getKeyboard(containerId: string) {
  return $(`#${containerId} .ui5KioskKeyboard`);
}

async function clickButton(containerId: string, text: string): Promise<void> {
  const container = await $(`#${containerId}`);
  const btn = await container.$(`span=${text}`);
  await btn.click();
}

/** Wait until the keyboard's aria-label matches the expected value after an async action. */
async function waitForLabel(containerId: string, expected: string, timeout = 5_000): Promise<void> {
  const kb = getKeyboard(containerId);
  await browser.waitUntil(async () => (await kb.getAttribute("aria-label")) === expected, {
    timeout,
    timeoutMsg: `aria-label in #${containerId} did not become "${expected}" within ${timeout}ms`,
  });
}

describe("KioskKeyboard i18n e2e", () => {
  before(async () => {
    await openPage();
  });

  afterEach(async () => {
    // Reset i18n state between tests to prevent ordering dependencies
    await browser.executeAsync((done: () => void) => {
      sap.ui.require(
        ["ui5/kiosk/KioskKeyboard"],
        (KioskKeyboard: { resetI18nConfiguration: () => void; clearI18nOverrideHook: () => void }) => {
          KioskKeyboard.resetI18nConfiguration();
          KioskKeyboard.clearI18nOverrideHook();
          done();
        },
      );
    });
  });

  describe("1. Baseline (no customization)", () => {
    it("should render with default English aria-label", async () => {
      const kb = await getKeyboard("kb-baseline");
      const label = await kb.getAttribute("aria-label");
      await expect(label).toBe("Virtual Keyboard");
    });

    it("should have English key labels", async () => {
      const kb = await getKeyboard("kb-baseline");
      const shiftKey = await kb.$('[data-key="\\{shift\\}"]');
      const enterKey = await kb.$('[data-key="\\{enter\\}"]');
      const shiftLabel = await shiftKey.getAttribute("aria-label");
      const enterLabel = await enterKey.getAttribute("aria-label");
      await expect(shiftLabel).toBe("Shift");
      await expect(enterLabel).toBe("Enter");
    });
  });

  describe("2. French enhancement bundle", () => {
    it("should update labels to French after applying bundle", async () => {
      await clickButton("controls-french", "Apply French bundle");
      await waitForLabel("kb-french", "Clavier virtuel");

      const kb = await getKeyboard("kb-french");
      const shiftKey = await kb.$('[data-key="\\{shift\\}"]');
      const shiftLabel = await shiftKey.getAttribute("aria-label");
      await expect(shiftLabel).toBe("Maj");
    });

    it("should restore English labels after reset", async () => {
      await clickButton("controls-french", "Apply French bundle");
      await waitForLabel("kb-french", "Clavier virtuel");
      await clickButton("controls-french", "Reset to defaults");
      await waitForLabel("kb-french", "Virtual Keyboard");
    });
  });

  describe("3. Override existing English labels", () => {
    it("should apply custom overrides", async () => {
      await clickButton("controls-override", "Apply overrides");
      await waitForLabel("kb-override", "Touch Keyboard");

      const kb = await getKeyboard("kb-override");
      const enterKey = await kb.$('[data-key="\\{enter\\}"]');
      const enterLabel = await enterKey.getAttribute("aria-label");
      await expect(enterLabel).toBe("Go");

      const backspaceKey = await kb.$('[data-key="\\{backspace\\}"]');
      const backspaceLabel = await backspaceKey.getAttribute("aria-label");
      await expect(backspaceLabel).toBe("Delete");
    });

    it("should keep non-overridden keys at base text", async () => {
      await clickButton("controls-override", "Apply overrides");
      await waitForLabel("kb-override", "Touch Keyboard");

      const kb = await getKeyboard("kb-override");
      const shiftKey = await kb.$('[data-key="\\{shift\\}"]');
      const shiftLabel = await shiftKey.getAttribute("aria-label");
      // Shift is not in the override bundle, should remain English
      await expect(shiftLabel).toBe("Shift");
    });
  });

  describe("4. Programmatic override hook", () => {
    it("should apply hook transformations", async () => {
      await clickButton("controls-hook", "Set override hook");

      const kb = await getKeyboard("kb-hook");
      // Hook prepends keyboard emoji — wait for it
      await browser.waitUntil(async () => ((await kb.getAttribute("aria-label")) ?? "").includes("\u2328"), {
        timeout: 5_000,
        timeoutMsg: "Hook did not update aria-label in time",
      });

      const shiftKey = await kb.$('[data-key="\\{shift\\}"]');
      const shiftLabel = await shiftKey.getAttribute("aria-label");
      // Hook uppercases KEY_* labels
      await expect(shiftLabel).toBe("SHIFT");
    });

    it("should restore defaults after reset", async () => {
      await clickButton("controls-hook", "Set override hook");
      await browser.waitUntil(
        async () => ((await getKeyboard("kb-hook").getAttribute("aria-label")) ?? "").includes("\u2328"),
        { timeout: 5_000 },
      );
      await clickButton("controls-hook", "Reset to defaults");
      await waitForLabel("kb-hook", "Virtual Keyboard");

      const kb = await getKeyboard("kb-hook");
      const shiftKey = await kb.$('[data-key="\\{shift\\}"]');
      const shiftLabel = await shiftKey.getAttribute("aria-label");
      await expect(shiftLabel).toBe("Shift");
    });
  });
});
