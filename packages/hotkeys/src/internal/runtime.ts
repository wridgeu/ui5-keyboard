import type { Platform } from "../types";
import { detectPlatform as detectPlatformDefault } from "./platform";

type InstanceManagerModule = {
  hasOpenDialog(): boolean;
  hasOpenPopover(): boolean;
};

export type RuntimeHooks = {
  detectPlatform: () => Platform;
  hasOpenPopup: () => boolean;
};

let popupChecker: (() => boolean) | null = null;

function hasOpenPopupDefault(): boolean {
  if (!popupChecker) {
    const instanceManager = sap.ui.require("sap/m/InstanceManager") as InstanceManagerModule | undefined;
    if (instanceManager) {
      popupChecker = () => instanceManager.hasOpenDialog() || instanceManager.hasOpenPopover();
    }
  }

  return popupChecker?.() ?? false;
}

const defaultRuntimeHooks: RuntimeHooks = {
  detectPlatform: detectPlatformDefault,
  hasOpenPopup: hasOpenPopupDefault,
};

export const runtimeHooks: RuntimeHooks = {
  detectPlatform: defaultRuntimeHooks.detectPlatform,
  hasOpenPopup: defaultRuntimeHooks.hasOpenPopup,
};

export function setRuntimeHooks(overrides: Partial<RuntimeHooks>): () => void {
  const previous: RuntimeHooks = {
    detectPlatform: runtimeHooks.detectPlatform,
    hasOpenPopup: runtimeHooks.hasOpenPopup,
  };

  if (overrides.detectPlatform) {
    runtimeHooks.detectPlatform = overrides.detectPlatform;
  }
  if (overrides.hasOpenPopup) {
    runtimeHooks.hasOpenPopup = overrides.hasOpenPopup;
  }

  return () => {
    runtimeHooks.detectPlatform = previous.detectPlatform;
    runtimeHooks.hasOpenPopup = previous.hasOpenPopup;
  };
}

export function resetRuntimeCaches(): void {
  popupChecker = null;
}
