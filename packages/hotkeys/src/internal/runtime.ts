import type { Platform } from "../library";
import { detectPlatform } from "./platform";

type InstanceManagerModule = {
  hasOpenDialog(): boolean;
  hasOpenPopover(): boolean;
};

export type RuntimeHooks = {
  detectPlatform: () => Platform;
  hasOpenPopup: () => boolean;
};

let popupChecker: (() => boolean) | null = null;

function hasOpenPopup(): boolean {
  if (!popupChecker) {
    const instanceManager = sap.ui.require("sap/m/InstanceManager") as InstanceManagerModule | undefined;
    if (instanceManager) {
      popupChecker = () => instanceManager.hasOpenDialog() || instanceManager.hasOpenPopover();
    }
  }

  return popupChecker?.() ?? false;
}

export const runtimeHooks: RuntimeHooks = {
  detectPlatform,
  hasOpenPopup,
};

export function resetRuntimeCaches(): void {
  popupChecker = null;
}
