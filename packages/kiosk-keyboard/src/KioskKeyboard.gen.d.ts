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
        "full" renders the active layout. "numeric" and "numpad" render
        compact number-oriented layouts regardless of the layout property.
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
        Full and Numpad keyboard types. Has no effect when keyboardType
        is set explicitly.
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
     * Active layout name. Only effective when keyboardType is "full".
     */
    getLayout(): string;

    /**
     * Active layout name. Only effective when keyboardType is "full".
     */
    setLayout(layout: string): this;

    // property: keyboardType

    /**
         * Keyboard display type.
        "full" renders the active layout. "numeric" and "numpad" render
        compact number-oriented layouts regardless of the layout property.
         */
    getKeyboardType(): KeyboardType;

    /**
         * Keyboard display type.
        "full" renders the active layout. "numeric" and "numpad" render
        compact number-oriented layouts regardless of the layout property.
         */
    setKeyboardType(keyboardType: KeyboardType): this;

    // property: enabled

    /**
     * Whether the keyboard is interactive.
     */
    getEnabled(): boolean;

    /**
     * Whether the keyboard is interactive.
     */
    setEnabled(enabled: boolean): this;

    // property: ariaLabel

    /**
     * Accessible label for the keyboard group.
     */
    getAriaLabel(): string;

    /**
     * Accessible label for the keyboard group.
     */
    setAriaLabel(ariaLabel: string): this;

    // property: docked

    /**
         * When true, the keyboard anchors to the bottom of the viewport
        and slides in/out. Use show()/close() to control visibility
        manually, or set autoShow to true for automatic behavior.
         */
    getDocked(): boolean;

    /**
         * When true, the keyboard anchors to the bottom of the viewport
        and slides in/out. Use show()/close() to control visibility
        manually, or set autoShow to true for automatic behavior.
         */
    setDocked(docked: boolean): this;

    // property: autoShow

    /**
         * When true, the docked keyboard automatically opens when any
        `<input>` or `<textarea>` receives focus, and closes when
        focus leaves. Requires `docked="true"`.
         */
    getAutoShow(): boolean;

    /**
         * When true, the docked keyboard automatically opens when any
        `<input>` or `<textarea>` receives focus, and closes when
        focus leaves. Requires `docked="true"`.
         */
    setAutoShow(autoShow: boolean): this;

    // property: autoType

    /**
         * When true and autoShow is active, the keyboard inspects the
        focused input's type metadata and automatically switches between
        Full and Numpad keyboard types. Has no effect when keyboardType
        is set explicitly.
         */
    getAutoType(): boolean;

    /**
         * When true and autoShow is active, the keyboard inspects the
        focused input's type metadata and automatically switches between
        Full and Numpad keyboard types. Has no effect when keyboardType
        is set explicitly.
         */
    setAutoType(autoType: boolean): this;

    // property: mobileKeyboard

    /**
         * Controls native keyboard behavior on mobile/touch devices.
        "Custom" (default) always uses this keyboard and suppresses
        the native one. "Native" defers to the native keyboard on
        phones and tablets. "Auto" uses custom on desktop, native
        on mobile.
         */
    getMobileKeyboard(): MobileKeyboard;

    /**
         * Controls native keyboard behavior on mobile/touch devices.
        "Custom" (default) always uses this keyboard and suppresses
        the native one. "Native" defers to the native keyboard on
        phones and tablets. "Auto" uses custom on desktop, native
        on mobile.
         */
    setMobileKeyboard(mobileKeyboard: MobileKeyboard): this;

    // property: inputIds

    /**
         * List of input control IDs to target. When set, attaches focus
        delegation to each resolved control so the keyboard auto-targets
        whichever input last received focus.
         */
    getInputIds(): string[];

    /**
         * List of input control IDs to target. When set, attaches focus
        delegation to each resolved control so the keyboard auto-targets
        whichever input last received focus.
         */
    setInputIds(inputIds: string[]): this;

    // association: targetInput

    /**
     * The input control to type into (e.g. sap.m.Input, sap.m.TextArea).
     */
    getTargetInput(): string;

    /**
     * The input control to type into (e.g. sap.m.Input, sap.m.TextArea).
     */
    setTargetInput(targetInput?: string | Control): this;

    // event: keyPress

    /**
     * Fired when a virtual key is pressed. Call preventDefault() to skip the default input action.
     */
    attachKeyPress(fn: (event: KioskKeyboard$KeyPressEvent) => void, listener?: object): this;

    /**
     * Fired when a virtual key is pressed. Call preventDefault() to skip the default input action.
     */
    attachKeyPress<CustomDataType extends object>(
      data: CustomDataType,
      fn: (event: KioskKeyboard$KeyPressEvent, data: CustomDataType) => void,
      listener?: object,
    ): this;

    /**
     * Fired when a virtual key is pressed. Call preventDefault() to skip the default input action.
     */
    detachKeyPress(fn: (event: KioskKeyboard$KeyPressEvent) => void, listener?: object): this;

    /**
     * Fired when a virtual key is pressed. Call preventDefault() to skip the default input action.
     */
    fireKeyPress(parameters?: KioskKeyboard$KeyPressEventParameters): boolean;

    // event: layoutChange

    /**
     * Fired when the active layout changes.
     */
    attachLayoutChange(fn: (event: KioskKeyboard$LayoutChangeEvent) => void, listener?: object): this;

    /**
     * Fired when the active layout changes.
     */
    attachLayoutChange<CustomDataType extends object>(
      data: CustomDataType,
      fn: (event: KioskKeyboard$LayoutChangeEvent, data: CustomDataType) => void,
      listener?: object,
    ): this;

    /**
     * Fired when the active layout changes.
     */
    detachLayoutChange(fn: (event: KioskKeyboard$LayoutChangeEvent) => void, listener?: object): this;

    /**
     * Fired when the active layout changes.
     */
    fireLayoutChange(parameters?: KioskKeyboard$LayoutChangeEventParameters): this;

    // event: afterOpen

    /**
     * Fired after the docked keyboard has opened.
     */
    attachAfterOpen(fn: (event: KioskKeyboard$AfterOpenEvent) => void, listener?: object): this;

    /**
     * Fired after the docked keyboard has opened.
     */
    attachAfterOpen<CustomDataType extends object>(
      data: CustomDataType,
      fn: (event: KioskKeyboard$AfterOpenEvent, data: CustomDataType) => void,
      listener?: object,
    ): this;

    /**
     * Fired after the docked keyboard has opened.
     */
    detachAfterOpen(fn: (event: KioskKeyboard$AfterOpenEvent) => void, listener?: object): this;

    /**
     * Fired after the docked keyboard has opened.
     */
    fireAfterOpen(parameters?: KioskKeyboard$AfterOpenEventParameters): this;

    // event: afterClose

    /**
     * Fired after the docked keyboard has closed.
     */
    attachAfterClose(fn: (event: KioskKeyboard$AfterCloseEvent) => void, listener?: object): this;

    /**
     * Fired after the docked keyboard has closed.
     */
    attachAfterClose<CustomDataType extends object>(
      data: CustomDataType,
      fn: (event: KioskKeyboard$AfterCloseEvent, data: CustomDataType) => void,
      listener?: object,
    ): this;

    /**
     * Fired after the docked keyboard has closed.
     */
    detachAfterClose(fn: (event: KioskKeyboard$AfterCloseEvent) => void, listener?: object): this;

    /**
     * Fired after the docked keyboard has closed.
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
