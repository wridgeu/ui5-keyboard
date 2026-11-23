import Control from "sap/ui/core/Control";
import type ManagedObject from "sap/ui/base/ManagedObject";
import Element from "sap/ui/core/Element";
import type { MetadataOptions } from "sap/ui/core/Element";
import syncStyleClass from "sap/ui/core/syncStyleClass";
import InvisibleMessage from "sap/ui/core/InvisibleMessage";
import type { AccessibilityInfo } from "sap/ui/core/library";
import { InvisibleMessageMode } from "sap/ui/core/library";
import Popover from "sap/m/Popover";
import { PlacementType } from "sap/m/library";
import { getLayoutMeta } from "./internal/layout-meta";
import type { LayoutDefinition, CompositionMiddleware, VariantTable } from "./types";
import CustomLayout from "./CustomLayout";
import { isValidVariantTable } from "./internal/custom-layout-fold";
import LayoutFoldCache from "./internal/layout-fold-cache";
import type { RendererInternalApi } from "./internal/renderer-internal-api";
import Log from "sap/base/Log";
import KioskKeyboardRenderer from "./KioskKeyboardRenderer";
import { KIOSK_KEYBOARD_DOM } from "./internal/dom-contract";
import { getText } from "./internal/i18n-registry";
import { resolveWithCustomResolver, isParticipating, keyPositionOf, type KeyPosition } from "./internal/dom";
import { applyVariantDefaults, resolveVariantTable, shiftedGlyph, toShiftVariants } from "./internal/latin-variants";
import VariantPopupBehavior from "./internal/variant-popup-behavior";
import { KeyboardType, LayoutChangeReason, type ControlID } from "./library"; // side-effect: ensures Lib.init() runs
import {
  getRegisteredLayout as registryGetLayout,
  getLayoutOrDefault as registryGetLayoutOrDefault,
  getRegisteredLayoutNames as registryGetLayoutNames,
  isBuiltInLayout as registryIsBuiltIn,
  getLocaleLayout as registryGetLocaleLayout,
} from "./internal/layout-registry";
import LayoutState from "./internal/layout-state";
import { AnnouncementQueue } from "./internal/announcement-queue";
import { getMiddlewareFactory as registryGetMiddlewareFactory } from "./internal/middleware-registry";
import {
  SPECIAL_KEY_ICONS as DEFAULT_SPECIAL_KEY_ICONS,
  LAYOUT_RETURN_ICON,
  getKeyIcon as iconsGetKeyIcon,
  clearIconWarnings as iconsClearWarnings,
} from "./internal/key-icons";
import { setI18nResolver as registrySetResolver } from "./internal/i18n-registry";
import type { I18nResolver, TargetResolver } from "./types";
import FocusClaimService from "./internal/focus-claim-service";
import { ShiftState } from "./internal/shift-state";
import TargetInputSession from "./internal/target-input-session";
import KeyGridNavigation from "./internal/key-grid-navigation";
import NativeKeyboardSuppression from "./internal/native-keyboard-suppression";
import AutoShowBehavior, { type KeyboardTypeSource } from "./internal/auto-show-behavior";
import BackspaceRepeatBehavior from "./internal/backspace-repeat-behavior";
import ResponsiveSizingController from "./internal/responsive-sizing-controller";
import AutoCompactBehavior from "./internal/auto-compact-behavior";
import FKeyController from "./internal/fkey-controller";
import ControlsDelegationController from "./internal/controls-delegation-controller";
import { getKeyLabel, getKeyAriaLabel } from "./internal/key-labels";
import PhysicalKeyHighlight from "./internal/physical-key-highlight";
import { parseKeyAction, assertNever, spendsOneShotShift, LAYOUT_BASE } from "./internal/key-token";
import type { KeyAction } from "./internal/key-token";
import { constrainedLayoutName, reconcileBaseSwitch } from "./internal/layout-constraint";

export type { KioskKeyboardDomContract } from "./internal/dom-contract";

/** One touch a touch event reports changed: a finger, or EventSimulation's single mouse touch. */
interface PressPointer {
  readonly identifier: number;
  readonly target: EventTarget | null;
}

/**
 * A press event reaching the touch handlers, carrying a mouse `button` when one
 * made it, and the touches it changed.
 */
interface PressEvent extends Event {
  readonly button?: number;
  readonly changedTouches?: ArrayLike<PressPointer>;
}

/** The pointer id of a press event that names no touch. */
const UNNAMED_POINTER = -1;

/** The pointers a press event changed; an event naming no touch is one unnamed pointer. */
function changedPointers(event: PressEvent): PressPointer[] {
  const touches = event.changedTouches;
  return touches && touches.length > 0 ? Array.from(touches) : [{ identifier: UNNAMED_POINTER, target: event.target }];
}

/** One pointer held on a key, owning everything its press armed. */
interface Press {
  readonly keyEl: HTMLElement;
  /** The key `keyEl` carried when pressed; a re-render can patch another key into it. */
  readonly key: string | undefined;
  /** Detaches this press's window-blur safety net. */
  readonly blur: AbortController;
  /** The Backspace auto-repeat, armed only for an enabled `{backspace}` press. */
  readonly repeat: BackspaceRepeatBehavior | null;
  /** Whether this press armed the variant popup's hold. */
  hold: boolean;
}

/**
 * The `sapselect` event a UI5 control handler receives: the framework's own fixed
 * event, carrying the native keydown it was built from in `originalEvent`. jQuery's
 * `addProp` list omits `repeat`, so a held key shows only on the native event.
 */
interface SelectEvent extends KeyboardEvent {
  readonly originalEvent?: KeyboardEvent;
}

/** The native keydown behind a `sapselect` / `sapselectmodifiers` wrapper. */
function nativeKeyEvent(event: Event): KeyboardEvent {
  const select = event as SelectEvent;
  return select.originalEvent ?? select;
}

/**
 * Whether a simulated touch event stands for a non-primary mouse button.
 *
 * UI5's EventSimulation binds the simulated touchstart/touchend to
 * mousedown/mouseup for every button, so the right-click that opens the accent
 * popup also reaches the touch handlers. The fixed event carries the original
 * `button`; a genuine touch has none, so it reads as primary.
 */
function isSecondaryPress(event: PressEvent): boolean {
  return event.button !== undefined && event.button > 0;
}

/** A docked keyboard's open period: exists only while open and owns what the period armed. */
interface DockSession {
  /** Detaches the document Escape listener. */
  readonly escape: AbortController;
}

/**
 * The focus state the framework stores before a re-render and hands back to
 * `applyFocusInfo`: the control id, and the grid position the roving tab stop sat on.
 */
