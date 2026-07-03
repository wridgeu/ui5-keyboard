// Main entry point: defines the component class.
//
// The built-in layouts and composition middleware are pulled into the module
// graph as genuine value imports by their registries (core/layout-registry.js
// and core/middleware-registry.js, which build their maps from direct imports).
// They are therefore bundled wherever this entry is (including the
// ui5-tooling-modules wrapper that resolves the main entry from the CEM) and
// cannot be dropped by tree-shaking. Side-effect-only imports would be.

import UI5Element from "@ui5/webcomponents-base/dist/UI5Element.js";
import customElement from "@ui5/webcomponents-base/dist/decorators/customElement.js";
import property from "@ui5/webcomponents-base/dist/decorators/property.js";
import event from "@ui5/webcomponents-base/dist/decorators/event-strict.js";
import jsxRenderer from "@ui5/webcomponents-base/dist/renderer/JsxRenderer.js";
import { reRenderAllUI5Elements } from "@ui5/webcomponents-base/dist/Render.js";
import type { ChangeInfo } from "@ui5/webcomponents-base/dist/UI5Element.js";

import { ShiftState } from "./core/shift-state.js";
import { resolveWithCustomResolver, KEY_ID_SUFFIX_RE } from "./core/dom-utils.js";
import { insertText, handleBackspace } from "./core/input-operations.js";
import {
  SECONDARY_LAYOUTS,
  getLayoutOrDefault,
  getLocaleLayout,
  getRegisteredLayout,
  getRegisteredLayoutNames,
  isBuiltInLayout,
} from "./core/layout-registry.js";
import { getMiddlewareFactory } from "./core/middleware-registry.js";
import { MemoMapView } from "./core/memo-map-view.js";
import { getText, setI18nResolver } from "./core/i18n.js";
import { BackspaceRepeatController } from "./core/backspace-repeat-controller.js";
import { ResponsiveSizingController } from "./core/responsive-sizing-controller.js";
import { NativeInputModeSuppression } from "./core/native-inputmode-suppression.js";
import { classifyKeyToken, parseLayoutToken, LAYOUT_BASE } from "./core/key-token.js";
import { AnnouncementQueue } from "./core/announcement-queue.js";
import { PhysicalKeyHighlightController } from "./core/physical-key-highlight-controller.js";
import { AutoShowController } from "./core/auto-show-controller.js";
import { FKeyController, NATIVE_DISPATCHABLE_KEYS } from "./core/fkey-controller.js";
import { KeyGridNavigation } from "./core/key-grid-navigation.js";
import {
  KeyboardType,
  MobileKeyboard,
  FKeyMode,
  type CompositionMiddleware,
  type LayoutDefinition,
  type KeyDefinition,
  type KeyPressEventDetail,
  type LayoutChangeEventDetail,
  type KeyboardTypeChangeEventDetail,
  type ActiveControlChangeEventDetail,
  type OpenStateChangeEventDetail,
} from "./types.js";

import KioskKeyboardTemplate from "./KioskKeyboardTemplate.js";
import { KIOSK_KEYBOARD_DOM } from "./core/dom-contract.js";
import styles from "./generated/themes/KioskKeyboard.css.js";

export type { KioskKeyboardDomContract } from "./core/dom-contract.js";

// ── Register ui5-icon + needed icons so they resolve inside shadow DOM ──
import "@ui5/webcomponents/dist/Icon.js";
import "@ui5/webcomponents-icons/dist/arrow-top.js";
import "@ui5/webcomponents-icons/dist/arrow-left.js";
import "@ui5/webcomponents-icons/dist/accept.js";
import "@ui5/webcomponents-icons/dist/locked.js";
import "@ui5/webcomponents-icons/dist/nav-back.js";

// ── Icon name map (used by the template to render <ui5-icon>) ──
const ICON_MAP: Readonly<Record<string, string>> = {
  "{shift}": "arrow-top",
  "{shift:capsLock}": "locked",
  "{enter}": "accept",
  "{backspace}": "arrow-left",
};
const SAP_ICON_PREFIX = "sap-icon://";

/** Icon for a `{layout:base}` key kept under the Numpad/Numeric constraint. */
const LAYOUT_RETURN_ICON = "sap-icon://nav-back";

// ── Valid enum values for string properties (derived from enums) ──
const VALID_KEYBOARD_TYPES: ReadonlySet<string> = new Set(Object.values(KeyboardType));
const VALID_FKEY_MODES: ReadonlySet<string> = new Set(Object.values(FKeyMode));
const VALID_MOBILE_KEYBOARDS: ReadonlySet<string> = new Set(Object.values(MobileKeyboard));

/**
 * Warns about an out-of-range enum property value. Returns `true` when the
 * value is invalid (and a warning was emitted) so the caller can coerce it to
 * its default; `false` when the value is valid.
 */
function isInvalidEnumValue(propName: string, value: string, validValues: ReadonlySet<string>): boolean {
  if (validValues.has(value)) return false;
  console.warn(`[kiosk-keyboard] Invalid ${propName} "${value}". Valid values: ${[...validValues].join(", ")}.`);
  return true;
}

// ── Internal provenance types ──

/** Who last set keyboardType. "auto:VALUE" = set by _setKeyboardTypeInternal for VALUE. */
type KeyboardTypeSource = "unset" | "explicit" | `auto:${string}`;

/** Why _targetElement was set: drives focusout cleanup policy. */
type TargetSource = "autoShow" | "explicit";

/** Why _currentLayout was last changed: drives _getResolvedLayout bypass. */
type LayoutSource = "user" | "external";

/** Display and ARIA labels for built-in special keys. */
const SPECIAL_KEY_LABELS: Record<string, string> = {
  "{shift}": "KEY_SHIFT",
  "{enter}": "KEY_ENTER",
  "{backspace}": "KEY_BACKSPACE",
  " ": "KEY_SPACE",
};

/**
 * Key values already warned about for a missing accessible name, so re-renders
 * do not repeat the warning. Module-level by design, matching the sibling
 * `core/fkey-controller.ts` `warnedUnsupportedFKeys`: a custom element has no
 * FLP-style "last instance destroyed" hook (`onExitDOM` fires on every detach,
 * including transient reattach), so per-page deduplication is the correct
 * lifetime. Intentionally NOT cleared on disconnect, unlike `kiosk-keyboard`'s
 * `clearLabelWarnings`, which the UI5 control clears on last-instance exit
 * because UI5 controls have a meaningful destroy boundary.
 */
const warnedMissingLabels = new Set<string>();

/**
 * Reshapes `{layout:base}` keys for a surface under the Numpad/Numeric
 * constraint: drop them when `useless`, else relabel to a back icon (they return
 * to numbers, not letters, so the built-in "ABC" label misleads). A caller-set
 * `ariaLabel` wins. Non-mutating. Mirrors the kiosk twin.
 */
