import UI5Element from "@ui5/webcomponents-base/dist/UI5Element.js";
import customElement from "@ui5/webcomponents-base/dist/decorators/customElement.js";
import property from "@ui5/webcomponents-base/dist/decorators/property.js";
import event from "@ui5/webcomponents-base/dist/decorators/event-strict.js";
import jsxRenderer from "@ui5/webcomponents-base/dist/renderer/JsxRenderer.js";
import type { ChangeInfo } from "@ui5/webcomponents-base/dist/UI5Element.js";

import { ShiftState } from "./core/shift-state.js";
import { resolveWithCustomResolver, keyElementId, KEY_ID_SUFFIX_RE } from "./core/dom-utils.js";
import { insertText, handleBackspace, handleNavigation } from "./core/input-operations.js";
import { detectKeyboardType } from "./core/keyboard-type-detector.js";
import {
  SECONDARY_LAYOUTS,
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
import {
  type LayoutDefinition,
  type KeyDefinition,
  type KeyPressEventDetail,
  type LayoutChangeEventDetail,
  type KeyboardTypeChangeEventDetail,
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

// ── Valid enum values for string properties ──
const VALID_KEYBOARD_TYPES: ReadonlySet<string> = new Set(["Full", "Numpad", "Numeric"]);
const VALID_FKEY_MODES: ReadonlySet<string> = new Set(["Virtual", "Native", "None"]);
const VALID_MOBILE_KEYBOARDS: ReadonlySet<string> = new Set(["Auto", "Native", "Custom"]);

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

/** Built-in native actions executed in fKeyMode="Native" when not prevented. */
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

/** Tracks unsupported fkey names that have already been warned about. */
const warnedUnsupportedFKeys = new Set<string>();

/** ARIA labels for icon-only special keys. */
const SPECIAL_KEY_LABELS: Record<string, string> = {
  "{shift}": "KEY_SHIFT",
  "{enter}": "KEY_ENTER",
  "{backspace}": "KEY_BACKSPACE",
  " ": "KEY_SPACE",
};

/**
 * `<kiosk-keyboard>` - Native web component for on-screen virtual keyboard.
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
  eventDetails!: {
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
  /** Check whether a layout is secondary (non-alphabetic). Secondary layouts cannot become the base layout. */
  static isSecondaryLayout(name: string): boolean {
    return SECONDARY_LAYOUTS.has(name);
  }
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
  accessibleName = "";

  @property()
  mobileKeyboard = "Auto";

  @property()
  fKeyMode = "Virtual";

  // ── Internal reactive state (triggers re-render, no attribute) ──

  @property({ noAttribute: true })
  _currentLayout = "";

  @property({ type: Boolean, noAttribute: true })
  _shifted = false;

  @property({ type: Boolean, noAttribute: true })
  _capsLock = false;

  // ── Backing field for `open` (see getter/setter below) ──
  _open = false;

  // ── Non-reactive internal state ──

  private _shiftState = new ShiftState();
  private _baseLayout = "";
  private _keyboardTypeExplicit = false;
  private _lastAutoDetectedType: string | null = null;
  private _targetElement: HTMLInputElement | HTMLTextAreaElement | null = null;
  private _targetFromAutoShow = false;
  private _targetResolver: ((el: HTMLElement) => HTMLInputElement | HTMLTextAreaElement | null) | null = null;
  private _lastFocusedKeyId: string | null = null;
  private _maxHeight = 0;
  /** Accessed by the JSX template for highlight class binding - not private. */
  _highlightedKey: string | null = null;
  private _layoutSwitchedByUser = false;
  private _pendingAnnouncement: string | null = null;
  private _deferredFocusOutCloseId: number | null = null;

  // ── Inputmode suppression (ref-counted, shared across instances) ──
  private static readonly _inputModeSuppressions = new Map<string, { original: string | null; refCount: number }>();
  private static _nextTempId = 0;
  private _suppressedInputId: string | null = null;

  // ── Multi-keyboard instance isolation ──
  private static readonly _instances = new Set<KioskKeyboard>();
  private static _nextAutoId = 0;

  // ── Escape listener tracking ──
  private _escapeListenerAttached = false;

  // ── Physical keyboard highlight ──
  private _highlightTarget: HTMLElement | null = null;

  // ── Bound listeners (document-level) ──
  private readonly _boundFocusIn = this._onDocumentFocusIn.bind(this);
  private readonly _boundFocusOut = this._onDocumentFocusOut.bind(this);
  private readonly _boundEscape = (e: Event) => {
    if (e instanceof KeyboardEvent) this._onDocumentEscape(e);
  };
  private readonly _boundPhysicalKeyDown = (e: Event) => {
    if (e instanceof KeyboardEvent) this._highlightKey(e.key, true);
  };
  private readonly _boundPhysicalKeyUp = (e: Event) => {
    if (e instanceof KeyboardEvent) this._highlightKey(e.key, false);
  };
  private readonly _boundPhysicalBlur = () => {
    this._clearHighlight();
  };
  private readonly _boundTouchStart = (e: Event) => {
    const target = (e.target as HTMLElement).closest?.(".kiosk-key");
    if (!target) return;
    // Prevent the input from losing focus when the user taps a virtual key.
    // This also suppresses the browser's synthesized mouse events (mousedown,
    // mouseup, click), so we handle the key press directly on touchend.
    e.preventDefault();
  };
  private readonly _boundTouchEnd = (e: Event) => {
    const te = e as TouchEvent;
    const touch = te.changedTouches[0];
    if (!touch) return;
    // Resolve the key under the finger at lift-off, not e.target (which is
    // the touchstart target per spec and may differ if the finger drifted).
    const el = this.shadowRoot!.elementFromPoint(touch.clientX, touch.clientY);
    const keyEl = (el as HTMLElement | null)?.closest<HTMLElement>("[data-key]");
    if (keyEl) keyEl.click();
  };

  // ── Pre-bound template handlers (avoids per-render allocation) ──
  readonly _boundOnKeyClick = this._onKeyClick.bind(this);
  readonly _boundOnKeyMouseDown = this._onKeyMouseDown.bind(this);
  readonly _boundOnKeyDown = this._onKeyDown.bind(this);

  /**
   * Whether the docked keyboard panel is currently visible.
   *
   * Setting `open = true` opens the keyboard (equivalent to `show()`),
   * setting it to `false` closes it (equivalent to `close()`).
   *
   * Follows the same reactive-property-on-setter pattern used by
   * `@ui5/webcomponents` Popup/Dialog (the `@property` decorator makes
   * the attribute observable so UI5 bridge controls can bind to it).
   */
  @property({ type: Boolean })
  set open(value: boolean) {
    if (this._open === value) return;
    this._open = value;
    if (!this.isConnected) return; // handled in onEnterDOM
    if (value) {
      this._performOpen();
    } else {
      this._performClose();
    }
  }

  get open(): boolean {
    return this._open;
  }

  private get _inputIdsList(): string[] {
    return this.inputIds
      ? this.inputIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  }

  private _autoId: string | null = null;

  get _componentId(): string {
    if (this.id) return this.id;
    if (!this._autoId) {
      this._autoId = `kiosk-kb-${KioskKeyboard._nextAutoId++}`;
    }
    return this._autoId;
  }

  // ── Lifecycle ──

  onEnterDOM(): void {
    KioskKeyboard._instances.add(this);

    if (!this._baseLayout) {
      this._baseLayout = this.layout || getLocaleLayout();
      if (!this.layout) {
        this._currentLayout = this._baseLayout;
      }
    }

    this._syncAutoShow();
    this._syncPhysicalKeyHighlight();

    if (this.docked) {
      this._attachEscapeListener();
    }

    // Handle open=true set before DOM connection (same pattern as ui5-dialog).
    // Delegate unconditionally - _performOpen() already resets _open when
    // !docked or native-deferred, preventing stale open state.
    if (this._open) {
      this._performOpen();
    }

    // Touch events need { passive: false } for preventDefault() which JSX can't express.
    // touchstart prevents input blur; touchend processes the key press (because
    // preventDefault on touchstart suppresses the browser's synthesized click).
    this.shadowRoot!.addEventListener("touchstart", this._boundTouchStart, { passive: false });
    this.shadowRoot!.addEventListener("touchend", this._boundTouchEnd);
  }

  onExitDOM(): void {
    KioskKeyboard._instances.delete(this);
    this._teardownAutoShow();
    this._teardownPhysicalKeyHighlight();
    this._restoreInputMode();
    this._detachEscapeListener();
    this.shadowRoot!.removeEventListener("touchstart", this._boundTouchStart);
    this.shadowRoot!.removeEventListener("touchend", this._boundTouchEnd);

    // Fire after-close before disconnecting so direct listeners still see it.
    // Cannot use `this.open = false` here - isConnected is already false,
    // so the setter skips side effects. Handle cleanup manually.
    if (this._open) {
      this._open = false;
      this.fireDecoratorEvent("after-close");
    }

    this._targetElement = null;
    this._targetFromAutoShow = false;
    this._targetResolver = null;

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
      // A programmatic layout change overrides any user-driven layout switch
      this._layoutSwitchedByUser = false;
      if (!SECONDARY_LAYOUTS.has(this.layout)) {
        this._baseLayout = this.layout;
      }
      this._currentLayout = this.layout;
      this._shiftState.reset();
      this._syncShiftState();
      this._resetStableHeight();
    }
    if (name === "keyboardType") {
      if (!VALID_KEYBOARD_TYPES.has(this.keyboardType)) {
        console.warn(
          `[kiosk-keyboard] Invalid keyboardType "${this.keyboardType}". Valid values: ${[...VALID_KEYBOARD_TYPES].join(", ")}.`,
        );
        this.keyboardType = "Full";
        return;
      }
      const autoDetected = this._lastAutoDetectedType === this.keyboardType;
      this._lastAutoDetectedType = null;
      if (!autoDetected) {
        this._keyboardTypeExplicit = true;
      }
      // Reset user layout switch and shift state - a keyboardType change implies a new layout context
      this._layoutSwitchedByUser = false;
      this._shiftState.reset();
      this._syncShiftState();
      this.fireDecoratorEvent("keyboard-type-change", {
        keyboardType: this.keyboardType,
        previousKeyboardType: (changeInfo.oldValue as string) ?? "Full",
        autoDetected,
      });
      this._resetStableHeight();
    }
    if (name === "fKeyMode" && !VALID_FKEY_MODES.has(this.fKeyMode)) {
      console.warn(
        `[kiosk-keyboard] Invalid fKeyMode "${this.fKeyMode}". Valid values: ${[...VALID_FKEY_MODES].join(", ")}.`,
      );
      this.fKeyMode = "Virtual";
      return;
    }
    if (name === "mobileKeyboard" && !VALID_MOBILE_KEYBOARDS.has(this.mobileKeyboard)) {
      console.warn(
        `[kiosk-keyboard] Invalid mobileKeyboard "${this.mobileKeyboard}". Valid values: ${[...VALID_MOBILE_KEYBOARDS].join(", ")}.`,
      );
      this.mobileKeyboard = "Auto";
      return;
    }
    if (name === "docked" || name === "autoShow") {
      this._syncAutoShow();
    }
    if (name === "docked") {
      if (this.docked) {
        this._attachEscapeListener();
      } else {
        // Close the keyboard before detaching - avoids stuck open state
        // and leaked inputmode suppression when docked is toggled off while open.
        this.open = false;
        this._detachEscapeListener();
      }
    }
  }

  // ── Public API ── Layout registry (instance delegates) ──
  //
  // These delegate to the shared module-level registry so that DOM-based
  // consumers (no ES import) can call them via querySelector:
  //   document.querySelector('kiosk-keyboard').registerLayout(…)
  //
  // The registry is shared - layouts registered on one instance are
  // visible to all <kiosk-keyboard> elements on the page.

  /** Registers a custom layout. Delegates to the shared layout registry. */
  registerLayout(name: string, definition: LayoutDefinition): void {
    registerLayout(name, definition);
  }

  /** Removes a custom layout. Delegates to the shared layout registry. */
  unregisterLayout(name: string): void {
    unregisterLayout(name);
  }

  /** Registers a locale-to-layout mapping. Delegates to the shared layout registry. */
  registerLocaleLayout(locale: string, layout: string): void {
    registerLocaleLayout(locale, layout);
  }

  /** Removes a locale-to-layout mapping. Delegates to the shared layout registry. */
  unregisterLocaleLayout(locale: string): void {
    unregisterLocaleLayout(locale);
  }

  // ── Public API ──

  /** Opens the docked keyboard. Equivalent to setting `open = true`. */
  show(): void {
    this.open = true;
  }

  /** Closes the docked keyboard. Equivalent to setting `open = false`. */
  close(): void {
    this.open = false;
  }

  /** Returns whether the docked keyboard is currently open. */
  isOpen(): boolean {
    return this.open;
  }

  /** Executes the open side effects. Called from the `open` setter. */
  private _performOpen(): void {
    if (!this.docked) {
      console.warn("[kiosk-keyboard] open has no effect when docked=false.");
      // Write backing field directly - going through the setter would trigger
      // _performClose() and fire a spurious after-close for a keyboard that
      // never actually opened (same pattern as ui5-dialog's openPopup rejection).
      this._open = false;
      return;
    }
    if (this._shouldDeferToNative()) {
      this._open = false;
      return;
    }
    this._suppressInputMode();
    this._pendingAnnouncement = getText("ARIA_KEYBOARD_OPENED", "Virtual keyboard opened");
    this.fireDecoratorEvent("after-open");
  }

  /** Executes the close side effects. Called from the `open` setter. */
  private _performClose(): void {
    this._restoreInputMode();
    this._pendingAnnouncement = getText("ARIA_KEYBOARD_CLOSED", "Virtual keyboard closed");
    this.fireDecoratorEvent("after-close");
  }

  /** Programmatically sets the input element that receives typed characters. */
  setTargetElement(el: HTMLInputElement | HTMLTextAreaElement | null): void {
    this._targetElement = el;
    this._targetFromAutoShow = false;
  }

  /**
   * Sets a custom resolver that the keyboard uses to locate the native
   * input/textarea inside a host element. Called during auto-show focus
   * handling and `for` resolution with the focused (or looked-up) element.
   *
   * Return the native `<input>` or `<textarea>` to type into, or `null`
   * to fall back to the built-in resolver (which traverses light DOM and
   * up to 3 levels of shadow DOM).
   *
   * @example
   * ```ts
   * keyboard.setTargetResolver((el) => {
   *   // Custom control with deeply nested input
   *   return el.querySelector('.my-inner-wrapper input');
   * });
   * ```
   */
  setTargetResolver(resolver: ((el: HTMLElement) => HTMLInputElement | HTMLTextAreaElement | null) | null): void {
    this._targetResolver = resolver;
  }

  /** Resets `keyboardType` to `"Full"` and clears the explicit-type flag. */
  resetKeyboardType(): void {
    this._setKeyboardTypeInternal("Full");
  }

  // ── Template helpers (used by KioskKeyboardTemplate) ──

  _getResolvedLayout(): LayoutDefinition {
    // An explicit layout switch (via {layout:...} key) takes precedence,
    // even when keyboardType constrains the default layout.
    if (this._layoutSwitchedByUser) return getLayoutOrDefault(this._currentLayout);

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
    if (key.icon) return key.icon; // custom text icon - rendered as label
    if (key.value === "{shift}" && this._capsLock) return ICON_SHIFT_LOCKED;
    return ICON_MAP[key.value] ?? null;
  }

  get _ariaLabel(): string {
    return this.accessibleName || getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard");
  }

  get _roleDescription(): string {
    return getText("KIOSK_KEYBOARD_ROLEDESCRIPTION", "keyboard");
  }

  get _liveRegionText(): string {
    if (this._capsLock) return getText("ARIA_CAPS_LOCK_ON", "Caps Lock on");
    if (this._shifted) return getText("ARIA_SHIFT_ON", "Shift on");
    return "";
  }

  _getFocusPosition(layout: LayoutDefinition): { row: number; col: number } {
    if (this._lastFocusedKeyId) {
      const match = this._lastFocusedKeyId.match(KEY_ID_SUFFIX_RE);
      if (match) {
        const r = Number.parseInt(match[1], 10);
        const c = Number.parseInt(match[2], 10);
        if (layout[r]?.[c]) return { row: r, col: c };
      }
    }
    return { row: 0, col: 0 };
  }

  // ── Event handlers (used by template + delegation) ──

  private _onKeyClick(e: Event): void {
    if (this.disabled) return;

    const keyEl = (e.target as HTMLElement).closest<HTMLElement>("[data-key]");
    if (!keyEl) return;

    const value = keyEl.dataset.key!;
    const shifted = this._shifted;
    const shiftValue = keyEl.dataset.shiftValue;

    if (value.startsWith("{layout:")) {
      this._handleLayoutSwitch(value);
      this._autoReleaseShift();
      return;
    }

    if (value.startsWith("{fkey:")) {
      this._handleFKeyPress(value, shifted);
      return;
    }

    // Shift is handled separately: shiftKey reports the *resulting* state
    // (what shift will become after toggle), not the pre-toggle state.
    if (value === "{shift}") {
      const nextShifted = !this._capsLock;
      const allowed = this.fireDecoratorEvent("key-press", { key: value, shiftKey: nextShifted });
      if (!allowed) return;
      this._shiftState.toggle();
      this._syncShiftState();
      return;
    }

    // Resolve the character that would be inserted (undefined for action keys)
    const isAction = value === "{backspace}" || value === "{enter}";
    const char = isAction ? undefined : shifted ? (shiftValue ?? value.toUpperCase()) : value;

    // All other keys fire key-press with the current shift state
    const allowed = this.fireDecoratorEvent("key-press", { key: value, shiftKey: shifted, char });
    if (!allowed) return;

    const target = this._resolveTarget();

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

    // Regular character key - dispatches "input" event (not "change", which
    // fires on blur, matching native keyboard behavior).
    if (target) {
      insertText(target, char!);
    }
    this._autoReleaseShift();
  }

  private _onKeyMouseDown(e: Event): void {
    e.preventDefault();
  }

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
      const nextEl = this.shadowRoot!.getElementById(id);
      if (nextEl) {
        keyEl.setAttribute("tabindex", "-1");
        nextEl.setAttribute("tabindex", "0");
        nextEl.focus();
        this._lastFocusedKeyId = id;
      }
    }
  }

  // ── Layout switch / F-key handling ──

  private _handleLayoutSwitch(value: string): void {
    const layoutName = value.slice(8, -1);
    if (layoutName === "base") {
      this._currentLayout = this._baseLayout || this.layout || getLocaleLayout();
      this._layoutSwitchedByUser = false;
    } else {
      this._currentLayout = layoutName;
      this._layoutSwitchedByUser = true;
    }
    this.fireDecoratorEvent("layout-change", { layout: this._currentLayout });
  }

  private _handleFKeyPress(value: string, shifted: boolean): void {
    const fkeyName = value.slice(6, -1);
    const allowed = this.fireDecoratorEvent("key-press", { key: fkeyName, shiftKey: shifted });
    if (!allowed) return;
    this._handleFKey(fkeyName, shifted);
    this._autoReleaseShift();
  }

  private _handleFKey(fkeyName: string, shiftKey: boolean): void {
    const mode = this.fKeyMode;
    if (mode === "None") return;

    let nativeAllowed = true;

    if (mode === "Native") {
      if (NATIVE_DISPATCHABLE_KEYS.has(fkeyName)) {
        nativeAllowed = this._dispatchNativeFKeydown(fkeyName, shiftKey);
        if (nativeAllowed) {
          NATIVE_FKEY_ACTIONS[fkeyName]?.();
        }
      } else {
        nativeAllowed = false;
        if (!warnedUnsupportedFKeys.has(fkeyName)) {
          warnedUnsupportedFKeys.add(fkeyName);
          console.warn(
            `[kiosk-keyboard] Ignored native dispatch for unsupported fkey "${fkeyName}". ` +
              "Only standard function/navigation keys are dispatched in fKeyMode=Native.",
          );
        }
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
    const target = this._resolveTarget() ?? document.activeElement;
    if (!target) return true;
    const nativeEvent = new KeyboardEvent("keydown", {
      key: fkeyName,
      code: fkeyName,
      bubbles: true,
      cancelable: true,
      shiftKey,
    });
    return target.dispatchEvent(nativeEvent);
  }

  // ── Internal helpers ──

  /** Resets stable height tracking so onAfterRendering re-measures from zero. */
  private _resetStableHeight(): void {
    if (!this.stableHeight) return;
    this._maxHeight = 0;
    const root = this.shadowRoot?.querySelector<HTMLElement>(".kiosk-keyboard");
    if (root) root.style.minHeight = "";
  }

  /** Sets keyboardType without marking it as explicit (for auto-detection). */
  private _setKeyboardTypeInternal(value: string): void {
    if (value === this.keyboardType) return;
    this._lastAutoDetectedType = value;
    this.keyboardType = value;
  }

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
    if (this._targetElement) {
      if (!this._targetElement.isConnected) {
        this._targetElement = null;
        this._targetFromAutoShow = false;
      } else {
        return this._targetElement;
      }
    }
    const forId = this.for;
    if (forId) {
      const el = document.getElementById(forId);
      if (!el) return null;
      return this._resolveInputFrom(el);
    }
    return null;
  }

  /** Resolve a native input/textarea from an element, using the custom resolver if set. */
  private _resolveInputFrom(el: HTMLElement): HTMLInputElement | HTMLTextAreaElement | null {
    return resolveWithCustomResolver(el, this._targetResolver);
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

    const inputEl = this._resolveInputFrom(target);
    if (!inputEl) return;
    if (this._isTargetOfOther(inputEl)) return;

    const ids = this._inputIdsList;
    if (ids.length > 0) {
      if (!this._matchesInputIds(target, ids)) return;
    }

    const targetChanged = this._targetElement !== inputEl;
    this._targetElement = inputEl;
    this._targetFromAutoShow = true;

    // Detect keyboard type before open - this may trigger onInvalidation for
    // keyboardType, but the target is already set so subsequent logic is safe.
    if (this.autoType && !this._keyboardTypeExplicit) {
      const detected = detectKeyboardType(inputEl);
      if (detected !== this.keyboardType) {
        this._setKeyboardTypeInternal(detected);
      }
    }

    if (this._deferredFocusOutCloseId !== null) {
      cancelAnimationFrame(this._deferredFocusOutCloseId);
      this._deferredFocusOutCloseId = null;
    }

    if (!this._open) {
      this.show();
      this._syncPhysicalKeyHighlight();
    } else if (targetChanged) {
      this._restoreInputMode();
      this._suppressInputMode();
      this._syncPhysicalKeyHighlight();
    }
  }

  private _onDocumentFocusOut(_e: FocusEvent): void {
    if (!this.autoShow) return;

    if (this._deferredFocusOutCloseId !== null) {
      cancelAnimationFrame(this._deferredFocusOutCloseId);
    }

    this._deferredFocusOutCloseId = requestAnimationFrame(() => {
      this._deferredFocusOutCloseId = null;
      if (!this.isConnected) return;
      const active = document.activeElement;

      if (active && (this.shadowRoot!.contains(active) || this.contains(active))) return;
      if (active instanceof HTMLElement && this._resolveInputFrom(active)) {
        const ids = this._inputIdsList;
        if (ids.length === 0 || this._matchesInputIds(active, ids)) return;
      }

      if (this._open) this.close();
      if (this._targetFromAutoShow) {
        this._targetElement = null;
        this._targetFromAutoShow = false;
      }
    });
  }

  private _isTargetOfOther(inputEl: HTMLElement): boolean {
    for (const kb of KioskKeyboard._instances) {
      if (kb === this) continue;
      if (kb._targetElement === inputEl) return true;
      const kbFor = kb.for;
      if (kbFor) {
        const forEl = document.getElementById(kbFor);
        if (!forEl) continue;
        // Compare both the host element and the resolved input it contains
        if (forEl === inputEl) return true;
        if (forEl instanceof HTMLElement && kb._resolveInputFrom(forEl) === inputEl) return true;
      }
    }
    return false;
  }

  /**
   * Checks whether the focused element (or a close ancestor) matches one
   * of the configured inputIds.
   *
   * Supports:
   * - Exact DOM id match (plain HTML)
   * - UI5-style prefixed IDs: walks up the DOM and strips the view prefix
   *   (`*--`) from each ancestor's id, matching the unprefixed control id
   *   (e.g. `"container-app---view--myInput"` matches `"myInput"`)
   */
  private _matchesInputIds(el: HTMLElement, ids: string[]): boolean {
    let current: HTMLElement | null = el;
    // Walk up at most 5 levels: input → inner wrapper → control root (+ margin for deeper UI5 nesting)
    for (let i = 0; i < 5 && current; i++) {
      const domId = current.id;
      if (domId) {
        if (ids.includes(domId)) return true;
        // Strip UI5 view prefix: everything up to and including the last "--"
        const sepIdx = domId.lastIndexOf("--");
        if (sepIdx !== -1 && ids.includes(domId.slice(sepIdx + 2))) return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  private _attachEscapeListener(): void {
    if (this._escapeListenerAttached) return;
    document.addEventListener("keydown", this._boundEscape, true);
    this._escapeListenerAttached = true;
  }

  private _detachEscapeListener(): void {
    if (!this._escapeListenerAttached) return;
    document.removeEventListener("keydown", this._boundEscape, true);
    this._escapeListenerAttached = false;
  }

  private _onDocumentEscape(e: KeyboardEvent): void {
    if (e.key === "Escape" && this._open) {
      this.close();
    }
  }

  // ── Inputmode suppression ──

  private _suppressInputMode(): void {
    const target = this._resolveTarget();
    if (!target) return;

    if (!target.id) {
      target.id = `kiosk-kb-tmp-${KioskKeyboard._nextTempId++}`;
    }

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
          // Clean up temp IDs assigned by _suppressInputMode
          if (el.id.startsWith("kiosk-kb-tmp-")) {
            el.removeAttribute("id");
          }
        }
        KioskKeyboard._inputModeSuppressions.delete(id);
      }
    }
    this._suppressedInputId = null;
  }

  // ── Physical keyboard highlight ──

  /** Maps a physical KeyboardEvent.key to the data-key value used in the layout. */
  private _physicalKeyToDataKey(physicalKey: string): string {
    const lower = physicalKey.toLowerCase();
    if (lower === "backspace") return "{backspace}";
    if (lower === "enter") return "{enter}";
    if (lower === "shift") return "{shift}";
    if (NATIVE_DISPATCHABLE_KEYS.has(physicalKey)) return `{fkey:${physicalKey}}`;
    return lower;
  }

  private _highlightKey(physicalKey: string, pressed: boolean): void {
    const shadow = this.shadowRoot!;
    const dataKey = this._physicalKeyToDataKey(physicalKey);

    // Immediate DOM manipulation for instant visual feedback
    if (pressed) {
      const selector = `[data-key="${CSS.escape(dataKey)}"], [data-shift-value="${CSS.escape(physicalKey)}"]`;
      const el = shadow.querySelector<HTMLElement>(selector);
      if (el) el.classList.add("kiosk-key--highlight");
    } else {
      this._clearHighlight();
    }

    // Track state so it persists across re-renders (lowercased for template comparison)
    this._highlightedKey = pressed ? dataKey.toLowerCase() : null;
  }

  private _clearHighlight(): void {
    this.shadowRoot!.querySelectorAll<HTMLElement>(".kiosk-key--highlight").forEach((el) =>
      el.classList.remove("kiosk-key--highlight"),
    );
    this._highlightedKey = null;
  }

  private _syncPhysicalKeyHighlight(): void {
    const target = this._resolveTarget();

    // Skip if target unchanged and still connected to DOM
    if (target === this._highlightTarget && (!target || target.isConnected)) return;

    if (this._highlightTarget) {
      this._highlightTarget.removeEventListener("keydown", this._boundPhysicalKeyDown);
      this._highlightTarget.removeEventListener("keyup", this._boundPhysicalKeyUp);
      this._highlightTarget.removeEventListener("blur", this._boundPhysicalBlur);
    }

    this._highlightTarget = target;

    if (target) {
      target.addEventListener("keydown", this._boundPhysicalKeyDown);
      target.addEventListener("keyup", this._boundPhysicalKeyUp);
      target.addEventListener("blur", this._boundPhysicalBlur);
    }
  }

  private _teardownPhysicalKeyHighlight(): void {
    if (this._highlightTarget) {
      this._highlightTarget.removeEventListener("keydown", this._boundPhysicalKeyDown);
      this._highlightTarget.removeEventListener("keyup", this._boundPhysicalKeyUp);
      this._highlightTarget.removeEventListener("blur", this._boundPhysicalBlur);
      this._highlightTarget = null;
    }
    this._clearHighlight();
  }
}

KioskKeyboard.define();
