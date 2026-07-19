import Control from "sap/ui/core/Control";
import Element from "sap/ui/core/Element";
import type { MetadataOptions } from "sap/ui/core/Element";
import syncStyleClass from "sap/ui/core/syncStyleClass";
import Popover from "sap/m/Popover";
import { PlacementType } from "sap/m/library";
import { SECONDARY_LAYOUTS } from "./internal/types";
import type { LayoutDefinition, CompositionMiddleware } from "./types";
import type { RendererInternalApi } from "./internal/renderer-internal-api";
import DEFAULT_LAYOUT from "./layouts/default-layout";
import Log from "sap/base/Log";
import KioskKeyboardRenderer from "./KioskKeyboardRenderer";
import { KIOSK_KEYBOARD_DOM } from "./internal/dom-contract";
import { getText } from "./internal/i18n-registry";
import { resolveWithCustomResolver, isParticipating, KEY_ID_SUFFIX_RE, type TargetResolverFn } from "./internal/dom";
import { applyVariantDefaults, shiftedGlyph, toShiftVariants } from "./internal/latin-variants";
import VariantPopupBehavior from "./internal/variant-popup-behavior";
import { KeyboardType } from "./library"; // side-effect: ensures Lib.init() runs
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
  SPECIAL_KEY_ICONS as DEFAULT_SPECIAL_KEY_ICONS,
  LAYOUT_RETURN_ICON,
  getKeyIcon as iconsGetKeyIcon,
  clearIconWarnings as iconsClearWarnings,
} from "./internal/key-icons";
import { setI18nResolver as registrySetResolver } from "./internal/i18n-registry";
import type { I18nResolver } from "./types";
import FocusClaimService from "./internal/focus-claim-service";
import { ShiftState } from "./internal/shift-state";
import TargetInputSession from "./internal/target-input-session";
import KeyGridNavigation from "./internal/key-grid-navigation";
import NativeKeyboardSuppression from "./internal/native-keyboard-suppression";
import AutoShowBehavior, { type KeyboardTypeSource } from "./internal/auto-show-behavior";
import BackspaceRepeatBehavior from "./internal/backspace-repeat-behavior";
import ResponsiveSizingController from "./internal/responsive-sizing-controller";
import FKeyController from "./internal/fkey-controller";
import ControlsDelegationController from "./internal/controls-delegation-controller";
import { getKeyLabel, getKeyAriaLabel, clearLabelWarnings } from "./internal/key-labels";
import PhysicalKeyHighlight from "./internal/physical-key-highlight";
import { parseKeyAction, assertNever, LAYOUT_BASE } from "./internal/key-token";
import { constrainedLayoutName, reconcileBaseSwitch } from "./internal/layout-constraint";

export type { KioskKeyboardDomContract } from "./internal/dom-contract";

/**
 * Whether a simulated touch event stands for a non-primary mouse button.
 *
 * UI5's EventSimulation binds the simulated touchstart/touchend to
 * mousedown/mouseup for every button, so the right-click that opens the accent
 * popup also reaches the touch handlers. The fixed event carries the original
 * `button`; a genuine touch has none, so it reads as primary.
 */
