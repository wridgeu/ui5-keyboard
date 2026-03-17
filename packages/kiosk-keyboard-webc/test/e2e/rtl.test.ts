import { openVisualPage, getKeyboardRoot, setDocumentDirection, matchElementSnapshotSafely } from "./test-helpers.js";

describe("KioskKeyboard Web Component - RTL (Right-to-Left)", () => {
  afterEach(async () => {
    await setDocumentDirection("ltr");
  });

  it("should match QWERTY layout in RTL", async () => {
    await openVisualPage();
    await setDocumentDirection("rtl");
    const kb = await getKeyboardRoot("kb-qwerty");
    await matchElementSnapshotSafely(kb, "webc-qwerty-rtl");
  });

  it("should match Numpad layout in RTL", async () => {
    await openVisualPage();
    await setDocumentDirection("rtl");
    const kb = await getKeyboardRoot("kb-numpad");
    await matchElementSnapshotSafely(kb, "webc-numpad-rtl");
  });

  it("should match Numeric layout in RTL", async () => {
    await openVisualPage();
    await setDocumentDirection("rtl");
    const kb = await getKeyboardRoot("kb-numeric");
    await matchElementSnapshotSafely(kb, "webc-numeric-rtl");
  });
});
