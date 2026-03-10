/**
 * Internal construction token - prevents direct instantiation of classes
 * that should only be created by their owning factory (e.g., EventDispatcher
 * creates KeyStateTracker, HotkeyManager.createRecorder() creates HotkeyRecorder).
 *
 * Not exported from the library barrel.
 * @internal
 */
export const INTERNAL_TOKEN: unique symbol = Symbol("ui5.hotkeys.internal");
