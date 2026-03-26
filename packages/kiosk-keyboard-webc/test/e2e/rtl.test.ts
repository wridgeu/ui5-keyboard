import {
  openVisualPage,
  getKeyboardRoot,
  setDocumentDirection,
  matchElementSnapshotInSection,
} from "./test-helpers.js";

describe("KioskKeyboard Web Component - RTL (Right-to-Left)", () => {
  afterEach(async () => {
    await setDocumentDirection("ltr");
  });

  it("should match QWERTY layout in RTL", async () => {
    await openVisualPage();
    await setDocumentDirection("rtl");
    const kb = await getKeyboardRoot("kb-qwerty");
    await matchElementSnapshotInSection(kb, "webc-qwerty-rtl");
  });

  it("should match Numpad layout in RTL", async () => {
    await openVisualPage();
    await setDocumentDirection("rtl");
    const kb = await getKeyboardRoot("kb-numpad");
    await matchElementSnapshotInSection(kb, "webc-numpad-rtl");
  });

  it("should match Numeric layout in RTL", async () => {
    await openVisualPage();
    await setDocumentDirection("rtl");
    const kb = await getKeyboardRoot("kb-numeric");
    await matchElementSnapshotInSection(kb, "webc-numeric-rtl");
  });

  it("should match Arabic layout in RTL", async () => {
    await openVisualPage();
    await setDocumentDirection("rtl");
    const kb = await getKeyboardRoot("kb-arabic");
    await matchElementSnapshotInSection(kb, "webc-arabic-rtl");
  });
});
