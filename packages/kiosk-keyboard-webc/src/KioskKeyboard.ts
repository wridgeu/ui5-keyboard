// Main entry point -- imports all built-in layouts (triggering self-registration)
// and defines the component class.
//
// The layout imports MUST be in this file (not only in bundle.esm.ts) because
// ui5-tooling-modules resolves the main entry from the CEM and the auto-generated
// wrapper needs layouts included in the Rollup module graph.

import UI5Element from "@ui5/webcomponents-base/dist/UI5Element.js";
import customElement from "@ui5/webcomponents-base/dist/decorators/customElement.js";
import property from "@ui5/webcomponents-base/dist/decorators/property.js";
import event from "@ui5/webcomponents-base/dist/decorators/event-strict.js";
import jsxRenderer from "@ui5/webcomponents-base/dist/renderer/JsxRenderer.js";
import { reRenderAllUI5Elements } from "@ui5/webcomponents-base/dist/Render.js";
import type { ChangeInfo } from "@ui5/webcomponents-base/dist/UI5Element.js";

import { ShiftState } from "./core/shift-state.js";
import { resolveWithCustomResolver, keyElementId, KEY_ID_SUFFIX_RE } from "./core/dom-utils.js";
import { insertText, handleBackspace, handleNavigation } from "./core/input-operations.js";
import { detectKeyboardType } from "./core/keyboard-type-detector.js";
import {
  SECONDARY_LAYOUTS,
  getLayoutOrDefault,
  getLocaleLayout,
  getRegisteredLayout,
  getRegisteredLayoutNames,
  isBuiltInLayout,
  type InstanceLayouts,
  type InstanceLocaleLayouts,
} from "./core/layout-registry.js";
import { getMiddlewareFactory, type InstanceMiddleware } from "./core/middleware-registry.js";
import { getText, setI18nResolver } from "./core/i18n.js";
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

// ── Built-in layout side-effect imports (self-register on load) ──
import "./layouts/qwerty.js";
import "./layouts/qwertz-de.js";
import "./layouts/numeric.js";
import "./layouts/special.js";
import "./layouts/numpad.js";
import "./layouts/fkeys.js";
import "./layouts/nav.js";
import "./layouts/ja-romaji.js";
import "./layouts/ja-kana.js";
import "./layouts/arabic.js";
import "./layouts/ko-hangul.js";
import "./layouts/qwerty-es.js";

// ── Register ui5-icon + needed icons so they resolve inside shadow DOM ──
import "@ui5/webcomponents/dist/Icon.js";
import "@ui5/webcomponents-icons/dist/arrow-top.js";
import "@ui5/webcomponents-icons/dist/arrow-left.js";
import "@ui5/webcomponents-icons/dist/accept.js";
import "@ui5/webcomponents-icons/dist/locked.js";

// ── Icon name map (used by the template to render <ui5-icon>) ──
const ICON_MAP: Readonly<Record<string, string>> = {
  "{shift}": "arrow-top",
  "{shift:capsLock}": "locked",
  "{enter}": "accept",
  "{backspace}": "arrow-left",
};
const SAP_ICON_PREFIX = "sap-icon://";

// ── Valid enum values for string properties (derived from enums) ──
const VALID_KEYBOARD_TYPES: ReadonlySet<string> = new Set(Object.values(KeyboardType));
const VALID_FKEY_MODES: ReadonlySet<string> = new Set(Object.values(FKeyMode));
const VALID_MOBILE_KEYBOARDS: ReadonlySet<string> = new Set(Object.values(MobileKeyboard));

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

/**
 * Tracks unsupported fkey names that have already been warned about. The set
 * is module-level by design: a custom element has no FLP-style "last instance
 * destroyed" hook (`onExitDOM` fires on every detach, including transient
 * reattach), so per-page deduplication is the correct lifetime. This is
 * intentionally NOT parity with `kiosk-keyboard`'s static-class equivalent,
 * which is cleared on last-instance exit because UI5 controls have a
 * meaningful destroy boundary.
 */
const warnedUnsupportedFKeys = new Set<string>();

// ── Internal provenance types ──

/** Who last set keyboardType. "auto:VALUE" = set by _setKeyboardTypeInternal for VALUE. */
type KeyboardTypeSource = "unset" | "explicit" | `auto:${string}`;

/** Why _targetElement was set -- drives focusout cleanup policy. */
type TargetSource = "autoShow" | "explicit";

/** Why _currentLayout was last changed -- drives _getResolvedLayout bypass. */
type LayoutSource = "user" | "external";

/** Display and ARIA labels for built-in special keys. */
const SPECIAL_KEY_LABELS: Record<string, string> = {
  "{shift}": "KEY_SHIFT",
  "{enter}": "KEY_ENTER",
  "{backspace}": "KEY_BACKSPACE",
  " ": "KEY_SPACE",
};

