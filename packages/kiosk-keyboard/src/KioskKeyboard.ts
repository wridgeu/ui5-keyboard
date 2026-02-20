import Control from "sap/ui/core/Control";
import Element from "sap/ui/core/Element";
import ManagedObject from "sap/ui/base/ManagedObject";
import View from "sap/ui/core/mvc/View";
import Device from "sap/ui/Device";
import { DEFAULT_LAYOUT, SECONDARY_LAYOUTS } from "./types";
import type { LayoutDefinition, KeyDefinition } from "./types";
import Log from "sap/base/Log";
import KioskKeyboardRenderer from "./KioskKeyboardRenderer";
import { getText } from "./i18n-util";
import { KEY_ID_SUFFIX_RE, keyElementId, isInputOrTextarea } from "./dom-util";
import { KeyboardType, MobileKeyboard } from "./library"; // side-effect: ensures Lib.init() runs
import {
  registerLayout as registryRegisterLayout,
  getRegisteredLayout as registryGetLayout,
  getLayoutOrDefault as registryGetLayoutOrDefault,
  getRegisteredLayoutNames as registryGetLayoutNames,
  isBuiltInLayout as registryIsBuiltIn,
  registerLocaleLayout as registryRegisterLocale,
  getLocaleLayout as registryGetLocaleLayout,
} from "./layout-registry";
import { detectKeyboardType as detectKbType } from "./detect-keyboard-type";
import FocusClaimService from "./internal/focus-claim-service";
import TargetInputSession from "./internal/target-input-session";

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
  declare private _boundEscapeKeydown: (e: KeyboardEvent) => void;
  declare private _focusClaimService: FocusClaimService;
  declare private _targetSession: TargetInputSession;

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
       * Call {@link #resetKeyboardType} to re-enable it.
       *
       * @example <caption>XML view — fixed numpad</caption>
       * <kiosk:KioskKeyboard keyboardType="Numpad" targetInput="pinInput" />
       */
      keyboardType: {
        type: "ui5.kiosk.KeyboardType",
        defaultValue: "Full",
        group: "Appearance",
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
       * and slides in/out. Use {@link #show}/{@link #close} to control
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
       * keyboard type. Call {@link #resetKeyboardType} to clear the lock
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
        group: "Data",
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
       * keyboard.attachKeyPress((event) => {
       *   if (event.getParameter("key") === "Enter") {
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
          keyboardType: { type: "string" },
          /** The previous keyboard type. */
          previousKeyboardType: { type: "string" },
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

  // ──────────────────────────────────────────────
  // Static delegates — layout registry (see layout-registry.ts)
  // ──────────────────────────────────────────────

  /** @see {@link registerLayout} in `layout-registry.ts` */
  static registerLayout(sName: string, oDefinition: LayoutDefinition): void {
    registryRegisterLayout(sName, oDefinition);
  }

  /** @see {@link getRegisteredLayout} in `layout-registry.ts` */
  static getRegisteredLayout(sName: string): LayoutDefinition | undefined {
    return registryGetLayout(sName);
  }

  /** @see {@link getRegisteredLayoutNames} in `layout-registry.ts` */
  static getRegisteredLayoutNames(): string[] {
    return registryGetLayoutNames();
  }

  /** @see {@link isBuiltInLayout} in `layout-registry.ts` */
  static isBuiltInLayout(sName: string): boolean {
    return registryIsBuiltIn(sName);
  }

  /** @see {@link registerLocaleLayout} in `layout-registry.ts` */
  static registerLocaleLayout(sLocale: string, sLayout: string): void {
    registryRegisterLocale(sLocale, sLayout);
  }

  /** @see {@link getLocaleLayout} in `layout-registry.ts` */
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
    this._registeredInputIds = new Set();
    this._inputFocusDelegation = {
      onfocusin: () => {
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
    this._originalInputMode = null;
    this._suppressedInputEl = null;
    this._maxHeight = 0;
    this._boundEscapeKeydown = this._onDocumentEscapeKeydown.bind(this);
    this._focusClaimService = new FocusClaimService(
      () => this.getInputIds(),
      (id) => this._findControlById(id),
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

    // Opt-in stable height: maintain consistent minHeight across layout
    // switches for non-docked Full keyboards.  Prevents layout shifts in
    // Popover scenarios and works around a sap.m.Popover bug where
    // content-height changes trigger a spurious close.
    // Docked keyboards are excluded: they pin to the viewport edge so
    // minimising their footprint is more valuable than preventing shifts.
    if (dom && this.getStableHeight() && this.getKeyboardType() === KeyboardType.Full && !this.getDocked()) {
      const el = dom as HTMLElement;
      const h = el.getBoundingClientRect().height;
      if (h > (this._maxHeight || 0)) {
        this._maxHeight = h;
      }
      el.style.minHeight = `${this._maxHeight}px`;
    } else if (dom) {
      (dom as HTMLElement).style.minHeight = "";
      this._maxHeight = 0;
    }

    this._setupInputIds();
  }

  exit(): void {
    KioskKeyboard._instances.delete(this);
    this._disableAutoShow();
    this._teardownInputIds();
    this._removeHighlightDelegation();
    this._restoreNativeKeyboard();
    document.removeEventListener("keydown", this._boundEscapeKeydown, true);
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
    if (!registryGetLayout(name)) {
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
    // Fire pending change on the previous target before switching
    this._targetSession.fireChangeIfDirty();

    // Remove highlight delegation from previous target
    this._removeHighlightDelegation();

    // If the keyboard is open, restore the old target's inputmode
    // before switching so it's not left suppressed.
    if (this._open) {
      this._restoreNativeKeyboard();
    }

    this._targetSession.resetForTargetSwitch();
    this.setAssociation("targetInput", target, true);

    // Add highlight delegation to new target
    const newId = this.getTargetInput();
    if (newId) {
      const next = Element.getElementById(newId);
      if (next) {
        next.addEventDelegate(this._keyHighlightDelegation);
        this._highlightTargetId = newId;

        // Dev-time check: warn if the control won't work as a target
        const focusRef = next.getFocusDomRef?.();
        if (focusRef && !isInputOrTextarea(focusRef)) {
          Log.warning(
            `KioskKeyboard: targetInput "${newId}" does not have a textual input DOM ref — ` +
              "key taps will have no effect. Expected HTMLInputElement or HTMLTextAreaElement.",
            undefined,
            "ui5.kiosk.KioskKeyboard",
          );
        }
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
    if (!this._open) return this;
    this._fireChangeIfDirty();
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
   * keyboard when Escape is pressed regardless of whether a virtual
   * key or the target input has focus. Attached in `show()`, detached
   * in `close()`.
   */
  private _onDocumentEscapeKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    if (!this.getDocked() || !this._open) return;

    // Don't close if Escape originated outside the keyboard and its target input
    const target = event.target as HTMLElement;
    const myDom = this.getDomRef();
    const inputDom = this._getTargetElement()?.getFocusDomRef() as HTMLElement | null;
    const isOnKeyboard = myDom?.contains(target);
    const isOnInput = inputDom && (inputDom === target || inputDom.contains(target));
    if (!isOnKeyboard && !isOnInput) return;

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
    if (kbType === KeyboardType.Numpad) return registryGetLayoutOrDefault("numpad");
    if (kbType === KeyboardType.Numeric) return registryGetLayoutOrDefault("numeric");
    return registryGetLayoutOrDefault(this.getLayout());
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

    const el = (event.target as HTMLElement).closest(".ui5KioskKey") as HTMLElement | null;
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
    if (!this.getDocked() || !this.getEnabled()) return;

    const target = event.target as HTMLElement;

    // Ignore focus on the keyboard itself
    const myDom = this.getDomRef();
    if (myDom && myDom.contains(target)) return;

    // Only claim textual inputs not deferred to native or owned by another instance
    const ui5Control = this._resolveClaimableControl(target);
    if (!ui5Control) return;

    this.setTargetInput(ui5Control);

    // Auto-detect keyboard type from input metadata
    if (this.getAutoType() && !this._keyboardTypeExplicit) {
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
    if (!this.getDocked() || !this._open || !this.getEnabled()) return;

    // Use relatedTarget to decide synchronously whether to close.
    // relatedTarget is the element that is *receiving* focus.
    const related = event.relatedTarget as HTMLElement | null;

    // Focus staying on the keyboard itself — don't close
    const myDom = this.getDomRef();
    if (myDom && related && myDom.contains(related)) return;

    // Focus moving to an input this keyboard would claim — keep open
    if (this._wouldClaimInput(related)) return;

    // Focus left all inputs, moved to a claimed input, or should
    // defer to native keyboard — close.
    this.close();
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
          this.setLayout(name);
          this.fireEvent("layoutChange", { layout: name });
        }
      }
      return;
    }

    if (keyValue.startsWith("{fkey:")) {
      const fkeyName = keyValue.slice("{fkey:".length, -1);
      this.fireEvent("keyPress", { key: fkeyName, shiftKey: shift }, true);
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

  private _fireChangeIfDirty(): void {
    this._targetSession.fireChangeIfDirty();
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

  /**
   * Suppresses the native virtual keyboard by setting
   * `inputmode="none"` on the target input's DOM element.
   */
  private _suppressNativeKeyboard(): void {
    if (this._shouldDeferToNative()) return;

    const el = this._getTargetElement();
    if (!el) return;

    const dom = el.getFocusDomRef();
    if (!isInputOrTextarea(dom)) return;

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
    const dom = isInputOrTextarea(freshDom) ? freshDom : this._suppressedInputEl;

    // If the DOM node was replaced by a re-render, also clean up the stale cached ref
    if (dom !== this._suppressedInputEl) {
      if (this._originalInputMode !== null) {
        this._suppressedInputEl.setAttribute("inputmode", this._originalInputMode);
      } else {
        this._suppressedInputEl.removeAttribute("inputmode");
      }
    }

    if (this._originalInputMode !== null) {
      dom.setAttribute("inputmode", this._originalInputMode);
    } else {
      dom.removeAttribute("inputmode");
    }

    this._originalInputMode = null;
    this._suppressedInputEl = null;
  }
}
