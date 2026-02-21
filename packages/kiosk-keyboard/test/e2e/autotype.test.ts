import { browser, $, expect } from "@wdio/globals";

const PAGE = "/test-resources/ui5/kiosk/e2e/autotype/index.html";

/** Navigate to the autotype test page and wait for UI5 to finish rendering. */
async function openPage(): Promise<void> {
  await browser.url(PAGE);
  await $("#kb .ui5KioskKeyboard").waitForExist({ timeout: 15_000 });
}

/** Focus the inner input/textarea of a UI5 control container via JS focus().
 *  Avoids click side-effects (ComboBox dropdown, DatePicker calendar). */
async function focusInput(containerId: string): Promise<void> {
  await browser.execute((id) => {
    const container = document.getElementById(id);
    if (!container) return;
    const el = container.querySelector("input") ?? container.querySelector("textarea");
    (el as HTMLElement)?.focus();
  }, containerId);
}

/** Check whether the docked keyboard is visually open (not closed). */
async function isKeyboardOpen(): Promise<boolean> {
  const kb = await $("#kb .ui5KioskKeyboard");
  const classes = String(await kb.getAttribute("class"));
  return !classes.includes("ui5KioskKeyboard--closed");
}

/** Check whether the keyboard is in Numpad mode. */
async function isNumpadKeyboard(): Promise<boolean> {
  const kb = await $("#kb .ui5KioskKeyboard");
  const classes = String(await kb.getAttribute("class"));
  return classes.includes("ui5KioskKeyboard--numpad");
}

/** Focus the blur target to reset focus state and wait for keyboard to close.
 *  Uses JS focus() instead of click() because the docked keyboard overlays
 *  the blur target at the bottom of the viewport. */
async function blurAndWaitForClose(): Promise<void> {
  await browser.execute(() => {
    document.getElementById("blur-target")?.focus();
  });
  await browser.waitUntil(async () => !(await isKeyboardOpen()), {
    timeout: 5_000,
    timeoutMsg: "Keyboard did not close after blur",
  });
}

describe("auto-type detection across input types", () => {
  beforeEach(async () => {
    await openPage();
  });

  describe("Full keyboard inputs", () => {
    const fullInputs = [
      { id: "input-text", label: "Text" },
      { id: "input-email", label: "Email" },
      { id: "input-password", label: "Password" },
      { id: "input-url", label: "URL" },
      { id: "input-textarea", label: "TextArea" },
      { id: "input-search", label: "SearchField" },
      { id: "input-combo", label: "ComboBox" },
      { id: "input-date", label: "DatePicker" },
    ];

    for (const { id, label } of fullInputs) {
      it(`should open Full keyboard when ${label} is focused`, async () => {
        await blurAndWaitForClose();
        await focusInput(id);

        await browser.waitUntil(() => isKeyboardOpen(), {
          timeout: 5_000,
          timeoutMsg: `Keyboard did not open for ${label}`,
        });

        const numpad = await isNumpadKeyboard();
        expect(numpad).toBe(false);
      });
    }
  });

  describe("Numpad keyboard inputs", () => {
    const numpadInputs = [
      { id: "input-number", label: "Number" },
      { id: "input-tel", label: "Tel" },
      { id: "input-step", label: "StepInput" },
    ];

    for (const { id, label } of numpadInputs) {
      it(`should open Numpad keyboard when ${label} is focused`, async () => {
        await blurAndWaitForClose();
        await focusInput(id);

        await browser.waitUntil(() => isKeyboardOpen(), {
          timeout: 5_000,
          timeoutMsg: `Keyboard did not open for ${label}`,
        });

        const numpad = await isNumpadKeyboard();
        expect(numpad).toBe(true);
      });
    }
  });

  describe("Ignored inputs", () => {
    const ignoredInputs = [
      { label: "CheckBox", selector: "#input-checkbox input" },
      { label: "RadioButton", selector: "#input-radio input" },
      { label: "Readonly Input", selector: "#input-readonly input" },
      { label: "Raw HTML input", selector: "#input-raw" },
    ];

    for (const { label, selector } of ignoredInputs) {
      it(`should NOT open keyboard when ${label} is focused`, async () => {
        await blurAndWaitForClose();

        // Use JS focus to avoid click-intercept from docked keyboard
        await browser.execute((sel) => {
          (document.querySelector(sel) as HTMLElement)?.focus();
        }, selector);

        const stableStart = Date.now();
        await browser.waitUntil(async () => !(await isKeyboardOpen()) && Date.now() - stableStart >= 400, {
          timeout: 2_000,
          interval: 50,
          timeoutMsg: `Keyboard opened unexpectedly for ${label}`,
        });

        const open = await isKeyboardOpen();
        expect(open).toBe(false);
      });
    }
  });
});
