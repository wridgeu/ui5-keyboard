/** The slice of the host the controller resolves its target through. */
export interface NativeInputModeSuppressionHost {
  resolveTarget(): HTMLInputElement | HTMLTextAreaElement | null;
}

/**
 * Owns the ref-counted native-keyboard suppression for the web component:
 * setting `inputmode="none"` on the resolved target while the virtual keyboard
 * is open, and restoring the original `inputmode` when it closes.
 *
 * The suppression bookkeeping is shared across all instances via a static
 * `WeakMap` keyed on the input element, so two keyboards pointed at the same
 * input do not clobber each other's restore: each `suppress()` bumps a refcount
 * and only the last `restore()` writes the original value back. The `WeakMap`
 * needs no explicit cleanup; entries are released when the input is GC'd.
 *
 * Mirrors the sibling `kiosk-keyboard` package's `native-keyboard-suppression.ts`
 * (the responsibilities and refcount semantics match; only the DOM access differs:
 * the webc resolves a live element, the UI5 twin resolves by control id).
 */
export class NativeInputModeSuppression {
  private static readonly _suppressions = new WeakMap<HTMLElement, { original: string | null; refCount: number }>();
  private _suppressedElement: HTMLElement | null = null;

  /** @param _host Live access to the resolved native input/textarea. */
  constructor(private readonly _host: NativeInputModeSuppressionHost) {}

  suppress(): void {
    const target = this._host.resolveTarget();
    if (!target) return;

    const existing = NativeInputModeSuppression._suppressions.get(target);
    if (existing) {
      existing.refCount++;
    } else {
      NativeInputModeSuppression._suppressions.set(target, {
        original: target.getAttribute("inputmode"),
        refCount: 1,
      });
    }
    target.setAttribute("inputmode", "none");
    this._suppressedElement = target;
  }

  restore(): void {
    const el = this._suppressedElement;
    if (!el) return;

    const state = NativeInputModeSuppression._suppressions.get(el);
    if (state) {
      state.refCount--;
      if (state.refCount <= 0) {
        if (state.original !== null) {
          el.setAttribute("inputmode", state.original);
        } else {
          el.removeAttribute("inputmode");
        }
        NativeInputModeSuppression._suppressions.delete(el);
      }
    }
    this._suppressedElement = null;
  }
}
