import InstanceManager from "sap/m/InstanceManager";

/**
 * Stub `sap.m.InstanceManager`, the collaborator `HotkeyManager` probes to decide
 * popup-aware suppression. Pins `hasOpenPopover` to `false` and returns the
 * `hasOpenDialog` stub so a caller can set or toggle the open state within a test
 * (`.returns(false)`, `.callsFake(...)`).
 */
export function stubPopupOpen(sandbox: sinon.SinonSandbox, open = false): sinon.SinonStub {
  sandbox.stub(InstanceManager, "hasOpenPopover").returns(false);
  return sandbox.stub(InstanceManager, "hasOpenDialog").returns(open);
}
