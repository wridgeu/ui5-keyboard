import { KeyboardType } from "ui5/kiosk/library";
import Event from "sap/ui/base/Event";
import { MobileKeyboard } from "ui5/kiosk/library";
import { FKeyMode } from "ui5/kiosk/library";
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
         */
        layout?: string | PropertyBindingInfo;

        /**
         * Keyboard display type.
        `"Full"` renders the active layout. `"Numeric"` and `"Numpad"` render
        compact number-oriented layouts regardless of the layout property.
        
        Setting this property (via setter, constructor, or XML attribute)
        disables auto-type detection permanently.
        Call `resetKeyboardType()` to re-enable it.
         */
        keyboardType?: KeyboardType | PropertyBindingInfo | `{${string}}`;

        /**
         * Whether the keyboard is interactive. When `false`, all keys are
        visually dimmed and pointer events are disabled.
         */
        enabled?: boolean | PropertyBindingInfo | `{${string}}`;

        /**
         * Accessible label for the keyboard group. Defaults to
        "Virtual Keyboard" from the resource bundle when left empty.
         */
        ariaLabel?: string | PropertyBindingInfo;

        /**
         * When `true`, the keyboard anchors to the bottom of the viewport
        and slides in/out. Use `show()` / `close()` to control
        visibility manually, or set `autoShow` to `true` for automatic
        focus-based behavior.
         */
        docked?: boolean | PropertyBindingInfo | `{${string}}`;

        /**
         * When `true`, the docked keyboard automatically opens when any
        `<input>` or `<textarea>` receives focus, and closes when
        focus leaves. Requires `docked="true"`.
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
         */
        autoType?: boolean | PropertyBindingInfo | `{${string}}`;

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
         */
        fKeyMode?: FKeyMode | PropertyBindingInfo | `{${string}}`;

        /**
         * List of input control IDs to target. When set, attaches focus
        delegation to each resolved control so the keyboard auto-targets
        whichever input last received focus.
        
        IDs are resolved against the parent View first (view-local IDs),
        then globally. This makes the property safe to use in XML views
        where control IDs are prefixed by the view ID.
         */
        controls?: string[] | PropertyBindingInfo | `{${string}}`;

        /**
         * Per-instance layout overrides. Resolution order is
        **instance map -> built-in**, so an entry here shadows the
        built-in of the same name for this control only. Use this to
        supply a custom layout, or to override a built-in (e.g. swap
        the German layout) without affecting other controls. Accepts
        a plain `Record<string, LayoutDefinition>`; the control stores
        it as a `Map` internally.
         *
         * @since 0.1.0
         */
        instanceLayouts?: (object | null) | PropertyBindingInfo | `{${string}}`;

        /**
         * Per-instance locale-to-layout overrides. Resolution order is
        **instance map -> built-in locale map -> default layout**.
        Keys are BCP-47 prefixes (e.g. `"de"`, `"de-at"`); values are
        layout names. Accepts a plain `Record<string, string>`; the
        control stores it as a `Map` internally.
         *
         * @since 0.1.0
         */
        instanceLocaleLayouts?: (object | null) | PropertyBindingInfo | `{${string}}`;

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
        instanceMiddleware?: (object | null) | PropertyBindingInfo | `{${string}}`;
        _activeTarget?: Control | string;
        ariaLabelledBy?: Control | string | (Control | string)[];
        ariaDescribedBy?: Control | string | (Control | string)[];

        /**
         * Fired when a virtual key is pressed. Call `preventDefault()` to
        skip the default input action (text insertion, backspace, etc.).
         */
        keyPress?: (event: KioskKeyboard$KeyPressEvent) => void;

        /**
         * Fired when the active layout changes (via a `{layout:name}` key
        or programmatic `setLayout()` call).
         */
        layoutChange?: (event: KioskKeyboard$LayoutChangeEvent) => void;

        /**
         * Fired when the keyboard type changes - by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         */
        keyboardTypeChange?: (event: KioskKeyboard$KeyboardTypeChangeEvent) => void;

        /**
         * Fired when the active target control changes (focus switches to a
        different input in auto-show mode, or programmatically).
         */
        activeControlChange?: (event: KioskKeyboard$ActiveControlChangeEvent) => void;

        /**
         * Fired when `show()` opens the docked keyboard (not tied to CSS transition end).
         */
        afterOpen?: (event: KioskKeyboard$AfterOpenEvent) => void;

        /**
         * Fired when `close()` closes the docked keyboard (not tied to CSS transition end).
         */
        afterClose?: (event: KioskKeyboard$AfterCloseEvent) => void;
    }

    export default interface KioskKeyboard {

        // property: layout

        /**
         * Active layout name. Only effective when keyboardType is "Full".
        Auto-detected from the UI5 locale when omitted.
         */
        getLayout(): string;

        /**
         * Active layout name. Only effective when keyboardType is "Full".
        Auto-detected from the UI5 locale when omitted.
         */
        setLayout(layout: string): this;

        // property: keyboardType

        /**
         * Keyboard display type.
        `"Full"` renders the active layout. `"Numeric"` and `"Numpad"` render
        compact number-oriented layouts regardless of the layout property.
        
        Setting this property (via setter, constructor, or XML attribute)
        disables auto-type detection permanently.
        Call `resetKeyboardType()` to re-enable it.
         */
        getKeyboardType(): KeyboardType;

        /**
         * Keyboard display type.
        `"Full"` renders the active layout. `"Numeric"` and `"Numpad"` render
        compact number-oriented layouts regardless of the layout property.
        
        Setting this property (via setter, constructor, or XML attribute)
        disables auto-type detection permanently.
        Call `resetKeyboardType()` to re-enable it.
         */
        setKeyboardType(keyboardType: KeyboardType): this;

        // property: enabled

        /**
         * Whether the keyboard is interactive. When `false`, all keys are
        visually dimmed and pointer events are disabled.
         */
        getEnabled(): boolean;

        /**
         * Whether the keyboard is interactive. When `false`, all keys are
        visually dimmed and pointer events are disabled.
         */
        setEnabled(enabled: boolean): this;

        // property: ariaLabel

        /**
         * Accessible label for the keyboard group. Defaults to
        "Virtual Keyboard" from the resource bundle when left empty.
         */
        getAriaLabel(): string;

        /**
         * Accessible label for the keyboard group. Defaults to
        "Virtual Keyboard" from the resource bundle when left empty.
         */
        setAriaLabel(ariaLabel: string): this;

        // property: docked

        /**
         * When `true`, the keyboard anchors to the bottom of the viewport
        and slides in/out. Use `show()` / `close()` to control
        visibility manually, or set `autoShow` to `true` for automatic
        focus-based behavior.
         */
        getDocked(): boolean;

        /**
         * When `true`, the keyboard anchors to the bottom of the viewport
        and slides in/out. Use `show()` / `close()` to control
        visibility manually, or set `autoShow` to `true` for automatic
        focus-based behavior.
         */
        setDocked(docked: boolean): this;

        // property: autoShow

        /**
         * When `true`, the docked keyboard automatically opens when any
        `<input>` or `<textarea>` receives focus, and closes when
        focus leaves. Requires `docked="true"`.
         */
        getAutoShow(): boolean;

        /**
         * When `true`, the docked keyboard automatically opens when any
        `<input>` or `<textarea>` receives focus, and closes when
        focus leaves. Requires `docked="true"`.
         */
        setAutoShow(autoShow: boolean): this;

        // property: autoType

        /**
         * When `true` and `autoShow` is active, the keyboard inspects the
        focused input's type metadata and automatically switches between
        Full and Numpad keyboard types.
        
        Has no effect when `keyboardType` has been set explicitly (via
        setter, constructor, or XML attribute), because that locks the
        keyboard type. Call `resetKeyboardType()` to clear the lock
        and re-enable auto-type detection.
         */
        getAutoType(): boolean;

        /**
         * When `true` and `autoShow` is active, the keyboard inspects the
        focused input's type metadata and automatically switches between
        Full and Numpad keyboard types.
        
        Has no effect when `keyboardType` has been set explicitly (via
        setter, constructor, or XML attribute), because that locks the
        keyboard type. Call `resetKeyboardType()` to clear the lock
        and re-enable auto-type detection.
         */
        setAutoType(autoType: boolean): this;

        // property: mobileKeyboard

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
         */
        getMobileKeyboard(): MobileKeyboard;

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
         */
        setMobileKeyboard(mobileKeyboard: MobileKeyboard): this;

        // property: fKeyMode

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
         */
        getFKeyMode(): FKeyMode;

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
         */
        setFKeyMode(fKeyMode: FKeyMode): this;

        // property: controls

        /**
         * List of input control IDs to target. When set, attaches focus
        delegation to each resolved control so the keyboard auto-targets
        whichever input last received focus.
        
        IDs are resolved against the parent View first (view-local IDs),
        then globally. This makes the property safe to use in XML views
        where control IDs are prefixed by the view ID.
         */
        getControls(): string[];

        /**
         * List of input control IDs to target. When set, attaches focus
        delegation to each resolved control so the keyboard auto-targets
        whichever input last received focus.
        
        IDs are resolved against the parent View first (view-local IDs),
        then globally. This makes the property safe to use in XML views
        where control IDs are prefixed by the view ID.
         */
        setControls(controls: string[]): this;

        // property: instanceLayouts

        /**
         * Per-instance layout overrides. Resolution order is
        **instance map -> built-in**, so an entry here shadows the
        built-in of the same name for this control only. Use this to
        supply a custom layout, or to override a built-in (e.g. swap
        the German layout) without affecting other controls. Accepts
        a plain `Record<string, LayoutDefinition>`; the control stores
        it as a `Map` internally.
         *
         * @since 0.1.0
         */
        getInstanceLayouts(): object | null;

        /**
         * Per-instance layout overrides. Resolution order is
        **instance map -> built-in**, so an entry here shadows the
        built-in of the same name for this control only. Use this to
        supply a custom layout, or to override a built-in (e.g. swap
        the German layout) without affecting other controls. Accepts
        a plain `Record<string, LayoutDefinition>`; the control stores
        it as a `Map` internally.
         *
         * @since 0.1.0
         */
        setInstanceLayouts(instanceLayouts: object | null): this;

        // property: instanceLocaleLayouts

        /**
         * Per-instance locale-to-layout overrides. Resolution order is
        **instance map -> built-in locale map -> default layout**.
        Keys are BCP-47 prefixes (e.g. `"de"`, `"de-at"`); values are
        layout names. Accepts a plain `Record<string, string>`; the
        control stores it as a `Map` internally.
         *
         * @since 0.1.0
         */
        getInstanceLocaleLayouts(): object | null;

        /**
         * Per-instance locale-to-layout overrides. Resolution order is
        **instance map -> built-in locale map -> default layout**.
        Keys are BCP-47 prefixes (e.g. `"de"`, `"de-at"`); values are
        layout names. Accepts a plain `Record<string, string>`; the
        control stores it as a `Map` internally.
         *
         * @since 0.1.0
         */
        setInstanceLocaleLayouts(instanceLocaleLayouts: object | null): this;

        // property: instanceMiddleware

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
        getInstanceMiddleware(): object | null;

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
        setInstanceMiddleware(instanceMiddleware: object | null): this;

        // association: _activeTarget
        get_activeTarget(): string;
        set_activeTarget(_activeTarget?: string | Control): this;

        // association: ariaLabelledBy
        getAriaLabelledBy(): string[];
        addAriaLabelledBy(ariaLabelledBy: string | Control): this;
        removeAriaLabelledBy(ariaLabelledBy: number | string | Control): string;
        removeAllAriaLabelledBy(): string[];

        // association: ariaDescribedBy
        getAriaDescribedBy(): string[];
        addAriaDescribedBy(ariaDescribedBy: string | Control): this;
        removeAriaDescribedBy(ariaDescribedBy: number | string | Control): string;
        removeAllAriaDescribedBy(): string[];

        // event: keyPress

        /**
         * Fired when a virtual key is pressed. Call `preventDefault()` to
        skip the default input action (text insertion, backspace, etc.).
         */
        attachKeyPress(fn: (event: KioskKeyboard$KeyPressEvent) => void, listener?: object): this;

        /**
         * Fired when a virtual key is pressed. Call `preventDefault()` to
        skip the default input action (text insertion, backspace, etc.).
         */
        attachKeyPress<CustomDataType extends object>(data: CustomDataType, fn: (event: KioskKeyboard$KeyPressEvent, data: CustomDataType) => void, listener?: object): this;

        /**
         * Fired when a virtual key is pressed. Call `preventDefault()` to
        skip the default input action (text insertion, backspace, etc.).
         */
        detachKeyPress(fn: (event: KioskKeyboard$KeyPressEvent) => void, listener?: object): this;

        /**
         * Fired when a virtual key is pressed. Call `preventDefault()` to
        skip the default input action (text insertion, backspace, etc.).
         */
        fireKeyPress(parameters?: KioskKeyboard$KeyPressEventParameters): boolean;

        // event: layoutChange

        /**
         * Fired when the active layout changes (via a `{layout:name}` key
        or programmatic `setLayout()` call).
         */
        attachLayoutChange(fn: (event: KioskKeyboard$LayoutChangeEvent) => void, listener?: object): this;

        /**
         * Fired when the active layout changes (via a `{layout:name}` key
        or programmatic `setLayout()` call).
         */
        attachLayoutChange<CustomDataType extends object>(data: CustomDataType, fn: (event: KioskKeyboard$LayoutChangeEvent, data: CustomDataType) => void, listener?: object): this;

        /**
         * Fired when the active layout changes (via a `{layout:name}` key
        or programmatic `setLayout()` call).
         */
        detachLayoutChange(fn: (event: KioskKeyboard$LayoutChangeEvent) => void, listener?: object): this;

        /**
         * Fired when the active layout changes (via a `{layout:name}` key
        or programmatic `setLayout()` call).
         */
        fireLayoutChange(parameters?: KioskKeyboard$LayoutChangeEventParameters): this;

        // event: keyboardTypeChange

        /**
         * Fired when the keyboard type changes - by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         */
        attachKeyboardTypeChange(fn: (event: KioskKeyboard$KeyboardTypeChangeEvent) => void, listener?: object): this;

        /**
         * Fired when the keyboard type changes - by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         */
        attachKeyboardTypeChange<CustomDataType extends object>(data: CustomDataType, fn: (event: KioskKeyboard$KeyboardTypeChangeEvent, data: CustomDataType) => void, listener?: object): this;

        /**
         * Fired when the keyboard type changes - by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         */
        detachKeyboardTypeChange(fn: (event: KioskKeyboard$KeyboardTypeChangeEvent) => void, listener?: object): this;

        /**
         * Fired when the keyboard type changes - by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         */
        fireKeyboardTypeChange(parameters?: KioskKeyboard$KeyboardTypeChangeEventParameters): this;

        // event: activeControlChange

        /**
         * Fired when the active target control changes (focus switches to a
        different input in auto-show mode, or programmatically).
         */
        attachActiveControlChange(fn: (event: KioskKeyboard$ActiveControlChangeEvent) => void, listener?: object): this;

        /**
         * Fired when the active target control changes (focus switches to a
        different input in auto-show mode, or programmatically).
         */
        attachActiveControlChange<CustomDataType extends object>(data: CustomDataType, fn: (event: KioskKeyboard$ActiveControlChangeEvent, data: CustomDataType) => void, listener?: object): this;

        /**
         * Fired when the active target control changes (focus switches to a
        different input in auto-show mode, or programmatically).
         */
        detachActiveControlChange(fn: (event: KioskKeyboard$ActiveControlChangeEvent) => void, listener?: object): this;

        /**
         * Fired when the active target control changes (focus switches to a
        different input in auto-show mode, or programmatically).
         */
        fireActiveControlChange(parameters?: KioskKeyboard$ActiveControlChangeEventParameters): this;

        // event: afterOpen

        /**
         * Fired when `show()` opens the docked keyboard (not tied to CSS transition end).
         */
        attachAfterOpen(fn: (event: KioskKeyboard$AfterOpenEvent) => void, listener?: object): this;

        /**
         * Fired when `show()` opens the docked keyboard (not tied to CSS transition end).
         */
        attachAfterOpen<CustomDataType extends object>(data: CustomDataType, fn: (event: KioskKeyboard$AfterOpenEvent, data: CustomDataType) => void, listener?: object): this;

        /**
         * Fired when `show()` opens the docked keyboard (not tied to CSS transition end).
         */
        detachAfterOpen(fn: (event: KioskKeyboard$AfterOpenEvent) => void, listener?: object): this;

        /**
         * Fired when `show()` opens the docked keyboard (not tied to CSS transition end).
         */
        fireAfterOpen(parameters?: KioskKeyboard$AfterOpenEventParameters): this;

        // event: afterClose

        /**
         * Fired when `close()` closes the docked keyboard (not tied to CSS transition end).
         */
        attachAfterClose(fn: (event: KioskKeyboard$AfterCloseEvent) => void, listener?: object): this;

        /**
         * Fired when `close()` closes the docked keyboard (not tied to CSS transition end).
         */
        attachAfterClose<CustomDataType extends object>(data: CustomDataType, fn: (event: KioskKeyboard$AfterCloseEvent, data: CustomDataType) => void, listener?: object): this;

        /**
         * Fired when `close()` closes the docked keyboard (not tied to CSS transition end).
         */
        detachAfterClose(fn: (event: KioskKeyboard$AfterCloseEvent) => void, listener?: object): this;

        /**
         * Fired when `close()` closes the docked keyboard (not tied to CSS transition end).
         */
        fireAfterClose(parameters?: KioskKeyboard$AfterCloseEventParameters): this;
    }

    /**
     * Interface describing the parameters of KioskKeyboard's 'keyPress' event.
     * Fired when a virtual key is pressed. Call `preventDefault()` to
    skip the default input action (text insertion, backspace, etc.).
     */
    export interface KioskKeyboard$KeyPressEventParameters {
        key?: string;
        shiftKey?: boolean;
    }

    /**
     * Interface describing the parameters of KioskKeyboard's 'layoutChange' event.
     * Fired when the active layout changes (via a `{layout:name}` key
    or programmatic `setLayout()` call).
     */
    export interface KioskKeyboard$LayoutChangeEventParameters {
        layout?: string;
    }

    /**
     * Interface describing the parameters of KioskKeyboard's 'keyboardTypeChange' event.
     * Fired when the keyboard type changes - by auto-type detection,
    explicit `setKeyboardType()`, or `resetKeyboardType()`.
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
     */
    export interface KioskKeyboard$ActiveControlChangeEventParameters {
        controlId?: string;
    }

    /**
     * Interface describing the parameters of KioskKeyboard's 'afterOpen' event.
     * Fired when `show()` opens the docked keyboard (not tied to CSS transition end).
     */
    // eslint-disable-next-line
    export interface KioskKeyboard$AfterOpenEventParameters {
    }

    /**
     * Interface describing the parameters of KioskKeyboard's 'afterClose' event.
     * Fired when `close()` closes the docked keyboard (not tied to CSS transition end).
     */
    // eslint-disable-next-line
    export interface KioskKeyboard$AfterCloseEventParameters {
    }

    /**
     * Type describing the KioskKeyboard's 'keyPress' event.
     * Fired when a virtual key is pressed. Call `preventDefault()` to
    skip the default input action (text insertion, backspace, etc.).
     */
    export type KioskKeyboard$KeyPressEvent = Event<KioskKeyboard$KeyPressEventParameters>;

    /**
     * Type describing the KioskKeyboard's 'layoutChange' event.
     * Fired when the active layout changes (via a `{layout:name}` key
    or programmatic `setLayout()` call).
     */
    export type KioskKeyboard$LayoutChangeEvent = Event<KioskKeyboard$LayoutChangeEventParameters>;

    /**
     * Type describing the KioskKeyboard's 'keyboardTypeChange' event.
     * Fired when the keyboard type changes - by auto-type detection,
    explicit `setKeyboardType()`, or `resetKeyboardType()`.
     */
    export type KioskKeyboard$KeyboardTypeChangeEvent = Event<KioskKeyboard$KeyboardTypeChangeEventParameters>;

    /**
     * Type describing the KioskKeyboard's 'activeControlChange' event.
     * Fired when the active target control changes (focus switches to a
    different input in auto-show mode, or programmatically).
     */
    export type KioskKeyboard$ActiveControlChangeEvent = Event<KioskKeyboard$ActiveControlChangeEventParameters>;

    /**
     * Type describing the KioskKeyboard's 'afterOpen' event.
     * Fired when `show()` opens the docked keyboard (not tied to CSS transition end).
     */
    export type KioskKeyboard$AfterOpenEvent = Event<KioskKeyboard$AfterOpenEventParameters>;

    /**
     * Type describing the KioskKeyboard's 'afterClose' event.
     * Fired when `close()` closes the docked keyboard (not tied to CSS transition end).
     */
    export type KioskKeyboard$AfterCloseEvent = Event<KioskKeyboard$AfterCloseEventParameters>;
}
