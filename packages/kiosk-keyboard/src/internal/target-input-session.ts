import Element from "sap/ui/core/Element";
import { isInputOrTextarea } from "./dom";
import {
  insertText as opsInsertText,
  handleBackspace as opsHandleBackspace,
  fireTargetChange as opsFireTargetChange,
} from "./input-operations";

/**
 * Tracks target input editing session state (cursor + dirty flag).
 */
export default class TargetInputSession {
  private _cursorPos: [number, number] | null = null;
  private _targetDirty = false;

  constructor(private readonly _getTargetElement: () => Element | null) {}

  resetForTargetSwitch(): void {
    this._cursorPos = null;
  }

  insertText(text: string): void {
    const dom = this._getTargetDomRef();
    if (!dom) return;
    this._cursorPos = opsInsertText(dom, text, this._cursorPos ?? undefined);
    this._targetDirty = true;
  }

  handleBackspace(): void {
    const dom = this._getTargetDomRef();
    if (!dom) return;

    const pos = opsHandleBackspace(dom, this._cursorPos ?? undefined);
    if (!pos) return;

    this._cursorPos = pos;
    this._targetDirty = true;
  }

  handleEnter(): void {
    const dom = this._getTargetDomRef();
    if (dom instanceof HTMLTextAreaElement) {
      this._cursorPos = opsInsertText(dom, "\n", this._cursorPos ?? undefined);
      return;
    }

    if (dom instanceof HTMLInputElement) {
      const element = this._getTargetElement();
      if (element) opsFireTargetChange(element, dom.value);
      this._targetDirty = false;
    }
  }

  fireChangeIfDirty(): void {
    if (!this._targetDirty) return;
    this._targetDirty = false;

    const element = this._getTargetElement();
    if (!element) return;

    const dom = element.getFocusDomRef();
    if (dom instanceof HTMLTextAreaElement) return;
    if (isInputOrTextarea(dom)) {
      opsFireTargetChange(element, dom.value);
    }
  }

  private _getTargetDomRef(): HTMLInputElement | HTMLTextAreaElement | null {
    const element = this._getTargetElement();
    if (!element) return null;

    const dom = element.getFocusDomRef();
    if (!isInputOrTextarea(dom)) {
      return null;
    }

    if (document.activeElement === dom) {
      this._cursorPos = [dom.selectionStart ?? dom.value.length, dom.selectionEnd ?? dom.value.length];
    } else if (this._cursorPos === null) {
      const end = dom.value.length;
      this._cursorPos = [end, end];
    } else {
      const len = dom.value.length;
      if (this._cursorPos[0] > len || this._cursorPos[1] > len) {
        this._cursorPos = [Math.min(this._cursorPos[0], len), Math.min(this._cursorPos[1], len)];
      }
    }

    return dom;
  }
}