interface KioskKeyboardFocusInfo {
  id: string;
  lastFocusedKey: KeyPosition | null;
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
  /** The docked open period, or `null` while closed; `isOpen()` reads it. */
  private _dockSession!: DockSession | null;
  /** Owns `controls` focus delegation and active-target reconciliation. */
  private _controlsDelegation!: ControlsDelegationController;
  private _physicalKeyHighlight!: PhysicalKeyHighlight;
  /** The live pointer presses, by pointer id. */
  private _presses!: Map<number, Press>;
  /** The keycap held down by a keyboard activation, or `null` between activations. */
  private _keyboardPressedKeyEl!: HTMLElement | null;
  /** Owns the long-press / right-click accent-variant popup. */
  private _variantPopup!: VariantPopupBehavior;
  /** Owns which layout is active, who asked for it, and the width tier's announcement. */
  private _layoutState!: LayoutState;
  /** The shift/caps pair the last announcement described, so only transitions speak. */
  private _announcedShifted!: boolean;
  private _announcedCapsLock!: boolean;
  private _middleware!: CompositionMiddleware | null;
  private _keyboardTypeSource!: KeyboardTypeSource;
  private _nativeKbSuppression!: NativeKeyboardSuppression;
  private _autoShowBehavior!: AutoShowBehavior;
  private _extensions!: { onAfterRendering?(): void; destroy(): void }[];
  private _focusClaimService!: FocusClaimService;
  private _targetSession!: TargetInputSession;
  private _rendererApi!: RendererInternalApi | null;
  private _targetResolverInstance!: TargetResolver | null;
  /**
   * Owns the folded view of `customLayouts` and its diagnostics.
   *
   * Declared without an initialiser on purpose. `tsconfig` targets ES2022 and leaves
   * `useDefineForClassFields` at its default `true`, while `ManagedObject` calls `init()`
   * and `applySettings()` from inside `super()` - so a field initialiser here would run
   * *after* both and silently discard the single fold built between the two
   * `applySettings` phases. Every field above follows the same form.
   */
  private _foldCache!: LayoutFoldCache;
  /** The factory that produced `_middleware`, so a re-resolve onto the same factory is a no-op. */
  private _middlewareFactory!: (() => CompositionMiddleware) | null;
  /** The `defaultVariants` value last validated, compared by identity per the property's contract. */
  private _checkedDefaultVariants!: unknown;
  /** `_checkedDefaultVariants` when it is a valid table, else `null`. */
  private _validDefaultVariants!: VariantTable | null;
  /** Whether the last resolution declared a variant table with `accentVariants` off. */
  private _disarmedVariants!: boolean;
  /** Owns the ResizeObserver-driven height-responsive class application. */
  private _responsiveSizing!: ResponsiveSizingController;
  private _autoCompact!: AutoCompactBehavior;
  /** Owns `fKeyMode`-driven F-key dispatch (native keydown + caret navigation). */
  private _fKeyController!: FKeyController;
  static readonly metadata: MetadataOptions = {
    library: "ui5.kiosk",
    properties: {
      /**
       * The layout asked for. Auto-detected from the UI5 locale when omitted.
       *
       * This is the intent, not the layout on screen: a secondary `{layout:*}` pick
       * (numbers, symbols, F-keys, navigation), a `keyboardType` constraint, an
       * `autoCompact` width swap and the registry fallback all change what renders
       * without writing here, the way `sap.f.FlexibleColumnLayout` keeps its `layout`
       * while the columns shown follow the width. Read `getEffectiveLayout()` for
       * the one that rendered. A `{layout:*}` key naming a primary layout is the user
       * choosing one, and is written here, so a two-way binding persists that choice
       * and nothing else.
       *
       * Setting the value it already holds is a no-op, so a binding refresh does not
       * undo a secondary pick; `resetLayout()` returns to the base layout.
       *
       * @example <caption>XML view</caption>
       * <kiosk:KioskKeyboard layout="qwertz-de" controls="myInput" />
       *
       * @example <caption>TypeScript - custom layout</caption>
       * new KioskKeyboard({
       *   layout: "azerty-fr",
       *   customLayouts: [new CustomLayout({ name: "azerty-fr", rows: frenchLayout })],
       * });
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
       * When `true`, a layout that declares a compact counterpart yields to it on a
       * keyboard too narrow to seat its rows, and takes it back when the room returns.
       *
       * Of the built-ins only `ja-kana` declares one (`ja-kana-compact`); a custom layout declares its own
       * with the `compact` property of a `customLayouts` entry.
       *
       * The swap fires `layoutChange` with `reason: "width"`, changes
       * `getEffectiveLayout()` only, and never overrides an explicit choice: the layout
       * you set stays the one it resolves against, so a `setLayout` or a `{layout:*}`
       * key still wins and is re-tiered from there.
       *
       * The width is taken from the keyboard's own box, so an embedded keyboard tiers
       * on the room it was granted rather than on the viewport. Override the threshold
       * with the `--ui5KioskKeyboard-autoCompactThreshold` custom property.
       *
       * @example <caption>XML view - kana that fits a 320px phone</caption>
       * <kiosk:KioskKeyboard layout="ja-kana" autoCompact="true" controls="myInput" />
       *
       * @since 0.1.0
       */
      autoCompact: {
        type: "boolean",
        defaultValue: false,
        group: "Behavior",
      },
      /**
       * When `true`, a built-in Latin-diacritics table is merged onto the
       * resolved layout so every matching base letter (a, e, i, o, u, c, n,
       * s, y, z, l, ...) gains a long-press / right-click accent-variant
       * popup, making German umlauts (ä/ö/ü) and the sharp S (ß/ẞ) reachable
       * from any Latin layout without editing layout data. `ja-romaji` is
       * excluded with the other non-Latin built-ins; a `variants` table on a
       * `customLayouts` entry arms it anyway.
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
       * - `"Virtual"` (default): fire `keyPress` and run the built-in caret
       *   navigation for arrow, `Home`/`End` and `PageUp`/`PageDown` keys, but
       *   dispatch no native `keydown` and run no native browser action.
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
       * In XML the IDs are comma-separated, and whitespace around one is not
       * part of it. An entry that names no control is skipped, and logged
       * once per ID.
       *
       * @example <caption>XML view - target multiple inputs</caption>
       * <m:Input id="name" />
       * <m:Input id="email" />
       * <kiosk:KioskKeyboard controls="name, email" />
       *
       * @example <caption>TypeScript</caption>
       * new KioskKeyboard({ controls: ["name", "email"] });
       *
       * @since 0.1.0
       */
      controls: {
        type: "ui5.kiosk.ControlID[]",
        defaultValue: [],
        group: "Behavior",
      },
      /**
       * Long-press variants applied under every layout, merged per base letter beneath
       * anything a `customLayouts` entry declares for that layout, so a house accent set
       * extends the built-in table rather than replacing it and a base letter mapped to
       * `[]` drops that letter everywhere. Base letters must be lowercase. Effective only
       * while `accentVariants` is set.
       *
       * This tier only ever adds; it has no suppression spelling. To take one layout out
       * of variants entirely use `suppress="Variants"` on its `CustomLayout`, and to take
       * the whole affordance out leave `accentVariants` off, which is the default.
       *
       * Read by object identity: assign a new object to change the table.
       *
       * @since 0.1.0
       */
      defaultVariants: {
        type: "ui5.kiosk.VariantOverrideTable",
        defaultValue: null,
        group: "Behavior",
      },
    },
    aggregations: {
      /**
       * Per-instance layouts. Each custom layout declares a layout, or overlays the one its
       * `name` already resolves to. Applied in aggregation order: for rows, locales,
       * metadata and middleware the last declaration wins; long-press variants
       * accumulate per base letter.
       *
       * @since 0.1.0
       */
      customLayouts: {
        type: "ui5.kiosk.CustomLayout",
        multiple: true,
        singularName: "customLayout",
        bindable: "bindable",
        // Lets a plain JS caller pass an object literal where a `CustomLayout` is
        // expected; it is also what the first `applySettings` phase constructs through.
        defaultClass: CustomLayout,
      },
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
      _activeTarget: {
        type: "sap.ui.core.Control",
        multiple: false,
        visibility: "hidden",
      },
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
       * The `{shift}` and `{layout:*}` keys switch state without firing it;
       * observe those through `layoutChange` and the rendered shift classes.
       * A key a composition middleware consumes (CJK/dead-key) does not fire
       * it either, since the middleware runs first.
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
       * Fired once per change of the `layout` property or of `getEffectiveLayout()`,
       * one event when both change together. Not fired for the layout the control
       * starts on.
       *
       * @example <caption>TypeScript</caption>
       * keyboard.attachLayoutChange((event) => {
       *   console.log("Renders:", event.getParameter("effectiveLayout"));
       * });
       *
       * @since 0.1.0
       */
      layoutChange: {
        parameters: {
          /** The layout asked for, which the `layout` property holds. Persist this one. */
          layout: { type: "string" },
          /**
           * The layout that now renders, which `getEffectiveLayout()` returns.
           *
           * @since 0.2.0
           */
          effectiveLayout: { type: "string" },
          /**
           * What changed it.
           *
           * @since 0.2.0
           */
          reason: { type: "ui5.kiosk.LayoutChangeReason" },
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
       * Fired when the docked keyboard closes: by `close()`, or by destroying it while open
       * (not tied to CSS transition end).
       *
       * @since 0.1.0
       */
      afterClose: {},
    },
  };

  static readonly renderer = KioskKeyboardRenderer;

  /** All living KioskKeyboard instances - used by auto-show to skip inputs already targeted by another keyboard. */
  private static readonly _instances = new Set<KioskKeyboard>();

  /**
   * Paces every instance's writes to the ARIA live region and holds the drain timer.
   *
   * Static because the node it protects is page-global: `InvisibleMessage` owns one
   * span for the whole document, so a per-instance cadence would let two keyboards
   * write over each other. Torn down with the last instance, so no timer outlives it.
   */
  private static readonly _announcements = new AnnouncementQueue({
    // Page-scoped like the node: a backlog is worth reading out while any keyboard is
    // still on screen, and dropped once none is.
    isConnected: () => {
      for (const instance of KioskKeyboard._instances) {
        if (instance.getDomRef() !== null) return true;
      }
      return false;
    },
    // `announce` clears the node before it writes, so a repeat of the text already
    // standing there is still read out.
    setLiveRegionText: (text) => {
      InvisibleMessage.getInstance().announce(text, InvisibleMessageMode.Polite);
    },
  });

  /** Global target resolver applied to all instances (lowest priority). */
  private static _globalTargetResolver: TargetResolver | null = null;

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
   * The library clears the global resolver when the last live `KioskKeyboard`
   * instance is destroyed.
   *
   * @param fnResolver Custom resolver function, or `null` to clear.
   * @public
   * @static
   * @since 0.1.0
   */
  static setGlobalTargetResolver(fnResolver: TargetResolver | null): void {
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
  static getGlobalTargetResolver(): TargetResolver | null {
    return KioskKeyboard._globalTargetResolver;
  }

  // ── Static delegates: layout registry (read-only views) ──
  // Customization is per control: declare `customLayouts` entries on the control.
  // There is no public mutation API for the global registry; built-ins ship sealed.

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
   * Build one layout out of several sources, for composing a custom layout from
   * shared rows and a built-in.
   *
   * Each source contributes its rows in order: a string names a built-in layout,
   * anything else is rows supplied directly. An unregistered name contributes
   * nothing and warns, so a typo yields a short layout rather than throwing
   * part-way through composition.
   *
   * @param aSources Layout names and row arrays, in the order they should appear.
   * @returns The composed rows, ready to use as a custom layout's `rows`.
   *
   * @example <caption>A navigation row above the built-in German layout</caption>
   * ```ts
   * import navRow from "ui5/kiosk/layouts/nav-row";
   *
   * new KioskKeyboard({
   *   layout: "nav-qwertz",
   *   customLayouts: [
   *     new CustomLayout({ name: "nav-qwertz", rows: KioskKeyboard.composeLayout([navRow], "qwertz-de") }),
   *   ],
   * });
   * ```
   *
   * @public
   * @static
   * @since 0.1.0
   */
  static composeLayout(...aSources: (string | LayoutDefinition)[]): LayoutDefinition {
    const rows: LayoutDefinition = [];
    for (const source of aSources) {
      if (Array.isArray(source)) {
        rows.push(...source);
        continue;
      }
      const registered = registryGetLayout(source);
      if (!registered) {
        Log.warning(
          `composeLayout: layout "${source}" is not a built-in layout and contributed no rows.`,
          undefined,
          "ui5.kiosk.KioskKeyboard",
        );
        continue;
      }
      rows.push(...registered);
    }
    return rows;
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
   * Reports on the built-ins only, like every static inspector here. A layout
   * marked secondary through a custom layout's `layoutRole` is scoped to the
   * control that declared it, which this static takes no reference to; the
   * keyboard itself honors it.
   *
   * @param sName Layout identifier.
   * @public
   * @static
   * @since 0.1.0
   */
  static isSecondaryLayout(sName: string): boolean {
    return getLayoutMeta(sName)?.secondary === true;
  }

  /**
   * Resolve the built-in layout name appropriate for the current UI5
   * locale. Per-app overrides should be supplied via the
   * `locales` of a `customLayouts` entry on the control.
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
   * Applies `customLayouts` in its own pass before everything else, then injects the
   * locale-detected layout when the caller named none. The layout the settings produce
   * is the one the control starts on, so `layoutChange` reports nothing for it.
   *
   * The custom layouts go through `super.applySettings` rather than being read out of
   * `mSettings`: that is what makes an object literal and a `CustomLayout` instance the
   * same input. A literal is constructed through the aggregation's `defaultClass` and
   * each value passes `validateProperty` exactly once, so `locales: "pl"` widens to
   * `["pl"]` whichever form the caller wrote. By the time `layout` is applied,
   * `setLayout`'s registry validation and the locale default below both resolve through
   * the complete set of custom layouts - which also matters for `clone()`, where
   * `ManagedObject` emits properties before aggregations.
   *
   * A `customLayouts` bound to a model populates asynchronously and therefore does not
   * contribute to the layout chosen here.
   */
  override applySettings(mSettings: $KioskKeyboardSettings, oScope?: object): this {
    // Destructure rather than `delete`: the caller's settings object is never mutated.
    const { customLayouts, ...rest } = mSettings ?? {};
    if (customLayouts !== undefined) {
      // Held in a typed binding rather than passed as a literal: `applySettings` takes
      // `$ManagedObjectSettings`, against which a literal is excess-property checked.
      const first: $KioskKeyboardSettings = { customLayouts };
      super.applySettings(first, oScope);
    }
    const fold = this._foldCache.get();
    // `layout` first so the locale default is the first setting applied; the spread
    // overwrites its value, not its position, when the caller named a layout.
    const second: $KioskKeyboardSettings = {
      layout: registryGetLocaleLayout(fold.localeLayouts, fold.layouts),
      ...rest,
    };
    super.applySettings(second, oScope);
    this._layoutState.settle();
    return this;
  }

  override init(): void {
    KioskKeyboard._instances.add(this);
    this._announcedShifted = false;
    this._announcedCapsLock = false;
    this._shiftState = new ShiftState(() => this._syncShiftState());
    this._keyGridNav = new KeyGridNavigation(KIOSK_KEYBOARD_DOM);
    // @ts-expect-error addDelegate is an internal UI5 API not exposed in @openui5/types
    this.addDelegate(this._keyGridNav, true);
    this._dockSession = null;
    this._controlsDelegation = new ControlsDelegationController({
      getControls: () => this.getControls(),
      getParent: () => this.getParent(),
      isRendered: () => this.getDomRef() !== null,
      getEnabled: () => this.getEnabled(),
      getDocked: () => this.getDocked(),
      getAutoShow: () => this.getAutoShow(),
      isOpen: () => this.isOpen(),
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
    this._presses = new Map();
    this._keyboardPressedKeyEl = null;
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
      getLayoutLang: () => this._getLayoutLang(),
      getVariantPopover: () => this._getVariantPopover(),
    });
    this._keyboardTypeSource = "unset";
    this._nativeKbSuppression = new NativeKeyboardSuppression(this);
    this._autoShowBehavior = new AutoShowBehavior(this);
    this._extensions = [this._nativeKbSuppression, this._autoShowBehavior];
    this._focusClaimService = new FocusClaimService(
      () => this.getControls(),
      () => this._controlsDelegation.getResolvedControlIds(),
      () => this._nativeKbSuppression.shouldDeferToNative(),
      (id) => this._isTargetOfOther(id),
    );
    this._targetResolverInstance = null;
    this._foldCache = new LayoutFoldCache({
      getCustomLayouts: () => this.getCustomLayouts(),
      // Deferred: a rebuild runs inside whatever read the fold, which can be a render.
      onRebuilt: () =>
        queueMicrotask(() => {
          if (!this.isDestroyed()) this._layoutState.refresh(LayoutChangeReason.Layouts);
        }),
    });
    this._middlewareFactory = null;
    this._layoutState = new LayoutState({
      getLayout: () => this.getLayout(),
      setLayoutProperty: (name) => {
        this.setProperty("layout", name);
      },
      invalidate: () => this.invalidate(),
      getKeyboardType: () => this.getKeyboardType(),
      getFold: () => this._foldCache.get(),
      fireLayoutChange: (parameters) => {
        this.fireLayoutChange(parameters);
      },
      resetShiftState: () => this._shiftState.reset(),
      leaveSurface: () => this._leaveSurface(),
      endComposition: () => this._dropComposition("commit"),
      focusAnchorValue: () => this._focusAnchorValue(),
      reseatFocusAnchor: (value) => this._reseatFocusAnchor(value),
    });
    this._checkedDefaultVariants = undefined;
    this._validDefaultVariants = null;
    this._disarmedVariants = false;
    this._targetSession = new TargetInputSession(() => this._getTargetElement());
    this._middleware = null;
    this._rendererApi = null;
    this._responsiveSizing = new ResponsiveSizingController(this);
    this._autoCompact = new AutoCompactBehavior(this);
    this._fKeyController = new FKeyController({
      getFKeyMode: () => this.getFKeyMode(),
      getTargetFocusDomRef: () => this._getTargetElement()?.getFocusDomRef() ?? null,
      getEffectiveResolver: () => this._getEffectiveResolver(),
      handleNavigationKey: (fkeyName, extend) => this._targetSession.handleNavigationKey(fkeyName, extend),
    });

    // Seeded from the built-in locale map; applySettings, which always follows
    // init, sets the layout the instance's own maps resolve to.
    this._layoutState.seed(registryGetLocaleLayout());
  }

  onLocalizationChanged(): void {
    this.invalidate();
  }

  override onBeforeRendering(): void {
    // The live region every announcement goes through, in the page and empty
    // before the first write, as ARIA asks. This hook rather than `init`: it
    // cannot run before the core is ready, so the static area resolves without a
    // gate. See the priming convention in CLAUDE.md.
    InvisibleMessage.getInstance();
  }

  override onAfterRendering(): void {
    // apiVersion 4 may skip this hook on a parent-only re-render; safe because
    // each external sync below is idempotent and independently event/observer-driven.
    this._keyGridNav.setRootRef(this._rootDomRef());
    this._syncDockedDomState();

    // A render that keeps the layout name can still seat another key where a
    // finger is held (an edit to the active custom layout).
    for (const press of this._presses.values()) {
      if (press.keyEl.dataset.key !== press.key) {
        this._leaveSurface();
        break;
      }
    }

    const pendingAnnouncement = this._layoutState.takePendingAnnouncement();
    if (pendingAnnouncement !== null) {
      this._announceLiveRegion(pendingAnnouncement);
    }

    for (const ext of this._extensions) ext.onAfterRendering?.();

    // A re-render wipes the root's height-tier classes: re-observe the new root and
    // re-measure (see ResponsiveSizingController).
    const dom = this._rootDomRef();
    if (dom) {
      this._responsiveSizing.syncObserver(dom);
      this._responsiveSizing.scheduleClassUpdate();
    }
    this._autoCompact.syncObserver(dom);

    this._controlsDelegation.sync();
  }

  /**
   * The rendered root element, or `null` before the first render and after exit.
   *
   * `getDomRef` is declared for every control and so reports the generic `Element`;
   * this keyboard's root is always an HTML element.
   */
  private _rootDomRef(): HTMLElement | null {
    // SAFETY: KioskKeyboardRenderer.render opens the root with `rm.openStart("div", ...)`,
    // so a DOM ref for this control is an HTMLElement whenever there is one.
    return this.getDomRef() as HTMLElement | null;
  }

  /** Keeps docked/closed root classes in sync without forcing a re-render. */
  private _syncDockedDomState(): void {
    const dom = this.getDomRef();
    if (!dom) return;

    const docked = this.getDocked();
    dom.classList.toggle(KIOSK_KEYBOARD_DOM.classes.rootDocked, docked);
    dom.classList.toggle(KIOSK_KEYBOARD_DOM.classes.rootClosed, docked && !this.isOpen());
  }

  override exit(): void {
    this._dropComposition("reset");
    KioskKeyboard._instances.delete(this);
    const wasLastInstance = KioskKeyboard._instances.size === 0;

    if (wasLastInstance) {
      registrySetResolver(null);
      FKeyController.clearWarnings();
      iconsClearWarnings();
      KioskKeyboard._globalTargetResolver = null;
      KioskKeyboard._announcements.teardown();
    }

    this._controlsDelegation.teardown();
    this._physicalKeyHighlight.detach();
    this._responsiveSizing.destroy();
    this._autoCompact.destroy();
    this._variantPopup.destroy();
    this._cancelAllPresses();
    for (const ext of this._extensions) ext.destroy();
    const wasOpen = this._dockSession !== null;
    this._dockSession?.escape.abort();
    this._dockSession = null;
    // Not close(): it would announce "keyboard closed" from a control that is leaving the page.
    if (wasOpen) this.fireAfterClose();
    // @ts-expect-error removeDelegate is an internal UI5 API not exposed in @openui5/types
    this.removeDelegate(this._keyGridNav);
    this._keyGridNav.destroy();
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
      // A disabled keyboard takes no input: every press ends, and the accent popup,
      // which renders into the static area where the disabled styling does not
      // reach it, closes rather than keep committing.
      this._leaveSurface();
    }
    // The renderer handles the disabled CSS class (ui5KioskKeyboard--disabled)
    // and per-key aria-disabled attributes at render time. Uses setProperty
    // directly because Control has no base setEnabled implementation to delegate to.
    return this.setProperty("enabled", isEnabled);
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
      // A hidden keyboard holds no press, popup or open state (escape listener,
      // native keyboard suppression), docked or not.
      this._leaveSurface();
      this.close();
    }
    return super.setVisible(isVisible);
  }

  /**
   * If focus is currently inside this keyboard's DOM, move it to the
   * target input. Called before operations that would remove the keyboard
   * from tab order (disable, hide) to avoid unpredictable focus fallback.
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
   * Fires `layoutChange` when the layout actually changes. The value the
   * property already holds is a no-op.
   *
   * @public
   * @since 0.1.0
   */
  setLayout(sLayout: string): this {
    if (sLayout.trim().toLowerCase() === this.getLayout()) return this;
    // Programmatic change is external-sourced and re-engages keyboardType constraints.
    this._layoutState.perform(sLayout, "external", "passed to setLayout()", LayoutChangeReason.Api);
    return this;
  }

  /**
   * Custom setter for autoCompact - switching it off gives the requested layout back
   * rather than leaving the arrangement a width picked with nothing left to undo it.
   *
   * @public
   * @since 0.1.0
   */
  setAutoCompact(autoCompact: boolean): this {
    this.setProperty("autoCompact", autoCompact);
    if (!autoCompact) this._layoutState.applyTier(false, false);
    return this;
  }

  /**
   * Applies the `autoCompact` width tier. Called from {@link AutoCompactBehavior}
   * on a frame of its own, never from the observation callback.
   */
  _applyCompactTier(narrow: boolean, crossed: boolean): void {
    this._layoutState.applyTier(narrow, crossed);
  }

  /**
   * Ends any in-progress composition and drops the middleware together with the
   * factory that produced it, so the next key re-resolves from scratch.
   * `"commit"` flushes the buffer to the target - what every real editing-context
   * switch (layout, target, or keyboardType change) does with a half-typed
   * syllable; `"reset"` discards it. A no-op when no composition is active.
   */
  private _dropComposition(mode: "commit" | "reset"): void {
    if (!this._middleware) return;
    this._middleware[mode]();
    this._middleware = null;
    this._middlewareFactory = null;
  }

  /**
   * A property write inside a parented custom layout reaches this control as an
   * invalidation naming that element. Dropping the cache is the entire reaction; the
   * fold is rebuilt on the next read, so a composition in progress is never torn down
   * by an edit to a custom layout the active layout does not read.
   *
   * The cache is dropped **before** `super`, because `Control.prototype.invalidate`
   * returns early during the `onBeforeRendering` phase.
   */
  override invalidate(oOrigin?: ManagedObject): void {
    if (oOrigin instanceof CustomLayout) this._foldCache.drop();
    super.invalidate(oOrigin);
  }

  /**
   * The table applied under every layout, validated here rather than in the fold
   * because it never enters the aggregation. Validated and reported once per value,
   * which the property reads by identity.
   */
  private _resolvedDefaultVariants(): VariantTable | null {
    const table = this.getDefaultVariants();
    if (table !== this._checkedDefaultVariants) {
      this._checkedDefaultVariants = table;
      const valid = table === null || isValidVariantTable(table);
      if (!valid) this._foldCache.report([{ code: "invalid-variants", layout: "" }]);
      this._validDefaultVariants = valid ? table : null;
    }
    return this._validDefaultVariants;
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
    return this._layoutState.getBaseLayout();
  }

  /**
   * Returns the layout that renders: the `layout` property after a secondary
   * `{layout:*}` pick, the `keyboardType` constraint, the `autoCompact` width tier
   * and the registry fallback have been applied. Read-only and derived, the way
   * `<img>` reports `currentSrc` beside `src`; every change fires `layoutChange`.
   *
   * @returns The name of the layout on screen.
   * @public
   * @since 0.2.0
   */
  getEffectiveLayout(): string {
    return this._layoutState.resolvedName();
  }

  /**
   * Restores the active layout to the tracked base layout, makes it the `layout`
   * property and drops a secondary `{layout:*}` pick.
   *
   * @public
   * @since 0.1.0
   */
  resetLayout(): this {
    this._layoutState.perform(
      this._layoutState.getBaseLayout(),
      "external",
      "held as the base layout",
      LayoutChangeReason.Api,
    );
    return this;
  }

  /**
   * Resets the keyboard to a fresh input context: clears the shift/caps
   * latch, aborts any in-progress composition, cancels backspace auto-repeat,
   * dismisses the accent-variant popover, and returns to the base layout.
   *
   * Deliberately leaves the bound target value, the active target, docked
   * visibility, and all developer configuration untouched, so a reused
   * instance can start clean without being recreated - call it, for example,
   * from a dialog's `beforeOpen` so a reopened keyboard never carries a stale
   * armed Shift.
   *
   * @public
   * @since 0.1.0
   */
  reset(): this {
    // Abort (not commit) any in-progress composition: reset discards the
    // interaction rather than flushing a half-formed syllable to the target.
    this._dropComposition("reset");
    // A fresh input context cannot leave a keycap painted, a blur listener armed,
    // or a pending touchend still able to type.
    this._leaveSurface();
    this._shiftState.reset();
    // Returns to the base layout and re-renders; fires layoutChange only on a
    // real change.
    return this.resetLayout();
  }

  /**
   * Sets the active target association without triggering a re-render,
   * since the association does not affect the keyboard's visual output.
   * Also moves the physical keyboard highlight delegation to the new target.
   */
  _setActiveTarget(target?: string | Control): this {
    const previousTarget = this._getActiveTargetId();

    // Captured now, fired last (see below).
    const fireDeferredChange = this._targetSession.captureAndClearDirty();

    this._physicalKeyHighlight.detach();

    // If the keyboard is open, restore the old target's inputmode
    // before switching so it's not left suppressed.
    if (this.isOpen()) {
      this._nativeKbSuppression.restore();
    }

    this._targetSession.resetForTargetSwitch();

    this.setAssociation("_activeTarget", target ?? "", true);

    const newId = this._getActiveTargetId();
    const isRealSwitch = newId !== previousTarget;

    // A real switch starts a fresh input context: shift resets, a composition
    // commits (the cached middleware holds the old target's preedit offsets), a
    // {layout:X} pick drops back to the base. A same-input refocus (caret
    // reposition) keeps all three.
    if (isRealSwitch) {
      this._shiftState.reset();
      this._dropComposition("commit");
      if (this._layoutState.getSource() === "user") {
        this._layoutState.clearUserOverride(LayoutChangeReason.User);
        this.invalidate();
      }
    }

    if (newId && this._isTargetOfOther(newId)) {
      Log.warning(
        `KioskKeyboard: active target "${newId}" is already targeted by another KioskKeyboard instance`,
        undefined,
        "ui5.kiosk.KioskKeyboard",
      );
    }

    if (newId) {
      const next = Element.getElementById(newId);
      if (next) {
        this._physicalKeyHighlight.attach(next, newId);

        // Dev-time check: warn if the control won't work as a target
        const focusRef = next.getFocusDomRef();
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

    if (this.isOpen()) {
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
    return Array.isArray(value) ? "" : (value ?? "");
  }

  _getKeyboardTypeSource(): KeyboardTypeSource {
    return this._keyboardTypeSource;
  }

  /** Called once the `keyboardType` property holds the new type, which the layout derives from. */
  _setKeyboardTypeSource(source: KeyboardTypeSource): void {
    this._keyboardTypeSource = source;
    // A keyboardType change (explicit, reset, or auto-detected) invalidates
    // any prior user-driven layout switch; the resolved layout must follow
    // the new constraint context.
    this._layoutState.clearUserOverride(LayoutChangeReason.KeyboardTypeChange);
    // A keyboardType change swaps the rendered surface exactly as `{layout:*}`
    // does, so it ends the typing context the same way: shift and Caps Lock
    // included (webc parity).
    this._shiftState.reset();
    // End any in-progress composition so the next key resolves against the new
    // effective layout, the way a layout switch does.
    this._dropComposition("commit");
    // A constraint suspends the width tier, so lifting one re-derives the layout that
    // surfaces from under it.
    this._layoutState.refresh(LayoutChangeReason.KeyboardTypeChange);
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
  setControls(controls: ControlID[]): this {
    this.setProperty("controls", controls, true);
    this._controlsDelegation.sync();
    return this;
  }

  /** Re-resolves the `controls` list against live instances (used by auto-show on focusin). */
  _syncControls(): void {
    this._controlsDelegation.sync();
  }

  /**
   * Custom setter for autoShow - the auto-show document listeners on the
   * AutoShowBehavior delegate are armed while the keyboard is docked with autoShow on.
   *
   * @public
   * @since 0.1.0
   */
  setAutoShow(isAutoShow: boolean): this {
    this.setProperty("autoShow", isAutoShow, true);
    this._autoShowBehavior.sync();
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
    this.setProperty("keyboardType", type);
    this._setKeyboardTypeSource("explicit");
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
    this.setProperty("keyboardType", KeyboardType.Full);
    this._setKeyboardTypeSource("unset");
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
   * without changing the observed border-box size, such as fixed-height styling
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
    const dom = this._rootDomRef();
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
   * back to the built-in resolver. A `null` from this resolver does not
   * reach the global one.
   *
   * @param fnResolver Custom resolver function, or `null` to clear.
   * @public
   * @since 0.1.0
   */
  setTargetResolver(fnResolver: TargetResolver | null): this {
    this._targetResolverInstance = fnResolver;
    this._targetSession.setTargetResolver(this._getEffectiveResolver());
    return this;
  }

  /**
   * Returns the instance-level target resolver, or `null`.
   * @public
   * @since 0.1.0
   */
  getTargetResolver(): TargetResolver | null {
    return this._targetResolverInstance;
  }

  /**
   * Returns the effective resolver: instance-level first, then global, then `null`.
   * @private
   */
  _getEffectiveResolver(): TargetResolver | null {
    return this._targetResolverInstance ?? KioskKeyboard._globalTargetResolver;
  }

  /**
   * Custom setter for docked - manages CSS on the existing DOM
   * rather than re-rendering (which would disrupt transitions).
   */
  setDocked(isDocked: boolean): this {
    const wasDocked = this.getDocked();
    if (wasDocked === isDocked) return this;

    if (wasDocked) this.close();

    this.setProperty("docked", isDocked, true);
    this._autoShowBehavior.sync();
    const dom = this._rootDomRef();
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
    // Before the open guard: a deferred auto-show close must not land on an
    // already-open keyboard that show() was just called on.
    this._autoShowBehavior.cancelPendingClose();
    if (this._dockSession || !this._canOpen()) return this;

    this._dockSession = { escape: new AbortController() };
    this._nativeKbSuppression.suppress();
    document.addEventListener("keydown", (e) => this._onDocumentEscapeKeydown(e), {
      capture: true,
      signal: this._dockSession.escape.signal,
    });
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
    const session = this._dockSession;
    if (!session) return this;
    // Drop both in-flight presses and any open accent popup before the session
    // closes: a keyboard sliding out of view cannot leave a keycap painted, a
    // blur listener armed, a popup floating over the page, or a pending touchend
    // still able to type into the target it just left.
    this._leaveSurface();
    this._targetSession.fireChangeIfDirty();
    this._dockSession = null;
    this._nativeKbSuppression.restore();
    session.escape.abort();
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
    return this._dockSession !== null;
  }

  /**
   * The one gate every open path passes, public `show()` and both focus paths alike.
   * A docked keyboard opens only while visible, and not where the native keyboard
   * takes over. Placement is not required, so `show()` works ahead of the first render.
   */
  private _canOpen(): boolean {
    return this.getVisible() && !this._nativeKbSuppression.shouldDeferToNative();
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
    if (!this.isOpen()) return;

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

  override getFocusInfo(): KioskKeyboardFocusInfo {
    return { id: this.getId(), lastFocusedKey: this._keyGridNav.getLastFocusedKey() };
  }

  override applyFocusInfo(oFocusInfo: {
    id?: string;
    preventScroll?: boolean;
    lastFocusedKey?: KeyPosition | null;
  }): this {
    // Disabled keyboard: the renderer set all keys to tabindex="-1".
    // Do not restore focus - it would undo the renderer's decision.
    if (!this.getEnabled()) {
      return this;
    }

    const pos = oFocusInfo.lastFocusedKey;
    if (pos) {
      const el = this.getDomRef()?.querySelector(KIOSK_KEYBOARD_DOM.selectors.keyByPosition(pos.row, pos.col));
      if (el instanceof HTMLElement) {
        el.setAttribute("tabindex", "0");
        this._focusWithOptions(el, oFocusInfo.preventScroll);
        return this;
      }
    }
    // Fallback: focus the first key (e.g. after layout switch where the
    // previously focused key no longer exists). This prevents Popover
    // auto-close when the keyboard re-renders inside one.
    const first = this.getDomRef()?.querySelector(KIOSK_KEYBOARD_DOM.selectors.key);
    if (first instanceof HTMLElement) {
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

    element.focus({ preventScroll });
  }

  /**
   * The `data-key` value the roving tab stop currently sits on, or `null` when
   * the keyboard has no tab stop to carry over. A key holding DOM focus wins over
   * the remembered one, since arrow navigation is not the only way onto a key.
   */
  private _focusAnchorValue(): string | null {
    const dom = this.getDomRef();
    if (!dom) return null;

    const active = document.activeElement;
    const focused =
      active instanceof HTMLElement && active.classList.contains(KIOSK_KEYBOARD_DOM.classes.key) && dom.contains(active)
        ? active
        : null;
    const last = this._keyGridNav.getLastFocusedKey();
    const anchor =
      focused ?? (last ? dom.querySelector(KIOSK_KEYBOARD_DOM.selectors.keyByPosition(last.row, last.col)) : null);
    return anchor?.getAttribute(KIOSK_KEYBOARD_DOM.attributes.key) ?? null;
  }

  /**
   * Re-seats the roving tab stop onto the key carrying `value` in the newly
   * resolved layout, or the first key when there is none. Key elements are
   * identified by grid position, so following the value keeps a keyboard user on
   * their key across any layout change. Only the remembered position moves: the
   * framework calls `applyFocusInfo` only when focus was inside the control, so
   * focus on the target input is never taken.
   */
  private _reseatFocusAnchor(value: string | null): void {
    const layout = value === null ? [] : this._getResolvedLayout();
    for (let row = 0; row < layout.length; row++) {
      const col = layout[row]!.findIndex((key) => key.value === value);
      if (col !== -1) {
        this._keyGridNav.setLastFocusedKey({ row, col });
        return;
      }
    }
    this._keyGridNav.setLastFocusedKey(null);
  }

  // ── Accessibility ──

  override getAccessibilityInfo(): AccessibilityInfo {
    return {
      role: "group",
      type: getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard"),
      description: this.getAriaLabel() || getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard"),
      focusable: this.getEnabled(),
      enabled: this.getEnabled(),
    };
  }

  /**
   * Queues text for the ARIA live region and drains what is due.
   *
   * Drained here rather than only from `onAfterRendering`: most callers (`show`,
   * `close`, the variant popup) change no rendered state, so no render would follow.
   */
  private _announceLiveRegion(text: string): void {
    KioskKeyboard._announcements.announce(text);
    KioskKeyboard._announcements.flush();
  }

  // ── Internal renderer helpers ──

  /**
   * Typed capability object for KioskKeyboardRenderer, checked structurally
   * against {@link RendererInternalApi}; created once per instance.
   *
   * @internal Used by KioskKeyboardRenderer only.
   */
  _getRendererApi(): RendererInternalApi {
    if (!this._rendererApi) {
      this._rendererApi = {
        _isShiftActive: () => this._isShiftActive(),
        _isCapsLock: () => this._isCapsLock(),
        _isKeyPressed: (row, col) => {
          const held = [this._keyboardPressedKeyEl, ...Array.from(this._presses.values(), (press) => press.keyEl)];
          return held.some((el) => {
            const pos = el ? keyPositionOf(el) : null;
            return pos?.row === row && pos.col === col;
          });
        },
        _getHighlightedKey: () => this._physicalKeyHighlight.getHighlightedKey(),
        _getResolvedLayout: () => this._getResolvedLayout(),
        _getLayoutLang: () => this._getLayoutLang(),
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

  private _isCapsLock(): boolean {
    return this._shiftState.isCapsLock;
  }

  /**
   * Announces a shift/caps transition and repaints the keycaps.
   *
   * Wired as the `ShiftState` change callback, so every mutator - a `{shift}` tap,
   * the auto-release after a shifted key, a physical modifier and the reset a layout
   * switch performs - routes through here. Caps Lock is settled before Shift:
   * `isShifted` is true in both modes, so a Caps Lock exit - to Off or to Shift -
   * would otherwise read as a shift release.
   */
  private _syncShiftState(): void {
    const wasShifted = this._announcedShifted;
    const wasCapsLock = this._announcedCapsLock;
    this._announcedShifted = this._shiftState.isShifted;
    this._announcedCapsLock = this._shiftState.isCapsLock;

    if (!wasCapsLock && this._announcedCapsLock) {
      this._announceLiveRegion(getText("ARIA_CAPS_LOCK_ON", "Caps Lock on"));
    } else if (wasCapsLock && !this._announcedCapsLock) {
      this._announceLiveRegion(getText("ARIA_CAPS_LOCK_OFF", "Caps Lock off"));
    } else if (!wasShifted && this._announcedShifted) {
      this._announceLiveRegion(getText("ARIA_SHIFT_ON", "Shift on"));
    } else if (wasShifted && !this._announcedShifted) {
      this._announceLiveRegion(getText("ARIA_SHIFT_OFF", "Shift off"));
    }

    this.invalidate();
  }

  /**
   * The BCP-47 language of the active layout's keycaps, or `undefined` when they
   * are in the UI language. The renderer puts it on the labels that carry the
   * layout's script so assistive tech announces them with that language's
   * pronunciation rules (WCAG 2.2 SC 3.1.2 Language of Parts).
   */
  private _getLayoutLang(): string | undefined {
    return getLayoutMeta(this._layoutState.resolvedName(), this._foldCache.get().layoutMeta)?.lang;
  }

  /** Resolve the effective layout used by the renderer. */
  private _getResolvedLayout(): LayoutDefinition {
    const layoutName = this._layoutState.resolvedName();
    const fold = this._foldCache.get();
    const resolved = registryGetLayoutOrDefault(layoutName, fold.layouts);
    const constrainedName = constrainedLayoutName(this.getKeyboardType());
    const base =
      constrainedName === null
        ? resolved
        : reconcileBaseSwitch(resolved, layoutName, constrainedName, {
            icon: LAYOUT_RETURN_ICON,
            ariaLabel: getText("ARIA_RETURN_TO_NUMBERS", "Return to numbers"),
          });
    // Opt-in Latin-diacritics: fill the resolved table's variants onto matching
    // base keys so umlauts/accents are reachable without editing layout data;
    // a layout the table resolution excludes keeps its keys unchanged. Author-declared
    // `variants` always win (applyVariantDefaults guarantees this).
    const defaults = this._resolvedDefaultVariants();
    const armed = this.getAccentVariants();
    this._noteDisarmedVariants(!armed && (fold.variants !== undefined || defaults !== null));
    if (!armed) return base;
    const table = resolveVariantTable(layoutName, fold.variants, defaults);
    return table ? applyVariantDefaults(base, table) : base;
  }

  /**
   * Warns on entering the state in which a variant table is declared while
   * `accentVariants` is off: the tables resolve but nothing applies them.
   */
  private _noteDisarmedVariants(disarmed: boolean): void {
    const was = this._disarmedVariants;
    this._disarmedVariants = disarmed;
    if (!disarmed || was) return;
    Log.warning(
      "A variant table is declared but accentVariants is false, so no variant table is applied. Set accentVariants to arm the long-press popups.",
      undefined,
      "ui5.kiosk.KioskKeyboard",
    );
  }

  /**
   * Resolves the effective, Shift/Caps-mapped variants for a rendered key from
   * its grid position, or `null` when the key declares none. Used by the popup
   * behavior to build the option listbox.
   */
  private _resolveKeyVariants(keyEl: HTMLElement): { base: string; glyphs: string[] } | null {
    const pos = keyPositionOf(keyEl);
    if (!pos) return null;
    const key = this._getResolvedLayout()[pos.row]?.[pos.col];
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
   * literal insert at the caret.
   */
  private _commitVariant(glyph: string): void {
    const shift = this._isShiftActive();
    if (this.fireKeyPress({ key: glyph, shiftKey: shift })) {
      if (!this._tryCompositionMiddleware(glyph)) this._targetSession.insertText(glyph);
    }
    // A committed variant is a character key, and `spendsOneShotShift("char")`
    // is true on every branch above, the vetoed one included.
    this._shiftState.autoRelease();
  }

  /**
   * Returns the hidden `_variantPopover`, creating its shell on first use. Mirrors
   * content density on every call, since a static-area popover cannot inherit it by
   * DOM ancestry.
   */
  private _getVariantPopover(): Popover {
    const held = this.getAggregation("_variantPopover");
    let popover: Popover;
    if (held instanceof Popover) {
      popover = held;
    } else {
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
    // SAFETY: the check establishes Control; the subclass T is the caller's claim.
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
   * Prevents focus from leaving the target input when clicking anywhere
   * on the keyboard surface - keys, rows, or gaps between keys - and begins a
   * press for every pointer that lands on a key.
   *
   * Uses UI5's EventSimulation touchstart (fires for both mouse and touch)
   * instead of raw pointerdown. preventDefault() on the underlying
   * mousedown/touchstart prevents focus transfer without suppressing the
   * click/tap chain - unlike pointerdown's preventDefault() which
   * suppresses all compatibility mouse events per the Pointer Events spec.
   */
  ontouchstart(event: Event): void {
    event.preventDefault();

    // EventSimulation maps EVERY mouse button's mousedown onto this simulated
    // touchstart, so only a primary press may drive a key: a right-click is the
    // context-menu gesture (`oncontextmenu`), not a key press. A genuine touch
    // carries no `button`, and so passes.
    if (isSecondaryPress(event)) return;

    for (const { identifier, target } of changedPointers(event)) {
      const el = this._resolveKeyElementFromEventTarget(target);
      if (el) this._beginPress(identifier, el);
    }
  }

  /**
   * Begins pointer `id`'s press on `el`. A new press stops the repeat and the
   * accent hold every other live press armed, the way a physical keyboard stops
   * repeating a held key once another goes down; those presses still activate on
   * their own release.
   */
  private _beginPress(id: number, el: HTMLElement): void {
    // A press on any key while the accent popup is open dismisses it (the
    // popup's options live in the static area, so a key press is always
    // "outside"), then proceeds so the same tap also types the key. The
    // framework autoClose does not fire for the keyboard's own keys because of
    // the preventDefault in ontouchstart, so close it explicitly here. A key that
    // has variants may become a re-anchor, so its options stay up until the hold
    // claims them or the release dismisses them for a plain tap.
    if (!el.hasAttribute(KIOSK_KEYBOARD_DOM.attributes.hasVariants)) {
      this._variantPopup.dismissOpen();
    }
    // A pointer still on record lost its release; it ends unactivated.
    this._endPress(id);
    for (const other of this._presses.values()) this._stopPressTimers(other);

    const enabled = this.getEnabled();
    // Safety net: if the window loses focus before touchend/touchcancel fires
    // (e.g. Alt-Tab during a mousedown, or a modal popup steals focus), the
    // gesture is abandoned, like a cancel, so no keycap stays pressed.
    const blur = new AbortController();
    window.addEventListener("blur", () => this.ontouchcancel(), { signal: blur.signal });
    const repeat =
      enabled && el.dataset.key === "{backspace}"
        ? new BackspaceRepeatBehavior(() => this._performBackspaceRepeatTick())
        : null;
    const hold = this._variantPopup.onPress(el, enabled);
    this._presses.set(id, { keyEl: el, key: el.dataset.key, blur, repeat, hold });
    el.classList.add(KIOSK_KEYBOARD_DOM.classes.keyPressed);
  }

  /** Stops the repeat and the accent hold `press` armed, leaving the press itself live. */
  private _stopPressTimers(press: Press): void {
    press.repeat?.stop();
    if (press.hold) {
      this._variantPopup.stop();
      press.hold = false;
    }
  }

  /**
   * The single exit of a pointer press: releases what it armed and unpaints its
   * key unless another live press holds the same key. Returns the ended press, or
   * `null` when the pointer had none.
   */
  private _endPress(id: number): Press | null {
    const press = this._presses.get(id);
    if (!press) return null;
    this._presses.delete(id);
    this._stopPressTimers(press);
    press.blur.abort();
    const stillHeld = Array.from(this._presses.values()).some((other) => other.keyEl === press.keyEl);
    if (!stillHeld) press.keyEl.classList.remove(KIOSK_KEYBOARD_DOM.classes.keyPressed);
    return press;
  }

  /**
   * Ends every press, pointer and keyboard, without activating any, and abandons
   * a re-anchor a hold parked.
   */
  private _cancelAllPresses(): void {
    this._variantPopup.cancelPending();
    for (const id of Array.from(this._presses.keys())) this._endPress(id);
    this._clearKeyboardPressedState();
  }

  /**
   * The keyboard surface went away or changed under the user (hide, disable,
   * close, reset, layout change): every press ends and the accent popup, whose
   * options were resolved from that surface, is abandoned.
   */
  private _leaveSurface(): void {
    this._cancelAllPresses();
    this._variantPopup.abandon();
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
    this._cancelAllPresses();
    this._variantPopup.openFor(el);
  }

  /** Activates each released pointer's key, when the release lands on the key it pressed (dragging away cancels). */
  ontouchend(event: Event): void {
    // The mirror of the ontouchstart filter: a non-primary release is not a key
    // activation, and must not tear down a primary press that is still live.
    if (isSecondaryPress(event)) return;

    for (const { identifier, target } of changedPointers(event)) {
      this._releasePress(identifier, target);
    }
  }

  private _releasePress(id: number, target: EventTarget | null): void {
    const press = this._endPress(id);

    if (!this.getEnabled() || !press) return;

    const pressed = press.keyEl;
    const el = this._resolveKeyElementFromEventTarget(target);
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

    this._keyGridNav.setLastFocusedKey(keyPositionOf(pressed));

    // A held Backspace already deleted via auto-repeat; skip the release delete
    // so lifting off does not remove one extra character.
    if (press.repeat?.didRepeat) return;

    if (variantOwnsRelease) return;

    this._handleKeyAction(keyValue, pressed);
  }

  /** The browser took the gesture away: every press ends unactivated. */
  ontouchcancel(): void {
    this._cancelAllPresses();
  }

  /**
   * Activate the focused key on Enter or Space without modifiers.
   *
   * Uses UI5's `sapselect` pseudo-event, which the framework filters to
   * Enter/Space with no Ctrl/Alt/Shift/Meta held, so Ctrl+Space and
   * similar combinations cannot accidentally trigger key activation.
   */
  onsapselect(event: Event): void {
    this._activateFocusedKey(event, false);
  }

  /**
   * Activate the focused key on Shift+Enter or Shift+Space, typing its shifted
   * glyph.
   *
   * `sapselectmodifiers` is UI5's public counterpart to `sapselect`, firing for
   * the same keys when any of Shift/Alt/Ctrl is held. Only Shift alone means
   * "activate shifted" here; the rest stay browser and OS shortcuts.
   *
   * The Shift is transient - it types one shifted glyph without latching the
   * on-screen `{shift}` state, so the keycap labels do not flip. That mirrors a
   * physical keyboard and is the only way a roving-tabindex user can type a
   * capital without round-tripping through the `{shift}` key: the physical
   * modifier sync in `PhysicalKeyHighlight` is attached to the target input, so
   * it never runs while focus sits on a keycap.
   */
  onsapselectmodifiers(event: Event): void {
    const native = nativeKeyEvent(event);
    if (!native.shiftKey || native.ctrlKey || native.altKey || native.metaKey) return;
    this._activateFocusedKey(event, true);
  }

  /**
   * Releases the keyboard-activation pressed state. A key activated from the
   * physical keyboard stays visually pressed for as long as the activating key
   * is held, the way `sap.m.Button` pairs `_activeButton` with `_inactiveButton`.
   *
   * Only Enter and Space end the press. Shift+Enter is a two-key hold, and
   * lifting the Shift first must not read as the release.
   */
  onkeyup(event: Event): void {
    const { key } = nativeKeyEvent(event);
    if (key !== "Enter" && key !== " ") return;
    this._clearKeyboardPressedState();
  }

  /**
   * Alt-Tab and similar take focus away without ever delivering the keyup, so
   * the pressed state would otherwise stick on the abandoned keycap.
   */
  onfocusout(): void {
    this._clearKeyboardPressedState();
  }

  /**
   * Shared body of the two keyboard-activation handlers.
   *
   * One activation per press: both pseudo-events map onto keydown, so the OS
   * auto-repeat of a held key is dropped. `{backspace}` is the only key that
   * repeats, from pointer input on `BackspaceRepeatBehavior`'s tuned curve.
   */
  private _activateFocusedKey(event: Event, shifted: boolean): void {
    if (!this.getEnabled()) return;

    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains(KIOSK_KEYBOARD_DOM.classes.key)) return;

    const keyValue = target.dataset.key;
    if (!keyValue) return;

    // Ahead of the repeat guard: the page must not scroll while Space is held.
    event.preventDefault();
    if (nativeKeyEvent(event).repeat) return;

    this._setKeyboardPressedState(target);
    this._handleKeyAction(keyValue, target, shifted);
  }

  /**
   * Marks `el` as pressed for the duration of a keyboard activation, so the
   * keycap gives the same feedback a pointer press does. Held separately from
   * the pointer presses, which also drive backspace repeat and the variant
   * popup; a keyboard activation is only the visual half.
   */
  private _setKeyboardPressedState(el: HTMLElement): void {
    this._clearKeyboardPressedState();
    this._keyboardPressedKeyEl = el;
    el.classList.add(KIOSK_KEYBOARD_DOM.classes.keyPressed);
  }

  private _clearKeyboardPressedState(): void {
    this._keyboardPressedKeyEl?.classList.remove(KIOSK_KEYBOARD_DOM.classes.keyPressed);
    this._keyboardPressedKeyEl = null;
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

  _wouldClaimInput(target: EventTarget | null): boolean {
    return this._focusClaimService.wouldClaimInput(target);
  }

  _resolveClaimableControl(target: EventTarget | null): Control | null {
    return this._focusClaimService.resolveClaimableControl(target);
  }

  /** Whether `node` is inside the control-owned accent-variant Popover (rendered into the static area). */
  _isNodeInVariantPopover(node: Node | null): boolean {
    const popover = this.getAggregation("_variantPopover");
    if (!(popover instanceof Popover)) return false;
    return popover.getDomRef()?.contains(node) ?? false;
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
    // The factory check runs before the composition gate: a non-composition key pressed
    // after a swap must still commit, or a stale buffer stays attached to a middleware
    // the resolved layout no longer reads.
    const factory = registryGetMiddlewareFactory(this._layoutState.resolvedName(), this._foldCache.get().middleware);
    if (factory !== this._middlewareFactory) {
      // Commit rather than reset: the characters already typed are the user's.
      this._dropComposition("commit");
      this._middlewareFactory = factory;
    }
    if (!this._keyAffectsComposition(keyValue)) return false;
    if (!this._middleware && factory) this._middleware = factory();
    if (this._middleware) {
      const targetEl = this._getTargetElement();
      const mwTarget = targetEl
        ? resolveWithCustomResolver(targetEl.getFocusDomRef(), this._getEffectiveResolver())
        : null;
      if (mwTarget && this._middleware.handleKey(keyValue, mwTarget)) return true;
    }
    return false;
  }

  /**
   * Fires the cancelable `keyPress` event and, unless vetoed, deletes one
   * grapheme from the target. Shared by the single Backspace tap and the
   * auto-repeat tick. Returns `false` only when the key fired but nothing was
   * deleted (empty input / cursor at start), which the repeater uses to stop.
   *
   * @param shift The Shift the activation carried, which for a keyboard
   *   activation may be the transient modifier rather than the latched state.
   *   The auto-repeat tick drives this from pointer input, where the latch is
   *   the only source.
   */
  private _performBackspaceDelete(shift = this._isShiftActive()): boolean {
    if (!this.fireKeyPress({ key: "Backspace", shiftKey: shift })) return true; // consumer vetoed this tick; keep the gesture alive
    return this._targetSession.handleBackspace();
  }

  /**
   * One Backspace deletion for an auto-repeat tick: the middleware-then-delete
   * path a single tap takes, plus the latch spend the tap gets from
   * `_handleKeyAction`. Returns `false` only when the key fired but nothing was
   * deleted, which the repeater uses to stop.
   */
  private _performBackspaceRepeatTick(): boolean {
    const handled = this._tryCompositionMiddleware("{backspace}") || this._performBackspaceDelete();
    this._shiftState.autoRelease();
    return handled;
  }

  /**
   * @param transientShift Shift held on the activating keystroke itself, which
   *   types the shifted glyph without latching the on-screen `{shift}` state.
   */
  private _handleKeyAction(keyValue: string, el: HTMLElement, transientShift = false): void {
    const shift = transientShift || this._isShiftActive();
    const action = parseKeyAction(keyValue);

    // Shift toggles before composition: the middleware would otherwise treat
    // it as a composition-affecting key.
    if (action.kind === "shift") {
      this._toggleShift(el);
      return;
    }

    this._performKeyAction(action, keyValue, el, shift);

    // Which keys spend a latched one-shot Shift depends on the key kind alone.
    if (spendsOneShotShift(action.kind)) this._shiftState.autoRelease();
  }

  /**
   * Runs what the key does, leaving the one-shot Shift to the caller.
   *
   * @param action Everything except `{shift}`, which `_handleKeyAction`
   *   settles itself before composition can see it.
   */
  private _performKeyAction(
    action: Exclude<KeyAction, { kind: "shift" }>,
    keyValue: string,
    el: HTMLElement,
    shift: boolean,
  ): void {
    if (this._tryCompositionMiddleware(keyValue)) return;

    switch (action.kind) {
      case "backspace":
        this._performBackspaceDelete(shift);
        return;

      case "enter":
        if (this.fireKeyPress({ key: "Enter", shiftKey: shift })) {
          this._targetSession.handleEnter();
        }
        return;

      case "layout": {
        // `base` re-engages the keyboardType constraint; any other pick is
        // user-driven and overrides it (webc parity).
        const name = action.target === LAYOUT_BASE ? this._layoutState.getBaseLayout() : action.target;
        const source = action.target === LAYOUT_BASE ? "external" : "user";
        this._layoutState.perform(name, source, "referenced by a {layout:*} key", LayoutChangeReason.User);
        return;
      }

      case "fkey": {
        // Fire keyPress first so consumers can prevent all downstream action
        // (including native F5 reload / F11 fullscreen in fKeyMode="Native").
        if (this.fireKeyPress({ key: action.name, shiftKey: shift })) {
          this._fKeyController.handle(action.name, shift);
        }
        return;
      }

      case "unknown":
        // An unrecognised {...} token fires keyPress for a consumer to handle and
        // inserts nothing, so a typo such as {bcksp} never types its own braces.
        if (this.fireKeyPress({ key: action.raw, shiftKey: shift })) {
          Log.warning(
            `Unrecognized key token "${action.raw}": not a built-in special key. Ignoring (no text inserted).`,
            undefined,
            "ui5.kiosk.KioskKeyboard",
          );
        }
        return;

      case "char": {
        // Regular character - resolve its Shift/Caps form (incl. CapsLock ß -> ẞ).
        const effective = shift ? shiftedGlyph(action.text, el.dataset.shiftValue, this._isCapsLock()) : action.text;

        if (this.fireKeyPress({ key: effective, shiftKey: shift })) {
          this._targetSession.insertText(effective);
        }
        return;
      }

      default:
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
   */
  private _getTargetElement(): Element | null {
    const id = this._getActiveTargetId();
    if (!id) return null;
    return Element.getElementById(id) ?? null;
  }
}
