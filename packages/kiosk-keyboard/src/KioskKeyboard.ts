import Control from "sap/ui/core/Control";
import Element from "sap/ui/core/Element";
import type ManagedObject from "sap/ui/base/ManagedObject";
import View from "sap/ui/core/mvc/View";
import ResizeHandler from "sap/ui/core/ResizeHandler";
import { SECONDARY_LAYOUTS } from "./internal/types";
import type { LayoutDefinition, KeyDefinition, CompositionMiddleware } from "./types";
import type { RendererInternalApi } from "./internal/renderer-internal-api";
import DEFAULT_LAYOUT from "./layouts/default-layout";
import Log from "sap/base/Log";
import KioskKeyboardRenderer from "./KioskKeyboardRenderer";
import { KIOSK_KEYBOARD_DOM } from "./internal/dom-contract";
import { getText } from "./internal/i18n-registry";
import { resolveWithCustomResolver, type TargetResolverFn } from "./internal/dom";
import { KeyboardType, FKeyMode, NativeDispatchableKeyNames } from "./library"; // side-effect: ensures Lib.init() runs
import {
  getRegisteredLayout as registryGetLayout,
  getLayoutOrDefault as registryGetLayoutOrDefault,
  getRegisteredLayoutNames as registryGetLayoutNames,
  isBuiltInLayout as registryIsBuiltIn,
  getLocaleLayout as registryGetLocaleLayout,
  type InstanceLayouts,
  type InstanceLocaleLayouts,
} from "./internal/layout-registry";
import {
  getMiddlewareFactory as registryGetMiddlewareFactory,
  type InstanceMiddleware,
} from "./internal/middleware-registry";
import {
  setI18nResolver as registrySetResolver,
  clearI18nResolver as registryClearResolver,
} from "./internal/i18n-registry";
import type { I18nResolver } from "./types";
import FocusClaimService from "./internal/focus-claim-service";
import { ShiftState } from "./internal/shift-state";
import TargetInputSession from "./internal/target-input-session";
import KeyGridNavigation from "./internal/key-grid-navigation";
import NativeKeyboardSuppression from "./internal/native-keyboard-suppression";
import AutoShowBehavior, { type KeyboardTypeSource } from "./internal/auto-show-behavior";

export type { KioskKeyboardDomContract } from "./internal/dom-contract";

type InputFocusDelegation = {
  onfocusin: () => void;
};

type KeyHighlightDelegation = {
  onkeydown: (event: Event) => void;
  onkeyup: (event: Event) => void;
};

/**
 * Resolves a CSS custom property holding a rem-based threshold to pixels.
 * Accepts values like "16rem" or "20rem"; falls back to `fallbackRem * remPx`
 * when the property is unset or unparseable.
 */
function resolveRemThreshold(styles: CSSStyleDeclaration, prop: string, fallbackRem: number, remPx: number): number {
  const raw = styles.getPropertyValue(prop).trim();
  if (!raw) return fallbackRem * remPx;
  const value = Number.parseFloat(raw);
  return Number.isNaN(value) ? fallbackRem * remPx : value * remPx;
}

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
 * @since 0.1.0
 */
export default class KioskKeyboard extends Control {
  /**
   * Stable DOM hook contract for tests and DOM assertions.
   *
   * Prefer these selectors and class names over hard-coded strings.
   * Styling customizations should continue to use the documented
   * `--ui5KioskKeyboard-*` CSS custom properties instead.
   */
  static readonly DOM = KIOSK_KEYBOARD_DOM;

  // The following three lines were generated and should remain as-is to make TypeScript aware of the constructor signatures
  constructor(idOrSettings?: string | $KioskKeyboardSettings);
  constructor(id?: string, settings?: $KioskKeyboardSettings);
  // oxlint-disable-next-line no-useless-constructor -- required by @ui5/ts-interface-generator overloads
  constructor(id?: string, settings?: $KioskKeyboardSettings) {
    super(id, settings);
  }

  // ── Private fields (initialized in init(), not at class level) ──
  private _shiftState!: ShiftState;
  private _keyGridNav!: KeyGridNavigation;
  private _open!: boolean;
  private _controlsFocusDelegation!: InputFocusDelegation;
  private _registeredControlById!: Map<string, string>;
  private _resolvedControlIds!: Set<string>;

