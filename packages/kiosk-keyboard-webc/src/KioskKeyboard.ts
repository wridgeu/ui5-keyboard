import { ShiftState } from "./core/shift-state.js";
import { resolveInputOrTextarea, keyElementId, KEY_ID_SUFFIX_RE } from "./core/dom-utils.js";
import { insertText, handleBackspace } from "./core/input-operations.js";
import { detectKeyboardType } from "./core/keyboard-type-detector.js";
import {
  getLayoutOrDefault,
  getLocaleLayout,
  registerLayout,
  unregisterLayout,
  resetCustomLayouts,
  getRegisteredLayout,
  getRegisteredLayoutNames,
  isBuiltInLayout,
  registerLocaleLayout,
  unregisterLocaleLayout,
  resetLocaleLayouts,
} from "./core/layout-registry.js";
import { getText, setI18nResolver } from "./core/i18n.js";
import type { LayoutDefinition, KeyDefinition } from "./types.js";
import cssText from "./themes/KioskKeyboard.css.js";

// ── Icon SVGs for built-in special keys ──
const ICON_SHIFT =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 2l6 7h-4v5H6V9H2z"/></svg>';
const ICON_SHIFT_LOCKED =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1l6 7h-4v3H6V8H2z"/><rect x="5" y="12" width="6" height="3" rx="0.5"/></svg>';
const ICON_ENTER =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13 3v5H5.5l2.3-2.3L7 5l-4 4 4 4 .8-.7L5.5 10H14V3z"/></svg>';
const ICON_BACKSPACE =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M14 3H5L1 8l4 5h9V3zm-3.3 6.3l-.7.7L8 8l-2 2-.7-.7L7.3 8 5.3 6l.7-.7L8 7.3l2-2.3.7.7L8.7 8z"/></svg>';

const ICON_MAP: Record<string, string> = {
  "{shift}": ICON_SHIFT,
  "{enter}": ICON_ENTER,
  "{backspace}": ICON_BACKSPACE,
};

/** ARIA labels for icon-only special keys. */
const SPECIAL_KEY_LABELS: Record<string, string> = {
  "{shift}": "KEY_SHIFT",
  "{enter}": "KEY_ENTER",
  "{backspace}": "KEY_BACKSPACE",
  " ": "KEY_SPACE",
};

// ── Reusable elements for safe HTML/attribute escaping ──
const _escDiv = document.createElement("div");
const _escTextNode = document.createTextNode("");
_escDiv.appendChild(_escTextNode);

/** Escape a string for safe use as HTML text content. */
function escHtml(s: string): string {
  _escTextNode.data = s;
  return _escDiv.innerHTML;
}

/** Escape a string for safe use inside a double-quoted HTML attribute value. */
function escAttr(s: string): string {
  return escHtml(s).replaceAll('"', "&quot;");
}

/**
 * `<kiosk-keyboard>` — Native web component for on-screen virtual keyboard.
 *
 * Built on standard custom elements (no UI5 runtime required). Consumable in
 * any framework (HTML, React, Vue, Angular) and inside UI5 apps via
 * `WebComponent.extend()` bridge.
 *
 * @tagname kiosk-keyboard
 */
export default class KioskKeyboard extends HTMLElement {
  // ── Static registry delegates ──
  static registerLayout = registerLayout;
  static unregisterLayout = unregisterLayout;
  static resetCustomLayouts = resetCustomLayouts;
  static getRegisteredLayout = getRegisteredLayout;
  static getRegisteredLayoutNames = getRegisteredLayoutNames;
  static isBuiltInLayout = isBuiltInLayout;
  static registerLocaleLayout = registerLocaleLayout;
  static unregisterLocaleLayout = unregisterLocaleLayout;
  static resetLocaleLayouts = resetLocaleLayouts;
  static getLocaleLayout = getLocaleLayout;
  static setI18nResolver = setI18nResolver;

