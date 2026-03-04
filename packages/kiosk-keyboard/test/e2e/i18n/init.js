sap.ui.define(["ui5/kiosk/KioskKeyboard", "sap/m/Input", "sap/m/Button"], (KioskKeyboard, Input, Button) => {
  "use strict";

  // ── Helpers ──────────────────────────────────

  /** Reset all i18n state to library defaults. */
  const resetI18n = () => {
    KioskKeyboard.resetI18nConfiguration();
    KioskKeyboard.clearI18nOverrideHook();
  };

  // Resolve the base URL for this demo directory so bundle URLs
  // work regardless of how the page is served.
  const base = sap.ui.require.toUrl("i18n-demo");

  // ── 1. Baseline ─────────────────────────────

  const inputBaseline = new Input({ value: "Hello World", width: "300px" });
  inputBaseline.placeAt("input-baseline");
  new KioskKeyboard({ targetInput: inputBaseline }).placeAt("kb-baseline");

  // ── 2. French enhancement bundle ────────────

  const inputFrench = new Input({ value: "Bonjour", width: "300px" });
  inputFrench.placeAt("input-french");
  const kbFrench = new KioskKeyboard({ targetInput: inputFrench });
  kbFrench.placeAt("kb-french");

  new Button({
    text: "Apply French bundle",
    type: "Emphasized",
    press: () => {
      resetI18n();
      KioskKeyboard.configureI18n({
        enhanceWith: [
          {
            bundleUrl: `${base}/i18n/messagebundle.properties`,
            supportedLocales: [""],
            fallbackLocale: "",
          },
        ],
      });
    },
  }).placeAt("controls-french");

  new Button({
    text: "Reset to defaults",
    press: () => resetI18n(),
  }).placeAt("controls-french");

  // ── 3. Override existing English labels ──────

  const inputOverride = new Input({ value: "Custom labels", width: "300px" });
  inputOverride.placeAt("input-override");
  const kbOverride = new KioskKeyboard({ targetInput: inputOverride });
  kbOverride.placeAt("kb-override");

  new Button({
    text: "Apply overrides",
    type: "Emphasized",
    press: () => {
      resetI18n();
      KioskKeyboard.configureI18n({
        enhanceWith: [
          {
            bundleUrl: `${base}/i18n-override/messagebundle.properties`,
            supportedLocales: [""],
            fallbackLocale: "",
          },
        ],
      });
    },
  }).placeAt("controls-override");

  new Button({
    text: "Reset to defaults",
    press: () => resetI18n(),
  }).placeAt("controls-override");

  // ── 4. Programmatic override hook ────────────

  const inputHook = new Input({ value: "Hook demo", width: "300px" });
  inputHook.placeAt("input-hook");
  const kbHook = new KioskKeyboard({ targetInput: inputHook });
  kbHook.placeAt("kb-hook");

  new Button({
    text: "Set override hook",
    type: "Emphasized",
    press: () => {
      resetI18n();
      KioskKeyboard.setI18nOverrideHook((ctx) => {
        if (ctx.key === "KIOSK_KEYBOARD_LABEL") {
          return `⌨️ ${ctx.resolvedText}`;
        }
        if (ctx.key.startsWith("KEY_")) {
          return ctx.resolvedText.toUpperCase();
        }
      });
    },
  }).placeAt("controls-hook");

  new Button({
    text: "Reset to defaults",
    press: () => resetI18n(),
  }).placeAt("controls-hook");
});
