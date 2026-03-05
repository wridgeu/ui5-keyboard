import UI5Element from "@ui5/webcomponents-base/dist/UI5Element.js";
import customElement from "@ui5/webcomponents-base/dist/decorators/customElement.js";
import property from "@ui5/webcomponents-base/dist/decorators/property.js";
import event from "@ui5/webcomponents-base/dist/decorators/event-strict.js";
import jsxRenderer from "@ui5/webcomponents-base/dist/renderer/JsxRenderer.js";
import type { ChangeInfo } from "@ui5/webcomponents-base/dist/UI5Element.js";

import { ShiftState } from "./core/shift-state.js";
import { resolveInputOrTextarea, keyElementId, KEY_ID_SUFFIX_RE } from "./core/dom-utils.js";
import { insertText, handleBackspace, handleNavigation } from "./core/input-operations.js";
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
import type {
  LayoutDefinition,
  KeyDefinition,
  KeyPressEventDetail,
  LayoutChangeEventDetail,
  KeyboardTypeChangeEventDetail,
} from "./types.js";

import KioskKeyboardTemplate from "./KioskKeyboardTemplate.js";
import styles from "./generated/themes/KioskKeyboard.css.js";

// ── Register ui5-icon + needed icons so they resolve inside shadow DOM ──
import "@ui5/webcomponents/dist/Icon.js";
import "@ui5/webcomponents-icons/dist/arrow-top.js";
import "@ui5/webcomponents-icons/dist/arrow-left.js";
import "@ui5/webcomponents-icons/dist/accept.js";
import "@ui5/webcomponents-icons/dist/locked.js";

// ── Icon name map (used by the template to render <ui5-icon>) ──
const ICON_MAP: Record<string, string> = {
  "{shift}": "arrow-top",
  "{enter}": "accept",
  "{backspace}": "arrow-left",
};

const ICON_SHIFT_LOCKED = "locked";

