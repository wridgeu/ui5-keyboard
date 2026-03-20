import Popover from "sap/m/Popover";
import type { Button$PressEvent } from "sap/m/Button";
import type Input from "sap/m/Input";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { Scope } from "../constants";
import BaseController from "./BaseController";

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
  private _popoverA: Popover | null = null;
  private _keyboardA: KioskKeyboard | null = null;

  private _popoverB: Popover | null = null;
  private _keyboardB: KioskKeyboard | null = null;

  private _popoverC: Popover | null = null;
  private _keyboardC: KioskKeyboard | null = null;

  // ── A) Generous height on the keyboard element ──

  onOpenKeyboardA(event: Button$PressEvent): void {
    const button = event.getSource();
    const input = this.byId(button.data("inputId") as string) as Input;

    if (!this._keyboardA) {
      this._keyboardA = new KioskKeyboard({
        keyboardType: "Full",
        ariaLabel: "Virtual Keyboard (generous)",
      });
      this._keyboardA.addStyleClass("demoPopoverKbGenerous");
    }
    this._keyboardA.setTargetInput(input);

    if (!this._popoverA) {
      this._popoverA = new Popover({
        title: "Generous (19 rem)",
        placement: "Auto",
        content: [this._keyboardA],
        contentWidth: "24rem",
      });
      this.getView()!.addDependent(this._popoverA);
    }

    this._popoverA.openBy(button);
  }

  // ── B) Compact height on the keyboard element (triggers cq-short) ──

  onOpenKeyboardB(event: Button$PressEvent): void {
    const button = event.getSource();
    const input = this.byId(button.data("inputId") as string) as Input;

    if (!this._keyboardB) {
      this._keyboardB = new KioskKeyboard({
        keyboardType: "Full",
        ariaLabel: "Virtual Keyboard (compact)",
      });
      this._keyboardB.addStyleClass("demoPopoverKbCompact");
    }
    this._keyboardB.setTargetInput(input);

    if (!this._popoverB) {
      this._popoverB = new Popover({
        title: "Compact (15 rem)",
        placement: "Auto",
        content: [this._keyboardB],
        contentWidth: "24rem",
      });
      this.getView()!.addDependent(this._popoverB);
    }

    this._popoverB.openBy(button);
  }

  // ── C) Custom CSS variables to fit naturally ──

  onOpenKeyboardC(event: Button$PressEvent): void {
    const button = event.getSource();
    const input = this.byId(button.data("inputId") as string) as Input;

    if (!this._keyboardC) {
      this._keyboardC = new KioskKeyboard({
        keyboardType: "Full",
        ariaLabel: "Virtual Keyboard (custom vars)",
      });
      this._keyboardC.addStyleClass("demoPopoverKbCustomVars");
    }
    this._keyboardC.setTargetInput(input);

    if (!this._popoverC) {
      this._popoverC = new Popover({
        title: "Custom CSS Vars",
        placement: "Auto",
        content: [this._keyboardC],
        contentWidth: "24rem",
      });
      this.getView()!.addDependent(this._popoverC);
    }

    this._popoverC.openBy(button);
  }

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  onExit(): void {
    this._popoverA?.destroy();
    this._popoverA = null;
    this._keyboardA = null;

    this._popoverB?.destroy();
    this._popoverB = null;
    this._keyboardB = null;

    this._popoverC?.destroy();
    this._popoverC = null;
    this._keyboardC = null;
  }
}
