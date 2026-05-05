import Popover from "sap/m/Popover";
import type { Button$PressEvent } from "sap/m/Button";
import type Input from "sap/m/Input";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { KeyboardType } from "ui5/kiosk/library";
import { Scope } from "../constants";
import BaseController from "./BaseController";

interface PopoverVariant {
  styleClass?: string;
  ariaLabel: string;
  title: string;
  contentHeight?: string;
}

const VARIANTS: Record<string, PopoverVariant> = {
  A: { styleClass: "demoPopoverKb--generous", ariaLabel: "Virtual Keyboard (generous)", title: "Generous (19 rem)" },
  B: { styleClass: "demoPopoverKb--compact", ariaLabel: "Virtual Keyboard (compact)", title: "Compact (15 rem)" },
  C: { styleClass: "demoPopoverKb--customVars", ariaLabel: "Virtual Keyboard (custom vars)", title: "Custom CSS Vars" },
  D: { styleClass: "demoPopoverKb--borderless", ariaLabel: "Virtual Keyboard (borderless)", title: "Borderless" },
  E: { ariaLabel: "Virtual Keyboard (automatic)", title: "Automatic (15 rem)", contentHeight: "15rem" },
};

/**
 * Popover-mounted keyboard demo showing four sizing strategies.
 *
 * A) Generous height (19 rem) -- full-size keys, no breakpoints triggered
 * B) Compact height (15 rem)  -- triggers cqShort, keys shrink to 2.25 rem
 * C) Custom CSS vars          -- reduce key height so keyboard fits naturally
 * D) Borderless               -- removes container border to blend with popover chrome
 * E) Popover contentHeight    -- demonstrates the limitation: intermediate wrappers break auto-detection
 *
 * @namespace demo.hotkeys.controller
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

  onOpenKeyboardD(event: Button$PressEvent): void {
    this._openVariant("D", event);
  }

  onOpenKeyboardE(event: Button$PressEvent): void {
    this._openVariant("E", event);
  }

  private _openVariant(key: string, event: Button$PressEvent): void {
    const variant = VARIANTS[key];
    if (!variant) return;
    const button = event.getSource();
    const input = this.byId(button.data("inputId") as string) as Input;

    let keyboard = this._keyboards.get(key);
    if (!keyboard) {
      keyboard = new KioskKeyboard({ keyboardType: KeyboardType.Full, ariaLabel: variant.ariaLabel });
      if (variant.styleClass) keyboard.addStyleClass(variant.styleClass);
      this._keyboards.set(key, keyboard);
    }
    keyboard.setControls([input.getId()]);

    let popover = this._popovers.get(key);
    if (!popover) {
      popover = new Popover({
        title: variant.title,
        placement: "Auto",
        content: [keyboard],
        contentWidth: "24rem",
        ...(variant.contentHeight ? { contentHeight: variant.contentHeight } : {}),
      });
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
