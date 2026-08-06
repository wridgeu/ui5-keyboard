sap.ui.define(["ui5/kiosk/KioskKeyboard", "sap/m/Input", "sap/m/Button"], (KioskKeyboard, Input, Button) => {
  "use strict";

  /** Reset resolver to library defaults. */
  const resetI18n = () => {
    KioskKeyboard.setI18nResolver(null);
  };

  // 1. Baseline

  const inputBaseline = new Input({ value: "Hello World", width: "300px" });
  inputBaseline.placeAt("input-baseline");
  new KioskKeyboard({ controls: [inputBaseline.getId()] }).placeAt("kb-baseline");

  // 2. French resolver

  const frenchTexts = {
    KIOSK_KEYBOARD_LABEL: "Clavier virtuel",
    KIOSK_KEYBOARD_ROLEDESCRIPTION: "clavier",
    KEY_SHIFT: "Maj",
    KEY_ENTER: "Entr\u00e9e",
    KEY_BACKSPACE: "Retour",
    KEY_SPACE: "Espace",
    ARIA_CAPS_LOCK: "Verrouillage majuscule",
    ARIA_CAPS_LOCK_ON: "Verrouillage majuscule activ\u00e9",
    ARIA_SHIFT_ON: "Majuscule activ\u00e9e",
    ARIA_SHIFT_OFF: "Majuscule d\u00e9sactiv\u00e9e",
    ARIA_KEYBOARD_OPENED: "Clavier virtuel ouvert",
    ARIA_KEYBOARD_CLOSED: "Clavier virtuel ferm\u00e9",
  };

  const inputFrench = new Input({ value: "Bonjour", width: "300px" });
  inputFrench.placeAt("input-french");
  const kbFrench = new KioskKeyboard({ controls: [inputFrench.getId()] });
  kbFrench.placeAt("kb-french");

  new Button({
    text: "Apply French bundle",
    type: "Emphasized",
    press: () => {
      resetI18n();
      KioskKeyboard.setI18nResolver((key) => frenchTexts[key]);
    },
  }).placeAt("controls-french");

  new Button({
    text: "Reset to defaults",
    press: () => resetI18n(),
  }).placeAt("controls-french");

  // 3. Override existing English labels

  const overrideTexts = {
    KIOSK_KEYBOARD_LABEL: "Touch Keyboard",
    KEY_ENTER: "Go",
    KEY_BACKSPACE: "Delete",
  };

  const inputOverride = new Input({ value: "Custom labels", width: "300px" });
  inputOverride.placeAt("input-override");
  const kbOverride = new KioskKeyboard({ controls: [inputOverride.getId()] });
  kbOverride.placeAt("kb-override");

  new Button({
    text: "Apply overrides",
    type: "Emphasized",
    press: () => {
      resetI18n();
      KioskKeyboard.setI18nResolver((key) => overrideTexts[key]);
    },
  }).placeAt("controls-override");

  new Button({
    text: "Reset to defaults",
    press: () => resetI18n(),
  }).placeAt("controls-override");

  // 4. Programmatic resolver

  const inputHook = new Input({ value: "Hook demo", width: "300px" });
  inputHook.placeAt("input-hook");
  const kbHook = new KioskKeyboard({ controls: [inputHook.getId()] });
  kbHook.placeAt("kb-hook");

  new Button({
    text: "Set override hook",
    type: "Emphasized",
    press: () => {
      resetI18n();
      KioskKeyboard.setI18nResolver((key, _locale, resolvedText) => {
        if (key === "KIOSK_KEYBOARD_LABEL") {
          return "\u2328\uFE0F " + resolvedText;
        }
        if (key.startsWith("KEY_")) {
          return resolvedText.toUpperCase();
        }
      });
    },
  }).placeAt("controls-hook");

  new Button({
    text: "Reset to defaults",
    press: () => resetI18n(),
  }).placeAt("controls-hook");
});
