// Import the source ESM entry so Vite transpiles TS on the fly and
// deduplicates the UI5 WC framework. No tsc pre-build needed.
import { KioskKeyboard } from "../../src/bundle.esm.ts";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import { setTheme } from "@ui5/webcomponents-base/dist/config/Theme.js";

// UI5 Web Components used on the demo page
import "@ui5/webcomponents/dist/Assets.js";
import "@ui5/webcomponents/dist/Input.js";
import "@ui5/webcomponents/dist/StepInput.js";
import "@ui5/webcomponents/dist/Label.js";
import "@ui5/webcomponents/dist/Button.js";
import "@ui5/webcomponents/dist/Switch.js";
import "@ui5/webcomponents/dist/TextArea.js";

// ── Theme switcher ──
// Theme tokens are defined as CSS custom properties in index.html.
// Switching themes only requires updating the data-theme attribute on <body>
// and calling setTheme() for the UI5 Web Components.
document.querySelectorAll(".theme-controls button").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const theme = btn.dataset.theme;
    document.body.dataset.theme = theme;
    await setTheme(theme);
    document.querySelectorAll(".theme-controls button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// ── Global event log ──
const log = document.getElementById("event-log");
function appendLog(source, msg) {
  const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
  log.textContent += `[${ts}] ${source}: ${msg}\n`;
  log.scrollTop = log.scrollHeight;
}

document.getElementById("clear-log").addEventListener("click", () => {
  log.textContent = "";
});

// Wire all keyboards for event logging
document.querySelectorAll("kiosk-keyboard").forEach((kb) => {
  const name = kb.id || kb.getAttribute("keyboard-type") || "keyboard";
  kb.addEventListener("key-press", (e) => {
    const d = e.detail;
    appendLog(name, `key-press key="${d.key}" shift=${d.shiftKey}`);
  });
  kb.addEventListener("layout-change", (e) => {
    appendLog(name, `layout-change layout="${e.detail.layout}" autoDetected=${e.detail.autoDetected}`);
  });
  kb.addEventListener("keyboard-type-change", (e) => {
    appendLog(name, `keyboard-type-change type="${e.detail.keyboardType}"`);
  });
  kb.addEventListener("active-control-change", (e) => {
    const el = e.detail.activeElement;
    appendLog(name, `active-control-change target="${el ? el.id || el.tagName.toLowerCase() : "none"}"`);
  });
  kb.addEventListener("after-open", () => appendLog(name, "after-open"));
  kb.addEventListener("after-close", () => appendLog(name, "after-close"));
});

// Toggle docked keyboard
document.getElementById("toggle-docked").addEventListener("click", () => {
  const docked = document.getElementById("kb-docked");
  if (docked.open) docked.close();
  else docked.show();
});

// Custom layout: the <kiosk-keyboard-custom-layout> is declared in index.html;
// only `rows` has to be assigned, since it is a JS object rather than an attribute.
const clDemoPin = document.getElementById("cl-demo-pin");
if (clDemoPin) {
  clDemoPin.rows = [
    [{ value: "1" }, { value: "2" }, { value: "3" }],
    [{ value: "4" }, { value: "5" }, { value: "6" }],
    [{ value: "7" }, { value: "8" }, { value: "9" }],
    [{ value: "{backspace}", type: "action" }, { value: "0" }, { value: "{enter}", type: "action" }],
  ];
}

// Auto-type toggle
document.getElementById("auto-type-switch").addEventListener("change", (e) => {
  const enabled = e.target.checked;
  const kb = document.getElementById("kb-docked");
  kb.autoType = enabled;
  if (!enabled) kb.resetKeyboardType();
  appendLog("kb-docked", `autoType ${enabled ? "enabled" : "disabled"}`);
});

// ── Advanced per-instance overrides ──

// 1) setTargetResolver: route a focusable host element to a separate input.
const kbResolver = document.getElementById("kb-resolver");
if (kbResolver) {
  kbResolver.setTargetResolver((el) => {
    const id = el.getAttribute?.("data-target");
    return id ? document.getElementById(id) : null;
  });
}

// 2) middleware: emoticon composition on a custom layout.
// Mirrors the built-in middleware contract: consume the closing key and replace
// the already-typed opening char with the composed emoji.
function createEmoticonMiddleware() {
  const MAP = new Map([
    [":)", "🙂"],
    [":(", "🙁"],
    [":D", "😄"],
    [";)", "😉"],
  ]);
  let prev = "";
  return {
    handleKey(key, target) {
      const combo = prev + key;
      prev = key;
      const emoji = MAP.get(combo);
      if (!emoji) return false;
      const value = target.value;
      const pos = target.selectionStart ?? value.length;
      if (pos === 0 || value.slice(pos - 1, pos) !== combo[0]) return false;
      target.value = value.slice(0, pos - 1) + emoji + value.slice(pos);
      const caret = pos - 1 + emoji.length;
      target.setSelectionRange(caret, caret);
      target.dispatchEvent(new Event("input", { bubbles: true }));
      prev = "";
      return true;
    },
    commit() {
      return null;
    },
    reset() {
      prev = "";
    },
  };
}
const clEmoji = document.getElementById("cl-emoji-compose");
if (clEmoji) {
  clEmoji.rows = [
    [{ value: ":" }, { value: ")" }, { value: "(" }],
    [{ value: "D" }, { value: ";" }, { value: "{backspace}", type: "action" }],
  ];
  clEmoji.middleware = () => createEmoticonMiddleware();
}

// 3) locales: the kb-locale card's custom layout claims the browser locale for
// "qwertz-de" declaratively (see index.html); the locale binding has to be in the
// markup so it is folded before the keyboard resolves its default on first paint.
// Only the status line is filled in here.
const localeStatus = document.getElementById("locale-status");
if (localeStatus) {
  localeStatus.textContent = `navigator.language = "${navigator.language}" → default layout "qwertz-de" (note the ß / ä / ö keys).`;
}

// ── i18n Resolver demo ──
const i18nTranslations = {
  fr: {
    KEY_SHIFT: "Maj",
    KEY_ENTER: "Entree",
    KEY_BACKSPACE: "Retour",
    KEY_SPACE: "Espace",
    KIOSK_KEYBOARD_LABEL: "Clavier virtuel",
    KIOSK_KEYBOARD_ROLEDESCRIPTION: "clavier",
    ARIA_CAPS_LOCK: "Verr. maj.",
    ARIA_CAPS_LOCK_ON: "Verrouillage majuscules active",
    ARIA_SHIFT_ON: "Majuscules activees",
    ARIA_KEYBOARD_OPENED: "Clavier virtuel ouvert",
    ARIA_KEYBOARD_CLOSED: "Clavier virtuel ferme",
  },
  es: {
    KEY_SHIFT: "May\u00fas",
    KEY_ENTER: "Intro",
    KEY_BACKSPACE: "Retroceso",
    KEY_SPACE: "Espacio",
    KIOSK_KEYBOARD_LABEL: "Teclado virtual",
    KIOSK_KEYBOARD_ROLEDESCRIPTION: "teclado",
    ARIA_CAPS_LOCK: "Bloq May\u00fas",
    ARIA_CAPS_LOCK_ON: "Bloqueo de may\u00fasculas activado",
    ARIA_SHIFT_ON: "May\u00fasculas activadas",
    ARIA_KEYBOARD_OPENED: "Teclado virtual abierto",
    ARIA_KEYBOARD_CLOSED: "Teclado virtual cerrado",
  },
  ja: {
    KEY_SHIFT: "\u30b7\u30d5\u30c8",
    KEY_ENTER: "\u78ba\u5b9a",
    KEY_BACKSPACE: "\u524a\u9664",
    KEY_SPACE: "\u30b9\u30da\u30fc\u30b9",
    KIOSK_KEYBOARD_LABEL: "\u4eee\u60f3\u30ad\u30fc\u30dc\u30fc\u30c9",
    KIOSK_KEYBOARD_ROLEDESCRIPTION: "\u30ad\u30fc\u30dc\u30fc\u30c9",
    ARIA_CAPS_LOCK: "Caps Lock",
    ARIA_CAPS_LOCK_ON: "Caps Lock \u30aa\u30f3",
    ARIA_SHIFT_ON: "\u30b7\u30d5\u30c8\u30aa\u30f3",
    ARIA_KEYBOARD_OPENED: "\u4eee\u60f3\u30ad\u30fc\u30dc\u30fc\u30c9\u304c\u958b\u304d\u307e\u3057\u305f",
    ARIA_KEYBOARD_CLOSED: "\u4eee\u60f3\u30ad\u30fc\u30dc\u30fc\u30c9\u304c\u9589\u3058\u307e\u3057\u305f",
  },
};

// Keys to inspect in the ARIA inspector panel
const INSPECTED_KEYS = [
  { value: "{shift}", label: "Shift key" },
  { value: "{enter}", label: "Enter key" },
  { value: "{backspace}", label: "Backspace key" },
  { value: " ", label: "Space key" },
];

const i18nStatus = document.getElementById("i18n-status");
const i18nInspector = document.getElementById("i18n-aria-inspector");
const kbI18n = document.getElementById("kb-i18n");

function createInspectorCard(label, value) {
  const card = document.createElement("div");
  card.style.cssText =
    "padding: 6px 10px; background: var(--input-bg); border: 1px solid var(--border-color); border-radius: 4px";
  const labelEl = document.createElement("div");
  labelEl.style.cssText = "font-size: 11px; color: var(--muted-color)";
  labelEl.textContent = label;
  const valueEl = document.createElement("div");
  valueEl.style.fontWeight = "bold";
  valueEl.textContent = value;
  card.appendChild(labelEl);
  card.appendChild(valueEl);
  return card;
}

function updateAriaInspector() {
  const root = kbI18n.shadowRoot;
  if (!root) return;
  const kbGroup = root.querySelector("[role='group']");
  const kbAriaLabel = kbGroup ? kbGroup.getAttribute("aria-label") : "?";
  const kbRoleDesc = kbGroup ? kbGroup.getAttribute("aria-roledescription") : "?";

  i18nInspector.replaceChildren(
    createInspectorCard("aria-label (keyboard)", kbAriaLabel),
    createInspectorCard("aria-roledescription", kbRoleDesc),
    ...INSPECTED_KEYS.map((spec) => {
      const keyEl = root.querySelector(`[data-key="${CSS.escape(spec.value)}"]`);
      // aria-label is only set when there is no visible text (correct a11y).
      // Fall back to the element's text content (the accessible name a
      // screen reader would announce).
      const ariaLabel = keyEl ? keyEl.getAttribute("aria-label") || keyEl.textContent.trim() : "?";
      return createInspectorCard(spec.label, ariaLabel);
    }),
  );
}

// Initial render of ARIA inspector
requestAnimationFrame(() => requestAnimationFrame(updateAriaInspector));

document.querySelectorAll(".i18n-lang-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const lang = btn.dataset.lang;

    document.querySelectorAll(".i18n-lang-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    if (!lang) {
      KioskKeyboard.setI18nResolver(null);
      i18nStatus.textContent = "Using built-in translations";
      appendLog("kb-i18n", "i18n resolver cleared (using defaults)");
    } else {
      const texts = i18nTranslations[lang];
      KioskKeyboard.setI18nResolver((key) => texts[key]);
      i18nStatus.textContent = `Resolver active: ${btn.textContent.trim()} override`;
      appendLog("kb-i18n", `i18n resolver set for ${btn.textContent.trim()}`);
    }

    // _queueI18nRefresh schedules a rAF before it calls reRenderAllUI5Elements,
    // so we need to wait one frame for that rAF to fire, then for the render to
    // finish, before the DOM reflects the new resolver values.
    await new Promise((r) => requestAnimationFrame(r));
    await renderFinished();
    updateAriaInspector();
  });
});

// Variant tiers: the house set applies under every layout, the slotted custom layout's
// own table merges over it per base letter. The suppressed twin needs no JavaScript.
const kbVariants = document.getElementById("kb-variants");
if (kbVariants) {
  kbVariants.defaultVariants = { q: ["ǫ", "ɋ"], w: ["ŵ"] };
}
const clVariants = document.getElementById("cl-variants");
if (clVariants) {
  clVariants.variants = { a: ["ą"], s: ["ś", "š"] };
}

// autoCompact: report which tier the resized box currently resolves to. The keyboard
// needs no script - `auto-compact` is an attribute - so this only reads it back out.
// `effectiveLayout`, not `layout`: the latter is the layout asked for, which a width
// swap deliberately leaves alone.
const kbCompact = document.getElementById("kb-compact");
const compactStatus = document.getElementById("compact-status");
if (kbCompact && compactStatus) {
  const report = () => {
    const width = Math.round(kbCompact.getBoundingClientRect().width);
    compactStatus.textContent = `keyboard width ${width}px → layout "${kbCompact.effectiveLayout}"`;
  };
  kbCompact.addEventListener("layout-change", report);
  new ResizeObserver(report).observe(kbCompact);
}
