import { $, browser, expect } from "@wdio/globals";

const PAGE = "/test-resources/ui5/kiosk/e2e/interop/index.html";

async function openPage(): Promise<void> {
  await browser.url(PAGE);
  await $("#interop-kb .ui5KioskKeyboard").waitForExist({ timeout: 15_000 });
}

async function isKeyboardOpen(): Promise<boolean> {
  const kb = await $("#interop-kb .ui5KioskKeyboard");
  const classes = (await kb.getAttribute("class")) ?? "";
  return !classes.includes("ui5KioskKeyboard--closed");
}

async function blurKeyboard(): Promise<void> {
  await browser.execute(() => {
    (document.getElementById("interop-blur") as HTMLElement | null)?.focus();
  });
  await browser.waitUntil(async () => !(await isKeyboardOpen()), {
    timeout: 5_000,
    timeoutMsg: "Keyboard did not close after blur",
  });
}

async function focusControl(controlId: string): Promise<void> {
  await browser.execute((id) => {
    const control = sap.ui.getCore().byId(id) as
      | {
          getFocusDomRef?: () => Element | null;
          focus?: () => void;
        }
      | undefined;
    if (!control) return;

    const focusRef = control.getFocusDomRef?.();
    if (focusRef instanceof HTMLElement) {
      const shadowInput = focusRef.shadowRoot?.querySelector("input,textarea") as HTMLElement | null;
      const lightInput = focusRef.querySelector?.("input,textarea") as HTMLElement | null;
      (shadowInput ?? lightInput ?? focusRef).focus();
      return;
    }

    control.focus?.();
  }, controlId);
}

async function getKeyboardTargetId(): Promise<string> {
  return browser.execute(() => {
    const kb = sap.ui.getCore().byId("interopKeyboard") as { getTargetInput: () => string } | undefined;
    return kb?.getTargetInput() ?? "";
  });
}

async function isNumpadKeyboard(): Promise<boolean> {
  const kb = await $("#interop-kb .ui5KioskKeyboard");
  const classes = (await kb.getAttribute("class")) ?? "";
  return classes.includes("ui5KioskKeyboard--numpad");
}

describe("interop: StepInput and UI5 WebC Input", () => {
  before(async () => {
    await openPage();
  });

  it("opens and targets StepInput via inputIds", async () => {
    await focusControl("interopStep");

    await browser.waitUntil(() => isKeyboardOpen(), {
      timeout: 5_000,
      timeoutMsg: "Keyboard did not open for StepInput",
    });

    expect(await getKeyboardTargetId()).toBe("interopStep");
    expect(await isNumpadKeyboard()).toBe(true);
  });

  it("opens and targets sap.ui.webc.main.Input via inputIds", async () => {
    await blurKeyboard();
    await focusControl("interopWebc");

    await browser.waitUntil(() => isKeyboardOpen(), {
      timeout: 5_000,
      timeoutMsg: "Keyboard did not open for sap.ui.webc.main.Input",
    });

    expect(await getKeyboardTargetId()).toBe("interopWebc");
    // For WebC wrappers we primarily verify focus target resolution.
    // Keyboard type can vary depending on wrapper input metadata.
    expect(await isKeyboardOpen()).toBe(true);
  });
});
