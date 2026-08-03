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
  getLayoutOrDefault,
  getLocaleLayout,
  getRegisteredLayout,
  getRegisteredLayoutNames,
  isBuiltInLayout,
  resolveLayoutName,
} from "./core/layout-registry.js";
import { getLayoutLang, isSecondaryLayout } from "./core/layout-meta.js";
import { getMiddlewareFactory } from "./core/middleware-registry.js";
import {
  EMPTY_FOLD,
  describeDiagnostic,
  foldCustomLayouts,
  isValidVariantTable,
  type CustomLayoutFold,
  type DiagnosticVocabulary,
  type LayoutDiagnostic,
} from "./core/custom-layout-fold.js";
import { isCustomLayout, type ICustomLayout } from "./CustomLayout.js";
import slot from "@ui5/webcomponents-base/dist/decorators/slot-strict.js";
import type { Slot } from "@ui5/webcomponents-base/dist/UI5Element.js";
import {
  applyVariantDefaults,
  resolveVariantTable,
  shiftedGlyph,
  toShiftVariants,
  type VariantTable,
} from "./core/latin-variants.js";
import { VariantPopupController, type VariantPopupState } from "./core/variant-popup-controller.js";
import { getText, setI18nResolver } from "./core/i18n.js";
import { BackspaceRepeatController } from "./core/backspace-repeat-controller.js";
import { ResponsiveSizingController } from "./core/responsive-sizing-controller.js";
import { NativeInputModeSuppression } from "./core/native-inputmode-suppression.js";
import { parseKeyAction, assertNever, LAYOUT_BASE } from "./core/key-token.js";
import { SPECIAL_KEY_ICON_NAMES, SPECIAL_KEY_I18N_KEYS } from "./core/key-action-meta.js";
import { constrainedLayoutName, reconcileBaseSwitch } from "./core/layout-constraint.js";
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
  type CustomLayoutSpec,
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
import "@ui5/webcomponents/dist/Button.js";
import "@ui5/webcomponents/dist/Popover.js";
import "@ui5/webcomponents-icons/dist/arrow-top.js";
import "@ui5/webcomponents-icons/dist/arrow-left.js";
import "@ui5/webcomponents-icons/dist/accept.js";
import "@ui5/webcomponents-icons/dist/locked.js";
import "@ui5/webcomponents-icons/dist/nav-back.js";

// ── Icon name map (used by the template to render <ui5-icon>) ──
const ICON_MAP: Readonly<Record<string, string>> = {
  "{shift}": SPECIAL_KEY_ICON_NAMES.shift,
  "{shift:capsLock}": SPECIAL_KEY_ICON_NAMES.capsLock,
  "{enter}": SPECIAL_KEY_ICON_NAMES.enter,
  "{backspace}": SPECIAL_KEY_ICON_NAMES.backspace,
};
const SAP_ICON_PREFIX = "sap-icon://";

