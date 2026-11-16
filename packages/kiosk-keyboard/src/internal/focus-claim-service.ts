import Control from "sap/ui/core/Control";
import ManagedObject from "sap/ui/base/ManagedObject";
import Element from "sap/ui/core/Element";
import { isInputOrTextarea } from "./dom";

/**
 * Encapsulates focus-based input claim decisions for docked auto-show mode.
 */
export default class FocusClaimService {
  /** Text-entry input types eligible for auto-claim. */
  private static readonly TEXTUAL_INPUT_TYPES: ReadonlySet<string> = new Set([
    "text",
    "search",
    "url",
    "tel",
    "email",
    "password",
    "number",
  ]);

  constructor(
    private readonly getControls: () => string[],
    private readonly getResolvedControlIds: () => ReadonlySet<string>,
    private readonly shouldDeferToNative: () => boolean,
    private readonly isTargetOfOther: (inputId: string) => boolean,
  ) {}

  wouldClaimInput(target: EventTarget | null): boolean {
    return this.resolveClaimableControl(target) !== null;
  }

  resolveClaimableControl(target: EventTarget | null): Control | null {
    if (!(target instanceof HTMLElement)) return null;
    if (!FocusClaimService.isTextualInput(FocusClaimService.focusedWithin(target))) return null;
    if (this.shouldDeferToNative()) return null;

    const ui5Control = Element.closestTo(target);
    if (!(ui5Control instanceof Control)) return null;
    if (this.isTargetOfOther(ui5Control.getId())) return null;

    const ids = this.getControls();
    if (ids.length > 0 && !this.isInControls(ui5Control)) return null;
    return ui5Control;
  }

  isInControls(control: Control): boolean {
    return this.resolveControlsAncestor(control) !== null;
  }

  resolveControlsAncestor(candidate: Control): Control | null {
    const resolvedIds = this.getResolvedControlIds();
    if (resolvedIds.size === 0) return null;

    for (let parent: ManagedObject | null = candidate; parent; parent = parent.getParent()) {
      if (parent instanceof Control && resolvedIds.has(parent.getId())) return parent;
    }

    return null;
  }

  /**
   * The element that actually holds focus under `el`. A focus event or
   * `document.activeElement` reaching the document from a web component
   * (`ui5-input`) is retargeted to the host, while its native input sits in an
   * open shadow root; the host stays the node `Element.closestTo` resolves.
   */
  private static focusedWithin(el: HTMLElement): globalThis.Element {
    let focused: globalThis.Element = el;
    while (focused.shadowRoot?.activeElement) {
      focused = focused.shadowRoot.activeElement;
    }
    return focused;
  }

  private static isTextualInput(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
    if (!isInputOrTextarea(el)) return false;
    if (el.disabled) return false;
    if (el.readOnly) return false;
    return el instanceof HTMLTextAreaElement || FocusClaimService.TEXTUAL_INPUT_TYPES.has(el.type);
  }
}
