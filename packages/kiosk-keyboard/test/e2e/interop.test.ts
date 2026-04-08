import { $, browser, expect } from "@wdio/globals";

const PAGE = "/test-resources/ui5/kiosk/e2e/interop/index.html";

async function openPage(): Promise<void> {
  await browser.url(PAGE);
  await $("#interop-kb .ui5KioskKeyboard").waitForExist({ timeout: 15_000 });
  await browser.waitUntil(
    () =>
      browser.execute(() => {
        const w = window as unknown as {
          interopHarnessReady?: boolean;
          interopHarness?: {
            focusControlById?: (controlId: string) => void;
            getKeyboardTargetId?: () => string;
            focusCustomElement?: () => void;
            focusShadowCustomElement?: () => void;
          };
        };

        return Boolean(
          w.interopHarnessReady &&
          w.interopHarness?.focusControlById &&
          w.interopHarness?.getKeyboardTargetId &&
          w.interopHarness?.focusCustomElement &&
          w.interopHarness?.focusShadowCustomElement,
        );
      }),
    {
      timeout: 10_000,
      timeoutMsg: "Interop harness not ready",
    },
  );
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

async function focusCustomElement(): Promise<void> {
  await browser.execute(() => {
    const harness = (window as unknown as { interopHarness?: { focusCustomElement?: () => void } }).interopHarness;
    harness?.focusCustomElement?.();
  });
}

async function focusShadowCustomElement(): Promise<void> {
  await browser.execute(() => {
    const harness = (window as unknown as { interopHarness?: { focusShadowCustomElement?: () => void } })
      .interopHarness;
    harness?.focusShadowCustomElement?.();
  });
}

async function isNumpadKeyboard(): Promise<boolean> {
  const kb = await $("#interop-kb .ui5KioskKeyboard");
  const classes = (await kb.getAttribute("class")) ?? "";
  return classes.includes("ui5KioskKeyboard--numpad");
}

describe("interop: StepInput, TextArea, and bridge custom element", () => {
  before(async () => {
    await openPage();
  });

  it("opens and targets StepInput via controls", async () => {
    await focusControl("interopStep");

    await browser.waitUntil(() => isKeyboardOpen(), {
      timeout: 5_000,
      timeoutMsg: "Keyboard did not open for StepInput",
    });

    expect(await getKeyboardTargetId()).toBe("interopStep");
    expect(await isNumpadKeyboard()).toBe(true);
  });

  it("opens and targets TextArea via controls", async () => {
    await blurKeyboard();
    await focusControl("interopTextArea");

    await browser.waitUntil(() => isKeyboardOpen(), {
      timeout: 5_000,
      timeoutMsg: "Keyboard did not open for TextArea",
    });

    expect(await getKeyboardTargetId()).toBe("interopTextArea");
    expect(await isKeyboardOpen()).toBe(true);
  });

  it("opens for custom element and targets bridge input", async () => {
    await blurKeyboard();
    await focusCustomElement();

    await browser.waitUntil(() => isKeyboardOpen(), {
      timeout: 5_000,
      timeoutMsg: "Keyboard did not open for custom element bridge",
    });

    expect(await getKeyboardTargetId()).toBe("interopBridgeInput");
    expect(await isKeyboardOpen()).toBe(true);
  });

  it("opens for shadow custom element and targets shadow bridge input", async () => {
    await blurKeyboard();
    await focusShadowCustomElement();

    await browser.waitUntil(() => isKeyboardOpen(), {
      timeout: 5_000,
      timeoutMsg: "Keyboard did not open for shadow custom element bridge",
    });

    expect(await getKeyboardTargetId()).toBe("interopShadowBridgeInput");
    expect(await isKeyboardOpen()).toBe(true);
  });
});
