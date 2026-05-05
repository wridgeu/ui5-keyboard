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

/**
 * Layouts that serve as secondary views (not base alphabetic layouts).
 *
 * Keep in sync with `packages/kiosk-keyboard-webc/src/core/layout-registry.ts`.
 * The webc package re-declares the same set; sharing is intentionally avoided
 * so each package owns its module graph.
 *
 * @internal
 */
export const SECONDARY_LAYOUTS: ReadonlySet<string> = new Set(["numeric", "special", "fkeys", "nav"]);
