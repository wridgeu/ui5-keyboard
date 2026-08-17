import Log from "sap/base/Log";
import { FKeyMode, NativeDispatchableKeyNames } from "../library";
import { resolveWithCustomResolver, type TargetResolverFn } from "./dom";

/**
 * Bridge to the host keyboard's target state and navigation handling. Kept as
 * callbacks (matching the sibling `FocusClaimService` / `TargetInputSession`
 * pattern) so the F-key dispatch logic stays free of UI5 control internals.
 */
export interface FKeyHost {
  getFKeyMode(): FKeyMode;
  /** Focus DOM ref of the active target, or null when there is none. */
  getTargetFocusDomRef(): Element | null;
  getEffectiveResolver(): TargetResolverFn | null;
  /** Moves the caret in the target input for a navigation/function key. */
  handleNavigationKey(fkeyName: string): void;
}

/**
 * Dispatches an F-key according to `fKeyMode` (mirrors the web component's
 * `_handleFKey`). The cancelable keyPress is expected to have already fired and
 * not been prevented before {@link handle} is called.
 *
 * `fKeyMode="Native"` synthesizes a real `keydown` on the target and, when not
 * canceled, runs the built-in browser action (F5 reload / F11 fullscreen) and
 * moves the caret for navigation keys.
 */
export default class FKeyController {
  /** Native actions executed in `fKeyMode="Native"` when not prevented. */
  private static readonly _NATIVE_FKEY_ACTIONS = new Map<string, () => void>([
    [
      "F5",
      () => {
        location.reload();
      },
    ],
    [
      "F11",
      () => {
        if (document.fullscreenElement) {
          void document.exitFullscreen?.().catch(() => undefined);
        } else {
          void document.documentElement.requestFullscreen?.().catch(() => undefined);
        }
      },
    ],
  ]);

  /** Tracks unsupported native F-key names already warned about. */
  private static readonly _WARNED_UNSUPPORTED_NATIVE_FKEYS = new Set<string>();

  /** Internal set used for O(1) native-dispatch allowlist checks. */
  private static readonly _NATIVE_DISPATCHABLE_FKEYS = new Set<string>(NativeDispatchableKeyNames);

  /** Clears the page-level unsupported-fkey warning dedup (call on last-instance exit). */
  static clearWarnings(): void {
    FKeyController._WARNED_UNSUPPORTED_NATIVE_FKEYS.clear();
  }

  constructor(private readonly _host: FKeyHost) {}

  handle(fkeyName: string, shiftKey: boolean): void {
    const fKeyMode = this._host.getFKeyMode();

    if (fKeyMode === FKeyMode.None) {
      return;
    }

    let nativeAllowed = true;

    if (fKeyMode === FKeyMode.Native) {
      if (FKeyController._isNativeDispatchableFKey(fkeyName)) {
        nativeAllowed = this._dispatchNativeFKeydown(fkeyName, shiftKey);
        if (nativeAllowed) {
          FKeyController._executeNativeFKeyAction(fkeyName);
        }
      } else {
        nativeAllowed = false;
        if (!FKeyController._WARNED_UNSUPPORTED_NATIVE_FKEYS.has(fkeyName)) {
          FKeyController._WARNED_UNSUPPORTED_NATIVE_FKEYS.add(fkeyName);
          Log.warning(
            `Ignored native dispatch for unsupported fkey "${fkeyName}". ` +
              "Only standard function/navigation keys are dispatched in fKeyMode=Native.",
            undefined,
            "ui5.kiosk.KioskKeyboard",
          );
        }
      }
    }

    if (nativeAllowed) {
      this._host.handleNavigationKey(fkeyName);
    }
  }

  /** Best-effort event target used for synthetic native F-key dispatch. */
  private _resolveNativeFKeyTarget(): EventTarget {
    const target = this._host.getTargetFocusDomRef();
    const textual = resolveWithCustomResolver(target, this._host.getEffectiveResolver());
    if (textual) return textual;
    if (target instanceof HTMLElement) return target;
    if (document.activeElement instanceof HTMLElement) return document.activeElement;
    return document;
  }

  /**
   * Dispatches synthetic `keydown` for an F-key and returns whether it was not canceled.
   *
   * The current allowlist (F1-F12, Arrow*, Home/End, PageUp/Down) has
   * `KeyboardEvent.code === KeyboardEvent.key` for every entry, so the same
   * string is used for both. Extending the allowlist to a key where the two
   * diverge (e.g. `NumpadEnter` has `key: "Enter"` / `code: "NumpadEnter"`)
   * requires routing `code` through an explicit lookup at that point.
   */
  private _dispatchNativeFKeydown(fkeyName: string, shiftKey: boolean): boolean {
    const nativeEvent = new KeyboardEvent("keydown", {
      key: fkeyName,
      code: fkeyName,
      bubbles: true,
      cancelable: true,
      shiftKey,
    });

    return this._resolveNativeFKeyTarget().dispatchEvent(nativeEvent);
  }

  private static _executeNativeFKeyAction(fkeyName: string): void {
    FKeyController._NATIVE_FKEY_ACTIONS.get(fkeyName)?.();
  }

  private static _isNativeDispatchableFKey(fkeyName: string): boolean {
    return FKeyController._NATIVE_DISPATCHABLE_FKEYS.has(fkeyName);
  }
}
