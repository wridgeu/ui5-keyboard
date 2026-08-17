import Element from "sap/ui/core/Element";
import { KIOSK_KEYBOARD_DOM } from "./dom-contract";
import { NativeDispatchableKeyNames } from "../library";
import type { ShiftState } from "./shift-state";

/** Maps non-derivable KeyboardEvent.key names to special-key data-key values. */
const KEY_TO_DATA_KEY = new Map<string, string>([
  ["Shift", "{shift}"],
  ["Backspace", "{backspace}"],
  ["Enter", "{enter}"],
  ["Delete", "{backspace}"], // virtual keyboard has no separate Delete - highlight Backspace
]);

/** Native-dispatchable keys (F1-F12, arrows, Home/End/PgUp/PgDn). */
const NATIVE_DISPATCHABLE = new Set<string>(NativeDispatchableKeyNames);

/**
 * Resolves a KeyboardEvent.key name to its data-key attribute value.
 * Native-dispatchable keys are derived dynamically from the allowlist.
 */
function resolveDataKey(key: string): string | undefined {
  return KEY_TO_DATA_KEY.get(key) ?? (NATIVE_DISPATCHABLE.has(key) ? `{fkey:${key}}` : undefined);
}

interface PhysicalKeyHighlightHost {
  getDomRef(): globalThis.Element | null;
}

/**
 * The keydown/keyup event a UI5 event delegate receives: the framework's own
 * fixed event, carrying the native one it was built from in `originalEvent`.
 */
interface DelegatedKeyboardEvent extends KeyboardEvent {
  readonly originalEvent?: KeyboardEvent;
}

/**
 * Mirrors the physical keyboard onto the on-screen keys: while a target input
 * is active, a UI5 event delegate on that input highlights the matching virtual
 * key on keydown/keyup and syncs shift/caps from the hardware keyboard.
 *
 * Owns the delegate object and the current target id so the control's
 * `_setActiveTarget`/`exit` only `attach`/`detach`.
 */
export default class PhysicalKeyHighlight {
  private readonly _delegation: {
    onkeydown: (event: DelegatedKeyboardEvent) => void;
    onkeyup: (event: DelegatedKeyboardEvent) => void;
  };
  private _targetId: string | null = null;

  constructor(
    private readonly _host: PhysicalKeyHighlightHost,
    private readonly _shiftState: ShiftState,
  ) {
    this._delegation = {
      onkeydown: (event: DelegatedKeyboardEvent) => this._onPhysicalKey(event, true),
      onkeyup: (event: DelegatedKeyboardEvent) => this._onPhysicalKey(event, false),
    };
  }

  /** Attach the highlight delegate to a freshly resolved target control. */
  attach(control: Element, controlId: string): void {
    control.addEventDelegate(this._delegation);
    this._targetId = controlId;
  }

  /** Detach the highlight delegate from the current target (if any). */
  detach(): void {
    if (!this._targetId) return;
    const prev = Element.getElementById(this._targetId);
    if (prev) prev.removeEventDelegate(this._delegation);
    this._targetId = null;
  }

  /**
   * Handles a physical keyboard event on the target input.
   * Syncs shift/capslock state from the physical keyboard and
   * delegates to visual key highlighting.
   */
  private _onPhysicalKey(event: DelegatedKeyboardEvent, down: boolean): void {
    this._highlightKey(event.key, down);

    // UI5 event delegation wraps the native event; unwrap to access
    // getModifierState which is not forwarded to the wrapper. The optional call
    // covers a wrapper that reached here without one.
    const native = event.originalEvent ?? event;
    const capsLock = native.getModifierState?.("CapsLock") ?? false;
    this._shiftState.syncFromPhysical(native.shiftKey, capsLock);
  }

  private _highlightKey(key: string, add: boolean): void {
    const dom = this._host.getDomRef();
    if (!dom) return;

    if (!add) {
      // Clear all highlights on any keyup. When Shift releases before the
      // character key, keyup reports the unshifted value (e.g. "2" not "@"),
      // so a targeted removal would miss the shifted key's highlight.
      dom
        .querySelectorAll<HTMLElement>(`.${KIOSK_KEYBOARD_DOM.classes.keyHighlight}`)
        .forEach((el) => el.classList.remove(KIOSK_KEYBOARD_DOM.classes.keyHighlight));
      return;
    }

    const mapped = resolveDataKey(key);
    const el =
      dom.querySelector(KIOSK_KEYBOARD_DOM.selectors.keyByValue(mapped ?? key)) ??
      (key.length === 1 ? dom.querySelector(KIOSK_KEYBOARD_DOM.selectors.keyByValue(key.toLowerCase())) : null) ??
      dom.querySelector(KIOSK_KEYBOARD_DOM.selectors.keyByShiftValue(key));
    el?.classList.toggle(KIOSK_KEYBOARD_DOM.classes.keyHighlight, add);
  }
}
