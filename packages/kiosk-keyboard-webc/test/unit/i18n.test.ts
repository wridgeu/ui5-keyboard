import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock only the UI5 WC i18n bundle - i18n-defaults.js is a generated file
// with plain object exports that works fine without mocking.
const mockGetText = vi.fn();
vi.mock("@ui5/webcomponents-base/dist/i18nBundle.js", () => ({
  getI18nBundle: vi.fn(() => Promise.resolve({ getText: mockGetText })),
}));

// Import after mock is set up
const { getText, setI18nResolver, initI18n } = await import("../../src/core/i18n.js");

describe("i18n", () => {
  beforeEach(async () => {
    setI18nResolver(null);
    mockGetText.mockReset();
    await initI18n();
  });

  it("returns default text from i18n-defaults for known key", () => {
    mockGetText.mockReturnValue("KEY_SHIFT"); // returns the key itself = no translation
    expect(getText("KEY_SHIFT", "fallback")).toBe("Shift");
  });

  it("returns bundle translation when available", () => {
    mockGetText.mockReturnValue("Umschalt");
    expect(getText("KEY_SHIFT", "fallback")).toBe("Umschalt");
  });

  it("returns fallback for unknown key", () => {
    expect(getText("NONEXISTENT_KEY", "my fallback")).toBe("my fallback");
  });

  it("resolver overrides resolved text", () => {
    mockGetText.mockReturnValue("Shift");
    setI18nResolver((_key, _locale, _defaultText) => "Custom Shift");
    expect(getText("KEY_SHIFT", "fallback")).toBe("Custom Shift");
  });

  it("resolver receives key, locale, and resolved text", () => {
    mockGetText.mockReturnValue("BundleShift");
    const resolver = vi.fn(() => undefined);
    setI18nResolver(resolver);
    getText("KEY_SHIFT", "fallback");

    expect(resolver).toHaveBeenCalledWith("KEY_SHIFT", expect.any(String), "BundleShift");
  });

  it("falls through when resolver returns undefined", () => {
    mockGetText.mockReturnValue("BundleText");
    setI18nResolver(() => undefined);
    expect(getText("KEY_SHIFT", "fallback")).toBe("BundleText");
  });

  it("falls through and logs warning when resolver throws", () => {
    mockGetText.mockReturnValue("BundleText");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    setI18nResolver(() => {
      throw new Error("resolver broke");
    });

    expect(getText("KEY_SHIFT", "fallback")).toBe("BundleText");
    expect(warnSpy).toHaveBeenCalledWith("[kiosk-keyboard] i18n resolver threw:", expect.any(Error));
  });

  it("clearing resolver with null disables override", () => {
    setI18nResolver(() => "override");
    expect(getText("KEY_SHIFT", "fallback")).toBe("override");

    setI18nResolver(null);
    mockGetText.mockReturnValue("KEY_SHIFT");
    expect(getText("KEY_SHIFT", "fallback")).toBe("Shift");
  });
});
