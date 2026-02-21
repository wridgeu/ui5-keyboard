import { browser, $, expect } from "@wdio/globals";

const PAGE = "/test-resources/ui5/kiosk/e2e/focus/index.html";

async function openPage(): Promise<void> {
  await browser.url(PAGE);
  await $("#kb .ui5KioskKeyboard").waitForExist({ timeout: 15_000 });
}

function getInput(containerId: string) {
  return $(`#${containerId} input`);
}

async function isKeyboardOpen(): Promise<boolean> {
  const kb = await $("#kb .ui5KioskKeyboard");
  const classes = String(await kb.getAttribute("class"));
  return !classes.includes("ui5KioskKeyboard--closed");
}

describe("docked keyboard focus behavior", () => {
  beforeEach(async () => {
    await openPage();
  });

  it("should open when an input is focused", async () => {
    const input = await getInput("input-a");
    await input.click();

    await browser.waitUntil(() => isKeyboardOpen(), {
      timeout: 5_000,
      timeoutMsg: "Keyboard did not open after focusing input A",
    });
  });

  it("should stay open when focus moves from one input to another", async () => {
    const inputA = await getInput("input-a");
    await inputA.click();
    await browser.waitUntil(() => isKeyboardOpen(), {
      timeout: 5_000,
      timeoutMsg: "Keyboard did not open after focusing input A",
    });

    const inputB = await getInput("input-b");
    await inputB.click();

    const stableStart = Date.now();
    await browser.waitUntil(async () => (await isKeyboardOpen()) && Date.now() - stableStart >= 250, {
      timeout: 2_000,
      interval: 50,
      timeoutMsg: "Keyboard did not stay open when moving focus between inputs",
    });

    expect(await isKeyboardOpen()).toBe(true);
  });

  it("should close when focus moves to a non-input element", async () => {
    const inputB = await getInput("input-b");
    await inputB.click();
    await browser.waitUntil(() => isKeyboardOpen(), {
      timeout: 5_000,
      timeoutMsg: "Keyboard did not open after focusing input B",
    });

    await $("#blur-target").click();

    await browser.waitUntil(async () => !(await isKeyboardOpen()), {
      timeout: 5_000,
      timeoutMsg: "Keyboard did not close after clicking non-input element",
    });
  });

  it("should reopen when an input is focused again after closing", async () => {
    const inputB = await getInput("input-b");
    await inputB.click();
    await browser.waitUntil(() => isKeyboardOpen(), {
      timeout: 5_000,
      timeoutMsg: "Keyboard did not open after focusing input B",
    });

    await $("#blur-target").click();
    await browser.waitUntil(async () => !(await isKeyboardOpen()), {
      timeout: 5_000,
      timeoutMsg: "Keyboard did not close before reopen check",
    });

    const input = await getInput("input-a");
    await input.click();

    await browser.waitUntil(() => isKeyboardOpen(), {
      timeout: 5_000,
      timeoutMsg: "Keyboard did not reopen after re-focusing input A",
    });
  });
});
