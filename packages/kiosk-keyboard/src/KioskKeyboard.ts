import Control from "sap/ui/core/Control";
import Element from "sap/ui/core/Element";
import ManagedObject from "sap/ui/base/ManagedObject";
import View from "sap/ui/core/mvc/View";
import Device from "sap/ui/Device";
import Localization from "sap/base/i18n/Localization";
import { DEFAULT_LAYOUT, SECONDARY_LAYOUTS } from "./types";
import type { LayoutDefinition, KeyDefinition } from "./types";
import layouts from "./layouts/index";
import Log from "sap/base/Log";
import KioskKeyboardRenderer from "./KioskKeyboardRenderer";
import { getText } from "./i18n-util";
import { KEY_ID_SUFFIX_RE, keyElementId } from "./dom-util";
import { KeyboardType } from "./library"; // side-effect: ensures Lib.init() runs

/**
 * On-screen virtual keyboard control for kiosk and touch applications.
 *
 * Renders an interactive keyboard that types into a target UI5 input control.
 * Supports multiple layouts (QWERTY, numeric, special characters, numpad),
 * Shift/Caps Lock toggle, and integrates with SAP theming.
 *
 * In **docked mode** (`docked="true"`), the keyboard anchors to the bottom
 * of the viewport and slides in/out. Use `show()` / `close()` to control
 * visibility manually, or set `autoShow="true"` for automatic
 * focus-based show/close behavior.
 *
 * @namespace ui5.kiosk
 * @extends sap.ui.core.Control
 * @public
 */
export default class KioskKeyboard extends Control {
  // The following three lines were generated and should remain as-is to make TypeScript aware of the constructor signatures
  constructor(idOrSettings?: string | $KioskKeyboardSettings);
  constructor(id?: string, settings?: $KioskKeyboardSettings);
  // oxlint-disable-next-line no-useless-constructor -- required by @ui5/ts-interface-generator overloads
  constructor(id?: string, settings?: $KioskKeyboardSettings) {
    super(id, settings);
  }

  // ── ManagedObject field trap: declare strips these from Babel output ──
  declare private _shiftActive: boolean;
  declare private _capsLock: boolean;
  declare private _lastFocusedKeyId: string | null;
  declare private _open: boolean;
  declare private _closeTimer: ReturnType<typeof setTimeout> | null;
  declare private _boundFocusIn: (e: FocusEvent) => void;
  declare private _boundFocusOut: (e: FocusEvent) => void;
  declare private _autoShowActive: boolean;
  declare private _inputFocusDelegation: { onfocusin: () => void };
  declare private _registeredInputIds: Set<string>;
  declare private _keyHighlightDelegation: {
    onkeydown: (event: Event) => void;
    onkeyup: (event: Event) => void;
  };
  declare private _highlightTargetId: string | null;
  declare private _pressedKeyEl: HTMLElement | null;
  declare private _baseLayout: string;
  declare private _keyboardTypeExplicit: boolean;
  declare private _originalInputMode: string | null;
  declare private _suppressedInputEl: HTMLInputElement | HTMLTextAreaElement | null;
  declare private _maxHeight: number;

  static readonly metadata = {
    library: "ui5.kiosk" as const,
    properties: {
      /** Active layout name. Only effective when keyboardType is "full". */
      layout: {
        type: "string",
        defaultValue: "qwerty",
        group: "Behavior",
      },
      /**
       * Keyboard display type.
       * "Full" renders the active layout. "Numeric" and "Numpad" render
       * compact number-oriented layouts regardless of the layout property.
       * Setting this property (via setter, constructor, or XML attribute)
       * disables auto-type detection permanently.
       * Call `resetKeyboardType()` to re-enable it.
       */
      keyboardType: {
        type: "ui5.kiosk.KeyboardType",
        defaultValue: "Full",
        group: "Appearance",
      },
      /** Whether the keyboard is interactive. */
      enabled: {
        type: "boolean",
        defaultValue: true,
        group: "Behavior",
      },
      /** Accessible label for the keyboard group. */
      ariaLabel: {
        type: "string",
        defaultValue: "",
        group: "Accessibility",
      },
      /**
       * When true, the keyboard anchors to the bottom of the viewport
       * and slides in/out. Use show()/close() to control visibility
       * manually, or set autoShow to true for automatic behavior.
       */
      docked: {
        type: "boolean",
        defaultValue: false,
        group: "Behavior",
      },
      /**
       * When true, the docked keyboard automatically opens when any
       * `<input>` or `<textarea>` receives focus, and closes when
       * focus leaves. Requires `docked="true"`.
       */
      autoShow: {
        type: "boolean",
        defaultValue: false,
        group: "Behavior",
      },
      /**
       * When true and autoShow is active, the keyboard inspects the
       * focused input's type metadata and automatically switches between
       * Full and Numpad keyboard types.
       * Has no effect when keyboardType has been set explicitly (via
       * setter, constructor, or XML attribute), because that locks the
       * keyboard type. Call `resetKeyboardType()` to clear the lock
       * and re-enable auto-type detection.
       */
      autoType: {
        type: "boolean",
        defaultValue: false,
        group: "Behavior",
      },
      /**
       * Controls native keyboard behavior on mobile/touch devices.
       * "Custom" (default) always uses this keyboard and suppresses
       * the native one. "Native" defers to the native keyboard on
       * phones and tablets. "Auto" uses custom on desktop, native
       * on mobile.
       */
      mobileKeyboard: {
        type: "ui5.kiosk.MobileKeyboard",
        defaultValue: "Custom",
        group: "Behavior",
      },
      /**
       * List of input control IDs to target. When set, attaches focus
       * delegation to each resolved control so the keyboard auto-targets
       * whichever input last received focus.
       */
      inputIds: {
        type: "string[]",
        defaultValue: [],
        group: "Data",
      },
    },
    associations: {
      /** The input control to type into (e.g. sap.m.Input, sap.m.TextArea). */
      targetInput: { type: "sap.ui.core.Control", multiple: false },
      ariaLabelledBy: {
        type: "sap.ui.core.Control",
        multiple: true,
        singularName: "ariaLabelledBy",
      },
      ariaDescribedBy: {
        type: "sap.ui.core.Control",
        multiple: true,
        singularName: "ariaDescribedBy",
      },
    },
    events: {
      /** Fired when a virtual key is pressed. Call preventDefault() to skip the default input action. */
      keyPress: {
        allowPreventDefault: true,
        parameters: {
          key: { type: "string" },
          shiftKey: { type: "boolean" },
        },
      },
      /** Fired when the active layout changes. */
      layoutChange: {
        parameters: {
          layout: { type: "string" },
        },
      },
      /** Fired after the docked keyboard has opened. */
      afterOpen: {},
      /** Fired after the docked keyboard has closed. */
      afterClose: {},
    },
  };

