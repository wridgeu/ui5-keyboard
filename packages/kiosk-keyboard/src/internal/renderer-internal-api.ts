import type { KeyDefinition, LayoutDefinition } from "../types";
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
  /** Whether a pointer or keyboard press holds the key at this grid position. */
  _isKeyPressed(row: number, col: number): boolean;
  _getHighlightedKey(): HighlightedKey | null;
  _getResolvedLayout(): LayoutDefinition;
  _getLayoutLang(): string | undefined;
  _getKeyLabel(key: KeyDefinition): string;
  _getKeyAriaLabel(key: KeyDefinition): string;
};
