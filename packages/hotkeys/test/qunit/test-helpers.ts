/**
 * Shared test utilities for dispatching keyboard events.
 */

/**
 * Create and dispatch a keydown event on document.
 */
export function fireKey(key: string, options?: Partial<KeyboardEvent>): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
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
  document.dispatchEvent(event);
  return event;
}

/**
 * Dispatch a keydown event on a specific element.
 * The HotkeyManager's capture-phase listener sees the correct composedPath target.
 */
export function fireKeyOn(target: EventTarget, key: string, options?: Partial<KeyboardEvent>): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
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
  target.dispatchEvent(event);
  return event;
}

/**
 * Dispatch a keyup event on document.
 */
export function fireKeyUp(key: string, options?: Partial<KeyboardEvent>): void {
  const event = new KeyboardEvent("keyup", {
    key,
    bubbles: true,
    cancelable: true,
    ctrlKey: options?.ctrlKey ?? false,
    shiftKey: options?.shiftKey ?? false,
    altKey: options?.altKey ?? false,
    metaKey: options?.metaKey ?? false,
  });
  if (options?.code !== undefined) {
    Object.defineProperty(event, "code", { value: options.code, writable: false });
  }
  if (options?.location !== undefined) {
    Object.defineProperty(event, "location", { value: options.location, writable: false });
  }
  document.dispatchEvent(event);
}

/**
 * Dispatch a blur event on window.
 */
export function fireBlur(): void {
  window.dispatchEvent(new Event("blur"));
}
