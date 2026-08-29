import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { registerI18nLoader } from "@ui5/webcomponents-base/dist/i18nBundle.js";
import { setLanguage } from "@ui5/webcomponents-base/dist/config/Language.js";
import { KEY_SHIFT } from "../../src/generated/i18n/i18n-defaults.js";
import { getText, setI18nResolver, initI18n } from "../../src/core/i18n.js";

// The framework's own loader registry is the seam. French ships no translation,
// so the loader registered here is the only one for that locale and its payload
// is what `initI18n` fetches and `getText` then reads through. The loader hands
// back the same object on every fetch, so a test declares the translation it
// needs by writing into it.
const BUNDLE_TEXTS: Record<string, string> = {};
const BUNDLE_LOCALE = "fr";

registerI18nLoader("kiosk-keyboard-webc", BUNDLE_LOCALE, () => Promise.resolve(BUNDLE_TEXTS));

describe("i18n", () => {
  beforeAll(async () => {
    await setLanguage(BUNDLE_LOCALE);
  });

  beforeEach(async () => {
    setI18nResolver(null);
    for (const key of Object.keys(BUNDLE_TEXTS)) delete BUNDLE_TEXTS[key];
    await initI18n();
  });

  it("returns default text from i18n-defaults for known key", () => {
    BUNDLE_TEXTS[KEY_SHIFT.key] = KEY_SHIFT.key; // the key itself = no translation
    expect(getText("KEY_SHIFT", "fallback")).toBe("Shift");
  });

  it("returns bundle translation when available", () => {
    BUNDLE_TEXTS[KEY_SHIFT.key] = "Umschalt";
    expect(getText("KEY_SHIFT", "fallback")).toBe("Umschalt");
  });

  it("returns fallback for unknown key", () => {
    expect(getText("NONEXISTENT_KEY", "my fallback")).toBe("my fallback");
  });

  it("resolver overrides resolved text", () => {
    BUNDLE_TEXTS[KEY_SHIFT.key] = "Shift";
    setI18nResolver((_key, _locale, _defaultText) => "Custom Shift");
    expect(getText("KEY_SHIFT", "fallback")).toBe("Custom Shift");
  });

  it("resolver receives key, locale, and resolved text", () => {
    BUNDLE_TEXTS[KEY_SHIFT.key] = "BundleShift";
    const resolver = vi.fn(() => undefined);
    setI18nResolver(resolver);
    getText("KEY_SHIFT", "fallback");

    expect(resolver).toHaveBeenCalledWith("KEY_SHIFT", BUNDLE_LOCALE, "BundleShift");
  });

  it("falls through when resolver returns undefined", () => {
    BUNDLE_TEXTS[KEY_SHIFT.key] = "BundleText";
    setI18nResolver(() => undefined);
    expect(getText("KEY_SHIFT", "fallback")).toBe("BundleText");
  });

  it("falls through and logs warning when resolver throws", () => {
    BUNDLE_TEXTS[KEY_SHIFT.key] = "BundleText";
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
    BUNDLE_TEXTS[KEY_SHIFT.key] = KEY_SHIFT.key;
    expect(getText("KEY_SHIFT", "fallback")).toBe("Shift");
  });

  it("rejects a non-function argument and keeps the previous resolver", () => {
    BUNDLE_TEXTS[KEY_SHIFT.key] = "BundleText";
    setI18nResolver(() => "override");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // @ts-expect-error a value only plain JS can supply, which is what the guard covers
    setI18nResolver("not a function");

    // Two resolutions: a stored non-function warns on each one instead of naming itself once.
    expect(getText("KEY_SHIFT", "fallback")).toBe("override");
    expect(getText("NONEXISTENT_KEY", "fallback")).toBe("override");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("must be a function or null"));
  });
});
