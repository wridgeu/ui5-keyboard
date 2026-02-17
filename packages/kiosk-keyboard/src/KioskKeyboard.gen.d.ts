import Event from "sap/ui/base/Event";
import { KeyboardType } from "ui5/kiosk/library";
import { MobileKeyboard } from "ui5/kiosk/library";
import Control from "sap/ui/core/Control";
import { PropertyBindingInfo } from "sap/ui/base/ManagedObject";
import { $ControlSettings } from "sap/ui/core/Control";

declare module "./KioskKeyboard" {
  /**
   * Interface defining the settings object used in constructor calls
   */
  interface $KioskKeyboardSettings extends $ControlSettings {
    /**
     * Active layout name. Only effective when keyboardType is "full".
     */
    layout?: string | PropertyBindingInfo;

    /**
         * Keyboard display type.
        "Full" renders the active layout. "Numeric" and "Numpad" render
        compact number-oriented layouts regardless of the layout property.
        Setting this property (via setter, constructor, or XML attribute)
        disables auto-type detection permanently.
        Call `resetKeyboardType()` to re-enable it.
         */
    keyboardType?: KeyboardType | PropertyBindingInfo | `{${string}}`;

    /**
     * Whether the keyboard is interactive.
     */
    enabled?: boolean | PropertyBindingInfo | `{${string}}`;

    /**
     * Accessible label for the keyboard group.
     */
    ariaLabel?: string | PropertyBindingInfo;

    /**
         * When true, the keyboard anchors to the bottom of the viewport
        and slides in/out. Use show()/close() to control visibility
        manually, or set autoShow to true for automatic behavior.
         */
    docked?: boolean | PropertyBindingInfo | `{${string}}`;

    /**
         * When true, the docked keyboard automatically opens when any
        `<input>` or `<textarea>` receives focus, and closes when
        focus leaves. Requires `docked="true"`.
         */
    autoShow?: boolean | PropertyBindingInfo | `{${string}}`;

    /**
         * When true and autoShow is active, the keyboard inspects the
        focused input's type metadata and automatically switches between
        Full and Numpad keyboard types.
        Has no effect when keyboardType has been set explicitly (via
        setter, constructor, or XML attribute), because that locks the
        keyboard type. Call `resetKeyboardType()` to clear the lock
        and re-enable auto-type detection.
         */
    autoType?: boolean | PropertyBindingInfo | `{${string}}`;

    /**
         * Controls native keyboard behavior on mobile/touch devices.
        "Custom" (default) always uses this keyboard and suppresses
        the native one. "Native" defers to the native keyboard on
        phones and tablets. "Auto" uses custom on desktop, native
        on mobile.
         */
    mobileKeyboard?: MobileKeyboard | PropertyBindingInfo | `{${string}}`;

    /**
         * List of input control IDs to target. When set, attaches focus
        delegation to each resolved control so the keyboard auto-targets
        whichever input last received focus.
         */
    inputIds?: string[] | PropertyBindingInfo | `{${string}}`;

    /**
     * The input control to type into (e.g. sap.m.Input, sap.m.TextArea).
     */
    targetInput?: Control | string;
    ariaLabelledBy?: Control | string | (Control | string)[];
    ariaDescribedBy?: Control | string | (Control | string)[];

    /**
     * Fired when a virtual key is pressed. Call preventDefault() to skip the default input action.
     */
    keyPress?: (event: KioskKeyboard$KeyPressEvent) => void;

    /**
     * Fired when the active layout changes.
     */
    layoutChange?: (event: KioskKeyboard$LayoutChangeEvent) => void;

    /**
     * Fired after the docked keyboard has opened.
     */
    afterOpen?: (event: KioskKeyboard$AfterOpenEvent) => void;

    /**
     * Fired after the docked keyboard has closed.
     */
    afterClose?: (event: KioskKeyboard$AfterCloseEvent) => void;
  }

  export default interface KioskKeyboard {
    // property: layout

    /**
     * Gets current value of property "layout".
     *
     * Active layout name. Only effective when keyboardType is "full".
     *
     * Default value is: "qwerty"
     * @returns Value of property "layout"
     */
    getLayout(): string;

    /**
     * Sets a new value for property "layout".
     *
     * Active layout name. Only effective when keyboardType is "full".
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
         * Keyboard display type.
        "Full" renders the active layout. "Numeric" and "Numpad" render
        compact number-oriented layouts regardless of the layout property.
        Setting this property (via setter, constructor, or XML attribute)
        disables auto-type detection permanently.
        Call `resetKeyboardType()` to re-enable it.
         *
         * Default value is: "Full"
         * @returns Value of property "keyboardType"
         */
    getKeyboardType(): KeyboardType;

