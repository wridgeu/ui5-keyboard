import { KeyboardType } from "ui5/kiosk/library";
import Event from "sap/ui/base/Event";
import { MobileKeyboard } from "ui5/kiosk/library";
import { FKeyMode } from "ui5/kiosk/library";
import { ControlID } from "ui5/kiosk/library";
import { VariantOverrideTable } from "ui5/kiosk/library";
import CustomLayout from "ui5/kiosk/CustomLayout";
import { AggregationBindingInfo } from "sap/ui/base/ManagedObject";
import Control from "sap/ui/core/Control";
import { PropertyBindingInfo } from "sap/ui/base/ManagedObject";
import { $ControlSettings } from "sap/ui/core/Control";

declare module "./KioskKeyboard" {

    /**
     * Interface defining the settings object used in constructor calls
     */
    interface $KioskKeyboardSettings extends $ControlSettings {

        /**
         * Active layout name. Only effective when keyboardType is "Full".
        Auto-detected from the UI5 locale when omitted.
        
        This holds the layout on screen, not the last one asked for: a `{layout:*}` key
        and an `autoCompact` width swap both write it, the way `sap.f.DynamicPage`
        writes `headerExpanded` on a scroll-driven collapse. Bind it `mode: "OneWay"`
        when it holds a stored preference, or a detected value travels back into the
        model; take user-driven changes from `layoutChange`, whose `autoDetected`
        parameter is `false` for exactly those.
         *
         * @since 0.1.0
         */
        layout?: string | PropertyBindingInfo;

        /**
         * Keyboard display type.
        `"Full"` renders the active layout. `"Numeric"` and `"Numpad"` render
        compact number-oriented layouts regardless of the layout property.
        
        Setting this property (via setter, constructor, or XML attribute)
        disables auto-type detection permanently.
        Call `resetKeyboardType()` to re-enable it.
         *
         * @since 0.1.0
         */
        keyboardType?: KeyboardType | PropertyBindingInfo | `{${string}}`;

        /**
         * Whether the keyboard is interactive. When `false`, all keys are
        visually dimmed and pointer events are disabled.
         *
         * @since 0.1.0
         */
        enabled?: boolean | PropertyBindingInfo | `{${string}}`;

        /**
         * Accessible label for the keyboard group. Defaults to
        "Virtual Keyboard" from the resource bundle when left empty.
         *
         * @since 0.1.0
         */
        ariaLabel?: string | PropertyBindingInfo;

        /**
         * When `true`, the keyboard anchors to the bottom of the viewport
        and slides in/out. Use `show()` / `close()` to control
        visibility manually, or set `autoShow` to `true` for automatic
        focus-based behavior.
         *
         * @since 0.1.0
         */
        docked?: boolean | PropertyBindingInfo | `{${string}}`;

        /**
         * When `true`, the docked keyboard automatically opens when any
        `<input>` or `<textarea>` receives focus, and closes when
        focus leaves. Requires `docked="true"`.
         *
         * @since 0.1.0
         */
        autoShow?: boolean | PropertyBindingInfo | `{${string}}`;

        /**
         * When `true` and `autoShow` is active, the keyboard inspects the
        focused input's type metadata and automatically switches between
        Full and Numpad keyboard types.
        
        Has no effect when `keyboardType` has been set explicitly (via
        setter, constructor, or XML attribute), because that locks the
        keyboard type. Call `resetKeyboardType()` to clear the lock
        and re-enable auto-type detection.
         *
         * @since 0.1.0
         */
        autoType?: boolean | PropertyBindingInfo | `{${string}}`;

        /**
         * When `true`, a layout that declares a compact counterpart yields to it on a
        keyboard too narrow to seat its rows, and takes it back when the room returns.
        
        Layout data is the one responsive dimension CSS cannot reach: a `@container`
        rule restyles a row but cannot re-seat its keys, and arrow-key navigation moves
        on the resolved layout rather than on rendered geometry. Of the built-ins only
        `ja-kana` declares one (`ja-kana-compact`); a custom layout declares its own
        with the `compact` property of a `customLayouts` entry.
        
        The swap fires `layoutChange` with `autoDetected: true` and never overrides an
        explicit choice: the layout you set stays the one it resolves against, so a
        `setLayout` or a `{layout:*}` key still wins and is re-tiered from there.
        
        The width is taken from the keyboard's own box, so an embedded keyboard tiers
        on the room it was granted rather than on the viewport. Override the threshold
        with the `--ui5KioskKeyboard-autoCompactThreshold` custom property.
         *
         * @since 0.1.0
         */
        autoCompact?: boolean | PropertyBindingInfo | `{${string}}`;

        /**
         * When `true`, a built-in Latin-diacritics table is merged onto the
        resolved layout so every matching base letter (a, e, i, o, u, c, n,
        s, y, z, l, ...) gains a long-press / right-click accent-variant
        popup, making German umlauts (ä/ö/ü) and the sharp S (ß/ẞ) reachable
        from any Latin layout without editing layout data. `ja-romaji` is
        excluded with the other non-Latin built-ins; a `variants` table on a
        `customLayouts` entry arms it anyway.
        
        A per-key `variants` declaration always wins over the default table.
        When Shift or Caps Lock is active, the popup surfaces the uppercase
        forms (including ẞ for ß). Default `false` (off).
         *
         * @since 0.1.0
         */
        accentVariants?: boolean | PropertyBindingInfo | `{${string}}`;

        /**
         * Controls whether the KioskKeyboard or the native on-screen
        keyboard is used.
        
        - `"Auto"` (default) - uses KioskKeyboard on desktop browsers,
          defers to the native keyboard on phones and tablets. On a
          regular laptop/desktop with a physical keyboard the virtual
          keyboard **will** still appear - use `"Native"` if that
          is not desired.
        - `"Custom"` - always uses the KioskKeyboard and suppresses
          the native keyboard via `inputmode="none"`. Best for
          **dedicated kiosk terminals** without a physical keyboard.
        - `"Native"` - always defers to the native keyboard; the
          KioskKeyboard will not open on focus.
         *
         * @since 0.1.0
         */
        mobileKeyboard?: MobileKeyboard | PropertyBindingInfo | `{${string}}`;

        /**
         * Controls how virtual F-key taps are handled.
        
        - `"Virtual"` (default): fire `keyPress` only. The app decides what to do.
        - `"Native"`: dispatch a synthetic `keydown` for standard
          function/navigation keys (`F1`-`F12`, arrows, `Home`/`End`,
          `PageUp`/`PageDown`) to the current target element (or document
          fallback). If not canceled, built-in native actions run for
          selected keys (`F5`, `F11`).
        - `"None"`: fire `keyPress` only, skip native dispatch and
          built-in navigation actions entirely.
         *
         * @since 0.1.0
         */
        fKeyMode?: FKeyMode | PropertyBindingInfo | `{${string}}`;