  static readonly renderer = KioskKeyboardRenderer;

  /** Built-in layout names that cannot be overwritten by registerLayout. */
  private static readonly _BUILTIN_LAYOUTS: ReadonlySet<string> = new Set(Object.keys(layouts));

  /** All living KioskKeyboard instances — used by auto-show to skip inputs already targeted by another keyboard. */
  private static readonly _instances = new Set<KioskKeyboard>();

  /**
   * Registers a custom keyboard layout that can then be used via
   * `setLayout(name)` or declaratively as `layout="name"` in XML views.
   *
   * Built-in layouts (qwerty, qwertz-de, numeric, special, numpad)
   * cannot be overwritten. Attempting to do so logs a warning and is
   * ignored.
   *
   * @param sName Layout identifier (lowercase, e.g. "azerty-fr")
   * @param oDefinition Array of rows, each containing key definitions
   * @public
   * @static
   */
  static registerLayout(sName: string, oDefinition: LayoutDefinition): void {
    const name = sName.toLowerCase();

    if (KioskKeyboard._BUILTIN_LAYOUTS.has(name)) {
      Log.warning(
        `Cannot overwrite built-in layout "${name}". Use a different name for custom layouts.`,
        undefined,
        "ui5.kiosk.KioskKeyboard",
      );
      return;
    }

    if (
      !Array.isArray(oDefinition) ||
      oDefinition.length === 0 ||
      !oDefinition.every(
        (row) =>
          Array.isArray(row) &&
          row.length > 0 &&
          row.every((key) => key !== null && typeof key === "object" && typeof key.value === "string"),
      )
    ) {
      Log.warning(
        `Invalid layout "${name}": must be a non-empty array of non-empty rows where each key has a string "value".`,
        undefined,
        "ui5.kiosk.KioskKeyboard",
      );
      return;
    }

    layouts[name] = oDefinition;
  }

  /**
   * Returns the layout definition for the given name, or undefined
   * if no such layout is registered.
   *
   * @param sName Layout identifier
   * @public
   * @static
   */
  static getRegisteredLayout(sName: string): LayoutDefinition | undefined {
    return layouts[sName];
  }

  /**
   * Returns the names of all registered layouts (built-in + custom).
   *
   * @public
   * @static
   */
  static getRegisteredLayoutNames(): string[] {
    return Object.keys(layouts);
  }

  /**
   * Returns whether the given layout name is a built-in layout.
   * Custom layouts registered via `registerLayout` return false.
   *
   * @param sName Layout identifier
   * @public
   * @static
   */
  static isBuiltInLayout(sName: string): boolean {
    return KioskKeyboard._BUILTIN_LAYOUTS.has(sName);
  }

  // ──────────────────────────────────────────────
  // Locale → Layout Mapping
  // ──────────────────────────────────────────────

  /** BCP-47 language prefix → layout name. Checked after exact match. */
  private static _LOCALE_LAYOUT_MAP: Record<string, string> = {
    de: "qwertz-de",
  };

  /**
   * Registers a mapping from a BCP-47 language tag (or prefix) to a
   * layout name. When no explicit `layout` is provided, the keyboard
   * uses this map to select a locale-appropriate default.
   *
   * @param sLocale Language tag or prefix (e.g. "fr", "es", "pt-br")
   * @param sLayout Layout name (must be registered via `registerLayout`)
   * @public
   * @static
   */
  static registerLocaleLayout(sLocale: string, sLayout: string): void {
    KioskKeyboard._LOCALE_LAYOUT_MAP[sLocale.toLowerCase()] = sLayout;
  }

  /**
   * Returns the layout name appropriate for the current UI5 locale.
   *
   * Resolution order:
   * 1. Exact BCP-47 match (e.g. "de-at")
   * 2. Language prefix (e.g. "de")
   * 3. {@link DEFAULT_LAYOUT} fallback ("qwerty")
   *
   * Uses `sap/base/i18n/Localization.getLanguageTag()` which already
   * resolves from all UI5 language sources (URL params, bootstrap
   * config, browser settings).
   *
   * @public
   * @static
   */
  static getLocaleLayout(): string {
    const tag = Localization.getLanguageTag();
    const lang = tag.language; // lowercase ISO639, e.g. "de"
    const region = tag.region; // uppercase ISO3166 or null, e.g. "AT"

    const map = KioskKeyboard._LOCALE_LAYOUT_MAP;

    // Exact match: "de-at", "pt-br", etc.
    if (region) {
      const exact = map[`${lang}-${region.toLowerCase()}`];
      if (exact) return exact;
    }

    // Language prefix: "de", "fr", etc.
    const prefix = map[lang];
    if (prefix) return prefix;

    return DEFAULT_LAYOUT;
  }