    /**
         * Sets a new value for property "keyboardType".
         *
         * Keyboard display type.
        "Full" renders the active layout. "Numeric" and "Numpad" render
        compact number-oriented layouts regardless of the layout property.
        Setting this property (via setter, constructor, or XML attribute)
        disables auto-type detection permanently.
        Call `resetKeyboardType()` to re-enable it.
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
     * Whether the keyboard is interactive.
     *
     * Default value is: true
     * @returns Value of property "enabled"
     */
    getEnabled(): boolean;

    /**
     * Sets a new value for property "enabled".
     *
     * Whether the keyboard is interactive.
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
     * Accessible label for the keyboard group.
     *
     * Default value is: ""
     * @returns Value of property "ariaLabel"
     */
    getAriaLabel(): string;

    /**
     * Sets a new value for property "ariaLabel".
     *
     * Accessible label for the keyboard group.
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
         * When true, the keyboard anchors to the bottom of the viewport
        and slides in/out. Use show()/close() to control visibility
        manually, or set autoShow to true for automatic behavior.
         *
         * Default value is: false
         * @returns Value of property "docked"
         */
    getDocked(): boolean;

    /**
         * Sets a new value for property "docked".
         *
         * When true, the keyboard anchors to the bottom of the viewport
        and slides in/out. Use show()/close() to control visibility
        manually, or set autoShow to true for automatic behavior.
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
         * When true, the docked keyboard automatically opens when any
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
         * When true, the docked keyboard automatically opens when any
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
         * When true and autoShow is active, the keyboard inspects the
        focused input's type metadata and automatically switches between
        Full and Numpad keyboard types.
        Has no effect when keyboardType has been set explicitly (via
        setter, constructor, or XML attribute), because that locks the
        keyboard type. Call `resetKeyboardType()` to clear the lock
        and re-enable auto-type detection.
         *
         * Default value is: false
         * @returns Value of property "autoType"
         */
    getAutoType(): boolean;

    /**
         * Sets a new value for property "autoType".
         *
         * When true and autoShow is active, the keyboard inspects the
        focused input's type metadata and automatically switches between
        Full and Numpad keyboard types.
        Has no effect when keyboardType has been set explicitly (via
        setter, constructor, or XML attribute), because that locks the
        keyboard type. Call `resetKeyboardType()` to clear the lock
        and re-enable auto-type detection.
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
         * Controls native keyboard behavior on mobile/touch devices.
        "Custom" (default) always uses this keyboard and suppresses
        the native one. "Native" defers to the native keyboard on
        phones and tablets. "Auto" uses custom on desktop, native
        on mobile.
         *
         * Default value is: "Custom"
         * @returns Value of property "mobileKeyboard"
         */
    getMobileKeyboard(): MobileKeyboard;

    /**
         * Sets a new value for property "mobileKeyboard".
         *
         * Controls native keyboard behavior on mobile/touch devices.
        "Custom" (default) always uses this keyboard and suppresses
        the native one. "Native" defers to the native keyboard on
        phones and tablets. "Auto" uses custom on desktop, native
        on mobile.
         *
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: "Custom"
         * @param [mobileKeyboard="Custom"] New value for property "mobileKeyboard"
         * @returns Reference to "this" in order to allow method chaining
         */
    setMobileKeyboard(mobileKeyboard: MobileKeyboard): this;

    // property: inputIds

    /**
         * Gets current value of property "inputIds".
         *
         * List of input control IDs to target. When set, attaches focus
        delegation to each resolved control so the keyboard auto-targets
        whichever input last received focus.
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
         *
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: []
         * @param [inputIds=[]] New value for property "inputIds"
         * @returns Reference to "this" in order to allow method chaining
         */
    setInputIds(inputIds: string[]): this;

    // association: targetInput

    /**
     * ID of the element which is the current target of the association "targetInput", or "null".
     *
     * The input control to type into (e.g. sap.m.Input, sap.m.TextArea).
     */
    getTargetInput(): string;

    /**
     * Sets the associated targetInput.
     *
     * The input control to type into (e.g. sap.m.Input, sap.m.TextArea).
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
     * Fired when a virtual key is pressed. Call preventDefault() to skip the default input action.
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
     * Fired when a virtual key is pressed. Call preventDefault() to skip the default input action.
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
    attachKeyPress<CustomDataType extends object>(
      data: CustomDataType,
      fn: (event: KioskKeyboard$KeyPressEvent, data: CustomDataType) => void,
      listener?: object,
    ): this;

    /**
     * Detaches event handler "fn" from the "keyPress" event of this "KioskKeyboard".
     *
     * Fired when a virtual key is pressed. Call preventDefault() to skip the default input action.
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
     * Fired when a virtual key is pressed. Call preventDefault() to skip the default input action.
     *
     * Listeners may prevent the default action of this event by calling the "preventDefault" method on the event object.
     * The return value of this method indicates whether the default action should be executed.
     *
     * @param parameters Parameters to pass along with the event
     * @param [mParameters.key] Fired when a virtual key is pressed. Call preventDefault() to skip the default input action.
     * @param [mParameters.shiftKey] Fired when a virtual key is pressed. Call preventDefault() to skip the default input action.
     *
     * @returns Whether or not to prevent the default action
     */
    fireKeyPress(parameters?: KioskKeyboard$KeyPressEventParameters): boolean;