        /**
         * List of input control IDs to target. When set, attaches focus
        delegation to each resolved control so the keyboard auto-targets
        whichever input last received focus.
        
        IDs are resolved against the parent View first (view-local IDs),
        then globally. This makes the property safe to use in XML views
        where control IDs are prefixed by the view ID.
        
        In XML the IDs are comma-separated, and whitespace around one is not
        part of it. An entry naming no control is skipped, and reported once
        the keyboard has rendered.
         *
         * @since 0.1.0
         */
        controls?: ControlID[] | PropertyBindingInfo | `{${string}}`;

        /**
         * Long-press variants applied under every layout, merged per base letter beneath
        anything a `customLayouts` entry declares for that layout, so a house accent set
        extends the built-in table rather than replacing it and a base letter mapped to
        `[]` drops that letter everywhere. Base letters must be lowercase. Effective only
        while `accentVariants` is set.
        
        This tier only ever adds; it has no suppression spelling. To take one layout out
        of variants entirely use `suppress="Variants"` on its `CustomLayout`, and to take
        the whole affordance out leave `accentVariants` off, which is the default.
        
        Read by object identity: assign a new object to change the table.
         *
         * @since 0.1.0
         */
        defaultVariants?: VariantOverrideTable | PropertyBindingInfo | `{${string}}`;

        /**
         * Per-instance layouts. Each custom layout declares a layout, or overlays the one its
        `name` already resolves to. Applied in aggregation order: for rows, locales,
        metadata and middleware the last declaration wins; long-press variants
        accumulate per base letter.
         *
         * @since 0.1.0
         */
        customLayouts?: CustomLayout[] | CustomLayout | AggregationBindingInfo | `{${string}}`;
        _activeTarget?: Control | string;
        ariaLabelledBy?: Control | string | (Control | string)[];
        ariaDescribedBy?: Control | string | (Control | string)[];

        /**
         * Fired when a virtual key is pressed. Call `preventDefault()` to
        skip the default input action (text insertion, backspace, etc.).
         *
         * @since 0.1.0
         */
        keyPress?: (event: KioskKeyboard$KeyPressEvent) => void;

        /**
         * Fired when the active layout changes (via a `{layout:name}` key
        or programmatic `setLayout()` call).
         *
         * @since 0.1.0
         */
        layoutChange?: (event: KioskKeyboard$LayoutChangeEvent) => void;

        /**
         * Fired when the keyboard type changes - by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         *
         * @since 0.1.0
         */
        keyboardTypeChange?: (event: KioskKeyboard$KeyboardTypeChangeEvent) => void;

        /**
         * Fired when the active target control changes (focus switches to a
        different input in auto-show mode, or programmatically).
         *
         * @since 0.1.0
         */
        activeControlChange?: (event: KioskKeyboard$ActiveControlChangeEvent) => void;

        /**
         * Fired when `show()` opens the docked keyboard (not tied to CSS transition end).
         *
         * @since 0.1.0
         */
        afterOpen?: (event: KioskKeyboard$AfterOpenEvent) => void;

        /**
         * Fired when `close()` closes the docked keyboard (not tied to CSS transition end).
         *
         * @since 0.1.0
         */
        afterClose?: (event: KioskKeyboard$AfterCloseEvent) => void;
    }

    export default interface KioskKeyboard {

        // property: layout

        /**
         * Gets current value of property "layout".
         *
         * Active layout name. Only effective when keyboardType is "Full".
        Auto-detected from the UI5 locale when omitted.
        
        This holds the layout on screen, not the last one asked for: a `{layout:*}` key
        and an `autoCompact` width swap both write it, the way `sap.f.DynamicPage`
        writes `headerExpanded` on a scroll-driven collapse. Bind it `mode: "OneWay"`
        when it holds a stored preference, or a detected value travels back into the
        model; take user-driven changes from `layoutChange`, whose `autoDetected`
        parameter is `false` for exactly those.
         *
         * @since 0.1.0
         * Default value is: "qwerty"
         * @returns Value of property "layout"
         */
        getLayout(): string;

        /**
         * Sets a new value for property "layout".
         *
         * Active layout name. Only effective when keyboardType is "Full".
        Auto-detected from the UI5 locale when omitted.
        
        This holds the layout on screen, not the last one asked for: a `{layout:*}` key
        and an `autoCompact` width swap both write it, the way `sap.f.DynamicPage`
        writes `headerExpanded` on a scroll-driven collapse. Bind it `mode: "OneWay"`
        when it holds a stored preference, or a detected value travels back into the
        model; take user-driven changes from `layoutChange`, whose `autoDetected`
        parameter is `false` for exactly those.
         *
         * @since 0.1.0
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: "qwerty"
         * @param [layout="qwerty"] New value for property "layout"
         * @returns Reference to "this" in order to allow method chaining
         */
        setLayout(layout: string): this;

        // property: keyboardType

        /**
         * Gets current value of property "keyboardType".
         *
         * Keyboard display type.
        `"Full"` renders the active layout. `"Numeric"` and `"Numpad"` render
        compact number-oriented layouts regardless of the layout property.
        
        Setting this property (via setter, constructor, or XML attribute)
        disables auto-type detection permanently.
        Call `resetKeyboardType()` to re-enable it.
         *
         * @since 0.1.0
         * Default value is: "Full"
         * @returns Value of property "keyboardType"
         */
        getKeyboardType(): KeyboardType;

        /**
         * Sets a new value for property "keyboardType".
         *
         * Keyboard display type.
        `"Full"` renders the active layout. `"Numeric"` and `"Numpad"` render
        compact number-oriented layouts regardless of the layout property.
        
        Setting this property (via setter, constructor, or XML attribute)
        disables auto-type detection permanently.
        Call `resetKeyboardType()` to re-enable it.
         *
         * @since 0.1.0
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: "Full"
         * @param [keyboardType="Full"] New value for property "keyboardType"
         * @returns Reference to "this" in order to allow method chaining
         */
        setKeyboardType(keyboardType: KeyboardType): this;

        // property: enabled

        /**
         * Gets current value of property "enabled".
         *
         * Whether the keyboard is interactive. When `false`, all keys are
        visually dimmed and pointer events are disabled.
         *
         * @since 0.1.0
         * Default value is: true
         * @returns Value of property "enabled"
         */
        getEnabled(): boolean;

        /**
         * Sets a new value for property "enabled".
         *
         * Whether the keyboard is interactive. When `false`, all keys are
        visually dimmed and pointer events are disabled.
         *
         * @since 0.1.0
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: true
         * @param [enabled=true] New value for property "enabled"
         * @returns Reference to "this" in order to allow method chaining
         */
        setEnabled(enabled: boolean): this;

        // property: ariaLabel

        /**
         * Gets current value of property "ariaLabel".
         *
         * Accessible label for the keyboard group. Defaults to
        "Virtual Keyboard" from the resource bundle when left empty.
         *
         * @since 0.1.0
         * Default value is: ""
         * @returns Value of property "ariaLabel"
         */
        getAriaLabel(): string;

        /**
         * Sets a new value for property "ariaLabel".
         *
         * Accessible label for the keyboard group. Defaults to
        "Virtual Keyboard" from the resource bundle when left empty.
         *
         * @since 0.1.0
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: ""
         * @param [ariaLabel=""] New value for property "ariaLabel"
         * @returns Reference to "this" in order to allow method chaining
         */
        setAriaLabel(ariaLabel: string): this;

