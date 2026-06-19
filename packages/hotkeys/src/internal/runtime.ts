type InstanceManagerModule = {
  hasOpenDialog(): boolean;
  hasOpenPopover(): boolean;
};

/**
 * Whether any UI5 popup (dialog or popover) is currently open.
 *
 * Probes `sap.m.InstanceManager` lazily via `sap.ui.require` so the library keeps
 * no hard dependency on `sap.m`; returns `false` when `sap.m` is not loaded.
 */
export function hasOpenPopup(): boolean {
  const instanceManager = sap.ui.require("sap/m/InstanceManager") as InstanceManagerModule | undefined;
  return instanceManager ? instanceManager.hasOpenDialog() || instanceManager.hasOpenPopover() : false;
}
