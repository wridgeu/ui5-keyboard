import type { TargetElement } from "../types";
import { resolveWithCustomResolver, type TargetResolverFn } from "./dom";
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

  private _customResolver: TargetResolverFn | null = null;

  constructor(private readonly _getTargetElement: () => TargetElement | null) {}

  setTargetResolver(resolver: TargetResolverFn | null): void {
    this._customResolver = resolver;
  }

  resetForTargetSwitch(): void {
    this._cursorPos = null;
    this._lastKnownValue = null;
  }

  insertText(text: string): void {
    const dom = this._getTargetDomRef();
    if (!dom) return;
    this._cursorPos = opsInsertText(dom, text, this._cursorPos ?? undefined, this._customResolver);
    this._lastKnownValue = dom.value;
    this._targetDirty = true;
  }

  handleBackspace(): void {
    const dom = this._getTargetDomRef();
    if (!dom) return;

    const pos = opsHandleBackspace(dom, this._cursorPos ?? undefined, this._customResolver);
    if (!pos) return;

    this._cursorPos = pos;
    this._lastKnownValue = dom.value;
    this._targetDirty = true;
  }

  handleEnter(): void {
    const dom = this._getTargetDomRef();
    if (dom instanceof HTMLTextAreaElement) {
      // Intentionally bypass this.insertText(): Enter in a textarea should only
      // insert a newline and must not mark the session dirty for change firing.
      // Textareas never emit change on Enter, and fireChangeIfDirty() also
      // skips textarea targets by design.
      this._cursorPos = opsInsertText(dom, "\n", this._cursorPos ?? undefined, this._customResolver);
      this._lastKnownValue = dom.value;
      return;
    }

    if (dom instanceof HTMLInputElement) {
      const element = this._getTargetElement();
      if (element) opsFireTargetChange(element, dom.value);
      this._targetDirty = false;
    }
  }

  handleNavigationKey(key: string): void {
    const dom = this._getTargetDomRef();
    if (!dom) return;

    const pos = opsHandleNavigation(dom, key, this._cursorPos ?? undefined);
    if (!pos) return;
    this._cursorPos = pos;
  }

  fireChangeIfDirty(): void {
    if (!this._targetDirty) return;
    this._targetDirty = false;

    const element = this._getTargetElement();
    if (!element) return;

    const dom = resolveWithCustomResolver(element.getFocusDomRef(), this._customResolver);
    if (dom instanceof HTMLTextAreaElement) return;
    if (dom) {
      opsFireTargetChange(element, dom.value);
    }
  }

  /**
   * Captures the pending change state and clears the dirty flag.
   *
   * Returns a callback that fires the `change` event on the captured
   * element, or `null` when there is nothing to fire. Call the returned
   * function **after** all state transitions in `setTargetInput` have
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
