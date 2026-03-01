import Control from "sap/ui/core/Control";
import Element from "sap/ui/core/Element";
import ManagedObject from "sap/ui/base/ManagedObject";
import View from "sap/ui/core/mvc/View";
import Device from "sap/ui/Device";
import { SECONDARY_LAYOUTS } from "./types";
import type { LayoutDefinition, KeyDefinition } from "./types";
import type { RendererInternalApi } from "./internal/renderer-internal-api";
import DEFAULT_LAYOUT from "./layouts/default-layout";
import Log from "sap/base/Log";
import KioskKeyboardRenderer from "./KioskKeyboardRenderer";
import { getText } from "./internal/i18n";
import { KEY_ID_SUFFIX_RE, keyElementId, resolveInputOrTextarea } from "./internal/dom";
import { KeyboardType, type KeyboardTypeValue, MobileKeyboard, FKeyMode, NativeDispatchableKeyNames } from "./library"; // side-effect: ensures Lib.init() runs
import {
  registerLayout as registryRegisterLayout,
  unregisterLayout as registryUnregisterLayout,
  resetCustomLayouts as registryResetCustomLayouts,
  getRegisteredLayout as registryGetLayout,
  getLayoutOrDefault as registryGetLayoutOrDefault,
  getRegisteredLayoutNames as registryGetLayoutNames,
  isBuiltInLayout as registryIsBuiltIn,
  registerLocaleLayout as registryRegisterLocale,
  unregisterLocaleLayout as registryUnregisterLocale,
  resetLocaleLayouts as registryResetLocales,
  getLocaleLayout as registryGetLocaleLayout,
} from "./internal/layout-registry";
import { detectKeyboardType as detectKbType } from "./internal/detect-keyboard-type";
import FocusClaimService from "./internal/focus-claim-service";
import TargetInputSession from "./internal/target-input-session";

type InputFocusDelegation = {
  onfocusin: () => void;
};

type KeyHighlightDelegation = {
  onkeydown: (event: Event) => void;
  onkeyup: (event: Event) => void;
};

