import type { TargetElement } from "./types";
import { resolveWithCustomResolver } from "./dom";
import type { TargetResolver } from "../types";
import {
  insertText as opsInsertText,
  handleBackspace as opsHandleBackspace,
  handleNavigation as opsHandleNavigation,
  fireTargetChange as opsFireTargetChange,
} from "./input-operations";

/**
 * Tracks target input editing session state (cursor + dirty flag).
 */
export default class TargetInputSession {
  private _cursorPos: [number, number] | null = null;
  private _lastKnownValue: string | null = null;
  private _targetDirty = false;

  private _customResolver: TargetResolver | null = null;
  private _cursorSyncFrame: number | null = null;

  constructor(private readonly _getTargetElement: () => TargetElement | null) {}

  setTargetResolver(resolver: TargetResolver | null): void {
    this._customResolver = resolver;
  }

  resetForTargetSwitch(): void {
    this._cursorPos = null;
    this._lastKnownValue = null;
  }

  insertText(text: string): void {
    const dom = this._getTargetDomRef();
    if (!dom) return;
    const pos = opsInsertText(dom, text, this._cursorPos ?? undefined);
    if (!pos) return;
    this._trackCursor(pos, dom);
    this._lastKnownValue = dom.value;
    this._targetDirty = true;
  }

  /** Deletes one grapheme (or the selection). Returns whether anything was removed. */
  handleBackspace(): boolean {
    const dom = this._getTargetDomRef();
    if (!dom) return false;

    const pos = opsHandleBackspace(dom, this._cursorPos ?? undefined);
    if (!pos) return false;

    this._trackCursor(pos, dom);
    this._lastKnownValue = dom.value;
    this._targetDirty = true;
    return true;
  }

  handleEnter(): void {
    const dom = this._getTargetDomRef();
    if (dom instanceof HTMLTextAreaElement) {
      // Intentionally bypass this.insertText(): Enter in a textarea should only
      // insert a newline and must not mark the session dirty for change firing.
      // Textareas never emit change on Enter, and fireChangeIfDirty() also
      // skips textarea targets by design.
      const pos = opsInsertText(dom, "\n", this._cursorPos ?? undefined);
      if (!pos) return;
      this._trackCursor(pos, dom);
      this._lastKnownValue = dom.value;
      return;
    }

    if (dom instanceof HTMLInputElement) {
      const element = this._getTargetElement();
      if (element) opsFireTargetChange(element, dom.value);
      this._targetDirty = false;
    }
  }

  handleNavigationKey(key: string, extend = false): void {
    const dom = this._getTargetDomRef();
    if (!dom) return;

    const pos = opsHandleNavigation(dom, key, this._cursorPos ?? undefined, extend);
    if (!pos) return;
    this._trackCursor(pos, dom);
  }

  /**
   * Fires the pending `change` on the current target and clears the dirty flag.
   *
   * The capture and the fire happen in the same tick, so this is the immediate
   * form of {@link captureAndClearDirty} rather than a second implementation of
   * its guard chain.
   */
  fireChangeIfDirty(): void {
    this.captureAndClearDirty()?.();
  }

  /**
   * Captures the pending change state and clears the dirty flag.
   *
   * Returns a callback that fires the `change` event on the captured
   * element, or `null` when there is nothing to fire. Call the returned
   * function **after** all state transitions in `_setActiveTarget` have
   * completed so that any re-entrant call sees fully settled state.
   */
  captureAndClearDirty(): (() => void) | null {
    if (!this._targetDirty) return null;
    this._targetDirty = false;

    const element = this._getTargetElement();
    if (!element) return null;

    const dom = resolveWithCustomResolver(element.getFocusDomRef(), this._customResolver);
    if (dom instanceof HTMLTextAreaElement) return null;
    if (dom) {
      const value = dom.value;
      return () => opsFireTargetChange(element, value);
    }
    return null;
  }

  /**
   * Records the tracked caret. While the target is unfocused it is re-applied on
   * the next frame: the browser discards an unfocused input's selection in the
   * rendering step after a pointer activation, after the edit has written it.
   */
  private _trackCursor(pos: [number, number], dom: HTMLInputElement | HTMLTextAreaElement): void {
    this._cursorPos = pos;
    if (document.activeElement === dom) return;

    // The navigation op reads the anchor back from selectionDirection, so it
    // is restored along with the range.
    const direction = dom.selectionDirection ?? undefined;
    if (this._cursorSyncFrame !== null) cancelAnimationFrame(this._cursorSyncFrame);
    this._cursorSyncFrame = requestAnimationFrame(() => {
      this._cursorSyncFrame = null;
      if (!dom.isConnected || document.activeElement === dom) return;
      try {
        dom.setSelectionRange(pos[0], pos[1], direction);
      } catch {
        // May throw on certain input types (e.g. type="number")
      }
    });
  }

  private _getTargetDomRef(): HTMLInputElement | HTMLTextAreaElement | null {
    const element = this._getTargetElement();
    if (!element) return null;

    const dom = resolveWithCustomResolver(element.getFocusDomRef(), this._customResolver);
    if (!dom) {
      return null;
    }

    const value = dom.value;

    if (document.activeElement === dom) {
      this._cursorPos = [dom.selectionStart ?? dom.value.length, dom.selectionEnd ?? dom.value.length];
    } else if (this._cursorPos === null) {
      const end = dom.value.length;
      this._cursorPos = [end, end];
    } else if (this._lastKnownValue !== null && value !== this._lastKnownValue) {
      // The value changed while unfocused (e.g. programmatic setValue()) and
      // cached cursor coordinates may now point into unrelated content.
      const end = value.length;
      this._cursorPos = [end, end];
    } else {
      const len = dom.value.length;
      if (this._cursorPos[0] > len || this._cursorPos[1] > len) {
        this._cursorPos = [Math.min(this._cursorPos[0], len), Math.min(this._cursorPos[1], len)];
      }
    }

    this._lastKnownValue = value;

    return dom;
  }
}
