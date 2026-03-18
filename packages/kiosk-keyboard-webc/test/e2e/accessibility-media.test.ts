import {
  openVisualPage,
  getKeyboardRoot,
  setEmulatedMediaFeatures,
  clearEmulatedMediaFeatures,
  matchElementSnapshotInSection,
} from "./test-helpers.js";

describe("KioskKeyboard Web Component - Accessibility Media Emulation", () => {
  beforeEach(async () => {
    await clearEmulatedMediaFeatures();
  });

  afterEach(async () => {
    await clearEmulatedMediaFeatures();
  });

  it("should match forced-colors (high contrast) mode", async () => {
    await setEmulatedMediaFeatures([{ name: "forced-colors", value: "active" }]);
    await openVisualPage();
    const kb = await getKeyboardRoot("kb-qwerty");
    await matchElementSnapshotInSection(kb, "webc-qwerty-forced-colors");
  });

  it("should match prefers-reduced-motion mode", async () => {
    await setEmulatedMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await openVisualPage();
    const kb = await getKeyboardRoot("kb-qwerty");
    await matchElementSnapshotInSection(kb, "webc-qwerty-reduced-motion");
  });
});