function isSecondaryPress(event: Event): boolean {
  const { button } = event as MouseEvent;
  return typeof button === "number" && button > 0;
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
  /** Owns `controls` focus delegation and active-target reconciliation. */
  private _controlsDelegation!: ControlsDelegationController;
  private _physicalKeyHighlight!: PhysicalKeyHighlight;
  private _pressedKeyEl!: HTMLElement | null;
  /** Owns press-and-hold continuous delete on the Backspace key. */
  private _backspaceRepeat!: BackspaceRepeatBehavior;
  /** Owns the long-press / right-click accent-variant popup. */
  private _variantPopup!: VariantPopupBehavior;
  private _baseLayout!: string;
  private _middleware!: CompositionMiddleware | null;
  private _keyboardTypeSource!: KeyboardTypeSource;
  /**
   * Whether the active layout was last set by a user-driven `{layout:X}` key tap
   * (`"user"`) or by a programmatic / auto-detected change (`"external"`).
   *
   * User-driven switches override the `keyboardType` constraint so a `{layout:special}`
   * tap in Numeric/Numpad mode shows the special layout. `{layout:base}`, `setLayout`,
   * `setKeyboardType`, `resetKeyboardType`, and auto-type detection all reset this
   * back to `"external"`. Mirrors the webc package's `_layoutSource` semantics.
   */
  private _layoutSource: "external" | "user" = "external";
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
  /** Owns the ResizeHandler-driven height-responsive class application. */
  private _responsiveSizing!: ResponsiveSizingController;
  /** Owns `fKeyMode`-driven F-key dispatch (native keydown + caret navigation). */
  private _fKeyController!: FKeyController;
  static readonly metadata: MetadataOptions = {
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
       *
       * @since 0.1.0
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
       *
       * @since 0.1.0
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
       *
       * @since 0.1.0
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
       *
       * @since 0.1.0
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
       *
       * @since 0.1.0
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
       *
       * @since 0.1.0
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
       *
       * @since 0.1.0
       */
      autoType: {
        type: "boolean",
        defaultValue: false,
        group: "Behavior",
      },
      /**
       * When `true`, a built-in Latin-diacritics table is merged onto the
       * resolved layout so every matching base letter (a, e, i, o, u, c, n,
       * s, y, z, l, ...) gains a long-press / right-click accent-variant
       * popup, making German umlauts (ä/ö/ü) and the sharp S (ß/ẞ) reachable
       * from any Latin layout without editing layout data.
       *
       * A per-key `variants` declaration always wins over the default table.
       * When Shift or Caps Lock is active, the popup surfaces the uppercase
       * forms (including ẞ for ß). Default `false` (off).
       *
       * @example <caption>XML view</caption>
       * <kiosk:KioskKeyboard accentVariants="true" controls="myInput" />
       *
       * @since 0.1.0
       */
      accentVariants: {
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
       *
       * @since 0.1.0
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
       *
       * @since 0.1.0
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
       *
       * @since 0.1.0
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
    aggregations: {
      /**
       * Internal accent-variant popover, owned by the control and driven by
       * `VariantPopupBehavior`. Hidden so consumers can neither inject nor clone
       * it; created lazily on first open, reused across opens, and destroyed
       * with the control.
       */
      _variantPopover: {
        type: "sap.m.Popover",
        multiple: false,
        visibility: "hidden",
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
       *
       * @since 0.1.0
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
       *
       * @since 0.1.0
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
       *
       * @since 0.1.0
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
       *
       * @since 0.1.0
       */
      activeControlChange: {
        parameters: {
          /** The control ID of the new active target, or empty string if cleared. */
          controlId: { type: "string" },
        },
      },
      /**
       * Fired when `show()` opens the docked keyboard (not tied to CSS transition end).
       *
       * @since 0.1.0
       */
      afterOpen: {},
      /**
       * Fired when `close()` closes the docked keyboard (not tied to CSS transition end).
       *
       * @since 0.1.0
       */
      afterClose: {},
    },
  };

  static readonly renderer = KioskKeyboardRenderer;

  /** All living KioskKeyboard instances - used by auto-show to skip inputs already targeted by another keyboard. */
  private static readonly _instances = new Set<KioskKeyboard>();

  /** Global target resolver applied to all instances (lowest priority). */
  private static _globalTargetResolver: TargetResolverFn | null = null;

  // ── Static delegates: target resolver ──

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

  // ── Static delegates: layout registry (read-only views) ──
  // Customization is per-instance: pass `instanceLayouts`,
  // `instanceLocaleLayouts`, and `instanceMiddleware` to the constructor
  // (or via the corresponding setters). There is no public mutation API
  // for the global registry; built-ins ship sealed.

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

  // Static delegates for i18n (see internal/i18n-registry.ts)

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
   * When no settings are provided at all (e.g. `new KioskKeyboard()`),
   * ManagedObject does not call `applySettings`. The locale default is
   * therefore also set in `init()`.
   */
  override applySettings(mSettings: Record<string, unknown>, oScope?: object): this {
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

  override init(): void {
    KioskKeyboard._instances.add(this);
    this._shiftState = new ShiftState(() => this.invalidate());
    this._keyGridNav = new KeyGridNavigation(this.getId(), KIOSK_KEYBOARD_DOM);
    // @ts-expect-error addDelegate is an internal UI5 API not exposed in @openui5/types
    this.addDelegate(this._keyGridNav, true);
    this._open = false;
    this._controlsDelegation = new ControlsDelegationController({
      getControls: () => this.getControls(),
      getParent: () => this.getParent(),
      getEnabled: () => this.getEnabled(),
      getDocked: () => this.getDocked(),
      getAutoShow: () => this.getAutoShow(),
      isOpen: () => this._open,
      show: () => {
        this.show();
      },
      getActiveTargetId: () => this._getActiveTargetId(),
      setActiveTarget: (target) => {
        this._setActiveTarget(target);
      },
      resolveControlsAncestor: (candidate) => this._focusClaimService.resolveControlsAncestor(candidate),
    });
    this._physicalKeyHighlight = new PhysicalKeyHighlight(this, this._shiftState);
    this._pressedKeyEl = null;
    this._backspaceRepeat = new BackspaceRepeatBehavior(() => {
      if (this._tryCompositionMiddleware("{backspace}")) return true;
      return this._performBackspaceDelete();
    });
    this._variantPopup = new VariantPopupBehavior({
      resolveVariants: (keyEl) => this._resolveKeyVariants(keyEl),
      commitVariant: (glyph) => {
        this._commitVariant(glyph);
      },
      announceOpen: (label) => {
        this._announceLiveRegion(label);
      },
      announceDismiss: () => {
        this._announceLiveRegion(getText("ARIA_VARIANTS_CLOSED", "Variants closed"));
      },
      getVariantPopover: () => this._getVariantPopover(),
    });
    this._keyboardTypeSource = "unset";
    this._nativeKbSuppression = new NativeKeyboardSuppression(this);
    this._autoShowBehavior = new AutoShowBehavior(this);
    this._extensions = [this._nativeKbSuppression, this._autoShowBehavior];
    this._boundEscapeKeydown = this._onDocumentEscapeKeydown.bind(this);
    // A press that ends outside the page abandons the gesture, like a cancel.
    this._boundClearPressedOnBlur = (): void => this.ontouchcancel();
    this._focusClaimService = new FocusClaimService(
      () => this.getControls(),
      () => this._controlsDelegation.getResolvedControlIds(),
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
    this._responsiveSizing = new ResponsiveSizingController(this);
    this._fKeyController = new FKeyController({
      getFKeyMode: () => this.getFKeyMode(),
      getTargetFocusDomRef: () => this._getTargetElement()?.getFocusDomRef() ?? null,
      getEffectiveResolver: () => this._getEffectiveResolver(),
      handleNavigationKey: (fkeyName) => this._targetSession.handleNavigationKey(fkeyName),
    });

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

  override onAfterRendering(): void {
    // apiVersion 4 may skip this hook on a parent-only re-render; safe because
    // each external sync below is idempotent and independently event/observer-driven.
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
      this._responsiveSizing.syncObserver(dom);
      this._responsiveSizing.scheduleClassUpdate();
    }

    this._controlsDelegation.sync();
  }

  /** Keeps docked/closed root classes in sync without forcing a re-render. */
  private _syncDockedDomState(): void {
    const dom = this.getDomRef();
    if (!dom) return;

    const docked = this.getDocked();
    dom.classList.toggle(KIOSK_KEYBOARD_DOM.classes.rootDocked, docked);
    dom.classList.toggle(KIOSK_KEYBOARD_DOM.classes.rootClosed, docked && !this._open);
  }

  override exit(): void {
    if (this._middleware) {
      this._middleware.reset();
      this._middleware = null;
    }
    KioskKeyboard._instances.delete(this);
    const wasLastInstance = KioskKeyboard._instances.size === 0;

    if (wasLastInstance) {
      registrySetResolver(null);
      FKeyController.clearWarnings();
      iconsClearWarnings();
      clearLabelWarnings();
      KioskKeyboard._globalTargetResolver = null;
    }

    this._controlsDelegation.teardown();
    this._physicalKeyHighlight.detach();
    this._responsiveSizing.destroy();
    this._variantPopup.destroy();
    this._clearPressedKeyState();
    for (const ext of this._extensions) ext.destroy();
    document.removeEventListener("keydown", this._boundEscapeKeydown, true);
    // @ts-expect-error removeDelegate is an internal UI5 API not exposed in @openui5/types
    this.removeDelegate(this._keyGridNav);
    this._keyGridNav.destroy();

    // After this instance restored its own inputmode suppression (via the
    // extension teardown above, where NativeKeyboardSuppression.destroy runs),
    // clear any page-level bookkeeping that outlived all instances - defensive
    // against an orphaned entry from an input destroyed mid-suppression.
    if (wasLastInstance) {
      NativeKeyboardSuppression._clearAll();
    }
  }

  // ── Public API: property overrides ──

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
   * `setVisible(true)` does not re-open a previously closed docked
   * keyboard; call `show()` explicitly after making it visible again.
   */
  override setVisible(isVisible: boolean): this {
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
   * Uses `document.activeElement` which does not pierce shadow DOM
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

  // ── Public API: target and docked mode ──

  /**
   * Custom setter for layout - tracks the base (alphabetic) layout so
   * that `{layout:base}` in numeric/special layouts can return to it.
   * Fires `layoutChange` when the layout actually changes.
   *
   * @public
   * @since 0.1.0
   */
  setLayout(sLayout: string): this {
    // Programmatic change is external-sourced and re-engages keyboardType constraints.
    this._performLayoutSwitch(sLayout, "external", "passed to setLayout()");
    return this;
  }

  /**
   * Single layout-switch core shared by the public `setLayout` and the
   * `{layout:*}` key branch of `_handleKeyAction`: normalize (trim + lowercase)
   * -> validate against the registry (warn and bail when unregistered) ->
   * apply -> fire `layoutChange` on a real change. Returns whether the layout
   * changed.
   *
   * @param rawName Requested layout name; normalized here.
   * @param source  Who drove the switch (see {@link _applyLayout}).
   * @param origin  Requester description used in the unregistered warning.
   */
  private _performLayoutSwitch(rawName: string, source: "external" | "user", origin: string): boolean {
    const name = rawName.trim().toLowerCase();
    if (!registryGetLayout(name, this._instanceLayoutsMap)) {
      Log.warning(
        `Layout "${name}" ${origin} is not registered. Pass it through the instanceLayouts setting.`,
        undefined,
        "ui5.kiosk.KioskKeyboard",
      );
      return false;
    }
    const changed = this._applyLayout(name, source);
    if (changed) {
      this.fireLayoutChange({ layout: name });
    }
    return changed;
  }

  /**
   * State-application step of {@link _performLayoutSwitch}: track the base
   * (alphabetic) layout, record who drove the switch, and write the `layout`
   * property. The caller validates `name` against the registry first.
   * Returns whether the property value actually changed.
   *
   * Selecting a layout always resets the typing context (shift/caps-lock), even a
   * re-selection of the active layout. The `source` only changes on a real switch
   * so a no-op re-selection can't silently flip the constraint-override.
   */
  private _applyLayout(name: string, source: "external" | "user"): boolean {
    if (!SECONDARY_LAYOUTS.has(name)) {
      this._baseLayout = name;
    }
    const changed = name !== this.getLayout();
    if (changed) {
      this._layoutSource = source;
      // A real layout switch ends any in-progress composition so the next key
      // resolves the new layout's middleware. Covers both programmatic
      // setLayout() and the {layout:*} key path.
      this._endComposition();
    }
    this._shiftState.reset();
    this.setProperty("layout", name);
    return changed;
  }

  /**
   * Commits any in-progress composition to the target and drops the middleware,
   * so the next key starts a fresh composition. A no-op when no composition is
   * active. Called on every real editing-context switch (layout, target, or
   * keyboardType change).
   */
  private _endComposition(): void {
    if (this._middleware) {
      this._middleware.commit();
      this._middleware = null;
    }
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
    if (this._middleware) {
      this._middleware.reset();
      this._middleware = null;
    }
    return this.setProperty("instanceMiddleware", value) as this;
  }

  private static _toLayoutMap(value: unknown): InstanceLayouts | undefined {
    if (!value || typeof value !== "object") return undefined;
    const entries: [string, LayoutDefinition][] = [];
    for (const [name, def] of Object.entries(value as Record<string, unknown>)) {
      if (!KioskKeyboard._isValidLayoutDefinition(def)) {
        Log.warning(
          `Invalid instanceLayouts entry "${name}": must be a non-empty array of non-empty rows where each key has a string "value".`,
          undefined,
          "ui5.kiosk.KioskKeyboard",
        );
        continue;
      }
      // Lookup paths normalize names via trim+lowercase; mirror that at
      // storage so mixed-case keys do not silently fall through.
      const key = name.trim().toLowerCase();
      if (!key) continue;
      entries.push([key, def]);
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
    const entries: [string, string][] = [];
    for (const [tag, layout] of Object.entries(value as Record<string, unknown>)) {
      if (typeof layout !== "string") continue;
      const key = tag.trim().toLowerCase();
      if (!key) continue;
      entries.push([key, layout.trim().toLowerCase()]);
    }
    return entries.length === 0 ? undefined : new Map(entries);
  }

  private static _toMiddlewareMap(value: unknown): InstanceMiddleware | undefined {
    if (!value || typeof value !== "object") return undefined;
    const entries: [string, () => CompositionMiddleware][] = [];
    for (const [name, factory] of Object.entries(value as Record<string, unknown>)) {
      if (typeof factory !== "function") continue;
      const key = name.trim().toLowerCase();
      if (!key) continue;
      entries.push([key, factory as () => CompositionMiddleware]);
    }
    return entries.length === 0 ? undefined : new Map(entries);
  }

  /**
   * Returns the current base (alphabetic) layout name.
   *
   * This is the layout used when `{layout:base}` is triggered from secondary
   * layouts such as `numeric`, `special`, `fkeys`, or `nav`.
   *
   * @public
   * @since 0.1.0
   */
  getBaseLayout(): string {
    return this._baseLayout;
  }

  /**
   * Restores the active layout to the tracked base layout.
   *
   * @public
   * @since 0.1.0
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
    this._physicalKeyHighlight.detach();

    // If the keyboard is open, restore the old target's inputmode
    // before switching so it's not left suppressed.
    if (this._open) {
      this._nativeKbSuppression.restore();
    }

    this._targetSession.resetForTargetSwitch();

    this.setAssociation("_activeTarget", target ?? "", true);

    const newId = this._getActiveTargetId();
    const isRealSwitch = newId !== previousTarget;

    // A real target switch starts a fresh input context: reset shift/caps.
    // A same-input refocus (caret reposition) preserves the armed shift,
    // mirroring the composition and layout-override handling below.
    if (isRealSwitch) {
      this._shiftState.reset();
    }

    // A real target switch ends any in-progress composition so the new target
    // starts fresh. Without this, the cached middleware (which holds the old
    // target and its preedit offsets) leaks the old syllable into the new input.
    // Mirrors the `{layout:}` key path and the web component's focusin handling.
    // A same-input refocus (caret reposition) keeps the composition going.
    if (isRealSwitch) {
      this._endComposition();
    }

    // A real target switch is a new editing context: drop a user-driven
    // `{layout:X}` override so the new target re-resolves under its keyboardType.
    // A same-input refocus (caret reposition) keeps it.
    if (isRealSwitch && this._layoutSource === "user") {
      this._layoutSource = "external";
      this.invalidate();
    }

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
        this._physicalKeyHighlight.attach(next, newId);

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

    // If the deferred change handler re-entered _setActiveTarget (e.g. by
    // focusing another input), that inner call already announced the final
    // target. Announce only when the association still holds the value THIS
    // call set, so the outer call does not fire a duplicate.
    const finalTarget = this._getActiveTargetId();
    if (finalTarget === newId && isRealSwitch) {
      this.fireActiveControlChange({ controlId: newId });
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
    // A keyboardType change (explicit, reset, or auto-detected) invalidates
    // any prior user-driven layout switch; the resolved layout must follow
    // the new constraint context.
    this._layoutSource = "external";
    // End any in-progress composition so the next key resolves against the new
    // effective layout (mirrors _applyLayout).
    this._endComposition();
  }

  /**
   * Custom setter for controls.
   *
   * Reconciles focus delegates against currently resolved control instances
   * without forcing a re-render, because controls does not affect renderer
   * output directly.
   *
   * @public
   * @since 0.1.0
   */
  setControls(controls: string[]): this {
    this.setProperty("controls", controls, true);
    this._controlsDelegation.sync();
    return this;
  }

  /** Re-resolves the `controls` list against live instances (used by auto-show on focusin). */
  _syncControls(): void {
    this._controlsDelegation.sync();
  }

  /**
   * Custom setter for autoShow - activates or deactivates the
   * auto-show document listeners on the AutoShowBehavior delegate.
   *
   * @public
   * @since 0.1.0
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
   *
   * @public
   * @since 0.1.0
   */
  setKeyboardType(type: KeyboardType): this {
    const previous = this.getKeyboardType();
    // Route through _setKeyboardTypeSource so the `_layoutSource` reset
    // (webc parity, see _getResolvedLayout) fires for explicit changes too,
    // not just for auto-detect.
    this._setKeyboardTypeSource("explicit");
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
    // Route through _setKeyboardTypeSource so the `_layoutSource` reset fires.
    this._setKeyboardTypeSource("unset");
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

    this._responsiveSizing.syncObserver(dom);
    this._responsiveSizing.scheduleClassUpdate();
    return this;
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
      this._responsiveSizing.syncObserver(dom);
    }
    return this;
  }

  /**
   * Opens the keyboard (docked mode). Slides it into view.
   *
   * @public
   * @since 0.1.0
   */
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

  /**
   * Closes the keyboard (docked mode). Slides it out of view.
   *
   * @public
   * @since 0.1.0
   */
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

  /**
   * Whether the docked keyboard is currently open.
   *
   * @public
   * @since 0.1.0
   */
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
    // An open accent-variant popup, or a re-anchor parked between two keys, owns
    // Escape: it resolves the popup and leaves the docked keyboard open.
    if (this._variantPopup.consumeEscape()) return;
    if (!this.getDocked() || !this._open) return;

    const eventTarget = event.composedPath?.()[0] ?? event.target;

    const target = eventTarget instanceof HTMLElement ? eventTarget : null;
    const myDom = this.getDomRef();
    const focusDomRef = this._getTargetElement()?.getFocusDomRef();
    const inputDom =
      resolveWithCustomResolver(focusDomRef, this._getEffectiveResolver()) ??
      (focusDomRef instanceof HTMLElement ? focusDomRef : null);
    const isOnKeyboard = target ? (myDom?.contains(target) ?? false) : false;

    event.preventDefault();
    this.close();
    // Move focus to the target input (if Escape was pressed on a virtual key)
    // or keep it where it is (if already on the input)
    if (isOnKeyboard && inputDom) {
      inputDom.focus();
    }
  }

  // ── Focus management ──

  override getFocusDomRef(): globalThis.Element | null {
    if (!this.getEnabled() || this._getResolvedLayout().length === 0) {
      return null;
    }

    return this._keyGridNav.getFocusableDomRef();
  }

  override getFocusInfo(): { id: string; lastFocusedKeyId: string | null } {
    return { id: this.getId(), lastFocusedKeyId: this._keyGridNav.getLastFocusedKeyId() };
  }

  override applyFocusInfo(oFocusInfo: { id?: string; preventScroll?: boolean; lastFocusedKeyId?: string }): this {
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

  // ── Accessibility ──

  override getAccessibilityInfo(): {
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

  /** Updates the ARIA live region text for screen reader announcements. */
  private _announceLiveRegion(text: string): void {
    const liveRegion = this.getDomRef("liveState");
    if (liveRegion) liveRegion.textContent = text;
  }

  // ── Internal renderer helpers ──

  /**
   * Returns the internal renderer API object.
   *
   * Exposes the five private helpers the renderer needs, without an unsafe
   * `as unknown as` cast. TypeScript structurally checks the returned object
   * literal against {@link RendererInternalApi} - if any method is renamed or
   * its signature changes, this line produces a compile error.
   *
   * The object is lazily created and cached per instance.
   *
   * @internal Used by KioskKeyboardRenderer only.
   */
  _getRendererApi(): RendererInternalApi {
    if (!this._rendererApi) {
      this._rendererApi = {
        _isShiftActive: () => this._isShiftActive(),
        _isCapsLock: () => this._isCapsLock(),
        _getResolvedLayout: () => this._getResolvedLayout(),
        _getKeyLabel: (key) => getKeyLabel(key, this._isShiftActive(), this._isCapsLock()),
        _getKeyAriaLabel: (key) => getKeyAriaLabel(key, this._isShiftActive(), this._isCapsLock()),
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

  /**
   * The effective layout NAME for the current state, shared by the renderer
   * (`_getResolvedLayout`) and the composition-middleware lookup
   * (`_tryCompositionMiddleware`) so the rendered surface and the active
   * middleware never resolve to different layouts. A user-driven `{layout:X}`
   * switch wins (it overrides the keyboardType constraint), then the
   * keyboardType constraint (Numpad/Numeric force their layout), then the
   * `layout` property. Mirrors the webc twin's `_resolvedLayoutName`.
   */
  private _resolvedLayoutName(): string {
    if (this._layoutSource === "user") return this.getLayout();
    return constrainedLayoutName(this.getKeyboardType()) ?? this.getLayout();
  }

  /** Resolve the effective layout used by the renderer. */
  private _getResolvedLayout(): LayoutDefinition {
    const layoutName = this._resolvedLayoutName();
    const resolved = registryGetLayoutOrDefault(layoutName, this._instanceLayoutsMap);
    const constrainedName = constrainedLayoutName(this.getKeyboardType());
    const base =
      constrainedName === null
        ? resolved
        : reconcileBaseSwitch(resolved, layoutName, constrainedName, {
            icon: LAYOUT_RETURN_ICON,
            ariaLabel: getText("ARIA_RETURN_TO_NUMBERS", "Return to numbers"),
          });
    // Opt-in Latin-diacritics: fill default variants onto matching base keys so
    // umlauts/accents are reachable from any layout. Author-declared `variants`
    // always win (applyVariantDefaults guarantees this).
    return this.getAccentVariants() ? applyVariantDefaults(base) : base;
  }

  /**
   * Resolves the effective, Shift/Caps-mapped variants for a rendered key from
   * its grid position, or `null` when the key declares none. Used by the popup
   * behavior to build the option listbox.
   */
  private _resolveKeyVariants(keyEl: HTMLElement): { base: string; glyphs: string[] } | null {
    const match = keyEl.id.match(KEY_ID_SUFFIX_RE);
    if (!match) return null;
    const row = Number.parseInt(match[1]!, 10);
    const col = Number.parseInt(match[2]!, 10);
    const key = this._getResolvedLayout()[row]?.[col];
    const variants = key?.variants;
    if (!variants || variants.length === 0) return null;
    const shift = this._isShiftActive();
    return {
      // The shifted base is what the key itself types under Shift or CapsLock.
      base: shift ? shiftedGlyph(key.value, key.shiftValue, this._isCapsLock()) : key.value,
      glyphs: shift ? toShiftVariants(variants) : [...variants],
    };
  }

  /**
   * Inserts a chosen accent variant through the same path a character key uses:
   * fire the cancelable `keyPress` (a consumer `preventDefault()` vetoes the
   * insert), route the glyph through the layout's composition middleware, then
   * auto-release one-shot Shift.
   *
   * Routing means "commit variant X" is identical to "press key X": a layout
   * whose middleware composes the glyph seeds the composition with it, while a
   * non-composition glyph finalizes any active preedit and falls back to a
   * literal insert at the caret. Shift auto-releases exactly once on every
   * branch - `_tryCompositionMiddleware` releases it when it consumes the glyph,
   * otherwise the literal-insert and veto branches release it here.
   */
  private _commitVariant(glyph: string): void {
    const shift = this._isShiftActive();
    if (this.fireKeyPress({ key: glyph, shiftKey: shift })) {
      if (!this._tryCompositionMiddleware(glyph)) {
        this._targetSession.insertText(glyph);
        this._shiftState.autoRelease();
      }
      return;
    }
    this._shiftState.autoRelease();
  }

  /**
   * Returns the control-owned accent-variant Popover from the hidden
   * `_variantPopover` aggregation, creating the reusable shell on first use.
   * The shell holds only structural options; `VariantPopupBehavior` rebuilds its
   * content, initial focus and aria-labelledby on every open. The framework
   * auto-destroys it with the control (no manual teardown in `exit`). Each call
   * mirrors the ambient content density, since a static-area popover cannot
   * inherit density by DOM ancestry.
   */
  private _getVariantPopover(): Popover {
    let popover = this.getAggregation("_variantPopover") as Popover | null;
    if (!popover) {
      // Derive a stable id from the control (as UI5 core controls id their own
      // internal sub-controls, e.g. sap.m.Select's `<id>-list`), rather than an
      // auto-generated `__popoverN`.
      popover = new Popover(`${this.getId()}-variantPopover`, {
        showHeader: false,
        showArrow: true,
        placement: PlacementType.VerticalPreferredTop,
        verticalScrolling: false,
        horizontalScrolling: false,
      });
      // Stable hook the theme uses to size the options to the anchor key and to
      // flatten the framework content frame, scoped to this control's popover.
      popover.addStyleClass(KIOSK_KEYBOARD_DOM.classes.variantPopover);
      this.setAggregation("_variantPopover", popover, true);
    }
    syncStyleClass("sapUiSizeCondensed", this, popover);
    syncStyleClass("sapUiSizeCompact", this, popover);
    return popover;
  }

  /**
   * Resolves and returns the active target control instance.
   *
   * This is a typed convenience over `_getActiveTargetId()` when controller
   * code needs the control object rather than the association ID string.
   *
   * @public
   * @since 0.1.0
   */
  getActiveControl<T extends Control = Control>(): T | null {
    const target = this._getTargetElement();
    return target instanceof Control ? (target as T) : null;
  }

  /** Default icons for special keys - used when the key has no explicit icon. */
  static readonly SPECIAL_KEY_ICONS: Readonly<Record<string, string>> = DEFAULT_SPECIAL_KEY_ICONS;

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
    return iconsGetKeyIcon(sKeyValue);
  }

  // ── UI5 event delegation ──

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
    this._backspaceRepeat.stop();
    this._variantPopup.stop();
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

    // EventSimulation maps EVERY mouse button's mousedown onto this simulated
    // touchstart, so only a primary press may drive a key: a right-click is the
    // context-menu gesture (`oncontextmenu`), not a key press. A genuine touch
    // carries no `button`, and so passes.
    if (isSecondaryPress(event)) return;

    const el = this._resolveKeyElementFromEventTarget(event.target);
    if (el) {
      // A press on any key while the accent popup is open dismisses it (the
      // popup's options live in the static area, so a key press is always
      // "outside"), then proceeds so the same tap also types the key. The
      // framework autoClose does not fire for the keyboard's own keys because of
      // the preventDefault above, so close it explicitly here. A key that has
      // variants may become a re-anchor, so its options stay up until the hold
      // claims them or `ontouchend` dismisses them for a plain tap.
      if (!el.hasAttribute(KIOSK_KEYBOARD_DOM.attributes.hasVariants)) {
        this._variantPopup.dismissOpen();
      }
      this._pressedKeyEl = el;
      el.classList.add(KIOSK_KEYBOARD_DOM.classes.keyPressed);
      // Safety net: if the window loses focus before touchend/touchcancel
      // fires (e.g. Alt-Tab during a mousedown, or a modal popup steals
      // focus), clear the pressed visual state so it does not stick.
      window.addEventListener("blur", this._boundClearPressedOnBlur);
      // Press-and-hold Backspace deletes continuously; the behavior arms the
      // repeat and later tells ontouchend to suppress its trailing delete.
      this._backspaceRepeat.onPress(el, this.getEnabled());
      // Press-and-hold a key with variants opens the accent popup; the behavior
      // arms the hold and later tells ontouchend to suppress its trailing tap.
      this._variantPopup.onPress(el, this.getEnabled());
    }
  }

  /**
   * Opens the accent-variant popup on right-click (contextmenu) for keys that
   * declare variants, so desktop users reach the popup without a long press.
   */
  oncontextmenu(event: Event): void {
    if (!this.getEnabled()) return;
    const el = this._resolveKeyElementFromEventTarget(event.target);
    if (!el || !el.hasAttribute(KIOSK_KEYBOARD_DOM.attributes.hasVariants)) return;
    event.preventDefault();
    this._clearPressedKeyState();
    this._variantPopup.openFor(el);
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
    // The mirror of the ontouchstart filter: a non-primary release is not a key
    // activation, and must not tear down a primary press that is still live.
    if (isSecondaryPress(event)) return;

    const pressed = this._clearPressedKeyState();

    if (!this.getEnabled() || !pressed) return;

    const el = this._resolveKeyElementFromEventTarget(event.target);
    const keyValue = pressed.dataset.key;

    // A hold that opened (or re-anchored) the popup owns this release: it
    // swallows the lift-off so it does not also insert the base glyph.
    const variantOwnsRelease = keyValue !== undefined && this._variantPopup.shouldSuppressRelease(keyValue);

    // Otherwise the gesture was a plain tap, so it dismisses as a press on any
    // other key would have. Decided before the returns below, so a release that
    // lands elsewhere or is swallowed by auto-repeat still closes the popup.
    if (!variantOwnsRelease) this._variantPopup.dismissOpen();

    if (el !== pressed) return;
    if (!keyValue) return;

    this._keyGridNav.setLastFocusedKeyId(pressed.id);

    // A held Backspace already deleted via auto-repeat; skip the release delete
    // so lifting off does not remove one extra character.
    if (this._backspaceRepeat.shouldSuppressRelease(keyValue)) return;

    if (variantOwnsRelease) return;

    this._handleKeyAction(keyValue, pressed);
  }

  ontouchcancel(): void {
    // The browser took the gesture away, so a re-anchor its hold parked must not
    // surface when the previous popup finishes closing.
    this._variantPopup.cancelPending();
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

  // ── Private: auto-show ──

  /** Returns true if any other KioskKeyboard instance already targets this input. */
  private _isTargetOfOther(inputId: string): boolean {
    for (const other of KioskKeyboard._instances) {
      if (other === this) continue;
      if (!isParticipating(other)) continue;
      if (other._getActiveTargetId() === inputId) return true;
      // With controls, the active target is only set on focus. However, the
      // controls list declares ownership: if the input is in another keyboard's
      // controls AND that keyboard has not been manually re-targeted to a
      // different input, the input is still claimed.
      const otherResolved = other._controlsDelegation.getResolvedControlIds();
      if (otherResolved.has(inputId)) {
        const otherActive = other._getActiveTargetId();
        // Claimed if: no active target yet (pre-focus), or the active target
        // IS this input, or the active target is also in controls (meaning the
        // keyboard hasn't been manually re-targeted outside its controls list).
        if (!otherActive || otherActive === inputId || otherResolved.has(otherActive)) {
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

  /** Whether `node` is inside the control-owned accent-variant Popover (rendered into the static area). */
  _isNodeInVariantPopover(node: Node | null): boolean {
    const popover = this.getAggregation("_variantPopover") as Popover | null;
    return popover?.getDomRef()?.contains(node) ?? false;
  }

  // ── Private: pointer and key actions ──

  /**
   * Whether a key can affect a composition buffer (CJK/dead-key) and must be
   * routed through middleware before default handling: {backspace}, {enter},
   * and regular character keys, but not layout/fkey switches.
   */
  private _keyAffectsComposition(keyValue: string): boolean {
    const kind = parseKeyAction(keyValue).kind;
    return kind !== "layout" && kind !== "fkey";
  }

  /**
   * Runs composition middleware (CJK/dead-key buffers) for keys that affect a
   * composition (see `_keyAffectsComposition`). Returns `true` when the
   * middleware consumed the key (caller should stop). Lazily instantiates the
   * middleware.
   */
  private _tryCompositionMiddleware(keyValue: string): boolean {
    if (!this._keyAffectsComposition(keyValue)) return false;
    if (!this._middleware) {
      const factory = registryGetMiddlewareFactory(this._resolvedLayoutName(), this._instanceMiddlewareMap);
      if (factory) this._middleware = factory();
    }
    if (this._middleware) {
      const targetEl = this._getTargetElement();
      const mwTarget = targetEl
        ? resolveWithCustomResolver(targetEl.getFocusDomRef(), this._getEffectiveResolver())
        : null;
      if (mwTarget && this._middleware.handleKey(keyValue, mwTarget)) {
        this._shiftState.autoRelease();
        return true;
      }
    }
    return false;
  }

  /**
   * Fires the cancelable `keyPress` event and, unless vetoed, deletes one
   * grapheme from the target. Shared by the single Backspace tap and the
   * auto-repeat tick. Returns `false` only when the key fired but nothing was
   * deleted (empty input / cursor at start), which the repeater uses to stop.
   */
  private _performBackspaceDelete(): boolean {
    if (!this.fireKeyPress({ key: "Backspace", shiftKey: this._isShiftActive() })) return true; // consumer vetoed this tick; keep the gesture alive
    return this._targetSession.handleBackspace();
  }

  private _handleKeyAction(keyValue: string, el: HTMLElement): void {
    const shift = this._isShiftActive();
    const action = parseKeyAction(keyValue);

    // Shift toggles before composition: the middleware would otherwise treat
    // it as a composition-affecting key.
    if (action.kind === "shift") {
      this._toggleShift(el);
      return;
    }

    // Composition middleware must see {backspace}/{enter}/chars/unknown tokens
    // (but not layout/fkey) before default handling.
    if (this._tryCompositionMiddleware(keyValue)) return;

    switch (action.kind) {
      case "backspace":
        this._performBackspaceDelete();
        return;

      case "enter":
        if (this.fireKeyPress({ key: "Enter", shiftKey: shift })) {
          this._targetSession.handleEnter();
        }
        return;

      case "layout": {
        // `base` re-engages the keyboardType constraint; any other pick is
        // user-driven and overrides it (webc parity).
        const name = action.target === LAYOUT_BASE ? this._baseLayout : action.target;
        const source = action.target === LAYOUT_BASE ? "external" : "user";
        this._performLayoutSwitch(name, source, "referenced by a {layout:*} key");
        return;
      }

      case "fkey": {
        // Fire keyPress first so consumers can prevent all downstream action
        // (including native F5 reload / F11 fullscreen in fKeyMode="Native").
        if (!this.fireKeyPress({ key: action.name, shiftKey: shift })) return;
        this._fKeyController.handle(action.name, shift);
        return;
      }

      case "unknown":
        // Unrecognized `{...}`-shaped value: not one of the built-in special
        // keys above. Fire keyPress so a consumer can still observe/handle it,
        // but do NOT insert the literal braces - that was a silent footgun (a
        // mistyped `{bcksp}`, or a custom `{paste}` key with no handler, typed
        // the text "{bcksp}" into the field).
        if (this.fireKeyPress({ key: action.raw, shiftKey: shift })) {
          Log.warning(
            `Unrecognized key token "${action.raw}": not a built-in special key. Ignoring (no text inserted).`,
            undefined,
            "ui5.kiosk.KioskKeyboard",
          );
        }
        this._shiftState.autoRelease();
        return;

      case "char": {
        // Regular character - resolve its Shift/Caps form (incl. CapsLock ß -> ẞ, #169).
        const effective = shift ? shiftedGlyph(action.text, el.dataset.shiftValue, this._isCapsLock()) : action.text;

        if (this.fireKeyPress({ key: effective, shiftKey: shift })) {
          this._targetSession.insertText(effective);
        }

        // Auto-release shift (not caps lock)
        this._shiftState.autoRelease();
        return;
      }

      default:
        // Exhaustiveness: every KeyAction kind is handled above ({shift} returns
        // earlier). A new variant fails to compile at this assertNever.
        return assertNever(action);
    }
  }

  /**
   * Inserts text at the caret of the active target, replacing any selection,
   * tracking the cursor exactly like a character key (fires UI5 `liveChange`).
   *
   * Designed to be called from a `keyPress` handler that owns a custom
   * `{...}` key (e.g. a clipboard-paste key). A safe no-op when there is no
   * active resolved target. Does not fire `keyPress` itself.
   *
   * @param text The text to insert.
   * @public
   * @since 0.1.0
   */
  insertText(text: string): void {
    this._targetSession.insertText(text);
  }

  /**
   * Deletes one grapheme before the caret of the active target (or the active
   * selection), exactly like the `{backspace}` key. Returns `true` when
   * something was removed, `false` otherwise (empty input, caret at start,
   * read-only/disabled target, or no active target).
   *
   * Designed to be called from a `keyPress` handler that owns a custom key.
   * Does not fire `keyPress` itself.
   *
   * @public
   * @since 0.1.0
   */
  deleteBackward(): boolean {
    return this._targetSession.handleBackspace();
  }

  /**
   * Returns the resolved native `<input>`/`<textarea>` of the active target,
   * or `null` when there is no active target or it has no textual DOM ref.
   *
   * Resolves through any instance/global target resolver, mirroring how the
   * built-in keys locate the element they type into. Useful from a `keyPress`
   * handler that owns a custom key and needs the live caret/selection.
   *
   * @public
   * @since 0.1.0
   */
  getActiveTargetElement(): HTMLInputElement | HTMLTextAreaElement | null {
    const element = this._getTargetElement();
    return element ? resolveWithCustomResolver(element.getFocusDomRef(), this._getEffectiveResolver()) : null;
  }

  private _toggleShift(el: HTMLElement): void {
    this._shiftState.toggle();

    // Optimistic DOM update: apply shift-active / caps-lock classes
    // immediately for instant visual feedback, before the framework
    // re-render cycle.  Same pattern as sap.m.Button._activeButton(),
    // sap.m.ToggleButton.setPressed(), and this control's own
    // ontouchstart keyPressed class.
    //
    // This duplicates the class logic in KioskKeyboardRenderer's
    // addKeyClasses hook. Custom renderers that override addKeyClasses
    // for shift styling must also override _toggleShift to keep the
    // optimistic path in sync.
    const isShifted = this._shiftState.isShifted;
    const isCaps = this._shiftState.isCapsLock;
    el.classList.toggle(KIOSK_KEYBOARD_DOM.classes.keyShiftActive, isShifted);
    el.classList.toggle(KIOSK_KEYBOARD_DOM.classes.keyCapsLock, isCaps);
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
}
