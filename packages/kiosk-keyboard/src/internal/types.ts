/**
 * Parameters of the `liveChange` and `change` events the keyboard fires on its
 * target: the value the target holds after the edit. `liveChange` carries it
 * under `newValue` as well, the name `sap.m.SearchField` declares it by.
 *
 * @internal
 */
export type TargetValueEventParameters = { value: string; newValue?: string };

/**
 * Minimal UI5 Element contract used by keyboard input operations.
 * Satisfied by `sap.ui.core.Element` and test mocks alike.
 *
 * @internal
 */
export interface TargetElement {
  getFocusDomRef(): Element | null;
  getMetadata(): {
    hasProperty(name: string): boolean;
    hasEvent(name: string): boolean;
  };
  fireEvent(name: string, params?: TargetValueEventParameters): void;
  setProperty(name: string, value: string): void;
}