/** Icon for a `{layout:base}` key kept under the Numpad/Numeric constraint. */
const LAYOUT_RETURN_ICON = SAP_ICON_PREFIX + SPECIAL_KEY_ICON_NAMES.layoutReturn;

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
  "{shift}": SPECIAL_KEY_I18N_KEYS.shift,
  "{enter}": SPECIAL_KEY_I18N_KEYS.enter,
  "{backspace}": SPECIAL_KEY_I18N_KEYS.backspace,
  " ": SPECIAL_KEY_I18N_KEYS.space,
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
   * Build one layout out of several sources, for composing a custom layout from
   * shared rows and a built-in.
   *
   * Each source contributes its rows in order: a string names a built-in layout,
   * anything else is rows supplied directly. An unregistered name contributes
   * nothing and warns, so a typo yields a short layout rather than throwing
   * part-way through composition.
   *
   * @param sources Layout names and row arrays, in the order they should appear.
   * @returns The composed rows, ready to use as a custom layout's `rows`.
   *
   * @example A navigation row above the built-in German layout
   * ```ts
   * import navRow from "kiosk-keyboard-webc/layouts/nav-row";
   *
   * const cl = document.createElement("kiosk-keyboard-custom-layout");
   * cl.slot = "customLayouts";
   * cl.name = "nav-qwertz";
   * cl.rows = KioskKeyboard.composeLayout([navRow], "qwertz-de");
   * keyboard.appendChild(cl);
   * keyboard.layout = "nav-qwertz";
   * ```
   *
   * @public
   * @since 0.1.0
   */
  static composeLayout(...sources: (string | LayoutDefinition)[]): LayoutDefinition {
    const rows: LayoutDefinition = [];
    for (const source of sources) {
      if (typeof source !== "string") {
        rows.push(...source);
        continue;
      }
      const registered = getRegisteredLayout(source);
      if (!registered) {
        console.warn(
          `[kiosk-keyboard] composeLayout: layout "${source}" is not a built-in layout and contributed no rows.`,
        );
        continue;
      }
      rows.push(...registered);
    }
    return rows;
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
    return isSecondaryLayout(name);
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
   * locale overrides can be supplied with the `locales` of a slotted custom layout.
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
   * to key presses or auto-show triggers. A disabled keyboard is also removed
   * from the tab order: every key renders `tabindex="-1"`, matching
   * `@ui5/webcomponents` Button and the `sap.m` convention.
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

  /**
   * Whether to fill the built-in Latin-diacritics table onto the resolved
   * layout so every matching Latin base key (a, e, o, u, s, c, n, …) exposes a
   * long-press / right-click accent-variant popup, so the umlauts and accents
   * become reachable without editing layout data.
   *
   * The `ja-romaji`, `ja-kana`, `arabic` and `ko-hangul` built-ins resolve to no
   * table; give a layout a `variants` table on its custom layout to arm it anyway.
   *
   * A per-key `variants` declared in the layout always wins over the table.
   * Attribute name: `accent-variants`.
   *
   * @default false
   * @public
   * @since 0.1.0
   */
  @property({ type: Boolean })
  accentVariants = false;

  // ── Public programmatic-only properties (no attribute mirror) ──

  /**
   * Long-press variants applied under every layout, merged per base letter beneath
   * anything a slotted `<kiosk-keyboard-custom-layout>` declares for that layout, so a
   * house accent set extends the built-in table rather than replacing it and a base
   * letter mapped to `[]` drops that letter everywhere. Base letters must be lowercase.
   * Effective only while `accentVariants` is set.
   *
   * This tier only ever adds; it has no suppression spelling. To take one layout out of
   * variants entirely use `suppress="Variants"` on its custom layout, and to take the
   * whole affordance out leave `accent-variants` unset, which is the default.
   *
   * Programmatic only: accepts a JS object (not a stringifiable attribute).
   *
   * Read by object identity: assign a new object to change the table.
   *
   * @default null
   * @public
   * @since 0.1.0
   */
  @property({ type: Object })
  defaultVariants: VariantTable | null = null;

  // ── Slots ──

  /**
   * Per-instance layouts. Each `<kiosk-keyboard-custom-layout>` declares a layout, or
   * overlays the one its `name` already resolves to. Applied in DOM order: for rows,
   * locales, metadata and middleware the last declaration wins; long-press variants
   * accumulate per base letter.
   *
   * Not projected: these are configuration, so the shadow template renders no
   * `<slot name="customLayouts">` for them and they never affect layout or styling.
   *
   * @public
   * @since 0.1.0
   */
  @slot({ type: HTMLElement, invalidateOnChildChange: { properties: true, slots: false } })
  customLayouts!: Slot<ICustomLayout>;

  // ── Internal reactive state (triggers re-render, no attribute) ──

  @property({ noAttribute: true })
  _currentLayout = "";

  @property({ type: Boolean, noAttribute: true })
  _shifted = false;

  @property({ type: Boolean, noAttribute: true })
  _capsLock = false;

  @property({ noAttribute: true })
  _liveRegionText = "";

  /**
   * Open accent-variant popup state, or `null` when closed. Assigning a new
   * object opens/refreshes the popup (rAF-batched re-render renders the
   * toolbar JSX); `null` closes it. Roving navigation mutates `activeIndex` in
   * place so a move does not tear down and re-show the popover.
   */
  @property({ type: Object, noAttribute: true })
  _variantPopup: VariantPopupState | null = null;

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
  /** Caps the disarmed-variants diagnostic at one emission per element. */
  private _warnedDisarmedVariants = false;
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
    // A variant drag-release just committed on the preceding pointerup and hid
    // the option; swallow this one synthesized touchend so `elementFromPoint`
    // does not resolve to the now-uncovered key beneath and insert a second char.
    if (this._variantCommittedTouch) {
      this._variantCommittedTouch = false;
      return;
    }
    // Resolve the key under the finger at lift-off, not e.target (which is
    // the touchstart target per spec and may differ if the finger drifted).
    const el = this.shadowRoot!.elementFromPoint(touch.clientX, touch.clientY);
    const keyEl = (el as HTMLElement | null)?.closest<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyHook);
    if (keyEl) keyEl.click();
  };
  /** Set for one touchend after a touch variant drag-release commits, to swallow the trailing synthesized tap. */
  private _variantCommittedTouch = false;

  // ── Backspace press-and-hold auto-repeat ──
  /** Owns the pointer gesture, repeat timer, and trailing-click suppression. */
  private readonly _backspaceRepeat = new BackspaceRepeatController(this, () => this._performBackspaceRepeatDelete());

  // ── Accent-variant long-press popup ──
  /** Owns the hold/right-click gesture that opens the accent-variant popup. */
  private readonly _variantGesture = new VariantPopupController({
    getShadowRoot: () => this.shadowRoot,
    isDisabled: () => this.disabled,
    isRtl: () => this.effectiveDir === "rtl",
    resolveOpenState: (keyEl) => this._resolveVariantOpenState(keyEl),
    getPopupState: () => this._variantPopup,
    setPopupState: (state) => {
      this._variantPopup = state;
    },
    insertVariant: (glyph) => this._insertVariant(glyph),
    announce: (text) => {
      this._announcements.announce(text);
    },
    announceDismiss: () => {
      this._announcements.announce(getText("ARIA_VARIANTS_CLOSED", "Variants closed"));
    },
    focusKey: (keyId) => {
      this.shadowRoot?.getElementById(keyId)?.focus();
    },
    notifyTouchCommit: () => {
      this._variantCommittedTouch = true;
    },
  });

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
    isRtl: () => this.effectiveDir === "rtl",
  });

  // ── Pre-bound template handlers (avoids per-render allocation) ──
  readonly _boundOnKeyClick = this._onKeyClick.bind(this);
  readonly _boundOnKeyMouseDown = this._onKeyMouseDown.bind(this);
  // While the popup is open its own roving navigation owns the arrow keys, so
  // grid navigation yields (focus is inside the popup, but guard defensively).
  readonly _boundOnKeyDown = (e: KeyboardEvent): void => {
    if (this._variantPopup) return;
    this._keyGridNav.onKeyDown(e);
  };
  readonly _boundOnKeyUp = (e: KeyboardEvent): void => {
    if (this._variantPopup) return;
    this._keyGridNav.onKeyUp(e);
  };
  readonly _boundOnVariantClick = (e: Event): void => this._variantGesture.onOptionClick(e);
  readonly _boundOnVariantKeyDown = (e: KeyboardEvent): void => this._variantGesture.onOptionKeydown(e);

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

    // Accent-variant long-press / right-click gesture.
    this._variantGesture.attach(signal);

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
    this._variantGesture.stop();
    this._variantPopup = null;
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

    // Open the accent-variant ui5-popover once its element and anchor key exist
    // in the freshly rendered shadow DOM (opener + open are set imperatively).
    if (this._variantPopup) this._variantGesture.openPopoverAfterRender();
  }

  override onInvalidation(changeInfo: ChangeInfo): void {
    const { name } = changeInfo;

    if (name === "layout") {
      const requested = this.layout.trim().toLowerCase();
      if (!getRegisteredLayout(requested, this._getFold().layouts)) {
        console.warn(
          `[kiosk-keyboard] Layout "${requested}" assigned to the layout property is not registered. Declare it as a <kiosk-keyboard-custom-layout> in the customLayouts slot.`,
        );
        return;
      }
      // A programmatic layout change is external-sourced and re-engages constraints.
      this._applyLayout(requested, "external");
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
    // A child property change is folded into a slot change, so this one branch covers
    // a custom layout being added, removed, reordered or edited. It never fires for the
    // slot content present at connect time, which is why the fold is read lazily.
    if (changeInfo.type === "slot" && changeInfo.name === "customLayouts") this._foldEpoch++;
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
   * Resets the keyboard to a fresh input context: clears the shift/caps
   * latch, aborts any in-progress composition, cancels backspace auto-repeat,
   * dismisses the accent-variant popover, and returns to the base layout.
   *
   * Deliberately leaves the bound target value, the active target, docked
   * visibility, and all developer configuration untouched, so a reused
   * instance can start clean without being recreated.
   *
   * @public
   * @since 0.1.0
   */
  reset(): void {
    // Abort (not commit) any in-progress composition: reset discards the
    // interaction rather than flushing a half-formed syllable to the target.
    if (this._middleware) {
      this._middleware.reset();
      this._middleware = null;
    }
    this._backspaceRepeat.stop();
    if (this._variantPopup) this._variantGesture.close();
    this._variantGesture.stop();
    this._variantPopup = null;
    this._shiftState.reset();
    this._resetToBaseLayout();
  }

  /**
   * Returns the active surface to the base (alphabetic) layout, mirroring the
   * kiosk twin's `resetLayout()`. Fires `layout-change` only on a real change.
   */
  private _resetToBaseLayout(): void {
    const base = this._baseLayout || this.layout || this._localeLayout();
    if (this._applyLayout(base, "external")) {
      this.fireDecoratorEvent("layout-change", { layout: this._currentLayout });
    }
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
    return getLocaleLayout(this._getFold().localeLayouts, this._getFold().layouts);
  }

  /**
   * The effective layout name for the current state: an explicit user switch
   * (via a {layout:...} key) takes precedence, then the keyboardType
   * constraint (Numpad/Numeric force their layout), then the
   * current/base/property/locale fallback chain. The result is run through the
   * registry, so an unregistered name reports the default layout it actually
   * falls back to. Rendering (_getResolvedLayout), the accent-variant table and
   * composition-middleware resolution (_ensureMiddleware) all read this name, so
   * none of them can key off a layout other than the one rendered.
   */
  private _resolvedLayoutName(): string {
    const requested =
      this._layoutSource === "user"
        ? this._currentLayout
        : (constrainedLayoutName(this.keyboardType) ??
          (this._currentLayout || this._baseLayout || this.layout || this._localeLayout()));
    return resolveLayoutName(requested, this._getFold().layouts);
  }

  /**
   * The BCP-47 language of the active layout's keycaps, or `undefined` when they
   * are in the UI language. The template puts it on the labels that carry the
   * layout's script so assistive tech announces them with that language's
   * pronunciation rules (WCAG 2.2 SC 3.1.2 Language of Parts).
   *
   * @internal Read by the template and the variant popup state.
   */
  _getLayoutLang(): string | undefined {
    return getLayoutLang(this._resolvedLayoutName(), this._getFold().layoutMeta);
  }

  _getResolvedLayout(): LayoutDefinition {
    const layoutsMap = this._getFold().layouts;
    const layoutName = this._resolvedLayoutName();
    const resolved = getLayoutOrDefault(layoutName, layoutsMap);
    const constrainedName = constrainedLayoutName(this.keyboardType);
    const base =
      constrainedName === null
        ? resolved
        : reconcileBaseSwitch(resolved, layoutName, constrainedName, {
            icon: LAYOUT_RETURN_ICON,
            ariaLabel: getText("ARIA_RETURN_TO_NUMBERS", "Return to numbers"),
          });
    // When enabled, fill the resolved accent-variant table onto matching base
    // keys so any layout gains the long-press variants. Author-declared
    // `variants` are preserved (applyVariantDefaults never overrides them).
    const variantsMap = this._getFold().variants;
    const defaults = this._defaultVariants();
    if (!this.accentVariants) {
      this._warnDisarmedVariants(variantsMap !== undefined || defaults !== null);
      return base;
    }
    const table = resolveVariantTable(layoutName, variantsMap, defaults);
    return table ? applyVariantDefaults(base, table) : base;
  }

  /**
   * The table applied under every layout, validated here rather than in the fold
   * because it never enters the slot.
   */
  private _defaultVariants(): VariantTable | null {
    const table = this.defaultVariants;
    if (table === null) return null;
    if (isValidVariantTable(table)) return table;
    this._reportDiagnostics([{ code: "invalid-variants", layout: "" }]);
    return null;
  }

  /**
   * Warns once when a variant table is declared while `accentVariants` is off, the
   * combination in which the tables resolve but nothing applies them.
   */
  private _warnDisarmedVariants(hasEntries: boolean): void {
    if (this._warnedDisarmedVariants || !hasEntries) return;
    this._warnedDisarmedVariants = true;
    console.warn(
      "[kiosk-keyboard] A variant table is declared but accentVariants is false, so no variant table is applied. Set accent-variants to arm the long-press popups.",
    );
  }

  // ── The folded view of the customLayouts slot ──

  private _foldCache: CustomLayoutFold = EMPTY_FOLD;
  private _foldKey: readonly ICustomLayout[] = [];
  private _foldEpoch = 0;
  private _foldedEpoch = -1;
  private _reportedDiagnostics = new Set<string>();
  private _middlewareFactory: (() => CompositionMiddleware) | null = null;

  /**
   * The lookup maps the resolution pipeline reads, folded from the `customLayouts` slot.
   *
   * Read on demand rather than assembled on invalidation: `_invalidate` is suppressed
   * until the first render completes while `_processChildren` populates the slot before
   * it, so an invalidation-driven fold would be empty for the whole first frame. The
   * slot array itself is populated by then, so reading it here is correct from the first
   * `onBeforeRendering` onward - which is what makes a `<kiosk-keyboard-custom-layout>`
   * present at connect time honoured on first paint.
   *
   * Rebuilt only when the slotted elements change identity or one of them reports a
   * property change, so diagnostics are emitted once per real change, not once per read.
   */
  private _getFold(): CustomLayoutFold {
    const children = this.customLayouts;
    if (this._foldedEpoch === this._foldEpoch && sameElements(this._foldKey, children)) return this._foldCache;
    this._foldKey = children;
    this._foldedEpoch = this._foldEpoch;

    const specs: CustomLayoutSpec[] = [];
    for (const child of children as readonly HTMLElement[]) {
      if (isCustomLayout(child)) specs.push(child.toSpec());
      else
        console.warn(
          `[kiosk-keyboard] Ignoring <${child.localName}> in the customLayouts slot: not a <kiosk-keyboard-custom-layout>.`,
        );
    }
    this._foldCache = foldCustomLayouts(specs, isBuiltInLayout);
    this._reportDiagnostics(this._foldCache.diagnostics);
    return this._foldCache;
  }

  /** Logs what the fold rejected, once per distinct complaint per configuration. */
  private _reportDiagnostics(diagnostics: readonly LayoutDiagnostic[]): void {
    if (diagnostics.length === 0) {
      // Everything resolves: a fault re-introduced later is reported again.
      this._reportedDiagnostics.clear();
      return;
    }
    for (const d of diagnostics) {
      const key = `${d.code}|${d.layout}|${d.other ?? ""}|${d.value ?? ""}`;
      if (this._reportedDiagnostics.has(key)) continue;
      this._reportedDiagnostics.add(key);
      console.warn(`[kiosk-keyboard] ${describeDiagnostic(d, WEBC_DIAGNOSTIC_VOCABULARY)}`);
    }
  }

  _getKeyLabel(key: KeyDefinition): string {
    if (key.label === "") return "";

    // Caps Lock state: use capsLockLabel if defined, else i18n fallback
    if (key.value === "{shift}" && this._capsLock) {
      if (key.capsLockLabel !== undefined) return key.capsLockLabel;
      return getText("KEY_CAPS_LOCK", "Caps Lock");
    }

    const shift = this._shifted;
    // shiftLabel names the Shift symbol, which CapsLock does not type.
    if (shift && !this._capsLock && key.shiftLabel) return key.shiftLabel;

    // Explicit label takes priority over i18n
    if (key.label !== undefined) {
      return shift && key.value.length === 1 && key.value.trim() ? key.label.toUpperCase() : key.label;
    }

    // No explicit label: use i18n for special keys, value for regular keys
    const i18nKey = SPECIAL_KEY_LABELS[key.value];
    if (i18nKey) return getText(i18nKey, key.value);

    const base = key.value;
    // Shift/Caps form of the key: Shift types the shiftValue, CapsLock uppercases
    // the base (incl. ß -> ẞ) and ignores an uncased shiftValue.
    if (shift) return shiftedGlyph(base, key.shiftValue, this._capsLock);
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

    // A hold/right-click just opened the accent-variant popup on this key;
    // swallow the trailing release click so lifting off does not also insert
    // the base glyph.
    if (this._variantGesture.consumeClick(value)) return;

    // Any other key press while the popup is open dismisses it (its options live
    // in the ui5-popover, so a key press is always "outside"), then proceeds so
    // the same tap also types the key. Runs after the trailing-click suppression
    // above so the click that opened the popup does not immediately close it.
    if (this._variantPopup) this._variantGesture.close();

    const action = parseKeyAction(value);

    // Layout, F-key, and Shift each fire their own key-press and return early.
    if (action.kind === "layout") {
      // Fire cancelable key-press first so consumers can veto a layout switch
      // the same way they can veto any other key.
      const allowed = this.fireDecoratorEvent("key-press", { key: value, shiftKey: shifted });
      if (!allowed) return;
      this._handleLayoutSwitch(action.target);
      return;
    }

    if (action.kind === "fkey") {
      this._handleFKeyPress(action.name, shifted);
      return;
    }

    if (action.kind === "shift") {
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
    // Its Shift/Caps form when shifted (incl. CapsLock ß -> ẞ, #169), else the base value.
    const char =
      action.kind === "char" ? (shifted ? shiftedGlyph(value, shiftValue, this._capsLock) : value) : undefined;

    const allowed = this.fireDecoratorEvent("key-press", { key: value, shiftKey: shifted, char });
    if (!allowed) return;

    const target = this._resolveTarget();

    // ── Composition middleware ──
    const middleware = this._ensureMiddleware();
    if (middleware && target && middleware.handleKey(value, target)) {
      this._autoReleaseShift();
      return;
    }

    if (action.kind === "backspace") {
      if (target) handleBackspace(target);
      this._autoReleaseShift();
      return;
    }

    if (action.kind === "enter") {
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

    if (action.kind === "unknown") {
      // key-press already fired (with char: undefined); do NOT insert the
      // literal braces - that was a silent footgun (a mistyped `{bcksp}`, or a
      // custom `{paste}` key with no handler, typed the text "{bcksp}").
      console.warn(
        `[kiosk-keyboard] Unrecognized key token "${value}": not a built-in special key. Ignoring (no text inserted).`,
      );
      this._autoReleaseShift();
      return;
    }

    if (action.kind === "char") {
      // Regular character key - dispatches "input" event (not "change", which
      // fires on blur, matching native keyboard behavior).
      if (target) {
        insertText(target, char!);
      }
      this._autoReleaseShift();
      return;
    }

    // Exhaustiveness: every KeyAction kind is handled above. A new variant fails
    // to compile at this assertNever.
    return assertNever(action);
  }

  /**
   * Lazily instantiates the composition middleware (CJK/dead-key buffers) for
   * the active layout and returns it. Shared by the regular click path and the
   * Backspace auto-repeat so both run keys through the same buffer.
   */
  private _ensureMiddleware(): CompositionMiddleware | null {
    const factory = getMiddlewareFactory(this._resolvedLayoutName(), this._getFold().middleware);
    if (factory !== this._middlewareFactory) {
      if (this._middleware) {
        // Commit the buffer to the target: `reset()` would drop a half-typed syllable,
        // and the preedit `commit()` finalises is already written into the input.
        this._middleware.commit();
        this._middleware = null;
      }
      this._middlewareFactory = factory;
    }
    if (!this._middleware && factory) this._middleware = factory();
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

  // ── Accent-variant popup ──

  /** The effective `variants` list of a rendered key element, from its grid position. */
  private _variantsForKey(keyEl: HTMLElement): string[] | undefined {
    const match = keyEl.id.match(KEY_ID_SUFFIX_RE);
    if (!match) return undefined;
    const row = Number.parseInt(match[1]!, 10);
    const col = Number.parseInt(match[2]!, 10);
    return this._getResolvedLayout()[row]?.[col]?.variants;
  }

  /**
   * Resolves the accent-variant popup state for `keyEl`, surfacing the
   * uppercase forms (incl. `ẞ` for `ß`) while Shift/Caps is active. Returns
   * `null` when disabled or the key has no effective variants. Called by the
   * gesture controller on hold / right-click.
   */
  private _resolveVariantOpenState(keyEl: HTMLElement): VariantPopupState | null {
    if (this.disabled) return null;
    const variants = this._variantsForKey(keyEl);
    if (!variants || variants.length === 0) return null;

    const value = keyEl.dataset.key!;
    const upper = this._shifted; // isShifted is also true under Caps Lock
    const glyphs = upper ? toShiftVariants(variants) : [...variants];
    // The shifted base is what the key itself types under Shift or CapsLock.
    const base = upper ? shiftedGlyph(value, keyEl.dataset.shiftValue, this._capsLock) : value;
    const label = getText("ARIA_VARIANTS_OPENED", "{0} variants for {1}", String(glyphs.length), base);

    return {
      anchorKeyId: keyEl.id,
      // Keys are flex:1 1 0, so width (unlike height and font-size) has no token
      // to cascade into the popover. offsetWidth gives the resting border-box,
      // unaffected by the pressed scale() transform on the held key.
      anchorKeyWidth: keyEl.offsetWidth,
      base,
      glyphs,
      activeIndex: 0,
      label,
      lang: this._getLayoutLang(),
    };
  }

  /**
   * Inserts a chosen variant through the same cursor-aware path a normal char
   * key uses: fires the cancelable `key-press` first (a consumer's
   * preventDefault vetoes the insert), routes the glyph through the composition
   * middleware so a committed variant can seed or continue composition exactly
   * like a pressed key, falls back to a literal insert when the middleware does
   * not consume it, and auto-releases one-shot Shift. Called by the popup
   * controller on commit.
   */
  private _insertVariant(glyph: string): void {
    const allowed = this.fireDecoratorEvent("key-press", { key: glyph, shiftKey: this._shifted, char: glyph });
    if (allowed) {
      const target = this._resolveTarget();
      if (target) {
        const middleware = this._ensureMiddleware();
        if (!(middleware && middleware.handleKey(glyph, target))) {
          insertText(target, glyph);
        }
      }
      this._autoReleaseShift();
    }
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
    if (!isSecondaryLayout(currentLayout, this._getFold().layoutMeta)) {
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

  private _handleLayoutSwitch(layoutName: string): void {
    if (layoutName !== LAYOUT_BASE && !getRegisteredLayout(layoutName, this._getFold().layouts)) {
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

  private _handleFKeyPress(fkeyName: string, shifted: boolean): void {
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
    if (e.key !== "Escape") return;
    // An open variant popup takes the Escape first: dismiss it (and stop the
    // event) instead of closing the docked keyboard underneath it.
    if (this._variantPopup) {
      e.stopImmediatePropagation();
      e.preventDefault();
      this._variantGesture.close();
      return;
    }
    if (this._openValue) this.close();
  }
}

/** Element-wise identity comparison: `_updateSlots` assigns a new array on every run. */
const sameElements = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((el, i) => el === b[i]);

/** How this twin spells the surface names a fold diagnostic has to quote. */
const WEBC_DIAGNOSTIC_VOCABULARY: DiagnosticVocabulary = {
  customLayouts: "customLayouts slot",
  customLayout: "<kiosk-keyboard-custom-layout>",
  get builtInLayouts() {
    return getRegisteredLayoutNames();
  },
};

KioskKeyboard.define();

export default KioskKeyboard;

export type { CompositionMiddleware, CustomLayoutSpec } from "./types.js";
export type { VariantTable } from "./core/latin-variants.js";
