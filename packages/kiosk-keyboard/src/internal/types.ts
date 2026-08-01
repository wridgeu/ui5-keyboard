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
  fireEvent(name: string, params?: Record<string, unknown>): void;
  setProperty(name: string, value: unknown): void;
}
