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
  // SAFETY: the single-string form of `sap.ui.require` probes synchronously - it returns the
  // export of an already-loaded module, or `undefined` when `sap.m` was never loaded, which the
  // check below handles. Under that name UI5 owns the module: `sap/m/InstanceManager` is a
  // singleton exposing the `hasOpenDialog` / `hasOpenPopover` predicates read here.
  const instanceManager = sap.ui.require("sap/m/InstanceManager") as InstanceManagerModule | undefined;
  return instanceManager ? instanceManager.hasOpenDialog() || instanceManager.hasOpenPopover() : false;
}