  // ── Observed attributes ──
  static get observedAttributes(): string[] {
    return [
      "layout",
      "keyboard-type",
      "docked",
      "open",
      "auto-show",
      "auto-type",
      "disabled",
      "for",
      "aria-label",
      "input-ids",
      "stable-height",
    ];
  }

  // ── All living instances (for multi-keyboard isolation) ──
  private static readonly _instances = new Set<KioskKeyboard>();

  // ── Internal state ──
  private _shiftState = new ShiftState();
  private _baseLayout = "";
  private _currentLayout = "";
  private _keyboardTypeExplicit = false;
  private _open = false;
  private _targetElement: HTMLInputElement | HTMLTextAreaElement | null = null;
  private _lastFocusedKeyId: string | null = null;
  private _maxHeight = 0;
  private _deferredFocusOutCloseId: number | null = null;

  // ── Inputmode suppression (ref-counted, shared across instances) ──
  private static readonly _inputModeSuppressions = new Map<string, { original: string | null; refCount: number }>();
  private _suppressedInputId: string | null = null;

  // ── Physical keyboard highlight ──
  private _highlightTargetId: string | null = null;

  // ── Shadow DOM ──
  private readonly _shadow: ShadowRoot;

  // ── Bound listeners ──
  private readonly _boundFocusIn: (e: FocusEvent) => void;
  private readonly _boundFocusOut: (e: FocusEvent) => void;
  private readonly _boundEscape: EventListener;
  private readonly _boundPhysicalKeyDown: EventListener;
  private readonly _boundPhysicalKeyUp: EventListener;

  private static _sheet: CSSStyleSheet | null = null;

