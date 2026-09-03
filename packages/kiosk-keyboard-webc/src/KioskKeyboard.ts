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
import announce from "@ui5/webcomponents-base/dist/util/InvisibleMessage.js";
import InvisibleMessageMode from "@ui5/webcomponents-base/dist/types/InvisibleMessageMode.js";
import type { ChangeInfo } from "@ui5/webcomponents-base/dist/UI5Element.js";
import type { PropertyValue } from "@ui5/webcomponents-base/dist/UI5ElementMetadata.js";

import { ShiftState } from "./core/shift-state.js";
import { resolveWithCustomResolver, keyPositionOf, type KeyPosition } from "./core/dom-utils.js";
import { insertText, handleBackspace } from "./core/input-operations.js";
import {
  getLayoutOrDefault,
  getLocaleLayout,
  getRegisteredLayout,
  getRegisteredLayoutNames,
  isBuiltInLayout,
} from "./core/layout-registry.js";
import { getLayoutMeta } from "./core/layout-meta.js";
import { getMiddlewareFactory } from "./core/middleware-registry.js";
import { isValidVariantTable } from "./core/custom-layout-fold.js";
import { LayoutFoldCache } from "./core/layout-fold-cache.js";
import { LayoutState, type FocusAnchor } from "./core/layout-state.js";
import type { ICustomLayout } from "./CustomLayout.js";
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
import { AutoCompactController } from "./core/auto-compact-controller.js";
import { NativeInputModeSuppression } from "./core/native-inputmode-suppression.js";
import { parseKeyAction, assertNever, spendsOneShotShift } from "./core/key-token.js";
import type { KeyAction } from "./core/key-token.js";
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
// The open `string` key is the contract: `_resolveKeyIcon` looks this up by whatever token a
// custom layout declares. Hand-mirrored by kiosk's `SPECIAL_KEY_ICONS`.
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

/**
 * The keyboard type an invalidation record carried before the change, falling
 * back to the property's own default when it carried none (the first change
 * after registration) or one outside the enum.
 */
function previousKeyboardTypeOf(oldValue: PropertyValue): `${KeyboardType}` {
  const match = Object.values(KeyboardType).find((name) => name === oldValue);
  return match ?? "Full";
}

// ── Internal provenance types ──

/** Who last set keyboardType. "auto:VALUE" = set by _setKeyboardTypeInternal for VALUE. */
type KeyboardTypeSource = "unset" | "explicit" | `auto:${string}`;

/** Why _targetElement was set: drives focusout cleanup policy. */
type TargetSource = "autoShow" | "explicit";

