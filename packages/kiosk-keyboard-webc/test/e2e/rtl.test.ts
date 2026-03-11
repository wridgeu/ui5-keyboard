import { expect } from "@wdio/globals";
import { openVisualPage, getKeyboardRoot, setDocumentDirection } from "./test-helpers.js";

describe("KioskKeyboard Web Component - RTL (Right-to-Left)", () => {
  afterEach(async () => {
    await setDocumentDirection("ltr");
  });

  it("should match QWERTY layout in RTL", async () => {
    await openVisualPage();
    await setDocumentDirection("rtl");
    const kb = await getKeyboardRoot("kb-qwerty");
    await expect(kb).toMatchElementSnapshot("webc-qwerty-rtl");
  });

  it("should match Numpad layout in RTL", async () => {
    await openVisualPage();
    await setDocumentDirection("rtl");
    const kb = await getKeyboardRoot("kb-numpad");
    await expect(kb).toMatchElementSnapshot("webc-numpad-rtl");
  });

  it("should match Numeric layout in RTL", async () => {
    await openVisualPage();
    await setDocumentDirection("rtl");
    const kb = await getKeyboardRoot("kb-numeric");
    await expect(kb).toMatchElementSnapshot("webc-numeric-rtl");
  });
});
