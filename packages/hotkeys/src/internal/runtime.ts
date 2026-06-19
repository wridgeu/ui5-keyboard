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

function hasOpenPopup(): boolean {
  const instanceManager = sap.ui.require("sap/m/InstanceManager") as InstanceManagerModule | undefined;
  return instanceManager ? instanceManager.hasOpenDialog() || instanceManager.hasOpenPopover() : false;
}

export const runtimeHooks: RuntimeHooks = {
  detectPlatform,
  hasOpenPopup,
};