type InputModeSuppressionState = {
  originalInputMode: string | null;
  refCount: number;
};

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
  declare private _boundFocusIn: (e: FocusEvent) => void;
  declare private _boundFocusOut: (e: FocusEvent) => void;
  declare private _autoShowActive: boolean;
  declare private _inputFocusDelegation: InputFocusDelegation;
  declare private _registeredInputControlById: Map<string, string>;
  declare private _resolvedInputControlIds: Set<string>;

  declare private _delegatedInstances: Map<string, Control>;
  declare private _keyHighlightDelegation: KeyHighlightDelegation;
  declare private _highlightTargetId: string | null;
  declare private _pressedKeyEl: HTMLElement | null;
  declare private _baseLayout: string;
  declare private _keyboardTypeExplicit: boolean;
  declare private _suppressedInputId: string | null;
  declare private _maxHeight: number;
  declare private _boundEscapeKeydown: (e: KeyboardEvent) => void;
  declare private _focusClaimService: FocusClaimService;
  declare private _targetSession: TargetInputSession;
  declare private _deferredFocusOutCloseId: number | null;
  declare private _rendererApi: RendererInternalApi | null;

  static readonly metadata = {
    library: "ui5.kiosk" as const,
    properties: {
      /**
       * Active layout name. Only effective when keyboardType is "Full".
       * Auto-detected from the UI5 locale when omitted.
       *
       * @example <caption>XML view</caption>
       * <kiosk:KioskKeyboard layout="qwertz-de" targetInput="myInput" />
       *
       * @example <caption>TypeScript — custom layout</caption>
       * KioskKeyboard.registerLayout("azerty-fr", frenchLayout);
       * new KioskKeyboard({ layout: "azerty-fr" });
       */
      layout: {
        type: "string",
        defaultValue: "qwerty",
        group: "Behavior",
      },
      /**
       * Keyboard display type.
       * `"Full"` renders the active layout. `"Numeric"` and `"Numpad"` render
       * compact number-oriented layouts regardless of the layout property.
       *
       * Setting this property (via setter, constructor, or XML attribute)
       * disables auto-type detection permanently.
       * Call `resetKeyboardType()` to re-enable it.
       *
       * @example <caption>XML view — fixed numpad</caption>
       * <kiosk:KioskKeyboard keyboardType="Numpad" targetInput="pinInput" />
       */
      keyboardType: {
        type: "ui5.kiosk.KeyboardType",
        defaultValue: "Full",
        group: "Behavior",
      },
      /**
       * Whether the keyboard is interactive. When `false`, all keys are
       * visually dimmed and pointer events are disabled.
       *
       * @example <caption>XML view — bind to model</caption>
       * <kiosk:KioskKeyboard enabled="{/keyboardEnabled}" targetInput="myInput" />
       */
      enabled: {
        type: "boolean",
        defaultValue: true,
        group: "Behavior",
      },
      /**
       * Accessible label for the keyboard group. Defaults to
       * "Virtual Keyboard" from the resource bundle when left empty.
       *
       * @example <caption>XML view</caption>
       * <kiosk:KioskKeyboard ariaLabel="PIN entry keyboard" targetInput="pinInput" />
       */
      ariaLabel: {
        type: "string",
        defaultValue: "",
        group: "Accessibility",
      },
      /**
       * When `true`, the keyboard anchors to the bottom of the viewport
       * and slides in/out. Use `show()` / `close()` to control
       * visibility manually, or set `autoShow` to `true` for automatic
       * focus-based behavior.
       *
       * @example <caption>XML view — docked with programmatic control</caption>
       * <kiosk:KioskKeyboard id="kb" docked="true" />
       * <!-- Controller: this.byId("kb").show(); -->
       */
      docked: {
        type: "boolean",
        defaultValue: false,
        group: "Behavior",
      },
      /**
       * When `true`, the docked keyboard automatically opens when any
       * `<input>` or `<textarea>` receives focus, and closes when
       * focus leaves. Requires `docked="true"`.
       *
       * @example <caption>XML view</caption>
       * <kiosk:KioskKeyboard docked="true" autoShow="true" />
       */
      autoShow: {
        type: "boolean",
        defaultValue: false,
        group: "Behavior",
      },
      /**
       * When `true` and `autoShow` is active, the keyboard inspects the
       * focused input's type metadata and automatically switches between
       * Full and Numpad keyboard types.
       *
       * Has no effect when `keyboardType` has been set explicitly (via
       * setter, constructor, or XML attribute), because that locks the
       * keyboard type. Call `resetKeyboardType()` to clear the lock
       * and re-enable auto-type detection.
       *
       * @example <caption>XML view — full auto kiosk setup</caption>
       * <kiosk:KioskKeyboard docked="true" autoShow="true" autoType="true" mobileKeyboard="Auto" />
       */
      autoType: {
        type: "boolean",
        defaultValue: false,
        group: "Behavior",
      },
      /**
       * Controls whether the KioskKeyboard or the native on-screen
       * keyboard is used.
       *
       * - `"Custom"` (default) — always uses the KioskKeyboard and
       *   suppresses the native keyboard via `inputmode="none"`.
       *   Best for **dedicated kiosk terminals** without a physical
       *   keyboard.
       * - `"Native"` — always defers to the native keyboard; the
       *   KioskKeyboard will not open on focus.
       * - `"Auto"` — uses KioskKeyboard on desktop browsers, defers
       *   to the native keyboard on phones and tablets. This is
       *   intended for **kiosk terminals running a desktop OS**
       *   (no physical keyboard) that should still let mobile
       *   visitors use their native keyboard. On a regular
       *   laptop/desktop with a physical keyboard the virtual
       *   keyboard **will** still appear — use `"Native"` if that
       *   is not desired.
       *
       * @example <caption>XML view — kiosk terminal setup</caption>
       * <kiosk:KioskKeyboard docked="true" autoShow="true" mobileKeyboard="Custom" />
       *
       * @example <caption>XML view — let mobile devices use native keyboard</caption>
       * <kiosk:KioskKeyboard docked="true" autoShow="true" mobileKeyboard="Auto" />
       */
      mobileKeyboard: {
        type: "ui5.kiosk.MobileKeyboard",
        defaultValue: "Custom",
        group: "Behavior",
      },
      /**
       * Controls how virtual F-key taps are handled.
       *
       * - `"Virtual"` (default): fire `keyPress` only. The app decides what to do.
       * - `"Native"`: dispatch a synthetic `keydown` for standard
       *   function/navigation keys (`F1`-`F12`, arrows, `Home`/`End`,
       *   `PageUp`/`PageDown`) to the current target element (or document
       *   fallback). If not canceled, built-in native actions run for
       *   selected keys (`F5`, `F11`).
       */
      fKeyMode: {
        type: "ui5.kiosk.FKeyMode",
        defaultValue: "Virtual",
        group: "Behavior",
      },
      /**
       * List of input control IDs to target. When set, attaches focus
       * delegation to each resolved control so the keyboard auto-targets
       * whichever input last received focus.
       *
       * IDs are resolved against the parent View first (view-local IDs),
       * then globally. This makes the property safe to use in XML views
       * where control IDs are prefixed by the view ID.
       *
       * Use this instead of `targetInput` when multiple inputs share
       * a single keyboard (e.g. a form with several fields).
       *
       * @example <caption>XML view — target multiple inputs</caption>
       * <m:Input id="name" />
       * <m:Input id="email" />
       * <kiosk:KioskKeyboard inputIds="name,email" />
       *
       * @example <caption>TypeScript</caption>
       * new KioskKeyboard({ inputIds: ["name", "email"] });
       */
      inputIds: {
        type: "string[]",
        defaultValue: [],
        group: "Behavior",
      },
      /**
       * When `true`, the keyboard maintains a consistent minimum height
       * across layout switches. Prevents visual layout shifts and works
       * around a `sap.m.Popover` bug where content height changes can
       * trigger spurious close.
       *
       * Only effective for non-docked Full keyboards. Docked keyboards
       * always minimize their footprint.
       *
       * @example <caption>XML view — keyboard inside a Popover</caption>
       * <Popover>
       *   <kiosk:KioskKeyboard stableHeight="true" targetInput="myInput" />
       * </Popover>
       */
      stableHeight: {
        type: "boolean",
        defaultValue: false,
        group: "Behavior",
      },
    },
    associations: {
      /**
       * The input control to type into (e.g. `sap.m.Input`, `sap.m.TextArea`).
       * For targeting multiple inputs, use the `inputIds` property instead.
       *
       * @example <caption>XML view</caption>
       * <m:Input id="myInput" />
       * <kiosk:KioskKeyboard targetInput="myInput" />
       */
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
      /**
       * Fired when a virtual key is pressed. Call `preventDefault()` to
       * skip the default input action (text insertion, backspace, etc.).
       *
       * @example <caption>TypeScript — intercept key presses</caption>
       * import { KeyName } from "ui5/kiosk/library";
       *
       * keyboard.attachKeyPress((event) => {
       *   if (event.getParameter("key") === KeyName.Enter) {
       *     event.preventDefault();
       *     submitForm();
       *   }
       * });
       */
      keyPress: {
        allowPreventDefault: true,
        parameters: {
          key: { type: "string" },
          shiftKey: { type: "boolean" },
        },
      },
      /**
       * Fired when the active layout changes (via a `{layout:name}` key
       * or programmatic `setLayout()` call).
       *
       * @example <caption>TypeScript</caption>
       * keyboard.attachLayoutChange((event) => {
       *   console.log("Switched to:", event.getParameter("layout"));
       * });
       */
      layoutChange: {
        parameters: {
          layout: { type: "string" },
        },
      },
      /**
       * Fired when the keyboard type changes — by auto-type detection,
       * explicit `setKeyboardType()`, or `resetKeyboardType()`.
       *
       * @example <caption>TypeScript</caption>
       * keyboard.attachKeyboardTypeChange((event) => {
       *   const type = event.getParameter("keyboardType");
       *   const auto = event.getParameter("autoDetected");
       *   console.log(`Type: ${type}, auto: ${auto}`);
       * });
       */
      keyboardTypeChange: {
        parameters: {
          /** The new keyboard type. */
          keyboardType: { type: "ui5.kiosk.KeyboardType" },
          /** The previous keyboard type. */
          previousKeyboardType: { type: "ui5.kiosk.KeyboardType" },
          /** Whether this change was triggered by auto-type detection. */
          autoDetected: { type: "boolean" },
        },
      },
      /** Fired when `show()` opens the docked keyboard (not tied to CSS transition end). */
      afterOpen: {},
      /** Fired when `close()` closes the docked keyboard (not tied to CSS transition end). */
      afterClose: {},
    },
  };

  static readonly renderer = KioskKeyboardRenderer;

  /** All living KioskKeyboard instances — used by auto-show to skip inputs already targeted by another keyboard. */
  private static readonly _instances = new Set<KioskKeyboard>();

  /** Native actions executed in `fKeyMode="Native"` when not prevented. */
  private static readonly _NATIVE_FKEY_ACTIONS: Partial<Record<string, () => void>> = {
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

  /** Tracks unsupported native F-key names already warned about. */
  private static readonly _WARNED_UNSUPPORTED_NATIVE_FKEYS = new Set<string>();

  /** Internal set used for O(1) native-dispatch allowlist checks. */
  private static readonly _NATIVE_DISPATCHABLE_FKEYS = new Set<string>(NativeDispatchableKeyNames);

  /** Ref-counted inputmode suppressions shared across keyboard instances. */
  private static readonly _inputModeSuppressions = new Map<string, InputModeSuppressionState>();

  // ──────────────────────────────────────────────
  // Static delegates — layout registry (see internal/layout-registry.ts)
  // ──────────────────────────────────────────────

  /**
   * Register a custom keyboard layout.
   *
   * Registered layouts can be used via `setLayout(name)` or declaratively
   * with `layout="name"`. Built-in layouts cannot be overwritten.
   *
   * @param sName Layout identifier (e.g. "azerty-fr").
   * @param oDefinition Layout rows and key definitions.
   */
  static registerLayout(sName: string, oDefinition: LayoutDefinition): void {
    registryRegisterLayout(sName, oDefinition);
  }

  /**
   * Remove a previously registered custom layout.
   *
   * Built-in layouts cannot be removed.
   *
   * @param sName Layout identifier.
   */
  static unregisterLayout(sName: string): void {
    registryUnregisterLayout(sName);
  }

  /**
   * Remove all custom layouts and keep built-in layouts intact.
   */
  static resetCustomLayouts(): void {
    registryResetCustomLayouts();
  }

  /**
   * Get a registered layout definition by name.
   *
   * @param sName Layout identifier.
   * @returns The layout definition, or undefined if not found.
   */
  static getRegisteredLayout(sName: string): LayoutDefinition | undefined {
    return registryGetLayout(sName);
  }

  /**
   * Get all registered layout names (built-in and custom).
   */
  static getRegisteredLayoutNames(): string[] {
    return registryGetLayoutNames();
  }

  /**
   * Check whether a layout name belongs to a built-in layout.
   *
   * @param sName Layout identifier.
   */
  static isBuiltInLayout(sName: string): boolean {
    return registryIsBuiltIn(sName);
  }

  /**
   * Register a locale-to-layout mapping.
   *
   * Mapping is used when no explicit `layout` is provided.
   *
   * @param sLocale BCP-47 locale key or prefix (e.g. "de", "de-at").
   * @param sLayout Target layout name.
   */
  static registerLocaleLayout(sLocale: string, sLayout: string): void {
    registryRegisterLocale(sLocale, sLayout);
  }

  /**
   * Remove a locale-to-layout mapping.
   *
   * @param sLocale Locale key or prefix.
   */
  static unregisterLocaleLayout(sLocale: string): void {
    registryUnregisterLocale(sLocale);
  }

  /**
   * Reset locale mappings back to built-in defaults.
   */
  static resetLocaleLayouts(): void {
    registryResetLocales();
  }

  /**
   * Resolve the layout name for the current UI5 locale.
   *
   * Uses exact locale match, then language-prefix match, then fallback.
   */
  static getLocaleLayout(): string {
    return registryGetLocaleLayout();
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
      mSettings.layout = registryGetLocaleLayout();
    }
    return super.applySettings(mSettings, oScope);
  }

  init(): void {
    KioskKeyboard._instances.add(this);
    this._shiftActive = false;
    this._capsLock = false;
    this._lastFocusedKeyId = null;
    this._open = false;
    this._autoShowActive = false;
    this._boundFocusIn = this._onDocumentFocusIn.bind(this);
    this._boundFocusOut = this._onDocumentFocusOut.bind(this);
    this._registeredInputControlById = new Map();
    this._resolvedInputControlIds = new Set();
    this._delegatedInstances = new Map();
    this._inputFocusDelegation = {
      onfocusin: () => {
        if (!this.getEnabled()) return;
        const active = Element.getActiveElement();
        if (!(active instanceof Control)) return;
        // For composite controls (e.g. StepInput), the active element is the
        // inner Input, but inputIds references the outer wrapper. Resolve the
        // registered ancestor so setTargetInput gets the right control.
        const ancestor = this._resolveInputIdsAncestor(active);
        this.setTargetInput(ancestor ?? active);
        // When docked with autoShow, show the keyboard for inputIds targets
        if (this.getDocked() && this.getAutoShow() && !this._open) {
          this.show();
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
    this._suppressedInputId = null;
    this._maxHeight = 0;
    this._boundEscapeKeydown = this._onDocumentEscapeKeydown.bind(this);
    this._deferredFocusOutCloseId = null;
    this._focusClaimService = new FocusClaimService(
      () => this.getInputIds(),
      () => this._resolvedInputControlIds,
      () => this._shouldDeferToNative(),
      (id) => this._isTargetOfOther(id),
    );
    this._targetSession = new TargetInputSession(() => this._getTargetElement());

    // Detect locale-appropriate default layout. This covers the case
    // where no settings are passed (applySettings is not called by
    // ManagedObject when settings are undefined).
    const localeLayout = registryGetLocaleLayout();
    this._baseLayout = localeLayout;
    if (localeLayout !== DEFAULT_LAYOUT) {
      this.setLayout(localeLayout);
    }
  }

  onAfterRendering(): void {
    const dom = this.getDomRef();

    this._syncDockedDomState();

    if (this.getDocked()) {
      // Activate auto-show listeners if the property was set declaratively
      // (e.g. via XML) before the control was rendered.
      if (this.getAutoShow() && !this._autoShowActive) {
        this._enableAutoShow();
      }
    }

    this._syncStableHeight(dom as HTMLElement | null);

    this._setupInputIds();
  }

  /** Keeps docked/closed root classes in sync without forcing a re-render. */
  private _syncDockedDomState(): void {
    const dom = this.getDomRef();
    if (!dom) return;

    const docked = this.getDocked();
    dom.classList.toggle("ui5KioskKeyboard--docked", docked);
    dom.classList.toggle("ui5KioskKeyboard--closed", docked && !this._open);
  }

  /** Updates stable-height minHeight based on current mode and measured height. */
  private _syncStableHeight(dom: HTMLElement | null): void {
    // Opt-in stable height: maintain consistent minHeight across layout
    // switches for non-docked Full keyboards. Prevents layout shifts in
    // Popover scenarios and works around a sap.m.Popover bug where
    // content-height changes trigger a spurious close.
    // Docked keyboards are excluded: they pin to the viewport edge so
    // minimising their footprint is more valuable than preventing shifts.
    if (dom && this.getStableHeight() && this.getKeyboardType() === KeyboardType.Full && !this.getDocked()) {
      const h = dom.getBoundingClientRect().height;
      if (h > this._maxHeight) {
        this._maxHeight = h;
      }
      dom.style.minHeight = `${this._maxHeight}px`;
      return;
    }

    if (dom) {
      dom.style.minHeight = "";
    }
    this._maxHeight = 0;
  }

  exit(): void {
    KioskKeyboard._instances.delete(this);
    this._cancelDeferredFocusOutClose();
    this._disableAutoShow();
    this._teardownInputIds();
    this._removeHighlightDelegation();
    this._restoreNativeKeyboard();
    document.removeEventListener("keydown", this._boundEscapeKeydown, true);
  }

  // ──────────────────────────────────────────────
  // Public API — Property overrides
  // ──────────────────────────────────────────────

  /**
   * Override `setEnabled` to proactively redirect focus to the target input
   * before disabling. Without this, the framework's generic onfocusfail
   * fallback would move focus to an arbitrary sibling.
   *
   * A docked keyboard that is disabled stays visually open (greyed out)
   * rather than closing. The escape listener and native keyboard suppression
   * remain attached so that re-enabling works without requiring `show()`.
   */
  setEnabled(bEnabled: boolean): this {
    if (!bEnabled) {
      this._redirectFocusToTargetIfOwned();
    }
    // Intentionally bypasses super.setEnabled() — the renderer and
    // _syncDockedDomState handle CSS classes and aria-disabled at
    // render time, so the generic Control.setEnabled logic is not needed.
    return this.setProperty("enabled", bEnabled) as this;
  }

  /**
   * Override `setVisible` to proactively redirect focus to the target input
   * before hiding. Without this, the framework's generic onfocusfail
   * fallback would move focus to an arbitrary sibling.
   *
   * Note: `setVisible(true)` does not re-open a previously closed docked
   * keyboard — call `show()` explicitly after making it visible again.
   */
  setVisible(bVisible: boolean): this {
    if (!bVisible) {
      this._redirectFocusToTargetIfOwned();
      // Close the docked keyboard — a hidden keyboard should not retain
      // open state (escape listener, native keyboard suppression).
      if (this.getDocked() && this._open) {
        this.close();
      }
    }
    return super.setVisible(bVisible);
  }

  /**
   * If focus is currently inside this keyboard's DOM, move it to the
   * target input. Called before operations that would remove the keyboard
   * from tab order (disable, hide) to avoid unpredictable focus fallback.
   *
   * Note: Uses `document.activeElement` which does not pierce shadow DOM
   * boundaries. This is fine because UI5 controls do not use shadow DOM.
   */
  private _redirectFocusToTargetIfOwned(): void {
    const myDom = this.getDomRef();
    if (!myDom) return;

    const active = document.activeElement;
    if (!active || !myDom.contains(active)) return;

    const targetElement = this._getTargetElement();
    const focusRef = targetElement?.getFocusDomRef();
    if (focusRef instanceof HTMLElement) {
      focusRef.focus();
      if (document.activeElement === focusRef) return;
    }

    // No target input or focus didn't move: blur the current key so
    // the framework's onfocusfail fallback starts from a clean state.
    if (active instanceof HTMLElement) {
      active.blur();
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
    if (!registryGetLayout(name)) {
      Log.warning(
        `Layout "${name}" is not registered. Call registerLayout() before setLayout().`,
        undefined,
        "ui5.kiosk.KioskKeyboard",
      );
      return this;
    }
    if (!SECONDARY_LAYOUTS.has(name)) {
      this._baseLayout = name;
    }
    return this.setProperty("layout", name);
  }

  /**
   * Returns the current base (alphabetic) layout name.
   *
   * This is the layout used when `{layout:base}` is triggered from secondary
   * layouts such as `numeric`, `special`, `fkeys`, or `nav`.
   */
  getBaseLayout(): string {
    return this._baseLayout;
  }

  /**
   * Restores the active layout to the tracked base layout.
   */
  resetLayout(): this {
    return this.setLayout(this._baseLayout);
  }

  /**
   * Sets the target input association without triggering a re-render,
   * since the association does not affect the keyboard's visual output.
   * Also moves the physical keyboard highlight delegation to the new target.
   */
  setTargetInput(target?: string | Control): this {
    // Capture pending change on the old target. The event is deferred to
    // after all state transitions so that re-entrant calls (from a change
    // handler that synchronously focuses another input) see settled state.
    const fireDeferredChange = this._targetSession.captureAndClearDirty();

    // Remove highlight delegation from previous target
    this._removeHighlightDelegation();

    // If the keyboard is open, restore the old target's inputmode
    // before switching so it's not left suppressed.
    if (this._open) {
      this._restoreNativeKeyboard();
    }

    this._targetSession.resetForTargetSwitch();

    // Reset shift/caps state for the new input context
    if (this._shiftActive || this._capsLock) {
      this._shiftActive = false;
      this._capsLock = false;
      this.invalidate();
    }

    this.setAssociation("targetInput", target ?? "", true);

    const newId = this.getTargetInput();
    if (newId && this._isTargetOfOther(newId)) {
      Log.warning(
        `KioskKeyboard: targetInput "${newId}" is already targeted by another KioskKeyboard instance`,
        undefined,
        "ui5.kiosk.KioskKeyboard",
      );
    }

    // Add highlight delegation to new target
    if (newId) {
      const next = Element.getElementById(newId);
      if (next) {
        next.addEventDelegate(this._keyHighlightDelegation);
        this._highlightTargetId = newId;

        // Dev-time check: warn if the control won't work as a target
        const focusRef = next.getFocusDomRef?.();
        if (focusRef && !resolveInputOrTextarea(focusRef)) {
          Log.warning(
            `KioskKeyboard: targetInput "${newId}" does not have a textual input DOM ref — ` +
              "key taps will have no effect. Expected (or containing) HTMLInputElement/HTMLTextAreaElement.",
            undefined,
            "ui5.kiosk.KioskKeyboard",
          );
        }
      } else {
        Log.warning(
          `KioskKeyboard: targetInput "${newId}" could not be resolved — Element.getElementById() returned null`,
          undefined,
          "ui5.kiosk.KioskKeyboard",
        );
      }
    }

    // Keep aria-controls in sync (setAssociation suppresses re-render)
    const dom = this.getDomRef();
    if (dom) {
      const resolvedId = this.getTargetInput();
      if (resolvedId) {
        dom.setAttribute("aria-controls", resolvedId);
      } else {
        dom.removeAttribute("aria-controls");
      }
    }

    // If the keyboard is open, suppress the new target's native keyboard.
    if (this._open) {
      this._suppressNativeKeyboard();
    }

    // Fire the deferred change event on the OLD target. State is now
    // settled, so if the handler re-enters setTargetInput (e.g. by
    // focusing another input), the inner call sees consistent state
    // and its result becomes the final state.
    fireDeferredChange?.();

    return this;
  }

  /**
   * Custom setter for inputIds.
   *
   * Reconciles focus delegates against currently resolved control instances
   * without forcing a re-render, because inputIds does not affect renderer
   * output directly.
   */
  setInputIds(inputIds: string[]): this {
    this.setProperty("inputIds", inputIds, true);
    this._setupInputIds();
    return this;
  }

  /**
   * Custom setter for autoShow — activates or deactivates the
   * auto-show document listeners via enableAutoShow/disableAutoShow.
   */
  setAutoShow(bAutoShow: boolean): this {
    this.setProperty("autoShow", bAutoShow, true);
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
  setKeyboardType(sType: KeyboardTypeValue): this {
    const sPrevious = this.getKeyboardType();
    this._keyboardTypeExplicit = true;
    this.setProperty("keyboardType", sType);
    if (sType !== sPrevious) {
      this.fireEvent("keyboardTypeChange", {
        keyboardType: sType,
        previousKeyboardType: sPrevious,
        autoDetected: false,
      });
    }
    return this;
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
    const sPrevious = this.getKeyboardType();
    this._keyboardTypeExplicit = false;
    this.setProperty("keyboardType", KeyboardType.Full);
    if (KeyboardType.Full !== sPrevious) {
      this.fireEvent("keyboardTypeChange", {
        keyboardType: KeyboardType.Full,
        previousKeyboardType: sPrevious,
        autoDetected: false,
      });
    }
    return this;
  }

  /**
   * Whether keyboardType has been explicitly set and auto-type is locked.
   */
  isKeyboardTypeExplicit(): boolean {
    return this._keyboardTypeExplicit;
  }

  /**
   * Custom setter for docked — manages CSS on the existing DOM
   * rather than re-rendering (which would disrupt transitions).
   */
  setDocked(bDocked: boolean): this {
    const wasDocked = this.getDocked();
    if (wasDocked === bDocked) return this;

    if (wasDocked && !bDocked) {
      if (this._open) {
        this.close();
      }
      this._disableAutoShow();
    }

    if (!wasDocked && bDocked) {
      this._open = false;
      if (this.getAutoShow()) {
        this._enableAutoShow();
      }
    }

    this.setProperty("docked", bDocked, true);
    this._syncDockedDomState();
    this._syncStableHeight(this.getDomRef() as HTMLElement | null);
    return this;
  }

  /** Opens the keyboard (docked mode). Slides it into view. */
  show(): this {
    if (!this.getDocked()) return this;
    if (this._open) return this;
    this._open = true;
    this._suppressNativeKeyboard();
    document.addEventListener("keydown", this._boundEscapeKeydown, true);
    const dom = this.getDomRef();
    if (dom) {
      dom.classList.remove("ui5KioskKeyboard--closed");
      this._announceLiveRegion(getText("ARIA_KEYBOARD_OPENED", "Virtual keyboard opened"));
    }
    this.fireEvent("afterOpen");
    return this;
  }

  /** Closes the keyboard (docked mode). Slides it out of view. */
  close(): this {
    if (!this.getDocked()) return this;
    if (!this._open) return this;
    this._targetSession.fireChangeIfDirty();
    this._open = false;
    this._restoreNativeKeyboard();
    document.removeEventListener("keydown", this._boundEscapeKeydown, true);
    const dom = this.getDomRef();
    if (dom) {
      dom.classList.add("ui5KioskKeyboard--closed");
      this._announceLiveRegion(getText("ARIA_KEYBOARD_CLOSED", "Virtual keyboard closed"));
    }
    this.fireEvent("afterClose");
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

  /**
   * Document-level Escape handler for docked keyboards. Closes the
   * keyboard when Escape is pressed regardless of focus source.
   * Attached in `show()`, detached in `close()`.
   */
  private _onDocumentEscapeKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    if (!this.getDocked() || !this._open) return;

    const eventTarget = event.composedPath?.()[0] ?? event.target;

    const target = eventTarget instanceof HTMLElement ? eventTarget : null;
    const myDom = this.getDomRef();
    const focusDomRef = this._getTargetElement()?.getFocusDomRef();
    const inputDom = resolveInputOrTextarea(focusDomRef) ?? (focusDomRef instanceof HTMLElement ? focusDomRef : null);
    const isOnKeyboard = target ? Boolean(myDom?.contains(target)) : false;

    event.preventDefault();
    this.close();
    // Move focus to the target input (if Escape was pressed on a virtual key)
    // or keep it where it is (if already on the input)
    if (isOnKeyboard && inputDom) {
      inputDom.focus();
    }
  }

  // ──────────────────────────────────────────────
  // Private — inputIds delegation
  // ──────────────────────────────────────────────

  private _setupInputIds(): void {
    const ids = this.getInputIds();
    const nextByInputId = new Map<string, string>();
    const nextCountsByControlId = new Map<string, number>();
    const prevCountsByControlId = new Map<string, number>();
    const resolvedControlIds = new Set<string>();

    for (const controlId of this._registeredInputControlById.values()) {
      prevCountsByControlId.set(controlId, (prevCountsByControlId.get(controlId) ?? 0) + 1);
    }

    // Resolve current IDs to canonical control IDs.
    for (const inputId of ids) {
      const control = this._findControlById(inputId);
      if (!control) continue;

      const controlId = control.getId();
      nextByInputId.set(inputId, controlId);
      nextCountsByControlId.set(controlId, (nextCountsByControlId.get(controlId) ?? 0) + 1);
      resolvedControlIds.add(controlId);
    }

    // Detach controls no longer referenced or whose instance changed.
    for (const controlId of prevCountsByControlId.keys()) {
      const prev = this._delegatedInstances.get(controlId);
      if (!prev) continue;
      // Keep delegate if same controlId in next AND same Control instance
      if (nextCountsByControlId.has(controlId) && Element.getElementById(controlId) === prev) continue;
      prev.removeEventDelegate(this._inputFocusDelegation);
    }

    // Attach controls newly referenced or whose instance changed.
    for (const controlId of nextCountsByControlId.keys()) {
      const control = Element.getElementById(controlId);
      if (!(control instanceof Control)) continue;
      // Skip if same controlId in prev AND same Control instance
      if (prevCountsByControlId.has(controlId) && this._delegatedInstances.get(controlId) === control) continue;
      control.addEventDelegate(this._inputFocusDelegation);
    }

    // Rebuild instance tracking
    this._delegatedInstances = new Map();
    for (const controlId of nextCountsByControlId.keys()) {
      const control = Element.getElementById(controlId);
      if (control instanceof Control) {
        this._delegatedInstances.set(controlId, control);
      }
    }

    this._registeredInputControlById = nextByInputId;
    this._resolvedInputControlIds = resolvedControlIds;
  }

  private _teardownInputIds(): void {
    for (const instance of this._delegatedInstances.values()) {
      instance.removeEventDelegate(this._inputFocusDelegation);
    }
    this._delegatedInstances.clear();
    this._registeredInputControlById.clear();
    this._resolvedInputControlIds.clear();
  }

  private _findControlById(targetId: string): Control | null {
    // Try view-local first (standard UI5 pattern — matches controller.byId())
    for (let parent: ManagedObject | null = this.getParent(); parent; parent = parent.getParent()) {
      if (parent instanceof View) {
        const found = parent.byId(targetId);
        if (found instanceof Control) return found;
      }
    }

    // Fall back to global registry
    const global = Element.getElementById(targetId);
    if (global instanceof Control) return global;

    return null;
  }

  // ──────────────────────────────────────────────
  // Focus Management
  // ──────────────────────────────────────────────

  getFocusDomRef(): globalThis.Element | null {
    if (!this.getEnabled() || this._getResolvedLayout().length === 0) {
      return null;
    }

    return (
      (this._lastFocusedKeyId && document.getElementById(this._lastFocusedKeyId)) ||
      this.getDomRef()?.querySelector(".ui5KioskKey") ||
      null
    );
  }

  getFocusInfo(): { id: string; lastFocusedKeyId: string | null } {
    return { id: this.getId(), lastFocusedKeyId: this._lastFocusedKeyId };
  }

  applyFocusInfo(oFocusInfo: { id?: string; preventScroll?: boolean; lastFocusedKeyId?: string }): this {
    // Disabled keyboard: the renderer set all keys to tabindex="-1".
    // Do not restore focus — it would undo the renderer's decision.
    if (!this.getEnabled()) {
      return this;
    }

    if (oFocusInfo.lastFocusedKeyId) {
      const el = document.getElementById(oFocusInfo.lastFocusedKeyId);
      if (el instanceof HTMLElement) {
        el.setAttribute("tabindex", "0");
        this._focusWithOptions(el, oFocusInfo.preventScroll);
        return this;
      }
    }
    // Fallback: focus the first key (e.g. after layout switch where the
    // previously focused key no longer exists). This prevents Popover
    // auto-close when the keyboard re-renders inside one.
    const first = this.getDomRef()?.querySelector(".ui5KioskKey") as HTMLElement | null;
    if (first) {
      first.setAttribute("tabindex", "0");
      this._focusWithOptions(first, oFocusInfo.preventScroll);
    }
    return this;
  }

  private _focusWithOptions(element: HTMLElement, preventScroll?: boolean): void {
    if (preventScroll === undefined) {
      element.focus();
      return;
    }

    try {
      element.focus({ preventScroll });
    } catch {
      element.focus();
    }
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
      focusable: this.getEnabled(),
      enabled: this.getEnabled(),
    };
  }

  // ──────────────────────────────────────────────
  // Internal renderer helpers
  // ──────────────────────────────────────────────

  /**
   * Returns the internal renderer API object.
   *
   * Exposes the five private helpers the renderer and tests need, without
   * an unsafe `as unknown as` cast. TypeScript structurally checks the
   * returned object literal against {@link RendererInternalApi} — if any
   * method is renamed or its signature changes, this line produces a
   * compile error.
   *
   * The object is lazily created and cached per instance.
   *
   * @internal Used by KioskKeyboardRenderer and test helpers only.
   */
  _getRendererApi(): RendererInternalApi {
    if (!this._rendererApi) {
      this._rendererApi = {
        _isShiftActive: () => this._isShiftActive(),
        _isCapsLock: () => this._isCapsLock(),
        _getResolvedLayout: () => this._getResolvedLayout(),
        _getKeyLabel: (key) => this._getKeyLabel(key),
        _getKeyAriaLabel: (key) => this._getKeyAriaLabel(key),
      };
    }
    return this._rendererApi;
  }

  /** Returns true for one-shot Shift and Caps Lock mode. */
  private _isShiftActive(): boolean {
    return this._shiftActive || this._isCapsLock();
  }

  /** Returns true when Caps Lock mode is active. */
  private _isCapsLock(): boolean {
    return this._capsLock;
  }

  /** Resolve the effective layout used by the renderer. */
  private _getResolvedLayout(): LayoutDefinition {
    const kbType = this.getKeyboardType();
    if (kbType === KeyboardType.Numpad) return registryGetLayoutOrDefault("numpad");
    if (kbType === KeyboardType.Numeric) return registryGetLayoutOrDefault("numeric");
    return registryGetLayoutOrDefault(this.getLayout());
  }

  /**
   * Resolves and returns the associated target input control instance.
   *
   * This is a typed convenience over `getTargetInput()` when controller code
   * needs the control object rather than the association ID string.
   */
  getTargetControl<T extends Control = Control>(): T | null {
    const target = this._getTargetElement();
    return target instanceof Control ? (target as T) : null;
  }

  /** Default icons for special keys — used when the key has no explicit icon. */
  static readonly SPECIAL_KEY_ICONS: Readonly<Record<string, string>> = {
    "{backspace}": "sap-icon://arrow-left",
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

  /**
   * Accessible label for a key — always non-empty.
   * For icon-only keys (label=""), resolves to a human-readable name.
   */
  private _getKeyAriaLabel(key: KeyDefinition): string {
    const entry = KioskKeyboard._SPECIAL_KEY_I18N[key.value];
    if (entry) {
      return getText(entry[0], entry[1]);
    }

    const display = this._getKeyLabel(key);
    return display || key.value;
  }

  /** The display label for a key (may be empty for icon-only keys). */
  private _getKeyLabel(key: KeyDefinition): string {
    const shift = this._isShiftActive();
    if (shift && key.shiftLabel) return key.shiftLabel;
    const entry = KioskKeyboard._SPECIAL_KEY_I18N[key.value];
    const base = entry ? this._getKeyAriaLabel(key) : (key.label ?? key.value);
    if (!base) return "";
    return shift && !entry && key.value.length === 1 ? base.toUpperCase() : base;
  }

  // ──────────────────────────────────────────────
  // UI5 Event Delegation
  // ──────────────────────────────────────────────

  private _resolveKeyElementFromEventTarget(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof globalThis.Element)) return null;
    const keyElement = target.closest(".ui5KioskKey");
    return keyElement instanceof HTMLElement ? keyElement : null;
  }

  private _clearPressedKeyState(): HTMLElement | null {
    const pressed = this._pressedKeyEl;
    this._pressedKeyEl = null;
    if (pressed) {
      pressed.classList.remove("ui5KioskKey--pressed");
    }
    return pressed;
  }

  /**
   * Prevents focus from leaving the target input when clicking anywhere
   * on the keyboard surface — keys, rows, or gaps between keys.
   *
   * Uses UI5's EventSimulation touchstart (fires for both mouse and touch)
   * instead of raw pointerdown. preventDefault() on the underlying
   * mousedown/touchstart prevents focus transfer without suppressing the
   * click/tap chain — unlike pointerdown's preventDefault() which
   * suppresses all compatibility mouse events per the Pointer Events spec.
   */
  ontouchstart(event: Event): void {
    // Always prevent focus steal when clicking anywhere on the keyboard
    // (including gaps between keys), so the target input keeps focus.
    event.preventDefault();

    const el = this._resolveKeyElementFromEventTarget(event.target);
    if (el) {
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
    const pressed = this._clearPressedKeyState();

    if (!this.getEnabled() || !pressed) return;

    const el = this._resolveKeyElementFromEventTarget(event.target);
    if (el !== pressed) return;

    const keyValue = pressed.dataset.key;
    if (!keyValue) return;

    this._lastFocusedKeyId = pressed.id;
    this._handleKeyAction(keyValue, pressed);
  }

  ontouchcancel(): void {
    this._clearPressedKeyState();
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
      if (other === this) continue;
      if (!other._isAutoShowParticipationActive()) continue;
      if (other.getTargetInput() === inputId) return true;
    }
    return false;
  }

  /**
   * Returns true when this instance should participate in auto-show claim checks.
   *
   * Hidden/inactive controls must not block other keyboards from claiming inputs.
   */
  private _isAutoShowParticipationActive(): boolean {
    if (!this.getVisible() || !this.getEnabled()) return false;

    const dom = this.getDomRef();
    if (!(dom instanceof HTMLElement)) return false;
    if (!document.contains(dom)) return false;

    return dom.getClientRects().length > 0;
  }

  /** Returns true if this keyboard would auto-claim the given DOM element. */
  private _wouldClaimInput(target: EventTarget | null): boolean {
    return this._focusClaimService.wouldClaimInput(target);
  }

  /** Returns the UI5 control this keyboard would auto-claim, or null. */
  private _resolveClaimableControl(target: EventTarget | null): Control | null {
    return this._focusClaimService.resolveClaimableControl(target);
  }

  /**
   * Walks the UI5 parent chain of `candidate` and returns the first control
   * whose ID matches a resolved inputIds entry, or null. This handles
   * composite controls (e.g. StepInput wrapping an inner Input) where
   * `Element.closestTo()` returns the inner control but inputIds references
   * the outer wrapper.
   */
  private _resolveInputIdsAncestor(candidate: Control): Control | null {
    return this._focusClaimService.resolveInputIdsAncestor(candidate);
  }

  private _onDocumentFocusIn(event: FocusEvent): void {
    if (!this.getDocked() || !this._isAutoShowParticipationActive()) return;

    this._cancelDeferredFocusOutClose();

    if (this.getInputIds().length > 0) {
      this._setupInputIds();
    }

    const target = event.target as HTMLElement;

    // Ignore focus on the keyboard itself
    const myDom = this.getDomRef();
    if (myDom && myDom.contains(target)) return;

    // Only claim textual inputs not deferred to native or owned by another instance
    const ui5Control = this._resolveClaimableControl(target);
    if (!ui5Control) return;

    this.setTargetInput(ui5Control);

    // Auto-detect keyboard type from input metadata.
    // Skip if re-entrancy (from deferred change handler) superseded this target.
    if (this.getAutoType() && !this._keyboardTypeExplicit && this.getTargetInput() === ui5Control.getId()) {
      const detected = detectKbType(ui5Control);
      const previous = this.getKeyboardType();
      this.setProperty("keyboardType", detected);
      if (detected !== previous) {
        this.fireEvent("keyboardTypeChange", {
          keyboardType: detected,
          previousKeyboardType: previous,
          autoDetected: true,
        });
      }
    }

    this.show();
  }

  private _onDocumentFocusOut(event: FocusEvent): void {
    if (!this.getDocked() || !this._open) return;

    // Use relatedTarget to decide synchronously whether to close.
    // relatedTarget is the element that is *receiving* focus.
    const related = event.relatedTarget as HTMLElement | null;

    // Focus staying on the keyboard itself — don't close
    const myDom = this.getDomRef();
    if (myDom && related && myDom.contains(related)) return;

    // Focus moving to an input this keyboard would claim — keep open
    if (this._wouldClaimInput(related)) return;

    // relatedTarget can be null for some browser/shadow-dom transitions.
    // Defer once and re-check the settled activeElement before closing.
    if (!related) {
      this._scheduleDeferredFocusOutClose();
      return;
    }

    this.close();
  }

  private _cancelDeferredFocusOutClose(): void {
    if (this._deferredFocusOutCloseId === null) return;
    clearTimeout(this._deferredFocusOutCloseId);
    this._deferredFocusOutCloseId = null;
  }

  private _scheduleDeferredFocusOutClose(): void {
    this._cancelDeferredFocusOutClose();
    this._deferredFocusOutCloseId = setTimeout(() => {
      this._deferredFocusOutCloseId = null;

      if (!this.getDocked() || !this._open) return;

      const related = document.activeElement as HTMLElement | null;
      const myDom = this.getDomRef();
      if (myDom && related && myDom.contains(related)) return;
      if (this._wouldClaimInput(related)) return;

      this.close();
    }, 0);
  }

  // ──────────────────────────────────────────────
  // Private — Pointer & Key Actions
  // ──────────────────────────────────────────────

  private _handleKeyAction(keyValue: string, el: HTMLElement): void {
    const shift = this._isShiftActive();

    if (keyValue === "{shift}") {
      this._toggleShift();
      return;
    }

    if (keyValue === "{backspace}") {
      if (this.fireEvent("keyPress", { key: "Backspace", shiftKey: shift }, true)) {
        this._targetSession.handleBackspace();
      }
      return;
    }

    if (keyValue === "{enter}") {
      if (this.fireEvent("keyPress", { key: "Enter", shiftKey: shift }, true)) {
        this._targetSession.handleEnter();
      }
      return;
    }

    if (keyValue.startsWith("{layout:")) {
      if (this.getKeyboardType() === KeyboardType.Full) {
        const raw = keyValue.slice("{layout:".length, -1).trim();
        if (raw) {
          const name = raw === "base" ? this._baseLayout : raw;
          const previousLayout = this.getLayout();
          this.setLayout(name);
          const nextLayout = this.getLayout();
          if (nextLayout !== previousLayout) {
            this.fireEvent("layoutChange", { layout: nextLayout });
          }
        }
      }
      return;
    }

    if (keyValue.startsWith("{fkey:")) {
      const fkeyName = keyValue.slice("{fkey:".length, -1);

      // Fire keyPress first so consumers can prevent all downstream action
      // (including native F5 reload / F11 fullscreen in fKeyMode="Native").
      if (!this.fireEvent("keyPress", { key: fkeyName, shiftKey: shift }, true)) {
        return;
      }

      let nativeAllowed = true;

      if (this.getFKeyMode() === FKeyMode.Native) {
        if (KioskKeyboard._isNativeDispatchableFKey(fkeyName)) {
          nativeAllowed = this._dispatchNativeFKeydown(fkeyName, shift);
          if (nativeAllowed) {
            KioskKeyboard._executeNativeFKeyAction(fkeyName);
          }
        } else {
          nativeAllowed = false;
          if (!KioskKeyboard._WARNED_UNSUPPORTED_NATIVE_FKEYS.has(fkeyName)) {
            KioskKeyboard._WARNED_UNSUPPORTED_NATIVE_FKEYS.add(fkeyName);
            Log.warning(
              `Ignored native dispatch for unsupported fkey "${fkeyName}". ` +
                "Only standard function/navigation keys are dispatched in fKeyMode=Native.",
              undefined,
              "ui5.kiosk.KioskKeyboard",
            );
          }
        }
      }

      if (nativeAllowed) {
        this._targetSession.handleNavigationKey(fkeyName);
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
      this._targetSession.insertText(effective);
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
   * Resolve the target input association to a UI5 Element.
   * Uses Element registry (the standard UI5 association resolution pattern).
   */
  private _getTargetElement(): Element | null {
    const id = this.getTargetInput();
    if (!id) return null;
    return Element.getElementById(id) ?? null;
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

  /** Maps KeyboardEvent.key names to special-key data-key values. */
  private static readonly _KEY_TO_DATA_KEY: Record<string, string> = {
    Shift: "{shift}",
    Backspace: "{backspace}",
    Enter: "{enter}",
    Delete: "{backspace}", // virtual keyboard has no separate Delete — highlight Backspace
    F1: "{fkey:F1}",
    F2: "{fkey:F2}",
    F3: "{fkey:F3}",
    F4: "{fkey:F4}",
    F5: "{fkey:F5}",
    F6: "{fkey:F6}",
    F7: "{fkey:F7}",
    F8: "{fkey:F8}",
    F9: "{fkey:F9}",
    F10: "{fkey:F10}",
    F11: "{fkey:F11}",
    F12: "{fkey:F12}",
    ArrowLeft: "{fkey:ArrowLeft}",
    ArrowRight: "{fkey:ArrowRight}",
    ArrowUp: "{fkey:ArrowUp}",
    ArrowDown: "{fkey:ArrowDown}",
    Home: "{fkey:Home}",
    End: "{fkey:End}",
    PageUp: "{fkey:PageUp}",
    PageDown: "{fkey:PageDown}",
  };

  private _highlightKey(key: string, add: boolean): void {
    const dom = this.getDomRef();
    if (!dom) return;

    const mapped = KioskKeyboard._KEY_TO_DATA_KEY[key];
    const el =
      dom.querySelector(`[data-key="${CSS.escape(mapped ?? key)}"]`) ??
      (key.length === 1 ? dom.querySelector(`[data-key="${CSS.escape(key.toLowerCase())}"]`) : null) ??
      dom.querySelector(`[data-shift-value="${CSS.escape(key)}"]`);
    el?.classList.toggle("ui5KioskKey--highlight", add);
  }

  /** Updates the ARIA live region text for screen reader announcements. */
  private _announceLiveRegion(text: string): void {
    const liveRegion = document.getElementById(`${this.getId()}-liveState`);
    if (liveRegion) liveRegion.textContent = text;
  }

  private _removeHighlightDelegation(): void {
    if (!this._highlightTargetId) return;
    const prev = Element.getElementById(this._highlightTargetId);
    if (prev) prev.removeEventDelegate(this._keyHighlightDelegation);
    this._highlightTargetId = null;
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
    if (mode === MobileKeyboard.Custom) return false;
    if (mode === MobileKeyboard.Native) return true;
    // "Auto": kiosk keyboard on desktop, native on mobile
    return Device.system.phone || (Device.system.tablet && !Device.system.desktop);
  }

  /** Best-effort event target used for synthetic native F-key dispatch. */
  private _resolveNativeFKeyTarget(): EventTarget {
    const target = this._getTargetElement()?.getFocusDomRef();
    const textual = resolveInputOrTextarea(target);
    if (textual) return textual;
    if (target instanceof HTMLElement) return target;
    if (document.activeElement instanceof HTMLElement) return document.activeElement;
    return document;
  }

  /** Dispatches synthetic `keydown` for an F-key and returns whether it was not canceled. */
  private _dispatchNativeFKeydown(fkeyName: string, shiftKey: boolean): boolean {
    const nativeEvent = new KeyboardEvent("keydown", {
      key: fkeyName,
      code: fkeyName,
      bubbles: true,
      cancelable: true,
      shiftKey,
    });

    return this._resolveNativeFKeyTarget().dispatchEvent(nativeEvent);
  }

  private static _executeNativeFKeyAction(fkeyName: string): void {
    KioskKeyboard._NATIVE_FKEY_ACTIONS[fkeyName]?.();
  }

  private static _isNativeDispatchableFKey(fkeyName: string): boolean {
    return KioskKeyboard._NATIVE_DISPATCHABLE_FKEYS.has(fkeyName);
  }

  private _resolveInputDomById(inputId: string): HTMLInputElement | HTMLTextAreaElement | null {
    const target = Element.getElementById(inputId);
    if (!target) return null;
    return resolveInputOrTextarea(target.getFocusDomRef());
  }

  /**
   * Suppresses the native virtual keyboard by setting
   * `inputmode="none"` on the target input's DOM element.
   *
   * Suppression is tracked per target input ID and ref-counted across
   * all KioskKeyboard instances, so one instance cannot accidentally
   * restore `inputmode` while another instance still needs suppression.
   */
  private _suppressNativeKeyboard(): void {
    if (this._shouldDeferToNative()) return;

    const inputId = this.getTargetInput();
    if (!inputId) return;

    // Already suppressing this target input
    if (this._suppressedInputId === inputId) {
      this._resolveInputDomById(inputId)?.setAttribute("inputmode", "none");
      return;
    }

    // Restore previous target (if any) before claiming another one
    this._restoreNativeKeyboard();

    const dom = this._resolveInputDomById(inputId);
    if (!dom) return;

    const state = KioskKeyboard._inputModeSuppressions.get(inputId);
    if (state) {
      state.refCount += 1;
    } else {
      KioskKeyboard._inputModeSuppressions.set(inputId, {
        originalInputMode: dom.getAttribute("inputmode"),
        refCount: 1,
      });
    }

    dom.setAttribute("inputmode", "none");
    this._suppressedInputId = inputId;
  }

  /**
   * Restores the original `inputmode` on the previously suppressed
   * input element.
   */
  private _restoreNativeKeyboard(): void {
    const inputId = this._suppressedInputId;
    if (!inputId) return;

    const state = KioskKeyboard._inputModeSuppressions.get(inputId);
    if (!state) {
      this._suppressedInputId = null;
      return;
    }

    state.refCount -= 1;

    const dom = this._resolveInputDomById(inputId);

    if (state.refCount > 0) {
      // Another keyboard instance still claims this input.
      dom?.setAttribute("inputmode", "none");
      this._suppressedInputId = null;
      return;
    }

    if (dom) {
      if (state.originalInputMode !== null) {
        dom.setAttribute("inputmode", state.originalInputMode);
      } else {
        dom.removeAttribute("inputmode");
      }
    }

    KioskKeyboard._inputModeSuppressions.delete(inputId);
    this._suppressedInputId = null;
  }
}