  private static _getSheet(): CSSStyleSheet {
    if (!KioskKeyboard._sheet) {
      KioskKeyboard._sheet = new CSSStyleSheet();
      KioskKeyboard._sheet.replaceSync(cssText);
    }
    return KioskKeyboard._sheet;
  }

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: "open" });
    this._shadow.adoptedStyleSheets = [KioskKeyboard._getSheet()];

    this._boundFocusIn = this._onDocumentFocusIn.bind(this);
    this._boundFocusOut = this._onDocumentFocusOut.bind(this);
    this._boundEscape = (e: Event) => this._onDocumentEscape(e as KeyboardEvent);
    this._boundPhysicalKeyDown = (e: Event) => this._highlightKey((e as KeyboardEvent).key, true);
    this._boundPhysicalKeyUp = (e: Event) => this._highlightKey((e as KeyboardEvent).key, false);
  }

  // ── Lifecycle ──

  connectedCallback(): void {
    KioskKeyboard._instances.add(this);

    // Set locale-based default layout if none specified
    if (!this._baseLayout) {
      this._baseLayout = getLocaleLayout();
      if (!this.getAttribute("layout")) {
        this._currentLayout = this._baseLayout;
      }
    }

    this._render();
    this._syncAutoShow();
    this._syncPhysicalKeyHighlight();

    if (this.docked) {
      document.addEventListener("keydown", this._boundEscape);
    }
  }

  disconnectedCallback(): void {
    KioskKeyboard._instances.delete(this);
    this._teardownAutoShow();
    this._teardownPhysicalKeyHighlight();
    this._restoreInputMode();
    document.removeEventListener("keydown", this._boundEscape);

    if (this._deferredFocusOutCloseId !== null) {
      cancelAnimationFrame(this._deferredFocusOutCloseId);
      this._deferredFocusOutCloseId = null;
    }
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    this._render();

    if (name === "auto-show") this._syncAutoShow();
    if (name === "docked") {
      if (newValue !== null) {
        document.addEventListener("keydown", this._boundEscape);
      } else {
        document.removeEventListener("keydown", this._boundEscape);
      }
    }
  }

  // ── Property accessors (reflect to/from attributes) ──

  get layout(): string {
    return this.getAttribute("layout") ?? "";
  }
  set layout(val: string) {
    this.setAttribute("layout", val);
    this._baseLayout = val;
    this._currentLayout = val;
  }

  get keyboardType(): string {
    return this.getAttribute("keyboard-type") ?? "Full";
  }
  set keyboardType(val: string) {
    this.setAttribute("keyboard-type", val);
    this._keyboardTypeExplicit = true;
  }

  get docked(): boolean {
    return this.hasAttribute("docked");
  }
  set docked(val: boolean) {
    this.toggleAttribute("docked", val);
  }

  get open(): boolean {
    return this._open;
  }
  set open(val: boolean) {
    if (val) this.show();
    else this.close();
  }

  get autoShow(): boolean {
    return this.hasAttribute("auto-show");
  }
  set autoShow(val: boolean) {
    this.toggleAttribute("auto-show", val);
  }

  get autoType(): boolean {
    return this.hasAttribute("auto-type");
  }
  set autoType(val: boolean) {
    this.toggleAttribute("auto-type", val);
  }

  get enabled(): boolean {
    return !this.hasAttribute("disabled");
  }
  set enabled(val: boolean) {
    this.toggleAttribute("disabled", !val);
  }

  get for(): string {
    return this.getAttribute("for") ?? "";
  }
  set for(val: string) {
    this.setAttribute("for", val);
  }

  get inputIds(): string[] {
    const attr = this.getAttribute("input-ids");
    return attr
      ? attr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  }
  set inputIds(val: string[]) {
    this.setAttribute("input-ids", val.join(","));
  }

  get stableHeight(): boolean {
    return this.hasAttribute("stable-height");
  }
  set stableHeight(val: boolean) {
    this.toggleAttribute("stable-height", val);
  }

  // ── Public API ──

  show(): void {
    if (!this.docked) return;
    this._open = true;
    this._render();
    this._suppressInputMode();
    this._announceLiveRegion(getText("ARIA_KEYBOARD_OPENED", "Virtual keyboard opened"));
    this.dispatchEvent(new CustomEvent("after-open", { bubbles: true, composed: true }));
  }

  close(): void {
    if (!this.docked) return;
    this._open = false;
    this._render();
    this._restoreInputMode();
    this._announceLiveRegion(getText("ARIA_KEYBOARD_CLOSED", "Virtual keyboard closed"));
    this.dispatchEvent(new CustomEvent("after-close", { bubbles: true, composed: true }));
  }

  setTargetElement(el: HTMLInputElement | HTMLTextAreaElement | null): void {
    this._targetElement = el;
  }

  resetKeyboardType(): void {
    this._keyboardTypeExplicit = false;
    this.removeAttribute("keyboard-type");
    this._render();
  }

  // ── Target resolution ──

  private _resolveTarget(): HTMLInputElement | HTMLTextAreaElement | null {
    if (this._targetElement) return this._targetElement;

    const forId = this.for;
    if (forId) {
      const el = document.getElementById(forId);
      return resolveInputOrTextarea(el);
    }

    return null;
  }

  // ── Layout resolution ──

  private _getResolvedLayout(): LayoutDefinition {
    const type = this.keyboardType;
    if (type === "Numpad") return getLayoutOrDefault("numpad");
    if (type === "Numeric") return getLayoutOrDefault("numeric");
    const name = this._currentLayout || this._baseLayout || this.layout || getLocaleLayout();
    return getLayoutOrDefault(name);
  }

  // ── Key interaction ──

  private _onKeyClick(e: Event): void {
    if (!this.enabled) return;

    const keyEl = (e.target as HTMLElement).closest<HTMLElement>("[data-key]");
    if (!keyEl) return;

    const value = keyEl.dataset.key!;
    const shifted = this._shiftState.isShifted;
    const shiftValue = keyEl.dataset.shiftValue;

    // Fire key-press event (can be canceled)
    const keyPressEvent = new CustomEvent("key-press", {
      detail: { key: value, shiftKey: shifted },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    if (!this.dispatchEvent(keyPressEvent)) return;

    const target = this._resolveTarget();

    // Handle special keys
    if (value === "{shift}") {
      this._shiftState.toggle();
      this._render();
      return;
    }

    if (value === "{backspace}") {
      if (target) handleBackspace(target);
      this._autoReleaseShift();
      return;
    }

    if (value === "{enter}") {
      if (target) {
        if (target instanceof HTMLTextAreaElement) {
          insertText(target, "\n");
        } else {
          target.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      this._autoReleaseShift();
      return;
    }

    if (value.startsWith("{layout:")) {
      const layoutName = value.slice(8, -1);
      if (layoutName === "base") {
        this._currentLayout = this._baseLayout || this.layout || getLocaleLayout();
      } else {
        this._currentLayout = layoutName;
      }
      this.dispatchEvent(
        new CustomEvent("layout-change", {
          detail: { layout: this._currentLayout },
          bubbles: true,
          composed: true,
        }),
      );
      this._render();
      return;
    }

    if (value.startsWith("{fkey:")) {
      // F-key: no text insertion, just the event
      this._autoReleaseShift();
      return;
    }

    // Regular character key
    if (target) {
      const char = shifted ? (shiftValue ?? value.toUpperCase()) : value;
      insertText(target, char);
    }
    this._autoReleaseShift();
  }

  private _autoReleaseShift(): void {
    if (this._shiftState.autoRelease()) {
      this._render();
    }
  }

  /** Focus steal prevention: mousedown/touchstart on keys prevents focus transfer. */
  private _onKeyMouseDown(e: Event): void {
    e.preventDefault();
  }

  /** Physical keyboard highlight: add/remove pressed class on matching key. */
  private _highlightKey(physicalKey: string, pressed: boolean): void {
    const root = this._shadow;
    const lowerKey = physicalKey.toLowerCase();

    if (pressed) {
      const selector = `[data-key="${CSS.escape(lowerKey)}"], [data-shift-value="${CSS.escape(physicalKey)}"]`;
      const el = root.querySelector<HTMLElement>(selector);
      if (el) el.classList.add("kiosk-key--highlight");
    } else {
      root
        .querySelectorAll<HTMLElement>(".kiosk-key--highlight")
        .forEach((el) => el.classList.remove("kiosk-key--highlight"));
    }
  }

  // ── Roving tabindex / keyboard navigation ──

  private _onKeyDown(e: KeyboardEvent): void {
    const keyEl = (e.target as HTMLElement).closest<HTMLElement>("[data-key]");
    if (!keyEl) return;

    const layout = this._getResolvedLayout();
    const match = keyEl.id.match(KEY_ID_SUFFIX_RE);
    if (!match) return;

    let row = Number.parseInt(match[1], 10);
    let col = Number.parseInt(match[2], 10);
    let moved = false;

    switch (e.key) {
      case "ArrowRight":
        col = col + 1 < (layout[row]?.length ?? 0) ? col + 1 : 0;
        moved = true;
        break;
      case "ArrowLeft":
        col = col - 1 >= 0 ? col - 1 : (layout[row]?.length ?? 1) - 1;
        moved = true;
        break;
      case "ArrowDown":
        row = row + 1 < layout.length ? row + 1 : 0;
        col = Math.min(col, (layout[row]?.length ?? 1) - 1);
        moved = true;
        break;
      case "ArrowUp":
        row = row - 1 >= 0 ? row - 1 : layout.length - 1;
        col = Math.min(col, (layout[row]?.length ?? 1) - 1);
        moved = true;
        break;
      case "Home":
        col = 0;
        moved = true;
        break;
      case "End":
        col = (layout[row]?.length ?? 1) - 1;
        moved = true;
        break;
      case "Enter":
      case " ":
        keyEl.click();
        e.preventDefault();
        return;
    }

    if (moved) {
      e.preventDefault();
      const id = keyElementId(this._componentId, row, col);
      const nextEl = this._shadow.getElementById(id);
      if (nextEl) {
        keyEl.setAttribute("tabindex", "-1");
        nextEl.setAttribute("tabindex", "0");
        nextEl.focus();
        this._lastFocusedKeyId = id;
      }
    }
  }

  // ── Auto-show (focusin/focusout) ──

  private _syncAutoShow(): void {
    if (this.autoShow && this.docked) {
      document.addEventListener("focusin", this._boundFocusIn, true);
      document.addEventListener("focusout", this._boundFocusOut, true);
    } else {
      this._teardownAutoShow();
    }
  }

  private _teardownAutoShow(): void {
    document.removeEventListener("focusin", this._boundFocusIn, true);
    document.removeEventListener("focusout", this._boundFocusOut, true);
  }

  private _onDocumentFocusIn(e: FocusEvent): void {
    if (!this.enabled || !this.docked || !this.autoShow) return;

    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    // Skip if focus is inside our own shadow
    if (this._shadow.contains(target) || this.contains(target)) return;

    const inputEl = resolveInputOrTextarea(target);
    if (!inputEl) return;

    // Skip if this input is targeted by another keyboard
    if (this._isTargetOfOther(inputEl)) return;

    // Check inputIds filter
    const ids = this.inputIds;
    if (ids.length > 0) {
      const targetId = target.id || target.closest("[id]")?.id;
      if (!targetId || !ids.includes(targetId)) return;
    }

    this._targetElement = inputEl;

    // Auto-type detection
    if (this.autoType && !this._keyboardTypeExplicit) {
      const detected = detectKeyboardType(target);
      if (detected !== this.keyboardType) {
        this.setAttribute("keyboard-type", detected);
      }
    }

    // Cancel any pending close
    if (this._deferredFocusOutCloseId !== null) {
      cancelAnimationFrame(this._deferredFocusOutCloseId);
      this._deferredFocusOutCloseId = null;
    }

    if (!this._open) this.show();
  }

  private _onDocumentFocusOut(_e: FocusEvent): void {
    if (!this._open) return;

    // Defer close to next frame so focusin on another input cancels it
    this._deferredFocusOutCloseId = requestAnimationFrame(() => {
      this._deferredFocusOutCloseId = null;
      const active = document.activeElement;

      // Don't close if focus moved to our shadow DOM
      if (active && (this._shadow.contains(active) || this.contains(active))) return;

      // Don't close if focus moved to another input
      if (active && resolveInputOrTextarea(active)) return;

      this.close();
      this._targetElement = null;
    });
  }

  private _isTargetOfOther(inputEl: HTMLElement): boolean {
    for (const kb of KioskKeyboard._instances) {
      if (kb === this) continue;
      if (kb._targetElement === inputEl) return true;
      const kbFor = kb.for;
      if (kbFor && document.getElementById(kbFor) === inputEl) return true;
    }
    return false;
  }

  private _onDocumentEscape(e: KeyboardEvent): void {
    if (e.key === "Escape" && this._open) {
      this.close();
    }
  }

  // ── Inputmode suppression ──

  private _suppressInputMode(): void {
    const target = this._resolveTarget();
    if (!target || !target.id) return;

    const id = target.id;
    const existing = KioskKeyboard._inputModeSuppressions.get(id);
    if (existing) {
      existing.refCount++;
    } else {
      KioskKeyboard._inputModeSuppressions.set(id, {
        original: target.getAttribute("inputmode"),
        refCount: 1,
      });
    }
    target.setAttribute("inputmode", "none");
    this._suppressedInputId = id;
  }

  private _restoreInputMode(): void {
    if (!this._suppressedInputId) return;

    const id = this._suppressedInputId;
    const state = KioskKeyboard._inputModeSuppressions.get(id);
    if (state) {
      state.refCount--;
      if (state.refCount <= 0) {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (el) {
          if (state.original !== null) {
            el.setAttribute("inputmode", state.original);
          } else {
            el.removeAttribute("inputmode");
          }
        }
        KioskKeyboard._inputModeSuppressions.delete(id);
      }
    }
    this._suppressedInputId = null;
  }

  // ── Physical keyboard highlight ──

  private _syncPhysicalKeyHighlight(): void {
    const target = this._resolveTarget();
    const targetId = target?.id ?? null;

    if (targetId === this._highlightTargetId) return;

    if (this._highlightTargetId) {
      const oldEl = document.getElementById(this._highlightTargetId);
      if (oldEl) {
        oldEl.removeEventListener("keydown", this._boundPhysicalKeyDown);
        oldEl.removeEventListener("keyup", this._boundPhysicalKeyUp);
      }
    }

    this._highlightTargetId = targetId;

    if (target) {
      target.addEventListener("keydown", this._boundPhysicalKeyDown);
      target.addEventListener("keyup", this._boundPhysicalKeyUp);
    }
  }

  private _teardownPhysicalKeyHighlight(): void {
    if (this._highlightTargetId) {
      const el = document.getElementById(this._highlightTargetId);
      if (el) {
        el.removeEventListener("keydown", this._boundPhysicalKeyDown);
        el.removeEventListener("keyup", this._boundPhysicalKeyUp);
      }
      this._highlightTargetId = null;
    }
  }

  // ── Key label/icon helpers ──

  private _getKeyLabel(key: KeyDefinition): string {
    if (this._shiftState.isShifted) {
      if (key.shiftLabel) return key.shiftLabel;
      if (key.shiftValue) return key.shiftValue;
      if (key.value.length === 1) return key.value.toUpperCase();
    }
    return key.label ?? key.value;
  }

  private _getKeyAriaLabel(key: KeyDefinition): string {
    const i18nKey = SPECIAL_KEY_LABELS[key.value];
    if (i18nKey) return getText(i18nKey, key.value);
    return this._getKeyLabel(key);
  }

  private _getKeyIcon(key: KeyDefinition): string | null {
    if (key.icon) return escHtml(key.icon);
    if (key.value === "{shift}" && this._shiftState.isCapsLock) return ICON_SHIFT_LOCKED;
    return ICON_MAP[key.value] ?? null;
  }

  private get _componentId(): string {
    return this.id || "kiosk-kb";
  }

  // ── Rendering ──

  private _render(): void {
    const layout = this._getResolvedLayout();
    const type = this.keyboardType;

    const rootClasses = ["kiosk-keyboard"];
    if (type === "Numpad") rootClasses.push("kiosk-keyboard--numpad");
    if (type === "Numeric") rootClasses.push("kiosk-keyboard--numeric");
    if (this.docked) rootClasses.push("kiosk-keyboard--docked");
    if (this.docked && !this._open) rootClasses.push("kiosk-keyboard--closed");
    if (!this.enabled) rootClasses.push("kiosk-keyboard--disabled");

    // Resolve focus target (roving tabindex)
    let focusRow = 0;
    let focusCol = 0;
    if (this._lastFocusedKeyId) {
      const match = this._lastFocusedKeyId.match(KEY_ID_SUFFIX_RE);
      if (match) {
        const r = Number.parseInt(match[1], 10);
        const c = Number.parseInt(match[2], 10);
        if (layout[r]?.[c]) {
          focusRow = r;
          focusCol = c;
        }
      }
    }

    const ariaLabel = this.getAttribute("aria-label") || getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard");
    const roleDesc = getText("KIOSK_KEYBOARD_ROLEDESCRIPTION", "keyboard");

    let html = `<div class="${rootClasses.join(" ")}" role="group" aria-label="${escAttr(ariaLabel)}" aria-roledescription="${escAttr(roleDesc)}">`;

    for (let ri = 0; ri < layout.length; ri++) {
      const row = layout[ri];
      html += '<div class="kiosk-row">';

      for (let ci = 0; ci < row.length; ci++) {
        const key = row[ci];
        const keyClasses = this._buildKeyClasses(key);
        const id = keyElementId(this._componentId, ri, ci);
        const isFocusTarget = ri === focusRow && ci === focusCol;
        const tabindex = this.enabled && isFocusTarget ? "0" : "-1";

        const isShiftKey = key.value === "{shift}";
        const ariaPressed = isShiftKey ? ` aria-pressed="${this._shiftState.isShifted}"` : "";
        const ariaDisabled = !this.enabled ? ' aria-disabled="true"' : "";
        const dataShiftValue = key.shiftValue ? ` data-shift-value="${escAttr(key.shiftValue)}"` : "";

        const keyAriaLabel =
          isShiftKey && this._shiftState.isCapsLock
            ? getText("ARIA_CAPS_LOCK", "Caps Lock")
            : this._getKeyAriaLabel(key);

        html += `<div id="${id}" class="${keyClasses}" role="button" tabindex="${tabindex}" data-key="${escAttr(key.value)}"${dataShiftValue}${ariaPressed}${ariaDisabled} aria-label="${escAttr(keyAriaLabel)}">`;

        const icon = this._getKeyIcon(key);
        if (icon) {
          html += `<span class="kiosk-key__icon">${icon}</span>`;
        } else {
          html += escHtml(this._getKeyLabel(key));
        }

        html += "</div>";
      }

      html += "</div>";
    }

    // Live region for shift/caps announcements
    let liveText = "";
    if (this._shiftState.isCapsLock) {
      liveText = getText("ARIA_CAPS_LOCK_ON", "Caps Lock on");
    } else if (this._shiftState.isShifted) {
      liveText = getText("ARIA_SHIFT_ON", "Shift on");
    }
    html += `<span class="kiosk-keyboard__live-region" role="status" aria-live="polite">${escHtml(liveText)}</span>`;

    html += "</div>";

    this._shadow.innerHTML = html;

    // Attach event listeners to the root
    const root = this._shadow.querySelector<HTMLElement>(".kiosk-keyboard");
    if (root) {
      root.addEventListener("click", (e) => this._onKeyClick(e));
      root.addEventListener("mousedown", (e) => this._onKeyMouseDown(e));
      root.addEventListener("touchstart", (e) => this._onKeyMouseDown(e), { passive: false });
      root.addEventListener("keydown", (e) => this._onKeyDown(e));
    }

    // Stable height
    if (this.stableHeight && !this.docked && root) {
      const h = root.offsetHeight;
      if (h > this._maxHeight) this._maxHeight = h;
      if (this._maxHeight > 0) root.style.minHeight = `${this._maxHeight}px`;
    }
  }

  private _announceLiveRegion(text: string): void {
    const region = this._shadow.querySelector<HTMLElement>(".kiosk-keyboard__live-region");
    if (region) region.textContent = text;
  }

  private _buildKeyClasses(key: KeyDefinition): string {
    const classes = ["kiosk-key"];

    if (key.width === "space") {
      classes.push("kiosk-key--space");
    } else if (key.width) {
      classes.push(`kiosk-key--w${key.width.replace(".", "-")}`);
    }

    if (key.type === "modifier") classes.push("kiosk-key--modifier");
    if (key.type === "action") classes.push("kiosk-key--action");

    if (key.value === "{shift}" && this._shiftState.isShifted) {
      classes.push("kiosk-key--active");
      if (this._shiftState.isCapsLock) {
        classes.push("kiosk-key--capsLock");
      }
    }

    return classes.join(" ");
  }
}

// Register the custom element
customElements.define("kiosk-keyboard", KioskKeyboard);
