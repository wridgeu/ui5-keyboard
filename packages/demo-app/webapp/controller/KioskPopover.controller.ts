import Popover from "sap/m/Popover";
import type { Button$PressEvent } from "sap/m/Button";
import type Input from "sap/m/Input";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Popover-mounted keyboard demo showing three sizing strategies.
 *
 * A) Generous container  -- contentHeight="19rem", full-size keys
 * B) Compact container   -- contentHeight="16rem", triggers cq-short
 * C) Height on keyboard  -- no contentHeight, fixed height on keyboard element
 *
 * Each scenario lazily creates and reuses its own Popover + KioskKeyboard.
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

  // ── A) Generous container (19 rem) ──

  onOpenKeyboardA(event: Button$PressEvent): void {
    const button = event.getSource();
    const input = this.byId(button.data("inputId") as string) as Input;

    if (!this._keyboardA) {
      this._keyboardA = new KioskKeyboard({
        keyboardType: "Full",
        ariaLabel: "Virtual Keyboard (generous)",
      });
    }
    this._keyboardA.setTargetInput(input);

    if (!this._popoverA) {
      this._popoverA = new Popover({
        title: "Generous (19 rem)",
        placement: "Bottom",
        content: [this._keyboardA],
        contentWidth: "24rem",
        contentHeight: "19rem",
      });
      this.getView()!.addDependent(this._popoverA);
    }

    this._popoverA.openBy(button);
  }

  // ── B) Compact container (16 rem, triggers cq-short) ──

  onOpenKeyboardB(event: Button$PressEvent): void {
    const button = event.getSource();
    const input = this.byId(button.data("inputId") as string) as Input;

    if (!this._keyboardB) {
      this._keyboardB = new KioskKeyboard({
        keyboardType: "Full",
        ariaLabel: "Virtual Keyboard (compact)",
      });
    }
    this._keyboardB.setTargetInput(input);

    if (!this._popoverB) {
      this._popoverB = new Popover({
        title: "Compact (16 rem)",
        placement: "Bottom",
        content: [this._keyboardB],
        contentWidth: "24rem",
        contentHeight: "16rem",
      });
      this.getView()!.addDependent(this._popoverB);
    }

    this._popoverB.openBy(button);
  }

  // ── C) Height on the keyboard element ──

  onOpenKeyboardC(event: Button$PressEvent): void {
    const button = event.getSource();
    const input = this.byId(button.data("inputId") as string) as Input;

    if (!this._keyboardC) {
      this._keyboardC = new KioskKeyboard({
        keyboardType: "Full",
        ariaLabel: "Virtual Keyboard (element height)",
      });
      // Fixed height directly on the keyboard element, not on the Popover.
      // The keyboard's responsive breakpoints adapt automatically.
      this._keyboardC.addStyleClass("demoPopoverKeyboardFixedHeight");
    }
    this._keyboardC.setTargetInput(input);

    if (!this._popoverC) {
      this._popoverC = new Popover({
        title: "Element Height (18 rem)",
        placement: "Bottom",
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