/**
 * Resolves a CSS custom property holding a rem-based threshold to pixels.
 * Accepts values like "16rem" or "20rem"; falls back to `fallbackRem * remPx`
 * when the property is unset or unparseable.
 */
function resolveRemThreshold(
  computedStyle: CSSStyleDeclaration,
  prop: string,
  fallbackRem: number,
  remPx: number,
): number {
  const raw = computedStyle.getPropertyValue(prop).trim();
  if (!raw) return fallbackRem * remPx;
  const value = Number.parseFloat(raw);
  return Number.isNaN(value) ? fallbackRem * remPx : value * remPx;
}

/** Drop `{layout:base}` keys from a layout (used when the switch would be a no-op). */
function stripDeadBaseSwitch(layout: LayoutDefinition): LayoutDefinition {
  let changed = false;
  const filtered = layout.map((row) => {
    const next = row.filter((key) => key.value !== "{layout:base}");
    if (next.length !== row.length) changed = true;
    return next;
  });
  return changed ? filtered.filter((row) => row.length > 0) : layout;
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

  eventDetails!: {
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
   * - `key` -- the i18n key (e.g. `"KEY_SHIFT"`, `"ARIA_KEYBOARD_OPENED"`)
   * - `locale` -- the current browser locale language subtag (e.g. `"en"`, `"de"`, `"fr"`)
   * - `defaultText` -- the text resolved from the built-in bundle (English or German)
   *
   * Return a `string` to override that text, or `undefined` to keep the default.
   *
   * Resolution order: custom resolver (highest priority) -> UI5 WC i18n bundle (locale-aware) -> English defaults.
   * Connected keyboard instances re-render asynchronously after the resolver changes.
   *
   * If the resolver throws, the error is logged and the default text is used.
   * Pass `null` to clear a previously set resolver.
   *
   * @example
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
   * it acts as the direct target (equivalent to the old `for` attribute).
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
   * Programmatic only -- this property accepts a JS object (not a
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
   * Programmatic only -- accepts a JS object (`Record<string, string>`).
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
   * Programmatic only -- accepts a JS object whose values are factory
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
  private _lastFocusedKeyId: string | null = null;
  /** Accessed by the JSX template for highlight class binding - not private. */
  _highlightedKey: string | null = null;
  private _layoutSource: LayoutSource = "external";
  /**
   * Pending live-region announcements. A queue (rather than a single slot)
   * is necessary because two state changes in the same render cycle (e.g.
   * open + shift toggle) must each be announced; assistive tech can elide
   * an announcement if a single live region is rewritten too quickly, so
   * the queue is also drained one entry per microtask delay below.
   */
  private _announcementQueue: string[] = [];
  private _announcementFlushPending = false;
  private _announcementTimerId: number | null = null;
  /** Minimum gap between live-region writes so AT clients can pick each one up. */
  private static readonly _ANNOUNCEMENT_INTERVAL_MS = 120;
  private _deferredFocusOutCloseId: number | null = null;
  /** ResizeObserver for height-responsive class updates. */
  private _resizeObserver: ResizeObserver | null = null;
  /** The current root element observed for intrinsic content size changes. */
  private _responsiveObservedRoot: HTMLElement | null = null;
  /** rAF handle that coalesces responsive class updates from multiple observers. */
  private _responsiveSyncFrame: number | null = null;
  // ── Inputmode suppression (ref-counted, shared across instances) ──
  private static readonly _inputModeSuppressions = new WeakMap<
    HTMLElement,
    { original: string | null; refCount: number }
  >();
  private _suppressedElement: HTMLElement | null = null;

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
  private _autoShowAbort: AbortController | null = null;
  private _escapeAbort: AbortController | null = null;
  private _physicalKeyAbort: AbortController | null = null;

  // ── Physical keyboard highlight ──
  private _highlightTarget: HTMLElement | null = null;

  // ── Bound listeners (document-level) ──
  private readonly _boundFocusIn = this._onDocumentFocusIn.bind(this);
  private readonly _boundFocusOut = this._onDocumentFocusOut.bind(this);
  private readonly _boundEscape = (e: Event) => {
    if (e instanceof KeyboardEvent) this._onDocumentEscape(e);
  };
  private readonly _boundPhysicalKeyDown = (e: Event) => {
    if (e instanceof KeyboardEvent) this._onPhysicalKey(e, true);
  };
  private readonly _boundPhysicalKeyUp = (e: Event) => {
    if (e instanceof KeyboardEvent) this._onPhysicalKey(e, false);
  };
  private readonly _boundPhysicalBlur = () => {
    this._clearHighlight();
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

  onEnterDOM(): void {
    KioskKeyboard._instances.add(this);

    if (!this._baseLayout) {
      this._baseLayout =
        this.layout || getLocaleLayout(this._getInstanceLocaleLayoutsMap(), this._getInstanceLayoutsMap());
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

    this._setupResizeObserver();
  }

  onExitDOM(): void {
    if (this._middleware) {
      this._middleware.reset();
      this._middleware = null;
    }
    KioskKeyboard._instances.delete(this);
    this._teardownAutoShow();
    this._teardownPhysicalKeyHighlight();
    this._teardownResizeObserver();
    this._restoreInputMode();
    this._detachEscapeListener();
    this._hostAbort?.abort();
    this._hostAbort = null;
    if (this._announcementTimerId !== null) {
      clearTimeout(this._announcementTimerId);
      this._announcementTimerId = null;
    }
    this._announcementQueue.length = 0;
    this._announcementFlushPending = false;
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

    if (this._deferredFocusOutCloseId !== null) {
      cancelAnimationFrame(this._deferredFocusOutCloseId);
      this._deferredFocusOutCloseId = null;
    }

    this._lastFocusedKeyId = null;
  }

  onAfterRendering(): void {
    // Announce pending live region text (from show/close/shift). Queue is
    // drained sequentially with a small gap so AT clients pick up each entry.
    this._flushAnnouncementQueue();

    // Sync observer targets so newly rendered root elements are observed.
    // Responsive height classes live on the host element (not in shadow DOM),
    // so they survive template re-renders and don't need reapplication here.
    // Actual height class updates are handled by the ResizeObserver callback
    // via _scheduleResponsiveClassUpdate(), avoiding forced reflow in the
    // render frame.
    const root = this.shadowRoot?.querySelector<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.root);
    if (root) this._syncResponsiveObserverTargets(root);
  }

  onInvalidation(changeInfo: ChangeInfo): void {
    const { name } = changeInfo;

    if (name === "layout") {
      // A programmatic layout change overrides any user-driven layout switch
      this._layoutSource = "external";
      if (!SECONDARY_LAYOUTS.has(this.layout)) {
        this._baseLayout = this.layout;
      }
      this._currentLayout = this.layout;
      this._shiftState.reset();
    }
    if (name === "keyboardType") {
      if (!VALID_KEYBOARD_TYPES.has(this.keyboardType)) {
        console.warn(
          `[kiosk-keyboard] Invalid keyboardType "${this.keyboardType}". Valid values: ${[...VALID_KEYBOARD_TYPES].join(", ")}.`,
        );
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

  /**
   * Returns the currently active target input element, or null if none.
   * @public
   * @since 0.1.0
   */
  get activeElement(): HTMLInputElement | HTMLTextAreaElement | null {
    return this._targetElement;
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
    // Auto-target when there's exactly one control and nothing is focused yet
    const ids = this._controlsList;
    if (ids.length === 1 && !this._targetElement) {
      const el = document.getElementById(ids[0]!);
      if (el) {
        const input = this._resolveInputFrom(el);
        if (input) {
          input.focus();
          this._targetElement = input;
          this._targetSource = "explicit";
        }
      }
    }
    this._suppressInputMode();
    this._announce(getText("ARIA_KEYBOARD_OPENED", "Virtual keyboard opened"));
    this.fireDecoratorEvent("after-open", { activeElement: this._targetElement });
  }

  /** Executes the close side effects. Called from the `open` setter. */
  private _performClose(): void {
    const activeElement = this._targetElement;
    this._restoreInputMode();
    this._announce(getText("ARIA_KEYBOARD_CLOSED", "Virtual keyboard closed"));
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
      this._restoreInputMode();
    }

    // Reset shift/caps state for the new input context
    this._shiftState.reset();

    this._targetElement = el;
    this._targetSource = "explicit";

    if (this._openValue) {
      this._suppressInputMode();
    }
    // Always sync highlight: cleans up listeners on the old target even
    // when the keyboard is closed, preventing a listener leak.
    this._syncPhysicalKeyHighlight();

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

    this._syncResponsiveObserverTargets(root);

    // Schedule responsive class update via rAF to avoid forced reflow.
    // Host element classes survive shadow DOM re-renders, so synchronous
    // reapplication is unnecessary.
    this._scheduleResponsiveClassUpdate();
  }

  // ── Template helpers (used by KioskKeyboardTemplate) ──

  _getResolvedLayout(): LayoutDefinition {
    const layoutsMap = this._getInstanceLayoutsMap();
    // An explicit layout switch (via {layout:...} key) takes precedence,
    // even when keyboardType constrains the default layout.
    if (this._layoutSource === "user") return getLayoutOrDefault(this._currentLayout, layoutsMap);

    const type = this.keyboardType;
    // On the auto-forced numpad/numeric layout, `{layout:base}` would resolve
    // back to the same auto-forced layout (handler sets `_layoutSource = "external"`,
    // so this branch runs again). Strip it so the rendered surface matches behavior.
    if (type === "Numpad") return stripDeadBaseSwitch(getLayoutOrDefault("numpad", layoutsMap));
    if (type === "Numeric") return stripDeadBaseSwitch(getLayoutOrDefault("numeric", layoutsMap));
    const name =
      this._currentLayout ||
      this._baseLayout ||
      this.layout ||
      getLocaleLayout(this._getInstanceLocaleLayoutsMap(), layoutsMap);
    return getLayoutOrDefault(name, layoutsMap);
  }

  // ── Memoized Map views of the instance-* properties ──
  //
  // The render pass and the middleware factory lookup read these on every
  // invocation, so we rebuild the Map only when the source object identity
  // changes. Consumers that want a fresh resolution should assign a new
  // object (the standard React/Lit pattern) rather than mutating in place.

  private _cachedInstanceLayoutsKey: object | null = null;
  private _cachedInstanceLayoutsMap: InstanceLayouts | undefined = undefined;
  private _cachedInstanceLocaleKey: object | null = null;
  private _cachedInstanceLocaleMap: InstanceLocaleLayouts | undefined = undefined;
  private _cachedInstanceMiddlewareKey: object | null = null;
  private _cachedInstanceMiddlewareMap: InstanceMiddleware | undefined = undefined;

  /** Returns a memoized `Map` view of the `instanceLayouts` property, or undefined. */
  private _getInstanceLayoutsMap(): InstanceLayouts | undefined {
    const value = this.instanceLayouts;
    if (!value || typeof value !== "object") {
      this._cachedInstanceLayoutsKey = null;
      this._cachedInstanceLayoutsMap = undefined;
      return undefined;
    }
    if (this._cachedInstanceLayoutsKey === value) return this._cachedInstanceLayoutsMap;
    const entries: [string, LayoutDefinition][] = [];
    for (const [name, def] of Object.entries(value)) {
      if (!KioskKeyboard._isValidLayoutDefinition(def)) {
        console.warn(
          `[kiosk-keyboard] Invalid instanceLayouts entry "${name}": must be a non-empty array of non-empty rows where each key has a string "value".`,
        );
        continue;
      }
      // Mirror lookup-side normalization (trim + lowercase) so mixed-case
      // keys do not silently fall through to the built-in.
      const key = name.trim().toLowerCase();
      if (!key) continue;
      entries.push([key, def]);
    }
    this._cachedInstanceLayoutsKey = value;
    this._cachedInstanceLayoutsMap = entries.length === 0 ? undefined : new Map(entries);
    return this._cachedInstanceLayoutsMap;
  }

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

  /** Returns a memoized `Map` view of the `instanceLocaleLayouts` property, or undefined. */
  private _getInstanceLocaleLayoutsMap(): InstanceLocaleLayouts | undefined {
    const value = this.instanceLocaleLayouts;
    if (!value || typeof value !== "object") {
      this._cachedInstanceLocaleKey = null;
      this._cachedInstanceLocaleMap = undefined;
      return undefined;
    }
    if (this._cachedInstanceLocaleKey === value) return this._cachedInstanceLocaleMap;
    const entries: [string, string][] = [];
    for (const [tag, layout] of Object.entries(value)) {
      if (typeof layout !== "string") continue;
      const key = tag.trim().toLowerCase();
      if (!key) continue;
      entries.push([key, layout.trim().toLowerCase()]);
    }
    this._cachedInstanceLocaleKey = value;
    this._cachedInstanceLocaleMap = entries.length === 0 ? undefined : new Map(entries);
    return this._cachedInstanceLocaleMap;
  }

  /** Returns a memoized `Map` view of the `instanceMiddleware` property, or undefined. */
  private _getInstanceMiddlewareMap(): InstanceMiddleware | undefined {
    const value = this.instanceMiddleware;
    if (!value || typeof value !== "object") {
      this._cachedInstanceMiddlewareKey = null;
      this._cachedInstanceMiddlewareMap = undefined;
      return undefined;
    }
    if (this._cachedInstanceMiddlewareKey === value) return this._cachedInstanceMiddlewareMap;
    const entries: [string, () => CompositionMiddleware][] = [];
    for (const [name, factory] of Object.entries(value)) {
      if (typeof factory !== "function") continue;
      const key = name.trim().toLowerCase();
      if (!key) continue;
      entries.push([key, factory as () => CompositionMiddleware]);
    }
    this._cachedInstanceMiddlewareKey = value;
    this._cachedInstanceMiddlewareMap = entries.length === 0 ? undefined : new Map(entries);
    return this._cachedInstanceMiddlewareMap;
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

  _getKeyAriaLabel(key: KeyDefinition): string {
    // CapsLock always overrides the shift key's aria-label so screen
    // readers announce "Caps Lock" rather than "Shift" (matches UI5 renderer).
    if (key.value === "{shift}" && this._capsLock) {
      return getText("KEY_CAPS_LOCK", "Caps Lock");
    }
    const i18nKey = SPECIAL_KEY_LABELS[key.value];
    if (i18nKey) return getText(i18nKey, key.value);
    return this._getKeyLabel(key) || key.value;
  }

  /**
   * Resolve the icon for a key, categorized by type.
   * Returns null if no icon should render.
   */
  _resolveKeyIcon(key: KeyDefinition): { value: string; sap: boolean } | null {
    // CapsLock state is evaluated first -- capsLockIcon is independent of icon: ""
    if (key.value === "{shift}" && this._capsLock) {
      const clIcon = key.capsLockIcon;
      if (clIcon !== undefined) {
        if (!clIcon) return null; // capsLockIcon: "" suppresses icon
        if (clIcon.startsWith(SAP_ICON_PREFIX)) {
          const name = clIcon.slice(SAP_ICON_PREFIX.length);
          if (!name) {
            console.warn(`KioskKeyboard: empty SAP icon URI for capsLockIcon on key "${key.value}", skipping icon`);
            return null;
          }
          return { value: name, sap: true };
        }
        return { value: clIcon, sap: false };
      }
      const builtIn = ICON_MAP["{shift:capsLock}"];
      return builtIn ? { value: builtIn, sap: true } : null;
    }

    if (key.icon === "") return null; // suppress default-state icon

    const customIcon = key.icon;
    if (customIcon) {
      if (customIcon.startsWith(SAP_ICON_PREFIX)) {
        const name = customIcon.slice(SAP_ICON_PREFIX.length);
        if (!name) {
          console.warn(`KioskKeyboard: empty SAP icon URI for key "${key.value}", skipping icon`);
          return null;
        }
        return { value: name, sap: true };
      }
      // Unicode / emoji
      return { value: customIcon, sap: false };
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

  /** Queue text for the live region. Identical consecutive entries are coalesced. */
  private _announce(text: string): void {
    if (!text) return;
    if (this._announcementQueue.at(-1) === text) return;
    this._announcementQueue.push(text);
  }

  /**
   * Drains the announcement queue with a fixed inter-message delay so AT
   * clients don't elide rapid consecutive writes to the same live region.
   */
  private _flushAnnouncementQueue(): void {
    if (this._announcementFlushPending) return;
    if (this._announcementQueue.length === 0) return;

    this._announcementFlushPending = true;
    const writeNext = (): void => {
      this._announcementTimerId = null;
      // Bail out if the host was disconnected while the timer was pending.
      // onExitDOM clears the queue and flag, so just stop the chain here.
      if (!this.isConnected) {
        this._announcementFlushPending = false;
        return;
      }
      const next = this._announcementQueue.shift();
      if (next !== undefined) this._liveRegionText = next;
      if (this._announcementQueue.length > 0) {
        this._announcementTimerId = window.setTimeout(writeNext, KioskKeyboard._ANNOUNCEMENT_INTERVAL_MS);
      } else {
        this._announcementFlushPending = false;
      }
    };
    writeNext();
  }

  _getFocusPosition(layout: LayoutDefinition): { row: number; col: number } {
    if (this._lastFocusedKeyId) {
      const match = this._lastFocusedKeyId.match(KEY_ID_SUFFIX_RE);
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

    if (value.startsWith("{layout:")) {
      // Fire cancelable key-press first so consumers can veto a layout switch
      // the same way they can veto any other key.
      const allowed = this.fireDecoratorEvent("key-press", { key: value, shiftKey: shifted });
      if (!allowed) return;
      this._handleLayoutSwitch(value);
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

      // Optimistic DOM update: apply shift-active / caps-lock classes
      // immediately for instant visual feedback, before the rAF-deferred
      // Preact re-render cycle.  The template class binding maintains the
      // state across subsequent re-renders (same pattern as _highlightKey).
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

    // Resolve the character that would be inserted (undefined for action keys)
    const isAction = value === "{backspace}" || value === "{enter}";
    const char = isAction ? undefined : shifted ? (shiftValue ?? value.toUpperCase()) : value;

    // All other keys fire key-press with the current shift state
    const allowed = this.fireDecoratorEvent("key-press", { key: value, shiftKey: shifted, char });
    if (!allowed) return;

    const target = this._resolveTarget();

    // ── Composition middleware ──
    if (!this._middleware) {
      const layoutsMap = this._getInstanceLayoutsMap();
      const localeMap = this._getInstanceLocaleLayoutsMap();
      const layoutName =
        this._currentLayout || this._baseLayout || this.layout || getLocaleLayout(localeMap, layoutsMap);
      const factory = getMiddlewareFactory(layoutName, this._getInstanceMiddlewareMap());
      if (factory) this._middleware = factory();
    }
    if (this._middleware && target && this._middleware.handleKey(value, target)) {
      this._autoReleaseShift();
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
    const keyEl = (e.target as HTMLElement).closest<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyHook);
    if (!keyEl) return;

    const layout = this._getResolvedLayout();
    const match = keyEl.id.match(KEY_ID_SUFFIX_RE);
    if (!match) return;

    let row = Number.parseInt(match[1]!, 10);
    let col = Number.parseInt(match[2]!, 10);
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
    if (this._middleware) {
      this._middleware.commit();
      this._middleware = null;
    }
    const layoutName = value.slice("{layout:".length, -1);
    if (layoutName !== "base" && !getRegisteredLayout(layoutName, this._getInstanceLayoutsMap())) {
      console.warn(`[kiosk-keyboard] Layout "${layoutName}" referenced by a {layout:*} key is not registered.`);
      return;
    }
    if (layoutName === "base") {
      this._currentLayout =
        this._baseLayout ||
        this.layout ||
        getLocaleLayout(this._getInstanceLocaleLayoutsMap(), this._getInstanceLayoutsMap());
      this._layoutSource = "external";
    } else {
      this._currentLayout = layoutName;
      this._layoutSource = "user";
      if (!SECONDARY_LAYOUTS.has(layoutName)) {
        this._baseLayout = layoutName;
      }
    }
    // Reset shift/caps-lock on layout switch, matching the programmatic
    // `layout` property setter path (onInvalidation, name === "layout").
    // Caps-lock that was meaningful in QWERTY has no meaning in numpad/special.
    this._shiftState.reset();
    this.fireDecoratorEvent("layout-change", { layout: this._currentLayout });
  }

  private _handleFKeyPress(value: string, shifted: boolean): void {
    const fkeyName = value.slice("{fkey:".length, -1);
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
      this._announce(getText("ARIA_CAPS_LOCK_ON", "Caps Lock on"));
    } else if (!wasShifted && this._shifted && !this._capsLock) {
      this._announce(getText("ARIA_SHIFT_ON", "Shift on"));
    } else if (wasShifted && !this._shifted && !this._capsLock) {
      this._announce(getText("ARIA_SHIFT_OFF", "Shift off"));
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
    KioskKeyboard._coarsePointerQuery ??= window.matchMedia("(pointer: coarse)");
    return KioskKeyboard._coarsePointerQuery;
  }

  private _shouldDeferToNative(): boolean {
    const mode = this.mobileKeyboard;
    if (mode === "Custom") return false;
    if (mode === "Native") return true;
    return KioskKeyboard._getCoarsePointerQuery().matches;
  }

  // ── Auto-show ──

  private _syncAutoShow(): void {
    if (this.autoShow && this.docked) {
      if (this._autoShowAbort) return;
      this._autoShowAbort = new AbortController();
      const { signal } = this._autoShowAbort;
      document.addEventListener("focusin", this._boundFocusIn, { capture: true, signal });
      document.addEventListener("focusout", this._boundFocusOut, { capture: true, signal });
    } else {
      this._teardownAutoShow();
    }
  }

  private _teardownAutoShow(): void {
    this._autoShowAbort?.abort();
    this._autoShowAbort = null;
  }

  private _onDocumentFocusIn(e: FocusEvent): void {
    if (this.disabled || !this.docked || !this.autoShow) return;

    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (this.shadowRoot!.contains(target) || this.contains(target)) return;

    const inputEl = this._resolveInputFrom(target);
    if (!inputEl) return;
    if (this._isTargetOfOther(inputEl)) return;

    const ids = this._controlsList;
    if (ids.length > 0) {
      if (!this._matchesControls(target, ids)) return;
    }

    const targetChanged = this._targetElement !== inputEl;
    if (targetChanged && this._middleware) {
      this._middleware.commit();
      this._middleware = null;
    }
    this._targetElement = inputEl;
    this._targetSource = "autoShow";

    // Detect keyboard type before open - this may trigger onInvalidation for
    // keyboardType, but the target is already set so subsequent logic is safe.
    if (this.autoType && this._keyboardTypeSource !== "explicit") {
      const detected = detectKeyboardType(inputEl);
      if (detected !== this.keyboardType) {
        this._setKeyboardTypeInternal(detected);
      }
    }

    if (this._deferredFocusOutCloseId !== null) {
      cancelAnimationFrame(this._deferredFocusOutCloseId);
      this._deferredFocusOutCloseId = null;
    }

    if (!this._openValue) {
      this.show();
      this._syncPhysicalKeyHighlight();
    } else if (targetChanged) {
      this._restoreInputMode();
      this._suppressInputMode();
      this._syncPhysicalKeyHighlight();
    }

    if (targetChanged) {
      this.fireDecoratorEvent("active-control-change", { activeElement: inputEl });
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
        const ids = this._controlsList;
        if (ids.length === 0 || this._matchesControls(active, ids)) return;
      }

      if (this._openValue) this.close();
      if (this._targetSource === "autoShow") {
        this._targetElement = null;
        this._targetSource = "explicit";
      }
    });
  }

  private _isTargetOfOther(inputEl: HTMLElement): boolean {
    for (const kb of KioskKeyboard._instances) {
      if (kb === this) continue;
      if (!kb._isAutoShowParticipationActive()) continue;
      if (kb._targetElement === inputEl) return true;
      const ids = kb._controlsList;
      if (ids.length === 1) {
        const el = document.getElementById(ids[0]!);
        if (!el) continue;
        if (el === inputEl) return true;
        if (el instanceof HTMLElement && kb._resolveInputFrom(el) === inputEl) return true;
      }
    }
    return false;
  }

  /**
   * Returns true when this instance should participate in auto-show claim checks.
   * Hidden, disabled, or disconnected keyboards must not block other keyboards
   * from claiming inputs.
   */
  private _isAutoShowParticipationActive(): boolean {
    if (this.disabled) return false;
    if (!this.isConnected) return false;
    // A docked keyboard that is closed hides via an inner shadow-DOM class
    // (visibility:hidden + transform), but the host element still reports
    // client rects. Exclude it explicitly so it does not block other keyboards.
    if (this.docked && !this.open) return false;
    return this.getClientRects().length > 0;
  }

  /**
   * Checks whether the focused element (or a close ancestor) matches one
   * of the configured controls.
   *
   * Supports:
   * - Exact DOM id match (plain HTML)
   * - UI5-style prefixed IDs: walks up the DOM and strips the view prefix
   *   (`*--`) from each ancestor's id, matching the unprefixed control id
   *   (e.g. `"container-app---view--myInput"` matches `"myInput"`)
   */
  private _matchesControls(el: HTMLElement, ids: string[]): boolean {
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

  // ── Inputmode suppression ──

  private _suppressInputMode(): void {
    const target = this._resolveTarget();
    if (!target) return;

    const existing = KioskKeyboard._inputModeSuppressions.get(target);
    if (existing) {
      existing.refCount++;
    } else {
      KioskKeyboard._inputModeSuppressions.set(target, {
        original: target.getAttribute("inputmode"),
        refCount: 1,
      });
    }
    target.setAttribute("inputmode", "none");
    this._suppressedElement = target;
  }

  private _restoreInputMode(): void {
    const el = this._suppressedElement;
    if (!el) return;

    const state = KioskKeyboard._inputModeSuppressions.get(el);
    if (state) {
      state.refCount--;
      if (state.refCount <= 0) {
        if (state.original !== null) {
          el.setAttribute("inputmode", state.original);
        } else {
          el.removeAttribute("inputmode");
        }
        KioskKeyboard._inputModeSuppressions.delete(el);
      }
    }
    this._suppressedElement = null;
  }

  // ── Physical keyboard sync ──

  private _onPhysicalKey(ev: KeyboardEvent, down: boolean): void {
    this._highlightKey(ev.key, down);

    this._shiftState.syncFromPhysical(ev.shiftKey, ev.getModifierState("CapsLock"));
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
      const selector = `${KIOSK_KEYBOARD_DOM.selectors.keyByValue(dataKey)}, ${KIOSK_KEYBOARD_DOM.selectors.keyByShiftValue(physicalKey)}`;
      const el = shadow.querySelector<HTMLElement>(selector);
      if (el) el.classList.add(KIOSK_KEYBOARD_DOM.classes.keyHighlight);
    } else {
      this._clearHighlight();
    }

    // Track state so it persists across re-renders (lowercased for template comparison)
    this._highlightedKey = pressed ? dataKey.toLowerCase() : null;
  }

  private _clearHighlight(): void {
    this.shadowRoot!.querySelectorAll<HTMLElement>(`.${KIOSK_KEYBOARD_DOM.classes.keyHighlight}`).forEach((el) =>
      el.classList.remove(KIOSK_KEYBOARD_DOM.classes.keyHighlight),
    );
    this._highlightedKey = null;
  }

  private _syncPhysicalKeyHighlight(): void {
    const target = this._resolveTarget();

    // Skip if target unchanged and still connected to DOM
    if (target === this._highlightTarget && (!target || target.isConnected)) return;

    this._physicalKeyAbort?.abort();
    this._physicalKeyAbort = null;
    this._highlightTarget = target;

    if (target) {
      this._physicalKeyAbort = new AbortController();
      const { signal } = this._physicalKeyAbort;
      target.addEventListener("keydown", this._boundPhysicalKeyDown, { signal });
      target.addEventListener("keyup", this._boundPhysicalKeyUp, { signal });
      target.addEventListener("blur", this._boundPhysicalBlur, { signal });
    }
  }

  private _teardownPhysicalKeyHighlight(): void {
    this._physicalKeyAbort?.abort();
    this._physicalKeyAbort = null;
    this._highlightTarget = null;
    this._clearHighlight();
  }

  // ── Responsive sizing (ResizeObserver) ──

  /** Attaches a ResizeObserver to the host element for responsive class updates. */
  private _setupResizeObserver(): void {
    this._resizeObserver = new ResizeObserver(() => {
      this._scheduleResponsiveClassUpdate();
    });
    this._resizeObserver.observe(this);
  }

  /** Disconnects and releases the ResizeObserver. */
  private _teardownResizeObserver(): void {
    if (this._responsiveSyncFrame !== null) {
      cancelAnimationFrame(this._responsiveSyncFrame);
      this._responsiveSyncFrame = null;
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    this._responsiveObservedRoot = null;
  }

  /** Keeps the root element observed so style-only intrinsic size changes trigger a re-sync. */
  private _syncResponsiveObserverTargets(root: HTMLElement | null): void {
    if (!this._resizeObserver || root === this._responsiveObservedRoot) return;

    if (this._responsiveObservedRoot) {
      this._resizeObserver.unobserve(this._responsiveObservedRoot);
    }

    if (root) {
      this._resizeObserver.observe(root);
    }

    this._responsiveObservedRoot = root;
  }

  /** Coalesces responsive class updates triggered by host/content observation. */
  private _scheduleResponsiveClassUpdate(): void {
    if (this._responsiveSyncFrame !== null) return;

    this._responsiveSyncFrame = requestAnimationFrame(() => {
      this._responsiveSyncFrame = null;
      this._applyResponsiveClasses();
    });
  }

  /** Returns the current host content-box height available to the keyboard root. */
  private _getHostContentHeight(): number {
    const hostStyle = getComputedStyle(this);
    const paddingTop = Number.parseFloat(hostStyle.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(hostStyle.paddingBottom) || 0;
    return Math.max(0, this.clientHeight - paddingTop - paddingBottom);
  }

  /**
   * Applies height responsive classes to the host element.
   *
   * Width responsiveness is handled purely by CSS @container queries.
   *
   * Height: applied in all browsers -- detects external height constraints
   * (host height < natural content height) and applies compact layout.
   *
   * Called from _scheduleResponsiveClassUpdate() (coalesced from ResizeObserver
   * via rAF) and from refreshResponsiveState() (invoked by onAfterRendering
   * and public callers) to survive template re-renders that reconcile the
   * class attribute.
   */
  private _applyResponsiveClasses(): void {
    const root = this.shadowRoot?.querySelector<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.root);
    if (!root) return;

    const remPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const cs = getComputedStyle(root);

    // ── Height ── (classes live on host so consumer overrides always win)
    this.classList.remove(KIOSK_KEYBOARD_DOM.classes.hostCqShort, KIOSK_KEYBOARD_DOM.classes.hostCqTiny);

    // Skip for docked keyboards (viewport-driven, not container-constrained)
    // and numpad (already compact, shouldn't shrink further).
    if (this.docked || this.keyboardType === "Numpad") {
      return;
    }

    // scrollHeight reports full content height even under overflow: hidden.
    // If root ever uses overflow: clip instead, scrollHeight may equal
    // clientHeight in some browsers, breaking constrained detection.
    const naturalHeight = root.scrollHeight;

    // Compare against the host content box, not the host border box. This
    // keeps height breakpoints accurate when consumers add host padding/borders.
    const hostHeight = this._getHostContentHeight();

    // Only apply when externally constrained (host height < natural content height).
    // Prevents naturally short keyboards (F-Keys, Nav) from triggering.
    // The +1px tolerance avoids oscillation from sub-pixel rounding differences.
    if (naturalHeight <= hostHeight + 1) {
      return;
    }

    const shortThresh = resolveRemThreshold(cs, "--kiosk-keyboard-cq-short-threshold", 16, remPx);
    const tinyThresh = resolveRemThreshold(cs, "--kiosk-keyboard-cq-tiny-threshold", 12, remPx);
    const isTiny = hostHeight <= tinyThresh;
    const isShort = hostHeight <= shortThresh;
    this.classList.toggle(KIOSK_KEYBOARD_DOM.classes.hostCqShort, isShort && !isTiny);
    this.classList.toggle(KIOSK_KEYBOARD_DOM.classes.hostCqTiny, isTiny);
  }
}

KioskKeyboard.define();

export default KioskKeyboard;

export type { CompositionMiddleware } from "./types.js";
