/**
 * Shared test utilities for dispatching keyboard events.
 */

import HotkeyManager from "ui5/hotkeys/HotkeyManager";

function buildKeyEvent(type: "keydown" | "keyup", key: string, options?: Partial<KeyboardEvent>): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    key,
    bubbles: true,
    cancelable: true,
    ctrlKey: options?.ctrlKey ?? false,
    shiftKey: options?.shiftKey ?? false,
    altKey: options?.altKey ?? false,
    metaKey: options?.metaKey ?? false,
    repeat: options?.repeat ?? false,
  });
  if (options?.code !== undefined) {
    Object.defineProperty(event, "code", { value: options.code, writable: false });
  }
  if (options?.location !== undefined) {
    Object.defineProperty(event, "location", { value: options.location, writable: false });
  }
  return event;
}

/**
 * Create and dispatch a keydown event on document.
 */
export function fireKey(key: string, options?: Partial<KeyboardEvent>): KeyboardEvent {
  const event = buildKeyEvent("keydown", key, options);
  document.dispatchEvent(event);
  return event;
}

/**
 * Dispatch a keydown event on a specific element.
 * The HotkeyManager's capture-phase listener sees the correct composedPath target.
 */
export function fireKeyOn(target: EventTarget, key: string, options?: Partial<KeyboardEvent>): KeyboardEvent {
  const event = buildKeyEvent("keydown", key, options);
  target.dispatchEvent(event);
  return event;
}

/**
 * Dispatch a keyup event on document.
 */
export function fireKeyUp(key: string, options?: Partial<KeyboardEvent>): void {
  const event = buildKeyEvent("keyup", key, options);
  document.dispatchEvent(event);
}

/**
 * Dispatch a blur event on window.
 */
export function fireBlur(): void {
  window.dispatchEvent(new Event("blur"));
}

/**
 * Destroy the HotkeyManager singleton if it currently exists.
 */
export function destroyHotkeyManager(): void {
  try {
    HotkeyManager.getInstance().destroy();
  } catch {
    // Not initialized yet or already destroyed
  }
}

/**
 * Reset the HotkeyManager singleton and return a fresh instance.
 */
export function resetHotkeyManager(): HotkeyManager {
  destroyHotkeyManager();
  return HotkeyManager.getInstance();
}
