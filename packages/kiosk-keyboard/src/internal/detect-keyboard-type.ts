import Control from "sap/ui/core/Control";
import type Input from "sap/m/Input";
import ManagedObject from "sap/ui/base/ManagedObject";
import { resolveWithCustomResolver, type TargetResolverFn } from "./dom";
import { KeyboardType, type KeyboardTypeValue } from "../library";

/** Numeric input types that map to Numpad keyboard. */
const NUMPAD_CONTROL_TYPES: ReadonlySet<string> = new Set(["Number", "Tel"]);
const NUMPAD_CONTROL_NAMES: ReadonlySet<string> = new Set(["sap.m.StepInput"]);
const NUMPAD_INPUT_MODES: ReadonlySet<string> = new Set(["numeric", "decimal", "tel"]);
const NUMPAD_HTML_TYPES: ReadonlySet<string> = new Set(["number", "tel"]);

/**
 * Detects whether the target control should use a Numpad or Full
 * keyboard type. Checks UI5 control type, control name, DOM
 * inputmode, and HTML type in order.
 */
export function detectKeyboardType(control: Control, customResolver?: TargetResolverFn | null): KeyboardTypeValue {
  // 1. UI5 getType() - e.g. sap.m.Input type="Number"
  //    Only sap.m.Input defines the `type` property; other InputBase
  //    subclasses (TextArea, ComboBox, DatePicker) do not have getType().
  if (control.isA("sap.m.Input")) {
    const type = (control as Input).getType();
    if (NUMPAD_CONTROL_TYPES.has(type)) return KeyboardType.Numpad;
  }

  // 2. Control name - walk up the parent chain because composite controls
  //    (e.g. sap.m.StepInput) wrap an inner sap.m.Input. Element.closestTo()
  //    returns the inner Input, but we need to match the outer StepInput.
  let parent: ManagedObject | null = control;
  for (let depth = 0; parent && depth < 100; depth++, parent = parent.getParent()) {
    if (parent instanceof Control) {
      const name = parent.getMetadata().getName();
      if (NUMPAD_CONTROL_NAMES.has(name)) return KeyboardType.Numpad;
    }
  }

  // 3. DOM inputmode attribute
  const dom = resolveWithCustomResolver(control.getFocusDomRef(), customResolver ?? null);
  if (dom) {
    const inputmode = dom.getAttribute("inputmode");
    if (inputmode && NUMPAD_INPUT_MODES.has(inputmode)) return KeyboardType.Numpad;

    // 4. HTML type attribute
    if (dom instanceof HTMLInputElement && NUMPAD_HTML_TYPES.has(dom.type)) {
      return KeyboardType.Numpad;
    }
  }

  return KeyboardType.Full;
}
