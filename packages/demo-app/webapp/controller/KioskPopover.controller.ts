import Popover from "sap/m/Popover";
import type Button from "sap/m/Button";
import type Input from "sap/m/Input";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { Scope } from "../constants";
import BaseController from "./BaseController";

/**
 * Popover-mounted keyboard demo — opens a Popover containing a
 * KioskKeyboard that targets the adjacent input field.
 *
 * The popover and keyboard are lazily created and reused across opens.
 *
 * @name demo.hotkeys.controller.KioskPopover
 */
export default class KioskPopover extends BaseController {
  private _popover!: Popover | null;
  private _keyboard!: KioskKeyboard | null;

  onInit(): void {
    this._popover = null;
    this._keyboard = null;
  }

  onOpenKeyboard(event: { getSource: () => Button }): void {
    const button = event.getSource();
    const inputId = button.data("key") as string;
    const input = this.byId(inputId) as Input;

    if (!this._keyboard) {
      this._keyboard = new KioskKeyboard({
        keyboardType: "Full",
        ariaLabel: "Virtual Keyboard",
        stableHeight: true,
      });
    }
    this._keyboard.setTargetInput(input);

    if (!this._popover) {
      this._popover = new Popover({
        title: "Virtual Keyboard",
        placement: "Bottom",
        content: [this._keyboard],
        contentWidth: "24rem",
      });
      this.getView()!.addDependent(this._popover);
    }

    this._popover.openBy(button);
  }

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  onExit(): void {
    this._popover?.destroy();
    this._popover = null;
    this._keyboard = null;
  }
}
