/**
 * Lightweight i18n module for the web component.
 *
 * Provides key → text resolution with locale support. The UI5 WC i18n system
 * (registerI18nLoader + @i18n decorator) can replace this once the build
 * tooling is fully wired up.
 */

/** Default English texts. */
const EN: Record<string, string> = {
  KIOSK_KEYBOARD_LABEL: "Virtual Keyboard",
  KIOSK_KEYBOARD_ROLEDESCRIPTION: "keyboard",
  KEY_SHIFT: "Shift",
  KEY_ENTER: "Enter",
  KEY_BACKSPACE: "Backspace",
  KEY_SPACE: "Space",
  ARIA_CAPS_LOCK: "Caps Lock",
  ARIA_CAPS_LOCK_ON: "Caps Lock on",
  ARIA_SHIFT_ON: "Shift on",
  ARIA_KEYBOARD_OPENED: "Virtual keyboard opened",
  ARIA_KEYBOARD_CLOSED: "Virtual keyboard closed",
};

/** German texts. */
const DE: Record<string, string> = {
  KIOSK_KEYBOARD_LABEL: "Virtuelle Tastatur",
  KIOSK_KEYBOARD_ROLEDESCRIPTION: "Tastatur",
  KEY_SHIFT: "Umschalt",
  KEY_ENTER: "Eingabe",
  KEY_BACKSPACE: "R\u00fccktaste",
  KEY_SPACE: "Leertaste",
  ARIA_CAPS_LOCK: "Feststelltaste",
  ARIA_CAPS_LOCK_ON: "Feststelltaste ein",
  ARIA_SHIFT_ON: "Umschalttaste ein",
  ARIA_KEYBOARD_OPENED: "Virtuelle Tastatur ge\u00f6ffnet",
  ARIA_KEYBOARD_CLOSED: "Virtuelle Tastatur geschlossen",
};

const BUNDLES: Record<string, Record<string, string>> = {
  en: EN,
  de: DE,
};

type I18nResolver = (key: string, locale: string, defaultText: string) => string | undefined;

let _resolver: I18nResolver | null = null;

/**
 * Set a custom i18n resolver callback for programmatic overrides.
 * Return a string to override, or undefined to keep the default.
 */
export function setI18nResolver(fn: I18nResolver | null): void {
  _resolver = fn;
}

function getLocaleBundle(): Record<string, string> {
  const lang = new Intl.Locale(navigator.language).language.toLowerCase();
  return BUNDLES[lang] ?? EN;
}

/**
 * Get a translated text for the given key.
 */
export function getText(key: string, fallback: string): string {
  const bundle = getLocaleBundle();
  const resolved = bundle[key] ?? fallback;

  if (_resolver) {
    try {
      const locale = new Intl.Locale(navigator.language).language;
      const override = _resolver(key, locale, resolved);
      if (typeof override === "string") return override;
    } catch {
      // Resolver threw — use resolved text
    }
  }

  return resolved;
}