/** Display and ARIA labels for built-in special keys. */
// The open `string` key is the contract: `_getKeyLabel` and `_getKeyAriaLabel` look this up by
// `key.value`, any token a custom layout declares. Hand-mirrored by kiosk's `SPECIAL_KEY_I18N`.
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
 * @param {boolean} autoDetected - Whether this change was the `autoCompact` width tier
 *   resolving, rather than a request.
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
      if (Array.isArray(source)) {
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
    return getLayoutMeta(name)?.secondary === true;
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
   * The keyboard layout asked for.
   *
   * When empty, the keyboard resolves the layout from the current locale
   * (see {@link KioskKeyboard.getLocaleLayout getLocaleLayout}). Per-instance
   * locale overrides can be supplied with the `locales` of a slotted custom layout.
   *
   * This is the declaration, not the layout on screen: a `{layout:*}` key, a
   * `keyboard-type` constraint and an `auto-compact` width swap all change what
   * renders without writing here, the way `src` stays put while the image the
   * browser picked shows up in `currentSrc`. Read {@link effectiveLayout} for the
   * one that rendered.
   *
   * @default ""
   * @public
   * @since 0.1.0
   */
  @property()
  layout = "";

  /**
   * The layout actually rendering, after the locale default, a `{layout:*}` key, a
   * `keyboard-type` constraint and the `auto-compact` width tier have all been
   * applied. Read-only, and not reflected to an attribute: it is a resolved value,
   * not a declaration, so it follows `UI5Element.effectiveDir` rather than `layout`.
   *
   * Changes to it are announced by `layout-change`; this getter is for reading the
   * state at any other moment.
   *
   * @public
   * @since 0.1.0
   */
  get effectiveLayout(): string {
    return this._layoutState.resolvedName();
  }

  /**
   * The keyboard type variant to display.
   *
   * Setting it to a value other than `"Full"` - as an attribute, before
   * connection, or programmatically - disables auto-type detection until
   * `resetKeyboardType()` is called.
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
  set disabled(value: boolean) {
    this._disabledValue = value;
    // The accent popup is part of the keyboard's surface, and it renders into the
    // top layer where the disabled styling does not reach it. Left open its
    // options still commit, so the disable closes it. A hold armed but not yet
    // fired is left alone: `_resolveVariantOpenState` refuses it at fire time.
    if (value && this._variantPopup) this._variantGesture.close();
  }

  get disabled(): boolean {
    return this._disabledValue;
  }

  private _disabledValue = false;

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
   * The `ja-romaji`, `ja-kana`, `ja-kana-compact`, `arabic` and `ko-hangul` built-ins resolve to no
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

  /**
   * Whether a layout that declares a compact counterpart yields to it on a keyboard
   * too narrow to seat its rows, and takes it back when the room returns.
   *
   * Layout data is the one responsive dimension CSS cannot reach: a `@container`
   * rule restyles a row but cannot re-seat its keys, and arrow-key navigation moves
   * on the resolved layout rather than on rendered geometry. Of the built-ins only
   * `ja-kana` declares one (`ja-kana-compact`); a custom layout declares its own with
   * the `compact` property of a `<kiosk-keyboard-custom-layout>`.
   *
   * The swap fires `layout-change` with `autoDetected: true` and never overrides an
   * explicit choice: the layout you set stays the one it resolves against, so the
   * `layout` property or a `{layout:*}` key still wins and is re-tiered from there.
   *
   * The width is taken from the keyboard's own box, so an embedded keyboard tiers on
   * the room it was granted rather than on the viewport. Override the threshold with
   * the `--kiosk-keyboard-auto-compact-threshold` custom property.
   *
   * Attribute name: `auto-compact`.
   *
   * @default false
   * @public
   * @since 0.1.0
   */
  @property({ type: Boolean })
  autoCompact = false;

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
  /** Owns which layout is active and who asked for it. */
  private readonly _layoutState = new LayoutState({
    getCurrentLayout: () => this._currentLayout,
    setCurrentLayout: (name) => {
      this._currentLayout = name;
    },
    getLayoutAttribute: () => this.layout,
    getLocaleLayout: () => this._localeLayout(),
    getKeyboardType: () => this.keyboardType,
    getFold: () => this._foldCache.get(),
    fireLayoutChange: (parameters) => {
      this.fireDecoratorEvent("layout-change", parameters);
    },
    resetShiftState: () => this._shiftState.reset(),
    endComposition: () => {
      if (this._middleware) {
        this._middleware.commit();
        this._middleware = null;
      }
    },
    focusAnchor: () => this._focusAnchor(),
    reseatFocusAnchor: (anchor) => this._reseatFocusAnchor(anchor),
    reapplyAutoCompact: () => this._autoCompact.reapply(),
    announce: (text) => KioskKeyboard._announcements.announce(text),
  });
  private _keyboardTypeSource: KeyboardTypeSource = "unset";
  private _targetElementValue: HTMLInputElement | HTMLTextAreaElement | null = null;
  private _targetSource: TargetSource = "explicit";
  private _targetResolver: ((el: HTMLElement) => HTMLInputElement | HTMLTextAreaElement | null) | null = null;
  /** Accessed by the JSX template for highlight class binding - not private. */
  _highlightedKey: string | null = null;
  /** Accessed by the JSX template for pressed class binding - not private. */
  _pressedKey: KeyPosition | null = null;
  /** Whether the next render must put DOM focus back on the re-seated roving tab stop. */
  private _restoreKeyFocus = false;
  /** Caps the disarmed-variants diagnostic at one emission per element. */
  private _warnedDisarmedVariants = false;
  private _initialValuesNormalised = false;
  /**
   * Paces every instance's writes to the ARIA live region and holds the drain timer.
   *
   * Static because the node it protects is page-global: `InvisibleMessage` keeps one
   * pair of spans in `<ui5-announcement-area>` for the whole document, so a
   * per-instance cadence would let two keyboards write over each other. Torn down with
   * the last instance, so no timer outlives it.
   */
  private static readonly _announcements = new AnnouncementQueue({
    // Page-scoped like the span: a backlog is worth reading out while any keyboard is
    // still connected, and dropped once none is.
    isConnected: () => {
      for (const instance of KioskKeyboard._instances) {
        if (instance.isConnected) return true;
      }
      return false;
    },
    // `announce` empties the span before it writes, so a repeat of the text already
    // standing there is still read out.
    setLiveRegionText: (text) => {
      announce(text, InvisibleMessageMode.Polite);
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
    const target = e.target;
    if (!(target instanceof Element) || !target.closest(KIOSK_KEYBOARD_DOM.selectors.key)) return;
    // Prevent the input from losing focus when the user taps a virtual key.
    // This also suppresses the browser's synthesized mouse events (mousedown,
    // mouseup, click), so we handle the key press directly on touchend.
    e.preventDefault();
  };
  private readonly _boundTouchEnd = (e: Event) => {
    // SAFETY: this listener is registered for "touchend" only (in `onEnterDOM`), and the
    // Touch Events spec dispatches that type as a TouchEvent. `instanceof TouchEvent` is
    // not an option: the interface is absent in browsers that never fire the event.
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
    const keyEl = el?.closest<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyHook);
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
      KioskKeyboard._announcements.announce(text);
    },
    announceDismiss: () => {
      KioskKeyboard._announcements.announce(getText("ARIA_VARIANTS_CLOSED", "Variants closed"));
    },
    focusKey: (pos) => {
      this.shadowRoot
        ?.querySelector<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyByPosition(pos.row, pos.col))
        ?.focus();
    },
    notifyTouchCommit: () => {
      this._variantCommittedTouch = true;
    },
  });

  // ── Responsive sizing (ResizeObserver-driven height classes) ──
  /** Owns the ResizeObserver and height-responsive class application. */
  private readonly _responsiveSizing = new ResponsiveSizingController(this);

  // ── Auto-compact (ResizeObserver-driven layout width tier) ──
  /** Owns the width measurement behind the `autoCompact` property. */
  private readonly _autoCompact = new AutoCompactController({
    isEnabled: () => this.autoCompact,
    applyTier: (narrow, crossed) => this._layoutState.applyTier(narrow, crossed),
  });

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
    isRtl: () => this.effectiveDir === "rtl",
    isDisabled: () => this.disabled,
    setPressedKey: (pos) => {
      this._pressedKey = pos;
    },
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
  readonly _boundOnFocusOut = (): void => this._keyGridNav.onFocusOut();
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

  override onBeforeRendering(): void {
    if (this._initialValuesNormalised) return;
    this._initialValuesNormalised = true;
    // The framework suppresses invalidation until the first render completes,
    // so attributes the parser applied and properties set before connection
    // never reach onInvalidation. Their initial values are normalised here,
    // ahead of the first paint: a plain assignment updates the state silently
    // and updateAttributes() reflects the clamped value.
    if (isInvalidEnumValue("keyboardType", this.keyboardType, VALID_KEYBOARD_TYPES)) {
      this.keyboardType = "Full";
    } else if (this.keyboardType !== "Full") {
      this._keyboardTypeSource = "explicit";
    }
    if (isInvalidEnumValue("fKeyMode", this.fKeyMode, VALID_FKEY_MODES)) {
      this.fKeyMode = "Virtual";
    }
    if (isInvalidEnumValue("mobileKeyboard", this.mobileKeyboard, VALID_MOBILE_KEYBOARDS)) {
      this.mobileKeyboard = "Auto";
    }
  }

  override onEnterDOM(): void {
    KioskKeyboard._instances.add(this);
    this._autoShow.register();

    this._layoutState.seed();

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
    if (KioskKeyboard._instances.size === 0) KioskKeyboard._announcements.teardown();
    this._autoShow.teardown();
    this._physicalKeyHighlight.teardown();
    this._responsiveSizing.teardown();
    this._autoCompact.teardown();
    this._inputModeSuppression.restore();
    this._detachEscapeListener();
    this._backspaceRepeat.stop();
    this._variantGesture.stop();
    this._variantPopup = null;
    this._hostAbort?.abort();
    this._hostAbort = null;
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

    this._keyGridNav.setLastFocusedKey(null);
    this._restoreKeyFocus = false;
  }

  override onAfterRendering(): void {
    // Announce pending live region text (from show/close/shift). Queue is
    // drained sequentially with a small gap so AT clients pick up each entry.
    KioskKeyboard._announcements.flush();

    // A layout change re-seats the roving tab stop by key value
    // (see _reseatFocusAnchor), which can move it off the element the browser
    // was focusing - and that element may no longer exist, dropping focus to the
    // document body. Put focus back on the tab stop when it was on a key before
    // the change; when the tab stop is the element already focused this is a
    // no-op, so focus is never disturbed for its own sake.
    if (this._restoreKeyFocus) {
      this._restoreKeyFocus = false;
      const tabStop = this.shadowRoot?.querySelector<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.focusableKey) ?? null;
      if (tabStop && this.shadowRoot?.activeElement !== tabStop) tabStop.focus();
    }

    // Sync observer targets so newly rendered root elements are observed.
    // Responsive height classes live on the host element (not in shadow DOM),
    // so they survive template re-renders and don't need reapplication here.
    // Actual height class updates are handled by the ResizeObserver callback
    // (coalesced via rAF in the controller), avoiding forced reflow in the
    // render frame.
    const root = this.shadowRoot?.querySelector<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.root) ?? null;
    if (root) this._responsiveSizing.syncObserverTargets(root);

    // The width tier observes the keyboard root's border box, the same box the CSS
    // `@container` width rules query. A null root is its teardown path, as is
    // `autoCompact` being off, which the re-render on that property change delivers.
    this._autoCompact.syncObserver(root);

    // Open the accent-variant ui5-popover once its element and anchor key exist
    // in the freshly rendered shadow DOM (opener + open are set imperatively).
    if (this._variantPopup) this._variantGesture.openPopoverAfterRender();
  }

  override onInvalidation(changeInfo: ChangeInfo): void {
    const { name } = changeInfo;

    if (name === "layout") {
      this._layoutState.applyAttribute(this.layout);
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
      this._layoutState.clearUserOverride();
      this._shiftState.reset();
      // The surface swap ends any in-progress composition: commit the preedit
      // and drop the middleware so the next key resolves against the new
      // effective layout (mirrors _applyLayout).
      if (this._middleware) {
        this._middleware.commit();
        this._middleware = null;
      }
      this.fireDecoratorEvent("keyboard-type-change", {
        keyboardType: this.keyboardType,
        previousKeyboardType: previousKeyboardTypeOf(changeInfo.oldValue),
        autoDetected,
      });
      // A constraint pins the rendered surface and suppresses the tier, so lifting one
      // re-opens the tier question for the layout that surfaces from under it.
      this._autoCompact.reapply();
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
    KioskKeyboard._announcements.announce(getText("ARIA_KEYBOARD_OPENED", "Virtual keyboard opened"));
    this.fireDecoratorEvent("after-open", { activeElement: this._targetElement });
  }

  /** Executes the close side effects. Called from the `open` setter. */
  private _performClose(): void {
    const activeElement = this._targetElement;
    this._inputModeSuppression.restore();
    KioskKeyboard._announcements.announce(getText("ARIA_KEYBOARD_CLOSED", "Virtual keyboard closed"));
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
    this._layoutState.resetToBase();
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
    const fold = this._foldCache.get();
    return getLocaleLayout(fold.localeLayouts, fold.layouts);
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
    return getLayoutMeta(this._layoutState.resolvedName(), this._foldCache.get().layoutMeta)?.lang;
  }

  _getResolvedLayout(): LayoutDefinition {
    const fold = this._foldCache.get();
    const layoutName = this._layoutState.resolvedName();
    const resolved = getLayoutOrDefault(layoutName, fold.layouts);
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
    const defaults = this._defaultVariants();
    if (!this.accentVariants) {
      this._warnDisarmedVariants(fold.variants !== undefined || defaults !== null);
      return base;
    }
    const table = resolveVariantTable(layoutName, fold.variants, defaults);
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
    this._foldCache.report([{ code: "invalid-variants", layout: "" }]);
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

  /** Owns the folded view of the `customLayouts` slot and its diagnostics. */
  private readonly _foldCache = new LayoutFoldCache({
    getCustomLayouts: () => this.customLayouts,
    onRebuilt: () => this._autoCompact.reapply(),
  });
  private _middlewareFactory: (() => CompositionMiddleware) | null = null;

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
   * Resolution order: the Caps Lock state of the shift key -> per-key
   * `ariaLabel` -> visible label (`_getKeyLabel`) -> built-in i18n entry. For an
   * icon-only key (`label: ""`) with none of these, a dev-time warning is logged
   * and the raw `value` is used as a last resort, so a custom icon-only token
   * never silently announces with no accessible name.
   */
  _getKeyAriaLabel(key: KeyDefinition): string {
    // Caps Lock outranks even a declared `ariaLabel` / `capsLockLabel` on the
    // shift key, so a screen reader gets the state the key is in rather than
    // "Shift". The kiosk twin applies the same override from its renderer, since
    // this method is only reached there for a key with no visible label.
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

  _getFocusPosition(layout: LayoutDefinition): KeyPosition {
    const last = this._keyGridNav.getLastFocusedKey();
    if (last && layout[last.row]?.[last.col]) return last;
    return { row: 0, col: 0 };
  }

  /**
   * The key the roving tab stop currently sits on: its `data-key` value, and
   * whether it also holds DOM focus. A key holding focus wins over the remembered
   * one, since arrow navigation is not the only way onto a key.
   */
  private _focusAnchor(): FocusAnchor {
    const shadow = this.shadowRoot;
    if (!shadow) return { value: null, focused: false };

    const active = shadow.activeElement;
    const focused =
      active instanceof HTMLElement ? active.closest<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyHook) : null;
    const last = this._keyGridNav.getLastFocusedKey();
    const anchor =
      focused ??
      (last ? shadow.querySelector<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyByPosition(last.row, last.col)) : null);
    return {
      value: anchor?.getAttribute(KIOSK_KEYBOARD_DOM.attributes.key) ?? null,
      focused: focused !== null,
    };
  }

  /**
   * Re-seats the roving tab stop onto the key that carries the anchor's value in
   * the layout now resolved, or onto the first key when the new arrangement has
   * no such key.
   *
   * Key elements are identified by their grid position, so a layout change hands
   * the same element to whatever key the new arrangement seats there. Following
   * the key by value keeps a keyboard user on the key they were on, and this runs
   * for every layout change - a `{layout:*}` press, a `layout` assignment and an
   * `autoCompact` width swap alike - so the arrangement a width picks is no
   * different to navigate than one that was asked for.
   *
   * DOM focus is put back only when it was on a key to begin with, so focus on
   * the target input (the ordinary case for a pointer user) is never moved. The
   * UI5 twin gets that restore from `FocusHandler.restoreFocus`; here the flag is
   * read in `onAfterRendering`, once the re-seated tab stop exists.
   */
  private _reseatFocusAnchor(anchor: FocusAnchor): void {
    const layout = anchor.value === null ? [] : this._getResolvedLayout();
    let pos: KeyPosition | null = null;
    for (let row = 0; row < layout.length && pos === null; row++) {
      const col = layout[row]!.findIndex((key) => key.value === anchor.value);
      if (col !== -1) pos = { row, col };
    }
    this._keyGridNav.setLastFocusedKey(pos);
    this._restoreKeyFocus = anchor.focused;
  }

  // ── Event handlers (used by template + delegation) ──

  private _onKeyClick(e: Event): void {
    if (this.disabled) return;

    const clicked = e.target;
    const keyEl =
      clicked instanceof Element ? clicked.closest<HTMLElement>(KIOSK_KEYBOARD_DOM.selectors.keyHook) : null;
    if (!keyEl) return;

    const value = keyEl.dataset.key!;
    // Shift held on the activating event types the shifted glyph without
    // latching the on-screen `{shift}` state, mirroring a physical keyboard.
    // It is the only way a roving-tabindex user can reach a capital without
    // round-tripping through `{shift}`: the physical-modifier sync in
    // `PhysicalKeyHighlightController` listens on the target input, so it never
    // runs while focus sits on a keycap.
    const shifted = this._shifted || (e instanceof MouseEvent && e.shiftKey);

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
    this._performKeyAction(action, keyEl, value, shifted);

    // One key, one decision: which keys spend a latched one-shot Shift is a
    // pure function of the key, so it is asked once here rather than left to
    // whichever branch of `_performKeyAction` remembers to call
    // `_autoReleaseShift()`.
    if (spendsOneShotShift(action.kind)) this._autoReleaseShift();
  }

  /**
   * Runs what the key does, leaving the one-shot Shift to the caller.
   *
   * @param shifted The Shift the activation carried - the latched state, or the
   *   modifier held on the activating click or keystroke.
   */
  private _performKeyAction(action: KeyAction, keyEl: HTMLElement, value: string, shifted: boolean): void {
    const shiftValue = keyEl.dataset.shiftValue;

    // Layout, F-key, and Shift each fire their own key-press and return early.
    if (action.kind === "layout") {
      // Fire cancelable key-press first so consumers can veto a layout switch
      // the same way they can veto any other key.
      const allowed = this.fireDecoratorEvent("key-press", { key: value, shiftKey: shifted });
      if (!allowed) return;
      this._layoutState.applyKeySwitch(action.target);
      return;
    }

    if (action.kind === "fkey") {
      this._handleFKeyPress(action.name, shifted);
      return;
    }

    if (action.kind === "shift") {
      // Shift is handled separately: shiftKey reports the *resulting* state
      // (what shift will become after toggle), not the pre-toggle state.
      const nextShifted = this._shiftState.peekToggle();
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
    if (middleware && target && middleware.handleKey(value, target)) return;

    if (action.kind === "backspace") {
      if (target) handleBackspace(target);
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
      return;
    }

    if (action.kind === "unknown") {
      // key-press already fired (with char: undefined); do NOT insert the
      // literal braces - that was a silent footgun (a mistyped `{bcksp}`, or a
      // custom `{paste}` key with no handler, typed the text "{bcksp}").
      console.warn(
        `[kiosk-keyboard] Unrecognized key token "${value}": not a built-in special key. Ignoring (no text inserted).`,
      );
      return;
    }

    if (action.kind === "char") {
      // Regular character key - dispatches "input" event (not "change", which
      // fires on blur, matching native keyboard behavior).
      if (target) {
        insertText(target, char!);
      }
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
    const factory = getMiddlewareFactory(this._layoutState.resolvedName(), this._foldCache.get().middleware);
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
    // Read where the tick consumes it, not only where the hold was armed, so
    // disabling mid-hold ends the gesture on the next tick rather than at the release.
    if (this.disabled) return false;
    // char is undefined for action keys, matching the single-tap {backspace} branch.
    const allowed = this.fireDecoratorEvent("key-press", {
      key: "{backspace}",
      shiftKey: this._shifted,
      char: undefined,
    });
    // Spent once, up front: every branch below spends it, the vetoed one
    // included, so the tick has exactly one release however it ends.
    this._autoReleaseShift();
    if (!allowed) return true; // consumer vetoed this tick; keep the gesture alive
    const target = this._resolveTarget();
    const middleware = this._ensureMiddleware();
    if (middleware && target && middleware.handleKey("{backspace}", target)) return true;
    if (!target) return false;
    return handleBackspace(target) !== null;
  }

  private _onKeyMouseDown(e: Event): void {
    e.preventDefault();
  }

  // ── Accent-variant popup ──

  /**
   * Resolves the accent-variant popup state for `keyEl`, surfacing the
   * uppercase forms (incl. `ẞ` for `ß`) while Shift/Caps is active. Returns
   * `null` when disabled or the key has no effective variants. Called by the
   * gesture controller on hold / right-click.
   */
  private _resolveVariantOpenState(keyEl: HTMLElement): VariantPopupState | null {
    if (this.disabled) return null;
    const anchorKey = keyPositionOf(keyEl);
    if (!anchorKey) return null;
    const variants = this._getResolvedLayout()[anchorKey.row]?.[anchorKey.col]?.variants;
    if (!variants || variants.length === 0) return null;

    const value = keyEl.dataset.key!;
    const upper = this._shifted; // isShifted is also true under Caps Lock
    const glyphs = upper ? toShiftVariants(variants) : [...variants];
    // The shifted base is what the key itself types under Shift or CapsLock.
    const base = upper ? shiftedGlyph(value, keyEl.dataset.shiftValue, this._capsLock) : value;
    const label = getText("ARIA_VARIANTS_OPENED", "Variants for {1}: {0}", String(glyphs.length), base);

    return {
      anchorKey,
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
   * not consume it. A committed variant is a character key, and
   * `spendsOneShotShift("char")` is true on every branch, the vetoed one
   * included. Called by the popup controller on commit.
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
    }
    this._autoReleaseShift();
  }

  // ── Layout switch / F-key handling ──

  private _handleFKeyPress(fkeyName: string, shifted: boolean): void {
    const allowed = this.fireDecoratorEvent("key-press", { key: fkeyName, shiftKey: shifted });
    if (allowed) this._fKeyController.handle(fkeyName, shifted);
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

  /**
   * Announces a shift/caps transition. Caps Lock is settled before Shift: `isShifted`
   * is true in both modes, so a Caps Lock exit - to Off or to Shift - would otherwise
   * read as a shift release.
   */
  private _syncShiftState(): void {
    const wasShifted = this._shifted;
    const wasCapsLock = this._capsLock;
    this._shifted = this._shiftState.isShifted;
    this._capsLock = this._shiftState.isCapsLock;
    if (!wasCapsLock && this._capsLock) {
      KioskKeyboard._announcements.announce(getText("ARIA_CAPS_LOCK_ON", "Caps Lock on"));
    } else if (wasCapsLock && !this._capsLock) {
      KioskKeyboard._announcements.announce(getText("ARIA_CAPS_LOCK_OFF", "Caps Lock off"));
    } else if (!wasShifted && this._shifted) {
      KioskKeyboard._announcements.announce(getText("ARIA_SHIFT_ON", "Shift on"));
    } else if (wasShifted && !this._shifted) {
      KioskKeyboard._announcements.announce(getText("ARIA_SHIFT_OFF", "Shift off"));
    }
  }

  private _autoReleaseShift(): void {
    this._shiftState.autoRelease();
  }

  /**
   * The element that receives typed characters. Assigning it keeps the host's
   * `aria-controls` pointed at the current target, so every write site - the
   * auto-show callback, `setTargetElement`, the auto-target in `_performOpen`,
   * the stale-target purge and disconnect teardown - stays in sync through the
   * one accessor rather than a sync call each could forget.
   */
  private get _targetElement(): HTMLInputElement | HTMLTextAreaElement | null {
    return this._targetElementValue;
  }

  private set _targetElement(el: HTMLInputElement | HTMLTextAreaElement | null) {
    this._targetElementValue = el;
    const id = this._ariaControlsId(el);
    if (id) {
      this.setAttribute("aria-controls", id);
    } else {
      this.removeAttribute("aria-controls");
    }
  }

  /**
   * The id an `aria-controls` on the host can actually resolve, or `""` when
   * there is none. IDREFs do not cross a shadow boundary, and a target is
   * routinely a native input inside another component's shadow root
   * (`resolveInputOrTextarea` recurses three levels), so the id worth
   * publishing belongs to the nearest ancestor sharing the host's tree scope -
   * the component named in `controls`, which is also what the UI5 twin points
   * at. A target outside that scope, or one with no id, yields no attribute.
   */
  private _ariaControlsId(el: HTMLElement | null): string {
    const scope = this.getRootNode();
    let node: Node | null = el;
    while (node && node.getRootNode() !== scope) {
      const root = node.getRootNode();
      node = root instanceof ShadowRoot ? root.host : null;
    }
    return node instanceof Element ? node.id : "";
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

KioskKeyboard.define();

export default KioskKeyboard;

export type { CompositionMiddleware, CustomLayoutSpec } from "./types.js";
export type { VariantTable } from "./core/latin-variants.js";