  /**
   * Injects the locale-detected layout when constructor settings are
   * provided but no explicit `layout` is included.
   *
   * Note: When no settings are provided at all (e.g. `new KioskKeyboard()`),
   * ManagedObject does not call `applySettings`. The locale default is
   * therefore also set in `init()`.
   */
  applySettings(mSettings: Record<string, unknown>, oScope?: object): this {
    if (mSettings && !("layout" in mSettings)) {
      mSettings.layout = KioskKeyboard.getLocaleLayout();
    }
    return super.applySettings(mSettings, oScope);
  }

  init(): void {
    KioskKeyboard._instances.add(this);
    this._shiftActive = false;
    this._capsLock = false;
    this._lastFocusedKeyId = null;
    this._open = false;
    this._closeTimer = null;
    this._autoShowActive = false;
    this._boundFocusIn = this._onDocumentFocusIn.bind(this);
    this._boundFocusOut = this._onDocumentFocusOut.bind(this);
    this._registeredInputIds = new Set();
    this._inputFocusDelegation = {
      onfocusin: () => {
        const delegateTarget = Element.getActiveElement();
        if (delegateTarget instanceof Control) {
          this.setTargetInput(delegateTarget);
        }
      },
    };
    this._keyHighlightDelegation = {
      onkeydown: (event: Event) => this._highlightKey((event as KeyboardEvent).key, true),
      onkeyup: (event: Event) => this._highlightKey((event as KeyboardEvent).key, false),
    };
    this._highlightTargetId = null;
    this._pressedKeyEl = null;
    this._keyboardTypeExplicit = false;
    this._originalInputMode = null;
    this._suppressedInputEl = null;
    this._maxHeight = 0;

    // Detect locale-appropriate default layout. This covers the case
    // where no settings are passed (applySettings is not called by
    // ManagedObject when settings are undefined).
    const localeLayout = KioskKeyboard.getLocaleLayout();
    this._baseLayout = localeLayout;
    if (localeLayout !== DEFAULT_LAYOUT) {
      this.setProperty("layout", localeLayout);
    }
  }

  onAfterRendering(): void {
    const dom = this.getDomRef();

    if (this.getDocked()) {
      // Sync the open/closed CSS class (renderer sets initial state,
      // but show()/close() bypass re-render for smooth animation)
      dom?.classList.toggle("ui5KioskKeyboard--closed", !this._open);

      // Activate auto-show listeners if the property was set declaratively
      // (e.g. via XML) before the control was rendered.
      if (this.getAutoShow() && !this._autoShowActive) {
        this._enableAutoShow();
      }
    }

    // Maintain consistent height across layout switches for non-docked
    // Full keyboards.  This prevents layout shifts in embedded/inline
    // scenarios and works around a sap.m.Popover bug where content-height
    // changes during a resize event trigger a spurious off-screen check
    // that closes the Popover on scrolled pages.
    // Docked keyboards are excluded: they pin to the viewport edge so
    // minimising their footprint is more valuable than preventing shifts.
    if (dom && this.getKeyboardType() === "Full" && !this.getDocked()) {
      const el = dom as HTMLElement;
      const h = el.getBoundingClientRect().height;
      if (h > (this._maxHeight || 0)) {
        this._maxHeight = h;
      }
      el.style.minHeight = `${this._maxHeight}px`;
    }

    this._setupInputIds();
  }

