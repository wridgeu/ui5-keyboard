import { handleNavigation } from "./input-operations.js";
import type { FKeyMode } from "../types.js";

// ── Native-dispatchable key allowlist ──
// Exported as the single source for both F-key dispatch and the physical-key
// highlight (which maps these to `{fkey:*}` data-keys).
export const NATIVE_DISPATCHABLE_KEYS = new Set([
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

/** Built-in native actions executed in fKeyMode="Native" when not prevented. */
const NATIVE_FKEY_ACTIONS = new Map<string, () => void>([
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

/**
 * Unsupported fkey names already warned about, per page: a custom element has no
 * last-instance destroy boundary (`onExitDOM` fires on every transient detach).
 */
const warnedUnsupportedFKeys = new Set<string>();

/** The keydowns {@link FKeyController} synthesizes, which carry no real modifier state. */
const ownDispatches = new WeakSet<Event>();

/** Whether `e` is a keydown an on-screen F-key synthesized rather than a real key press. */
export function isFKeyDispatch(e: Event): boolean {
  return ownDispatches.has(e);
}

/**
 * Bridge to the host keyboard's mode and target resolution. Kept as callbacks
 * so the F-key dispatch logic stays free of element internals.
 */
export interface FKeyHost {
  getFKeyMode(): `${FKeyMode}`;
  /** Resolved native input/textarea of the active target, or null. */
  resolveTarget(): HTMLInputElement | HTMLTextAreaElement | null;
}

/**
 * Dispatches an F-key according to `fKeyMode`. The cancelable key-press is expected to have already fired
 * and not been prevented before {@link handle} is called.
 *
 * `fKeyMode="Native"` synthesizes a real `keydown` on the target and, when not
 * canceled, runs the built-in browser action (F5 reload / F11 fullscreen) and
 * moves the caret for navigation keys.
 */
export class FKeyController {
  constructor(private readonly _host: FKeyHost) {}

  handle(fkeyName: string, shiftKey: boolean): void {
    const mode = this._host.getFKeyMode();
    if (mode === "None") return;

    let nativeAllowed = true;

    if (mode === "Native") {
      if (NATIVE_DISPATCHABLE_KEYS.has(fkeyName)) {
        nativeAllowed = this._dispatchNativeFKeydown(fkeyName, shiftKey);
        if (nativeAllowed) {
          NATIVE_FKEY_ACTIONS.get(fkeyName)?.();
        }
      } else {
        nativeAllowed = false;
        if (!warnedUnsupportedFKeys.has(fkeyName)) {
          warnedUnsupportedFKeys.add(fkeyName);
          console.warn(
            `[kiosk-keyboard] Ignored native dispatch for unsupported fkey "${fkeyName}". ` +
              "Only standard function/navigation keys are dispatched in fKeyMode=Native.",
          );
        }
      }
    }

    if (nativeAllowed) {
      const target = this._host.resolveTarget();
      if (target) {
        handleNavigation(target, fkeyName, undefined, shiftKey);
      }
    }
  }

  private _dispatchNativeFKeydown(fkeyName: string, shiftKey: boolean): boolean {
    const target = this._host.resolveTarget() ?? document.activeElement;
    if (!target) return true;
    const nativeEvent = new KeyboardEvent("keydown", {
      key: fkeyName,
      code: fkeyName,
      bubbles: true,
      cancelable: true,
      shiftKey,
    });
    ownDispatches.add(nativeEvent);
    return target.dispatchEvent(nativeEvent);
  }
}