    // event: layoutChange

    /**
     * Attaches event handler "fn" to the "layoutChange" event of this "KioskKeyboard".
     *
     * Fired when the active layout changes.
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
     * Fired when the active layout changes.
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
    attachLayoutChange<CustomDataType extends object>(
      data: CustomDataType,
      fn: (event: KioskKeyboard$LayoutChangeEvent, data: CustomDataType) => void,
      listener?: object,
    ): this;

    /**
     * Detaches event handler "fn" from the "layoutChange" event of this "KioskKeyboard".
     *
     * Fired when the active layout changes.
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
     * Fired when the active layout changes.
     *
     * @param parameters Parameters to pass along with the event
     * @param [mParameters.layout] Fired when the active layout changes.
     *
     * @returns Reference to "this" in order to allow method chaining
     */
    fireLayoutChange(parameters?: KioskKeyboard$LayoutChangeEventParameters): this;

    // event: afterOpen

    /**
     * Attaches event handler "fn" to the "afterOpen" event of this "KioskKeyboard".
     *
     * Fired after the docked keyboard has opened.
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
     * Fired after the docked keyboard has opened.
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
    attachAfterOpen<CustomDataType extends object>(
      data: CustomDataType,
      fn: (event: KioskKeyboard$AfterOpenEvent, data: CustomDataType) => void,
      listener?: object,
    ): this;

    /**
     * Detaches event handler "fn" from the "afterOpen" event of this "KioskKeyboard".
     *
     * Fired after the docked keyboard has opened.
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
     * Fired after the docked keyboard has opened.
     *
     * @param parameters Parameters to pass along with the event
     * @returns Reference to "this" in order to allow method chaining
     */
    fireAfterOpen(parameters?: KioskKeyboard$AfterOpenEventParameters): this;

    // event: afterClose

    /**
     * Attaches event handler "fn" to the "afterClose" event of this "KioskKeyboard".
     *
     * Fired after the docked keyboard has closed.
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
     * Fired after the docked keyboard has closed.
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
    attachAfterClose<CustomDataType extends object>(
      data: CustomDataType,
      fn: (event: KioskKeyboard$AfterCloseEvent, data: CustomDataType) => void,
      listener?: object,
    ): this;

    /**
     * Detaches event handler "fn" from the "afterClose" event of this "KioskKeyboard".
     *
     * Fired after the docked keyboard has closed.
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
     * Fired after the docked keyboard has closed.
     *
     * @param parameters Parameters to pass along with the event
     * @returns Reference to "this" in order to allow method chaining
     */
    fireAfterClose(parameters?: KioskKeyboard$AfterCloseEventParameters): this;
  }

  /**
   * Interface describing the parameters of KioskKeyboard's 'keyPress' event.
   * Fired when a virtual key is pressed. Call preventDefault() to skip the default input action.
   */
  export interface KioskKeyboard$KeyPressEventParameters {
    key?: string;
    shiftKey?: boolean;
  }

  /**
   * Interface describing the parameters of KioskKeyboard's 'layoutChange' event.
   * Fired when the active layout changes.
   */
  export interface KioskKeyboard$LayoutChangeEventParameters {
    layout?: string;
  }

  /**
   * Interface describing the parameters of KioskKeyboard's 'afterOpen' event.
   * Fired after the docked keyboard has opened.
   */
  // eslint-disable-next-line
  export interface KioskKeyboard$AfterOpenEventParameters {}

  /**
   * Interface describing the parameters of KioskKeyboard's 'afterClose' event.
   * Fired after the docked keyboard has closed.
   */
  // eslint-disable-next-line
  export interface KioskKeyboard$AfterCloseEventParameters {}

  /**
   * Type describing the KioskKeyboard's 'keyPress' event.
   * Fired when a virtual key is pressed. Call preventDefault() to skip the default input action.
   */
  export type KioskKeyboard$KeyPressEvent = Event<KioskKeyboard$KeyPressEventParameters>;

  /**
   * Type describing the KioskKeyboard's 'layoutChange' event.
   * Fired when the active layout changes.
   */
  export type KioskKeyboard$LayoutChangeEvent = Event<KioskKeyboard$LayoutChangeEventParameters>;

  /**
   * Type describing the KioskKeyboard's 'afterOpen' event.
   * Fired after the docked keyboard has opened.
   */
  export type KioskKeyboard$AfterOpenEvent = Event<KioskKeyboard$AfterOpenEventParameters>;

  /**
   * Type describing the KioskKeyboard's 'afterClose' event.
   * Fired after the docked keyboard has closed.
   */
  export type KioskKeyboard$AfterCloseEvent = Event<KioskKeyboard$AfterCloseEventParameters>;
}
