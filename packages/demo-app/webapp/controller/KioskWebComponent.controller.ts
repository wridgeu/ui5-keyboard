import JSONModel from "sap/ui/model/json/JSONModel";
import type { Router$RouteMatchedEvent } from "sap/ui/core/routing/Router";
import { Scope } from "../constants";
import BaseController from "./BaseController";

// Register the <kiosk-keyboard> custom element (resolved by ui5-tooling-modules)
import "kiosk-keyboard-webc/dist/bundle.esm.js";

/**
 * Controller for the native `<kiosk-keyboard>` web component demo page.
 *
 * Wires the web component's events via the DOM (since bridge controls
 * forward DOM events) and manages lifecycle around route matching.
 *
 * @name demo.hotkeys.controller.KioskWebComponent
 */
export default class KioskWebComponent extends BaseController {
  private static readonly _MODEL_NAME = "webc";

  onInit(): void {
    this.getView()!.setModel(
      new JSONModel({
        lastKey: "None",
        layout: "qwerty",
      }),
      KioskWebComponent._MODEL_NAME,
    );

    this.getTypedComponent().getRouter().attachRouteMatched(this._onRouteMatched, this);
  }

  onExit(): void {
    this.getTypedComponent().getRouter().detachRouteMatched(this._onRouteMatched, this);
    this._detachKeyboardEvents();
  }

  onNavBack(): void {
    this._setKeyboardRouteActive(false);
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  private _onRouteMatched(event: Router$RouteMatchedEvent): void {
    const routeName = event.getParameter("name");
    this._setKeyboardRouteActive(routeName === Scope.KioskWebComponent);
  }

  private _setKeyboardRouteActive(active: boolean): void {
    const host = this._getKeyboardHost();
    if (!host) return;

    if (active) {
      host.setAttribute("auto-show", "");
      this._attachKeyboardEvents();
      return;
    }

    // Deactivate: close keyboard and detach events
    if (typeof (host as HTMLElement & { close?: () => void }).close === "function") {
      (host as HTMLElement & { close: () => void }).close();
    }
    host.removeAttribute("auto-show");
    this._detachKeyboardEvents();

    const viewModel = this._getViewModel();
    viewModel.setProperty("/lastKey", "None");
    viewModel.setProperty("/layout", "qwerty");
  }

  private _onKeyPress = (e: Event): void => {
    const detail = (e as CustomEvent).detail ?? {};
    const key = detail.key ?? "";
    const shift = detail.shiftKey ?? false;
    this._getViewModel().setProperty("/lastKey", shift ? `${key} (Shift)` : key);
  };

  private _onLayoutChange = (e: Event): void => {
    const detail = (e as CustomEvent).detail ?? {};
    this._getViewModel().setProperty("/layout", detail.layout ?? "");
  };

  private _attachKeyboardEvents(): void {
    const host = this._getKeyboardHost();
    if (!host) return;
    host.addEventListener("key-press", this._onKeyPress);
    host.addEventListener("layout-change", this._onLayoutChange);
  }

  private _detachKeyboardEvents(): void {
    const host = this._getKeyboardHost();
    if (!host) return;
    host.removeEventListener("key-press", this._onKeyPress);
    host.removeEventListener("layout-change", this._onLayoutChange);
  }

  private _getKeyboardHost(): HTMLElement | null {
    const control = this.byId("webcKeyboard");
    return control?.getDomRef() as HTMLElement | null;
  }

  private _getViewModel(): JSONModel {
    return this.getView()!.getModel(KioskWebComponent._MODEL_NAME) as JSONModel;
  }
}
