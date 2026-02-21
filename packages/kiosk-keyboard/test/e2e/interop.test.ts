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
    const harness = (window as unknown as { interopHarness?: { focusControlById?: (controlId: string) => void } })
      .interopHarness;
    harness?.focusControlById?.(id);
  }, controlId);
}

async function getKeyboardTargetId(): Promise<string> {
  return browser.execute(() => {
    const harness = (window as unknown as { interopHarness?: { getKeyboardTargetId?: () => string } }).interopHarness;
    return harness?.getKeyboardTargetId?.() ?? "";
  });
}

async function isNumpadKeyboard(): Promise<boolean> {
  const kb = await $("#interop-kb .ui5KioskKeyboard");
  const classes = (await kb.getAttribute("class")) ?? "";
  return classes.includes("ui5KioskKeyboard--numpad");
}

describe("interop: StepInput and TextArea", () => {
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

  it("opens and targets TextArea via inputIds", async () => {
    await blurKeyboard();
    await focusControl("interopTextArea");

    await browser.waitUntil(() => isKeyboardOpen(), {
      timeout: 5_000,
      timeoutMsg: "Keyboard did not open for TextArea",
    });

    expect(await getKeyboardTargetId()).toBe("interopTextArea");
    expect(await isKeyboardOpen()).toBe(true);
  });
});