        // property: docked

        /**
         * Gets current value of property "docked".
         *
         * When `true`, the keyboard anchors to the bottom of the viewport
        and slides in/out. Use `show()` / `close()` to control
        visibility manually, or set `autoShow` to `true` for automatic
        focus-based behavior.
         *
         * @since 0.1.0
         * Default value is: false
         * @returns Value of property "docked"
         */
        getDocked(): boolean;

        /**
         * Sets a new value for property "docked".
         *
         * When `true`, the keyboard anchors to the bottom of the viewport
        and slides in/out. Use `show()` / `close()` to control
        visibility manually, or set `autoShow` to `true` for automatic
        focus-based behavior.
         *
         * @since 0.1.0
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: false
         * @param [docked=false] New value for property "docked"
         * @returns Reference to "this" in order to allow method chaining
         */
        setDocked(docked: boolean): this;

        // property: autoShow

        /**
         * Gets current value of property "autoShow".
         *
         * When `true`, the docked keyboard automatically opens when any
        `<input>` or `<textarea>` receives focus, and closes when
        focus leaves. Requires `docked="true"`.
         *
         * @since 0.1.0
         * Default value is: false
         * @returns Value of property "autoShow"
         */
        getAutoShow(): boolean;

        /**
         * Sets a new value for property "autoShow".
         *
         * When `true`, the docked keyboard automatically opens when any
        `<input>` or `<textarea>` receives focus, and closes when
        focus leaves. Requires `docked="true"`.
         *
         * @since 0.1.0
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: false
         * @param [autoShow=false] New value for property "autoShow"
         * @returns Reference to "this" in order to allow method chaining
         */
        setAutoShow(autoShow: boolean): this;

        // property: autoType

        /**
         * Gets current value of property "autoType".
         *
         * When `true` and `autoShow` is active, the keyboard inspects the
        focused input's type metadata and automatically switches between
        Full and Numpad keyboard types.
        
        Has no effect when `keyboardType` has been set explicitly (via
        setter, constructor, or XML attribute), because that locks the
        keyboard type. Call `resetKeyboardType()` to clear the lock
        and re-enable auto-type detection.
         *
         * @since 0.1.0
         * Default value is: false
         * @returns Value of property "autoType"
         */
        getAutoType(): boolean;

        /**
         * Sets a new value for property "autoType".
         *
         * When `true` and `autoShow` is active, the keyboard inspects the
        focused input's type metadata and automatically switches between
        Full and Numpad keyboard types.
        
        Has no effect when `keyboardType` has been set explicitly (via
        setter, constructor, or XML attribute), because that locks the
        keyboard type. Call `resetKeyboardType()` to clear the lock
        and re-enable auto-type detection.
         *
         * @since 0.1.0
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: false
         * @param [autoType=false] New value for property "autoType"
         * @returns Reference to "this" in order to allow method chaining
         */
        setAutoType(autoType: boolean): this;

        // property: autoCompact

        /**
         * Gets current value of property "autoCompact".
         *
         * When `true`, a layout that declares a compact counterpart yields to it on a
        keyboard too narrow to seat its rows, and takes it back when the room returns.
        
        Layout data is the one responsive dimension CSS cannot reach: a `@container`
        rule restyles a row but cannot re-seat its keys, and arrow-key navigation moves
        on the resolved layout rather than on rendered geometry. Of the built-ins only
        `ja-kana` declares one (`ja-kana-compact`); a custom layout declares its own
        with the `compact` property of a `customLayouts` entry.
        
        The swap fires `layoutChange` with `autoDetected: true` and never overrides an
        explicit choice: the layout you set stays the one it resolves against, so a
        `setLayout` or a `{layout:*}` key still wins and is re-tiered from there.
        
        The width is taken from the keyboard's own box, so an embedded keyboard tiers
        on the room it was granted rather than on the viewport. Override the threshold
        with the `--ui5KioskKeyboard-autoCompactThreshold` custom property.
         *
         * @since 0.1.0
         * Default value is: false
         * @returns Value of property "autoCompact"
         */
        getAutoCompact(): boolean;

        /**
         * Sets a new value for property "autoCompact".
         *
         * When `true`, a layout that declares a compact counterpart yields to it on a
        keyboard too narrow to seat its rows, and takes it back when the room returns.
        
        Layout data is the one responsive dimension CSS cannot reach: a `@container`
        rule restyles a row but cannot re-seat its keys, and arrow-key navigation moves
        on the resolved layout rather than on rendered geometry. Of the built-ins only
        `ja-kana` declares one (`ja-kana-compact`); a custom layout declares its own
        with the `compact` property of a `customLayouts` entry.
        
        The swap fires `layoutChange` with `autoDetected: true` and never overrides an
        explicit choice: the layout you set stays the one it resolves against, so a
        `setLayout` or a `{layout:*}` key still wins and is re-tiered from there.
        
        The width is taken from the keyboard's own box, so an embedded keyboard tiers
        on the room it was granted rather than on the viewport. Override the threshold
        with the `--ui5KioskKeyboard-autoCompactThreshold` custom property.
         *
         * @since 0.1.0
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: false
         * @param [autoCompact=false] New value for property "autoCompact"
         * @returns Reference to "this" in order to allow method chaining
         */
        setAutoCompact(autoCompact: boolean): this;

        // property: accentVariants

        /**
         * Gets current value of property "accentVariants".
         *
         * When `true`, a built-in Latin-diacritics table is merged onto the
        resolved layout so every matching base letter (a, e, i, o, u, c, n,
        s, y, z, l, ...) gains a long-press / right-click accent-variant
        popup, making German umlauts (ä/ö/ü) and the sharp S (ß/ẞ) reachable
        from any Latin layout without editing layout data. `ja-romaji` is
        excluded with the other non-Latin built-ins; a `variants` table on a
        `customLayouts` entry arms it anyway.
        
        A per-key `variants` declaration always wins over the default table.
        When Shift or Caps Lock is active, the popup surfaces the uppercase
        forms (including ẞ for ß). Default `false` (off).
         *
         * @since 0.1.0
         * Default value is: false
         * @returns Value of property "accentVariants"
         */
        getAccentVariants(): boolean;

        /**
         * Sets a new value for property "accentVariants".
         *
         * When `true`, a built-in Latin-diacritics table is merged onto the
        resolved layout so every matching base letter (a, e, i, o, u, c, n,
        s, y, z, l, ...) gains a long-press / right-click accent-variant
        popup, making German umlauts (ä/ö/ü) and the sharp S (ß/ẞ) reachable
        from any Latin layout without editing layout data. `ja-romaji` is
        excluded with the other non-Latin built-ins; a `variants` table on a
        `customLayouts` entry arms it anyway.
        
        A per-key `variants` declaration always wins over the default table.
        When Shift or Caps Lock is active, the popup surfaces the uppercase
        forms (including ẞ for ß). Default `false` (off).
         *
         * @since 0.1.0
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: false
         * @param [accentVariants=false] New value for property "accentVariants"
         * @returns Reference to "this" in order to allow method chaining
         */
        setAccentVariants(accentVariants: boolean): this;

