import { expect } from "@wdio/globals";
import {
  openVisualPage,
  getKeyboardRoot,
  setEmulatedMediaFeatures,
  clearEmulatedMediaFeatures,
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
    await expect(kb).toMatchElementSnapshot("webc-qwerty-forced-colors");
  });
});
