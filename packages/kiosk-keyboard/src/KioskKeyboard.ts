import Control from "sap/ui/core/Control";
import Element from "sap/ui/core/Element";
import ManagedObject from "sap/ui/base/ManagedObject";
import type { LayoutDefinition, KeyDefinition } from "./types";
import layouts from "./layouts/index";
import KioskKeyboardRenderer from "./KioskKeyboardRenderer";
import "./library"; // side-effect: ensures Lib.init() runs

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
 */
export default class KioskKeyboard extends Control {
  // The following three lines were generated and should remain as-is to make TypeScript aware of the constructor signatures
  constructor(idOrSettings?: string | $KioskKeyboardSettings);
  constructor(id?: string, settings?: $KioskKeyboardSettings);
  // oxlint-disable-next-line no-useless-constructor -- required by @ui5/ts-interface-generator overloads
  constructor(id?: string, settings?: $KioskKeyboardSettings) {
    super(id, settings);
  }

  // ── ManagedObject field trap: declare strips these from Babel output ──
  declare private _shiftActive: boolean;
  declare private _capsLock: boolean;
  declare private _lastFocusedKeyId: string | null;
  declare private _open: boolean;
  declare private _closeTimer: ReturnType<typeof setTimeout> | null;
  declare private _boundFocusIn: (e: FocusEvent) => void;
  declare private _boundFocusOut: (e: FocusEvent) => void;
  declare private _autoShowActive: boolean;
  declare private _inputFocusDelegation: { onfocusin: () => void };
  declare private _registeredInputIds: Set<string>;
  declare private _keyHighlightDelegation: {
    onkeydown: (event: KeyboardEvent) => void;
    onkeyup: (event: KeyboardEvent) => void;
  };
  declare private _highlightTargetId: string | null;
  declare private _pressedKeyEl: HTMLElement | null;

  static readonly metadata = {
    library: "ui5.kiosk" as const,
    properties: {
      /** Active layout name. Only effective when keyboardType is "full". */
      layout: {
        type: "string",
        defaultValue: "qwerty",
        group: "Behavior",
      },
      /**
       * Keyboard display type.
       * "full" renders the active layout. "numeric" and "numpad" render
       * compact number-oriented layouts regardless of the layout property.
       */
      keyboardType: {
        type: "ui5.kiosk.KeyboardType",
        defaultValue: "Full",
        group: "Appearance",
      },
      /** Whether the keyboard is interactive. */
      enabled: {
        type: "boolean",
        defaultValue: true,
        group: "Behavior",
      },
      /** Accessible label for the keyboard group. */
      ariaLabel: {
        type: "string",
        defaultValue: "Virtual Keyboard",
        group: "Accessibility",
      },
      /**
       * When true, the keyboard anchors to the bottom of the viewport
       * and slides in/out. Use show()/close() to control visibility
       * manually, or set autoShow to true for automatic behavior.
       */
      docked: {
        type: "boolean",
        defaultValue: false,
        group: "Behavior",
      },
      /**
       * When true, the docked keyboard automatically opens when any
       * `<input>` or `<textarea>` receives focus, and closes when
       * focus leaves. Requires `docked="true"`.
       */
      autoShow: {
        type: "boolean",
        defaultValue: false,
        group: "Behavior",
      },
      /**
       * List of input control IDs to target. When set, attaches focus
       * delegation to each resolved control so the keyboard auto-targets
       * whichever input last received focus.
       */
      inputIds: {
        type: "string[]",
        defaultValue: [],
        group: "Data",
      },
    },
    associations: {
      /** The input control to type into (e.g. sap.m.Input, sap.m.TextArea). */
      targetInput: { type: "sap.ui.core.Control", multiple: false },
    },
    events: {
      /** Fired when a virtual key is pressed. Call preventDefault() to skip the default input action. */
      keyPress: {
        allowPreventDefault: true,
        parameters: {
          key: { type: "string" },
          shiftKey: { type: "boolean" },
        },
      },
      /** Fired when the active layout changes. */
      layoutChange: {
        parameters: {
          layout: { type: "string" },
        },
      },
      /** Fired after the docked keyboard has opened. */
      afterOpen: {},
      /** Fired after the docked keyboard has closed. */
      afterClose: {},
    },
  };