        // property: mobileKeyboard

        /**
         * Gets current value of property "mobileKeyboard".
         *
         * Controls whether the KioskKeyboard or the native on-screen
        keyboard is used.
        
        - `"Auto"` (default) - uses KioskKeyboard on desktop browsers,
          defers to the native keyboard on phones and tablets. On a
          regular laptop/desktop with a physical keyboard the virtual
          keyboard **will** still appear - use `"Native"` if that
          is not desired.
        - `"Custom"` - always uses the KioskKeyboard and suppresses
          the native keyboard via `inputmode="none"`. Best for
          **dedicated kiosk terminals** without a physical keyboard.
        - `"Native"` - always defers to the native keyboard; the
          KioskKeyboard will not open on focus.
         *
         * @since 0.1.0
         * Default value is: "Auto"
         * @returns Value of property "mobileKeyboard"
         */
        getMobileKeyboard(): MobileKeyboard;

        /**
         * Sets a new value for property "mobileKeyboard".
         *
         * Controls whether the KioskKeyboard or the native on-screen
        keyboard is used.
        
        - `"Auto"` (default) - uses KioskKeyboard on desktop browsers,
          defers to the native keyboard on phones and tablets. On a
          regular laptop/desktop with a physical keyboard the virtual
          keyboard **will** still appear - use `"Native"` if that
          is not desired.
        - `"Custom"` - always uses the KioskKeyboard and suppresses
          the native keyboard via `inputmode="none"`. Best for
          **dedicated kiosk terminals** without a physical keyboard.
        - `"Native"` - always defers to the native keyboard; the
          KioskKeyboard will not open on focus.
         *
         * @since 0.1.0
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: "Auto"
         * @param [mobileKeyboard="Auto"] New value for property "mobileKeyboard"
         * @returns Reference to "this" in order to allow method chaining
         */
        setMobileKeyboard(mobileKeyboard: MobileKeyboard): this;

        // property: fKeyMode

        /**
         * Gets current value of property "fKeyMode".
         *
         * Controls how virtual F-key taps are handled.
        
        - `"Virtual"` (default): fire `keyPress` only. The app decides what to do.
        - `"Native"`: dispatch a synthetic `keydown` for standard
          function/navigation keys (`F1`-`F12`, arrows, `Home`/`End`,
          `PageUp`/`PageDown`) to the current target element (or document
          fallback). If not canceled, built-in native actions run for
          selected keys (`F5`, `F11`).
        - `"None"`: fire `keyPress` only, skip native dispatch and
          built-in navigation actions entirely.
         *
         * @since 0.1.0
         * Default value is: "Virtual"
         * @returns Value of property "fKeyMode"
         */
        getFKeyMode(): FKeyMode;

        /**
         * Sets a new value for property "fKeyMode".
         *
         * Controls how virtual F-key taps are handled.
        
        - `"Virtual"` (default): fire `keyPress` only. The app decides what to do.
        - `"Native"`: dispatch a synthetic `keydown` for standard
          function/navigation keys (`F1`-`F12`, arrows, `Home`/`End`,
          `PageUp`/`PageDown`) to the current target element (or document
          fallback). If not canceled, built-in native actions run for
          selected keys (`F5`, `F11`).
        - `"None"`: fire `keyPress` only, skip native dispatch and
          built-in navigation actions entirely.
         *
         * @since 0.1.0
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: "Virtual"
         * @param [fKeyMode="Virtual"] New value for property "fKeyMode"
         * @returns Reference to "this" in order to allow method chaining
         */
        setFKeyMode(fKeyMode: FKeyMode): this;

        // property: controls

        /**
         * Gets current value of property "controls".
         *
         * List of input control IDs to target. When set, attaches focus
        delegation to each resolved control so the keyboard auto-targets
        whichever input last received focus.
        
        IDs are resolved against the parent View first (view-local IDs),
        then globally. This makes the property safe to use in XML views
        where control IDs are prefixed by the view ID.
        
        In XML the IDs are comma-separated, and whitespace around one is not
        part of it. An entry naming no control is skipped, and reported once
        the keyboard has rendered.
         *
         * @since 0.1.0
         * Default value is: []
         * @returns Value of property "controls"
         */
        getControls(): ControlID[];

        /**
         * Sets a new value for property "controls".
         *
         * List of input control IDs to target. When set, attaches focus
        delegation to each resolved control so the keyboard auto-targets
        whichever input last received focus.
        
        IDs are resolved against the parent View first (view-local IDs),
        then globally. This makes the property safe to use in XML views
        where control IDs are prefixed by the view ID.
        
        In XML the IDs are comma-separated, and whitespace around one is not
        part of it. An entry naming no control is skipped, and reported once
        the keyboard has rendered.
         *
         * @since 0.1.0
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: []
         * @param [controls=[]] New value for property "controls"
         * @returns Reference to "this" in order to allow method chaining
         */
        setControls(controls: ControlID[]): this;

        // property: defaultVariants

        /**
         * Gets current value of property "defaultVariants".
         *
         * Long-press variants applied under every layout, merged per base letter beneath
        anything a `customLayouts` entry declares for that layout, so a house accent set
        extends the built-in table rather than replacing it and a base letter mapped to
        `[]` drops that letter everywhere. Base letters must be lowercase. Effective only
        while `accentVariants` is set.
        
        This tier only ever adds; it has no suppression spelling. To take one layout out
        of variants entirely use `suppress="Variants"` on its `CustomLayout`, and to take
        the whole affordance out leave `accentVariants` off, which is the default.
        
        Read by object identity: assign a new object to change the table.
         *
         * @since 0.1.0
         *
         * @returns Value of property "defaultVariants"
         */
        getDefaultVariants(): VariantOverrideTable;

        /**
         * Sets a new value for property "defaultVariants".
         *
         * Long-press variants applied under every layout, merged per base letter beneath
        anything a `customLayouts` entry declares for that layout, so a house accent set
        extends the built-in table rather than replacing it and a base letter mapped to
        `[]` drops that letter everywhere. Base letters must be lowercase. Effective only
        while `accentVariants` is set.
        
        This tier only ever adds; it has no suppression spelling. To take one layout out
        of variants entirely use `suppress="Variants"` on its `CustomLayout`, and to take
        the whole affordance out leave `accentVariants` off, which is the default.
        
        Read by object identity: assign a new object to change the table.
         *
         * @since 0.1.0
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * @param defaultVariants New value for property "defaultVariants"
         * @returns Reference to "this" in order to allow method chaining
         */
        setDefaultVariants(defaultVariants: VariantOverrideTable): this;

        // aggregation: customLayouts

        /**
         * Gets content of aggregation "customLayouts".
         *
         * Per-instance layouts. Each custom layout declares a layout, or overlays the one its
        `name` already resolves to. Applied in aggregation order: for rows, locales,
        metadata and middleware the last declaration wins; long-press variants
        accumulate per base letter.
         *
         * @since 0.1.0
         */
        getCustomLayouts(): CustomLayout[];

