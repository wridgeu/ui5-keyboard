import type KioskKeyboard from "../KioskKeyboard";
import type { KeyDefinition, LayoutDefinition } from "../types";

/**
 * Internal bridge type for renderer/test access to renderer-only control helpers.
 */
export type RendererInternalApi = {
  _isShiftActive(): boolean;
  _isCapsLock(): boolean;
  _getResolvedLayout(): LayoutDefinition;
  _getKeyLabel(key: KeyDefinition): string;
  _getKeyAriaLabel(key: KeyDefinition): string;
};

export function asRendererInternalControl(control: KioskKeyboard): RendererInternalApi {
  return control as unknown as RendererInternalApi;
}