  static readonly renderer = KioskKeyboardRenderer;

  init(): void {
    this._shiftActive = false;
    this._capsLock = false;
    this._lastFocusedKeyId = null;
    this._open = false;
    this._closeTimer = null;
    this._autoShowActive = false;
    this._boundFocusIn = this._onDocumentFocusIn.bind(this);
    this._boundFocusOut = this._onDocumentFocusOut.bind(this);
    this._registeredInputIds = new Set();
    this._inputFocusDelegation = {
      onfocusin: () => {
        const delegateTarget = Element.getActiveElement();
        if (delegateTarget instanceof Control) {
          this.setTargetInput(delegateTarget);
        }
      },
    };
    this._keyHighlightDelegation = {
      onkeydown: (event: KeyboardEvent) => this._highlightKey(event.key, true),
      onkeyup: (event: KeyboardEvent) => this._highlightKey(event.key, false),
    };
    this._highlightTargetId = null;
    this._pressedKeyEl = null;
  }

  onAfterRendering(): void {
    if (this.getDocked()) {
      // Sync the open/closed CSS class (renderer sets initial state,
      // but show()/close() bypass re-render for smooth animation)
      this.getDomRef()?.classList.toggle("ui5KioskKeyboard--closed", !this._open);

      // Activate auto-show listeners if the property was set declaratively
      // (e.g. via XML) before the control was rendered.
      if (this.getAutoShow() && !this._autoShowActive) {
        this.enableAutoShow();
      }
    }

    this._setupInputIds();
  }