        /**
         * Adds some customLayout to the aggregation "customLayouts".
         *
         * Per-instance layouts. Each custom layout declares a layout, or overlays the one its
        `name` already resolves to. Applied in aggregation order: for rows, locales,
        metadata and middleware the last declaration wins; long-press variants
        accumulate per base letter.
         *
         * @since 0.1.0
         * @param customLayout The customLayout to add; if empty, nothing is inserted
         * @returns Reference to "this" in order to allow method chaining
         */
        addCustomLayout(customLayouts: CustomLayout): this;

        /**
         * Inserts a customLayout into the aggregation "customLayouts".
         *
         * Per-instance layouts. Each custom layout declares a layout, or overlays the one its
        `name` already resolves to. Applied in aggregation order: for rows, locales,
        metadata and middleware the last declaration wins; long-press variants
        accumulate per base letter.
         *
         * @since 0.1.0
         * @param customLayout The customLayout to insert; if empty, nothing is inserted
         * @param index The "0"-based index the customLayout should be inserted at; for
         *              a negative value of "iIndex", the customLayout is inserted at position 0; for a value
         *              greater than the current size of the aggregation, the customLayout is inserted at
         *              the last position
         * @returns Reference to "this" in order to allow method chaining
         */
        insertCustomLayout(customLayouts: CustomLayout, index: number): this;

        /**
         * Removes a customLayout from the aggregation "customLayouts".
         *
         * Per-instance layouts. Each custom layout declares a layout, or overlays the one its
        `name` already resolves to. Applied in aggregation order: for rows, locales,
        metadata and middleware the last declaration wins; long-press variants
        accumulate per base letter.
         *
         * @since 0.1.0
         * @param customLayout The customLayout to remove or its index or id
         * @returns The removed customLayout or "null"
         */
        removeCustomLayout(customLayouts: number | string | CustomLayout): CustomLayout | null;

        /**
         * Removes all the controls from the aggregation "customLayouts".
         * Additionally, it unregisters them from the hosting UIArea.
         *
         * Per-instance layouts. Each custom layout declares a layout, or overlays the one its
        `name` already resolves to. Applied in aggregation order: for rows, locales,
        metadata and middleware the last declaration wins; long-press variants
        accumulate per base letter.
         *
         * @since 0.1.0
         * @returns  An array of the removed elements (might be empty)
         */
        removeAllCustomLayouts(): CustomLayout[];

        /**
         * Checks for the provided "ui5.kiosk.CustomLayout" in the aggregation "customLayouts".
         * and returns its index if found or -1 otherwise.
         *
         * Per-instance layouts. Each custom layout declares a layout, or overlays the one its
        `name` already resolves to. Applied in aggregation order: for rows, locales,
        metadata and middleware the last declaration wins; long-press variants
        accumulate per base letter.
         *
         * @since 0.1.0
         * @param customLayout The customLayout whose index is looked for
         * @returns The index of the provided control in the aggregation if found, or -1 otherwise
         */
        indexOfCustomLayout(customLayouts: CustomLayout): number;

        /**
         * Destroys all the customLayouts in the aggregation "customLayouts".
         *
         * Per-instance layouts. Each custom layout declares a layout, or overlays the one its
        `name` already resolves to. Applied in aggregation order: for rows, locales,
        metadata and middleware the last declaration wins; long-press variants
        accumulate per base letter.
         *
         * @since 0.1.0
         * @returns Reference to "this" in order to allow method chaining
         */
        destroyCustomLayouts(): this;

        /**
         * Binds aggregation "customLayouts" to model data.
         *
         * Per-instance layouts. Each custom layout declares a layout, or overlays the one its
        `name` already resolves to. Applied in aggregation order: for rows, locales,
        metadata and middleware the last declaration wins; long-press variants
        accumulate per base letter.
         *
         * @since 0.1.0
         * See {@link sap.ui.base.ManagedObject#bindAggregation ManagedObject.bindAggregation} for a
         * detailed description of the possible properties of "oBindingInfo".
         * @param oBindingInfo The binding information
         * @returns Reference to "this" in order to allow method chaining
         */
        bindCustomLayouts(bindingInfo: AggregationBindingInfo): this;

        /**
         * Unbinds aggregation "customLayouts" from model data.
         *
         * Per-instance layouts. Each custom layout declares a layout, or overlays the one its
        `name` already resolves to. Applied in aggregation order: for rows, locales,
        metadata and middleware the last declaration wins; long-press variants
        accumulate per base letter.
         *
         * @since 0.1.0
         * @returns Reference to "this" in order to allow method chaining
         */
        unbindCustomLayouts(): this;

        // association: _activeTarget

        /**
         * ID of the element which is the current target of the association "_activeTarget", or "null".
         */
        get_activeTarget(): string;

        /**
         * Sets the associated _activeTarget.
         *
         * @param _activeTarget ID of an element which becomes the new target of this "_activeTarget" association; alternatively, an element instance may be given
         * @returns Reference to "this" in order to allow method chaining
         */
        set_activeTarget(_activeTarget?: string | Control): this;

        // association: ariaLabelledBy

        /**
         * Returns array of IDs of the elements which are the current targets of the association "ariaLabelledBy".
         */
        getAriaLabelledBy(): string[];

        /**
         * Adds some ariaLabelledBy into the association "ariaLabelledBy".
         *
         * @param ariaLabelledBy The ariaLabelledBy to add; if empty, nothing is inserted
         * @returns Reference to "this" in order to allow method chaining
         */
        addAriaLabelledBy(ariaLabelledBy: string | Control): this;

        /**
         * Removes an ariaLabelledBy from the association named ariaLabelledBy.
         *
         * @param ariaLabelledBy The ariaLabelledBy to be removed or its index or ID
         * @returns The removed ariaLabelledBy or "null"
         */
        removeAriaLabelledBy(ariaLabelledBy: number | string | Control): string;

        /**
         * Removes all the controls in the association named ariaLabelledBy.
         *
         * @returns An array of the removed elements (might be empty)
         */
        removeAllAriaLabelledBy(): string[];

        // association: ariaDescribedBy

        /**
         * Returns array of IDs of the elements which are the current targets of the association "ariaDescribedBy".
         */
        getAriaDescribedBy(): string[];

        /**
         * Adds some ariaDescribedBy into the association "ariaDescribedBy".
         *
         * @param ariaDescribedBy The ariaDescribedBy to add; if empty, nothing is inserted
         * @returns Reference to "this" in order to allow method chaining
         */
        addAriaDescribedBy(ariaDescribedBy: string | Control): this;

        /**
         * Removes an ariaDescribedBy from the association named ariaDescribedBy.
         *
         * @param ariaDescribedBy The ariaDescribedBy to be removed or its index or ID
         * @returns The removed ariaDescribedBy or "null"
         */
        removeAriaDescribedBy(ariaDescribedBy: number | string | Control): string;

