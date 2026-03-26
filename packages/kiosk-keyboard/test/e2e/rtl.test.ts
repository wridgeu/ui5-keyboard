import { openVisualPage, getKeyboard, setDocumentDirection, matchElementSnapshotInSection } from "./test-helpers.js";

describe("KioskKeyboard RTL (Right-to-Left)", () => {
  afterEach(async () => {
    await setDocumentDirection("ltr");
  });

  it("should match QWERTY layout in RTL", async () => {
    await openVisualPage();
    await setDocumentDirection("rtl");
    const kb = await getKeyboard("kb-qwerty");
    await matchElementSnapshotInSection(kb, "kb-qwerty-rtl");
  });

  it("should match Numpad layout in RTL", async () => {
    await openVisualPage();
    await setDocumentDirection("rtl");
    const kb = await getKeyboard("kb-numpad");
    await matchElementSnapshotInSection(kb, "kb-numpad-rtl");
  });

  it("should match Numeric layout in RTL", async () => {
    await openVisualPage();
    await setDocumentDirection("rtl");
    const kb = await getKeyboard("kb-numeric");
    await matchElementSnapshotInSection(kb, "kb-numeric-rtl");
  });

  it("should match Arabic layout in RTL", async () => {
    await openVisualPage();
    await setDocumentDirection("rtl");
    const kb = await getKeyboard("kb-arabic");
    await matchElementSnapshotInSection(kb, "kb-arabic-rtl");
  });
});
