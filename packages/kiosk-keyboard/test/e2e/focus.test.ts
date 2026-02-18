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
  const classes = await kb.getAttribute("class");
  return !classes.includes("ui5KioskKeyboard--closed");
}

describe("docked keyboard focus behavior", () => {
  before(async () => {
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
    // Input A is already focused and keyboard is open from the previous test
    const inputB = await getInput("input-b");
    await inputB.click();

    // Keyboard should remain open — wait briefly to ensure no close/reopen flicker
    await browser.pause(300);
    const open = await isKeyboardOpen();
    expect(open).toBe(true);
  });

  it("should close when focus moves to a non-input element", async () => {
    // Input B is focused and keyboard is open
    await $("#blur-target").click();

    await browser.waitUntil(async () => !(await isKeyboardOpen()), {
      timeout: 5_000,
      timeoutMsg: "Keyboard did not close after clicking non-input element",
    });
  });

  it("should reopen when an input is focused again after closing", async () => {
    // Keyboard is closed from the previous test
    const input = await getInput("input-a");
    await input.click();

    await browser.waitUntil(() => isKeyboardOpen(), {
      timeout: 5_000,
      timeoutMsg: "Keyboard did not reopen after re-focusing input A",
    });
  });
});