        /**
         * Removes all the controls in the association named ariaDescribedBy.
         *
         * @returns An array of the removed elements (might be empty)
         */
        removeAllAriaDescribedBy(): string[];

        // event: keyPress

        /**
         * Attaches event handler "fn" to the "keyPress" event of this "KioskKeyboard".
         *
         * Fired when a virtual key is pressed. Call `preventDefault()` to
        skip the default input action (text insertion, backspace, etc.).
         *
         * @since 0.1.0
         * When called, the context of the event handler (its "this") will be bound to "oListener" if specified,
         * otherwise it will be bound to this "KioskKeyboard" itself.
         *
         * @param fn The function to be called when the event occurs
         * @param listener Context object to call the event handler with. Defaults to this "KioskKeyboard" itself
         *
         * @returns Reference to "this" in order to allow method chaining
         */
        attachKeyPress(fn: (event: KioskKeyboard$KeyPressEvent) => void, listener?: object): this;

        /**
         * Attaches event handler "fn" to the "keyPress" event of this "KioskKeyboard".
         *
         * Fired when a virtual key is pressed. Call `preventDefault()` to
        skip the default input action (text insertion, backspace, etc.).
         *
         * @since 0.1.0
         * When called, the context of the event handler (its "this") will be bound to "oListener" if specified,
         * otherwise it will be bound to this "KioskKeyboard" itself.
         *
         * @param data An application-specific payload object that will be passed to the event handler along with the event object when firing the event
         * @param fn The function to be called when the event occurs
         * @param listener Context object to call the event handler with. Defaults to this "KioskKeyboard" itself
         *
         * @returns Reference to "this" in order to allow method chaining
         */
        attachKeyPress<CustomDataType extends object>(data: CustomDataType, fn: (event: KioskKeyboard$KeyPressEvent, data: CustomDataType) => void, listener?: object): this;

        /**
         * Detaches event handler "fn" from the "keyPress" event of this "KioskKeyboard".
         *
         * Fired when a virtual key is pressed. Call `preventDefault()` to
        skip the default input action (text insertion, backspace, etc.).
         *
         * @since 0.1.0
         * The passed function and listener object must match the ones used for event registration.
         *
         * @param fn The function to be called, when the event occurs
         * @param listener Context object on which the given function had to be called
         * @returns Reference to "this" in order to allow method chaining
         * @since 0.1.0
         */
        detachKeyPress(fn: (event: KioskKeyboard$KeyPressEvent) => void, listener?: object): this;

        /**
         * Fires event "keyPress" to attached listeners.
         *
         * Fired when a virtual key is pressed. Call `preventDefault()` to
        skip the default input action (text insertion, backspace, etc.).
         *
         * @since 0.1.0
         *
         * Listeners may prevent the default action of this event by calling the "preventDefault" method on the event object.
         * The return value of this method indicates whether the default action should be executed.
         *
         * @param parameters Parameters to pass along with the event
         * @param [mParameters.key] Fired when a virtual key is pressed. Call `preventDefault()` to
        skip the default input action (text insertion, backspace, etc.).
         * @param [mParameters.shiftKey] Fired when a virtual key is pressed. Call `preventDefault()` to
        skip the default input action (text insertion, backspace, etc.).
         *
         * @returns Whether or not to prevent the default action
         */
        fireKeyPress(parameters?: KioskKeyboard$KeyPressEventParameters): boolean;

        // event: layoutChange

        /**
         * Attaches event handler "fn" to the "layoutChange" event of this "KioskKeyboard".
         *
         * Fired when the active layout changes (via a `{layout:name}` key
        or programmatic `setLayout()` call).
         *
         * @since 0.1.0
         * When called, the context of the event handler (its "this") will be bound to "oListener" if specified,
         * otherwise it will be bound to this "KioskKeyboard" itself.
         *
         * @param fn The function to be called when the event occurs
         * @param listener Context object to call the event handler with. Defaults to this "KioskKeyboard" itself
         *
         * @returns Reference to "this" in order to allow method chaining
         */
        attachLayoutChange(fn: (event: KioskKeyboard$LayoutChangeEvent) => void, listener?: object): this;

        /**
         * Attaches event handler "fn" to the "layoutChange" event of this "KioskKeyboard".
         *
         * Fired when the active layout changes (via a `{layout:name}` key
        or programmatic `setLayout()` call).
         *
         * @since 0.1.0
         * When called, the context of the event handler (its "this") will be bound to "oListener" if specified,
         * otherwise it will be bound to this "KioskKeyboard" itself.
         *
         * @param data An application-specific payload object that will be passed to the event handler along with the event object when firing the event
         * @param fn The function to be called when the event occurs
         * @param listener Context object to call the event handler with. Defaults to this "KioskKeyboard" itself
         *
         * @returns Reference to "this" in order to allow method chaining
         */
        attachLayoutChange<CustomDataType extends object>(data: CustomDataType, fn: (event: KioskKeyboard$LayoutChangeEvent, data: CustomDataType) => void, listener?: object): this;

        /**
         * Detaches event handler "fn" from the "layoutChange" event of this "KioskKeyboard".
         *
         * Fired when the active layout changes (via a `{layout:name}` key
        or programmatic `setLayout()` call).
         *
         * @since 0.1.0
         * The passed function and listener object must match the ones used for event registration.
         *
         * @param fn The function to be called, when the event occurs
         * @param listener Context object on which the given function had to be called
         * @returns Reference to "this" in order to allow method chaining
         * @since 0.1.0
         */
        detachLayoutChange(fn: (event: KioskKeyboard$LayoutChangeEvent) => void, listener?: object): this;

        /**
         * Fires event "layoutChange" to attached listeners.
         *
         * Fired when the active layout changes (via a `{layout:name}` key
        or programmatic `setLayout()` call).
         *
         * @since 0.1.0
         *
         * @param parameters Parameters to pass along with the event
         * @param [mParameters.layout] Fired when the active layout changes (via a `{layout:name}` key
        or programmatic `setLayout()` call).
         * @param [mParameters.autoDetected] Fired when the active layout changes (via a `{layout:name}` key
        or programmatic `setLayout()` call).
         *
         * @returns Reference to "this" in order to allow method chaining
         */
        fireLayoutChange(parameters?: KioskKeyboard$LayoutChangeEventParameters): this;

        // event: keyboardTypeChange

        /**
         * Attaches event handler "fn" to the "keyboardTypeChange" event of this "KioskKeyboard".
         *
         * Fired when the keyboard type changes - by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         *
         * @since 0.1.0
         * When called, the context of the event handler (its "this") will be bound to "oListener" if specified,
         * otherwise it will be bound to this "KioskKeyboard" itself.
         *
         * @param fn The function to be called when the event occurs
         * @param listener Context object to call the event handler with. Defaults to this "KioskKeyboard" itself
         *
         * @returns Reference to "this" in order to allow method chaining
         */
        attachKeyboardTypeChange(fn: (event: KioskKeyboard$KeyboardTypeChangeEvent) => void, listener?: object): this;

