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
  // Allow UI5 re-render + async bundle load to settle
  await browser.pause(500);
}

describe("KioskKeyboard i18n e2e", () => {
  before(async () => {
    await openPage();
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

      const kb = await getKeyboard("kb-french");
      const label = await kb.getAttribute("aria-label");
      await expect(label).toBe("Clavier virtuel");

      const shiftKey = await kb.$('[data-key="\\{shift\\}"]');
      const shiftLabel = await shiftKey.getAttribute("aria-label");
      await expect(shiftLabel).toBe("Maj");
    });

    it("should restore English labels after reset", async () => {
      await clickButton("controls-french", "Apply French bundle");
      await clickButton("controls-french", "Reset to defaults");

      const kb = await getKeyboard("kb-french");
      const label = await kb.getAttribute("aria-label");
      await expect(label).toBe("Virtual Keyboard");
    });
  });

  describe("3. Override existing English labels", () => {
    it("should apply custom overrides", async () => {
      await clickButton("controls-override", "Apply overrides");

      const kb = await getKeyboard("kb-override");
      const label = await kb.getAttribute("aria-label");
      await expect(label).toBe("Touch Keyboard");

      const enterKey = await kb.$('[data-key="\\{enter\\}"]');
      const enterLabel = await enterKey.getAttribute("aria-label");
      await expect(enterLabel).toBe("Go");

      const backspaceKey = await kb.$('[data-key="\\{backspace\\}"]');
      const backspaceLabel = await backspaceKey.getAttribute("aria-label");
      await expect(backspaceLabel).toBe("Delete");
    });

    it("should keep non-overridden keys at base text", async () => {
      await clickButton("controls-override", "Apply overrides");

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
      const label = await kb.getAttribute("aria-label");
      // Hook prepends keyboard emoji to the label
      await expect(label).toContain("\u2328");

      const shiftKey = await kb.$('[data-key="\\{shift\\}"]');
      const shiftLabel = await shiftKey.getAttribute("aria-label");
      // Hook uppercases KEY_* labels
      await expect(shiftLabel).toBe("SHIFT");
    });

    it("should restore defaults after reset", async () => {
      await clickButton("controls-hook", "Set override hook");
      await clickButton("controls-hook", "Reset to defaults");

      const kb = await getKeyboard("kb-hook");
      const label = await kb.getAttribute("aria-label");
      await expect(label).toBe("Virtual Keyboard");

      const shiftKey = await kb.$('[data-key="\\{shift\\}"]');
      const shiftLabel = await shiftKey.getAttribute("aria-label");
      await expect(shiftLabel).toBe("Shift");
    });
  });
});