function reconcileBaseSwitch(layout: LayoutDefinition, useless: boolean): LayoutDefinition {
  let changed = false;
  const next = layout.map((row) =>
    row.flatMap((key) => {
      if (parseLayoutToken(key.value) !== LAYOUT_BASE) return [key];
      changed = true;
      if (useless) return [];
      return [
        {
          ...key,
          label: "",
          icon: LAYOUT_RETURN_ICON,
          ariaLabel: key.ariaLabel ?? getText("ARIA_RETURN_TO_NUMBERS", "Return to numbers"),
        },
      ];
    }),
  );
  return changed ? next.filter((row) => row.length > 0) : layout;
}

/**
 * `<kiosk-keyboard>` - Native web component for on-screen virtual keyboard.
 *
 * Built on the UI5 Web Components framework (`UI5Element`) for automatic SAP
 * theming, reactive properties, and JSX-based rendering. Consumable in any
 * framework (HTML, React, Vue, Angular) and inside UI5 apps via
 * `WebComponent.extend()` bridge.
 *
 * @class
 * @extends UI5Element
 * @public
 * @since 0.1.0
 */
@customElement({
  tag: "kiosk-keyboard",
  renderer: jsxRenderer,
  template: KioskKeyboardTemplate,
  styles,
  languageAware: true,
})
/**
 * Fired when a key is pressed on the virtual keyboard.
 *
 * Call `event.preventDefault()` to suppress the default input behavior.
 *
 * @param {string} key - The key value (character, `{shift}`, `{backspace}`, etc.)
 * @param {boolean} shiftKey - Whether Shift is active.
 * @param {string} [char] - The resolved character (after shift). `undefined` for action keys.
 * @public
 * @since 0.1.0
 */
@event("key-press", { bubbles: true, cancelable: true })
/**
 * Fired when the docked keyboard panel opens.
 *
 * @param {HTMLInputElement | HTMLTextAreaElement | null} activeElement
 *   The active target input at the moment the keyboard opens, or `null`.
 * @public
 * @since 0.1.0
 */
@event("after-open", { bubbles: true })
/**
 * Fired when the docked keyboard panel closes.
 *
 * @param {HTMLInputElement | HTMLTextAreaElement | null} activeElement
 *   The target input that was active just before the keyboard closed,
 *   or `null`.
 * @public
 * @since 0.1.0
 */
@event("after-close", { bubbles: true })
/**
 * Fired when the active layout changes (user switch or locale resolution).
 *
 * @param {string} layout - The new layout name.
 * @public
 * @since 0.1.0
 */
@event("layout-change", { bubbles: true })
/**
 * Fired when the keyboard type changes (manual or auto-detected).
 *
 * @param {string} keyboardType - The new keyboard type.
 * @param {string} previousKeyboardType - The previous keyboard type.
 * @param {boolean} autoDetected - Whether the change was auto-detected.
 * @public
 * @since 0.1.0
 */
@event("keyboard-type-change", { bubbles: true })
/**
 * Fired when the active control changes (focus switches to a different input
 * in auto-show mode, or `setTargetElement()` is called programmatically).
 * @param {HTMLInputElement | HTMLTextAreaElement | null} activeElement The new active element, or null if cleared.
 * @public
 * @since 0.1.0
 */
@event("active-control-change", { bubbles: true })
class KioskKeyboard extends UI5Element {
  /**
   * Stable DOM hook contract for tests and DOM assertions.
   *
   * Prefer these selectors and class names over hard-coded strings.
   * Styling customizations should continue to use host attributes and the
   * documented `--kiosk-keyboard-*` CSS custom properties instead.
   */
  static readonly DOM = KIOSK_KEYBOARD_DOM;

  override eventDetails!: {
    "key-press": KeyPressEventDetail;
    "after-open": OpenStateChangeEventDetail;
    "after-close": OpenStateChangeEventDetail;
    "layout-change": LayoutChangeEventDetail;
    "keyboard-type-change": KeyboardTypeChangeEventDetail;
    "active-control-change": ActiveControlChangeEventDetail;
  };

  // ── Static read-only registry getters ──

  /**
   * Get a built-in layout definition by name.
   * @param name Layout name.
   * @returns The layout definition, or undefined if not found.
   * @public
   * @since 0.1.0
   */
  static getRegisteredLayout(name: string): LayoutDefinition | undefined {
    return getRegisteredLayout(name);
  }

  /**
   * Get all built-in layout names.
   * @returns Array of layout names.
   * @public
   * @since 0.1.0
   */
  static getRegisteredLayoutNames(): string[] {
    return getRegisteredLayoutNames();
  }

  /**
   * Check whether a layout name belongs to a built-in layout.
   * @param name Layout name.
   * @returns True if the layout is built-in.
   * @public
   * @since 0.1.0
   */
  static isBuiltInLayout(name: string): boolean {
    return isBuiltInLayout(name);
  }

  /**
   * Check whether a layout is secondary (non-alphabetic).
   * Secondary layouts cannot become the base layout.
   * @param name Layout name to check.
   * @returns True if the layout is secondary.
   * @public
   * @since 0.1.0
   */
  static isSecondaryLayout(name: string): boolean {
    return SECONDARY_LAYOUTS.has(name);
  }

  /**
   * Get the layout name for the current locale.
   * @returns The layout name for the current locale.
   * @public
   * @since 0.1.0
   */
  static getLocaleLayout(): string {
    return getLocaleLayout();
  }

  /**
   * Set a custom i18n resolver callback for programmatic text overrides.
   *
   * The resolver is called for every translatable text the keyboard renders
   * (key labels, ARIA labels, live region announcements). It receives:
   *
   * - `key`: the i18n key (e.g. `"KEY_SHIFT"`, `"ARIA_KEYBOARD_OPENED"`)
   * - `locale`: the active locale language subtag (e.g. `"en"`, `"de"`, `"fr"`)
   * - `defaultText`: the text resolved from the built-in locale bundle
   *
   * Return a `string` to override that text, or `undefined` to keep the default.
   *
   * Resolution order: custom resolver (highest priority) -> UI5 WC i18n bundle (locale-aware) -> English defaults.
   * Connected keyboard instances re-render asynchronously after the resolver changes.
   *
   * If the resolver throws, the error is logged and the default text is used.
   * Pass `null` to clear a previously set resolver.
   *
   * Example (the `@example` tag is intentionally avoided: it is rejected by
   * the CEM dev-mode validation; see docs/kiosk-webc/CUSTOM-ELEMENTS-MANIFEST.md):
   * ```ts
   * // Add French translations
   * KioskKeyboard.setI18nResolver((key, locale, defaultText) => {
   *   const fr = { KEY_SHIFT: "Maj", KEY_ENTER: "Entree", KEY_SPACE: "Espace" };
   *   if (locale === "fr" && fr[key]) return fr[key];
   *   return undefined; // fall through to built-in text
   * });
   *
   * // Clear the resolver
   * KioskKeyboard.setI18nResolver(null);
   * ```
   *
   * @param fn Resolver function, or `null` to clear.
   * @public
   * @since 0.1.0
   */
  static setI18nResolver(fn: ((key: string, locale: string, defaultText: string) => string | undefined) | null): void {
    setI18nResolver(fn);
    KioskKeyboard._queueI18nRefresh();
  }

  // ── Public reactive properties (synced with attributes) ──

