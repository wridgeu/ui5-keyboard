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
    if (!FocusClaimService.isTextualInput(target)) return null;
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

  private static isTextualInput(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
    if (!isInputOrTextarea(el)) return false;
    if (el.disabled) return false;
    if (el.readOnly) return false;
    return el instanceof HTMLTextAreaElement || FocusClaimService.TEXTUAL_INPUT_TYPES.has(el.type);
  }
}
