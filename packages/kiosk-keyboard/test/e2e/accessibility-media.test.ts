import { expect } from "@wdio/globals";
import { openVisualPage, getKeyboard, setEmulatedMediaFeatures, clearEmulatedMediaFeatures } from "./test-helpers.js";

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
    await expect(kb).toMatchElementSnapshot("kb-qwerty-forced-colors");
  });
});
