import {
  openVisualPage,
  getKeyboard,
  setEmulatedMediaFeatures,
  clearEmulatedMediaFeatures,
  matchElementSnapshotInSection,
} from "./test-helpers.js";

describe("KioskKeyboard Accessibility Media Emulation", () => {
  beforeEach(async () => {
    await clearEmulatedMediaFeatures();
  });

  afterEach(async () => {
    await clearEmulatedMediaFeatures();
  });

  it("should match forced-colors (high contrast) mode", async () => {
    await setEmulatedMediaFeatures([{ name: "forced-colors", value: "active" }]);
    await openVisualPage();
    const kb = await getKeyboard("kb-qwerty");
    await matchElementSnapshotInSection(kb, "kb-qwerty-forced-colors");
  });
});
