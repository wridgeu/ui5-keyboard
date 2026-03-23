import Popover from "sap/m/Popover";
import type { Button$PressEvent } from "sap/m/Button";
import type Input from "sap/m/Input";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { Scope } from "../constants";
import BaseController from "./BaseController";

interface PopoverVariant {
  styleClass: string;
  ariaLabel: string;
  title: string;
}

const VARIANTS: Record<string, PopoverVariant> = {
  A: { styleClass: "demoPopoverKbGenerous", ariaLabel: "Virtual Keyboard (generous)", title: "Generous (19 rem)" },
  B: { styleClass: "demoPopoverKbCompact", ariaLabel: "Virtual Keyboard (compact)", title: "Compact (15 rem)" },
  C: { styleClass: "demoPopoverKbCustomVars", ariaLabel: "Virtual Keyboard (custom vars)", title: "Custom CSS Vars" },
};

/**
 * Popover-mounted keyboard demo showing three sizing strategies.
 *
 * All three set a fixed height on the keyboard element itself so the
 * responsive height breakpoints can detect the constraint. The Popover
 * sizes to its content automatically.
 *
 * A) Generous height (19 rem) -- full-size keys, no breakpoints triggered
 * B) Compact height (15 rem)  -- triggers cq-short, keys shrink to 2.25 rem
 * C) Custom CSS vars          -- reduce key height so keyboard fits naturally
 *
 * @name demo.hotkeys.controller.KioskPopover
 */
export default class KioskPopover extends BaseController {
  private _keyboards = new Map<string, KioskKeyboard>();
  private _popovers = new Map<string, Popover>();

  onOpenKeyboardA(event: Button$PressEvent): void {
    this._openVariant("A", event);
  }

  onOpenKeyboardB(event: Button$PressEvent): void {
    this._openVariant("B", event);
  }

  onOpenKeyboardC(event: Button$PressEvent): void {
    this._openVariant("C", event);
  }

  private _openVariant(key: string, event: Button$PressEvent): void {
    const variant = VARIANTS[key];
    const button = event.getSource();
    const input = this.byId(button.data("inputId") as string) as Input;

    let keyboard = this._keyboards.get(key);
    if (!keyboard) {
      keyboard = new KioskKeyboard({ keyboardType: "Full", ariaLabel: variant.ariaLabel });
      keyboard.addStyleClass(variant.styleClass);
      this._keyboards.set(key, keyboard);
    }
    keyboard.setTargetInput(input);

    let popover = this._popovers.get(key);
    if (!popover) {
      popover = new Popover({ title: variant.title, placement: "Auto", content: [keyboard], contentWidth: "24rem" });
      this.getView()!.addDependent(popover);
      this._popovers.set(key, popover);
    }

    popover.openBy(button);
  }

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  onExit(): void {
    for (const popover of this._popovers.values()) {
      popover.destroy();
    }
    this._popovers.clear();
    this._keyboards.clear();
  }
}