  exit(): void {
    this.disableAutoShow();
    this._teardownInputIds();
    this._removeHighlightDelegation();
    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
    }
  }

  // ──────────────────────────────────────────────
  // Public API — Target & Docked Mode
  // ──────────────────────────────────────────────

  /**
   * Sets the target input association without triggering a re-render,
   * since the association does not affect the keyboard's visual output.
   * Also moves the physical keyboard highlight delegation to the new target.
   */
  setTargetInput(target: string | Control): this {
    // Remove highlight delegation from previous target
    this._removeHighlightDelegation();

    this.setAssociation("targetInput", target, true);

    // Add highlight delegation to new target
    const newId = this.getTargetInput();
    if (newId) {
      const next = Element.getElementById(newId);
      if (next) {
        next.addEventDelegate(this._keyHighlightDelegation);
        this._highlightTargetId = newId;
      }
    }
    return this;
  }

  /**
   * Custom setter for autoShow — activates or deactivates the
   * auto-show document listeners via enableAutoShow/disableAutoShow.
   */
  setAutoShow(bAutoShow: boolean): this {
    this.setProperty("autoShow", bAutoShow);
    if (bAutoShow) {
      this.enableAutoShow();
    } else {
      this.disableAutoShow();
    }
    return this;
  }

  /**
   * Custom setter for docked — manages CSS on the existing DOM
   * rather than re-rendering (which would disrupt transitions).
   */
  setDocked(bDocked: boolean): this {
    if (!this.getDocked() && bDocked) {
      this._open = false;
    }
    return this.setProperty("docked", bDocked);
  }

  /** Opens the keyboard (docked mode). Slides it into view. */
  show(): this {
    if (this._open) return this;
    this._open = true;
    const dom = this.getDomRef();
    if (dom) {
      dom.classList.remove("ui5KioskKeyboard--closed");
    }
    this.fireEvent("afterOpen");
    return this;
  }

  /** Closes the keyboard (docked mode). Slides it out of view. */
  close(): this {
    if (!this._open) return this;
    this._open = false;
    const dom = this.getDomRef();
    if (dom) {
      dom.classList.add("ui5KioskKeyboard--closed");
    }
    this.fireEvent("afterClose");
    return this;
  }

  /** Whether the docked keyboard is currently open. */
  isOpen(): boolean {
    return this._open;
  }

  /**
   * Enables auto-show: the keyboard automatically opens when any
   * `<input>` or `<textarea>` on the page receives focus, setting it
   * as the target. Closes when focus moves away from all inputs.
   */
  enableAutoShow(): this {
    if (this._autoShowActive) return this;
    this._autoShowActive = true;
    document.addEventListener("focusin", this._boundFocusIn, true);
    document.addEventListener("focusout", this._boundFocusOut, true);
    return this;
  }

  /** Disables auto-show listeners. */
  disableAutoShow(): this {
    if (!this._autoShowActive) return this;
    this._autoShowActive = false;
    document.removeEventListener("focusin", this._boundFocusIn, true);
    document.removeEventListener("focusout", this._boundFocusOut, true);
    return this;
  }

  // ──────────────────────────────────────────────
  // Private — inputIds delegation
  // ──────────────────────────────────────────────

  private _setupInputIds(): void {
    const ids = this.getInputIds();
    if (!ids?.length) return;

    for (const inputId of ids) {
      if (this._registeredInputIds.has(inputId)) continue;
      const control = this._findControlById(inputId);
      if (!control) continue;
      control.addEventDelegate(this._inputFocusDelegation);
      this._registeredInputIds.add(inputId);
    }
  }

  private _teardownInputIds(): void {
    for (const inputId of this._registeredInputIds) {
      const control = this._findControlById(inputId);
      if (control) control.removeEventDelegate(this._inputFocusDelegation);
    }
    this._registeredInputIds.clear();
  }

  private _findControlById(targetId: string): Control | null {
    // Try global first
    const global = Element.getElementById(targetId);
    if (global instanceof Control) return global;

    // Walk up to find parent View for view-local IDs
    for (let parent: ManagedObject | null = this.getParent(); parent; parent = parent.getParent()) {
      if (typeof (parent as unknown as Record<string, unknown>).byId === "function") {
        const found = (parent as unknown as { byId: (id: string) => Element | undefined }).byId(targetId);
        if (found instanceof Control) return found;
      }
    }
    return null;
  }

  // ──────────────────────────────────────────────
  // Focus Management
  // ──────────────────────────────────────────────

  getFocusDomRef(): globalThis.Element | null {
    return (
      (this._lastFocusedKeyId && document.getElementById(this._lastFocusedKeyId)) ||
      this.getDomRef()?.querySelector(".ui5KioskKey") ||
      null
    );
  }

  getFocusInfo(): object {
    return { lastFocusedKeyId: this._lastFocusedKeyId };
  }

  applyFocusInfo(oFocusInfo: { preventScroll?: boolean; lastFocusedKeyId?: string }): this {
    if (oFocusInfo.lastFocusedKeyId) {
      const el = document.getElementById(oFocusInfo.lastFocusedKeyId);
      if (el) {
        el.setAttribute("tabindex", "0");
        el.focus();
        return this;
      }
    }
    return this;
  }

  // ──────────────────────────────────────────────
  // Accessibility
  // ──────────────────────────────────────────────

  getAccessibilityInfo(): {
    role: string;
    type: string;
    description: string;
    focusable: boolean;
    enabled: boolean;
  } {
    return {
      role: "group",
      type: "Virtual Keyboard",
      description: this.getAriaLabel(),
      focusable: true,
      enabled: this.getEnabled(),
    };
  }

  // ──────────────────────────────────────────────
  // Public API (used by renderer)
  // ──────────────────────────────────────────────

  isShiftActive(): boolean {
    return this._shiftActive || this._capsLock;
  }

  isCapsLock(): boolean {
    return this._capsLock;
  }

  getResolvedLayout(): LayoutDefinition {
    const kbType = this.getKeyboardType();
    if (kbType === "Numpad") return layouts.numpad;
    if (kbType === "Numeric") return layouts.numeric;
    return layouts[this.getLayout()] ?? layouts.qwerty;
  }

  /** The display label for a key (may be empty for icon-only keys). */
  getKeyLabel(key: KeyDefinition): string {
    const shift = this.isShiftActive();
    if (shift && key.shiftLabel) return key.shiftLabel;
    const base = key.label ?? key.value;
    return shift && key.value.length === 1 ? base.toUpperCase() : base;
  }

  /** Human-readable map for special key values used in ARIA labels. */
  private static readonly _SPECIAL_KEY_LABELS: Record<string, string> = {
    "{backspace}": "Backspace",
    "{enter}": "Enter",
    "{shift}": "Shift",
    " ": "Space",
  };

  /**
   * Accessible label for a key — always non-empty.
   * For icon-only keys (label=""), resolves to a human-readable name.
   */
  getKeyAriaLabel(key: KeyDefinition): string {
    const display = this.getKeyLabel(key);
    if (display) return display;

    // Icon-only key with empty display label — resolve from value
    return KioskKeyboard._SPECIAL_KEY_LABELS[key.value] ?? key.value;
  }

  // ──────────────────────────────────────────────
  // UI5 Event Delegation
  // ──────────────────────────────────────────────

  /**
   * Prevents focus from leaving the target input when a key is pressed.
   *
   * Uses UI5's unified saptouchstart (fires for both mouse and touch)
   * instead of raw pointerdown. preventDefault() on the underlying
   * mousedown/touchstart prevents focus transfer to the key div without
   * suppressing the click/tap chain — unlike pointerdown's preventDefault()
   * which suppresses all compatibility mouse events per the Pointer Events spec.
   */
  onsaptouchstart(event: Event): void {
    const el = (event.target as HTMLElement).closest(".ui5KioskKey") as HTMLElement | null;
    if (el) {
      event.preventDefault();
      this._pressedKeyEl = el;
      el.classList.add("ui5KioskKey--pressed");
    }
  }

  /**
   * Activates the key on touch/mouse release.
   *
   * Only fires if the release target matches the press target (basic
   * tap detection — drag-away cancels). Replaces ontap which couldn't
   * fire because pointerdown's preventDefault() suppressed the click
   * event that jQuery's tap plugin depends on.
   */
  onsaptouchend(event: Event): void {
    const pressed = this._pressedKeyEl;
    this._pressedKeyEl = null;
    if (pressed) {
      pressed.classList.remove("ui5KioskKey--pressed");
    }

    if (!this.getEnabled() || !pressed) return;

    const el = (event.target as HTMLElement).closest(".ui5KioskKey") as HTMLElement | null;
    if (el !== pressed) return;

    const keyValue = pressed.dataset.key;
    if (!keyValue) return;

    this._lastFocusedKeyId = pressed.id;
    this._handleKeyAction(keyValue, pressed);
  }

  onkeydown(event: KeyboardEvent): void {
    if (!this.getEnabled()) return;
    // Don't intercept browser shortcuts (Alt+Arrow = history, Meta+Arrow = OS)
    if (event.altKey || event.metaKey) return;

    const target = event.target as HTMLElement;
    if (!target.classList.contains("ui5KioskKey")) return;

    switch (event.key) {
      case "Enter":
      case " ": {
        event.preventDefault();
        const keyValue = target.dataset.key;
        if (keyValue) this._handleKeyAction(keyValue, target);
        break;
      }
      case "ArrowLeft":
        event.preventDefault();
        this._moveFocus(target, 0, -1);
        break;
      case "ArrowRight":
        event.preventDefault();
        this._moveFocus(target, 0, 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        this._moveFocus(target, -1, 0);
        break;
      case "ArrowDown":
        event.preventDefault();
        this._moveFocus(target, 1, 0);
        break;
      case "Home": {
        event.preventDefault();
        const row = target.closest(".ui5KioskRow");
        const first = row?.querySelector(".ui5KioskKey") as HTMLElement | null;
        if (first && first !== target) this._transferFocus(target, first);
        break;
      }
      case "End": {
        event.preventDefault();
        const row = target.closest(".ui5KioskRow");
        const keys = row?.querySelectorAll(".ui5KioskKey");
        const last = keys?.[keys.length - 1] as HTMLElement | undefined;
        if (last && last !== target) this._transferFocus(target, last);
        break;
      }
    }
  }

  // ──────────────────────────────────────────────
  // Private — Auto-show
  // ──────────────────────────────────────────────

  private _onDocumentFocusIn(event: FocusEvent): void {
    if (!this.getDocked() || !this.getEnabled()) return;

    const target = event.target as HTMLElement;

    // Ignore focus on the keyboard itself
    const myDom = this.getDomRef();
    if (myDom && myDom.contains(target)) return;

    // Check if focus went to an input/textarea
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      // Cancel any pending close
      if (this._closeTimer) {
        clearTimeout(this._closeTimer);
        this._closeTimer = null;
      }

      // Resolve the UI5 control that owns this DOM element
      const ui5Control = Element.closestTo(target);
      if (ui5Control instanceof Control) {
        this.setTargetInput(ui5Control);
      }
      this.show();
    }
  }

  private _onDocumentFocusOut(_event: FocusEvent): void {
    if (!this.getDocked() || !this._open || !this.getEnabled()) return;

    // Delay close — focus might be moving to another input or the keyboard
    this._closeTimer = setTimeout(() => {
      this._closeTimer = null;
      const active = document.activeElement as HTMLElement | null;

      // Don't close if focus is on the keyboard
      const myDom = this.getDomRef();
      if (myDom && active && myDom.contains(active)) return;

      // Don't close if focus moved to another input
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;

      this.close();
    }, 200);
  }

  // ──────────────────────────────────────────────
  // Private — Pointer & Key Actions
  // ──────────────────────────────────────────────

  private _handleKeyAction(keyValue: string, el: HTMLElement): void {
    const shift = this.isShiftActive();

    if (keyValue === "{shift}") {
      this._toggleShift();
      return;
    }

    if (keyValue === "{backspace}") {
      if (this.fireEvent("keyPress", { key: "Backspace", shiftKey: shift }, true)) {
        this._handleBackspace();
      }
      return;
    }

    if (keyValue === "{enter}") {
      if (this.fireEvent("keyPress", { key: "Enter", shiftKey: shift }, true)) {
        this._handleEnter();
      }
      return;
    }

    if (keyValue.startsWith("{layout:")) {
      if (this.getKeyboardType() === "Full") {
        const name = keyValue.slice(8, -1);
        this.setLayout(name);
        this.fireEvent("layoutChange", { layout: name });
      }
      return;
    }

    // Regular character — resolve shift value
    let effective = keyValue;
    if (shift) {
      const shiftValue = el.dataset.shiftValue;
      if (shiftValue) {
        effective = shiftValue;
      } else if (keyValue.length === 1) {
        effective = keyValue.toUpperCase();
      }
    }

    if (this.fireEvent("keyPress", { key: effective, shiftKey: shift }, true)) {
      this._insertText(effective);
    }

    // Auto-release shift (not caps lock)
    if (this._shiftActive && !this._capsLock) {
      this._shiftActive = false;
      this.invalidate();
    }
  }

  private _toggleShift(): void {
    if (this._capsLock) {
      this._capsLock = false;
      this._shiftActive = false;
    } else if (this._shiftActive) {
      this._capsLock = true;
    } else {
      this._shiftActive = true;
    }
    this.invalidate();
  }

  /**
   * Returns the target input's inner DOM element, ensuring it is focused
   * with the cursor at the end of its value if it wasn't already active.
   *
   * Real virtual keyboards always operate at the cursor position. When the
   * target input hasn't been focused yet (e.g. set programmatically via
   * `setTargetInput`), `selectionStart` defaults to 0. Without this guard
   * every operation would happen at the beginning instead of the end.
   */
  private _getTargetDomRef(): HTMLInputElement | HTMLTextAreaElement | null {
    const element = this._getTargetElement();
    if (!element) return null;

    const dom = element.getFocusDomRef();
    if (!(dom instanceof HTMLInputElement || dom instanceof HTMLTextAreaElement)) {
      return null;
    }

    // Ensure cursor is positioned — if the input isn't the active element,
    // focus it and place the cursor at the end of the existing value.
    if (document.activeElement !== dom) {
      dom.focus();
      dom.setSelectionRange(dom.value.length, dom.value.length);
    }

    return dom;
  }

  private _insertText(text: string): void {
    const dom = this._getTargetDomRef();
    if (!dom) return;

    const start = dom.selectionStart ?? dom.value.length;
    const end = dom.selectionEnd ?? start;
    const newValue = dom.value.slice(0, start) + text + dom.value.slice(end);
    const newPos = start + text.length;

    this._setTargetValue(newValue);
    dom.setSelectionRange(newPos, newPos);
  }

  private _handleBackspace(): void {
    const dom = this._getTargetDomRef();
    if (!dom) return;

    const start = dom.selectionStart ?? dom.value.length;
    const end = dom.selectionEnd ?? start;

    let newValue: string;
    let newPos: number;

    if (start !== end) {
      newValue = dom.value.slice(0, start) + dom.value.slice(end);
      newPos = start;
    } else if (start > 0) {
      newValue = dom.value.slice(0, start - 1) + dom.value.slice(start);
      newPos = start - 1;
    } else {
      return;
    }

    this._setTargetValue(newValue);
    dom.setSelectionRange(newPos, newPos);
  }

  private _handleEnter(): void {
    const dom = this._getTargetDomRef();
    if (dom instanceof HTMLTextAreaElement) {
      this._insertText("\n");
      return;
    }
    // Single-line input: fire change event (matches physical Enter behavior)
    if (dom instanceof HTMLInputElement) {
      this._fireTargetChange(dom.value);
    }
  }

  /**
   * Resolve the target input association to a UI5 Element.
   * Uses Element registry (the standard UI5 association resolution pattern).
   */
  private _getTargetElement(): Element | null {
    const id = this.getTargetInput();
    if (!id) return null;
    return Element.getElementById(id) ?? null;
  }

  private _fireTargetChange(value: string): void {
    const element = this._getTargetElement();
    if (!element) return;

    if (element.getMetadata().hasEvent("change")) {
      element.fireEvent("change", { value });
    }
  }

  private _setTargetValue(newValue: string): void {
    const element = this._getTargetElement();
    if (!element) return;

    const metadata = element.getMetadata();
    if (metadata.hasProperty("value")) {
      element.setProperty("value", newValue);
    }
    if (metadata.hasEvent("liveChange")) {
      element.fireEvent("liveChange", { value: newValue, newValue });
    }
  }

  private _moveFocus(current: HTMLElement, dRow: number, dCol: number): void {
    const match = current.id.match(/-key-(\d+)-(\d+)$/);
    if (!match) return;

    const row = Number.parseInt(match[1], 10) + dRow;
    const col = Number.parseInt(match[2], 10) + dCol;
    const sId = this.getId();

    // Try exact coordinate first
    let next: HTMLElement | null = document.getElementById(`${sId}-key-${row}-${col}`);

    if (!next) {
      if (dCol !== 0 && dRow === 0) {
        // Horizontal wrapping: move to adjacent row
        const currentRow = current.closest(".ui5KioskRow");
        const adjacentRow = dCol > 0 ? currentRow?.nextElementSibling : currentRow?.previousElementSibling;
        if (adjacentRow) {
          const keys = adjacentRow.querySelectorAll(".ui5KioskKey");
          next = (dCol > 0 ? keys[0] : keys[keys.length - 1]) as HTMLElement | null;
        }
      } else if (dRow !== 0) {
        // Vertical fallback: clamp to last key in target row
        const targetRow = this.getDomRef()?.querySelectorAll(".ui5KioskRow")[row];
        if (targetRow) {
          const keys = targetRow.querySelectorAll(".ui5KioskKey");
          next = keys[Math.min(col, keys.length - 1)] as HTMLElement | null;
        }
      }
    }

    if (next) {
      this._transferFocus(current, next);
    }
  }

  private _transferFocus(current: HTMLElement, next: HTMLElement): void {
    current.setAttribute("tabindex", "-1");
    next.setAttribute("tabindex", "0");
    next.focus();
    this._lastFocusedKeyId = next.id;
  }

  // ──────────────────────────────────────────────
  // Private — Physical keyboard highlighting
  // ──────────────────────────────────────────────

  private _highlightKey(key: string, add: boolean): void {
    const dom = this.getDomRef();
    if (!dom) return;

    const el =
      dom.querySelector(`[data-key="${CSS.escape(key)}"]`) ??
      (key.length === 1 ? dom.querySelector(`[data-key="${CSS.escape(key.toLowerCase())}"]`) : null);
    el?.classList.toggle("ui5KioskKey--highlight", add);
  }

  private _removeHighlightDelegation(): void {
    if (!this._highlightTargetId) return;
    const prev = Element.getElementById(this._highlightTargetId);
    if (prev) prev.removeEventDelegate(this._keyHighlightDelegation);
    this._highlightTargetId = null;
  }
}