  private _delegatedInstances!: Map<string, Control>;
  private _keyHighlightDelegation!: KeyHighlightDelegation;
  private _highlightTargetId!: string | null;
  private _pressedKeyEl!: HTMLElement | null;
  private _baseLayout!: string;
  private _middleware!: CompositionMiddleware | null;
  private _keyboardTypeSource!: KeyboardTypeSource;
  private _nativeKbSuppression!: NativeKeyboardSuppression;
  private _autoShowBehavior!: AutoShowBehavior;
  private _extensions!: { onAfterRendering?(): void; destroy(): void }[];
  private _boundEscapeKeydown!: (e: KeyboardEvent) => void;
  private _boundClearPressedOnBlur!: () => void;
  private _focusClaimService!: FocusClaimService;
  private _targetSession!: TargetInputSession;
  private _rendererApi!: RendererInternalApi | null;
  private _targetResolverInstance!: TargetResolverFn | null;
  /** Per-instance layout overrides, derived from the `instanceLayouts` property. */
  private _instanceLayoutsMap!: InstanceLayouts | undefined;
  /** Per-instance locale-to-layout overrides, derived from the `instanceLocaleLayouts` property. */
  private _instanceLocaleLayoutsMap!: InstanceLocaleLayouts | undefined;
  /** Per-instance middleware factory overrides, derived from the `instanceMiddleware` property. */
  private _instanceMiddlewareMap!: InstanceMiddleware | undefined;
  /** UI5 ResizeHandler registration ID for root size updates. */
  private _responsiveResizeHandlerId!: string | null;
  /** Root DOM element currently observed by the resize handler. */
  private _responsiveObservedDom!: HTMLElement | null;
  /** rAF handle used to coalesce responsive class updates from multiple observers. */
  private _responsiveSyncFrameId!: number | null;
  static readonly metadata = {
    library: "ui5.kiosk",
    properties: {
      /**
       * Active layout name. Only effective when keyboardType is "Full".
       * Auto-detected from the UI5 locale when omitted.
       *
       * @example <caption>XML view</caption>
       * <kiosk:KioskKeyboard layout="qwertz-de" controls="myInput" />
       *
       * @example <caption>TypeScript - custom layout</caption>
       * new KioskKeyboard({ layout: "azerty-fr", instanceLayouts: { "azerty-fr": frenchLayout } });
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
       * @example <caption>XML view - fixed numpad</caption>
       * <kiosk:KioskKeyboard keyboardType="Numpad" controls="pinInput" />
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
       * @example <caption>XML view - bind to model</caption>
       * <kiosk:KioskKeyboard enabled="{/keyboardEnabled}" controls="myInput" />
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
       * <kiosk:KioskKeyboard ariaLabel="PIN entry keyboard" controls="pinInput" />
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
       * @example <caption>XML view - docked with programmatic control</caption>
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
       * @example <caption>XML view - full auto kiosk setup</caption>
       * <kiosk:KioskKeyboard docked="true" autoShow="true" autoType="true" />
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
       * - `"Auto"` (default) - uses KioskKeyboard on desktop browsers,
       *   defers to the native keyboard on phones and tablets. On a
       *   regular laptop/desktop with a physical keyboard the virtual
       *   keyboard **will** still appear - use `"Native"` if that
       *   is not desired.
       * - `"Custom"` - always uses the KioskKeyboard and suppresses
       *   the native keyboard via `inputmode="none"`. Best for
       *   **dedicated kiosk terminals** without a physical keyboard.
       * - `"Native"` - always defers to the native keyboard; the
       *   KioskKeyboard will not open on focus.
       *
       * @example <caption>XML view - kiosk terminal setup</caption>
       * <kiosk:KioskKeyboard docked="true" autoShow="true" mobileKeyboard="Custom" />
       *
       * @example <caption>XML view - always defer to native keyboard</caption>
       * <kiosk:KioskKeyboard docked="true" autoShow="true" mobileKeyboard="Native" />
       */
      mobileKeyboard: {
        type: "ui5.kiosk.MobileKeyboard",
        defaultValue: "Auto",
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
       * - `"None"`: fire `keyPress` only, skip native dispatch and
       *   built-in navigation actions entirely.
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
       * @example <caption>XML view - target multiple inputs</caption>
       * <m:Input id="name" />
       * <m:Input id="email" />
       * <kiosk:KioskKeyboard controls="name,email" />
       *
       * @example <caption>TypeScript</caption>
       * new KioskKeyboard({ controls: ["name", "email"] });
       */
      controls: {
        type: "string[]",
        defaultValue: [],
        group: "Behavior",
      },
      /**
       * Per-instance layout overrides. Resolution order is
       * **instance map -> built-in**, so an entry here shadows the
       * built-in of the same name for this control only. Use this to
       * supply a custom layout, or to override a built-in (e.g. swap
       * the German layout) without affecting other controls. Accepts
       * a plain `Record<string, LayoutDefinition>`; the control stores
       * it as a `Map` internally.
       *
       * @since 0.1.0
       */
      instanceLayouts: {
        type: "object",
        defaultValue: null,
        group: "Behavior",
      },
      /**
       * Per-instance locale-to-layout overrides. Resolution order is
       * **instance map -> built-in locale map -> default layout**.
       * Keys are BCP-47 prefixes (e.g. `"de"`, `"de-at"`); values are
       * layout names. Accepts a plain `Record<string, string>`; the
       * control stores it as a `Map` internally.
       *
       * @since 0.1.0
       */
      instanceLocaleLayouts: {
        type: "object",
        defaultValue: null,
        group: "Behavior",
      },
      /**
       * Per-instance composition middleware overrides, keyed by layout
       * name. Resolution order is **instance map -> built-in**. Use
       * this to attach a layout-specific middleware factory for a
       * custom layout, or to swap the built-in middleware for one
       * control only. Accepts a plain
       * `Record<string, () => CompositionMiddleware>`; the control
       * stores it as a `Map` internally.
       *
       * @since 0.1.0
       */
      instanceMiddleware: {
        type: "object",
        defaultValue: null,
        group: "Behavior",
      },
    },
    associations: {
      _activeTarget: { type: "sap.ui.core.Control", multiple: false },
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
       * @example <caption>TypeScript - intercept key presses</caption>
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
          /** The key value that was pressed (character, or a {@link KeyName} constant for non-character keys). */
          key: { type: "string" },
          /** Whether the Shift modifier was active when the key was pressed. */
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
          /** The name of the newly active layout. */
          layout: { type: "string" },
        },
      },
      /**
       * Fired when the keyboard type changes - by auto-type detection,
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
      /**
       * Fired when the active target control changes (focus switches to a
       * different input in auto-show mode, or programmatically).
       */
      activeControlChange: {
        parameters: {
          /** The control ID of the new active target, or empty string if cleared. */
          controlId: { type: "string" },
        },
      },
      /** Fired when `show()` opens the docked keyboard (not tied to CSS transition end). */
      afterOpen: {},
      /** Fired when `close()` closes the docked keyboard (not tied to CSS transition end). */
      afterClose: {},
    },
  };

  static readonly renderer = KioskKeyboardRenderer;

  /** All living KioskKeyboard instances - used by auto-show to skip inputs already targeted by another keyboard. */
  private static readonly _instances = new Set<KioskKeyboard>();

  /** Native actions executed in `fKeyMode="Native"` when not prevented. */
  private static readonly _NATIVE_FKEY_ACTIONS: Record<string, (() => void) | undefined> = {
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

  /** Global target resolver applied to all instances (lowest priority). */
  private static _globalTargetResolver: TargetResolverFn | null = null;

  // ──────────────────────────────────────────────
  // Static delegates - target resolver
  // ──────────────────────────────────────────────

  /**
   * Sets a global custom resolver used by **all** KioskKeyboard instances
   * to locate the native `<input>` or `<textarea>` inside a host element.
   *
   * An instance-level resolver (set via `setTargetResolver()`) takes
   * precedence over the global resolver. Pass `null` to clear.
   *
   * The callback receives the focus DOM ref (`HTMLElement`) and must return
   * the native input/textarea to type into, or `null` to fall back to
   * the built-in resolver.
   *
   * @param fnResolver Custom resolver function, or `null` to clear.
   * @public
   * @static
   * @since 0.1.0
   */
  static setGlobalTargetResolver(fnResolver: TargetResolverFn | null): void {
    KioskKeyboard._globalTargetResolver = fnResolver;
    // Propagate to existing instances that don't have an instance-level override
    for (const instance of KioskKeyboard._instances) {
      if (!instance._targetResolverInstance) {
        instance._targetSession.setTargetResolver(instance._getEffectiveResolver());
      }
    }
  }

  /**
   * Returns the currently set global target resolver, or `null`.
   * @public
   * @static
   * @since 0.1.0
   */
  static getGlobalTargetResolver(): TargetResolverFn | null {
    return KioskKeyboard._globalTargetResolver;
  }

  // ──────────────────────────────────────────────
  // Static delegates - layout registry (read-only views)
  //
  // Customization is per-instance: pass `instanceLayouts`,
  // `instanceLocaleLayouts`, and `instanceMiddleware` to the constructor
  // (or via the corresponding setters). There is no public mutation API
  // for the global registry -- built-ins ship sealed.
  // ──────────────────────────────────────────────

  /**
   * Get a built-in layout definition by name. Returns `undefined` for
   * names that are not built-in. Instance-only layouts are intentionally
   * not visible through this static getter.
   *
   * @param sName Layout identifier.
   * @public
   * @static
   * @since 0.1.0
   */
  static getRegisteredLayout(sName: string): LayoutDefinition | undefined {
    return registryGetLayout(sName);
  }

  /**
   * Get the names of all built-in layouts.
   *
   * @public
   * @static
   * @since 0.1.0
   */
  static getRegisteredLayoutNames(): string[] {
    return registryGetLayoutNames();
  }

  /**
   * Check whether a layout name belongs to a built-in layout.
   *
   * @param sName Layout identifier.
   * @public
   * @static
   * @since 0.1.0
   */
  static isBuiltInLayout(sName: string): boolean {
    return registryIsBuiltIn(sName);
  }

  /**
   * Check whether a layout is a secondary (non-alphabetic) layout.
   *
   * Secondary layouts (`numeric`, `special`, `fkeys`, `nav`) serve as
   * auxiliary views switched to via `{layout:name}` keys. They cannot
   * become the base layout - the keyboard tracks the last non-secondary
   * layout as the base and returns to it when `{layout:base}` is pressed.
   *
   * @param sName Layout identifier.
   * @public
   * @static
   * @since 0.1.0
   */
  static isSecondaryLayout(sName: string): boolean {
    return SECONDARY_LAYOUTS.has(sName);
  }

  /**
   * Resolve the built-in layout name appropriate for the current UI5
   * locale. Per-app overrides should be supplied via the
   * `instanceLocaleLayouts` setting on the control instance.
   *
   * @public
   * @static
   * @since 0.1.0
   */
  static getLocaleLayout(): string {
    return registryGetLocaleLayout();
  }

  // --
  // Static delegates - i18n (see internal/i18n-registry.ts)
  // --

  /**
   * Set a custom i18n resolver callback for programmatic overrides.
   *
   * The resolver runs after the base library bundle has been consulted.
   * Return a string to replace the resolved text, or `undefined` to keep it.
   *
   * Only one resolver is active at a time. Calling again replaces the
   * previous resolver. Pass `null` to clear the resolver.
   *
   * **Lifecycle note:** The resolver is stored in a module-level singleton.
   * If the resolver closes over Component, Controller, or View references,
   * those objects cannot be garbage-collected until the resolver is cleared.
   * The resolver is auto-cleared when the last KioskKeyboard instance is
   * destroyed.
   *
   * @param fn  The resolver function, or `null` to clear.
   * @public
   * @static
   * @since 0.1.0
   */
  static setI18nResolver(fn: I18nResolver | null): void {
    registrySetResolver(fn);
    KioskKeyboard._invalidateAllInstances();
  }

  /** Invalidate all living KioskKeyboard instances to pick up i18n changes. */
  private static _invalidateAllInstances(): void {
    for (const instance of KioskKeyboard._instances) {
      instance.invalidate();
    }
  }

  /**
   * Pre-populates the internal `Map` caches for `instanceLayouts`,
   * `instanceLocaleLayouts`, and `instanceMiddleware`, then injects the
   * locale-detected layout (resolved through any instance locale map)
   * when no explicit `layout` is provided.
   *
   * The pre-population happens before `super.applySettings`, so that
   * `setLayout`'s validation honors instance overrides regardless of
   * the order in which the framework iterates the settings.
   *
   * Note: When no settings are provided at all (e.g. `new KioskKeyboard()`),
   * ManagedObject does not call `applySettings`. The locale default is
   * therefore also set in `init()`.
   */
  applySettings(mSettings: Record<string, unknown>, oScope?: object): this {
    // Pre-populate the internal Map caches before super.applySettings
    // runs so layout validation in setLayout() can honor instance
    // overrides regardless of property iteration order.
    this._instanceLayoutsMap = KioskKeyboard._toLayoutMap(mSettings?.instanceLayouts);
    this._instanceLocaleLayoutsMap = KioskKeyboard._toStringMap(mSettings?.instanceLocaleLayouts);
    this._instanceMiddlewareMap = KioskKeyboard._toMiddlewareMap(mSettings?.instanceMiddleware);
    // Spread before super so callers' settings object is never mutated;
    // any explicit `layout` in `mSettings` overrides the locale default.
    const merged: Record<string, unknown> = {
      layout: registryGetLocaleLayout(this._instanceLocaleLayoutsMap, this._instanceLayoutsMap),
      ...mSettings,
    };
    return super.applySettings(merged, oScope);
  }

  init(): void {
    KioskKeyboard._instances.add(this);
    this._shiftState = new ShiftState();
    this._keyGridNav = new KeyGridNavigation(this.getId(), KIOSK_KEYBOARD_DOM);
    // @ts-expect-error addDelegate is an internal UI5 API not exposed in @openui5/types
    this.addDelegate(this._keyGridNav, true);
    this._open = false;
    this._registeredControlById = new Map();
    this._resolvedControlIds = new Set();
    this._delegatedInstances = new Map();
    this._controlsFocusDelegation = {
      onfocusin: () => {
        if (!this.getEnabled()) return;
        const active = Element.getActiveElement();
        if (!(active instanceof Control)) return;
        // For composite controls (e.g. StepInput), the active element is the
        // inner Input, but controls references the outer wrapper. Resolve the
        // registered ancestor so _setActiveTarget gets the right control.
        const ancestor = this._resolveControlsAncestor(active);
        this._setActiveTarget(ancestor ?? active);
        // When docked with autoShow, show the keyboard for controls targets
        if (this.getDocked() && this.getAutoShow() && !this._open) {
          this.show();
        }
      },
    };
    this._keyHighlightDelegation = {
      onkeydown: (event: Event) => this._onPhysicalKey(event as KeyboardEvent, true),
      onkeyup: (event: Event) => this._onPhysicalKey(event as KeyboardEvent, false),
    };
    this._highlightTargetId = null;
    this._pressedKeyEl = null;
    this._keyboardTypeSource = "unset";
    this._nativeKbSuppression = new NativeKeyboardSuppression(this);
    this._autoShowBehavior = new AutoShowBehavior(this);
    this._extensions = [this._nativeKbSuppression, this._autoShowBehavior];
    this._boundEscapeKeydown = this._onDocumentEscapeKeydown.bind(this);
    this._boundClearPressedOnBlur = (): void => {
      this._clearPressedKeyState();
    };
    this._focusClaimService = new FocusClaimService(
      () => this.getControls(),
      () => this._resolvedControlIds,
      () => this._nativeKbSuppression.shouldDeferToNative(),
      (id) => this._isTargetOfOther(id),
    );
    this._targetResolverInstance = null;
    this._instanceLayoutsMap = undefined;
    this._instanceLocaleLayoutsMap = undefined;
    this._instanceMiddlewareMap = undefined;
    this._targetSession = new TargetInputSession(() => this._getTargetElement());
    this._middleware = null;
    this._rendererApi = null;
    this._responsiveResizeHandlerId = null;
    this._responsiveObservedDom = null;
    this._responsiveSyncFrameId = null;

    // Detect locale-appropriate default layout. This covers the case
    // where no settings are passed (applySettings is not called by
    // ManagedObject when settings are undefined).
    const localeLayout = registryGetLocaleLayout();
    this._baseLayout = localeLayout;
    if (localeLayout !== DEFAULT_LAYOUT) {
      this.setLayout(localeLayout);
    }
  }

  onLocalizationChanged(): void {
    this.invalidate();
  }

  onAfterRendering(): void {
    this._keyGridNav.setRootRef(this.getDomRef() as HTMLElement | null);
    this._syncDockedDomState();

    for (const ext of this._extensions) ext.onAfterRendering?.();

    // Sync the ResizeHandler registration with the current DOM element,
    // then defer responsive class reapplication to the next animation frame.
    // Re-renders wipe root classes, but deferring avoids forced reflow
    // (getComputedStyle + scrollHeight) in the render frame. The 1-frame
    // delay for responsive sizing is imperceptible; the ResizeHandler
    // already uses rAF for resize-triggered updates.
    const dom = this.getDomRef() as HTMLElement | null;
    if (dom) {
      this._syncResponsiveSizing(dom);
      this._scheduleResponsiveSizingSync();
    }

    this._setupControls();
  }

  /** Ensures a ResizeHandler is attached to the current DOM element. */
  private _syncResponsiveSizing(dom: HTMLElement | null): void {
    if (!dom) {
      this._teardownResponsiveSizing();
      return;
    }

    if (this._responsiveObservedDom !== dom) {
      this._teardownResponsiveSizing();
      this._responsiveObservedDom = dom;
      this._responsiveResizeHandlerId = ResizeHandler.register(dom, () => {
        this._scheduleResponsiveSizingSync();
      });
    }
  }

  /** Deregisters the UI5 ResizeHandler and clears the observed DOM reference. */
  private _teardownResponsiveSizing(): void {
    if (this._responsiveSyncFrameId !== null) {
      cancelAnimationFrame(this._responsiveSyncFrameId);
      this._responsiveSyncFrameId = null;
    }
    if (this._responsiveResizeHandlerId) {
      ResizeHandler.deregister(this._responsiveResizeHandlerId);
      this._responsiveResizeHandlerId = null;
    }
    this._responsiveObservedDom = null;
  }

  /** Coalesces responsive class updates triggered by root/content resize observers. */
  private _scheduleResponsiveSizingSync(): void {
    if (this._responsiveSyncFrameId !== null) return;

    this._responsiveSyncFrameId = requestAnimationFrame(() => {
      this._responsiveSyncFrameId = null;
      const dom = this.getDomRef() as HTMLElement | null;
      if (dom) {
        this._applyResponsiveSizeClasses(dom);
      }
    });
  }

  /**
   * Applies height-responsive classes to the keyboard root element.
   *
   * Toggles `cqShort` / `cqTiny` classes when the keyboard is externally
   * constrained (host height < natural content height). Skipped for docked and numpad.
   * The +1px tolerance on the constrained check avoids oscillation from sub-pixel rounding.
   *
   * Width breakpoints are handled purely by CSS `@container` queries (see
   * KioskKeyboard.container-queries.css), so no JS width measurement is needed.
   */
  private _applyResponsiveSizeClasses(dom: HTMLElement): void {
    const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
    const cs = window.getComputedStyle(dom);

    // Height classes -- detect external height constraints by comparing the
    // keyboard's natural (unconstrained) content height against its rendered
    // height. Skip for docked keyboards (viewport-driven) and numpad.
    dom.classList.remove(KIOSK_KEYBOARD_DOM.classes.rootCqShort, KIOSK_KEYBOARD_DOM.classes.rootCqTiny);

    const docked = this.getDocked();
    const isNumpad = this.getKeyboardType() === KeyboardType.Numpad;
    if (docked || isNumpad) {
      return;
    }

    // scrollHeight reports the full content height even under overflow: hidden.
    // If the element ever uses overflow: clip, scrollHeight may equal
    // clientHeight in some browsers, breaking constrained detection.
    const naturalHeight = dom.scrollHeight;
    const renderedHeight = dom.getBoundingClientRect().height;

    // Only apply when externally constrained (natural content > rendered).
    // The +1px tolerance avoids oscillation from sub-pixel rounding.
    if (naturalHeight <= renderedHeight + 1) {
      return;
    }

    const shortThresh = resolveRemThreshold(cs, "--ui5KioskKeyboard-cqShortThreshold", 16, remPx);
    const tinyThresh = resolveRemThreshold(cs, "--ui5KioskKeyboard-cqTinyThreshold", 12, remPx);
    const isShort = renderedHeight <= shortThresh;
    const isTiny = renderedHeight <= tinyThresh;
    dom.classList.toggle(KIOSK_KEYBOARD_DOM.classes.rootCqShort, isShort && !isTiny);
    dom.classList.toggle(KIOSK_KEYBOARD_DOM.classes.rootCqTiny, isTiny);
  }

  /** Keeps docked/closed root classes in sync without forcing a re-render. */
  private _syncDockedDomState(): void {
    const dom = this.getDomRef();
    if (!dom) return;

    const docked = this.getDocked();
    dom.classList.toggle(KIOSK_KEYBOARD_DOM.classes.rootDocked, docked);
    dom.classList.toggle(KIOSK_KEYBOARD_DOM.classes.rootClosed, docked && !this._open);
  }

  exit(): void {
    if (this._middleware) {
      this._middleware.reset();
      this._middleware = null;
    }
    KioskKeyboard._instances.delete(this);

    if (KioskKeyboard._instances.size === 0) {
      registryClearResolver();
      KioskKeyboard._WARNED_UNSUPPORTED_NATIVE_FKEYS.clear();
      KioskKeyboard._globalTargetResolver = null;
    }

    this._teardownControls();
    this._removeHighlightDelegation();
    this._teardownResponsiveSizing();
    this._clearPressedKeyState();
    for (const ext of this._extensions) ext.destroy();
    document.removeEventListener("keydown", this._boundEscapeKeydown, true);
    // @ts-expect-error removeDelegate is an internal UI5 API not exposed in @openui5/types
    this.removeDelegate(this._keyGridNav);
    this._keyGridNav.destroy();
  }

  // ──────────────────────────────────────────────
  // Public API - Property overrides
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
  setEnabled(isEnabled: boolean): this {
    if (!isEnabled) {
      this._redirectFocusToTargetIfOwned();
    }
    // The renderer handles the disabled CSS class (ui5KioskKeyboard--disabled)
    // and per-key aria-disabled attributes at render time. Uses setProperty
    // directly because Control has no base setEnabled implementation to delegate to.
    return this.setProperty("enabled", isEnabled) as this;
  }

  /**
   * Override `setVisible` to proactively redirect focus to the target input
   * before hiding. Without this, the framework's generic onfocusfail
   * fallback would move focus to an arbitrary sibling.
   *
   * Note: `setVisible(true)` does not re-open a previously closed docked
   * keyboard - call `show()` explicitly after making it visible again.
   */
  setVisible(isVisible: boolean): this {
    if (!isVisible) {
      this._redirectFocusToTargetIfOwned();
      // Close the docked keyboard - a hidden keyboard should not retain
      // open state (escape listener, native keyboard suppression).
      if (this.getDocked() && this._open) {
        this.close();
      }
    }
    return super.setVisible(isVisible);
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
  // Public API - Target & Docked Mode
  // ──────────────────────────────────────────────

  /**
   * Custom setter for layout - tracks the base (alphabetic) layout so
   * that `{layout:base}` in numeric/special layouts can return to it.
   */
  setLayout(sLayout: string): this {
    const name = sLayout.toLowerCase();
    if (!registryGetLayout(name, this._instanceLayoutsMap)) {
      Log.warning(
        `Layout "${name}" is not registered. Pass it through the instanceLayouts setting before setLayout().`,
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
   * Custom setter for `instanceLayouts` - keeps the internal `Map`
   * cache in sync with the property value so callers do not pay the
   * `Object.entries` cost on every render.
   */
  setInstanceLayouts(value: Record<string, LayoutDefinition> | null): this {
    this._instanceLayoutsMap = KioskKeyboard._toLayoutMap(value);
    return this.setProperty("instanceLayouts", value) as this;
  }

  /**
   * Custom setter for `instanceLocaleLayouts` - keeps the internal
   * `Map` cache in sync with the property value.
   */
  setInstanceLocaleLayouts(value: Record<string, string> | null): this {
    this._instanceLocaleLayoutsMap = KioskKeyboard._toStringMap(value);
    return this.setProperty("instanceLocaleLayouts", value) as this;
  }

  /**
   * Custom setter for `instanceMiddleware` - keeps the internal `Map`
   * cache in sync with the property value.
   */
  setInstanceMiddleware(value: Record<string, () => CompositionMiddleware> | null): this {
    this._instanceMiddlewareMap = KioskKeyboard._toMiddlewareMap(value);
    return this.setProperty("instanceMiddleware", value) as this;
  }

  private static _toLayoutMap(value: unknown): InstanceLayouts | undefined {
    if (!value || typeof value !== "object") return undefined;
    const entries: [string, LayoutDefinition][] = [];
    for (const [name, def] of Object.entries(value as Record<string, unknown>)) {
      if (KioskKeyboard._isValidLayoutDefinition(def)) {
        entries.push([name, def]);
      } else {
        Log.warning(
          `Invalid instanceLayouts entry "${name}": must be a non-empty array of non-empty rows where each key has a string "value".`,
          undefined,
          "ui5.kiosk.KioskKeyboard",
        );
      }
    }
    return entries.length === 0 ? undefined : new Map(entries);
  }

  private static _isValidLayoutDefinition(def: unknown): def is LayoutDefinition {
    return (
      Array.isArray(def) &&
      def.length > 0 &&
      def.every(
        (row) =>
          Array.isArray(row) && row.length > 0 && row.every((key) => typeof key?.value === "string" && key.value),
      )
    );
  }

  private static _toStringMap(value: unknown): InstanceLocaleLayouts | undefined {
    if (!value || typeof value !== "object") return undefined;
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => typeof v === "string") as [
      string,
      string,
    ][];
    return entries.length === 0 ? undefined : new Map(entries);
  }

  private static _toMiddlewareMap(value: unknown): InstanceMiddleware | undefined {
    if (!value || typeof value !== "object") return undefined;
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => typeof v === "function") as [
      string,
      () => CompositionMiddleware,
    ][];
    return entries.length === 0 ? undefined : new Map(entries);
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
   * Sets the active target association without triggering a re-render,
   * since the association does not affect the keyboard's visual output.
   * Also moves the physical keyboard highlight delegation to the new target.
   */
  _setActiveTarget(target?: string | Control): this {
    const previousTarget = this._getActiveTargetId();

    // Capture pending change on the old target. The event is deferred to
    // after all state transitions so that re-entrant calls (from a change
    // handler that synchronously focuses another input) see settled state.
    const fireDeferredChange = this._targetSession.captureAndClearDirty();

    // Remove highlight delegation from previous target
    this._removeHighlightDelegation();

    // If the keyboard is open, restore the old target's inputmode
    // before switching so it's not left suppressed.
    if (this._open) {
      this._nativeKbSuppression.restore();
    }

    this._targetSession.resetForTargetSwitch();

    // Reset shift/caps state for the new input context
    if (this._shiftState.isShifted) {
      this._shiftState.reset();
      this.invalidate();
    }

    this.setAssociation("_activeTarget", target ?? "", true);

    const newId = this._getActiveTargetId();
    if (newId && this._isTargetOfOther(newId)) {
      Log.warning(
        `KioskKeyboard: active target "${newId}" is already targeted by another KioskKeyboard instance`,
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
        if (focusRef && !resolveWithCustomResolver(focusRef, this._getEffectiveResolver())) {
          Log.warning(
            `KioskKeyboard: active target "${newId}" does not have a textual input DOM ref - ` +
              "key taps will have no effect. Expected (or containing) HTMLInputElement/HTMLTextAreaElement.",
            undefined,
            "ui5.kiosk.KioskKeyboard",
          );
        }
      } else {
        Log.warning(
          `KioskKeyboard: active target "${newId}" could not be resolved - Element.getElementById() returned null`,
          undefined,
          "ui5.kiosk.KioskKeyboard",
        );
      }
    }

    // Keep aria-controls in sync (setAssociation suppresses re-render)
    const dom = this.getDomRef();
    if (dom) {
      const resolvedId = this._getActiveTargetId();
      if (resolvedId) {
        dom.setAttribute("aria-controls", resolvedId);
      } else {
        dom.removeAttribute("aria-controls");
      }
    }

    // If the keyboard is open, suppress the new target's native keyboard.
    if (this._open) {
      this._nativeKbSuppression.suppress();
    }

    // Fire the deferred change event on the OLD target. State is now
    // settled, so if the handler re-enters _setActiveTarget (e.g. by
    // focusing another input), the inner call sees consistent state
    // and its result becomes the final state.
    fireDeferredChange?.();

    const newTarget = this._getActiveTargetId();
    if (newTarget !== previousTarget) {
      this.fireActiveControlChange({ controlId: newTarget });
    }

    return this;
  }

  /**
   * Returns the ID of the currently active target, or empty string.
   */
  _getActiveTargetId(): string {
    // `_activeTarget` is single-cardinality, so getAssociation returns string | null.
    // The UI5 type stub widens this to string | string[]; narrow defensively.
    const value = this.getAssociation("_activeTarget", null);
    return typeof value === "string" ? value : "";
  }

  _getKeyboardTypeSource(): KeyboardTypeSource {
    return this._keyboardTypeSource;
  }

  _setKeyboardTypeSource(source: KeyboardTypeSource): void {
    this._keyboardTypeSource = source;
  }

  /**
   * Custom setter for controls.
   *
   * Reconciles focus delegates against currently resolved control instances
   * without forcing a re-render, because controls does not affect renderer
   * output directly.
   */
  setControls(controls: string[]): this {
    this.setProperty("controls", controls, true);
    this._setupControls();
    return this;
  }

  /**
   * Custom setter for autoShow - activates or deactivates the
   * auto-show document listeners on the AutoShowBehavior delegate.
   */
  setAutoShow(isAutoShow: boolean): this {
    this.setProperty("autoShow", isAutoShow, true);
    if (isAutoShow) {
      this._autoShowBehavior.enable();
    } else {
      this._autoShowBehavior.disable();
    }
    return this;
  }

  /**
   * Custom setter for keyboardType - marks the type as explicitly set,
   * which disables auto-type detection. Use {@link #resetKeyboardType}
   * to re-enable auto-type.
   */
  setKeyboardType(type: KeyboardType): this {
    const previous = this.getKeyboardType();
    this._keyboardTypeSource = "explicit";
    this.setProperty("keyboardType", type);
    if (type !== previous) {
      this.fireKeyboardTypeChange({
        keyboardType: type,
        previousKeyboardType: previous,
        autoDetected: false,
      });
    }
    return this;
  }

  /**
   * Clears the explicit keyboardType lock and resets to "Full".
   *
   * Once {@link #setKeyboardType} has been called - directly, via the
   * constructor, or via an XML attribute - the `autoType` feature is
   * permanently disabled. Call this method to re-enable auto-type
   * detection so the keyboard can switch between Full and Numpad
   * based on the focused input's metadata again.
   *
   * @public
   * @since 0.1.0
   */
  resetKeyboardType(): this {
    const sPrevious = this.getKeyboardType();
    this._keyboardTypeSource = "unset";
    this.setProperty("keyboardType", KeyboardType.Full);
    if (KeyboardType.Full !== sPrevious) {
      this.fireKeyboardTypeChange({
        keyboardType: KeyboardType.Full,
        previousKeyboardType: sPrevious,
        autoDetected: false,
      });
    }
    return this;
  }

  /**
   * Recomputes responsive height classes from the current live DOM.
   *
   * Call this after runtime CSS changes that affect intrinsic keyboard height
   * without triggering a ResizeHandler callback, such as fixed-height styling
   * combined with updated `--ui5KioskKeyboard-*` sizing variables.
   *
   * The class update is deferred to the next animation frame to avoid
   * forced reflow. Query the DOM for responsive classes after a
   * `requestAnimationFrame` callback, not synchronously.
   *
   * @public
   * @since 0.1.0
   */
  refreshResponsiveState(): this {
    const dom = this.getDomRef() as HTMLElement | null;
    if (!dom) return this;

    this._syncResponsiveSizing(dom);
    this._scheduleResponsiveSizingSync();
    return this;
  }

  /**
   * Whether keyboardType has been explicitly set and auto-type is locked.
   */
  isKeyboardTypeExplicit(): boolean {
    return this._keyboardTypeSource === "explicit";
  }

  /**
   * Sets a custom resolver for this keyboard instance that locates the
   * native `<input>` or `<textarea>` inside a host element.
   *
   * Takes precedence over the global resolver set via
   * `KioskKeyboard.setGlobalTargetResolver()`. Pass `null` to clear
   * and fall back to the global resolver (if any) or the built-in one.
   *
   * The callback receives the focus DOM ref (`HTMLElement`) and must
   * return the native input/textarea to type into, or `null` to fall
   * back to the next resolver in the chain.
   *
   * @param fnResolver Custom resolver function, or `null` to clear.
   * @public
   * @since 0.1.0
   */
  setTargetResolver(fnResolver: TargetResolverFn | null): this {
    this._targetResolverInstance = fnResolver;
    this._targetSession.setTargetResolver(this._getEffectiveResolver());
    return this;
  }

  /**
   * Returns the instance-level target resolver, or `null`.
   * @public
   * @since 0.1.0
   */
  getTargetResolver(): TargetResolverFn | null {
    return this._targetResolverInstance;
  }

  /**
   * Returns the effective resolver: instance-level first, then global, then `null`.
   * @private
   */
  _getEffectiveResolver(): TargetResolverFn | null {
    return this._targetResolverInstance ?? KioskKeyboard._globalTargetResolver;
  }

  /**
   * Custom setter for docked - manages CSS on the existing DOM
   * rather than re-rendering (which would disrupt transitions).
   */
  setDocked(isDocked: boolean): this {
    const wasDocked = this.getDocked();
    if (wasDocked === isDocked) return this;

    if (wasDocked && !isDocked) {
      if (this._open) {
        this.close();
      }
      this._autoShowBehavior.disable();
    }

    if (!wasDocked && isDocked) {
      this._open = false;
      if (this.getAutoShow()) {
        this._autoShowBehavior.enable();
      }
    }

    this.setProperty("docked", isDocked, true);
    const dom = this.getDomRef() as HTMLElement | null;
    this._syncDockedDomState();
    if (dom) {
      this._syncResponsiveSizing(dom);
    }
    return this;
  }

  /** Opens the keyboard (docked mode). Slides it into view. */
  show(): this {
    if (!this.getDocked()) return this;
    if (this._open) return this;
    if (this._nativeKbSuppression.shouldDeferToNative()) return this;

    this._open = true;
    this._nativeKbSuppression.suppress();
    document.addEventListener("keydown", this._boundEscapeKeydown, true);
    const dom = this.getDomRef();
    if (dom) {
      dom.classList.remove(KIOSK_KEYBOARD_DOM.classes.rootClosed);
      this._announceLiveRegion(getText("ARIA_KEYBOARD_OPENED", "Virtual keyboard opened"));
    }
    this.fireAfterOpen();
    return this;
  }

  /** Closes the keyboard (docked mode). Slides it out of view. */
  close(): this {
    if (!this.getDocked()) return this;
    if (!this._open) return this;
    this._targetSession.fireChangeIfDirty();
    this._open = false;
    this._nativeKbSuppression.restore();
    document.removeEventListener("keydown", this._boundEscapeKeydown, true);
    const dom = this.getDomRef();
    if (dom) {
      dom.classList.add(KIOSK_KEYBOARD_DOM.classes.rootClosed);
      this._announceLiveRegion(getText("ARIA_KEYBOARD_CLOSED", "Virtual keyboard closed"));
    }
    this.fireAfterClose();
    return this;
  }

  /** Whether the docked keyboard is currently open. */
  isOpen(): boolean {
    return this._open;
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
    const inputDom =
      resolveWithCustomResolver(focusDomRef, this._getEffectiveResolver()) ??
      (focusDomRef instanceof HTMLElement ? focusDomRef : null);
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
  // Private - controls delegation
  // ──────────────────────────────────────────────

  _setupControls(): void {
    const ids = this.getControls();
    const nextByInputId = new Map<string, string>();
    const nextCountsByControlId = new Map<string, number>();
    const prevCountsByControlId = new Map<string, number>();
    const resolvedControlIds = new Set<string>();

    for (const controlId of this._registeredControlById.values()) {
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

    // Fast path: if the resolved (inputId → controlId) map and all delegate
    // instances are unchanged, no DOM reconciliation is needed. This skips
    // the work on the common focusin firehose where the controls list stays
    // identical between events.
    if (this._isResolutionUnchanged(nextByInputId)) return;

    // Detach controls no longer referenced or whose instance changed.
    for (const controlId of prevCountsByControlId.keys()) {
      const prev = this._delegatedInstances.get(controlId);
      if (!prev) continue;
      // Keep delegate if same controlId in next AND same Control instance
      if (nextCountsByControlId.has(controlId) && Element.getElementById(controlId) === prev) continue;
      prev.removeEventDelegate(this._controlsFocusDelegation);
    }

    // Attach controls newly referenced or whose instance changed.
    for (const controlId of nextCountsByControlId.keys()) {
      const control = Element.getElementById(controlId);
      if (!(control instanceof Control)) continue;
      // Skip if same controlId in prev AND same Control instance
      if (prevCountsByControlId.has(controlId) && this._delegatedInstances.get(controlId) === control) continue;
      control.addEventDelegate(this._controlsFocusDelegation);
    }

    // Rebuild instance tracking
    this._delegatedInstances = new Map();
    for (const controlId of nextCountsByControlId.keys()) {
      const control = Element.getElementById(controlId);
      if (control instanceof Control) {
        this._delegatedInstances.set(controlId, control);
      }
    }

    this._registeredControlById = nextByInputId;
    this._resolvedControlIds = resolvedControlIds;

    // Clear active target if it's no longer among the resolved controls
    const currentTargetId = this._getActiveTargetId();
    if (currentTargetId && resolvedControlIds.size > 0 && !resolvedControlIds.has(currentTargetId)) {
      this._setActiveTarget("");
    }

    // Auto-target when exactly one control is resolved and nothing is active yet
    if (resolvedControlIds.size === 1 && !this._getActiveTargetId()) {
      const [onlyId] = resolvedControlIds;
      if (onlyId) {
        const control = Element.getElementById(onlyId);
        if (control instanceof Control) {
          this._setActiveTarget(control);
        }
      }
    }
  }

  private _teardownControls(): void {
    for (const instance of this._delegatedInstances.values()) {
      instance.removeEventDelegate(this._controlsFocusDelegation);
    }
    this._delegatedInstances.clear();
    this._registeredControlById.clear();
    this._resolvedControlIds.clear();
  }

  /**
   * Returns true when {@link _setupControls}'s freshly resolved
   * (inputId → controlId) map matches the cached one entry-for-entry AND
   * every cached delegate instance is still the same Control object.
   *
   * Used to skip reconciliation on document focusin events where the
   * controls property and resolved instances have not changed.
   */
  private _isResolutionUnchanged(nextByInputId: ReadonlyMap<string, string>): boolean {
    if (nextByInputId.size !== this._registeredControlById.size) return false;
    for (const [inputId, controlId] of nextByInputId) {
      if (this._registeredControlById.get(inputId) !== controlId) return false;
      if (this._delegatedInstances.get(controlId) !== Element.getElementById(controlId)) return false;
    }
    return true;
  }

  private _findControlById(targetId: string): Control | null {
    // Try view-local first (standard UI5 pattern - matches controller.byId())
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

    return this._keyGridNav.getFocusableDomRef();
  }

  getFocusInfo(): { id: string; lastFocusedKeyId: string | null } {
    return { id: this.getId(), lastFocusedKeyId: this._keyGridNav.getLastFocusedKeyId() };
  }

  applyFocusInfo(oFocusInfo: { id?: string; preventScroll?: boolean; lastFocusedKeyId?: string }): this {
    // Disabled keyboard: the renderer set all keys to tabindex="-1".
    // Do not restore focus - it would undo the renderer's decision.
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
    const first = this.getDomRef()?.querySelector(KIOSK_KEYBOARD_DOM.selectors.key) as HTMLElement | null;
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
   * returned object literal against {@link RendererInternalApi} - if any
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
    return this._shiftState.isShifted;
  }

  /** Returns true when Caps Lock mode is active. */
  private _isCapsLock(): boolean {
    return this._shiftState.isCapsLock;
  }

  /** Resolve the effective layout used by the renderer. */
  private _getResolvedLayout(): LayoutDefinition {
    const kbType = this.getKeyboardType();
    if (kbType === KeyboardType.Numpad) return registryGetLayoutOrDefault("numpad", this._instanceLayoutsMap);
    if (kbType === KeyboardType.Numeric) return registryGetLayoutOrDefault("numeric", this._instanceLayoutsMap);
    return registryGetLayoutOrDefault(this.getLayout(), this._instanceLayoutsMap);
  }

  /**
   * Resolves and returns the active target control instance.
   *
   * This is a typed convenience over `_getActiveTargetId()` when controller
   * code needs the control object rather than the association ID string.
   */
  getActiveControl<T extends Control = Control>(): T | null {
    const target = this._getTargetElement();
    return target instanceof Control ? (target as T) : null;
  }

  /** Default icons for special keys - used when the key has no explicit icon. */
  static readonly SPECIAL_KEY_ICONS: Readonly<Record<string, string>> = {
    "{backspace}": "sap-icon://arrow-left",
    "{shift}": "sap-icon://arrow-top",
    "{shift:capsLock}": "sap-icon://locked",
    "{enter}": "sap-icon://accept",
  };

  /**
   * Returns the default icon URI for a special key value, or undefined
   * if the key has no default icon.
   *
   * @param sKeyValue Key value (e.g. "{shift}", "{enter}")
   * @public
   * @static
   * @since 0.1.0
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
   * Accessible label for a key - always non-empty.
   * Used as aria-label when no visible text is present.
   */
  private _getKeyAriaLabel(key: KeyDefinition): string {
    const entry = KioskKeyboard._SPECIAL_KEY_I18N[key.value];
    if (entry) {
      return getText(entry[0], entry[1]);
    }

    const display = this._getKeyLabel(key);
    return display || key.value;
  }

  /** The display label for a key. Empty string when label is suppressed (icon-only opt-out). */
  private _getKeyLabel(key: KeyDefinition): string {
    if (key.label === "") return "";

    // Caps Lock state: use capsLockLabel if defined, else i18n fallback
    if (key.value === "{shift}" && this._isCapsLock()) {
      if (key.capsLockLabel !== undefined) return key.capsLockLabel;
      return getText("ARIA_CAPS_LOCK", "Caps Lock");
    }

    const shift = this._isShiftActive();
    if (shift && key.shiftLabel) return key.shiftLabel;

    // Explicit label takes priority over i18n
    if (key.label !== undefined) {
      return shift && key.value.length === 1 && key.value.trim() ? key.label.toUpperCase() : key.label;
    }

    // No explicit label: i18n for special keys, value for regular keys
    const entry = KioskKeyboard._SPECIAL_KEY_I18N[key.value];
    if (entry) return getText(entry[0], entry[1]);

    const base = key.value;
    if (!base) return "";
    if (shift) {
      if (key.shiftValue) return key.shiftValue;
      if (key.value.length === 1 && key.value.trim()) return base.toUpperCase();
    }
    return base;
  }

  // ──────────────────────────────────────────────
  // UI5 Event Delegation
  // ──────────────────────────────────────────────

  private _resolveKeyElementFromEventTarget(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof globalThis.Element)) return null;
    const keyElement = target.closest(KIOSK_KEYBOARD_DOM.selectors.key);
    return keyElement instanceof HTMLElement ? keyElement : null;
  }

  /**
   * Clears the pressed-key visual state and detaches the window-blur safety
   * net attached by `ontouchstart`. Safe to call when no key is pressed and
   * is therefore also invoked from `exit()` to guarantee listener cleanup.
   */
  private _clearPressedKeyState(): HTMLElement | null {
    const pressed = this._pressedKeyEl;
    this._pressedKeyEl = null;
    if (pressed) {
      pressed.classList.remove(KIOSK_KEYBOARD_DOM.classes.keyPressed);
      window.removeEventListener("blur", this._boundClearPressedOnBlur);
    }
    return pressed;
  }

  /**
   * Prevents focus from leaving the target input when clicking anywhere
   * on the keyboard surface - keys, rows, or gaps between keys.
   *
   * Uses UI5's EventSimulation touchstart (fires for both mouse and touch)
   * instead of raw pointerdown. preventDefault() on the underlying
   * mousedown/touchstart prevents focus transfer without suppressing the
   * click/tap chain - unlike pointerdown's preventDefault() which
   * suppresses all compatibility mouse events per the Pointer Events spec.
   */
  ontouchstart(event: Event): void {
    // Always prevent focus steal when clicking anywhere on the keyboard
    // (including gaps between keys), so the target input keeps focus.
    event.preventDefault();

    const el = this._resolveKeyElementFromEventTarget(event.target);
    if (el) {
      this._pressedKeyEl = el;
      el.classList.add(KIOSK_KEYBOARD_DOM.classes.keyPressed);
      // Safety net: if the window loses focus before touchend/touchcancel
      // fires (e.g. Alt-Tab during a mousedown, or a modal popup steals
      // focus), clear the pressed visual state so it does not stick.
      window.addEventListener("blur", this._boundClearPressedOnBlur);
    }
  }

  /**
   * Activates the key on touch/mouse release.
   *
   * Only fires if the release target matches the press target (basic
   * tap detection - drag-away cancels). Replaces ontap which couldn't
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

    this._keyGridNav.setLastFocusedKeyId(pressed.id);
    this._handleKeyAction(keyValue, pressed);
  }

  ontouchcancel(): void {
    this._clearPressedKeyState();
  }

  /**
   * Activate the focused key on Enter or Space without modifiers.
   *
   * Uses UI5's `sapselect` pseudo-event, which the framework filters to
   * Enter/Space with no Ctrl/Alt/Shift/Meta held, so Ctrl+Space and
   * similar combinations cannot accidentally trigger key activation.
   */
  onsapselect(event: Event): void {
    if (!this.getEnabled()) return;

    const target = event.target as HTMLElement;
    if (!target.classList.contains(KIOSK_KEYBOARD_DOM.classes.key)) return;

    const keyValue = target.dataset.key;
    if (!keyValue) return;

    event.preventDefault();
    this._handleKeyAction(keyValue, target);
  }

  // ──────────────────────────────────────────────
  // Private - Auto-show
  // ──────────────────────────────────────────────

  /**
   * Whether this instance is visible, enabled, attached to the DOM,
   * and has a non-zero layout size - i.e. eligible to participate in
   * multi-instance focus-claim arbitration.
   */
  private _isParticipating(): boolean {
    if (!this.getVisible() || !this.getEnabled()) return false;
    const dom = this.getDomRef();
    if (!(dom instanceof HTMLElement)) return false;
    if (!document.contains(dom)) return false;
    return dom.getClientRects().length > 0;
  }

  /** Returns true if any other KioskKeyboard instance already targets this input. */
  private _isTargetOfOther(inputId: string): boolean {
    for (const other of KioskKeyboard._instances) {
      if (other === this) continue;
      if (!other._isParticipating()) continue;
      if (other._getActiveTargetId() === inputId) return true;
      // With controls, the active target is only set on focus. However, the
      // controls list declares ownership: if the input is in another keyboard's
      // controls AND that keyboard has not been manually re-targeted to a
      // different input, the input is still claimed.
      if (other._resolvedControlIds.has(inputId)) {
        const otherActive = other._getActiveTargetId();
        // Claimed if: no active target yet (pre-focus), or the active target
        // IS this input, or the active target is also in controls (meaning the
        // keyboard hasn't been manually re-targeted outside its controls list).
        if (!otherActive || otherActive === inputId || other._resolvedControlIds.has(otherActive)) {
          return true;
        }
      }
    }
    return false;
  }

  /** Returns true if this keyboard would auto-claim the given DOM element. */
  _wouldClaimInput(target: EventTarget | null): boolean {
    return this._focusClaimService.wouldClaimInput(target);
  }

  /** Returns the UI5 control this keyboard would auto-claim, or null. */
  _resolveClaimableControl(target: EventTarget | null): Control | null {
    return this._focusClaimService.resolveClaimableControl(target);
  }

  /**
   * Walks the UI5 parent chain of `candidate` and returns the first control
   * whose ID matches a resolved controls entry, or null. This handles
   * composite controls (e.g. StepInput wrapping an inner Input) where
   * `Element.closestTo()` returns the inner control but controls references
   * the outer wrapper.
   */
  private _resolveControlsAncestor(candidate: Control): Control | null {
    return this._focusClaimService.resolveControlsAncestor(candidate);
  }

  // ──────────────────────────────────────────────
  // Private - Pointer & Key Actions
  // ──────────────────────────────────────────────

  private _handleKeyAction(keyValue: string, el: HTMLElement): void {
    const shift = this._isShiftActive();

    if (keyValue === "{shift}") {
      this._toggleShift(el);
      return;
    }

    // ── Composition middleware (must see {backspace}/{enter} before default handling) ──
    if (
      keyValue === "{backspace}" ||
      keyValue === "{enter}" ||
      (!keyValue.startsWith("{layout:") && !keyValue.startsWith("{fkey:"))
    ) {
      if (!this._middleware) {
        const factory = registryGetMiddlewareFactory(this.getLayout(), this._instanceMiddlewareMap);
        if (factory) this._middleware = factory();
      }
      if (this._middleware) {
        const targetEl = this._getTargetElement();
        const mwTarget = targetEl
          ? resolveWithCustomResolver(targetEl.getFocusDomRef(), this._getEffectiveResolver())
          : null;
        if (mwTarget && this._middleware.handleKey(keyValue, mwTarget)) {
          if (this._shiftState.autoRelease()) {
            this.invalidate();
          }
          return;
        }
      }
    }

    if (keyValue === "{backspace}") {
      if (this.fireKeyPress({ key: "Backspace", shiftKey: shift })) {
        this._targetSession.handleBackspace();
      }
      return;
    }

    if (keyValue === "{enter}") {
      if (this.fireKeyPress({ key: "Enter", shiftKey: shift })) {
        this._targetSession.handleEnter();
      }
      return;
    }

    if (keyValue.startsWith("{layout:")) {
      if (this.getKeyboardType() === KeyboardType.Full) {
        const raw = keyValue.slice("{layout:".length, -1).trim();
        if (raw) {
          if (this._middleware) {
            this._middleware.commit();
            this._middleware = null;
          }
          const name = raw === "base" ? this._baseLayout : raw;
          const previousLayout = this.getLayout();
          this.setLayout(name);
          const nextLayout = this.getLayout();
          if (nextLayout !== previousLayout) {
            this.fireLayoutChange({ layout: nextLayout });
          }
        }
      }
      return;
    }

    if (keyValue.startsWith("{fkey:")) {
      const fkeyName = keyValue.slice("{fkey:".length, -1);

      // Fire keyPress first so consumers can prevent all downstream action
      // (including native F5 reload / F11 fullscreen in fKeyMode="Native").
      if (!this.fireKeyPress({ key: fkeyName, shiftKey: shift })) {
        return;
      }

      const fKeyMode = this.getFKeyMode();

      if (fKeyMode === FKeyMode.None) {
        return;
      }

      let nativeAllowed = true;

      if (fKeyMode === FKeyMode.Native) {
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

    // Regular character - resolve shift value
    let effective = keyValue;
    if (shift) {
      const shiftValue = el.dataset.shiftValue;
      if (shiftValue) {
        effective = shiftValue;
      } else if (keyValue.length === 1) {
        effective = keyValue.toUpperCase();
      }
    }

    if (this.fireKeyPress({ key: effective, shiftKey: shift })) {
      this._targetSession.insertText(effective);
    }

    // Auto-release shift (not caps lock)
    if (this._shiftState.autoRelease()) {
      this.invalidate();
    }
  }

  private _toggleShift(el: HTMLElement): void {
    this._shiftState.toggle();

    // Optimistic DOM update: apply shift-active / caps-lock classes
    // immediately for instant visual feedback, before the framework
    // re-render cycle.  Same pattern as sap.m.Button._activeButton(),
    // sap.m.ToggleButton.setPressed(), and this control's own
    // ontouchstart keyPressed class.
    //
    // Note: this duplicates the class logic in KioskKeyboardRenderer's
    // addKeyClasses hook.  Custom renderers that override addKeyClasses
    // for shift styling must also override _toggleShift to keep the
    // optimistic path in sync.
    const isShifted = this._shiftState.isShifted;
    const isCaps = this._shiftState.isCapsLock;
    el.classList.toggle(KIOSK_KEYBOARD_DOM.classes.keyShiftActive, isShifted);
    el.classList.toggle(KIOSK_KEYBOARD_DOM.classes.keyCapsLock, isCaps);

    this.invalidate();
  }

  /**
   * Resolve the target input association to a UI5 Element.
   * Uses Element registry (the standard UI5 association resolution pattern).
   */
  private _getTargetElement(): Element | null {
    const id = this._getActiveTargetId();
    if (!id) return null;
    return Element.getElementById(id) ?? null;
  }

  // ──────────────────────────────────────────────
  // Private - Physical keyboard highlighting
  // ──────────────────────────────────────────────

  /** Maps non-derivable KeyboardEvent.key names to special-key data-key values. */
  private static readonly _KEY_TO_DATA_KEY: Record<string, string> = {
    Shift: "{shift}",
    Backspace: "{backspace}",
    Enter: "{enter}",
    Delete: "{backspace}", // virtual keyboard has no separate Delete - highlight Backspace
  };

  /**
   * Resolves a KeyboardEvent.key name to its data-key attribute value.
   * Native-dispatchable keys (F1-F12, arrows, Home/End/PgUp/PgDn) are
   * derived dynamically from the `_NATIVE_DISPATCHABLE_FKEYS` set.
   */
  private static _resolveDataKey(key: string): string | undefined {
    return (
      KioskKeyboard._KEY_TO_DATA_KEY[key] ??
      (KioskKeyboard._NATIVE_DISPATCHABLE_FKEYS.has(key) ? `{fkey:${key}}` : undefined)
    );
  }

  /**
   * Handles a physical keyboard event on the target input.
   * Syncs shift/capslock state from the physical keyboard and
   * delegates to visual key highlighting.
   */
  private _onPhysicalKey(event: KeyboardEvent, down: boolean): void {
    this._highlightKey(event.key, down);

    // UI5 event delegation wraps the native event; unwrap to access
    // getModifierState which is not forwarded to the wrapper.
    const native = (event as KeyboardEvent & { originalEvent?: KeyboardEvent }).originalEvent ?? event;
    const capsLock = typeof native.getModifierState === "function" && native.getModifierState("CapsLock");
    const changed = this._shiftState.syncFromPhysical(native.shiftKey, capsLock);
    if (changed) {
      this.invalidate();
    }
  }

  private _highlightKey(key: string, add: boolean): void {
    const dom = this.getDomRef();
    if (!dom) return;

    if (!add) {
      // Clear all highlights on any keyup. When Shift releases before the
      // character key, keyup reports the unshifted value (e.g. "2" not "@"),
      // so a targeted removal would miss the shifted key's highlight.
      dom
        .querySelectorAll<HTMLElement>(`.${KIOSK_KEYBOARD_DOM.classes.keyHighlight}`)
        .forEach((el) => el.classList.remove(KIOSK_KEYBOARD_DOM.classes.keyHighlight));
      return;
    }

    const mapped = KioskKeyboard._resolveDataKey(key);
    const el =
      dom.querySelector(KIOSK_KEYBOARD_DOM.selectors.keyByValue(mapped ?? key)) ??
      (key.length === 1 ? dom.querySelector(KIOSK_KEYBOARD_DOM.selectors.keyByValue(key.toLowerCase())) : null) ??
      dom.querySelector(KIOSK_KEYBOARD_DOM.selectors.keyByShiftValue(key));
    el?.classList.toggle(KIOSK_KEYBOARD_DOM.classes.keyHighlight, add);
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
  // Private - Mobile detection
  // ──────────────────────────────────────────────

  /** Best-effort event target used for synthetic native F-key dispatch. */
  private _resolveNativeFKeyTarget(): EventTarget {
    const target = this._getTargetElement()?.getFocusDomRef();
    const textual = resolveWithCustomResolver(target, this._getEffectiveResolver());
    if (textual) return textual;
    if (target instanceof HTMLElement) return target;
    if (document.activeElement instanceof HTMLElement) return document.activeElement;
    return document;
  }

  /**
   * Dispatches synthetic `keydown` for an F-key and returns whether it was not canceled.
   *
   * The current allowlist (F1-F12, Arrow*, Home/End, PageUp/Down) has
   * `KeyboardEvent.code === KeyboardEvent.key` for every entry, so the same
   * string is used for both. Extending the allowlist to a key where the two
   * diverge (e.g. `NumpadEnter` has `key: "Enter"` / `code: "NumpadEnter"`)
   * requires routing `code` through an explicit lookup at that point.
   */
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
}
