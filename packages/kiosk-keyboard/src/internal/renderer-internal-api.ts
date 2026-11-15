import type { KeyDefinition, LayoutDefinition } from "../types";
import type { KeyPosition } from "./dom";
import type { HighlightedKey } from "./physical-key-highlight";

/**
 * Internal bridge type for renderer/test access to renderer-only control helpers.
 *
 * KioskKeyboard exposes this via `_getRendererApi()`, which structurally
 * checks the returned object against this type at compile time - no unsafe
 * `as unknown as` cast needed.
 */
export type RendererInternalApi = {
  _isShiftActive(): boolean;
  _isCapsLock(): boolean;
  _getPressedKey(): KeyPosition | null;
  _getHighlightedKey(): HighlightedKey | null;
  _getResolvedLayout(): LayoutDefinition;
  _getLayoutLang(): string | undefined;
  _getKeyLabel(key: KeyDefinition): string;
  _getKeyAriaLabel(key: KeyDefinition): string;
};