        /**
         * Attaches event handler "fn" to the "keyboardTypeChange" event of this "KioskKeyboard".
         *
         * Fired when the keyboard type changes - by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         *
         * @since 0.1.0
         * When called, the context of the event handler (its "this") will be bound to "oListener" if specified,
         * otherwise it will be bound to this "KioskKeyboard" itself.
         *
         * @param data An application-specific payload object that will be passed to the event handler along with the event object when firing the event
         * @param fn The function to be called when the event occurs
         * @param listener Context object to call the event handler with. Defaults to this "KioskKeyboard" itself
         *
         * @returns Reference to "this" in order to allow method chaining
         */
        attachKeyboardTypeChange<CustomDataType extends object>(data: CustomDataType, fn: (event: KioskKeyboard$KeyboardTypeChangeEvent, data: CustomDataType) => void, listener?: object): this;

        /**
         * Detaches event handler "fn" from the "keyboardTypeChange" event of this "KioskKeyboard".
         *
         * Fired when the keyboard type changes - by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         *
         * @since 0.1.0
         * The passed function and listener object must match the ones used for event registration.
         *
         * @param fn The function to be called, when the event occurs
         * @param listener Context object on which the given function had to be called
         * @returns Reference to "this" in order to allow method chaining
         * @since 0.1.0
         */
        detachKeyboardTypeChange(fn: (event: KioskKeyboard$KeyboardTypeChangeEvent) => void, listener?: object): this;

        /**
         * Fires event "keyboardTypeChange" to attached listeners.
         *
         * Fired when the keyboard type changes - by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         *
         * @since 0.1.0
         *
         * @param parameters Parameters to pass along with the event
         * @param [mParameters.keyboardType] Fired when the keyboard type changes - by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         * @param [mParameters.previousKeyboardType] Fired when the keyboard type changes - by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         * @param [mParameters.autoDetected] Fired when the keyboard type changes - by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         *
         * @returns Reference to "this" in order to allow method chaining
         */
        fireKeyboardTypeChange(parameters?: KioskKeyboard$KeyboardTypeChangeEventParameters): this;

        // event: activeControlChange

        /**
         * Attaches event handler "fn" to the "activeControlChange" event of this "KioskKeyboard".
         *
         * Fired when the active target control changes (focus switches to a
        different input in auto-show mode, or programmatically).
         *
         * @since 0.1.0
         * When called, the context of the event handler (its "this") will be bound to "oListener" if specified,
         * otherwise it will be bound to this "KioskKeyboard" itself.
         *
         * @param fn The function to be called when the event occurs
         * @param listener Context object to call the event handler with. Defaults to this "KioskKeyboard" itself
         *
         * @returns Reference to "this" in order to allow method chaining
         */
        attachActiveControlChange(fn: (event: KioskKeyboard$ActiveControlChangeEvent) => void, listener?: object): this;

        /**
         * Attaches event handler "fn" to the "activeControlChange" event of this "KioskKeyboard".
         *
         * Fired when the active target control changes (focus switches to a
        different input in auto-show mode, or programmatically).
         *
         * @since 0.1.0
         * When called, the context of the event handler (its "this") will be bound to "oListener" if specified,
         * otherwise it will be bound to this "KioskKeyboard" itself.
         *
         * @param data An application-specific payload object that will be passed to the event handler along with the event object when firing the event
         * @param fn The function to be called when the event occurs
         * @param listener Context object to call the event handler with. Defaults to this "KioskKeyboard" itself
         *
         * @returns Reference to "this" in order to allow method chaining
         */
        attachActiveControlChange<CustomDataType extends object>(data: CustomDataType, fn: (event: KioskKeyboard$ActiveControlChangeEvent, data: CustomDataType) => void, listener?: object): this;

        /**
         * Detaches event handler "fn" from the "activeControlChange" event of this "KioskKeyboard".
         *
         * Fired when the active target control changes (focus switches to a
        different input in auto-show mode, or programmatically).
         *
         * @since 0.1.0
         * The passed function and listener object must match the ones used for event registration.
         *
         * @param fn The function to be called, when the event occurs
         * @param listener Context object on which the given function had to be called
         * @returns Reference to "this" in order to allow method chaining
         * @since 0.1.0
         */
        detachActiveControlChange(fn: (event: KioskKeyboard$ActiveControlChangeEvent) => void, listener?: object): this;

        /**
         * Fires event "activeControlChange" to attached listeners.
         *
         * Fired when the active target control changes (focus switches to a
        different input in auto-show mode, or programmatically).
         *
         * @since 0.1.0
         *
         * @param parameters Parameters to pass along with the event
         * @param [mParameters.controlId] Fired when the active target control changes (focus switches to a
        different input in auto-show mode, or programmatically).
         *
         * @returns Reference to "this" in order to allow method chaining
         */
        fireActiveControlChange(parameters?: KioskKeyboard$ActiveControlChangeEventParameters): this;

        // event: afterOpen

        /**
         * Attaches event handler "fn" to the "afterOpen" event of this "KioskKeyboard".
         *
         * Fired when `show()` opens the docked keyboard (not tied to CSS transition end).
         *
         * @since 0.1.0
         * When called, the context of the event handler (its "this") will be bound to "oListener" if specified,
         * otherwise it will be bound to this "KioskKeyboard" itself.
         *
         * @param fn The function to be called when the event occurs
         * @param listener Context object to call the event handler with. Defaults to this "KioskKeyboard" itself
         *
         * @returns Reference to "this" in order to allow method chaining
         */
        attachAfterOpen(fn: (event: KioskKeyboard$AfterOpenEvent) => void, listener?: object): this;

        /**
         * Attaches event handler "fn" to the "afterOpen" event of this "KioskKeyboard".
         *
         * Fired when `show()` opens the docked keyboard (not tied to CSS transition end).
         *
         * @since 0.1.0
         * When called, the context of the event handler (its "this") will be bound to "oListener" if specified,
         * otherwise it will be bound to this "KioskKeyboard" itself.
         *
         * @param data An application-specific payload object that will be passed to the event handler along with the event object when firing the event
         * @param fn The function to be called when the event occurs
         * @param listener Context object to call the event handler with. Defaults to this "KioskKeyboard" itself
         *
         * @returns Reference to "this" in order to allow method chaining
         */
        attachAfterOpen<CustomDataType extends object>(data: CustomDataType, fn: (event: KioskKeyboard$AfterOpenEvent, data: CustomDataType) => void, listener?: object): this;

        /**
         * Detaches event handler "fn" from the "afterOpen" event of this "KioskKeyboard".
         *
         * Fired when `show()` opens the docked keyboard (not tied to CSS transition end).
         *
         * @since 0.1.0
         * The passed function and listener object must match the ones used for event registration.
         *
         * @param fn The function to be called, when the event occurs
         * @param listener Context object on which the given function had to be called
         * @returns Reference to "this" in order to allow method chaining
         * @since 0.1.0
         */
        detachAfterOpen(fn: (event: KioskKeyboard$AfterOpenEvent) => void, listener?: object): this;

