import { expect } from "@wdio/globals";
import { openVisualPage, getKeyboard, setDocumentDirection } from "./test-helpers.js";

describe("KioskKeyboard RTL (Right-to-Left)", () => {
  afterEach(async () => {
    await setDocumentDirection("ltr");
  });

  it("should match QWERTY layout in RTL", async () => {
    await openVisualPage();
    await setDocumentDirection("rtl");
    const kb = await getKeyboard("kb-qwerty");
    await expect(kb).toMatchElementSnapshot("kb-qwerty-rtl");
  });

  it("should match Numpad layout in RTL", async () => {
    await openVisualPage();
    await setDocumentDirection("rtl");
    const kb = await getKeyboard("kb-numpad");
    await expect(kb).toMatchElementSnapshot("kb-numpad-rtl");
  });

  it("should match Numeric layout in RTL", async () => {
    await openVisualPage();
    await setDocumentDirection("rtl");
    const kb = await getKeyboard("kb-numeric");
    await expect(kb).toMatchElementSnapshot("kb-numeric-rtl");
  });
});