  exit(): void {
    KioskKeyboard._instances.delete(this);
    this._disableAutoShow();
    this._teardownInputIds();
    this._removeHighlightDelegation();
    this._restoreNativeKeyboard();
    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
    }
  }

  // ──────────────────────────────────────────────
  // Public API — Target & Docked Mode
  // ──────────────────────────────────────────────

  /**
   * Custom setter for layout — tracks the base (alphabetic) layout so
   * that `{layout:base}` in numeric/special layouts can return to it.
   */
  setLayout(sLayout: string): this {
    const name = sLayout.toLowerCase();
    if (!SECONDARY_LAYOUTS.has(name)) {
      this._baseLayout = name;
    }
    if (!layouts[name]) {
      Log.warning(
        `Layout "${name}" is not registered. The keyboard will fall back to "${DEFAULT_LAYOUT}".`,
        undefined,
        "ui5.kiosk.KioskKeyboard",
      );
    }
    return this.setProperty("layout", name);
  }

  /**
   * Sets the target input association without triggering a re-render,
   * since the association does not affect the keyboard's visual output.
   * Also moves the physical keyboard highlight delegation to the new target.
   */
  setTargetInput(target: string | Control): this {
    // Remove highlight delegation from previous target
    this._removeHighlightDelegation();

    // If the keyboard is open, restore the old target's inputmode
    // before switching so it's not left suppressed.
    if (this._open) {
      this._restoreNativeKeyboard();
    }

    this.setAssociation("targetInput", target, true);

    // Add highlight delegation to new target
    const newId = this.getTargetInput();
    if (newId) {
      const next = Element.getElementById(newId);
      if (next) {
        next.addEventDelegate(this._keyHighlightDelegation);
        this._highlightTargetId = newId;
      }
    }

    // If the keyboard is open, suppress the new target's native keyboard.
    if (this._open) {
      this._suppressNativeKeyboard();
    }

    return this;
  }

  /**
   * Custom setter for autoShow — activates or deactivates the
   * auto-show document listeners via enableAutoShow/disableAutoShow.
   */
  setAutoShow(bAutoShow: boolean): this {
    this.setProperty("autoShow", bAutoShow);
    if (bAutoShow) {
      this._enableAutoShow();
    } else {
      this._disableAutoShow();
    }
    return this;
  }

  /**
   * Custom setter for keyboardType — marks the type as explicitly set,
   * which disables auto-type detection. Use {@link #resetKeyboardType}
   * to re-enable auto-type.
   */
  setKeyboardType(sType: string): this {
    this._keyboardTypeExplicit = true;
    return this.setProperty("keyboardType", sType);
  }

  /**
   * Clears the explicit keyboardType lock and resets to "Full".
   *
   * Once {@link #setKeyboardType} has been called — directly, via the
   * constructor, or via an XML attribute — the `autoType` feature is
   * permanently disabled. Call this method to re-enable auto-type
   * detection so the keyboard can switch between Full and Numpad
   * based on the focused input's metadata again.
   *
   * @public
   */
  resetKeyboardType(): this {
    this._keyboardTypeExplicit = false;
    return this.setProperty("keyboardType", "Full");
  }

  /**
   * Custom setter for docked — manages CSS on the existing DOM
   * rather than re-rendering (which would disrupt transitions).
   */
  setDocked(bDocked: boolean): this {
    if (!this.getDocked() && bDocked) {
      this._open = false;
    }
    return this.setProperty("docked", bDocked);
  }

  /** Opens the keyboard (docked mode). Slides it into view. */
  show(): this {
    if (this._open) return this;
    this._open = true;
    this._suppressNativeKeyboard();
    const dom = this.getDomRef();
    if (dom) {
      dom.classList.remove("ui5KioskKeyboard--closed");
    }
    this._fireAfterTransition("afterOpen");
    return this;
  }

  /** Closes the keyboard (docked mode). Slides it out of view. */
  close(): this {
    if (!this._open) return this;
    this._open = false;
    this._restoreNativeKeyboard();
    const dom = this.getDomRef();
    if (dom) {
      dom.classList.add("ui5KioskKeyboard--closed");
    }
    this._fireAfterTransition("afterClose");
    return this;
  }

  /** Whether the docked keyboard is currently open. */
  isOpen(): boolean {
    return this._open;
  }

  /**
   * Enables auto-show: the keyboard automatically opens when any
   * `<input>` or `<textarea>` on the page receives focus, setting it
   * as the target. Closes when focus moves away from all inputs.
   */
  private _enableAutoShow(): this {
    if (this._autoShowActive) return this;
    this._autoShowActive = true;
    document.addEventListener("focusin", this._boundFocusIn, true);
    document.addEventListener("focusout", this._boundFocusOut, true);
    return this;
  }

  /** Disables auto-show listeners. */
  private _disableAutoShow(): this {
    if (!this._autoShowActive) return this;
    this._autoShowActive = false;
    document.removeEventListener("focusin", this._boundFocusIn, true);
    document.removeEventListener("focusout", this._boundFocusOut, true);
    return this;
  }

  // ──────────────────────────────────────────────
  // Private — inputIds delegation
  // ──────────────────────────────────────────────

  private _setupInputIds(): void {
    const ids = this.getInputIds();
    const nextIds = new Set(ids);

    // Remove delegates for IDs no longer in the list
    for (const oldId of this._registeredInputIds) {
      if (!nextIds.has(oldId)) {
        const control = this._findControlById(oldId);
        if (control) control.removeEventDelegate(this._inputFocusDelegation);
        this._registeredInputIds.delete(oldId);
      }
    }

    // Add delegates for new IDs
    for (const inputId of ids) {
      if (this._registeredInputIds.has(inputId)) continue;
      const control = this._findControlById(inputId);
      if (!control) continue;
      control.addEventDelegate(this._inputFocusDelegation);
      this._registeredInputIds.add(inputId);
    }
  }

  private _teardownInputIds(): void {
    for (const inputId of this._registeredInputIds) {
      const control = this._findControlById(inputId);
      if (control) control.removeEventDelegate(this._inputFocusDelegation);
    }
    this._registeredInputIds.clear();
  }

  private _findControlById(targetId: string): Control | null {
    // Try global first
    const global = Element.getElementById(targetId);
    if (global instanceof Control) return global;

    // Walk up to find parent View for view-local IDs
    for (let parent: ManagedObject | null = this.getParent(); parent; parent = parent.getParent()) {
      if (parent instanceof View) {
        const found = parent.byId(targetId);
        if (found instanceof Control) return found;
      }
    }
    return null;
  }

  // ──────────────────────────────────────────────
  // Focus Management
  // ──────────────────────────────────────────────

  getFocusDomRef(): globalThis.Element | null {
    return (
      (this._lastFocusedKeyId && document.getElementById(this._lastFocusedKeyId)) ||
      this.getDomRef()?.querySelector(".ui5KioskKey") ||
      null
    );
  }

  getFocusInfo(): { lastFocusedKeyId: string | null } {
    return { lastFocusedKeyId: this._lastFocusedKeyId };
  }

  applyFocusInfo(oFocusInfo: { preventScroll?: boolean; lastFocusedKeyId?: string }): this {
    if (oFocusInfo.lastFocusedKeyId) {
      const el = document.getElementById(oFocusInfo.lastFocusedKeyId);
      if (el) {
        el.setAttribute("tabindex", "0");
        el.focus();
        return this;
      }
    }
    // Fallback: focus the first key (e.g. after layout switch where the
    // previously focused key no longer exists). This prevents Popover
    // auto-close when the keyboard re-renders inside one.
    const first = this.getDomRef()?.querySelector(".ui5KioskKey") as HTMLElement | null;
    if (first) {
      first.setAttribute("tabindex", "0");
      first.focus();
    }
    return this;
  }

  // ──────────────────────────────────────────────
  // Accessibility
  // ──────────────────────────────────────────────

  getAccessibilityInfo(): {
    role: string;
    type: string;
    description: string;
    focusable: boolean;
    enabled: boolean;
  } {
    return {
      role: "group",
      type: getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard"),
      description: this.getAriaLabel() || getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard"),
      focusable: true,
      enabled: this.getEnabled(),
    };
  }

  // ──────────────────────────────────────────────
  // Public API (used by renderer)
  // ──────────────────────────────────────────────

  isShiftActive(): boolean {
    return this._shiftActive || this._capsLock;
  }

  isCapsLock(): boolean {
    return this._capsLock;
  }

  getResolvedLayout(): LayoutDefinition {
    const kbType = this.getKeyboardType();
    if (kbType === "Numpad") return layouts.numpad;
    if (kbType === "Numeric") return layouts.numeric;
    const name = this.getLayout();
    return layouts[name] ?? layouts[DEFAULT_LAYOUT];
  }

  /** Default icons for special keys — used when the key has no explicit icon. */
  static readonly SPECIAL_KEY_ICONS: Readonly<Record<string, string>> = {
    "{shift}": "sap-icon://arrow-top",
    "{enter}": "sap-icon://accept",
  };

  /**
   * Returns the default icon URI for a special key value, or undefined
   * if the key has no default icon.
   *
   * @param sKeyValue Key value (e.g. "{shift}", "{enter}")
   * @public
   * @static
   */
  static getKeyIcon(sKeyValue: string): string | undefined {
    return KioskKeyboard.SPECIAL_KEY_ICONS[sKeyValue];
  }

  /** Map from special key value to [i18nKey, fallback]. */
  private static readonly _SPECIAL_KEY_I18N: Record<string, [string, string]> = {
    "{backspace}": ["KEY_BACKSPACE", "Backspace"],
    "{enter}": ["KEY_ENTER", "Enter"],
    "{shift}": ["KEY_SHIFT", "Shift"],
    " ": ["KEY_SPACE", "Space"],
  };

  /** The display label for a key (may be empty for icon-only keys). */
  getKeyLabel(key: KeyDefinition): string {
    const shift = this.isShiftActive();
    if (shift && key.shiftLabel) return key.shiftLabel;
    const entry = KioskKeyboard._SPECIAL_KEY_I18N[key.value];
    const base = entry ? getText(entry[0], entry[1]) : (key.label ?? key.value);
    if (!base) return "";
    return shift && !entry && key.value.length === 1 ? base.toUpperCase() : base;
  }

  /**
   * Accessible label for a key — always non-empty.
   * For icon-only keys (label=""), resolves to a human-readable name.
   */
  getKeyAriaLabel(key: KeyDefinition): string {
    const display = this.getKeyLabel(key);
    if (display) return display;

    // Icon-only key with empty display label — resolve from value
    const entry = KioskKeyboard._SPECIAL_KEY_I18N[key.value];
    return entry ? getText(entry[0], entry[1]) : key.value;
  }

  // ──────────────────────────────────────────────
  // UI5 Event Delegation
  // ──────────────────────────────────────────────

  /**
   * Prevents focus from leaving the target input when a key is pressed.
   *
   * Uses UI5's EventSimulation touchstart (fires for both mouse and touch)
   * instead of raw pointerdown. preventDefault() on the underlying
   * mousedown/touchstart prevents focus transfer to the key div without
   * suppressing the click/tap chain — unlike pointerdown's preventDefault()
   * which suppresses all compatibility mouse events per the Pointer Events spec.
   */
  ontouchstart(event: Event): void {
    const el = (event.target as HTMLElement).closest(".ui5KioskKey") as HTMLElement | null;
    if (el) {
      event.preventDefault();
      this._pressedKeyEl = el;
      el.classList.add("ui5KioskKey--pressed");
    }
  }

  /**
   * Activates the key on touch/mouse release.
   *
   * Only fires if the release target matches the press target (basic
   * tap detection — drag-away cancels). Replaces ontap which couldn't
   * fire because pointerdown's preventDefault() suppressed the click
   * event that jQuery's tap plugin depends on.
   */
  ontouchend(event: Event): void {
    const pressed = this._pressedKeyEl;
    this._pressedKeyEl = null;
    if (pressed) {
      pressed.classList.remove("ui5KioskKey--pressed");
    }

    if (!this.getEnabled() || !pressed) return;

    const el = (event.target as HTMLElement).closest(".ui5KioskKey") as HTMLElement | null;
    if (el !== pressed) return;

    const keyValue = pressed.dataset.key;
    if (!keyValue) return;

    this._lastFocusedKeyId = pressed.id;
    this._handleKeyAction(keyValue, pressed);
  }

  onkeydown(event: KeyboardEvent): void {
    if (!this.getEnabled()) return;
    // Don't intercept browser shortcuts (Alt+Arrow = history, Meta+Arrow = OS)
    if (event.altKey || event.metaKey) return;

    const target = event.target as HTMLElement;
    if (!target.classList.contains("ui5KioskKey")) return;

    switch (event.key) {
      case "Enter":
      case " ": {
        event.preventDefault();
        const keyValue = target.dataset.key;
        if (keyValue) this._handleKeyAction(keyValue, target);
        break;
      }
      case "ArrowLeft":
        event.preventDefault();
        this._moveFocus(target, 0, -1);
        break;
      case "ArrowRight":
        event.preventDefault();
        this._moveFocus(target, 0, 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        this._moveFocus(target, -1, 0);
        break;
      case "ArrowDown":
        event.preventDefault();
        this._moveFocus(target, 1, 0);
        break;
      case "Home": {
        event.preventDefault();
        const row = target.closest(".ui5KioskRow");
        const first = row?.querySelector(".ui5KioskKey") as HTMLElement | null;
        if (first && first !== target) this._transferFocus(target, first);
        break;
      }
      case "End": {
        event.preventDefault();
        const row = target.closest(".ui5KioskRow");
        const keys = row?.querySelectorAll(".ui5KioskKey");
        const last = keys?.[keys.length - 1] as HTMLElement | undefined;
        if (last && last !== target) this._transferFocus(target, last);
        break;
      }
    }
  }

  // ──────────────────────────────────────────────
  // Private — Auto-show
  // ──────────────────────────────────────────────

  /** Returns true if any other KioskKeyboard instance already targets this input. */
  private _isTargetOfOther(inputId: string): boolean {
    for (const other of KioskKeyboard._instances) {
      if (other !== this && other.getTargetInput() === inputId) return true;
    }
    return false;
  }

  private _onDocumentFocusIn(event: FocusEvent): void {
    if (!this.getDocked() || !this.getEnabled()) return;

    const target = event.target as HTMLElement;

    // Ignore focus on the keyboard itself
    const myDom = this.getDomRef();
    if (myDom && myDom.contains(target)) return;

    // Check if focus went to an input/textarea
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      // Defer to native keyboard on mobile when configured
      if (this._shouldDeferToNative()) return;

      // Resolve the UI5 control that owns this DOM element
      const ui5Control = Element.closestTo(target);

      // Skip if this input is already targeted by another keyboard instance.
      // Check BEFORE cancelling the close timer so the keyboard still closes
      // normally when focus moves from an unclaimed input to a claimed one.
      if (ui5Control instanceof Control && this._isTargetOfOther(ui5Control.getId())) return;

      // Cancel any pending close
      if (this._closeTimer) {
        clearTimeout(this._closeTimer);
        this._closeTimer = null;
      }

      if (ui5Control instanceof Control) {
        this.setTargetInput(ui5Control);

        // Auto-detect keyboard type from input metadata
        if (this.getAutoType() && !this._keyboardTypeExplicit) {
          const detected = this._detectKeyboardType(ui5Control);
          this.setProperty("keyboardType", detected);
        }
      }

      this.show(); // show() calls _suppressNativeKeyboard() internally
    }
  }

  private _onDocumentFocusOut(_event: FocusEvent): void {
    if (!this.getDocked() || !this._open || !this.getEnabled()) return;

    // Clear any pending close timer before setting a new one
    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
    }

    // Delay close — focus might be moving to another input or the keyboard
    this._closeTimer = setTimeout(() => {
      this._closeTimer = null;
      const active = document.activeElement;

      // Don't close if focus is on the keyboard
      const myDom = this.getDomRef();
      if (myDom && active && myDom.contains(active)) return;

      // Don't close if focus moved to another input — unless that input
      // is claimed by a different keyboard instance (e.g. an inline numpad).
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        const ui5Control = Element.closestTo(active);
        if (!(ui5Control instanceof Control && this._isTargetOfOther(ui5Control.getId()))) return;
      }

      this.close();
    }, 200);
  }

  // ──────────────────────────────────────────────
  // Private — Pointer & Key Actions
  // ──────────────────────────────────────────────

  private _handleKeyAction(keyValue: string, el: HTMLElement): void {
    const shift = this.isShiftActive();

    if (keyValue === "{shift}") {
      this._toggleShift();
      return;
    }

    if (keyValue === "{backspace}") {
      if (this.fireEvent("keyPress", { key: "Backspace", shiftKey: shift }, true)) {
        this._handleBackspace();
      }
      return;
    }

    if (keyValue === "{enter}") {
      if (this.fireEvent("keyPress", { key: "Enter", shiftKey: shift }, true)) {
        this._handleEnter();
      }
      return;
    }

    if (keyValue.startsWith("{layout:")) {
      if (this.getKeyboardType() === "Full") {
        const raw = keyValue.slice(8, -1);
        const name = raw === "base" ? this._baseLayout : raw;
        this.setLayout(name);
        this.fireEvent("layoutChange", { layout: name });
      }
      return;
    }

    // Regular character — resolve shift value
    let effective = keyValue;
    if (shift) {
      const shiftValue = el.dataset.shiftValue;
      if (shiftValue) {
        effective = shiftValue;
      } else if (keyValue.length === 1) {
        effective = keyValue.toUpperCase();
      }
    }

    if (this.fireEvent("keyPress", { key: effective, shiftKey: shift }, true)) {
      this._insertText(effective);
    }

    // Auto-release shift (not caps lock)
    if (this._shiftActive && !this._capsLock) {
      this._shiftActive = false;
      this.invalidate();
    }
  }

  private _toggleShift(): void {
    if (this._capsLock) {
      this._capsLock = false;
      this._shiftActive = false;
    } else if (this._shiftActive) {
      this._capsLock = true;
    } else {
      this._shiftActive = true;
    }
    this.invalidate();
  }

  /**
   * Returns the target input's inner DOM element, ensuring it is focused
   * with the cursor at the end of its value if it wasn't already active.
   *
   * Real virtual keyboards always operate at the cursor position. When the
   * target input hasn't been focused yet (e.g. set programmatically via
   * `setTargetInput`), `selectionStart` defaults to 0. Without this guard
   * every operation would happen at the beginning instead of the end.
   */
  private _getTargetDomRef(): HTMLInputElement | HTMLTextAreaElement | null {
    const element = this._getTargetElement();
    if (!element) return null;

    const dom = element.getFocusDomRef();
    if (!(dom instanceof HTMLInputElement || dom instanceof HTMLTextAreaElement)) {
      return null;
    }

    // Ensure cursor is positioned — if the input isn't the active element,
    // focus it and place the cursor at the end of the existing value.
    if (document.activeElement !== dom) {
      dom.focus();
      dom.setSelectionRange(dom.value.length, dom.value.length);
    }

    return dom;
  }

  private _insertText(text: string): void {
    const dom = this._getTargetDomRef();
    if (!dom) return;

    const start = dom.selectionStart ?? dom.value.length;
    const end = dom.selectionEnd ?? start;
    const newValue = dom.value.slice(0, start) + text + dom.value.slice(end);
    const newPos = start + text.length;

    this._setTargetValue(newValue);
    try {
      dom.setSelectionRange(newPos, newPos);
    } catch {
      // May throw on certain input types (e.g. type="number")
    }
  }

  private _handleBackspace(): void {
    const dom = this._getTargetDomRef();
    if (!dom) return;

    const start = dom.selectionStart ?? dom.value.length;
    const end = dom.selectionEnd ?? start;

    let newValue: string;
    let newPos: number;

    if (start !== end) {
      newValue = dom.value.slice(0, start) + dom.value.slice(end);
      newPos = start;
    } else if (start > 0) {
      newValue = dom.value.slice(0, start - 1) + dom.value.slice(start);
      newPos = start - 1;
    } else {
      return;
    }

    this._setTargetValue(newValue);
    try {
      dom.setSelectionRange(newPos, newPos);
    } catch {
      // May throw on certain input types (e.g. type="number")
    }
  }

  private _handleEnter(): void {
    const dom = this._getTargetDomRef();
    if (dom instanceof HTMLTextAreaElement) {
      this._insertText("\n");
      return;
    }
    // Single-line input: fire change event (matches physical Enter behavior)
    if (dom instanceof HTMLInputElement) {
      this._fireTargetChange(dom.value);
    }
  }

  /**
   * Resolve the target input association to a UI5 Element.
   * Uses Element registry (the standard UI5 association resolution pattern).
   */
  private _getTargetElement(): Element | null {
    const id = this.getTargetInput();
    if (!id) return null;
    return Element.getElementById(id) ?? null;
  }

  private _fireTargetChange(value: string): void {
    const element = this._getTargetElement();
    if (!element) return;

    if (element.getMetadata().hasEvent("change")) {
      element.fireEvent("change", { value });
    }
  }

  private _setTargetValue(newValue: string): void {
    const element = this._getTargetElement();
    if (!element) return;

    const metadata = element.getMetadata();
    if (metadata.hasProperty("value")) {
      // Use the typed setter (e.g. InputBase.setValue) which updates both
      // the ManagedObject property AND the DOM value synchronously.
      // Direct setProperty() only updates the property bag — but
      // InputBase.getValue() reads from the DOM when rendered, causing a
      // desync where the property is updated but getValue() returns stale data.
      const ctrl = element as unknown as Record<string, unknown>;
      if (typeof ctrl.setValue === "function") {
        (ctrl.setValue as (v: string) => unknown).call(element, newValue);
      } else {
        element.setProperty("value", newValue);
      }
    }
    if (metadata.hasEvent("liveChange")) {
      element.fireEvent("liveChange", { value: newValue });
    }
  }

  private _moveFocus(current: HTMLElement, dRow: number, dCol: number): void {
    const match = current.id.match(KEY_ID_SUFFIX_RE);
    if (!match) return;

    const row = Number.parseInt(match[1], 10) + dRow;
    const col = Number.parseInt(match[2], 10) + dCol;
    const sId = this.getId();

    // Try exact coordinate first
    let next: HTMLElement | null = document.getElementById(keyElementId(sId, row, col));

    if (!next) {
      if (dCol !== 0 && dRow === 0) {
        // Horizontal wrapping: move to adjacent row
        const currentRow = current.closest(".ui5KioskRow");
        const adjacentRow = dCol > 0 ? currentRow?.nextElementSibling : currentRow?.previousElementSibling;
        if (adjacentRow) {
          const keys = adjacentRow.querySelectorAll(".ui5KioskKey");
          if (keys.length > 0) {
            next = (dCol > 0 ? keys[0] : keys[keys.length - 1]) as HTMLElement;
          }
        }
      } else if (dRow !== 0) {
        // Vertical fallback: clamp to last key in target row
        const targetRow = this.getDomRef()?.querySelectorAll(".ui5KioskRow")[row];
        if (targetRow) {
          const keys = targetRow.querySelectorAll(".ui5KioskKey");
          if (keys.length > 0) {
            next = keys[Math.min(col, keys.length - 1)] as HTMLElement;
          }
        }
      }
    }

    if (next) {
      this._transferFocus(current, next);
    }
  }

  private _transferFocus(current: HTMLElement, next: HTMLElement): void {
    current.setAttribute("tabindex", "-1");
    next.setAttribute("tabindex", "0");
    next.focus();
    this._lastFocusedKeyId = next.id;
  }

  // ──────────────────────────────────────────────
  // Private — Physical keyboard highlighting
  // ──────────────────────────────────────────────

  private _highlightKey(key: string, add: boolean): void {
    const dom = this.getDomRef();
    if (!dom) return;

    const el =
      dom.querySelector(`[data-key="${CSS.escape(key)}"]`) ??
      (key.length === 1 ? dom.querySelector(`[data-key="${CSS.escape(key.toLowerCase())}"]`) : null) ??
      dom.querySelector(`[data-shift-value="${CSS.escape(key)}"]`);
    el?.classList.toggle("ui5KioskKey--highlight", add);
  }

  private _removeHighlightDelegation(): void {
    if (!this._highlightTargetId) return;
    const prev = Element.getElementById(this._highlightTargetId);
    if (prev) prev.removeEventDelegate(this._keyHighlightDelegation);
    this._highlightTargetId = null;
  }

  // ──────────────────────────────────────────────
  // Private — Auto-type detection
  // ──────────────────────────────────────────────

  /** Numeric input types that map to Numpad keyboard. */
  private static readonly _NUMPAD_CONTROL_TYPES: ReadonlySet<string> = new Set(["Number", "Tel"]);
  private static readonly _NUMPAD_CONTROL_NAMES: ReadonlySet<string> = new Set(["sap.m.StepInput"]);
  private static readonly _NUMPAD_INPUT_MODES: ReadonlySet<string> = new Set(["numeric", "decimal", "tel"]);
  private static readonly _NUMPAD_HTML_TYPES: ReadonlySet<string> = new Set(["number", "tel"]);

  /**
   * Detects whether the target control should use a Numpad or Full
   * keyboard type. Checks UI5 control type, control name, DOM
   * inputmode, and HTML type in order.
   */
  private _detectKeyboardType(control: Control): string {
    // 1. UI5 getType() — e.g. sap.m.Input type="Number"
    const ctrl = control as unknown as Record<string, unknown>;
    if (typeof ctrl.getType === "function") {
      const type = ctrl.getType() as string;
      if (KioskKeyboard._NUMPAD_CONTROL_TYPES.has(type)) return KeyboardType.Numpad;
    }

    // 2. Control name — walk up the parent chain because composite controls
    //    (e.g. sap.m.StepInput) wrap an inner sap.m.Input. Element.closestTo()
    //    returns the inner Input, but we need to match the outer StepInput.
    for (let parent: ManagedObject | null = control; parent; parent = parent.getParent()) {
      if (parent instanceof Control) {
        const name = parent.getMetadata().getName();
        if (KioskKeyboard._NUMPAD_CONTROL_NAMES.has(name)) return KeyboardType.Numpad;
      }
    }

    // 3. DOM inputmode attribute
    const dom = control.getFocusDomRef();
    if (dom instanceof HTMLInputElement || dom instanceof HTMLTextAreaElement) {
      const inputmode = dom.getAttribute("inputmode");
      if (inputmode && KioskKeyboard._NUMPAD_INPUT_MODES.has(inputmode)) return KeyboardType.Numpad;

      // 4. HTML type attribute
      if (dom instanceof HTMLInputElement && KioskKeyboard._NUMPAD_HTML_TYPES.has(dom.type)) {
        return KeyboardType.Numpad;
      }
    }

    return KeyboardType.Full;
  }

  // ──────────────────────────────────────────────
  // Private — Mobile detection
  // ──────────────────────────────────────────────

  /**
   * Returns true when the native keyboard should be used instead of
   * this control. Checks the `mobileKeyboard` property against
   * the current device type.
   */
  private _shouldDeferToNative(): boolean {
    const mode = this.getMobileKeyboard();
    if (mode === "Custom") return false;
    if (mode === "Native") return true;
    // "Auto": kiosk keyboard on desktop, native on mobile
    return Device.system.phone || (Device.system.tablet && !Device.system.desktop);
  }

  /**
   * Suppresses the native virtual keyboard by setting
   * `inputmode="none"` on the target input's DOM element.
   */
  private _suppressNativeKeyboard(): void {
    if (this._shouldDeferToNative()) return;

    const el = this._getTargetElement();
    if (!el) return;

    const dom = el.getFocusDomRef();
    if (!(dom instanceof HTMLInputElement || dom instanceof HTMLTextAreaElement)) return;

    // Already suppressing this element
    if (this._suppressedInputEl === dom) return;

    // Restore previous if different
    this._restoreNativeKeyboard();

    this._originalInputMode = dom.getAttribute("inputmode");
    this._suppressedInputEl = dom;
    dom.setAttribute("inputmode", "none");
  }

  /**
   * Restores the original `inputmode` on the previously suppressed
   * input element.
   */
  private _restoreNativeKeyboard(): void {
    if (!this._suppressedInputEl) return;

    // Re-resolve: the target control may have re-rendered, replacing the DOM node.
    // Fall back to the cached ref if the target is no longer available.
    const freshDom = this._getTargetElement()?.getFocusDomRef();
    const dom =
      freshDom instanceof HTMLInputElement || freshDom instanceof HTMLTextAreaElement
        ? freshDom
        : this._suppressedInputEl;

    if (this._originalInputMode !== null) {
      dom.setAttribute("inputmode", this._originalInputMode);
    } else {
      dom.removeAttribute("inputmode");
    }

    this._originalInputMode = null;
    this._suppressedInputEl = null;
  }

  /**
   * Fires an event after the CSS transition completes (docked mode),
   * or immediately if not docked or no transition is active.
   */
  private _fireAfterTransition(eventName: string): void {
    const dom = this.getDomRef();
    if (!dom || !this.getDocked()) {
      this.fireEvent(eventName);
      return;
    }
    // prefers-reduced-motion sets transition: none → duration is "0s"
    const duration = getComputedStyle(dom).transitionDuration;
    if (!duration || duration === "0s") {
      this.fireEvent(eventName);
      return;
    }
    const handler = (e: Event) => {
      const te = e as TransitionEvent;
      if (te.target !== dom || te.propertyName !== "transform") return;
      dom.removeEventListener("transitionend", handler);
      this.fireEvent(eventName);
    };
    dom.addEventListener("transitionend", handler);
  }
}
