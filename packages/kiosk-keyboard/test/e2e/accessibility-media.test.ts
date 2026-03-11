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

  it("should match prefers-reduced-motion mode", async () => {
    await setEmulatedMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await openVisualPage();
    const kb = await getKeyboard("kb-qwerty");
    await expect(kb).toMatchElementSnapshot("kb-qwerty-reduced-motion");
  });
});