        /**
         * Fires event "afterOpen" to attached listeners.
         *
         * Fired when `show()` opens the docked keyboard (not tied to CSS transition end).
         *
         * @since 0.1.0
         *
         * @param parameters Parameters to pass along with the event
         * @returns Reference to "this" in order to allow method chaining
         */
        fireAfterOpen(parameters?: KioskKeyboard$AfterOpenEventParameters): this;

        // event: afterClose

        /**
         * Attaches event handler "fn" to the "afterClose" event of this "KioskKeyboard".
         *
         * Fired when `close()` closes the docked keyboard (not tied to CSS transition end).
         *
         * @since 0.1.0
         * When called, the context of the event handler (its "this") will be bound to "oListener" if specified,
         * otherwise it will be bound to this "KioskKeyboard" itself.
         *
         * @param fn The function to be called when the event occurs
         * @param listener Context object to call the event handler with. Defaults to this "KioskKeyboard" itself
         *
         * @returns Reference to "this" in order to allow method chaining
         */
        attachAfterClose(fn: (event: KioskKeyboard$AfterCloseEvent) => void, listener?: object): this;

        /**
         * Attaches event handler "fn" to the "afterClose" event of this "KioskKeyboard".
         *
         * Fired when `close()` closes the docked keyboard (not tied to CSS transition end).
         *
         * @since 0.1.0
         * When called, the context of the event handler (its "this") will be bound to "oListener" if specified,
         * otherwise it will be bound to this "KioskKeyboard" itself.
         *
         * @param data An application-specific payload object that will be passed to the event handler along with the event object when firing the event
         * @param fn The function to be called when the event occurs
         * @param listener Context object to call the event handler with. Defaults to this "KioskKeyboard" itself
         *
         * @returns Reference to "this" in order to allow method chaining
         */
        attachAfterClose<CustomDataType extends object>(data: CustomDataType, fn: (event: KioskKeyboard$AfterCloseEvent, data: CustomDataType) => void, listener?: object): this;

        /**
         * Detaches event handler "fn" from the "afterClose" event of this "KioskKeyboard".
         *
         * Fired when `close()` closes the docked keyboard (not tied to CSS transition end).
         *
         * @since 0.1.0
         * The passed function and listener object must match the ones used for event registration.
         *
         * @param fn The function to be called, when the event occurs
         * @param listener Context object on which the given function had to be called
         * @returns Reference to "this" in order to allow method chaining
         * @since 0.1.0
         */
        detachAfterClose(fn: (event: KioskKeyboard$AfterCloseEvent) => void, listener?: object): this;

        /**
         * Fires event "afterClose" to attached listeners.
         *
         * Fired when `close()` closes the docked keyboard (not tied to CSS transition end).
         *
         * @since 0.1.0
         *
         * @param parameters Parameters to pass along with the event
         * @returns Reference to "this" in order to allow method chaining
         */
        fireAfterClose(parameters?: KioskKeyboard$AfterCloseEventParameters): this;
    }

    /**
     * Interface describing the parameters of KioskKeyboard's 'keyPress' event.
     * Fired when a virtual key is pressed. Call `preventDefault()` to
    skip the default input action (text insertion, backspace, etc.).
     *
     * @since 0.1.0
     */
    export interface KioskKeyboard$KeyPressEventParameters {
        key?: string;
        shiftKey?: boolean;
    }

    /**
     * Interface describing the parameters of KioskKeyboard's 'layoutChange' event.
     * Fired when the active layout changes (via a `{layout:name}` key
    or programmatic `setLayout()` call).
     *
     * @since 0.1.0
     */
    export interface KioskKeyboard$LayoutChangeEventParameters {
        layout?: string;
        autoDetected?: boolean;
    }

    /**
     * Interface describing the parameters of KioskKeyboard's 'keyboardTypeChange' event.
     * Fired when the keyboard type changes - by auto-type detection,
    explicit `setKeyboardType()`, or `resetKeyboardType()`.
     *
     * @since 0.1.0
     */
    export interface KioskKeyboard$KeyboardTypeChangeEventParameters {
        keyboardType?: KeyboardType;
        previousKeyboardType?: KeyboardType;
        autoDetected?: boolean;
    }

    /**
     * Interface describing the parameters of KioskKeyboard's 'activeControlChange' event.
     * Fired when the active target control changes (focus switches to a
    different input in auto-show mode, or programmatically).
     *
     * @since 0.1.0
     */
    export interface KioskKeyboard$ActiveControlChangeEventParameters {
        controlId?: string;
    }

    /**
     * Interface describing the parameters of KioskKeyboard's 'afterOpen' event.
     * Fired when `show()` opens the docked keyboard (not tied to CSS transition end).
     *
     * @since 0.1.0
     */
    // eslint-disable-next-line
    export interface KioskKeyboard$AfterOpenEventParameters {
    }

    /**
     * Interface describing the parameters of KioskKeyboard's 'afterClose' event.
     * Fired when `close()` closes the docked keyboard (not tied to CSS transition end).
     *
     * @since 0.1.0
     */
    // eslint-disable-next-line
    export interface KioskKeyboard$AfterCloseEventParameters {
    }

    /**
     * Type describing the KioskKeyboard's 'keyPress' event.
     * Fired when a virtual key is pressed. Call `preventDefault()` to
    skip the default input action (text insertion, backspace, etc.).
     *
     * @since 0.1.0
     */
    export type KioskKeyboard$KeyPressEvent = Event<KioskKeyboard$KeyPressEventParameters>;

    /**
     * Type describing the KioskKeyboard's 'layoutChange' event.
     * Fired when the active layout changes (via a `{layout:name}` key
    or programmatic `setLayout()` call).
     *
     * @since 0.1.0
     */
    export type KioskKeyboard$LayoutChangeEvent = Event<KioskKeyboard$LayoutChangeEventParameters>;

    /**
     * Type describing the KioskKeyboard's 'keyboardTypeChange' event.
     * Fired when the keyboard type changes - by auto-type detection,
    explicit `setKeyboardType()`, or `resetKeyboardType()`.
     *
     * @since 0.1.0
     */
    export type KioskKeyboard$KeyboardTypeChangeEvent = Event<KioskKeyboard$KeyboardTypeChangeEventParameters>;

    /**
     * Type describing the KioskKeyboard's 'activeControlChange' event.
     * Fired when the active target control changes (focus switches to a
    different input in auto-show mode, or programmatically).
     *
     * @since 0.1.0
     */
    export type KioskKeyboard$ActiveControlChangeEvent = Event<KioskKeyboard$ActiveControlChangeEventParameters>;

    /**
     * Type describing the KioskKeyboard's 'afterOpen' event.
     * Fired when `show()` opens the docked keyboard (not tied to CSS transition end).
     *
     * @since 0.1.0
     */
    export type KioskKeyboard$AfterOpenEvent = Event<KioskKeyboard$AfterOpenEventParameters>;

    /**
     * Type describing the KioskKeyboard's 'afterClose' event.
     * Fired when `close()` closes the docked keyboard (not tied to CSS transition end).
     *
     * @since 0.1.0
     */
    export type KioskKeyboard$AfterCloseEvent = Event<KioskKeyboard$AfterCloseEventParameters>;
}