  /**
   * The active keyboard layout name.
   *
   * When empty, the keyboard resolves the layout from the current locale
   * (see {@link KioskKeyboard.getLocaleLayout getLocaleLayout}). Per-instance
   * locale overrides can be supplied via the `instanceLocaleLayouts` property.
   *
   * @default ""
   * @public
   * @since 0.1.0
   */
  @property()
  layout = "";

  /**
   * The keyboard type variant to display.
   *
   * @default "Full"
   * @public
   * @since 0.1.0
   */
  @property()
  keyboardType: `${KeyboardType}` = "Full";

  /**
   * Whether the keyboard renders in docked mode (fixed to the bottom of the viewport).
   *
   * @default false
   * @public
   * @since 0.1.0
   */
  @property({ type: Boolean })
  docked = false;

  /**
   * Whether the keyboard automatically opens/closes when an input receives/loses focus.
   * Only effective when `docked` is `true`.
   *
   * @default false
   * @public
   * @since 0.1.0
   */
  @property({ type: Boolean })
  autoShow = false;

  /**
   * Whether the keyboard automatically detects the appropriate keyboard type
   * based on the focused input's `type` and `inputmode` attributes.
   *
   * @default false
   * @public
   * @since 0.1.0
   */
  @property({ type: Boolean })
  autoType = false;

  /**
   * Whether the keyboard is disabled. A disabled keyboard does not respond
   * to key presses or auto-show triggers.
   *
   * @default false
   * @public
   * @since 0.1.0
   */
  @property({ type: Boolean })
  disabled = false;

  /**
   * Comma-separated list of target input element IDs. The keyboard targets
   * these elements via focus delegation. When a single ID is provided,
   * it acts as the direct target.
   *
   * @default ""
   * @public
   * @since 0.1.0
   */
  @property()
  controls = "";

  /**
   * Accessible name for the keyboard region (ARIA label).
   *
   * @default ""
   * @public
   * @since 0.1.0
   */
  @property()
  accessibleName = "";

  /**
   * Controls behavior on touch devices: defer to native keyboard,
   * always show custom, or auto-detect.
   *
   * @default "Auto"
   * @public
   * @since 0.1.0
   */
  @property()
  mobileKeyboard: `${MobileKeyboard}` = "Auto";

  /**
   * Controls how function key presses are handled.
   *
   * @default "Virtual"
   * @public
   * @since 0.1.0
   */
  @property()
  fKeyMode: `${FKeyMode}` = "Virtual";

  // ── Public programmatic-only properties (no attribute mirror) ──

  /**
   * Per-instance layout overrides. Resolution order is
   * **instance map -> built-in**, so an entry here shadows the
   * built-in of the same name for this element only. Use this to
   * supply a custom layout, or to override a built-in (e.g. swap
   * the German layout) without affecting other elements.
   *
   * Programmatic only: this property accepts a JS object (not a
   * stringifiable attribute), so it cannot be set via HTML markup.
   *
   * @default null
   * @public
   * @since 0.1.0
   */
  @property({ type: Object, noAttribute: true })
  instanceLayouts: Record<string, LayoutDefinition> | null = null;

  /**
   * Per-instance locale-to-layout overrides. Resolution order is
   * **instance map -> built-in locale map -> default layout**. Keys
   * are BCP-47 prefixes (e.g. `"de"`, `"de-at"`); values are layout
   * names.
   *
   * Programmatic only: accepts a JS object (`Record<string, string>`).
   *
   * @default null
   * @public
   * @since 0.1.0
   */
  @property({ type: Object, noAttribute: true })
  instanceLocaleLayouts: Record<string, string> | null = null;

  /**
   * Per-instance composition middleware overrides keyed by layout name.
   *
   * Programmatic only: accepts a JS object whose values are factory
   * functions returning a `CompositionMiddleware`.
   *
   * @default null
   * @public
   * @since 0.1.0
   */
  @property({ type: Object, noAttribute: true })
  instanceMiddleware: Record<string, () => CompositionMiddleware> | null = null;

  // ── Internal reactive state (triggers re-render, no attribute) ──

  @property({ noAttribute: true })
  _currentLayout = "";

  @property({ type: Boolean, noAttribute: true })
  _shifted = false;

  @property({ type: Boolean, noAttribute: true })
  _capsLock = false;

  @property({ noAttribute: true })
  _liveRegionText = "";

  // ── Backing field for the `open` getter/setter below.
  //    Direct writes intentionally bypass the setter when the host is being
  //    torn down or when invalidation flow already ran in the same tick. ──
  private _openValue = false;

  // ── Non-reactive internal state ──

  private _shiftState = new ShiftState(() => this._syncShiftState());
  private _middleware: CompositionMiddleware | null = null;
  private _baseLayout = "";
  private _keyboardTypeSource: KeyboardTypeSource = "unset";
  private _targetElement: HTMLInputElement | HTMLTextAreaElement | null = null;
  private _targetSource: TargetSource = "explicit";
  private _targetResolver: ((el: HTMLElement) => HTMLInputElement | HTMLTextAreaElement | null) | null = null;
  /** Accessed by the JSX template for highlight class binding - not private. */
  _highlightedKey: string | null = null;
  private _layoutSource: LayoutSource = "external";
  /** Owns the ARIA live-region announcement queue and its drain timer. */
  private readonly _announcements = new AnnouncementQueue({
    isConnected: () => this.isConnected,
    setLiveRegionText: (text) => {
      this._liveRegionText = text;
    },
  });

  // ── Inputmode suppression (ref-counted, shared across instances) ──
  /** Owns the `inputmode="none"` swap and its cross-instance refcount. */
  private readonly _inputModeSuppression = new NativeInputModeSuppression(() => this._resolveTarget());

  // ── Multi-keyboard instance isolation ──
  private static readonly _instances = new Set<KioskKeyboard>();
  private static _pendingI18nRefresh = false;
  private static _nextAutoId = 0;

  private static _queueI18nRefresh(): void {
    if (KioskKeyboard._pendingI18nRefresh) return;
    KioskKeyboard._pendingI18nRefresh = true;

    requestAnimationFrame(() => {
      KioskKeyboard._pendingI18nRefresh = false;
      if (KioskKeyboard._instances.size === 0) return;
      void reRenderAllUI5Elements({ tag: KioskKeyboard.getMetadata().getTag() });
    });
  }

  // ── Listener controllers (one per feature; presence == attached) ──
  private _hostAbort: AbortController | null = null;
  private _escapeAbort: AbortController | null = null;

  // ── Auto-show (document focusin/focusout) ──
  /** Owns the focus listeners, deferred close, and cross-instance claim checks. */
  private readonly _autoShow = new AutoShowController(this, {
    getTargetElement: () => this._targetElement,
    getTargetSource: () => this._targetSource,
    getControlsList: () => this._controlsList,
    getKeyboardTypeSource: () => this._keyboardTypeSource,
    resolveInputFrom: (el) => this._resolveInputFrom(el),
    setKeyboardTypeInternal: (value) => this._setKeyboardTypeInternal(value),
    setTarget: (el, source) => {
      this._targetElement = el;
      this._targetSource = source;
    },
    resetTargetContext: () => {
      this._shiftState.reset();
      if (this._middleware) {
        this._middleware.commit();
        this._middleware = null;
      }
    },
    show: () => this.show(),
    close: () => this.close(),
    restoreInputMode: () => this._inputModeSuppression.restore(),
    suppressInputMode: () => this._inputModeSuppression.suppress(),
    syncPhysicalKeyHighlight: () => this._physicalKeyHighlight.sync(),
    fireActiveControlChange: (el) => {
      this.fireDecoratorEvent("active-control-change", { activeElement: el });
    },
  });

