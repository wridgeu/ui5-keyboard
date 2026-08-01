import { KeyboardType } from "ui5/kiosk/library";
import Event from "sap/ui/base/Event";
import { MobileKeyboard } from "ui5/kiosk/library";
import { FKeyMode } from "ui5/kiosk/library";
import { InstanceLayoutMap } from "ui5/kiosk/library";
import { InstanceLocaleLayoutMap } from "ui5/kiosk/library";
import { InstanceMiddlewareMap } from "ui5/kiosk/library";
import { InstanceVariantMap } from "ui5/kiosk/library";
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
         * When `true`, a built-in Latin-diacritics table is merged onto the
        resolved layout so every matching base letter (a, e, i, o, u, c, n,
        s, y, z, l, ...) gains a long-press / right-click accent-variant
        popup, making German umlauts (ä/ö/ü) and the sharp S (ß/ẞ) reachable
        from any Latin layout without editing layout data. `ja-romaji` is
        excluded with the other non-Latin built-ins; an `instanceVariants`
        entry arms it anyway.
        
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
         *
         * @since 0.1.0
         */
        controls?: string[] | PropertyBindingInfo | `{${string}}`;

        /**
         * Per-instance layout overrides. Resolution order is
        **instance map -> built-in**, so an entry here shadows the
        built-in of the same name for this control only. Use this to
        supply a custom layout, or to override a built-in (e.g. swap
        the German layout) without affecting other controls. Accepts
        a plain `Record<string, LayoutInput>`: each entry is either the
        layout's rows, or a `LayoutSpec` (`{ rows, lang, secondary }`)
        declaring the layout's attributes alongside them. The control
        stores the rows and the attributes as `Map`s internally.
        
        Read by object identity: assign a new object to change the layouts.
        Mutating the object already assigned is not observed until the next
        render triggered by something else.
         *
         * @since 0.1.0
         */
        instanceLayouts?: InstanceLayoutMap | PropertyBindingInfo | `{${string}}`;

        /**
         * Per-instance locale-to-layout overrides. Resolution order is
        **instance map -> built-in locale map -> default layout**.
        Keys are BCP-47 prefixes (e.g. `"de"`, `"de-at"`); values are
        layout names. Accepts a plain `Record<string, string>`; the
        control stores it as a `Map` internally.
         *
         * @since 0.1.0
         */
        instanceLocaleLayouts?: InstanceLocaleLayoutMap | PropertyBindingInfo | `{${string}}`;

        /**
         * Per-instance composition middleware overrides, keyed by layout
        name. Resolution order is **instance map -> built-in**. Use
        this to attach a layout-specific middleware factory for a
        custom layout, or to swap the built-in middleware for one
        control only. Accepts a plain
        `Record<string, () => CompositionMiddleware>`; the control
        stores it as a `Map` internally.
         *
         * @since 0.1.0
         */
        instanceMiddleware?: InstanceMiddlewareMap | PropertyBindingInfo | `{${string}}`;

        /**
         * Per-instance accent-variant table overrides, keyed by layout name
        (or `"*"` for every layout). The entry for a layout wins, else the
        `"*"` wildcard; either is merged onto the built-in table per base
        letter, so it extends the defaults rather than replacing them. A base
        letter mapped to `[]` drops that letter, and a `null` entry opts the
        layout out entirely. Base letters must be lowercase. Effective only
        while `accentVariants` is set. Accepts a plain
        `Record<string, Record<string, string[]> | null>`; the control stores
        it as a `Map` internally.
        
        Read by object identity: assign a new object to change the tables.
        Mutating the object already assigned is not observed until the next
        render triggered by something else.
         *
         * @since 0.1.0
         */
        instanceVariants?: InstanceVariantMap | PropertyBindingInfo | `{${string}}`;
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

        // property: accentVariants

        /**
         * Gets current value of property "accentVariants".
         *
         * When `true`, a built-in Latin-diacritics table is merged onto the
        resolved layout so every matching base letter (a, e, i, o, u, c, n,
        s, y, z, l, ...) gains a long-press / right-click accent-variant
        popup, making German umlauts (ä/ö/ü) and the sharp S (ß/ẞ) reachable
        from any Latin layout without editing layout data. `ja-romaji` is
        excluded with the other non-Latin built-ins; an `instanceVariants`
        entry arms it anyway.
        
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
        excluded with the other non-Latin built-ins; an `instanceVariants`
        entry arms it anyway.
        
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
         *
         * @since 0.1.0
         * Default value is: []
         * @returns Value of property "controls"
         */
        getControls(): string[];

        /**
         * Sets a new value for property "controls".
         *
         * List of input control IDs to target. When set, attaches focus
        delegation to each resolved control so the keyboard auto-targets
        whichever input last received focus.
        
        IDs are resolved against the parent View first (view-local IDs),
        then globally. This makes the property safe to use in XML views
        where control IDs are prefixed by the view ID.
         *
         * @since 0.1.0
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: []
         * @param [controls=[]] New value for property "controls"
         * @returns Reference to "this" in order to allow method chaining
         */
        setControls(controls: string[]): this;

        // property: instanceLayouts

        /**
         * Gets current value of property "instanceLayouts".
         *
         * Per-instance layout overrides. Resolution order is
        **instance map -> built-in**, so an entry here shadows the
        built-in of the same name for this control only. Use this to
        supply a custom layout, or to override a built-in (e.g. swap
        the German layout) without affecting other controls. Accepts
        a plain `Record<string, LayoutInput>`: each entry is either the
        layout's rows, or a `LayoutSpec` (`{ rows, lang, secondary }`)
        declaring the layout's attributes alongside them. The control
        stores the rows and the attributes as `Map`s internally.
        
        Read by object identity: assign a new object to change the layouts.
        Mutating the object already assigned is not observed until the next
        render triggered by something else.
         *
         * @since 0.1.0
         *
         * @returns Value of property "instanceLayouts"
         */
        getInstanceLayouts(): InstanceLayoutMap;

        /**
         * Sets a new value for property "instanceLayouts".
         *
         * Per-instance layout overrides. Resolution order is
        **instance map -> built-in**, so an entry here shadows the
        built-in of the same name for this control only. Use this to
        supply a custom layout, or to override a built-in (e.g. swap
        the German layout) without affecting other controls. Accepts
        a plain `Record<string, LayoutInput>`: each entry is either the
        layout's rows, or a `LayoutSpec` (`{ rows, lang, secondary }`)
        declaring the layout's attributes alongside them. The control
        stores the rows and the attributes as `Map`s internally.
        
        Read by object identity: assign a new object to change the layouts.
        Mutating the object already assigned is not observed until the next
        render triggered by something else.
         *
         * @since 0.1.0
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * @param instanceLayouts New value for property "instanceLayouts"
         * @returns Reference to "this" in order to allow method chaining
         */
        setInstanceLayouts(instanceLayouts: InstanceLayoutMap): this;

        // property: instanceLocaleLayouts

        /**
         * Gets current value of property "instanceLocaleLayouts".
         *
         * Per-instance locale-to-layout overrides. Resolution order is
        **instance map -> built-in locale map -> default layout**.
        Keys are BCP-47 prefixes (e.g. `"de"`, `"de-at"`); values are
        layout names. Accepts a plain `Record<string, string>`; the
        control stores it as a `Map` internally.
         *
         * @since 0.1.0
         *
         * @returns Value of property "instanceLocaleLayouts"
         */
        getInstanceLocaleLayouts(): InstanceLocaleLayoutMap;

        /**
         * Sets a new value for property "instanceLocaleLayouts".
         *
         * Per-instance locale-to-layout overrides. Resolution order is
        **instance map -> built-in locale map -> default layout**.
        Keys are BCP-47 prefixes (e.g. `"de"`, `"de-at"`); values are
        layout names. Accepts a plain `Record<string, string>`; the
        control stores it as a `Map` internally.
         *
         * @since 0.1.0
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * @param instanceLocaleLayouts New value for property "instanceLocaleLayouts"
         * @returns Reference to "this" in order to allow method chaining
         */
        setInstanceLocaleLayouts(instanceLocaleLayouts: InstanceLocaleLayoutMap): this;

        // property: instanceMiddleware

        /**
         * Gets current value of property "instanceMiddleware".
         *
         * Per-instance composition middleware overrides, keyed by layout
        name. Resolution order is **instance map -> built-in**. Use
        this to attach a layout-specific middleware factory for a
        custom layout, or to swap the built-in middleware for one
        control only. Accepts a plain
        `Record<string, () => CompositionMiddleware>`; the control
        stores it as a `Map` internally.
         *
         * @since 0.1.0
         *
         * @returns Value of property "instanceMiddleware"
         */
        getInstanceMiddleware(): InstanceMiddlewareMap;

        /**
         * Sets a new value for property "instanceMiddleware".
         *
         * Per-instance composition middleware overrides, keyed by layout
        name. Resolution order is **instance map -> built-in**. Use
        this to attach a layout-specific middleware factory for a
        custom layout, or to swap the built-in middleware for one
        control only. Accepts a plain
        `Record<string, () => CompositionMiddleware>`; the control
        stores it as a `Map` internally.
         *
         * @since 0.1.0
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * @param instanceMiddleware New value for property "instanceMiddleware"
         * @returns Reference to "this" in order to allow method chaining
         */
        setInstanceMiddleware(instanceMiddleware: InstanceMiddlewareMap): this;

        // property: instanceVariants

        /**
         * Gets current value of property "instanceVariants".
         *
         * Per-instance accent-variant table overrides, keyed by layout name
        (or `"*"` for every layout). The entry for a layout wins, else the
        `"*"` wildcard; either is merged onto the built-in table per base
        letter, so it extends the defaults rather than replacing them. A base
        letter mapped to `[]` drops that letter, and a `null` entry opts the
        layout out entirely. Base letters must be lowercase. Effective only
        while `accentVariants` is set. Accepts a plain
        `Record<string, Record<string, string[]> | null>`; the control stores
        it as a `Map` internally.
        
        Read by object identity: assign a new object to change the tables.
        Mutating the object already assigned is not observed until the next
        render triggered by something else.
         *
         * @since 0.1.0
         *
         * @returns Value of property "instanceVariants"
         */
        getInstanceVariants(): InstanceVariantMap;

        /**
         * Sets a new value for property "instanceVariants".
         *
         * Per-instance accent-variant table overrides, keyed by layout name
        (or `"*"` for every layout). The entry for a layout wins, else the
        `"*"` wildcard; either is merged onto the built-in table per base
        letter, so it extends the defaults rather than replacing them. A base
        letter mapped to `[]` drops that letter, and a `null` entry opts the
        layout out entirely. Base letters must be lowercase. Effective only
        while `accentVariants` is set. Accepts a plain
        `Record<string, Record<string, string[]> | null>`; the control stores
        it as a `Map` internally.
        
        Read by object identity: assign a new object to change the tables.
        Mutating the object already assigned is not observed until the next
        render triggered by something else.
         *
         * @since 0.1.0
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * @param instanceVariants New value for property "instanceVariants"
         * @returns Reference to "this" in order to allow method chaining
         */
        setInstanceVariants(instanceVariants: InstanceVariantMap): this;

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