// ── Native-dispatchable key allowlist ──
const NATIVE_DISPATCHABLE_KEYS = new Set([
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

// ── Built-in native actions for F-keys ──
const NATIVE_FKEY_ACTIONS: Partial<Record<string, () => void>> = {
  F5: () => {
    location.reload();
  },
  F11: () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    } else {
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
  },
};

/** ARIA labels for icon-only special keys. */
const SPECIAL_KEY_LABELS: Record<string, string> = {
  "{shift}": "KEY_SHIFT",
  "{enter}": "KEY_ENTER",
  "{backspace}": "KEY_BACKSPACE",
  " ": "KEY_SPACE",
};

/**
 * `<kiosk-keyboard>` — Native web component for on-screen virtual keyboard.
 *
 * Built on the UI5 Web Components framework (`UI5Element`) for automatic SAP
 * theming, reactive properties, and JSX-based rendering. Consumable in any
 * framework (HTML, React, Vue, Angular) and inside UI5 apps via
 * `WebComponent.extend()` bridge.
 *
 * @tagname kiosk-keyboard
 */
@customElement({
  tag: "kiosk-keyboard",
  renderer: jsxRenderer,
  template: KioskKeyboardTemplate,
  styles,
  languageAware: true,
  themeAware: true,
})
@event("key-press", { bubbles: true, cancelable: true })
@event("after-open", { bubbles: true })
@event("after-close", { bubbles: true })
@event("layout-change", { bubbles: true })
@event("keyboard-type-change", { bubbles: true })
export default class KioskKeyboard extends UI5Element {
  declare eventDetails: {
    "key-press": KeyPressEventDetail;
    "after-open": void;
    "after-close": void;
    "layout-change": LayoutChangeEventDetail;
    "keyboard-type-change": KeyboardTypeChangeEventDetail;
  };

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

  // ── Public reactive properties (synced with attributes) ──

  @property()
  layout = "";

  @property()
  keyboardType = "Full";

  @property({ type: Boolean })
  docked = false;

  @property({ type: Boolean })
  autoShow = false;

  @property({ type: Boolean })
  autoType = false;

  @property({ type: Boolean })
  disabled = false;

  @property()
  for = "";

  @property()
  inputIds = "";

  @property({ type: Boolean })
  stableHeight = false;

  @property()
  mobileKeyboard = "Auto";

  @property()
  fKeyMode = "Event";

  // ── Internal reactive state (triggers re-render, no attribute) ──

  @property({ type: Boolean, noAttribute: true })
  _open = false;

  @property({ noAttribute: true })
  _currentLayout = "";

  @property({ type: Boolean, noAttribute: true })
  _shifted = false;

  @property({ type: Boolean, noAttribute: true })
  _capsLock = false;

  // ── Non-reactive internal state ──

  _shiftState = new ShiftState();
  _baseLayout = "";
  _keyboardTypeExplicit = false;
  _targetElement: HTMLInputElement | HTMLTextAreaElement | null = null;
  _lastFocusedKeyId: string | null = null;
  _maxHeight = 0;
  _highlightedKey: string | null = null;
  _pendingAnnouncement: string | null = null;
  _deferredFocusOutCloseId: number | null = null;

  // ── Inputmode suppression (ref-counted, shared across instances) ──
  private static readonly _inputModeSuppressions = new Map<string, { original: string | null; refCount: number }>();
  private _suppressedInputId: string | null = null;

  // ── Multi-keyboard instance isolation ──
  private static readonly _instances = new Set<KioskKeyboard>();

  // ── Physical keyboard highlight ──
  private _highlightTargetId: string | null = null;

  // ── Bound listeners (document-level) ──
  private readonly _boundFocusIn = this._onDocumentFocusIn.bind(this);
  private readonly _boundFocusOut = this._onDocumentFocusOut.bind(this);
  private readonly _boundEscape = (e: Event) => this._onDocumentEscape(e as KeyboardEvent);
  private readonly _boundPhysicalKeyDown = (e: Event) => this._highlightKey((e as KeyboardEvent).key, true);
  private readonly _boundPhysicalKeyUp = (e: Event) => this._highlightKey((e as KeyboardEvent).key, false);
  private readonly _boundTouchStart = (e: Event) => {
    const target = (e.target as HTMLElement).closest?.(".kiosk-key");
    if (target) this._onKeyMouseDown(e);
  };

  // ── Pre-bound template handlers (avoids per-render allocation) ──
  readonly _boundOnKeyClick = this._onKeyClick.bind(this);
  readonly _boundOnKeyMouseDown = this._onKeyMouseDown.bind(this);
  readonly _boundOnKeyDown = this._onKeyDown.bind(this);

  // ── Convenience property aliases ──

  get enabled(): boolean {
    return !this.disabled;
  }
  set enabled(val: boolean) {
    this.disabled = !val;
  }

  get open(): boolean {
    return this._open;
  }
  set open(val: boolean) {
    if (val) this.show();
    else this.close();
  }

  get _inputIdsList(): string[] {
    return this.inputIds
      ? this.inputIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  }

  get _componentId(): string {
    return this.id || "kiosk-kb";
  }

  // ── Lifecycle ──

  onEnterDOM(): void {
    KioskKeyboard._instances.add(this);

    if (!this._baseLayout) {
      this._baseLayout = getLocaleLayout();
      if (!this.layout) {
        this._currentLayout = this._baseLayout;
      }
    }

    this._syncAutoShow();
    this._syncPhysicalKeyHighlight();

    if (this.docked) {
      document.addEventListener("keydown", this._boundEscape);
    }

    // Touchstart needs { passive: false } which JSX can't express
    this.shadowRoot!.addEventListener("touchstart", this._boundTouchStart, { passive: false });
  }

  onExitDOM(): void {
    KioskKeyboard._instances.delete(this);
    this._teardownAutoShow();
    this._teardownPhysicalKeyHighlight();
    this._restoreInputMode();
    document.removeEventListener("keydown", this._boundEscape);
    this.shadowRoot!.removeEventListener("touchstart", this._boundTouchStart);

    if (this._deferredFocusOutCloseId !== null) {
      cancelAnimationFrame(this._deferredFocusOutCloseId);
      this._deferredFocusOutCloseId = null;
    }

    this._lastFocusedKeyId = null;
  }

  onAfterRendering(): void {
    // Announce pending live region text (from show/close/shift)
    if (this._pendingAnnouncement) {
      const region = this.shadowRoot!.querySelector<HTMLElement>(".kiosk-keyboard__live-region");
      if (region) region.textContent = this._pendingAnnouncement;
      this._pendingAnnouncement = null;
    }

    // Stable height
    if (this.stableHeight && !this.docked) {
      const root = this.shadowRoot!.querySelector<HTMLElement>(".kiosk-keyboard");
      if (root) {
        const h = root.offsetHeight;
        if (h > this._maxHeight) this._maxHeight = h;
        if (this._maxHeight > 0) root.style.minHeight = `${this._maxHeight}px`;
      }
    }
  }

  onInvalidation(changeInfo: ChangeInfo): void {
    const { name } = changeInfo;

    if (name === "layout") {
      this._baseLayout = this.layout;
      this._currentLayout = this.layout;
    }
    if (name === "keyboardType") {
      this._keyboardTypeExplicit = true;
      this.fireDecoratorEvent("keyboard-type-change", { keyboardType: this.keyboardType });
    }
    if (name === "docked" || name === "autoShow") {
      this._syncAutoShow();
    }
    if (name === "docked") {
      if (this.docked) document.addEventListener("keydown", this._boundEscape);
      else document.removeEventListener("keydown", this._boundEscape);
    }
  }

  // ── Public API ──

  /** Opens the docked keyboard. No-op if not docked or already open. */
  show(): void {
    if (!this.docked || this._shouldDeferToNative()) return;
    if (this._open) return;
    this._open = true;
    this._suppressInputMode();
    this._pendingAnnouncement = getText("ARIA_KEYBOARD_OPENED", "Virtual keyboard opened");
    this.fireDecoratorEvent("after-open");
  }

  /** Closes the docked keyboard. No-op if not docked or already closed. */
  close(): void {
    if (!this.docked || !this._open) return;
    this._open = false;
    this._restoreInputMode();
    this._pendingAnnouncement = getText("ARIA_KEYBOARD_CLOSED", "Virtual keyboard closed");
    this.fireDecoratorEvent("after-close");
  }

  /** Returns whether the docked keyboard is currently open. */
  isOpen(): boolean {
    return this._open;
  }

  /** Programmatically sets the input element that receives typed characters. */
  setTargetElement(el: HTMLInputElement | HTMLTextAreaElement | null): void {
    this._targetElement = el;
  }

  /** Resets `keyboardType` to `"Full"` and clears the explicit-type flag. */
  resetKeyboardType(): void {
    this._keyboardTypeExplicit = false;
    this.keyboardType = "Full";
  }

  // ── Template helpers (used by KioskKeyboardTemplate) ──

  _getResolvedLayout(): LayoutDefinition {
    const type = this.keyboardType;
    if (type === "Numpad") return getLayoutOrDefault("numpad");
    if (type === "Numeric") return getLayoutOrDefault("numeric");
    const name = this._currentLayout || this._baseLayout || this.layout || getLocaleLayout();
    return getLayoutOrDefault(name);
  }

  _getKeyLabel(key: KeyDefinition): string {
    if (this._shifted) {
      if (key.shiftLabel) return key.shiftLabel;
      if (key.shiftValue) return key.shiftValue;
      if (key.value.length === 1) return key.value.toUpperCase();
    }
    return key.label ?? key.value;
  }

  _getKeyAriaLabel(key: KeyDefinition): string {
    const i18nKey = SPECIAL_KEY_LABELS[key.value];
    if (i18nKey) return getText(i18nKey, key.value);
    return this._getKeyLabel(key);
  }

  _getKeyIcon(key: KeyDefinition): string | null {
    if (key.icon) return key.icon; // custom text icon — rendered as label
    if (key.value === "{shift}" && this._capsLock) return ICON_SHIFT_LOCKED;
    return ICON_MAP[key.value] ?? null;
  }

  get _ariaLabel(): string {
    return this.getAttribute("aria-label") || getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard");
  }

  get _roleDescription(): string {
    return getText("KIOSK_KEYBOARD_ROLEDESCRIPTION", "keyboard");
  }

  get _liveRegionText(): string {
    if (this._capsLock) return getText("ARIA_CAPS_LOCK_ON", "Caps Lock on");
    if (this._shifted) return getText("ARIA_SHIFT_ON", "Shift on");
    return "";
  }

  _getFocusPosition(): { row: number; col: number } {
    if (this._lastFocusedKeyId) {
      const match = this._lastFocusedKeyId.match(KEY_ID_SUFFIX_RE);
      if (match) {
        const layout = this._getResolvedLayout();
        const r = Number.parseInt(match[1], 10);
        const c = Number.parseInt(match[2], 10);
        if (layout[r]?.[c]) return { row: r, col: c };
      }
    }
    return { row: 0, col: 0 };
  }

  // ── Event handlers (used by template + delegation) ──

  _onKeyClick(e: Event): void {
    if (this.disabled) return;

    const keyEl = (e.target as HTMLElement).closest<HTMLElement>("[data-key]");
    if (!keyEl) return;

    const value = keyEl.dataset.key!;
    const shifted = this._shifted;
    const shiftValue = keyEl.dataset.shiftValue;

    // Layout switches don't fire key-press
    if (value.startsWith("{layout:")) {
      const layoutName = value.slice(8, -1);
      if (layoutName === "base") {
        this._currentLayout = this._baseLayout || this.layout || getLocaleLayout();
      } else {
        this._currentLayout = layoutName;
      }
      this.fireDecoratorEvent("layout-change", { layout: this._currentLayout });
      return;
    }

    // F-keys fire key-press with the extracted key name (e.g. "F5", not "{fkey:F5}")
    if (value.startsWith("{fkey:")) {
      const fkeyName = value.slice(6, -1);
      const allowed = this.fireDecoratorEvent("key-press", { key: fkeyName, shiftKey: shifted });
      if (!allowed) return;
      this._handleFKey(fkeyName, shifted);
      this._autoReleaseShift();
      return;
    }

    // All other keys fire key-press with the raw value
    const allowed = this.fireDecoratorEvent("key-press", { key: value, shiftKey: shifted });
    if (!allowed) return;

    const target = this._resolveTarget();

    if (value === "{shift}") {
      this._shiftState.toggle();
      this._syncShiftState();
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

    // Regular character key
    if (target) {
      const char = shifted ? (shiftValue ?? value.toUpperCase()) : value;
      insertText(target, char);
    }
    this._autoReleaseShift();
  }

  _onKeyMouseDown(e: Event): void {
    e.preventDefault();
  }

  _onKeyDown(e: KeyboardEvent): void {
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
      const nextEl = this.shadowRoot!.getElementById(id);
      if (nextEl) {
        keyEl.setAttribute("tabindex", "-1");
        nextEl.setAttribute("tabindex", "0");
        nextEl.focus();
        this._lastFocusedKeyId = id;
      }
    }
  }

  // ── F-key / navigation key handling ──

  private _handleFKey(fkeyName: string, shiftKey: boolean): void {
    const mode = this.fKeyMode;
    if (mode === "None") return;

    let nativeAllowed = true;

    if (mode === "Native") {
      if (NATIVE_DISPATCHABLE_KEYS.has(fkeyName)) {
        nativeAllowed = this._dispatchNativeFKeydown(fkeyName, shiftKey);
        if (nativeAllowed) {
          const action = NATIVE_FKEY_ACTIONS[fkeyName];
          if (action) action();
        }
      } else {
        nativeAllowed = false;
      }
    }

    // Move cursor in target input for navigation keys (when not suppressed)
    if (nativeAllowed) {
      const target = this._resolveTarget();
      if (target) {
        handleNavigation(target, fkeyName);
      }
    }
  }

  private _dispatchNativeFKeydown(fkeyName: string, shiftKey: boolean): boolean {
    const target = this._resolveNativeFKeyTarget();
    const nativeEvent = new KeyboardEvent("keydown", {
      key: fkeyName,
      code: fkeyName,
      bubbles: true,
      cancelable: true,
      shiftKey,
    });
    return target.dispatchEvent(nativeEvent);
  }

  private _resolveNativeFKeyTarget(): EventTarget {
    const target = this._resolveTarget();
    if (target) return target;
    if (document.activeElement instanceof HTMLElement) return document.activeElement;
    return document;
  }

  // ── Internal helpers ──

  private _syncShiftState(): void {
    this._shifted = this._shiftState.isShifted;
    this._capsLock = this._shiftState.isCapsLock;
  }

  private _autoReleaseShift(): void {
    if (this._shiftState.autoRelease()) {
      this._syncShiftState();
    }
  }

  private _resolveTarget(): HTMLInputElement | HTMLTextAreaElement | null {
    if (this._targetElement) return this._targetElement;
    const forId = this.for;
    if (forId) {
      const el = document.getElementById(forId);
      return resolveInputOrTextarea(el);
    }
    return null;
  }

  private _shouldDeferToNative(): boolean {
    const mode = this.mobileKeyboard;
    if (mode === "Custom") return false;
    if (mode === "Native") return true;
    return window.matchMedia("(pointer: coarse)").matches;
  }

  // ── Auto-show ──

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
    if (this.disabled || !this.docked || !this.autoShow) return;

    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (this.shadowRoot!.contains(target) || this.contains(target)) return;

    const inputEl = resolveInputOrTextarea(target);
    if (!inputEl) return;
    if (this._isTargetOfOther(inputEl)) return;

    const ids = this._inputIdsList;
    if (ids.length > 0) {
      const targetId = inputEl.id;
      if (!targetId || !ids.includes(targetId)) return;
    }

    this._targetElement = inputEl;

    if (this.autoType && !this._keyboardTypeExplicit) {
      const detected = detectKeyboardType(target);
      if (detected !== this.keyboardType) {
        this.keyboardType = detected;
      }
    }

    if (this._deferredFocusOutCloseId !== null) {
      cancelAnimationFrame(this._deferredFocusOutCloseId);
      this._deferredFocusOutCloseId = null;
    }

    if (!this._open) this.show();
  }

  private _onDocumentFocusOut(_e: FocusEvent): void {
    if (!this._open) return;

    this._deferredFocusOutCloseId = requestAnimationFrame(() => {
      this._deferredFocusOutCloseId = null;
      const active = document.activeElement;

      if (active && (this.shadowRoot!.contains(active) || this.contains(active))) return;
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

  private _highlightKey(physicalKey: string, pressed: boolean): void {
    const shadow = this.shadowRoot!;
    const lowerKey = physicalKey.toLowerCase();

    // Immediate DOM manipulation for instant visual feedback
    if (pressed) {
      const selector = `[data-key="${CSS.escape(lowerKey)}"], [data-shift-value="${CSS.escape(physicalKey)}"]`;
      const el = shadow.querySelector<HTMLElement>(selector);
      if (el) el.classList.add("kiosk-key--highlight");
    } else {
      shadow
        .querySelectorAll<HTMLElement>(".kiosk-key--highlight")
        .forEach((el) => el.classList.remove("kiosk-key--highlight"));
    }

    // Track state so it persists across re-renders
    this._highlightedKey = pressed ? lowerKey : null;
  }

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
}

KioskKeyboard.define();
