import { expect } from "@wdio/globals";
import { openTestPage, getKeyboardRoot, setEmulatedMediaFeatures, clearEmulatedMediaFeatures } from "./test-helpers.js";

describe("KioskKeyboard Web Component - Accessibility Media Emulation", () => {
  afterEach(async () => {
    await clearEmulatedMediaFeatures();
  });

  it("should match forced-colors (high contrast) mode", async () => {
    await setEmulatedMediaFeatures([{ name: "forced-colors", value: "active" }]);
    await openTestPage();
    const kb = await getKeyboardRoot("kb-qwerty");
    await expect(kb).toMatchElementSnapshot("webc-qwerty-forced-colors");
  });

  it("should match prefers-reduced-motion mode", async () => {
    await setEmulatedMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await openTestPage();
    const kb = await getKeyboardRoot("kb-qwerty");
    await expect(kb).toMatchElementSnapshot("webc-qwerty-reduced-motion");
  });
});
