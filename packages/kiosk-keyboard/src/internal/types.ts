/**
 * Parameters of the `liveChange` and `change` events the keyboard fires on its
 * target: the value the target holds after the edit.
 *
 * @internal
 */
export type TargetValueEventParameters = { value: string };

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
