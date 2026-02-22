import Event from "sap/ui/base/Event";
import { KeyboardType } from "ui5/kiosk/library";
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
         * /**
               * Keyboard display type.
               * `"Full"` renders the active layout. `"Numeric"` and `"Numpad"` render
               * compact number-oriented layouts regardless of the layout property.
               *
               * Setting this property (via setter, constructor, or XML attribute)
               * disables auto-type detection permanently.
               * Call
        {@link #resetKeyboardType}
         to re-enable it.
               *
               *
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
         * /**
               * When `true`, the keyboard anchors to the bottom of the viewport
               * and slides in/out. Use
        {@link #show}
        /
        {@link #close}
         to control
               * visibility manually, or set `autoShow` to `true` for automatic
               * focus-based behavior.
               *
               *
         */
        docked?: boolean | PropertyBindingInfo | `{${string}}`;

        /**
         * When `true`, the docked keyboard automatically opens when any
        `<input>` or `<textarea>` receives focus, and closes when
        focus leaves. Requires `docked="true"`.
         */
        autoShow?: boolean | PropertyBindingInfo | `{${string}}`;

        /**
         * /**
               * When `true` and `autoShow` is active, the keyboard inspects the
               * focused input's type metadata and automatically switches between
               * Full and Numpad keyboard types.
               *
               * Has no effect when `keyboardType` has been set explicitly (via
               * setter, constructor, or XML attribute), because that locks the
               * keyboard type. Call
        {@link #resetKeyboardType}
         to clear the lock
               * and re-enable auto-type detection.
               *
               *
         */
        autoType?: boolean | PropertyBindingInfo | `{${string}}`;

        /**
         * Controls whether the KioskKeyboard or the native on-screen
        keyboard is used.
        
        - `"Custom"` (default) — always uses the KioskKeyboard and
          suppresses the native keyboard via `inputmode="none"`.
          Best for **dedicated kiosk terminals** without a physical
          keyboard.
        - `"Native"` — always defers to the native keyboard; the
          KioskKeyboard will not open on focus.
        - `"Auto"` — uses KioskKeyboard on desktop browsers, defers
          to the native keyboard on phones and tablets. This is
          intended for **kiosk terminals running a desktop OS**
          (no physical keyboard) that should still let mobile
          visitors use their native keyboard. On a regular
          laptop/desktop with a physical keyboard the virtual
          keyboard **will** still appear — use `"Native"` if that
          is not desired.
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
         */
        fKeyMode?: FKeyMode | PropertyBindingInfo | `{${string}}`;

        /**
         * List of input control IDs to target. When set, attaches focus
        delegation to each resolved control so the keyboard auto-targets
        whichever input last received focus.
        
        IDs are resolved against the parent View first (view-local IDs),
        then globally. This makes the property safe to use in XML views
        where control IDs are prefixed by the view ID.
        
        Use this instead of `targetInput` when multiple inputs share
        a single keyboard (e.g. a form with several fields).
         */
        inputIds?: string[] | PropertyBindingInfo | `{${string}}`;

        /**
         * When `true`, the keyboard maintains a consistent minimum height
        across layout switches. Prevents visual layout shifts and works
        around a `sap.m.Popover` bug where content height changes can
        trigger spurious close.
        
        Only effective for non-docked Full keyboards. Docked keyboards
        always minimize their footprint.
         */
        stableHeight?: boolean | PropertyBindingInfo | `{${string}}`;

        /**
         * The input control to type into (e.g. `sap.m.Input`, `sap.m.TextArea`).
        For targeting multiple inputs, use the `inputIds` property instead.
         */
        targetInput?: Control | string;
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
         * Fired when the keyboard type changes — by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         */
        keyboardTypeChange?: (event: KioskKeyboard$KeyboardTypeChangeEvent) => void;

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
         * Gets current value of property "layout".
         *
         * Active layout name. Only effective when keyboardType is "Full".
        Auto-detected from the UI5 locale when omitted.
         *
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
         * /**
               * Keyboard display type.
               * `"Full"` renders the active layout. `"Numeric"` and `"Numpad"` render
               * compact number-oriented layouts regardless of the layout property.
               *
               * Setting this property (via setter, constructor, or XML attribute)
               * disables auto-type detection permanently.
               * Call
        {@link #resetKeyboardType}
         to re-enable it.
               *
               *
         *
         * Default value is: "Full"
         * @returns Value of property "keyboardType"
         */
        getKeyboardType(): KeyboardType;

        /**
         * Sets a new value for property "keyboardType".
         *
         * /**
               * Keyboard display type.
               * `"Full"` renders the active layout. `"Numeric"` and `"Numpad"` render
               * compact number-oriented layouts regardless of the layout property.
               *
               * Setting this property (via setter, constructor, or XML attribute)
               * disables auto-type detection permanently.
               * Call
        {@link #resetKeyboardType}
         to re-enable it.
               *
               *
         *
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
         * /**
               * When `true`, the keyboard anchors to the bottom of the viewport
               * and slides in/out. Use
        {@link #show}
        /
        {@link #close}
         to control
               * visibility manually, or set `autoShow` to `true` for automatic
               * focus-based behavior.
               *
               *
         *
         * Default value is: false
         * @returns Value of property "docked"
         */
        getDocked(): boolean;

        /**
         * Sets a new value for property "docked".
         *
         * /**
               * When `true`, the keyboard anchors to the bottom of the viewport
               * and slides in/out. Use
        {@link #show}
        /
        {@link #close}
         to control
               * visibility manually, or set `autoShow` to `true` for automatic
               * focus-based behavior.
               *
               *
         *
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
         * /**
               * When `true` and `autoShow` is active, the keyboard inspects the
               * focused input's type metadata and automatically switches between
               * Full and Numpad keyboard types.
               *
               * Has no effect when `keyboardType` has been set explicitly (via
               * setter, constructor, or XML attribute), because that locks the
               * keyboard type. Call
        {@link #resetKeyboardType}
         to clear the lock
               * and re-enable auto-type detection.
               *
               *
         *
         * Default value is: false
         * @returns Value of property "autoType"
         */
        getAutoType(): boolean;

        /**
         * Sets a new value for property "autoType".
         *
         * /**
               * When `true` and `autoShow` is active, the keyboard inspects the
               * focused input's type metadata and automatically switches between
               * Full and Numpad keyboard types.
               *
               * Has no effect when `keyboardType` has been set explicitly (via
               * setter, constructor, or XML attribute), because that locks the
               * keyboard type. Call
        {@link #resetKeyboardType}
         to clear the lock
               * and re-enable auto-type detection.
               *
               *
         *
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: false
         * @param [autoType=false] New value for property "autoType"
         * @returns Reference to "this" in order to allow method chaining
         */
        setAutoType(autoType: boolean): this;

        // property: mobileKeyboard

        /**
         * Gets current value of property "mobileKeyboard".
         *
         * Controls whether the KioskKeyboard or the native on-screen
        keyboard is used.
        
        - `"Custom"` (default) — always uses the KioskKeyboard and
          suppresses the native keyboard via `inputmode="none"`.
          Best for **dedicated kiosk terminals** without a physical
          keyboard.
        - `"Native"` — always defers to the native keyboard; the
          KioskKeyboard will not open on focus.
        - `"Auto"` — uses KioskKeyboard on desktop browsers, defers
          to the native keyboard on phones and tablets. This is
          intended for **kiosk terminals running a desktop OS**
          (no physical keyboard) that should still let mobile
          visitors use their native keyboard. On a regular
          laptop/desktop with a physical keyboard the virtual
          keyboard **will** still appear — use `"Native"` if that
          is not desired.
         *
         * Default value is: "Custom"
         * @returns Value of property "mobileKeyboard"
         */
        getMobileKeyboard(): MobileKeyboard;

        /**
         * Sets a new value for property "mobileKeyboard".
         *
         * Controls whether the KioskKeyboard or the native on-screen
        keyboard is used.
        
        - `"Custom"` (default) — always uses the KioskKeyboard and
          suppresses the native keyboard via `inputmode="none"`.
          Best for **dedicated kiosk terminals** without a physical
          keyboard.
        - `"Native"` — always defers to the native keyboard; the
          KioskKeyboard will not open on focus.
        - `"Auto"` — uses KioskKeyboard on desktop browsers, defers
          to the native keyboard on phones and tablets. This is
          intended for **kiosk terminals running a desktop OS**
          (no physical keyboard) that should still let mobile
          visitors use their native keyboard. On a regular
          laptop/desktop with a physical keyboard the virtual
          keyboard **will** still appear — use `"Native"` if that
          is not desired.
         *
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: "Custom"
         * @param [mobileKeyboard="Custom"] New value for property "mobileKeyboard"
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
         *
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
         *
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: "Virtual"
         * @param [fKeyMode="Virtual"] New value for property "fKeyMode"
         * @returns Reference to "this" in order to allow method chaining
         */
        setFKeyMode(fKeyMode: FKeyMode): this;

        // property: inputIds

        /**
         * Gets current value of property "inputIds".
         *
         * List of input control IDs to target. When set, attaches focus
        delegation to each resolved control so the keyboard auto-targets
        whichever input last received focus.
        
        IDs are resolved against the parent View first (view-local IDs),
        then globally. This makes the property safe to use in XML views
        where control IDs are prefixed by the view ID.
        
        Use this instead of `targetInput` when multiple inputs share
        a single keyboard (e.g. a form with several fields).
         *
         * Default value is: []
         * @returns Value of property "inputIds"
         */
        getInputIds(): string[];

        /**
         * Sets a new value for property "inputIds".
         *
         * List of input control IDs to target. When set, attaches focus
        delegation to each resolved control so the keyboard auto-targets
        whichever input last received focus.
        
        IDs are resolved against the parent View first (view-local IDs),
        then globally. This makes the property safe to use in XML views
        where control IDs are prefixed by the view ID.
        
        Use this instead of `targetInput` when multiple inputs share
        a single keyboard (e.g. a form with several fields).
         *
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: []
         * @param [inputIds=[]] New value for property "inputIds"
         * @returns Reference to "this" in order to allow method chaining
         */
        setInputIds(inputIds: string[]): this;

        // property: stableHeight

        /**
         * Gets current value of property "stableHeight".
         *
         * When `true`, the keyboard maintains a consistent minimum height
        across layout switches. Prevents visual layout shifts and works
        around a `sap.m.Popover` bug where content height changes can
        trigger spurious close.
        
        Only effective for non-docked Full keyboards. Docked keyboards
        always minimize their footprint.
         *
         * Default value is: false
         * @returns Value of property "stableHeight"
         */
        getStableHeight(): boolean;

        /**
         * Sets a new value for property "stableHeight".
         *
         * When `true`, the keyboard maintains a consistent minimum height
        across layout switches. Prevents visual layout shifts and works
        around a `sap.m.Popover` bug where content height changes can
        trigger spurious close.
        
        Only effective for non-docked Full keyboards. Docked keyboards
        always minimize their footprint.
         *
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: false
         * @param [stableHeight=false] New value for property "stableHeight"
         * @returns Reference to "this" in order to allow method chaining
         */
        setStableHeight(stableHeight: boolean): this;

        // association: targetInput

        /**
         * ID of the element which is the current target of the association "targetInput", or "null".
         *
         * The input control to type into (e.g. `sap.m.Input`, `sap.m.TextArea`).
        For targeting multiple inputs, use the `inputIds` property instead.
         */
        getTargetInput(): string;

        /**
         * Sets the associated targetInput.
         *
         * The input control to type into (e.g. `sap.m.Input`, `sap.m.TextArea`).
        For targeting multiple inputs, use the `inputIds` property instead.
         *
         * @param targetInput ID of an element which becomes the new target of this "targetInput" association; alternatively, an element instance may be given
         * @returns Reference to "this" in order to allow method chaining
         */
        setTargetInput(targetInput?: string | Control): this;

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
         * The passed function and listener object must match the ones used for event registration.
         *
         * @param fn The function to be called, when the event occurs
         * @param listener Context object on which the given function had to be called
         * @returns Reference to "this" in order to allow method chaining
         */
        detachKeyPress(fn: (event: KioskKeyboard$KeyPressEvent) => void, listener?: object): this;

        /**
         * Fires event "keyPress" to attached listeners.
         *
         * Fired when a virtual key is pressed. Call `preventDefault()` to
        skip the default input action (text insertion, backspace, etc.).
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
         * The passed function and listener object must match the ones used for event registration.
         *
         * @param fn The function to be called, when the event occurs
         * @param listener Context object on which the given function had to be called
         * @returns Reference to "this" in order to allow method chaining
         */
        detachLayoutChange(fn: (event: KioskKeyboard$LayoutChangeEvent) => void, listener?: object): this;

        /**
         * Fires event "layoutChange" to attached listeners.
         *
         * Fired when the active layout changes (via a `{layout:name}` key
        or programmatic `setLayout()` call).
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
         * Fired when the keyboard type changes — by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         *
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
         * Fired when the keyboard type changes — by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         *
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
         * Fired when the keyboard type changes — by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         *
         * The passed function and listener object must match the ones used for event registration.
         *
         * @param fn The function to be called, when the event occurs
         * @param listener Context object on which the given function had to be called
         * @returns Reference to "this" in order to allow method chaining
         */
        detachKeyboardTypeChange(fn: (event: KioskKeyboard$KeyboardTypeChangeEvent) => void, listener?: object): this;

        /**
         * Fires event "keyboardTypeChange" to attached listeners.
         *
         * Fired when the keyboard type changes — by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         *
         * @param parameters Parameters to pass along with the event
         * @param [mParameters.keyboardType] Fired when the keyboard type changes — by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         * @param [mParameters.previousKeyboardType] Fired when the keyboard type changes — by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         * @param [mParameters.autoDetected] Fired when the keyboard type changes — by auto-type detection,
        explicit `setKeyboardType()`, or `resetKeyboardType()`.
         *
         * @returns Reference to "this" in order to allow method chaining
         */
        fireKeyboardTypeChange(parameters?: KioskKeyboard$KeyboardTypeChangeEventParameters): this;

        // event: afterOpen

        /**
         * Attaches event handler "fn" to the "afterOpen" event of this "KioskKeyboard".
         *
         * Fired when `show()` opens the docked keyboard (not tied to CSS transition end).
         *
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
         * The passed function and listener object must match the ones used for event registration.
         *
         * @param fn The function to be called, when the event occurs
         * @param listener Context object on which the given function had to be called
         * @returns Reference to "this" in order to allow method chaining
         */
        detachAfterOpen(fn: (event: KioskKeyboard$AfterOpenEvent) => void, listener?: object): this;

        /**
         * Fires event "afterOpen" to attached listeners.
         *
         * Fired when `show()` opens the docked keyboard (not tied to CSS transition end).
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
         * The passed function and listener object must match the ones used for event registration.
         *
         * @param fn The function to be called, when the event occurs
         * @param listener Context object on which the given function had to be called
         * @returns Reference to "this" in order to allow method chaining
         */
        detachAfterClose(fn: (event: KioskKeyboard$AfterCloseEvent) => void, listener?: object): this;

        /**
         * Fires event "afterClose" to attached listeners.
         *
         * Fired when `close()` closes the docked keyboard (not tied to CSS transition end).
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
     * Fired when the keyboard type changes — by auto-type detection,
    explicit `setKeyboardType()`, or `resetKeyboardType()`.
     */
    export interface KioskKeyboard$KeyboardTypeChangeEventParameters {
        keyboardType?: string;
        previousKeyboardType?: string;
        autoDetected?: boolean;
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
     * Fired when the keyboard type changes — by auto-type detection,
    explicit `setKeyboardType()`, or `resetKeyboardType()`.
     */
    export type KioskKeyboard$KeyboardTypeChangeEvent = Event<KioskKeyboard$KeyboardTypeChangeEventParameters>;

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