  // ── Physical keyboard highlight ──
  /** Owns the physical-key highlight listeners and physical-modifier shift sync. */
  private readonly _physicalKeyHighlight = new PhysicalKeyHighlightController(
    {
      getShadowRoot: () => this.shadowRoot,
      resolveTarget: () => this._resolveTarget(),
      setHighlightedKey: (value) => {
        this._highlightedKey = value;
      },
      syncShiftFromPhysical: (shiftKey, capsLock) => {
        this._shiftState.syncFromPhysical(shiftKey, capsLock);
      },
    },
    NATIVE_DISPATCHABLE_KEYS,
  );

  // ── Bound listeners (document-level) ──
  private readonly _boundEscape = (e: Event) => {
    if (e instanceof KeyboardEvent) this._onDocumentEscape(e);
  };
  private readonly _boundTouchStart = (e: Event) => {
    const target = (e.target as HTMLElement).closest?.(KIOSK_KEYBOARD_DOM.selectors.key);
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
    const keyEl = (el as HTMLElement | null)?.closest<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyHook);
    if (keyEl) keyEl.click();
  };

  // ── Backspace press-and-hold auto-repeat ──
  /** Owns the pointer gesture, repeat timer, and trailing-click suppression. */
  private readonly _backspaceRepeat = new BackspaceRepeatController(this, () => this._performBackspaceRepeatDelete());

  // ── Responsive sizing (ResizeObserver-driven height classes) ──
  /** Owns the ResizeObserver and height-responsive class application. */
  private readonly _responsiveSizing = new ResponsiveSizingController(this);

  // ── F-key dispatch ──
  /** Owns `fKeyMode`-driven F-key dispatch (native keydown + caret navigation). */
  private readonly _fKeyController = new FKeyController({
    getFKeyMode: () => this.fKeyMode,
    resolveTarget: () => this._resolveTarget(),
  });

  // ── Arrow-key grid navigation ──
  /** Owns roving-tabindex grid navigation and the last-focused-key tracking. */
  private readonly _keyGridNav = new KeyGridNavigation({
    getResolvedLayout: () => this._getResolvedLayout(),
    getShadowRoot: () => this.shadowRoot,
    getComponentId: () => this._componentId,
  });

  // ── Pre-bound template handlers (avoids per-render allocation) ──
  readonly _boundOnKeyClick = this._onKeyClick.bind(this);
  readonly _boundOnKeyMouseDown = this._onKeyMouseDown.bind(this);
  readonly _boundOnKeyDown = this._keyGridNav.onKeyDown.bind(this._keyGridNav);

  /**
   * Whether the docked keyboard panel is currently visible.
   *
   * Setting `open = true` opens the keyboard (equivalent to `show()`),
   * setting it to `false` closes it (equivalent to `close()`).
   *
   * Follows the same reactive-property-on-setter pattern used by
   * `@ui5/webcomponents` Popup/Dialog (the `@property` decorator makes
   * the attribute observable so UI5 bridge controls can bind to it).
   *
   * @default false
   * @public
   * @since 0.1.0
   */
  @property({ type: Boolean })
  set open(value: boolean) {
    if (this._openValue === value) return;
    this._openValue = value;
    if (!this.isConnected) return; // handled in onEnterDOM
    if (value) {
      this._performOpen();
    } else {
      this._performClose();
    }
  }

  get open(): boolean {
    return this._openValue;
  }

  private get _controlsList(): string[] {
    return this.controls
      ? this.controls
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

  override onEnterDOM(): void {
    KioskKeyboard._instances.add(this);
    this._autoShow.register();

    if (!this._baseLayout) {
      this._baseLayout = this.layout || this._localeLayout();
      if (!this.layout) {
        this._currentLayout = this._baseLayout;
      }
    }

    this._autoShow.sync();
    this._physicalKeyHighlight.sync();

    if (this.docked) {
      this._attachEscapeListener();
    }

    // Handle open=true set before DOM connection (same pattern as ui5-dialog).
    // Delegate unconditionally - _performOpen() already resets _openValue when
    // !docked or native-deferred, preventing stale open state.
    if (this._openValue) {
      this._performOpen();
    }

    // Touch events need { passive: false } for preventDefault() which JSX can't express.
    // touchstart prevents input blur; touchend processes the key press (because
    // preventDefault on touchstart suppresses the browser's synthesized click).
    this._hostAbort = new AbortController();
    const { signal } = this._hostAbort;
    this.shadowRoot!.addEventListener("touchstart", this._boundTouchStart, { passive: false, signal });
    this.shadowRoot!.addEventListener("touchend", this._boundTouchEnd, { signal });

    // Backspace press-and-hold auto-repeat (pointer gesture + trailing-click suppression).
    this._backspaceRepeat.attach(signal);

    this._responsiveSizing.setup();
  }

  override onExitDOM(): void {
    if (this._middleware) {
      this._middleware.reset();
      this._middleware = null;
    }
    KioskKeyboard._instances.delete(this);
    this._autoShow.teardown();
    this._physicalKeyHighlight.teardown();
    this._responsiveSizing.teardown();
    this._inputModeSuppression.restore();
    this._detachEscapeListener();
    this._backspaceRepeat.stop();
    this._hostAbort?.abort();
    this._hostAbort = null;
    this._announcements.teardown();
    // Fire after-close before disconnecting so direct listeners still see it.
    // Cannot use `this.open = false` here - isConnected is already false,
    // so the setter skips side effects. Handle cleanup manually.
    if (this._openValue) {
      const activeElement = this._targetElement;
      this._openValue = false;
      this.fireDecoratorEvent("after-close", { activeElement });
    }

    this._targetElement = null;
    this._targetSource = "explicit";
    this._targetResolver = null;

    this._autoShow.unregister();

    this._keyGridNav.setLastFocusedKeyId(null);
  }

  override onAfterRendering(): void {
    // Announce pending live region text (from show/close/shift). Queue is
    // drained sequentially with a small gap so AT clients pick up each entry.
    this._announcements.flush();

    // Sync observer targets so newly rendered root elements are observed.
    // Responsive height classes live on the host element (not in shadow DOM),
    // so they survive template re-renders and don't need reapplication here.
    // Actual height class updates are handled by the ResizeObserver callback
    // (coalesced via rAF in the controller), avoiding forced reflow in the
    // render frame.
    const root = this.shadowRoot?.querySelector<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.root);
    if (root) this._responsiveSizing.syncObserverTargets(root);
  }

  override onInvalidation(changeInfo: ChangeInfo): void {
    const { name } = changeInfo;

    if (name === "layout") {
      // A programmatic layout change is external-sourced and re-engages constraints.
      this._applyLayout(this.layout, "external");
    }
    if (name === "keyboardType") {
      if (isInvalidEnumValue("keyboardType", this.keyboardType, VALID_KEYBOARD_TYPES)) {
        // Use _setKeyboardTypeInternal so the re-entrant onInvalidation
        // sees an "auto:" source and does not lock out future auto-detection.
        this._setKeyboardTypeInternal("Full");
        return;
      }
      const autoDetected = this._keyboardTypeSource === `auto:${this.keyboardType}`;
      this._keyboardTypeSource = autoDetected ? "unset" : "explicit";
      // Reset user layout switch and shift state - a keyboardType change implies a new layout context
      this._layoutSource = "external";
      this._shiftState.reset();
      // The surface swap ends any in-progress composition: commit the preedit
      // and drop the middleware so the next key resolves against the new
      // effective layout (mirrors _applyLayout).
      if (this._middleware) {
        this._middleware.commit();
        this._middleware = null;
      }
      const previousKeyboardType =
        typeof changeInfo.oldValue === "string" && VALID_KEYBOARD_TYPES.has(changeInfo.oldValue)
          ? (changeInfo.oldValue as `${KeyboardType}`)
          : "Full";
      this.fireDecoratorEvent("keyboard-type-change", {
        keyboardType: this.keyboardType,
        previousKeyboardType,
        autoDetected,
      });
    }
    if (name === "fKeyMode" && isInvalidEnumValue("fKeyMode", this.fKeyMode, VALID_FKEY_MODES)) {
      this.fKeyMode = "Virtual";
      return;
    }
    if (
      name === "mobileKeyboard" &&
      isInvalidEnumValue("mobileKeyboard", this.mobileKeyboard, VALID_MOBILE_KEYBOARDS)
    ) {
      this.mobileKeyboard = "Auto";
      return;
    }
    if (name === "docked" || name === "autoShow") {
      this._autoShow.sync();
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
    if (name === "instanceMiddleware") {
      // The active middleware is cached lazily on first key press; without
      // this reset, a runtime swap of `instanceMiddleware` would be ignored
      // until the next layout switch.
      if (this._middleware) {
        this._middleware.reset();
        this._middleware = null;
      }
    }
  }

  // ── Public API ──

  /**
   * Opens the docked keyboard. Equivalent to setting `open = true`.
   * @public
   * @since 0.1.0
   */
  show(): void {
    this.open = true;
  }

  /**
   * Closes the docked keyboard. Equivalent to setting `open = false`.
   * @public
   * @since 0.1.0
   */
  close(): void {
    this.open = false;
  }

  /** Executes the open side effects. Called from the `open` setter. */
  private _performOpen(): void {
    if (!this.docked) {
      console.warn("[kiosk-keyboard] open has no effect when docked=false.");
      // Write backing field directly - going through the setter would trigger
      // _performClose() and fire a spurious after-close for a keyboard that
      // never actually opened (same pattern as ui5-dialog's openPopup rejection).
      this._openValue = false;
      return;
    }
    if (this._shouldDeferToNative()) {
      this._openValue = false;
      return;
    }
    // Auto-target when nothing is targeted yet: _resolveTarget falls back to
    // the single-entry `controls` lookup.
    if (!this._targetElement) {
      const input = this._resolveTarget();
      if (input) {
        input.focus();
        this._targetElement = input;
        this._targetSource = "explicit";
      }
    }
    this._inputModeSuppression.suppress();
    this._announcements.announce(getText("ARIA_KEYBOARD_OPENED", "Virtual keyboard opened"));
    this.fireDecoratorEvent("after-open", { activeElement: this._targetElement });
  }

  /** Executes the close side effects. Called from the `open` setter. */
  private _performClose(): void {
    const activeElement = this._targetElement;
    this._inputModeSuppression.restore();
    this._announcements.announce(getText("ARIA_KEYBOARD_CLOSED", "Virtual keyboard closed"));
    this.fireDecoratorEvent("after-close", { activeElement });
  }

  /**
   * Programmatically sets the input element that receives typed characters.
   * @param el The input or textarea element to type into, or `null` to clear.
   * @public
   * @since 0.1.0
   */
  setTargetElement(el: HTMLInputElement | HTMLTextAreaElement | null): void {
    const previous = this._targetElement;

    // Restore the old target's inputmode before switching so it's not left suppressed.
    if (this._openValue) {
      this._inputModeSuppression.restore();
    }

    // Reset shift/caps only on a real switch; a same-input re-set is a caret
    // reposition that keeps the armed shift (parity with the UI5 twin).
    if (el !== previous) {
      this._shiftState.reset();
    }

    this._targetElement = el;
    this._targetSource = "explicit";

    if (this._openValue) {
      this._inputModeSuppression.suppress();
    }
    // Always sync highlight: cleans up listeners on the old target even
    // when the keyboard is closed, preventing a listener leak.
    this._physicalKeyHighlight.sync();

    if (el !== previous) {
      this.fireDecoratorEvent("active-control-change", { activeElement: el });
    }
  }

  /**
   * Sets a custom resolver that the keyboard uses to locate the native
   * input/textarea inside a host element. Called during auto-show focus
   * handling and `controls` resolution with the focused (or looked-up) element.
   *
   * Return the native `<input>` or `<textarea>` to type into, or `null`
   * to fall back to the built-in resolver (which traverses light DOM and
   * up to 3 levels of shadow DOM).
   * @param resolver Custom resolver function, or `null` to clear.
   * @public
   * @since 0.1.0
   */
  setTargetResolver(resolver: ((el: HTMLElement) => HTMLInputElement | HTMLTextAreaElement | null) | null): void {
    this._targetResolver = resolver;
  }

  /**
   * Resets `keyboardType` to `"Full"` and re-enables auto-type detection.
   * @public
   * @since 0.1.0
   */
  resetKeyboardType(): void {
    this._keyboardTypeSource = "unset";
    this._setKeyboardTypeInternal("Full");
  }

  /**
   * Recomputes responsive height classes from the current live DOM.
   *
   * Call this after runtime styling changes that alter intrinsic keyboard height
   * without producing a reliable resize signal, for example when compact mode
   * or custom CSS vars change the underlying natural content height within a
   * fixed-height host.
   *
   * The class update is deferred to the next animation frame to avoid
   * forced reflow. Query the DOM for responsive classes after a
   * `requestAnimationFrame` callback, not synchronously.
   *
   * @public
   * @since 0.1.0
   */
  refreshResponsiveState(): void {
    const root = this.shadowRoot?.querySelector<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.root);
    if (!root) return;

    this._responsiveSizing.syncObserverTargets(root);

    // Schedule responsive class update via rAF to avoid forced reflow.
    // Host element classes survive shadow DOM re-renders, so synchronous
    // reapplication is unnecessary.
    this._responsiveSizing.scheduleClassUpdate();
  }

  // ── Template helpers (used by KioskKeyboardTemplate) ──

  /** Locale-derived default layout name, honoring the per-instance locale and layout overrides. */
  private _localeLayout(): string {
    return getLocaleLayout(
      this._localeLayoutsView.get(this.instanceLocaleLayouts),
      this._layoutsView.get(this.instanceLayouts),
    );
  }

  /**
   * The layout name forced by a non-user `keyboardType` of `Numpad`/`Numeric`,
   * or `null` when no such constraint applies (user pick, or a free type).
   */
  private _autoForcedLayoutName(): "numpad" | "numeric" | null {
    if (this._layoutSource === "user") return null;
    if (this.keyboardType === "Numpad") return "numpad";
    if (this.keyboardType === "Numeric") return "numeric";
    return null;
  }

  /**
   * The effective layout name for the current state: an explicit user switch
   * (via a {layout:...} key) takes precedence, then the keyboardType
   * constraint (Numpad/Numeric force their layout), then the
   * current/base/property/locale fallback chain. Rendering
   * (_getResolvedLayout) and composition-middleware resolution
   * (_ensureMiddleware) must agree on this name so the rendered surface and
   * the active middleware never diverge.
   */
  private _resolvedLayoutName(): string {
    if (this._layoutSource === "user") return this._currentLayout;
    return (
      this._autoForcedLayoutName() ?? (this._currentLayout || this._baseLayout || this.layout || this._localeLayout())
    );
  }

  _getResolvedLayout(): LayoutDefinition {
    const layoutsMap = this._layoutsView.get(this.instanceLayouts);
    const layoutName = this._resolvedLayoutName();
    const resolved = getLayoutOrDefault(layoutName, layoutsMap);
    const constrainedName =
      this.keyboardType === "Numpad" ? "numpad" : this.keyboardType === "Numeric" ? "numeric" : null;
    if (constrainedName === null) return resolved;
    // The {layout:base} key can't reach letters under the constraint; it is a
    // dead duplicate when the constrained layout is showing or a sibling key
    // already reaches it, otherwise the only route back.
    const baseSwitchIsUseless =
      layoutName === constrainedName ||
      resolved.some((row) => row.some((key) => parseLayoutToken(key.value) === constrainedName));
    return reconcileBaseSwitch(resolved, baseSwitchIsUseless);
  }

  // ── Memoized Map views of the instance-* properties ──
  //
  // The render pass and the middleware factory lookup read these on every
  // invocation, so each MemoMapView rebuilds its Map only when the source
  // object identity changes. Consumers that want a fresh resolution should
  // assign a new object (the standard React/Lit pattern) rather than
  // mutating in place. Validators warn on (and skip) invalid entries.

  private readonly _layoutsView = new MemoMapView<LayoutDefinition>((name, def) => {
    if (!KioskKeyboard._isValidLayoutDefinition(def)) {
      console.warn(
        `[kiosk-keyboard] Invalid instanceLayouts entry "${name}": must be a non-empty array of non-empty rows where each key has a string "value".`,
      );
      return undefined;
    }
    return def;
  });

  private readonly _localeLayoutsView = new MemoMapView<string>((_name, layout) =>
    typeof layout === "string" ? layout.trim().toLowerCase() : undefined,
  );

  private readonly _middlewareView = new MemoMapView<() => CompositionMiddleware>((_name, factory) =>
    typeof factory === "function" ? (factory as () => CompositionMiddleware) : undefined,
  );

  private static _isValidLayoutDefinition(def: unknown): def is LayoutDefinition {
    return (
      Array.isArray(def) &&
      def.length > 0 &&
      def.every(
        (row) =>
          Array.isArray(row) &&
          row.length > 0 &&
          row.every((key) => key && typeof (key as KeyDefinition).value === "string" && (key as KeyDefinition).value),
      )
    );
  }

  _getKeyLabel(key: KeyDefinition): string {
    if (key.label === "") return "";

    // Caps Lock state: use capsLockLabel if defined, else i18n fallback
    if (key.value === "{shift}" && this._capsLock) {
      if (key.capsLockLabel !== undefined) return key.capsLockLabel;
      return getText("KEY_CAPS_LOCK", "Caps Lock");
    }

    const shift = this._shifted;
    if (shift && key.shiftLabel) return key.shiftLabel;

    // Explicit label takes priority over i18n
    if (key.label !== undefined) {
      return shift && key.value.length === 1 && key.value.trim() ? key.label.toUpperCase() : key.label;
    }

    // No explicit label: use i18n for special keys, value for regular keys
    const i18nKey = SPECIAL_KEY_LABELS[key.value];
    if (i18nKey) return getText(i18nKey, key.value);

    const base = key.value;
    if (shift) {
      if (key.shiftValue) return key.shiftValue;
      if (key.value.length === 1 && key.value.trim()) return key.value.toUpperCase();
    }
    return base;
  }

  /**
   * Accessible label for a key - always non-empty.
   *
   * Resolution order: per-key `ariaLabel` -> visible label (`_getKeyLabel`,
   * which also covers the Caps Lock override for the shift key) -> built-in
   * i18n entry. For an icon-only key (`label: ""`) with none of these, a
   * dev-time warning is logged and the raw `value` is used as a last resort,
   * so a custom icon-only token never silently announces with no accessible
   * name.
   */
  _getKeyAriaLabel(key: KeyDefinition): string {
    // CapsLock always overrides the shift key's aria-label so screen
    // readers announce "Caps Lock" rather than "Shift" (matches UI5 renderer).
    if (key.value === "{shift}" && this._capsLock) {
      return getText("KEY_CAPS_LOCK", "Caps Lock");
    }

    if (key.ariaLabel) return key.ariaLabel;

    const display = this._getKeyLabel(key);
    if (display) return display;

    const i18nKey = SPECIAL_KEY_LABELS[key.value];
    if (i18nKey) return getText(i18nKey, key.value);

    // Icon-only key (label suppressed) with no ariaLabel and no i18n entry:
    // warn so the consumer adds a localizable accessible name, and fall back
    // to the raw value rather than announcing nothing. Warn once per key value
    // (this runs on every re-render).
    if (key.label === "" && !warnedMissingLabels.has(key.value)) {
      warnedMissingLabels.add(key.value);
      console.warn(
        `[kiosk-keyboard] Icon-only key "${key.value}" has no accessible name; set ariaLabel on the KeyDefinition.`,
      );
    }

    return key.value;
  }

  /**
   * Resolve the icon for a key, categorized by type.
   * Returns null if no icon should render.
   */
  _resolveKeyIcon(key: KeyDefinition): { value: string; sap: boolean } | null {
    const parseSapIcon = (raw: string, where: string): { value: string; sap: boolean } | null => {
      if (raw.startsWith(SAP_ICON_PREFIX)) {
        const name = raw.slice(SAP_ICON_PREFIX.length);
        if (!name) {
          console.warn(`[kiosk-keyboard] empty SAP icon URI for ${where}, skipping icon`);
          return null;
        }
        return { value: name, sap: true };
      }
      // Unicode / emoji
      return { value: raw, sap: false };
    };

    // CapsLock state is evaluated first; capsLockIcon is independent of icon: ""
    if (key.value === "{shift}" && this._capsLock) {
      const clIcon = key.capsLockIcon;
      if (clIcon !== undefined) {
        if (!clIcon) return null; // capsLockIcon: "" suppresses icon
        return parseSapIcon(clIcon, `capsLockIcon on key "${key.value}"`);
      }
      const builtIn = ICON_MAP["{shift:capsLock}"];
      return builtIn ? { value: builtIn, sap: true } : null;
    }

    if (key.icon === "") return null; // suppress default-state icon

    const customIcon = key.icon;
    if (customIcon) {
      return parseSapIcon(customIcon, `key "${key.value}"`);
    }

    const builtIn = ICON_MAP[key.value];
    return builtIn ? { value: builtIn, sap: true } : null;
  }

  get _ariaLabel(): string {
    return this.accessibleName || getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard");
  }

  get _roleDescription(): string {
    return getText("KIOSK_KEYBOARD_ROLEDESCRIPTION", "keyboard");
  }

  _getFocusPosition(layout: LayoutDefinition): { row: number; col: number } {
    const lastFocusedKeyId = this._keyGridNav.getLastFocusedKeyId();
    if (lastFocusedKeyId) {
      const match = lastFocusedKeyId.match(KEY_ID_SUFFIX_RE);
      if (match) {
        const r = Number.parseInt(match[1]!, 10);
        const c = Number.parseInt(match[2]!, 10);
        if (layout[r]?.[c]) return { row: r, col: c };
      }
    }
    return { row: 0, col: 0 };
  }

  // ── Event handlers (used by template + delegation) ──

  private _onKeyClick(e: Event): void {
    if (this.disabled) return;

    const keyEl = (e.target as HTMLElement).closest<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyHook);
    if (!keyEl) return;

    const value = keyEl.dataset.key!;
    const shifted = this._shifted;
    const shiftValue = keyEl.dataset.shiftValue;

    // A held Backspace already deleted via auto-repeat; swallow the trailing
    // release click so lifting off does not delete one extra character.
    if (this._backspaceRepeat.consumeClick(value)) return;

    const kind = classifyKeyToken(value);

    // Layout, F-key, and Shift each fire their own key-press and return early.
    if (kind === "layout") {
      // Fire cancelable key-press first so consumers can veto a layout switch
      // the same way they can veto any other key.
      const allowed = this.fireDecoratorEvent("key-press", { key: value, shiftKey: shifted });
      if (!allowed) return;
      this._handleLayoutSwitch(value);
      return;
    }

    if (kind === "fkey") {
      this._handleFKeyPress(value, shifted);
      return;
    }

    if (kind === "shift") {
      // Shift is handled separately: shiftKey reports the *resulting* state
      // (what shift will become after toggle), not the pre-toggle state.
      const nextShifted = !this._capsLock;
      const allowed = this.fireDecoratorEvent("key-press", { key: value, shiftKey: nextShifted });
      if (!allowed) return;
      this._shiftState.toggle();

      // Optimistic DOM update: apply shift-active / caps-lock classes
      // immediately for instant visual feedback, before the rAF-deferred
      // Preact re-render cycle.  The template class binding maintains the
      // state across subsequent re-renders (same pattern as the physical-key
      // highlight controller's _highlightKey).
      // Preact will redundantly setAttribute("class", ...) on the next
      // render because its VDOM-to-VDOM diff always detects a change
      // (class objects are freshly created each render, never === equal).
      // The redundant DOM write is idempotent and harmless.
      const isShifted = this._shiftState.isShifted;
      const isCaps = this._shiftState.isCapsLock;
      keyEl.classList.toggle(KIOSK_KEYBOARD_DOM.classes.keyShiftActive, isShifted);
      keyEl.classList.toggle(KIOSK_KEYBOARD_DOM.classes.keyCapsLock, isCaps);
      return;
    }

    // Backspace, Enter, an unrecognized `{...}` token, and characters share one
    // key-press + composition pass. `char` is the text that would be inserted;
    // `undefined` for keys that insert nothing (actions and unknown tokens). A
    // lone "{"/"}" matches only one end, so it stays a literal character.
    const char = kind === "char" ? (shifted ? (shiftValue ?? value.toUpperCase()) : value) : undefined;

    const allowed = this.fireDecoratorEvent("key-press", { key: value, shiftKey: shifted, char });
    if (!allowed) return;

    const target = this._resolveTarget();

    // ── Composition middleware ──
    const middleware = this._ensureMiddleware();
    if (middleware && target && middleware.handleKey(value, target)) {
      this._autoReleaseShift();
      return;
    }

    if (kind === "backspace") {
      if (target) handleBackspace(target);
      this._autoReleaseShift();
      return;
    }

    if (kind === "enter") {
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

    if (kind === "unknown") {
      // key-press already fired (with char: undefined); do NOT insert the
      // literal braces - that was a silent footgun (a mistyped `{bcksp}`, or a
      // custom `{paste}` key with no handler, typed the text "{bcksp}").
      console.warn(
        `[kiosk-keyboard] Unrecognized key token "${value}": not a built-in special key. Ignoring (no text inserted).`,
      );
      this._autoReleaseShift();
      return;
    }

    if (kind === "char") {
      // Regular character key - dispatches "input" event (not "change", which
      // fires on blur, matching native keyboard behavior).
      if (target) {
        insertText(target, char!);
      }
      this._autoReleaseShift();
      return;
    }

    // Exhaustiveness: every KeyTokenKind is handled above. A new kind added to
    // classifyKeyToken fails to compile here.
    const _exhaustive: never = kind;
    return _exhaustive;
  }

  /**
   * Lazily instantiates the composition middleware (CJK/dead-key buffers) for
   * the active layout and returns it. Shared by the regular click path and the
   * Backspace auto-repeat so both run keys through the same buffer.
   */
  private _ensureMiddleware(): CompositionMiddleware | null {
    if (!this._middleware) {
      const factory = getMiddlewareFactory(
        this._resolvedLayoutName(),
        this._middlewareView.get(this.instanceMiddleware),
      );
      if (factory) this._middleware = factory();
    }
    return this._middleware;
  }

  /**
   * One Backspace deletion for an auto-repeat tick: fires the cancelable
   * `key-press`, runs composition middleware, then deletes one grapheme.
   * Mirrors the `{backspace}` branch of `_onKeyClick`. Returns `false` only
   * when the key fired but nothing was deleted (empty input / read-only /
   * cursor at start), which stops the repeat.
   */
  private _performBackspaceRepeatDelete(): boolean {
    // char is undefined for action keys, matching the single-tap {backspace} branch.
    const allowed = this.fireDecoratorEvent("key-press", {
      key: "{backspace}",
      shiftKey: this._shifted,
      char: undefined,
    });
    if (!allowed) return true; // consumer vetoed this tick; keep the gesture alive
    const target = this._resolveTarget();
    const middleware = this._ensureMiddleware();
    if (middleware && target && middleware.handleKey("{backspace}", target)) {
      this._autoReleaseShift();
      return true;
    }
    if (!target) return false;
    const pos = handleBackspace(target);
    this._autoReleaseShift();
    return pos !== null;
  }

  private _onKeyMouseDown(e: Event): void {
    e.preventDefault();
  }

  // ── Layout switch / F-key handling ──

  /**
   * Apply a resolved layout as the active surface: track the base (alphabetic)
   * layout, record who drove the switch, and reset the typing context. Shared by
   * the `layout` property path and the `{layout:*}` key handler.
   *
   * Selecting a layout always resets shift/caps-lock, even a re-selection of the
   * active layout. The `source` only changes on a real switch so a no-op can't
   * silently flip the constraint-override. Returns whether the layout changed.
   */
  private _applyLayout(currentLayout: string, source: "external" | "user"): boolean {
    if (!SECONDARY_LAYOUTS.has(currentLayout)) {
      this._baseLayout = currentLayout;
    }
    const changed = currentLayout !== this._currentLayout;
    if (changed) {
      this._currentLayout = currentLayout;
      this._layoutSource = source;
      // A real layout switch ends any in-progress composition: commit the
      // preedit to the target and drop the middleware so the next key resolves
      // the new layout's middleware. Covers both a programmatic `layout` change
      // and the {layout:*} key path.
      if (this._middleware) {
        this._middleware.commit();
        this._middleware = null;
      }
    }
    this._shiftState.reset();
    return changed;
  }

  private _handleLayoutSwitch(value: string): void {
    // Lowercase to match the case-insensitive registry, so a mixed-case name
    // can't be recorded as a (corrupt) base layout.
    const layoutName = (parseLayoutToken(value) ?? "").toLowerCase();
    if (layoutName !== LAYOUT_BASE && !getRegisteredLayout(layoutName, this._layoutsView.get(this.instanceLayouts))) {
      console.warn(`[kiosk-keyboard] Layout "${layoutName}" referenced by a {layout:*} key is not registered.`);
      return;
    }
    const changed =
      layoutName === LAYOUT_BASE
        ? this._applyLayout(this._baseLayout || this.layout || this._localeLayout(), "external")
        : this._applyLayout(layoutName, "user");
    if (changed) {
      this.fireDecoratorEvent("layout-change", { layout: this._currentLayout });
    }
  }

  private _handleFKeyPress(value: string, shifted: boolean): void {
    const fkeyName = value.slice("{fkey:".length, -1);
    const allowed = this.fireDecoratorEvent("key-press", { key: fkeyName, shiftKey: shifted });
    if (!allowed) return;
    this._fKeyController.handle(fkeyName, shifted);
    this._autoReleaseShift();
  }

  /**
   * Inserts text at the caret of the active target, replacing any selection,
   * tracking the cursor exactly like a character key (dispatches `input`).
   *
   * Designed to be called from a `key-press` handler that owns a custom
   * `{...}` key (e.g. a clipboard-paste key). A safe no-op when there is no
   * active resolved target. Does not fire `key-press` itself.
   *
   * @param text The text to insert.
   * @public
   * @since 0.1.0
   */
  insertText(text: string): void {
    const target = this._resolveTarget();
    if (target) insertText(target, text);
  }

  /**
   * Deletes one grapheme before the caret of the active target (or the active
   * selection), exactly like the `{backspace}` key. Returns `true` when
   * something was removed, `false` otherwise (empty input, caret at start,
   * read-only/disabled target, or no active target).
   *
   * Designed to be called from a `key-press` handler that owns a custom key.
   * Does not fire `key-press` itself.
   *
   * @public
   * @since 0.1.0
   */
  deleteBackward(): boolean {
    const target = this._resolveTarget();
    return target ? handleBackspace(target) !== null : false;
  }

  /**
   * Returns the resolved native `<input>`/`<textarea>` of the active target,
   * or `null` when there is no active target or it has no textual DOM ref.
   *
   * Resolves through any custom target resolver, mirroring how the built-in
   * keys locate the element they type into; re-resolves on each call, so it
   * survives a disconnected target. Useful from a `key-press` handler that owns
   * a custom key and needs the live caret/selection.
   *
   * @public
   * @since 0.1.0
   */
  getActiveTargetElement(): HTMLInputElement | HTMLTextAreaElement | null {
    return this._resolveTarget();
  }

  // ── Internal helpers ──

  /** Sets keyboardType without marking it as explicit (for auto-detection). */
  private _setKeyboardTypeInternal(value: `${KeyboardType}`): void {
    if (value === this.keyboardType) return;
    this._keyboardTypeSource = `auto:${value}`;
    this.keyboardType = value;
  }

  private _syncShiftState(): void {
    const wasShifted = this._shifted;
    const wasCapsLock = this._capsLock;
    this._shifted = this._shiftState.isShifted;
    this._capsLock = this._shiftState.isCapsLock;
    if (!wasCapsLock && this._capsLock) {
      this._announcements.announce(getText("ARIA_CAPS_LOCK_ON", "Caps Lock on"));
    } else if (!wasShifted && this._shifted && !this._capsLock) {
      this._announcements.announce(getText("ARIA_SHIFT_ON", "Shift on"));
    } else if (wasShifted && !wasCapsLock && !this._shifted && !this._capsLock) {
      this._announcements.announce(getText("ARIA_SHIFT_OFF", "Shift off"));
    }
  }

  private _autoReleaseShift(): void {
    this._shiftState.autoRelease();
  }

  private _resolveTarget(): HTMLInputElement | HTMLTextAreaElement | null {
    if (this._targetElement) {
      if (!this._targetElement.isConnected) {
        this._targetElement = null;
        this._targetSource = "explicit";
      } else {
        return this._targetElement;
      }
    }
    const ids = this._controlsList;
    if (ids.length === 1) {
      const el = document.getElementById(ids[0]!);
      if (!el) return null;
      return this._resolveInputFrom(el);
    }
    return null;
  }

  /** Resolve a native input/textarea from an element, using the custom resolver if set. */
  private _resolveInputFrom(el: HTMLElement): HTMLInputElement | HTMLTextAreaElement | null {
    return resolveWithCustomResolver(el, this._targetResolver);
  }

  /**
   * Cached `MediaQueryList` reused across all instances; `.matches` is a
   * live getter that re-evaluates per read, so hot-plugged pointers are
   * always reflected without an explicit `change` listener.
   */
  private static _coarsePointerQuery: MediaQueryList | null = null;

  private static _getCoarsePointerQuery(): MediaQueryList {
    KioskKeyboard._coarsePointerQuery ??= matchMedia("(pointer: coarse)");
    return KioskKeyboard._coarsePointerQuery;
  }

  private _shouldDeferToNative(): boolean {
    const mode = this.mobileKeyboard;
    if (mode === "Custom") return false;
    if (mode === "Native") return true;
    return KioskKeyboard._getCoarsePointerQuery().matches;
  }

  private _attachEscapeListener(): void {
    if (this._escapeAbort) return;
    this._escapeAbort = new AbortController();
    document.addEventListener("keydown", this._boundEscape, {
      capture: true,
      signal: this._escapeAbort.signal,
    });
  }

  private _detachEscapeListener(): void {
    this._escapeAbort?.abort();
    this._escapeAbort = null;
  }

  private _onDocumentEscape(e: KeyboardEvent): void {
    if (e.key === "Escape" && this._openValue) {
      this.close();
    }
  }
}

KioskKeyboard.define();

export default KioskKeyboard;

export type { CompositionMiddleware } from "./types.js";
